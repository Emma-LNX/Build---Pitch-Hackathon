import { api, ApiError, studentAccessToken, tokenSubject } from '../../lib/api';
import { getDailyCheckIn, pendingDailyCheckIns, putDailyCheckIn, saveDailyCheckIn } from '../storage/db';
import type { DailyCheckIn } from '../../types';

/** Las cuentas escolares se crean con esta zona en el backend; el día se cuenta igual en ambos lados. */
export const CHECK_IN_TIME_ZONE = 'America/Guatemala';
const TIMEOUT_MS = 2500;

type RemoteEntry = Omit<DailyCheckIn, 'studentId' | 'synced' | 'syncError'>;
type Today = { date: string; required: boolean; checkIn: RemoteEntry | null };
export type CheckInAnswers = Pick<DailyCheckIn, 'sleepHours' | 'food' | 'mood'>;

const running = new Map<string, Promise<void>>();

/** Fecha YYYY-MM-DD en la zona del alumno. */
export function checkInDate(timeZone = CHECK_IN_TIME_ZONE, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** `null` sin conexión, sin sesión o si la sesión activa pertenece a otra cuenta. */
async function ownToken(studentId: string): Promise<string | null> {
  if (!navigator.onLine) return null;
  const token = await studentAccessToken().catch(() => null);
  return token && tokenSubject(token) === studentId ? token : null;
}

function withTimeout<T>(task: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([task, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), TIMEOUT_MS + 500))]);
}

/** Envía los registros pendientes de la cuenta. La fecha de cada uno se conserva aunque se envíe días después. */
export function syncDailyCheckIns(studentId: string): Promise<void> {
  let task = running.get(studentId);
  if (!task) {
    task = (async () => {
      if (!(await ownToken(studentId))) return;
      for (const entry of await pendingDailyCheckIns(studentId)) {
        try {
          const saved = await api<RemoteEntry>('/students/me/daily-check-in/sync', {
            method: 'POST',
            body: { date: entry.date, answers: { sleepHours: entry.sleepHours, food: entry.food, mood: entry.mood } },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          await putDailyCheckIn({ ...saved, studentId, synced: true });
        } catch (error) {
          // Un registro inválido no bloquea los demás días; sin conexión o sin sesión se reintenta después.
          if (error instanceof ApiError && error.status === 400) await putDailyCheckIn({ ...entry, syncError: error.message });
          else return;
        }
      }
    })().finally(() => running.delete(studentId));
    running.set(studentId, task);
  }
  return task;
}

/** ¿Ya respondió hoy? Primero en este teléfono; si no, en el servidor (pudo responder en otro teléfono). */
export async function hasCheckedInToday(studentId: string): Promise<boolean> {
  if (await getDailyCheckIn(studentId, checkInDate())) return true;
  return withTimeout((async () => {
    if (!(await ownToken(studentId))) return false;
    try {
      const today = await api<Today>('/students/me/daily-check-in', { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (today.checkIn) await putDailyCheckIn({ ...today.checkIn, studentId, synced: true });
      return !today.required;
    } catch {
      return false;
    }
  })(), false);
}

/** Guarda las respuestas en el teléfono (sirve sin internet) y las envía en segundo plano. */
export async function recordDailyCheckIn(studentId: string, answers: CheckInAnswers) {
  await saveDailyCheckIn({
    studentId,
    date: checkInDate(),
    ...answers,
    timeZone: CHECK_IN_TIME_ZONE,
    createdAt: new Date().toISOString(),
    synced: false,
  });
  // Un envío que ya estaba en curso no incluye este registro: se repite al terminar.
  void syncDailyCheckIns(studentId).then(() => syncDailyCheckIns(studentId));
}

import { api, ApiError } from '../../lib/auth';
import { getDB, getDailyCheckIn, saveDailyCheckIn } from '../storage/db';
import type { DailyCheckIn, Profile } from '../../types';

type RemoteEntry = Omit<DailyCheckIn, 'studentId' | 'synced'>;
type Today = { date: string; required: boolean; checkIn: RemoteEntry | null };
const running = new Map<string, Promise<void>>();

export function checkInDate(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function assertOwner(accountId: string, profile: Profile) {
  if (profile.authUserId !== accountId) throw new Error('Este perfil todavía no está vinculado a tu cuenta.');
}

export function syncDailyCheckIns(accountId: string, profile: Profile): Promise<void> {
  assertOwner(accountId, profile);
  let task = running.get(accountId);
  if (!task) {
    task = (async () => {
      if (!navigator.onLine) return;
      const db = await getDB(accountId);
      const pending = (await db.getAll('dailyCheckIns'))
        .filter((entry) => entry.studentId === profile.studentId && !entry.synced)
        .sort((a, b) => a.date.localeCompare(b.date));
      for (const entry of pending) {
        let saved: RemoteEntry;
        try { saved = await api<RemoteEntry>(accountId, '/students/me/daily-check-in/sync', {
          method: 'POST', body: JSON.stringify({ date: entry.date, answers: {
            sleepHours: entry.sleepHours, food: entry.food, mood: entry.mood,
          } }),
        }); } catch (error) {
          if (error instanceof ApiError && error.status === 400) {
            await db.put('dailyCheckIns', { ...entry, syncError: error.message });
            window.dispatchEvent(new Event('daily-check-in-changed'));
            continue; // Un registro inválido no bloquea el envío de los demás días.
          }
          throw error;
        }
        await db.put('dailyCheckIns', { ...saved, studentId: profile.studentId, synced: true });
        window.dispatchEvent(new Event('daily-check-in-changed'));
      }
    })().finally(() => running.delete(accountId));
    running.set(accountId, task);
  }
  return task;
}

function connectionUnavailable(error: unknown) {
  return !navigator.onLine || error instanceof TypeError;
}

export async function loadDailyState(accountId: string, profile: Profile) {
  assertOwner(accountId, profile);
  let warning = '';
  try {
    try { await syncDailyCheckIns(accountId, profile); }
    catch (error) {
      if (error instanceof ApiError && error.status === 400) warning = 'Hay respuestas pendientes con una fecha inválida. Revisa la fecha del dispositivo.';
      else throw error;
    }
    const today = await api<Today>(accountId, '/students/me/daily-check-in');
    if (today.checkIn) {
      await (await getDB(accountId)).put('dailyCheckIns', {
        ...today.checkIn, studentId: profile.studentId, synced: true,
      });
    }
    return { date: today.date, entry: today.checkIn, warning };
  } catch (error) {
    if (!connectionUnavailable(error)) throw error;
    const date = checkInDate(profile.timeZone ?? 'America/Guatemala');
    return { date, entry: await getDailyCheckIn(accountId, profile.studentId, date), warning: 'Sin conexión: tus respuestas se enviarán al volver a conectarte.' };
  }
}

export async function recordDailyCheckIn(accountId: string, profile: Profile,
    answers: Pick<DailyCheckIn, 'sleepHours' | 'food' | 'mood'>) {
  assertOwner(accountId, profile);
  const timeZone = profile.timeZone ?? 'America/Guatemala';
  let date = checkInDate(timeZone);
  try {
    const today = await api<Today>(accountId, '/students/me/daily-check-in');
    date = today.date;
  } catch (error) { if (!connectionUnavailable(error)) throw error; }
  await saveDailyCheckIn(accountId, {
    studentId: profile.studentId, date, ...answers, timeZone, createdAt: new Date().toISOString(), synced: false,
  });
  try {
    await syncDailyCheckIns(accountId, profile);
    // Una sincronización anterior pudo empezar justo antes de guardar esta respuesta.
    if (!(await getDailyCheckIn(accountId, profile.studentId, date))?.synced) {
      await syncDailyCheckIns(accountId, profile);
    }
    const latest = await getDailyCheckIn(accountId, profile.studentId, date);
    if (latest?.syncError) throw new Error(latest.syncError);
  }
  catch (error) { if (!connectionUnavailable(error)) throw error; }
}

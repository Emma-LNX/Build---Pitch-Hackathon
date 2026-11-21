import { api, getStudentAccessToken } from '../../lib/api';
import { markAnswersSynced, unsyncedAnswers } from '../../offline/storage/db';
import type { CategoryId } from '../../types';
import { CATEGORIES } from '../curriculum/catalog';

const BATCH = 200;
const TIMEOUT_MS = 2500;

/** Token del alumno que entró con usuario y contraseña; `null` sin sesión o sin internet. */
async function token(): Promise<string | null> {
  if (!navigator.onLine) return null;
  try {
    return getStudentAccessToken();
  } catch {
    return null;
  }
}

async function call(path: string, accessToken: string, init: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`/api${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...init.headers },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sube al módulo de estadísticas las respuestas que aún no se enviaron.
 * Devuelve los ids guardados en el servidor y la fecha con que quedaron marcados.
 */
export async function uploadAnswers(studentId: string): Promise<{ ids: string[]; syncedAt: string } | null> {
  const accessToken = await token();
  if (!accessToken) return null;
  const pending = await unsyncedAnswers(studentId);
  const ids: string[] = [];
  for (let i = 0; i < pending.length; i += BATCH) {
    if (getStudentAccessToken() !== accessToken) break;
    const batch = pending.slice(i, i + BATCH);
    const response = await call('/estadisticas/me/respuestas', accessToken, {
      method: 'POST',
      // Respuesta DTO no admite `skill`, `syncedAt` ni identificadores locales.
      body: JSON.stringify({ respuestas: batch.map(({ id, sessionId, source, category, exercise, difficulty, interaction, correct, errorTag, timeMs, answeredAt }) =>
        ({ id, sessionId, source, category, exercise, difficulty, interaction, correct, errorTag, timeMs, answeredAt })) }),
    });
    if (!response?.ok) break;
    ids.push(...batch.map((a) => a.id));
  }
  if (ids.length === 0) return null;
  const syncedAt = new Date().toISOString();
  await markAnswersSynced(studentId, ids, syncedAt);
  return { ids, syncedAt };
}

/** Categorías que el servidor recomienda practicar, según todas las respuestas del alumno. */
export async function fetchRecommended(): Promise<CategoryId[] | null> {
  const accessToken = await token();
  if (!accessToken) return null;
  try {
    const data = await api<{ recomendadas?: string[] }>('/estadisticas/me/dominio', { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const valid = new Set<string>(CATEGORIES.map((c) => c.id));
    return (data.recomendadas ?? []).filter((c): c is CategoryId => valid.has(c));
  } catch {
    return null;
  }
}

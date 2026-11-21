import { getAccessToken } from '../../lib/supabase';
import { markAnswersSynced, unsyncedAnswers } from '../../offline/storage/db';
import type { CategoryId } from '../../types';
import { CATEGORIES } from '../curriculum/catalog';

const BATCH = 200;
const TIMEOUT_MS = 2500;

/** Token del alumno que entró con usuario y contraseña; `null` sin sesión o sin internet. */
async function token(accountId: string): Promise<string | null> {
  if (!navigator.onLine) return null;
  try {
    return await getAccessToken(accountId);
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
export async function uploadAnswers(accountId: string): Promise<{ ids: string[]; syncedAt: string } | null> {
  const pending = await unsyncedAnswers(accountId);
  const ids: string[] = [];
  for (let i = 0; i < pending.length; i += BATCH) {
    const accessToken = await token(accountId);
    if (!accessToken) break;
    const batch = pending.slice(i, i + BATCH);
    const response = await call('/estadisticas/me/respuestas', accessToken, {
      method: 'POST',
      body: JSON.stringify({ respuestas: batch }),
    });
    if (!response?.ok) break;
    ids.push(...batch.map((a) => a.id));
  }
  if (ids.length === 0) return null;
  const syncedAt = new Date().toISOString();
  await markAnswersSynced(accountId, ids, syncedAt);
  return { ids, syncedAt };
}

/** Categorías que el servidor recomienda practicar, según todas las respuestas del alumno. */
export async function fetchRecommended(accountId: string): Promise<CategoryId[] | null> {
  const accessToken = await token(accountId);
  if (!accessToken) return null;
  const response = await call('/estadisticas/me/dominio', accessToken);
  if (!response?.ok) return null;
  try {
    const data = (await response.json()) as { recomendadas?: string[] };
    const valid = new Set<string>(CATEGORIES.map((c) => c.id));
    return (data.recomendadas ?? []).filter((c): c is CategoryId => valid.has(c));
  } catch {
    return null;
  }
}

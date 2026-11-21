import { getDB } from '../storage/db';

/**
 * Envía los intentos guardados offline al backend.
 *
 * Contrato esperado (pendiente en backend):
 *   POST /api/progress/attempts   body: PendingAttempt[]
 *   2xx => el servidor los guardó. Cada intento trae un `id` UUID para que
 *   el backend ignore duplicados si el envío se repite.
 *
 * Si no hay internet o el servidor falla, los intentos se quedan en la cola
 * y se reintenta al volver la conexión o al abrir la app.
 */
const running = new Map<string, Promise<number>>();

export function syncPendingAttempts(accountId: string): Promise<number> {
  let task = running.get(accountId);
  if (!task) { task = doSync(accountId).finally(() => running.delete(accountId)); running.set(accountId, task); }
  return task;
}

async function doSync(accountId: string): Promise<number> {
  const db = await getDB(accountId);
  const pending = await db.getAll('outbox');
  if (pending.length === 0 || !navigator.onLine) return pending.length;

  try {
    const response = await fetch('/api/progress/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pending),
    });
    if (!response.ok) return pending.length;

    const tx = db.transaction('outbox', 'readwrite');
    await Promise.all([...pending.map((a) => tx.store.delete(a.id)), tx.done]);
    return db.count('outbox');
  } catch {
    return pending.length;
  }
}

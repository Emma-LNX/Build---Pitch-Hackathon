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
let running: Promise<number> | null = null;

export function syncPendingAttempts(): Promise<number> {
  running ??= doSync().finally(() => {
    running = null;
  });
  return running;
}

async function doSync(): Promise<number> {
  const db = await getDB();
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

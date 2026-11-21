import { openDB } from 'idb';
import { getDB } from '../../offline/storage/db';
import type { Profile } from '../../types';

export async function legacyProfile(accountId: string): Promise<Profile | null> {
  if (!indexedDB.databases || !(await indexedDB.databases()).some((db) => db.name === 'math-portal')) return null;
  const db = await openDB('math-portal');
  try {
    if (!db.objectStoreNames.contains('meta')) return null;
    const owner = await db.get('meta', 'linkedOwner');
    return !owner || owner === accountId ? (await db.get('meta', 'profile')) ?? null : null;
  } finally { db.close(); }
}

// Se ejecuta solamente después de que el usuario confirme que ese perfil le pertenece.
export async function importLegacyProfile(accountId: string, linked: Profile) {
  const source = await openDB('math-portal');
  try {
    const claim = source.transaction('meta', 'readwrite');
    const owner = await claim.store.get('linkedOwner');
    if (owner && owner !== accountId) { claim.abort(); throw new Error('El perfil local ya pertenece a otra cuenta.'); }
    await claim.store.put(accountId, 'linkedOwner');
    await claim.done;
    const original = await source.get('meta', 'profile') as Profile;
    const destination = await getDB(accountId);
    const stats = await source.get('meta', 'stats');
    if (stats) await destination.put('meta', stats, 'stats');
    for (const store of ['lessons', 'skills', 'outbox'] as const) {
      if (!source.objectStoreNames.contains(store)) continue;
      for (const item of await source.getAll(store)) {
        await destination.put(store, store === 'outbox' ? { ...item, studentId: linked.studentId } : item);
      }
    }
    if (source.objectStoreNames.contains('dailyCheckIns')) {
      for (const entry of await source.getAll('dailyCheckIns')) {
        if (entry.studentId === original.studentId) {
          await destination.put('dailyCheckIns', { ...entry, studentId: linked.studentId, synced: false });
        }
      }
    }
  } finally { source.close(); }
}

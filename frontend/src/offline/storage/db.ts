import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DailyCheckIn, LessonProgress, PendingAttempt, Profile, SkillProgress, Stats } from '../../types';

interface MathPortalDB extends DBSchema {
  meta: { key: 'profile' | 'stats'; value: Profile | Stats };
  lessons: { key: string; value: LessonProgress };
  skills: { key: string; value: SkillProgress };
  /** Cola de intentos que aún no llegan al servidor. */
  outbox: { key: string; value: PendingAttempt };
  dailyCheckIns: { key: [string, string]; value: DailyCheckIn };
}

const databases = new Map<string, Promise<IDBPDatabase<MathPortalDB>>>();

export function getDB(accountId: string) {
  if (!accountId) throw new Error('Falta la cuenta del propietario');
  let dbPromise = databases.get(accountId);
  dbPromise ??= openDB<MathPortalDB>(`math-portal:${accountId}`, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('meta');
        db.createObjectStore('lessons', { keyPath: 'lessonId' });
        db.createObjectStore('skills', { keyPath: 'skill' });
        db.createObjectStore('outbox', { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        db.createObjectStore('dailyCheckIns', { keyPath: ['studentId', 'date'] });
      }
    },
  });
  databases.set(accountId, dbPromise);
  return dbPromise;
}

export async function getDailyCheckIn(accountId: string, studentId: string, date: string) {
  return (await getDB(accountId)).get('dailyCheckIns', [studentId, date]);
}

export async function saveDailyCheckIn(accountId: string, entry: DailyCheckIn) {
  const db = await getDB(accountId);
  const tx = db.transaction('dailyCheckIns', 'readwrite');
  // Dos pestañas comparten la transacción: la primera respuesta del día se conserva.
  const saved = await tx.store.get([entry.studentId, entry.date]);
  if (!saved) await tx.store.add(entry);
  // Las respuestas pendientes no se borran al cambiar de día.
  for (const key of await tx.store.getAllKeys()) {
    if (key[0] === entry.studentId && key[1] !== entry.date) {
      const old = await tx.store.get(key);
      if (old?.synced) await tx.store.delete(key);
    }
  }
  await tx.done;
  window.dispatchEvent(new Event('daily-check-in-changed'));
  return saved ?? entry;
}

export const EMPTY_STATS: Stats = { xp: 0, streak: 0, lastActiveDay: null };

export interface Snapshot {
  profile: Profile | null;
  stats: Stats;
  lessons: LessonProgress[];
  skills: SkillProgress[];
  pending: number;
}

export async function loadSnapshot(accountId: string): Promise<Snapshot> {
  const db = await getDB(accountId);
  const [profile, stats, lessons, skills, pending] = await Promise.all([
    db.get('meta', 'profile') as Promise<Profile | undefined>,
    db.get('meta', 'stats') as Promise<Stats | undefined>,
    db.getAll('lessons'),
    db.getAll('skills'),
    db.count('outbox'),
  ]);
  return { profile: profile ?? null, stats: stats ?? EMPTY_STATS, lessons, skills, pending };
}

export async function saveProfile(accountId: string, profile: Profile) {
  const db = await getDB(accountId);
  await db.put('meta', profile, 'profile');
}

/** Guarda en una sola transacción todo lo que produce una lección terminada. */
export async function saveLessonResult(
  accountId: string,
  stats: Stats,
  lesson: LessonProgress,
  skills: SkillProgress[],
  attempt: PendingAttempt,
) {
  const db = await getDB(accountId);
  const tx = db.transaction(['meta', 'lessons', 'skills', 'outbox'], 'readwrite');
  await Promise.all([
    tx.objectStore('meta').put(stats, 'stats'),
    tx.objectStore('lessons').put(lesson),
    ...skills.map((s) => tx.objectStore('skills').put(s)),
    tx.objectStore('outbox').put(attempt),
    tx.done,
  ]);
}

/** Pide al navegador que no borre los datos locales cuando falte espacio. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // No es crítico: algunos navegadores no lo soportan.
  }
}

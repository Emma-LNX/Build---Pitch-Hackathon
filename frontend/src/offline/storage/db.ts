import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { LessonProgress, PendingAttempt, Profile, SkillProgress, Stats } from '../../types';

interface MathPortalDB extends DBSchema {
  meta: { key: 'profile' | 'stats'; value: Profile | Stats };
  lessons: { key: string; value: LessonProgress };
  skills: { key: string; value: SkillProgress };
  /** Cola de intentos que aún no llegan al servidor. */
  outbox: { key: string; value: PendingAttempt };
}

let dbPromise: Promise<IDBPDatabase<MathPortalDB>> | null = null;

export function getDB() {
  dbPromise ??= openDB<MathPortalDB>('math-portal', 1, {
    upgrade(db) {
      db.createObjectStore('meta');
      db.createObjectStore('lessons', { keyPath: 'lessonId' });
      db.createObjectStore('skills', { keyPath: 'skill' });
      db.createObjectStore('outbox', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

export const EMPTY_STATS: Stats = { xp: 0, streak: 0, lastActiveDay: null };

export interface Snapshot {
  profile: Profile | null;
  stats: Stats;
  lessons: LessonProgress[];
  skills: SkillProgress[];
  pending: number;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const db = await getDB();
  const [profile, stats, lessons, skills, pending] = await Promise.all([
    db.get('meta', 'profile') as Promise<Profile | undefined>,
    db.get('meta', 'stats') as Promise<Stats | undefined>,
    db.getAll('lessons'),
    db.getAll('skills'),
    db.count('outbox'),
  ]);
  return { profile: profile ?? null, stats: stats ?? EMPTY_STATS, lessons, skills, pending };
}

export async function saveProfile(profile: Profile) {
  const db = await getDB();
  await db.put('meta', profile, 'profile');
}

/** Guarda en una sola transacción todo lo que produce una lección terminada. */
export async function saveLessonResult(
  stats: Stats,
  lesson: LessonProgress,
  skills: SkillProgress[],
  attempt: PendingAttempt,
) {
  const db = await getDB();
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

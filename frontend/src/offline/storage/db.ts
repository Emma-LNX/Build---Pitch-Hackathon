import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AnswerRecord,
  CategoryMastery,
  LessonProgress,
  PendingAttempt,
  Profile,
  SkillProgress,
  Stats,
} from '../../types';

interface DiagnosticInfo {
  completedAt: string;
}

interface MathPortalDB extends DBSchema {
  meta: { key: 'profile' | 'stats' | 'diagnostic'; value: Profile | Stats | DiagnosticInfo };
  lessons: { key: string; value: LessonProgress };
  skills: { key: string; value: SkillProgress };
  /** Cola de intentos que aún no llegan al servidor. */
  outbox: { key: string; value: PendingAttempt };
  /** Cada respuesta a un reto; las que no tienen `syncedAt` faltan por enviar. */
  answers: { key: string; value: AnswerRecord };
  mastery: { key: string; value: CategoryMastery };
}

let dbPromise: Promise<IDBPDatabase<MathPortalDB>> | null = null;

export function getDB() {
  dbPromise ??= openDB<MathPortalDB>('math-portal', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('meta');
        db.createObjectStore('lessons', { keyPath: 'lessonId' });
        db.createObjectStore('skills', { keyPath: 'skill' });
        db.createObjectStore('outbox', { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        db.createObjectStore('answers', { keyPath: 'id' });
        db.createObjectStore('mastery', { keyPath: 'category' });
      }
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
  answers: AnswerRecord[];
  mastery: CategoryMastery[];
  diagnosticDoneAt: string | null;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const db = await getDB();
  const [profile, stats, lessons, skills, pending, answers, mastery, diagnostic] = await Promise.all([
    db.get('meta', 'profile') as Promise<Profile | undefined>,
    db.get('meta', 'stats') as Promise<Stats | undefined>,
    db.getAll('lessons'),
    db.getAll('skills'),
    db.count('outbox'),
    db.getAll('answers'),
    db.getAll('mastery'),
    db.get('meta', 'diagnostic') as Promise<DiagnosticInfo | undefined>,
  ]);
  return {
    profile: profile ?? null,
    stats: stats ?? EMPTY_STATS,
    lessons,
    skills,
    pending,
    answers: answers.sort((a, b) => a.answeredAt.localeCompare(b.answeredAt)),
    mastery,
    diagnosticDoneAt: diagnostic?.completedAt ?? null,
  };
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

/** Guarda las respuestas de una sesión, el dominio recalculado y, si aplica, las estadísticas. */
export async function saveLearning(
  answers: AnswerRecord[],
  mastery: CategoryMastery[],
  extra: { stats?: Stats; diagnosticDoneAt?: string } = {},
) {
  const db = await getDB();
  const tx = db.transaction(['meta', 'answers', 'mastery'], 'readwrite');
  await Promise.all([
    ...answers.map((a) => tx.objectStore('answers').put(a)),
    ...mastery.map((m) => tx.objectStore('mastery').put(m)),
    extra.stats ? tx.objectStore('meta').put(extra.stats, 'stats') : Promise.resolve(),
    extra.diagnosticDoneAt
      ? tx.objectStore('meta').put({ completedAt: extra.diagnosticDoneAt }, 'diagnostic')
      : Promise.resolve(),
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

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  LessonProgress,
  PendingAttempt,
  Profile,
  SkillProgress,
  Stats,
  WardrobeState,
} from '../../types';

type StudentStats = Stats & { studentId: string };
export type StudentLesson = LessonProgress & { studentId: string };
export type StudentSkill = SkillProgress & { studentId: string };

/** Resultado guardado de una partida, para no premiarla dos veces. */
export interface RewardRecord<T = unknown> {
  attemptId: string;
  studentId: string;
  outcome: T;
  createdAt: string;
}

/**
 * Sesión preparada en este teléfono tras un acceso correcto con conexión.
 * Guarda el refresh token del servicio de autenticación (nunca la contraseña).
 * Cerrar sesión la elimina; sin ella, la cuenta no se muestra ni se abre.
 */
export interface StoredSession {
  studentId: string;
  refreshToken: string;
  preparedAt: string;
}

interface MathPortalDB extends DBSchema {
  meta: { key: string; value: string };
  sessions: { key: string; value: StoredSession };
  students: { key: string; value: Profile };
  stats: { key: string; value: StudentStats };
  studentLessons: { key: [string, string]; value: StudentLesson; indexes: { 'by-student': string } };
  studentSkills: { key: [string, string]; value: StudentSkill; indexes: { 'by-student': string } };
  wardrobe: { key: string; value: WardrobeState };
  rewards: { key: string; value: RewardRecord };
  /** Cola de intentos que aún no llegan al servidor. */
  outbox: { key: string; value: PendingAttempt };
}

const DB_NAME = 'math-portal';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<MathPortalDB>> | null = null;

export function getDB() {
  dbPromise ??= openDB<MathPortalDB>(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('meta');
        db.createObjectStore('outbox', { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        db.createObjectStore('students', { keyPath: 'studentId' });
        db.createObjectStore('stats', { keyPath: 'studentId' });
        db.createObjectStore('studentLessons', { keyPath: ['studentId', 'lessonId'] }).createIndex('by-student', 'studentId');
        db.createObjectStore('studentSkills', { keyPath: ['studentId', 'skill'] }).createIndex('by-student', 'studentId');
        db.createObjectStore('wardrobe', { keyPath: 'studentId' });
        db.createObjectStore('rewards', { keyPath: 'attemptId' });
      }
      if (oldVersion < 3) db.createObjectStore('sessions', { keyPath: 'studentId' });
      if (oldVersion === 1) await migrateV1(db, tx);
    },
  });
  return dbPromise;
}

/**
 * v1 guardaba un único perfil. Se convierte en el primer estudiante de v2,
 * con su XP, lecciones y habilidades. Solo se esperan operaciones de IndexedDB
 * para que la transacción de actualización siga activa.
 */
async function migrateV1(db: IDBPDatabase<any>, tx: any) {
  const meta = tx.objectStore('meta');
  const profile = (await meta.get('profile')) as Profile | undefined;
  const stats = (await meta.get('stats')) as Stats | undefined;
  const lessons = (await tx.objectStore('lessons').getAll()) as LessonProgress[];
  const skills = (await tx.objectStore('skills').getAll()) as SkillProgress[];

  if (profile) {
    const studentId = profile.studentId;
    await tx.objectStore('students').put(profile);
    await tx.objectStore('stats').put({ ...(stats ?? EMPTY_STATS), studentId });
    for (const l of lessons) await tx.objectStore('studentLessons').put({ ...l, studentId });
    for (const s of skills) await tx.objectStore('studentSkills').put({ ...s, studentId });
    await meta.put(studentId, 'activeStudent');
  }
  await meta.delete('profile');
  await meta.delete('stats');
  db.deleteObjectStore('lessons');
  db.deleteObjectStore('skills');
}

export const EMPTY_STATS: Stats = { xp: 0, streak: 0, lastActiveDay: null };

export interface StudentSnapshot {
  profile: Profile;
  stats: Stats;
  lessons: LessonProgress[];
  skills: SkillProgress[];
  wardrobe: WardrobeState | null;
}

function stripStudent<T extends { studentId: string }>({ studentId: _id, ...rest }: T): Omit<T, 'studentId'> {
  return rest;
}

export async function loadStudent(studentId: string): Promise<StudentSnapshot | null> {
  const db = await getDB();
  const [profile, stats, lessons, skills, wardrobe] = await Promise.all([
    db.get('students', studentId),
    db.get('stats', studentId),
    db.getAllFromIndex('studentLessons', 'by-student', studentId),
    db.getAllFromIndex('studentSkills', 'by-student', studentId),
    db.get('wardrobe', studentId),
  ]);
  if (!profile) return null;
  return {
    profile,
    stats: stats ? stripStudent(stats) : EMPTY_STATS,
    lessons: lessons.map(stripStudent),
    skills: skills.map(stripStudent),
    wardrobe: wardrobe ?? null,
  };
}

export interface Startup {
  /** Cuentas con sesión preparada en este teléfono. */
  accounts: Profile[];
  pending: number;
}

export async function loadStartup(): Promise<Startup> {
  const db = await getDB();
  const [sessions, pending] = await Promise.all([db.getAll('sessions'), db.count('outbox')]);
  const accounts: Profile[] = [];
  for (const session of sessions) {
    const profile = await db.get('students', session.studentId);
    if (profile?.username) accounts.push(profile);
  }
  return { accounts, pending };
}

export async function saveProfile(profile: Profile) {
  const db = await getDB();
  await db.put('students', profile);
}

export async function getSession(studentId: string): Promise<StoredSession | undefined> {
  const db = await getDB();
  return db.get('sessions', studentId);
}

export async function saveSession(session: StoredSession) {
  const db = await getDB();
  await db.put('sessions', session);
}

/** Cerrar sesión: el teléfono deja de poder abrir esta cuenta sin volver a autenticarse. */
export async function deleteSession(studentId: string) {
  const db = await getDB();
  await db.delete('sessions', studentId);
}

export async function saveWardrobe(wardrobe: WardrobeState) {
  const db = await getDB();
  await db.put('wardrobe', wardrobe);
}

export async function getReward<T>(attemptId: string): Promise<RewardRecord<T> | undefined> {
  const db = await getDB();
  return (await db.get('rewards', attemptId)) as RewardRecord<T> | undefined;
}

/**
 * Guarda en una sola transacción todo lo que produce una lección terminada.
 * Si la partida (`attempt.id`) ya se registró, no escribe nada y devuelve el
 * resultado guardado: repetir el evento no vuelve a dar XP ni desbloqueos.
 */
export async function commitLessonResult<T>(input: {
  studentId: string;
  stats: Stats;
  lesson: LessonProgress;
  skills: SkillProgress[];
  wardrobe: WardrobeState;
  attempt: PendingAttempt;
  outcome: T;
}): Promise<{ duplicate: boolean; outcome: T }> {
  const db = await getDB();
  const tx = db.transaction(['stats', 'studentLessons', 'studentSkills', 'wardrobe', 'rewards', 'outbox'], 'readwrite');
  const existing = (await tx.objectStore('rewards').get(input.attempt.id)) as RewardRecord<T> | undefined;
  if (existing) {
    await tx.done;
    return { duplicate: true, outcome: existing.outcome };
  }
  const { studentId } = input;
  await Promise.all([
    tx.objectStore('stats').put({ ...input.stats, studentId }),
    tx.objectStore('studentLessons').put({ ...input.lesson, studentId }),
    ...input.skills.map((s) => tx.objectStore('studentSkills').put({ ...s, studentId })),
    tx.objectStore('wardrobe').put(input.wardrobe),
    tx.objectStore('rewards').put({
      attemptId: input.attempt.id,
      studentId,
      outcome: input.outcome,
      createdAt: input.attempt.createdAt,
    }),
    tx.objectStore('outbox').put(input.attempt),
    tx.done,
  ]);
  return { duplicate: false, outcome: input.outcome };
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

/** Guardarropas de todos los perfiles del teléfono (para el selector de perfil). */
export async function listWardrobes(): Promise<WardrobeState[]> {
  const db = await getDB();
  return db.getAll('wardrobe');
}

export async function countPending(): Promise<number> {
  const db = await getDB();
  return db.count('outbox');
}

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AnswerRecord,
  CategoryMastery,
  DailyCheckIn,
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
  studentAnswers: { key: string; value: AnswerRecord & { studentId: string }; indexes: { 'by-student': string } };
  studentMastery: { key: [string, string]; value: CategoryMastery & { studentId: string } };
  dailyCheckIns: { key: [string, string]; value: DailyCheckIn };
}

const DB_NAME = 'math-portal';
const DB_VERSION = 5;

let dbPromise: Promise<IDBPDatabase<MathPortalDB>> | null = null;

export function getDB() {
  dbPromise ??= openDB<MathPortalDB>(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('meta');
        db.createObjectStore('outbox', { keyPath: 'id' });
      }
      // Las dos ramas usaban v2 para esquemas distintos. Detectar los stores
      // permite actualizar ambos sin perder progreso ni mezclar estudiantes.
      if (!db.objectStoreNames.contains('students')) {
        db.createObjectStore('students', { keyPath: 'studentId' });
        db.createObjectStore('stats', { keyPath: 'studentId' });
        db.createObjectStore('studentLessons', { keyPath: ['studentId', 'lessonId'] }).createIndex('by-student', 'studentId');
        db.createObjectStore('studentSkills', { keyPath: ['studentId', 'skill'] }).createIndex('by-student', 'studentId');
        db.createObjectStore('wardrobe', { keyPath: 'studentId' });
        db.createObjectStore('rewards', { keyPath: 'attemptId' });
      }
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'studentId' });
      if (!db.objectStoreNames.contains('studentAnswers')) {
        db.createObjectStore('studentAnswers', { keyPath: 'id' }).createIndex('by-student', 'studentId');
      }
      if (!db.objectStoreNames.contains('studentMastery')) db.createObjectStore('studentMastery', { keyPath: ['studentId', 'category'] });
      if (!db.objectStoreNames.contains('dailyCheckIns')) db.createObjectStore('dailyCheckIns', { keyPath: ['studentId', 'date'] });
      if ((db.objectStoreNames as DOMStringList).contains('lessons')) await migrateV1(db, tx);
    },
    blocking() {
      // Otra pestaña abrió una versión nueva de la app: sin soltar la base, esa pestaña no puede actualizarla.
      void dbPromise?.then((db) => db.close());
      window.location.reload();
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
  const legacy = await meta.get('profile');
  const profile: Profile | undefined = legacy ? {
    ...legacy, username: legacy.username ?? '', gender: legacy.gender ?? null,
    courseId: legacy.courseId ?? '', courseName: legacy.courseName ?? '', schoolName: legacy.schoolName ?? '',
  } : undefined;
  const stats = (await meta.get('stats')) as Stats | undefined;
  const lessons = (await tx.objectStore('lessons').getAll()) as LessonProgress[];
  const skills = (await tx.objectStore('skills').getAll()) as SkillProgress[];

  if (profile) {
    const studentId = profile.studentId;
    await tx.objectStore('students').put(profile);
    await tx.objectStore('stats').put({ ...(stats ?? EMPTY_STATS), studentId });
    for (const l of lessons) await tx.objectStore('studentLessons').put({ ...l, studentId });
    for (const s of skills) await tx.objectStore('studentSkills').put({ ...s, studentId });
    if (db.objectStoreNames.contains('answers')) {
      for (const answer of await tx.objectStore('answers').getAll()) {
        await tx.objectStore('studentAnswers').put({ ...answer, studentId });
      }
    }
    const diagnostic = await meta.get('diagnostic');
    if (diagnostic?.completedAt) await meta.put(diagnostic.completedAt, `diagnostic:${studentId}`);
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
  answers: AnswerRecord[];
  diagnosticDoneAt: string | null;
}

function stripStudent<T extends { studentId: string }>({ studentId: _id, ...rest }: T): Omit<T, 'studentId'> {
  return rest;
}

export async function loadStudent(studentId: string): Promise<StudentSnapshot | null> {
  const db = await getDB();
  const [profile, stats, lessons, skills, wardrobe, answers, diagnostic] = await Promise.all([
    db.get('students', studentId),
    db.get('stats', studentId),
    db.getAllFromIndex('studentLessons', 'by-student', studentId),
    db.getAllFromIndex('studentSkills', 'by-student', studentId),
    db.get('wardrobe', studentId),
    db.getAllFromIndex('studentAnswers', 'by-student', studentId),
    db.get('meta', `diagnostic:${studentId}`),
  ]);
  if (!profile) return null;
  return {
    profile,
    stats: stats ? stripStudent(stats) : EMPTY_STATS,
    lessons: lessons.map(stripStudent),
    skills: skills.map(stripStudent),
    wardrobe: wardrobe ?? null,
    answers: answers.map(stripStudent).sort((a, b) => a.answeredAt.localeCompare(b.answeredAt)),
    diagnosticDoneAt: diagnostic ?? null,
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
  attemptId: string;
  stats: Stats;
  lesson?: LessonProgress;
  skills?: SkillProgress[];
  wardrobe: WardrobeState;
  attempt?: PendingAttempt;
  records?: AnswerRecord[];
  mastery?: CategoryMastery[];
  diagnosticDoneAt?: string;
  outcome: T;
}): Promise<{ duplicate: boolean; outcome: T }> {
  const db = await getDB();
  const tx = db.transaction(['meta', 'stats', 'studentLessons', 'studentSkills', 'wardrobe', 'rewards', 'outbox', 'studentAnswers', 'studentMastery'], 'readwrite');
  const existing = (await tx.objectStore('rewards').get(input.attemptId)) as RewardRecord<T> | undefined;
  if (existing) {
    if (existing.studentId !== input.studentId) throw new Error('La sesión pertenece a otro estudiante');
    await tx.done;
    return { duplicate: true, outcome: existing.outcome };
  }
  const { studentId } = input;
  await Promise.all([
    tx.objectStore('stats').put({ ...input.stats, studentId }),
    ...(input.lesson ? [tx.objectStore('studentLessons').put({ ...input.lesson, studentId })] : []),
    ...(input.skills ?? []).map((s) => tx.objectStore('studentSkills').put({ ...s, studentId })),
    ...(input.records ?? []).map((a) => tx.objectStore('studentAnswers').put({ ...a, studentId })),
    ...(input.mastery ?? []).map((m) => tx.objectStore('studentMastery').put({ ...m, studentId })),
    ...(input.diagnosticDoneAt ? [tx.objectStore('meta').put(input.diagnosticDoneAt, `diagnostic:${studentId}`)] : []),
    tx.objectStore('wardrobe').put(input.wardrobe),
    tx.objectStore('rewards').put({
      attemptId: input.attemptId,
      studentId,
      outcome: input.outcome,
      createdAt: input.attempt?.createdAt ?? new Date().toISOString(),
    }),
    ...(input.attempt ? [tx.objectStore('outbox').put(input.attempt)] : []),
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

/** Solo respuestas de la cuenta activa, nunca las de todo el teléfono. */
export async function unsyncedAnswers(studentId: string): Promise<AnswerRecord[]> {
  const db = await getDB();
  return (await db.getAllFromIndex('studentAnswers', 'by-student', studentId)).filter((a) => !a.syncedAt).map(stripStudent);
}

export async function markAnswersSynced(studentId: string, ids: string[], syncedAt: string) {
  const db = await getDB();
  const tx = db.transaction('studentAnswers', 'readwrite');
  await Promise.all(ids.map(async (id) => {
    const answer = await tx.store.get(id);
    if (answer?.studentId === studentId) await tx.store.put({ ...answer, syncedAt });
  }));
  await tx.done;
}

const checkInsOf = (studentId: string) => IDBKeyRange.bound([studentId, ''], [studentId, '\uffff']);

export async function getDailyCheckIn(studentId: string, date: string): Promise<DailyCheckIn | undefined> {
  return (await getDB()).get('dailyCheckIns', [studentId, date]);
}

/**
 * Guarda el registro del día si aún no existe: la primera respuesta prevalece.
 * Borra los días anteriores ya enviados (el teléfono puede ser compartido); los pendientes se conservan.
 */
export async function saveDailyCheckIn(entry: DailyCheckIn): Promise<DailyCheckIn> {
  const db = await getDB();
  const tx = db.transaction('dailyCheckIns', 'readwrite');
  const saved = await tx.store.get([entry.studentId, entry.date]);
  if (!saved) await tx.store.add(entry);
  for (const old of await tx.store.getAll(checkInsOf(entry.studentId))) {
    if (old.date !== entry.date && old.synced) await tx.store.delete([old.studentId, old.date]);
  }
  await tx.done;
  return saved ?? entry;
}

export async function putDailyCheckIn(entry: DailyCheckIn) {
  await (await getDB()).put('dailyCheckIns', entry);
}

/** Registros de la cuenta que faltan por enviar, del más antiguo al más reciente. */
export async function pendingDailyCheckIns(studentId: string): Promise<DailyCheckIn[]> {
  const all = await (await getDB()).getAll('dailyCheckIns', checkInsOf(studentId));
  return all.filter((e) => !e.synced && !e.syncError).sort((a, b) => a.date.localeCompare(b.date));
}

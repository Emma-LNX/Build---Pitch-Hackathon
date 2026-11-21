export type SkillId =
  | 'valor-posicional'
  | 'suma'
  | 'resta'
  | 'multiplicacion'
  | 'problemas'
  | 'division'
  | 'division-larga'
  | 'fracciones'
  | 'angulos'
  | 'figuras'
  | 'perimetro'
  | 'medidas'
  | 'dinero'
  | 'numeracion-maya';

/** Categorías del CNB de 4.º grado en las que el alumno tiene un nivel propio. */
export type CategoryId = 'numeros' | 'maya' | 'suma-resta' | 'mult-div' | 'fracciones' | 'geometria' | 'medidas';

/** Tipo de reto concreto; cada uno tiene su generador. */
export type ExerciseId =
  | 'valor-posicional'
  | 'suma'
  | 'resta'
  | 'multiplicacion'
  | 'problemas'
  | 'division'
  | 'division-larga'
  | 'fraccion-identificar'
  | 'fraccion-comparar'
  | 'fraccion-sumar'
  | 'angulos'
  | 'figuras'
  | 'perimetro'
  | 'medidas'
  | 'dinero'
  | 'maya-leer'
  | 'maya-formar';

/** 1 = fácil, 2 = de su grado, 3 = reto. */
export type Difficulty = 1 | 2 | 3;

/** Forma de responder: opción múltiple, teclado numérico o constructor maya. */
export type Interaction = 'choice' | 'number' | 'maya' | 'coins' | 'slices' | 'blocks' | 'order';

/** Minijuegos táctiles: mercado, tortilla de fracciones, bloques y ordenar tarjetas. */
export type GameSpec =
  | { kind: 'coins'; values: number[] }
  | { kind: 'slices'; parts: number }
  | { kind: 'blocks'; places: number[] }
  | { kind: 'order'; items: string[]; sep: '<' | '>' };

export type WorldId = 'tikal' | 'yaxha' | 'mirador';

export interface Lesson {
  id: string;
  worldId: WorldId;
  number: number;
  title: string;
  skill: SkillId;
  exercise: ExerciseId;
}

export interface World {
  id: WorldId;
  name: string;
  subtitle: string;
  lessons: Lesson[];
}

export type Visual =
  | { kind: 'fraction'; numerator: number; denominator: number; shape: 'circle' | 'bar' }
  | { kind: 'angle'; degrees: number }
  | { kind: 'rect'; width: number; height: number; unit: string }
  | { kind: 'polygon'; sides: number }
  | { kind: 'maya'; value: number };

export interface Question {
  id: string;
  skill: SkillId;
  exercise: ExerciseId;
  category: CategoryId;
  difficulty: Difficulty;
  interaction: Interaction;
  prompt: string;
  visual?: Visual;
  options: string[];
  answer: string;
  /** Respuesta equivocada típica y el error que revela (p. ej. "sin-llevar"). */
  commonError?: { answer: string; tag: string };
  /** Cantidad de niveles del constructor maya. */
  mayaLevels?: number;
  game?: GameSpec;
  explanation?: string;
}

/** Género elegido por el estudiante para su avatar. No interviene en el acceso. */
export type Gender = 'nina' | 'nino';
export type SessionKind = 'DIAGNOSTICO' | 'ENTRENAMIENTO' | 'LECCION';

/**
 * Respuesta a un reto. Es la unidad que alimenta el nivel por categoría y,
 * al sincronizar, las estadísticas del profesor (tabla `respuestas_items`).
 */
export interface AnswerRecord {
  id: string;
  sessionId: string;
  source: SessionKind;
  exercise: ExerciseId;
  skill: SkillId;
  category: CategoryId;
  difficulty: Difficulty;
  interaction: Interaction;
  correct: boolean;
  errorTag: string | null;
  timeMs: number;
  answeredAt: string;
  syncedAt?: string;
}

/** Estimación del dominio de una categoría (modelo tipo Elo). */
export interface CategoryMastery {
  category: CategoryId;
  theta: number;
  answers: number;
  correct: number;
  updatedAt: string;
}

export type CapColor = 'terracota' | 'jade' | 'ocre' | 'cielo' | 'morado';

/**
 * Perfil local del estudiante autenticado. Los datos de clase vienen de la
 * cuenta que creó su profesor. Nunca incluye la contraseña.
 */
export interface Profile {
  /** Id del usuario en el servicio de autenticación. */
  studentId: string;
  name: string;
  username: string;
  gender: Gender | null;
  courseId: string;
  classroomId?: string | null;
  courseName: string;
  schoolName: string;
  /** El género cambió sin conexión y falta enviarlo al servidor. */
  genderPendingSync?: boolean;
}

export interface Stats {
  xp: number;
  streak: number;
  /** Último día (YYYY-MM-DD, hora local) en que completó una lección. */
  lastActiveDay: string | null;
}

export interface LessonProgress {
  lessonId: string;
  bestStars: number;
  completed: boolean;
  plays: number;
}

export interface SkillProgress {
  skill: SkillId;
  correct: number;
  total: number;
}

/* ---------------- Guardarropa ---------------- */

/** Presentación del conjunto; define la silueta (falda o pantalón) sobre el mismo cuerpo base. */
export type OutfitPresentation = 'femenina' | 'masculina';

/**
 * Estado de revisión cultural:
 * - en-revision: ficha con fuentes publicadas; ilustración aún no validada.
 * - pendiente-ilustracion: ficha documentada, pero falta una ilustración fiel.
 * - verificado: revisado con la fuente y, de ser posible, con la comunidad.
 */
export type CulturalReview = 'en-revision' | 'pendiente-ilustracion' | 'verificado';

export interface OutfitSource {
  label: string;
  url?: string;
}

export interface Outfit {
  id: string;
  name: string;
  /** Comunidad o municipio de procedencia. */
  community: string;
  department: string;
  /** Comunidad lingüística, cuando la fuente la indica. */
  linguisticCommunity?: string;
  presentation: OutfitPresentation;
  description: string;
  /** Aspectos de la ilustración que aún no están documentados. */
  pendingDetails?: string;
  sources: OutfitSource[];
  xpRequired: number;
  review: CulturalReview;
}

export interface WardrobeState {
  studentId: string;
  unlocked: string[];
  equipped: string;
  /** Último conjunto elegido en cada presentación, para restaurarlo si se corrige el género. */
  equippedBy?: Partial<Record<OutfitPresentation, string>>;
  /** Desbloqueos ya celebrados; evita repetir la celebración al recargar. */
  celebrated: string[];
}

/** Intento guardado localmente, pendiente de enviarse al servidor. */
export interface PendingAttempt {
  id: string;
  studentId: string;
  lessonId: string;
  correct: number;
  total: number;
  skillResults: { skill: SkillId; correct: boolean }[];
  createdAt: string;
}

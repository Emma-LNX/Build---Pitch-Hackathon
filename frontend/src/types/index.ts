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

export interface Profile {
  studentId: string;
  name: string;
  grade: string;
  section: string;
  capColor: CapColor;
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

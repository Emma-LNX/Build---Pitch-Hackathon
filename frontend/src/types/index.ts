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
  | 'dinero';

export type WorldId = 'tikal' | 'yaxha' | 'mirador';

export interface Lesson {
  id: string;
  worldId: WorldId;
  number: number;
  title: string;
  skill: SkillId;
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
  | { kind: 'polygon'; sides: number };

export interface Question {
  id: string;
  skill: SkillId;
  prompt: string;
  visual?: Visual;
  options: string[];
  answer: string;
  explanation?: string;
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

import { pick } from '../../lib/random';
import type { AnswerRecord, CategoryId, CategoryMastery, Difficulty, ExerciseId } from '../../types';
import { CATEGORIES, findCategory } from '../curriculum/catalog';

/**
 * Modelo tipo Elo por categoría: `theta` es la habilidad estimada y cada reto
 * tiene dificultad `b` (0 = reto normal de su grado). Tras cada respuesta,
 * theta sube o baja según qué tan probable era acertar.
 */
const K_DIAGNOSTIC = 0.8;
const K_PRACTICE = 0.3;
/** Se busca que acierte 3 de cada 4: ni aburrido ni frustrante. */
const TARGET_SUCCESS = 0.75;

export function itemDifficulty(d: Difficulty): number {
  return d - 2;
}

export function successProbability(theta: number, d: Difficulty): number {
  return 1 / (1 + Math.exp(-(theta - itemDifficulty(d))));
}

/** Puntuación 0–100: probabilidad de resolver un reto normal de su grado. */
export function masteryScore(theta: number): number {
  return Math.round(100 * successProbability(theta, 2));
}

export const LEVELS = [
  { min: 0, name: 'Semilla' },
  { min: 40, name: 'Brote' },
  { min: 60, name: 'Milpa' },
  { min: 75, name: 'Elote' },
  { min: 90, name: 'Mazorca' },
] as const;

export function levelFor(score: number): { number: number; name: string } {
  const index = LEVELS.filter((l) => score >= l.min).length - 1;
  return { number: index + 1, name: LEVELS[index].name };
}

export function bestDifficulty(theta: number): Difficulty {
  const options: Difficulty[] = [1, 2, 3];
  return options.reduce((best, d) =>
    Math.abs(successProbability(theta, d) - TARGET_SUCCESS) < Math.abs(successProbability(theta, best) - TARGET_SUCCESS)
      ? d
      : best,
  );
}

/**
 * Recalcula el dominio reproduciendo todas las respuestas en orden. Así el
 * resultado no depende del orden en que lleguen las partidas sin conexión.
 */
export function computeMastery(answers: AnswerRecord[]): Partial<Record<CategoryId, CategoryMastery>> {
  const result: Partial<Record<CategoryId, CategoryMastery>> = {};
  const sorted = [...answers].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));
  for (const a of sorted) {
    const m = result[a.category] ?? { category: a.category, theta: 0, answers: 0, correct: 0, updatedAt: a.answeredAt };
    const k = a.source === 'DIAGNOSTICO' ? K_DIAGNOSTIC : K_PRACTICE;
    const p = successProbability(m.theta, a.difficulty);
    result[a.category] = {
      ...m,
      theta: m.theta + k * ((a.correct ? 1 : 0) - p),
      answers: m.answers + 1,
      correct: m.correct + (a.correct ? 1 : 0),
      updatedAt: a.answeredAt,
    };
  }
  return result;
}

export function thetaOf(mastery: Partial<Record<CategoryId, CategoryMastery>>, category: CategoryId): number {
  return mastery[category]?.theta ?? 0;
}

/** Categorías de la más difícil a la más fácil para el alumno. */
export function rankCategories(mastery: Partial<Record<CategoryId, CategoryMastery>>): CategoryId[] {
  return CATEGORIES.map((c) => c.id).sort((a, b) => thetaOf(mastery, a) - thetaOf(mastery, b));
}

/** Errores que más se repiten en las respuestas recientes. */
export function frequentErrors(answers: AnswerRecord[], limit = 3): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of answers.slice(-60)) {
    if (!a.correct && a.errorTag && a.errorTag !== 'otro') counts.set(a.errorTag, (counts.get(a.errorTag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface PlannedItem {
  exercise: ExerciseId;
  category: CategoryId;
  difficulty: Difficulty;
}

/** Elige el reto de la categoría que peor le va últimamente; los no jugados cuentan como 50 %. */
function weakestExercise(category: CategoryId, answers: AnswerRecord[], avoid?: ExerciseId): ExerciseId {
  const exercises = findCategory(category)!.exercises;
  const recent = answers.filter((a) => a.category === category).slice(-20);
  const accuracy = (e: ExerciseId) => {
    const rs = recent.filter((a) => a.exercise === e);
    return rs.length === 0 ? 0.5 : rs.filter((a) => a.correct).length / rs.length;
  };
  const candidates = exercises.length > 1 && avoid ? exercises.filter((e) => e !== avoid) : exercises;
  const worst = Math.min(...candidates.map(accuracy));
  return pick(candidates.filter((e) => accuracy(e) - worst < 0.15));
}

/**
 * Misión del día (8 retos): 5 de las dos categorías más débiles, 2 de una
 * intermedia y un cierre fácil de la más fuerte. Con `only`, todo es de esa
 * categoría. `focus` (temas que marcó el profesor) se trata como lo más débil.
 */
export function planMission(
  mastery: Partial<Record<CategoryId, CategoryMastery>>,
  answers: AnswerRecord[],
  options: { only?: CategoryId; focus?: CategoryId[] } = {},
): PlannedItem[] {
  const ranked = rankCategories(mastery);
  const focus = (options.focus ?? []).filter((c) => ranked.includes(c));
  const order = [...focus, ...ranked.filter((c) => !focus.includes(c))];
  const [w1, w2] = order;
  const mid = order[Math.floor(order.length / 2)];
  const strong = order[order.length - 1];
  const slots: CategoryId[] = options.only
    ? Array(8).fill(options.only)
    : [w1, w2, mid, w1, w2, mid, w1, strong];

  const items: PlannedItem[] = [];
  slots.forEach((category, i) => {
    const previous = [...items].reverse().find((it) => it.category === category)?.exercise;
    const closing = !options.only && i === slots.length - 1;
    items.push({
      category,
      exercise: weakestExercise(category, answers, previous),
      difficulty: closing ? 1 : bestDifficulty(thetaOf(mastery, category)),
    });
  });
  return items;
}

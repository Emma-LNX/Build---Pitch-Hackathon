import type { ExerciseId, Lesson, SkillId, World, WorldId } from '../../types';

export const SKILL_LABELS: Record<SkillId, string> = {
  'valor-posicional': 'Valor posicional',
  suma: 'Suma',
  resta: 'Resta',
  multiplicacion: 'Multiplicación',
  problemas: 'Problemas de multiplicar',
  division: 'División',
  'division-larga': 'División larga',
  fracciones: 'Fracciones',
  angulos: 'Ángulos',
  figuras: 'Figuras',
  perimetro: 'Perímetro',
  medidas: 'Medidas',
  dinero: 'Dinero',
  'numeracion-maya': 'Numeración maya',
};

function lessons(worldId: WorldId, items: [string, SkillId, ExerciseId][]): Lesson[] {
  return items.map(([title, skill, exercise], i) => ({
    id: `${worldId}-${i + 1}`,
    worldId,
    number: i + 1,
    title,
    skill,
    exercise,
  }));
}

export const WORLDS: World[] = [
  {
    id: 'tikal',
    name: 'Tikal',
    subtitle: 'Números y operaciones',
    lessons: lessons('tikal', [
      ['Valor posicional', 'valor-posicional', 'valor-posicional'],
      ['Sumas con llevadas', 'suma', 'suma'],
      ['Restas prestando', 'resta', 'resta'],
      ['Tablas de multiplicar', 'multiplicacion', 'multiplicacion'],
      ['Problemas de multiplicar', 'problemas', 'problemas'],
    ]),
  },
  {
    id: 'yaxha',
    name: 'Yaxhá',
    subtitle: 'División y fracciones',
    lessons: lessons('yaxha', [
      ['Repartir en partes iguales', 'division', 'division'],
      ['División larga', 'division-larga', 'division-larga'],
      ['¿Qué fracción es?', 'fracciones', 'fraccion-identificar'],
      ['Comparar fracciones', 'fracciones', 'fraccion-comparar'],
      ['Sumar fracciones', 'fracciones', 'fraccion-sumar'],
    ]),
  },
  {
    id: 'mirador',
    name: 'El Mirador',
    subtitle: 'Geometría y medidas',
    lessons: lessons('mirador', [
      ['Ángulos', 'angulos', 'angulos'],
      ['Figuras planas', 'figuras', 'figuras'],
      ['Perímetro', 'perimetro', 'perimetro'],
      ['Medidas', 'medidas', 'medidas'],
      ['Dinero en quetzales', 'dinero', 'dinero'],
    ]),
  },
];

export const ALL_LESSONS: Lesson[] = WORLDS.flatMap((w) => w.lessons);

export function findLesson(id: string): Lesson | undefined {
  return ALL_LESSONS.find((l) => l.id === id);
}

export function findWorld(id: string | null | undefined): World | undefined {
  return WORLDS.find((w) => w.id === id);
}

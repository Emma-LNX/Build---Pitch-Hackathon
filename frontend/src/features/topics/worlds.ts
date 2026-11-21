import type { Lesson, SkillId, World, WorldId } from '../../types';

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
};

function lessons(worldId: WorldId, items: [string, SkillId][]): Lesson[] {
  return items.map(([title, skill], i) => ({
    id: `${worldId}-${i + 1}`,
    worldId,
    number: i + 1,
    title,
    skill,
  }));
}

export const WORLDS: World[] = [
  {
    id: 'tikal',
    name: 'Tikal',
    subtitle: 'Números y operaciones',
    lessons: lessons('tikal', [
      ['Valor posicional', 'valor-posicional'],
      ['Sumas con llevadas', 'suma'],
      ['Restas prestando', 'resta'],
      ['Tablas de multiplicar', 'multiplicacion'],
      ['Problemas de multiplicar', 'problemas'],
    ]),
  },
  {
    id: 'yaxha',
    name: 'Yaxhá',
    subtitle: 'División y fracciones',
    lessons: lessons('yaxha', [
      ['Repartir en partes iguales', 'division'],
      ['División larga', 'division-larga'],
      ['¿Qué fracción es?', 'fracciones'],
      ['Comparar fracciones', 'fracciones'],
      ['Sumar fracciones', 'fracciones'],
    ]),
  },
  {
    id: 'mirador',
    name: 'El Mirador',
    subtitle: 'Geometría y medidas',
    lessons: lessons('mirador', [
      ['Ángulos', 'angulos'],
      ['Figuras planas', 'figuras'],
      ['Perímetro', 'perimetro'],
      ['Medidas', 'medidas'],
      ['Dinero en quetzales', 'dinero'],
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

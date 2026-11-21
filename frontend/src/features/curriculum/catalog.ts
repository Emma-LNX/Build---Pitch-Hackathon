import type { CategoryId, ExerciseId, SkillId } from '../../types';

export interface Category {
  id: CategoryId;
  name: string;
  /** Contenidos de la dosificación de Matemáticas de 4.º grado (CNB Guatemala). */
  cnb: string;
  exercises: ExerciseId[];
}

export const CATEGORIES: Category[] = [
  { id: 'numeros', name: 'Números y valor posicional', cnb: '4.1.2–4.1.4', exercises: ['valor-posicional'] },
  { id: 'maya', name: 'Numeración maya', cnb: '4.1.7, 4.1.9, 4.8', exercises: ['maya-leer', 'maya-formar'] },
  { id: 'suma-resta', name: 'Suma y resta', cnb: '4.3', exercises: ['suma', 'resta'] },
  {
    id: 'mult-div',
    name: 'Multiplicación y división',
    cnb: '4.4, 4.6',
    exercises: ['multiplicacion', 'problemas', 'division', 'division-larga'],
  },
  {
    id: 'fracciones',
    name: 'Fracciones',
    cnb: '4.10',
    exercises: ['fraccion-identificar', 'fraccion-comparar', 'fraccion-sumar'],
  },
  { id: 'geometria', name: 'Geometría', cnb: '1.1, 1.3, 1.5', exercises: ['angulos', 'figuras', 'perimetro'] },
  { id: 'medidas', name: 'Medidas y dinero', cnb: '7.1, 7.7', exercises: ['medidas', 'dinero'] },
];

export const EXERCISES: Record<ExerciseId, { category: CategoryId; skill: SkillId }> = {
  'valor-posicional': { category: 'numeros', skill: 'valor-posicional' },
  'maya-leer': { category: 'maya', skill: 'numeracion-maya' },
  'maya-formar': { category: 'maya', skill: 'numeracion-maya' },
  suma: { category: 'suma-resta', skill: 'suma' },
  resta: { category: 'suma-resta', skill: 'resta' },
  multiplicacion: { category: 'mult-div', skill: 'multiplicacion' },
  problemas: { category: 'mult-div', skill: 'problemas' },
  division: { category: 'mult-div', skill: 'division' },
  'division-larga': { category: 'mult-div', skill: 'division-larga' },
  'fraccion-identificar': { category: 'fracciones', skill: 'fracciones' },
  'fraccion-comparar': { category: 'fracciones', skill: 'fracciones' },
  'fraccion-sumar': { category: 'fracciones', skill: 'fracciones' },
  angulos: { category: 'geometria', skill: 'angulos' },
  figuras: { category: 'geometria', skill: 'figuras' },
  perimetro: { category: 'geometria', skill: 'perimetro' },
  medidas: { category: 'medidas', skill: 'medidas' },
  dinero: { category: 'medidas', skill: 'dinero' },
};

export function findCategory(id: string | null | undefined): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

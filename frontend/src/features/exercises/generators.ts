import { fmt, pick, randInt, shuffle, uuid } from '../../lib/random';
import type { Lesson, Question, SkillId, Visual } from '../../types';

export const QUESTIONS_PER_LESSON = 5;

type Draft = Omit<Question, 'id' | 'skill' | 'options'> & { distractors: string[] };
type Generator = () => Draft;

/** Arma 4 opciones únicas (respuesta + 3 distractores) en orden aleatorio. */
function buildOptions(answer: string, distractors: string[], filler: () => string): string[] {
  const set = new Set<string>([answer]);
  for (const d of distractors) {
    if (set.size >= 4) break;
    if (d && !d.startsWith('-')) set.add(d);
  }
  let guard = 0;
  while (set.size < 4 && guard++ < 50) set.add(filler());
  return shuffle([...set]);
}

function nearNumbers(n: number, offsets: number[]): string[] {
  return offsets.map((o) => n + o).filter((v) => v > 0).map(fmt);
}

/* ---------------- Mundo 1: Tikal ---------------- */

const PLACE_NAMES = ['unidades', 'decenas', 'centenas', 'unidades de millar', 'decenas de millar'];

const valorPosicional: Generator = () => {
  if (Math.random() < 0.5) {
    // Dígito con valor único dentro del número
    let n = 0;
    let digits: number[] = [];
    let pos = 0;
    do {
      n = randInt(1000, 99999);
      digits = String(n).split('').reverse().map(Number);
      pos = randInt(1, digits.length - 1);
    } while (digits[pos] === 0 || digits.filter((d) => d === digits[pos]).length > 1);
    const d = digits[pos];
    const answer = d * 10 ** pos;
    return {
      prompt: `¿Cuál es el valor del ${d} en el número ${fmt(n)}?`,
      answer: fmt(answer),
      distractors: [0, 1, 2, 3, 4].filter((p) => p !== pos).map((p) => fmt(d * 10 ** p)),
      explanation: `El ${d} está en las ${PLACE_NAMES[pos]}, así que vale ${fmt(answer)}.`,
    };
  }
  const um = randInt(1, 9);
  const c = randInt(0, 9);
  const dd = randInt(1, 9);
  const u = randInt(0, 9);
  const answer = um * 1000 + c * 100 + dd * 10 + u;
  return {
    prompt: `¿Qué número tiene ${um} unidades de millar, ${c} centenas, ${dd} decenas y ${u} unidades?`,
    answer: fmt(answer),
    distractors: [
      fmt(u * 1000 + dd * 100 + c * 10 + um),
      fmt(um * 1000 + dd * 100 + c * 10 + u),
      fmt(um * 100 + c * 10 + dd),
      fmt(um * 10000 + c * 100 + dd * 10 + u),
    ],
  };
};

function sumNoCarry(a: number, b: number): number {
  const da = String(a).padStart(5, '0').split('').map(Number);
  const db = String(b).padStart(5, '0').split('').map(Number);
  return Number(da.map((x, i) => (x + db[i]) % 10).join(''));
}

const suma: Generator = () => {
  const a = randInt(150, 4999);
  const b = randInt(150, 4999);
  const answer = a + b;
  const story = pick([
    `En la escuela hay ${fmt(a)} libros y llegan ${fmt(b)} más. ¿Cuántos libros hay ahora?`,
    `Un agricultor cosechó ${fmt(a)} mazorcas el lunes y ${fmt(b)} el martes. ¿Cuántas cosechó en total?`,
    `${fmt(a)} + ${fmt(b)} = ?`,
    `${fmt(a)} + ${fmt(b)} = ?`,
  ]);
  return {
    prompt: story,
    answer: fmt(answer),
    distractors: [fmt(sumNoCarry(a, b)), ...nearNumbers(answer, [10, -10, 100, -100, 1])],
    explanation: `${fmt(a)} + ${fmt(b)} = ${fmt(answer)}. ¡No olvides las llevadas!`,
  };
};

function subtractNoBorrow(a: number, b: number): number {
  const da = String(a).padStart(5, '0').split('').map(Number);
  const db = String(b).padStart(5, '0').split('').map(Number);
  return Number(da.map((x, i) => Math.abs(x - db[i])).join(''));
}

const resta: Generator = () => {
  const a = randInt(1000, 9999);
  const b = randInt(120, a - 100);
  const answer = a - b;
  const story = pick([
    `Una tienda tenía ${fmt(a)} tortillas y vendió ${fmt(b)}. ¿Cuántas le quedan?`,
    `Un tren lleva ${fmt(a)} sacos de café y descarga ${fmt(b)}. ¿Cuántos quedan?`,
    `${fmt(a)} − ${fmt(b)} = ?`,
    `${fmt(a)} − ${fmt(b)} = ?`,
  ]);
  return {
    prompt: story,
    answer: fmt(answer),
    distractors: [fmt(subtractNoBorrow(a, b)), ...nearNumbers(answer, [10, -10, 100, -100, 1])],
    explanation: `${fmt(a)} − ${fmt(b)} = ${fmt(answer)}.`,
  };
};

const multiplicacion: Generator = () => {
  const a = randInt(2, 10);
  const b = randInt(2, 10);
  const answer = a * b;
  return {
    prompt: `${a} × ${b} = ?`,
    answer: String(answer),
    distractors: [a * (b + 1), a * (b - 1), (a + 1) * b, a + b, answer + 2].map(String),
    explanation: `${a} veces ${b} es ${answer}.`,
  };
};

const problemas: Generator = () => {
  const a = randInt(12, 48);
  const b = randInt(2, 9);
  const answer = a * b;
  const prompt = pick([
    `Una caja tiene ${a} mangos. ¿Cuántos mangos hay en ${b} cajas?`,
    `Un bus lleva ${a} pasajeros en cada viaje. Si hace ${b} viajes, ¿cuántos pasajeros llevó?`,
    `Cada cuaderno cuesta Q${a}. ¿Cuánto cuestan ${b} cuadernos?`,
    `Doña Rosa hace ${a} tamales cada día. ¿Cuántos tamales hace en ${b} días?`,
  ]);
  const isMoney = prompt.includes('Q');
  const f = (n: number) => (isMoney ? `Q${fmt(n)}` : fmt(n));
  return {
    prompt,
    answer: f(answer),
    distractors: [a + b, answer + 10, answer - 10, a * (b + 1)].filter((n) => n > 0).map(f),
    explanation: `${a} × ${b} = ${fmt(answer)}.`,
  };
};

/* ---------------- Mundo 2: Yaxhá ---------------- */

const division: Generator = () => {
  const b = randInt(2, 9);
  const q = randInt(2, 10);
  const a = b * q;
  const prompt = pick([
    `${a} ÷ ${b} = ?`,
    `Reparte ${a} dulces entre ${b} amigos en partes iguales. ¿Cuántos le tocan a cada uno?`,
    `Hay ${a} niños y se forman ${b} equipos iguales. ¿Cuántos niños hay en cada equipo?`,
  ]);
  return {
    prompt,
    answer: String(q),
    distractors: [q + 1, q - 1, q + 2, b].map(String),
    explanation: `${b} × ${q} = ${a}, entonces ${a} ÷ ${b} = ${q}.`,
  };
};

const divisionLarga: Generator = () => {
  const b = randInt(2, 9);
  if (Math.random() < 0.3) {
    const q = randInt(10, 60);
    const r = randInt(1, b - 1 || 1);
    const a = b * q + r;
    return {
      prompt: `Al dividir ${a} ÷ ${b}, ¿cuánto sobra (residuo)?`,
      answer: String(r),
      distractors: [0, r + 1, r - 1, b, q].map(String),
      explanation: `${b} × ${q} = ${b * q}, y ${a} − ${b * q} = ${r}.`,
    };
  }
  const q = randInt(11, 199);
  const a = b * q;
  return {
    prompt: `${fmt(a)} ÷ ${b} = ?`,
    answer: fmt(q),
    distractors: nearNumbers(q, [1, -1, 10, -10, 100]),
    explanation: `${b} × ${q} = ${fmt(a)}.`,
  };
};

const frac = (n: number, d: number) => `${n}/${d}`;

const fraccionIdentificar: Generator = () => {
  const den = pick([2, 3, 4, 5, 6, 8]);
  const num = randInt(1, den - 1);
  const visual: Visual = { kind: 'fraction', numerator: num, denominator: den, shape: pick(['circle', 'bar'] as const) };
  return {
    prompt: '¿Qué fracción está pintada?',
    visual,
    answer: frac(num, den),
    distractors: [
      frac(den - num, den),
      frac(num, den + 1),
      frac(num + 1 < den ? num + 1 : num - 1 || 1, den),
      frac(den, num),
    ],
    explanation: `Hay ${den} partes iguales y ${num} están pintadas: ${num}/${den}.`,
  };
};

const fraccionComparar: Generator = () => {
  if (Math.random() < 0.5) {
    const den = randInt(5, 10);
    const nums = shuffle(Array.from({ length: den - 1 }, (_, i) => i + 1)).slice(0, 4);
    const max = Math.max(...nums);
    return {
      prompt: '¿Cuál es la fracción más grande?',
      answer: frac(max, den),
      distractors: nums.filter((n) => n !== max).map((n) => frac(n, den)),
      explanation: 'Si el denominador es igual, la más grande es la que tiene el numerador mayor.',
    };
  }
  const dens = shuffle([2, 3, 4, 5, 6, 8, 10]).slice(0, 4);
  const min = Math.min(...dens);
  return {
    prompt: '¿Cuál fracción es más grande?',
    answer: frac(1, min),
    distractors: dens.filter((d) => d !== min).map((d) => frac(1, d)),
    explanation: `Mientras menos partes, más grande es cada pedazo: 1/${min} es la mayor.`,
  };
};

const fraccionSumar: Generator = () => {
  const den = randInt(3, 10);
  const a = randInt(1, den - 2);
  const b = randInt(1, den - 1 - a);
  return {
    prompt: `${frac(a, den)} + ${frac(b, den)} = ?`,
    answer: frac(a + b, den),
    distractors: [frac(a + b, den * 2), frac(a + b + 1, den), frac(Math.abs(a - b) || 1, den), frac(a * b, den)],
    explanation: `Con el mismo denominador, solo se suman los numeradores: ${a} + ${b} = ${a + b}.`,
  };
};

/* ---------------- Mundo 3: El Mirador ---------------- */

const angulos: Generator = () => {
  if (Math.random() < 0.2) {
    return {
      prompt: '¿Cuánto mide un ángulo recto?',
      answer: '90°',
      distractors: ['45°', '180°', '360°'],
      explanation: 'Un ángulo recto mide 90°, como la esquina de un cuaderno.',
    };
  }
  const type = pick(['Agudo', 'Recto', 'Obtuso', 'Llano'] as const);
  const degrees =
    type === 'Agudo' ? randInt(2, 8) * 10 : type === 'Recto' ? 90 : type === 'Obtuso' ? randInt(11, 16) * 10 : 180;
  const why: Record<typeof type, string> = {
    Agudo: 'mide menos de 90°',
    Recto: 'mide exactamente 90°',
    Obtuso: 'mide más de 90° y menos de 180°',
    Llano: 'mide 180°, es una línea recta',
  };
  return {
    prompt: '¿Qué tipo de ángulo es este?',
    visual: { kind: 'angle', degrees },
    answer: type,
    distractors: ['Agudo', 'Recto', 'Obtuso', 'Llano'],
    explanation: `Es ${type.toLowerCase()} porque ${why[type]}.`,
  };
};

const SHAPES: { sides: number; name: string }[] = [
  { sides: 3, name: 'Triángulo' },
  { sides: 4, name: 'Cuadrado' },
  { sides: 5, name: 'Pentágono' },
  { sides: 6, name: 'Hexágono' },
  { sides: 8, name: 'Octágono' },
];

const figuras: Generator = () => {
  const shape = pick(SHAPES);
  if (Math.random() < 0.5) {
    return {
      prompt: '¿Cómo se llama esta figura?',
      visual: { kind: 'polygon', sides: shape.sides },
      answer: shape.name,
      distractors: SHAPES.map((s) => s.name),
      explanation: `Tiene ${shape.sides} lados: es un ${shape.name.toLowerCase()}.`,
    };
  }
  return {
    prompt: `¿Cuántos lados tiene un ${shape.name.toLowerCase()}?`,
    answer: String(shape.sides),
    distractors: ['3', '4', '5', '6', '8', '10'],
    explanation: `Un ${shape.name.toLowerCase()} tiene ${shape.sides} lados.`,
  };
};

const perimetro: Generator = () => {
  const unit = pick(['cm', 'm']);
  const w = randInt(3, 15);
  const h = Math.random() < 0.3 ? w : randInt(2, 12);
  const answer = 2 * (w + h);
  const u = (n: number) => `${n} ${unit}`;
  return {
    prompt: w === h ? '¿Cuál es el perímetro de este cuadrado?' : '¿Cuál es el perímetro de este rectángulo?',
    visual: { kind: 'rect', width: w, height: h, unit },
    answer: u(answer),
    distractors: [u(w * h), u(w + h), u(2 * w + h), u(answer + 2)],
    explanation: `Suma todos los lados: ${w} + ${h} + ${w} + ${h} = ${answer} ${unit}.`,
  };
};

const CONVERSIONS = [
  { one: 'metro', from: 'metros', to: 'centímetros', factor: 100 },
  { one: 'kilómetro', from: 'kilómetros', to: 'metros', factor: 1000 },
  { one: 'kilogramo', from: 'kilogramos', to: 'gramos', factor: 1000 },
  { one: 'hora', from: 'horas', to: 'minutos', factor: 60 },
  { one: 'día', from: 'días', to: 'horas', factor: 24 },
  { one: 'semana', from: 'semanas', to: 'días', factor: 7 },
];

const medidas: Generator = () => {
  const c = pick(CONVERSIONS);
  const n = randInt(2, 9);
  const answer = n * c.factor;
  return {
    prompt: `¿Cuántos ${c.to} hay en ${n} ${c.from}?`,
    answer: fmt(answer),
    distractors: [n * 10, n * 100, n * 1000, n * 60, n + c.factor, answer + c.factor]
      .filter((v) => v !== answer)
      .map(fmt),
    explanation: `En 1 ${c.one} hay ${fmt(c.factor)} ${c.to}, así que ${n} × ${fmt(c.factor)} = ${fmt(answer)}.`,
  };
};

const ITEMS = ['un tamal', 'un cuaderno', 'una pelota', 'un refresco', 'una libra de frijol', 'un lápiz', 'unas tortillas'];

const dinero: Generator = () => {
  if (Math.random() < 0.5) {
    const price = randInt(3, 95);
    const bill = [5, 10, 20, 50, 100].find((b) => b > price)!;
    const answer = bill - price;
    return {
      prompt: `Compras ${pick(ITEMS)} que cuesta Q${price} y pagas con un billete de Q${bill}. ¿Cuánto te dan de vuelto?`,
      answer: `Q${answer}`,
      distractors: [answer + 1, answer - 1, answer + 10, price].filter((n) => n > 0).map((n) => `Q${n}`),
      explanation: `Q${bill} − Q${price} = Q${answer}.`,
    };
  }
  const [i1, i2] = shuffle(ITEMS);
  const a = randInt(4, 45);
  const b = randInt(4, 45);
  return {
    prompt: `${i1[0].toUpperCase()}${i1.slice(1)} cuesta Q${a} y ${i2} cuesta Q${b}. ¿Cuánto pagas por los dos?`,
    answer: `Q${a + b}`,
    distractors: [a + b + 1, a + b - 1, a + b + 10, Math.abs(a - b)].filter((n) => n > 0).map((n) => `Q${n}`),
    explanation: `Q${a} + Q${b} = Q${a + b}.`,
  };
};

const GENERATORS: Record<string, Generator> = {
  'tikal-1': valorPosicional,
  'tikal-2': suma,
  'tikal-3': resta,
  'tikal-4': multiplicacion,
  'tikal-5': problemas,
  'yaxha-1': division,
  'yaxha-2': divisionLarga,
  'yaxha-3': fraccionIdentificar,
  'yaxha-4': fraccionComparar,
  'yaxha-5': fraccionSumar,
  'mirador-1': angulos,
  'mirador-2': figuras,
  'mirador-3': perimetro,
  'mirador-4': medidas,
  'mirador-5': dinero,
};

export function generateLesson(lesson: Lesson, count = QUESTIONS_PER_LESSON): Question[] {
  const generator = GENERATORS[lesson.id];
  const seen = new Set<string>();
  const questions: Question[] = [];
  let guard = 0;
  while (questions.length < count && guard++ < count * 20) {
    const draft = generator();
    const key = draft.prompt + JSON.stringify(draft.visual ?? '');
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(toQuestion(draft, lesson.skill));
  }
  return questions;
}

function toQuestion({ distractors, ...draft }: Draft, skill: SkillId): Question {
  // El primer distractor es el error más común; el resto se mezcla para variar.
  const pool = [distractors[0], ...shuffle(distractors.slice(1))];
  return {
    ...draft,
    id: uuid(),
    skill,
    options: buildOptions(draft.answer, pool, () => {
      // Relleno por si los distractores no alcanzan
      const fraction = draft.answer.match(/^(\d+)\/(\d+)$/);
      if (fraction) return frac(randInt(1, Number(fraction[2])), Number(fraction[2]));
      const n = Number(draft.answer.replace(/[^\d]/g, ''));
      return n > 0 ? draft.answer.replace(/[\d,]+/, fmt(n + randInt(2, 9))) : String(randInt(1, 20));
    }),
  };
}

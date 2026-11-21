import { fmt, pick, randInt, shuffle, uuid } from '../../lib/random';
import type { Difficulty, ExerciseId, Interaction, Lesson, Question } from '../../types';
import { EXERCISES } from '../curriculum/catalog';

export const QUESTIONS_PER_LESSON = 5;

type Draft = Omit<
  Question,
  'id' | 'skill' | 'exercise' | 'category' | 'difficulty' | 'interaction' | 'options' | 'commonError'
> & {
  distractors: string[];
  /** Error que revela el primer distractor, para el profesor y el motor adaptativo. */
  errorTag?: string;
  interaction?: Interaction;
};
type Generator = (d: Difficulty) => Draft;

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

/** "a, b y c" */
function listText(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/* ---------------- Números y operaciones ---------------- */

const PLACE_NAMES = ['unidades', 'decenas', 'centenas', 'unidades de millar', 'decenas de millar'];

const valorPosicional: Generator = (d) => {
  const [min, max] = d === 1 ? [100, 999] : d === 2 ? [1000, 99999] : [10000, 99999];
  if (Math.random() < 0.5) {
    // Dígito con valor único dentro del número
    let n = 0;
    let digits: number[] = [];
    let pos = 0;
    do {
      n = randInt(min, max);
      digits = String(n).split('').reverse().map(Number);
      pos = randInt(1, digits.length - 1);
    } while (digits[pos] === 0 || digits.filter((x) => x === digits[pos]).length > 1);
    const digit = digits[pos];
    const answer = digit * 10 ** pos;
    return {
      prompt: `¿Cuál es el valor del ${digit} en el número ${fmt(n)}?`,
      answer: fmt(answer),
      distractors: [digit, ...[1, 2, 3, 4].filter((p) => p !== pos).map((p) => digit * 10 ** p)].map(fmt),
      errorTag: 'valor-absoluto',
      explanation: `El ${digit} está en las ${PLACE_NAMES[pos]}, así que vale ${fmt(answer)}.`,
    };
  }
  const parts = d + 2;
  const ds = Array.from({ length: parts }, (_, i) => (i === 0 || i === parts - 2 ? randInt(1, 9) : randInt(0, 9)));
  const names = PLACE_NAMES.slice(0, parts).reverse();
  const answer = Number(ds.join(''));
  const swapped = [...ds];
  [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
  return {
    prompt: `¿Qué número tiene ${listText(ds.map((x, i) => `${x} ${names[i]}`))}?`,
    answer: fmt(answer),
    distractors: [
      fmt(Number([...ds].reverse().join(''))),
      fmt(Number(swapped.join(''))),
      fmt(answer * 10),
      fmt(Math.floor(answer / 10)),
    ],
    errorTag: 'orden-cifras',
  };
};

function sumNoCarry(a: number, b: number): number {
  const da = String(a).padStart(5, '0').split('').map(Number);
  const db = String(b).padStart(5, '0').split('').map(Number);
  return Number(da.map((x, i) => (x + db[i]) % 10).join(''));
}

const suma: Generator = (d) => {
  const [min, max] = d === 1 ? [10, 499] : d === 2 ? [150, 4999] : [10000, 49999];
  const a = randInt(min, max);
  const b = randInt(min, max);
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
    errorTag: 'sin-llevar',
    explanation: `${fmt(a)} + ${fmt(b)} = ${fmt(answer)}. ¡No olvides las llevadas!`,
  };
};

function subtractNoBorrow(a: number, b: number): number {
  const da = String(a).padStart(5, '0').split('').map(Number);
  const db = String(b).padStart(5, '0').split('').map(Number);
  return Number(da.map((x, i) => Math.abs(x - db[i])).join(''));
}

const resta: Generator = (d) => {
  const a = d === 1 ? randInt(100, 999) : d === 2 ? randInt(1000, 9999) : randInt(10000, 99999);
  const b = randInt(Math.max(11, Math.floor(a * 0.15)), a - 10);
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
    errorTag: 'resta-sin-prestar',
    explanation: `${fmt(a)} − ${fmt(b)} = ${fmt(answer)}.`,
  };
};

const multiplicacion: Generator = (d) => {
  if (d === 3) {
    const a = randInt(12, 99);
    const b = randInt(11, 25);
    const answer = a * b;
    const units = b % 10;
    return {
      prompt: `${a} × ${b} = ?`,
      answer: fmt(answer),
      distractors: [a * units + a * Math.floor(b / 10), answer + 10, answer - 10, a * (b + 1)].map(fmt),
      errorTag: 'sin-correr-lugar',
      explanation: `${a} × ${units} = ${fmt(a * units)} y ${a} × ${b - units} = ${fmt(a * (b - units))}. Juntos: ${fmt(answer)}.`,
    };
  }
  const a = randInt(2, d === 1 ? 5 : 10);
  const b = randInt(2, 10);
  const answer = a * b;
  return {
    prompt: `${a} × ${b} = ?`,
    answer: String(answer),
    distractors: [a * (b + 1), a * (b - 1), (a + 1) * b, a + b, answer + 2].map(String),
    errorTag: 'tabla-vecina',
    explanation: `${a} veces ${b} es ${answer}.`,
  };
};

const problemas: Generator = (d) => {
  const a = d === 1 ? randInt(2, 12) : d === 2 ? randInt(12, 48) : randInt(25, 99);
  const b = d === 1 ? randInt(2, 5) : d === 2 ? randInt(2, 9) : randInt(11, 20);
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
    errorTag: 'suma-en-vez-de-multiplicar',
    explanation: `${a} × ${b} = ${fmt(answer)}.`,
  };
};

const division: Generator = (d) => {
  const b = d === 1 ? randInt(2, 5) : d === 2 ? randInt(2, 9) : randInt(11, 15);
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
    errorTag: 'cociente-cercano',
    explanation: `${b} × ${q} = ${a}, entonces ${a} ÷ ${b} = ${q}.`,
  };
};

const divisionLarga: Generator = (d) => {
  const b = d === 1 ? randInt(2, 5) : d === 2 ? randInt(2, 9) : randInt(11, 25);
  if (Math.random() < 0.3) {
    const q = randInt(10, d === 3 ? 90 : 60);
    const r = randInt(1, b - 1);
    const a = b * q + r;
    return {
      prompt: `Al dividir ${fmt(a)} ÷ ${b}, ¿cuánto sobra (residuo)?`,
      answer: String(r),
      distractors: [0, r + 1, r - 1, b, q].map(String),
      errorTag: 'residuo-cero',
      explanation: `${b} × ${q} = ${fmt(b * q)}, y ${fmt(a)} − ${fmt(b * q)} = ${r}.`,
    };
  }
  const q = randInt(11, d === 3 ? 150 : 199);
  const a = b * q;
  return {
    prompt: `${fmt(a)} ÷ ${b} = ?`,
    answer: fmt(q),
    distractors: nearNumbers(q, [1, -1, 10, -10, 100]),
    errorTag: 'cociente-cercano',
    explanation: `${b} × ${q} = ${fmt(a)}.`,
  };
};

/* ---------------- Fracciones ---------------- */

const frac = (n: number, d: number) => `${n}/${d}`;

const fraccionIdentificar: Generator = (d) => {
  const den = pick(d === 1 ? [2, 3, 4] : d === 2 ? [2, 3, 4, 5, 6, 8] : [5, 6, 8, 10, 12]);
  const num = randInt(1, den - 1);
  return {
    prompt: '¿Qué fracción está pintada?',
    visual: { kind: 'fraction', numerator: num, denominator: den, shape: pick(['circle', 'bar'] as const) },
    answer: frac(num, den),
    distractors: [
      frac(den - num, den),
      frac(num, den + 1),
      frac(num + 1 < den ? num + 1 : num - 1 || 1, den),
      frac(den, num),
    ],
    errorTag: 'cuenta-no-pintadas',
    explanation: `Hay ${den} partes iguales y ${num} están pintadas: ${num}/${den}.`,
  };
};

const fraccionComparar: Generator = (d) => {
  if (d === 1 || Math.random() < 0.5) {
    const den = d === 1 ? randInt(5, 6) : randInt(5, 10);
    const nums = shuffle(Array.from({ length: den - 1 }, (_, i) => i + 1)).slice(0, 4);
    const max = Math.max(...nums);
    return {
      prompt: '¿Cuál es la fracción más grande?',
      answer: frac(max, den),
      distractors: nums.filter((n) => n !== max).map((n) => frac(n, den)),
      explanation: 'Si el denominador es igual, la más grande es la que tiene el numerador mayor.',
    };
  }
  const dens = shuffle(d === 3 ? [2, 3, 4, 5, 6, 8, 10, 12] : [2, 3, 4, 5, 6, 8, 10]).slice(0, 4);
  const min = Math.min(...dens);
  const max = Math.max(...dens);
  return {
    prompt: '¿Cuál fracción es más grande?',
    answer: frac(1, min),
    distractors: [frac(1, max), ...dens.filter((x) => x !== min && x !== max).map((x) => frac(1, x))],
    errorTag: 'denominador-mayor',
    explanation: `Mientras menos partes, más grande es cada pedazo: 1/${min} es la mayor.`,
  };
};

const fraccionSumar: Generator = (d) => {
  const den = d === 1 ? randInt(3, 6) : d === 2 ? randInt(3, 10) : randInt(6, 12);
  const a = randInt(1, den - 2);
  const b = randInt(1, den - 1 - a);
  return {
    prompt: `${frac(a, den)} + ${frac(b, den)} = ?`,
    answer: frac(a + b, den),
    distractors: [frac(a + b, den * 2), frac(a + b + 1, den), frac(Math.abs(a - b) || 1, den), frac(a * b, den)],
    errorTag: 'suma-denominadores',
    explanation: `Con el mismo denominador, solo se suman los numeradores: ${a} + ${b} = ${a + b}.`,
  };
};

/* ---------------- Geometría ---------------- */

const angulos: Generator = (d) => {
  if (Math.random() < (d === 1 ? 0.3 : 0.15)) {
    return {
      prompt: '¿Cuánto mide un ángulo recto?',
      answer: '90°',
      distractors: ['45°', '180°', '360°'],
      explanation: 'Un ángulo recto mide 90°, como la esquina de un cuaderno.',
    };
  }
  const types = d === 1 ? (['Agudo', 'Recto', 'Obtuso'] as const) : (['Agudo', 'Recto', 'Obtuso', 'Llano'] as const);
  const type = pick(types);
  const agudo = d === 1 ? pick([30, 45]) : d === 2 ? randInt(2, 8) * 10 : pick([75, 80, 85]);
  const obtuso = d === 1 ? pick([135, 150]) : d === 2 ? randInt(11, 16) * 10 : pick([95, 100, 105]);
  const degrees = type === 'Agudo' ? agudo : type === 'Recto' ? 90 : type === 'Obtuso' ? obtuso : 180;
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
  { sides: 7, name: 'Heptágono' },
  { sides: 10, name: 'Decágono' },
];

const figuras: Generator = (d) => {
  const pool = SHAPES.slice(0, d === 1 ? 3 : d === 2 ? 5 : 7);
  const shape = pick(pool);
  if (Math.random() < 0.5) {
    return {
      prompt: '¿Cómo se llama esta figura?',
      visual: { kind: 'polygon', sides: shape.sides },
      answer: shape.name,
      distractors: shuffle(SHAPES.map((s) => s.name)),
      explanation: `Tiene ${shape.sides} lados: es un ${shape.name.toLowerCase()}.`,
    };
  }
  return {
    prompt: `¿Cuántos lados tiene un ${shape.name.toLowerCase()}?`,
    answer: String(shape.sides),
    distractors: shuffle(['3', '4', '5', '6', '7', '8', '10']),
    explanation: `Un ${shape.name.toLowerCase()} tiene ${shape.sides} lados.`,
  };
};

const perimetro: Generator = (d) => {
  const unit = pick(['cm', 'm']);
  const max = d === 1 ? 8 : d === 2 ? 15 : 40;
  const w = randInt(3, max);
  const h = d === 1 || Math.random() < 0.3 ? w : randInt(2, max - 2);
  const answer = 2 * (w + h);
  const u = (n: number) => `${n} ${unit}`;
  return {
    prompt: w === h ? '¿Cuál es el perímetro de este cuadrado?' : '¿Cuál es el perímetro de este rectángulo?',
    visual: { kind: 'rect', width: w, height: h, unit },
    answer: u(answer),
    distractors: [u(w * h), u(w + h), u(2 * w + h), u(answer + 2)],
    errorTag: 'confunde-area',
    explanation: `Suma todos los lados: ${w} + ${h} + ${w} + ${h} = ${answer} ${unit}.`,
  };
};

/* ---------------- Medidas y dinero ---------------- */

const CONVERSIONS = [
  { one: 'metro', from: 'metros', to: 'centímetros', factor: 100 },
  { one: 'día', from: 'días', to: 'horas', factor: 24 },
  { one: 'semana', from: 'semanas', to: 'días', factor: 7 },
  { one: 'kilómetro', from: 'kilómetros', to: 'metros', factor: 1000 },
  { one: 'kilogramo', from: 'kilogramos', to: 'gramos', factor: 1000 },
  { one: 'hora', from: 'horas', to: 'minutos', factor: 60 },
  { one: 'libra', from: 'libras', to: 'onzas', factor: 16 },
];

const medidas: Generator = (d) => {
  const c = pick(d === 1 ? CONVERSIONS.slice(0, 3) : CONVERSIONS);
  const n = d === 1 ? randInt(2, 5) : d === 2 ? randInt(2, 9) : randInt(10, 25);
  const answer = n * c.factor;
  return {
    prompt: `¿Cuántos ${c.to} hay en ${n} ${c.from}?`,
    answer: fmt(answer),
    distractors: [n * 10, n * 100, n * 1000, n * 60, n + c.factor, answer + c.factor]
      .filter((v) => v !== answer)
      .map(fmt),
    errorTag: 'factor-equivocado',
    explanation: `En 1 ${c.one} hay ${fmt(c.factor)} ${c.to}, así que ${n} × ${fmt(c.factor)} = ${fmt(answer)}.`,
  };
};

const ITEMS = ['un tamal', 'un cuaderno', 'una pelota', 'un refresco', 'una libra de frijol', 'un lápiz', 'unas tortillas'];

const dinero: Generator = (d) => {
  if (Math.random() < 0.5) {
    const price = d === 1 ? randInt(3, 19) : d === 2 ? randInt(3, 95) : randInt(105, 190);
    const bill = [5, 10, 20, 50, 100, 200].find((b) => b > price)!;
    const answer = bill - price;
    return {
      prompt: `Compras ${pick(ITEMS)} que cuesta Q${price} y pagas con un billete de Q${bill}. ¿Cuánto te dan de vuelto?`,
      answer: `Q${answer}`,
      distractors: [bill + price, answer + 1, answer - 1, answer + 10, price].filter((n) => n > 0).map((n) => `Q${n}`),
      errorTag: 'suma-en-vez-de-restar',
      explanation: `Q${bill} − Q${price} = Q${answer}.`,
    };
  }
  const [i1, i2] = shuffle(ITEMS);
  const [min, max] = d === 1 ? [2, 20] : d === 2 ? [4, 45] : [25, 150];
  const a = randInt(min, max);
  const b = randInt(min, max);
  return {
    prompt: `${i1[0].toUpperCase()}${i1.slice(1)} cuesta Q${a} y ${i2} cuesta Q${b}. ¿Cuánto pagas por los dos?`,
    answer: `Q${a + b}`,
    distractors: [Math.abs(a - b), a + b + 1, a + b - 1, a + b + 10].filter((n) => n > 0).map((n) => `Q${n}`),
    errorTag: 'resta-en-vez-de-sumar',
    explanation: `Q${a} + Q${b} = Q${a + b}.`,
  };
};

/* ---------------- Numeración maya ---------------- */

const MAYA_PLACES = [1, 20, 400];

/** Dígitos en base 20, del nivel más alto al más bajo. */
export function mayaDigits(value: number): number[] {
  const digits: number[] = [];
  let n = value;
  do {
    digits.unshift(n % 20);
    n = Math.floor(n / 20);
  } while (n > 0);
  return digits;
}

function mayaValue(d: Difficulty): number {
  return d === 1 ? randInt(1, 19) : d === 2 ? randInt(21, 399) : randInt(401, 1999);
}

function mayaExplanation(value: number): string {
  const digits = mayaDigits(value);
  if (digits.length === 1) {
    return `${Math.floor(value / 5)} barra(s) valen ${Math.floor(value / 5) * 5} y ${value % 5} punto(s) valen ${value % 5}: ${value}.`;
  }
  const parts = digits.map((dg, i) => {
    const place = MAYA_PLACES[digits.length - 1 - i];
    return place === 1 ? `${dg}` : `${dg} × ${place}`;
  });
  return `Cada nivel vale 20 veces más que el de abajo: ${parts.join(' + ')} = ${fmt(value)}.`;
}

const mayaLeer: Generator = (d) => {
  const value = mayaValue(d);
  const digits = mayaDigits(value);
  const naive = digits.length > 1 ? digits.reduce((s, x) => s + x, 0) : Math.floor(value / 5) + (value % 5);
  return {
    prompt: '¿Qué número maya es este?',
    visual: { kind: 'maya', value },
    answer: fmt(value),
    distractors: [naive, value + 1, value - 1, value + 5, value + 20].filter((n) => n > 0 && n !== value).map(fmt),
    errorTag: digits.length > 1 ? 'posicion-maya' : 'barra-vale-5',
    explanation: mayaExplanation(value),
  };
};

const mayaFormar: Generator = (d) => {
  const value = mayaValue(d);
  return {
    prompt: `Forma el número ${fmt(value)} con numeración maya`,
    answer: fmt(value),
    distractors: [],
    interaction: 'maya',
    mayaLevels: d,
    explanation: mayaExplanation(value),
  };
};

/* ---------------- Minijuegos ---------------- */

const PLACES_UP_TO_THOUSANDS = [1000, 100, 10, 1];

function placeExplanation(n: number): string {
  const digits = String(n).split('').map(Number);
  const names = PLACE_NAMES.slice(0, digits.length).reverse();
  return `${fmt(n)} = ${listText(digits.map((x, i) => `${x} ${names[i]}`))}.`;
}

const bloquesFormar: Generator = (d) => {
  const n =
    d === 1
      ? randInt(101, 999)
      : d === 2
        ? randInt(1001, 9999)
        : randInt(1, 9) * 1000 + (Math.random() < 0.5 ? 0 : randInt(1, 9) * 100) + randInt(0, 9) * 10 + randInt(1, 9);
  return {
    prompt: `Forma el número ${fmt(n)} con bloques`,
    answer: fmt(n),
    distractors: [],
    interaction: 'blocks',
    game: { kind: 'blocks', places: n < 1000 ? PLACES_UP_TO_THOUSANDS.slice(1) : PLACES_UP_TO_THOUSANDS },
    explanation: placeExplanation(n),
  };
};

const sumaBloques: Generator = (d) => {
  if (d === 3) return suma(d);
  const [min, max] = d === 1 ? [15, 480] : [120, 4800];
  const a = randInt(min, max);
  const b = randInt(min, max);
  return {
    prompt: `Junta con bloques: ${fmt(a)} + ${fmt(b)}`,
    answer: fmt(a + b),
    distractors: [fmt(sumNoCarry(a, b))],
    errorTag: 'sin-llevar',
    interaction: 'blocks',
    game: { kind: 'blocks', places: a + b < 1000 ? PLACES_UP_TO_THOUSANDS.slice(1) : PLACES_UP_TO_THOUSANDS },
    explanation: `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}. Cuando juntas 10 de una columna, se cambian por 1 de la siguiente.`,
  };
};

/** Números con las mismas cifras en otro orden: obliga a mirar el valor posicional. */
function shuffledDigitsNumbers(d: Difficulty): number[] {
  const length = d === 1 ? 3 : d === 2 ? 4 : 5;
  for (;;) {
    const digits = Array.from({ length }, () => randInt(1, 9));
    const set = new Set<number>();
    for (let tries = 0; set.size < 4 && tries < 40; tries++) set.add(Number(shuffle(digits).join('')));
    if (set.size === 4) return [...set];
  }
}

const ordenarNumeros: Generator = (d) => {
  const numbers = d === 1 && Math.random() < 0.5 ? shuffle(Array.from({ length: 4 }, () => randInt(100, 999))) : shuffledDigitsNumbers(d);
  if (new Set(numbers).size < 4) return ordenarNumeros(d);
  const descending = Math.random() < 0.3;
  const sorted = [...numbers].sort((a, b) => (descending ? b - a : a - b)).map(fmt);
  const sep = descending ? '>' : '<';
  return {
    prompt: descending ? 'Toca los números del más grande al más pequeño' : 'Toca los números del más pequeño al más grande',
    answer: sorted.join(` ${sep} `),
    distractors: [],
    interaction: 'order',
    game: { kind: 'order', items: shuffle(numbers.map(fmt)), sep },
    explanation: 'Compara primero la cifra de la izquierda; si es igual, mira la siguiente.',
  };
};

const ordenarFracciones: Generator = (d) => {
  if (d === 3 || Math.random() < 0.3) {
    const dens = shuffle([2, 3, 4, 5, 6, 8, 10, 12]).slice(0, 4);
    return {
      prompt: 'Ordena las fracciones de la más pequeña a la más grande',
      answer: [...dens].sort((a, b) => b - a).map((x) => frac(1, x)).join(' < '),
      distractors: [],
      interaction: 'order',
      game: { kind: 'order', items: dens.map((x) => frac(1, x)), sep: '<' },
      explanation: 'Si la tortilla se parte en más pedazos, cada pedazo es más pequeño.',
    };
  }
  const den = d === 1 ? randInt(5, 6) : randInt(6, 12);
  const nums = shuffle(Array.from({ length: den - 1 }, (_, i) => i + 1)).slice(0, 4);
  return {
    prompt: 'Ordena las fracciones de la más pequeña a la más grande',
    answer: [...nums].sort((a, b) => a - b).map((n) => frac(n, den)).join(' < '),
    distractors: [],
    interaction: 'order',
    game: { kind: 'order', items: nums.map((n) => frac(n, den)), sep: '<' },
    explanation: 'Con el mismo denominador, gana la que tiene más pedazos (numerador mayor).',
  };
};

const fraccionPintar: Generator = (d) => {
  const den = pick(d === 1 ? [2, 3, 4] : d === 2 ? [4, 5, 6, 8] : [6, 8, 10, 12]);
  const num = randInt(1, den - 1);
  return {
    prompt: `Toca la tortilla para pintar ${frac(num, den)}`,
    answer: frac(num, den),
    distractors: [frac(den - num, den)],
    errorTag: 'cuenta-no-pintadas',
    interaction: 'slices',
    game: { kind: 'slices', parts: den },
    explanation: `${frac(num, den)} es pintar ${num} de ${den} pedazos iguales.`,
  };
};

const fraccionSumarPintar: Generator = (d) => {
  const den = d === 1 ? randInt(3, 6) : d === 2 ? randInt(4, 8) : randInt(6, 12);
  const a = randInt(1, den - 2);
  const b = randInt(1, den - 1 - a);
  return {
    prompt: `Pinta en la tortilla cuánto es ${frac(a, den)} + ${frac(b, den)}`,
    answer: frac(a + b, den),
    distractors: [],
    interaction: 'slices',
    game: { kind: 'slices', parts: den },
    explanation: `Pinta ${a} pedazos y luego ${b} más: ${frac(a + b, den)}.`,
  };
};

const dineroMercado: Generator = (d) => {
  const values = d === 1 ? [10, 5, 1] : d === 2 ? [50, 20, 10, 5, 1] : [100, 50, 20, 10, 5, 1];
  const item = pick(ITEMS);
  if (Math.random() < 0.5) {
    const price = d === 1 ? randInt(3, 17) : d === 2 ? randInt(13, 95) : randInt(105, 190);
    const bill = [5, 10, 20, 50, 100, 200].find((b) => b > price)!;
    const change = bill - price;
    return {
      prompt: `Vendes ${item} a Q${price} y te pagan con Q${bill}. Entrega el vuelto exacto.`,
      answer: `Q${change}`,
      distractors: [`Q${bill + price}`],
      errorTag: 'suma-en-vez-de-restar',
      interaction: 'coins',
      game: { kind: 'coins', values },
      explanation: `Q${bill} − Q${price} = Q${change}.`,
    };
  }
  const price = d === 1 ? randInt(6, 19) : d === 2 ? randInt(21, 95) : randInt(105, 190);
  return {
    prompt: `En el mercado, ${item} cuesta Q${price}. Paga con el dinero justo.`,
    answer: `Q${price}`,
    distractors: [],
    interaction: 'coins',
    game: { kind: 'coins', values },
    explanation: `Junta billetes grandes primero y completa con los pequeños hasta Q${price}.`,
  };
};

/** Versión de juego de cada ejercicio que la tiene. */
const GAMES: Partial<Record<ExerciseId, Generator>> = {
  'valor-posicional': (d) => (Math.random() < 0.5 ? bloquesFormar(d) : ordenarNumeros(d)),
  suma: sumaBloques,
  'fraccion-identificar': fraccionPintar,
  'fraccion-comparar': ordenarFracciones,
  'fraccion-sumar': fraccionSumarPintar,
  dinero: dineroMercado,
};

const GENERATORS: Record<ExerciseId, Generator> = {
  'valor-posicional': valorPosicional,
  suma,
  resta,
  multiplicacion,
  problemas,
  division,
  'division-larga': divisionLarga,
  'fraccion-identificar': fraccionIdentificar,
  'fraccion-comparar': fraccionComparar,
  'fraccion-sumar': fraccionSumar,
  angulos,
  figuras,
  perimetro,
  medidas,
  dinero,
  'maya-leer': mayaLeer,
  'maya-formar': mayaFormar,
};

const PLAIN_INTEGER = /^\d{1,3}(,\d{3})*$/;

/**
 * Genera un reto. `numberChance` es la probabilidad de pedirlo con teclado
 * cuando la respuesta es un número entero (evita adivinar entre opciones);
 * `gameChance`, la de usar el minijuego del ejercicio si existe.
 */
export function generateQuestion(exercise: ExerciseId, difficulty: Difficulty, numberChance = 0, gameChance = 0): Question {
  const game = GAMES[exercise];
  const generator = game && Math.random() < gameChance ? game : GENERATORS[exercise];
  const { distractors, errorTag, interaction: forced, ...draft } = generator(difficulty);
  const meta = EXERCISES[exercise];
  const interaction: Interaction =
    forced ?? (PLAIN_INTEGER.test(draft.answer) && Math.random() < numberChance ? 'number' : 'choice');
  const first = distractors[0];
  // El primer distractor es el error más común; el resto se mezcla para variar.
  const pool = [first, ...shuffle(distractors.slice(1))];
  return {
    ...draft,
    id: uuid(),
    skill: meta.skill,
    exercise,
    category: meta.category,
    difficulty,
    interaction,
    commonError: errorTag && first && first !== draft.answer ? { answer: first, tag: errorTag } : undefined,
    options:
      interaction !== 'choice' && interaction !== 'number'
        ? []
        : buildOptions(draft.answer, pool, () => {
            // Relleno por si los distractores no alcanzan
            const fraction = draft.answer.match(/^(\d+)\/(\d+)$/);
            if (fraction) return frac(randInt(1, Number(fraction[2]) - 1), Number(fraction[2]));
            const n = Number(draft.answer.replace(/[^\d]/g, ''));
            return n > 0 ? draft.answer.replace(/[\d,]+/, fmt(n + randInt(2, 9))) : String(randInt(1, 20));
          }),
  };
}

export function generateLesson(lesson: Lesson, difficulty: Difficulty = 2, count = QUESTIONS_PER_LESSON): Question[] {
  const seen = new Set<string>();
  const questions: Question[] = [];
  let guard = 0;
  while (questions.length < count && guard++ < count * 20) {
    const question = generateQuestion(lesson.exercise, difficulty, 0.4, 0.6);
    const key = question.prompt + question.answer + JSON.stringify(question.visual ?? '');
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(question);
  }
  return questions;
}

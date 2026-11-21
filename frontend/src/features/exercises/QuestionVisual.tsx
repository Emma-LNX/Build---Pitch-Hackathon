import type { Visual } from '../../types';

const INK = '#183B4A';
const FILL = '#F5C451';
const EMPTY = '#FFF8E8';

export function QuestionVisual({ visual }: { visual: Visual }) {
  switch (visual.kind) {
    case 'fraction':
      return visual.shape === 'circle' ? <FractionCircle {...visual} /> : <FractionBar {...visual} />;
    case 'angle':
      return <Angle degrees={visual.degrees} />;
    case 'rect':
      return <Rect {...visual} />;
    case 'polygon':
      return <Polygon sides={visual.sides} />;
  }
}

function FractionCircle({ numerator, denominator }: { numerator: number; denominator: number }) {
  const r = 70;
  const slices = Array.from({ length: denominator }, (_, i) => {
    const a0 = (i / denominator) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / denominator) * Math.PI * 2 - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`;
    return <path key={i} d={d} fill={i < numerator ? FILL : EMPTY} stroke={INK} strokeWidth={4} strokeLinejoin="round" />;
  });
  return (
    <svg className="visual" viewBox="-80 -80 160 160" role="img" aria-label={`Círculo dividido en ${denominator} partes`}>
      {slices}
    </svg>
  );
}

function FractionBar({ numerator, denominator }: { numerator: number; denominator: number }) {
  const w = 240 / denominator;
  return (
    <svg className="visual" viewBox="-4 -4 248 78" role="img" aria-label={`Barra dividida en ${denominator} partes`}>
      {Array.from({ length: denominator }, (_, i) => (
        <rect key={i} x={i * w} y={0} width={w} height={70} fill={i < numerator ? FILL : EMPTY} stroke={INK} strokeWidth={4} />
      ))}
    </svg>
  );
}

function Angle({ degrees }: { degrees: number }) {
  const len = 90;
  const rad = (degrees * Math.PI) / 180;
  const x2 = len * Math.cos(rad);
  const y2 = -len * Math.sin(rad);
  const arcR = 28;
  const ax = arcR * Math.cos(rad);
  const ay = -arcR * Math.sin(rad);
  const arc =
    degrees === 90 ? (
      <path d="M18 0 L18 -18 L0 -18" fill="none" stroke="#278FC7" strokeWidth={4} />
    ) : (
      <path d={`M${arcR} 0 A${arcR} ${arcR} 0 0 0 ${ax} ${ay}`} fill="none" stroke="#278FC7" strokeWidth={4} />
    );
  return (
    <svg className="visual" viewBox="-110 -105 220 120" role="img" aria-label="Ángulo">
      {arc}
      <line x1={0} y1={0} x2={len} y2={0} stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <line x1={0} y1={0} x2={x2} y2={y2} stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <circle cx={0} cy={0} r={6} fill="#F5C451" stroke={INK} strokeWidth={3} />
    </svg>
  );
}

function Rect({ width, height, unit }: { width: number; height: number; unit: string }) {
  const scale = 150 / Math.max(width, height);
  const w = width * scale;
  const h = height * scale;
  return (
    <svg className="visual" viewBox={`-50 -34 ${w + 100} ${h + 64}`} role="img" aria-label={`Rectángulo de ${width} por ${height} ${unit}`}>
      <rect x={0} y={0} width={w} height={h} rx={4} fill="#CDE9F7" stroke={INK} strokeWidth={4} />
      <text x={w / 2} y={-10} textAnchor="middle" className="visual-label">
        {width} {unit}
      </text>
      <text x={w + 8} y={h / 2 + 6} className="visual-label">
        {height} {unit}
      </text>
    </svg>
  );
}

function Polygon({ sides }: { sides: number }) {
  const r = 70;
  const points = Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2 + (sides === 4 ? Math.PI / 4 : 0);
    return `${r * Math.cos(a)},${r * Math.sin(a)}`;
  }).join(' ');
  return (
    <svg className="visual" viewBox="-80 -80 160 160" role="img" aria-label="Figura">
      <polygon points={points} fill="#80C9EE" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    </svg>
  );
}

/** Muestra "3/4" como fracción apilada; cualquier otro texto, tal cual. */
export function AnswerText({ text }: { text: string }) {
  const m = text.match(/^(\d+)\/(\d+)$/);
  if (!m) return <>{text}</>;
  return (
    <span className="fraction-text" aria-label={`${m[1]} sobre ${m[2]}`}>
      <span>{m[1]}</span>
      <span className="fraction-line" />
      <span>{m[2]}</span>
    </span>
  );
}

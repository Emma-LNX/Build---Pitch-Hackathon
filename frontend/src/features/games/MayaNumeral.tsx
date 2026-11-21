import { mayaDigits } from '../exercises/generators';

const INK = '#183B4A';
const SHELL = '#F5C451';
const W = 90;
const GAP = 28;

function digitHeight(digit: number): number {
  if (digit === 0) return 30;
  const bars = Math.floor(digit / 5);
  const dots = digit % 5;
  if (bars === 0) return 16;
  return (dots ? 20 : 0) + bars * 18 - 6;
}

/** Un nivel: concha (0), puntos (1) y barras (5). */
function MayaDigit({ digit, y }: { digit: number; y: number }) {
  if (digit === 0) {
    const cx = W / 2;
    return (
      <g>
        <ellipse cx={cx} cy={y + 15} rx={30} ry={13} fill={SHELL} stroke={INK} strokeWidth={3} />
        <path d={`M${cx - 18} ${y + 13} Q${cx} ${y + 4} ${cx + 18} ${y + 13}`} fill="none" stroke={INK} strokeWidth={2.5} />
        <path d={`M${cx - 20} ${y + 20} Q${cx} ${y + 12} ${cx + 20} ${y + 20}`} fill="none" stroke={INK} strokeWidth={2.5} />
      </g>
    );
  }
  const bars = Math.floor(digit / 5);
  const dots = digit % 5;
  const dotY = y + 8;
  const barsTop = y + (dots ? 20 : 0);
  return (
    <g>
      {Array.from({ length: dots }, (_, i) => (
        <circle key={`d${i}`} cx={W / 2 + (i - (dots - 1) / 2) * 17} cy={dotY} r={7} fill={INK} />
      ))}
      {Array.from({ length: bars }, (_, i) => (
        <rect key={`b${i}`} x={10} y={barsTop + i * 18} width={W - 20} height={12} rx={6} fill={INK} />
      ))}
    </g>
  );
}

/** Numeral maya vertical: el nivel de arriba vale 20 veces el de abajo. */
export function MayaNumeral({ value, digits, className = 'visual' }: { value?: number; digits?: number[]; className?: string }) {
  const levels = digits ?? mayaDigits(value ?? 0);
  let cursor = 6;
  const groups = levels.map((digit, i) => {
    const y = cursor;
    cursor += digitHeight(digit) + (i < levels.length - 1 ? GAP : 0);
    return <MayaDigit key={i} digit={digit} y={y} />;
  });
  const height = cursor + 6;
  return (
    <svg className={className} viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Número maya">
      {groups}
    </svg>
  );
}

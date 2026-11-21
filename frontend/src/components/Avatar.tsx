import type { CapColor } from '../types';

/** Color del sombrero y la pañoleta del explorador. */
export const CAP_COLORS: Record<CapColor, string> = {
  terracota: '#D9663F',
  jade: '#1FA88F',
  ocre: '#F5C451',
  cielo: '#278FC7',
  morado: '#8E5CC7',
};

export const CAP_LABELS: Record<CapColor, string> = {
  terracota: 'Rojo',
  jade: 'Jade',
  ocre: 'Amarillo',
  cielo: 'Azul',
  morado: 'Morado',
};

const INK = '#183B4A';
const SW = 4;

/** Explorador con sombrero de ala ancha, pañoleta y mochila. */
export function Avatar({ color = 'terracota', className }: { color?: CapColor; className?: string }) {
  const c = CAP_COLORS[color];
  return (
    <svg className={className} viewBox="0 0 100 124" aria-hidden="true">
      {/* sombra corta en el suelo */}
      <ellipse cx={54} cy={120} rx={26} ry={4} fill="rgba(24,59,74,0.22)" />
      {/* mochila */}
      <rect x={66} y={84} width={14} height={26} rx={5} fill="#B9773F" stroke={INK} strokeWidth={SW} />
      {/* cuerpo */}
      <path d="M28 118 C28 94 37 85 50 85 C63 85 72 94 72 118 Z" fill="#E9DDBC" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M58 88 L66 118" stroke="#B9773F" strokeWidth={5} />
      {/* pañoleta */}
      <path d="M38 88 L50 100 L62 88 Z" fill={c} stroke={INK} strokeWidth={3.2} strokeLinejoin="round" />
      {/* cabeza */}
      <circle cx={50} cy={60} r={25} fill="#C98B5E" stroke={INK} strokeWidth={SW} />
      <circle cx={41} cy={63} r={3.4} fill={INK} />
      <circle cx={59} cy={63} r={3.4} fill={INK} />
      <circle cx={34} cy={70} r={3.6} fill="#E7795A" opacity={0.5} />
      <circle cx={66} cy={70} r={3.6} fill="#E7795A" opacity={0.5} />
      <path d="M43 72 Q50 78 57 72" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      {/* sombrero */}
      <path d="M31 48 C31 24 69 24 69 48 Z" fill="#E4D5AD" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <rect x={31} y={40} width={38} height={8} fill={c} />
      <path d="M31 40 H69" stroke={INK} strokeWidth={2.5} />
      <path d="M14 50 Q50 40 86 50 Q88 56 80 56 Q50 50 20 56 Q12 56 14 50 Z" fill="#E4D5AD" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
    </svg>
  );
}

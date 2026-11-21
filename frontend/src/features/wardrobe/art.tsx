import type { ReactNode } from 'react';

/**
 * Ilustraciones locales de cada conjunto (SVG dentro del paquete de la app,
 * disponibles sin conexión). Todas usan el mismo cuerpo base, pose y
 * proporciones de `Avatar` (viewBox 0 0 100 150); cada conjunto dibuja sus
 * propias prendas, no es un cambio de color de otro.
 *
 * Son interpretaciones de las descripciones citadas en `outfits.ts` y están
 * EN REVISIÓN: no se presentan como representaciones validadas.
 */

export const INK = '#183B4A';
export const SW = 3.5;

export interface OutfitLayers {
  silhouette: 'falda' | 'pantalon' | 'pantalon-corto';
  hair: 'corto' | 'largo';
  /** Detrás del cuerpo (cabello largo, perraje caído). */
  back?: ReactNode;
  /** Relleno de piernas del pantalón. */
  legs?: string;
  /** Detalles sobre las piernas (sobrepantalón, bordados del borde). */
  legsDetail?: ReactNode;
  /** Corte / falda envolvente. */
  skirt?: ReactNode;
  sleeves: string;
  torso: string;
  /** Detalles sobre el torso: lienzos, brocados, faja, cuello. */
  torsoDetail?: ReactNode;
  /** Tocado o sombrero, encima de la cabeza. */
  head?: ReactNode;
  defs?: ReactNode;
  footwear: string;
}

const TORSO = 'M31 112 C30 94 38 85 50 85 C62 85 70 94 69 112 Z';
const SKIRT = 'M32 104 L68 104 L72 134 Q50 139 28 134 Z';

/** Faja: banda en la cintura con franjas de colores. */
function Faja({ colors, y = 102 }: { colors: string[]; y?: number }) {
  const h = 8 / colors.length;
  return (
    <g>
      {colors.map((c, i) => (
        <rect key={i} x={31} y={y + i * h} width={38} height={h} fill={c} />
      ))}
      <rect x={31} y={y} width={38} height={8} fill="none" stroke={INK} strokeWidth={SW} />
    </g>
  );
}

/** Fila de rombos de brocado. */
function Brocade({ x, y, n, color, size = 3.2 }: { x: number; y: number; n: number; color: string; size?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <path
          key={i}
          d={`M${x + i * size * 2} ${y} l${size} ${-size} l${size} ${size} l${-size} ${size} z`}
          fill={color}
        />
      ))}
    </g>
  );
}

/** Ave bordada pequeña (silueta genérica de bordado de aves). */
function Bird({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <path
      d={`M${x} ${y} q3 -4 6 -1 l3 -2 l-1 3 q-2 4 -7 3 z`}
      fill={color}
      stroke={INK}
      strokeWidth={0.8}
    />
  );
}

export const OUTFIT_ART: Record<string, (uid: string) => OutfitLayers> = {
  /* Chichicastenango: huipil de tres lienzos, cuello circular con picos, corte oscuro con líneas y jaspe, faja. */
  'chichicastenango-f': (uid) => ({
    silhouette: 'falda',
    hair: 'largo',
    defs: (
      <pattern id={`${uid}-corte`} width={6} height={10} patternUnits="userSpaceOnUse">
        <rect width={6} height={10} fill="#1F2A4A" />
        <rect x={0} width={1} height={10} fill="#F4F1EA" />
        <rect x={3} y={0} width={1.4} height={4} fill="#8FA6D6" />
        <rect x={3} y={6} width={1.4} height={3} fill="#8FA6D6" />
      </pattern>
    ),
    skirt: <path d={SKIRT} fill={`url(#${uid}-corte)`} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />,
    sleeves: '#3A2430',
    torso: '#3A2430',
    torsoDetail: (
      <g>
        {/* tres lienzos */}
        <path d="M43 90 V104 M57 90 V104" stroke="#5E3A4C" strokeWidth={1.4} />
        <Brocade x={44} y={99} n={2} color="#E9B949" />
        <Brocade x={33} y={99} n={2} color="#3FA36B" size={2.6} />
        <Brocade x={58} y={99} n={2} color="#3FA36B" size={2.6} />
        {/* cuello circular con picos (sol) */}
        <circle cx={50} cy={89} r={9} fill="#C9302C" stroke={INK} strokeWidth={2} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const x = 50 + Math.cos(a) * 9;
          const y = 89 + Math.sin(a) * 9;
          const x2 = 50 + Math.cos(a) * 12.5;
          const y2 = 89 + Math.sin(a) * 12.5;
          const dx = -Math.sin(a) * 2;
          const dy = Math.cos(a) * 2;
          return <path key={i} d={`M${x + dx} ${y + dy} L${x2} ${y2} L${x - dx} ${y - dy} Z`} fill="#E9B949" stroke={INK} strokeWidth={0.8} />;
        })}
        <circle cx={50} cy={89} r={5} fill="#C98B5E" stroke={INK} strokeWidth={1.5} />
        <Faja colors={['#C9302C', '#E9B949', '#3FA36B']} />
      </g>
    ),
    footwear: '#8A5A3C',
  }),

  /* San Juan Sacatepéquez: huipil de franjas anchas moradas y amarillas, brocado en los hombros. */
  'san-juan-sacatepequez-f': (uid) => ({
    silhouette: 'falda',
    hair: 'largo',
    defs: (
      <pattern id={`${uid}-franjas`} width={10} height={10} patternUnits="userSpaceOnUse">
        <rect width={10} height={10} fill="#6B2D8C" />
        <rect y={0} width={10} height={4} fill="#F2C230" />
        <rect y={4} width={10} height={1} fill="#E46A2B" />
      </pattern>
    ),
    skirt: (
      <g>
        <path d={SKIRT} fill="#2E3A59" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M58 104 L61 136" stroke="#1E2740" strokeWidth={1.4} />
      </g>
    ),
    sleeves: `url(#${uid}-franjas)`,
    torso: `url(#${uid}-franjas)`,
    torsoDetail: (
      <g>
        {/* brocado en la zona de los hombros */}
        <rect x={35} y={88} width={30} height={6} fill="#3FA36B" stroke={INK} strokeWidth={1.2} />
        <Brocade x={37} y={91} n={4} color="#C9302C" size={1.8} />
        <Brocade x={53} y={91} n={3} color="#F2C230" size={1.8} />
        <path d="M45 85 Q50 90 55 85" fill="none" stroke={INK} strokeWidth={1.6} />
      </g>
    ),
    footwear: '#8A5A3C',
  }),

  /* Nebaj: corte rojo, huipil de dos lienzos brocado, faja, perraje al hombro, cinta con pompones. */
  'nebaj-f': (uid) => ({
    silhouette: 'falda',
    hair: 'largo',
    defs: (
      <pattern id={`${uid}-perraje`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
        <rect width={6} height={6} fill="#2F6FAF" />
        <rect width={6} height={2} fill="#F4F1EA" />
      </pattern>
    ),
    skirt: (
      <g>
        <path d={SKIRT} fill="#C62828" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M42 106 L40 136 M56 106 L59 136" stroke="#9B1C1C" strokeWidth={1.4} />
      </g>
    ),
    sleeves: '#F4F1EA',
    torso: '#F4F1EA',
    torsoDetail: (
      <g>
        {/* dos lienzos unidos al centro */}
        <path d="M50 92 V104" stroke="#C8BFA8" strokeWidth={1.4} />
        <Brocade x={35} y={97} n={2} color="#3FA36B" />
        <Brocade x={53} y={97} n={2} color="#C62828" />
        <Brocade x={38} y={102} n={4} color="#2F6FAF" size={2.2} />
        {/* cuello con aplicación de cadena */}
        <path d="M43 86 Q50 93 57 86" fill="none" stroke="#C62828" strokeWidth={2} strokeDasharray="1.5 1.5" />
        <Faja colors={['#E9B949', '#3FA36B', '#C62828', '#2F6FAF']} />
        {/* perraje sobre el hombro */}
        <path d="M62 86 Q70 96 64 112 L58 110 Q62 98 56 88 Z" fill={`url(#${uid}-perraje)`} stroke={INK} strokeWidth={2} />
      </g>
    ),
    head: (
      <g>
        {/* cinta enrollada con pompones en los extremos */}
        <path d="M26 50 Q50 34 74 50" fill="none" stroke="#C62828" strokeWidth={7} strokeLinecap="round" />
        <path d="M27 49 Q50 33 73 49" fill="none" stroke="#2F6FAF" strokeWidth={2} strokeDasharray="3 3" />
        <circle cx={24} cy={60} r={6} fill="#3FA36B" stroke={INK} strokeWidth={2} />
        <circle cx={76} cy={60} r={6} fill="#E9B949" stroke={INK} strokeWidth={2} />
        <path d="M26 52 L24 54 M74 52 L76 54" stroke={INK} strokeWidth={2} />
      </g>
    ),
    footwear: '#8A5A3C',
  }),

  /* Santiago Atitlán (femenino): tocoyal enrollado en la cabeza, huipil con aves bordadas. */
  'santiago-atitlan-f': (uid) => ({
    silhouette: 'falda',
    hair: 'largo',
    defs: (
      <pattern id={`${uid}-huipil`} width={5} height={10} patternUnits="userSpaceOnUse">
        <rect width={5} height={10} fill="#F4F1EA" />
        <rect x={0} width={1.2} height={10} fill="#7A4E9E" />
      </pattern>
    ),
    skirt: <path d={SKIRT} fill="#2B3A55" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />,
    sleeves: `url(#${uid}-huipil)`,
    torso: `url(#${uid}-huipil)`,
    torsoDetail: (
      <g>
        <Bird x={38} y={96} color="#3FA36B" />
        <Bird x={52} y={94} color="#E9B949" />
        <Bird x={45} y={101} color="#C62828" />
        <path d="M44 86 L50 92 L56 86" fill="none" stroke={INK} strokeWidth={1.6} />
        <rect x={31} y={104} width={38} height={4} fill="#7A4E9E" stroke={INK} strokeWidth={2} />
      </g>
    ),
    head: (
      <g>
        {/* tocoyal: cinta larga enrollada como un disco */}
        <ellipse cx={50} cy={42} rx={33} ry={9} fill="#C62828" stroke={INK} strokeWidth={SW} />
        <ellipse cx={50} cy={42} rx={25} ry={6.5} fill="none" stroke="#8E1B1B" strokeWidth={1.6} />
        <ellipse cx={50} cy={42} rx={17} ry={4.4} fill="none" stroke="#8E1B1B" strokeWidth={1.6} />
        <ellipse cx={50} cy={42} rx={9} ry={2.4} fill="#E9B949" stroke={INK} strokeWidth={1.4} />
      </g>
    ),
    footwear: '#8A5A3C',
  }),

  /* Todos Santos Cuchumatán: pantalón rojo con rayas blancas, sobrepantalón negro, camisa de rayas finas
     con cuello ancho decorado y sombrero de palma con cinta azul. */
  'todos-santos-m': (uid) => ({
    silhouette: 'pantalon',
    hair: 'corto',
    defs: (
      <>
        <pattern id={`${uid}-pantalon`} width={5} height={10} patternUnits="userSpaceOnUse">
          <rect width={5} height={10} fill="#C62828" />
          <rect x={0} width={1.6} height={10} fill="#F4F1EA" />
        </pattern>
        <pattern id={`${uid}-camisa`} width={4} height={10} patternUnits="userSpaceOnUse">
          <rect width={4} height={10} fill="#F4F1EA" />
          <rect x={0} width={0.9} height={10} fill="#7A4E9E" />
        </pattern>
      </>
    ),
    legs: `url(#${uid}-pantalon)`,
    legsDetail: (
      // sobrepantalón negro
      <path d="M36 106 H64 L63 122 H52 L50 114 L48 122 H37 Z" fill="#20232A" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
    ),
    sleeves: `url(#${uid}-camisa)`,
    torso: `url(#${uid}-camisa)`,
    torsoDetail: (
      <g>
        {/* cuello ancho decorado */}
        <path d="M36 88 L50 86 L64 88 L60 100 L50 94 L40 100 Z" fill="#7A4E9E" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <path d="M39 91 L50 89 L61 91" fill="none" stroke="#C62828" strokeWidth={1.6} />
        <path d="M41 95 L50 92 L59 95" fill="none" stroke="#E9B949" strokeWidth={1.4} />
      </g>
    ),
    head: (
      <g>
        <path d="M31 47 C31 24 69 24 69 47 Z" fill="#E8D29A" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
        <rect x={31} y={39} width={38} height={7} fill="#2F6FAF" />
        <path d="M31 39 H69" stroke={INK} strokeWidth={2} />
        <path d="M14 49 Q50 39 86 49 Q88 55 80 55 Q50 49 20 55 Q12 55 14 49 Z" fill="#E8D29A" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      </g>
    ),
    footwear: '#8A5A3C',
  }),

  /* Santiago Atitlán (masculino): pantalón corto de telar con aves y diseños geométricos bordados en el borde,
     camisa y faja. */
  'santiago-atitlan-m': (uid) => ({
    silhouette: 'pantalon-corto',
    hair: 'corto',
    defs: (
      <pattern id={`${uid}-pantalon`} width={4} height={10} patternUnits="userSpaceOnUse">
        <rect width={4} height={10} fill="#F4F1EA" />
        <rect x={0} width={1} height={10} fill="#7A4E9E" />
      </pattern>
    ),
    legs: `url(#${uid}-pantalon)`,
    legsDetail: (
      <g>
        <Bird x={38} y={124} color="#3FA36B" />
        <Bird x={52} y={124} color="#C62828" />
        <Brocade x={38} y={127} n={3} color="#E9B949" size={1.6} />
        <Brocade x={52} y={127} n={3} color="#2F6FAF" size={1.6} />
      </g>
    ),
    sleeves: '#F4F1EA',
    torso: '#F4F1EA',
    torsoDetail: (
      <g>
        <path d="M40 90 V104 M46 88 V104 M54 88 V104 M60 90 V104" stroke="#C8BFA8" strokeWidth={1.2} />
        <path d="M44 86 L50 92 L56 86" fill="none" stroke={INK} strokeWidth={1.6} />
        <Faja colors={['#C62828', '#2F6FAF', '#C62828']} />
      </g>
    ),
    footwear: '#8A5A3C',
  }),
};

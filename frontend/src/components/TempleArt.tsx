import type { WorldId } from '../types';

interface Tier {
  w: number;
  h: number;
}

interface TempleShape {
  tiers: Tier[];
  shrine: Tier;
  comb?: Tier;
  stair: number;
}

const SHAPES: Record<WorldId, TempleShape> = {
  // Templo I del Gran Jaguar: alto y angosto, con crestería
  tikal: {
    tiers: [{ w: 132, h: 20 }, { w: 114, h: 20 }, { w: 96, h: 20 }, { w: 80, h: 20 }, { w: 64, h: 18 }],
    shrine: { w: 42, h: 24 },
    comb: { w: 30, h: 18 },
    stair: 22,
  },
  // Yaxhá: base ancha y templo cuadrado
  yaxha: {
    tiers: [{ w: 156, h: 26 }, { w: 124, h: 26 }, { w: 92, h: 26 }],
    shrine: { w: 56, h: 30 },
    stair: 26,
  },
  // La Danta (El Mirador): enorme y escalonada
  mirador: {
    tiers: [{ w: 184, h: 18 }, { w: 158, h: 18 }, { w: 132, h: 18 }, { w: 106, h: 20 }],
    shrine: { w: 50, h: 28 },
    comb: { w: 22, h: 14 },
    stair: 24,
  },
};

export const INK = '#183B4A';
const STONE = '#E4D5AD';
const STONE_DARK = '#CDB98A';
const STAIR = '#F4EBD2';
/** Sombra corta: la luz viene de arriba a la izquierda, la sombra cae a la derecha. */
const SHADE = 'rgba(24, 59, 74, 0.14)';
const SW = 4;

interface TempleArtProps {
  world: WorldId;
  className?: string;
  /** Para incrustar dentro de otro SVG (escenario del mapa). */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export function TempleArt({ world, className, x, y, width, height }: TempleArtProps) {
  const shape = SHAPES[world];
  const ground = 192;
  const cx = 100;
  let top = ground;
  const tiers = shape.tiers.map((t) => {
    top -= t.h;
    return { ...t, x: cx - t.w / 2, y: top };
  });
  const shrineY = top - shape.shrine.h;
  const combY = shape.comb ? shrineY - shape.comb.h : shrineY;
  const stepCount = Math.floor((ground - top) / 9);
  const half = shape.stair / 2;

  const block = (bx: number, by: number, bw: number, bh: number, fill: string, key?: number) => (
    <g key={key}>
      <rect x={bx} y={by} width={bw} height={bh} rx={3} fill={fill} />
      <rect x={bx + bw * 0.7} y={by} width={bw * 0.3} height={bh} fill={SHADE} />
      <rect x={bx} y={by} width={bw} height={bh} rx={3} fill="none" stroke={INK} strokeWidth={SW} />
    </g>
  );

  return (
    <svg
      className={className}
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox="0 0 200 200"
      aria-hidden="true"
      overflow="visible"
    >
      {/* sombra corta proyectada en el suelo */}
      <ellipse cx={cx + 8} cy={ground + 1} rx={shape.tiers[0].w / 2 + 6} ry={6} fill="rgba(24,59,74,0.18)" />
      {shape.comb && block(cx - shape.comb.w / 2, combY, shape.comb.w, shape.comb.h + 2, STONE)}
      {block(cx - shape.shrine.w / 2, shrineY, shape.shrine.w, shape.shrine.h + 2, STONE)}
      {block(cx - shape.shrine.w / 2 - 4, shrineY - 2, shape.shrine.w + 8, 7, STONE_DARK)}
      <rect x={cx - 7} y={shrineY + 9} width={14} height={shape.shrine.h - 7} rx={3} fill={INK} />
      {tiers.map((t, i) => block(t.x, t.y, t.w, t.h + 2, i % 2 ? STONE_DARK : STONE, i))}
      <path
        d={`M${cx - half + 3} ${top} L${cx + half - 3} ${top} L${cx + half + 6} ${ground} L${cx - half - 6} ${ground} Z`}
        fill={STAIR}
        stroke={INK}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      {Array.from({ length: stepCount }, (_, i) => {
        const sy = top + 7 + i * 9;
        const spread = ((sy - top) / (ground - top)) * 9;
        return (
          <line
            key={i}
            x1={cx - half + spread * -1 + 6}
            x2={cx + half + spread - 6}
            y1={sy}
            y2={sy}
            stroke={INK}
            strokeOpacity={0.55}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

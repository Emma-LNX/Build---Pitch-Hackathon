import { memo } from 'react';
import { TempleArt } from '../../components/TempleArt';
import type { WorldId } from '../../types';

/** Sistema de coordenadas del escenario. Todo se escala con el ancho de pantalla. */
export const SCENE_W = 400;
export const SCENE_H = 1100;

/** Posición de cada estación (lección 1 abajo → lección 5 junto al templo). */
export const STATIONS: { x: number; y: number }[] = [
  { x: 122, y: 975 },
  { x: 282, y: 858 },
  { x: 116, y: 738 },
  { x: 286, y: 620 },
  { x: 196, y: 505 },
];

const TEMPLE_BASE = { x: 200, y: 392 };

const INK = '#183B4A';
const SKY = '#80C9EE';
const GRASS = '#70BE46';
const GRASS_EDGE = '#398647';
const JUNGLE = '#245C48';
const STONE = '#E4D5AD';
const STONE_EDGE = '#C9B27E';
const SUN = '#F5C451';

/** Curva suave (Catmull-Rom → Bézier) que pasa por todos los puntos. */
function smoothPath(points: { x: number; y: number }[]): string {
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

const ROAD = smoothPath([{ x: 214, y: SCENE_H + 20 }, ...STATIONS, TEMPLE_BASE]);

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-34 10 a14 14 0 0 1 8-22 a20 20 0 0 1 36-6 a15 15 0 0 1 26 12 a11 11 0 0 1 2 16 z" fill="#FFFFFF" />
      <path d="M-34 10 h72" stroke="#5FAFD9" strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

function Tree({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={6} cy={2} rx={26} ry={5} fill="rgba(24,59,74,0.2)" />
      <path d="M-5 2 L-3 -46 L5 -46 L7 2 Z" fill="#8A5A3C" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      <path
        d="M-40 -48 C-46 -70 -24 -86 -6 -80 C2 -98 34 -96 38 -74 C54 -70 54 -44 36 -40 C22 -30 -24 -30 -40 -48 Z"
        fill={GRASS_EDGE}
        stroke={INK}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <path d="M-28 -60 C-26 -74 -8 -78 0 -70 C6 -84 26 -82 26 -70" fill="none" stroke={GRASS} strokeWidth={7} strokeLinecap="round" />
    </g>
  );
}

function Bush({ x, y, s = 1, color = GRASS_EDGE }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M-30 0 C-36 -16 -22 -28 -10 -22 C-6 -36 16 -36 18 -22 C30 -26 38 -12 30 0 Z"
        fill={color}
        stroke={INK}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <path d="M-18 -14 C-14 -20 -8 -20 -6 -16" fill="none" stroke={GRASS} strokeWidth={4} strokeLinecap="round" />
    </g>
  );
}

function Flower({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 V-8" stroke={GRASS_EDGE} strokeWidth={2.5} />
      <circle cx={0} cy={-10} r={4} fill={SUN} stroke={INK} strokeWidth={2} />
    </g>
  );
}

function Rock({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-14 0 C-14 -10 -6 -14 2 -14 C10 -14 14 -8 14 0 Z" fill={STONE} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M6 -10 C10 -8 11 -4 11 0" fill="none" stroke={STONE_EDGE} strokeWidth={3} />
    </g>
  );
}

/** Ilustración estática del mundo; los botones de lección se colocan encima en HTML. */
export const MapScene = memo(function MapScene({ world }: { world: WorldId }) {
  return (
    <svg className="scene-art" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true">
      {/* 1. Cielo */}
      <rect width={SCENE_W} height={SCENE_H} fill={SKY} />
      <circle cx={344} cy={210} r={22} fill={SUN} stroke={INK} strokeWidth={3.5} />
      <Cloud x={70} y={196} s={0.9} />
      <Cloud x={300} y={290} s={0.7} />
      <Cloud x={340} y={118} s={0.6} />

      {/* 2. Vegetación lejana */}
      <path
        d="M0 330 C20 300 50 296 70 318 C88 290 126 292 140 322 L260 322 C274 292 312 288 330 316 C350 294 384 298 400 324 L400 420 L0 420 Z"
        fill={JUNGLE}
      />
      <path
        d="M0 362 C30 340 70 344 96 364 C120 346 150 350 168 368 L232 368 C252 350 284 346 306 364 C330 344 376 342 400 360 L400 420 L0 420 Z"
        fill="#2F7247"
      />

      {/* 3. Templo */}
      <TempleArt world={world} x={88} y={178} width={224} height={224} />

      {/* 4. Terreno */}
      <path
        d={`M0 400 C80 384 150 392 200 392 C260 392 330 382 400 398 L400 ${SCENE_H} L0 ${SCENE_H} Z`}
        fill={GRASS}
        stroke={GRASS_EDGE}
        strokeWidth={5}
      />
      {/* lomas de césped con borde inferior más oscuro */}
      <path d="M-10 560 C40 536 70 546 84 568 Z" fill={GRASS_EDGE} opacity={0.35} />
      <path d={`M300 1010 C340 992 380 996 410 1012 L410 ${SCENE_H} L300 ${SCENE_H} Z`} fill={GRASS_EDGE} opacity={0.35} />
      <path d="M-10 800 C30 782 64 790 80 806 L-10 806 Z" fill={GRASS_EDGE} opacity={0.35} />

      {/* 5. Camino hacia el templo */}
      <path d={ROAD} fill="none" stroke={INK} strokeWidth={42} strokeLinecap="round" />
      <path d={ROAD} fill="none" stroke={STONE_EDGE} strokeWidth={36} strokeLinecap="round" />
      <path d={ROAD} fill="none" stroke={STONE} strokeWidth={28} strokeLinecap="round" />
      <path d={ROAD} fill="none" stroke="#F4EBD2" strokeWidth={4} strokeDasharray="2 16" strokeLinecap="round" />

      {/* 6. Plataformas de cada estación */}
      {STATIONS.map((p, i) => (
        <g key={i}>
          <ellipse cx={p.x} cy={p.y + 30} rx={56} ry={20} fill={GRASS_EDGE} stroke={INK} strokeWidth={4} />
          <ellipse cx={p.x} cy={p.y + 22} rx={56} ry={20} fill={GRASS} stroke={INK} strokeWidth={4} />
        </g>
      ))}

      {/* 7. Árboles que enmarcan el recorrido */}
      <Tree x={36} y={446} s={1} />
      <Tree x={372} y={470} s={1.1} flip />
      <Tree x={366} y={742} s={0.9} flip />
      <Tree x={30} y={662} s={0.85} />
      <Tree x={30} y={900} s={0.95} />

      {/* 8. Detalles y primer plano */}
      <Rock x={232} y={548} s={0.8} />
      <Rock x={66} y={1040} />
      <Rock x={350} y={940} s={0.8} />
      <Flower x={200} y={800} />
      <Flower x={212} y={810} />
      <Flower x={70} y={560} />
      <Flower x={336} y={560} />
      <Flower x={196} y={690} />
      <Flower x={350} y={1060} />
      <Bush x={22} y={1100} s={1.3} color={JUNGLE} />
      <Bush x={380} y={1100} s={1.5} color={JUNGLE} />
      <Bush x={150} y={420} s={0.6} />
      <Bush x={268} y={424} s={0.55} />
    </svg>
  );
});

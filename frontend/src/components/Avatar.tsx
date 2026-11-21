import { useId } from 'react';
import { useProgress } from '../features/progress/ProgressContext';
import { INK, OUTFIT_ART, SW } from '../features/wardrobe/art';
import { findOutfit, outfitToWear } from '../features/wardrobe/outfits';

const SKIN = '#C98B5E';
const HAIR = '#2A1E17';

/**
 * Personaje base: mismo cuerpo, pose y proporciones para todos los conjuntos.
 * Cada conjunto aporta sus capas de ropa desde `art.tsx`. Si el conjunto aún no
 * tiene ilustración, se muestra una silueta con signo de pregunta.
 */
export function Avatar({ outfitId, className }: { outfitId: string | undefined; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const art = outfitId ? OUTFIT_ART[outfitId]?.(uid) : undefined;
  if (!art) return <PendingSilhouette className={className} />;

  const skirt = art.silhouette === 'falda';
  const shortPants = art.silhouette === 'pantalon-corto';

  return (
    <svg className={className} viewBox="0 0 100 150" aria-hidden="true">
      {art.defs && <defs>{art.defs}</defs>}
      <ellipse cx={53} cy={146} rx={27} ry={4} fill="rgba(24,59,74,0.22)" />

      {/* cabello recogido detrás de la cabeza */}
      {art.hair === 'largo' && (
        <path d="M27 60 C26 72 29 80 34 84 L66 84 C71 80 74 72 73 60 Z" fill={HAIR} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      )}
      {art.back}

      {/* piernas */}
      {skirt ? (
        <>
          <rect x={40} y={128} width={8} height={12} fill={SKIN} stroke={INK} strokeWidth={SW} />
          <rect x={52} y={128} width={8} height={12} fill={SKIN} stroke={INK} strokeWidth={SW} />
        </>
      ) : (
        <>
          {shortPants && (
            <>
              <rect x={39} y={120} width={9} height={20} fill={SKIN} stroke={INK} strokeWidth={SW} />
              <rect x={52} y={120} width={9} height={20} fill={SKIN} stroke={INK} strokeWidth={SW} />
            </>
          )}
          <rect x={37} y={106} width={12} height={shortPants ? 24 : 34} rx={3} fill={art.legs} stroke={INK} strokeWidth={SW} />
          <rect x={51} y={106} width={12} height={shortPants ? 24 : 34} rx={3} fill={art.legs} stroke={INK} strokeWidth={SW} />
          {art.legsDetail}
        </>
      )}
      <ellipse cx={43} cy={141} rx={8} ry={4.5} fill={art.footwear} stroke={INK} strokeWidth={SW} />
      <ellipse cx={57} cy={141} rx={8} ry={4.5} fill={art.footwear} stroke={INK} strokeWidth={SW} />
      {skirt && art.skirt}

      {/* brazos */}
      <rect x={22} y={90} width={11} height={24} rx={5.5} fill={art.sleeves} stroke={INK} strokeWidth={SW} transform="rotate(8 27 90)" />
      <rect x={67} y={90} width={11} height={24} rx={5.5} fill={art.sleeves} stroke={INK} strokeWidth={SW} transform="rotate(-8 73 90)" />
      <circle cx={25} cy={115} r={5} fill={SKIN} stroke={INK} strokeWidth={SW} />
      <circle cx={75} cy={115} r={5} fill={SKIN} stroke={INK} strokeWidth={SW} />

      {/* torso */}
      <path d="M31 112 C30 94 38 85 50 85 C62 85 70 94 69 112 Z" fill={art.torso} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      {art.torsoDetail}

      {/* cabeza */}
      <circle cx={50} cy={60} r={25} fill={SKIN} stroke={INK} strokeWidth={SW} />
      {/* cabello: cubre la parte superior de la cabeza */}
      <path d="M25 60 A25 25 0 0 1 75 60 C70 47 58 44 50 46 C42 44 30 47 25 60 Z" fill={HAIR} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <circle cx={41} cy={63} r={3.4} fill={INK} />
      <circle cx={59} cy={63} r={3.4} fill={INK} />
      <circle cx={34} cy={70} r={3.6} fill="#E7795A" opacity={0.5} />
      <circle cx={66} cy={70} r={3.6} fill="#E7795A" opacity={0.5} />
      <path d="M43 72 Q50 78 57 72" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      {art.head}
    </svg>
  );
}

/** Conjunto documentado sin ilustración todavía. */
function PendingSilhouette({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 150" aria-hidden="true">
      <ellipse cx={53} cy={146} rx={27} ry={4} fill="rgba(24,59,74,0.15)" />
      <g fill="#C9D3D8" stroke="#8FA1AA" strokeWidth={SW} strokeDasharray="5 4" strokeLinejoin="round">
        <rect x={37} y={106} width={12} height={34} rx={3} />
        <rect x={51} y={106} width={12} height={34} rx={3} />
        <path d="M31 112 C30 94 38 85 50 85 C62 85 70 94 69 112 Z" />
        <circle cx={50} cy={60} r={25} />
      </g>
      <text x={50} y={70} textAnchor="middle" fontSize={28} fontWeight={800} fill="#7A8C95" fontFamily="'Baloo 2', sans-serif">
        ?
      </text>
    </svg>
  );
}

/**
 * Avatar del estudiante activo: el conjunto equipado, o el inicial de su género
 * si el equipado no corresponde. Todas las pantallas lo usan, así que equipar
 * un conjunto las actualiza a todas.
 */
export function PlayerAvatar({ className, outfitId }: { className?: string; outfitId?: string }) {
  const { profile, wardrobe } = useProgress();
  const gender = profile?.gender ?? 'nina';
  const id = outfitId && findOutfit(outfitId) ? outfitId : outfitToWear(wardrobe, gender).id;
  return <Avatar outfitId={id} className={className} />;
}

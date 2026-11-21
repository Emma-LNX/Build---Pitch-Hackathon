import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerAvatar } from '../../components/Avatar';
import { Platform } from '../../components/GameArt';
import { StarIcon } from '../../components/icons';
import { useProgress } from '../progress/ProgressContext';
import { findOutfit, pendingCelebrations } from './outfits';

/**
 * Celebra los conjuntos desbloqueados que el estudiante aún no ha visto.
 * Se guarda cuáles ya se celebraron, así que recargar no la repite.
 */
export function UnlockCelebration() {
  const { wardrobe, profile, markCelebrated } = useProgress();
  const navigate = useNavigate();
  const primaryRef = useRef<HTMLButtonElement>(null);
  // Solo conjuntos de su catálogo y con ilustración
  const pendingId = wardrobe && profile?.gender ? pendingCelebrations(wardrobe, profile.gender)[0] : undefined;

  useEffect(() => {
    if (pendingId) primaryRef.current?.focus();
  }, [pendingId]);

  const outfit = findOutfit(pendingId);
  if (!pendingId || !outfit) return null;

  async function view() {
    await markCelebrated([pendingId!]);
    navigate(`/perfil/guardarropa?ver=${pendingId}`);
  }

  return (
    <div className="celebrate-backdrop">
      <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title">
        <div className="celebrate-stage" aria-hidden="true">
          <svg className="celebrate-rays" viewBox="-100 -100 200 200">
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d="M0 0 L-9 -100 L9 -100 Z" fill="#F5C451" opacity={0.55} transform={`rotate(${i * 30})`} />
            ))}
          </svg>
          <StarIcon className="celebrate-spark celebrate-spark-1" />
          <StarIcon className="celebrate-spark celebrate-spark-2" />
          <div className="celebrate-figure">
            <PlayerAvatar outfitId={outfit.id} className="celebrate-avatar" />
            <Platform className="celebrate-platform" />
          </div>
        </div>
        <h2 id="celebrate-title">¡Descubriste un nuevo conjunto!</h2>
        <p className="celebrate-name">{outfit.name}</p>
        <div className="celebrate-actions">
          <button ref={primaryRef} className="btn btn-primary btn-block" onClick={view}>
            Ver conjunto
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => markCelebrated([pendingId])}>
            Seguir aprendiendo
          </button>
        </div>
      </div>
    </div>
  );
}

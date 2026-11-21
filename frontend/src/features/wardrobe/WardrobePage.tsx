import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Avatar, PlayerAvatar } from '../../components/Avatar';
import { Platform } from '../../components/GameArt';
import { CheckIcon, ChevronIcon, EyeIcon, LockIcon } from '../../components/icons';
import { ProgressBar } from '../../components/ProgressBar';
import { fmt } from '../../lib/random';
import type { Outfit, WardrobeState } from '../../types';
import { useProgress } from '../progress/ProgressContext';
import { catalogFor, isUnlocked, isWearable, nextUnlock, outfitToWear } from './outfits';

type OutfitStatus = 'locked' | 'available' | 'equipped' | 'pending-art';

function statusOf(outfit: Outfit, wardrobe: WardrobeState, wearingId: string): OutfitStatus {
  if (!isUnlocked(wardrobe, outfit.id)) return 'locked';
  if (!isWearable(outfit)) return 'pending-art';
  return outfit.id === wearingId ? 'equipped' : 'available';
}

const origin = (o: Outfit) => `${o.community}, ${o.department}`;

export function WardrobePage() {
  const { wardrobe, stats, profile, equipOutfit } = useProgress();
  const [params, setParams] = useSearchParams();
  // La vista previa vive solo en esta pantalla; nunca sobrescribe lo equipado
  const [preview, setPreview] = useState<string | null>(() => params.get('ver'));
  const [error, setError] = useState<string | null>(null);
  const shownRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    shownRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, []);

  if (!wardrobe || !profile?.gender) return null;
  const gender = profile.gender;
  const catalog = catalogFor(gender);
  const wearing = outfitToWear(wardrobe, gender);
  const shown = catalog.find((o) => o.id === preview) ?? wearing;
  const shownStatus = statusOf(shown, wardrobe, wearing.id);
  const previewing = shown.id !== wearing.id;
  const next = nextUnlock(wardrobe, stats.xp, gender);

  function clearParam() {
    if (params.has('ver')) setParams({}, { replace: true });
  }

  function choose(id: string) {
    setError(null);
    setPreview(id === wearing.id ? null : id);
  }

  function cancelPreview() {
    setPreview(null);
    setError(null);
    clearParam();
  }

  async function equip() {
    try {
      await equipOutfit(shown.id);
      setPreview(null);
      clearParam();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo equipar el conjunto');
    }
  }

  const stateLabel: Record<OutfitStatus, string> = {
    locked: 'Bloqueado',
    available: 'Disponible',
    equipped: 'Lo llevas puesto',
    'pending-art': 'Ilustración en preparación',
  };

  return (
    <div className="page wardrobe">
      <header className="sub-head">
        <Link to="/perfil" className="round-btn" aria-label="Volver al perfil">
          <ChevronIcon dir="left" className="round-btn-icon" />
        </Link>
        <h1>Mi guardarropa</h1>
      </header>

      {/* Escenario: el personaje es el protagonista */}
      <section className={`closet-stage${previewing ? ' closet-previewing' : ''}`} aria-live="polite">
        {previewing ? (
          <span className="stage-tag stage-tag-preview">
            <EyeIcon className="stage-tag-icon" /> Vista previa
          </span>
        ) : (
          <span className="stage-tag stage-tag-worn">
            <CheckIcon className="stage-tag-icon" /> Lo llevas puesto
          </span>
        )}
        <div className="closet-figure">
          <PlayerAvatar outfitId={shown.id} className="closet-avatar" />
          <Platform className="closet-platform" />
        </div>
      </section>

      {/* Catálogo: solo los conjuntos de su presentación, disponibles y bloqueados */}
      <ul className="outfit-strip" aria-label="Conjuntos">
        {catalog.map((o) => {
          const status = statusOf(o, wardrobe, wearing.id);
          const isShown = o.id === shown.id;
          return (
            <li key={o.id}>
              <button
                ref={isShown ? shownRef : undefined}
                className={`outfit-card outfit-${status}`}
                aria-pressed={isShown}
                onClick={() => choose(o.id)}
                aria-label={`${o.name}, ${origin(o)}. ${
                  status === 'locked' ? `Bloqueado, necesitas ${fmt(o.xpRequired)} XP` : stateLabel[status]
                }`}
              >
                <span className="outfit-thumb">
                  <Avatar outfitId={isWearable(o) ? o.id : undefined} className="outfit-thumb-art" />
                  {status === 'locked' && <LockIcon className="outfit-lock" />}
                </span>
                <span className="outfit-name">{o.community}</span>
                <span className="outfit-origin">{o.department}</span>
                <span className={`outfit-state state-${status}`}>
                  {status === 'locked' && (
                    <>
                      <LockIcon className="state-icon" /> {fmt(o.xpRequired)} XP
                    </>
                  )}
                  {status === 'available' && 'Disponible'}
                  {status === 'equipped' && (
                    <>
                      <CheckIcon className="state-icon" /> Puesto
                    </>
                  )}
                  {status === 'pending-art' && 'Próximamente'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Ficha del conjunto mostrado */}
      <section className="panel outfit-sheet" aria-labelledby="outfit-title">
        <h2 id="outfit-title">{shown.name}</h2>
        <p className="outfit-sheet-origin">
          {origin(shown)}
          {shown.linguisticCommunity ? ` · ${shown.linguisticCommunity}` : ''}
        </p>
        <p className="outfit-sheet-text">{shown.description}</p>
        <p className="review-flag">
          {shown.review === 'pendiente-ilustracion'
            ? 'Ilustración en preparación: falta documentar sus detalles para dibujarlo con fidelidad.'
            : shown.review === 'en-revision'
              ? 'Ilustración en revisión: basada en descripciones publicadas, aún no validada por el museo ni la comunidad.'
              : 'Revisado con su fuente.'}
          {shown.pendingDetails ? ` ${shown.pendingDetails}` : ''}
        </p>
        <details className="outfit-sources">
          <summary>Fuentes ({shown.sources.length})</summary>
          <ul>
            {shown.sources.map((s) => (
              <li key={s.label}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}</li>
            ))}
          </ul>
        </details>

        {shownStatus === 'locked' && (
          <p className="locked-note">
            <LockIcon className="locked-note-icon" />
            Se desbloquea con {fmt(shown.xpRequired)} XP. Te faltan {fmt(shown.xpRequired - stats.xp)} XP.
          </p>
        )}
        {error && (
          <p className="locked-note" role="alert">
            {error}
          </p>
        )}

        <div className="outfit-actions">
          {shownStatus === 'available' && (
            <button className="btn btn-primary btn-block" onClick={equip}>
              <CheckIcon className="btn-icon" /> Equipar
            </button>
          )}
          {previewing && (
            <button className="btn btn-secondary btn-block" onClick={cancelPreview}>
              Cancelar vista previa
            </button>
          )}
        </div>
      </section>

      {/* Experiencia y siguiente desbloqueo */}
      <section className="panel panel-quiet">
        <div className="row-between">
          <h2>Tu experiencia</h2>
          <span className="value-chip">{fmt(stats.xp)} XP</span>
        </div>
        {next ? (
          <>
            <ProgressBar
              value={((stats.xp - next.from) / (next.outfit.xpRequired - next.from)) * 100}
              tone="yellow"
              label="Progreso hacia el siguiente conjunto"
            />
            <p className="hint">Te faltan {fmt(next.remaining)} XP para descubrir un nuevo conjunto.</p>
          </>
        ) : (
          <p className="hint">¡Ya descubriste todos los conjuntos!</p>
        )}
        <p className="hint">Equipar ropa no gasta tu experiencia.</p>
      </section>
    </div>
  );
}

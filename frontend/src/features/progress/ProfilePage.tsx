import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayerAvatar } from '../../components/Avatar';
import { GameBadge, Platform } from '../../components/GameArt';
import { ChevronIcon, FlameIcon, HangerIcon, StarIcon } from '../../components/icons';
import type { Gender } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { ProgressBar } from '../../components/ProgressBar';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { fmt } from '../../lib/random';
import { currentStreak, levelFor, useProgress, XP_PER_LEVEL } from './ProgressContext';

/**
 * Compañeros de ejemplo: se mostrarán los reales cuando el backend
 * exponga la tabla de la clase.
 */
const DEMO_CLASSMATES = [
  { name: 'Emy', xp: 420 },
  { name: 'Emma', xp: 370 },
  { name: 'Ale', xp: 250 },
  { name: 'Dan', xp: 140 },
];

export function ProfilePage() {
  const { profile, stats, lessons, pending } = useProgress();
  const { logout, changeGender } = useAuth();
  const online = useOnlineStatus();
  const [leaving, setLeaving] = useState(false);
  if (!profile) return null;

  const { level, intoLevel } = levelFor(stats.xp);
  const streak = currentStreak(stats);
  const totalStars = Object.values(lessons).reduce((sum, l) => sum + l.bestStars, 0);

  const ranking = [...DEMO_CLASSMATES, { name: profile.name.split(' ')[0], xp: stats.xp, me: true }].sort(
    (a, b) => b.xp - a.xp,
  );

  return (
    <div className="page">
      <section className="hero" aria-label="Tu explorador">
        <svg className="hero-clouds" viewBox="0 0 400 120" aria-hidden="true">
          <path d="M40 60 a12 12 0 0 1 8-18 a17 17 0 0 1 30-4 a12 12 0 0 1 22 10 a9 9 0 0 1 2 12 z" fill="#fff" />
          <path d="M290 40 a10 10 0 0 1 6-14 a14 14 0 0 1 25-4 a10 10 0 0 1 18 8 a8 8 0 0 1 1 10 z" fill="#fff" />
        </svg>
        <div className="hero-figure">
          <PlayerAvatar className="hero-avatar" />
          <Platform className="hero-platform" />
        </div>
        <div className="nameplate">
          <h1>{profile.name}</h1>
          <p>
            {profile.courseName} · {profile.schoolName}
          </p>
          <p className="nameplate-user">Usuario: {profile.username}</p>
        </div>
      </section>

      <Link to="/perfil/guardarropa" className="wardrobe-entry">
        <span className="wardrobe-entry-icon">
          <HangerIcon />
        </span>
        <span className="wardrobe-entry-text">
          <strong>Mi guardarropa</strong>
          <small>Cambia el conjunto de tu explorador</small>
        </span>
        <ChevronIcon className="wardrobe-entry-go" />
      </Link>

      <div className="badges">
        <GameBadge
          color="#F08A2E"
          icon={<FlameIcon />}
          value={streak}
          label={streak === 1 ? 'Racha: 1 día' : `Racha: ${streak} días`}
        />
        <GameBadge color="#278FC7" icon={<StarIcon />} value={level} label={`Nivel ${level}`} />
        <GameBadge color="#F5C451" icon={<StarIcon />} value={totalStars} label={totalStars === 1 ? '1 estrella' : `${totalStars} estrellas`} />
      </div>

      <section className="panel">
        <div className="row-between">
          <h2>Experiencia</h2>
          <span className="value-chip">
            {intoLevel}/{XP_PER_LEVEL} XP
          </span>
        </div>
        <ProgressBar value={(intoLevel / XP_PER_LEVEL) * 100} tone="yellow" label="Experiencia del nivel" />
        <p className="hint">
          Te faltan {XP_PER_LEVEL - intoLevel} XP para el nivel {level + 1}.
        </p>
      </section>

      <section className="panel panel-quiet">
        <h2>Amigos</h2>
        <ol className="ranking">
          {ranking.map((r, i) => {
            const me = 'me' in r;
            return (
              <li key={r.name + i} className={me ? 'ranking-me' : undefined}>
                <span className="ranking-pos">{i + 1}</span>
                <span className="ranking-name">{me ? `${r.name} (tú)` : r.name}</span>
                <span className="ranking-xp">{fmt(r.xp)} XP</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="panel panel-quiet">
        <h2>Mi avatar</h2>
        <p className="hint">Elige cómo se ve tu explorador. Tu experiencia y tus conjuntos se conservan.</p>
        <div className="gender-row" role="group" aria-label="Avatar">
          {(
            [
              ['nina', 'Niña'],
              ['nino', 'Niño'],
            ] as [Gender, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`gender-option${profile.gender === value ? ' gender-on' : ''}`}
              aria-pressed={profile.gender === value}
              onClick={() => profile.gender !== value && changeGender(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <button
        className="btn btn-secondary btn-block"
        disabled={leaving}
        onClick={async () => {
          setLeaving(true);
          await logout();
        }}
      >
        {leaving ? 'Cerrando…' : 'Cerrar sesión'}
      </button>
      <p className="hint logout-hint">Al cerrar sesión, tu avance queda oculto hasta que vuelvas a entrar con tu contraseña.</p>

      <p className="sync-note">
        {pending === 0
          ? 'Todo tu avance está guardado.'
          : online
            ? `Enviando ${pending} ${pending === 1 ? 'respuesta' : 'respuestas'} a tu maestro…`
            : `${pending} ${pending === 1 ? 'respuesta guardada' : 'respuestas guardadas'} en este teléfono. Se enviarán cuando haya internet.`}
      </p>
    </div>
  );
}

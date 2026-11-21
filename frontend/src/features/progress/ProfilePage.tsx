import { useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { GameBadge, Platform } from '../../components/GameArt';
import { FlameIcon, StarIcon } from '../../components/icons';
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
  const online = useOnlineStatus();
  const navigate = useNavigate();
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
          <Avatar color={profile.capColor} className="hero-avatar" />
          <Platform className="hero-platform" />
        </div>
        <div className="nameplate">
          <h1>{profile.name}</h1>
          <p>
            {profile.grade} grado · Sección {profile.section}
          </p>
        </div>
        <button className="btn btn-small btn-secondary hero-edit" onClick={() => navigate('/bienvenida?editar=1')}>
          Editar
        </button>
      </section>

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

      <p className="sync-note">
        {pending === 0
          ? 'Todo tu avance está guardado.'
          : online
            ? `Enviando ${pending} ${pending === 1 ? 'lección' : 'lecciones'} a tu maestro…`
            : `${pending} ${pending === 1 ? 'lección guardada' : 'lecciones guardadas'} en este teléfono. Se enviarán cuando haya internet.`}
      </p>
    </div>
  );
}

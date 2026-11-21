import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlayerAvatar } from '../../components/Avatar';
import { CheckIcon, ChevronIcon, LockIcon, StarIcon } from '../../components/icons';
import type { Lesson, LessonProgress } from '../../types';
import { useProgress, weekActivity } from '../progress/ProgressContext';
import { LessonSheet, type StationState } from './LessonSheet';
import { MapScene, SCENE_H, SCENE_W, STATIONS } from './MapScene';
import { findWorld, WORLDS } from './worlds';

/**
 * Una lección se abre cuando la anterior está completada.
 * "current" es la primera abierta sin completar; las demás abiertas quedan "available".
 */
function stationStates(worldLessons: Lesson[], progress: Record<string, LessonProgress>): StationState[] {
  let currentAssigned = false;
  return worldLessons.map((l, i) => {
    if (progress[l.id]?.completed) return 'done';
    const unlocked = i === 0 || !!progress[worldLessons[i - 1].id]?.completed;
    if (!unlocked) return 'locked';
    if (!currentAssigned) {
      currentAssigned = true;
      return 'current';
    }
    return 'available';
  });
}

const STATE_LABELS: Record<StationState, string> = {
  done: 'completada',
  current: 'lección actual',
  available: 'disponible',
  locked: 'bloqueada',
};

export function MapPage() {
  const { lessons, stats, profile } = useProgress();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const closeSheet = useCallback(() => setSelected(null), []);

  const firstUnfinished = WORLDS.find((w) => w.lessons.some((l) => !lessons[l.id]?.completed)) ?? WORLDS[0];
  const world = findWorld(params.get('mundo')) ?? firstUnfinished;
  const worldIndex = WORLDS.indexOf(world);
  const states = stationStates(world.lessons, lessons);
  const currentIndex = states.indexOf('current');
  const done = states.filter((s) => s === 'done').length;
  const week = weekActivity(stats);

  // Al abrir un mundo, centra la lección actual (puede quedar fuera de la pantalla)
  const currentRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [world.id]);

  function changeWorld(step: number) {
    const next = WORLDS[(worldIndex + step + WORLDS.length) % WORLDS.length];
    setSelected(null);
    setParams({ mundo: next.id }, { replace: true });
  }

  const selectedIndex = world.lessons.findIndex((l) => l.id === selected);

  return (
    <div className="map-page">
      <section className={`scene scene-${world.id}`} aria-label={`Mapa del mundo ${world.name}`}>
        <MapScene world={world.id} />

        <header className="hud">
          <div className="hud-top">
            <span className="brand">
              <img src="/logo.svg" alt="" width={24} height={24} />
              MayaMente
            </span>
            <ol className="week" aria-label="Días que jugaste esta semana">
              {week.map((d) => (
                <li
                  key={d.name}
                  className={`week-day${d.active ? ' week-on' : ''}${d.isToday ? ' week-today' : ''}`}
                  aria-label={`${d.name}${d.active ? ', jugaste' : ''}${d.isToday ? ' (hoy)' : ''}`}
                >
                  {d.active ? <CheckIcon className="week-check" /> : d.label}
                </li>
              ))}
            </ol>
          </div>

          <div className="world-switch">
            <button className="round-btn" onClick={() => changeWorld(-1)} aria-label="Mundo anterior">
              <ChevronIcon dir="left" className="round-btn-icon" />
            </button>
            <div className="world-name">
              {profile && (
                <span className="class-chip">
                  Clase {profile.courseName} · {profile.schoolName}
                </span>
              )}
              <h1>{world.name}</h1>
              <p>
                {world.subtitle} · {done}/{world.lessons.length}
              </p>
            </div>
            <button className="round-btn" onClick={() => changeWorld(1)} aria-label="Mundo siguiente">
              <ChevronIcon className="round-btn-icon" />
            </button>
          </div>
        </header>

        <ol className="stations">
          {world.lessons.map((lesson, i) => {
            const state = states[i];
            const pos = STATIONS[i % STATIONS.length];
            const best = lessons[lesson.id]?.bestStars ?? 0;
            return (
              <li
                key={lesson.id}
                className={`station station-${state}`}
                style={{ left: `${(pos.x / SCENE_W) * 100}%`, top: `${(pos.y / SCENE_H) * 100}%` }}
              >
                {state === 'current' && (
                  <div className="bubble" aria-hidden="true">
                    Lección {lesson.number}
                  </div>
                )}
                <button
                  ref={state === 'current' ? currentRef : undefined}
                  className="node"
                  onClick={() => setSelected(lesson.id)}
                  aria-label={`Lección ${lesson.number}: ${lesson.title}, ${STATE_LABELS[state]}${
                    state === 'done' ? `, ${best} de 3 estrellas` : ''
                  }`}
                  aria-haspopup="dialog"
                >
                  {state === 'locked' ? (
                    <LockIcon className="node-icon" />
                  ) : state === 'done' ? (
                    <CheckIcon className="node-icon" />
                  ) : (
                    <span className="node-number">{lesson.number}</span>
                  )}
                </button>
                {state === 'done' && (
                  <span className="node-stars" aria-hidden="true">
                    {[1, 2, 3].map((n) => (
                      <StarIcon key={n} className="node-star" filled={best >= n} />
                    ))}
                  </span>
                )}
                {state === 'current' && (
                  <PlayerAvatar
                    className={`explorer ${pos.x < SCENE_W / 2 ? 'explorer-right' : 'explorer-left'}`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {selectedIndex >= 0 && (
        <LessonSheet
          lesson={world.lessons[selectedIndex]}
          state={states[selectedIndex]}
          bestStars={lessons[world.lessons[selectedIndex].id]?.bestStars ?? 0}
          currentLesson={currentIndex >= 0 ? world.lessons[currentIndex] : undefined}
          onPlay={() => navigate(`/leccion/${world.lessons[selectedIndex].id}`)}
          onSelect={setSelected}
          onClose={closeSheet}
        />
      )}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { CloseIcon, LockIcon, PlayIcon, StarIcon } from '../../components/icons';
import type { Lesson } from '../../types';
import { QUESTIONS_PER_LESSON } from '../exercises/generators';
import { XP_LESSON_BONUS, XP_PER_CORRECT } from '../progress/ProgressContext';
import { SKILL_LABELS } from './worlds';

export type StationState = 'done' | 'current' | 'available' | 'locked';

interface Props {
  lesson: Lesson;
  state: StationState;
  bestStars: number;
  currentLesson?: Lesson;
  onPlay: () => void;
  onSelect: (lessonId: string) => void;
  onClose: () => void;
}

/** Panel compacto que aparece al tocar una estación del mapa. */
export function LessonSheet({ lesson, state, bestStars, currentLesson, onPlay, onSelect, onClose }: Props) {
  const actionRef = useRef<HTMLButtonElement>(null);
  const locked = state === 'locked';
  const maxXp = QUESTIONS_PER_LESSON * XP_PER_CORRECT + XP_LESSON_BONUS;

  useEffect(() => {
    actionRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lesson.id, onClose]);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet-head">
          <span className={`sheet-badge sheet-badge-${state}`} aria-hidden="true">
            {locked ? <LockIcon className="sheet-badge-icon" /> : lesson.number}
          </span>
          <div className="sheet-titles">
            <p className="sheet-kicker">Lección {lesson.number}</p>
            <h2 id="sheet-title">{lesson.title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <CloseIcon className="icon" />
          </button>
        </div>

        <div className="sheet-meta">
          <span className="tag">Habilidad: {SKILL_LABELS[lesson.skill]}</span>
          <span className="tag">{QUESTIONS_PER_LESSON} retos</span>
        </div>

        {state === 'done' ? (
          <div className="sheet-stars" aria-label={`Tu récord: ${bestStars} de 3 estrellas`}>
            {[1, 2, 3].map((n) => (
              <StarIcon key={n} className="sheet-star" filled={bestStars >= n} />
            ))}
            <span>{bestStars < 3 ? '¡Juega otra vez para ganar más estrellas!' : '¡Lección perfecta!'}</span>
          </div>
        ) : !locked ? (
          <p className="sheet-text">Gana hasta {maxXp} XP y 3 estrellas.</p>
        ) : (
          <p className="sheet-text">
            Termina la lección {lesson.number - 1} para abrir este reto.
          </p>
        )}

        {locked ? (
          currentLesson && (
            <button ref={actionRef} className="btn btn-secondary btn-block" onClick={() => onSelect(currentLesson.id)}>
              Ir a la lección {currentLesson.number}
            </button>
          )
        ) : (
          <button ref={actionRef} className="btn btn-primary btn-block btn-play" onClick={onPlay}>
            <PlayIcon className="btn-icon" />
            {state === 'done' ? 'Jugar otra vez' : 'Jugar'}
          </button>
        )}
      </div>
    </>
  );
}

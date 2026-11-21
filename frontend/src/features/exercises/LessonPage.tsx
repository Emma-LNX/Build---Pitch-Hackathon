import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { Platform } from '../../components/GameArt';
import { StarIcon } from '../../components/icons';
import type { AnswerRecord } from '../../types';
import { bestDifficulty, thetaOf } from '../adaptive/engine';
import { EXERCISES } from '../curriculum/catalog';
import { useProgress, type LessonOutcome } from '../progress/ProgressContext';
import { findLesson, findWorld } from '../topics/worlds';
import { generateLesson } from './generators';
import { SessionRunner } from './SessionRunner';

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const lesson = findLesson(lessonId);
  if (!lesson) return <Navigate to="/" replace />;
  // `key` reinicia todo el estado al repetir o cambiar de lección
  return <LessonRun key={lessonId} lessonId={lessonId} />;
}

function LessonRun({ lessonId }: { lessonId: string }) {
  const lesson = findLesson(lessonId)!;
  const world = findWorld(lesson.worldId)!;
  const { completeLesson, profile, mastery } = useProgress();
  const navigate = useNavigate();

  const [round, setRound] = useState(0);
  // La dificultad se ajusta al nivel del alumno en la categoría de la lección
  const difficulty = useMemo(() => bestDifficulty(thetaOf(mastery, EXERCISES[lesson.exercise].category)), [round]);
  const questions = useMemo(() => generateLesson(lesson, difficulty), [lesson, round, difficulty]);
  const [result, setResult] = useState<{ outcome: LessonOutcome; correct: number; total: number } | null>(null);

  async function finish(records: AnswerRecord[]) {
    const outcome = await completeLesson({ lessonId, records });
    setResult({ outcome, correct: records.filter((r) => r.correct).length, total: records.length });
  }

  function retry() {
    setResult(null);
    setRound((r) => r + 1);
  }

  if (result) {
    const { outcome, correct, total } = result;
    return (
      <div className="lesson-page lesson-result">
        <div className="result-card">
          <div className="result-figure">
            <Avatar color={profile?.capColor} className="result-avatar" />
            <Platform className="result-platform" />
          </div>
          <h1>{outcome.passed ? '¡Lección completada!' : '¡Casi lo logras!'}</h1>
          <div className="result-stars">
            {[1, 2, 3].map((n) => (
              <StarIcon key={n} className={`result-star result-star-${n}`} filled={outcome.stars >= n} />
            ))}
          </div>
          <p className="result-score">
            {correct} de {total} correctas
          </p>
          <p className="result-xp">+{outcome.xpEarned} XP</p>
          {outcome.leveledUp && <p className="result-levelup">¡Subiste de nivel!</p>}
          {!outcome.passed && <p className="result-hint">Necesitas 3 correctas para avanzar. ¡Inténtalo otra vez!</p>}
        </div>
        <div className="lesson-actions">
          <button className="btn btn-secondary" onClick={retry}>
            Repetir
          </button>
          <button className="btn btn-primary" onClick={() => navigate(`/?mundo=${world.id}`)}>
            Continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <SessionRunner
      key={round}
      kind="LECCION"
      total={questions.length}
      next={(history) => questions[history.length] ?? null}
      tag={() => `${world.name} · Lección ${lesson.number}: ${lesson.title}`}
      exitTo={`/?mundo=${world.id}`}
      onComplete={finish}
    />
  );
}

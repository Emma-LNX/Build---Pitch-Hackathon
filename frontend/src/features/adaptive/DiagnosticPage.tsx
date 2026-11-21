import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { Platform } from '../../components/GameArt';
import { pick } from '../../lib/random';
import type { AnswerRecord, ExerciseId } from '../../types';
import { CATEGORIES } from '../curriculum/catalog';
import { generateQuestion } from '../exercises/generators';
import { SessionRunner } from '../exercises/SessionRunner';
import { useProgress, type SessionOutcome } from '../progress/ProgressContext';
import { MasteryList } from './MasteryList';

const PER_CATEGORY = 2;
const TOTAL = CATEGORIES.length * PER_CATEGORY;

/**
 * Expedición de exploración: 2 retos por categoría. El primero es de su grado;
 * si acierta, el segundo es más difícil y, si falla, más fácil.
 */
function nextDiagnostic(history: AnswerRecord[]) {
  const category = CATEGORIES[Math.floor(history.length / PER_CATEGORY)];
  if (!category) return null;
  const first = history.length % PER_CATEGORY === 0;
  const last = history[history.length - 1];
  const difficulty = first ? 2 : last.correct ? 3 : 1;
  let exercise: ExerciseId;
  if (category.id === 'maya') exercise = first ? 'maya-leer' : 'maya-formar';
  else {
    const options = first ? category.exercises : category.exercises.filter((e) => e !== last.exercise);
    exercise = pick(options.length ? options : category.exercises);
  }
  return generateQuestion(exercise, difficulty, 1, 0.5);
}

export function DiagnosticPage() {
  const { recordSession, profile } = useProgress();
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);

  if (outcome) {
    return (
      <div className="lesson-page adaptive-page">
        <div className="panel adaptive-card">
          <h1>¡Expedición completada!</h1>
          <p className="hint">Así está tu milpa. Cada categoría crece por separado: practica las que están más pequeñas.</p>
          <p className="result-xp">+{outcome.xpEarned} XP</p>
          <MasteryList mastery={outcome.after} before={{}} practice={false} />
        </div>
        <div className="lesson-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            Al mapa
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/mision')}>
            Mi misión
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="lesson-page adaptive-page">
        <div className="panel adaptive-card adaptive-intro">
          <div className="result-figure">
            <Avatar color={profile?.capColor} className="result-avatar" />
            <Platform className="result-platform" />
          </div>
          <h1>Expedición de exploración</h1>
          <p>
            Son {TOTAL} retos de todos los temas. No pasa nada si fallas: así sabremos qué practicar contigo.
          </p>
        </div>
        <div className="lesson-actions">
          <Link className="btn btn-secondary" to="/">
            Después
          </Link>
          <button className="btn btn-primary" onClick={() => setStarted(true)}>
            ¡Empezar!
          </button>
        </div>
      </div>
    );
  }

  return (
    <SessionRunner
      kind="DIAGNOSTICO"
      total={TOTAL}
      soft
      next={nextDiagnostic}
      tag={(q) => `Expedición · ${CATEGORIES.find((c) => c.id === q.category)?.name}`}
      exitTo="/"
      onComplete={async (records) => setOutcome(await recordSession('DIAGNOSTICO', records))}
    />
  );
}

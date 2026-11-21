import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlayerAvatar } from '../../components/Avatar';
import { Platform } from '../../components/GameArt';
import { TempleArt } from '../../components/TempleArt';
import type { AnswerRecord, CategoryId, Difficulty } from '../../types';
import { findCategory } from '../curriculum/catalog';
import { generateQuestion } from '../exercises/generators';
import { SessionRunner } from '../exercises/SessionRunner';
import { useProgress, type SessionOutcome } from '../progress/ProgressContext';
import { planMission, type PlannedItem } from './engine';
import { MasteryList } from './MasteryList';
import { fetchRecommended } from './serverSync';

/** Si falló los dos últimos retos de esa categoría, baja un escalón para no frustrarlo. */
function adjust(item: PlannedItem, history: AnswerRecord[]): Difficulty {
  const sameCategory = history.filter((r) => r.category === item.category).slice(-2);
  if (sameCategory.length === 2 && sameCategory.every((r) => !r.correct)) {
    return Math.max(1, item.difficulty - 1) as Difficulty;
  }
  return item.difficulty;
}

export function MissionPage() {
  const [params] = useSearchParams();
  const only = findCategory(params.get('categoria'))?.id;
  const [round, setRound] = useState(0);
  // Recomendación del módulo de estadísticas; `null` = sin sesión o sin servidor, se usa el dispositivo.
  const [focus, setFocus] = useState<CategoryId[] | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetchRecommended().then((categories) => alive && setFocus(categories));
    return () => {
      alive = false;
    };
  }, [round]);

  if (focus === undefined) {
    return (
      <div className="splash">
        <TempleArt world="tikal" className="splash-temple" />
      </div>
    );
  }
  return (
    <MissionRun
      key={`${only ?? 'mix'}-${round}`}
      only={only}
      focus={focus?.length ? focus : undefined}
      onAgain={() => setRound((r) => r + 1)}
    />
  );
}

function MissionRun({ only, focus, onAgain }: { only?: CategoryId; focus?: CategoryId[]; onAgain: () => void }) {
  const { mastery, answers, recordSession, profile } = useProgress();
  const navigate = useNavigate();
  const [plan] = useState(() => planMission(mastery, answers, { only, focus }));
  const [result, setResult] = useState<{ outcome: SessionOutcome; correct: number; categories: CategoryId[] } | null>(
    null,
  );

  if (result) {
    const { outcome, correct, categories } = result;
    return (
      <div className="lesson-page adaptive-page">
        <div className="panel adaptive-card">
          <div className="result-figure">
            <PlayerAvatar className="result-avatar" />
            <Platform className="result-platform" />
          </div>
          <h1>¡Misión cumplida!</h1>
          <p className="result-score">
            {correct} de {plan.length} correctas
          </p>
          <p className="result-xp">+{outcome.xpEarned} XP</p>
          {outcome.leveledUp && <p className="result-levelup">¡Subiste de nivel!</p>}
          <MasteryList mastery={outcome.after} before={outcome.before} only={categories} practice={false} />
        </div>
        <div className="lesson-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/progreso')}>
            Mi milpa
          </button>
          <button className="btn btn-primary" onClick={onAgain}>
            Otra misión
          </button>
        </div>
      </div>
    );
  }

  const title = only ? `Práctica · ${findCategory(only)!.name}` : focus ? 'Misión recomendada' : 'Misión del día';
  return (
    <SessionRunner
      kind="ENTRENAMIENTO"
      total={plan.length}
      next={(history) => {
        const item = plan[history.length];
        return item ? generateQuestion(item.exercise, adjust(item, history), 0.5, 0.6) : null;
      }}
      tag={(q) => `${title} · ${findCategory(q.category)!.name}`}
      exitTo="/"
      onComplete={async (records) => {
        const outcome = await recordSession('ENTRENAMIENTO', records);
        setResult({
          outcome,
          correct: records.filter((r) => r.correct).length,
          categories: [...new Set(records.map((r) => r.category))],
        });
      }}
    />
  );
}

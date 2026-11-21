import { Link } from 'react-router-dom';
import { ChevronIcon } from '../../components/icons';
import { ProgressBar } from '../../components/ProgressBar';
import type { CategoryId, CategoryMastery } from '../../types';
import { CATEGORIES } from '../curriculum/catalog';
import { MayaNumeral } from '../games/MayaNumeral';
import { levelFor, masteryScore } from './engine';

interface Props {
  mastery: Partial<Record<CategoryId, CategoryMastery>>;
  /** Puntuación anterior, para mostrar cuánto subió en la sesión. */
  before?: Partial<Record<CategoryId, CategoryMastery>>;
  only?: CategoryId[];
  practice?: boolean;
}

/** "Tu milpa": nivel por categoría, de Semilla a Mazorca (con numeral maya). */
export function MasteryList({ mastery, before, only, practice = true }: Props) {
  const categories = CATEGORIES.filter((c) => !only || only.includes(c.id));
  return (
    <ul className="mastery-list">
      {categories.map((c) => {
        const m = mastery[c.id];
        const enough = (m?.answers ?? 0) > 0;
        const score = masteryScore(m?.theta ?? 0);
        const level = levelFor(score);
        const prev = before?.[c.id];
        const delta = prev ? score - masteryScore(prev.theta) : null;
        return (
          <li key={c.id} className="mastery-row">
            <span className="mastery-level" aria-hidden="true">
              {enough ? <MayaNumeral digits={[level.number]} className="mastery-level-art" /> : '?'}
            </span>
            <span className="mastery-info">
              <span className="row-between">
                <strong>{c.name}</strong>
                <span className="mastery-name">
                  {enough ? level.name : 'Sin datos'}
                  {delta !== null && delta !== 0 && (
                    <small className={delta > 0 ? 'mastery-up' : 'mastery-down'}>
                      {delta > 0 ? ` +${delta}` : ` ${delta}`}
                    </small>
                  )}
                </span>
              </span>
              <ProgressBar value={enough ? score : 0} tone={score >= 60 ? 'green' : 'yellow'} label={`${c.name}: ${score} de 100`} />
              <small className="hint">CNB 4.º: {c.cnb}</small>
            </span>
            {practice && (
              <Link to={`/mision?categoria=${c.id}`} className="practice-go" aria-label={`Practicar ${c.name}`}>
                <ChevronIcon className="practice-go-icon" />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

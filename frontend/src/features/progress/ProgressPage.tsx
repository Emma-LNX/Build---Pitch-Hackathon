import { Link } from 'react-router-dom';
import { CheckIcon, ChevronIcon } from '../../components/icons';
import { ProgressBar } from '../../components/ProgressBar';
import { TempleArt } from '../../components/TempleArt';
import type { SkillId, SkillProgress } from '../../types';
import { ALL_LESSONS, SKILL_LABELS, WORLDS } from '../topics/worlds';
import { useProgress } from './ProgressContext';

const NEEDS_PRACTICE_BELOW = 0.7;
const MIN_ANSWERS_TO_JUDGE = 3;

export function ProgressPage() {
  const { lessons, skills } = useProgress();

  const skillList = Object.values(skills).filter((s): s is SkillProgress => !!s && s.total > 0);
  const correct = skillList.reduce((n, s) => n + s.correct, 0);
  const total = skillList.reduce((n, s) => n + s.total, 0);
  const completed = ALL_LESSONS.filter((l) => lessons[l.id]?.completed).length;

  // "Dominio del tema" solo cuando hay respuestas que lo respalden
  const unit = WORLDS.find((w) => w.lessons.some((l) => !lessons[l.id]?.completed)) ?? WORLDS[WORLDS.length - 1];
  const unitDone = unit.lessons.filter((l) => lessons[l.id]?.completed).length;
  const second =
    total > 0
      ? { label: 'Dominio del tema', value: (correct / total) * 100, detail: `${correct} de ${total} respuestas correctas` }
      : { label: 'Avance de la unidad', value: (unitDone / unit.lessons.length) * 100, detail: `${unit.name}: ${unitDone} de ${unit.lessons.length} lecciones` };

  const weak = skillList
    .filter((s) => s.total >= MIN_ANSWERS_TO_JUDGE && s.correct / s.total < NEEDS_PRACTICE_BELOW)
    .sort((a, b) => a.correct / a.total - b.correct / b.total);

  return (
    <div className="page">
      <header className="page-head">
        <TempleArt world="tikal" className="page-head-art" />
        <h1>Mi progreso</h1>
      </header>

      <section className="panel">
        <Metric
          label="Lecciones completadas"
          value={(completed / ALL_LESSONS.length) * 100}
          tone="blue"
          detail={`${completed} de ${ALL_LESSONS.length} lecciones`}
        />
        <Metric label={second.label} value={second.value} tone="green" detail={second.detail} />
      </section>

      <section className="panel panel-warm">
        <h2>Vamos a practicar</h2>
        {total === 0 ? (
          <p className="hint">Juega tu primera lección y aquí te diremos qué repasar.</p>
        ) : weak.length === 0 ? (
          <p className="hint">¡Vas muy bien en todos los temas! Sigue subiendo al templo.</p>
        ) : (
          <ul className="practice-list">
            {weak.map((s) => (
              <li key={s.skill}>
                <Link to={practiceLink(s.skill)} className="practice-btn">
                  <span className="practice-text">
                    <strong>Practicar {SKILL_LABELS[s.skill].toLowerCase()}</strong>
                    <small>Aciertos: {Math.round((s.correct / s.total) * 100)}%</small>
                  </span>
                  <span className="practice-go" aria-hidden="true">
                    <ChevronIcon className="practice-go-icon" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel panel-quiet">
        <h2>Mundos</h2>
        <ul className="world-list">
          {WORLDS.map((w) => {
            const done = w.lessons.filter((l) => lessons[l.id]?.completed).length;
            return (
              <li key={w.id}>
                <Link to={`/?mundo=${w.id}`} className="world-row">
                  <TempleArt world={w.id} className="world-row-art" />
                  <span className="world-row-info">
                    <strong>{w.name}</strong>
                    <span className="pips" aria-label={`${done} de ${w.lessons.length} lecciones`}>
                      {w.lessons.map((l) => (
                        <span key={l.id} className={`pip${lessons[l.id]?.completed ? ' pip-on' : ''}`}>
                          {lessons[l.id]?.completed && <CheckIcon className="pip-check" />}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="world-row-count">
                    {done}/{w.lessons.length}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'green';
  detail: string;
}) {
  return (
    <div className="metric">
      <div className="row-between">
        <span className="metric-label">{label}</span>
        <strong className="metric-value">{Math.round(value)}%</strong>
      </div>
      <ProgressBar value={value} tone={tone} label={label} />
      <span className="hint">{detail}</span>
    </div>
  );
}

/** Lleva a la primera lección que trabaja esa habilidad. */
function practiceLink(skill: SkillId): string {
  const lesson = ALL_LESSONS.find((l) => l.skill === skill);
  return lesson ? `/leccion/${lesson.id}` : '/';
}

import { Link } from 'react-router-dom';
import { CheckIcon } from '../../components/icons';
import { ProgressBar } from '../../components/ProgressBar';
import { TempleArt } from '../../components/TempleArt';
import type { SkillProgress } from '../../types';
import { frequentErrors } from '../adaptive/engine';
import { ERROR_LABELS } from '../adaptive/errors';
import { MasteryList } from '../adaptive/MasteryList';
import { ALL_LESSONS, WORLDS } from '../topics/worlds';
import { useProgress } from './ProgressContext';

export function ProgressPage() {
  const { lessons, skills, mastery, answers, diagnosticDoneAt } = useProgress();
  const errors = frequentErrors(answers);

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
        <h2>Tu milpa</h2>
        {!diagnosticDoneAt ? (
          <>
            <p className="hint">Haz la expedición de exploración y te diremos tu nivel en cada tema.</p>
            <Link to="/diagnostico" className="btn btn-primary btn-block adaptive-cta">
              Empezar expedición
            </Link>
          </>
        ) : (
          <>
            <p className="hint">Semilla, Brote, Milpa, Elote y Mazorca: cada tema crece por separado.</p>
            <MasteryList mastery={mastery} />
            <Link to="/mision" className="btn btn-primary btn-block adaptive-cta">
              Misión del día
            </Link>
          </>
        )}
        {errors.length > 0 && (
          <div className="error-tips">
            <h3>Ojo con esto</h3>
            <ul>
              {errors.map((e) => (
                <li key={e.tag}>{ERROR_LABELS[e.tag] ?? e.tag}</li>
              ))}
            </ul>
          </div>
        )}
        {diagnosticDoneAt && (
          <Link to="/diagnostico" className="hint adaptive-redo">
            Repetir expedición
          </Link>
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
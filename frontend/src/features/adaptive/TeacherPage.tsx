import { Link } from 'react-router-dom';
import { CloseIcon } from '../../components/icons';
import { ProgressBar } from '../../components/ProgressBar';
import type { AnswerRecord, Interaction, SessionKind } from '../../types';
import { CATEGORIES } from '../curriculum/catalog';
import { useProgress } from '../progress/ProgressContext';
import { SKILL_LABELS } from '../topics/worlds';
import { frequentErrors, levelFor, masteryScore, rankCategories, thetaOf } from './engine';
import { ERROR_LABELS } from './errors';

const SOURCE_LABELS: Record<SessionKind, string> = { DIAGNOSTICO: 'Expedición', ENTRENAMIENTO: 'Misión', LECCION: 'Lección' };
const INTERACTION_LABELS: Record<Interaction, string> = {
  choice: 'Opciones',
  number: 'Teclado',
  maya: 'Constructor maya',
  coins: 'Mercado',
  slices: 'Tortilla',
  blocks: 'Bloques',
  order: 'Ordenar',
};

const seconds = (ms: number) => `${Math.round(ms / 1000)} s`;
const percent = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);
const average = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0);
const errorLabel = (tag: string | null) => (tag ? (ERROR_LABELS[tag] ?? 'Otro error') : '');

function topError(answers: AnswerRecord[]): string | null {
  const counts = new Map<string, number>();
  for (const a of answers) if (!a.correct && a.errorTag && a.errorTag !== 'otro') counts.set(a.errorTag, (counts.get(a.errorTag) ?? 0) + 1);
  return [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
}

function exportCsv(answers: AnswerRecord[], student: string) {
  const header = ['fecha', 'origen', 'categoria', 'ejercicio', 'dificultad', 'juego', 'correcta', 'error', 'tiempo_ms'];
  const rows = answers.map((a) => [
    a.answeredAt,
    a.source,
    a.category,
    a.exercise,
    a.difficulty,
    a.interaction,
    a.correct ? 'si' : 'no',
    a.errorTag ?? '',
    a.timeMs,
  ]);
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `mayamente-${student.toLowerCase().replace(/\s+/g, '-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Reporte del alumno para el profesor, armado con las respuestas guardadas en el dispositivo. */
export function TeacherPage() {
  const { profile, answers, mastery } = useProgress();
  const name = profile?.name ?? 'Alumno';
  const correct = answers.filter((a) => a.correct).length;
  const errors = frequentErrors(answers, 5);
  const recent = answers.slice(-12).reverse();
  const weakest = rankCategories(mastery)
    .filter((c) => mastery[c])
    .slice(0, 2)
    .map((id) => CATEGORIES.find((c) => c.id === id)!);

  return (
    <div className="page teacher-page">
      <header className="lesson-header">
        <Link to="/progreso" className="icon-btn" aria-label="Volver">
          <CloseIcon className="icon" />
        </Link>
        <div>
          <h1 className="teacher-title">Vista del profesor</h1>
          <p className="hint">
            {name} · {profile?.grade} {profile?.section}
          </p>
        </div>
      </header>

      {answers.length === 0 ? (
        <section className="panel">
          <p>Aún no hay respuestas. Pide al alumno que haga la Expedición para conocer su nivel en cada tema.</p>
        </section>
      ) : (
        <>
          <section className="teacher-stats">
            <Stat value={String(answers.length)} label="retos respondidos" />
            <Stat value={`${percent(correct, answers.length)}%`} label="de aciertos" />
            <Stat value={seconds(average(answers.map((a) => a.timeMs)))} label="por reto, en promedio" />
            <Stat value={String(new Set(answers.map((a) => a.sessionId)).size)} label="sesiones de práctica" />
          </section>

          {weakest.length > 0 && (
            <section className="panel panel-warm">
              <h2>Recomendación</h2>
              <ul className="teacher-list">
                {weakest.map((c) => {
                  const tag = topError(answers.filter((a) => a.category === c.id));
                  return (
                    <li key={c.id}>
                      Reforzar <strong>{c.name}</strong> (CNB 4.º: {c.cnb})
                      {tag && <span className="hint"> · Error más común: {errorLabel(tag)}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="panel">
            <h2>Nivel por tema del CNB</h2>
            <ul className="teacher-cats">
              {CATEGORIES.map((c) => {
                const list = answers.filter((a) => a.category === c.id);
                const ok = list.filter((a) => a.correct).length;
                const score = masteryScore(thetaOf(mastery, c.id));
                const games = list.filter((a) => a.interaction !== 'choice' && a.interaction !== 'number').length;
                return (
                  <li key={c.id}>
                    <span className="row-between">
                      <strong>{c.name}</strong>
                      <span>{list.length ? `${levelFor(score).name} · ${score}/100` : 'Sin datos'}</span>
                    </span>
                    <ProgressBar value={list.length ? score : 0} tone={score >= 60 ? 'green' : 'yellow'} label={`${c.name}: ${score} de 100`} />
                    <small className="hint">
                      CNB {c.cnb}
                      {list.length > 0 &&
                        ` · ${ok}/${list.length} correctas (${percent(ok, list.length)}%) · ${seconds(average(list.map((a) => a.timeMs)))} por reto · ${games} en juegos`}
                    </small>
                  </li>
                );
              })}
            </ul>
          </section>

          {errors.length > 0 && (
            <section className="panel">
              <h2>Errores frecuentes</h2>
              <ul className="teacher-list">
                {errors.map((e) => (
                  <li key={e.tag}>
                    {errorLabel(e.tag)} <span className="hint">· {e.count} veces</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel">
            <h2>Últimas respuestas</h2>
            <ul className="teacher-recent">
              {recent.map((a) => (
                <li key={a.id}>
                  <span className={a.correct ? 'teacher-ok' : 'teacher-bad'}>{a.correct ? '✓' : '✗'}</span>
                  <span>
                    <strong>{SKILL_LABELS[a.skill]}</strong>
                    <small className="hint">
                      {' '}
                      · {SOURCE_LABELS[a.source]} · {INTERACTION_LABELS[a.interaction]} · nivel {a.difficulty} · {seconds(a.timeMs)}
                    </small>
                    {!a.correct && a.errorTag && a.errorTag !== 'otro' && <small className="teacher-error">{errorLabel(a.errorTag)}</small>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <button className="btn btn-secondary btn-block" onClick={() => exportCsv(answers, name)}>
            Descargar respuestas (CSV)
          </button>
        </>
      )}
      <p className="hint teacher-note">
        Datos de este dispositivo. Cuando la app se conecte al servidor, este reporte llegará al panel de estadísticas del aula.
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="teacher-stat">
      <strong>{value}</strong>
      <span className="hint">{label}</span>
    </div>
  );
}

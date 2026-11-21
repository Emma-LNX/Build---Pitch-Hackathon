import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, CloseIcon, CrossIcon } from '../../components/icons';
import { ProgressBar } from '../../components/ProgressBar';
import { fmt, uuid } from '../../lib/random';
import type { AnswerRecord, Question, SessionKind } from '../../types';
import { MayaBuilder, mayaDigitsValue } from '../games/MayaBuilder';
import { MayaNumeral } from '../games/MayaNumeral';
import { gameAnswer, initialPicks, MiniGame } from '../games/MiniGames';
import { NumberPad } from '../games/NumberPad';
import { AnswerText, QuestionVisual } from './QuestionVisual';

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Correcto!', '¡Eres un crack!', '¡Así se hace!'];

interface Props {
  kind: SessionKind;
  total: number;
  /** Siguiente reto según lo que ya respondió; `null` termina la sesión. */
  next: (history: AnswerRecord[]) => Question | null;
  tag: (question: Question) => string;
  exitTo: string;
  /** Diagnóstico: sin rojo ni vibración, para que no se sienta como examen. */
  soft?: boolean;
  onComplete: (records: AnswerRecord[]) => Promise<void> | void;
}

const toNumber = (text: string) => Number(text.replace(/[^\d]/g, ''));

/** Ciclo de preguntas compartido por lecciones, diagnóstico y misiones. */
export function SessionRunner({ kind, total, next, tag, exitTo, soft = false, onComplete }: Props) {
  const sessionId = useMemo(() => uuid(), []);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [question, setQuestion] = useState<Question | null>(() => next([]));
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [maya, setMaya] = useState<number[]>(() => Array(question?.mayaLevels ?? 1).fill(0));
  const [picks, setPicks] = useState<number[]>(() => initialPicks(question?.game));
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const finishing = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const praise = useMemo(() => PRAISE[Math.floor(Math.random() * PRAISE.length)], [records.length]);

  if (!question) return null;
  const q = question;

  const given = q.game
    ? gameAnswer(q.game, picks)
    : q.interaction === 'choice'
      ? selected
      : q.interaction === 'number'
        ? typed
          ? fmt(Number(typed))
          : null
        : fmt(mayaDigitsValue(maya));
  const ready = q.interaction === 'maya' ? mayaDigitsValue(maya) > 0 : given !== null;

  function check() {
    if (checked || !ready || given === null) return;
    const exact = q.interaction === 'choice' || q.interaction === 'order';
    const isCorrect = exact ? given === q.answer : toNumber(given) === toNumber(q.answer);
    const errorTag = isCorrect
      ? null
      : q.commonError && given === q.commonError.answer
        ? q.commonError.tag
        : q.interaction === 'maya'
          ? 'construccion-maya'
          : 'otro';
    setRecords((rs) => [
      ...rs,
      {
        id: uuid(),
        sessionId,
        source: kind,
        exercise: q.exercise,
        skill: q.skill,
        category: q.category,
        difficulty: q.difficulty,
        interaction: q.interaction,
        correct: isCorrect,
        errorTag,
        timeMs: Date.now() - startedAt,
        answeredAt: new Date().toISOString(),
      },
    ]);
    setCorrect(isCorrect);
    setChecked(true);
    if (!isCorrect && !soft) navigator.vibrate?.(120);
  }

  async function goNext() {
    if (finishing.current) return;
    const upcoming = records.length < total ? next(records) : null;
    if (!upcoming) {
      setSaving(true);
      finishing.current = true;
      setSaveError(null);
      try { await onComplete(records); }
      catch {
        setSaveError('No pudimos guardar tu avance. Intenta de nuevo.');
        finishing.current = false;
        setSaving(false);
      }
      return;
    }
    setQuestion(upcoming);
    setSelected(null);
    setTyped('');
    setMaya(Array(upcoming.mayaLevels ?? 1).fill(0));
    setPicks(initialPicks(upcoming.game));
    setChecked(false);
    setStartedAt(Date.now());
  }

  const footerTone = checked ? (correct ? 'feedback-good' : soft ? 'feedback-soft' : 'feedback-bad') : '';

  return (
    <div className="lesson-page">
      <header className="lesson-header">
        <Link to={exitTo} className="icon-btn" aria-label="Salir">
          <CloseIcon className="icon" />
        </Link>
        <ProgressBar value={(records.length / total) * 100} tone="yellow" label="Avance" />
        <span className="lesson-counter">
          {Math.min(records.length + (checked ? 0 : 1), total)}/{total}
        </span>
      </header>

      <div className="lesson-body">
        <p className="lesson-tag">{tag(q)}</p>
        <h1 className="question-prompt">{q.prompt}</h1>
        {q.visual && (
          <div className="visual-box">
            <QuestionVisual visual={q.visual} />
          </div>
        )}

        {q.interaction === 'choice' && (
          <div className="options" role="radiogroup" aria-label="Respuestas">
            {q.options.map((opt) => {
              let cls = 'option';
              if (selected === opt) cls += ' option-selected';
              if (checked && opt === q.answer) cls += ' option-correct';
              if (checked && selected === opt && !correct) cls += soft ? ' option-soft' : ' option-wrong';
              return (
                <button
                  key={opt}
                  role="radio"
                  aria-checked={selected === opt}
                  className={cls}
                  disabled={checked}
                  onClick={() => setSelected(opt)}
                >
                  <AnswerText text={opt} />
                  {checked && opt === q.answer && <CheckIcon className="option-mark" />}
                  {checked && selected === opt && !correct && !soft && <CrossIcon className="option-mark" />}
                </button>
              );
            })}
          </div>
        )}
        {q.interaction === 'number' && <NumberPad value={typed} onChange={setTyped} disabled={checked} />}
        {q.interaction === 'maya' && <MayaBuilder digits={maya} onChange={setMaya} disabled={checked} />}
        {q.game && <MiniGame game={q.game} picks={picks} onChange={setPicks} disabled={checked} />}
      </div>

      <footer className={`lesson-footer ${footerTone}`}>
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        {checked && (
          <div className="feedback" role="status">
            <span className="feedback-icon" aria-hidden="true">
              {correct ? <CheckIcon /> : <CrossIcon />}
            </span>
            <strong>{correct ? praise : soft ? '¡Buen intento! La respuesta era:' : 'La respuesta correcta es:'}</strong>
            {!correct && (
              <span className="feedback-answer">
                {q.interaction === 'maya' ? (
                  <span className="feedback-maya">
                    {q.answer}
                    <MayaNumeral value={toNumber(q.answer)} className="feedback-maya-art" />
                  </span>
                ) : (
                  <AnswerText text={q.answer} />
                )}
              </span>
            )}
            {q.explanation && <p>{q.explanation}</p>}
          </div>
        )}
        {checked ? (
          <button className="btn btn-primary btn-block" onClick={goNext} disabled={saving}>
            {records.length < total ? 'Siguiente' : 'Ver resultado'}
          </button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={check} disabled={!ready}>
            Comprobar
          </button>
        )}
      </footer>
    </div>
  );
}

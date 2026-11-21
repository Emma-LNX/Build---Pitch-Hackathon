import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { Platform } from '../../components/GameArt';
import { CheckIcon, CloseIcon, CrossIcon, StarIcon } from '../../components/icons';
import { ProgressBar } from '../../components/ProgressBar';
import type { SkillId } from '../../types';
import { useProgress, type LessonOutcome } from '../progress/ProgressContext';
import { findLesson, findWorld } from '../topics/worlds';
import { generateLesson } from './generators';
import { AnswerText, QuestionVisual } from './QuestionVisual';

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Correcto!', '¡Eres un crack!', '¡Así se hace!'];

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
  const { completeLesson, profile } = useProgress();
  const navigate = useNavigate();

  const [round, setRound] = useState(0);
  const questions = useMemo(() => generateLesson(lesson), [lesson, round]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<{ skill: SkillId; correct: boolean }[]>([]);
  const [outcome, setOutcome] = useState<LessonOutcome | null>(null);
  const [saving, setSaving] = useState(false);

  const question = questions[index];
  const isCorrect = selected === question?.answer;
  const praise = useMemo(() => PRAISE[Math.floor(Math.random() * PRAISE.length)], [index]);

  function check() {
    if (!selected) return;
    setChecked(true);
    setAnswers((a) => [...a, { skill: question.skill, correct: isCorrect }]);
    if (!isCorrect) navigator.vibrate?.(120);
  }

  async function next() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSelected(null);
      setChecked(false);
      return;
    }
    setSaving(true);
    setOutcome(await completeLesson({ lessonId, answers }));
    setSaving(false);
  }

  function retry() {
    setRound((r) => r + 1);
    setIndex(0);
    setSelected(null);
    setChecked(false);
    setAnswers([]);
    setOutcome(null);
  }

  if (outcome) {
    const correct = answers.filter((a) => a.correct).length;
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
            {correct} de {answers.length} correctas
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
    <div className="lesson-page">
      <header className="lesson-header">
        <Link to={`/?mundo=${world.id}`} className="icon-btn" aria-label="Salir de la lección">
          <CloseIcon className="icon" />
        </Link>
        <ProgressBar
          value={((index + (checked ? 1 : 0)) / questions.length) * 100}
          tone="yellow"
          label="Avance de la lección"
        />
        <span className="lesson-counter">
          {index + 1}/{questions.length}
        </span>
      </header>

      <div className="lesson-body">
        <p className="lesson-tag">
          {world.name} · Lección {lesson.number}: {lesson.title}
        </p>
        <h1 className="question-prompt">{question.prompt}</h1>
        {question.visual && (
          <div className="visual-box">
            <QuestionVisual visual={question.visual} />
          </div>
        )}
        <div className="options" role="radiogroup" aria-label="Respuestas">
          {question.options.map((opt) => {
            let cls = 'option';
            if (selected === opt) cls += ' option-selected';
            if (checked && opt === question.answer) cls += ' option-correct';
            if (checked && selected === opt && !isCorrect) cls += ' option-wrong';
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
                {checked && opt === question.answer && <CheckIcon className="option-mark" />}
                {checked && selected === opt && !isCorrect && <CrossIcon className="option-mark" />}
              </button>
            );
          })}
        </div>
      </div>

      <footer className={`lesson-footer ${checked ? (isCorrect ? 'feedback-good' : 'feedback-bad') : ''}`}>
        {checked && (
          <div className="feedback" role="status">
            <span className="feedback-icon" aria-hidden="true">
              {isCorrect ? <CheckIcon /> : <CrossIcon />}
            </span>
            <strong>{isCorrect ? praise : 'La respuesta correcta es:'}</strong>
            {!isCorrect && (
              <span className="feedback-answer">
                <AnswerText text={question.answer} />
              </span>
            )}
            {question.explanation && <p>{question.explanation}</p>}
          </div>
        )}
        {checked ? (
          <button className="btn btn-primary btn-block" onClick={next} disabled={saving}>
            {index + 1 < questions.length ? 'Siguiente' : 'Ver resultado'}
          </button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={check} disabled={!selected}>
            Comprobar
          </button>
        )}
      </footer>
    </div>
  );
}

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CloseIcon } from '../../components/icons';
import { hasCheckedInToday, recordDailyCheckIn } from '../../offline/sync/dailyCheckIns';
import type { FoodAnswer, Gender, MoodAnswer } from '../../types';
import { useProgress } from '../progress/ProgressContext';

const FOODS: { value: FoodAnswer; label: string }[] = [
  { value: 'SUFICIENTE', label: 'Sí, bastante' },
  { value: 'POCO', label: 'Sí, pero poco' },
  { value: 'NO_HE_COMIDO', label: 'Todavía no' },
  { value: 'PREFIERO_NO_RESPONDER', label: 'Prefiero no responder' },
];

function moods(gender: Gender | null): { value: MoodAnswer; label: string }[] {
  const word = (nina: string, nino: string, neutral: string) => (gender === 'nina' ? nina : gender === 'nino' ? nino : neutral);
  return [
    { value: 'FELIZ', label: 'Feliz' },
    { value: 'TRANQUILO', label: word('Tranquila', 'Tranquilo', 'Con calma') },
    { value: 'TRISTE', label: 'Triste' },
    { value: 'PREOCUPADO', label: word('Preocupada', 'Preocupado', 'Con preocupación') },
    { value: 'CANSADO', label: word('Cansada', 'Cansado', 'Con cansancio') },
    { value: 'PREFIERO_NO_RESPONDER', label: 'Prefiero no responder' },
  ];
}

const SLEEP_HOURS = Array.from({ length: 49 }, (_, i) => i / 2);
const hoursLabel = (h: number) => {
  const whole = Math.floor(h);
  const unit = whole === 1 ? 'hora' : 'horas';
  if (h === 0.5) return 'Media hora';
  return h % 1 ? `${whole} ${unit} y media` : `${whole} ${unit}`;
};

/**
 * Antes de la primera lección, misión o diagnóstico del día se hacen tres preguntas de bienestar.
 * Una partida ya empezada no se interrumpe aunque cambie el día.
 */
export function DailyCheckInGate({ children }: { children: ReactNode }) {
  const { profile } = useProgress();
  const studentId = profile?.studentId;
  const [status, setStatus] = useState<'loading' | 'form' | 'ready'>('loading');

  useEffect(() => {
    if (!studentId) return;
    let alive = true;
    setStatus('loading');
    hasCheckedInToday(studentId).then((done) => alive && setStatus(done ? 'ready' : 'form'));
    return () => {
      alive = false;
    };
  }, [studentId]);

  if (!profile || !studentId) return <Navigate to="/" replace />;
  if (status === 'ready') return children;
  if (status === 'loading') return <div className="lesson-page" aria-busy="true" />;
  return <CheckInForm studentId={studentId} gender={profile.gender} onDone={() => setStatus('ready')} />;
}

function CheckInForm({ studentId, gender, onDone }: { studentId: string; gender: Gender | null; onDone: () => void }) {
  const [sleep, setSleep] = useState('');
  const [food, setFood] = useState<FoodAnswer | null>(null);
  const [mood, setMood] = useState<MoodAnswer | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const complete = sleep !== '' && food !== null && mood !== null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!complete || saving) return;
    setSaving(true);
    setError(false);
    try {
      await recordDailyCheckIn(studentId, { sleepHours: sleep === 'skip' ? null : Number(sleep), food, mood });
      onDone();
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  return (
    <div className="lesson-page">
      <header className="lesson-header">
        <Link to="/" className="icon-btn" aria-label="Volver al mapa">
          <CloseIcon className="icon" />
        </Link>
      </header>
      <form className="lesson-body daily-check-in" onSubmit={submit}>
        <p className="lesson-tag">Antes de jugar</p>
        <h1 className="question-prompt">¿Cómo estás hoy?</h1>
        <p className="hint">Son tres preguntas, una vez al día. No hay respuestas correctas ni incorrectas y no cambian tus puntos.</p>

        <label className="field">
          <span>¿Cuántas horas dormiste anoche?</span>
          <select value={sleep} onChange={(e) => setSleep(e.target.value)} disabled={saving}>
            <option value="" disabled>
              Elige una respuesta
            </option>
            {SLEEP_HOURS.map((h) => (
              <option key={h} value={h}>
                {hoursLabel(h)}
              </option>
            ))}
            <option value="skip">Prefiero no responder</option>
          </select>
        </label>

        <Choices legend="¿Ya comiste hoy?" items={FOODS} value={food} onChange={setFood} disabled={saving} />
        <Choices legend="¿Cómo te sientes?" items={moods(gender)} value={mood} onChange={setMood} disabled={saving} />

        {error && (
          <p className="field-error" role="alert">
            No pudimos guardar tus respuestas. Inténtalo otra vez.
          </p>
        )}
        <button className="btn btn-primary btn-block" type="submit" disabled={!complete || saving}>
          {saving ? 'Guardando…' : 'Guardar y jugar'}
        </button>
      </form>
    </div>
  );
}

function Choices<T extends string>({ legend, items, value, onChange, disabled }: {
  legend: string;
  items: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="field" disabled={disabled}>
      <legend>{legend}</legend>
      <div className="options" role="radiogroup" aria-label={legend}>
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={value === item.value}
            className="option daily-option"
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { loadDailyState, recordDailyCheckIn, checkInDate } from '../../offline/sync/dailyCheckIns';
import { useAccountId } from '../auth/AuthContext';
import { useProgress } from '../progress/ProgressContext';
import type { FoodAnswer, MoodAnswer, Profile } from '../../types';

// El perfil local todavía no tiene zona horaria; coincide con la predeterminada del backend.

const MOODS: { value: MoodAnswer; label: string }[] = [
  { value: 'FELIZ', label: 'Feliz' },
  { value: 'TRANQUILO', label: 'Con tranquilidad' },
  { value: 'TRISTE', label: 'Con tristeza' },
  { value: 'PREOCUPADO', label: 'Con preocupación' },
  { value: 'CANSADO', label: 'Con cansancio' },
  { value: 'PREFIERO_NO_RESPONDER', label: 'Prefiero no responder' },
];

export function DailyCheckInGate({ studentId, lessonId, children }: {
  studentId: string; lessonId: string; children: ReactNode;
}) {
  const accountId = useAccountId();
  const { profile } = useProgress();
  if (!profile) return null;
  const date = checkInDate(profile.timeZone ?? 'America/Guatemala');
  // Cambiar de perfil o de lección vuelve a consultar el día; una lección en curso no se interrumpe.
  return <CheckIn key={`${accountId}:${studentId}:${lessonId}:${date}`} accountId={accountId} profile={profile}>{children}</CheckIn>;
}

function CheckIn({ accountId, profile, children }: { accountId: string; profile: Profile; children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'form' | 'ready' | 'error'>('loading');
  const [sleep, setSleep] = useState('');
  const [food, setFood] = useState<FoodAnswer | ''>('');
  const [mood, setMood] = useState<MoodAnswer | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadDailyState(accountId, profile)
      .then(({ entry, warning }) => { if (!cancelled) { setWarning(warning); setStatus(entry ? 'ready' : 'form'); } })
      .catch((e: Error) => { if (!cancelled) { setError(e.message); setStatus('error'); } });
    return () => { cancelled = true; };
  }, [accountId, profile, retry]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!sleep || !food || !mood || saving) return;
    setSaving(true);
    setError('');
    try {
      // Si dejó el formulario abierto durante la noche, se acredita la fecha al responder.
      await recordDailyCheckIn(accountId, profile, { sleepHours: sleep === 'skip' ? null : Number(sleep), food, mood });
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar tus respuestas. Inténtalo otra vez.');
    } finally { setSaving(false); }
  }

  if (status === 'ready') return children;
  return (
    <main className="daily-check-in">
      <section className="panel daily-check-in-card" aria-labelledby="daily-title">
        <Link to="/" className="daily-back">Volver al mapa</Link>
        <p className="lesson-tag">Antes de explorar</p>
        <h1 id="daily-title">¿Cómo estás hoy?</h1>
        {status === 'loading' && <p role="status">Preparando tu lección…</p>}
        {status === 'error' && <>
          <p role="alert">{error || 'No pudimos consultar tu registro de hoy.'}</p>
          <button className="btn btn-primary" onClick={() => { setStatus('loading'); setRetry((n) => n + 1); }}>Reintentar</button>
        </>}
        {status === 'form' && <>
          <p>Son tres preguntas, una vez al día. No hay respuestas correctas o incorrectas.</p>
          {warning && <p role="status">{warning}</p>}
          <form onSubmit={submit} className="daily-check-in-form">
            <label className="field">
              <span>1. ¿Cuántas horas dormiste anoche?</span>
              <select required value={sleep} onChange={(e) => setSleep(e.target.value)} disabled={saving}>
                <option value="" disabled>Elige una respuesta</option>
                {Array.from({ length: 49 }, (_, i) => i / 2).map((hours) =>
                  <option key={hours} value={hours}>{hours} {hours === 1 ? 'hora' : 'horas'}</option>)}
                <option value="skip">Prefiero no responder</option>
              </select>
            </label>
            <label className="field">
              <span>2. ¿Cómo has comido hoy?</span>
              <select required value={food} onChange={(e) => setFood(e.target.value as FoodAnswer)} disabled={saving}>
                <option value="" disabled>Elige una respuesta</option>
                <option value="SUFICIENTE">He comido suficiente</option>
                <option value="POCO">He comido poco</option>
                <option value="NO_HE_COMIDO">Todavía no he comido</option>
                <option value="PREFIERO_NO_RESPONDER">Prefiero no responder</option>
              </select>
            </label>
            <fieldset className="field daily-moods" disabled={saving}>
              <legend>3. ¿Cómo te sientes hoy?</legend>
              {MOODS.map((item) => <label key={item.value} className="daily-mood">
                <input type="radio" name="mood" required value={item.value} checked={mood === item.value}
                  onChange={() => setMood(item.value)} />
                <span>{item.label}</span>
              </label>)}
            </fieldset>
            <p className="hint">Puedes elegir “Prefiero no responder”. Tus respuestas no cambian tus puntos.</p>
            {error && <p role="alert">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar y comenzar'}
            </button>
          </form>
        </>}
      </section>
    </main>
  );
}

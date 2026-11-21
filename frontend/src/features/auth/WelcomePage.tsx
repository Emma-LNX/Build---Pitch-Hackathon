import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar, CAP_COLORS, CAP_LABELS } from '../../components/Avatar';
import { Platform } from '../../components/GameArt';
import { TempleArt } from '../../components/TempleArt';
import { uuid } from '../../lib/random';
import type { CapColor } from '../../types';
import { useProgress } from '../progress/ProgressContext';
import { useAccountId } from './AuthContext';
import { legacyProfile } from './legacyProfile';
import type { Profile } from '../../types';

const GRADES = ['4to', '5to', '6to'];
const SECTIONS = ['A', 'B', 'C', 'D'];

/**
 * Registro local: el perfil vive en el teléfono para que funcione sin internet.
 * Cuando exista autenticación en el backend, aquí se vinculará la cuenta.
 */
export function WelcomePage() {
  const { profile, saveProfile } = useProgress();
  const accountId = useAccountId();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editing = params.get('editar') === '1' && !!profile;

  const [name, setName] = useState(profile?.name ?? '');
  const [grade, setGrade] = useState(profile?.grade ?? '4to');
  const [section, setSection] = useState(profile?.section ?? 'A');
  const [capColor, setCapColor] = useState<CapColor>(profile?.capColor ?? 'terracota');
  const [legacy, setLegacy] = useState<Profile | null>(null);
  const [importLocal, setImportLocal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void legacyProfile(accountId).then(setLegacy).catch(() => {}); }, [accountId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) return;
    setSaving(true); setError('');
    try { await saveProfile({
      studentId: profile?.studentId ?? uuid(),
      name: clean,
      grade,
      section,
      capColor,
    }, importLocal);
    navigate(editing ? '/perfil' : '/', { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo vincular el perfil.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="welcome">
      <section className="welcome-hero">
        <TempleArt world="tikal" className="welcome-temple" />
        <div className="welcome-ground" />
        <div className="welcome-figure">
          <Avatar color={capColor} className="welcome-avatar" />
          <Platform className="welcome-platform" />
        </div>
        {!editing && <h1 className="welcome-title">MayaMente</h1>}
      </section>

      <form className="panel welcome-form" onSubmit={submit}>
        <h2>{editing ? 'Editar perfil' : '¡Hola, explorador!'}</h2>
        {!editing && <p className="hint">Sube a los templos mayas resolviendo retos de matemática.</p>}
        {!editing && legacy && <label className="daily-mood">
          <input type="checkbox" checked={importLocal} onChange={(e) => {
            setImportLocal(e.target.checked);
            if (e.target.checked) { setName(legacy.name); setGrade(legacy.grade); setSection(legacy.section); setCapColor(legacy.capColor); }
          }} />
          <span>El perfil local de {legacy.name} es mío. Vincular su progreso y respuestas a esta cuenta.</span>
        </label>}

        <label className="field">
          <span>¿Cómo te llamas?</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre y apellido"
            autoComplete="name"
            maxLength={40}
            required
          />
        </label>

        <fieldset className="field">
          <legend>Grado</legend>
          <div className="chip-row">
            {GRADES.map((g) => (
              <button
                type="button"
                key={g}
                className="chip chip-wide"
                aria-pressed={grade === g}
                onClick={() => setGrade(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Sección</legend>
          <div className="chip-row">
            {SECTIONS.map((s) => (
              <button type="button" key={s} className="chip" aria-pressed={section === s} onClick={() => setSection(s)}>
                {s}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Color de tu sombrero</legend>
          <div className="chip-row">
            {(Object.keys(CAP_COLORS) as CapColor[]).map((c) => (
              <button
                type="button"
                key={c}
                className="color-dot"
                style={{ background: CAP_COLORS[c] }}
                aria-label={CAP_LABELS[c]}
                aria-pressed={capColor === c}
                onClick={() => setCapColor(c)}
              />
            ))}
          </div>
        </fieldset>

        {error && <p role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={!name.trim() || saving}>
          {saving ? 'Vinculando…' : editing ? 'Guardar' : '¡Empezar la aventura!'}
        </button>
        {editing && (
          <button type="button" className="btn btn-secondary btn-block" onClick={() => navigate('/perfil')}>
            Cancelar
          </button>
        )}
      </form>
    </div>
  );
}

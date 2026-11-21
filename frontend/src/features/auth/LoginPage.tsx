import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { CloudOffIcon, EyeIcon } from '../../components/icons';
import { TempleArt } from '../../components/TempleArt';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { listWardrobes } from '../../offline/storage/db';
import type { Gender } from '../../types';
import { outfitToWear } from '../wardrobe/outfits';
import { LoginFailure, SessionEndedError, useAuth, type LoginError } from './AuthContext';

export const CREDENTIALS_ERROR = 'Revisa tu usuario y contraseña. Si necesitas ayuda, pregunta a tu profe';
export const PREPARE_ACCOUNT = 'Conéctate una vez para preparar tu cuenta en este teléfono';

const MESSAGES: Record<LoginError, string> = {
  credenciales: CREDENTIALS_ERROR,
  'sin-conexion': PREPARE_ACCOUNT,
  'demasiados-intentos': 'Hubo muchos intentos. Espera unos minutos y pregunta a tu profe.',
  'sin-clase': 'Tu cuenta todavía no tiene clase. Pregunta a tu profe.',
  servidor: 'No pudimos conectar con MayaMente. Intenta de nuevo en un momento.',
};

export function LoginPage() {
  const { accounts, login, continueAs } = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const ids = { user: useId(), pass: useId(), gender: useId(), error: useId() };

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Sin opción preseleccionada
  const [gender, setGender] = useState<Gender | null>(null);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [equipped, setEquipped] = useState<Record<string, string>>({});

  useEffect(() => {
    listWardrobes().then((all) => setEquipped(Object.fromEntries(all.map((w) => [w.studentId, w.equipped]))));
  }, [accounts]);

  const missing = {
    user: !username.trim(),
    pass: !password,
    gender: !gender,
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (missing.user || missing.pass || missing.gender) return;
    if (!navigator.onLine) {
      setError(PREPARE_ACCOUNT);
      return;
    }
    setLoading('form');
    try {
      // Al entrar se abre siempre el inicio de su clase
      navigate('/', { replace: true });
      await login(username, password, gender!);
    } catch (err) {
      setError(err instanceof LoginFailure ? MESSAGES[err.reason] : MESSAGES.servidor);
      setPassword('');
    } finally {
      setLoading(null);
    }
  }

  async function resume(studentId: string) {
    setError(null);
    setLoading(studentId);
    try {
      navigate('/', { replace: true });
      await continueAs(studentId);
    } catch (err) {
      setError(
        err instanceof SessionEndedError
          ? 'Tu sesión en este teléfono terminó. Escribe tu usuario y contraseña.'
          : MESSAGES.servidor,
      );
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <div className="login">
      <section className="login-hero" aria-hidden="true">
        <TempleArt world="tikal" className="login-temple" />
        <div className="login-ground" />
      </section>
      <h1 className="login-title">MayaMente</h1>

      {!online && (
        <p className="offline-banner login-offline" role="status">
          <CloudOffIcon className="offline-icon" />
          <span>
            Sin internet.{' '}
            {accounts.length > 0 ? 'Puedes continuar con una cuenta ya preparada en este teléfono.' : PREPARE_ACCOUNT + '.'}
          </span>
        </p>
      )}

      {accounts.length > 0 && (
        <section className="panel resume-panel" aria-labelledby="resume-title">
          <h2 id="resume-title">¿Eres tú?</h2>
          <ul className="resume-list">
            {accounts.map((a) => (
              <li key={a.studentId}>
                <button className="resume-btn" onClick={() => resume(a.studentId)} disabled={busy}>
                  <Avatar
                    outfitId={outfitToWear(
                      equipped[a.studentId] ? { studentId: a.studentId, unlocked: [], celebrated: [], equipped: equipped[a.studentId] } : null,
                      a.gender ?? 'nina',
                    ).id}
                    className="resume-avatar"
                  />
                  <span className="resume-text">
                    <strong>{loading === a.studentId ? 'Abriendo…' : `Continuar como ${a.name}`}</strong>
                    <small>
                      {a.courseName} · {a.schoolName}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="panel login-form" onSubmit={submit} noValidate aria-describedby={error ? ids.error : undefined}>
        <h2>{accounts.length > 0 ? 'Entrar con otra cuenta' : 'Entrar'}</h2>

        <div className="field">
          <label htmlFor={ids.user}>Usuario</label>
          <input
            id={ids.user}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={30}
            aria-invalid={touched && missing.user}
            aria-describedby={touched && missing.user ? `${ids.user}-msg` : undefined}
          />
          {touched && missing.user && (
            <span id={`${ids.user}-msg`} className="field-error">
              Escribe tu usuario.
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor={ids.pass}>Contraseña</label>
          <div className="password-row">
            <input
              id={ids.pass}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={72}
              aria-invalid={touched && missing.pass}
              aria-describedby={touched && missing.pass ? `${ids.pass}-msg` : undefined}
            />
            <button
              type="button"
              className="peek-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-controls={ids.pass}
            >
              <EyeIcon className="peek-icon" />
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {touched && missing.pass && (
            <span id={`${ids.pass}-msg`} className="field-error">
              Escribe tu contraseña.
            </span>
          )}
        </div>

        <fieldset className="field" aria-describedby={touched && missing.gender ? `${ids.gender}-msg` : undefined}>
          <legend>Soy</legend>
          <div className="gender-row">
            {(
              [
                ['nina', 'Niña'],
                ['nino', 'Niño'],
              ] as [Gender, string][]
            ).map(([value, label]) => (
              <label key={value} className={`gender-option${gender === value ? ' gender-on' : ''}`}>
                <input type="radio" name="gender" value={value} checked={gender === value} onChange={() => setGender(value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {touched && missing.gender && (
            <span id={`${ids.gender}-msg`} className="field-error">
              Elige Niña o Niño.
            </span>
          )}
        </fieldset>

        {error && (
          <p id={ids.error} className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy} aria-busy={loading === 'form'}>
          {loading === 'form' ? (
            <>
              <span className="spinner" aria-hidden="true" /> Entrando…
            </>
          ) : (
            'Entrar'
          )}
        </button>
        <p className="hint login-hint">Tu usuario y tu contraseña te los da tu profe.</p>
      </form>

      <Link to="/profe" className="teacher-link">
        Soy profe: administrar cuentas
      </Link>
    </div>
  );
}

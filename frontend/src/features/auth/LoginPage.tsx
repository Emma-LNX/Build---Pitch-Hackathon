import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { Platform } from '../../components/GameArt';
import { TempleArt } from '../../components/TempleArt';
import { signInWithUsername, supabase, type SignInError } from '../../lib/supabase';
import { useProgress } from '../progress/ProgressContext';
import './login.css';

const ERRORS: Record<SignInError, string> = {
  'no-configurado': 'El inicio de sesión no está configurado',
  credenciales: 'Usuario o contraseña incorrectos',
  'sin-internet': 'Necesitas internet para entrar la primera vez',
  desconocido: 'Algo salió mal. Intenta otra vez en un momento.',
};

interface StudentMe {
  alias?: string;
  schoolGrade?: string | null;
}

/** Perfil del backend; si no hay red o aún no existe, se usan los datos de la cuenta. */
async function fetchStudentMe(accessToken: string): Promise<StudentMe | null> {
  try {
    const response = await fetch('/api/students/me', { headers: { Authorization: `Bearer ${accessToken}` } });
    return response.ok ? ((await response.json()) as StudentMe) : null;
  } catch {
    return null;
  }
}

/** El aula guarda el grado como texto ("CUARTO PRIMARIA", "5TO"...); la app usa 4to, 5to o 6to. */
function toGrade(schoolGrade: string | null | undefined, fallback: string): string {
  const grade = (schoolGrade ?? '').toUpperCase();
  if (grade.includes('4') || grade.includes('CUARTO')) return '4to';
  if (grade.includes('5') || grade.includes('QUINTO')) return '5to';
  if (grade.includes('6') || grade.includes('SEXTO')) return '6to';
  return fallback;
}

/** Entrada con el usuario y la contraseña que la escuela creó para el alumno. */
export function LoginPage() {
  const { profile, saveProfile } = useProgress();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SignInError | null>(supabase ? null : 'no-configurado');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !username.trim() || !password) return;
    setBusy(true);
    setError(null);
    const result = await signInWithUsername(username, password);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    const { session } = result;
    const me = await fetchStudentMe(session.accessToken);
    try {
      await saveProfile({
        studentId: session.userId,
        name: me?.alias?.trim() || session.alias || session.username,
        grade: toGrade(me?.schoolGrade, profile?.grade ?? '4to'),
        section: 'A',
        capColor: profile?.capColor ?? 'terracota',
      });
    } catch {
      setError('desconocido');
      setBusy(false);
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="welcome">
      <section className="welcome-hero">
        <TempleArt world="tikal" className="welcome-temple" />
        <div className="welcome-ground" />
        <div className="welcome-figure">
          <Avatar color={profile?.capColor ?? 'terracota'} className="welcome-avatar" />
          <Platform className="welcome-platform" />
        </div>
        <h1 className="welcome-title">MayaMente</h1>
      </section>

      <form className="panel welcome-form" onSubmit={submit}>
        <h2>¡Qué bueno verte!</h2>
        <p className="hint">Escribe el usuario y la contraseña que te dio tu maestro o maestra.</p>

        <label className="field">
          <span>Usuario</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Por ejemplo: ana.lopez"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={30}
            required
          />
        </label>

        <div className="field">
          <label htmlFor="login-password">Contraseña</label>
          <div className="login-password">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña secreta"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="btn btn-secondary btn-small"
              aria-pressed={showPassword}
              aria-controls="login-password"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        {error && (
          <p className="login-error" role="alert">
            {ERRORS[error]}
          </p>
        )}

        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={busy || !supabase || !username.trim() || !password}
        >
          {busy ? 'Entrando…' : '¡Entrar!'}
        </button>
        <button type="button" className="btn btn-secondary btn-block" onClick={() => navigate('/')}>
          Volver
        </button>
      </form>
    </div>
  );
}

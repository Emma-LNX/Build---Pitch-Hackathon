import { useState, type FormEvent } from 'react';
import { Avatar } from '../../components/Avatar';
import { Platform } from '../../components/GameArt';
import { TempleArt } from '../../components/TempleArt';
import { signInWithUsername, type SignInError } from '../../lib/supabase';
import './login.css';

const ERRORS: Record<SignInError, string> = {
  'no-configurado': 'El inicio de sesión no está configurado.',
  credenciales: 'Usuario o contraseña incorrectos. Si usas correo, comprueba que esté confirmado.',
  'sin-internet': 'Necesitas internet para entrar la primera vez.',
  desconocido: 'No pudimos iniciar sesión. Inténtalo de nuevo.',
};

/** Comparte sesión con AuthProvider; no depende de ProgressProvider durante el login. */
export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SignInError | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try { const result = await signInWithUsername(username, password); if (!result.ok) setError(result.error); }
    catch { setError('desconocido'); }
    finally { setBusy(false); }
  }
  return <div className="welcome">
    <section className="welcome-hero">
      <TempleArt world="tikal" className="welcome-temple" /><div className="welcome-ground" />
      <div className="welcome-figure"><Avatar color="terracota" className="welcome-avatar" /><Platform className="welcome-platform" /></div>
      <h1 className="welcome-title">MayaMente</h1>
    </section>
    <form className="panel welcome-form" onSubmit={submit}>
      <h2>¡Qué bueno verte!</h2><p className="hint">Usa el usuario que te dio tu escuela o el correo de tu cuenta.</p>
      <label className="field"><span>Usuario o correo</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ana.lopez o tu correo" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={254} required disabled={busy} />
      </label>
      <div className="field"><label htmlFor="login-password">Contraseña</label><div className="login-password">
        <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required disabled={busy} />
        <button type="button" className="btn btn-secondary btn-small" aria-pressed={showPassword} aria-controls="login-password" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
      </div></div>
      {error && <p className="login-error" role="alert">{ERRORS[error]}</p>}
      <button className="btn btn-primary btn-block" disabled={busy || !username.trim() || !password}>{busy ? 'Entrando…' : 'Iniciar sesión'}</button>
    </form>
  </div>;
}

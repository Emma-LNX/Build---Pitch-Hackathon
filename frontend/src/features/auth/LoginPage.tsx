import { useState, type FormEvent } from 'react';
import { authClient } from '../../lib/auth';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { error } = await (await authClient()).auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error('No pudimos iniciar sesión. Revisa tus datos y confirma tu correo.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos conectar.'); }
    finally { setBusy(false); }
  }
  return <main className="daily-check-in"><section className="panel daily-check-in-card">
    <h1>Entra a MayaMente</h1><p>Inicia sesión con tu cuenta para guardar tus respuestas.</p>
    <form className="daily-check-in-form" onSubmit={submit}>
      <label className="field"><span>Correo</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field"><span>Contraseña</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Entrando…' : 'Iniciar sesión'}</button>
    </form>
  </section></main>;
}

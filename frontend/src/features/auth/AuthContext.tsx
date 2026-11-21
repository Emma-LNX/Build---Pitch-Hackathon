import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { authClient } from '../../lib/auth';

const AuthContext = createContext<Session | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    authClient().then((client) => {
      if (cancelled) return;
      const { data } = client.auth.onAuthStateChange((_event, next) => {
        setSession(next); setReady(true);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    }).catch((e: Error) => { if (!cancelled) { setError(e.message); setReady(true); } });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [retry]);

  if (error) return <main className="daily-check-in"><section className="panel daily-check-in-card">
    <h1>No pudimos conectar</h1><p role="alert">{error}</p>
    <button className="btn btn-primary" onClick={() => { setError(''); setReady(false); setRetry((n) => n + 1); }}>Reintentar</button>
  </section></main>;
  if (!ready) return <p role="status">Preparando tu sesión…</p>;
  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>;
}

export function useSession() { return useContext(AuthContext); }
export function useAccountId() {
  const session = useSession();
  if (!session) throw new Error('Se requiere una sesión');
  return session.user.id;
}

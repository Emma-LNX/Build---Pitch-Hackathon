import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, type RequestOptions } from '../../lib/api';
import {
  AuthError,
  getUser,
  readRedirect,
  refreshSession,
  resendConfirmation,
  signIn,
  signOut,
  signUp,
  type AuthErrorKind,
  type AuthSession,
} from './supabaseAuth';

/**
 * Sesión de profesores y directores (Supabase Auth).
 * - Token de acceso: solo en memoria.
 * - Refresh token: en sessionStorage (se borra al cerrar la pestaña) para
 *   sobrevivir a recargas; nunca en localStorage ni IndexedDB.
 * - Se renueva antes de vencer y, si el servidor responde 401, una vez más.
 */

const STORAGE_KEY = 'mayamente.staff.refresh';

export type StaffStatus = 'cargando' | 'sin-sesion' | 'pendiente-confirmacion' | 'con-sesion' | 'vencida';

/** El servidor rechazó la sesión y no se pudo renovar. */
export class SessionExpiredError extends Error {}

interface StaffSessionValue {
  status: StaffStatus;
  session: AuthSession | null;
  /** Correo esperando confirmación (tras registrarse o intentar entrar sin confirmar). */
  pendingEmail: string | null;
  /** Error del retorno desde el enlace de confirmación. */
  redirectError: AuthErrorKind | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  resend: () => Promise<void>;
  logout: () => Promise<void>;
  backToLogin: () => void;
  /** Petición a la API con el token del profesor/director y renovación automática. */
  call: <T>(path: string, options?: Omit<RequestOptions, 'token' | 'auth'>) => Promise<T>;
}

const Ctx = createContext<StaffSessionValue | null>(null);

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StaffStatus>('cargando');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [redirectError, setRedirectError] = useState<AuthErrorKind | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);
  const refreshing = useRef<Promise<AuthSession | null> | null>(null);

  const adopt = useCallback((next: AuthSession | null, nextStatus: StaffStatus) => {
    sessionRef.current = next;
    setSession(next);
    setStatus(nextStatus);
    if (next) sessionStorage.setItem(STORAGE_KEY, next.refreshToken);
    else sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  /** Renueva una sola vez aunque varias peticiones lo pidan a la vez. */
  const renew = useCallback(async (): Promise<AuthSession | null> => {
    const current = sessionRef.current;
    if (!current) return null;
    refreshing.current ??= refreshSession(current.refreshToken)
      .then((next) => {
        adopt(next, 'con-sesion');
        return next;
      })
      .catch((error) => {
        // Sin conexión no se declara vencida: se reintenta al volver.
        if (error instanceof AuthError && error.kind === 'sin-conexion') return null;
        adopt(null, 'vencida');
        return null;
      })
      .finally(() => {
        refreshing.current = null;
      });
    return refreshing.current;
  }, [adopt]);

  // Arranque: retorno del enlace de confirmación o sesión de esta pestaña
  useEffect(() => {
    const redirect = readRedirect(window.location.hash);
    if (redirect) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      if (redirect.kind === 'error') {
        setRedirectError(redirect.reason);
        setStatus('sin-sesion');
        return;
      }
      getUser(redirect.accessToken)
        .then((user) =>
          adopt(
            {
              accessToken: redirect.accessToken,
              refreshToken: redirect.refreshToken,
              expiresAt: Date.now() + redirect.expiresIn * 1000,
              user,
            },
            'con-sesion',
          ),
        )
        .catch(() => {
          setRedirectError('servidor');
          setStatus('sin-sesion');
        });
      return;
    }
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setStatus('sin-sesion');
      return;
    }
    refreshSession(stored)
      .then((next) => adopt(next, 'con-sesion'))
      .catch(() => adopt(null, 'sin-sesion'));
  }, [adopt]);

  // Renovación un minuto antes de vencer
  useEffect(() => {
    if (!session) return;
    const wait = Math.max(5_000, session.expiresAt - Date.now() - 60_000);
    const timer = window.setTimeout(() => void renew(), wait);
    return () => window.clearTimeout(timer);
  }, [session, renew]);

  const login = useCallback(
    async (email: string, password: string) => {
      setRedirectError(null);
      try {
        adopt(await signIn(email.trim(), password), 'con-sesion');
        setPendingEmail(null);
      } catch (error) {
        if (error instanceof AuthError && error.kind === 'correo-sin-confirmar') {
          setPendingEmail(email.trim());
          setStatus('pendiente-confirmacion');
        }
        throw error;
      }
    },
    [adopt],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      setRedirectError(null);
      const result = await signUp(email.trim(), password);
      if (result.session) {
        // El proyecto no exige confirmar el correo
        adopt(result.session, 'con-sesion');
        return;
      }
      setPendingEmail(email.trim());
      setStatus('pendiente-confirmacion');
    },
    [adopt],
  );

  const resend = useCallback(async () => {
    if (pendingEmail) await resendConfirmation(pendingEmail);
  }, [pendingEmail]);

  const logout = useCallback(async () => {
    const current = sessionRef.current;
    adopt(null, 'sin-sesion');
    if (current) await signOut(current.accessToken);
  }, [adopt]);

  const backToLogin = useCallback(() => {
    setPendingEmail(null);
    setRedirectError(null);
    adopt(null, 'sin-sesion');
  }, [adopt]);

  const call = useCallback(
    async <T,>(path: string, options: Omit<RequestOptions, 'token' | 'auth'> = {}): Promise<T> => {
      const current = sessionRef.current;
      if (!current) throw new SessionExpiredError();
      try {
        return await api<T>(path, { ...options, token: current.accessToken });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        const renewed = await renew();
        if (!renewed) throw new SessionExpiredError();
        try {
          return await api<T>(path, { ...options, token: renewed.accessToken });
        } catch (retry) {
          if (retry instanceof ApiError && retry.status === 401) {
            adopt(null, 'vencida');
            throw new SessionExpiredError();
          }
          throw retry;
        }
      }
    },
    [renew, adopt],
  );

  const value = useMemo(
    () => ({ status, session, pendingEmail, redirectError, login, register, resend, logout, backToLogin, call }),
    [status, session, pendingEmail, redirectError, login, register, resend, logout, backToLogin, call],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStaffSession(): StaffSessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStaffSession debe usarse dentro de <StaffSessionProvider>');
  return ctx;
}

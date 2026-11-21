/**
 * Cliente mínimo de Supabase Auth (API REST de GoTrue) para profesores y
 * directores. Usa solo la configuración PÚBLICA del proyecto:
 *   VITE_SUPABASE_URL       URL base del proyecto
 *   VITE_SUPABASE_ANON_KEY  clave pública "anon" (pensada para el navegador)
 * La clave service-role nunca debe estar en el frontend.
 */

const URL_BASE = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const authConfigured = Boolean(URL_BASE && ANON_KEY);

export interface AuthUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Momento (ms) en que vence el token de acceso. */
  expiresAt: number;
  user: AuthUser;
}

export type AuthErrorKind =
  | 'credenciales'
  | 'correo-sin-confirmar'
  | 'cuenta-existente'
  | 'contrasena-debil'
  | 'demasiados-intentos'
  | 'enlace-vencido'
  | 'sin-conexion'
  | 'sin-configuracion'
  | 'servidor';

export class AuthError extends Error {
  constructor(
    public readonly kind: AuthErrorKind,
    message: string = kind,
  ) {
    super(message);
  }
}

function requireConfig() {
  if (!authConfigured) throw new AuthError('sin-configuracion');
}

async function call(path: string, init: { method?: string; body?: unknown; token?: string; query?: string } = {}) {
  requireConfig();
  if (!navigator.onLine) throw new AuthError('sin-conexion');
  let response: Response;
  try {
    response = await fetch(`${URL_BASE}/auth/v1${path}${init.query ?? ''}`, {
      method: init.method ?? 'POST',
      headers: {
        apikey: ANON_KEY,
        'Content-Type': 'application/json',
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new AuthError('sin-conexion');
  }
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) throw classify(response.status, json);
  return json;
}

/** Traduce los errores de GoTrue (formatos nuevo y anterior). */
function classify(status: number, body: Record<string, unknown>): AuthError {
  const code = String(body.error_code ?? body.code ?? body.error ?? '');
  const message = String(body.msg ?? body.message ?? body.error_description ?? '').toLowerCase();
  if (status === 429 || code.includes('rate_limit')) return new AuthError('demasiados-intentos');
  if (code === 'email_not_confirmed' || message.includes('not confirmed')) return new AuthError('correo-sin-confirmar');
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) {
    return new AuthError('cuenta-existente');
  }
  if (code === 'weak_password' || message.includes('password should')) return new AuthError('contrasena-debil', message);
  if (status === 400 || status === 401 || code === 'invalid_credentials' || code === 'invalid_grant') {
    return new AuthError('credenciales');
  }
  return new AuthError('servidor');
}

function toUser(raw: Record<string, unknown>): AuthUser {
  return {
    id: String(raw.id),
    email: String(raw.email ?? ''),
    emailConfirmed: Boolean(raw.email_confirmed_at ?? raw.confirmed_at),
  };
}

function toSession(raw: Record<string, unknown>): AuthSession {
  const expiresIn = Number(raw.expires_in ?? 3600);
  return {
    accessToken: String(raw.access_token),
    refreshToken: String(raw.refresh_token),
    expiresAt: raw.expires_at ? Number(raw.expires_at) * 1000 : Date.now() + expiresIn * 1000,
    user: toUser((raw.user as Record<string, unknown>) ?? {}),
  };
}

/** Dirección a la que vuelve el enlace de confirmación (debe estar en "Redirect URLs" de Supabase). */
export function confirmationRedirect(): string {
  return `${window.location.origin}/profe`;
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  return toSession(await call('/token', { query: '?grant_type=password', body: { email, password } }));
}

export async function refreshSession(refreshToken: string): Promise<AuthSession> {
  return toSession(await call('/token', { query: '?grant_type=refresh_token', body: { refresh_token: refreshToken } }));
}

export async function signOut(accessToken: string): Promise<void> {
  try {
    await call('/logout', { token: accessToken });
  } catch {
    // Si el token ya venció, la sesión se descarta igual en el navegador.
  }
}

export async function getUser(accessToken: string): Promise<AuthUser> {
  return toUser(await call('/user', { method: 'GET', token: accessToken }));
}

/**
 * Registro con correo y contraseña. Con "Confirm email" activo, Supabase envía
 * el enlace y no devuelve sesión hasta confirmar.
 */
export async function signUp(email: string, password: string): Promise<{ needsConfirmation: boolean; session: AuthSession | null }> {
  const raw = await call('/signup', {
    query: `?redirect_to=${encodeURIComponent(confirmationRedirect())}`,
    body: { email, password },
  });
  if (raw.access_token) return { needsConfirmation: false, session: toSession(raw) };
  return { needsConfirmation: true, session: null };
}

export async function resendConfirmation(email: string): Promise<void> {
  await call('/resend', {
    query: `?redirect_to=${encodeURIComponent(confirmationRedirect())}`,
    body: { type: 'signup', email },
  });
}

/**
 * Lee el retorno del enlace de confirmación. Supabase redirige con los tokens
 * o el error en el fragmento (#access_token=…&type=signup / #error=…).
 */
export function readRedirect(hash: string):
  | { kind: 'session'; accessToken: string; refreshToken: string; expiresIn: number }
  | { kind: 'error'; reason: AuthErrorKind; description: string }
  | null {
  if (!hash || hash.length < 2) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (params.get('error') || params.get('error_code')) {
    const code = params.get('error_code') ?? '';
    return {
      kind: 'error',
      reason: code === 'otp_expired' ? 'enlace-vencido' : 'servidor',
      description: params.get('error_description') ?? '',
    };
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { kind: 'session', accessToken, refreshToken, expiresIn: Number(params.get('expires_in') ?? 3600) };
}

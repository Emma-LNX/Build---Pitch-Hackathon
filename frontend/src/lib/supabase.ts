import { createClient, isAuthApiError, isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Los alumnos no tienen correo: la escuela les crea un usuario y Supabase lo guarda
 * como `usuario@alumnos.mayamente.app`. Debe coincidir con el dominio del backend.
 */
export const STUDENT_EMAIL_DOMAIN = 'alumnos.mayamente.app';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();

/** `null` cuando falta configuración: la app sigue funcionando solo en el teléfono. */
export const supabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;

export function normalizeUsername(usuario: string): string {
  return usuario.trim().toLowerCase();
}

export function usernameToEmail(usuario: string): string {
  return `${normalizeUsername(usuario)}@${STUDENT_EMAIL_DOMAIN}`;
}

export type SignInError = 'no-configurado' | 'credenciales' | 'sin-internet' | 'desconocido';

export interface StudentSession {
  userId: string;
  accessToken: string;
  username: string;
  /** Alias guardado por la escuela al crear la cuenta. */
  alias: string | null;
}

export type SignInResult = { ok: true; session: StudentSession } | { ok: false; error: SignInError };

export async function signInWithUsername(usuario: string, password: string): Promise<SignInResult> {
  if (!supabase) return { ok: false, error: 'no-configurado' };
  if (!navigator.onLine) return { ok: false, error: 'sin-internet' };
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(usuario), password });
    if (error) {
      if (isAuthRetryableFetchError(error)) return { ok: false, error: 'sin-internet' };
      if (error.code === 'invalid_credentials' || (isAuthApiError(error) && error.status === 400)) {
        return { ok: false, error: 'credenciales' };
      }
      return { ok: false, error: 'desconocido' };
    }
    if (!data.session) return { ok: false, error: 'desconocido' };
    const alias = data.user.user_metadata?.alias;
    return {
      ok: true,
      session: {
        userId: data.user.id,
        accessToken: data.session.access_token,
        username: normalizeUsername(usuario),
        alias: typeof alias === 'string' && alias.trim() ? alias.trim() : null,
      },
    };
  } catch {
    return { ok: false, error: 'sin-internet' };
  }
}

/** Cierra la sesión solo en este dispositivo; funciona también sin internet. */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut({ scope: 'local' });
}

/** Token vigente (se renueva solo) para llamar a `/api`; `null` si no hay sesión. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { authClient } from './auth';

/**
 * Los alumnos no tienen correo: la escuela les crea un usuario y Supabase lo guarda
 * como `usuario@alumnos.mayamente.app`. Debe coincidir con el dominio del backend.
 */
export const STUDENT_EMAIL_DOMAIN = 'alumnos.mayamente.app';


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
  if (!navigator.onLine) return { ok: false, error: 'sin-internet' };
  try {
    const client = await authClient();
    const email = usuario.includes('@') ? normalizeUsername(usuario) : usernameToEmail(usuario);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
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
  await (await authClient()).auth.signOut({ scope: 'local' });
}

/** Token vigente (se renueva solo) para llamar a `/api`; `null` si no hay sesión. */
export async function getAccessToken(accountId: string): Promise<string | null> {
  const { data } = await (await authClient()).auth.getSession();
  if (data.session?.user.id !== accountId) return null;
  return data.session?.access_token ?? null;
}

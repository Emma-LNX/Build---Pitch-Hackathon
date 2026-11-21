import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: Promise<SupabaseClient> | undefined;
export function authClient() {
  client ??= (async () => {
    let config: { url: string; publishableKey: string };
    try {
      const response = await fetch('/api/auth/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('Configuración no disponible');
      config = await response.json();
      localStorage.setItem('math-portal-auth-config', JSON.stringify(config));
    } catch {
      const cached = localStorage.getItem('math-portal-auth-config');
      if (!cached) throw new Error('No se pudo conectar. Revisa la configuración de Supabase e inténtalo de nuevo.');
      config = JSON.parse(cached);
    }
    return createClient(config.url, config.publishableKey);
  })().catch((error) => { client = undefined; throw error; });
  return client;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(accountId: string, path: string, init: RequestInit = {}): Promise<T> {
  const client = await authClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session || data.session.user.id !== accountId) {
    throw new ApiError(401, 'Inicia sesión de nuevo para sincronizar.');
  }
  const response = await fetch(`/api${path}`, {
    ...init, cache: 'no-store', headers: {
      'Content-Type': 'application/json', ...init.headers,
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new ApiError(response.status, problem.detail ?? `No se pudo guardar (${response.status}).`);
  }
  return response.json();
}

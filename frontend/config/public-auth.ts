import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

type Env = Record<string, string | undefined>;
export interface PublicAuthConfig { url: string; key: string }

/** Solo estos dos valores públicos pueden incorporarse al navegador. */
export function publicAuthFrom(root: Env, local: Env): PublicAuthConfig {
  return {
    url: (local.VITE_SUPABASE_URL || root.VITE_SUPABASE_URL || root.SUPABASE_URL || '').trim().replace(/\/$/, ''),
    key: (local.VITE_SUPABASE_PUBLISHABLE_KEY || local.VITE_SUPABASE_ANON_KEY ||
      root.VITE_SUPABASE_PUBLISHABLE_KEY || root.VITE_SUPABASE_ANON_KEY ||
      root.SUPABASE_PUBLISHABLE_KEY || root.SUPABASE_ANON_KEY || '').trim(),
  };
}

export function publicAuthIssues(config: PublicAuthConfig): string[] {
  const issues: string[] = [];
  try {
    const url = new URL(config.url);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      issues.push('SUPABASE_URL debe usar HTTPS (HTTP solo para localhost).');
    }
  } catch { issues.push('Falta una SUPABASE_URL válida.'); }
  if (!config.key) issues.push('Falta SUPABASE_PUBLISHABLE_KEY o SUPABASE_ANON_KEY: las credenciales PostgreSQL no reemplazan la clave pública de Auth.');
  else if (!config.key.startsWith('sb_publishable_')) {
    try {
      const role = JSON.parse(Buffer.from(config.key.split('.')[1], 'base64url').toString()).role;
      if (role !== 'anon') issues.push('La clave del frontend debe ser pública (publishable o JWT anon).');
    } catch { issues.push('La clave pública no tiene formato publishable ni JWT anon.'); }
  }
  return issues;
}

export function loadPublicAuth(mode: string): PublicAuthConfig {
  const frontend = fileURLToPath(new URL('..', import.meta.url));
  return publicAuthFrom(loadEnv(mode, resolve(frontend, '..'), ''), loadEnv(mode, frontend, 'VITE_'));
}

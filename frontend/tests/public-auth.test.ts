import { describe, expect, it } from 'vitest';
import { publicAuthFrom, publicAuthIssues } from '../config/public-auth';

describe('configuración pública para publicar', () => {
  it('lee las variables públicas del .env raíz sin incluir credenciales privadas', () => {
    const config = publicAuthFrom({ SUPABASE_URL: 'https://project.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      SUPABASE_DB_PASSWORD: 'private-password', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_private' }, {});
    expect(config).toEqual({ url: 'https://project.supabase.co', key: 'sb_publishable_test' });
    expect(JSON.stringify(config)).not.toContain('private');
    expect(publicAuthIssues(config)).toEqual([]);
  });
  it('las entradas vacías del frontend no ocultan la clave configurada en la raíz', () => {
    expect(publicAuthFrom({ SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
      { VITE_SUPABASE_PUBLISHABLE_KEY: '' }).key).toBe('sb_publishable_test');
  });
  it('rechaza credenciales de base de datos o claves secretas como clave del navegador', () => {
    expect(publicAuthIssues({ url: 'https://project.supabase.co', key: 'sb_secret_private' })).not.toEqual([]);
    expect(publicAuthIssues({ url: 'https://project.supabase.co', key: 'database-password' })).not.toEqual([]);
    expect(publicAuthFrom({ SUPABASE_DB_PASSWORD: 'database-password' }, {}).key).toBe('');
  });
  it('admite la clave JWT anon existente y rechaza una clave service_role', () => {
    const jwt = (role: string) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
    expect(publicAuthIssues({ url: 'https://project.supabase.co', key: jwt('anon') })).toEqual([]);
    expect(publicAuthIssues({ url: 'https://project.supabase.co', key: jwt('service_role') })).not.toEqual([]);
  });
});

import { resolveConfig } from 'vite';

const config = await resolveConfig({ logLevel: 'silent' }, 'build', 'production');
const url = JSON.parse(config.define['import.meta.env.VITE_SUPABASE_URL']);
const key = JSON.parse(config.define['import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY']);
let validUrl = false;
try {
  const parsed = new URL(url);
  validUrl = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname));
} catch { /* Se informa sin imprimir valores. */ }
console.log(`URL pública de Supabase: ${validUrl ? 'configurada' : 'falta o no es válida'}`);
console.log(`Clave pública de Supabase Auth: ${key ? 'configurada' : 'falta'}`);
if (!validUrl || !key) {
  console.error('Completa SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY (o SUPABASE_ANON_KEY) en el .env raíz. No uses la contraseña PostgreSQL ni service_role en el frontend.');
  process.exitCode = 1;
} else console.log('Configuración pública lista para compilar. No se han mostrado claves.');

import { test, expect } from '@playwright/test';

// Auth y API aislados: nunca crean alumnos ni respuestas personales en Supabase.
test('links accounts, saves through the API, and preserves offline ownership and date', async ({ page, context }) => {
  const users: Record<string, string> = {
    'a@example.test': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'b@example.test': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'b.escolar@alumnos.mayamente.app': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  };
  const profiles = new Map<string, Record<string, unknown>>();
  const entries = new Map<string, Record<string, unknown>>();
  const posts: { owner: string; date: string }[] = [];
  let unauthorized = false;
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
  let serverDate = date;
  const jwt = (id: string) => `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url')}.test`;
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  await page.addInitScript(() => {
    if (sessionStorage.getItem('merge-fixture')) return;
    sessionStorage.setItem('merge-fixture', 'ready');
    const request = indexedDB.open('math-portal:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('meta');
      db.createObjectStore('lessons', { keyPath: 'lessonId' });
      db.createObjectStore('skills', { keyPath: 'skill' });
      db.createObjectStore('outbox', { keyPath: 'id' });
      db.createObjectStore('dailyCheckIns', { keyPath: ['studentId', 'date'] });
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ xp: 123, streak: 0, lastActiveDay: null }, 'stats');
      tx.oncomplete = () => db.close();
    };
  });
  await page.route('https://auth.example.test/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (request.url().includes('/logout')) return route.fulfill({ status: 204, headers: cors });
    const body = request.postDataJSON();
    const id = users[body.email];
    if (!id) return route.fulfill({ status: 400, json: { msg: 'Invalid credentials' }, headers: cors });
    return route.fulfill({ headers: cors, json: {
      access_token: jwt(id), refresh_token: `refresh-${id}`, token_type: 'bearer', expires_in: 86400,
      user: { id, email: body.email, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    } });
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/config') return route.fulfill({ json: { url: 'https://auth.example.test', publishableKey: 'sb_publishable_test' } });
    const authorization = request.headers().authorization;
    expect(authorization).toMatch(/^Bearer /);
    const owner = JSON.parse(Buffer.from(authorization!.split('.')[1], 'base64url').toString()).sub as string;
    expect(Object.values(users)).toContain(owner);
    if (unauthorized) return route.fulfill({ status: 401, json: { detail: 'Sesión vencida' } });
    if (path === '/api/students/me') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        profiles.set(owner, { id: owner, alias: body.alias, schoolGrade: body.schoolGrade, timeZone: 'America/Guatemala' });
      }
      return profiles.has(owner) ? route.fulfill({ json: profiles.get(owner) }) : route.fulfill({ status: 404, json: {} });
    }
    if (path.endsWith('/daily-check-in/sync')) {
      const body = request.postDataJSON();
      posts.push({ owner, date: body.date });
      const key = `${owner}:${body.date}`;
      if (!entries.has(key)) entries.set(key, { date: body.date, ...body.answers, timeZone: 'America/Guatemala', createdAt: new Date().toISOString() });
      return route.fulfill({ json: entries.get(key) });
    }
    if (path.endsWith('/daily-check-in')) return route.fulfill({ json: {
      date: serverDate, required: !entries.has(`${owner}:${serverDate}`), checkIn: entries.get(`${owner}:${serverDate}`) ?? null,
    } });
    return route.fulfill({ status: 404, json: {} });
  });
  const login = async (email: string) => {
    await page.getByLabel('Usuario o correo', { exact: true }).fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill('Test-only-password-123!');
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  };
  const setup = async (name: string) => {
    await page.getByLabel('¿Cómo te llamas?').fill(name);
    await page.getByRole('button', { name: '¡Empezar la aventura!' }).click();
    await expect(page.getByLabel('¿Cómo te llamas?')).toHaveCount(0);
  };
  const answer = async () => {
    await page.getByLabel(/Cuántas horas/).selectOption('8');
    await page.getByLabel(/Cómo has comido/).selectOption('SUFICIENTE');
    await page.getByLabel('Feliz', { exact: true }).check();
    await page.getByRole('button', { name: 'Guardar y comenzar' }).click();
    await expect(page.locator('.question-prompt')).toBeVisible();
  };
  await page.goto('/'); await login('a@example.test'); await setup('Alumna A');
  const upgraded = await page.evaluate(async () => {
    // @ts-expect-error Vite resuelve el módulo de la aplicación en el navegador.
    const { getDB } = await import('/src/offline/storage/db.ts');
    const db = await getDB('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    return { version: db.version, xp: (await db.get('meta', 'stats')).xp,
      stores: Array.from(db.objectStoreNames) };
  });
  expect(upgraded).toMatchObject({ version: 3, xp: 123 });
  expect(upgraded.stores).toEqual(expect.arrayContaining(['answers', 'mastery', 'dailyCheckIns']));
  await page.goto('/leccion/tikal-1'); await answer();
  expect(entries.size).toBe(1);
  expect(posts[0]).toEqual({ owner: users['a@example.test'], date });
  await page.reload(); await expect(page.locator('.question-prompt')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login('B.Escolar'); await setup('Alumno B');
  await page.goto('/leccion/tikal-1'); await expect(page.getByRole('heading', { name: '¿Cómo estás hoy?' })).toBeVisible();
  await context.setOffline(true); await answer();
  expect(entries.size).toBe(1);
  await expect(page.getByRole('complementary', { name: 'Sincronización de respuestas' }).getByRole('status')).toContainText('1 registro pendiente');
  const tomorrow = new Date(`${date}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  serverDate = tomorrow.toISOString().slice(0, 10);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => entries.size).toBe(2);
  expect(posts.at(-1)).toEqual({ owner: users['b@example.test'], date });
  await expect(page.getByRole('complementary', { name: 'Sincronización de respuestas' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login('a@example.test'); await page.goto('/leccion/tikal-1');
  await expect(page.getByRole('heading', { name: '¿Cómo estás hoy?' })).toBeVisible();
  for (const path of ['/diagnostico', '/mision', '/leccion/tikal-1']) {
    await page.goto(path);
    await expect(page.getByLabel(/Cuántas horas/)).toBeVisible();
    await expect(page.locator('.question-prompt')).toHaveCount(0);
  }
  await page.getByLabel(/Cuántas horas/).selectOption('8');
  await page.getByLabel(/Cómo has comido/).selectOption('SUFICIENTE');
  await page.getByLabel('Feliz', { exact: true }).check();
  unauthorized = true;
  await page.getByRole('button', { name: 'Guardar y comenzar' }).click();
  await expect(page.getByRole('alert')).toContainText('Sesión vencida');
  await expect(page.locator('.question-prompt')).toHaveCount(0);
});

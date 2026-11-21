import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffApp } from '../src/features/staff/StaffApp';

vi.mock('../src/features/staff/supabaseAuth', async (original) => ({
  ...await original<typeof import('../src/features/staff/supabaseAuth')>(),
  authConfigured: true,
  signIn: vi.fn(async () => ({
    accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt: Date.now() + 3600_000,
    user: { id: 'staff', email: 'staff@example.test', emailConfirmed: true },
  })),
  refreshSession: vi.fn(async () => ({
    accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt: Date.now() + 3600_000,
    user: { id: 'staff', email: 'staff@example.test', emailConfirmed: true },
  })),
}));

type School = { id: string; name: string; role: string };
let schools: School[];
let director: boolean;
let sent: { path: string; method: string; body: unknown }[];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem('mayamente.staff.refresh', 'stored');
  history.replaceState(null, '', '/profe');
  schools = [];
  director = false;
  sent = [];
  vi.stubGlobal('fetch', vi.fn(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    sent.push({ path, method, body });
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-access');
    if (path === '/api/schools' && method === 'GET') return json(schools);
    if (path === '/api/directors/me') return director
      ? json({ userId: 'staff', name: 'Dirección', email: 'staff@example.test' }) : json({}, 404);
    if (path === '/api/schools' && method === 'POST') {
      const school = { id: 'new-school', name: body.name, role: 'DIRECTOR' };
      schools = [...schools, school];
      return json(school, 201);
    }
    if (path.endsWith('/statistics')) return json({ professors: 1, students: 0, courses: 1, topics: 0, classrooms: 0 });
    if (path.endsWith('/courses') && method === 'POST') return json({ id: 'created-course', schoolId: 'school', name: body.name }, 201);
    if (path.endsWith('/courses')) return json([{ id: 'course', schoolId: 'school', name: 'Matemática' }]);
    if (path === '/api/schools/school/members' && method === 'POST') return json({ userId: 'teacher', email: body.email, role: body.role }, 201);
    if (path === '/api/schools/school/members') return json([{ userId: 'teacher', email: 'teacher@example.test', role: 'PROFESOR' }]);
    if (path === '/api/schools/school/courses/course/members') return json([]);
    if (path === '/api/schools/school/courses/course/members/teacher' && method === 'PUT') return new Response(null, { status: 204 });
    if (path.endsWith('/teachers/me')) return json({ userId: 'staff', schoolId: 'school', email: 'staff@example.test', classrooms: [] });
    if (path === '/api/teacher/classes') return json([{ schoolId: 'school', schoolName: 'Mi escuela', courseId: 'course', courseName: 'Matemática' }]);
    if (path === '/api/teacher/classes/course/students' && method === 'POST') {
      return json({ userId: 'student', displayName: body.displayName, username: body.username, courseId: 'course', createdAt: new Date().toISOString(), passwordResetAt: null }, 201);
    }
    if (path === '/api/teacher/classes/course/students') return json([]);
    if (path.endsWith('/topics') && method === 'GET') return json([]);
    if (path.endsWith('/topics') && method === 'POST') return json({ id: 'topic', ...body }, 201);
    throw new Error(`Unexpected endpoint: ${method} ${path}`);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function open(path = '/profe') {
  return render(<StrictMode><MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/profe/*" element={<StaffApp />} /></Routes>
  </MemoryRouter></StrictMode>);
}

describe('recorridos de los paneles con contratos HTTP', () => {
  it('el formulario de correo abre el panel del profesor después del acceso', async () => {
    sessionStorage.clear();
    schools = [{ id: 'school', name: 'Mi escuela', role: 'PROFESOR' }];
    open();
    fireEvent.change(await screen.findByLabelText('Correo'), { target: { value: 'staff@example.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('button', { name: 'Matemática' });
    expect(sessionStorage.getItem('mayamente.staff.refresh')).toBe('test-refresh');
  });

  it('varios roles requieren elegir contexto antes de cargar datos de un colegio', async () => {
    director = true;
    schools = [
      { id: 'school', name: 'Escuela docente', role: 'PROFESOR' },
      { id: 'other', name: 'Escuela de dirección', role: 'DIRECTOR' },
    ];
    open();
    await screen.findByRole('heading', { name: '¿Dónde vas a trabajar?' });
    expect(sent.every((r) => r.path === '/api/schools' || r.path === '/api/directors/me')).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: /Profesor Escuela docente/ }));
    await screen.findByRole('button', { name: 'Matemática' });
    expect(sent.some((r) => r.path.includes('/other/'))).toBe(false);
  });

  it('añadir un profesor utiliza su correo y el rol permitido por la API', async () => {
    director = true;
    schools = [{ id: 'school', name: 'Mi escuela', role: 'DIRECTOR' }];
    open('/profe/director/school/integrantes');
    fireEvent.change(await screen.findByLabelText('Correo de la cuenta'), { target: { value: 'new@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir al colegio' }));
    await screen.findByText('new@example.test ahora es profesor del colegio.');
    expect(sent.find((r) => r.method === 'POST')).toEqual({
      path: '/api/schools/school/members', method: 'POST', body: { email: 'new@example.test', role: 'PROFESOR' },
    });
  });

  it('asignar un profesor al curso utiliza PUT sin cuerpo y acepta 204', async () => {
    director = true;
    schools = [{ id: 'school', name: 'Mi escuela', role: 'DIRECTOR' }];
    open('/profe/director/school/cursos');
    fireEvent.click(await screen.findByRole('button', { name: /Matemática Ver integrantes/ }));
    const heading = await screen.findByRole('heading', { name: 'Integrantes de Matemática' });
    const section = within(heading.closest('section')!);
    await section.findByRole('option', { name: 'teacher@example.test · Profesor' });
    fireEvent.change(section.getByRole('combobox'), { target: { value: 'teacher' } });
    fireEvent.click(section.getByRole('button', { name: 'Asignar al curso' }));
    await screen.findByText('teacher@example.test quedó asignada a Matemática.');
    expect(sent.find((r) => r.method === 'PUT')).toEqual({
      path: '/api/schools/school/courses/course/members/teacher', method: 'PUT', body: undefined,
    });
  });

  it('un director sin colegios crea uno y entra al contexto confirmado por el servidor', async () => {
    director = true;
    open();
    fireEvent.click(await screen.findByRole('link', { name: 'Crear mi primer colegio' }));
    fireEvent.change(screen.getByLabelText('Nombre del colegio'), { target: { value: 'Escuela nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear colegio' }));
    await screen.findByRole('heading', { name: 'Datos administrativos' });
    expect(screen.getByText('Escuela nueva')).toBeTruthy();
    expect(sent.filter((r) => r.method === 'POST')).toEqual([
      { path: '/api/schools', method: 'POST', body: { name: 'Escuela nueva' } },
    ]);
  });

  it('el profesor ve sus cursos y no activa automáticamente un perfil de director', async () => {
    schools = [{ id: 'school', name: 'Mi escuela', role: 'PROFESOR' }];
    open();
    await screen.findByRole('heading', { name: 'Tus cursos' });
    expect(await screen.findByRole('button', { name: 'Matemática' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Integrantes' })).toBeNull();
    expect(sent.some((r) => r.method === 'POST')).toBe(false);
  });

  it('crear un estudiante envía el contrato real y permite descartar sus credenciales', async () => {
    schools = [{ id: 'school', name: 'Mi escuela', role: 'PROFESOR' }];
    open('/profe/profesor/school/estudiantes');
    await screen.findByRole('heading', { name: 'Crear cuenta de estudiante' });
    fireEvent.change(screen.getByLabelText('Nombre del estudiante'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'ana.4b' } });
    fireEvent.change(screen.getByLabelText('Contraseña inicial'), { target: { value: 'ceiba123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await screen.findByRole('heading', { name: /Cuenta creada.*Ana/ });
    expect(sent.find((r) => r.method === 'POST')).toEqual({
      path: '/api/teacher/classes/course/students', method: 'POST',
      body: { displayName: 'Ana', username: 'ana.4b', password: 'ceiba123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByText('ceiba123')).toBeNull();
    expect(JSON.stringify(sessionStorage)).not.toContain('ceiba123');
  });

  it('publicar un tema envía únicamente title y content al curso seleccionado', async () => {
    schools = [{ id: 'school', name: 'Mi escuela', role: 'PROFESOR' }];
    open('/profe/profesor/school/temas');
    await screen.findByRole('heading', { name: 'Publicar tema en Matemática' });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Fracciones' } });
    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'Dividir en partes iguales.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar tema' }));
    await screen.findByText('Tema “Fracciones” publicado en Matemática.');
    expect(sent.find((r) => r.method === 'POST')).toEqual({
      path: '/api/schools/school/courses/course/topics', method: 'POST',
      body: { title: 'Fracciones', content: 'Dividir en partes iguales.' },
    });
  });

  it('un director no obtiene el formulario de publicación de temas', async () => {
    director = true;
    schools = [{ id: 'school', name: 'Mi escuela', role: 'DIRECTOR' }];
    open('/profe/director/school/temas');
    await screen.findByText('Este curso aún no tiene temas.');
    expect(screen.queryByRole('button', { name: 'Publicar tema' })).toBeNull();
  });

  it('rechaza una ruta docente de un colegio ajeno sin consultar sus datos', async () => {
    schools = [{ id: 'school', name: 'Mi escuela', role: 'PROFESOR' }];
    open('/profe/profesor/foreign/estudiantes');
    await screen.findByRole('heading', { name: 'Tus cursos' });
    await waitFor(() => expect(sent.some((r) => r.path.includes('foreign'))).toBe(false));
  });
});

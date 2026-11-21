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
const ROOM = {
  id: 'room', schoolId: 'school', grade: 'Cuarto primaria', section: 'A', academicYear: 2026, teacherId: 'staff',
  studentCount: 1, createdAt: '2026-01-10T00:00:00Z', updatedAt: '2026-01-10T00:00:00Z',
};
const LEARNING = {
  classroomId: 'room',
  alumnos: [{
    studentId: 'ana', alias: 'Ana López', usuario: 'ana.lopez', respuestas: 10, correctas: 7, ultimaRespuesta: '2026-03-02T15:00:00Z',
    categorias: [
      { categoria: 'fracciones', puntaje: 35, nivel: 'Semilla', respuestas: 4, correctas: 1, tiempoPromedioMs: 9000 },
      { categoria: 'suma-resta', puntaje: 80, nivel: 'Elote', respuestas: 6, correctas: 6, tiempoPromedioMs: 4000 },
    ],
    errores: [], recomendadas: ['fracciones', 'suma-resta'],
  }],
  categorias: [
    { categoria: 'fracciones', puntajePromedio: 35, alumnosConDatos: 1, alumnosConDificultad: 1 },
    { categoria: 'suma-resta', puntajePromedio: 80, alumnosConDatos: 1, alumnosConDificultad: 0 },
  ],
};
let schools: School[];
let rooms: typeof ROOM[];
let director: boolean;
let sent: { path: string; method: string; body: unknown }[];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem('mayamente.staff.refresh', 'stored');
  history.replaceState(null, '', '/profe');
  schools = [];
  rooms = [ROOM];
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
    if (path.endsWith('/teachers/me')) return json({ userId: 'staff', schoolId: 'school', email: 'staff@example.test', classrooms: rooms });
    if (path === '/api/schools/school/classrooms' && method === 'POST') {
      const room = { ...ROOM, id: 'new-room', grade: body.grade, section: body.section, academicYear: body.academicYear };
      rooms = [...rooms, room];
      return json(room, 201);
    }
    if (path === '/api/schools/school/classrooms') return json(rooms);
    if (path === '/api/schools/school/classrooms/room/student-accounts' && method === 'POST') {
      return json({ studentId: 'student', username: body.username, alias: body.alias, classroomId: 'room' }, 201);
    }
    if (path === '/api/estadisticas/profesor/aulas/room') return json(LEARNING);
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
    await screen.findByText('Cuarto primaria A · 2026');
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
    await screen.findByText('Cuarto primaria A · 2026');
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

  it('el profesor ve sus aulas y no activa automáticamente un perfil de director', async () => {
    schools = [{ id: 'school', name: 'Mi escuela', role: 'PROFESOR' }];
    open();
    await screen.findByRole('heading', { name: 'Tus aulas' });
    expect(await screen.findByText('Cuarto primaria A · 2026')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Integrantes' })).toBeNull();
    expect(sent.some((r) => r.method === 'POST')).toBe(false);
  });

  it('el profesor crea su propia aula', async () => {
    schools = [{ id: 'school', name: 'Mi escuela', role: 'PROFESOR' }];
    open();
    await screen.findByRole('heading', { name: 'Tus aulas' });
    fireEvent.change(screen.getByLabelText('Sección'), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear aula' }));
    const year = new Date().getFullYear();
    await screen.findByText(`Aula Cuarto primaria B · ${year} creada. Ahora agrega a tus alumnos.`);
    expect(sent.find((r) => r.method === 'POST')).toEqual({
      path: '/api/schools/school/classrooms', method: 'POST',
      body: { grade: 'Cuarto primaria', section: 'B', academicYear: year, teacherId: 'staff' },
    });
  });

  it('crear un alumno lo inscribe en el aula y permite descartar sus credenciales', async () => {
    schools = [{ id: 'school', name: 'Mi escuela', role: 'PROFESOR' }];
    open('/profe/profesor/school/alumnos');
    await screen.findByRole('heading', { name: 'Crear cuenta de alumno' });
    fireEvent.change(screen.getByLabelText('Nombre del alumno'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'ana.4b' } });
    fireEvent.change(screen.getByLabelText('Contraseña inicial'), { target: { value: 'ceiba123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await screen.findByRole('heading', { name: /Cuenta creada.*Ana/ });
    expect(sent.find((r) => r.method === 'POST')).toEqual({
      path: '/api/schools/school/classrooms/room/student-accounts', method: 'POST',
      body: { username: 'ana.4b', password: 'ceiba123', alias: 'Ana' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByText('ceiba123')).toBeNull();
    expect(JSON.stringify(sessionStorage)).not.toContain('ceiba123');
  });

  it('el profesor ve el nivel de cada alumno por tema y qué le conviene practicar', async () => {
    schools = [{ id: 'school', name: 'Mi escuela', role: 'PROFESOR' }];
    open('/profe/profesor/school/estadisticas');
    await screen.findByText('Ana López');
    expect(screen.getByText('1 alumno necesita apoyo')).toBeTruthy();
    expect(screen.getByText('Semilla · 35')).toBeTruthy();
    expect(screen.getByText('Le conviene practicar:')).toBeTruthy();
  });

  it('el director ve las estadísticas de las aulas de su colegio', async () => {
    director = true;
    schools = [{ id: 'school', name: 'Mi escuela', role: 'DIRECTOR' }];
    open('/profe/director/school/aulas');
    await screen.findByText('Ana López');
    expect(sent.some((r) => r.path === '/api/estadisticas/profesor/aulas/room')).toBe(true);
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
    open('/profe/profesor/foreign/alumnos');
    await screen.findByRole('heading', { name: 'Tus aulas' });
    await waitFor(() => expect(sent.some((r) => r.path.includes('foreign'))).toBe(false));
  });
});

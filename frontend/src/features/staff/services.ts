/**
 * Servicios tipados de la API para profesores y directores.
 * Cada función corresponde a un endpoint real del backend (ver docs/rbac.md,
 * docs/directors.md, docs/teachers.md, docs/classrooms.md y docs/cuentas-estudiantes.md).
 * Los tipos reflejan los DTO de Java; no se agregan campos inventados.
 */
import type { RequestOptions } from '../../lib/api';

export type Call = <T>(path: string, options?: Omit<RequestOptions, 'token' | 'auth'>) => Promise<T>;

/* ---------- DTO ---------- */

export type SchoolRole = 'DIRECTOR' | 'PROFESOR' | 'ALUMNO';

/** SchoolView */
export interface School {
  id: string;
  name: string;
  role: SchoolRole;
}

/** DirectorDtos.DirectorProfile */
export interface DirectorProfile {
  userId: string;
  name: string;
  email: string;
}

/** DirectorDtos.Member */
export interface Member {
  userId: string;
  email: string | null;
  role: SchoolRole;
}

/** DirectorDtos.Statistics: conteos administrativos actuales */
export interface SchoolStatistics {
  professors: number;
  students: number;
  courses: number;
  topics: number;
  classrooms: number;
}

/** CourseView */
export interface Course {
  id: string;
  schoolId: string;
  name: string;
}

/** TopicView */
export interface Topic {
  id: string;
  schoolId: string;
  courseId: string;
  title: string;
  content: string;
  createdBy: string;
}

/** Límites de CreateTopicRequest */
export const TOPIC_LIMITS = { title: 160, content: 20000 } as const;
/** Límites de NameRequest y RegisterDirector */
export const NAME_LIMITS = { school: 160, course: 160, director: 100 } as const;

/** ClassroomDtos.ClassroomView */
export interface Classroom {
  id: string;
  schoolId: string;
  grade: string;
  section: string;
  academicYear: number;
  teacherId: string;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
}

/** ClassroomDtos.StudentView */
export interface ClassroomStudent {
  userId: string;
  email: string | null;
  enrolledAt: string;
}

/** TeacherDtos.Teacher */
export interface TeacherProfile {
  userId: string;
  schoolId: string;
  email: string;
  classrooms: Classroom[];
}

/** TeacherDtos.Statistics */
export interface PracticeStatistics {
  attempts: number;
  passedAttempts: number;
  passPercentage: number;
  averageScore: number;
  completedActivities: number;
}

/** TeacherDtos.TopicStatistics (temas del catálogo global de práctica) */
export interface PracticeTopicStatistics {
  topicId: string;
  name: string;
  attempts: number;
  passedAttempts: number;
  passPercentage: number;
  averageScore: number;
  lastAttemptAt: string | null;
  difficult: boolean;
}

/** TeacherDtos.ClassroomStatistics */
export interface ClassroomStatistics {
  classroomId: string;
  students: number;
  activeStudents: number;
  statistics: PracticeStatistics;
  topics: PracticeTopicStatistics[];
}

/** TeacherDtos.StudentProgress */
export interface StudentProgress {
  studentId: string;
  alias: string;
  statistics: PracticeStatistics;
  topics: PracticeTopicStatistics[];
}

/** Módulo de cuentas: AccountDtos.TeacherClass */
export interface AccountClass {
  schoolId: string;
  schoolName: string;
  courseId: string;
  courseName: string;
}

/** Módulo de cuentas: AccountDtos.StudentAccount (nunca incluye la contraseña) */
export interface StudentAccount {
  userId: string;
  displayName: string;
  username: string;
  courseId: string;
  createdAt: string;
  passwordResetAt: string | null;
}

/* ---------- Endpoints ---------- */

/** AprendizajeDtos.Categoria: nivel del alumno en una categoría del CNB */
export interface LearningCategory {
  categoria: string;
  puntaje: number;
  nivel: string;
  respuestas: number;
  correctas: number;
  tiempoPromedioMs: number;
}

/** AprendizajeDtos.AlumnoAula */
export interface LearningStudent {
  studentId: string;
  alias: string;
  usuario: string | null;
  respuestas: number;
  correctas: number;
  ultimaRespuesta: string | null;
  categorias: LearningCategory[];
  errores: { error: string; veces: number }[];
  recomendadas: string[];
}

/** AprendizajeDtos.Aula */
export interface ClassroomLearning {
  classroomId: string;
  alumnos: LearningStudent[];
  categorias: { categoria: string; puntajePromedio: number; alumnosConDatos: number; alumnosConDificultad: number }[];
}

const enc = encodeURIComponent;
const S = (school: string) => `/schools/${enc(school)}`;

export const schoolsApi = {
  /** GET /schools: colegios propios con el rol del usuario */
  list: (call: Call, signal?: AbortSignal) => call<School[]>('/schools', { signal }),
  /** POST /schools {name} → 201 SchoolView (solo director activo) */
  create: (call: Call, name: string) => call<School>('/schools', { method: 'POST', body: { name } }),
  /** GET /schools/{s}/statistics (dueño del colegio) */
  statistics: (call: Call, school: string, signal?: AbortSignal) =>
    call<SchoolStatistics>(`${S(school)}/statistics`, { signal }),
};

export const directorsApi = {
  /** GET /directors/me: 404 sin perfil; 403 correo sin confirmar */
  me: (call: Call, signal?: AbortSignal) => call<DirectorProfile>('/directors/me', { signal }),
  /** POST /directors/register {name} (idempotente; requiere correo confirmado) */
  register: (call: Call, name: string) => call<DirectorProfile>('/directors/register', { method: 'POST', body: { name } }),
};

export const membersApi = {
  list: (call: Call, school: string, signal?: AbortSignal) => call<Member[]>(`${S(school)}/members`, { signal }),
  /** POST {email, role: PROFESOR|ALUMNO}: la cuenta debe existir y tener el correo confirmado */
  add: (call: Call, school: string, email: string, role: 'PROFESOR' | 'ALUMNO') =>
    call<Member>(`${S(school)}/members`, { method: 'POST', body: { email, role } }),
  remove: (call: Call, school: string, user: string) =>
    call<void>(`${S(school)}/members/${enc(user)}`, { method: 'DELETE' }),
};

export const coursesApi = {
  /** GET /schools/{s}/courses: todos (director) o solo los asignados (profesor) */
  list: (call: Call, school: string, signal?: AbortSignal) => call<Course[]>(`${S(school)}/courses`, { signal }),
  create: (call: Call, school: string, name: string) =>
    call<Course>(`${S(school)}/courses`, { method: 'POST', body: { name } }),
  /** Elimina el curso, sus temas y asignaciones */
  remove: (call: Call, school: string, course: string) =>
    call<void>(`${S(school)}/courses/${enc(course)}`, { method: 'DELETE' }),
  members: (call: Call, school: string, course: string, signal?: AbortSignal) =>
    call<Member[]>(`${S(school)}/courses/${enc(course)}/members`, { signal }),
  /** PUT sin cuerpo: el rol se deriva de la membresía escolar */
  assign: (call: Call, school: string, course: string, user: string) =>
    call<void>(`${S(school)}/courses/${enc(course)}/members/${enc(user)}`, { method: 'PUT' }),
  unassign: (call: Call, school: string, course: string, user: string) =>
    call<void>(`${S(school)}/courses/${enc(course)}/members/${enc(user)}`, { method: 'DELETE' }),
};

export const topicsApi = {
  list: (call: Call, school: string, course: string, signal?: AbortSignal) =>
    call<Topic[]>(`${S(school)}/courses/${enc(course)}/topics`, { signal }),
  /** Solo el profesor asignado al curso (403 en otro caso) */
  create: (call: Call, school: string, course: string, title: string, content: string) =>
    call<Topic>(`${S(school)}/courses/${enc(course)}/topics`, { method: 'POST', body: { title, content } }),
};

export const teacherApi = {
  /** GET /schools/{s}/teachers/me: 404 si no es PROFESOR de ese colegio */
  me: (call: Call, school: string, signal?: AbortSignal) => call<TeacherProfile>(`${S(school)}/teachers/me`, { signal }),
  classroomStatistics: (call: Call, school: string, classroom: string, signal?: AbortSignal) =>
    call<ClassroomStatistics>(`${S(school)}/classrooms/${enc(classroom)}/statistics`, { signal }),
  classroomStudents: (call: Call, school: string, classroom: string, signal?: AbortSignal) =>
    call<ClassroomStudent[]>(`${S(school)}/classrooms/${enc(classroom)}/students`, { signal }),
  studentProgress: (call: Call, school: string, classroom: string, student: string, signal?: AbortSignal) =>
    call<StudentProgress>(`${S(school)}/classrooms/${enc(classroom)}/students/${enc(student)}/progress`, { signal }),
};

/** Aulas y cuentas de alumnos por aula (docs/classrooms.md) y su aprendizaje (docs/aprendizaje-adaptativo.md) */
export const classroomsApi = {
  /** El director lista todas las aulas del colegio; el profesor, las suyas */
  list: (call: Call, school: string, signal?: AbortSignal) => call<Classroom[]>(`${S(school)}/classrooms`, { signal }),
  /** Un profesor solo puede crear su propia aula (teacherId = su cuenta) */
  create: (call: Call, school: string, body: { grade: string; section: string; academicYear: number; teacherId: string }) =>
    call<Classroom>(`${S(school)}/classrooms`, { method: 'POST', body }),
  createStudent: (call: Call, school: string, classroom: string, body: { username: string; password: string; alias: string }) =>
    call<{ studentId: string; username: string; alias: string; classroomId: string }>(
      `${S(school)}/classrooms/${enc(classroom)}/student-accounts`,
      { method: 'POST', body },
    ),
  changePassword: (call: Call, school: string, classroom: string, student: string, password: string) =>
    call<void>(`${S(school)}/classrooms/${enc(classroom)}/student-accounts/${enc(student)}/password`, {
      method: 'PUT',
      body: { password },
    }),
  learning: (call: Call, classroom: string, signal?: AbortSignal) =>
    call<ClassroomLearning>(`/estadisticas/profesor/aulas/${enc(classroom)}`, { signal }),
};

/** Módulo de cuentas de estudiantes (docs/cuentas-estudiantes.md) */
export const accountsApi = {
  classes: (call: Call, signal?: AbortSignal) => call<AccountClass[]>('/teacher/classes', { signal }),
  students: (call: Call, course: string, signal?: AbortSignal) =>
    call<StudentAccount[]>(`/teacher/classes/${enc(course)}/students`, { signal }),
  create: (call: Call, course: string, displayName: string, username: string, password: string) =>
    call<StudentAccount>(`/teacher/classes/${enc(course)}/students`, {
      method: 'POST',
      body: { displayName, username, password },
    }),
  resetPassword: (call: Call, user: string, password: string) =>
    call<void>(`/teacher/students/${enc(user)}/password`, { method: 'PUT', body: { password } }),
  move: (call: Call, user: string, courseId: string) =>
    call<void>(`/teacher/students/${enc(user)}/class`, { method: 'PUT', body: { courseId } }),
};

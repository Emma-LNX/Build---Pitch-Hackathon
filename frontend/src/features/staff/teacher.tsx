import { useCallback, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { BookIcon, ChartIcon, DocIcon, GroupIcon, HomeIcon, PersonIcon } from '../../components/icons';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { StudentAccountsPanel } from '../teacher/TeacherPage';
import { AreaNav, useStaffLogout, type Access } from './StaffApp';
import { useStaffSession } from './StaffSession';
import {
  coursesApi,
  NAME_LIMITS,
  teacherApi,
  type Classroom,
  type PracticeStatistics,
  type PracticeTopicStatistics,
} from './services';
import { TopicsBrowser } from './topics';
import { Empty, ErrorState, errorMessage, fieldErrorsOf, Loading, SuccessNote, TextField, Updated, useRemote } from './ui';

export function TeacherArea({ access, schoolId }: { access: Access; schoolId: string }) {
  const base = `/profe/profesor/${schoolId}`;
  // Curso activo del profesor en este colegio (se limpia al cambiar de colegio: el área se vuelve a montar)
  const [course, setCourse] = useState<string | null>(null);
  const onCourse = useCallback((id: string | null) => setCourse(id), []);
  const items = [
    { to: base, label: 'Inicio', icon: <HomeIcon />, end: true },
    { to: `${base}/cursos`, label: 'Cursos', icon: <BookIcon /> },
    { to: `${base}/estudiantes`, label: 'Estudiantes', icon: <GroupIcon /> },
    { to: `${base}/temas`, label: 'Temas', icon: <DocIcon /> },
    { to: `${base}/aulas`, label: 'Aulas', icon: <ChartIcon /> },
    { to: `${base}/perfil`, label: 'Perfil', icon: <PersonIcon /> },
  ];
  return (
    <div className="staff-body">
      <AreaNav items={items} />
      <main className="staff-main">
        <Routes>
          <Route index element={<TeacherHome schoolId={schoolId} base={base} course={course} onCourse={onCourse} />} />
          <Route path="cursos" element={<TeacherCourses schoolId={schoolId} base={base} course={course} onCourse={onCourse} />} />
          <Route
            path="estudiantes"
            element={
              <div className="staff-page">
                <h1>Estudiantes</h1>
                <StudentAccountsPanel schoolId={schoolId} course={course} onCourseChange={onCourse} />
              </div>
            }
          />
          <Route
            path="temas"
            element={<TopicsBrowser schoolId={schoolId} role="PROFESOR" canPublish={() => true} course={course} onCourseChange={onCourse} />}
          />
          <Route path="aulas" element={<Classrooms schoolId={schoolId} />} />
          <Route path="perfil" element={<TeacherProfileView access={access} schoolId={schoolId} />} />
          <Route path="*" element={<Navigate to={base} replace />} />
        </Routes>
      </main>
    </div>
  );
}

/* ---------- Inicio ---------- */

function TeacherHome({
  schoolId,
  base,
  course,
  onCourse,
}: {
  schoolId: string;
  base: string;
  course: string | null;
  onCourse: (id: string | null) => void;
}) {
  const { call } = useStaffSession();
  const me = useRemote(`teacher-me:${schoolId}`, (signal) => teacherApi.me(call, schoolId, signal));
  const courses = useRemote(`courses:${schoolId}`, (signal) => coursesApi.list(call, schoolId, signal));
  const list = courses.data ?? [];
  const active = list.find((c) => c.id === course) ?? null;

  return (
    <div className="staff-page">
      <h1>Inicio</h1>
      <section className="panel">
        <div className="row-between">
          <h2>Tus cursos</h2>
          <Updated at={courses.updatedAt} />
        </div>
        {courses.loading && !courses.data ? (
          <Loading />
        ) : courses.error && !courses.data ? (
          <ErrorState error={courses.error} onRetry={courses.reload} />
        ) : list.length === 0 ? (
          <Empty title="Aún no tienes cursos en este colegio.">
            <p>
              <Link to={`${base}/cursos`}>Crea tu primer curso</Link> o pide a tu director que te asigne uno.
            </p>
          </Empty>
        ) : (
          <>
            <div className="chip-row" role="group" aria-label="Curso activo">
              {list.map((c) => (
                <button key={c.id} className="chip chip-wide" aria-pressed={c.id === course} onClick={() => onCourse(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
            <p className="hint">{active ? `Curso activo: ${active.name}` : 'Elige un curso para trabajar con él.'}</p>
          </>
        )}
      </section>

      <section className="quick-actions">
        <Link className="action-card" to={`${base}/estudiantes`}>
          <GroupIcon className="action-icon" />
          <span>Cuentas de estudiantes</span>
        </Link>
        <Link className="action-card" to={`${base}/temas`}>
          <DocIcon className="action-icon" />
          <span>Temas del curso</span>
        </Link>
        <Link className="action-card" to={`${base}/aulas`}>
          <ChartIcon className="action-icon" />
          <span>Estadísticas de aulas</span>
        </Link>
      </section>

      <section className="panel">
        <h2>Tus aulas</h2>
        {me.loading && !me.data ? (
          <Loading />
        ) : me.error && !me.data ? (
          <ErrorState error={me.error} onRetry={me.reload} ctx={{ notFound: 'No figuras como profesor de este colegio.' }} />
        ) : (me.data?.classrooms ?? []).length === 0 ? (
          <Empty title="No eres responsable de ninguna aula en este colegio." />
        ) : (
          <ul className="item-list">
            {me.data!.classrooms.map((c) => (
              <li key={c.id} className="item-row">
                <span className="item-text">
                  <strong>{classroomName(c)}</strong>
                  <span className="hint">{c.studentCount === 1 ? '1 estudiante' : `${c.studentCount} estudiantes`}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const classroomName = (c: Classroom) => `${c.grade} ${c.section} · ${c.academicYear}`;

/* ---------- Cursos ---------- */

function TeacherCourses({
  schoolId,
  base,
  course,
  onCourse,
}: {
  schoolId: string;
  base: string;
  course: string | null;
  onCourse: (id: string | null) => void;
}) {
  const { call } = useStaffSession();
  const online = useOnlineStatus();
  const courses = useRemote(`courses:${schoolId}`, (signal) => coursesApi.list(call, schoolId, signal));
  const list = courses.data ?? [];
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const clearSuccess = useCallback(() => setSuccess(null), []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await coursesApi.create(call, schoolId, name.trim());
      setSuccess(`Curso “${created.name}” creado. Ya puedes agregar estudiantes y temas.`);
      setName('');
      onCourse(created.id);
      courses.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="staff-page">
      <h1>Mis cursos</h1>
      <SuccessNote text={success} onDone={clearSuccess} />
      <form className="panel staff-form" onSubmit={create} noValidate>
        <h2>Crear curso</h2>
        <TextField label="Nombre del curso" value={name} onChange={setName} maxLength={NAME_LIMITS.course} error={fieldErrorsOf(error).name} />
        {Boolean(error) && <p className="form-error">{errorMessage(error, { notFound: 'No figuras como profesor de este colegio.' })}</p>}
        <button className="btn btn-primary" disabled={busy || !name.trim() || !online}>
          {busy ? 'Creando…' : 'Crear curso'}
        </button>
      </form>
      <p className="hint">Quedas asignado a los cursos que creas. Eliminar cursos corresponde al director.</p>
      <section className="panel">
        {courses.loading && !courses.data ? (
          <Loading />
        ) : courses.error && !courses.data ? (
          <ErrorState error={courses.error} onRetry={courses.reload} />
        ) : list.length === 0 ? (
          <Empty title="No tienes cursos asignados en este colegio." />
        ) : (
          <ul className="item-list">
            {list.map((c) => (
              <li key={c.id} className={`item-row${c.id === course ? ' item-active' : ''}`}>
                <button className="item-select" aria-pressed={c.id === course} onClick={() => onCourse(c.id)}>
                  <strong>{c.name}</strong>
                  <span className="hint">{c.id === course ? 'Curso activo' : 'Elegir como activo'}</span>
                </button>
                <span className="row-actions">
                  <Link className="btn btn-small btn-secondary" to={`${base}/temas`} onClick={() => onCourse(c.id)}>
                    Temas
                  </Link>
                  <Link className="btn btn-small btn-secondary" to={`${base}/estudiantes`} onClick={() => onCourse(c.id)}>
                    Estudiantes
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Updated at={courses.updatedAt} />
      </section>
    </div>
  );
}

/* ---------- Aulas: estadísticas de práctica (docs/teachers.md) ---------- */

function Classrooms({ schoolId }: { schoolId: string }) {
  const { call } = useStaffSession();
  const me = useRemote(`teacher-me:${schoolId}`, (signal) => teacherApi.me(call, schoolId, signal));
  const [selected, setSelected] = useState<string | null>(null);
  const rooms = me.data?.classrooms ?? [];
  const room = rooms.find((r) => r.id === selected) ?? rooms[0] ?? null;

  return (
    <div className="staff-page">
      <h1>Aulas</h1>
      <p className="hint">
        Resultados de las partidas de práctica guardadas en el servidor. Los temas de esta sección son los del catálogo de práctica,
        no los temas publicados en los cursos.
      </p>
      {me.loading && !me.data ? (
        <Loading />
      ) : me.error && !me.data ? (
        <ErrorState error={me.error} onRetry={me.reload} />
      ) : rooms.length === 0 ? (
        <Empty title="No eres responsable de ninguna aula en este colegio.">
          <p>El director asigna un profesor responsable a cada aula.</p>
        </Empty>
      ) : (
        <>
          {rooms.length > 1 && (
            <div className="chip-row" role="group" aria-label="Aula">
              {rooms.map((r) => (
                <button key={r.id} className="chip chip-wide" aria-pressed={r.id === room?.id} onClick={() => setSelected(r.id)}>
                  {r.grade} {r.section}
                </button>
              ))}
            </div>
          )}
          {room && <ClassroomStats key={room.id} schoolId={schoolId} room={room} />}
        </>
      )}
    </div>
  );
}

function ClassroomStats({ schoolId, room }: { schoolId: string; room: Classroom }) {
  const { call } = useStaffSession();
  const stats = useRemote(`classroom-stats:${room.id}`, (signal) => teacherApi.classroomStatistics(call, schoolId, room.id, signal));
  const students = useRemote(`classroom-students:${room.id}`, (signal) => teacherApi.classroomStudents(call, schoolId, room.id, signal));
  const [student, setStudent] = useState<string>('');

  return (
    <>
      <section className="panel">
        <div className="row-between">
          <h2>Estadísticas de {classroomName(room)}</h2>
          <Updated at={stats.updatedAt} />
        </div>
        {stats.loading && !stats.data ? (
          <Loading />
        ) : stats.error && !stats.data ? (
          <ErrorState error={stats.error} onRetry={stats.reload} ctx={{ notFound: 'Ya no eres responsable de esta aula.' }} />
        ) : (
          stats.data && (
            <>
              <dl className="tiles">
                <div className="tile">
                  <dt>Estudiantes</dt>
                  <dd>{stats.data.students}</dd>
                </div>
                <div className="tile">
                  <dt>Con partidas</dt>
                  <dd>{stats.data.activeStudents}</dd>
                </div>
                <div className="tile">
                  <dt>Partidas</dt>
                  <dd>{stats.data.statistics.attempts}</dd>
                </div>
              </dl>
              {stats.data.statistics.attempts === 0 ? (
                <Empty title="Aún no hay partidas de práctica en esta aula." />
              ) : (
                <>
                  <StatLine s={stats.data.statistics} />
                  <TopicBars topics={stats.data.topics} />
                </>
              )}
            </>
          )
        )}
      </section>

      <section className="panel">
        <h2>Ver estudiante</h2>
        {students.loading && !students.data ? (
          <Loading />
        ) : students.error && !students.data ? (
          <ErrorState error={students.error} onRetry={students.reload} />
        ) : (students.data ?? []).length === 0 ? (
          <Empty title="El aula no tiene estudiantes matriculados." />
        ) : (
          <>
            <label className="inline-select">
              <span>Estudiante</span>
              <select value={student} onChange={(e) => setStudent(e.target.value)}>
                <option value="">Elige un estudiante…</option>
                {students.data!.map((s) => (
                  <option key={s.userId} value={s.userId}>
                    {s.email ?? s.userId}
                  </option>
                ))}
              </select>
            </label>
            {student && <StudentProgressView key={student} schoolId={schoolId} room={room} student={student} />}
          </>
        )}
      </section>
    </>
  );
}

function StudentProgressView({ schoolId, room, student }: { schoolId: string; room: Classroom; student: string }) {
  const { call } = useStaffSession();
  const progress = useRemote(`progress:${room.id}:${student}`, (signal) =>
    teacherApi.studentProgress(call, schoolId, room.id, student, signal),
  );
  if (progress.loading && !progress.data) return <Loading />;
  if (progress.error && !progress.data) {
    return <ErrorState error={progress.error} onRetry={progress.reload} ctx={{ notFound: 'Este estudiante ya no está en el aula.' }} />;
  }
  const p = progress.data!;
  return (
    <div className="student-progress">
      <h3>{p.alias}</h3>
      {p.statistics.attempts === 0 ? <p className="hint">Aún no tiene partidas de práctica.</p> : <StatLine s={p.statistics} />}
      {p.topics.length > 0 && <TopicBars topics={p.topics} />}
    </div>
  );
}

function StatLine({ s }: { s: PracticeStatistics }) {
  return (
    <p className="stat-line">
      <span>
        Aprobadas: <strong>{s.passedAttempts}</strong> de {s.attempts} ({Math.round(s.passPercentage)}%)
      </span>
      <span>
        Puntaje promedio: <strong>{Math.round(Number(s.averageScore))}%</strong>
      </span>
      <span>
        Actividades completadas: <strong>{s.completedActivities}</strong>
      </span>
    </p>
  );
}

/** Barras horizontales por tema: % de partidas aprobadas, con el valor en texto. */
function TopicBars({ topics }: { topics: PracticeTopicStatistics[] }) {
  return (
    <ul className="bars" aria-label="Partidas aprobadas por tema">
      {topics.map((t) => (
        <li key={t.topicId} className="bar-row">
          <span className="bar-label">
            {t.name}
            {t.difficult && <span className="tag tag-warn">Marcado como difícil</span>}
          </span>
          <span className="bar-track" aria-hidden="true">
            <span className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, t.passPercentage))}%` }} />
          </span>
          <span className="bar-value">
            {Math.round(t.passPercentage)}% · {t.passedAttempts}/{t.attempts}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Perfil ---------- */

function TeacherProfileView({ access, schoolId }: { access: Access; schoolId: string }) {
  const { call, session } = useStaffSession();
  const logout = useStaffLogout();
  const me = useRemote(`teacher-me:${schoolId}`, (signal) => teacherApi.me(call, schoolId, signal));
  const courses = useRemote(`courses:${schoolId}`, (signal) => coursesApi.list(call, schoolId, signal));
  const roleName = (r: string) => (r === 'DIRECTOR' ? 'Director' : r === 'PROFESOR' ? 'Profesor' : 'Estudiante');
  return (
    <div className="staff-page">
      <h1>Perfil</h1>
      <section className="panel">
        <dl className="profile-data">
          <dt>Correo</dt>
          <dd>{me.data?.email ?? session?.user.email}</dd>
          <dt>Colegios y roles</dt>
          <dd>
            <ul className="plain-list">
              {access.schools.map((s) => (
                <li key={`${s.id}-${s.role}`}>
                  {s.name} · {roleName(s.role)}
                </li>
              ))}
            </ul>
          </dd>
          <dt>Cursos en este colegio</dt>
          <dd>{courses.data ? courses.data.map((c) => c.name).join(', ') || 'Ninguno' : 'Cargando…'}</dd>
          <dt>Aulas a tu cargo</dt>
          <dd>{me.data ? me.data.classrooms.map(classroomName).join(', ') || 'Ninguna' : 'Cargando…'}</dd>
        </dl>
      </section>
      <button className="btn btn-secondary btn-block" onClick={() => void logout()}>
        Cerrar sesión
      </button>
    </div>
  );
}

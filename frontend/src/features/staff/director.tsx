import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { BookIcon, DocIcon, GroupIcon, HomeIcon, PersonIcon, SchoolIcon, TrashIcon } from '../../components/icons';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { AreaNav, NO_SCHOOL_BASE, useStaffLogout, type Access } from './StaffApp';
import { useStaffSession } from './StaffSession';
import {
  coursesApi,
  directorsApi,
  membersApi,
  NAME_LIMITS,
  schoolsApi,
  type Course,
  type Member,
  type School,
} from './services';
import { TopicsBrowser } from './topics';
import {
  ConfirmDialog,
  Empty,
  ErrorState,
  errorMessage,
  fieldErrorsOf,
  Loading,
  SuccessNote,
  TextField,
  Updated,
  useRemote,
} from './ui';

interface Props {
  access: Access;
  /** null: director activo que aún no tiene colegios. */
  schoolId: string | null;
  onAccessChange: () => void;
}

export function DirectorArea({ access, schoolId, onAccessChange }: Props) {
  const base = schoolId ? `/profe/director/${schoolId}` : NO_SCHOOL_BASE;
  const items = [
    { to: base, label: 'Inicio', icon: <HomeIcon />, end: true },
    { to: `${base}/colegios`, label: 'Colegios', icon: <SchoolIcon /> },
    ...(schoolId
      ? [
          { to: `${base}/integrantes`, label: 'Integrantes', icon: <GroupIcon /> },
          { to: `${base}/cursos`, label: 'Cursos', icon: <BookIcon /> },
          { to: `${base}/temas`, label: 'Temas', icon: <DocIcon /> },
        ]
      : []),
    { to: `${base}/perfil`, label: 'Perfil', icon: <PersonIcon /> },
  ];
  return (
    <div className="staff-body">
      <AreaNav items={items} />
      <main className="staff-main">
        <Routes>
          <Route index element={schoolId ? <DirectorHome schoolId={schoolId} access={access} base={base} /> : <NoSchoolYet base={base} />} />
          <Route path="colegios" element={<Schools access={access} current={schoolId} onAccessChange={onAccessChange} />} />
          {schoolId && <Route path="integrantes" element={<Members schoolId={schoolId} />} />}
          {schoolId && <Route path="cursos" element={<Courses schoolId={schoolId} />} />}
          {schoolId && <Route path="temas" element={<TopicsBrowser schoolId={schoolId} canPublish={() => false} role="DIRECTOR" />} />}
          <Route path="perfil" element={<DirectorProfileView access={access} />} />
          <Route path="*" element={<Navigate to={base} replace />} />
        </Routes>
      </main>
    </div>
  );
}

/* ---------- Inicio ---------- */

function DirectorHome({ schoolId, access, base }: { schoolId: string; access: Access; base: string }) {
  const { call } = useStaffSession();
  const navigate = useNavigate();
  const stats = useRemote(`stats:${schoolId}`, (signal) => schoolsApi.statistics(call, schoolId, signal));
  const mine = access.schools.filter((s) => s.role === 'DIRECTOR');

  return (
    <div className="staff-page">
      <div className="page-title-row">
        <h1>Inicio</h1>
        {mine.length > 1 && (
          <label className="inline-select">
            <span>Colegio activo</span>
            <select value={schoolId} onChange={(e) => navigate(`/profe/director/${e.target.value}`)}>
              {mine.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <section className="panel">
        <div className="row-between">
          <h2>Datos administrativos</h2>
          <Updated at={stats.updatedAt} />
        </div>
        <p className="hint">Conteos actuales del colegio. No son métricas de aprendizaje.</p>
        {stats.loading && !stats.data ? (
          <Loading />
        ) : stats.error && !stats.data ? (
          <ErrorState error={stats.error} onRetry={stats.reload} />
        ) : (
          stats.data && (
            <dl className="tiles">
              {(
                [
                  ['Profesores', stats.data.professors],
                  ['Estudiantes', stats.data.students],
                  ['Cursos', stats.data.courses],
                  ['Temas', stats.data.topics],
                  ['Aulas', stats.data.classrooms],
                ] as [string, number][]
              ).map(([label, value]) => (
                <div key={label} className="tile">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )
        )}
      </section>

      {stats.data && (stats.data.professors === 0 || stats.data.courses === 0) && (
        <section className="panel panel-warm">
          <h2>Siguiente paso</h2>
          {stats.data.professors === 0 && (
            <p>
              Añade a tus profesores con el correo de su cuenta. <Link to={`${base}/integrantes`}>Ir a Integrantes</Link>
            </p>
          )}
          {stats.data.courses === 0 && (
            <p>
              Crea el primer curso y asígnale un profesor. <Link to={`${base}/cursos`}>Ir a Cursos</Link>
            </p>
          )}
        </section>
      )}

      <section className="quick-actions">
        <Link className="action-card" to={`${base}/integrantes`}>
          <GroupIcon className="action-icon" />
          <span>Administrar integrantes</span>
        </Link>
        <Link className="action-card" to={`${base}/cursos`}>
          <BookIcon className="action-icon" />
          <span>Administrar cursos</span>
        </Link>
        <Link className="action-card" to={`${base}/temas`}>
          <DocIcon className="action-icon" />
          <span>Ver temas</span>
        </Link>
      </section>
    </div>
  );
}

function NoSchoolYet({ base }: { base: string }) {
  return (
    <div className="staff-page">
      <h1>Inicio</h1>
      <Empty title="Tu perfil de director está activo, pero aún no tienes colegios.">
        <Link className="btn btn-small btn-primary" to={`${base}/colegios`}>
          Crear mi primer colegio
        </Link>
      </Empty>
    </div>
  );
}

/* ---------- Colegios ---------- */

function Schools({ access, current, onAccessChange }: { access: Access; current: string | null; onAccessChange: () => void }) {
  const { call } = useStaffSession();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Se abre el colegio nuevo cuando la lista de acceso del servidor ya lo incluye
  const [created, setCreated] = useState<string | null>(null);
  useEffect(() => {
    if (created && access.schools.some((s) => s.id === created && s.role === 'DIRECTOR')) {
      navigate(`/profe/director/${created}`);
    }
  }, [created, access, navigate]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const school = await schoolsApi.create(call, name.trim());
      setName('');
      setCreated(school.id);
      onAccessChange();
    } catch (err) {
      setError(err); // se conserva el formulario
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = (s: School) => (s.role === 'DIRECTOR' ? 'Director' : s.role === 'PROFESOR' ? 'Profesor' : 'Estudiante');
  const linkFor = (s: School) =>
    s.role === 'DIRECTOR' ? `/profe/director/${s.id}` : s.role === 'PROFESOR' ? `/profe/profesor/${s.id}` : null;

  return (
    <div className="staff-page">
      <h1>Colegios</h1>
      <section className="panel">
        <h2>Tus colegios ({access.schools.length})</h2>
        {access.schools.length === 0 ? (
          <Empty title="Aún no tienes colegios." />
        ) : (
          <ul className="item-list">
            {access.schools.map((s) => {
              const to = linkFor(s);
              const active = s.id === current && s.role === 'DIRECTOR';
              return (
                <li key={`${s.id}-${s.role}`} className={`item-row${active ? ' item-active' : ''}`}>
                  <span className="item-text">
                    <strong>{s.name}</strong>
                    <span className={`role-badge role-${s.role.toLowerCase()}`}>{roleLabel(s)}</span>
                  </span>
                  {active ? (
                    <span className="tag">Activo</span>
                  ) : (
                    to && (
                      <Link className="btn btn-small btn-secondary" to={to}>
                        Abrir
                      </Link>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <form className="panel staff-form" onSubmit={create} noValidate>
        <h2>Crear colegio</h2>
        <p className="hint">Quedarás como su director. No se pueden editar ni eliminar colegios desde la app.</p>
        <TextField label="Nombre del colegio" value={name} onChange={setName} maxLength={NAME_LIMITS.school} error={fieldErrorsOf(error).name} />
        {Boolean(error) && <p className="form-error">{errorMessage(error, { forbidden: 'Confirma tu correo y activa tu perfil de director.' })}</p>}
        <button className="btn btn-primary" disabled={busy || !name.trim() || !online}>
          {busy ? 'Creando…' : 'Crear colegio'}
        </button>
      </form>
    </div>
  );
}

/* ---------- Integrantes ---------- */

function Members({ schoolId }: { schoolId: string }) {
  const { call } = useStaffSession();
  const online = useOnlineStatus();
  const members = useRemote(`members:${schoolId}`, (signal) => membersApi.list(call, schoolId, signal));
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'PROFESOR' | 'ALUMNO'>('PROFESOR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const clearSuccess = useCallback(() => setSuccess(null), []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const member = await membersApi.add(call, schoolId, email.trim(), role);
      setSuccess(`${member.email ?? email} ahora es ${member.role === 'PROFESOR' ? 'profesor' : 'estudiante'} del colegio.`);
      setEmail('');
      members.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await membersApi.remove(call, schoolId, removing.userId);
      setSuccess(`${removing.email ?? 'La cuenta'} ya no tiene acceso a este colegio.`);
      setRemoving(null);
      members.reload();
    } catch (err) {
      setRemoveError(errorMessage(err, { notFound: 'Esa persona ya no está en el colegio.' }));
    } finally {
      setRemoveBusy(false);
    }
  }

  const list = members.data ?? [];
  const groups: [string, Member[]][] = [
    ['Profesores', list.filter((m) => m.role === 'PROFESOR')],
    ['Estudiantes', list.filter((m) => m.role === 'ALUMNO')],
  ];

  return (
    <div className="staff-page">
      <h1>Integrantes</h1>
      <SuccessNote text={success} onDone={clearSuccess} />
      <form className="panel staff-form" onSubmit={add} noValidate>
        <h2>Añadir una cuenta existente</h2>
        <p className="hint">
          La persona ya debe tener una cuenta en MayaMente con el correo confirmado. Esto no crea cuentas ni envía invitaciones.
          Las cuentas de estudiantes con usuario y contraseña las crea su profesor.
        </p>
        <TextField label="Correo de la cuenta" type="email" value={email} onChange={setEmail} maxLength={254} error={fieldErrorsOf(error).email} />
        <fieldset className="field">
          <legend>Rol en el colegio</legend>
          <div className="gender-row">
            {(
              [
                ['PROFESOR', 'Profesor'],
                ['ALUMNO', 'Estudiante'],
              ] as ['PROFESOR' | 'ALUMNO', string][]
            ).map(([value, label]) => (
              <label key={value} className={`gender-option${role === value ? ' gender-on' : ''}`}>
                <input type="radio" name="member-role" checked={role === value} onChange={() => setRole(value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {Boolean(error) && (
          <p className="form-error">
            {errorMessage(error, {
              notFound: 'No hay una cuenta con ese correo confirmado.',
              conflict: 'Esa cuenta ya tiene otro rol en este colegio.',
            })}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy || !email.trim() || !online}>
          {busy ? 'Añadiendo…' : 'Añadir al colegio'}
        </button>
      </form>

      <section className="panel">
        <div className="row-between">
          <h2>Personas del colegio</h2>
          <Updated at={members.updatedAt} />
        </div>
        {members.loading && !members.data ? (
          <Loading />
        ) : members.error && !members.data ? (
          <ErrorState error={members.error} onRetry={members.reload} />
        ) : list.length === 0 ? (
          <Empty title="Aún no hay profesores ni estudiantes.">
            <p>Añade la primera cuenta con el formulario de arriba.</p>
          </Empty>
        ) : (
          groups.map(([title, people]) => (
            <div key={title} className="group">
              <h3>
                {title} ({people.length})
              </h3>
              {people.length === 0 ? (
                <p className="hint">Ninguno todavía.</p>
              ) : (
                <ul className="item-list">
                  {people.map((m) => (
                    <li key={m.userId} className="item-row">
                      <span className="item-text">
                        <strong>{m.email ?? 'Cuenta sin correo visible'}</strong>
                      </span>
                      <button
                        className="icon-action"
                        disabled={!online}
                        aria-label={`Retirar a ${m.email ?? 'esta cuenta'} del colegio`}
                        onClick={() => {
                          setRemoveError(null);
                          setRemoving(m);
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </section>

      {removing && (
        <ConfirmDialog
          title="¿Retirar del colegio?"
          confirmLabel="Retirar"
          danger
          busy={removeBusy}
          error={removeError}
          onCancel={() => setRemoving(null)}
          onConfirm={remove}
        >
          <p>
            <strong>{removing.email}</strong> perderá su membresía y sus asignaciones a cursos de este colegio.
          </p>
          <p>Su cuenta se conserva, igual que sus accesos a otros colegios y los temas que haya publicado.</p>
          {removing.role === 'PROFESOR' && <p className="hint">Si es responsable de aulas, primero hay que reasignarlas.</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}

/* ---------- Cursos ---------- */

function Courses({ schoolId }: { schoolId: string }) {
  const { call } = useStaffSession();
  const online = useOnlineStatus();
  const courses = useRemote(`courses:${schoolId}`, (signal) => coursesApi.list(call, schoolId, signal));
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const clearSuccess = useCallback(() => setSuccess(null), []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const course = await coursesApi.create(call, schoolId, name.trim());
      setSuccess(`Curso “${course.name}” creado.`);
      setName('');
      setSelected(course.id);
      courses.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function removeCourse() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await coursesApi.remove(call, schoolId, deleting.id);
      setSuccess(`Curso “${deleting.name}” eliminado.`);
      if (selected === deleting.id) setSelected(null);
      setDeleting(null);
      courses.reload();
    } catch (err) {
      setDeleteError(errorMessage(err, { notFound: 'Ese curso ya no existe.' }));
    } finally {
      setDeleteBusy(false);
    }
  }

  const list = courses.data ?? [];
  const current = list.find((c) => c.id === selected) ?? null;

  return (
    <div className="staff-page">
      <h1>Cursos</h1>
      <SuccessNote text={success} onDone={clearSuccess} />
      <form className="panel staff-form" onSubmit={create} noValidate>
        <h2>Crear curso</h2>
        <TextField label="Nombre del curso" value={name} onChange={setName} maxLength={NAME_LIMITS.course} error={fieldErrorsOf(error).name} />
        {Boolean(error) && <p className="form-error">{errorMessage(error)}</p>}
        <button className="btn btn-primary" disabled={busy || !name.trim() || !online}>
          {busy ? 'Creando…' : 'Crear curso'}
        </button>
      </form>

      <section className="panel">
        <div className="row-between">
          <h2>Cursos del colegio ({list.length})</h2>
          <Updated at={courses.updatedAt} />
        </div>
        {courses.loading && !courses.data ? (
          <Loading />
        ) : courses.error && !courses.data ? (
          <ErrorState error={courses.error} onRetry={courses.reload} />
        ) : list.length === 0 ? (
          <Empty title="Aún no hay cursos." />
        ) : (
          <ul className="item-list">
            {list.map((c) => (
              <li key={c.id} className={`item-row${c.id === selected ? ' item-active' : ''}`}>
                <button className="item-select" aria-pressed={c.id === selected} onClick={() => setSelected(c.id === selected ? null : c.id)}>
                  <strong>{c.name}</strong>
                  <span className="hint">{c.id === selected ? 'Ocultar integrantes' : 'Ver integrantes'}</span>
                </button>
                <button
                  className="icon-action"
                  disabled={!online}
                  aria-label={`Eliminar el curso ${c.name}`}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleting(c);
                  }}
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* key: cambiar de curso limpia la lista y descarta respuestas tardías */}
      {current && <CourseMembers key={current.id} schoolId={schoolId} course={current} />}

      {deleting && (
        <ConfirmDialog
          title={`¿Eliminar “${deleting.name}”?`}
          confirmLabel="Eliminar curso"
          danger
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => setDeleting(null)}
          onConfirm={removeCourse}
        >
          <p>Se eliminarán también todos sus temas y las asignaciones de profesores y estudiantes a este curso.</p>
          <p>Esta acción no se puede deshacer.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function CourseMembers({ schoolId, course }: { schoolId: string; course: Course }) {
  const { call } = useStaffSession();
  const online = useOnlineStatus();
  const members = useRemote(`course-members:${course.id}`, (signal) => coursesApi.members(call, schoolId, course.id, signal));
  const school = useRemote(`members:${schoolId}`, (signal) => membersApi.list(call, schoolId, signal));
  const [candidate, setCandidate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const clearSuccess = useCallback(() => setSuccess(null), []);

  const inCourse = new Set((members.data ?? []).map((m) => m.userId));
  const available = (school.data ?? []).filter((m) => !inCourse.has(m.userId));

  async function assign(e: FormEvent) {
    e.preventDefault();
    if (!candidate || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Sin cuerpo: el servidor deriva el rol de la membresía escolar
      await coursesApi.assign(call, schoolId, course.id, candidate);
      const who = school.data?.find((m) => m.userId === candidate);
      setSuccess(`${who?.email ?? 'La cuenta'} quedó asignada a ${course.name}.`);
      setCandidate('');
      members.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function unassign() {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await coursesApi.unassign(call, schoolId, course.id, removing.userId);
      setRemoving(null);
      members.reload();
    } catch (err) {
      setRemoveError(errorMessage(err, { notFound: 'Ya no estaba asignado a este curso.' }));
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="row-between">
        <h2>Integrantes de {course.name}</h2>
        <Updated at={members.updatedAt} />
      </div>
      <SuccessNote text={success} onDone={clearSuccess} />
      {members.loading && !members.data ? (
        <Loading />
      ) : members.error && !members.data ? (
        <ErrorState error={members.error} onRetry={members.reload} />
      ) : (members.data ?? []).length === 0 ? (
        <Empty title="Este curso aún no tiene integrantes." />
      ) : (
        <ul className="item-list">
          {members.data!.map((m) => (
            <li key={m.userId} className="item-row">
              <span className="item-text">
                <strong>{m.email ?? 'Cuenta sin correo visible'}</strong>
                <span className={`role-badge role-${m.role.toLowerCase()}`}>{m.role === 'PROFESOR' ? 'Profesor' : 'Estudiante'}</span>
              </span>
              <button
                className="icon-action"
                disabled={!online}
                aria-label={`Retirar a ${m.email ?? 'esta cuenta'} del curso`}
                onClick={() => {
                  setRemoveError(null);
                  setRemoving(m);
                }}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="assign-form" onSubmit={assign}>
        <label className="field">
          <span>Asignar una persona del colegio</span>
          <select value={candidate} onChange={(e) => setCandidate(e.target.value)} disabled={!school.data}>
            <option value="">{available.length ? 'Elige una cuenta…' : 'No hay más personas del colegio'}</option>
            {available.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.email ?? m.userId} · {m.role === 'PROFESOR' ? 'Profesor' : 'Estudiante'}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">El rol en el curso es el que la persona ya tiene en el colegio.</p>
        {Boolean(error) && <p className="form-error">{errorMessage(error, { notFound: 'Esa cuenta ya no pertenece al colegio.' })}</p>}
        <button className="btn btn-small btn-primary" disabled={!candidate || busy || !online}>
          {busy ? 'Asignando…' : 'Asignar al curso'}
        </button>
      </form>

      {removing && (
        <ConfirmDialog
          title="¿Retirar del curso?"
          confirmLabel="Retirar del curso"
          danger
          busy={removeBusy}
          error={removeError}
          onCancel={() => setRemoving(null)}
          onConfirm={unassign}
        >
          <p>
            <strong>{removing.email}</strong> dejará de estar asignado a {course.name}. Sigue siendo integrante del colegio.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

/* ---------- Perfil ---------- */

function DirectorProfileView({ access }: { access: Access }) {
  const { call, session } = useStaffSession();
  const logout = useStaffLogout();
  const profile = useRemote(`director-me:${session?.user.id}`, (signal) => directorsApi.me(call, signal));
  return (
    <div className="staff-page">
      <h1>Perfil</h1>
      <section className="panel">
        {profile.loading && !profile.data ? (
          <Loading />
        ) : profile.error && !profile.data ? (
          <ErrorState error={profile.error} onRetry={profile.reload} />
        ) : (
          <dl className="profile-data">
            <dt>Nombre</dt>
            <dd>{profile.data?.name}</dd>
            <dt>Correo</dt>
            <dd>{profile.data?.email ?? session?.user.email}</dd>
            <dt>Colegios que diriges</dt>
            <dd>{access.schools.filter((s) => s.role === 'DIRECTOR').map((s) => s.name).join(', ') || 'Ninguno todavía'}</dd>
          </dl>
        )}
      </section>
      <button className="btn btn-secondary btn-block" onClick={() => void logout()}>
        Cerrar sesión
      </button>
    </div>
  );
}

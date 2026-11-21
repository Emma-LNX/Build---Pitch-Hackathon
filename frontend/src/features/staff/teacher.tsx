import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { ChartIcon, GroupIcon, HomeIcon, PersonIcon } from '../../components/icons';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { ERROR_LABELS } from '../adaptive/errors';
import { CATEGORIES } from '../curriculum/catalog';
import { DeliveryCard, generatePassword, suggestUsername } from '../teacher/TeacherPage';
import { AreaNav, useStaffLogout, type Access } from './StaffApp';
import { useStaffSession } from './StaffSession';
import { classroomsApi, teacherApi, type Classroom, type LearningStudent } from './services';
import { ConfirmDialog, Empty, ErrorState, errorMessage, fieldErrorsOf, Loading, SuccessNote, TextField, Updated, useRemote } from './ui';

/**
 * Panel del profesor organizado por aulas: crea su aula, las cuentas de sus alumnos
 * y ve el nivel de cada alumno por categoría del CNB (docs/aprendizaje-adaptativo.md).
 */
export function TeacherArea({ access, schoolId }: { access: Access; schoolId: string }) {
  const base = `/profe/profesor/${schoolId}`;
  // Aula activa en este colegio (se limpia al cambiar de colegio: el área se vuelve a montar)
  const [room, setRoom] = useState<string | null>(null);
  const onRoom = useCallback((id: string | null) => setRoom(id), []);
  const items = [
    { to: base, label: 'Inicio', icon: <HomeIcon />, end: true },
    { to: `${base}/alumnos`, label: 'Alumnos', icon: <GroupIcon /> },
    { to: `${base}/estadisticas`, label: 'Estadísticas', icon: <ChartIcon /> },
    { to: `${base}/perfil`, label: 'Perfil', icon: <PersonIcon /> },
  ];
  return (
    <div className="staff-body">
      <AreaNav items={items} />
      <main className="staff-main">
        <Routes>
          <Route index element={<TeacherHome schoolId={schoolId} base={base} onRoom={onRoom} />} />
          <Route path="alumnos" element={<StudentsPage schoolId={schoolId} room={room} onRoom={onRoom} />} />
          <Route path="estadisticas" element={<LearningPage schoolId={schoolId} room={room} onRoom={onRoom} />} />
          <Route path="perfil" element={<TeacherProfileView access={access} schoolId={schoolId} />} />
          <Route path="*" element={<Navigate to={base} replace />} />
        </Routes>
      </main>
    </div>
  );
}

const classroomName = (c: Classroom) => `${c.grade} ${c.section} · ${c.academicYear}`;
const categoryName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;
const USERNAME_RE = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;
/** Mismos cortes que AprendizajeService.nivel */
const LEVELS = [
  ['Semilla', 'menos de 40'],
  ['Brote', '40 a 59'],
  ['Milpa', '60 a 74'],
  ['Elote', '75 a 89'],
  ['Mazorca', '90 o más'],
] as const;

function useRooms(schoolId: string) {
  const { call } = useStaffSession();
  return useRemote(`teacher-me:${schoolId}`, (signal) => teacherApi.me(call, schoolId, signal));
}

/* ---------- Inicio: aulas ---------- */

function TeacherHome({ schoolId, base, onRoom }: { schoolId: string; base: string; onRoom: (id: string | null) => void }) {
  const me = useRooms(schoolId);
  const rooms = me.data?.classrooms ?? [];

  return (
    <div className="staff-page">
      <h1>Inicio</h1>
      <section className="panel">
        <div className="row-between">
          <h2>Tus aulas</h2>
          <Updated at={me.updatedAt} />
        </div>
        {me.loading && !me.data ? (
          <Loading />
        ) : me.error && !me.data ? (
          <ErrorState error={me.error} onRetry={me.reload} ctx={{ notFound: 'No figuras como profesor de este colegio.' }} />
        ) : rooms.length === 0 ? (
          <Empty title="Aún no tienes aulas.">
            <p>Crea tu aula abajo para empezar a agregar alumnos.</p>
          </Empty>
        ) : (
          <ul className="item-list">
            {rooms.map((c) => (
              <li key={c.id} className="item-row">
                <span className="item-text">
                  <strong>{classroomName(c)}</strong>
                  <span className="hint">{c.studentCount === 1 ? '1 alumno' : `${c.studentCount} alumnos`}</span>
                </span>
                <span className="row-actions">
                  <Link className="btn btn-small btn-secondary" to={`${base}/alumnos`} onClick={() => onRoom(c.id)}>
                    Alumnos
                  </Link>
                  <Link className="btn btn-small btn-primary" to={`${base}/estadisticas`} onClick={() => onRoom(c.id)}>
                    Estadísticas
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateClassroom schoolId={schoolId} onCreated={(id) => { onRoom(id); me.reload(); }} />

      <section className="panel">
        <h2>¿Cómo funciona?</h2>
        <ol className="how-list">
          <li>Crea tu aula (por ejemplo, Cuarto primaria A).</li>
          <li>En <strong>Alumnos</strong>, crea una cuenta con usuario y contraseña para cada niño.</li>
          <li>Los niños entran a MayaMente y juegan. Sus respuestas se envían solas cuando hay internet.</li>
          <li>
            En <strong>Estadísticas</strong> ves el nivel de cada alumno en cada tema del CNB y qué le conviene practicar. La app ya
            le da más ejercicios de lo que más le cuesta.
          </li>
        </ol>
      </section>
    </div>
  );
}

function CreateClassroom({ schoolId, onCreated }: { schoolId: string; onCreated: (id: string) => void }) {
  const { call, session } = useStaffSession();
  const online = useOnlineStatus();
  const [grade, setGrade] = useState('Cuarto primaria');
  const [section, setSection] = useState('A');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const clearSuccess = useCallback(() => setSuccess(null), []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy || !grade.trim() || !section.trim() || !session) return;
    setBusy(true);
    setError(null);
    try {
      const created = await classroomsApi.create(call, schoolId, {
        grade: grade.trim(),
        section: section.trim(),
        academicYear: Number(year),
        teacherId: session.user.id,
      });
      setSuccess(`Aula ${classroomName(created)} creada. Ahora agrega a tus alumnos.`);
      onCreated(created.id);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const fields = fieldErrorsOf(error);
  return (
    <form className="panel staff-form" onSubmit={create} noValidate>
      <h2>Crear aula</h2>
      <SuccessNote text={success} onDone={clearSuccess} />
      <TextField label="Grado" value={grade} onChange={setGrade} maxLength={80} error={fields.grade} />
      <TextField label="Sección" value={section} onChange={setSection} maxLength={16} error={fields.section} />
      <TextField label="Ciclo escolar" value={year} onChange={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))} maxLength={4} error={fields.academicYear} />
      {Boolean(error) && (
        <p className="form-error">{errorMessage(error, { conflict: 'Ya existe un aula con ese grado y sección en este ciclo.' })}</p>
      )}
      <button className="btn btn-primary" disabled={busy || !online || !grade.trim() || !section.trim() || year.length !== 4}>
        {busy ? 'Creando…' : 'Crear aula'}
      </button>
    </form>
  );
}

/** Elige el aula activa; devuelve la seleccionada o la primera. */
function RoomPicker({ schoolId, room, onRoom, children }: {
  schoolId: string;
  room: string | null;
  onRoom: (id: string | null) => void;
  children: (room: Classroom) => ReactNode;
}) {
  const me = useRooms(schoolId);
  const rooms = me.data?.classrooms ?? [];
  const current = rooms.find((r) => r.id === room) ?? rooms[0] ?? null;
  if (me.loading && !me.data) return <Loading />;
  if (me.error && !me.data) return <ErrorState error={me.error} onRetry={me.reload} />;
  if (!current) {
    return (
      <Empty title="Aún no tienes aulas.">
        <p>Créala en Inicio.</p>
      </Empty>
    );
  }
  return (
    <>
      {rooms.length > 1 && (
        <div className="chip-row" role="group" aria-label="Aula">
          {rooms.map((r) => (
            <button key={r.id} className="chip chip-wide" aria-pressed={r.id === current.id} onClick={() => onRoom(r.id)}>
              {r.grade} {r.section}
            </button>
          ))}
        </div>
      )}
      {children(current)}
    </>
  );
}

/* ---------- Alumnos: cuentas con usuario y contraseña ---------- */

interface Delivery {
  name: string;
  username: string;
  password: string;
  courseName: string;
  reason: 'nueva' | 'restablecida';
}

function StudentsPage({ schoolId, room, onRoom }: { schoolId: string; room: string | null; onRoom: (id: string | null) => void }) {
  return (
    <div className="staff-page">
      <h1>Alumnos</h1>
      <RoomPicker schoolId={schoolId} room={room} onRoom={onRoom}>
        {(current) => <Roster key={current.id} schoolId={schoolId} room={current} />}
      </RoomPicker>
    </div>
  );
}

function Roster({ schoolId, room }: { schoolId: string; room: Classroom }) {
  const { call } = useStaffSession();
  const online = useOnlineStatus();
  const learning = useRemote(`learning:${room.id}`, (signal) => classroomsApi.learning(call, room.id, signal));
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [resetting, setResetting] = useState<LearningStudent | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  async function confirmReset() {
    if (!resetting) return;
    const password = generatePassword();
    setBusy(true);
    setDialogError(null);
    try {
      await classroomsApi.changePassword(call, schoolId, room.id, resetting.studentId, password);
      setDelivery({ name: resetting.alias, username: resetting.usuario ?? '', password, courseName: classroomName(room), reason: 'restablecida' });
      setResetting(null);
    } catch (err) {
      setDialogError(errorMessage(err, { notFound: 'Esta cuenta no se creó desde un aula; pide al director una nueva.' }));
    } finally {
      setBusy(false);
    }
  }

  const list = learning.data?.alumnos ?? [];
  return (
    <>
      {delivery && <DeliveryCard delivery={delivery} onDone={() => setDelivery(null)} />}
      <CreateStudent
        schoolId={schoolId}
        room={room}
        onCreated={(d) => {
          setDelivery(d);
          learning.reload();
        }}
      />
      <section className="panel">
        <div className="row-between">
          <h2>
            Alumnos de {classroomName(room)} ({list.length})
          </h2>
          <Updated at={learning.updatedAt} />
        </div>
        {learning.loading && !learning.data ? (
          <Loading />
        ) : learning.error && !learning.data ? (
          <ErrorState error={learning.error} onRetry={learning.reload} />
        ) : list.length === 0 ? (
          <Empty title="Aún no hay alumnos en esta aula." />
        ) : (
          <ul className="roster">
            {list.map((s) => (
              <li key={s.studentId} className="roster-row">
                <span className="roster-text">
                  <strong>{s.alias}</strong>
                  <small>Usuario: {s.usuario ?? '—'}</small>
                </span>
                <span className="roster-actions">
                  <button
                    className="btn btn-small btn-secondary"
                    disabled={!online}
                    onClick={() => {
                      setDialogError(null);
                      setResetting(s);
                    }}
                  >
                    Nueva contraseña
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">Las contraseñas no se pueden consultar. Si un alumno la olvida, crea una nueva.</p>
      </section>
      {resetting && (
        <ConfirmDialog
          title={`¿Nueva contraseña para ${resetting.alias}?`}
          confirmLabel="Crear contraseña nueva"
          busy={busy}
          error={dialogError}
          onCancel={() => setResetting(null)}
          onConfirm={confirmReset}
        >
          <p>La contraseña anterior dejará de funcionar. Verás la nueva una sola vez para entregarla.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

function CreateStudent({ schoolId, room, onCreated }: { schoolId: string; room: Classroom; onCreated: (d: Delivery) => void }) {
  const { call } = useStaffSession();
  const online = useOnlineStatus();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [userEdited, setUserEdited] = useState(false);
  const [password, setPassword] = useState(generatePassword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMessage(null);
    setError(null);
    if (!name.trim() || !username.trim() || password.length < 6) {
      return setMessage('Completa el nombre, el usuario y una contraseña de al menos 6 caracteres.');
    }
    if (username.length < 3 || !USERNAME_RE.test(username)) {
      return setMessage('El usuario debe tener de 3 a 30 letras sin tildes, números, punto o guion bajo.');
    }
    setBusy(true);
    try {
      const created = await classroomsApi.createStudent(call, schoolId, room.id, { username: username.trim(), password, alias: name.trim() });
      onCreated({ name: created.alias, username: created.username, password, courseName: classroomName(room), reason: 'nueva' });
      setName('');
      setUsername('');
      setUserEdited(false);
      setPassword(generatePassword());
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const fields = fieldErrorsOf(error);
  return (
    <form className="panel staff-form" onSubmit={submit} noValidate>
      <h2>Crear cuenta de alumno</h2>
      <TextField
        label="Nombre del alumno"
        value={name}
        maxLength={40}
        error={fields.alias}
        onChange={(v) => {
          setName(v);
          if (!userEdited) setUsername(suggestUsername(v).replace(/-/g, '_'));
        }}
      />
      <TextField
        label="Nombre de usuario"
        value={username}
        maxLength={30}
        error={fields.username}
        hint="Letras sin tildes, números, punto o guion bajo"
        onChange={(v) => {
          setUsername(v);
          setUserEdited(true);
        }}
      />
      <div className="field">
        <label htmlFor="initial-password">Contraseña inicial</label>
        <div className="password-row">
          <input id="initial-password" value={password} maxLength={72} spellCheck={false} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="peek-btn" onClick={() => setPassword(generatePassword())}>
            Generar
          </button>
        </div>
        {fields.password && <span className="field-error">{fields.password}</span>}
      </div>
      {(message || Boolean(error)) && (
        <p className="form-error" role="alert">
          {message ??
            errorMessage(error, {
              notFound: 'Ya no eres responsable de esta aula.',
              conflict: 'Ese usuario ya existe o el alumno ya está en otra aula. Elige otro usuario.',
            })}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={busy || !online}>
        {busy ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  );
}

/* ---------- Estadísticas de aprendizaje del aula ---------- */

function LearningPage({ schoolId, room, onRoom }: { schoolId: string; room: string | null; onRoom: (id: string | null) => void }) {
  return (
    <div className="staff-page">
      <h1>Estadísticas</h1>
      <p className="hint">
        Cada respuesta de un alumno en MayaMente guarda el tema, si acertó y cuánto tardó. Con eso se calcula su nivel en cada tema
        del CNB, de Semilla a Mazorca, y la app le da más ejercicios de lo que más le cuesta. Los datos llegan cuando el alumno tiene
        internet.
      </p>
      <RoomPicker schoolId={schoolId} room={room} onRoom={onRoom}>
        {(current) => <ClassroomLearningView key={current.id} room={current} />}
      </RoomPicker>
    </div>
  );
}

export function ClassroomLearningView({ room }: { room: Classroom }) {
  const { call } = useStaffSession();
  const learning = useRemote(`learning:${room.id}`, (signal) => classroomsApi.learning(call, room.id, signal));
  if (learning.loading && !learning.data) return <Loading />;
  if (learning.error && !learning.data) {
    return <ErrorState error={learning.error} onRetry={learning.reload} ctx={{ notFound: 'Ya no tienes acceso a esta aula.' }} />;
  }
  const data = learning.data!;
  const active = data.alumnos.filter((a) => a.respuestas > 0);
  const answers = data.alumnos.reduce((n, a) => n + a.respuestas, 0);
  const correct = data.alumnos.reduce((n, a) => n + a.correctas, 0);

  return (
    <>
      <section className="panel">
        <div className="row-between">
          <h2>{classroomName(room)}</h2>
          <span className="row-actions">
            <Updated at={learning.updatedAt} />
            <button className="btn btn-small btn-secondary" onClick={learning.reload}>
              Actualizar
            </button>
          </span>
        </div>
        <dl className="tiles">
          <div className="tile">
            <dt>Alumnos</dt>
            <dd>{data.alumnos.length}</dd>
          </div>
          <div className="tile">
            <dt>Ya jugaron</dt>
            <dd>{active.length}</dd>
          </div>
          <div className="tile">
            <dt>Respuestas</dt>
            <dd>{answers}</dd>
          </div>
          <div className="tile">
            <dt>Aciertos</dt>
            <dd>{answers ? `${Math.round((100 * correct) / answers)}%` : '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>Temas del aula</h2>
        {data.categorias.length === 0 ? (
          <Empty title="Aún no hay respuestas en esta aula.">
            <p>Cuando tus alumnos jueguen (por ejemplo, la Expedición), aquí verás cómo va el aula en cada tema.</p>
          </Empty>
        ) : (
          <ul className="bars" aria-label="Nivel promedio por tema">
            {data.categorias.map((c) => (
              <li key={c.categoria} className="bar-row">
                <span className="bar-label">
                  {categoryName(c.categoria)}
                  {c.alumnosConDificultad > 0 && (
                    <span className="tag tag-warn">
                      {c.alumnosConDificultad === 1 ? '1 alumno necesita apoyo' : `${c.alumnosConDificultad} alumnos necesitan apoyo`}
                    </span>
                  )}
                </span>
                <span className="bar-track" aria-hidden="true">
                  <span className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, c.puntajePromedio))}%` }} />
                </span>
                <span className="bar-value">
                  {c.puntajePromedio}/100 · {c.alumnosConDatos} {c.alumnosConDatos === 1 ? 'alumno' : 'alumnos'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Cada alumno</h2>
        <ul className="level-chips" aria-label="Niveles">
          {LEVELS.map(([nivel, rango]) => (
            <li key={nivel} className={`level-chip level-${nivel.toLowerCase()}`}>
              <strong>{nivel}</strong>
              <span>{rango}</span>
            </li>
          ))}
        </ul>
        <p className="hint">Puntaje de 0 a 100 en cada tema. Sube con aciertos y baja con errores; Semilla y Brote necesitan apoyo.</p>
        {data.alumnos.length === 0 ? (
          <Empty title="Aún no hay alumnos en esta aula." />
        ) : (
          <ul className="learning-list">
            {data.alumnos.map((a) => (
              <StudentLearning key={a.studentId} student={a} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function StudentLearning({ student: a }: { student: LearningStudent }) {
  return (
    <li className="learning-card">
      <div className="row-between">
        <strong>{a.alias}</strong>
        <span className="hint">
          {a.respuestas === 0
            ? 'Aún no ha jugado'
            : `${a.respuestas} respuestas · ${Math.round((100 * a.correctas) / a.respuestas)}% aciertos`}
          {a.ultimaRespuesta && ` · última vez ${new Date(a.ultimaRespuesta).toLocaleDateString('es-GT')}`}
        </span>
      </div>
      {a.categorias.length > 0 && (
        <ul className="level-chips">
          {a.categorias.map((c) => (
            <li key={c.categoria} className={`level-chip level-${c.nivel.toLowerCase()}`}>
              <span>{categoryName(c.categoria)}</span>
              <strong>
                {c.nivel} · {c.puntaje}
              </strong>
            </li>
          ))}
        </ul>
      )}
      {a.recomendadas.length > 0 && (
        <p className="learning-note">
          <strong>Le conviene practicar:</strong> {a.recomendadas.map(categoryName).join(' y ')}
        </p>
      )}
      {a.errores.length > 0 && (
        <p className="learning-note">
          <strong>Errores frecuentes:</strong> {a.errores.map((e) => `${ERROR_LABELS[e.error] ?? e.error} (${e.veces})`).join('; ')}
        </p>
      )}
    </li>
  );
}

/* ---------- Perfil ---------- */

function TeacherProfileView({ access, schoolId }: { access: Access; schoolId: string }) {
  const { session } = useStaffSession();
  const logout = useStaffLogout();
  const me = useRooms(schoolId);
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

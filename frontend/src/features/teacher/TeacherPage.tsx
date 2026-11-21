import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useStaffSession } from '../staff/StaffSession';
import { accountsApi, type AccountClass, type StudentAccount } from '../staff/services';
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
} from '../staff/ui';

/**
 * Cuentas de estudiantes del profesor (módulo de cuentas, docs/cuentas-estudiantes.md).
 * Antes era una página aparte; ahora es la sección "Estudiantes" del panel del profesor.
 *
 * Las contraseñas solo existen en memoria mientras la ficha de entrega está abierta:
 * no se guardan en almacenamiento persistente ni en registros, y no se pueden consultar después.
 */

const WORDS = ['ceiba', 'jaguar', 'quetzal', 'maiz', 'tikal', 'cacao', 'volcan', 'lago', 'colibri', 'tortuga'];

/** Contraseña inicial fácil de dictar: palabra + 3 dígitos aleatorios (criptográficos). */
export function generatePassword(): string {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return `${WORDS[values[0] % WORDS.length]}${String(values[1] % 1000).padStart(3, '0')}`;
}

/** "Daniel García" → "daniel.garcia" */
export function suggestUsername(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 30);
}

interface Delivery {
  name: string;
  username: string;
  password: string;
  courseName: string;
  reason: 'nueva' | 'restablecida';
}

const USERNAME_RE = /^[A-Za-z0-9._-]{3,30}$/;

export function StudentAccountsPanel({
  schoolId,
  course,
  onCourseChange,
}: {
  schoolId: string;
  course: string | null;
  onCourseChange: (id: string) => void;
}) {
  const { call, session } = useStaffSession();
  const online = useOnlineStatus();
  // /teacher/classes devuelve las clases del profesor en todos sus colegios: se filtra al activo
  const classes = useRemote(`account-classes:${session?.user.id}`, (signal) => accountsApi.classes(call, signal));
  const mine = (classes.data ?? []).filter((c) => c.schoolId === schoolId);
  const current = mine.find((c) => c.courseId === course) ?? mine[0] ?? null;
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  // Sube con cada cuenta creada para volver a pedir la lista al servidor
  const [created, setCreated] = useState(0);

  useEffect(() => {
    if (current && current.courseId !== course) onCourseChange(current.courseId);
  }, [current, course, onCourseChange]);

  if (classes.loading && !classes.data) return <Loading label="Cargando tus cursos…" />;
  if (classes.error && !classes.data) return <ErrorState error={classes.error} onRetry={classes.reload} />;
  if (!current) {
    return (
      <Empty title="No tienes cursos asignados en este colegio.">
        <p>Para crear cuentas de estudiantes, tu director debe asignarte a un curso.</p>
      </Empty>
    );
  }

  return (
    <>
      {mine.length > 1 && (
        <label className="inline-select panel">
          <span>Curso</span>
          <select value={current.courseId} onChange={(e) => onCourseChange(e.target.value)}>
            {mine.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.courseName}
              </option>
            ))}
          </select>
        </label>
      )}
      {delivery && <DeliveryCard delivery={delivery} onDone={() => setDelivery(null)} />}
      <CreateStudentForm
        classes={mine}
        defaultCourse={current.courseId}
        disabled={!online}
        onCreated={(d, courseId) => {
          setDelivery(d);
          setCreated((n) => n + 1);
          onCourseChange(courseId);
        }}
      />
      {/* key: al cambiar de curso se limpian la lista y las respuestas pendientes */}
      <Roster key={current.courseId} current={current} classes={mine} onDelivery={setDelivery} refresh={created} />
    </>
  );
}

function CreateStudentForm({
  classes,
  defaultCourse,
  disabled,
  onCreated,
}: {
  classes: AccountClass[];
  defaultCourse: string;
  disabled: boolean;
  onCreated: (delivery: Delivery, courseId: string) => void;
}) {
  const { call } = useStaffSession();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [userEdited, setUserEdited] = useState(false);
  const [password, setPassword] = useState(generatePassword);
  const [courseId, setCourseId] = useState(defaultCourse);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setCourseId(defaultCourse), [defaultCourse]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMessage(null);
    setError(null);
    if (!name.trim() || !username.trim() || password.length < 6) {
      return setMessage('Completa el nombre, el usuario y una contraseña de al menos 6 caracteres.');
    }
    if (!USERNAME_RE.test(username)) {
      return setMessage('El usuario debe tener de 3 a 30 letras, números, punto o guion, sin espacios ni tildes.');
    }
    setBusy(true);
    try {
      const created = await accountsApi.create(call, courseId, name.trim(), username.trim(), password);
      const course = classes.find((c) => c.courseId === courseId);
      onCreated(
        { name: created.displayName, username: created.username, password, courseName: course?.courseName ?? '', reason: 'nueva' },
        courseId,
      );
      setName('');
      setUsername('');
      setUserEdited(false);
      setPassword(generatePassword());
    } catch (err) {
      setError(err); // se conserva el formulario
    } finally {
      setBusy(false);
    }
  }

  const fields = fieldErrorsOf(error);
  return (
    <form className="panel staff-form" onSubmit={submit} noValidate>
      <h2>Crear cuenta de estudiante</h2>
      <TextField
        label="Nombre del estudiante"
        value={name}
        maxLength={40}
        error={fields.displayName}
        onChange={(v) => {
          setName(v);
          if (!userEdited) setUsername(suggestUsername(v));
        }}
      />
      <TextField
        label="Nombre de usuario"
        value={username}
        maxLength={30}
        error={fields.username}
        hint="Letras, números, punto o guion"
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
      <label className="field">
        <span>Curso</span>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.courseId} value={c.courseId}>
              {c.courseName}
            </option>
          ))}
        </select>
      </label>
      {(message || Boolean(error)) && (
        <p className="form-error" role="alert">
          {message ?? errorMessage(error, { notFound: 'No eres profesor de ese curso.', conflict: 'Ese nombre de usuario ya existe. Elige otro.' })}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={busy || disabled}>
        {busy ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  );
}

function Roster({
  current,
  classes,
  onDelivery,
  refresh,
}: {
  current: AccountClass;
  classes: AccountClass[];
  onDelivery: (d: Delivery) => void;
  refresh: number;
}) {
  const { call } = useStaffSession();
  const online = useOnlineStatus();
  const students = useRemote(`accounts:${current.courseId}`, (signal) => accountsApi.students(call, current.courseId, signal));
  const { reload } = students;
  useEffect(() => {
    if (refresh > 0) reload();
  }, [refresh, reload]);
  const [resetting, setResetting] = useState<StudentAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const clearSuccess = useCallback(() => setSuccess(null), []);

  async function confirmReset() {
    if (!resetting) return;
    const password = generatePassword();
    setBusy(true);
    setDialogError(null);
    try {
      await accountsApi.resetPassword(call, resetting.userId, password);
      onDelivery({ name: resetting.displayName, username: resetting.username, password, courseName: current.courseName, reason: 'restablecida' });
      setResetting(null);
      students.reload();
    } catch (err) {
      setDialogError(errorMessage(err, { notFound: 'Ese estudiante ya no está en tu curso.' }));
    } finally {
      setBusy(false);
    }
  }

  async function move(student: StudentAccount, target: string) {
    if (target === student.courseId || moving || !online) return;
    setMoving(true);
    setError(null);
    try {
      await accountsApi.move(call, student.userId, target);
      const to = classes.find((c) => c.courseId === target);
      setSuccess(`${student.displayName} ahora está en ${to?.courseName ?? 'otro curso'}.`);
      students.reload();
    } catch (err) {
      setError(errorMessage(err, { notFound: 'No eres profesor de ese curso.' }));
    } finally {
      setMoving(false);
    }
  }

  const list = students.data ?? [];
  return (
    <section className="panel">
      <div className="row-between">
        <h2>
          Estudiantes de {current.courseName} ({list.length})
        </h2>
        <Updated at={students.updatedAt} />
      </div>
      <SuccessNote text={success} onDone={clearSuccess} />
      {error && <p className="form-error">{error}</p>}
      {students.loading && !students.data ? (
        <Loading />
      ) : students.error && !students.data ? (
        <ErrorState error={students.error} onRetry={students.reload} />
      ) : list.length === 0 ? (
        <Empty title="Aún no hay cuentas en este curso." />
      ) : (
        <ul className="roster">
          {list.map((s) => (
            <li key={s.userId} className="roster-row">
              <span className="roster-text">
                <strong>{s.displayName}</strong>
                <small>Usuario: {s.username}</small>
              </span>
              <span className="roster-actions">
                <button className="btn btn-small btn-secondary" disabled={!online} onClick={() => { setDialogError(null); setResetting(s); }}>
                  Nueva contraseña
                </button>
                {classes.length > 1 && (
                  <select aria-label={`Cambiar de curso a ${s.displayName}`} value={s.courseId} disabled={!online || moving} onChange={(e) => move(s, e.target.value)}>
                    {classes.map((c) => (
                      <option key={c.courseId} value={c.courseId}>
                        {c.courseName}
                      </option>
                    ))}
                  </select>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">Las contraseñas no se pueden consultar. Si un estudiante la olvida, crea una nueva.</p>
      {resetting && (
        <ConfirmDialog
          title={`¿Nueva contraseña para ${resetting.displayName}?`}
          confirmLabel="Crear contraseña nueva"
          busy={busy}
          error={dialogError}
          onCancel={() => setResetting(null)}
          onConfirm={confirmReset}
        >
          <p>La contraseña anterior dejará de funcionar. Verás la nueva una sola vez para entregarla.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}

/** Ficha para entregar las credenciales. Al cerrarla, la contraseña desaparece de la app. */
export function DeliveryCard({ delivery, onDone }: { delivery: Delivery; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `MayaMente\nEstudiante: ${delivery.name}\nCurso: ${delivery.courseName}\nUsuario: ${delivery.username}\nContraseña: ${delivery.password}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="panel delivery" role="status" aria-labelledby="delivery-title">
      <h2 id="delivery-title">
        {delivery.reason === 'nueva' ? 'Cuenta creada' : 'Contraseña nueva'}: entrega estos datos a {delivery.name}
      </h2>
      <dl className="delivery-data">
        <dt>Curso</dt>
        <dd>{delivery.courseName}</dd>
        <dt>Usuario</dt>
        <dd className="mono">{delivery.username}</dd>
        <dt>Contraseña</dt>
        <dd className="mono">{delivery.password}</dd>
      </dl>
      <p className="hint">Al pulsar “Listo” la contraseña ya no se podrá ver. Si se olvida, crea una nueva.</p>
      <div className="delivery-actions">
        <button className="btn btn-small btn-secondary" onClick={copy}>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <button className="btn btn-small btn-secondary" onClick={() => window.print()}>
          Imprimir
        </button>
        <button className="btn btn-small btn-primary" onClick={onDone}>
          Listo
        </button>
      </div>
    </section>
  );
}

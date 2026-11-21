import { useCallback, useState, type FormEvent } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useStaffSession } from './StaffSession';
import { coursesApi, TOPIC_LIMITS, topicsApi, type Course } from './services';
import { Empty, ErrorState, errorMessage, fieldErrorsOf, Loading, SuccessNote, TextField, Updated, useRemote } from './ui';

/**
 * Temas escolares de los cursos (tabla `topics`). Son contenidos del curso,
 * distintos del catálogo global de práctica (`temas`) y sin relación con
 * ejercicios en el backend actual.
 */
export function TopicsBrowser({
  schoolId,
  canPublish,
  role,
  course,
  onCourseChange,
}: {
  schoolId: string;
  /** Publicar es solo para el profesor asignado; el servidor lo confirma. */
  canPublish: (course: Course) => boolean;
  role: 'DIRECTOR' | 'PROFESOR';
  course?: string | null;
  onCourseChange?: (id: string | null) => void;
}) {
  const { call } = useStaffSession();
  const courses = useRemote(`courses:${schoolId}`, (signal) => coursesApi.list(call, schoolId, signal));
  const [localCourse, setLocalCourse] = useState<string | null>(null);
  const selectedId = course !== undefined ? course : localCourse;
  const select = (id: string | null) => (onCourseChange ? onCourseChange(id) : setLocalCourse(id));
  const list = courses.data ?? [];
  const selected = list.find((c) => c.id === selectedId) ?? list[0] ?? null;

  return (
    <div className="staff-page">
      <h1>Temas</h1>
      <p className="hint">
        Contenidos publicados en cada curso. {role === 'DIRECTOR' ? 'Publicarlos corresponde a los profesores asignados.' : ''}
      </p>
      {courses.loading && !courses.data ? (
        <Loading />
      ) : courses.error && !courses.data ? (
        <ErrorState error={courses.error} onRetry={courses.reload} />
      ) : list.length === 0 ? (
        <Empty title={role === 'DIRECTOR' ? 'El colegio aún no tiene cursos.' : 'No tienes cursos asignados en este colegio.'}>
          {role === 'PROFESOR' && <p>Pide a tu director que te asigne a un curso.</p>}
        </Empty>
      ) : (
        <>
          <label className="inline-select panel">
            <span>Curso</span>
            <select value={selected?.id ?? ''} onChange={(e) => select(e.target.value)}>
              {list.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {selected && <CourseTopics key={selected.id} schoolId={schoolId} course={selected} canPublish={canPublish(selected)} />}
        </>
      )}
    </div>
  );
}

function CourseTopics({ schoolId, course, canPublish }: { schoolId: string; course: Course; canPublish: boolean }) {
  const { call, session } = useStaffSession();
  const online = useOnlineStatus();
  const topics = useRemote(`topics:${course.id}`, (signal) => topicsApi.list(call, schoolId, course.id, signal));
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const clearSuccess = useCallback(() => setSuccess(null), []);

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const topic = await topicsApi.create(call, schoolId, course.id, title.trim(), content.trim());
      setSuccess(`Tema “${topic.title}” publicado en ${course.name}.`);
      setTitle('');
      setContent('');
      topics.reload();
    } catch (err) {
      setError(err); // el formulario se conserva
    } finally {
      setBusy(false);
    }
  }

  const fields = fieldErrorsOf(error);
  const list = topics.data ?? [];

  return (
    <>
      <SuccessNote text={success} onDone={clearSuccess} />
      {canPublish && (
        <form className="panel staff-form" onSubmit={publish} noValidate>
          <h2>Publicar tema en {course.name}</h2>
          <TextField label="Título" value={title} onChange={setTitle} maxLength={TOPIC_LIMITS.title} error={fields.title} />
          <TextField
            label="Contenido"
            value={content}
            onChange={setContent}
            maxLength={TOPIC_LIMITS.content}
            error={fields.content}
            multiline
          />
          {Boolean(error) && (
            <p className="form-error">
              {errorMessage(error, { forbidden: 'Solo el profesor asignado a este curso puede publicar temas.' })}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy || !title.trim() || !content.trim() || !online}>
            {busy ? 'Publicando…' : 'Publicar tema'}
          </button>
        </form>
      )}
      <section className="panel">
        <div className="row-between">
          <h2>
            Temas de {course.name} ({list.length})
          </h2>
          <Updated at={topics.updatedAt} />
        </div>
        {topics.loading && !topics.data ? (
          <Loading />
        ) : topics.error && !topics.data ? (
          <ErrorState error={topics.error} onRetry={topics.reload} />
        ) : list.length === 0 ? (
          <Empty title="Este curso aún no tiene temas." />
        ) : (
          <ul className="topic-list">
            {list.map((t) => (
              <li key={t.id} className="topic-item">
                <button className="topic-head" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)}>
                  <strong>{t.title}</strong>
                  {t.createdBy === session?.user.id && <span className="tag">Publicado por ti</span>}
                </button>
                {open === t.id && <p className="topic-content">{t.content}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

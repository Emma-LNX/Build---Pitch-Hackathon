import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ChevronIcon, EyeIcon } from '../../components/icons';
import { TempleArt } from '../../components/TempleArt';
import { ApiError } from '../../lib/api';
import { DirectorArea } from './director';
import { directorsApi, NAME_LIMITS, schoolsApi, type DirectorProfile, type School } from './services';
import { StaffSessionProvider, useStaffSession } from './StaffSession';
import { authConfigured, AuthError, type AuthErrorKind } from './supabaseAuth';
import { TeacherArea } from './teacher';
import { Empty, ErrorState, errorMessage, Loading, OfflineNotice, TextField, useRemote } from './ui';

const AUTH_MESSAGES: Record<AuthErrorKind, string> = {
  credenciales: 'Correo o contraseña incorrectos.',
  'correo-sin-confirmar': 'Tu correo aún no está confirmado.',
  'cuenta-existente': 'Ya existe una cuenta con ese correo. Inicia sesión.',
  'contrasena-debil': 'La contraseña es muy débil. Usa al menos 8 caracteres con letras y números.',
  'demasiados-intentos': 'Demasiados intentos. Espera unos minutos.',
  'enlace-vencido': 'El enlace de confirmación venció o ya se usó. Pide uno nuevo.',
  'sin-conexion': 'Sin conexión. Iniciar sesión necesita internet.',
  'sin-configuracion': 'Falta la configuración pública de Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).',
  servidor: 'El servicio de acceso no respondió. Intenta de nuevo.',
};
const authMessage = (e: unknown) => (e instanceof AuthError ? AUTH_MESSAGES[e.kind] : AUTH_MESSAGES.servidor);

export function StaffApp() {
  return (
    <StaffSessionProvider>
      <StaffGate />
    </StaffSessionProvider>
  );
}

function StaffGate() {
  const { status } = useStaffSession();
  if (!authConfigured) {
    return (
      <StaffShell>
        <div className="panel">
          <h2>Configuración pendiente</h2>
          <p>{AUTH_MESSAGES['sin-configuracion']}</p>
          <p className="hint">Son datos públicos del proyecto Supabase. Ver docs/staff-frontend.md.</p>
        </div>
      </StaffShell>
    );
  }
  if (status === 'cargando') return <StaffShell><Loading label="Comprobando tu sesión…" /></StaffShell>;
  if (status === 'pendiente-confirmacion') return <StaffShell><PendingConfirmation /></StaffShell>;
  if (status !== 'con-sesion') return <StaffShell><StaffLogin expired={status === 'vencida'} /></StaffShell>;
  return <AccessGate />;
}

function StaffShell({ children }: { children: ReactNode }) {
  return (
    <div className="staff-entry">
      <header className="staff-entry-head">
        <Link to="/" className="round-btn" aria-label="Ir al acceso de estudiantes">
          <ChevronIcon dir="left" className="round-btn-icon" />
        </Link>
        <TempleArt world="tikal" className="staff-entry-logo" />
        <div>
          <p className="staff-brand">MayaMente</p>
          <h1>Profes y dirección</h1>
        </div>
      </header>
      <OfflineNotice />
      {children}
    </div>
  );
}

/* ---------- Acceso y registro ---------- */

function StaffLogin({ expired }: { expired: boolean }) {
  const { login, register, redirectError } = useStaffSession();
  const [mode, setMode] = useState<'entrar' | 'registro'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return setError('Escribe tu correo y tu contraseña.');
    if (mode === 'registro') {
      if (password.length < 8) return setError('Usa una contraseña de al menos 8 caracteres.');
      if (password !== confirm) return setError('Las contraseñas no coinciden.');
    }
    setBusy(true);
    try {
      if (mode === 'entrar') await login(email, password);
      else await register(email, password);
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {expired && (
        <p className="form-error" role="alert">
          Tu sesión venció. Vuelve a entrar.
        </p>
      )}
      {redirectError && (
        <p className="form-error" role="alert">
          {AUTH_MESSAGES[redirectError]}
        </p>
      )}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'entrar'} className="tab" onClick={() => setMode('entrar')}>
          Entrar
        </button>
        <button role="tab" aria-selected={mode === 'registro'} className="tab" onClick={() => setMode('registro')}>
          Crear cuenta de director
        </button>
      </div>
      <form className="panel staff-form" onSubmit={submit} noValidate>
        {mode === 'registro' && (
          <p className="hint">
            Crea tu cuenta con tu correo. Te enviaremos un enlace para confirmarlo; después activarás tu perfil de director. Los
            profesores no se registran aquí: su director los añade al colegio.
          </p>
        )}
        <TextField label="Correo" type="email" value={email} onChange={setEmail} autoComplete="username" maxLength={254} />
        <div className="field">
          <label htmlFor="staff-pass">Contraseña</label>
          <div className="password-row">
            <input
              id="staff-pass"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
            />
            <button type="button" className="peek-btn" aria-pressed={show} onClick={() => setShow((v) => !v)}>
              <EyeIcon className="peek-icon" />
              {show ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>
        {mode === 'registro' && (
          <TextField label="Repite la contraseña" type={show ? 'text' : 'password'} value={confirm} onChange={setConfirm} autoComplete="new-password" />
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-block" disabled={busy || !navigator.onLine}>
          {busy ? 'Un momento…' : mode === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
    </>
  );
}

function PendingConfirmation() {
  const { pendingEmail, resend, backToLogin } = useStaffSession();
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="panel">
      <h2>Confirma tu correo</h2>
      <p>
        Enviamos un enlace a <strong>{pendingEmail}</strong>. Ábrelo en este dispositivo para confirmar tu cuenta y vuelve a entrar.
      </p>
      <p className="hint">Si no llega en unos minutos, revisa la carpeta de spam o pide otro enlace.</p>
      {error && <p className="form-error">{error}</p>}
      {state === 'sent' && <p className="success-note">Enlace enviado otra vez.</p>}
      <div className="row-actions">
        <button
          className="btn btn-small btn-secondary"
          disabled={state === 'busy'}
          onClick={async () => {
            setError(null);
            setState('busy');
            try {
              await resend();
              setState('sent');
            } catch (e) {
              setError(authMessage(e));
              setState('idle');
            }
          }}
        >
          {state === 'busy' ? 'Enviando…' : 'Reenviar enlace'}
        </button>
        <button className="btn btn-small btn-primary" onClick={backToLogin}>
          Ya confirmé: entrar
        </button>
      </div>
    </div>
  );
}

/* ---------- Roles y contexto ---------- */

export type DirectorState =
  | { kind: 'activo'; profile: DirectorProfile }
  | { kind: 'sin-perfil' }
  | { kind: 'correo-sin-confirmar' };

export interface Access {
  schools: School[];
  director: DirectorState;
}

/** Roles y colegios desde el backend (nunca del token, el correo ni user_metadata). */
async function loadAccess(call: ReturnType<typeof useStaffSession>['call'], signal: AbortSignal): Promise<Access> {
  const [schools, director] = await Promise.all([
    schoolsApi.list(call, signal),
    directorsApi.me(call, signal).then(
      (profile): DirectorState => ({ kind: 'activo', profile }),
      (error): DirectorState => {
        if (error instanceof ApiError && error.status === 404) return { kind: 'sin-perfil' };
        if (error instanceof ApiError && error.status === 403) return { kind: 'correo-sin-confirmar' };
        throw error;
      },
    ),
  ]);
  return { schools, director };
}

/** Director activo sin colegios: ruta estática para no confundirla con un id de colegio. */
export const NO_SCHOOL_BASE = '/profe/director/nuevo';

interface ContextOption {
  path: string;
  role: 'DIRECTOR' | 'PROFESOR';
  schoolId: string | null;
  schoolName: string;
}

function contextsOf(access: Access): ContextOption[] {
  const list: ContextOption[] = [];
  for (const s of access.schools) {
    if (s.role === 'DIRECTOR') list.push({ path: `/profe/director/${s.id}`, role: 'DIRECTOR', schoolId: s.id, schoolName: s.name });
    if (s.role === 'PROFESOR') list.push({ path: `/profe/profesor/${s.id}`, role: 'PROFESOR', schoolId: s.id, schoolName: s.name });
  }
  // Perfil de director activo sin colegios todavía
  if (access.director.kind === 'activo' && !list.some((c) => c.role === 'DIRECTOR')) {
    list.push({ path: NO_SCHOOL_BASE, role: 'DIRECTOR', schoolId: null, schoolName: 'Sin colegio' });
  }
  return list;
}

function AccessGate() {
  const { call, session } = useStaffSession();
  const userId = session!.user.id;
  // La clave incluye la cuenta: otra cuenta nunca ve datos de la anterior
  const access = useRemote(`access:${userId}`, (signal) => loadAccess(call, signal));

  if (access.loading && !access.data) return <StaffShell><Loading label="Cargando tus colegios y roles…" /></StaffShell>;
  if (access.error && !access.data) {
    return (
      <StaffShell>
        <ErrorState error={access.error} onRetry={access.reload} />
      </StaffShell>
    );
  }
  const data = access.data!;
  const contexts = contextsOf(data);
  return (
    <Routes>
      <Route index element={<ContextChooser access={data} contexts={contexts} />} />
      <Route path="activar" element={<ActivateDirector access={data} onActivated={access.reload} />} />
      <Route
        path="director/nuevo/*"
        element={
          data.director.kind === 'activo' ? (
            <AreaFrame contexts={contexts} role="DIRECTOR" schoolId={null}>
              <DirectorArea access={data} schoolId={null} onAccessChange={access.reload} />
            </AreaFrame>
          ) : (
            <Navigate to="/profe" replace />
          )
        }
      />
      <Route path="director/:schoolId/*" element={<DirectorRoute access={data} contexts={contexts} onAccessChange={access.reload} />} />
      <Route path="profesor/:schoolId/*" element={<TeacherRoute access={data} contexts={contexts} />} />
      <Route path="*" element={<Navigate to="/profe" replace />} />
    </Routes>
  );
}

function DirectorRoute({ access, contexts, onAccessChange }: { access: Access; contexts: ContextOption[]; onAccessChange: () => void }) {
  const { schoolId = '' } = useParams();
  // Solo colegios donde el backend indica rol DIRECTOR
  if (!access.schools.some((s) => s.id === schoolId && s.role === 'DIRECTOR')) return <Navigate to="/profe" replace />;
  return (
    <AreaFrame contexts={contexts} role="DIRECTOR" schoolId={schoolId}>
      {/* key: al cambiar de colegio se desmonta todo y se limpian los datos anteriores */}
      <DirectorArea key={schoolId} access={access} schoolId={schoolId} onAccessChange={onAccessChange} />
    </AreaFrame>
  );
}

function TeacherRoute({ access, contexts }: { access: Access; contexts: ContextOption[] }) {
  const { schoolId = '' } = useParams();
  if (!access.schools.some((s) => s.id === schoolId && s.role === 'PROFESOR')) return <Navigate to="/profe" replace />;
  return (
    <AreaFrame contexts={contexts} role="PROFESOR" schoolId={schoolId}>
      <TeacherArea key={schoolId} access={access} schoolId={schoolId} />
    </AreaFrame>
  );
}

function ContextChooser({ access, contexts }: { access: Access; contexts: ContextOption[] }) {
  const navigate = useNavigate();
  const { logout, session } = useStaffSession();
  // Con un único contexto se abre directamente su panel
  useEffect(() => {
    if (contexts.length === 1) navigate(contexts[0].path, { replace: true });
  }, [contexts, navigate]);
  if (contexts.length === 1) return null;

  const onlyStudent = access.schools.length > 0 && access.schools.every((s) => s.role === 'ALUMNO');
  return (
    <StaffShell>
      <section className="panel">
        <h2>¿Dónde vas a trabajar?</h2>
        <p className="hint">Cuenta: {session?.user.email}</p>
        {contexts.length === 0 ? (
          <Empty title={onlyStudent ? 'Esta cuenta es de estudiante.' : 'Tu cuenta todavía no tiene acceso a un colegio.'}>
            {access.director.kind === 'correo-sin-confirmar' ? (
              <p>Confirma tu correo para poder activar un perfil de director.</p>
            ) : (
              <>
                <p>Si eres profesor, pide a tu director que te añada al colegio con este correo.</p>
                <p>Si diriges un colegio, activa tu perfil de director para crear uno.</p>
                <Link className="btn btn-small btn-secondary" to="/profe/activar">
                  Activar perfil de director
                </Link>
              </>
            )}
          </Empty>
        ) : (
          <ul className="context-list">
            {contexts.map((c) => (
              <li key={c.path}>
                <Link className="context-card" to={c.path}>
                  <span className={`role-badge role-${c.role.toLowerCase()}`}>{c.role === 'DIRECTOR' ? 'Director' : 'Profesor'}</span>
                  <strong>{c.schoolName}</strong>
                  <ChevronIcon className="context-go" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {contexts.length > 0 && access.director.kind === 'sin-perfil' && (
          <p className="hint">
            ¿También diriges un colegio? <Link to="/profe/activar">Activar perfil de director</Link>
          </p>
        )}
      </section>
      <button className="btn btn-secondary btn-block" onClick={() => void logout()}>
        Cerrar sesión
      </button>
    </StaffShell>
  );
}

/** Activación explícita: nunca se hace automáticamente al entrar con una cuenta de profesor. */
function ActivateDirector({ access, onActivated }: { access: Access; onActivated: () => void }) {
  const { call } = useStaffSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Tras activar se espera a que el servidor lo confirme y se abre el área del director
  const [activated, setActivated] = useState(false);

  if (access.director.kind === 'activo') return <Navigate to={activated ? NO_SCHOOL_BASE : '/profe'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await directorsApi.register(call, name.trim());
      setActivated(true);
      onActivated();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <StaffShell>
      <form className="panel staff-form" onSubmit={submit} noValidate>
        <h2>Activar perfil de director</h2>
        {access.director.kind === 'correo-sin-confirmar' ? (
          <p className="form-error">Primero confirma tu correo. Después podrás activar el perfil.</p>
        ) : (
          <p className="hint">
            Con el perfil activo podrás crear colegios nuevos. No da acceso a colegios que ya existen ni a los de otros directores.
          </p>
        )}
        <TextField label="Nombre completo" value={name} onChange={setName} maxLength={NAME_LIMITS.director} autoComplete="name" />
        {Boolean(error) && <p className="form-error">{errorMessage(error, { forbidden: 'Confirma tu correo antes de activar el perfil.' })}</p>}
        <div className="row-actions">
          <Link to="/profe" className="btn btn-small btn-secondary">
            Cancelar
          </Link>
          <button className="btn btn-small btn-primary" disabled={busy || !name.trim() || !navigator.onLine}>
            {busy ? 'Activando…' : 'Activar'}
          </button>
        </div>
      </form>
    </StaffShell>
  );
}

/* ---------- Marco de cada área: barra lateral, contexto activo ---------- */

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

function AreaFrame({
  contexts,
  role,
  schoolId,
  children,
}: {
  contexts: ContextOption[];
  role: 'DIRECTOR' | 'PROFESOR';
  schoolId: string | null;
  children: ReactNode;
}) {
  const current = contexts.find((c) => c.role === role && c.schoolId === schoolId);
  return (
    <div className="staff-app" data-role={role.toLowerCase()}>
      <header className="staff-top">
        <div className="staff-context">
          <span className={`role-badge role-${role.toLowerCase()}`}>{role === 'DIRECTOR' ? 'Director' : 'Profesor'}</span>
          <strong className="staff-school">{current?.schoolName ?? 'Sin colegio'}</strong>
        </div>
        {contexts.length > 1 && (
          <Link to="/profe" className="btn btn-small btn-secondary">
            Cambiar
          </Link>
        )}
      </header>
      <OfflineNotice />
      {children}
    </div>
  );
}

/** Navegación del área: lateral en escritorio, inferior en móvil. */
export function AreaNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="staff-nav" aria-label="Secciones">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="staff-nav-item">
          <span className="staff-nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function useAccessSchools(access: Access) {
  return useMemo(() => access.schools, [access]);
}

export function useStaffLogout() {
  const { logout } = useStaffSession();
  const navigate = useNavigate();
  return useCallback(async () => {
    await logout();
    navigate('/profe', { replace: true });
  }, [logout, navigate]);
}

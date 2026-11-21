import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CloudOffIcon } from '../../components/icons';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { ApiError, isAbort, OfflineError } from '../../lib/api';
import { SessionExpiredError } from './StaffSession';

/* ---------- Carga remota sin respuestas tardías ---------- */

export interface Remote<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Hora de la última respuesta correcta del servidor. */
  updatedAt: Date | null;
  reload: () => void;
}

/**
 * Carga datos y descarta respuestas de una selección anterior (colegio, curso,
 * cuenta): cada cambio de `key` cancela la petición previa.
 */
export function useRemote<T>(key: string | null, loader: (signal: AbortSignal) => Promise<T>): Remote<T> {
  const [state, setState] = useState<{ key: string | null; data?: T; error?: unknown; loading: boolean; updatedAt: Date | null }>({
    key,
    loading: key !== null,
    updatedAt: null,
  });
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (key === null) {
      setState({ key, loading: false, updatedAt: null });
      return;
    }
    const controller = new AbortController();
    // Al cambiar de selección se limpian los datos visibles del contexto anterior
    setState((s) => (s.key === key ? { ...s, loading: true, error: undefined } : { key, loading: true, updatedAt: null }));
    loaderRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, loading: false, updatedAt: new Date() });
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbort(error)) return;
        // Si se retiró el permiso, tampoco se conserva la respuesta anterior.
        const denied = error instanceof ApiError && [401, 403, 404].includes(error.status);
        setState((s) => ({ ...s, ...(denied ? { data: undefined, updatedAt: null } : {}), key, error, loading: false }));
      });
    return () => controller.abort();
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: current ? state.loading : key !== null,
    updatedAt: current ? state.updatedAt : null,
    reload,
  };
}

/* ---------- Mensajes de error según el endpoint ---------- */

export interface ErrorContext {
  /** Qué significa 404 en esta operación. */
  notFound?: string;
  /** Qué significa 403 en esta operación. */
  forbidden?: string;
  /** Qué significa 409 en esta operación (si el servidor no da detalle). */
  conflict?: string;
}

export function errorMessage(error: unknown, ctx: ErrorContext = {}): string {
  if (error instanceof SessionExpiredError) return 'Tu sesión venció. Vuelve a entrar.';
  if (error instanceof OfflineError) return 'Sin conexión. Esta operación necesita internet.';
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return Object.keys(error.fieldErrors).length ? 'Revisa los campos marcados.' : error.message || 'Revisa los datos enviados.';
      case 403:
        return ctx.forbidden ?? (error.message && !error.message.startsWith('Error') ? error.message : 'No tienes permiso para esta acción.');
      case 404:
        return ctx.notFound ?? 'No está disponible o no tienes acceso.';
      case 409:
        return error.message && !error.message.startsWith('Error') ? error.message : ctx.conflict ?? 'Entra en conflicto con los datos actuales.';
      case 503:
        return 'El servicio no está disponible. Intenta de nuevo más tarde.';
      default:
        return error.message || 'Ocurrió un error en el servidor.';
    }
  }
  return 'Ocurrió un error inesperado.';
}

export function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fieldErrors : {};
}

/* ---------- Estados ---------- */

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <p className="state state-loading" role="status">
      <span className="spinner spinner-dark" aria-hidden="true" /> {label}
    </p>
  );
}

export function ErrorState({ error, onRetry, ctx }: { error: unknown; onRetry?: () => void; ctx?: ErrorContext }) {
  return (
    <div className="state state-error" role="alert">
      <p>{errorMessage(error, ctx)}</p>
      {onRetry && !(error instanceof SessionExpiredError) && (
        <button className="btn btn-small btn-secondary" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state state-empty">
      <strong>{title}</strong>
      {children && <div className="state-next">{children}</div>}
    </div>
  );
}

export function Updated({ at }: { at: Date | null }) {
  if (!at) return null;
  return (
    <span className="updated">
      Actualizado a las {at.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

/** Aviso y bloqueo de operaciones remotas sin conexión. */
export function useRemoteAllowed(): boolean {
  return useOnlineStatus();
}

export function OfflineNotice() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <p className="offline-banner staff-offline" role="status">
      <CloudOffIcon className="offline-icon" />
      <span>Sin conexión. Ves los datos ya cargados; los cambios están desactivados hasta que vuelva internet.</span>
    </p>
  );
}

export function SuccessNote({ text, onDone }: { text: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!text) return;
    const t = window.setTimeout(onDone, 4000);
    return () => window.clearTimeout(t);
  }, [text, onDone]);
  if (!text) return null;
  return (
    <p className="success-note" role="status">
      {text}
    </p>
  );
}

/* ---------- Confirmación explícita ---------- */

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const online = useOnlineStatus();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        <div className="dialog-body">{children}</div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button ref={cancelRef} className="btn btn-small btn-secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button className={`btn btn-small ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy || !online}>
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Campo de formulario con error del servidor ---------- */

export function TextField({
  label,
  value,
  onChange,
  error,
  maxLength,
  type = 'text',
  hint,
  autoComplete,
  multiline,
  rows = 6,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  maxLength?: number;
  type?: string;
  hint?: string;
  autoComplete?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const id = useId();
  const describedBy = [error ? `${id}-err` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    value,
    maxLength,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type={type} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
      )}
      <span className="field-meta">
        {hint && <span id={`${id}-hint`}>{hint}</span>}
        {maxLength && (
          <span className="counter">
            {value.length}/{maxLength}
          </span>
        )}
      </span>
      {error && (
        <span id={`${id}-err`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}

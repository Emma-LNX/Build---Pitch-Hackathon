/**
 * Cliente de la API (`/api`, mismo origen). Los tokens de acceso viven solo en
 * memoria; nunca se guardan en localStorage ni IndexedDB.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Errores de validación por campo (Problem Details `errors`). */
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** No hay conexión o el servidor no respondió. */
export class OfflineError extends Error {
  constructor() {
    super('Sin conexión');
  }
}

let accessToken: string | null = null;
let refresher: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Token de la cuenta estudiantil activa, para fijar la identidad de un lote offline. */
export function getStudentAccessToken(): string | null { return accessToken; }

/** Renueva el token de acceso cuando vence (lo registra la sesión del estudiante). */
export function setTokenRefresher(fn: (() => Promise<string | null>) | null) {
  refresher = fn;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** false para rutas públicas (inicio de sesión). */
  auth?: boolean;
  /** Token explícito (panel docente y de dirección), en lugar del del estudiante. */
  token?: string | null;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, token, signal } = options;
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new OfflineError();

  const send = (bearer: string | null) =>
    fetch(`/api${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response: Response;
  try {
    response = await send(token ?? accessToken);
    // Token vencido: renovar una vez y reintentar (solo sesión del estudiante)
    if (response.status === 401 && auth && token === undefined && refresher) {
      const renewed = await refresher();
      if (renewed) response = await send(renewed);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new OfflineError();
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Convierte una respuesta de error (Problem Details) en ApiError. */
export async function toApiError(response: Response): Promise<ApiError> {
  let detail = '';
  let fieldErrors: Record<string, string> = {};
  try {
    const problem = await response.json();
    detail = typeof problem?.detail === 'string' ? problem.detail : '';
    if (problem?.errors && typeof problem.errors === 'object') fieldErrors = problem.errors;
  } catch {
    // sin cuerpo
  }
  return new ApiError(response.status, detail || `Error ${response.status}`, fieldErrors);
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

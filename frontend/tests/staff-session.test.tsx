import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffSessionProvider, SessionExpiredError, useStaffSession } from '../src/features/staff/StaffSession';
import { AuthError, type AuthSession } from '../src/features/staff/supabaseAuth';

const auth = vi.hoisted(() => ({
  refreshSession: vi.fn(), getUser: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
}));
vi.mock('../src/features/staff/supabaseAuth', async (original) => ({
  ...await original<typeof import('../src/features/staff/supabaseAuth')>(), ...auth,
}));

const session = (token = 'first', id = 'teacher'): AuthSession => ({
  accessToken: token, refreshToken: `refresh-${token}`, expiresAt: Date.now() + 3600_000,
  user: { id, email: `${id}@example.test`, emailConfirmed: true },
});
const wrapper = ({ children }: { children: ReactNode }) => (
  <StrictMode><StaffSessionProvider>{children}</StaffSessionProvider></StrictMode>
);
const response = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  sessionStorage.clear();
  history.replaceState(null, '', '/profe');
  auth.refreshSession.mockReset().mockResolvedValue(session());
  auth.getUser.mockReset().mockResolvedValue(session().user);
  auth.signIn.mockReset().mockResolvedValue(session());
  auth.signOut.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('sesiones de profesores y directores', () => {
  it('restaura una sola vez el refresh token bajo StrictMode', async () => {
    sessionStorage.setItem('mayamente.staff.refresh', 'stored');
    const { result } = renderHook(useStaffSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('con-sesion'));
    expect(auth.refreshSession).toHaveBeenCalledExactlyOnceWith('stored');
    expect(sessionStorage.getItem('mayamente.staff.refresh')).toBe('refresh-first');
  });

  it('consume el enlace de confirmación una vez y elimina los tokens de la URL', async () => {
    history.replaceState(null, '', '/profe#access_token=confirmed&refresh_token=refresh-confirmed&expires_in=3600');
    const { result } = renderHook(useStaffSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('con-sesion'));
    expect(auth.getUser).toHaveBeenCalledExactlyOnceWith('confirmed');
    expect(auth.refreshSession).not.toHaveBeenCalled();
    expect(location.hash).toBe('');
    expect(result.current.session?.accessToken).toBe('confirmed');
  });

  it('comparte la renovación entre peticiones que reciben 401 simultáneos', async () => {
    sessionStorage.setItem('mayamente.staff.refresh', 'stored');
    const { result } = renderHook(useStaffSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('con-sesion'));
    const next = deferred<AuthSession>();
    auth.refreshSession.mockReturnValueOnce(next.promise);
    vi.mocked(fetch).mockImplementation(async (_url, init) =>
      (init?.headers as Record<string, string>).Authorization === 'Bearer first'
        ? response(401) : response(200, { ok: true }));
    let requests!: Promise<unknown[]>;
    act(() => { requests = Promise.all([result.current.call('/schools'), result.current.call('/directors/me')]); });
    await waitFor(() => expect(auth.refreshSession).toHaveBeenCalledTimes(2));
    await act(async () => { next.resolve(session('renewed')); await requests; });
    expect(auth.refreshSession).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('cerrar sesión durante una renovación no permite que la respuesta la reabra', async () => {
    sessionStorage.setItem('mayamente.staff.refresh', 'stored');
    const { result } = renderHook(useStaffSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('con-sesion'));
    const next = deferred<AuthSession>();
    auth.refreshSession.mockReturnValueOnce(next.promise);
    vi.mocked(fetch).mockResolvedValue(response(401));
    let request!: Promise<unknown>;
    act(() => { request = result.current.call('/schools').catch((e) => e); });
    await waitFor(() => expect(auth.refreshSession).toHaveBeenCalledTimes(2));
    await act(async () => { await result.current.logout(); });
    await act(async () => { next.resolve(session('late')); await request; });
    expect(result.current.status).toBe('sin-sesion');
    expect(sessionStorage.getItem('mayamente.staff.refresh')).toBeNull();
    expect(await request).toBeInstanceOf(SessionExpiredError);
  });

  it('descarta una respuesta de la cuenta anterior después de cambiar de usuario', async () => {
    sessionStorage.setItem('mayamente.staff.refresh', 'stored');
    const { result } = renderHook(useStaffSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('con-sesion'));
    const old = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(old.promise);
    let request!: Promise<unknown>;
    act(() => { request = result.current.call('/schools').catch((e) => e); });
    await act(async () => { await result.current.logout(); });
    auth.signIn.mockResolvedValueOnce(session('second', 'director'));
    await act(async () => { await result.current.login('director@example.test', 'password'); });
    await act(async () => { old.resolve(response(200, ['private-teacher-data'])); await request; });
    expect(await request).toBeInstanceOf(SessionExpiredError);
    expect(result.current.session?.user.id).toBe('director');
  });

  it('un refresh rechazado invalida la sesión y borra su token', async () => {
    sessionStorage.setItem('mayamente.staff.refresh', 'stored');
    const { result } = renderHook(useStaffSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('con-sesion'));
    vi.mocked(fetch).mockResolvedValue(response(401));
    auth.refreshSession.mockRejectedValueOnce(new AuthError('credenciales'));
    await act(async () => { await expect(result.current.call('/schools')).rejects.toBeInstanceOf(SessionExpiredError); });
    expect(result.current.status).toBe('vencida');
    expect(sessionStorage.getItem('mayamente.staff.refresh')).toBeNull();
  });
});

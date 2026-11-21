import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, OfflineError, setAccessToken, setTokenRefresher } from '../../lib/api';
import { deleteSession, getSession, loadStartup, saveSession } from '../../offline/storage/db';
import type { Gender, Profile } from '../../types';
import { useProgress } from '../progress/ProgressContext';

/**
 * Sesión del estudiante.
 *
 * - AUTENTICAR (usuario + contraseña) requiere conexión: la contraseña la valida
 *   el servidor (Supabase Auth a través de la API). Nunca se guarda en el teléfono.
 * - CONTINUAR una sesión preparada ("Continuar como…") usa el refresh token
 *   guardado tras un acceso correcto. Sin conexión abre los datos locales,
 *   sin fingir que se validó una contraseña.
 * - CERRAR SESIÓN borra ese token y oculta los datos: para volver hay que autenticarse.
 */

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface MyClass {
  userId: string;
  displayName: string;
  username: string;
  schoolId: string;
  schoolName: string;
  courseId: string;
  courseName: string;
  gender: 'NINA' | 'NINO' | null;
}

export type LoginError = 'credenciales' | 'sin-conexion' | 'demasiados-intentos' | 'sin-clase' | 'servidor';

export class LoginFailure extends Error {
  constructor(public readonly reason: LoginError) {
    super(reason);
  }
}

/** La sesión preparada ya no es válida en el servidor (venció o se cerró en otro lado). */
export class SessionEndedError extends Error {}

const toApiGender = (g: Gender) => (g === 'nina' ? 'NINA' : 'NINO');
const fromApiGender = (g: MyClass['gender']): Gender | null => (g === 'NINA' ? 'nina' : g === 'NINO' ? 'nino' : null);

interface AuthValue {
  status: 'loading' | 'signed-out' | 'signed-in';
  /** Cuentas con sesión preparada en este teléfono (para "Continuar como…"). */
  accounts: Profile[];
  login: (username: string, password: string, gender: Gender) => Promise<void>;
  continueAs: (studentId: string) => Promise<void>;
  logout: () => Promise<void>;
  changeGender: (gender: Gender) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { openStudent, closeStudent, saveProfile, updateGender, profile } = useProgress();
  const [status, setStatus] = useState<AuthValue['status']>('loading');
  const [accounts, setAccounts] = useState<Profile[]>([]);
  const currentId = useRef<string | null>(null);

  const reloadAccounts = useCallback(async () => {
    const startup = await loadStartup();
    setAccounts(startup.accounts);
    return startup.accounts;
  }, []);

  // Al abrir la app no se entra automáticamente: en teléfonos compartidos,
  // cada estudiante elige su cuenta o se autentica.
  useEffect(() => {
    reloadAccounts().then(() => setStatus('signed-out'));
  }, [reloadAccounts]);

  /** Renueva el token con el refresh token guardado y lo rota. */
  const refreshFor = useCallback(async (studentId: string): Promise<string | null> => {
    const stored = await getSession(studentId);
    if (!stored) return null;
    try {
      const tokens = await api<SessionTokens>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: stored.refreshToken },
        auth: false,
      });
      await saveSession({ ...stored, refreshToken: tokens.refreshToken });
      setAccessToken(tokens.accessToken);
      return tokens.accessToken;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await deleteSession(studentId);
        throw new SessionEndedError();
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    setTokenRefresher(async () => {
      if (!currentId.current) return null;
      try {
        return await refreshFor(currentId.current);
      } catch {
        return null;
      }
    });
    return () => setTokenRefresher(null);
  }, [refreshFor]);

  /** Trae la clase desde la cuenta creada por el profesor y la guarda para usarla sin conexión. */
  const syncClass = useCallback(
    async (base: Profile | undefined, studentIdHint?: string): Promise<Profile> => {
      const mine = await api<MyClass>('/students/me/class');
      if (studentIdHint && mine.userId !== studentIdHint) throw new SessionEndedError();
      const next: Profile = {
        studentId: mine.userId,
        name: mine.displayName,
        username: mine.username,
        gender: base?.gender ?? fromApiGender(mine.gender),
        courseId: mine.courseId,
        courseName: mine.courseName,
        schoolName: mine.schoolName,
        genderPendingSync: base?.genderPendingSync,
      };
      return next;
    },
    [],
  );

  const pushGender = useCallback(async (p: Profile): Promise<Profile> => {
    if (!p.gender) return p;
    try {
      await api('/students/me', { method: 'PATCH', body: { gender: toApiGender(p.gender) } });
      return { ...p, genderPendingSync: false };
    } catch {
      return { ...p, genderPendingSync: true }; // se reintenta en el próximo acceso con conexión
    }
  }, []);

  const enter = useCallback(
    async (p: Profile) => {
      await saveProfile(p);
      currentId.current = p.studentId;
      await openStudent(p.studentId);
      setStatus('signed-in');
      await reloadAccounts();
    },
    [saveProfile, openStudent, reloadAccounts],
  );

  const login = useCallback(
    async (username: string, password: string, gender: Gender) => {
      if (!navigator.onLine) throw new LoginFailure('sin-conexion');
      let tokens: SessionTokens;
      try {
        tokens = await api<SessionTokens>('/auth/student/login', {
          method: 'POST',
          body: { username: username.trim(), password },
          auth: false,
        });
      } catch (error) {
        if (error instanceof OfflineError) throw new LoginFailure('sin-conexion');
        if (error instanceof ApiError && (error.status === 401 || error.status === 400)) throw new LoginFailure('credenciales');
        if (error instanceof ApiError && error.status === 429) throw new LoginFailure('demasiados-intentos');
        throw new LoginFailure('servidor');
      }
      setAccessToken(tokens.accessToken);
      try {
        const fromServer = await syncClass(undefined);
        const withGender = await pushGender({ ...fromServer, gender });
        // Acceso correcto con conexión: queda preparada para continuar sin internet
        await saveSession({ studentId: withGender.studentId, refreshToken: tokens.refreshToken, preparedAt: new Date().toISOString() });
        await enter(withGender);
      } catch (error) {
        setAccessToken(null);
        if (error instanceof ApiError && error.status === 404) throw new LoginFailure('sin-clase');
        throw new LoginFailure(error instanceof OfflineError ? 'sin-conexion' : 'servidor');
      }
    },
    [syncClass, pushGender, enter],
  );

  const continueAs = useCallback(
    async (studentId: string) => {
      const local = accounts.find((a) => a.studentId === studentId);
      const stored = await getSession(studentId);
      if (!local || !stored) throw new SessionEndedError();
      let next = local;
      if (navigator.onLine) {
        try {
          await refreshFor(studentId);
          // Actualiza la clase por si el profesor la cambió
          next = await syncClass(local, studentId);
          if (next.genderPendingSync) next = await pushGender(next);
        } catch (error) {
          if (error instanceof SessionEndedError) {
            setAccessToken(null);
            await reloadAccounts();
            throw error;
          }
          // Sin respuesta del servidor: continuar con los datos locales
        }
      }
      await enter(next);
    },
    [accounts, refreshFor, syncClass, pushGender, enter, reloadAccounts],
  );

  const logout = useCallback(async () => {
    const id = currentId.current;
    if (navigator.onLine) {
      try {
        await api('/auth/logout', { method: 'POST' });
      } catch {
        // El token se descarta igual en el teléfono
      }
    }
    if (id) await deleteSession(id);
    setAccessToken(null);
    currentId.current = null;
    closeStudent();
    setStatus('signed-out');
    await reloadAccounts();
  }, [closeStudent, reloadAccounts]);

  const changeGender = useCallback(
    async (gender: Gender) => {
      if (!profile) return;
      let pending = true;
      if (navigator.onLine) {
        try {
          await api('/students/me', { method: 'PATCH', body: { gender: toApiGender(gender) } });
          pending = false;
        } catch {
          pending = true;
        }
      }
      await updateGender(gender, pending);
    },
    [profile, updateGender],
  );

  const value = useMemo(
    () => ({ status, accounts, login, continueAs, logout, changeGender }),
    [status, accounts, login, continueAs, logout, changeGender],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '../src/lib/api';
import { getDailyCheckIn, pendingDailyCheckIns, saveDailyCheckIn } from '../src/offline/storage/db';
import { checkInDate, syncDailyCheckIns } from '../src/offline/sync/dailyCheckIns';
import { DailyCheckInGate } from '../src/features/wellbeing/DailyCheckInGate';
import type { DailyCheckIn } from '../src/types';

const state = vi.hoisted(() => ({ studentId: 'ana' }));
vi.mock('../src/features/progress/ProgressContext', () => ({
  useProgress: () => ({
    profile: { studentId: state.studentId, name: 'Ana', username: 'ana', gender: 'nina', courseId: '', courseName: '', schoolName: '' },
  }),
}));

const jwt = (sub: string) => `header.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.firma`;
const entry = (studentId: string, date: string, extra: Partial<DailyCheckIn> = {}): DailyCheckIn => ({
  studentId, date, sleepHours: 8.5, food: 'POCO', mood: 'CANSADO', timeZone: 'America/Guatemala',
  createdAt: `${date}T12:00:00Z`, synced: false, ...extra,
});
const echo = vi.fn(async (_url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body));
  return new Response(JSON.stringify({ date: body.date, ...body.answers, timeZone: 'America/Guatemala', createdAt: '2026-11-21T18:00:00Z' }));
});

let online = true;
Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });

beforeEach(() => {
  online = true;
  setAccessToken(null);
  echo.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('registro diario de bienestar', () => {
  it('conserva la primera respuesta del día y borra solo los días anteriores ya enviados', async () => {
    await saveDailyCheckIn(entry('ana', '2026-11-19', { synced: true }));
    await saveDailyCheckIn(entry('ana', '2026-11-20'));
    await saveDailyCheckIn(entry('ana', '2026-11-21'));
    const second = await saveDailyCheckIn(entry('ana', '2026-11-21', { mood: 'FELIZ' }));
    expect(second.mood).toBe('CANSADO');
    expect(await getDailyCheckIn('ana', '2026-11-19')).toBeUndefined();
    expect((await pendingDailyCheckIns('ana')).map((e) => e.date)).toEqual(['2026-11-20', '2026-11-21']);
  });

  it('envía los pendientes con su fecha original y los marca como enviados', async () => {
    await saveDailyCheckIn(entry('bea', '2026-11-20'));
    await saveDailyCheckIn(entry('bea', '2026-11-21', { sleepHours: null, food: 'PREFIERO_NO_RESPONDER' }));
    setAccessToken(jwt('bea'));
    vi.stubGlobal('fetch', echo);
    await syncDailyCheckIns('bea');
    const calls = echo.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual(['/api/students/me/daily-check-in/sync', '/api/students/me/daily-check-in/sync']);
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ date: '2026-11-20', answers: { sleepHours: 8.5, food: 'POCO', mood: 'CANSADO' } });
    expect(JSON.parse(String(calls[1][1].body)).answers).toEqual({ sleepHours: null, food: 'PREFIERO_NO_RESPONDER', mood: 'CANSADO' });
    expect(await pendingDailyCheckIns('bea')).toEqual([]);
    expect((await getDailyCheckIn('bea', '2026-11-21'))?.synced).toBe(true);
  });

  it('no envía con el token de otra cuenta y un registro inválido no bloquea los demás días', async () => {
    await saveDailyCheckIn(entry('carla', '2026-11-19'));
    await saveDailyCheckIn(entry('carla', '2026-11-20'));
    vi.stubGlobal('fetch', echo);
    setAccessToken(jwt('otra-cuenta'));
    await syncDailyCheckIns('carla');
    expect(echo).not.toHaveBeenCalled();

    setAccessToken(jwt('carla'));
    echo.mockImplementationOnce(async () => new Response(JSON.stringify({ detail: 'La fecha reportada no es válida' }), { status: 400 }));
    await syncDailyCheckIns('carla');
    expect((await getDailyCheckIn('carla', '2026-11-19'))?.syncError).toBe('La fecha reportada no es válida');
    expect((await getDailyCheckIn('carla', '2026-11-20'))?.synced).toBe(true);
    expect(await pendingDailyCheckIns('carla')).toEqual([]);
  });

  it('pregunta antes de jugar, guarda sin internet y no vuelve a preguntar ese día', async () => {
    state.studentId = 'dani';
    online = false;
    const view = () => render(<MemoryRouter><DailyCheckInGate><p>Lección</p></DailyCheckInGate></MemoryRouter>);
    view();
    expect(await screen.findByRole('heading', { name: '¿Cómo estás hoy?' })).toBeTruthy();
    expect(screen.queryByText('Lección')).toBeNull();
    const save = screen.getByRole('button', { name: 'Guardar y jugar' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Todavía no' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Cansada' }));
    fireEvent.click(save);
    expect(await screen.findByText('Lección')).toBeTruthy();
    expect(await getDailyCheckIn('dani', checkInDate())).toMatchObject({ sleepHours: 9, food: 'NO_HE_COMIDO', mood: 'CANSADO', synced: false });

    cleanup();
    view();
    expect(await screen.findByText('Lección')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '¿Cómo estás hoy?' })).toBeNull();
  });

  it('no pregunta si ya respondió hoy en otro teléfono', async () => {
    state.studentId = 'eva';
    setAccessToken(jwt('eva'));
    const today = checkInDate();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      date: today, required: false,
      checkIn: { date: today, sleepHours: 7, food: 'SUFICIENTE', mood: 'FELIZ', timeZone: 'America/Guatemala', createdAt: `${today}T14:00:00Z` },
    }))));
    render(<MemoryRouter><DailyCheckInGate><p>Lección</p></DailyCheckInGate></MemoryRouter>);
    expect(await screen.findByText('Lección')).toBeTruthy();
    expect(await getDailyCheckIn('eva', today)).toMatchObject({ mood: 'FELIZ', synced: true });
  });
});

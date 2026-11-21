import 'fake-indexeddb/auto';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnswerRecord, Profile } from '../src/types';

const profile = (studentId: string): Profile => ({ studentId, name: studentId, username: studentId,
  gender: 'nina', courseId: 'course', courseName: 'Cuarto B', schoolName: 'Escuela' });
const answer = (id: string): AnswerRecord => ({ id, sessionId: `session-${id}`, source: 'LECCION',
  exercise: 'suma', skill: 'suma', category: 'suma-resta', difficulty: 2, interaction: 'choice',
  correct: true, errorTag: null, timeMs: 1000, answeredAt: '2026-11-21T18:00:00Z' });
const jwt = (sub: string) => `header.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.firma`;

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
});
afterEach(() => vi.unstubAllGlobals());

describe('integración de progreso, aprendizaje y guardarropas', () => {
  it('guarda las respuestas y el guardarropa por estudiante y no duplica recompensas', async () => {
    const db = await import('../src/offline/storage/db');
    await db.saveProfile(profile('ana'));
    await db.saveProfile(profile('bea'));
    const result = { studentId: 'ana', attemptId: 'attempt', stats: { xp: 100, streak: 1, lastActiveDay: '2026-11-21' },
      wardrobe: { studentId: 'ana', unlocked: ['initial'], equipped: 'initial', celebrated: [] },
      records: [answer('one')], outcome: { xpEarned: 100 } };
    expect((await db.commitLessonResult(result)).duplicate).toBe(false);
    expect((await db.commitLessonResult({ ...result, stats: { ...result.stats, xp: 200 } })).duplicate).toBe(true);
    expect((await db.loadStudent('ana'))?.stats.xp).toBe(100);
    expect((await db.loadStudent('ana'))?.answers).toHaveLength(1);
    expect((await db.loadStudent('bea'))?.answers).toHaveLength(0);
    expect(await db.unsyncedAnswers('bea')).toEqual([]);
    await db.markAnswersSynced('bea', ['one'], 'now');
    expect(await db.unsyncedAnswers('ana')).toHaveLength(1);
    await db.markAnswersSynced('ana', ['one'], 'now');
    expect(await db.unsyncedAnswers('ana')).toEqual([]);
  });

  it.each([1, 2])('migra el esquema v%i de main conservando XP y respuestas antiguas', async (version) => {
    const legacy = await openDB('math-portal', version, { upgrade(db) {
      db.createObjectStore('meta');
      db.createObjectStore('lessons', { keyPath: 'lessonId' });
      db.createObjectStore('skills', { keyPath: 'skill' });
      db.createObjectStore('outbox', { keyPath: 'id' });
      if (version === 2) { db.createObjectStore('answers', { keyPath: 'id' }); db.createObjectStore('mastery', { keyPath: 'category' }); }
    } });
    await legacy.put('meta', { studentId: 'ana', name: 'Ana', grade: '4.º' }, 'profile');
    await legacy.put('meta', { xp: 250, streak: 2, lastActiveDay: '2026-11-21' }, 'stats');
    await legacy.put('lessons', { lessonId: 'lesson', bestStars: 3, completed: true, plays: 1 });
    if (version === 2) {
      await legacy.put('answers', answer('old'));
      await legacy.put('meta', { completedAt: '2026-11-21' }, 'diagnostic');
    }
    legacy.close();
    const db = await import('../src/offline/storage/db');
    const snap = await db.loadStudent('ana');
    expect(snap?.stats.xp).toBe(250);
    expect(snap?.lessons[0].completed).toBe(true);
    expect(snap?.answers).toHaveLength(version === 2 ? 1 : 0);
    expect(snap?.diagnosticDoneAt).toBe(version === 2 ? '2026-11-21' : null);
    expect((await db.loadStartup()).accounts).toEqual([]);
  });

  it('migra la versión 3 de sesiones y guardarropas sin perder cuentas preparadas', async () => {
    const legacy = await openDB('math-portal', 3, { upgrade(db) {
      db.createObjectStore('meta'); db.createObjectStore('outbox', { keyPath: 'id' });
      db.createObjectStore('students', { keyPath: 'studentId' });
      db.createObjectStore('stats', { keyPath: 'studentId' });
      db.createObjectStore('studentLessons', { keyPath: ['studentId', 'lessonId'] }).createIndex('by-student', 'studentId');
      db.createObjectStore('studentSkills', { keyPath: ['studentId', 'skill'] }).createIndex('by-student', 'studentId');
      db.createObjectStore('wardrobe', { keyPath: 'studentId' });
      db.createObjectStore('rewards', { keyPath: 'attemptId' });
      db.createObjectStore('sessions', { keyPath: 'studentId' });
    } });
    await legacy.put('students', profile('ana'));
    await legacy.put('sessions', { studentId: 'ana', refreshToken: 'test-refresh', preparedAt: 'now' });
    await legacy.put('wardrobe', { studentId: 'ana', unlocked: ['one'], equipped: 'one', celebrated: [] });
    legacy.close();
    const db = await import('../src/offline/storage/db');
    expect((await db.loadStartup()).accounts[0].studentId).toBe('ana');
    expect((await db.loadStudent('ana'))?.wardrobe?.equipped).toBe('one');
    expect((await db.loadStudent('ana'))?.answers).toEqual([]);
  });

  it('sincroniza solo la cuenta activa y serializa los campos exactos del backend', async () => {
    const db = await import('../src/offline/storage/db');
    for (const studentId of ['ana', 'bea']) {
      await db.commitLessonResult({ studentId, attemptId: studentId, stats: { xp: 10, streak: 1, lastActiveDay: 'now' },
        wardrobe: { studentId, unlocked: [], equipped: 'initial', celebrated: [] }, records: [answer(studentId)], outcome: {} });
    }
    const api = await import('../src/lib/api');
    api.setAccessToken(jwt('ana'));
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ recibidas: 1, nuevas: 1 })));
    vi.stubGlobal('fetch', fetcher);
    const { uploadAnswers } = await import('../src/features/adaptive/serverSync');
    expect((await uploadAnswers('ana'))?.ids).toEqual(['ana']);
    const [url, init] = (fetcher.mock.calls as unknown as [string, RequestInit][])[0];
    expect(url).toBe('/api/estadisticas/me/respuestas');
    const sent = JSON.parse(String(init.body)).respuestas;
    expect(sent[0].id).toBe('ana');
    expect(sent[0]).not.toHaveProperty('skill');
    expect(sent[0]).not.toHaveProperty('studentId');
    expect(sent[0]).not.toHaveProperty('syncedAt');
    expect(await db.unsyncedAnswers('ana')).toHaveLength(0);
    expect(await db.unsyncedAnswers('bea')).toHaveLength(1);
  });

  it('si entró sin internet, al volver la conexión renueva el token con la sesión guardada y sube', async () => {
    const db = await import('../src/offline/storage/db');
    await db.commitLessonResult({ studentId: 'ana', attemptId: 'ana', stats: { xp: 10, streak: 1, lastActiveDay: 'now' },
      wardrobe: { studentId: 'ana', unlocked: [], equipped: 'initial', celebrated: [] }, records: [answer('ana')], outcome: {} });
    const api = await import('../src/lib/api');
    const refresher = vi.fn(async () => {
      api.setAccessToken(jwt('ana'));
      return jwt('ana');
    });
    api.setTokenRefresher(refresher);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ recibidas: 1, nuevas: 1 }))));
    const { uploadAnswers } = await import('../src/features/adaptive/serverSync');
    expect((await uploadAnswers('ana'))?.ids).toEqual(['ana']);
    expect(refresher).toHaveBeenCalledTimes(1);
    expect(await db.unsyncedAnswers('ana')).toHaveLength(0);
  });

  it('no sube respuestas con el token de otra cuenta', async () => {
    const db = await import('../src/offline/storage/db');
    await db.commitLessonResult({ studentId: 'ana', attemptId: 'ana', stats: { xp: 10, streak: 1, lastActiveDay: 'now' },
      wardrobe: { studentId: 'ana', unlocked: [], equipped: 'initial', celebrated: [] }, records: [answer('ana')], outcome: {} });
    const api = await import('../src/lib/api');
    api.setAccessToken(jwt('bea'));
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { uploadAnswers } = await import('../src/features/adaptive/serverSync');
    expect(await uploadAnswers('ana')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    expect(await db.unsyncedAnswers('ana')).toHaveLength(1);
  });
});

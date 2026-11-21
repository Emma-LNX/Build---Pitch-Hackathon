import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dayKey, uuid } from '../../lib/random';
import {
  EMPTY_STATS,
  loadSnapshot,
  requestPersistentStorage,
  saveLearning,
  saveLessonResult,
  saveProfile as persistProfile,
} from '../../offline/storage/db';
import { syncPendingAttempts } from '../../offline/sync/syncQueue';
import type {
  AnswerRecord,
  CategoryId,
  CategoryMastery,
  LessonProgress,
  Profile,
  SessionKind,
  SkillId,
  SkillProgress,
  Stats,
} from '../../types';
import { computeMastery } from '../adaptive/engine';
import { uploadAnswers } from '../adaptive/serverSync';

type MasteryMap = Partial<Record<CategoryId, CategoryMastery>>;

export const XP_PER_LEVEL = 100;
export const XP_PER_CORRECT = 10;
export const XP_LESSON_BONUS = 10;

export function starsFor(correct: number, total: number): number {
  const ratio = correct / total;
  if (ratio === 1) return 3;
  if (ratio >= 0.8) return 2;
  if (ratio >= 0.6) return 1;
  return 0;
}

export function levelFor(xp: number) {
  return { level: Math.floor(xp / XP_PER_LEVEL) + 1, intoLevel: xp % XP_PER_LEVEL };
}

/** Racha visible: si pasó más de un día sin jugar, ya se perdió. */
export function currentStreak(stats: Stats): number {
  if (!stats.lastActiveDay) return 0;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return stats.lastActiveDay === dayKey() || stats.lastActiveDay === dayKey(yesterday) ? stats.streak : 0;
}

export interface WeekDay {
  label: string;
  name: string;
  active: boolean;
  isToday: boolean;
}

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WEEK_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/**
 * Días de esta semana (lunes a domingo) en que jugó. Se deduce de la racha:
 * son los `streak` días consecutivos que terminan en `lastActiveDay`.
 */
export function weekActivity(stats: Stats, now = new Date()): WeekDay[] {
  const streak = currentStreak(stats);
  const active = new Set<string>();
  if (stats.lastActiveDay && streak > 0) {
    const [y, m, d] = stats.lastActiveDay.split('-').map(Number);
    for (let k = 0; k < Math.min(streak, 7); k++) active.add(dayKey(new Date(y, m - 1, d - k)));
  }
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return WEEK_LABELS.map((label, i) => {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return { label, name: WEEK_NAMES[i], active: active.has(dayKey(day)), isToday: dayKey(day) === dayKey(now) };
  });
}

export interface LessonResultInput {
  lessonId: string;
  records: AnswerRecord[];
}

export interface LessonOutcome {
  stars: number;
  xpEarned: number;
  passed: boolean;
  leveledUp: boolean;
}

export interface SessionOutcome {
  xpEarned: number;
  leveledUp: boolean;
  before: MasteryMap;
  after: MasteryMap;
}

interface ProgressState {
  ready: boolean;
  profile: Profile | null;
  stats: Stats;
  lessons: Record<string, LessonProgress>;
  skills: Partial<Record<SkillId, SkillProgress>>;
  pending: number;
  answers: AnswerRecord[];
  mastery: MasteryMap;
  diagnosticDoneAt: string | null;
}

interface ProgressContextValue extends ProgressState {
  saveProfile: (profile: Profile) => Promise<void>;
  completeLesson: (input: LessonResultInput) => Promise<LessonOutcome>;
  recordSession: (kind: Exclude<SessionKind, 'LECCION'>, records: AnswerRecord[]) => Promise<SessionOutcome>;
  sync: () => Promise<void>;
}

/** Suma XP y actualiza la racha con el reloj del teléfono. */
function nextStats(prev: Stats, xpEarned: number): Stats {
  const today = dayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let streak = prev.streak;
  if (prev.lastActiveDay !== today) {
    streak = prev.lastActiveDay === dayKey(yesterday) ? streak + 1 : 1;
  }
  return { xp: prev.xp + xpEarned, streak, lastActiveDay: today };
}

const XP_DIAGNOSTIC = 50;

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>({
    ready: false,
    profile: null,
    stats: EMPTY_STATS,
    lessons: {},
    skills: {},
    pending: 0,
    answers: [],
    mastery: {},
    diagnosticDoneAt: null,
  });

  const sync = useCallback(async () => {
    const pending = await syncPendingAttempts();
    const uploaded = await uploadAnswers();
    const sent = new Set(uploaded?.ids);
    setState((s) => ({
      ...s,
      pending,
      answers: uploaded ? s.answers.map((a) => (sent.has(a.id) ? { ...a, syncedAt: uploaded.syncedAt } : a)) : s.answers,
    }));
  }, []);

  useEffect(() => {
    requestPersistentStorage();
    loadSnapshot().then((snap) => {
      setState({
        ready: true,
        profile: snap.profile,
        stats: snap.stats,
        lessons: Object.fromEntries(snap.lessons.map((l) => [l.lessonId, l])),
        skills: Object.fromEntries(snap.skills.map((s) => [s.skill, s])),
        pending: snap.pending,
        answers: snap.answers,
        mastery: computeMastery(snap.answers),
        diagnosticDoneAt: snap.diagnosticDoneAt,
      });
      void sync();
    });
    const onOnline = () => void sync();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [sync]);

  const saveProfile = useCallback(async (profile: Profile) => {
    await persistProfile(profile);
    setState((s) => ({ ...s, profile }));
  }, []);

  const completeLesson = useCallback(
    async ({ lessonId, records }: LessonResultInput): Promise<LessonOutcome> => {
      const answers = records.map((r) => ({ skill: r.skill, correct: r.correct }));
      const correct = answers.filter((a) => a.correct).length;
      const total = answers.length;
      const stars = starsFor(correct, total);
      const passed = stars > 0;
      const xpEarned = correct * XP_PER_CORRECT + (passed ? XP_LESSON_BONUS : 0);

      const prevStats = state.stats;
      const stats = nextStats(prevStats, xpEarned);
      const allAnswers = [...state.answers, ...records];
      const mastery = computeMastery(allAnswers);

      const prevLesson = state.lessons[lessonId];
      const lesson: LessonProgress = {
        lessonId,
        bestStars: Math.max(prevLesson?.bestStars ?? 0, stars),
        completed: (prevLesson?.completed ?? false) || passed,
        plays: (prevLesson?.plays ?? 0) + 1,
      };

      const skillMap = { ...state.skills };
      for (const a of answers) {
        const prev = skillMap[a.skill] ?? { skill: a.skill, correct: 0, total: 0 };
        skillMap[a.skill] = { ...prev, correct: prev.correct + (a.correct ? 1 : 0), total: prev.total + 1 };
      }
      const touched = [...new Set(answers.map((a) => a.skill))].map((s) => skillMap[s]!);

      await saveLessonResult(stats, lesson, touched, {
        id: uuid(),
        studentId: state.profile?.studentId ?? 'anonimo',
        lessonId,
        correct,
        total,
        skillResults: answers,
        createdAt: new Date().toISOString(),
      });
      await saveLearning(records, Object.values(mastery));

      setState((s) => ({
        ...s,
        stats,
        lessons: { ...s.lessons, [lessonId]: lesson },
        skills: skillMap,
        pending: s.pending + 1,
        answers: allAnswers,
        mastery,
      }));
      void sync();

      return {
        stars,
        xpEarned,
        passed,
        leveledUp: levelFor(stats.xp).level > levelFor(prevStats.xp).level,
      };
    },
    [state, sync],
  );

  const recordSession = useCallback(
    async (kind: Exclude<SessionKind, 'LECCION'>, records: AnswerRecord[]): Promise<SessionOutcome> => {
      const correct = records.filter((r) => r.correct).length;
      const xpEarned =
        kind === 'DIAGNOSTICO'
          ? XP_DIAGNOSTIC
          : correct * XP_PER_CORRECT + (correct >= records.length * 0.75 ? XP_LESSON_BONUS : 0);
      const stats = nextStats(state.stats, xpEarned);
      const allAnswers = [...state.answers, ...records];
      const mastery = computeMastery(allAnswers);
      const diagnosticDoneAt = kind === 'DIAGNOSTICO' ? new Date().toISOString() : undefined;

      await saveLearning(records, Object.values(mastery), { stats, diagnosticDoneAt });
      setState((s) => ({
        ...s,
        stats,
        answers: allAnswers,
        mastery,
        diagnosticDoneAt: diagnosticDoneAt ?? s.diagnosticDoneAt,
      }));
      void sync();

      return {
        xpEarned,
        leveledUp: levelFor(stats.xp).level > levelFor(state.stats.xp).level,
        before: state.mastery,
        after: mastery,
      };
    },
    [state, sync],
  );

  const value = useMemo(
    () => ({ ...state, saveProfile, completeLesson, recordSession, sync }),
    [state, saveProfile, completeLesson, recordSession, sync],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress debe usarse dentro de <ProgressProvider>');
  return ctx;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { dayKey, uuid } from '../../lib/random';
import {
  commitLessonResult,
  countPending,
  EMPTY_STATS,
  loadStudent,
  requestPersistentStorage,
  saveProfile as persistProfile,
  saveWardrobe,
  type StudentSnapshot,
} from '../../offline/storage/db';
import { syncPendingAttempts } from '../../offline/sync/syncQueue';
import type { Gender, LessonProgress, Profile, SkillId, SkillProgress, Stats, WardrobeState } from '../../types';
import {
  adaptToGender,
  applyUnlocks,
  findOutfit,
  initialWardrobe,
  isUnlocked,
  isWearable,
  presentationFor,
  withEquipped,
} from '../wardrobe/outfits';

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
  /** UUID de la partida: el mismo id nunca se premia dos veces. */
  attemptId: string;
  lessonId: string;
  answers: { skill: SkillId; correct: boolean }[];
}

export interface LessonOutcome {
  stars: number;
  xpEarned: number;
  passed: boolean;
  leveledUp: boolean;
  /** Conjuntos del guardarropa desbloqueados por esta partida. */
  newOutfits: string[];
}

interface StudentState {
  profile: Profile | null;
  stats: Stats;
  lessons: Record<string, LessonProgress>;
  skills: Partial<Record<SkillId, SkillProgress>>;
  wardrobe: WardrobeState | null;
}

interface ProgressState extends StudentState {
  ready: boolean;
  pending: number;
}

interface ProgressContextValue extends ProgressState {
  /** Abre los datos locales de un estudiante ya autenticado (o con sesión preparada). */
  openStudent: (studentId: string) => Promise<void>;
  /** Oculta los datos del estudiante al cerrar sesión. */
  closeStudent: () => void;
  saveProfile: (profile: Profile) => Promise<void>;
  /** Corrige el género: actualiza el catálogo y equipa un conjunto compatible si hace falta. */
  updateGender: (gender: Gender, pendingSync: boolean) => Promise<void>;
  completeLesson: (input: LessonResultInput) => Promise<LessonOutcome>;
  equipOutfit: (outfitId: string) => Promise<void>;
  markCelebrated: (outfitIds: string[]) => Promise<void>;
  sync: () => Promise<void>;
}

const EMPTY_STUDENT: StudentState = { profile: null, stats: EMPTY_STATS, lessons: {}, skills: {}, wardrobe: null };

function genderOf(profile: Profile | null): Gender {
  return profile?.gender ?? 'nina';
}

/** Asegura que el estudiante tenga guardarropa coherente con su XP y su género. */
async function hydrateStudent(snap: StudentSnapshot | null): Promise<StudentState> {
  if (!snap) return EMPTY_STUDENT;
  const gender = genderOf(snap.profile);
  const base = snap.wardrobe ?? initialWardrobe(snap.profile.studentId, gender);
  const wardrobe = adaptToGender(applyUnlocks(base, snap.stats.xp).wardrobe, gender);
  if (wardrobe !== snap.wardrobe) await saveWardrobe(wardrobe);
  return {
    profile: snap.profile,
    stats: snap.stats,
    lessons: Object.fromEntries(snap.lessons.map((l) => [l.lessonId, l])),
    skills: Object.fromEntries(snap.skills.map((s) => [s.skill, s])),
    wardrobe,
  };
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>({ ...EMPTY_STUDENT, ready: false, pending: 0 });
  // Estado más reciente para las acciones asíncronas (evita cierres obsoletos)
  const stateRef = useRef(state);
  stateRef.current = state;
  // Las partidas se procesan en fila para que dos eventos seguidos no se pisen
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const commit = useCallback((patch: Partial<ProgressState>) => {
    stateRef.current = { ...stateRef.current, ...patch };
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const sync = useCallback(async () => {
    const pending = await syncPendingAttempts();
    setState((s) => ({ ...s, pending }));
  }, []);

  useEffect(() => {
    requestPersistentStorage();
    countPending().then((pending) => {
      commit({ ready: true, pending });
      void sync();
    });
    const onOnline = () => void sync();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [sync, commit]);

  const openStudent = useCallback(
    async (studentId: string) => {
      await queue.current; // no cambiar de cuenta a mitad de guardar una partida
      commit(await hydrateStudent(await loadStudent(studentId)));
    },
    [commit],
  );

  const closeStudent = useCallback(() => commit(EMPTY_STUDENT), [commit]);

  const saveProfile = useCallback(
    async (profile: Profile) => {
      await persistProfile(profile);
      if (stateRef.current.profile?.studentId === profile.studentId) commit({ profile });
    },
    [commit],
  );

  const updateGender = useCallback(
    async (gender: Gender, pendingSync: boolean) => {
      const { profile, wardrobe, stats } = stateRef.current;
      if (!profile) return;
      const next: Profile = { ...profile, gender, genderPendingSync: pendingSync };
      await persistProfile(next);
      // Conserva XP y desbloqueos; solo cambia el conjunto si el actual no corresponde
      const base = wardrobe ?? initialWardrobe(profile.studentId, gender);
      const adapted = adaptToGender(applyUnlocks(base, stats.xp).wardrobe, gender);
      if (adapted !== wardrobe) await saveWardrobe(adapted);
      commit({ profile: next, wardrobe: adapted });
    },
    [commit],
  );

  const completeLesson = useCallback(
    (input: LessonResultInput): Promise<LessonOutcome> => {
      const run = async (): Promise<LessonOutcome> => {
        const { attemptId, lessonId, answers } = input;
        const current = stateRef.current;
        const profile = current.profile;
        if (!profile) throw new Error('No hay un perfil activo');

        const correct = answers.filter((a) => a.correct).length;
        const total = answers.length;
        const stars = starsFor(correct, total);
        const passed = stars > 0;
        const xpEarned = correct * XP_PER_CORRECT + (passed ? XP_LESSON_BONUS : 0);

        const prevStats = current.stats;
        const today = dayKey();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        let streak = prevStats.streak;
        if (prevStats.lastActiveDay !== today) {
          streak = prevStats.lastActiveDay === dayKey(yesterday) ? streak + 1 : 1;
        }
        const stats: Stats = { xp: prevStats.xp + xpEarned, streak, lastActiveDay: today };

        const prevLesson = current.lessons[lessonId];
        const lesson: LessonProgress = {
          lessonId,
          bestStars: Math.max(prevLesson?.bestStars ?? 0, stars),
          completed: (prevLesson?.completed ?? false) || passed,
          plays: (prevLesson?.plays ?? 0) + 1,
        };

        const skillMap = { ...current.skills };
        for (const a of answers) {
          const prev = skillMap[a.skill] ?? { skill: a.skill, correct: 0, total: 0 };
          skillMap[a.skill] = { ...prev, correct: prev.correct + (a.correct ? 1 : 0), total: prev.total + 1 };
        }
        const touched = [...new Set(answers.map((a) => a.skill))].map((s) => skillMap[s]!);

        // La XP es acumulativa; los desbloqueos se derivan de ella y son permanentes
        const { wardrobe, newlyUnlocked } = applyUnlocks(
          current.wardrobe ?? initialWardrobe(profile.studentId, genderOf(profile)),
          stats.xp,
        );

        const outcome: LessonOutcome = {
          stars,
          xpEarned,
          passed,
          leveledUp: levelFor(stats.xp).level > levelFor(prevStats.xp).level,
          newOutfits: newlyUnlocked,
        };

        const result = await commitLessonResult({
          studentId: profile.studentId,
          stats,
          lesson,
          skills: touched,
          wardrobe,
          outcome,
          attempt: {
            id: attemptId,
            studentId: profile.studentId,
            lessonId,
            correct,
            total,
            skillResults: answers,
            createdAt: new Date().toISOString(),
          },
        });
        // Evento repetido: se devuelve el resultado original sin volver a sumar
        if (result.duplicate) return result.outcome;
        // Si cambió de cuenta mientras se guardaba, no mezclar el estado en pantalla
        if (stateRef.current.profile?.studentId !== profile.studentId) return outcome;

        commit({
          stats,
          lessons: { ...current.lessons, [lessonId]: lesson },
          skills: skillMap,
          wardrobe,
          pending: stateRef.current.pending + 1,
        });
        void sync();
        return outcome;
      };
      const next = queue.current.then(run, run);
      queue.current = next.catch(() => undefined);
      return next;
    },
    [sync, commit],
  );

  const updateWardrobe = useCallback(
    async (change: (w: WardrobeState) => WardrobeState) => {
      const current = stateRef.current.wardrobe;
      if (!current) return;
      const wardrobe = change(current);
      if (wardrobe === current) return;
      await saveWardrobe(wardrobe);
      commit({ wardrobe });
    },
    [commit],
  );

  const equipOutfit = useCallback(
    (outfitId: string) =>
      updateWardrobe((w) => {
        const outfit = findOutfit(outfitId);
        const gender = genderOf(stateRef.current.profile);
        // Solo conjuntos desbloqueados, ilustrados y de su catálogo
        if (!outfit || !isUnlocked(w, outfitId)) throw new Error('Este conjunto todavía está bloqueado');
        if (!isWearable(outfit)) throw new Error('Este conjunto todavía no tiene ilustración');
        if (outfit.presentation !== presentationFor(gender)) throw new Error('Este conjunto no está en tu guardarropa');
        return w.equipped === outfitId ? w : withEquipped(w, outfit);
      }),
    [updateWardrobe],
  );

  const markCelebrated = useCallback(
    (outfitIds: string[]) =>
      updateWardrobe((w) => {
        const add = outfitIds.filter((id) => !w.celebrated.includes(id));
        return add.length ? { ...w, celebrated: [...w.celebrated, ...add] } : w;
      }),
    [updateWardrobe],
  );

  const value = useMemo(
    () => ({
      ...state,
      openStudent,
      closeStudent,
      saveProfile,
      updateGender,
      completeLesson,
      equipOutfit,
      markCelebrated,
      sync,
    }),
    [state, openStudent, closeStudent, saveProfile, updateGender, completeLesson, equipOutfit, markCelebrated, sync],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress debe usarse dentro de <ProgressProvider>');
  return ctx;
}

/** UUID de una nueva partida; se reutiliza si el evento de finalización se repite. */
export function newAttemptId(): string {
  return uuid();
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { detectPersonalRecords } from '@/lib/personalRecords';
import { calculateSetVolumeKg } from '@/lib/weightUtils';
import { useUserProfileStore } from '@/store/userProfileStore';
import type { CompletedWorkout } from '@/types/workout';

export const WORKOUT_HISTORY_STORAGE_KEY = 'spot-workout-history';
export const WORKOUT_HISTORY_INDEX_KEY = 'spot-workout-history-index';

export function getWorkoutHistoryYearShardKey(year: number): string {
  return `${WORKOUT_HISTORY_STORAGE_KEY}-${year}`;
}

function getWorkoutYear(workout: CompletedWorkout): number {
  const raw = workout.workoutDate || workout.completedAt || workout.startedAt;
  if (typeof raw === 'string') {
    const match = raw.match(/^(\d{4})/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (parsed >= 1970 && parsed <= 2100) return parsed;
    }
  }
  const dt = new Date(workout.completedAt || workout.startedAt);
  return !isNaN(dt.getTime()) ? dt.getFullYear() : new Date().getFullYear();
}

type WorkoutHistoryState = {
  workouts: CompletedWorkout[];
  hydrated: boolean;
  error: string | null;
  loadHistory: () => Promise<CompletedWorkout[]>;
  addCompletedWorkout: (workout: CompletedWorkout) => Promise<boolean>;
  updateWorkout: (updatedWorkout: CompletedWorkout) => Promise<boolean>;
  replaceHistory: (workouts: CompletedWorkout[]) => Promise<boolean>;
  deleteWorkout: (id: string) => Promise<boolean>;
  clearHistory: () => Promise<boolean>;
};

function isCompletedSet(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const set = value as { weight?: unknown; reps?: unknown; volume?: unknown; completedAt?: unknown };
  return (
    typeof set.weight === 'number' &&
    typeof set.reps === 'number' &&
    typeof set.volume === 'number' &&
    typeof set.completedAt === 'string'
  );
}

function isCompletedExercise(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const exercise = value as {
    exerciseId?: unknown;
    exerciseName?: unknown;
    muscleGroup?: unknown;
    sets?: unknown;
  };
  return (
    typeof exercise.exerciseId === 'string' &&
    typeof exercise.exerciseName === 'string' &&
    typeof exercise.muscleGroup === 'string' &&
    Array.isArray(exercise.sets) &&
    exercise.sets.every(isCompletedSet)
  );
}

function isPersonalRecord(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const record = value as {
    id?: unknown;
    type?: unknown;
    exerciseId?: unknown;
    exerciseName?: unknown;
    value?: unknown;
    label?: unknown;
  };
  return (
    typeof record.id === 'string' &&
    (record.type === 'weight' || record.type === 'estimated_1rm') &&
    typeof record.exerciseId === 'string' &&
    typeof record.exerciseName === 'string' &&
    typeof record.value === 'number' &&
    typeof record.label === 'string'
  );
}

function isCompletedWorkout(value: unknown): value is CompletedWorkout {
  if (!value || typeof value !== 'object') return false;
  const workout = value as Partial<CompletedWorkout>;
  return (
    typeof workout.id === 'string' &&
    typeof workout.programWorkoutId === 'string' &&
    typeof workout.workoutName === 'string' &&
    typeof workout.startedAt === 'string' &&
    typeof workout.completedAt === 'string' &&
    typeof workout.durationSeconds === 'number' &&
    typeof workout.totalSets === 'number' &&
    typeof workout.totalVolume === 'number' &&
    Array.isArray(workout.exercises) &&
    workout.exercises.every(isCompletedExercise) &&
    Array.isArray(workout.personalRecords) &&
    workout.personalRecords.every(isPersonalRecord)
  );
}

function parseHistory(value: string | null): CompletedWorkout[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isCompletedWorkout) : [];
  } catch {
    return [];
  }
}

function sortNewestFirst(workouts: CompletedWorkout[]): CompletedWorkout[] {
  return [...workouts].sort(
    (a, b) =>
      new Date(b.completedAt || b.startedAt).getTime() -
      new Date(a.completedAt || a.startedAt).getTime()
  );
}

function parseShardIndex(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { years?: unknown }).years)
    ) {
      const years = (parsed as { years: unknown[] }).years
        .filter((y): y is number => typeof y === 'number' && Number.isInteger(y))
        .sort((a, b) => b - a);
      return Array.from(new Set(years));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists workouts sharded by calendar year (`spot-workout-history-YYYY`)
 * so no single AsyncStorage key ever approaches Android's 2 MB CursorWindow limit.
 * Optionally restricts writes to `onlyYears` when only specific years changed.
 */
async function persistShardedWorkouts(
  workouts: CompletedWorkout[],
  onlyYears?: Set<number>
): Promise<void> {
  const byYear = new Map<number, CompletedWorkout[]>();
  for (const w of workouts) {
    const y = getWorkoutYear(w);
    const bucket = byYear.get(y) ?? [];
    bucket.push(w);
    byYear.set(y, bucket);
  }

  const existingIndexRaw = await AsyncStorage.getItem(WORKOUT_HISTORY_INDEX_KEY);
  const previousYears = parseShardIndex(existingIndexRaw) ?? [];
  const nextYears = Array.from(byYear.keys()).sort((a, b) => b - a);

  const pairsToWrite: [string, string][] = [
    [WORKOUT_HISTORY_INDEX_KEY, JSON.stringify({ years: nextYears })],
  ];

  for (const year of nextYears) {
    if (!onlyYears || onlyYears.has(year)) {
      pairsToWrite.push([
        getWorkoutHistoryYearShardKey(year),
        JSON.stringify(byYear.get(year) ?? []),
      ]);
    }
  }

  await AsyncStorage.multiSet(pairsToWrite);

  const removedYears = previousYears.filter((y) => !byYear.has(y));
  if (removedYears.length > 0) {
    await AsyncStorage.multiRemove(removedYears.map(getWorkoutHistoryYearShardKey));
  }
}

async function readAllShardedWorkouts(): Promise<CompletedWorkout[]> {
  const indexRaw = await AsyncStorage.getItem(WORKOUT_HISTORY_INDEX_KEY);
  const years = parseShardIndex(indexRaw);

  if (years !== null) {
    if (years.length === 0) return [];
    const pairs = await AsyncStorage.multiGet(years.map(getWorkoutHistoryYearShardKey));
    const merged: CompletedWorkout[] = [];
    for (const [, rawShard] of pairs) {
      if (rawShard) {
        merged.push(...parseHistory(rawShard));
      }
    }
    return sortNewestFirst(merged);
  }

  // Transparent 1-time migration from legacy single-key `spot-workout-history`
  const legacyRaw = await AsyncStorage.getItem(WORKOUT_HISTORY_STORAGE_KEY);
  const legacyWorkouts = sortNewestFirst(parseHistory(legacyRaw));
  if (legacyRaw !== null) {
    await persistShardedWorkouts(legacyWorkouts);
    await AsyncStorage.removeItem(WORKOUT_HISTORY_STORAGE_KEY);
  }
  return legacyWorkouts;
}

function recalculateHistoryPRs(workouts: CompletedWorkout[]): CompletedWorkout[] {
  const baselineLifts = useUserProfileStore.getState().profile?.baselineLifts;
  const chronological = [...workouts].sort(
    (a, b) =>
      new Date(a.completedAt || a.startedAt).getTime() -
      new Date(b.completedAt || b.startedAt).getTime()
  );
  const processed: CompletedWorkout[] = [];
  for (const w of chronological) {
    const prs = detectPersonalRecords(w, processed, baselineLifts);
    processed.push({
      ...w,
      personalRecords: prs,
    });
  }
  return processed.reverse();
}

export const useWorkoutHistoryStore = create<WorkoutHistoryState>((set, get) => ({
  workouts: [],
  hydrated: false,
  error: null,

  loadHistory: async () => {
    if (get().hydrated) return get().workouts;
    try {
      const workouts = await readAllShardedWorkouts();
      set({ workouts, hydrated: true, error: null });
      return workouts;
    } catch {
      const fallback = get().workouts;
      set({ hydrated: true, error: 'Workout history is temporarily unavailable.' });
      return fallback;
    }
  },

  addCompletedWorkout: async (workout) => {
    const current = get().hydrated ? get().workouts : await get().loadHistory();
    if (current.some((item) => item.id === workout.id)) {
      set({ workouts: current, hydrated: true, error: null });
      return true;
    }

    const stampedWorkout: CompletedWorkout = {
      ...workout,
      updatedAt: workout.updatedAt || workout.completedAt || new Date().toISOString(),
    };
    const next = sortNewestFirst([stampedWorkout, ...current]);
    const affectedYear = getWorkoutYear(stampedWorkout);

    try {
      await persistShardedWorkouts(next, new Set([affectedYear]));
      set({ workouts: next, hydrated: true, error: null });
      return true;
    } catch {
      set({ error: 'Workout completed, but history could not be saved.' });
      return false;
    }
  },

  deleteWorkout: async (id: string) => {
    const current = get().hydrated ? get().workouts : await get().loadHistory();
    const filtered = current.filter((item) => item.id !== id);
    const next = recalculateHistoryPRs(filtered);
    try {
      await persistShardedWorkouts(next);
      set({ workouts: next, hydrated: true, error: null });

      // Clear any matching completed live-session card so deleted workout doesn't linger on Home
      await import('@/store/workoutSessionStore')
        .then(({ useWorkoutSessionStore }) => {
          const live = useWorkoutSessionStore.getState().session;
          if (live && live.completed && live.id === id) {
            useWorkoutSessionStore.getState().clearSession();
          }
        })
        .catch(() => undefined);

      await import('@/lib/cloudSync')
        .then(({ recordDeletedWorkout }) => recordDeletedWorkout(id))
        .catch(() => undefined);
      return true;
    } catch {
      set({ error: 'Workout could not be deleted.' });
      return false;
    }
  },

  updateWorkout: async (updatedWorkout: CompletedWorkout) => {
    const current = get().hydrated ? get().workouts : await get().loadHistory();
    const cleanedExercises = updatedWorkout.exercises
      .map((ex) => ({
        ...ex,
        sets: ex.sets
          .filter(
            (s) =>
              typeof s.reps === 'number' &&
              s.reps > 0 &&
              typeof s.weight === 'number' &&
              s.weight >= 0
          )
          .map((s) => ({
            ...s,
            volume: calculateSetVolumeKg({
              weightKg: s.weight,
              reps: s.reps,
              exerciseName: ex.exerciseName,
              setType: s.setType,
            }),
          })),
      }))
      .filter((ex) => ex.sets.length > 0);

    const allSets = cleanedExercises.flatMap((ex) => ex.sets);
    const workingSets = allSets.filter((s) => s.setType !== 'warmup');
    const totalVolume =
      Math.round(workingSets.reduce((sum, s) => sum + s.volume, 0) * 100) / 100;

    const nowIso = new Date().toISOString();
    const normalizedWorkout: CompletedWorkout = {
      ...updatedWorkout,
      exercises: cleanedExercises,
      totalSets: allSets.length,
      totalVolume,
      updatedAt: nowIso,
    };

    const replaced = current.map((item) =>
      item.id === normalizedWorkout.id ? normalizedWorkout : item
    );
    const next = recalculateHistoryPRs(replaced);
    const syncedTarget =
      next.find((item) => item.id === normalizedWorkout.id) ?? normalizedWorkout;
    try {
      await persistShardedWorkouts(next);
      set({ workouts: next, hydrated: true, error: null });
      await import('@/lib/cloudSync')
        .then(({ syncCompletedWorkout }) => syncCompletedWorkout(syncedTarget))
        .catch(() => undefined);
      return true;
    } catch {
      set({ error: 'Workout could not be updated.' });
      return false;
    }
  },

  replaceHistory: async (incomingWorkouts: CompletedWorkout[]) => {
    const valid = Array.isArray(incomingWorkouts)
      ? incomingWorkouts.filter(isCompletedWorkout)
      : [];
    const next = recalculateHistoryPRs(valid);
    try {
      await persistShardedWorkouts(next);
      await AsyncStorage.removeItem(WORKOUT_HISTORY_STORAGE_KEY).catch(() => undefined);
      set({ workouts: next, hydrated: true, error: null });
      return true;
    } catch {
      set({ error: 'Workout history could not be imported.' });
      return false;
    }
  },

  clearHistory: async () => {
    try {
      const indexRaw = await AsyncStorage.getItem(WORKOUT_HISTORY_INDEX_KEY);
      const years = parseShardIndex(indexRaw) ?? [];
      const keysToRemove = [
        WORKOUT_HISTORY_STORAGE_KEY,
        WORKOUT_HISTORY_INDEX_KEY,
        ...years.map(getWorkoutHistoryYearShardKey),
      ];
      await AsyncStorage.multiRemove(keysToRemove);
      set({ workouts: [], hydrated: true, error: null });
      return true;
    } catch {
      set({ error: 'Workout history could not be cleared.' });
      return false;
    }
  },
}));

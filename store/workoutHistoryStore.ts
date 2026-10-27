import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { detectPersonalRecords } from '@/lib/personalRecords';
import { useUserProfileStore } from '@/store/userProfileStore';
import type { CompletedWorkout } from '@/types/workout';

export const WORKOUT_HISTORY_STORAGE_KEY = 'spot-workout-history';

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
  return typeof set.weight === 'number' && typeof set.reps === 'number' && typeof set.volume === 'number' && typeof set.completedAt === 'string';
}

function isCompletedExercise(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const exercise = value as { exerciseId?: unknown; exerciseName?: unknown; muscleGroup?: unknown; sets?: unknown };
  return typeof exercise.exerciseId === 'string'
    && typeof exercise.exerciseName === 'string'
    && typeof exercise.muscleGroup === 'string'
    && Array.isArray(exercise.sets)
    && exercise.sets.every(isCompletedSet);
}

function isPersonalRecord(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const record = value as { id?: unknown; type?: unknown; exerciseId?: unknown; exerciseName?: unknown; value?: unknown; label?: unknown };
  return typeof record.id === 'string'
    && (record.type === 'weight' || record.type === 'estimated_1rm')
    && typeof record.exerciseId === 'string'
    && typeof record.exerciseName === 'string'
    && typeof record.value === 'number'
    && typeof record.label === 'string';
}

function isCompletedWorkout(value: unknown): value is CompletedWorkout {
  if (!value || typeof value !== 'object') return false;
  const workout = value as Partial<CompletedWorkout>;
  return typeof workout.id === 'string'
    && typeof workout.programWorkoutId === 'string'
    && typeof workout.workoutName === 'string'
    && typeof workout.startedAt === 'string'
    && typeof workout.completedAt === 'string'
    && typeof workout.durationSeconds === 'number'
    && typeof workout.totalSets === 'number'
    && typeof workout.totalVolume === 'number'
    && Array.isArray(workout.exercises)
    && workout.exercises.every(isCompletedExercise)
    && Array.isArray(workout.personalRecords)
    && workout.personalRecords.every(isPersonalRecord);
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

function recalculateHistoryPRs(workouts: CompletedWorkout[]): CompletedWorkout[] {
  const baselineLifts = useUserProfileStore.getState().profile?.baselineLifts;
  // Sort oldest -> newest to recompute PRs chronologically
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
  // Return in newest -> oldest order matching store convention
  return processed.reverse();
}

export const useWorkoutHistoryStore = create<WorkoutHistoryState>((set, get) => ({
  workouts: [],
  hydrated: false,
  error: null,

  loadHistory: async () => {
    if (get().hydrated) return get().workouts;
    try {
      const stored = await AsyncStorage.getItem(WORKOUT_HISTORY_STORAGE_KEY);
      const workouts = parseHistory(stored);
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

    const next = [workout, ...current];
    try {
      await AsyncStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(next));
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
      await AsyncStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(next));
      set({ workouts: next, hydrated: true, error: null });
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
          .filter((s) => typeof s.reps === 'number' && s.reps > 0 && typeof s.weight === 'number' && s.weight >= 0)
          .map((s) => ({
            ...s,
            volume: s.setType === 'warmup' ? 0 : Math.round(s.weight * s.reps * 100) / 100,
          })),
      }))
      .filter((ex) => ex.sets.length > 0);

    const allSets = cleanedExercises.flatMap((ex) => ex.sets);
    const workingSets = allSets.filter((s) => s.setType !== 'warmup');
    const totalVolume =
      Math.round(workingSets.reduce((sum, s) => sum + s.weight * s.reps, 0) * 100) / 100;

    const normalizedWorkout: CompletedWorkout = {
      ...updatedWorkout,
      exercises: cleanedExercises,
      totalSets: allSets.length,
      totalVolume,
    };

    const replaced = current.map((item) =>
      item.id === normalizedWorkout.id ? normalizedWorkout : item
    );
    const next = recalculateHistoryPRs(replaced);
    try {
      await AsyncStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(next));
      set({ workouts: next, hydrated: true, error: null });
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
      await AsyncStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(next));
      set({ workouts: next, hydrated: true, error: null });
      return true;
    } catch {
      set({ error: 'Workout history could not be imported.' });
      return false;
    }
  },

  clearHistory: async () => {
    try {
      await AsyncStorage.removeItem(WORKOUT_HISTORY_STORAGE_KEY);
      set({ workouts: [], hydrated: true, error: null });
      return true;
    } catch {
      set({ error: 'Workout history could not be cleared.' });
      return false;
    }
  },
}));

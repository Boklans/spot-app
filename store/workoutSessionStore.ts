import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { generateProgram, resolveRestSeconds, type GeneratedExercise, type GeneratedWorkout } from '@/lib/programGenerator';
import { findLatestExerciseSets, recommendWeight, type WeightRecommendation } from '@/lib/adaptiveProgression';
import type { CompletedWorkout, PersonalRecord } from '@/types/workout';
import { defaultOnboarding } from './workoutStore';
import { useWorkoutHistoryStore } from './workoutHistoryStore';

export type WorkoutSet = {
  id: string;
  weight: number;
  reps: number;
  targetReps: string;
  completed: boolean;
  completedAt?: string;
};

export type PreviousSet = {
  weight: number;
  reps: number;
};

export type WorkoutExercise = {
  id: string;
  name: string;
  muscleGroup: string;
  previousSets: PreviousSet[];
  recommendation: WeightRecommendation;
  sets: WorkoutSet[];
  weightIncrement: number;
  restSeconds: number;
};

export type WorkoutSession = {
  id: string;
  programWorkoutId: string;
  workoutName: string;
  startedAt: string;
  completedAt?: string;
  currentExerciseIndex: number;
  currentSetIndex: number;
  exercises: WorkoutExercise[];
  personalRecords: PersonalRecord[];
  completed: boolean;
};

export const ACTIVE_WORKOUT_SESSION_STORAGE_KEY = 'spot_active_workout_session';

export type ActiveWorkoutStorage = {
  session: WorkoutSession;
  restEndsAt: number | null;
  restNextType: 'set' | 'exercise' | null;
};

type WorkoutSessionState = {
  session: WorkoutSession | null;
  restEndsAt: number | null;
  restNextType: 'set' | 'exercise' | null;
  hydrated: boolean;
  hydrateSession: () => Promise<boolean>;
  initializeSession: (workout?: GeneratedWorkout) => Promise<void>;
  completeCurrentSet: () => void;
  setPersonalRecords: (personalRecords: PersonalRecord[]) => void;
  updateCurrentSet: (values: { weight?: number; reps?: number }) => void;
  addRestTime: (seconds: number) => void;
  skipRest: () => void;
  swapExercise: (newExercise: { name: string; muscleGroup: string; defaultWeight?: number }) => void;
  clearSession: () => void;
};

let persistenceQueue = Promise.resolve();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isWorkoutSet(value: unknown): value is WorkoutSet {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.weight === 'number'
    && typeof value.reps === 'number'
    && typeof value.targetReps === 'string'
    && typeof value.completed === 'boolean'
    && (value.completedAt === undefined || typeof value.completedAt === 'string');
}

function isRecommendation(value: unknown): value is WeightRecommendation {
  if (!isRecord(value)) return false;
  return typeof value.recommendedWeight === 'number'
    && (value.recommendationReason === 'increase' || value.recommendationReason === 'maintain' || value.recommendationReason === 'reduce' || value.recommendationReason === 'program_default')
    && (value.source === 'history' || value.source === 'program_default')
    && typeof value.explanation === 'string';
}

function isWorkoutSession(value: unknown): value is WorkoutSession {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || typeof value.programWorkoutId !== 'string' || typeof value.workoutName !== 'string' || typeof value.startedAt !== 'string') return false;
  if (typeof value.currentExerciseIndex !== 'number' || typeof value.currentSetIndex !== 'number' || !Array.isArray(value.exercises) || !Array.isArray(value.personalRecords) || typeof value.completed !== 'boolean') return false;
  if (value.currentExerciseIndex < 0 || value.currentExerciseIndex >= value.exercises.length) return false;
  return value.exercises.every((exercise) => isRecord(exercise)
    && typeof exercise.id === 'string'
    && typeof exercise.name === 'string'
    && typeof exercise.muscleGroup === 'string'
    && (exercise.weightIncrement === undefined || typeof exercise.weightIncrement === 'number')
    && (exercise.restSeconds === undefined || typeof exercise.restSeconds === 'number')
    && Array.isArray(exercise.previousSets)
    && exercise.previousSets.every((set) => isRecord(set) && typeof set.weight === 'number' && typeof set.reps === 'number')
    && isRecommendation(exercise.recommendation)
    && Array.isArray(exercise.sets)
    && exercise.sets.length > 0
    && exercise.sets.every(isWorkoutSet));
}

function parseActiveWorkout(value: string | null): ActiveWorkoutStorage | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || !isWorkoutSession(parsed.session)) return null;
    const restEndsAt = parsed.restEndsAt;
    const restNextType = parsed.restNextType;
    if (restEndsAt !== null && typeof restEndsAt !== 'number') return null;
    if (restNextType !== null && restNextType !== 'set' && restNextType !== 'exercise') return null;
    const exercise = parsed.session.exercises[parsed.session.currentExerciseIndex];
    if (parsed.session.currentSetIndex < 0 || parsed.session.currentSetIndex >= exercise.sets.length) return null;

    const normalizedExercises: WorkoutExercise[] = parsed.session.exercises.map((item) => ({
      ...item,
      weightIncrement: typeof item.weightIncrement === 'number' ? item.weightIncrement : 2.5,
      restSeconds: typeof item.restSeconds === 'number' ? item.restSeconds : resolveRestSeconds(),
    }));

    return {
      session: {
        ...parsed.session,
        exercises: normalizedExercises,
      },
      restEndsAt,
      restNextType,
    };
  } catch {
    return null;
  }
}

function queuePersistence(task: () => Promise<void>) {
  persistenceQueue = persistenceQueue.then(task).catch(() => undefined);
}

function persistSnapshot(snapshot: ActiveWorkoutStorage | null) {
  queuePersistence(async () => {
    if (!snapshot) {
      await AsyncStorage.removeItem(ACTIVE_WORKOUT_SESSION_STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(ACTIVE_WORKOUT_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  });
}

function createSessionExercises(workout: GeneratedWorkout, history: CompletedWorkout[]): WorkoutExercise[] {
  return workout.exercises.map((exercise, exerciseIndex) => {
    const previousSets = findLatestExerciseSets(history, exercise);
    const recommendation = recommendWeight(exercise, previousSets);
    const weight = recommendation.recommendedWeight;
    const weightIncrement = typeof exercise.weightIncrement === 'number' ? exercise.weightIncrement : 2.5;
    const restSeconds = resolveRestSeconds(exercise, workout);

    return {
      id: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      previousSets,
      recommendation,
      weightIncrement,
      restSeconds,
      sets: Array.from({ length: exercise.sets }, (_, setIndex) => ({
        id: `exercise-${exerciseIndex + 1}-set-${setIndex + 1}`,
        weight,
        reps: Number.parseInt(exercise.targetRepRange.split('-')[0], 10),
        targetReps: exercise.targetRepRange,
        completed: false,
      })),
    };
  });
}

export const useWorkoutSessionStore = create<WorkoutSessionState>((set) => ({
  session: null,
  restEndsAt: null,
  restNextType: null,
  hydrated: false,

  hydrateSession: async () => {
    try {
      const stored = await AsyncStorage.getItem(ACTIVE_WORKOUT_SESSION_STORAGE_KEY);
      const snapshot = parseActiveWorkout(stored);
      if (!snapshot) {
        if (stored) await AsyncStorage.removeItem(ACTIVE_WORKOUT_SESSION_STORAGE_KEY);
        set({ hydrated: true });
        return false;
      }
      set({ session: snapshot.session, restEndsAt: snapshot.restEndsAt, restNextType: snapshot.restNextType, hydrated: true });
      return true;
    } catch {
      set({ hydrated: true });
      return false;
    }
  },

  initializeSession: async (workout = generateProgram(defaultOnboarding).workouts[0]) => {
    const history = await useWorkoutHistoryStore.getState().loadHistory();
    const now = new Date().toISOString();
    set({
      session: {
        id: `session-${Date.now()}`,
        programWorkoutId: workout.id,
        workoutName: workout.name,
        startedAt: now,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
        exercises: createSessionExercises(workout, history),
        personalRecords: [],
        completed: false,
      },
      restEndsAt: null,
      restNextType: null,
    });
    persistSnapshot(useWorkoutSessionStore.getState().session ? { session: useWorkoutSessionStore.getState().session as WorkoutSession, restEndsAt: null, restNextType: null } : null);
  },

  setPersonalRecords: (personalRecords) => {
    set((state) => state.session ? { session: { ...state.session, personalRecords } } : state);
    const state = useWorkoutSessionStore.getState();
    if (state.session && !state.session.completed) persistSnapshot({ session: state.session, restEndsAt: state.restEndsAt, restNextType: state.restNextType });
  },

  completeCurrentSet: () => {
    set((state) => {
      if (!state.session || state.session.completed) return state;

      const session = state.session;
      const exercise = session.exercises[session.currentExerciseIndex];
      const activeSet = exercise?.sets[session.currentSetIndex];
      if (!exercise || !activeSet || activeSet.completed) return state;

      const restDuration = resolveRestSeconds(exercise);
      const completedAt = new Date().toISOString();
      const exercisesWithCompletedSet = session.exercises.map((item, exerciseIndex) => {
        if (exerciseIndex !== session.currentExerciseIndex) return item;
        return {
          ...item,
          sets: item.sets.map((workoutSet, setIndex) =>
            setIndex === session.currentSetIndex
              ? { ...workoutSet, completed: true, completedAt }
              : workoutSet,
          ),
        };
      });

      const isLastSet = session.currentSetIndex === exercise.sets.length - 1;
      const isLastExercise = session.currentExerciseIndex === session.exercises.length - 1;

      if (isLastSet && isLastExercise) {
        return {
          ...state,
          session: {
            ...session,
            exercises: exercisesWithCompletedSet,
            completed: true,
            completedAt,
          },
          restEndsAt: null,
          restNextType: null,
        };
      }

      const nextExerciseIndex = isLastSet
        ? session.currentExerciseIndex + 1
        : session.currentExerciseIndex;
      const nextSetIndex = isLastSet ? 0 : session.currentSetIndex + 1;

      return {
        ...state,
        session: {
          ...session,
          exercises: exercisesWithCompletedSet,
          currentExerciseIndex: nextExerciseIndex,
          currentSetIndex: nextSetIndex,
        },
        restEndsAt: Date.now() + restDuration * 1000,
        restNextType: isLastSet ? 'exercise' : 'set',
      };
    });
    const state = useWorkoutSessionStore.getState();
    if (state.session) persistSnapshot({ session: state.session, restEndsAt: state.restEndsAt, restNextType: state.restNextType });
  },

  updateCurrentSet: (values) => {
    set((state) => {
      if (!state.session) return state;
      const { currentExerciseIndex, currentSetIndex } = state.session;
      return {
        ...state,
        session: {
          ...state.session,
          exercises: state.session.exercises.map((exercise, exerciseIndex) =>
            exerciseIndex !== currentExerciseIndex
              ? exercise
              : {
                  ...exercise,
                  sets: exercise.sets.map((workoutSet, setIndex) =>
                    setIndex !== currentSetIndex ? workoutSet : { ...workoutSet, ...values },
                  ),
                },
          ),
        },
      };
    });
    const state = useWorkoutSessionStore.getState();
    if (state.session) persistSnapshot({ session: state.session, restEndsAt: state.restEndsAt, restNextType: state.restNextType });
  },

  addRestTime: (seconds) => {
    set((state) => ({
      restEndsAt: (state.restEndsAt ?? Date.now()) + seconds * 1000,
    }));
    const state = useWorkoutSessionStore.getState();
    if (state.session) persistSnapshot({ session: state.session, restEndsAt: state.restEndsAt, restNextType: state.restNextType });
  },

  skipRest: () => {
    set({ restEndsAt: null, restNextType: null });
    const state = useWorkoutSessionStore.getState();
    if (state.session) persistSnapshot({ session: state.session, restEndsAt: null, restNextType: null });
  },

  swapExercise: (newExercise) => {
    set((state) => {
      if (!state.session) return state;
      const { currentExerciseIndex } = state.session;
      const currentEx = state.session.exercises[currentExerciseIndex];
      const history = useWorkoutHistoryStore.getState().workouts;
      const generatedEx: GeneratedExercise = {
        id: currentEx?.id ?? `swapped-${Date.now()}`,
        name: newExercise.name,
        muscleGroup: newExercise.muscleGroup,
        equipment: 'barbell',
        sets: currentEx?.sets.length ?? 3,
        targetRepRange: currentEx?.sets[0]?.targetReps ?? '8-12',
        recommendedWeight: newExercise.defaultWeight ?? 20,
        weightIncrement: currentEx?.weightIncrement ?? 2.5,
        restSeconds: currentEx?.restSeconds ?? 90,
      };
      const previousSets = findLatestExerciseSets(history, generatedEx);
      const rec = recommendWeight(generatedEx, previousSets);

      return {
        ...state,
        session: {
          ...state.session,
          exercises: state.session.exercises.map((ex, idx) => {
            if (idx !== currentExerciseIndex) return ex;
            return {
              ...ex,
              name: newExercise.name,
              muscleGroup: newExercise.muscleGroup,
              previousSets,
              recommendation: rec,
              sets: ex.sets.map((s) => (s.completed ? s : { ...s, weight: rec.recommendedWeight })),
            };
          }),
        },
      };
    });
    const state = useWorkoutSessionStore.getState();
    if (state.session) {
      persistSnapshot({
        session: state.session,
        restEndsAt: state.restEndsAt,
        restNextType: state.restNextType,
      });
    }
  },

  clearSession: () => {
    set({ session: null, restEndsAt: null, restNextType: null });
    persistSnapshot(null);
  },
}));

export async function clearPersistedActiveWorkout() {
  persistenceQueue = persistenceQueue.then(() => AsyncStorage.removeItem(ACTIVE_WORKOUT_SESSION_STORAGE_KEY));
  await persistenceQueue;
}

export function getSessionProgress(session: WorkoutSession) {
  const totalSets = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const completedSets = session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((workoutSet) => workoutSet.completed).length,
    0,
  );
  return { completedSets, totalSets, percentage: totalSets === 0 ? 0 : (completedSets / totalSets) * 100 };
}

export function getSessionSummary(session: WorkoutSession) {
  const completedSets = session.exercises.flatMap((exercise) => exercise.sets.filter((workoutSet) => workoutSet.completed));
  const durationMs = session.completedAt
    ? Math.max(0, new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime())
    : 0;
  const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
  const volume = completedSets.reduce((total, workoutSet) => total + workoutSet.weight * workoutSet.reps, 0);
  const exerciseCount = session.exercises.filter((exercise) => exercise.sets.some((workoutSet) => workoutSet.completed)).length;

  return {
    durationMinutes,
    exerciseCount,
    completedSets: completedSets.length,
    volume,
  };
}

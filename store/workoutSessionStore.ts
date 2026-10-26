import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { generateProgram, resolveRestSeconds, type EquipmentId, type GeneratedExercise, type GeneratedWorkout } from '@/lib/programGenerator';
import { findLatestExerciseSets, inferEquipmentFromName, practicalIncrement, recommendWeight, type WeightRecommendation } from '@/lib/adaptiveProgression';
import type { CompletedWorkout, PersonalRecord } from '@/types/workout';
import type { UserWorkout } from '@/types/userProgram';
import { defaultOnboarding } from './workoutStore';
import { useWorkoutHistoryStore } from './workoutHistoryStore';
import { useProgramStore } from './programStore';
import { getScheduledWorkout, useProgramProgressStore } from './programProgressStore';
import { useUserProfileStore } from './userProfileStore';

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
  equipment?: EquipmentId;
  previousSets: PreviousSet[];
  recommendation: WeightRecommendation;
  sets: WorkoutSet[];
  weightIncrement: number;
  restSeconds: number;
  isCustomRest?: boolean;
  customImageUri?: string;
  isCustom?: boolean;
};

export type WorkoutSession = {
  id: string;
  programWorkoutId: string;
  workoutName: string;
  workoutDate?: string; // YYYY-MM-DD calendar day
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
  initializeSession: (workout?: GeneratedWorkout | UserWorkout) => Promise<void>;
  completeCurrentSet: () => void;
  toggleSetCompletion: (exerciseIndex: number, setIndex: number) => void;
  setPersonalRecords: (personalRecords: PersonalRecord[]) => void;
  updateCurrentSet: (values: { weight?: number; reps?: number }, propagate?: boolean) => void;
  updateSet: (exerciseIndex: number, setIndex: number, values: { weight?: number; reps?: number }, propagate?: boolean) => void;
  updateExerciseRest: (exerciseIndex: number, restSeconds: number, applyToAll?: boolean) => void;
  addRestTime: (seconds: number) => void;
  skipRest: () => void;
  swapExercise: (newExercise: { name: string; muscleGroup: string; defaultWeight?: number }) => void;
  setCurrentSetIndex: (setIndex: number) => void;
  addSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number) => void;
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

let pendingSnapshot: ActiveWorkoutStorage | null | undefined = undefined;
let isPersisting = false;

async function processPersistence() {
  if (isPersisting || pendingSnapshot === undefined) return;
  isPersisting = true;
  const snapshotToSave = pendingSnapshot;
  pendingSnapshot = undefined;
  try {
    if (!snapshotToSave) {
      await AsyncStorage.removeItem(ACTIVE_WORKOUT_SESSION_STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(ACTIVE_WORKOUT_SESSION_STORAGE_KEY, JSON.stringify(snapshotToSave));
    }
  } catch {}
  isPersisting = false;
  if (pendingSnapshot !== undefined) {
    processPersistence();
  }
}

function persistSnapshot(snapshot: ActiveWorkoutStorage | null) {
  pendingSnapshot = snapshot;
  processPersistence();
}

function createSessionExercises(workout: GeneratedWorkout | UserWorkout, history: CompletedWorkout[]): WorkoutExercise[] {
  return workout.exercises.map((exercise, exerciseIndex) => {
    const equipment: EquipmentId = (exercise as any).equipment || inferEquipmentFromName(exercise.name);
    const exerciseWithEquipment = { ...exercise, equipment } as GeneratedExercise;
    const previousSets = findLatestExerciseSets(history, exerciseWithEquipment);
    const recommendation = recommendWeight(exerciseWithEquipment, previousSets);
    const weight = recommendation.source === 'history'
      ? recommendation.recommendedWeight
      : (typeof exercise.recommendedWeight === 'number' && exercise.recommendedWeight > 0
        ? exercise.recommendedWeight
        : recommendation.recommendedWeight);
    const defaultMinReps = Number.parseInt(exercise.targetRepRange ? exercise.targetRepRange.split('-')[0] : '10', 10) || 10;
    const reps = typeof recommendation.recommendedReps === 'number' && recommendation.recommendedReps > 0
      ? recommendation.recommendedReps
      : defaultMinReps;
    const equipIncrement = practicalIncrement(equipment, weight);
    const weightIncrement = typeof exercise.weightIncrement === 'number' && exercise.weightIncrement > 0
      ? Math.max(exercise.weightIncrement, equipIncrement)
      : equipIncrement;
    const restSeconds = resolveRestSeconds(exercise as any, workout as any);

    return {
      id: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment,
      previousSets,
      recommendation,
      weightIncrement,
      restSeconds,
      isCustomRest: (exercise as any).isCustomRest,
      customImageUri: (exercise as any).customImageUri,
      isCustom: (exercise as any).isCustom,
      sets: Array.from({ length: exercise.sets || 3 }, (_, setIndex) => ({
        id: `exercise-${exerciseIndex + 1}-set-${setIndex + 1}`,
        weight,
        reps,
        targetReps: exercise.targetRepRange || '8-12',
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

  initializeSession: async (workout?: GeneratedWorkout | UserWorkout) => {
    const history = await useWorkoutHistoryStore.getState().loadHistory();
    const activeProgram = useProgramStore.getState().program;
    const progress = useProgramProgressStore.getState().progress;
    const targetWorkout = workout ?? (activeProgram?.workouts?.length ? getScheduledWorkout(activeProgram, progress) : generateProgram(defaultOnboarding).workouts[0]);
    const now = new Date().toISOString();
    set({
      session: {
        id: `session-${Date.now()}`,
        programWorkoutId: targetWorkout.id,
        workoutName: targetWorkout.name,
        workoutDate: now.slice(0, 10),
        startedAt: now,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
        exercises: createSessionExercises(targetWorkout, history),
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
    const s = useWorkoutSessionStore.getState().session;
    if (!s || s.completed) return;
    const activeSet = s.exercises[s.currentExerciseIndex]?.sets[s.currentSetIndex];
    if (!activeSet || activeSet.completed) return;
    useWorkoutSessionStore.getState().toggleSetCompletion(s.currentExerciseIndex, s.currentSetIndex);
  },

  toggleSetCompletion: (targetExIdx: number, targetSetIdx: number) => {
    set((state) => {
      if (!state.session) return state;

      const session = state.session;
      const exercise = session.exercises[targetExIdx];
      const targetSet = exercise?.sets[targetSetIdx];
      if (!exercise || !targetSet) return state;

      // Case A: Uncompleting an already completed set (undo)
      if (targetSet.completed) {
        const exercisesWithUncompletedSet = session.exercises.map((item, exIdx) => {
          if (exIdx !== targetExIdx) return item;
          return {
            ...item,
            sets: item.sets.map((s, sIdx) =>
              sIdx === targetSetIdx
                ? { ...s, completed: false, completedAt: undefined }
                : s
            ),
          };
        });

        return {
          ...state,
          session: {
            ...session,
            exercises: exercisesWithUncompletedSet,
            completed: false,
            completedAt: undefined,
            currentExerciseIndex: targetExIdx,
            currentSetIndex: targetSetIdx,
          },
          restEndsAt: null,
          restNextType: null,
        };
      }

      // Case B: Completing a pending set
      const completedAt = new Date().toISOString();
      const exercisesWithCompletedSet = session.exercises.map((item, exIdx) => {
        if (exIdx !== targetExIdx) return item;
        return {
          ...item,
          sets: item.sets.map((workoutSet, sIdx) =>
            sIdx === targetSetIdx
              ? { ...workoutSet, completed: true, completedAt }
              : workoutSet,
          ),
        };
      });

      const allSetsCompleted = exercisesWithCompletedSet.every((ex) =>
        ex.sets.every((s) => s.completed)
      );

      if (allSetsCompleted) {
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

      const currentExUpdated = exercisesWithCompletedSet[targetExIdx];
      let nextExerciseIndex = targetExIdx;
      let nextSetIndex = targetSetIdx;
      let movedToAnotherExercise = false;

      // 1. Next uncompleted set in current exercise after targetSetIdx
      const nextAfterInCurrent = currentExUpdated.sets.findIndex(
        (s, idx) => idx > targetSetIdx && !s.completed
      );
      // 2. Any earlier uncompleted set in current exercise
      const anyUncompletedInCurrent = currentExUpdated.sets.findIndex((s) => !s.completed);

      if (nextAfterInCurrent !== -1) {
        nextSetIndex = nextAfterInCurrent;
      } else if (anyUncompletedInCurrent !== -1) {
        nextSetIndex = anyUncompletedInCurrent;
      } else {
        // 3. Find next exercise with uncompleted sets
        movedToAnotherExercise = true;
        let foundExIdx = exercisesWithCompletedSet.findIndex(
          (ex, idx) => idx > targetExIdx && ex.sets.some((s) => !s.completed)
        );
        if (foundExIdx === -1) {
          foundExIdx = exercisesWithCompletedSet.findIndex((ex) =>
            ex.sets.some((s) => !s.completed)
          );
        }
        if (foundExIdx !== -1) {
          nextExerciseIndex = foundExIdx;
          nextSetIndex = Math.max(
            0,
            exercisesWithCompletedSet[foundExIdx].sets.findIndex((s) => !s.completed)
          );
        }
      }

      const targetExerciseForRest = movedToAnotherExercise
        ? exercisesWithCompletedSet[nextExerciseIndex] ?? exercise
        : exercise;
      const restDuration = resolveRestSeconds(targetExerciseForRest);

      return {
        ...state,
        session: {
          ...session,
          exercises: exercisesWithCompletedSet,
          currentExerciseIndex: nextExerciseIndex,
          currentSetIndex: nextSetIndex,
        },
        restEndsAt: restDuration > 0 ? Date.now() + restDuration * 1000 : null,
        restNextType: restDuration > 0 ? (movedToAnotherExercise ? 'exercise' : 'set') : null,
      };
    });
    const state = useWorkoutSessionStore.getState();
    if (state.session) persistSnapshot({ session: state.session, restEndsAt: state.restEndsAt, restNextType: state.restNextType });
  },

  updateCurrentSet: (values, propagate = false) => {
    const session = useWorkoutSessionStore.getState().session;
    if (!session) return;
    useWorkoutSessionStore.getState().updateSet(session.currentExerciseIndex, session.currentSetIndex, values, propagate);
  },

  updateSet: (exerciseIndex, setIndex, values, propagate = false) => {
    set((state) => {
      if (!state.session) return state;
      const targetExercise = state.session.exercises[exerciseIndex];
      const targetSet = targetExercise?.sets[setIndex];
      if (!targetExercise || !targetSet) return state;

      // Completed sets must never propagate changes to other sets
      const shouldPropagate = propagate && !targetSet.completed;

      return {
        ...state,
        session: {
          ...state.session,
          exercises: state.session.exercises.map((exercise, exIdx) =>
            exIdx !== exerciseIndex
              ? exercise
              : {
                  ...exercise,
                  sets: exercise.sets.map((workoutSet, sIdx) => {
                    // Update target set (preserves completed and completedAt)
                    if (sIdx === setIndex) {
                      return { ...workoutSet, ...values };
                    }
                    // Forward-propagate weight and reps ONLY if explicitly requested AND target is uncompleted
                    if (shouldPropagate && sIdx > setIndex && !workoutSet.completed) {
                      return { ...workoutSet, ...values };
                    }
                    return workoutSet;
                  }),
                },
          ),
        },
      };
    });
    const state = useWorkoutSessionStore.getState();
    if (state.session) persistSnapshot({ session: state.session, restEndsAt: state.restEndsAt, restNextType: state.restNextType });
  },

  setCurrentSetIndex: (setIndex) => {
    set((state) => {
      if (!state.session) return state;
      const exercise = state.session.exercises[state.session.currentExerciseIndex];
      if (!exercise) return state;
      const bounded = Math.max(0, Math.min(exercise.sets.length - 1, setIndex));
      return {
        ...state,
        session: {
          ...state.session,
          currentSetIndex: bounded,
        },
      };
    });
    const state = useWorkoutSessionStore.getState();
    if (state.session && !state.session.completed) {
      persistSnapshot({
        session: state.session,
        restEndsAt: state.restEndsAt,
        restNextType: state.restNextType,
      });
    }
  },

  addSet: (exerciseIndex) => {
    set((state) => {
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          exercises: state.session.exercises.map((exercise, exIdx) => {
            if (exIdx !== exerciseIndex) return exercise;
            const lastSet = exercise.sets[exercise.sets.length - 1];
            const newSet: WorkoutSet = {
              id: `set-${Date.now()}-${exercise.sets.length + 1}`,
              weight: lastSet?.weight ?? 20,
              reps: lastSet?.reps ?? 8,
              targetReps: lastSet?.targetReps ?? '8-12',
              completed: false,
            };
            return {
              ...exercise,
              sets: [...exercise.sets, newSet],
            };
          }),
        },
      };
    });
    const state = useWorkoutSessionStore.getState();
    if (state.session) persistSnapshot({ session: state.session, restEndsAt: state.restEndsAt, restNextType: state.restNextType });
  },

  removeSet: (exerciseIndex) => {
    set((state) => {
      if (!state.session) return state;
      const targetExercise = state.session.exercises[exerciseIndex];
      if (!targetExercise || targetExercise.sets.length <= 1) return state;

      const lastSet = targetExercise.sets[targetExercise.sets.length - 1];
      if (lastSet?.completed) return state;

      const newSets = targetExercise.sets.slice(0, -1);
      const isCurrentExercise = state.session.currentExerciseIndex === exerciseIndex;
      const newCurrentSetIndex = isCurrentExercise
        ? Math.min(state.session.currentSetIndex, newSets.length - 1)
        : state.session.currentSetIndex;

      return {
        ...state,
        session: {
          ...state.session,
          currentSetIndex: newCurrentSetIndex,
          exercises: state.session.exercises.map((exercise, exIdx) => {
            if (exIdx !== exerciseIndex) return exercise;
            return {
              ...exercise,
              sets: newSets,
            };
          }),
        },
      };
    });
    const state = useWorkoutSessionStore.getState();
    if (state.session) persistSnapshot({ session: state.session, restEndsAt: state.restEndsAt, restNextType: state.restNextType });
  },

  updateExerciseRest: (exerciseIndex, restSeconds, applyToAll = false) => {
    const boundedRest = Math.max(0, Math.min(600, restSeconds));
    set((state) => {
      if (!state.session) return state;
      // If applyToAll is true, update all exercises; otherwise update ONLY target exercise
      const updatedExercises = state.session.exercises.map((ex, idx) => {
        if (applyToAll || idx === exerciseIndex) {
          return { ...ex, restSeconds: boundedRest, isCustomRest: true };
        }
        return ex;
      });
      const newRestEndsAt =
        state.restEndsAt !== null
          ? (boundedRest > 0 ? Date.now() + boundedRest * 1000 : null)
          : null;
      const newRestNextType =
        boundedRest === 0 ? null : state.restNextType;

      return {
        ...state,
        session: {
          ...state.session,
          exercises: updatedExercises,
        },
        restEndsAt: newRestEndsAt,
        restNextType: newRestNextType,
      };
    });

    if (applyToAll) {
      try {
        useUserProfileStore.getState().updateProfile({ defaultRestSeconds: boundedRest });
      } catch {
        // Ignore background sync errors
      }
    }

    const state = useWorkoutSessionStore.getState();
    if (state.session && !state.session.completed) {
      persistSnapshot({
        session: state.session,
        restEndsAt: state.restEndsAt,
        restNextType: state.restNextType,
      });
    }
  },

  addRestTime: (seconds) => {
    set((state) => {
      const base = Math.max(Date.now(), state.restEndsAt ?? Date.now());
      const newRestEndsAt = Math.max(Date.now(), base + seconds * 1000);
      return {
        ...state,
        restEndsAt: newRestEndsAt,
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
      const isBw = typeof newExercise.defaultWeight === 'number' && newExercise.defaultWeight === 0;
      const inferredEquipment = isBw ? 'bodyweight' : inferEquipmentFromName(newExercise.name, 'barbell');
      const swappedId = newExercise.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const generatedEx: GeneratedExercise = {
        id: swappedId || `swapped-${Date.now()}`,
        name: newExercise.name,
        muscleGroup: newExercise.muscleGroup,
        equipment: inferredEquipment,
        sets: currentEx?.sets.length ?? 3,
        targetRepRange: currentEx?.sets[0]?.targetReps ?? '8-12',
        recommendedWeight: newExercise.defaultWeight ?? 20,
        weightIncrement: practicalIncrement(inferredEquipment, newExercise.defaultWeight ?? 20),
        restSeconds: currentEx?.restSeconds ?? 90,
      };
      const previousSets = findLatestExerciseSets(history, generatedEx);
      const rec = recommendWeight(generatedEx, previousSets);
      const defaultMinReps = Number.parseInt(generatedEx.targetRepRange ? generatedEx.targetRepRange.split('-')[0] : '8', 10) || 8;
      const resolvedIncrement = practicalIncrement(inferredEquipment, rec.recommendedWeight);

      return {
        ...state,
        restEndsAt: null,
        restNextType: null,
        session: {
          ...state.session,
          currentSetIndex: 0,
          exercises: state.session.exercises.map((ex, idx) => {
            if (idx !== currentExerciseIndex) return ex;
            return {
              ...ex,
              id: generatedEx.id,
              name: newExercise.name,
              muscleGroup: newExercise.muscleGroup,
              equipment: inferredEquipment,
              previousSets,
              recommendation: rec,
              weightIncrement: resolvedIncrement,
              sets: ex.sets.map((s) => ({
                ...s,
                weight: rec.recommendedWeight,
                reps: rec.recommendedReps ?? defaultMinReps,
                completed: false,
                completedAt: undefined,
              })),
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
  pendingSnapshot = undefined;
  persistenceQueue = persistenceQueue.then(() => AsyncStorage.removeItem(ACTIVE_WORKOUT_SESSION_STORAGE_KEY));
  await persistenceQueue;
}

function isValidSessionSet(workoutSet: WorkoutSet | null | undefined): boolean {
  if (!workoutSet || workoutSet.completed !== true) return false;
  if (typeof workoutSet.reps !== 'number' || !Number.isFinite(workoutSet.reps) || workoutSet.reps <= 0) return false;
  if (typeof workoutSet.weight !== 'number' || !Number.isFinite(workoutSet.weight) || workoutSet.weight < 0) return false;
  return true;
}

export function getSessionProgress(session: WorkoutSession) {
  const totalSets = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const completedSets = session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter(isValidSessionSet).length,
    0,
  );
  return { completedSets, totalSets, percentage: totalSets === 0 ? 0 : (completedSets / totalSets) * 100 };
}

export function getSessionSummary(session: WorkoutSession) {
  const plannedSets = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const completedSets = session.exercises.flatMap((exercise) => exercise.sets.filter(isValidSessionSet));
  const durationMs = session.completedAt
    ? Math.max(0, new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime())
    : 0;
  const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
  const volume = Math.round(
    completedSets.reduce((total, workoutSet) => total + workoutSet.weight * workoutSet.reps, 0) * 100
  ) / 100;
  const exerciseCount = session.exercises.filter((exercise) => exercise.sets.some(isValidSessionSet)).length;
  const plannedExerciseCount = session.exercises.length;
  const isPartial = plannedSets > 0 && completedSets.length < plannedSets;

  return {
    durationMinutes,
    exerciseCount,
    plannedExerciseCount,
    completedSets: completedSets.length,
    plannedSets,
    isPartial,
    volume,
  };
}

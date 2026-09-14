import { create } from 'zustand';
import { generateProgram, type GeneratedWorkout } from '@/lib/programGenerator';
import { defaultOnboarding } from './workoutStore';

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
  sets: WorkoutSet[];
};

export type WorkoutSession = {
  id: string;
  workoutName: string;
  startedAt: string;
  completedAt?: string;
  currentExerciseIndex: number;
  currentSetIndex: number;
  exercises: WorkoutExercise[];
  completed: boolean;
};

type WorkoutSessionState = {
  session: WorkoutSession | null;
  restEndsAt: number | null;
  initializeSession: (workout?: GeneratedWorkout) => void;
  completeCurrentSet: () => void;
  updateCurrentSet: (values: { weight?: number; reps?: number }) => void;
  addRestTime: (seconds: number) => void;
  skipRest: () => void;
  clearSession: () => void;
};

const DEFAULT_REST_SECONDS = 150;

function createSessionExercises(workout: GeneratedWorkout): WorkoutExercise[] {
  return workout.exercises.map((exercise, exerciseIndex) => {
    const weight = exercise.recommendedWeight;
    const previousSets = [
      { weight: Math.max(0, weight - 2.5), reps: 10 },
      { weight: Math.max(0, weight - 2.5), reps: 9 },
      { weight: Math.max(0, weight - 2.5), reps: 9 },
    ];

    return {
      id: `exercise-${exerciseIndex + 1}`,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      previousSets,
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

  initializeSession: (workout = generateProgram(defaultOnboarding).workouts[0]) => {
    const now = new Date().toISOString();
    set({
      session: {
        id: `session-${Date.now()}`,
        workoutName: workout.name,
        startedAt: now,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
        exercises: createSessionExercises(workout),
        completed: false,
      },
      restEndsAt: null,
    });
  },

  completeCurrentSet: () => {
    set((state) => {
      if (!state.session || state.session.completed) return state;

      const session = state.session;
      const exercise = session.exercises[session.currentExerciseIndex];
      const activeSet = exercise?.sets[session.currentSetIndex];
      if (!exercise || !activeSet || activeSet.completed) return state;

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
        restEndsAt: Date.now() + DEFAULT_REST_SECONDS * 1000,
      };
    });
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
  },

  addRestTime: (seconds) => {
    set((state) => ({
      restEndsAt: (state.restEndsAt ?? Date.now()) + seconds * 1000,
    }));
  },

  skipRest: () => set({ restEndsAt: null }),

  clearSession: () => set({ session: null, restEndsAt: null }),
}));

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

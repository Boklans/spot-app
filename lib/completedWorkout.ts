import type { CompletedWorkout, PersonalRecord } from '@/types/workout';
import type { WorkoutSession } from '@/store/workoutSessionStore';

export function createCompletedWorkoutSnapshot(session: WorkoutSession, personalRecords: PersonalRecord[] = []): CompletedWorkout {
  const completedAt = session.completedAt ?? new Date().toISOString();
  const durationSeconds = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000));
  const exercises = session.exercises.map((exercise) => ({
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    muscleGroup: exercise.muscleGroup,
    sets: exercise.sets.filter((set) => set.completed).map((set) => ({
      weight: set.weight,
      reps: set.reps,
      volume: set.weight * set.reps,
      completedAt: set.completedAt ?? completedAt,
    })),
  })).filter((exercise) => exercise.sets.length > 0);
  const completedSets = exercises.flatMap((exercise) => exercise.sets);

  return {
    id: session.id,
    programWorkoutId: session.programWorkoutId,
    workoutName: session.workoutName,
    startedAt: session.startedAt,
    completedAt,
    durationSeconds,
    totalSets: completedSets.length,
    totalVolume: completedSets.reduce((total, set) => total + set.volume, 0),
    exercises,
    personalRecords,
  };
}

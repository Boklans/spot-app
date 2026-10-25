import type { CompletedWorkout, PersonalRecord } from '@/types/workout';
import type { WorkoutSession } from '@/store/workoutSessionStore';

export function isValidCompletedSet(
  set: { completed?: boolean; weight?: number; reps?: number } | null | undefined
): boolean {
  if (!set || set.completed !== true) return false;
  if (typeof set.reps !== 'number' || !Number.isFinite(set.reps) || set.reps <= 0) return false;
  if (typeof set.weight !== 'number' || !Number.isFinite(set.weight) || set.weight < 0) return false;
  return true;
}

export function createCompletedWorkoutSnapshot(
  session: WorkoutSession,
  personalRecords: PersonalRecord[] = []
): CompletedWorkout {
  const completedAt = session.completedAt ?? new Date().toISOString();
  const durationSeconds = Math.max(
    0,
    Math.round((new Date(completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
  );
  const plannedSets = session.exercises.reduce((total, ex) => total + (ex.sets?.length ?? 0), 0);
  const exercises = session.exercises
    .map((exercise) => ({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      sets: exercise.sets.filter(isValidCompletedSet).map((set) => {
        const safeWeight = Math.max(0, Number.isFinite(set.weight) ? set.weight : 0);
        const safeReps = Math.max(0, Number.isFinite(set.reps) ? set.reps : 0);
        return {
          weight: safeWeight,
          reps: safeReps,
          volume: Math.round(safeWeight * safeReps * 100) / 100,
          completedAt: set.completedAt ?? completedAt,
        };
      }),
    }))
    .filter((exercise) => exercise.sets.length > 0);
  const completedSets = exercises.flatMap((exercise) => exercise.sets);
  const isPartial = plannedSets > 0 && completedSets.length < plannedSets;

  return {
    id: session.id,
    programWorkoutId: session.programWorkoutId,
    workoutName: session.workoutName,
    workoutDate: session.workoutDate || session.startedAt.slice(0, 10),
    startedAt: session.startedAt,
    completedAt,
    durationSeconds,
    totalSets: completedSets.length,
    plannedSets,
    isPartial,
    totalVolume: Math.round(completedSets.reduce((total, set) => total + set.volume, 0) * 100) / 100,
    exercises,
    personalRecords,
  };
}

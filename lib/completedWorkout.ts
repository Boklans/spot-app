import { calculateSetVolumeKg } from '@/lib/weightUtils';
import type { WorkoutSession } from '@/store/workoutSessionStore';
import type { CompletedWorkout, PersonalRecord } from '@/types/workout';

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

  const plannedTotalSets = session.exercises.reduce((total, ex) => total + (ex.sets?.length ?? 0), 0);
  const plannedWorkingSets = session.exercises.reduce(
    (total, ex) => total + (ex.sets ?? []).filter((s) => s.setType !== 'warmup').length,
    0
  );

  const exercises = session.exercises
    .map((exercise) => ({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      supersetWithNext: exercise.supersetWithNext,
      sets: exercise.sets.filter(isValidCompletedSet).map((set) => {
        const safeWeight = Math.max(0, Number.isFinite(set.weight) ? set.weight : 0);
        const safeReps = Math.max(0, Number.isFinite(set.reps) ? set.reps : 0);
        const resolvedSetType = set.setType ?? 'normal';
        return {
          weight: safeWeight,
          reps: safeReps,
          volume: calculateSetVolumeKg({
            weightKg: safeWeight,
            reps: safeReps,
            exerciseName: exercise.name,
            equipment: exercise.equipment,
            setType: resolvedSetType,
          }),
          completedAt: set.completedAt ?? completedAt,
          rir: set.rir,
          setType: resolvedSetType,
        };
      }),
    }))
    .filter((exercise) => exercise.sets.length > 0);

  const completedSets = exercises.flatMap((exercise) => exercise.sets);
  const workingSets = completedSets.filter((set) => set.setType !== 'warmup');

  // Partial workout detection strictly evaluates prescribed working sets so skipped optional
  // warm-up sets never block split rotation, while an all-warmup session stays partial.
  const isPartial =
    plannedWorkingSets > 0
      ? workingSets.length < plannedWorkingSets
      : completedSets.length > 0 || plannedTotalSets > 0;

  return {
    id: session.id,
    programWorkoutId: session.programWorkoutId,
    workoutName: session.workoutName,
    workoutDate: session.workoutDate || session.startedAt.slice(0, 10),
    startedAt: session.startedAt,
    completedAt,
    durationSeconds,
    totalSets: completedSets.length,
    plannedSets: plannedWorkingSets > 0 ? plannedWorkingSets : plannedTotalSets,
    isPartial,
    totalVolume: Math.round(workingSets.reduce((total, set) => total + set.volume, 0) * 100) / 100,
    exercises,
    personalRecords,
  };
}

import type { GeneratedWorkout } from '@/lib/programGenerator';
import { normalizeMuscleGroup, type MuscleRecoveryStatus } from '@/lib/recoveryEngine';
import type { UserWorkout } from '@/types/userProgram';

export type WorkoutInsightType = 'warning' | 'positive' | 'neutral';

export type WorkoutInsight = {
  type: WorkoutInsightType;
  message: string;
};

/**
 * Evaluates the scheduled workout against muscle recovery data to provide
 * actionable, deterministic training insights (e.g., fatigue warnings or PR readiness).
 */
export function getWorkoutInsight(
  scheduledWorkout: UserWorkout | GeneratedWorkout,
  recoveryData: MuscleRecoveryStatus[]
): WorkoutInsight | null {
  if (!scheduledWorkout) return null;

  // 1. Extract and normalize targeted muscle groups from workout metadata and exercises
  const rawMuscles: string[] = [
    ...(scheduledWorkout.muscleGroups || []),
    ...(scheduledWorkout.exercises?.map((ex) => ex.muscleGroup) || []),
  ];

  if (rawMuscles.length === 0) return null;

  const targetedNormalizedMuscles = [
    ...new Set(rawMuscles.filter(Boolean).map(normalizeMuscleGroup)),
  ];

  if (targetedNormalizedMuscles.length === 0) return null;

  // 2. Match target muscles with recovery data
  const matchingStatuses = targetedNormalizedMuscles
    .map((muscle) =>
      recoveryData.find((r) => r.muscleGroup.toLowerCase() === muscle.toLowerCase())
    )
    .filter((r): r is MuscleRecoveryStatus => Boolean(r));

  if (matchingStatuses.length === 0) return null;

  // 3. Check for fatigued/under-recovered muscles (< 50% readiness or 'Fatigued')
  const fatiguedMuscles = matchingStatuses
    .filter((r) => r.status === 'Fatigued' || r.readinessPercentage < 50)
    .sort((a, b) => a.readinessPercentage - b.readinessPercentage);

  if (fatiguedMuscles.length > 0) {
    const mostFatigued = fatiguedMuscles[0];
    const muscleNameDisplay =
      fatiguedMuscles.length === 1
        ? mostFatigued.muscleGroup
        : `${fatiguedMuscles[0].muscleGroup} & ${fatiguedMuscles[1].muscleGroup}`;

    return {
      type: 'warning',
      message: `Your ${muscleNameDisplay} ${
        fatiguedMuscles.length === 1 ? 'is' : 'are'
      } still recovering (${mostFatigued.readinessPercentage}%). Consider an active rest day or swapping workouts.`,
    };
  }

  // 4. Check if all target muscles are well recovered (> 85%)
  const allRecovered = matchingStatuses.every((r) => r.readinessPercentage > 85);
  if (allRecovered) {
    return {
      type: 'positive',
      message: 'Your target muscles are fully recovered. Great day to push for a PR!',
    };
  }

  // 5. Normal recovery state: no specific banner needed
  return null;
}


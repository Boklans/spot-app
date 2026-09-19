import type { CompletedWorkout } from '@/types/workout';

export type RecoveryStatusType = 'Ready' | 'Recovering' | 'Fatigued';

export type MuscleRecoveryStatus = {
  muscleGroup: string;
  readinessPercentage: number; // 0-100
  status: RecoveryStatusType;
};

export const CORE_MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
] as const;

export function normalizeMuscleGroup(muscleGroup: string): string {
  const lower = muscleGroup.trim().toLowerCase();
  if (['legs', 'quads', 'hamstrings', 'calves', 'glutes', 'quadriceps'].includes(lower)) {
    return 'Legs';
  }
  if (['arms', 'biceps', 'triceps', 'forearms'].includes(lower)) {
    return 'Arms';
  }
  if (['back', 'lats', 'traps', 'upper back', 'lower back'].includes(lower)) {
    return 'Back';
  }
  if (['chest', 'pecs', 'pectorals'].includes(lower)) {
    return 'Chest';
  }
  if (['shoulders', 'delts', 'deltoids'].includes(lower)) {
    return 'Shoulders';
  }
  if (['core', 'abs', 'abdominals', 'obliques'].includes(lower)) {
    return 'Core';
  }
  return muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1);
}

/**
 * Calculates muscle recovery based on training history using a time-decay model:
 * - > 72h ago (or never trained): 100% ('Ready')
 * - 48h - 72h ago: ~80-95% ('Ready')
 * - 24h - 48h ago: ~50-70% ('Recovering')
 * - < 24h ago: ~15-40% ('Fatigued')
 * 
 * Returns all core muscle groups sorted with most fatigued first.
 */
export function calculateMuscleRecovery(
  history: CompletedWorkout[],
  now = new Date()
): MuscleRecoveryStatus[] {
  const nowMs = now.getTime();
  const latestTrainedMap = new Map<string, Date>();

  // 1. Scan completed workouts and find the latest training timestamp per normalized muscle group
  for (const workout of history) {
    if (!workout.completedAt) continue;
    const completedDate = new Date(workout.completedAt);
    if (isNaN(completedDate.getTime())) continue;

    for (const exercise of workout.exercises) {
      if (!exercise.muscleGroup) continue;
      const normalized = normalizeMuscleGroup(exercise.muscleGroup);
      const existing = latestTrainedMap.get(normalized);
      if (!existing || completedDate.getTime() > existing.getTime()) {
        latestTrainedMap.set(normalized, completedDate);
      }
    }
  }

  // 2. Compute recovery status for each core muscle group
  const results: MuscleRecoveryStatus[] = CORE_MUSCLE_GROUPS.map((group) => {
    const lastTrained = latestTrainedMap.get(group);

    if (!lastTrained) {
      return {
        muscleGroup: group,
        readinessPercentage: 100,
        status: 'Ready',
      };
    }

    const diffHours = (nowMs - lastTrained.getTime()) / (1000 * 60 * 60);

    // If timestamp is in future or over 72 hours ago, muscle is fully recovered
    if (diffHours < 0 || diffHours >= 72) {
      return {
        muscleGroup: group,
        readinessPercentage: 100,
        status: 'Ready',
      };
    }

    let readinessPercentage: number;
    let status: RecoveryStatusType;

    if (diffHours >= 48) {
      // 48h - 72h ago: ~80-95% ('Ready')
      readinessPercentage = Math.round(80 + ((diffHours - 48) / 24) * 15);
      status = 'Ready';
    } else if (diffHours >= 24) {
      // 24h - 48h ago: ~50-70% ('Recovering')
      readinessPercentage = Math.round(50 + ((diffHours - 24) / 24) * 20);
      status = 'Recovering';
    } else {
      // < 24h ago: ~15-40% ('Fatigued')
      readinessPercentage = Math.round(15 + (diffHours / 24) * 25);
      status = 'Fatigued';
    }

    readinessPercentage = Math.min(100, Math.max(0, readinessPercentage));

    return {
      muscleGroup: group,
      readinessPercentage,
      status,
    };
  });

  // 3. Sort: Most fatigued first (Fatigued -> Recovering -> Ready, then ascending readiness %)
  const statusPriority: Record<RecoveryStatusType, number> = {
    Fatigued: 0,
    Recovering: 1,
    Ready: 2,
  };

  return results.sort((a, b) => {
    if (statusPriority[a.status] !== statusPriority[b.status]) {
      return statusPriority[a.status] - statusPriority[b.status];
    }
    return a.readinessPercentage - b.readinessPercentage;
  });
}


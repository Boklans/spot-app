import {
  calculateMuscleRecoveryStats,
  normalizeMuscleCategory,
} from '@/lib/progressCalculator';
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
  return normalizeMuscleCategory(muscleGroup);
}

/**
 * Unified Muscle Recovery Engine (P2-01):
 * Delegates directly to the working-set-aware `calculateMuscleRecoveryStats`
 * engine (36h-72h scaling, warmup-excluded, bilingual-safe) so Analytics,
 * Coach, Preview, and Notifications report 100% identical muscle readiness.
 */
export function calculateMuscleRecovery(
  history: CompletedWorkout[],
  now = new Date()
): MuscleRecoveryStatus[] {
  const statsMap = calculateMuscleRecoveryStats(history, now);

  const results: MuscleRecoveryStatus[] = CORE_MUSCLE_GROUPS.map((group) => {
    const stat = statsMap[group];
    const readinessPercentage = stat ? stat.recoveryPercent : 100;
    const status: RecoveryStatusType =
      !stat || stat.status === 'fresh'
        ? 'Ready'
        : stat.status === 'recovering'
          ? 'Recovering'
          : 'Fatigued';

    return {
      muscleGroup: group,
      readinessPercentage,
      status,
    };
  });

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

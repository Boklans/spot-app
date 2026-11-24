import { isBarbellExercise, roundPracticalWeight } from '@/lib/adaptiveProgression';
import type { EquipmentId } from '@/lib/programGenerator';
import type { WorkoutSet } from '@/store/workoutSessionStore';

export interface WarmupPlanInput {
  workingWeightKg: number;
  workingReps?: number;
  equipment: EquipmentId;
  exerciseName: string;
  exerciseIndex: number;
}

export interface PlannedWarmupSet {
  weight: number;
  reps: number;
  targetReps: string;
}

/**
 * Generates biomechanically realistic, progressive ramp-up warm-up sets
 * tailored to the exercise's equipment and target working weight.
 */
export function buildWarmupPlan(input: WarmupPlanInput): PlannedWarmupSet[] {
  const { workingWeightKg, equipment, exerciseName } = input;
  const safeWorking = Number.isFinite(workingWeightKg) && workingWeightKg > 0 ? workingWeightKg : 0;

  // Bodyweight or unloaded exercise: 1 controlled activation set
  if (equipment === 'bodyweight' || safeWorking <= 0) {
    return [{ weight: 0, reps: 10, targetReps: '10' }];
  }

  const isBarbell = isBarbellExercise(exerciseName, equipment);
  const barFloor = isBarbell ? 20 : 0;

  const snapWeight = (ratio: number): number => {
    const raw = safeWorking * ratio;
    let rounded = roundPracticalWeight(raw, equipment);
    if (isBarbell && safeWorking >= barFloor) {
      rounded = Math.max(barFloor, rounded);
    }
    // Keep warmup strictly lighter than working weight unless working weight itself is the empty bar
    if (rounded >= safeWorking && safeWorking > barFloor) {
      const step = equipment === 'dumbbells' ? 1 : 2.5;
      rounded = Math.max(barFloor, Math.round((safeWorking - step) * 10) / 10);
    }
    return Math.max(0, Math.round(rounded * 10) / 10);
  };

  let rawPlan: { ratio: number; reps: number }[];
  if ((isBarbell || equipment === 'machines') && safeWorking >= 60) {
    rawPlan = [
      { ratio: 0.45, reps: 8 },
      { ratio: 0.68, reps: 5 },
      { ratio: 0.85, reps: 2 },
    ];
  } else if (equipment === 'dumbbells' && safeWorking >= 22) {
    rawPlan = [
      { ratio: 0.5, reps: 8 },
      { ratio: 0.72, reps: 5 },
      { ratio: 0.86, reps: 2 },
    ];
  } else if (safeWorking >= 25 || (equipment === 'dumbbells' && safeWorking >= 10)) {
    rawPlan = [
      { ratio: 0.55, reps: 8 },
      { ratio: 0.8, reps: 4 },
    ];
  } else {
    rawPlan = [{ ratio: 0.6, reps: 10 }];
  }

  const deduped: PlannedWarmupSet[] = [];
  for (const step of rawPlan) {
    const weight = snapWeight(step.ratio);
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.weight - weight) < 0.01) {
      continue;
    }
    // Avoid generating a warmup heavier than or equal to working weight when we already have a lighter warmup
    if (weight >= safeWorking && deduped.length > 0) {
      continue;
    }
    deduped.push({
      weight,
      reps: step.reps,
      targetReps: String(step.reps),
    });
  }

  if (deduped.length === 0) {
    return [{ weight: Math.max(barFloor, Math.min(safeWorking, barFloor || safeWorking)), reps: 8, targetReps: '8' }];
  }

  return deduped;
}

export function createWarmupWorkoutSets(input: WarmupPlanInput): WorkoutSet[] {
  const plan = buildWarmupPlan(input);
  const stamp = Date.now();
  return plan.map((item, idx) => ({
    id: `exercise-${input.exerciseIndex + 1}-warmup-${idx + 1}-${stamp}`,
    weight: item.weight,
    reps: item.reps,
    targetReps: item.targetReps,
    completed: false,
    setType: 'warmup',
  }));
}

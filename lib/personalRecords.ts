import type { CompletedWorkout, PersonalRecord } from '@/types/workout';
import { isAssistedExercise } from '@/lib/adaptiveProgression';
import { areExercisesEquivalent, resolveCanonicalExerciseId } from '@/lib/exercises';
import { convertWeightToActiveUnit, formatWeight } from '@/lib/weightUtils';
import type { AppLanguage, WeightUnit } from '@/store/userProfileStore';

export type BaselineLiftsInput = {
  benchPressKg?: number;
  squatKg?: number;
  deadliftKg?: number;
  overheadPressKg?: number;
};

export type AllTimeExerciseRecord = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  estimated1RMKg: number;
  isBodyweight: boolean;
  isAssisted: boolean;
  isNewPr: boolean;
  achievedAt: string;
};

export function calculateEstimated1RM(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function normalizeExerciseName(name: string): string {
  return (name || '').trim().toLowerCase();
}

function isSameExercise(
  a: { exerciseId?: string; exerciseName?: string },
  b: { exerciseId?: string; exerciseName?: string }
): boolean {
  return areExercisesEquivalent(a, b);
}

function getBaselineWeightForExercise(
  exerciseName: string,
  baselineLifts?: BaselineLiftsInput
): number {
  if (!baselineLifts) return 0;
  const canonicalId = resolveCanonicalExerciseId(exerciseName);
  if (canonicalId === 'barbell-bench-press') {
    return baselineLifts.benchPressKg && baselineLifts.benchPressKg > 0
      ? baselineLifts.benchPressKg
      : 0;
  }
  if (canonicalId === 'barbell-back-squat') {
    return baselineLifts.squatKg && baselineLifts.squatKg > 0
      ? baselineLifts.squatKg
      : 0;
  }
  if (canonicalId === 'conventional-deadlift') {
    return baselineLifts.deadliftKg && baselineLifts.deadliftKg > 0
      ? baselineLifts.deadliftKg
      : 0;
  }
  if (canonicalId === 'overhead-barbell-press') {
    return baselineLifts.overheadPressKg && baselineLifts.overheadPressKg > 0
      ? baselineLifts.overheadPressKg
      : 0;
  }
  return 0;
}

export function detectPersonalRecords(
  current: CompletedWorkout,
  history: CompletedWorkout[],
  baselineLifts?: BaselineLiftsInput
): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  const priorWorkouts = history.filter((workout) => workout.id !== current.id);

  for (const exercise of current.exercises) {
    const currentSets = (exercise.sets || []).filter(
      (s) =>
        s.setType !== 'warmup' &&
        typeof s.reps === 'number' &&
        s.reps > 0 &&
        typeof s.weight === 'number' &&
        s.weight >= 0
    );
    if (currentSets.length === 0) continue;

    const historicalSets = priorWorkouts
      .flatMap((workout) => workout.exercises)
      .filter((item) => isSameExercise(item, exercise))
      .flatMap((item) => item.sets)
      .filter(
        (s) =>
          s.setType !== 'warmup' &&
          typeof s.reps === 'number' &&
          s.reps > 0 &&
          typeof s.weight === 'number' &&
          s.weight >= 0
      );

    const baselineKg = getBaselineWeightForExercise(exercise.exerciseName, baselineLifts);
    if (historicalSets.length === 0 && baselineKg <= 0) {
      // First session without prior baseline establishes the initial benchmark
      continue;
    }

    const isAssisted = isAssistedExercise(exercise.exerciseName);
    const hasPositiveWeight =
      currentSets.some((s) => s.weight > 0) ||
      historicalSets.some((s) => s.weight > 0) ||
      baselineKg > 0;

    // 1. Bodyweight exercises (weight === 0): PR is strictly more reps in a set
    if (!hasPositiveWeight) {
      if (historicalSets.length === 0) continue;
      const currentMaxReps = Math.max(...currentSets.map((s) => s.reps));
      const historicalMaxReps = Math.max(...historicalSets.map((s) => s.reps));
      if (currentMaxReps > historicalMaxReps) {
        records.push({
          id: `${current.id}-${exercise.exerciseId}-reps`,
          type: 'estimated_1rm',
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          value: currentMaxReps,
          reps: currentMaxReps,
          isBodyweight: true,
          label: `${currentMaxReps} reps`,
        });
      }
      continue;
    }

    // 2. Assisted exercises (Gravitron): LESS counterweight assistance = stronger
    if (isAssisted) {
      const posCurrent = currentSets.filter((s) => s.weight > 0);
      const posHist = historicalSets.filter((s) => s.weight > 0);
      if (posCurrent.length === 0 || posHist.length === 0) continue;

      const currentMinAssist = Math.min(...posCurrent.map((s) => s.weight));
      const historicalMinAssist = Math.min(...posHist.map((s) => s.weight));
      const bestCurrentAtMin = Math.max(
        ...posCurrent.filter((s) => Math.abs(s.weight - currentMinAssist) < 0.01).map((s) => s.reps)
      );

      if (currentMinAssist < historicalMinAssist) {
        records.push({
          id: `${current.id}-${exercise.exerciseId}-weight`,
          type: 'weight',
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          value: currentMinAssist,
          weightKg: currentMinAssist,
          reps: bestCurrentAtMin,
          isAssisted: true,
          label: `-${formatWeight(currentMinAssist)} kg × ${bestCurrentAtMin}`,
        });
      } else if (Math.abs(currentMinAssist - historicalMinAssist) < 0.01) {
        const bestHistAtMin = Math.max(
          ...posHist.filter((s) => Math.abs(s.weight - historicalMinAssist) < 0.01).map((s) => s.reps)
        );
        if (bestCurrentAtMin > bestHistAtMin) {
          records.push({
            id: `${current.id}-${exercise.exerciseId}-estimated-1rm`,
            type: 'estimated_1rm',
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            value: currentMinAssist,
            weightKg: currentMinAssist,
            reps: bestCurrentAtMin,
            isAssisted: true,
            label: `-${formatWeight(currentMinAssist)} kg × ${bestCurrentAtMin}`,
          });
        }
      }
      continue;
    }

    // 3. Standard weighted exercises: higher weight OR higher estimated 1RM (more reps at working weight)
    const currentMaxWeight = Math.max(...currentSets.map((set) => set.weight));
    const historicalMaxWeight = Math.max(
      baselineKg,
      ...(historicalSets.length > 0 ? historicalSets.map((set) => set.weight) : [0])
    );

    const bestSetAtMaxWeight = currentSets
      .filter((s) => Math.abs(s.weight - currentMaxWeight) < 0.01)
      .sort((a, b) => b.reps - a.reps)[0];

    if (currentMaxWeight > historicalMaxWeight) {
      const repsLabel = bestSetAtMaxWeight ? ` × ${bestSetAtMaxWeight.reps}` : '';
      records.push({
        id: `${current.id}-${exercise.exerciseId}-weight`,
        type: 'weight',
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        value: currentMaxWeight,
        weightKg: currentMaxWeight,
        reps: bestSetAtMaxWeight?.reps,
        label: `${formatWeight(currentMaxWeight)} kg${repsLabel}`,
      });
    } else {
      const currentBestSet = [...currentSets].sort(
        (a, b) => calculateEstimated1RM(b.weight, b.reps) - calculateEstimated1RM(a.weight, a.reps)
      )[0];
      const currentBest1RM = currentBestSet
        ? calculateEstimated1RM(currentBestSet.weight, currentBestSet.reps)
        : 0;
      const historicalBest1RM = Math.max(
        baselineKg > 0 ? calculateEstimated1RM(baselineKg, 5) : 0,
        ...(historicalSets.length > 0
          ? historicalSets.map((set) => calculateEstimated1RM(set.weight, set.reps))
          : [0])
      );

      if (currentBestSet && currentBest1RM > historicalBest1RM) {
        records.push({
          id: `${current.id}-${exercise.exerciseId}-estimated-1rm`,
          type: 'estimated_1rm',
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          value: currentBest1RM,
          weightKg: currentBestSet.weight,
          reps: currentBestSet.reps,
          oneRepMaxKg: currentBest1RM,
          label: `${formatWeight(currentBestSet.weight)} kg × ${currentBestSet.reps} (1RM ${formatWeight(currentBest1RM)} kg)`,
        });
      }
    }
  }

  return records;
}

/**
 * Dynamically formats a PersonalRecord in the user's active unit (`kg` or `lbs`)
 * and language (`en` or `uk`), including graceful conversion of legacy stored `kg` labels.
 */
export function formatPersonalRecordLabel(
  record: PersonalRecord,
  unit: WeightUnit = 'kg',
  lang: AppLanguage = 'en'
): string {
  const uLabel = unit === 'lbs' ? 'lb' : lang === 'uk' ? 'кг' : 'kg';
  const repsWord = lang === 'uk' ? 'повт.' : 'reps';

  if (record.isBodyweight || /^\d+\s*reps$/i.test((record.label || '').trim())) {
    const repsVal = record.reps ?? Math.round(record.value);
    return `${repsVal} ${repsWord}`;
  }

  if (record.isAssisted || isAssistedExercise(record.exerciseName)) {
    const assistKg = record.weightKg ?? record.value;
    const disp = formatWeight(convertWeightToActiveUnit(assistKg, unit));
    if (record.reps) {
      return `-${disp} ${uLabel} × ${record.reps}`;
    }
    const legacyRepsMatch = (record.label || '').match(/×\s*(\d+)/);
    return legacyRepsMatch ? `-${disp} ${uLabel} × ${legacyRepsMatch[1]}` : `-${disp} ${uLabel}`;
  }

  if (typeof record.weightKg === 'number' && record.weightKg > 0) {
    const dispW = formatWeight(convertWeightToActiveUnit(record.weightKg, unit));
    if (typeof record.oneRepMaxKg === 'number' && record.oneRepMaxKg > 0 && record.reps) {
      const disp1RM = formatWeight(convertWeightToActiveUnit(record.oneRepMaxKg, unit));
      return `${dispW} ${uLabel} × ${record.reps} (1RM ${disp1RM} ${uLabel})`;
    }
    return record.reps ? `${dispW} ${uLabel} × ${record.reps}` : `${dispW} ${uLabel}`;
  }

  // Legacy stored label parser: e.g. "100 kg × 8 (1RM 126.7 kg)" or "100 kg × 5"
  const raw = record.label || '';
  const converted = raw.replace(/(-?\d+(?:\.\d+)?)\s*kg\b/gi, (_m, numStr) => {
    const kgNum = parseFloat(numStr);
    if (!Number.isFinite(kgNum)) return _m;
    return `${formatWeight(convertWeightToActiveUnit(Math.abs(kgNum), unit))} ${uLabel}`;
  });
  return converted;
}

/**
 * Computes deduplicated all-time Personal Bests per exercise across workout history
 * and optional onboarding baseline lifts.
 */
export function getAllTimePersonalRecords(
  history: CompletedWorkout[],
  baselineLifts?: BaselineLiftsInput
): AllTimeExerciseRecord[] {
  const byExercise = new Map<string, AllTimeExerciseRecord>();

  // Sort chronological (oldest -> newest) so we accurately track when the best record was set
  const chronological = [...history].sort(
    (a, b) =>
      new Date(a.completedAt || a.startedAt).getTime() -
      new Date(b.completedAt || b.startedAt).getTime()
  );

  const seenCount = new Map<string, number>();

  for (const workout of chronological) {
    const workoutDate = workout.completedAt || workout.startedAt;
    for (const exercise of workout.exercises || []) {
      const validSets = (exercise.sets || []).filter(
        (s) =>
          s.setType !== 'warmup' &&
          typeof s.reps === 'number' &&
          s.reps > 0 &&
          typeof s.weight === 'number' &&
          s.weight >= 0
      );
      if (validSets.length === 0) continue;

      const key = resolveCanonicalExerciseId(exercise.exerciseName) || exercise.exerciseId;
      if (!key) continue;

      const prevSeen = seenCount.get(key) ?? 0;
      seenCount.set(key, prevSeen + 1);

      const isAssisted = isAssistedExercise(exercise.exerciseName);
      const isBodyweight = validSets.every((s) => s.weight === 0);

      let bestSet = validSets[0];
      if (isBodyweight) {
        bestSet = [...validSets].sort((a, b) => b.reps - a.reps)[0];
      } else if (isAssisted) {
        bestSet = [...validSets].sort((a, b) => {
          if (a.weight !== b.weight) return a.weight - b.weight;
          return b.reps - a.reps;
        })[0];
      } else {
        bestSet = [...validSets].sort((a, b) => {
          if (b.weight !== a.weight) return b.weight - a.weight;
          return b.reps - a.reps;
        })[0];
      }

      const est1RM = isBodyweight
        ? bestSet.reps
        : calculateEstimated1RM(bestSet.weight, bestSet.reps);

      const existing = byExercise.get(key);
      if (!existing) {
        byExercise.set(key, {
          id: `${workout.id}-${exercise.exerciseId}`,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          weightKg: bestSet.weight,
          reps: bestSet.reps,
          estimated1RMKg: est1RM,
          isBodyweight,
          isAssisted,
          isNewPr: Boolean(
            (workout.personalRecords || []).some((pr) => isSameExercise(pr, exercise))
          ),
          achievedAt: workoutDate,
        });
      } else {
        const isBetter = isBodyweight
          ? bestSet.reps > existing.reps
          : isAssisted
            ? bestSet.weight < existing.weightKg ||
              (Math.abs(bestSet.weight - existing.weightKg) < 0.01 && bestSet.reps > existing.reps)
            : bestSet.weight > existing.weightKg ||
              (Math.abs(bestSet.weight - existing.weightKg) < 0.01 && bestSet.reps > existing.reps) ||
              est1RM > existing.estimated1RMKg;

        if (isBetter) {
          byExercise.set(key, {
            id: `${workout.id}-${exercise.exerciseId}`,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            weightKg: bestSet.weight,
            reps: bestSet.reps,
            estimated1RMKg: est1RM,
            isBodyweight,
            isAssisted,
            isNewPr: true,
            achievedAt: workoutDate,
          });
        }
      }
    }
  }

  // Merge onboarding baseline lifts if higher or not yet logged in history
  const baselineEntries: Array<{ name: string; weightKg?: number }> = [
    { name: 'Bench Press', weightKg: baselineLifts?.benchPressKg },
    { name: 'Barbell Squat', weightKg: baselineLifts?.squatKg },
    { name: 'Deadlift', weightKg: baselineLifts?.deadliftKg },
    { name: 'Overhead Press', weightKg: baselineLifts?.overheadPressKg },
  ];

  for (const item of baselineEntries) {
    if (typeof item.weightKg !== 'number' || item.weightKg <= 0) continue;
    const key = resolveCanonicalExerciseId(item.name);
    const existing = byExercise.get(key);
    if (!existing) {
      byExercise.set(key, {
        id: `baseline-${key}`,
        exerciseId: `baseline-${key}`,
        exerciseName: item.name,
        weightKg: item.weightKg,
        reps: 1,
        estimated1RMKg: item.weightKg,
        isBodyweight: false,
        isAssisted: false,
        isNewPr: false,
        achievedAt: '',
      });
    } else if (item.weightKg > existing.weightKg) {
      byExercise.set(key, {
        ...existing,
        weightKg: item.weightKg,
        reps: 1,
        estimated1RMKg: Math.max(existing.estimated1RMKg, item.weightKg),
      });
    }
  }

  return Array.from(byExercise.values()).sort((a, b) => {
    if (a.isNewPr !== b.isNewPr) return a.isNewPr ? -1 : 1;
    const timeA = a.achievedAt ? new Date(a.achievedAt).getTime() : 0;
    const timeB = b.achievedAt ? new Date(b.achievedAt).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return b.weightKg - a.weightKg;
  });
}

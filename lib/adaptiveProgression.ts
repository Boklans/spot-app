import type { CompletedWorkout } from '@/types/workout';
import type { EquipmentId, GeneratedExercise } from '@/lib/programGenerator';
import { areExercisesEquivalent, findCanonicalExercise, getExerciseLoadType } from '@/lib/exercises';
import { addWeight, formatWeight, normalizeWeight, subtractWeight } from '@/lib/weightUtils';

export type ProgressionReason = 'increase' | 'maintain' | 'reduce' | 'program_default';
export type ProgressionSource = 'history' | 'program_default';

export type WeightRecommendation = {
  recommendedWeight: number;
  recommendedReps?: number;
  recommendationReason: ProgressionReason;
  source: ProgressionSource;
  explanation: string;
  explanationUk?: string;
};

export type HistoricalSet = { weight: number; reps: number; setType?: string; rir?: number };

export type RecommendWeightOptions = {
  deloadActive?: boolean;
};

export function isAssistedExercise(name: string): boolean {
  const lower = (name || '').toLowerCase();
  return lower.includes('assisted') || lower.includes('гравітрон') || lower.includes('gravitron');
}

/**
 * Identifies unilateral / dumbbell exercises where lifters enter the weight of ONE hand/dumbbell.
 */
export function isPerHandExercise(name: string, equipment?: EquipmentId): boolean {
  const loadType = getExerciseLoadType(name, equipment);
  return loadType === 'bilateral_per_hand' || loadType === 'unilateral_per_side';
}

/**
 * Identifies barbell / plate-loaded lifts where a Barbell Plate Calculator is genuinely helpful.
 */
export function isBarbellExercise(name: string, equipment?: EquipmentId): boolean {
  const lower = (name || '').toLowerCase();
  if (isAssistedExercise(lower)) return false;
  if (
    lower.includes('dumbbell') ||
    lower.includes('db ') ||
    lower.includes('гантел') ||
    lower.includes('cable') ||
    lower.includes('блок') ||
    lower.includes('machine') ||
    lower.includes('тренажер') ||
    lower.includes('pulldown') ||
    lower.includes('pushdown') ||
    lower.includes('bodyweight') ||
    lower.includes('push-up') ||
    lower.includes('pull-up') ||
    lower.includes('dip') ||
    lower.includes('plank')
  ) {
    return false;
  }
  if (
    lower.includes('barbell') ||
    lower.includes('штанг') ||
    lower.includes('bench press') ||
    lower.includes('жим лежачи') ||
    lower.includes('squat') ||
    lower.includes('присідан') ||
    lower.includes('deadlift') ||
    lower.includes('станова') ||
    lower.includes('румунська') ||
    lower.includes('overhead press') ||
    lower.includes('military press') ||
    lower.includes('hip thrust') ||
    lower.includes('ez bar') ||
    lower.includes('ez-bar') ||
    lower.includes('leg press') ||
    lower.includes('жим ногами') ||
    lower.includes('hack squat')
  ) {
    return true;
  }
  const resolved = equipment || inferEquipmentFromName(name);
  return resolved === 'barbell';
}

export function inferEquipmentFromName(name: string, fallback: EquipmentId = 'barbell'): EquipmentId {
  const canonical = findCanonicalExercise(name);
  if (canonical) {
    return canonical.equipment;
  }
  const lower = (name || '').toLowerCase();
  if (isAssistedExercise(lower)) {
    return 'machines';
  }
  if (
    lower.includes('push-up') ||
    lower.includes('push up') ||
    lower.includes('pull-up') ||
    lower.includes('pull up') ||
    lower.includes('chin-up') ||
    lower.includes('chin up') ||
    lower.includes('plank') ||
    lower.includes('bodyweight') ||
    lower.includes('hanging knee') ||
    lower.includes('відтискан') ||
    lower.includes('підтягуван') ||
    lower.includes('планк') ||
    lower.includes('власною вагою') ||
    (lower.includes('dip') && !lower.includes('machine')) ||
    (lower.includes('брус') && !lower.includes('гравітрон')) ||
    (lower.includes('crunch') && !lower.includes('cable') && !lower.includes('machine'))
  ) {
    return 'bodyweight';
  }
  if (
    lower.includes('dumbbell') ||
    lower.includes('db ') ||
    lower.includes('гантел') ||
    lower.includes('lateral raise') ||
    lower.includes('hammer curl') ||
    lower.includes('молотки')
  ) {
    return 'dumbbells';
  }
  if (
    lower.includes('machine') ||
    lower.includes('cable') ||
    lower.includes('тренажер') ||
    lower.includes('блок') ||
    lower.includes('кросовер') ||
    lower.includes('pulldown') ||
    lower.includes('pushdown') ||
    lower.includes('leg press') ||
    lower.includes('leg curl') ||
    lower.includes('leg extension') ||
    lower.includes('seated row') ||
    lower.includes('face pull') ||
    lower.includes('fly')
  ) {
    return 'machines';
  }
  return fallback;
}

export function findLatestExerciseSets(history: CompletedWorkout[], exercise: GeneratedExercise): HistoricalSet[] {
  const matches = history
    .flatMap((workout) => workout.exercises.map((item) => ({ workout, item })))
    .map(({ workout, item }) => ({
      workout,
      workingSets: (item.sets || []).filter(
        (set) => set.setType !== 'warmup' && typeof set.reps === 'number' && set.reps > 0
      ),
      matchesTarget: areExercisesEquivalent(item, exercise),
    }))
    .filter(({ matchesTarget, workingSets }) => matchesTarget && workingSets.length > 0)
    .sort((left, right) => new Date(right.workout.completedAt).getTime() - new Date(left.workout.completedAt).getTime());

  return (
    matches[0]?.workingSets.map((set) => ({
      weight: set.weight,
      reps: set.reps,
      setType: set.setType,
      rir: set.rir,
    })) ?? []
  );
}

export function parseRepRange(value: string): {
  minimum: number;
  maximum: number;
  isTimed: boolean;
} {
  const raw = (value || '8-12').toLowerCase().trim();
  const isTimed = /\b(sec|secs|second|seconds|сек|с)\b|\d+\s*s\b/.test(raw);
  const nums = raw.match(/\d+/g)?.map(Number).filter((n) => Number.isFinite(n) && n > 0) ?? [];
  if (nums.length >= 2) {
    const lo = Math.min(nums[0], nums[1]);
    const hi = Math.max(nums[0], nums[1]);
    return { minimum: lo, maximum: hi, isTimed };
  }
  if (nums.length === 1) {
    return { minimum: nums[0], maximum: nums[0], isTimed };
  }
  return { minimum: 8, maximum: 12, isTimed: false };
}

export function practicalIncrement(equipment: EquipmentId, weight: number) {
  if (equipment === 'bodyweight') return weight > 0 ? 2.5 : 0;
  if (equipment === 'dumbbells') return weight >= 30 ? 2 : 1;
  if (equipment === 'machines') return weight >= 50 ? 5 : 2.5;
  return 2.5;
}

export function roundPracticalWeight(value: number, equipment: EquipmentId) {
  if (equipment === 'bodyweight' && value <= 0) return 0;
  const increment = practicalIncrement(equipment, value);
  if (increment <= 0) return 0;
  return Math.max(0, Math.round(value / increment) * increment);
}

export function recommendWeight(
  exercise: GeneratedExercise,
  previousSets: HistoricalSet[],
  options?: RecommendWeightOptions
): WeightRecommendation {
  const deloadActive = Boolean(options?.deloadActive);
  const { minimum, maximum, isTimed } = parseRepRange(exercise.targetRepRange);
  const equipment = exercise.equipment || inferEquipmentFromName(exercise.name);
  const requiredSets = Math.max(1, exercise.sets || 3);
  const validSets = previousSets.filter(
    (s) => s.setType !== 'warmup' && typeof s.reps === 'number' && s.reps > 0
  );
  const completedAllSets = validSets.length >= requiredSets;
  const hasWeightedBodyweightLoad =
    equipment === 'bodyweight' &&
    (validSets.some((s) => s.weight > 0) || (exercise.recommendedWeight || 0) > 0);

  if (equipment === 'bodyweight' && !hasWeightedBodyweightLoad) {
    const unitEn = isTimed ? 'sec' : 'reps';
    const unitUk = isTimed ? 'сек' : 'повт.';
    if (validSets.length > 0) {
      const reps = validSets.map((s) => s.reps);
      const minHit = Math.min(...reps);
      const step = isTimed ? 5 : 1;
      const nextReps = completedAllSets && minHit >= minimum
        ? Math.min(maximum, minHit + step)
        : Math.min(maximum, Math.max(minimum, minHit));
      return {
        recommendedWeight: 0,
        recommendedReps: nextReps,
        recommendationReason: 'maintain',
        source: 'history',
        explanation: completedAllSets
          ? `Last time: ${reps.join('/')} ${unitEn}. Aim for ${nextReps} controlled ${unitEn} today.`
          : `Last time: ${reps.join('/')} (${validSets.length}/${requiredSets} sets). Complete all ${requiredSets} sets of ${nextReps} ${unitEn} today.`,
        explanationUk: completedAllSets
          ? `Минулого разу: ${reps.join('/')} ${unitUk} Ціль сьогодні — ${nextReps} ${unitUk}`
          : `Минулого разу: ${reps.join('/')} (${validSets.length}/${requiredSets} підх.). Закріпіть усі ${requiredSets} підходи по ${nextReps} ${unitUk}`,
      };
    }
    return {
      recommendedWeight: 0,
      recommendedReps: minimum,
      recommendationReason: 'program_default',
      source: 'program_default',
      explanation: isTimed
        ? `Hold strict form for ${minimum} seconds per set.`
        : 'Use your bodyweight and focus on controlled reps.',
      explanationUk: isTimed
        ? `Утримуйте технічне положення ${minimum} сек у кожному підході.`
        : 'Виконуйте з власною вагою під повним контролем.',
    };
  }

  const isAssisted = isAssistedExercise(exercise.name);
  const workingPrevWeight = validSets.length > 0
    ? (isAssisted
        ? Math.min(...validSets.map((s) => s.weight))
        : Math.max(...validSets.map((s) => s.weight)))
    : 0;
  const weight = workingPrevWeight > 0 ? workingPrevWeight : (exercise.recommendedWeight || 0);

  if (validSets.length === 0 || weight <= 0) {
    const baseDefaultWeight = Math.max(0, exercise.recommendedWeight || 0);
    if (deloadActive && baseDefaultWeight > 0) {
      // Note: exercise.recommendedWeight on the program template is already reduced by applyDeloadWeek(),
      // so do NOT multiply by 0.85 a second time when source === 'program_default'.
      return {
        recommendedWeight: baseDefaultWeight,
        recommendedReps: minimum,
        recommendationReason: 'reduce',
        source: 'program_default',
        explanation: `Deload week active (-15%): focus on crisp technique at ${formatWeight(baseDefaultWeight)} kg × ${minimum} reps.`,
        explanationUk: `Тиждень розвантаження (-15%): фокус на чистій техніці з вагою ${formatWeight(baseDefaultWeight)} кг × ${minimum} повт.`,
      };
    }
    return {
      recommendedWeight: baseDefaultWeight,
      recommendedReps: minimum,
      recommendationReason: 'program_default',
      source: 'program_default',
      explanation: isAssisted
        ? `Starting assistance weight (${minimum}-${maximum} reps). Hit ${maximum} reps on all sets to reduce assistance.`
        : `Starting weight from your program (${minimum}-${maximum} reps). Hit ${maximum} reps on all sets to increase weight.`,
      explanationUk: isAssisted
        ? `Стартова противага (${minimum}–${maximum} повт). Виконайте всі підходи по ${maximum} повт, щоб зменшити допомогу тренажера.`
        : `Стартова вага за програмою (${minimum}–${maximum} повт). Виконайте всі підходи по ${maximum} повт для переходу на більшу вагу.`,
    };
  }

  const equipIncrement = practicalIncrement(equipment, weight);
  const increment = typeof exercise.weightIncrement === 'number' && exercise.weightIncrement > 0
    ? Math.max(exercise.weightIncrement, equipIncrement)
    : equipIncrement;

  // Active Deload Week (-15% from historical working weight; +15% counterweight for assisted lifts)
  if (deloadActive) {
    if (isAssisted) {
      const rawEasier = weight * 1.15;
      const stepped = roundPracticalWeight(rawEasier, equipment);
      const deloadAssist = stepped > weight ? stepped : addWeight(weight, increment);
      return {
        recommendedWeight: deloadAssist,
        recommendedReps: minimum,
        recommendationReason: 'reduce',
        source: 'history',
        explanation: `Deload week (-15% load): assistance increased from ${formatWeight(weight)} kg to ${formatWeight(deloadAssist)} kg × ${minimum} reps for joint & CNS recovery.`,
        explanationUk: `Тиждень розвантаження (-15% навантаження): противагу збільшено з ${formatWeight(weight)} кг до ${formatWeight(deloadAssist)} кг × ${minimum} повт для відновлення.`,
      };
    }

    const rawDeload = weight * 0.85;
    const roundedDeload = roundPracticalWeight(rawDeload, equipment);
    const candidateDeload = roundedDeload > 0 ? roundedDeload : equipIncrement;
    const deloadWeight = candidateDeload < weight
      ? candidateDeload
      : Math.max(equipIncrement, subtractWeight(weight, increment));

    return {
      recommendedWeight: normalizeWeight(deloadWeight),
      recommendedReps: minimum,
      recommendationReason: 'reduce',
      source: 'history',
      explanation: `Deload week (-15% from ${formatWeight(weight)} kg): perform ${requiredSets} smooth sets at ${formatWeight(deloadWeight)} kg × ${minimum} reps to shed fatigue.`,
      explanationUk: `Тиждень розвантаження (-15% від ${formatWeight(weight)} кг): виконайте ${requiredSets} спокійні підходи по ${formatWeight(deloadWeight)} кг × ${minimum} повт для відновлення.`,
    };
  }

  const reps = validSets.map((set) => set.reps);
  const minRepsHit = Math.min(...reps);
  const maxRepsHit = Math.max(...reps);
  // For assisted exercises (gravitron), progression means LESS counterweight; for standard exercises, MORE weight.
  const progressedWeight = isAssisted
    ? Math.max(0, subtractWeight(weight, increment))
    : addWeight(weight, increment);

  const setsAtWorkingWeight = validSets.filter((s) => Math.abs(s.weight - workingPrevWeight) < 0.01);
  const allSetsAtWorkingWeight = setsAtWorkingWeight.length === validSets.length;

  // Mixed-weight sets in the previous workout (e.g., 45x12 then dropped to 40x12, or ramped up 45x8 -> 47.5x10)
  if (!allSetsAtWorkingWeight) {
    const workingWeightReps = setsAtWorkingWeight.map((s) => s.reps);
    const minAtWorkingWeight = Math.min(...workingWeightReps);
    if (minAtWorkingWeight >= minimum - 1) {
      const targetRepsAtWorking = Math.min(maximum, Math.max(minimum, minRepsHit));
      return {
        recommendedWeight: normalizeWeight(weight),
        recommendedReps: targetRepsAtWorking,
        recommendationReason: 'maintain',
        source: 'history',
        explanation: `Last time you used ${formatWeight(weight)} kg on ${setsAtWorkingWeight.length}/${requiredSets} sets. Consolidate all ${requiredSets} sets at ${formatWeight(weight)} kg × ${targetRepsAtWorking} reps.`,
        explanationUk: `Минулого разу вага ${formatWeight(weight)} кг була у ${setsAtWorkingWeight.length}/${requiredSets} підх. Закріпіть усі ${requiredSets} підходи з вагою ${formatWeight(weight)} кг × ${targetRepsAtWorking} повт.`,
      };
    }
    // User failed at the peak weight (e.g. 45x5) and dropped to a lighter weight (e.g. 40x10, 40x10)
    const fallbackSets = validSets.filter((s) => Math.abs(s.weight - workingPrevWeight) >= 0.01);
    const successfulFallbackSets = fallbackSets.filter((s) => s.reps >= minimum - 1);
    if (successfulFallbackSets.length > 0) {
      const fallbackWeight = isAssisted
        ? Math.min(...successfulFallbackSets.map((s) => s.weight))
        : Math.max(...successfulFallbackSets.map((s) => s.weight));
      const minFallbackReps = Math.min(...successfulFallbackSets.map((s) => s.reps));
      const targetRepsFallback = Math.min(maximum, Math.max(minimum, minFallbackReps));
      return {
        recommendedWeight: normalizeWeight(fallbackWeight),
        recommendedReps: targetRepsFallback,
        recommendationReason: 'reduce',
        source: 'history',
        explanation: `Peak weight ${formatWeight(weight)} kg was below target range (${minAtWorkingWeight} reps). Consolidate ${formatWeight(fallbackWeight)} kg × ${targetRepsFallback} reps across all ${requiredSets} sets.`,
        explanationUk: `Вага ${formatWeight(weight)} кг виявилася заважкою (${minAtWorkingWeight} повт). Закріпіть усі ${requiredSets} підходи з робочою вагою ${formatWeight(fallbackWeight)} кг × ${targetRepsFallback} повт.`,
      };
    }
  }

  // Incomplete workout (fewer completed sets than prescribed): consolidate before advancing weight or reps
  if (!completedAllSets) {
    if (minRepsHit >= minimum - 2 && maxRepsHit >= minimum - 1) {
      const targetRepsConsolidate = Math.min(maximum, Math.max(minimum, minRepsHit));
      return {
        recommendedWeight: normalizeWeight(weight),
        recommendedReps: targetRepsConsolidate,
        recommendationReason: 'maintain',
        source: 'history',
        explanation: `You completed ${validSets.length}/${requiredSets} sets (${reps.join('/')}) at ${formatWeight(weight)} kg. Complete all ${requiredSets} sets of ${targetRepsConsolidate} reps before progressing.`,
        explanationUk: `Виконано ${validSets.length}/${requiredSets} підх. (${reps.join('/')}) × ${formatWeight(weight)} кг. Закріпіть усі ${requiredSets} підходи по ${targetRepsConsolidate} повт перед підвищенням.`,
      };
    }
  }

  // 1. All prescribed sets completed at working weight and hit/exceeded top of rep range -> Progress weight, reset target reps to minimum
  if (completedAllSets && allSetsAtWorkingWeight && reps.every((value) => value >= maximum)) {
    return {
      recommendedWeight: progressedWeight,
      recommendedReps: minimum,
      recommendationReason: 'increase',
      source: 'history',
      explanation: isAssisted
        ? `You hit ${reps.join('/')} with ${formatWeight(weight)} kg assistance (top of ${minimum}-${maximum}). Reduce assistance to ${formatWeight(progressedWeight)} kg × ${minimum} reps today.`
        : `You hit ${reps.join('/')} at ${formatWeight(weight)} kg last time (top of ${minimum}-${maximum}). Try ${formatWeight(progressedWeight)} kg × ${minimum} reps today.`,
      explanationUk: isAssisted
        ? `Минулого разу: ${reps.join('/')} з противагою ${formatWeight(weight)} кг (верхня межа ${minimum}–${maximum}). Зменшуємо противагу до ${formatWeight(progressedWeight)} кг × ${minimum} повт (менша противага = важче).`
        : `Минулого разу ви виконали ${reps.join('/')} × ${formatWeight(weight)} кг (верхня межа ${minimum}–${maximum}). Переходимо на ${formatWeight(progressedWeight)} кг × ${minimum} повт.`,
    };
  }

  // 2. All prescribed sets hit at least minimum -> Maintain weight, progress target reps by +1 from lowest set
  if (completedAllSets && allSetsAtWorkingWeight && reps.every((value) => value >= minimum)) {
    const nextReps = Math.min(maximum, minRepsHit + 1);
    return {
      recommendedWeight: normalizeWeight(weight),
      recommendedReps: nextReps,
      recommendationReason: 'maintain',
      source: 'history',
      explanation: isAssisted
        ? `You hit ${reps.join('/')} with ${formatWeight(weight)} kg assistance. Keep ${formatWeight(weight)} kg and aim for ${nextReps} reps (${formatWeight(progressedWeight)} kg assistance unlocks at ${maximum} reps).`
        : `You hit ${reps.join('/')} at ${formatWeight(weight)} kg. Stay at ${formatWeight(weight)} kg and aim for ${nextReps} reps (${formatWeight(progressedWeight)} kg unlocks at ${maximum} reps).`,
      explanationUk: isAssisted
        ? `Минулого разу: ${reps.join('/')} з противагою ${formatWeight(weight)} кг. Сьогодні ціль — ${nextReps} повт у всіх підходах (перехід на ${formatWeight(progressedWeight)} кг противаги після ${maximum} повт).`
        : `Минулого разу: ${reps.join('/')} × ${formatWeight(weight)} кг. Залишаємо ${formatWeight(weight)} кг, ціль — ${nextReps} повт у підході (перехід на ${formatWeight(progressedWeight)} кг після ${maximum} повт).`,
    };
  }

  // 3. Minor fatigue on later sets (at least half sets hit minimum, and worst set within 2 reps of minimum) -> Maintain weight & consolidate minimum reps
  const setsAtMinimum = reps.filter((r) => r >= minimum).length;
  if (allSetsAtWorkingWeight && setsAtMinimum >= Math.ceil(reps.length / 2) && minRepsHit >= minimum - 2) {
    return {
      recommendedWeight: normalizeWeight(weight),
      recommendedReps: minimum,
      recommendationReason: 'maintain',
      source: 'history',
      explanation: `You hit ${reps.join('/')} at ${formatWeight(weight)} kg last time. Keep ${formatWeight(weight)} kg and aim to hit ${minimum} reps on all sets.`,
      explanationUk: `Минулого разу: ${reps.join('/')} × ${formatWeight(weight)} кг (майже в цілі). Закріпіть ${formatWeight(weight)} кг — виконайте всі підходи по ${minimum} чистих повторень.`,
    };
  }

  // 4. Significant miss below target rep range -> Deload (-5% or 1 practical step; for assisted exercises, ADD counterweight)
  if (isAssisted) {
    const easierAssistance = addWeight(weight, increment);
    return {
      recommendedWeight: easierAssistance,
      recommendedReps: minimum,
      recommendationReason: 'reduce',
      source: 'history',
      explanation: `Last session (${reps.join('/')} with ${formatWeight(weight)} kg assistance) was below ${minimum}-${maximum} reps. Increase assistance to ${formatWeight(easierAssistance)} kg × ${minimum} reps.`,
      explanationUk: `Минулого разу (${reps.join('/')} з противагою ${formatWeight(weight)} кг) було нижче діапазону ${minimum}–${maximum}. Збільшуємо противагу до ${formatWeight(easierAssistance)} кг × ${minimum} повт для чистої техніки.`,
    };
  }

  const rawReduced = weight * 0.95;
  const candidate = increment > 0
    ? normalizeWeight(Math.round(rawReduced / increment) * increment)
    : normalizeWeight(rawReduced);
  const reduceWeight = candidate < weight ? candidate : subtractWeight(weight, increment);
  const finalReduced = reduceWeight < weight && reduceWeight > 0 ? reduceWeight : normalizeWeight(weight);

  return {
    recommendedWeight: finalReduced,
    recommendedReps: minimum,
    recommendationReason: 'reduce',
    source: 'history',
    explanation: `Last session (${reps.join('/')} at ${formatWeight(weight)} kg) was below the ${minimum}-${maximum} target range. Build consistency at ${formatWeight(finalReduced)} kg × ${minimum} reps.`,
    explanationUk: `Минулого разу (${reps.join('/')} × ${formatWeight(weight)} кг) було нижче діапазону ${minimum}–${maximum}. Знижуємо до ${formatWeight(finalReduced)} кг × ${minimum} повт для чистої техніки.`,
  };
}

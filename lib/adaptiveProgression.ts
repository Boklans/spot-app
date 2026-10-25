import type { CompletedWorkout } from '@/types/workout';
import type { EquipmentId, GeneratedExercise } from '@/lib/programGenerator';
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

export type HistoricalSet = { weight: number; reps: number };

export function isAssistedExercise(name: string): boolean {
  const lower = (name || '').toLowerCase();
  return lower.includes('assisted') || lower.includes('гравітрон') || lower.includes('gravitron');
}

export function inferEquipmentFromName(name: string, fallback: EquipmentId = 'barbell'): EquipmentId {
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
    (lower.includes('dip') && !lower.includes('machine')) ||
    (lower.includes('crunch') && !lower.includes('cable') && !lower.includes('machine'))
  ) {
    return 'bodyweight';
  }
  if (lower.includes('dumbbell') || lower.includes('db ') || lower.includes('lateral raise') || lower.includes('hammer curl')) {
    return 'dumbbells';
  }
  if (
    lower.includes('machine') ||
    lower.includes('cable') ||
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
  const targetName = (exercise.name || '').trim().toLowerCase();
  const matches = history
    .flatMap((workout) => workout.exercises.map((item) => ({ workout, item })))
    .filter(({ item }) => {
      if (!item.sets || item.sets.length === 0) return false;
      const itemName = (item.exerciseName || '').trim().toLowerCase();
      if (itemName && targetName) {
        return itemName === targetName;
      }
      return item.exerciseId === exercise.id;
    })
    .sort((left, right) => new Date(right.workout.completedAt).getTime() - new Date(left.workout.completedAt).getTime());
  return matches[0]?.item.sets.map((set) => ({ weight: set.weight, reps: set.reps })) ?? [];
}

export function parseRepRange(value: string) {
  const [minimum, maximum] = (value || '8-12').split('-').map(Number);
  return { minimum: minimum || 8, maximum: maximum || minimum || 12 };
}

export function practicalIncrement(equipment: EquipmentId, weight: number) {
  if (equipment === 'bodyweight') return 0;
  if (equipment === 'dumbbells') return weight >= 30 ? 2 : 1;
  if (equipment === 'machines') return weight >= 50 ? 5 : 2.5;
  return 2.5;
}

export function roundPracticalWeight(value: number, equipment: EquipmentId) {
  if (equipment === 'bodyweight') return 0;
  const increment = practicalIncrement(equipment, value);
  return Math.max(0, Math.round(value / increment) * increment);
}

export function recommendWeight(exercise: GeneratedExercise, previousSets: HistoricalSet[]): WeightRecommendation {
  const { minimum, maximum } = parseRepRange(exercise.targetRepRange);
  const equipment = exercise.equipment || inferEquipmentFromName(exercise.name);
  const requiredSets = Math.max(1, exercise.sets || 3);
  const validSets = previousSets.filter((s) => typeof s.reps === 'number' && s.reps > 0);
  const completedAllSets = validSets.length >= requiredSets;

  if (equipment === 'bodyweight') {
    if (validSets.length > 0) {
      const reps = validSets.map((s) => s.reps);
      const minHit = Math.min(...reps);
      const nextReps = completedAllSets && minHit >= minimum
        ? Math.min(maximum, minHit + 1)
        : Math.min(maximum, Math.max(minimum, minHit));
      return {
        recommendedWeight: 0,
        recommendedReps: nextReps,
        recommendationReason: 'maintain',
        source: 'history',
        explanation: completedAllSets
          ? `Last time: ${reps.join('/')} reps. Aim for ${nextReps} controlled reps today.`
          : `Last time: ${reps.join('/')} (${validSets.length}/${requiredSets} sets). Complete all ${requiredSets} sets of ${nextReps} reps today.`,
        explanationUk: completedAllSets
          ? `Минулого разу: ${reps.join('/')} повт. Ціль сьогодні — ${nextReps} підконтрольних повторень.`
          : `Минулого разу: ${reps.join('/')} (${validSets.length}/${requiredSets} підх.). Закріпіть усі ${requiredSets} підходи по ${nextReps} повт.`,
      };
    }
    return {
      recommendedWeight: 0,
      recommendedReps: minimum,
      recommendationReason: 'program_default',
      source: 'program_default',
      explanation: 'Use your bodyweight and focus on controlled reps.',
      explanationUk: 'Виконуйте з власною вагою під повним контролем.',
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
    return {
      recommendedWeight: Math.max(0, exercise.recommendedWeight || 0),
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

  const reps = validSets.map((set) => set.reps);
  const minRepsHit = Math.min(...reps);
  const maxRepsHit = Math.max(...reps);
  const equipIncrement = practicalIncrement(equipment, weight);
  const increment = typeof exercise.weightIncrement === 'number' && exercise.weightIncrement > 0
    ? Math.max(exercise.weightIncrement, equipIncrement)
    : equipIncrement;
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

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

export function inferEquipmentFromName(name: string, fallback: EquipmentId = 'barbell'): EquipmentId {
  const lower = (name || '').toLowerCase();
  if (
    lower.includes('push-up') ||
    lower.includes('push up') ||
    lower.includes('pull-up') ||
    lower.includes('pull up') ||
    lower.includes('chin-up') ||
    lower.includes('plank') ||
    lower.includes('bodyweight') ||
    lower.includes('hanging knee') ||
    lower.includes('crunch') && !lower.includes('cable')
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

  if (equipment === 'bodyweight') {
    if (previousSets.length > 0) {
      const reps = previousSets.map((s) => s.reps);
      const minHit = Math.min(...reps);
      const nextReps = minHit >= minimum ? Math.min(maximum, minHit + 1) : minimum;
      return {
        recommendedWeight: 0,
        recommendedReps: nextReps,
        recommendationReason: 'maintain',
        source: 'history',
        explanation: `Last time: ${reps.join('/')} reps. Aim for ${nextReps} controlled reps today.`,
        explanationUk: `Минулого разу: ${reps.join('/')} повт. Ціль сьогодні — ${nextReps} підконтрольних повторень.`,
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

  const maxPrevWeight = previousSets.length > 0 ? Math.max(...previousSets.map((s) => s.weight)) : 0;
  const weight = maxPrevWeight > 0 ? maxPrevWeight : (exercise.recommendedWeight || 0);

  if (previousSets.length === 0 || weight <= 0) {
    return {
      recommendedWeight: Math.max(0, exercise.recommendedWeight || 0),
      recommendedReps: minimum,
      recommendationReason: 'program_default',
      source: 'program_default',
      explanation: `Starting weight from your program (${minimum}-${maximum} reps). Hit ${maximum} reps on all sets to increase weight.`,
      explanationUk: `Стартова вага за програмою (${minimum}–${maximum} повт). Виконайте всі підходи по ${maximum} повт для переходу на більшу вагу.`,
    };
  }

  const reps = previousSets.map((set) => set.reps);
  const minRepsHit = Math.min(...reps);
  const maxRepsHit = Math.max(...reps);
  const increment = typeof exercise.weightIncrement === 'number' && exercise.weightIncrement > 0
    ? exercise.weightIncrement
    : practicalIncrement(equipment, weight);
  const roundedIncrease = addWeight(weight, increment);

  // 1. All sets hit or exceeded top of rep range -> Increase weight, reset target reps to minimum
  if (reps.every((value) => value >= maximum)) {
    return {
      recommendedWeight: roundedIncrease,
      recommendedReps: minimum,
      recommendationReason: 'increase',
      source: 'history',
      explanation: `You hit ${reps.join('/')} at ${formatWeight(weight)} kg last time (top of ${minimum}-${maximum}). Try ${formatWeight(roundedIncrease)} kg × ${minimum} reps today.`,
      explanationUk: `Минулого разу ви виконали ${reps.join('/')} × ${formatWeight(weight)} кг (верхня межа ${minimum}–${maximum}). Переходимо на ${formatWeight(roundedIncrease)} кг × ${minimum} повт.`,
    };
  }

  // 2. All sets hit at least minimum -> Maintain weight, progress target reps by +1
  if (reps.every((value) => value >= minimum)) {
    const nextReps = minRepsHit === maxRepsHit
      ? Math.min(maximum, minRepsHit + 1)
      : Math.min(maximum, maxRepsHit);
    return {
      recommendedWeight: normalizeWeight(weight),
      recommendedReps: nextReps,
      recommendationReason: 'maintain',
      source: 'history',
      explanation: `You hit ${reps.join('/')} at ${formatWeight(weight)} kg. Stay at ${formatWeight(weight)} kg and aim for ${nextReps} reps (${formatWeight(roundedIncrease)} kg unlocks at ${maximum} reps).`,
      explanationUk: `Минулого разу: ${reps.join('/')} × ${formatWeight(weight)} кг. Залишаємо ${formatWeight(weight)} кг, ціль — ${nextReps} повт у підході (перехід на ${formatWeight(roundedIncrease)} кг після ${maximum} повт).`,
    };
  }

  // 3. Minor fatigue on later sets (at least half sets hit minimum, and worst set within 2 reps of minimum) -> Maintain weight & consolidate minimum reps
  const setsAtMinimum = reps.filter((r) => r >= minimum).length;
  if (setsAtMinimum >= Math.ceil(reps.length / 2) && minRepsHit >= minimum - 2) {
    return {
      recommendedWeight: normalizeWeight(weight),
      recommendedReps: minimum,
      recommendationReason: 'maintain',
      source: 'history',
      explanation: `You hit ${reps.join('/')} at ${formatWeight(weight)} kg last time. Keep ${formatWeight(weight)} kg and aim to hit ${minimum} reps on all sets.`,
      explanationUk: `Минулого разу: ${reps.join('/')} × ${formatWeight(weight)} кг (майже в цілі). Закріпіть ${formatWeight(weight)} кг — виконайте всі підходи по ${minimum} чистих повторень.`,
    };
  }

  // 4. Significant miss below target rep range -> Reduce weight (-5% or 1 practical step) to rebuild form
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

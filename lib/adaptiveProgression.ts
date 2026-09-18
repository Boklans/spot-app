import type { CompletedWorkout } from '@/types/workout';
import type { EquipmentId, GeneratedExercise } from '@/lib/programGenerator';
import { addWeight, formatWeight, normalizeWeight, subtractWeight } from '@/lib/weightUtils';

export type ProgressionReason = 'increase' | 'maintain' | 'reduce' | 'program_default';
export type ProgressionSource = 'history' | 'program_default';

export type WeightRecommendation = {
  recommendedWeight: number;
  recommendationReason: ProgressionReason;
  source: ProgressionSource;
  explanation: string;
};

export type HistoricalSet = { weight: number; reps: number };

export function findLatestExerciseSets(history: CompletedWorkout[], exercise: GeneratedExercise): HistoricalSet[] {
  const matches = history
    .flatMap((workout) => workout.exercises.map((item) => ({ workout, item })))
    .filter(({ item }) => item.exerciseId === exercise.id || item.exerciseName.toLowerCase() === exercise.name.toLowerCase())
    .sort((left, right) => new Date(right.workout.completedAt).getTime() - new Date(left.workout.completedAt).getTime());
  return matches[0]?.item.sets.map((set) => ({ weight: set.weight, reps: set.reps })) ?? [];
}

function parseRepRange(value: string) {
  const [minimum, maximum] = value.split('-').map(Number);
  return { minimum: minimum || 1, maximum: maximum || minimum || 1 };
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
  if (exercise.equipment === 'bodyweight' || previousSets.length === 0 || exercise.recommendedWeight <= 0) {
    return {
      recommendedWeight: exercise.recommendedWeight,
      recommendationReason: 'program_default',
      source: 'program_default',
      explanation: exercise.equipment === 'bodyweight' ? 'Use your bodyweight and focus on controlled reps.' : 'Starting weight from your program.',
    };
  }

  const { minimum, maximum } = parseRepRange(exercise.targetRepRange);
  const weight = previousSets[0].weight;
  const reps = previousSets.map((set) => set.reps);
  const increment = typeof exercise.weightIncrement === 'number' && exercise.weightIncrement > 0
    ? exercise.weightIncrement
    : practicalIncrement(exercise.equipment, weight);
  const roundedIncrease = addWeight(weight, increment);

  if (reps.every((value) => value >= maximum)) {
    return {
      recommendedWeight: roundedIncrease,
      recommendationReason: 'increase',
      source: 'history',
      explanation: `You hit ${reps.join('/')} last time. Try ${formatWeight(roundedIncrease)} kg today.`,
    };
  }

  if (reps.every((value) => value >= minimum)) {
    return {
      recommendedWeight: normalizeWeight(weight),
      recommendationReason: 'maintain',
      source: 'history',
      explanation: `Stay at ${formatWeight(weight)} kg and build reps.`,
    };
  }

  const rawReduced = weight * 0.95;
  const candidate = increment > 0
    ? normalizeWeight(Math.round(rawReduced / increment) * increment)
    : normalizeWeight(rawReduced);
  const reduceWeight = candidate < weight ? candidate : subtractWeight(weight, increment);

  return {
    recommendedWeight: reduceWeight < weight ? reduceWeight : normalizeWeight(weight),
    recommendationReason: 'reduce',
    source: 'history',
    explanation: `Build consistency at ${formatWeight(reduceWeight)} kg before increasing again.`,
  };
}

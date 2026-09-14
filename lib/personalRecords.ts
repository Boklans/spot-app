import type { CompletedWorkout, PersonalRecord } from '@/types/workout';

export function calculateEstimated1RM(weight: number, reps: number) {
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function detectPersonalRecords(current: CompletedWorkout, history: CompletedWorkout[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];

  for (const exercise of current.exercises) {
    const currentSets = exercise.sets;
    const historicalSets = history
      .flatMap((workout) => workout.exercises)
      .filter((item) => item.exerciseName.toLowerCase() === exercise.exerciseName.toLowerCase())
      .flatMap((item) => item.sets);

    if (historicalSets.length === 0 || currentSets.length === 0) continue;

    const currentMaxWeight = Math.max(...currentSets.map((set) => set.weight));
    const historicalMaxWeight = Math.max(...historicalSets.map((set) => set.weight));
    if (currentMaxWeight > historicalMaxWeight) {
      records.push({
        id: `${current.id}-${exercise.exerciseId}-weight`,
        type: 'weight',
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        value: currentMaxWeight,
        label: `${currentMaxWeight} kg`,
      });
    }

    const currentBest1RM = Math.max(...currentSets.map((set) => calculateEstimated1RM(set.weight, set.reps)));
    const historicalBest1RM = Math.max(...historicalSets.map((set) => calculateEstimated1RM(set.weight, set.reps)));
    if (currentBest1RM > historicalBest1RM) {
      records.push({
        id: `${current.id}-${exercise.exerciseId}-estimated-1rm`,
        type: 'estimated_1rm',
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        value: currentBest1RM,
        label: `${currentBest1RM} kg estimated 1RM`,
      });
    }
  }

  return records;
}

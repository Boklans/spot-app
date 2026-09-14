import { calculateEstimated1RM } from '@/lib/personalRecords';
import type { CompletedWorkout } from '@/types/workout';

export type ProgressPeriod = '7D' | '30D' | 'ALL';
export type TrendPoint = { date: string; value: number };
export type MuscleProgressValue = { name: string; volume: number; changePercent?: number };

export type ProgressSummary = {
  workouts: number;
  volume: number;
  trainingDays: number;
  personalRecords: number;
};

export type StrengthProgress = {
  latestBestSet: { weight: number; reps: number };
  historicalMaxWeight: number;
  bestEstimated1RM: number;
  trend: TrendPoint[];
} | null;

const periodDays: Record<Exclude<ProgressPeriod, 'ALL'>, number> = { '7D': 7, '30D': 30 };

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWindowStart(period: ProgressPeriod, now: Date) {
  if (period === 'ALL') return null;
  const start = startOfDay(now);
  start.setDate(start.getDate() - (periodDays[period] - 1));
  return start;
}

export function filterWorkoutsByPeriod(history: CompletedWorkout[], period: ProgressPeriod, now = new Date()) {
  const start = getWindowStart(period, now);
  if (!start) return history;
  return history.filter((workout) => new Date(workout.completedAt).getTime() >= start.getTime());
}

function getPreviousPeriodWorkouts(history: CompletedWorkout[], period: ProgressPeriod, now: Date) {
  if (period === 'ALL') return [];
  const currentStart = getWindowStart(period, now);
  if (!currentStart) return [];
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - periodDays[period]);
  return history.filter((workout) => {
    const completedAt = new Date(workout.completedAt).getTime();
    return completedAt >= previousStart.getTime() && completedAt < currentStart.getTime();
  });
}

export function calculateProgressSummary(history: CompletedWorkout[], period: ProgressPeriod, now = new Date()): ProgressSummary {
  const workouts = filterWorkoutsByPeriod(history, period, now);
  const dates = new Set(workouts.map((workout) => startOfDay(new Date(workout.completedAt)).toISOString()));
  return {
    workouts: workouts.length,
    volume: workouts.reduce((total, workout) => total + workout.totalVolume, 0),
    trainingDays: dates.size,
    personalRecords: workouts.reduce((total, workout) => total + workout.personalRecords.length, 0),
  };
}

function calculateMuscleVolumes(workouts: CompletedWorkout[]) {
  const volumes = new Map<string, number>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const volume = exercise.sets.reduce((total, set) => total + set.volume, 0);
      volumes.set(exercise.muscleGroup, (volumes.get(exercise.muscleGroup) ?? 0) + volume);
    }
  }
  return volumes;
}

export function calculateMuscleProgress(history: CompletedWorkout[], period: ProgressPeriod, now = new Date()): MuscleProgressValue[] {
  const current = calculateMuscleVolumes(filterWorkoutsByPeriod(history, period, now));
  const previous = calculateMuscleVolumes(getPreviousPeriodWorkouts(history, period, now));
  return [...current.entries()]
    .sort(([, left], [, right]) => right - left)
    .map(([name, volume]) => {
      const previousVolume = previous.get(name);
      const changePercent = previousVolume && previousVolume > 0 ? Math.round(((volume - previousVolume) / previousVolume) * 100) : undefined;
      return { name, volume, changePercent };
    });
}

export function calculateBenchPressProgress(history: CompletedWorkout[], period: ProgressPeriod, now = new Date()): StrengthProgress {
  const workouts = filterWorkoutsByPeriod(history, period, now)
    .map((workout) => ({ workout, exercise: workout.exercises.find((exercise) => exercise.exerciseName.toLowerCase() === 'bench press') }))
    .filter((item): item is { workout: CompletedWorkout; exercise: NonNullable<typeof item.exercise> } => Boolean(item.exercise));
  if (workouts.length === 0) return null;

  const bestSets = workouts.map(({ workout, exercise }) => {
    const bestSet = [...exercise.sets].sort((left, right) => calculateEstimated1RM(right.weight, right.reps) - calculateEstimated1RM(left.weight, left.reps))[0];
    return { workout, exercise, bestSet };
  });
  const latest = [...bestSets].sort((left, right) => new Date(right.workout.completedAt).getTime() - new Date(left.workout.completedAt).getTime())[0];
  const allSets = bestSets.flatMap(({ exercise }) => exercise.sets);
  return {
    latestBestSet: { weight: latest.bestSet.weight, reps: latest.bestSet.reps },
    historicalMaxWeight: Math.max(...allSets.map((set) => set.weight)),
    bestEstimated1RM: Math.max(...allSets.map((set) => calculateEstimated1RM(set.weight, set.reps))),
    trend: bestSets
      .sort((left, right) => new Date(left.workout.completedAt).getTime() - new Date(right.workout.completedAt).getTime())
      .map(({ workout, bestSet }) => ({ date: workout.completedAt, value: calculateEstimated1RM(bestSet.weight, bestSet.reps) })),
  };
}

export function formatVolume(value: number) {
  return `${Math.round(value).toLocaleString()} kg`;
}

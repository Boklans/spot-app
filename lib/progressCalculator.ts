import { calculateEstimated1RM } from '@/lib/personalRecords';
import { convertVolumeToActiveUnit, getActiveWeightUnit } from '@/lib/weightUtils';
import type { WeightUnit } from '@/store/userProfileStore';
import type { UserProgram } from '@/types/userProgram';
import type { CompletedExercise, CompletedWorkout } from '@/types/workout';

export type ProgressPeriod = '7D' | '30D' | 'ALL';
export type TrendPoint = { date: string; value: number };
export type MuscleProgressValue = { name: string; volume: number; changePercent?: number };

export type ProgressSummary = {
  workouts: number;
  volume: number;
  trainingDays: number;
  personalRecords: number;
};

export type StrengthMetricType = '1RM' | 'MAX_REPS' | 'VOLUME';

export type TargetExerciseQuery = {
  id?: string;
  name: string;
};

export type StrengthProgress = {
  exerciseName: string;
  metricType: StrengthMetricType;
  unit: string;
  latestBestSet: { weight: number; reps: number };
  historicalMaxWeight: number;
  bestEstimated1RM: number;
  bestValue: number;
  trend: TrendPoint[];
} | null;

export type TrackedExerciseItem = {
  id: string;
  name: string;
  source: 'program' | 'history';
  muscleGroup?: string;
};

const periodDays: Record<Exclude<ProgressPeriod, 'ALL'>, number> = { '7D': 7, '30D': 30 };

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getStartOfWeek(now = new Date()): Date {
  const date = startOfDay(now);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = (day === 0 ? -6 : 1) - day; // Monday as first day of week
  date.setDate(date.getDate() + diff);
  return date;
}

export function countWorkoutsThisWeek(history: CompletedWorkout[], now = new Date()): number {
  const startOfWeek = getStartOfWeek(now).getTime();
  const currentNow = now.getTime();
  return history.filter((workout) => {
    const time = new Date(workout.completedAt).getTime();
    return time >= startOfWeek && time <= currentNow;
  }).length;
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

export function calculateExerciseProgress(
  history: CompletedWorkout[],
  targetExercise: TargetExerciseQuery,
  period: ProgressPeriod,
  now = new Date()
): StrengthProgress {
  const targetNameLower = targetExercise.name.trim().toLowerCase();

  // Dual matching: match by exerciseId OR case-insensitive name
  const matchingWorkouts = filterWorkoutsByPeriod(history, period, now)
    .map((workout) => {
      const exercise = workout.exercises.find((ex) => {
        const matchesId = Boolean(targetExercise.id && ex.exerciseId === targetExercise.id);
        const matchesName = ex.exerciseName.trim().toLowerCase() === targetNameLower;
        return matchesId || matchesName;
      });
      return exercise && exercise.sets.length > 0 ? { workout, exercise } : null;
    })
    .filter((item): item is { workout: CompletedWorkout; exercise: CompletedExercise } => Boolean(item));

  if (matchingWorkouts.length === 0) return null;

  const allSets = matchingWorkouts.flatMap((item) => item.exercise.sets);
  if (allSets.length === 0) return null;

  // Determine if exercise is weighted (> 0 kg) or bodyweight (0 kg or undefined)
  const hasPositiveWeight = allSets.some((set) => typeof set.weight === 'number' && set.weight > 0);
  const metricType: StrengthMetricType = hasPositiveWeight ? '1RM' : 'MAX_REPS';
  const unit = hasPositiveWeight ? 'kg' : 'reps';

  // For each session, compute the best set
  const sessionPoints = matchingWorkouts.map(({ workout, exercise }) => {
    let bestSet = exercise.sets[0];
    let sessionValue = 0;

    if (hasPositiveWeight) {
      const sorted = [...exercise.sets].sort((a, b) => {
        const estA = calculateEstimated1RM(a.weight, a.reps);
        const estB = calculateEstimated1RM(b.weight, b.reps);
        if (estB !== estA) return estB - estA;
        return b.weight - a.weight;
      });
      bestSet = sorted[0];
      sessionValue = calculateEstimated1RM(bestSet.weight, bestSet.reps);
    } else {
      const sorted = [...exercise.sets].sort((a, b) => b.reps - a.reps);
      bestSet = sorted[0];
      sessionValue = bestSet.reps;
    }

    return {
      workout,
      exercise,
      bestSet,
      sessionValue,
    };
  });

  const latest = [...sessionPoints].sort(
    (a, b) => new Date(b.workout.completedAt).getTime() - new Date(a.workout.completedAt).getTime()
  )[0];

  const historicalMaxWeight = hasPositiveWeight ? Math.max(...allSets.map((s) => s.weight)) : 0;
  const bestValue = hasPositiveWeight
    ? Math.max(...allSets.map((s) => calculateEstimated1RM(s.weight, s.reps)))
    : Math.max(...allSets.map((s) => s.reps));

  const trend: TrendPoint[] = [...sessionPoints]
    .sort(
      (a, b) => new Date(a.workout.completedAt).getTime() - new Date(b.workout.completedAt).getTime()
    )
    .map(({ workout, sessionValue }) => ({
      date: workout.completedAt,
      value: sessionValue,
    }));

  return {
    exerciseName: targetExercise.name,
    metricType,
    unit,
    latestBestSet: { weight: latest.bestSet.weight, reps: latest.bestSet.reps },
    historicalMaxWeight,
    bestEstimated1RM: bestValue,
    bestValue,
    trend,
  };
}

export function getAvailableExercisesForProgress(
  program: UserProgram | null | undefined,
  history: CompletedWorkout[]
): TrackedExerciseItem[] {
  const result: TrackedExerciseItem[] = [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();

  // 1. Add exercises from the active UserProgram (highest priority)
  if (program && Array.isArray(program.workouts)) {
    for (const workout of program.workouts) {
      if (!Array.isArray(workout.exercises)) continue;
      for (const exercise of workout.exercises) {
        const trimmedName = exercise.name.trim();
        const key = trimmedName.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          if (exercise.id) seenIds.add(exercise.id);
          result.push({
            id: exercise.id,
            name: trimmedName,
            source: 'program',
            muscleGroup: exercise.muscleGroup,
          });
        }
      }
    }
  }

  // 2. Add historical exercises not present in the active program
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );

  for (const workout of sortedHistory) {
    if (!Array.isArray(workout.exercises)) continue;
    for (const exercise of workout.exercises) {
      const trimmedName = exercise.exerciseName.trim();
      const key = trimmedName.toLowerCase();
      const id = exercise.exerciseId;

      if (!seenNames.has(key) && (!id || !seenIds.has(id))) {
        seenNames.add(key);
        if (id) seenIds.add(id);
        result.push({
          id: id || `history-${key}`,
          name: trimmedName,
          source: 'history',
          muscleGroup: exercise.muscleGroup,
        });
      }
    }
  }

  return result;
}

export function formatVolume(value: number, unit?: WeightUnit) {
  const active = unit ?? getActiveWeightUnit();
  const converted = convertVolumeToActiveUnit(value, active);
  return `${Math.round(converted).toLocaleString()} ${active.toUpperCase()}`;
}

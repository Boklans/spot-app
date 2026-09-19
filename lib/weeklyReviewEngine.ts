import type { CompletedWorkout } from '@/types/workout';

export type WeeklyReview = {
  weekKey: string; // e.g. '2026-W38'
  workoutsCount: number;
  totalVolume: number;
  prCount: number;
  volumeDeltaPercentage: number;
  summaryText: string;
};

/**
 * Returns ISO-8601 week key in 'YYYY-Www' format.
 */
export function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function calculateWorkoutVolume(workout: CompletedWorkout): number {
  if (typeof workout.totalVolume === 'number' && workout.totalVolume > 0) {
    return workout.totalVolume;
  }
  if (!workout.exercises) return 0;
  return workout.exercises.reduce((total, ex) => {
    if (!ex.sets) return total;
    return (
      total +
      ex.sets.reduce((setSum, s) => {
        if (typeof s.volume === 'number' && s.volume > 0) return setSum + s.volume;
        return setSum + (s.weight || 0) * (s.reps || 0);
      }, 0)
    );
  }, 0);
}

/**
 * Generates an executive summary of the user's weekly training performance.
 * - Current Week: Last 7 days
 * - Previous Week: Days 8-14 ago
 * Returns null if no workouts were completed in the last 7 days.
 */
export function generateWeeklyReview(
  history: CompletedWorkout[],
  now = new Date()
): WeeklyReview | null {
  const nowMs = now.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  const currentWeekStart = nowMs - 7 * msPerDay;
  const previousWeekStart = nowMs - 14 * msPerDay;

  const currentWeekWorkouts: CompletedWorkout[] = [];
  const previousWeekWorkouts: CompletedWorkout[] = [];

  for (const workout of history) {
    if (!workout.completedAt) continue;
    const completedTime = new Date(workout.completedAt).getTime();
    if (isNaN(completedTime)) continue;

    if (completedTime >= currentWeekStart && completedTime <= nowMs) {
      currentWeekWorkouts.push(workout);
    } else if (completedTime >= previousWeekStart && completedTime < currentWeekStart) {
      previousWeekWorkouts.push(workout);
    }
  }

  // If workoutsCount for Current Week is 0, return null
  if (currentWeekWorkouts.length === 0) {
    return null;
  }

  const workoutsCount = currentWeekWorkouts.length;
  const totalVolume = currentWeekWorkouts.reduce(
    (sum, w) => sum + calculateWorkoutVolume(w),
    0
  );
  const prCount = currentWeekWorkouts.reduce(
    (sum, w) => sum + (w.personalRecords?.length || 0),
    0
  );

  const prevVolume = previousWeekWorkouts.reduce(
    (sum, w) => sum + calculateWorkoutVolume(w),
    0
  );

  let volumeDeltaPercentage = 0;
  if (prevVolume > 0) {
    volumeDeltaPercentage = Math.round(((totalVolume - prevVolume) / prevVolume) * 100);
  } else if (totalVolume > 0 && previousWeekWorkouts.length === 0) {
    volumeDeltaPercentage = 100;
  }

  const weekKey = getISOWeekKey(now);

  // Generate deterministic "AI-like" summaryText
  let summaryText = '';
  if (volumeDeltaPercentage > 0) {
    const prPart =
      prCount > 0 ? ` and hit ${prCount} new PR${prCount > 1 ? 's' : ''}` : '';
    summaryText = `Great week! You completed ${workoutsCount} workout${
      workoutsCount > 1 ? 's' : ''
    }${prPart}. Your total volume went up by ${volumeDeltaPercentage}% compared to last week. Keep this momentum going!`;
  } else if (volumeDeltaPercentage < 0) {
    const prPart =
      prCount > 0 ? ` with ${prCount} new PR${prCount > 1 ? 's' : ''}` : '';
    summaryText = `Solid dedication! You logged ${workoutsCount} workout${
      workoutsCount > 1 ? 's' : ''
    }${prPart}. Total volume decreased by ${Math.abs(
      volumeDeltaPercentage
    )}%—a healthy deload or great setup to push harder next week.`;
  } else {
    const prPart =
      prCount > 0 ? ` and hit ${prCount} new PR${prCount > 1 ? 's' : ''}` : '';
    summaryText = `Consistent effort! You completed ${workoutsCount} workout${
      workoutsCount > 1 ? 's' : ''
    }${prPart}, maintaining your volume baseline from last week. Consistency is key!`;
  }

  return {
    weekKey,
    workoutsCount,
    totalVolume: Math.round(totalVolume),
    prCount,
    volumeDeltaPercentage,
    summaryText,
  };
}


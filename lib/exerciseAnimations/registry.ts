/**
 * Lightweight registry mapping normalized exercise names to bespoke
 * biomechanical 2D vector animation IDs.
 *
 * Designed for incremental expansion (Dumbbell Bench Press, Lat Pulldown,
 * Seated Cable Row, Squat, etc.) without heavyweight framework overhead.
 */

export type ExerciseAnimationId = 'barbell_bench_press';

/**
 * Resolves an exercise name (English or Ukrainian) to a supported animation ID,
 * or returns `null` when the exercise should fall back to its static render.
 *
 * Strict matching guarantees that variants with different biomechanics
 * (e.g. Incline Bench Press, Dumbbell Bench Press, Machine Chest Press)
 * never display a mismatched Flat Barbell Bench Press animation.
 */
export function resolveExerciseAnimationId(
  exerciseName?: string | null,
  equipment?: string | null
): ExerciseAnimationId | null {
  if (!exerciseName) return null;
  const name = exerciseName.trim().toLowerCase();
  const equip = (equipment || '').trim().toLowerCase();

  // Exclude variants with distinct bench angle or equipment biomechanics
  const isInclineOrDecline =
    name.includes('incline') ||
    name.includes('decline') ||
    name.includes('під кутом') ||
    name.includes('похил');
  const isNonBarbell =
    name.includes('dumbbell') ||
    name.includes('machine') ||
    name.includes('smith') ||
    name.includes('cable') ||
    name.includes('гантел') ||
    name.includes('тренажер') ||
    name.includes('сміт') ||
    equip === 'dumbbells' ||
    equip === 'machines' ||
    equip === 'cables' ||
    equip === 'bodyweight';

  if (isInclineOrDecline || isNonBarbell) {
    return null;
  }

  const isFlatBarbellBench =
    name === 'barbell bench press' ||
    name === 'bench press' ||
    name === 'flat barbell bench press' ||
    name === 'flat bench press' ||
    name === 'жим штанги лежачи' ||
    name === 'жим лежачи' ||
    (name.includes('bench press') && name.includes('barbell')) ||
    (name.includes('жим') && name.includes('штанг') && name.includes('лежач'));

  if (isFlatBarbellBench) {
    return 'barbell_bench_press';
  }

  return null;
}

export function hasExerciseAnimation(
  exerciseName?: string | null,
  equipment?: string | null
): boolean {
  return resolveExerciseAnimationId(exerciseName, equipment) !== null;
}

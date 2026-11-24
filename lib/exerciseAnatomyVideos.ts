import type { VideoSource } from 'expo-video';

export type AnatomySex = 'male' | 'female';

export interface ExerciseAnatomyVideoSpec {
  id: string;
  maleSource: VideoSource;
  femaleSource: VideoSource;
  primaryMusclesUk: string;
  primaryMusclesEn: string;
  secondaryMusclesUk: string;
  secondaryMusclesEn: string;
  aspectRatio: number;
  attribution: string;
}

const BARBELL_BENCH_PRESS_SPEC: ExerciseAnatomyVideoSpec = {
  id: 'barbell_bench_press',
  maleSource: require('@/assets/animations/barbell_bench_press_male.mp4'),
  femaleSource: require('@/assets/animations/barbell_bench_press_female.mp4'),
  primaryMusclesUk: 'Великий грудний м’яз',
  primaryMusclesEn: 'Pectoralis major',
  secondaryMusclesUk: 'Передня дельта · Трицепс',
  secondaryMusclesEn: 'Anterior deltoid · Triceps brachii',
  aspectRatio: 864 / 576,
  attribution: 'Z-Anatomy / BodyParts3D (CC BY-SA)',
};

/**
 * Resolves an exercise name (EN or UK) to its locally bundled 3D anatomical
 * demonstration video spec, or `null` if not yet authored.
 *
 * Strictly excludes biomechanical variants (incline, dumbbell, machine, smith,
 * cable) so every displayed 3D muscular demonstration matches the exact lift.
 */
export function getExerciseAnatomyVideo(
  exerciseName?: string | null,
  equipment?: string | null
): ExerciseAnatomyVideoSpec | null {
  if (!exerciseName) return null;
  const name = exerciseName.trim().toLowerCase();
  const equip = (equipment || '').trim().toLowerCase();

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
    return BARBELL_BENCH_PRESS_SPEC;
  }

  return null;
}

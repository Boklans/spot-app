import { ImageSourcePropType } from 'react-native';

const EXERCISE_IMAGES: Record<string, ImageSourcePropType> = {
  'bench press': require('@/assets/exercises/bench_press.jpg'),
  'incline dumbbell press': require('@/assets/exercises/incline_dumbbell_press.jpg'),
  'incline dumbbell': require('@/assets/exercises/incline_dumbbell_press.jpg'),
  'barbell row': require('@/assets/exercises/barbell_row.jpg'),
  'lat pulldown': require('@/assets/exercises/lat_pulldown.jpg'),
  'overhead press': require('@/assets/exercises/shoulder_press.jpg'),
  'overhead': require('@/assets/exercises/shoulder_press.jpg'),
  'shoulder press': require('@/assets/exercises/shoulder_press.jpg'),
  'triceps pushdown': require('@/assets/exercises/triceps_pushdown.jpg'),
  'biceps curl': require('@/assets/exercises/biceps_curl.jpg'),
  'squat': require('@/assets/exercises/barbell_squat.jpg'),
  'deadlift': require('@/assets/exercises/romanian_deadlift.jpg'),
  'pull-up': require('@/assets/exercises/pull_ups.jpg'),
  'pull up': require('@/assets/exercises/pull_ups.jpg'),
  'chin-up': require('@/assets/exercises/pull_ups.jpg'),
  'leg press': require('@/assets/exercises/leg_press.jpg'),
  'lateral raise': require('@/assets/exercises/lateral_raises.jpg'),
  'plank': require('@/assets/exercises/plank.jpg'),
  'leg curl': require('@/assets/exercises/leg_curl.jpg'),
  'leg extension': require('@/assets/exercises/leg_extension.jpg'),
  'dips': require('@/assets/exercises/chest_dips.jpg'),
  'fly': require('@/assets/exercises/cable_chest_fly.jpg'),
  'hammer curl': require('@/assets/exercises/hammer_curl.jpg'),
  'skull crusher': require('@/assets/exercises/skull_crushers.jpg'),
  'calf': require('@/assets/exercises/calf_raise.jpg'),
  'bulgarian': require('@/assets/exercises/bulgarian_split_squat.jpg'),
  'knee raise': require('@/assets/exercises/hanging_knee_raise.jpg'),
  'hanging': require('@/assets/exercises/hanging_knee_raise.jpg'),
  'incline barbell': require('@/assets/exercises/incline_barbell_press.jpg'),
  'incline bench': require('@/assets/exercises/incline_barbell_press.jpg'),
  'incline press': require('@/assets/exercises/incline_barbell_press.jpg'),
  'cable row': require('@/assets/exercises/seated_cable_row.jpg'),
  'seated row': require('@/assets/exercises/seated_cable_row.jpg'),
};

export function getExerciseImage(name?: string): ImageSourcePropType {
  if (!name) return EXERCISE_IMAGES['bench press'];
  const lower = name.toLowerCase().trim();
  for (const [key, image] of Object.entries(EXERCISE_IMAGES)) {
    if (lower.includes(key)) {
      return image;
    }
  }
  return EXERCISE_IMAGES['bench press'];
}


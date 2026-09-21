import { ImageSourcePropType } from 'react-native';

const EXERCISE_IMAGES: Record<string, ImageSourcePropType> = {
  // --- Chest (Most specific first) ---
  'incline dumbbell press': require('@/assets/exercises/incline_dumbbell_press.jpg'),
  'incline dumbbell': require('@/assets/exercises/incline_dumbbell_press.jpg'),
  'incline barbell press': require('@/assets/exercises/incline_barbell_press.jpg'),
  'incline barbell': require('@/assets/exercises/incline_barbell_press.jpg'),
  'incline bench': require('@/assets/exercises/incline_barbell_press.jpg'),
  'incline press': require('@/assets/exercises/incline_barbell_press.jpg'),

  'dumbbell bench press': require('@/assets/exercises/dumbbell_bench_press.jpg'),
  'dumbbell bench': require('@/assets/exercises/dumbbell_bench_press.jpg'),
  'machine chest press': require('@/assets/exercises/machine_chest_press.jpg'),
  'chest press machine': require('@/assets/exercises/machine_chest_press.jpg'),
  'chest press': require('@/assets/exercises/machine_chest_press.jpg'),
  'bench press': require('@/assets/exercises/bench_press.jpg'),

  'push-up': require('@/assets/exercises/push_ups.jpg'),
  'push up': require('@/assets/exercises/push_ups.jpg'),
  'pushup': require('@/assets/exercises/push_ups.jpg'),
  'chest dips': require('@/assets/exercises/chest_dips.jpg'),
  'dips': require('@/assets/exercises/chest_dips.jpg'),
  'cable chest fly': require('@/assets/exercises/cable_chest_fly.jpg'),
  'cable fly': require('@/assets/exercises/cable_chest_fly.jpg'),
  'chest fly': require('@/assets/exercises/cable_chest_fly.jpg'),
  'fly': require('@/assets/exercises/cable_chest_fly.jpg'),

  // --- Back ---
  'single-arm dumbbell row': require('@/assets/exercises/dumbbell_row.jpg'),
  'single arm dumbbell row': require('@/assets/exercises/dumbbell_row.jpg'),
  'one-arm dumbbell row': require('@/assets/exercises/dumbbell_row.jpg'),
  'one arm dumbbell row': require('@/assets/exercises/dumbbell_row.jpg'),
  'dumbbell row': require('@/assets/exercises/dumbbell_row.jpg'),
  'barbell bent-over row': require('@/assets/exercises/barbell_row.jpg'),
  'barbell row': require('@/assets/exercises/barbell_row.jpg'),
  'bent-over row': require('@/assets/exercises/barbell_row.jpg'),
  'bent over row': require('@/assets/exercises/barbell_row.jpg'),
  'seated cable row': require('@/assets/exercises/seated_cable_row.jpg'),
  'seated row': require('@/assets/exercises/seated_cable_row.jpg'),
  'cable row': require('@/assets/exercises/seated_cable_row.jpg'),
  'lat pulldown': require('@/assets/exercises/lat_pulldown.jpg'),
  'pulldown': require('@/assets/exercises/lat_pulldown.jpg'),
  'pull-up': require('@/assets/exercises/pull_ups.jpg'),
  'pull up': require('@/assets/exercises/pull_ups.jpg'),
  'chin-up': require('@/assets/exercises/pull_ups.jpg'),
  'chin up': require('@/assets/exercises/pull_ups.jpg'),
  'face pull': require('@/assets/exercises/face_pulls.jpg'),
  'face-pull': require('@/assets/exercises/face_pulls.jpg'),

  // --- Shoulders ---
  'dumbbell shoulder press': require('@/assets/exercises/dumbbell_shoulder_press.jpg'),
  'overhead barbell press': require('@/assets/exercises/shoulder_press.jpg'),
  'overhead press': require('@/assets/exercises/shoulder_press.jpg'),
  'shoulder press': require('@/assets/exercises/shoulder_press.jpg'),
  'overhead': require('@/assets/exercises/shoulder_press.jpg'),
  'cable lateral raise': require('@/assets/exercises/cable_lateral_raise.jpg'),
  'lateral raise': require('@/assets/exercises/lateral_raises.jpg'),
  'side raise': require('@/assets/exercises/lateral_raises.jpg'),

  // --- Arms: Triceps ---
  'overhead triceps extension': require('@/assets/exercises/overhead_triceps_extension.jpg'),
  'overhead triceps': require('@/assets/exercises/overhead_triceps_extension.jpg'),
  'triceps extension': require('@/assets/exercises/overhead_triceps_extension.jpg'),
  'triceps pushdown': require('@/assets/exercises/triceps_pushdown.jpg'),
  'tricep pushdown': require('@/assets/exercises/triceps_pushdown.jpg'),
  'skull crusher': require('@/assets/exercises/skull_crushers.jpg'),
  'skullcrusher': require('@/assets/exercises/skull_crushers.jpg'),

  // --- Arms: Biceps ---
  'incline dumbbell curl': require('@/assets/exercises/incline_dumbbell_curl.jpg'),
  'incline curl': require('@/assets/exercises/incline_dumbbell_curl.jpg'),
  'hammer curl': require('@/assets/exercises/hammer_curl.jpg'),
  'barbell biceps curl': require('@/assets/exercises/biceps_curl.jpg'),
  'biceps curl': require('@/assets/exercises/biceps_curl.jpg'),
  'bicep curl': require('@/assets/exercises/biceps_curl.jpg'),
  'curl': require('@/assets/exercises/biceps_curl.jpg'),

  // --- Legs ---
  'bulgarian split squat': require('@/assets/exercises/bulgarian_split_squat.jpg'),
  'bulgarian': require('@/assets/exercises/bulgarian_split_squat.jpg'),
  'walking lunge': require('@/assets/exercises/walking_lunges.jpg'),
  'lunge': require('@/assets/exercises/walking_lunges.jpg'),
  'barbell squat': require('@/assets/exercises/barbell_squat.jpg'),
  'squat': require('@/assets/exercises/barbell_squat.jpg'),
  'leg press': require('@/assets/exercises/leg_press.jpg'),
  'lying leg curl': require('@/assets/exercises/leg_curl.jpg'),
  'leg curl': require('@/assets/exercises/leg_curl.jpg'),
  'leg extension': require('@/assets/exercises/leg_extension.jpg'),
  'romanian deadlift': require('@/assets/exercises/romanian_deadlift.jpg'),
  'deadlift': require('@/assets/exercises/romanian_deadlift.jpg'),
  'standing calf raise': require('@/assets/exercises/calf_raise.jpg'),
  'calf raise': require('@/assets/exercises/calf_raise.jpg'),
  'calf': require('@/assets/exercises/calf_raise.jpg'),

  // --- Core ---
  'cable crunch': require('@/assets/exercises/cable_crunch.jpg'),
  'kneeling crunch': require('@/assets/exercises/cable_crunch.jpg'),
  'hanging knee raise': require('@/assets/exercises/hanging_knee_raise.jpg'),
  'knee raise': require('@/assets/exercises/hanging_knee_raise.jpg'),
  'plank': require('@/assets/exercises/plank.jpg'),
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

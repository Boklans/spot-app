import { ImageSourcePropType } from 'react-native';
import { useUserProfileStore } from '@/store/userProfileStore';

// Dedicated female 3D anatomical renders (high-res matte grey clay with #C8FF3D neon highlights)
// Strictly mapped ONLY to movements that match the actual biomechanics and equipment of the render.
const FEMALE_EXERCISE_IMAGES: Record<string, ImageSourcePropType> = {
  // Hip Thrust & Glute Bridges
  'barbell hip thrust': require('@/assets/exercises/female/hip_thrust.jpg'),
  'dumbbell hip thrust': require('@/assets/exercises/female/hip_thrust.jpg'),
  'hip thrust': require('@/assets/exercises/female/hip_thrust.jpg'),
  'glute bridge': require('@/assets/exercises/female/hip_thrust.jpg'),
  'pull-through': require('@/assets/exercises/female/hip_thrust.jpg'),

  // Squats
  'barbell back squat': require('@/assets/exercises/female/barbell_squat.jpg'),
  'barbell front squat': require('@/assets/exercises/female/barbell_squat.jpg'),
  'barbell squat': require('@/assets/exercises/female/barbell_squat.jpg'),
  'goblet squat': require('@/assets/exercises/female/barbell_squat.jpg'),
  'back squat': require('@/assets/exercises/female/barbell_squat.jpg'),
  'front squat': require('@/assets/exercises/female/barbell_squat.jpg'),
  'squat': require('@/assets/exercises/female/barbell_squat.jpg'),

  // Romanian Deadlift & RDL
  'barbell romanian deadlift': require('@/assets/exercises/female/romanian_deadlift.jpg'),
  'dumbbell romanian deadlift': require('@/assets/exercises/female/romanian_deadlift.jpg'),
  'romanian deadlift': require('@/assets/exercises/female/romanian_deadlift.jpg'),
  'dumbbell rdl': require('@/assets/exercises/female/romanian_deadlift.jpg'),
  'rdl': require('@/assets/exercises/female/romanian_deadlift.jpg'),

  // Bulgarian Split Squat
  'bulgarian split squat': require('@/assets/exercises/female/bulgarian_split_squat.jpg'),
  'split squat': require('@/assets/exercises/female/bulgarian_split_squat.jpg'),

  // Walking Lunges
  'walking dumbbell lunge': require('@/assets/exercises/female/walking_lunges.jpg'),
  'walking lunge': require('@/assets/exercises/female/walking_lunges.jpg'),
  'dumbbell lunge': require('@/assets/exercises/female/walking_lunges.jpg'),
  'lunges': require('@/assets/exercises/female/walking_lunges.jpg'),
  'lunge': require('@/assets/exercises/female/walking_lunges.jpg'),

  // Lat Pulldown
  'cable lat pulldown': require('@/assets/exercises/female/lat_pulldown.jpg'),
  'lat pulldown': require('@/assets/exercises/female/lat_pulldown.jpg'),

  // Dumbbell Shoulder Press
  'standing dumbbell shoulder press': require('@/assets/exercises/female/dumbbell_shoulder_press.jpg'),
  'seated dumbbell shoulder press': require('@/assets/exercises/female/dumbbell_shoulder_press.jpg'),
  'dumbbell shoulder press': require('@/assets/exercises/female/dumbbell_shoulder_press.jpg'),
  'dumbbell overhead press': require('@/assets/exercises/female/dumbbell_shoulder_press.jpg'),

  // Lateral Raises
  'dumbbell lateral raise': require('@/assets/exercises/female/lateral_raises.jpg'),
  'lateral raise': require('@/assets/exercises/female/lateral_raises.jpg'),
  'side raise': require('@/assets/exercises/female/lateral_raises.jpg'),

  // Dumbbell Bench Press
  'dumbbell bench press': require('@/assets/exercises/female/dumbbell_bench_press.jpg'),
  'dumbbell bench': require('@/assets/exercises/female/dumbbell_bench_press.jpg'),

  // Core: Cable Crunch & Plank
  'cable crunch': require('@/assets/exercises/female/cable_crunch.jpg'),
  'kneeling crunch': require('@/assets/exercises/female/cable_crunch.jpg'),
  'plank': require('@/assets/exercises/female/plank.jpg'),
};

// Full library of 3D anatomical renders covering every movement in the Exercise Library
const EXERCISE_IMAGES: Record<string, ImageSourcePropType> = {
  // --- Chest ---
  'incline dumbbell press': require('@/assets/exercises/incline_dumbbell_press.jpg'),
  'incline dumbbell': require('@/assets/exercises/incline_dumbbell_press.jpg'),
  'incline barbell bench press': require('@/assets/exercises/incline_barbell_press.jpg'),
  'incline barbell press': require('@/assets/exercises/incline_barbell_press.jpg'),
  'incline barbell': require('@/assets/exercises/incline_barbell_press.jpg'),
  'incline bench': require('@/assets/exercises/incline_barbell_press.jpg'),
  'incline press': require('@/assets/exercises/incline_barbell_press.jpg'),

  'dumbbell bench press': require('@/assets/exercises/dumbbell_bench_press.jpg'),
  'dumbbell bench': require('@/assets/exercises/dumbbell_bench_press.jpg'),
  'barbell bench press': require('@/assets/exercises/bench_press.jpg'),
  'bench press': require('@/assets/exercises/bench_press.jpg'),
  'machine chest press': require('@/assets/exercises/machine_chest_press.jpg'),
  'chest press machine': require('@/assets/exercises/machine_chest_press.jpg'),
  'chest press': require('@/assets/exercises/machine_chest_press.jpg'),

  'push-ups': require('@/assets/exercises/push_ups.jpg'),
  'push-up': require('@/assets/exercises/push_ups.jpg'),
  'push up': require('@/assets/exercises/push_ups.jpg'),
  'pushup': require('@/assets/exercises/push_ups.jpg'),
  'chest dips': require('@/assets/exercises/chest_dips.jpg'),
  'tricep dips': require('@/assets/exercises/chest_dips.jpg'),
  'dips': require('@/assets/exercises/chest_dips.jpg'),
  'cable chest fly': require('@/assets/exercises/cable_chest_fly.jpg'),
  'cable fly': require('@/assets/exercises/cable_chest_fly.jpg'),
  'chest fly': require('@/assets/exercises/cable_chest_fly.jpg'),
  'fly': require('@/assets/exercises/cable_chest_fly.jpg'),

  // --- Back ---
  'barbell bent-over row': require('@/assets/exercises/barbell_row.jpg'),
  'barbell bent over row': require('@/assets/exercises/barbell_row.jpg'),
  'barbell row': require('@/assets/exercises/barbell_row.jpg'),
  'bent-over row': require('@/assets/exercises/barbell_row.jpg'),
  'bent over row': require('@/assets/exercises/barbell_row.jpg'),
  'single-arm dumbbell row': require('@/assets/exercises/dumbbell_row.jpg'),
  'single arm dumbbell row': require('@/assets/exercises/dumbbell_row.jpg'),
  'one-arm dumbbell row': require('@/assets/exercises/dumbbell_row.jpg'),
  'dumbbell row': require('@/assets/exercises/dumbbell_row.jpg'),
  'seated cable row': require('@/assets/exercises/seated_cable_row.jpg'),
  'seated row': require('@/assets/exercises/seated_cable_row.jpg'),
  'cable row': require('@/assets/exercises/seated_cable_row.jpg'),
  't-bar row': require('@/assets/exercises/barbell_row.jpg'),
  'lat pulldown': require('@/assets/exercises/lat_pulldown.jpg'),
  'pulldown': require('@/assets/exercises/lat_pulldown.jpg'),
  'pull-ups': require('@/assets/exercises/pull_ups.jpg'),
  'pull-up': require('@/assets/exercises/pull_ups.jpg'),
  'pull up': require('@/assets/exercises/pull_ups.jpg'),
  'chin-ups': require('@/assets/exercises/pull_ups.jpg'),
  'chin-up': require('@/assets/exercises/pull_ups.jpg'),
  'chin up': require('@/assets/exercises/pull_ups.jpg'),
  'face pulls': require('@/assets/exercises/face_pulls.jpg'),
  'face pull': require('@/assets/exercises/face_pulls.jpg'),
  'reverse pec deck': require('@/assets/exercises/face_pulls.jpg'),

  // --- Shoulders ---
  'standing dumbbell shoulder press': require('@/assets/exercises/dumbbell_shoulder_press.jpg'),
  'dumbbell shoulder press': require('@/assets/exercises/dumbbell_shoulder_press.jpg'),
  'overhead barbell press': require('@/assets/exercises/shoulder_press.jpg'),
  'overhead press': require('@/assets/exercises/shoulder_press.jpg'),
  'shoulder press': require('@/assets/exercises/shoulder_press.jpg'),
  'military press': require('@/assets/exercises/shoulder_press.jpg'),
  'overhead': require('@/assets/exercises/shoulder_press.jpg'),
  'dumbbell lateral raise': require('@/assets/exercises/lateral_raises.jpg'),
  'cable lateral raise': require('@/assets/exercises/cable_lateral_raise.jpg'),
  'lateral raise': require('@/assets/exercises/lateral_raises.jpg'),
  'side raise': require('@/assets/exercises/lateral_raises.jpg'),

  // --- Arms: Triceps ---
  'cable tricep rope pushdown': require('@/assets/exercises/triceps_pushdown.jpg'),
  'triceps pushdown': require('@/assets/exercises/triceps_pushdown.jpg'),
  'tricep pushdown': require('@/assets/exercises/triceps_pushdown.jpg'),
  'overhead triceps extension': require('@/assets/exercises/overhead_triceps_extension.jpg'),
  'overhead triceps': require('@/assets/exercises/overhead_triceps_extension.jpg'),
  'triceps extension': require('@/assets/exercises/overhead_triceps_extension.jpg'),
  'skull crushers': require('@/assets/exercises/skull_crushers.jpg'),
  'skull crusher': require('@/assets/exercises/skull_crushers.jpg'),

  // --- Arms: Biceps ---
  'incline dumbbell bicep curl': require('@/assets/exercises/incline_dumbbell_curl.jpg'),
  'incline dumbbell curl': require('@/assets/exercises/incline_dumbbell_curl.jpg'),
  'incline curl': require('@/assets/exercises/incline_dumbbell_curl.jpg'),
  'dumbbell hammer curl': require('@/assets/exercises/hammer_curl.jpg'),
  'hammer curl': require('@/assets/exercises/hammer_curl.jpg'),
  'barbell bicep curl': require('@/assets/exercises/biceps_curl.jpg'),
  'barbell curl': require('@/assets/exercises/biceps_curl.jpg'),
  'biceps curl': require('@/assets/exercises/biceps_curl.jpg'),
  'bicep curl': require('@/assets/exercises/biceps_curl.jpg'),
  'curl': require('@/assets/exercises/biceps_curl.jpg'),

  // --- Legs & Glutes ---
  'barbell back squat': require('@/assets/exercises/barbell_squat.jpg'),
  'barbell front squat': require('@/assets/exercises/barbell_squat.jpg'),
  'barbell squat': require('@/assets/exercises/barbell_squat.jpg'),
  'goblet squat': require('@/assets/exercises/barbell_squat.jpg'),
  'squat': require('@/assets/exercises/barbell_squat.jpg'),
  'leg press': require('@/assets/exercises/leg_press.jpg'),
  'bulgarian split squat': require('@/assets/exercises/bulgarian_split_squat.jpg'),
  'split squat': require('@/assets/exercises/bulgarian_split_squat.jpg'),
  'leg extension': require('@/assets/exercises/leg_extension.jpg'),
  'lying leg curl': require('@/assets/exercises/leg_curl.jpg'),
  'leg curl': require('@/assets/exercises/leg_curl.jpg'),
  'standing calf raise': require('@/assets/exercises/calf_raise.jpg'),
  'calf raise': require('@/assets/exercises/calf_raise.jpg'),
  'calf': require('@/assets/exercises/calf_raise.jpg'),
  'walking dumbbell lunge': require('@/assets/exercises/walking_lunges.jpg'),
  'walking lunge': require('@/assets/exercises/walking_lunges.jpg'),
  'dumbbell lunge': require('@/assets/exercises/walking_lunges.jpg'),
  'lunge': require('@/assets/exercises/walking_lunges.jpg'),
  'barbell hip thrust': require('@/assets/exercises/female/hip_thrust.jpg'),
  'dumbbell hip thrust': require('@/assets/exercises/female/hip_thrust.jpg'),
  'hip thrust': require('@/assets/exercises/female/hip_thrust.jpg'),
  'glute bridge': require('@/assets/exercises/female/hip_thrust.jpg'),
  'pull-through': require('@/assets/exercises/female/hip_thrust.jpg'),
  'glute': require('@/assets/exercises/female/hip_thrust.jpg'),
  'conventional deadlift': require('@/assets/exercises/romanian_deadlift.jpg'),
  'romanian deadlift': require('@/assets/exercises/romanian_deadlift.jpg'),
  'deadlift': require('@/assets/exercises/romanian_deadlift.jpg'),
  'rdl': require('@/assets/exercises/romanian_deadlift.jpg'),

  // --- Core ---
  'cable crunch': require('@/assets/exercises/cable_crunch.jpg'),
  'kneeling crunch': require('@/assets/exercises/cable_crunch.jpg'),
  'hanging leg raise': require('@/assets/exercises/hanging_knee_raise.jpg'),
  'hanging knee raise': require('@/assets/exercises/hanging_knee_raise.jpg'),
  'knee raise': require('@/assets/exercises/hanging_knee_raise.jpg'),
  'plank': require('@/assets/exercises/plank.jpg'),
  'ab wheel rollout': require('@/assets/exercises/plank.jpg'),
  'ab wheel': require('@/assets/exercises/plank.jpg'),
};

/**
 * Searches a dictionary for the most specific matching key (longest key first).
 */
function matchExercise(name: string, dictionary: Record<string, ImageSourcePropType>): ImageSourcePropType | null {
  const lower = name.toLowerCase().trim();
  if (!lower) return null;

  // Exact match first
  if (dictionary[lower]) {
    return dictionary[lower];
  }

  // Substring match sorted by length descending so specific names take precedence
  const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) {
      return dictionary[key];
    }
  }

  return null;
}

export function getExerciseImage(
  name?: string,
  customImageUri?: string,
  sexOverride?: 'male' | 'female' | 'unspecified'
): ImageSourcePropType {
  if (customImageUri) {
    return { uri: customImageUri };
  }

  // Resolve user sex (either explicit or from profile store)
  const currentSex = sexOverride ?? useUserProfileStore.getState().profile.sex;
  const exerciseName = name ?? '';

  // 1. If user is female, check if we have a biomechanically accurate female render for this exercise
  if (currentSex === 'female' && exerciseName) {
    const femaleMatch = matchExercise(exerciseName, FEMALE_EXERCISE_IMAGES);
    if (femaleMatch) {
      return femaleMatch;
    }
  }

  // 2. Otherwise (or as an anatomically accurate fallback for exercises without dedicated female renders yet),
  // match against the full 3D exercise library so every movement displays its correct equipment and form
  if (exerciseName) {
    const libraryMatch = matchExercise(exerciseName, EXERCISE_IMAGES);
    if (libraryMatch) {
      return libraryMatch;
    }
  }

  // 3. Fallback if the exercise name is completely unrecognized
  if (currentSex === 'female') {
    return FEMALE_EXERCISE_IMAGES['hip thrust'] ?? EXERCISE_IMAGES['bench press'];
  }
  return EXERCISE_IMAGES['bench press'];
}

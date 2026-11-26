/**
 * SPOT 2.0 Real-Module Female Programming & Asset Verification Suite
 * Executes actual production TypeScript modules:
 * - lib/programGenerator.ts
 * - lib/exerciseImages.ts
 * - store/userProfileStore.ts
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule, resetMemoryStorage } = require('./tsRunner');

const { generateProgram } = loadTsModule('lib/programGenerator.ts');
const { getExerciseImage } = loadTsModule('lib/exerciseImages.ts');
const { useUserProfileStore } = loadTsModule('store/userProfileStore.ts');

console.log('\n--- Running Real-Module Female Programming & Asset Verification Suite ---\n');

let passed = 0;

// TEST 1: Female 3D Assets Presence on Disk
{
  const femaleAssetsDir = path.join(__dirname, '..', 'assets', 'exercises', 'female');
  assert.ok(fs.existsSync(femaleAssetsDir), 'assets/exercises/female directory must exist');

  const requiredImages = [
    'barbell_squat.jpg',
    'bulgarian_split_squat.jpg',
    'cable_crunch.jpg',
    'dumbbell_bench_press.jpg',
    'dumbbell_shoulder_press.jpg',
    'hip_thrust.jpg',
    'lateral_raises.jpg',
    'lat_pulldown.jpg',
    'plank.jpg',
    'romanian_deadlift.jpg',
    'walking_lunges.jpg',
  ];

  for (const img of requiredImages) {
    const fullPath = path.join(femaleAssetsDir, img);
    assert.ok(fs.existsSync(fullPath), `Female image ${img} must exist`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 5000, `Female image ${img} must have valid content`);
  }

  console.log('✅ TEST 1 PASSED: All 11 dedicated 3D female athletic anatomy renders present on disk');
  passed++;
}

// TEST 2: Real getExerciseImage dynamic sex routing & biomechanical accuracy
{
  const femaleHipThrust = getExerciseImage('Barbell Hip Thrust', undefined, 'female');
  assert.strictEqual(femaleHipThrust.__assetPath, 'assets/exercises/female/hip_thrust.jpg');

  const femaleSquat = getExerciseImage('Barbell Back Squat', undefined, 'female');
  assert.strictEqual(femaleSquat.__assetPath, 'assets/exercises/female/barbell_squat.jpg');

  const maleSquat = getExerciseImage('Barbell Back Squat', undefined, 'male');
  assert.strictEqual(maleSquat.__assetPath, 'assets/exercises/barbell_squat.jpg');

  // Verify non-female-rendered exercises fall back to biomechanically accurate equipment renders (NOT wrong female renders!)
  assert.strictEqual(getExerciseImage('Push-ups', undefined, 'female').__assetPath, 'assets/exercises/push_ups.jpg');
  assert.strictEqual(getExerciseImage('Pull-ups', undefined, 'female').__assetPath, 'assets/exercises/pull_ups.jpg');
  assert.strictEqual(getExerciseImage('Leg Extension', undefined, 'female').__assetPath, 'assets/exercises/leg_extension.jpg');

  console.log('✅ TEST 2 PASSED: Real getExerciseImage routes male/female renders with biomechanical precision');
  passed++;
}

// TEST 3: Real generateProgram execution for female Full Body & Upper/Lower splits
{
  const femaleFb = generateProgram({
    completed: true,
    sex: 'female',
    weightKg: 60,
    goal: 'build_muscle',
    experience: 'intermediate',
    trainingFrequency: 3,
    equipment: ['full_gym'],
    splitPreference: 'full_body',
  });
  assert.strictEqual(femaleFb.splitType, 'full_body');
  assert.strictEqual(femaleFb.workouts.length, 3);
  const allExerciseNames = femaleFb.workouts.flatMap((w) => w.exercises.map((e) => e.name.toLowerCase()));
  assert.ok(
    allExerciseNames.some((n) => n.includes('hip thrust') || n.includes('glute')),
    'Female Full Body program must include glute-focused compound movement'
  );

  const femaleUl = generateProgram({
    completed: true,
    sex: 'female',
    weightKg: 60,
    goal: 'build_muscle',
    experience: 'intermediate',
    trainingFrequency: 4,
    equipment: ['full_gym'],
    splitPreference: 'upper_lower',
  });
  assert.strictEqual(femaleUl.splitType, 'upper_lower');
  assert.strictEqual(femaleUl.workouts.length, 4);

  console.log('✅ TEST 3 PASSED: Real generateProgram builds female Full Body & Upper/Lower templates accurately');
  passed++;
}

// TEST 4: Real userProfileStore sex persistence
(async () => {
  resetMemoryStorage();
  await useUserProfileStore.getState().updateProfile({ sex: 'female', weightKg: 58 });
  useUserProfileStore.setState({ hydrated: false });
  const loaded = await useUserProfileStore.getState().loadProfile();
  assert.strictEqual(loaded.sex, 'female');
  assert.strictEqual(loaded.weightKg, 58);

  console.log('✅ TEST 4 PASSED: Real userProfileStore persists and reloads sex & weightKg reliably');
  passed++;

  console.log(`\n🎉 ALL ${passed} REAL-MODULE FEMALE PROGRAMMING & ASSET TESTS PASSED!\n`);
})().catch((err) => {
  console.error('❌ Female programming verification failed:', err);
  process.exit(1);
});

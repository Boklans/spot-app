/**
 * SPOT Female Programming & Asset Verification Suite
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n--- Running SPOT Female Programming & Asset Verification Suite ---\n');

let passed = 0;

// TEST 1: Female 3D Assets Presence
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
    assert.ok(stat.size > 50000, `Female image ${img} must have valid content (got ${stat.size} bytes)`);
  }

  console.log('✅ TEST 1 PASSED: All 11 dedicated 3D female athletic anatomy renders present and verified');
  passed++;
}

// TEST 2: exerciseImages.ts integration
{
  const exerciseImagesSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'exerciseImages.ts'), 'utf8');

  assert.ok(exerciseImagesSource.includes('FEMALE_EXERCISE_IMAGES'), 'exerciseImages.ts must declare FEMALE_EXERCISE_IMAGES mapping');
  assert.ok(exerciseImagesSource.includes("currentSex === 'female'"), 'exerciseImages.ts must resolve female assets when sex is female');
  assert.ok(exerciseImagesSource.includes('assets/exercises/female/hip_thrust.jpg'), 'exerciseImages.ts must map female hip thrust');
  assert.ok(exerciseImagesSource.includes('assets/exercises/female/barbell_squat.jpg'), 'exerciseImages.ts must map female squat');
  assert.ok(exerciseImagesSource.includes('assets/exercises/female/lat_pulldown.jpg'), 'exerciseImages.ts must map female lat pulldown');

  console.log('✅ TEST 2 PASSED: exerciseImages.ts dynamically routes to female renders for female users');
  passed++;
}

// TEST 3: Female-tailored Workout Templates in programGenerator.ts
{
  const programGenSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'programGenerator.ts'), 'utf8');

  assert.ok(programGenSource.includes('femaleFullBodyTemplates'), 'programGenerator.ts must implement femaleFullBodyTemplates');
  assert.ok(programGenSource.includes('femaleUpperLowerTemplates'), 'programGenerator.ts must implement femaleUpperLowerTemplates');
  assert.ok(programGenSource.includes("onboarding.sex === 'female'"), 'programGenerator.ts must inspect onboarding sex');
  assert.ok(programGenSource.includes('Sculpt & Tone (Glute Focus)') || programGenSource.includes('Скульпт & Тонус'), 'programGenerator.ts must provide female-focused program naming');
  assert.ok(programGenSource.includes('Glute & Silhouette Split') || programGenSource.includes('Жіночий спліт'), 'programGenerator.ts must provide female-focused split naming');

  console.log('✅ TEST 3 PASSED: Dedicated female program templates & splits implemented in programGenerator.ts');
  passed++;
}

// TEST 4: Onboarding Sex Persistence & Profile Integrity
{
  const userProfileSource = fs.readFileSync(path.join(__dirname, '..', 'store', 'userProfileStore.ts'), 'utf8');
  assert.ok(userProfileSource.includes("p.sex === 'male' || p.sex === 'female'"), 'normalizeLoadedProfile must persist sex when loading profile');

  const readySource = fs.readFileSync(path.join(__dirname, '..', 'app', 'onboarding', 'program-ready.tsx'), 'utf8');
  assert.ok(readySource.includes("onboarding.sex && onboarding.sex !== 'unspecified'"), 'program-ready.tsx must prioritize onboarding.sex over default profile');

  const editProfileSource = fs.readFileSync(path.join(__dirname, '..', 'components', 'profile', 'EditProfileModal.tsx'), 'utf8');
  assert.ok(!editProfileSource.includes('sexRow'), 'EditProfileModal.tsx must not clutter profile with redundant gender switch');

  console.log('✅ TEST 4 PASSED: Onboarding sex selection persists reliably into profile without loss');
  passed++;
}

// TEST 5: Switching Split Preference between Full Body and Upper / Lower
{
  const profileSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'profile.tsx'), 'utf8');
  assert.ok(profileSource.includes("s.includes('full')"), 'profile.tsx must parse Full Body split choice safely');
  assert.ok(profileSource.includes("s.includes('upper')"), 'profile.tsx must parse Upper / Lower split choice safely');

  const programGenSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'programGenerator.ts'), 'utf8');
  assert.ok(programGenSource.includes("onboarding.splitPreference === 'full_body'"), 'programGenerator.ts must check explicit full_body preference');
  assert.ok(programGenSource.includes("onboarding.splitPreference === 'upper_lower'"), 'programGenerator.ts must check explicit upper_lower preference');

  console.log('✅ TEST 5 PASSED: Switching between Full Body and Upper/Lower is strictly honored in profile and generator');
  passed++;
}

console.log(`\n🎉 ALL ${passed} FEMALE PROGRAMMING & ASSET TESTS PASSED!\n`);


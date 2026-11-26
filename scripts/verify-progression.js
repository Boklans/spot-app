/**
 * SPOT 2.0 Real-Module Adaptive Progression Verification Suite
 * Directly executes actual production TypeScript module:
 * - lib/adaptiveProgression.ts
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./tsRunner');

const {
  recommendWeight,
  findLatestExerciseSets,
  inferEquipmentFromName,
} = loadTsModule('lib/adaptiveProgression.ts');

console.log('\n--- Running Real-Module Adaptive Progression Engine Tests ---\n');
let passed = 0;

const benchPress = {
  id: 'bench-press',
  name: 'Bench Press',
  muscleGroup: 'Chest',
  equipment: 'barbell',
  sets: 3,
  targetRepRange: '8-12',
  recommendedWeight: 40,
  weightIncrement: 2.5,
};

// TEST 1: First session uses program_default
{
  const rec = recommendWeight(benchPress, []);
  assert.strictEqual(rec.recommendedWeight, 40);
  assert.strictEqual(rec.recommendedReps, 8);
  assert.strictEqual(rec.recommendationReason, 'program_default');
  assert.strictEqual(rec.source, 'program_default');
  console.log('✅ TEST 1 PASSED: First workout uses program_default weight (40kg) and min reps (8)');
  passed++;
}

// TEST 2: Hitting 8/8/8 in 8-12 range maintains 40kg and advances target reps to 9
{
  const rec = recommendWeight(benchPress, [
    { weight: 40, reps: 8 },
    { weight: 40, reps: 8 },
    { weight: 40, reps: 8 },
  ]);
  assert.strictEqual(rec.recommendedWeight, 40);
  assert.strictEqual(rec.recommendedReps, 9);
  assert.strictEqual(rec.recommendationReason, 'maintain');
  assert.strictEqual(rec.source, 'history');
  console.log('✅ TEST 2 PASSED: Double progression advances target reps from 8/8/8 -> 40kg × 9 reps');
  passed++;
}

// TEST 3: Uneven sets 10/9/9 -> 10 reps AND 10/8/8 -> 9 reps
{
  const rec10_9_9 = recommendWeight(benchPress, [
    { weight: 40, reps: 10 },
    { weight: 40, reps: 9 },
    { weight: 40, reps: 9 },
  ]);
  assert.strictEqual(rec10_9_9.recommendedWeight, 40);
  assert.strictEqual(rec10_9_9.recommendedReps, 10);
  assert.strictEqual(rec10_9_9.recommendationReason, 'maintain');

  const rec10_8_8 = recommendWeight(benchPress, [
    { weight: 40, reps: 10 },
    { weight: 40, reps: 8 },
    { weight: 40, reps: 8 },
  ]);
  assert.strictEqual(rec10_8_8.recommendedWeight, 40);
  assert.strictEqual(rec10_8_8.recommendedReps, 9);
  assert.strictEqual(rec10_8_8.recommendationReason, 'maintain');
  console.log('✅ TEST 3 PASSED: Uneven sets (10/9/9 -> 10 reps, 10/8/8 -> 9 reps) advance +1 from lowest set without skipping');
  passed++;
}

// TEST 4: Hitting top of rep range (12/12/12) increases weight (+2.5kg) and resets target reps to 8
{
  const rec = recommendWeight(benchPress, [
    { weight: 40, reps: 12 },
    { weight: 40, reps: 12 },
    { weight: 40, reps: 12 },
  ]);
  assert.strictEqual(rec.recommendedWeight, 42.5);
  assert.strictEqual(rec.recommendedReps, 8);
  assert.strictEqual(rec.recommendationReason, 'increase');
  assert.strictEqual(rec.source, 'history');
  console.log('✅ TEST 4 PASSED: Top of rep range (12/12/12) triggers +2.5kg increase (42.5kg × 8 reps)');
  passed++;
}

// TEST 5: Equipment-specific increments
{
  const dbCurl = {
    id: 'bicep-curl',
    name: 'Dumbbell Bicep Curl',
    equipment: 'dumbbells',
    sets: 2,
    targetRepRange: '10-12',
    recommendedWeight: 12,
    weightIncrement: 1,
  };
  assert.strictEqual(
    recommendWeight(dbCurl, [{ weight: 12, reps: 12 }, { weight: 12, reps: 12 }]).recommendedWeight,
    13
  );
  assert.strictEqual(
    recommendWeight(dbCurl, [{ weight: 32, reps: 12 }, { weight: 32, reps: 12 }]).recommendedWeight,
    34
  );

  const legPress = {
    id: 'leg-press',
    name: 'Leg Press',
    equipment: 'machines',
    sets: 2,
    targetRepRange: '10-12',
    recommendedWeight: 40,
    weightIncrement: 2.5,
  };
  assert.strictEqual(
    recommendWeight(legPress, [{ weight: 40, reps: 12 }, { weight: 40, reps: 12 }]).recommendedWeight,
    42.5
  );
  assert.strictEqual(
    recommendWeight(legPress, [{ weight: 80, reps: 12 }, { weight: 80, reps: 12 }]).recommendedWeight,
    85
  );

  const pullUps = {
    id: 'pull-up',
    name: 'Pull-up',
    sets: 3,
    targetRepRange: '6-10',
    recommendedWeight: 0,
  };
  const recBw = recommendWeight(pullUps, [
    { weight: 0, reps: 7 },
    { weight: 0, reps: 7 },
    { weight: 0, reps: 7 },
  ]);
  assert.strictEqual(recBw.recommendedWeight, 0);
  assert.strictEqual(recBw.recommendedReps, 8);
  assert.strictEqual(inferEquipmentFromName('Tricep Dips'), 'bodyweight');
  assert.strictEqual(inferEquipmentFromName('Assisted Pull-up'), 'machines');

  console.log('✅ TEST 5 PASSED: Equipment-aware increments (+1/+2kg DB, +2.5/+5kg Machine, +1 rep Bodyweight & Dips/Assisted)');
  passed++;
}

// TEST 6: Fatigue Boundary Cases
{
  const rec887 = recommendWeight(benchPress, [{ weight: 40, reps: 8 }, { weight: 40, reps: 8 }, { weight: 40, reps: 7 }]);
  assert.strictEqual(rec887.recommendedWeight, 40);
  assert.strictEqual(rec887.recommendationReason, 'maintain');

  const rec886 = recommendWeight(benchPress, [{ weight: 40, reps: 8 }, { weight: 40, reps: 8 }, { weight: 40, reps: 6 }]);
  assert.strictEqual(rec886.recommendedWeight, 40);
  assert.strictEqual(rec886.recommendationReason, 'maintain');

  const rec777 = recommendWeight(benchPress, [{ weight: 40, reps: 7 }, { weight: 40, reps: 7 }, { weight: 40, reps: 7 }]);
  assert.strictEqual(rec777.recommendedWeight, 37.5);
  assert.strictEqual(rec777.recommendationReason, 'reduce');

  const rec554 = recommendWeight(benchPress, [{ weight: 40, reps: 5 }, { weight: 40, reps: 5 }, { weight: 40, reps: 4 }]);
  assert.strictEqual(rec554.recommendedWeight, 37.5);
  assert.strictEqual(rec554.recommendationReason, 'reduce');

  console.log('✅ TEST 6 PASSED: Fatigue boundary cases verified (8/8/7 & 8/8/6 maintain 40kg; 7/7/7 & 5/5/4 reduce to 37.5kg)');
  passed++;
}

// TEST 7: Manual Weight Override & Mixed Weights Across Sets
{
  const recManualOverride = recommendWeight(benchPress, [
    { weight: 50, reps: 8 },
    { weight: 50, reps: 8 },
    { weight: 50, reps: 8 },
  ]);
  assert.strictEqual(recManualOverride.recommendedWeight, 50);
  assert.strictEqual(recManualOverride.recommendedReps, 9);

  const recMixedDrop = recommendWeight(benchPress, [
    { weight: 45, reps: 12 },
    { weight: 40, reps: 12 },
    { weight: 40, reps: 12 },
  ]);
  assert.strictEqual(recMixedDrop.recommendedWeight, 45);
  assert.strictEqual(recMixedDrop.recommendedReps, 12);
  assert.strictEqual(recMixedDrop.recommendationReason, 'maintain');

  const recFailedPeakDrop = recommendWeight(benchPress, [
    { weight: 45, reps: 5 },
    { weight: 40, reps: 10 },
    { weight: 40, reps: 10 },
  ]);
  assert.strictEqual(recFailedPeakDrop.recommendedWeight, 40);
  assert.strictEqual(recFailedPeakDrop.recommendedReps, 10);
  assert.strictEqual(recFailedPeakDrop.recommendationReason, 'reduce');

  const recRampedPeak = recommendWeight(benchPress, [
    { weight: 45, reps: 8 },
    { weight: 45, reps: 8 },
    { weight: 47.5, reps: 10 },
  ]);
  assert.strictEqual(recRampedPeak.recommendedWeight, 47.5);
  assert.strictEqual(recRampedPeak.recommendedReps, 8);
  assert.strictEqual(recRampedPeak.recommendationReason, 'maintain');

  console.log('✅ TEST 7 PASSED: Manual weight override, mixed-weight drop sets, and failed peak fallback verified');
  passed++;
}

// TEST 8: Incomplete / Skipped Sets Protection
{
  const rec1of3 = recommendWeight(benchPress, [{ weight: 40, reps: 12 }]);
  assert.strictEqual(rec1of3.recommendedWeight, 40);
  assert.strictEqual(rec1of3.recommendedReps, 12);
  assert.strictEqual(rec1of3.recommendationReason, 'maintain');

  const rec2of3 = recommendWeight(benchPress, [{ weight: 40, reps: 8 }, { weight: 40, reps: 8 }]);
  assert.strictEqual(rec2of3.recommendedWeight, 40);
  assert.strictEqual(rec2of3.recommendedReps, 8);
  assert.strictEqual(rec2of3.recommendationReason, 'maintain');

  console.log('✅ TEST 8 PASSED: Incomplete/skipped sets consolidate before increasing weight or reps');
  passed++;
}

// TEST 9: Swapped Exercise Isolation & Similar Names via real findLatestExerciseSets
{
  const mockHistory = [
    {
      id: 'w-3',
      completedAt: '2026-10-26T10:00:00Z',
      exercises: [
        {
          exerciseId: 'incline-bench-press',
          exerciseName: 'Incline Bench Press',
          sets: [{ weight: 35, reps: 10 }, { weight: 35, reps: 10 }, { weight: 35, reps: 10 }],
        },
      ],
    },
    {
      id: 'w-2',
      completedAt: '2026-10-25T10:00:00Z',
      exercises: [
        {
          exerciseId: 'bench-press',
          exerciseName: 'Incline Dumbbell Press',
          sets: [{ weight: 16, reps: 12 }, { weight: 16, reps: 12 }, { weight: 16, reps: 12 }],
        },
      ],
    },
    {
      id: 'w-1',
      completedAt: '2026-10-20T10:00:00Z',
      exercises: [
        {
          exerciseId: 'bench-press',
          exerciseName: 'Bench Press',
          sets: [{ weight: 42.5, reps: 9 }, { weight: 42.5, reps: 9 }, { weight: 42.5, reps: 9 }],
        },
      ],
    },
  ];

  const benchSets = findLatestExerciseSets(mockHistory, benchPress);
  assert.strictEqual(benchSets.length, 3);
  assert.strictEqual(benchSets[0].weight, 42.5);
  assert.strictEqual(benchSets[0].reps, 9);

  const dbInclineSets = findLatestExerciseSets(mockHistory, {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
  });
  assert.strictEqual(dbInclineSets.length, 3);
  assert.strictEqual(dbInclineSets[0].weight, 16);

  console.log('✅ TEST 9 PASSED: Real findLatestExerciseSets isolates swapped exercises and similar names');
  passed++;
}

// TEST 10: Gravitron / Assisted Pull-up & Dip Inverse Counterweight Progression
{
  const assistedPullUp = {
    id: 'assisted-pull-up',
    name: 'Assisted Pull-up',
    muscleGroup: 'Back',
    sets: 3,
    targetRepRange: '8-12',
    recommendedWeight: 30,
    weightIncrement: 2.5,
  };

  const recProgress = recommendWeight(assistedPullUp, [
    { weight: 30, reps: 12 },
    { weight: 30, reps: 12 },
    { weight: 30, reps: 12 },
  ]);
  assert.strictEqual(recProgress.recommendedWeight, 27.5);
  assert.strictEqual(recProgress.recommendedReps, 8);
  assert.strictEqual(recProgress.recommendationReason, 'increase');

  const recDeload = recommendWeight(assistedPullUp, [
    { weight: 30, reps: 5 },
    { weight: 30, reps: 5 },
    { weight: 30, reps: 4 },
  ]);
  assert.strictEqual(recDeload.recommendedWeight, 32.5);
  assert.strictEqual(recDeload.recommendedReps, 8);
  assert.strictEqual(recDeload.recommendationReason, 'reduce');

  console.log('✅ TEST 10 PASSED: Gravitron / Assisted exercises reduce counterweight on progression (30 -> 27.5kg) and increase on fatigue');
  passed++;
}

// TEST 11: Screen & Service Integration Contracts
{
  const homeSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
  const previewSource = fs.readFileSync(path.join(__dirname, '..', 'app', 'workout', 'preview.tsx'), 'utf8');
  const notifSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'notificationService.ts'), 'utf8');

  assert.ok(!homeSource.includes("'/workout/rest'"), 'Home screen must never route to blocking /workout/rest');
  assert.ok(!previewSource.includes("'/workout/rest'"), 'Preview screen must never route to blocking /workout/rest');
  assert.ok(notifSource.includes("screen: '/workout/active'"), 'Rest timer notification must route to /workout/active');

  console.log('✅ TEST 11 PASSED: Screen routing & notification target contracts verified');
  passed++;
}

console.log(`\n🎉 ALL ${passed} REAL-MODULE ADAPTIVE PROGRESSION ENGINE TESTS PASSED!\n`);

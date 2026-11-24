/**
 * SPOT 2.0 "Gym Floor Pro" Real-Module Verification Suite
 * Directly transpiles and executes actual TypeScript domain modules:
 * - lib/plateCalculator.ts
 * - lib/warmupGenerator.ts
 * - lib/strengthStandards.ts
 * - lib/csvImporter.ts
 * - lib/adaptiveProgression.ts (isPerHandExercise / isBarbellExercise)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const moduleCache = new Map();

function loadTsModule(relPath) {
  const fullPath = path.resolve(ROOT, relPath);
  if (moduleCache.has(fullPath)) return moduleCache.get(fullPath).exports;

  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: fullPath,
  });

  const mod = { exports: {} };
  moduleCache.set(fullPath, mod);

  const localRequire = (specifier) => {
    if (specifier.startsWith('@/')) {
      const targetRel = specifier.slice(2);
      const candidates = [
        targetRel + '.ts',
        targetRel + '.tsx',
        path.join(targetRel, 'index.ts'),
      ];
      for (const c of candidates) {
        if (fs.existsSync(path.resolve(ROOT, c))) {
          return loadTsModule(c);
        }
      }
      // Minimal stub for non-domain RN/store modules if referenced only by type
      return {};
    }
    if (specifier.startsWith('.')) {
      const dir = path.dirname(fullPath);
      const base = path.resolve(dir, specifier);
      for (const ext of ['.ts', '.tsx', '.js']) {
        if (fs.existsSync(base + ext)) {
          return loadTsModule(path.relative(ROOT, base + ext));
        }
      }
    }
    return require(specifier);
  };

  const fn = vm.runInThisContext(
    `(function(exports, require, module, __filename, __dirname) {\n${transpiled.outputText}\n})`,
    { filename: fullPath }
  );
  fn(mod.exports, localRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

console.log('\n--- Running SPOT 2.0 Gym Floor Pro Verification Suite ---\n');

const plateCalc = loadTsModule('lib/plateCalculator.ts');
const warmupGen = loadTsModule('lib/warmupGenerator.ts');
const strengthStd = loadTsModule('lib/strengthStandards.ts');
const csvImporter = loadTsModule('lib/csvImporter.ts');
const adaptive = loadTsModule('lib/adaptiveProgression.ts');

let passed = 0;

// TEST 1: Plate Calculator (KG exact, remainder, bar_only, below_bar, LBS)
{
  // 87.5 kg on 20 kg bar -> 33.75 kg/side -> 25 + 5 + 2.5 + 1.25
  const r1 = plateCalc.calculateBarbellPlates(87.5, 'kg', 20);
  assert.strictEqual(r1.status, 'loaded');
  assert.strictEqual(r1.achievableTotal, 87.5);
  assert.strictEqual(r1.remainderPerSide, 0);
  assert.deepStrictEqual(
    r1.perSide.map((p) => `${p.count}x${p.weight}`),
    ['1x25', '1x5', '1x2.5', '1x1.25']
  );

  // 100 kg on 20 kg bar -> 40 kg/side -> 25 + 15
  const r2 = plateCalc.calculateBarbellPlates(100, 'kg', 20);
  assert.strictEqual(r2.achievableTotal, 100);
  assert.deepStrictEqual(
    r2.perSide.map((p) => `${p.count}x${p.weight}`),
    ['1x25', '1x15']
  );

  // 225 lbs on 45 lb bar -> 90 lb/side -> 2x45
  const rLbs = plateCalc.calculateBarbellPlates(225, 'lbs', 45);
  assert.strictEqual(rLbs.status, 'loaded');
  assert.strictEqual(rLbs.achievableTotal, 225);
  assert.deepStrictEqual(
    rLbs.perSide.map((p) => `${p.count}x${p.weight}`),
    ['2x45']
  );

  // Bar only & below bar edge cases
  assert.strictEqual(plateCalc.calculateBarbellPlates(20, 'kg', 20).status, 'bar_only');
  assert.strictEqual(plateCalc.calculateBarbellPlates(15, 'kg', 20).status, 'below_bar');
  assert.strictEqual(plateCalc.calculateBarbellPlates(0, 'kg', 20).status, 'invalid');

  // Non-exact target weight reports accurate remainder
  const rOdd = plateCalc.calculateBarbellPlates(81, 'kg', 20); // 30.5/side -> 25+5=30, rem=0.5
  assert.strictEqual(rOdd.achievableTotal, 80);
  assert.strictEqual(rOdd.remainderPerSide, 0.5);

  console.log('✅ TEST 1 PASSED: Barbell Plate Calculator solves KG, LBS, bar-only, below-bar, and remainders accurately');
  passed++;
}

// TEST 2: Warmup Generator (heavy barbell, light barbell floor, dumbbells, bodyweight)
{
  // 100 kg Squat -> 3 strictly ascending ramp sets, all >= 20 kg and < 100 kg
  const w1 = warmupGen.buildWarmupPlan({
    workingWeightKg: 100,
    equipment: 'barbell',
    exerciseName: 'Barbell Squat',
    exerciseIndex: 0,
  });
  assert.strictEqual(w1.length, 3);
  assert.ok(w1[0].weight >= 20 && w1[0].weight < w1[1].weight && w1[1].weight < w1[2].weight && w1[2].weight < 100);
  assert.deepStrictEqual(w1.map((s) => s.reps), [8, 5, 2]);

  // 30 kg Barbell Overhead Press -> floored at 20 kg empty bar, deduplicated (never two 20 kg sets!)
  const w2 = warmupGen.buildWarmupPlan({
    workingWeightKg: 30,
    equipment: 'barbell',
    exerciseName: 'Overhead Press',
    exerciseIndex: 1,
  });
  assert.ok(w2.length >= 1 && w2.length <= 2);
  assert.ok(w2.every((s) => s.weight >= 20 && s.weight < 30));
  if (w2.length === 2) assert.ok(w2[0].weight < w2[1].weight);

  // Bodyweight -> single 0 kg activation set
  const w3 = warmupGen.buildWarmupPlan({
    workingWeightKg: 0,
    equipment: 'bodyweight',
    exerciseName: 'Pull-Up',
    exerciseIndex: 2,
  });
  assert.strictEqual(w3.length, 1);
  assert.strictEqual(w3[0].weight, 0);

  // Generated WorkoutSets have setType: 'warmup' and completed: false
  const sets = warmupGen.createWarmupWorkoutSets({
    workingWeightKg: 80,
    equipment: 'barbell',
    exerciseName: 'Bench Press',
    exerciseIndex: 0,
  });
  assert.ok(sets.every((s) => s.setType === 'warmup' && s.completed === false));

  console.log('✅ TEST 2 PASSED: 1-Tap Warm-up Generator respects barbell floor, deduplication, and equipment scaling');
  passed++;
}

// TEST 3: Strength Standards (male vs female, rank boundaries, next-rank delta, profile score)
{
  // 80 kg male with 100 kg Bench Press 1RM -> ratio 1.25 -> Intermediate (1.0..1.35)
  const benchMale = strengthStd.evaluateLiftStandard({
    exerciseName: 'Bench Press',
    estimated1RMKg: 100,
    bodyweightKg: 80,
    sex: 'male',
  });
  assert.ok(benchMale);
  assert.strictEqual(benchMale.rank.key, 'intermediate');
  assert.strictEqual(benchMale.nextRank.key, 'advanced');
  assert.strictEqual(benchMale.kgToNextRank, 8); // 1.35 * 80 = 108 -> +8 kg

  // 60 kg female with 65 kg Bench Press 1RM -> ratio 1.083 -> Elite (>= 1.05)
  const benchFemale = strengthStd.evaluateLiftStandard({
    exerciseName: 'Bench Press',
    estimated1RMKg: 65,
    bodyweightKg: 60,
    sex: 'female',
  });
  assert.ok(benchFemale);
  assert.strictEqual(benchFemale.rank.key, 'elite');
  assert.strictEqual(benchFemale.nextRank, null);
  assert.strictEqual(benchFemale.kgToNextRank, 0);

  // Unknown isolation exercise returns null cleanly
  assert.strictEqual(
    strengthStd.evaluateLiftStandard({
      exerciseName: 'Cable Wrist Curl',
      estimated1RMKg: 25,
      bodyweightKg: 80,
      sex: 'male',
    }),
    null
  );

  // Overall Strength Profile aggregates cleanly
  const profile = strengthStd.evaluateStrengthProfile(
    [
      { id: '1', exerciseId: 'bp', exerciseName: 'Bench Press', weightKg: 90, reps: 5, estimated1RMKg: 105, isBodyweight: false, isAssisted: false, isNewPr: true },
      { id: '2', exerciseId: 'sq', exerciseName: 'Barbell Squat', weightKg: 120, reps: 5, estimated1RMKg: 140, isBodyweight: false, isAssisted: false, isNewPr: true },
    ],
    80,
    'male'
  );
  assert.ok(profile && profile.evaluatedLifts.length === 2);
  assert.ok(profile.overallScore > 40 && profile.overallScore <= 100);

  console.log('✅ TEST 3 PASSED: Strength Standards accurately rank male/female lifts and compute next-rank deltas');
  passed++;
}

// TEST 4: Equipment Helpers (isPerHandExercise & isBarbellExercise)
{
  assert.strictEqual(adaptive.isPerHandExercise('Incline Dumbbell Press', 'dumbbells'), true);
  assert.strictEqual(adaptive.isPerHandExercise('Lateral Raise', 'dumbbells'), true);
  assert.strictEqual(adaptive.isPerHandExercise('Single-Arm Cable Row', 'machines'), true);
  assert.strictEqual(adaptive.isPerHandExercise('Goblet Squat', 'dumbbells'), false);
  assert.strictEqual(adaptive.isPerHandExercise('Bench Press', 'barbell'), false);

  assert.strictEqual(adaptive.isBarbellExercise('Bench Press', 'barbell'), true);
  assert.strictEqual(adaptive.isBarbellExercise('Barbell Squat', 'barbell'), true);
  assert.strictEqual(adaptive.isBarbellExercise('Incline Dumbbell Press', 'dumbbells'), false);
  assert.strictEqual(adaptive.isBarbellExercise('Lat Pulldown', 'machines'), false);

  console.log('✅ TEST 4 PASSED: Per-hand dumbbell/unilateral & barbell exercise classification verified');
  passed++;
}

// TEST 5: Hevy & Strong CSV Importer + Deduplication
{
  const hevyCsv = [
    'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
    '"Upper A, Heavy",2026-11-20 18:00:00,2026-11-20 18:55:00,,Bench Press (Barbell),,,0,warmup,40,8,,,',
    '"Upper A, Heavy",2026-11-20 18:00:00,2026-11-20 18:55:00,,Bench Press (Barbell),,,1,normal,80,8,,,8',
    '"Upper A, Heavy",2026-11-20 18:00:00,2026-11-20 18:55:00,,Bench Press (Barbell),,,2,failure,80,7,,,10',
    '"Upper A, Heavy",2026-11-20 18:00:00,2026-11-20 18:55:00,,Lat Pulldown,,,0,normal,65,10,,,',
  ].join('\n');

  const hevyRes = csvImporter.parseWorkoutHistoryCsv(hevyCsv);
  assert.strictEqual(hevyRes.success, true);
  assert.strictEqual(hevyRes.source, 'hevy');
  assert.strictEqual(hevyRes.importedWorkoutsCount, 1);
  assert.strictEqual(hevyRes.importedSetsCount, 4);
  const hw = hevyRes.workouts[0];
  assert.strictEqual(hw.workoutName, 'Upper A, Heavy');
  assert.strictEqual(hw.exercises[0].exerciseName, 'Bench Press');
  assert.strictEqual(hw.exercises[0].muscleGroup, 'Chest');
  assert.strictEqual(hw.exercises[0].sets[0].setType, 'warmup');
  assert.strictEqual(hw.exercises[0].sets[1].rir, 2); // RPE 8 -> 2 RIR
  // Warmup (40*8=320) excluded from working totalVolume: 80*8 + 80*7 + 65*10 = 640 + 560 + 650 = 1850
  assert.strictEqual(hw.totalVolume, 1850);

  const strongCsv = [
    'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
    '2026-11-18 10:00:00,Lower Strength,1h 5m,Squat (Barbell),W,60,8,,,,,',
    '2026-11-18 10:00:00,Lower Strength,1h 5m,Squat (Barbell),1,100,5,,,,,9',
    '2026-11-18 10:00:00,Lower Strength,1h 5m,Romanian Deadlift (Barbell),1,90,8,,,,,',
  ].join('\n');

  const strongRes = csvImporter.parseWorkoutHistoryCsv(strongCsv, 'kg');
  assert.strictEqual(strongRes.success, true);
  assert.strictEqual(strongRes.source, 'strong');
  assert.strictEqual(strongRes.importedWorkoutsCount, 1);
  assert.strictEqual(strongRes.workouts[0].durationSeconds, 3900);
  assert.strictEqual(strongRes.workouts[0].totalVolume, 100 * 5 + 90 * 8);

  // Deduplication prevents double-importing the same workout
  const merge1 = csvImporter.mergeImportedWorkouts([], hevyRes.workouts);
  assert.strictEqual(merge1.newlyAdded, 1);
  const merge2 = csvImporter.mergeImportedWorkouts(merge1.merged, hevyRes.workouts);
  assert.strictEqual(merge2.newlyAdded, 0);
  assert.strictEqual(merge2.merged.length, 1);

  // Invalid CSV fails gracefully
  const badRes = csvImporter.parseWorkoutHistoryCsv('foo,bar\n1,2');
  assert.strictEqual(badRes.success, false);

  console.log('✅ TEST 5 PASSED: Hevy & Strong CSV importer parses quoted fields, set types, RPE->RIR, and deduplicates cleanly');
  passed++;
}

console.log(`\n🎉 ALL ${passed} GYM FLOOR PRO ENGINE TESTS PASSED!\n`);

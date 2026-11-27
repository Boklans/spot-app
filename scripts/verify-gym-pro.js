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
const { loadTsModule } = require('./tsRunner');

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
  assert.strictEqual(hw.exercises[0].exerciseName, 'Barbell Bench Press');
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

  // European semicolon-delimited Strong CSV export (P2-05)
  const euStrongCsv = [
    'Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE',
    '2026-11-19 11:00:00;Upper EU;45m;Bench Press (Barbell);1;85;8;;;;;8',
  ].join('\n');
  const euRes = csvImporter.parseWorkoutHistoryCsv(euStrongCsv, 'kg');
  assert.strictEqual(euRes.success, true);
  assert.strictEqual(euRes.workouts[0].exercises[0].exerciseName, 'Barbell Bench Press');
  assert.strictEqual(euRes.workouts[0].totalVolume, 85 * 8);

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

// TEST 6 (P0-04): Canonical Exercise Registry, Cross-Catalog Identity & Ukrainian Translation Precision
{
  const exercisesMod = loadTsModule('lib/exercises.ts');
  const libraryMod = loadTsModule('lib/exerciseLibrary.ts');
  const catalogMod = loadTsModule('lib/exerciseCatalog.ts');
  const i18nMod = loadTsModule('lib/i18n.ts');
  const prsMod = loadTsModule('lib/personalRecords.ts');
  const calcMod = loadTsModule('lib/progressCalculator.ts');
  const notesMod = loadTsModule('store/exerciseNotesStore.ts');

  const allowedCategories = new Set(['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core']);

  assert.ok(libraryMod.EXERCISE_LIBRARY.length >= 45, 'Canonical library must include full exercise roster');
  assert.strictEqual(libraryMod.EXERCISE_LIBRARY.length, catalogMod.EXERCISE_CATALOG.length);

  for (const ex of libraryMod.EXERCISE_LIBRARY) {
    assert.ok(allowedCategories.has(ex.muscleGroup), `Exercise ${ex.name} has unfilterable category ${ex.muscleGroup}`);
    const uk = i18nMod.translateExercise(ex.name, 'uk');
    assert.ok(/[а-яіїєґ]/i.test(uk), `Exercise "${ex.name}" must translate into Ukrainian Cyrillic (got "${uk}")`);
  }

  // Substring collision regression checks (FL-05)
  assert.strictEqual(i18nMod.translateExercise('Barbell Bench Press', 'uk'), 'Жим штанги лежачи');
  assert.strictEqual(i18nMod.translateExercise('Incline Barbell Bench Press', 'uk'), 'Жим штанги під кутом');
  assert.strictEqual(i18nMod.translateExercise('Standing Dumbbell Shoulder Press', 'uk'), 'Жим гантелей стоячи');
  assert.strictEqual(i18nMod.translateExercise('Dumbbell Shoulder Press', 'uk'), 'Жим гантелей сидячи');
  assert.strictEqual(i18nMod.translateExercise('Barbell Front Squat', 'uk'), 'Фронтальні присідання зі штангою');

  // Unified exercise identity across generator ("Bench Press") and picker ("Barbell Bench Press")
  assert.strictEqual(
    exercisesMod.resolveCanonicalExerciseId('Bench Press'),
    exercisesMod.resolveCanonicalExerciseId('Barbell Bench Press')
  );
  assert.strictEqual(
    exercisesMod.resolveCanonicalExerciseId('Жим штанги лежачи'),
    'barbell-bench-press'
  );
  assert.notStrictEqual(
    exercisesMod.resolveCanonicalExerciseId('Incline Barbell Bench Press'),
    exercisesMod.resolveCanonicalExerciseId('Barbell Bench Press')
  );

  // History logged under "Barbell Bench Press" matches program template "Bench Press"
  const crossHistory = [
    {
      id: 'w-hist-1',
      completedAt: '2026-11-10T10:00:00Z',
      startedAt: '2026-11-10T09:15:00Z',
      exercises: [
        {
          exerciseId: 'lib-bench-press',
          exerciseName: 'Barbell Bench Press',
          muscleGroup: 'Chest',
          sets: [
            { weight: 80, reps: 10, volume: 800, completedAt: '2026-11-10T09:20:00Z' },
            { weight: 80, reps: 10, volume: 800, completedAt: '2026-11-10T09:23:00Z' },
          ],
        },
      ],
    },
  ];
  const matchedSets = adaptive.findLatestExerciseSets(crossHistory, { id: 'bench_press', name: 'Bench Press' });
  assert.strictEqual(matchedSets.length, 2);
  assert.strictEqual(matchedSets[0].weight, 80);

  const progressMatch = calcMod.calculateExerciseProgress(crossHistory, { name: 'Bench Press' }, 'ALL', new Date('2026-11-15T10:00:00Z'));
  assert.ok(progressMatch);
  assert.strictEqual(progressMatch.historicalMaxWeight, 80);

  const prMatch = prsMod.detectPersonalRecords(
    {
      id: 'w-hist-2',
      completedAt: '2026-11-14T10:00:00Z',
      exercises: [{ exerciseId: 'upper-a-1', exerciseName: 'Bench Press', muscleGroup: 'Chest', sets: [{ weight: 82.5, reps: 10, volume: 825, completedAt: '2026-11-14T10:00:00Z' }] }],
    },
    crossHistory
  );
  assert.strictEqual(prMatch.length, 1);

  // Legacy note lookup preserved while normalizing to canonical ID
  notesMod.useExerciseNotesStore.setState({ notes: { 'bench press': 'Seat 3, medium grip' }, hydrated: true });
  assert.strictEqual(notesMod.useExerciseNotesStore.getState().getNote('Barbell Bench Press'), 'Seat 3, medium grip');

  // Missing flagship lifts now present
  assert.ok(exercisesMod.findCanonicalExercise('Hip Thrust'));
  assert.ok(exercisesMod.findCanonicalExercise('Conventional Deadlift'));
  assert.ok(exercisesMod.findCanonicalExercise('Assisted Pull-up'));
  assert.ok(exercisesMod.findCanonicalExercise('Assisted Dip'));

  console.log('✅ TEST 6 PASSED (P0-04): Canonical exercise registry unifies identity, catalogs, notes, PRs, and Ukrainian translations');
  passed++;
}

// TEST 7 (P0-08): LBS Conversions, Lossless Round-Trip Weight Saving & Notification Shade Units
{
  const weightMod = loadTsModule('lib/weightUtils.ts');
  const prsMod = loadTsModule('lib/personalRecords.ts');
  const notifMod = loadTsModule('lib/notificationService.ts');
  const profileMod = loadTsModule('store/userProfileStore.ts');
  const sessionMod = loadTsModule('store/workoutSessionStore.ts');

  // 1. Opening EditSetModal on 20 kg in LBS mode ("44" lb) and saving WITHOUT editing weight must preserve exact 20 kg (zero 19.96 kg drift!)
  const untouchedKg = weightMod.resolveSavedSetWeightKg({
    initialWeightKg: 20,
    weightText: '44',
    weightDirty: false,
    unit: 'lbs',
  });
  assert.strictEqual(untouchedKg, 20, 'Untouched weight in LBS mode must remain exact 20 kg');

  // 2. Explicitly typing 135 lbs converts cleanly to 61.24 kg (and displays back as 135 lbs)
  const editedKg = weightMod.resolveSavedSetWeightKg({
    initialWeightKg: 20,
    weightText: '135',
    weightDirty: true,
    unit: 'lbs',
  });
  assert.strictEqual(editedKg, 61.24);
  assert.strictEqual(weightMod.convertWeightToActiveUnit(editedKg, 'lbs'), 135);

  // 3. Notification shade snapshot converts KG -> LBS accurately (no longer printing "61.23 lbs"!)
  profileMod.useUserProfileStore.setState({
    profile: { ...profileMod.useUserProfileStore.getState().profile, weightUnit: 'lbs', language: 'en' },
    hydrated: true,
  });
  sessionMod.useWorkoutSessionStore.setState({
    session: {
      id: 'sess-lbs-shade',
      programWorkoutId: 'upper-a',
      workoutName: 'Upper Body A',
      startedAt: new Date().toISOString(),
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      completed: false,
      personalRecords: [],
      exercises: [
        {
          id: 'barbell-bench-press',
          name: 'Barbell Bench Press',
          muscleGroup: 'Chest',
          equipment: 'barbell',
          weightIncrement: 2.5,
          restSeconds: 90,
          previousSets: [],
          recommendation: { recommendedWeight: 61.23, recommendationReason: 'maintain', source: 'history', explanation: '' },
          sets: [{ id: 's1', weight: 61.23, reps: 8, targetReps: '8-10', completed: false }],
        },
      ],
    },
    restEndsAt: null,
    restNextType: null,
    hydrated: true,
  });
  const shadeSnap = notifMod.getLiveShadeNotificationSnapshot();
  assert.ok(shadeSnap);
  assert.strictEqual(shadeSnap.weightText, '135 lbs', `Expected "135 lbs" in shade, got "${shadeSnap.weightText}"`);

  // Reset profile back to kg
  profileMod.useUserProfileStore.setState({
    profile: { ...profileMod.useUserProfileStore.getState().profile, weightUnit: 'kg', language: 'en' },
    hydrated: true,
  });

  // 4. Dynamic PR label formatting in LBS & UK (including legacy stored "kg" labels)
  const legacyPr = {
    id: 'pr-1',
    type: 'weight',
    exerciseId: 'bp',
    exerciseName: 'Barbell Bench Press',
    value: 100,
    label: '100 kg × 5',
  };
  assert.strictEqual(prsMod.formatPersonalRecordLabel(legacyPr, 'lbs', 'en'), '220.5 lb × 5');
  assert.strictEqual(prsMod.formatPersonalRecordLabel(legacyPr, 'kg', 'uk'), '100 кг × 5');

  const bwPr = {
    id: 'pr-bw',
    type: 'estimated_1rm',
    exerciseId: 'pu',
    exerciseName: 'Pull-ups',
    value: 14,
    reps: 14,
    isBodyweight: true,
    label: '14 reps',
  };
  assert.strictEqual(prsMod.formatPersonalRecordLabel(bwPr, 'kg', 'uk'), '14 повт.');

  console.log('✅ TEST 7 PASSED (P0-08): LBS conversions, lossless round-trip saves, PR labels, and OS notification shade units verified');
  passed++;
}

// ============================================================================
// TEST 8: Onboarding Split Preservation & Profile/Onboarding Cache Sync (P0-07)
// ============================================================================
(async () => {
  const workoutStoreMod = loadTsModule('store/workoutStore.ts');
  const profileMod = loadTsModule('store/userProfileStore.ts');
  const programStoreMod = loadTsModule('store/programStore.ts');
  const programGenMod = loadTsModule('lib/programGenerator.ts');
  const programMigMod = loadTsModule('lib/programMigration.ts');
  const { resetMemoryStorage, memoryAsyncStorage } = require('./tsRunner');

  resetMemoryStorage();
  workoutStoreMod.clearOnboardingCache();

  // 1. Preset split ('upper_lower') saved via setPresetProgram preserves splitType & splitPreference (no forced 'custom')
  await workoutStoreMod.saveOnboarding({
    name: 'Olena',
    sex: 'female',
    goal: 'build_muscle',
    experience: 'intermediate',
    trainingFrequency: 4,
    splitPreference: 'upper_lower',
    completed: true,
  });
  const generatedUL = programGenMod.generateProgram((await workoutStoreMod.loadOnboarding()));
  const presetProg = programMigMod.migrateGeneratedToUserProgram(generatedUL);
  await programStoreMod.useProgramStore.getState().setPresetProgram(presetProg);

  const savedProg = programStoreMod.useProgramStore.getState().program;
  const savedOb = await workoutStoreMod.loadOnboarding();
  assert.strictEqual(savedProg.splitType, 'upper_lower', 'Preset splitType must remain upper_lower, not forced custom');
  assert.strictEqual(savedOb.splitPreference, 'upper_lower', 'Onboarding splitPreference must remain upper_lower');

  // 2. Updating profile synchronizes cachedOnboarding in RAM immediately (no stale cache!)
  await profileMod.useUserProfileStore.getState().updateProfile({
    name: 'Olena K',
    goal: 'Get Stronger',
    experience: 'Advanced',
    workoutsPerWeek: 5,
    weightKg: 63.5,
  });
  const cachedAfterProfileUpdate = await workoutStoreMod.loadOnboarding();
  assert.strictEqual(cachedAfterProfileUpdate.name, 'Olena K');
  assert.strictEqual(cachedAfterProfileUpdate.goal, 'get_stronger');
  assert.strictEqual(cachedAfterProfileUpdate.experience, 'advanced');
  assert.strictEqual(cachedAfterProfileUpdate.trainingFrequency, 5);
  assert.strictEqual(cachedAfterProfileUpdate.weightKg, 63.5);

  // 3. Clearing onboarding cache + removing AsyncStorage key leaves zero ghost RAM state
  await memoryAsyncStorage.removeItem('spot-onboarding');
  workoutStoreMod.clearOnboardingCache();
  const afterReset = await workoutStoreMod.loadOnboarding();
  assert.strictEqual(afterReset, null, 'Deleted onboarding must not leak from cachedOnboarding RAM');

  console.log('✅ TEST 8 PASSED (P0-07): Preset onboarding split preserved & profile/onboarding RAM cache stays 100% synchronized');
  passed++;

  // ============================================================================
  // TEST 9: Cold-Kill Notification Action Hydration & Silent Boot Reminders (P0-10)
  // ============================================================================
  {
    const notifMod = loadTsModule('lib/notificationService.ts');
    const sessionMod = loadTsModule('store/workoutSessionStore.ts');
    const { notificationsState, resetNotificationsMock } = require('./tsRunner');

    // 1. Simulate cold-killed app: initialize a real session so it persists to AsyncStorage, then clear RAM store (session: null, hydrated: false)
    await sessionMod.useWorkoutSessionStore.getState().initializeSession();
    // Flush microtasks so serialized AsyncStorage persistence completes
    await new Promise((r) => setTimeout(r, 20));
    const storedRaw = await memoryAsyncStorage.getItem('spot_active_workout_session');
    assert.ok(storedRaw, 'Active workout session must be persisted in AsyncStorage');

    sessionMod.useWorkoutSessionStore.setState({ session: null, restEndsAt: null, hydrated: false });

    // User taps "Complete Set" in the OS notification shade from cold-killed state!
    await notifMod.handleNotificationAction(notifMod.ACTION_COMPLETE_SET, {});

    const hydratedAfterTap = sessionMod.useWorkoutSessionStore.getState();
    assert.strictEqual(hydratedAfterTap.hydrated, true, 'Notification action must hydrate session on cold start');
    assert.ok(hydratedAfterTap.session, 'Cold-start notification action must load persisted session');
    assert.strictEqual(
      hydratedAfterTap.session.exercises[0].sets[0].completed,
      true,
      'Cold-start ACTION_COMPLETE_SET must complete set 1 instead of dropping the tap'
    );
    assert.strictEqual(hydratedAfterTap.session.currentSetIndex, 1);

    // 2. Cold-boot scheduleWorkoutDayReminders({ promptIfNeeded: false }) must NOT schedule or hijack when permissions are undetermined
    resetNotificationsMock();
    notificationsState.permissionsGranted = false;
    await notifMod.scheduleWorkoutDayReminders({ promptIfNeeded: false });
    assert.strictEqual(
      notificationsState.scheduled.length,
      0,
      'Cold-boot reminder check must not schedule when OS permission is not yet granted'
    );
    resetNotificationsMock();

    console.log('✅ TEST 9 PASSED (P0-10): Cold-kill notification actions hydrate session & boot reminder check avoids OS permission hijack');
    passed++;
  }

  // ============================================================================
  // TEST 10: Superset Rest Transitions, Warm-up Superset Isolation & Timer Clamping (P1-01, P1-02)
  // ============================================================================
  {
    const sessionMod = loadTsModule('store/workoutSessionStore.ts');

    const supersetExercises = [
      {
        id: 'ex-a1',
        name: 'Barbell Bench Press',
        muscleGroup: 'Chest',
        equipment: 'barbell',
        weightIncrement: 2.5,
        restSeconds: 0,
        supersetWithNext: true,
        previousSets: [],
        recommendation: { recommendedWeight: 80, recommendationReason: 'maintain', source: 'program_default', explanation: '' },
        sets: [
          { id: 'w1', weight: 40, reps: 8, targetReps: '8', completed: false, setType: 'warmup' },
          { id: 's1', weight: 80, reps: 8, targetReps: '8-10', completed: false, setType: 'normal' },
          { id: 's2', weight: 80, reps: 8, targetReps: '8-10', completed: false, setType: 'normal' },
        ],
      },
      {
        id: 'ex-a2',
        name: 'Barbell Row',
        muscleGroup: 'Back',
        equipment: 'barbell',
        weightIncrement: 2.5,
        restSeconds: 90,
        supersetWithNext: false,
        previousSets: [],
        recommendation: { recommendedWeight: 70, recommendationReason: 'maintain', source: 'program_default', explanation: '' },
        sets: [
          { id: 'r1', weight: 70, reps: 10, targetReps: '8-12', completed: false, setType: 'normal' },
          { id: 'r2', weight: 70, reps: 10, targetReps: '8-12', completed: false, setType: 'normal' },
        ],
      },
    ];

    assert.strictEqual(sessionMod.getSupersetBadgeLabel(supersetExercises, 0), 'A1');
    assert.strictEqual(sessionMod.getSupersetBadgeLabel(supersetExercises, 1), 'A2');

    sessionMod.useWorkoutSessionStore.setState({
      session: {
        id: 'sess-superset',
        programWorkoutId: 'upper-ss',
        workoutName: 'Upper Superset',
        startedAt: new Date().toISOString(),
        currentExerciseIndex: 0,
        currentSetIndex: 0,
        completed: false,
        personalRecords: [],
        exercises: supersetExercises,
      },
      restEndsAt: null,
      restTotalSeconds: 0,
      restNextType: null,
      hydrated: true,
    });

    // 1. Completing warmup set w1 on A1 must stay on A1 (set index 1) and NOT jump to A2!
    sessionMod.useWorkoutSessionStore.getState().toggleSetCompletion(0, 0);
    let st = sessionMod.useWorkoutSessionStore.getState();
    assert.strictEqual(st.session.currentExerciseIndex, 0, 'Warmup set on A1 must stay on A1');
    assert.strictEqual(st.session.currentSetIndex, 1);

    // 2. Completing working set s1 on A1 (restSeconds: 0) jumps to A2 (exercise 1, set 0) with 0s rest!
    sessionMod.useWorkoutSessionStore.getState().toggleSetCompletion(0, 1);
    st = sessionMod.useWorkoutSessionStore.getState();
    assert.strictEqual(st.session.currentExerciseIndex, 1, 'Working set on A1 must alternate to A2');
    assert.strictEqual(st.session.currentSetIndex, 0);
    assert.strictEqual(st.restEndsAt, null, 'A1 -> A2 transition with 0s rest must have restEndsAt === null');

    // 3. Completing working set r1 on A2 (restSeconds: 90) jumps back to A1 (exercise 0, set 2) with A2's 90s round rest!
    sessionMod.useWorkoutSessionStore.getState().toggleSetCompletion(1, 0);
    st = sessionMod.useWorkoutSessionStore.getState();
    assert.strictEqual(st.session.currentExerciseIndex, 0, 'Working set on A2 must return to A1 next round');
    assert.strictEqual(st.session.currentSetIndex, 2);
    assert.strictEqual(st.restTotalSeconds, 90, 'A2 -> A1 round transition must use A2 restSeconds (90s), not A1 0s!');
    assert.ok(st.restEndsAt && st.restEndsAt > Date.now() + 80000);

    // 4. Subtracting -15s when only 10s remain clears rest cleanly (restEndsAt === null)
    sessionMod.useWorkoutSessionStore.setState({ restEndsAt: Date.now() + 10000, restTotalSeconds: 60 });
    sessionMod.useWorkoutSessionStore.getState().addRestTime(-15);
    st = sessionMod.useWorkoutSessionStore.getState();
    assert.strictEqual(st.restEndsAt, null, 'addRestTime(-15) with 10s left must clear restEndsAt cleanly');
    assert.strictEqual(st.restTotalSeconds, 0);

    console.log('✅ TEST 10 PASSED (P1-01 & P1-02): Superset A1/A2 transitions, warmup isolation, and rest timer clamping verified');
    passed++;
  }

  // ============================================================================
  // TEST 11: 360-Combination Program Generator Matrix & Local Date Keys (P1-03, P1-04)
  // ============================================================================
  {
    const dateMod = loadTsModule('lib/dateUtils.ts');
    const exercisesMod = loadTsModule('lib/exercises.ts');

    // Local date round-trip without UTC shift
    const localSample = new Date(2026, 10, 27, 0, 30, 0); // 00:30 local time (would be Nov 26 in UTC+2!)
    const key = dateMod.toLocalDateKey(localSample);
    assert.strictEqual(key, '2026-11-27', '00:30 local time must stay 2026-11-27 in local date key');
    const parsedBack = dateMod.parseLocalDateKey(key);
    assert.strictEqual(parsedBack.getFullYear(), 2026);
    assert.strictEqual(parsedBack.getMonth(), 10);
    assert.strictEqual(parsedBack.getDate(), 27);

    // 360-combination generator matrix: 2 sexes x 4 goals x 3 experiences x 5 equipment presets x 3 splits
    const sexes = ['male', 'female'];
    const goals = ['build_muscle', 'get_stronger', 'lose_fat', 'recomposition'];
    const experiences = ['beginner', 'intermediate', 'advanced'];
    const equipmentPresets = [
      ['full_gym'],
      ['dumbbells', 'bodyweight'],
      ['barbell', 'dumbbells', 'bodyweight'],
      ['bodyweight'],
      ['machines', 'dumbbells'],
    ];
    const splits = [
      { splitPreference: 'full_body', trainingFrequency: 3 },
      { splitPreference: 'upper_lower', trainingFrequency: 4 },
      { splitPreference: 'push_pull_legs', trainingFrequency: 6 },
    ];

    const forbiddenPullPresses = new Set([
      'overhead-press',
      'dumbbell-shoulder-press',
      'standing-dumbbell-shoulder-press',
      'machine-shoulder-press',
      'arnold-press',
      'pike-push-up',
    ]);

    let combosChecked = 0;
    for (const sex of sexes) {
      for (const goal of goals) {
        for (const experience of experiences) {
          for (const equipment of equipmentPresets) {
            for (const sp of splits) {
              const prog = programGenMod.generateProgram({
                name: 'Matrix',
                sex,
                goal,
                experience,
                trainingFrequency: sp.trainingFrequency,
                splitPreference: sp.splitPreference,
                equipment,
                completed: true,
              });
              combosChecked++;
              for (const w of prog.workouts) {
                const seen = new Set();
                for (const ex of w.exercises) {
                  const cid = exercisesMod.resolveCanonicalExerciseId(ex.name) || ex.name.toLowerCase();
                  assert.ok(
                    !seen.has(cid),
                    `Duplicate exercise "${ex.name}" in workout "${w.name}" (${sex}/${goal}/${experience}/${sp.splitPreference}/[${equipment.join(',')}])`
                  );
                  seen.add(cid);

                  if (/pull/i.test(w.id) || /pull/i.test(w.name)) {
                    assert.ok(
                      !forbiddenPullPresses.has(cid),
                      `Overhead push "${ex.name}" leaked onto Pull day "${w.name}"!`
                    );
                  }
                }
              }
            }
          }
        }
      }
    }
    assert.strictEqual(combosChecked, 360);

    console.log(`✅ TEST 11 PASSED (P1-03 & P1-04): All ${combosChecked} program combinations have 0 duplicates & 0 Pull-day presses; local date keys verified`);
    passed++;
  }

  // ============================================================================
  // TEST 12: Safe Barbell Bar Weight Options & Docked WorkoutKeypadSheet Contract (P1-08, P1-09)
  // ============================================================================
  {
    const plateMod = loadTsModule('lib/plateCalculator.ts');
    const fs = require('fs');
    const path = require('path');

    // Heavy main barbell lifts must NOT offer 10 kg EZ / 25 lb EZ
    const squatBarsKg = plateMod.getBarWeightOptions('kg', 'Barbell Back Squat');
    const benchBarsLbs = plateMod.getBarWeightOptions('lbs', 'Barbell Bench Press');
    assert.ok(!squatBarsKg.some((b) => b.weight === 10), 'Squat must NOT show 10 kg EZ bar option');
    assert.ok(!benchBarsLbs.some((b) => b.weight === 25), 'Bench Press must NOT show 25 lb EZ bar option');

    // Arm / curl / skullcrusher lifts DO offer 10 kg EZ / 25 lb EZ and default to it
    const curlBarsKg = plateMod.getBarWeightOptions('kg', 'EZ-Bar Curl');
    assert.ok(curlBarsKg.some((b) => b.weight === 10), 'EZ-Bar Curl must include 10 kg EZ bar');
    assert.strictEqual(plateMod.getDefaultBarWeight('kg', 'EZ-Bar Curl'), 10);
    assert.strictEqual(plateMod.getDefaultBarWeight('kg', 'Barbell Back Squat'), 20);

    // WorkoutKeypadSheet must contain zero OS TextInput components
    const keypadSrc = fs.readFileSync(
      path.join(__dirname, '..', 'components', 'workout', 'WorkoutKeypadSheet.tsx'),
      'utf8'
    );
    assert.ok(!keypadSrc.includes('<TextInput'), 'WorkoutKeypadSheet must never summon OS keyboard via <TextInput>');

    console.log('✅ TEST 12 PASSED (P1-08 & P1-09): Barbell EZ-bar safety guard & zero-OS-keyboard WorkoutKeypadSheet verified');
    passed++;
  }

  // ============================================================================
  // TEST 13: Unified ExercisePicker, 64pt Accordion Editor & Virtualized HistoryFeed (P1-12, P1-13, P1-14)
  // ============================================================================
  {
    const fs = require('fs');
    const path = require('path');

    const pickerSrc = fs.readFileSync(
      path.join(__dirname, '..', 'components', 'program', 'ExercisePickerModal.tsx'),
      'utf8'
    );
    assert.ok(pickerSrc.includes('EQUIPMENT_FILTERS'), 'ExercisePickerModal must provide equipment filtering');
    assert.ok(pickerSrc.includes('onSelectMultiple'), 'ExercisePickerModal must support multi-select batch adding');
    assert.ok(pickerSrc.includes('deleteCustomExercise'), 'ExercisePickerModal must support custom exercise deletion');

    const accordionSrc = fs.readFileSync(
      path.join(__dirname, '..', 'components', 'program', 'WorkoutDayEditor.tsx'),
      'utf8'
    );
    assert.ok(accordionSrc.includes('minHeight: 64'), 'WorkoutDayEditor must render 64pt collapsed accordion rows');

    const historyFeedSrc = fs.readFileSync(
      path.join(__dirname, '..', 'components', 'history', 'HistoryFeed.tsx'),
      'utf8'
    );
    assert.ok(historyFeedSrc.includes('<SectionList'), 'HistoryFeed must use virtualized <SectionList>');
    assert.ok(!historyFeedSrc.includes('deleteWorkout('), 'HistoryFeed cards must not expose accidental 2-tap delete button');

    const progressSrc = fs.readFileSync(
      path.join(__dirname, '..', 'app', '(tabs)', 'progress.tsx'),
      'utf8'
    );
    assert.ok(progressSrc.includes('<HistoryFeed'), 'Progress tab must promote virtualized HistoryFeed');

    console.log('✅ TEST 13 PASSED (P1-12, P1-13, P1-14): Unified ExercisePicker, 64pt Accordion Editor & Virtualized HistoryFeed verified');
    passed++;
  }

  console.log(`\n🎉 ALL ${passed} GYM FLOOR PRO ENGINE TESTS PASSED!\n`);
})().catch((err) => {
  console.error('❌ Async test failure in verify-gym-pro.js:', err);
  process.exit(1);
});

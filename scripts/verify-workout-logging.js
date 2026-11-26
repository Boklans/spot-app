/**
 * SPOT 2.0 Real-Module Workout Logging, PR Detection & Finalization Suite
 * Executes actual production TypeScript modules:
 * - store/workoutSessionStore.ts
 * - lib/completedWorkout.ts
 * - lib/personalRecords.ts
 * - lib/progressCalculator.ts
 * - lib/workoutFinalizer.ts
 */
const assert = require('assert');
const { loadTsModule, resetMemoryStorage } = require('./tsRunner');

const { useWorkoutSessionStore, ACTIVE_WORKOUT_SESSION_STORAGE_KEY } = loadTsModule('store/workoutSessionStore.ts');
const { createCompletedWorkoutSnapshot } = loadTsModule('lib/completedWorkout.ts');
const { detectPersonalRecords, getAllTimePersonalRecords } = loadTsModule('lib/personalRecords.ts');
const { normalizeMuscleCategory } = loadTsModule('lib/progressCalculator.ts');
const { finalizeWorkoutSession } = loadTsModule('lib/workoutFinalizer.ts');
const { useWorkoutHistoryStore } = loadTsModule('store/workoutHistoryStore.ts');
const { useProgramStore } = loadTsModule('store/programStore.ts');
const { useProgramProgressStore } = loadTsModule('store/programProgressStore.ts');

function createMockSession() {
  const startedAt = new Date(Date.now() - 1000 * 60 * 15).toISOString();
  return {
    id: 'test-session-1',
    programWorkoutId: 'workout-push-a',
    workoutName: 'Push A',
    workoutDate: startedAt.slice(0, 10),
    startedAt,
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    completed: false,
    personalRecords: [],
    exercises: [
      {
        id: 'ex-1',
        name: 'Barbell Bench Press',
        muscleGroup: 'Chest',
        equipment: 'barbell',
        weightIncrement: 2.5,
        restSeconds: 90,
        previousSets: [{ weight: 55, reps: 8 }],
        recommendation: {
          recommendedWeight: 57.5,
          recommendationReason: 'increase',
          source: 'history',
          explanation: 'Progressive overload',
        },
        sets: [
          { id: 's1', weight: 57.5, reps: 8, targetReps: '8-12', completed: false },
          { id: 's2', weight: 57.5, reps: 8, targetReps: '8-12', completed: false },
          { id: 's3', weight: 57.5, reps: 8, targetReps: '8-12', completed: false },
        ],
      },
    ],
  };
}

function createMock12SetSession() {
  const startedAt = new Date(Date.now() - 1000 * 60 * 20).toISOString();
  const makeEx = (id, name, muscleGroup, weight) => ({
    id,
    name,
    muscleGroup,
    equipment: 'barbell',
    weightIncrement: 2.5,
    restSeconds: 90,
    previousSets: [],
    recommendation: {
      recommendedWeight: weight,
      recommendationReason: 'maintain',
      source: 'program_default',
      explanation: '',
    },
    sets: [
      { id: `${id}-s1`, weight, reps: 8, targetReps: '8-12', completed: false },
      { id: `${id}-s2`, weight, reps: 8, targetReps: '8-12', completed: false },
      { id: `${id}-s3`, weight, reps: 8, targetReps: '8-12', completed: false },
    ],
  });

  return {
    id: 'session-12-sets',
    programWorkoutId: 'upper-a',
    workoutName: 'Upper A',
    workoutDate: startedAt.slice(0, 10),
    startedAt,
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    completed: false,
    personalRecords: [],
    exercises: [
      makeEx('ex-1', 'Bench Press', 'Chest', 40),
      makeEx('ex-2', 'Barbell Row', 'Back', 40),
      makeEx('ex-3', 'Overhead Press', 'Shoulders', 25),
      makeEx('ex-4', 'Barbell Curl', 'Biceps', 20),
    ],
  };
}

function seedSession(session) {
  resetMemoryStorage();
  useWorkoutSessionStore.setState({
    session,
    restEndsAt: null,
    restNextType: null,
    hydrated: true,
  });
}

(async () => {
  console.log('--- Running Real-Module Workout Logging & Integrity Tests ---\n');
  let passedTests = 0;

  // Test 1: Completing a set once via real store
  {
    seedSession(createMockSession());
    useWorkoutSessionStore.getState().completeCurrentSet();
    const state = useWorkoutSessionStore.getState();

    assert.strictEqual(state.session.exercises[0].sets[0].completed, true);
    assert.ok(typeof state.session.exercises[0].sets[0].completedAt === 'string');
    assert.strictEqual(state.session.currentSetIndex, 1);
    assert.ok(state.restEndsAt > Date.now());
    assert.strictEqual(state.restNextType, 'set');
    console.log('✅ TEST 1 PASSED: Completing a set once transitions real store state and advances set');
    passedTests++;
  }

  // Test 2: Rapid double-tap / subsequent edit preserves timestamp
  {
    seedSession(createMockSession());
    useWorkoutSessionStore.getState().completeCurrentSet();
    const completedTimestamp1 = useWorkoutSessionStore.getState().session.exercises[0].sets[0].completedAt;

    useWorkoutSessionStore.getState().updateSet(0, 0, { weight: 60 });
    const state = useWorkoutSessionStore.getState();
    assert.strictEqual(state.session.currentSetIndex, 1);
    assert.strictEqual(state.session.exercises[0].sets[0].completedAt, completedTimestamp1);
    console.log('✅ TEST 2 PASSED: Editing a completed set retains set index and completedAt timestamp');
    passedTests++;
  }

  // Test 3: Editing active uncompleted set with propagate=false
  {
    seedSession(createMockSession());
    useWorkoutSessionStore.getState().updateSet(0, 0, { weight: 60, reps: 10 }, false);
    const state = useWorkoutSessionStore.getState();

    assert.strictEqual(state.session.exercises[0].sets[0].weight, 60);
    assert.strictEqual(state.session.exercises[0].sets[0].reps, 10);
    assert.strictEqual(state.session.exercises[0].sets[1].weight, 57.5);
    assert.strictEqual(state.session.exercises[0].sets[1].reps, 8);
    console.log('✅ TEST 3 PASSED: Editing active uncompleted set with propagate=false modifies target set only');
    passedTests++;
  }

  // Test 4: Explicit forward propagation on uncompleted sets
  {
    seedSession(createMockSession());
    useWorkoutSessionStore.getState().updateSet(0, 0, { weight: 62.5, reps: 10 }, true);
    const state = useWorkoutSessionStore.getState();

    assert.strictEqual(state.session.exercises[0].sets[0].weight, 62.5);
    assert.strictEqual(state.session.exercises[0].sets[1].weight, 62.5);
    assert.strictEqual(state.session.exercises[0].sets[2].weight, 62.5);
    console.log('✅ TEST 4 PASSED: Explicit propagate=true propagates forward to uncompleted sets');
    passedTests++;
  }

  // Test 5: Editing a completed set refuses propagation
  {
    seedSession(createMockSession());
    useWorkoutSessionStore.getState().completeCurrentSet();
    const originalCompletedAt = useWorkoutSessionStore.getState().session.exercises[0].sets[0].completedAt;

    useWorkoutSessionStore.getState().updateSet(0, 0, { weight: 65, reps: 9 }, true);
    const state = useWorkoutSessionStore.getState();
    const editedSet0 = state.session.exercises[0].sets[0];

    assert.strictEqual(editedSet0.weight, 65);
    assert.strictEqual(editedSet0.reps, 9);
    assert.strictEqual(editedSet0.completed, true);
    assert.strictEqual(editedSet0.completedAt, originalCompletedAt);
    assert.strictEqual(state.session.exercises[0].sets[1].weight, 57.5);
    console.log('✅ TEST 5 PASSED: Editing completed set preserves completion state & refuses propagation');
    passedTests++;
  }

  // Test 6: Real AsyncStorage hydration of active session & rest deadline
  {
    const futureRest = Date.now() + 45000;
    resetMemoryStorage({
      [ACTIVE_WORKOUT_SESSION_STORAGE_KEY]: {
        session: createMockSession(),
        restEndsAt: futureRest,
        restNextType: 'set',
      },
    });
    useWorkoutSessionStore.setState({ session: null, restEndsAt: null, restNextType: null, hydrated: false });
    const hydrated = await useWorkoutSessionStore.getState().hydrateSession();
    const state = useWorkoutSessionStore.getState();

    assert.strictEqual(hydrated, true);
    assert.strictEqual(state.restEndsAt, futureRest);
    assert.strictEqual(state.restNextType, 'set');
    assert.strictEqual(state.session.id, 'test-session-1');
    console.log('✅ TEST 6 PASSED: Real hydrateSession restores session & rest timer deadline from AsyncStorage');
    passedTests++;
  }

  // Test 7: Real createCompletedWorkoutSnapshot reflects edited completed set volume
  {
    seedSession(createMockSession());
    useWorkoutSessionStore.getState().completeCurrentSet();
    useWorkoutSessionStore.getState().updateSet(0, 0, { weight: 70, reps: 10 }, false);
    useWorkoutSessionStore.getState().completeCurrentSet();
    useWorkoutSessionStore.getState().completeCurrentSet();

    const state = useWorkoutSessionStore.getState();
    assert.strictEqual(state.session.completed, true);
    const snapshot = createCompletedWorkoutSnapshot(state.session);

    assert.strictEqual(snapshot.totalSets, 3);
    assert.strictEqual(snapshot.plannedSets, 3);
    assert.strictEqual(snapshot.isPartial, false);
    assert.strictEqual(snapshot.totalVolume, 1620);
    console.log('✅ TEST 7 PASSED: Real createCompletedWorkoutSnapshot computes exact volume (1620 kg)');
    passedTests++;
  }

  // Test 8: Scenario A — 0 of 12 sets completed
  {
    const snapshot = createCompletedWorkoutSnapshot(createMock12SetSession());
    assert.strictEqual(snapshot.totalSets, 0);
    assert.strictEqual(snapshot.plannedSets, 12);
    assert.strictEqual(snapshot.totalVolume, 0);
    assert.strictEqual(snapshot.exercises.length, 0);
    console.log('✅ TEST 8 PASSED (Scenario A): 0 of 12 sets yields 0 volume and 0 exercises');
    passedTests++;
  }

  // Test 9: Scenario B — 1 of 12 sets completed (real finalizeWorkoutSession does NOT advance rotation)
  {
    seedSession(createMock12SetSession());
    const prog = {
      id: 'prog-ul',
      name: 'UL',
      splitType: 'upper_lower',
      workouts: [
        { id: 'upper-a', name: 'Upper A', dayLabel: 'MON', exercises: [] },
        { id: 'lower-a', name: 'Lower A', dayLabel: 'TUE', exercises: [] },
      ],
    };
    useProgramStore.setState({ program: prog, hydrated: true, deloadActive: false });
    await useProgramProgressStore.getState().resetProgress('prog-ul', 'upper-a');
    useWorkoutHistoryStore.setState({ workouts: [], hydrated: true });

    useWorkoutSessionStore.getState().completeCurrentSet();
    const state = useWorkoutSessionStore.getState();
    assert.strictEqual(state.session.completed, false);

    const finalized = await finalizeWorkoutSession(state.session);
    assert.strictEqual(finalized.totalSets, 1);
    assert.strictEqual(finalized.isPartial, true);
    assert.strictEqual(finalized.totalVolume, 320);
    assert.strictEqual(useProgramProgressStore.getState().progress.nextWorkoutId, 'upper-a');
    console.log('✅ TEST 9 PASSED (Scenario B): Real finalizeWorkoutSession marks 1/12 partial and keeps nextWorkoutId = upper-a');
    passedTests++;
  }

  // Test 10: Scenario C/D — Out-of-order set completion does NOT auto-finish workout prematurely
  {
    const session = createMock12SetSession();
    session.currentExerciseIndex = 3;
    session.currentSetIndex = 2;
    seedSession(session);

    useWorkoutSessionStore.getState().completeCurrentSet();
    const state = useWorkoutSessionStore.getState();

    assert.strictEqual(state.session.completed, false);
    assert.strictEqual(state.session.currentExerciseIndex, 3);
    assert.strictEqual(state.session.currentSetIndex, 0);
    console.log('✅ TEST 10 PASSED (Scenario C/D): Completing last set out-of-order wraps to uncompleted set in exercise');
    passedTests++;
  }

  // Test 11: Undo set completion (toggleSetCompletion) restores uncompleted state cleanly
  {
    seedSession(createMockSession());
    useWorkoutSessionStore.getState().completeCurrentSet();
    assert.strictEqual(useWorkoutSessionStore.getState().session.exercises[0].sets[0].completed, true);

    useWorkoutSessionStore.getState().toggleSetCompletion(0, 0);
    const state = useWorkoutSessionStore.getState();
    assert.strictEqual(state.session.exercises[0].sets[0].completed, false);
    assert.strictEqual(state.session.exercises[0].sets[0].completedAt, undefined);
    assert.strictEqual(state.restEndsAt, null);
    console.log('✅ TEST 11 PASSED: Real toggleSetCompletion undoes set completion and cancels rest timer');
    passedTests++;
  }

  // Test 12: Scenario F — Full 12 of 12 sets completion advances rotation via real finalizeWorkoutSession
  {
    seedSession(createMock12SetSession());
    const prog = {
      id: 'prog-ul',
      name: 'UL',
      splitType: 'upper_lower',
      workouts: [
        { id: 'upper-a', name: 'Upper A', dayLabel: 'MON', exercises: [] },
        { id: 'lower-a', name: 'Lower A', dayLabel: 'TUE', exercises: [] },
      ],
    };
    useProgramStore.setState({ program: prog, hydrated: true, deloadActive: false });
    await useProgramProgressStore.getState().resetProgress('prog-ul', 'upper-a');
    useWorkoutHistoryStore.setState({ workouts: [], hydrated: true });

    for (let i = 0; i < 12; i++) {
      useWorkoutSessionStore.getState().completeCurrentSet();
    }
    const state = useWorkoutSessionStore.getState();
    assert.strictEqual(state.session.completed, true);

    const finalized = await finalizeWorkoutSession(state.session);
    assert.strictEqual(finalized.totalSets, 12);
    assert.strictEqual(finalized.isPartial, false);
    assert.strictEqual(useProgramProgressStore.getState().progress.nextWorkoutId, 'lower-a');
    console.log('✅ TEST 12 PASSED (Scenario F): Completing 12/12 sets marks full workout and advances nextWorkoutId to lower-a');
    passedTests++;
  }

  // Test 13: Real detectPersonalRecords — Weighted PRs & baselineLifts
  {
    const w1 = {
      id: 'w1',
      completedAt: '2026-10-01T10:00:00Z',
      exercises: [{ exerciseId: 'upper-a-1', exerciseName: 'Bench Press', muscleGroup: 'Chest', sets: [{ weight: 40, reps: 8, volume: 320, completedAt: '2026-10-01T10:00:00Z' }] }],
    };
    const prsVsBaseline = detectPersonalRecords(w1, [], { benchPressKg: 35 });
    assert.strictEqual(prsVsBaseline.length, 1);

    const w2 = {
      id: 'w2',
      completedAt: '2026-10-05T10:00:00Z',
      exercises: [{ exerciseId: 'upper-a-1', exerciseName: 'Bench Press', muscleGroup: 'Chest', sets: [{ weight: 40, reps: 9, volume: 360, completedAt: '2026-10-05T10:00:00Z' }] }],
    };
    const prsW2 = detectPersonalRecords(w2, [w1]);
    assert.strictEqual(prsW2.length, 1);
    console.log('✅ TEST 13 PASSED: Real detectPersonalRecords handles baselineLifts and rep-progression 1RM PRs');
    passedTests++;
  }

  // Test 14: Real detectPersonalRecords — Bodyweight & Assisted/Gravitron
  {
    const bw1 = {
      id: 'bw1',
      completedAt: '2026-10-01T10:00:00Z',
      exercises: [
        { exerciseId: 'pullup', exerciseName: 'Pull-Ups', muscleGroup: 'Back', sets: [{ weight: 0, reps: 8, volume: 0, completedAt: '2026-10-01T10:00:00Z' }] },
        { exerciseId: 'assist', exerciseName: 'Assisted Pull-Up (Gravitron)', muscleGroup: 'Back', sets: [{ weight: 30, reps: 8, volume: 240, completedAt: '2026-10-01T10:00:00Z' }] },
      ],
    };
    const bw2Stronger = {
      id: 'bw2',
      completedAt: '2026-10-05T10:00:00Z',
      exercises: [
        { exerciseId: 'pullup', exerciseName: 'Pull-Ups', muscleGroup: 'Back', sets: [{ weight: 0, reps: 11, volume: 0, completedAt: '2026-10-05T10:00:00Z' }] },
        { exerciseId: 'assist', exerciseName: 'Assisted Pull-Up (Gravitron)', muscleGroup: 'Back', sets: [{ weight: 25, reps: 8, volume: 200, completedAt: '2026-10-05T10:00:00Z' }] },
      ],
    };
    const bw3Weaker = {
      id: 'bw3',
      completedAt: '2026-10-08T10:00:00Z',
      exercises: [
        { exerciseId: 'assist', exerciseName: 'Assisted Pull-Up (Gravitron)', muscleGroup: 'Back', sets: [{ weight: 35, reps: 8, volume: 280, completedAt: '2026-10-08T10:00:00Z' }] },
      ],
    };

    assert.strictEqual(detectPersonalRecords(bw2Stronger, [bw1]).length, 2);
    assert.strictEqual(detectPersonalRecords(bw3Weaker, [bw1]).length, 0);
    console.log('✅ TEST 14 PASSED: Real detectPersonalRecords handles Bodyweight and Assisted counterweight PRs');
    passedTests++;
  }

  // Test 15: Positional exerciseId isolation & getAllTimePersonalRecords
  {
    const histBench = {
      id: 'h1',
      startedAt: '2026-10-01T10:00:00Z',
      completedAt: '2026-10-01T10:45:00Z',
      exercises: [{ exerciseId: 'upper-a-1', exerciseName: 'Bench Press', muscleGroup: 'Chest', sets: [{ weight: 60, reps: 10, volume: 600, completedAt: '2026-10-01T10:15:00Z' }] }],
    };
    const swappedIncline1 = {
      id: 'h2',
      startedAt: '2026-10-04T10:00:00Z',
      completedAt: '2026-10-04T10:45:00Z',
      exercises: [{ exerciseId: 'upper-a-1', exerciseName: 'Incline Dumbbell Press', muscleGroup: 'Chest', sets: [{ weight: 18, reps: 10, volume: 360, completedAt: '2026-10-04T10:15:00Z' }] }],
    };
    const swappedIncline2 = {
      id: 'h3',
      startedAt: '2026-10-08T10:00:00Z',
      completedAt: '2026-10-08T10:45:00Z',
      exercises: [{ exerciseId: 'upper-a-1', exerciseName: 'Incline Dumbbell Press', muscleGroup: 'Chest', sets: [{ weight: 20, reps: 10, volume: 400, completedAt: '2026-10-08T10:15:00Z' }] }],
    };

    const prs = detectPersonalRecords(swappedIncline2, [histBench, swappedIncline1]);
    assert.strictEqual(prs.length, 1);

    const allTime = getAllTimePersonalRecords([histBench, swappedIncline1, swappedIncline2]);
    assert.strictEqual(allTime.length, 2);
    console.log('✅ TEST 15 PASSED: Real detectPersonalRecords & getAllTimePersonalRecords isolate swapped exercises');
    passedTests++;
  }

  // Test 16: Real normalizeMuscleCategory
  {
    assert.strictEqual(normalizeMuscleCategory('Quads'), 'Legs');
    assert.strictEqual(normalizeMuscleCategory('Hamstrings'), 'Legs');
    assert.strictEqual(normalizeMuscleCategory('Glutes'), 'Legs');
    assert.strictEqual(normalizeMuscleCategory('Calves'), 'Legs');
    assert.strictEqual(normalizeMuscleCategory('Biceps'), 'Arms');
    assert.strictEqual(normalizeMuscleCategory('Triceps'), 'Arms');
    assert.strictEqual(normalizeMuscleCategory('Abs'), 'Core');
    console.log('✅ TEST 16 PASSED: Real normalizeMuscleCategory maps sub-muscles to Analytics categories');
    passedTests++;
  }

  // Test 17 (P0-01): End-to-end session creation under active Deload Week (-15%)
  {
    const prog = {
      id: 'prog-deload',
      name: 'Strength UL',
      splitType: 'upper_lower',
      daysPerWeek: 4,
      workouts: [
        {
          id: 'upper-a',
          name: 'Upper A',
          dayLabel: 'MON',
          muscleGroups: ['Chest'],
          estimatedMinutes: 45,
          exercises: [
            {
              id: 'barbell-bench-press',
              name: 'Barbell Bench Press',
              muscleGroup: 'Chest',
              equipment: 'barbell',
              sets: 3,
              recommendedWeight: 60,
              targetRepRange: '8-12',
              weightIncrement: 2.5,
            },
          ],
        },
      ],
    };
    resetMemoryStorage({
      'spot-workout-history': [
        {
          id: 'prev-1',
          programWorkoutId: 'upper-a',
          workoutName: 'Upper A',
          workoutDate: '2026-11-15',
          startedAt: '2026-11-15T10:00:00Z',
          completedAt: '2026-11-15T10:45:00Z',
          durationSeconds: 2700,
          totalSets: 3,
          plannedSets: 3,
          isPartial: false,
          totalVolume: 3000,
          exercises: [
            {
              exerciseId: 'barbell-bench-press',
              exerciseName: 'Barbell Bench Press',
              muscleGroup: 'Chest',
              sets: [
                { weight: 100, reps: 10, volume: 1000, completedAt: '2026-11-15T10:10:00Z' },
                { weight: 100, reps: 10, volume: 1000, completedAt: '2026-11-15T10:13:00Z' },
                { weight: 100, reps: 10, volume: 1000, completedAt: '2026-11-15T10:16:00Z' },
              ],
            },
          ],
          personalRecords: [],
        },
      ],
    });
    useWorkoutHistoryStore.setState({ workouts: [], hydrated: false });
    useProgramStore.setState({ program: prog, hydrated: true, deloadActive: false });
    await useProgramStore.getState().applyDeloadWeek();
    assert.strictEqual(useProgramStore.getState().deloadActive, true);

    await useWorkoutSessionStore.getState().initializeSession(useProgramStore.getState().program.workouts[0]);
    const deloadSession = useWorkoutSessionStore.getState().session;
    assert.strictEqual(deloadSession.exercises[0].sets[0].weight, 85, 'Session Bench Press must load at 85 kg (-15% of 100 kg)');

    await useProgramStore.getState().restoreFromDeload();
    assert.strictEqual(useProgramStore.getState().deloadActive, false);
    await useWorkoutSessionStore.getState().initializeSession(useProgramStore.getState().program.workouts[0]);
    const restoredSession = useWorkoutSessionStore.getState().session;
    assert.strictEqual(restoredSession.exercises[0].sets[0].weight, 100, 'After restoreFromDeload, historical 100 kg resumes');

    console.log('✅ TEST 17 PASSED (P0-01): initializeSession prescribes -15% deload weight from history and restores cleanly');
    passedTests++;
  }

  // Test 18 (P0-02): Skipping optional warm-up set does NOT mark completed working workout isPartial or block rotation, and warmup edit does NOT overwrite working sets
  {
    const session = createMockSession();
    seedSession(session);
    useWorkoutSessionStore.getState().addWarmupSets(0);

    // Editing Warmup Set 0 with propagate=true MUST NOT overwrite Working Sets!
    useWorkoutSessionStore.getState().updateSet(0, 0, { weight: 30, reps: 10 }, true);
    const afterWarmupEdit = useWorkoutSessionStore.getState().session.exercises[0].sets;
    const workingSetsBeforeComplete = afterWarmupEdit.filter((s) => s.setType !== 'warmup');
    assert.ok(
      workingSetsBeforeComplete.every((s) => s.weight === 57.5),
      'Warmup set propagation must never overwrite working set weights'
    );

    // Complete 2 warmups, skip 1 warmup, and complete ALL 3 working sets
    const allSets = useWorkoutSessionStore.getState().session.exercises[0].sets;
    const warmupIndices = allSets.map((s, idx) => (s.setType === 'warmup' ? idx : -1)).filter((i) => i >= 0);
    const workingIndices = allSets.map((s, idx) => (s.setType !== 'warmup' ? idx : -1)).filter((i) => i >= 0);

    // Complete first warmup (leave last warmup uncompleted!) and complete all 3 working sets
    useWorkoutSessionStore.getState().toggleSetCompletion(0, warmupIndices[0]);
    for (const wIdx of workingIndices) {
      useWorkoutSessionStore.getState().toggleSetCompletion(0, wIdx);
    }

    const prog = {
      id: 'prog-warmup-rot',
      name: 'Push Pull',
      splitType: 'upper_lower',
      workouts: [
        { id: 'workout-push-a', name: 'Push A', dayLabel: 'MON', exercises: [] },
        { id: 'workout-pull-a', name: 'Pull A', dayLabel: 'WED', exercises: [] },
      ],
    };
    useProgramStore.setState({ program: prog, hydrated: true, deloadActive: false });
    await useProgramProgressStore.getState().resetProgress('prog-warmup-rot', 'workout-push-a');
    useWorkoutHistoryStore.setState({ workouts: [], hydrated: true });

    const finalized = await finalizeWorkoutSession(useWorkoutSessionStore.getState().session);
    assert.strictEqual(finalized.isPartial, false, 'Skipping an optional warmup when all working sets are done must yield isPartial = false');
    assert.strictEqual(useProgramProgressStore.getState().progress.nextWorkoutId, 'workout-pull-a', 'Split rotation must advance cleanly');
    const savedWarmup = finalized.exercises[0].sets.find((s) => s.setType === 'warmup');
    assert.strictEqual(savedWarmup.volume, 0, 'Warmup set volume must be stored as 0');

    console.log('✅ TEST 18 PASSED (P0-02): Skipped warm-up sets never trigger false isPartial or block split rotation; warmup edits never overwrite working sets');
    passedTests++;
  }

  // Test 19 (P0-05): Bilateral per-hand dumbbell exercises multiply volume ×2 while unilateral & single-DB exercises stay ×1
  {
    const { calculateSetVolumeKg } = loadTsModule('lib/weightUtils.ts');
    const { calculateMuscleProgress } = loadTsModule('lib/progressCalculator.ts');

    // Bilateral 2-dumbbell Bench Press: 30 kg per hand × 10 reps = 600 kg per set (×2)
    assert.strictEqual(
      calculateSetVolumeKg({ weightKg: 30, reps: 10, exerciseName: 'Dumbbell Bench Press', equipment: 'dumbbells' }),
      600
    );
    // Unilateral Single-Arm Dumbbell Row: 30 kg × 10 reps = 300 kg per set (×1 — never double-counted!)
    assert.strictEqual(
      calculateSetVolumeKg({ weightKg: 30, reps: 10, exerciseName: 'Single-Arm Dumbbell Row', equipment: 'dumbbells' }),
      300
    );
    // Unilateral Bulgarian Split Squat: 16 kg × 10 reps = 160 kg (×1)
    assert.strictEqual(
      calculateSetVolumeKg({ weightKg: 16, reps: 10, exerciseName: 'Bulgarian Split Squat', equipment: 'dumbbells' }),
      160
    );
    // Single shared-dumbbell Goblet Squat: 24 kg × 10 reps = 240 kg (×1)
    assert.strictEqual(
      calculateSetVolumeKg({ weightKg: 24, reps: 10, exerciseName: 'Goblet Squat', equipment: 'dumbbells' }),
      240
    );

    // Verify createCompletedWorkoutSnapshot & Analytics Muscle Progress apply ×2 on bilateral dumbbells
    const dbSession = {
      id: 'sess-db-vol',
      programWorkoutId: 'upper-db',
      workoutName: 'Upper DB',
      workoutDate: '2026-11-20',
      startedAt: '2026-11-20T10:00:00Z',
      completedAt: '2026-11-20T10:30:00Z',
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      completed: true,
      personalRecords: [],
      exercises: [
        {
          id: 'db-bench',
          name: 'Dumbbell Bench Press',
          muscleGroup: 'Chest',
          equipment: 'dumbbells',
          weightIncrement: 1,
          restSeconds: 90,
          previousSets: [],
          recommendation: { recommendedWeight: 30, recommendationReason: 'maintain', source: 'program_default', explanation: '' },
          sets: [
            { id: 's1', weight: 30, reps: 10, targetReps: '8-12', completed: true, completedAt: '2026-11-20T10:05:00Z' },
            { id: 's2', weight: 30, reps: 10, targetReps: '8-12', completed: true, completedAt: '2026-11-20T10:08:00Z' },
            { id: 's3', weight: 30, reps: 10, targetReps: '8-12', completed: true, completedAt: '2026-11-20T10:11:00Z' },
          ],
        },
      ],
    };
    const snap = createCompletedWorkoutSnapshot(dbSession);
    assert.strictEqual(snap.exercises[0].sets[0].weight, 30, 'Per-hand weight remains 30 kg');
    assert.strictEqual(snap.totalVolume, 1800, '3 sets × 10 reps × (30 kg × 2 hands) = 1800 kg total volume');

    const muscleProg = calculateMuscleProgress([snap], 'ALL', new Date('2026-11-21T10:00:00Z'));
    assert.strictEqual(muscleProg.find((m) => m.name === 'Chest').volume, 1800);

    console.log('✅ TEST 19 PASSED (P0-05): Bilateral per-hand dumbbells compute ×2 tonnage while keeping per-hand weight & ×1 unilateral volume');
    passedTests++;
  }

  // Test 20 (P0-03): discardSession clears state & AsyncStorage; mid-workout swapExercise preserves completed sets!
  {
    const multiSetSession = {
      id: 'sess-swap-guard',
      programWorkoutId: 'upper-a',
      workoutName: 'Upper A',
      workoutDate: '2026-11-22',
      startedAt: '2026-11-22T10:00:00Z',
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
          recommendation: { recommendedWeight: 80, recommendationReason: 'maintain', source: 'program_default', explanation: '' },
          sets: [
            { id: 's1', weight: 80, reps: 8, targetReps: '8-10', completed: false },
            { id: 's2', weight: 80, reps: 8, targetReps: '8-10', completed: false },
            { id: 's3', weight: 80, reps: 8, targetReps: '8-10', completed: false },
            { id: 's4', weight: 80, reps: 8, targetReps: '8-10', completed: false },
          ],
        },
      ],
    };
    seedSession(multiSetSession);

    // Complete 2 of 4 sets on Barbell Bench Press (1,280 kg completed work)
    useWorkoutSessionStore.getState().completeCurrentSet();
    useWorkoutSessionStore.getState().completeCurrentSet();
    assert.strictEqual(useWorkoutSessionStore.getState().session.currentSetIndex, 2);

    // Swap exercise mid-workout -> default mode MUST preserve the 2 completed Bench sets & insert Machine Chest Press with 2 remaining sets!
    useWorkoutSessionStore.getState().swapExercise({
      name: 'Machine Chest Press',
      muscleGroup: 'Chest',
      defaultWeight: 50,
      equipment: 'machines',
    });

    const swappedState = useWorkoutSessionStore.getState().session;
    assert.strictEqual(swappedState.exercises.length, 2, 'Completed exercise kept + replacement inserted');
    assert.strictEqual(swappedState.exercises[0].name, 'Barbell Bench Press');
    assert.strictEqual(swappedState.exercises[0].sets.length, 2, 'Original exercise trimmed to its 2 completed sets');
    assert.ok(swappedState.exercises[0].sets.every((s) => s.completed === true));
    assert.strictEqual(swappedState.exercises[1].name, 'Machine Chest Press');
    assert.strictEqual(swappedState.exercises[1].sets.length, 2, 'Replacement exercise receives remaining 2 uncompleted sets');
    assert.strictEqual(swappedState.currentExerciseIndex, 1, 'Focus moves to newly inserted replacement exercise');
    assert.strictEqual(swappedState.currentSetIndex, 0);

    // Verify explicit discardSession wipes in-memory session AND persisted AsyncStorage key
    await useWorkoutSessionStore.getState().discardSession();
    assert.strictEqual(useWorkoutSessionStore.getState().session, null);
    const rehydrated = await useWorkoutSessionStore.getState().hydrateSession();
    assert.strictEqual(rehydrated, false, 'Discarded workout must not resurrect on hydrateSession');

    console.log('✅ TEST 20 PASSED (P0-03): swapExercise preserves completed sets & discardSession cleanly purges active workout');
    passedTests++;
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passedTests} / 20 PASSED, 0 FAILED (100% Real TS Execution)`);
  console.log(`========================================\n`);
})().catch((err) => {
  console.error('❌ Workout logging verification failed:', err);
  process.exit(1);
});

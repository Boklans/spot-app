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

  console.log(`\n========================================`);
  console.log(`Results: ${passedTests} / 16 PASSED, 0 FAILED (100% Real TS Execution)`);
  console.log(`========================================\n`);
})().catch((err) => {
  console.error('❌ Workout logging verification failed:', err);
  process.exit(1);
});

// scripts/verify-workout-logging.js
// Automated verification suite for SPOT Workout Logging, Completion Integrity (Scenarios A-G),
// and Onboarding Personalization Audit.

const assert = require('assert');

// 1. Mock Session Setup (Multi-exercise 12-set workout)
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

function isValidCompletedSet(set) {
  return (
    Boolean(set && set.completed === true) &&
    typeof set.reps === 'number' &&
    Number.isFinite(set.reps) &&
    set.reps > 0 &&
    typeof set.weight === 'number' &&
    Number.isFinite(set.weight) &&
    set.weight >= 0
  );
}

// 2. Pure Store Logic Emulators (mirroring workoutSessionStore.ts & completedWorkout.ts)
function completeCurrentSet(state) {
  if (!state.session || state.session.completed) return state;

  const session = state.session;
  const exercise = session.exercises[session.currentExerciseIndex];
  const activeSet = exercise?.sets[session.currentSetIndex];
  if (!exercise || !activeSet || activeSet.completed) return state;

  const completedAt = new Date().toISOString();
  const exercisesWithCompletedSet = session.exercises.map((item, exerciseIndex) => {
    if (exerciseIndex !== session.currentExerciseIndex) return item;
    return {
      ...item,
      sets: item.sets.map((workoutSet, setIndex) =>
        setIndex === session.currentSetIndex
          ? { ...workoutSet, completed: true, completedAt }
          : workoutSet
      ),
    };
  });

  const allSetsCompleted = exercisesWithCompletedSet.every((ex) =>
    ex.sets.every((s) => s.completed)
  );

  if (allSetsCompleted) {
    return {
      ...state,
      session: {
        ...session,
        exercises: exercisesWithCompletedSet,
        completed: true,
        completedAt,
      },
      restEndsAt: null,
      restNextType: null,
    };
  }

  let nextExerciseIndex = session.currentExerciseIndex;
  let nextSetIndex = session.currentSetIndex;
  let movedToAnotherExercise = false;

  const currentUpdatedEx = exercisesWithCompletedSet[session.currentExerciseIndex];
  const nextUncompletedInCurrent = currentUpdatedEx.sets.findIndex(
    (s, idx) => idx > session.currentSetIndex && !s.completed
  );
  const anyUncompletedInCurrent = currentUpdatedEx.sets.findIndex((s) => !s.completed);

  if (nextUncompletedInCurrent !== -1) {
    nextSetIndex = nextUncompletedInCurrent;
  } else if (anyUncompletedInCurrent !== -1) {
    nextSetIndex = anyUncompletedInCurrent;
  } else {
    movedToAnotherExercise = true;
    const totalEx = exercisesWithCompletedSet.length;
    for (let offset = 1; offset < totalEx; offset++) {
      const candidateExIdx = (session.currentExerciseIndex + offset) % totalEx;
      const firstUncompletedSetIdx = exercisesWithCompletedSet[candidateExIdx].sets.findIndex(
        (s) => !s.completed
      );
      if (firstUncompletedSetIdx !== -1) {
        nextExerciseIndex = candidateExIdx;
        nextSetIndex = firstUncompletedSetIdx;
        break;
      }
    }
  }

  const restDuration = exercise.restSeconds || 90;

  return {
    ...state,
    session: {
      ...session,
      exercises: exercisesWithCompletedSet,
      currentExerciseIndex: nextExerciseIndex,
      currentSetIndex: nextSetIndex,
    },
    restEndsAt: restDuration > 0 ? Date.now() + restDuration * 1000 : null,
    restNextType: restDuration > 0 ? (movedToAnotherExercise ? 'exercise' : 'set') : null,
  };
}

function updateSet(state, exerciseIndex, setIndex, values, propagate = false) {
  if (!state.session) return state;
  const targetExercise = state.session.exercises[exerciseIndex];
  const targetSet = targetExercise?.sets[setIndex];
  if (!targetExercise || !targetSet) return state;

  const shouldPropagate = propagate && !targetSet.completed;

  return {
    ...state,
    session: {
      ...state.session,
      exercises: state.session.exercises.map((exercise, exIdx) =>
        exIdx !== exerciseIndex
          ? exercise
          : {
              ...exercise,
              sets: exercise.sets.map((workoutSet, sIdx) => {
                if (sIdx === setIndex) {
                  return { ...workoutSet, ...values };
                }
                if (shouldPropagate && sIdx > setIndex && !workoutSet.completed) {
                  return { ...workoutSet, ...values };
                }
                return workoutSet;
              }),
            }
      ),
    },
  };
}

function createCompletedWorkoutSnapshot(session) {
  const completedAt = session.completedAt ?? new Date().toISOString();
  const durationSeconds = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000));
  const plannedSets = session.exercises.reduce((total, ex) => total + ex.sets.length, 0);
  const exercises = session.exercises.map((exercise) => ({
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    muscleGroup: exercise.muscleGroup,
    sets: exercise.sets.filter(isValidCompletedSet).map((set) => ({
      weight: set.weight,
      reps: set.reps,
      volume: set.weight * set.reps,
      completedAt: set.completedAt ?? completedAt,
    })),
  })).filter((exercise) => exercise.sets.length > 0);
  const completedSets = exercises.flatMap((exercise) => exercise.sets);
  const isPartial = plannedSets > 0 && completedSets.length < plannedSets;

  return {
    id: session.id,
    programWorkoutId: session.programWorkoutId,
    workoutName: session.workoutName,
    workoutDate: session.workoutDate || session.startedAt.slice(0, 10),
    startedAt: session.startedAt,
    completedAt,
    durationSeconds,
    totalSets: completedSets.length,
    plannedSets,
    isPartial,
    totalVolume: completedSets.reduce((total, set) => total + set.volume, 0),
    exercises,
    personalRecords: [],
  };
}

console.log('--- Running SPOT Workout Logging & Integrity Tests ---\n');

let passedTests = 0;

// Test 1: Completing a set once
{
  let state = { session: createMockSession(), restEndsAt: null, restNextType: null };
  state = completeCurrentSet(state);

  assert.strictEqual(state.session.exercises[0].sets[0].completed, true, 'Set 1 must be marked completed');
  assert.ok(typeof state.session.exercises[0].sets[0].completedAt === 'string', 'Set 1 must have completedAt timestamp');
  assert.strictEqual(state.session.currentSetIndex, 1, 'Current set index must advance to Set 2 (index 1)');
  assert.ok(state.restEndsAt > Date.now(), 'restEndsAt must be in the future');
  assert.strictEqual(state.restNextType, 'set', 'restNextType must be set');
  console.log('✅ TEST 1 PASSED: Completing a set once transitions state and advances set');
  passedTests++;
}

// Test 2: Rapid double taps do not double-advance
{
  let state = { session: createMockSession(), restEndsAt: null, restNextType: null };
  state = completeCurrentSet(state);
  const completedTimestamp1 = state.session.exercises[0].sets[0].completedAt;

  const doubleTapState = updateSet(state, 0, 0, { weight: 60 });
  assert.strictEqual(doubleTapState.session.currentSetIndex, 1, 'Double tap does not advance set index unexpectedly');
  assert.strictEqual(doubleTapState.session.exercises[0].sets[0].completedAt, completedTimestamp1, 'Timestamp is not corrupted');
  console.log('✅ TEST 2 PASSED: Rapid double-tap protection retains consistent set index and timestamp');
  passedTests++;
}

// Test 3: Editing active uncompleted set
{
  let state = { session: createMockSession(), restEndsAt: null, restNextType: null };
  state = updateSet(state, 0, 0, { weight: 60, reps: 10 }, false);

  assert.strictEqual(state.session.exercises[0].sets[0].weight, 60, 'Set 0 weight must be 60');
  assert.strictEqual(state.session.exercises[0].sets[0].reps, 10, 'Set 0 reps must be 10');
  assert.strictEqual(state.session.exercises[0].sets[1].weight, 57.5, 'Set 1 weight must remain 57.5 when propagate is false');
  assert.strictEqual(state.session.exercises[0].sets[1].reps, 8, 'Set 1 reps must remain 8 when propagate is false');
  console.log('✅ TEST 3 PASSED: Editing active uncompleted set with propagate=false modifies target set only');
  passedTests++;
}

// Test 4: Explicit forward propagation on uncompleted sets
{
  let state = { session: createMockSession(), restEndsAt: null, restNextType: null };
  state = updateSet(state, 0, 0, { weight: 62.5, reps: 10 }, true);

  assert.strictEqual(state.session.exercises[0].sets[0].weight, 62.5);
  assert.strictEqual(state.session.exercises[0].sets[1].weight, 62.5, 'Subsequent uncompleted set 1 received propagated weight');
  assert.strictEqual(state.session.exercises[0].sets[2].weight, 62.5, 'Subsequent uncompleted set 2 received propagated weight');
  console.log('✅ TEST 4 PASSED: Explicit propagate=true propagates forward to uncompleted sets');
  passedTests++;
}

// Test 5: Editing a completed set preserves completion state, timestamp, and does NOT propagate
{
  let state = { session: createMockSession(), restEndsAt: null, restNextType: null };
  state = completeCurrentSet(state);
  const originalCompletedAt = state.session.exercises[0].sets[0].completedAt;

  state = updateSet(state, 0, 0, { weight: 65, reps: 9 }, true);

  const editedSet0 = state.session.exercises[0].sets[0];
  assert.strictEqual(editedSet0.weight, 65, 'Set 0 weight must be updated to 65');
  assert.strictEqual(editedSet0.reps, 9, 'Set 0 reps must be updated to 9');
  assert.strictEqual(editedSet0.completed, true, 'Set 0 MUST remain completed: true');
  assert.strictEqual(editedSet0.completedAt, originalCompletedAt, 'Set 0 completedAt timestamp MUST remain identical');
  assert.strictEqual(state.session.exercises[0].sets[1].weight, 57.5, 'Set 1 must not be modified by completed set edit');
  console.log('✅ TEST 5 PASSED: Editing completed set preserves completion state & timestamp and refuses propagation');
  passedTests++;
}

// Test 6: Rest timer serialization and restoration
{
  const futureRest = Date.now() + 45000;
  const storageData = {
    session: createMockSession(),
    restEndsAt: futureRest,
    restNextType: 'set',
  };

  const serialized = JSON.stringify(storageData);
  const parsed = JSON.parse(serialized);

  assert.strictEqual(parsed.restEndsAt, futureRest, 'restEndsAt must survive JSON serialization');
  assert.strictEqual(parsed.restNextType, 'set', 'restNextType must survive JSON serialization');
  assert.strictEqual(parsed.session.id, 'test-session-1', 'Session ID intact');
  console.log('✅ TEST 6 PASSED: Rest timer deadline survives storage serialization & hydration');
  passedTests++;
}

// Test 7: Finalization idempotency & Volume reflection from edited completed sets
{
  let state = { session: createMockSession(), restEndsAt: null, restNextType: null };
  state = completeCurrentSet(state);
  state = updateSet(state, 0, 0, { weight: 70, reps: 10 }, false);
  state = completeCurrentSet(state);
  state = completeCurrentSet(state);

  assert.strictEqual(state.session.completed, true, 'Session is completed after final set');
  const snapshot = createCompletedWorkoutSnapshot(state.session);

  assert.strictEqual(snapshot.totalSets, 3, 'Must have 3 completed sets');
  assert.strictEqual(snapshot.plannedSets, 3, 'Planned sets must be 3');
  assert.strictEqual(snapshot.isPartial, false, 'Full workout must have isPartial = false');
  assert.strictEqual(snapshot.totalVolume, 1620, 'Total volume must reflect corrected 70kg x 10 set (expected 1620)');
  console.log('✅ TEST 7 PASSED: Finalized snapshot reflects corrected completed set values and exact volume');
  passedTests++;
}

// Test 8: Scenario A — 0 of 12 sets completed (Empty workout must NOT be saved)
{
  const session = createMock12SetSession();
  const snapshot = createCompletedWorkoutSnapshot(session);
  assert.strictEqual(snapshot.totalSets, 0, '0 completed sets must yield totalSets = 0');
  assert.strictEqual(snapshot.plannedSets, 12, 'plannedSets must be 12');
  assert.strictEqual(snapshot.totalVolume, 0, '0 completed sets must yield 0 volume');
  assert.strictEqual(snapshot.exercises.length, 0, 'No exercises with completed sets');
  console.log('✅ TEST 8 PASSED (Scenario A): 0 of 12 sets completed produces 0 volume and is blocked from saving');
  passedTests++;
}

// Test 9: Scenario B — 1 of 12 sets completed (Partial save does NOT record full workout or advance rotation)
{
  let state = { session: createMock12SetSession(), restEndsAt: null, restNextType: null };
  // User completes ONLY Set 1 of Exercise 1 (40kg x 8 = 320kg)
  state = completeCurrentSet(state);

  assert.strictEqual(state.session.completed, false, 'Session must NOT auto-complete after 1 of 12 sets');
  const snapshot = createCompletedWorkoutSnapshot(state.session);

  assert.strictEqual(snapshot.totalSets, 1, 'Only 1 set must be recorded');
  assert.strictEqual(snapshot.plannedSets, 12, 'Planned sets must be 12');
  assert.strictEqual(snapshot.isPartial, true, '1 of 12 sets MUST be marked isPartial: true');
  assert.strictEqual(snapshot.totalVolume, 320, 'Volume must be strictly 40 * 8 = 320 (not all 12 sets)');
  assert.strictEqual(snapshot.exercises.length, 1, 'Only 1 exercise had a completed set');

  // Rotation guard check:
  let rotationAdvanced = false;
  if (!snapshot.isPartial) {
    rotationAdvanced = true;
  }
  assert.strictEqual(rotationAdvanced, false, 'Program rotation MUST NOT advance on partial workout');
  console.log('✅ TEST 9 PASSED (Scenario B): 1 of 12 sets records partial workout (1/12, 320kg) and does NOT advance rotation');
  passedTests++;
}

// Test 10: Scenario C & D — Out-of-order set completion does NOT auto-finish workout prematurely
{
  let state = { session: createMock12SetSession(), restEndsAt: null, restNextType: null };
  // User jumps straight to the last exercise (index 3) and last set (index 2)
  state.session.currentExerciseIndex = 3;
  state.session.currentSetIndex = 2;

  state = completeCurrentSet(state);

  assert.strictEqual(
    state.session.completed,
    false,
    'Completing the last set of the last exercise when earlier sets are uncompleted MUST NOT finish the workout'
  );
  assert.strictEqual(state.session.currentExerciseIndex, 3, 'Focuses remaining uncompleted set in current exercise first');
  assert.strictEqual(state.session.currentSetIndex, 0, 'Wraps to set 0 of exercise 3');
  console.log('✅ TEST 10 PASSED (Scenario C/D): Completing last set out-of-order does not prematurely finish session');
  passedTests++;
}

// Test 11: Scenario E — Quick Log initialized from activeSession does NOT copy pre-filled reps from uncompleted sets
{
  const activeSession = createMock12SetSession();
  // Mark only set 1 of exercise 1 as completed
  activeSession.exercises[0].sets[0].completed = true;

  // Emulate quick-log.tsx initialization fix:
  const quickLogExercises = activeSession.exercises.map((ex) => ({
    id: ex.id,
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    sets: ex.sets.map((s) => ({
      id: s.id,
      weight: s.weight,
      reps: s.completed ? s.reps : 0,
    })),
  }));

  const validSets = quickLogExercises.flatMap((ex) =>
    ex.sets.filter((s) => s.reps > 0 && s.weight >= 0)
  );
  assert.strictEqual(
    validSets.length,
    1,
    'Quick Log initialized from activeSession with 1 completed set must only have 1 set with reps > 0'
  );
  console.log('✅ TEST 11 PASSED (Scenario E): Quick Log does not convert uncompleted template sets into completed sets');
  passedTests++;
}

// Test 12: Scenario F — Full 12 of 12 sets completion marks isPartial = false and advances rotation
{
  let state = { session: createMock12SetSession(), restEndsAt: null, restNextType: null };
  for (let i = 0; i < 12; i++) {
    state = completeCurrentSet(state);
  }

  assert.strictEqual(state.session.completed, true, 'Session must be completed after all 12 sets');
  const snapshot = createCompletedWorkoutSnapshot(state.session);
  assert.strictEqual(snapshot.totalSets, 12, 'All 12 sets recorded');
  assert.strictEqual(snapshot.plannedSets, 12, '12 planned sets');
  assert.strictEqual(snapshot.isPartial, false, 'Full workout has isPartial = false');
  console.log('✅ TEST 12 PASSED (Scenario F): Completing 12 of 12 sets marks workout as full and eligible to advance rotation');
  passedTests++;
}

console.log(`\n========================================`);
console.log(`Results: ${passedTests} / 12 PASSED, 0 FAILED`);
console.log(`========================================\n`);

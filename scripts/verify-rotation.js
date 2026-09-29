// scripts/verify-rotation.js
// Verification suite for the 4 core program rotation and history rules

function simulateAdvanceProgress({
  program,
  currentProgress,
  history,
  completedWorkoutId,
  sessionId,
  completedAt,
  workoutDate
}) {
  // 1. Idempotency guard: never advance twice for the exact same session
  if (sessionId && currentProgress.lastCompletedSessionId === sessionId) {
    return { ...currentProgress, advanced: false, reason: 'idempotent_duplicate' };
  }

  const workouts = program.workouts;
  if (!workouts || workouts.length === 0) {
    return { ...currentProgress, advanced: false, reason: 'no_workouts' };
  }

  const completedIndex = workouts.findIndex((w) => w.id === completedWorkoutId);
  const isProgramWorkout = completedIndex >= 0;

  // 2. Custom or unprogrammed workouts: count as completed, but do NOT advance rotation
  if (!isProgramWorkout) {
    return {
      ...currentProgress,
      completedWorkoutCount: currentProgress.completedWorkoutCount + 1,
      lastCompletedSessionId: sessionId,
      advanced: false,
      reason: 'unprogrammed_custom_workout',
    };
  }

  // 3. Retroactive backfill check:
  const sessionDate = workoutDate || (completedAt ? completedAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const completedTimestamp = completedAt ? new Date(completedAt).getTime() : Date.now();

  const priorProgramWorkouts = history.filter((w) =>
    w.id !== sessionId &&
    workouts.some((pw) => pw.id === w.programWorkoutId)
  );

  const latestPriorWorkout = priorProgramWorkouts.sort((a, b) => {
    const dateA = a.workoutDate || (a.completedAt || a.startedAt || '').slice(0, 10);
    const dateB = b.workoutDate || (b.completedAt || b.startedAt || '').slice(0, 10);
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    const timeA = new Date(a.completedAt || a.startedAt || 0).getTime();
    const timeB = new Date(b.completedAt || b.startedAt || 0).getTime();
    return timeB - timeA;
  })[0];

  const latestPriorDate = latestPriorWorkout
    ? (latestPriorWorkout.workoutDate || (latestPriorWorkout.completedAt || latestPriorWorkout.startedAt || '').slice(0, 10))
    : '';
  const latestPriorTime = latestPriorWorkout
    ? new Date(latestPriorWorkout.completedAt || latestPriorWorkout.startedAt || 0).getTime()
    : 0;

  const isOlderThanLatest = Boolean(
    latestPriorWorkout &&
    (sessionDate < latestPriorDate || (sessionDate === latestPriorDate && completedTimestamp < latestPriorTime))
  );

  if (isOlderThanLatest) {
    return {
      ...currentProgress,
      completedWorkoutCount: currentProgress.completedWorkoutCount + 1,
      lastCompletedSessionId: sessionId,
      advanced: false,
      reason: 'retroactive_backfill',
    };
  }

  // 4. Standard forward progression:
  const currentIndex = workouts.findIndex((w) => w.id === currentProgress.nextWorkoutId);
  const baseIndex = completedIndex >= 0 ? completedIndex : (currentIndex >= 0 ? currentIndex : 0);
  const nextIndex = (baseIndex + 1) % workouts.length;

  const nextWorkout = workouts[nextIndex] ?? workouts[0];
  const nextWorkoutId = nextWorkout?.id ?? workouts[0].id;

  return {
    ...currentProgress,
    nextWorkoutId,
    completedWorkoutCount: currentProgress.completedWorkoutCount + 1,
    lastCompletedWorkoutId: completedWorkoutId,
    lastCompletedSessionId: sessionId,
    advanced: true,
    reason: 'forward_advanced',
  };
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

const mockProgram = {
  id: 'prog-1',
  workouts: [
    { id: 'upper-a', name: 'Upper A' },
    { id: 'lower-a', name: 'Lower A' },
    { id: 'upper-b', name: 'Upper B' },
    { id: 'lower-b', name: 'Lower B' },
  ],
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n--- Running 4 Core Rotation & Backfill Tests ---\n');

// ── Test 1: Backfill after multiple future workouts
// Mon — Upper A, Wed — Lower A, Fri — Upper B.
// Current nextWorkoutId should be Lower B (index 3).
// On Sunday, user backfills Monday.
// Expectation: nextWorkoutId remains Lower B.
console.log('Test 1: Backfill after several subsequent workouts');
{
  const history = [
    { id: 'sess-wed', programWorkoutId: 'lower-a', workoutDate: '2026-09-23', completedAt: '2026-09-23T19:00:00Z' },
    { id: 'sess-fri', programWorkoutId: 'upper-b', workoutDate: '2026-09-25', completedAt: '2026-09-25T19:00:00Z' },
  ];
  const currentProgress = {
    programId: 'prog-1',
    nextWorkoutId: 'lower-b',
    completedWorkoutCount: 2,
    lastCompletedWorkoutId: 'upper-b',
    lastCompletedSessionId: 'sess-fri',
  };

  const result = simulateAdvanceProgress({
    program: mockProgram,
    currentProgress,
    history,
    completedWorkoutId: 'upper-a',
    sessionId: 'sess-mon-backfill',
    workoutDate: '2026-09-21',
    completedAt: '2026-09-21T18:00:00Z',
  });

  assert(result.nextWorkoutId === 'lower-b', `nextWorkoutId remains 'lower-b' (got '${result.nextWorkoutId}')`);
  assert(result.completedWorkoutCount === 3, 'completedWorkoutCount increased to 3');
  assert(result.reason === 'retroactive_backfill', "reason is 'retroactive_backfill'");
}

// ── Test 2: Old program workout, but not current scheduled one
// Current: Lower A (waiting for Wed).
// Backfill: Upper A (for Mon).
// Expectation: nextWorkoutId remains Lower A.
console.log('\nTest 2: Old program workout backfilled before current');
{
  const history = [
    // Nothing or older workouts
  ];
  const currentProgress = {
    programId: 'prog-1',
    nextWorkoutId: 'lower-a',
    completedWorkoutCount: 0,
    lastCompletedWorkoutId: undefined,
  };

  // User logs Upper A completed yesterday
  const result = simulateAdvanceProgress({
    program: mockProgram,
    currentProgress,
    history,
    completedWorkoutId: 'upper-a',
    sessionId: 'sess-upper-a',
    workoutDate: '2026-09-28',
    completedAt: '2026-09-28T18:00:00Z',
  });

  assert(result.nextWorkoutId === 'lower-a', `nextWorkoutId is 'lower-a' (got '${result.nextWorkoutId}')`);
  assert(result.completedWorkoutCount === 1, 'completedWorkoutCount is 1');
}

// ── Test 3: Custom workout between program workouts
// Upper A -> rotation = Lower A
// Custom Arms -> rotation = Lower A (NOT advanced!)
// Lower A -> rotation = Upper B
console.log('\nTest 3: Custom workout does not disrupt program rotation');
{
  let currentProgress = {
    programId: 'prog-1',
    nextWorkoutId: 'lower-a',
    completedWorkoutCount: 1,
    lastCompletedWorkoutId: 'upper-a',
  };
  const history = [
    { id: 'sess-upper-a', programWorkoutId: 'upper-a', workoutDate: '2026-09-28', completedAt: '2026-09-28T18:00:00Z' },
  ];

  // User logs custom "Arms Pump" workout
  const customResult = simulateAdvanceProgress({
    program: mockProgram,
    currentProgress,
    history,
    completedWorkoutId: 'custom-arms',
    sessionId: 'sess-custom-arms',
    workoutDate: '2026-09-29',
    completedAt: '2026-09-29T10:00:00Z',
  });

  assert(customResult.nextWorkoutId === 'lower-a', `Custom workout kept nextWorkoutId as 'lower-a' (got '${customResult.nextWorkoutId}')`);
  assert(customResult.reason === 'unprogrammed_custom_workout', "reason is 'unprogrammed_custom_workout'");

  // Then user performs planned Lower A
  const lowerResult = simulateAdvanceProgress({
    program: mockProgram,
    currentProgress: customResult,
    history: [
      ...history,
      { id: 'sess-custom-arms', programWorkoutId: 'custom-arms', workoutDate: '2026-09-29', completedAt: '2026-09-29T10:00:00Z' }
    ],
    completedWorkoutId: 'lower-a',
    sessionId: 'sess-lower-a',
    workoutDate: '2026-09-29',
    completedAt: '2026-09-29T18:00:00Z',
  });

  assert(lowerResult.nextWorkoutId === 'upper-b', `Planned Lower A advanced nextWorkoutId to 'upper-b' (got '${lowerResult.nextWorkoutId}')`);
  assert(lowerResult.completedWorkoutCount === 3, 'Total completed is 3');
}

// ── Test 4: Idempotency (Duplicate finalize)
// Session X finalized once -> nextWorkoutId = Lower A
// Same session finalized again -> nextWorkoutId remains Lower A
console.log('\nTest 4: Duplicate finalization does not advance twice');
{
  const initialProgress = {
    programId: 'prog-1',
    nextWorkoutId: 'upper-a',
    completedWorkoutCount: 0,
  };

  const firstCall = simulateAdvanceProgress({
    program: mockProgram,
    currentProgress: initialProgress,
    history: [],
    completedWorkoutId: 'upper-a',
    sessionId: 'session-xyz',
    workoutDate: '2026-09-29',
    completedAt: '2026-09-29T12:00:00Z',
  });

  assert(firstCall.nextWorkoutId === 'lower-a', "First call advanced to 'lower-a'");
  assert(firstCall.lastCompletedSessionId === 'session-xyz', "Recorded session-xyz");

  const duplicateCall = simulateAdvanceProgress({
    program: mockProgram,
    currentProgress: firstCall,
    history: [
      { id: 'session-xyz', programWorkoutId: 'upper-a', workoutDate: '2026-09-29', completedAt: '2026-09-29T12:00:00Z' }
    ],
    completedWorkoutId: 'upper-a',
    sessionId: 'session-xyz',
    workoutDate: '2026-09-29',
    completedAt: '2026-09-29T12:00:00Z',
  });

  assert(duplicateCall.nextWorkoutId === 'lower-a', "Duplicate call kept nextWorkoutId as 'lower-a'");
  assert(duplicateCall.completedWorkoutCount === 1, 'completedWorkoutCount did not increment twice');
  assert(duplicateCall.reason === 'idempotent_duplicate', "reason is 'idempotent_duplicate'");
}

console.log(`\n========================================`);
console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}

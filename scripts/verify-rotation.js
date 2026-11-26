/**
 * SPOT 2.0 Real-Module Rotation & Backfill Verification Suite
 * Executes actual production TypeScript store:
 * - store/programProgressStore.ts
 * - store/workoutHistoryStore.ts
 */
const assert = require('assert');
const { loadTsModule, resetMemoryStorage } = require('./tsRunner');

const { useProgramProgressStore, PROGRAM_PROGRESS_STORAGE_KEY } = loadTsModule('store/programProgressStore.ts');
const { useWorkoutHistoryStore } = loadTsModule('store/workoutHistoryStore.ts');

const mockProgram = {
  id: 'prog-1',
  name: 'Upper Lower Split',
  splitType: 'upper_lower',
  workouts: [
    { id: 'upper-a', name: 'Upper A', dayLabel: 'MON', exercises: [] },
    { id: 'lower-a', name: 'Lower A', dayLabel: 'TUE', exercises: [] },
    { id: 'upper-b', name: 'Upper B', dayLabel: 'THU', exercises: [] },
    { id: 'lower-b', name: 'Lower B', dayLabel: 'FRI', exercises: [] },
  ],
};

let passed = 0;

function check(cond, msg) {
  assert.ok(cond, msg);
  console.log(`  ✅ PASS: ${msg}`);
  passed++;
}

async function setupScenario(progressState, historyItems = []) {
  resetMemoryStorage({
    [PROGRAM_PROGRESS_STORAGE_KEY]: {
      ...progressState,
      updatedAt: progressState.updatedAt || '2026-09-25T19:00:00Z',
    },
    'spot-workout-history': historyItems.map((h) => ({
      workoutName: 'Session',
      startedAt: h.completedAt || '2026-09-20T18:00:00Z',
      durationSeconds: 2400,
      totalSets: 9,
      plannedSets: 9,
      isPartial: false,
      totalVolume: 3000,
      exercises: [],
      personalRecords: [],
      ...h,
    })),
  });
  useWorkoutHistoryStore.setState({ workouts: [], hydrated: false });
  useProgramProgressStore.setState({ progress: null, hydrated: false });
  await useWorkoutHistoryStore.getState().loadHistory();
  await useProgramProgressStore.getState().loadProgress(mockProgram);
}

(async () => {
  console.log('\n--- Running Real-Module Program Rotation & Backfill Tests ---\n');

  // Test 1: Backfill after multiple subsequent workouts
  console.log('Test 1: Backfill after several subsequent workouts');
  {
    await setupScenario(
      {
        programId: 'prog-1',
        nextWorkoutId: 'lower-b',
        completedWorkoutCount: 2,
        lastCompletedWorkoutId: 'upper-b',
        lastCompletedSessionId: 'sess-fri',
      },
      [
        { id: 'sess-wed', programWorkoutId: 'lower-a', workoutDate: '2026-09-23', completedAt: '2026-09-23T19:00:00Z' },
        { id: 'sess-fri', programWorkoutId: 'upper-b', workoutDate: '2026-09-25', completedAt: '2026-09-25T19:00:00Z' },
      ]
    );

    const result = await useProgramProgressStore.getState().advanceProgress(
      mockProgram,
      'upper-a',
      'sess-mon-backfill',
      '2026-09-21T18:00:00Z'
    );

    check(result.nextWorkoutId === 'lower-b', `nextWorkoutId remains 'lower-b' (got '${result.nextWorkoutId}')`);
    check(result.completedWorkoutCount === 3, 'completedWorkoutCount increased to 3');
    check(result.lastCompletedSessionId === 'sess-mon-backfill', 'Recorded backfill session ID');
  }

  // Test 2: Old program workout logged before current scheduled workout
  console.log('\nTest 2: Old program workout logged before current');
  {
    await setupScenario({
      programId: 'prog-1',
      nextWorkoutId: 'lower-a',
      completedWorkoutCount: 0,
    });

    const result = await useProgramProgressStore.getState().advanceProgress(
      mockProgram,
      'upper-a',
      'sess-upper-a',
      '2026-09-28T18:00:00Z'
    );

    check(result.nextWorkoutId === 'lower-a', `nextWorkoutId is 'lower-a' (got '${result.nextWorkoutId}')`);
    check(result.completedWorkoutCount === 1, 'completedWorkoutCount is 1');
  }

  // Test 3: Custom workout between program workouts does not disrupt split rotation
  console.log('\nTest 3: Custom workout does not disrupt program rotation');
  {
    await setupScenario(
      {
        programId: 'prog-1',
        nextWorkoutId: 'lower-a',
        completedWorkoutCount: 1,
        lastCompletedWorkoutId: 'upper-a',
      },
      [
        { id: 'sess-upper-a', programWorkoutId: 'upper-a', workoutDate: '2026-09-28', completedAt: '2026-09-28T18:00:00Z' },
      ]
    );

    const customResult = await useProgramProgressStore.getState().advanceProgress(
      mockProgram,
      'custom-arms',
      'sess-custom-arms',
      '2026-09-29T10:00:00Z'
    );
    check(customResult.nextWorkoutId === 'lower-a', `Custom workout kept nextWorkoutId as 'lower-a' (got '${customResult.nextWorkoutId}')`);
    check(customResult.completedWorkoutCount === 2, 'Custom workout incremented completedWorkoutCount to 2');

    const lowerResult = await useProgramProgressStore.getState().advanceProgress(
      mockProgram,
      'lower-a',
      'sess-lower-a',
      '2026-09-29T18:00:00Z'
    );
    check(lowerResult.nextWorkoutId === 'upper-b', `Planned Lower A advanced nextWorkoutId to 'upper-b' (got '${lowerResult.nextWorkoutId}')`);
    check(lowerResult.completedWorkoutCount === 3, 'Total completed is 3');
  }

  // Test 4: Idempotency (Duplicate finalize)
  console.log('\nTest 4: Duplicate finalization does not advance twice');
  {
    await setupScenario({
      programId: 'prog-1',
      nextWorkoutId: 'upper-a',
      completedWorkoutCount: 0,
    });

    const firstCall = await useProgramProgressStore.getState().advanceProgress(
      mockProgram,
      'upper-a',
      'session-xyz',
      '2026-09-29T12:00:00Z'
    );
    check(firstCall.nextWorkoutId === 'lower-a', "First call advanced to 'lower-a'");
    check(firstCall.lastCompletedSessionId === 'session-xyz', 'Recorded session-xyz');

    const duplicateCall = await useProgramProgressStore.getState().advanceProgress(
      mockProgram,
      'upper-a',
      'session-xyz',
      '2026-09-29T12:00:00Z'
    );
    check(duplicateCall.nextWorkoutId === 'lower-a', "Duplicate call kept nextWorkoutId as 'lower-a'");
    check(duplicateCall.completedWorkoutCount === 1, 'completedWorkoutCount did not increment twice');
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passed} PASSED, 0 FAILED (100% Real TS Execution)`);
  console.log(`========================================\n`);
})().catch((err) => {
  console.error('❌ Rotation verification failed:', err);
  process.exit(1);
});

/**
 * Real-Module Cloud Sync, Multi-Account Isolation, Tombstones & Backup Verification Suite (P0-06)
 * Executes actual production TypeScript modules against an in-memory stateful Supabase mock.
 */
const assert = require('assert');
const {
  loadTsModule,
  resetMemoryStorage,
  setSupabaseMock,
} = require('./tsRunner');

console.log('\n--- Running Real-Module Cloud Sync, Account Isolation & Backup Tests (P0-06) ---\n');

/**
 * Stateful in-memory Supabase database & auth simulator supporting:
 * upsert, select, eq, in, delete, order, limit, maybeSingle, and offline simulation.
 */
function createStatefulSupabase() {
  const tables = {
    profiles: [],
    user_programs: [],
    workout_history: [],
    body_weight_logs: [],
  };
  let activeSession = null;
  let networkOffline = false;

  const usersByEmail = new Map([
    ['user-a@spot.app', { id: 'user-a', email: 'user-a@spot.app' }],
    ['user-b@spot.app', { id: 'user-b', email: 'user-b@spot.app' }],
  ]);

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  return {
    tables,
    setOffline(offline) {
      networkOffline = offline;
    },
    setSessionForUser(userId) {
      const user = Array.from(usersByEmail.values()).find((u) => u.id === userId) || {
        id: userId,
        email: `${userId}@spot.app`,
      };
      activeSession = { access_token: `tok-${userId}`, user };
      return user;
    },
    auth: {
      getUser: async () => ({ data: { user: activeSession?.user ?? null }, error: null }),
      getSession: async () => ({ data: { session: activeSession }, error: null }),
      signInWithPassword: async ({ email }) => {
        if (networkOffline) return { data: { user: null, session: null }, error: new Error('fetch failed') };
        const user = usersByEmail.get(email);
        if (!user) return { data: { user: null, session: null }, error: new Error('Invalid login credentials') };
        activeSession = { access_token: `tok-${user.id}`, user };
        return { data: { user, session: activeSession }, error: null };
      },
      signUp: async ({ email, options }) => {
        if (networkOffline) return { data: { user: null, session: null }, error: new Error('fetch failed') };
        const id = `user-${usersByEmail.size + 1}`;
        const user = { id, email, user_metadata: options?.data || {} };
        usersByEmail.set(email, user);
        // Simulate email-confirmation-required flow when options?.data?.unconfirmed is set
        if (options?.data?.unconfirmed) {
          return { data: { user, session: null }, error: null };
        }
        activeSession = { access_token: `tok-${id}`, user };
        return { data: { user, session: activeSession }, error: null };
      },
      signOut: async () => {
        activeSession = null;
        return { error: null };
      },
      updateUser: async () => ({ data: {}, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    rpc: async () => ({ data: null, error: null }),
    from(tableName) {
      if (!tables[tableName]) tables[tableName] = [];
      let mode = 'select';
      const eqFilters = [];
      let inFilter = null;
      let orderSpec = null;
      let limitCount = null;

      function matchesRow(row) {
        for (const [col, val] of eqFilters) {
          if (row[col] !== val) return false;
        }
        if (inFilter) {
          const [col, vals] = inFilter;
          if (!vals.includes(row[col])) return false;
        }
        return true;
      }

      function executeSelect() {
        if (networkOffline) return { data: null, error: new Error('Network request failed') };
        let rows = tables[tableName].filter(matchesRow).map(clone);
        if (orderSpec) {
          const { col, ascending } = orderSpec;
          rows.sort((a, b) => {
            if (a[col] === b[col]) return 0;
            return (a[col] > b[col] ? 1 : -1) * (ascending ? 1 : -1);
          });
        }
        if (typeof limitCount === 'number') {
          rows = rows.slice(0, limitCount);
        }
        return { data: rows, error: null };
      }

      function executeDelete() {
        if (networkOffline) return { data: null, error: new Error('Network request failed') };
        tables[tableName] = tables[tableName].filter((row) => !matchesRow(row));
        return { data: null, error: null };
      }

      const builder = {
        select() {
          mode = 'select';
          return builder;
        },
        async upsert(payload) {
          if (networkOffline) return { data: null, error: new Error('Network request failed') };
          const items = Array.isArray(payload) ? payload : [payload];
          for (const item of items) {
            const copy = clone(item);
            const idx = tables[tableName].findIndex((r) => r.id === copy.id);
            if (idx >= 0) {
              tables[tableName][idx] = { ...tables[tableName][idx], ...copy };
            } else {
              tables[tableName].push(copy);
            }
          }
          return { data: clone(items), error: null };
        },
        delete() {
          mode = 'delete';
          return builder;
        },
        eq(col, val) {
          eqFilters.push([col, val]);
          return builder;
        },
        in(col, vals) {
          inFilter = [col, vals];
          return builder;
        },
        order(col, opts = {}) {
          orderSpec = { col, ascending: opts.ascending !== false };
          return builder;
        },
        limit(n) {
          limitCount = n;
          return builder;
        },
        async maybeSingle() {
          const res = executeSelect();
          if (res.error) return res;
          return { data: res.data[0] ?? null, error: null };
        },
        then(onFulfilled, onRejected) {
          const res = mode === 'delete' ? executeDelete() : executeSelect();
          return Promise.resolve(res).then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
  };
}

function makeWorkout(id, workoutName, weightKg, completedAt) {
  return {
    id,
    programWorkoutId: 'upper-a',
    workoutName,
    startedAt: completedAt,
    completedAt,
    durationSeconds: 2400,
    totalSets: 2,
    totalVolume: weightKg * 10 * 2,
    personalRecords: [],
    exercises: [
      {
        exerciseId: 'barbell-bench-press',
        exerciseName: 'Barbell Bench Press',
        muscleGroup: 'Chest',
        sets: [
          { weight: weightKg, reps: 10, volume: weightKg * 10, completedAt },
          { weight: weightKg, reps: 10, volume: weightKg * 10, completedAt },
        ],
      },
    ],
  };
}

(async () => {
  resetMemoryStorage();
  const mockDb = createStatefulSupabase();
  setSupabaseMock(mockDb);

  const authStoreMod = loadTsModule('store/authStore.ts');
  const cloudSyncMod = loadTsModule('lib/cloudSync.ts');
  const historyMod = loadTsModule('store/workoutHistoryStore.ts');
  const bodyWeightMod = loadTsModule('store/bodyWeightStore.ts');
  const notesMod = loadTsModule('store/exerciseNotesStore.ts');
  const customExMod = loadTsModule('store/customExercisesStore.ts');
  const profileMod = loadTsModule('store/userProfileStore.ts');
  const programMod = loadTsModule('store/programStore.ts');
  const backupMod = loadTsModule('lib/backupService.ts');

  let passed = 0;

  // ==========================================================================
  // TEST 1: User A signOut -> User B signIn Multi-Account Isolation
  // ==========================================================================
  {
    const loginA = await authStoreMod.useAuthStore.getState().signInWithPassword('user-a@spot.app', 'secret123');
    assert.strictEqual(loginA.success, true);

    await profileMod.useUserProfileStore.getState().updateProfile({ name: 'UserA', weightKg: 88 });
    await historyMod.useWorkoutHistoryStore
      .getState()
      .addCompletedWorkout(makeWorkout('workout-user-a-1', 'Upper A (User A)', 100, '2026-11-20T10:00:00.000Z'));
    await bodyWeightMod.useBodyWeightStore.getState().addEntry(88.4, '2026-11-20');
    await notesMod.useExerciseNotesStore.getState().setNote('Barbell Bench Press', 'User A secret bench setup');
    const customExA = await customExMod.useCustomExercisesStore.getState().addCustomExercise({
      name: 'User A Pendulum Squat',
      muscleGroup: 'Legs',
      equipment: 'machines',
      weightIncrement: 5,
      defaultSets: 3,
      defaultRepRange: '8-12',
      defaultWeight: 60,
    });

    const upA = await cloudSyncMod.syncUp();
    assert.strictEqual(upA.success, true);
    assert.strictEqual(
      mockDb.tables.workout_history.filter((r) => r.user_id === 'user-a').length,
      1,
      'User A workout must be stored in cloud under user-a'
    );

    // Seed User B with 1 pre-existing workout in cloud
    mockDb.tables.workout_history.push({
      id: 'user-b:workout-user-b-cloud',
      user_id: 'user-b',
      workout_name: 'Lower B (User B)',
      workout_data: makeWorkout('workout-user-b-cloud', 'Lower B (User B)', 60, '2026-11-21T12:00:00.000Z'),
      completed_at: '2026-11-21T12:00:00.000Z',
    });

    // User A signs out!
    await authStoreMod.useAuthStore.getState().signOut();
    assert.strictEqual(historyMod.useWorkoutHistoryStore.getState().workouts.length, 0, 'Sign out must clear User A workouts');
    assert.strictEqual(customExMod.useCustomExercisesStore.getState().customExercises.length, 0, 'Sign out must clear User A custom exercises');
    assert.strictEqual(notesMod.useExerciseNotesStore.getState().getNote('Barbell Bench Press'), '', 'Sign out must clear User A notes');

    // User B signs in on the same device and runs syncDown + syncUp (matching AuthModal)
    const loginB = await authStoreMod.useAuthStore.getState().signInWithPassword('user-b@spot.app', 'secret456');
    assert.strictEqual(loginB.success, true);
    const downB = await cloudSyncMod.syncDown();
    assert.strictEqual(downB.success, true);
    const upB = await cloudSyncMod.syncUp();
    assert.strictEqual(upB.success, true);

    const userBLocalWorkouts = historyMod.useWorkoutHistoryStore.getState().workouts;
    assert.strictEqual(userBLocalWorkouts.length, 1);
    assert.strictEqual(userBLocalWorkouts[0].id, 'workout-user-b-cloud');

    const userBCloudWorkouts = mockDb.tables.workout_history.filter((r) => r.user_id === 'user-b');
    assert.strictEqual(userBCloudWorkouts.length, 1, 'User A workouts must NEVER leak into User B cloud account');
    assert.ok(!userBCloudWorkouts.some((r) => r.workout_data.id === 'workout-user-a-1'));

    const userBProgRow = mockDb.tables.user_programs.find((r) => r.user_id === 'user-b');
    assert.ok(!userBProgRow?.progress_data?.customExercises?.some((e) => e.id === customExA.id));
    assert.strictEqual(notesMod.useExerciseNotesStore.getState().getNote('Barbell Bench Press'), '');

    console.log('✅ TEST 1 PASSED: User A signOut -> User B signIn guarantees 100% multi-account data isolation');
    passed++;
  }

  // ==========================================================================
  // TEST 2: Direct Session Switch Without signOut Still Isolates via Owner Stamp
  // ==========================================================================
  {
    // User B is currently active with workout-user-b-cloud in local store.
    // Force an abrupt user switch to User A without calling signOut()
    const userA = mockDb.setSessionForUser('user-a');
    authStoreMod.useAuthStore.setState({ user: userA, session: { access_token: 'tok-a', user: userA } });

    const downA = await cloudSyncMod.syncDown();
    assert.strictEqual(downA.success, true);

    const userALocalIds = historyMod.useWorkoutHistoryStore.getState().workouts.map((w) => w.id);
    assert.deepStrictEqual(userALocalIds, ['workout-user-a-1'], 'Abrupt account switch must purge previous owner data before syncDown');
    assert.strictEqual(customExMod.useCustomExercisesStore.getState().customExercises.length, 1);
    assert.strictEqual(customExMod.useCustomExercisesStore.getState().customExercises[0].name, 'User A Pendulum Squat');

    console.log('✅ TEST 2 PASSED: ensureAccountIsolation prevents cross-account merge even on direct token swap');
    passed++;
  }

  // ==========================================================================
  // TEST 3: Deleted Workout, Body Weight, Note & Custom Exercise Do Not Resurrect
  // ==========================================================================
  {
    // Add a second workout for User A and sync it
    await historyMod.useWorkoutHistoryStore
      .getState()
      .addCompletedWorkout(makeWorkout('workout-to-delete', 'Delete Me Workout', 70, '2026-11-22T10:00:00.000Z'));
    await bodyWeightMod.useBodyWeightStore.getState().addEntry(89.2, '2026-11-22');
    const bwToDelete = bodyWeightMod.useBodyWeightStore.getState().entries.find((e) => e.date === '2026-11-22');
    assert.ok(bwToDelete);
    await cloudSyncMod.syncUp();
    assert.strictEqual(mockDb.tables.workout_history.filter((r) => r.user_id === 'user-a').length, 2);

    // Go OFFLINE, delete workout, body weight, note, and custom exercise locally!
    mockDb.setOffline(true);
    const customId = customExMod.useCustomExercisesStore.getState().customExercises[0].id;
    await historyMod.useWorkoutHistoryStore.getState().deleteWorkout('workout-to-delete');
    await bodyWeightMod.useBodyWeightStore.getState().deleteEntry(bwToDelete.id);
    await notesMod.useExerciseNotesStore.getState().setNote('Barbell Bench Press', '');
    await customExMod.useCustomExercisesStore.getState().deleteCustomExercise(customId);

    // Come back ONLINE and run syncDown()! Tombstones must flush & prevent resurrection!
    mockDb.setOffline(false);
    const downRes = await cloudSyncMod.syncDown();
    assert.strictEqual(downRes.success, true);

    const remainingWorkouts = historyMod.useWorkoutHistoryStore.getState().workouts.map((w) => w.id);
    assert.deepStrictEqual(remainingWorkouts, ['workout-user-a-1'], 'Deleted workout must NEVER resurrect on syncDown');
    assert.strictEqual(
      mockDb.tables.workout_history.filter((r) => r.user_id === 'user-a').length,
      1,
      'Deleted workout row must be removed from Supabase workout_history'
    );
    assert.ok(
      !bodyWeightMod.useBodyWeightStore.getState().entries.some((e) => e.id === bwToDelete.id),
      'Deleted body-weight entry must NEVER resurrect on syncDown'
    );
    assert.strictEqual(
      notesMod.useExerciseNotesStore.getState().getNote('Barbell Bench Press'),
      '',
      'Cleared exercise note must NEVER resurrect on syncDown'
    );
    assert.strictEqual(
      customExMod.useCustomExercisesStore.getState().customExercises.length,
      0,
      'Deleted custom exercise must NEVER resurrect on syncDown'
    );

    console.log('✅ TEST 3 PASSED: Offline & online deletion tombstones prevent resurrection of workouts, weights, notes, and custom exercises');
    passed++;
  }

  // ==========================================================================
  // TEST 4: Historical Workout Edits Sync & Survive Stale Cloud Rows (updatedAt LWW)
  // ==========================================================================
  {
    // Edit User A's workout while offline (100 kg -> 110 kg)
    mockDb.setOffline(true);
    const target = historyMod.useWorkoutHistoryStore.getState().workouts.find((w) => w.id === 'workout-user-a-1');
    assert.ok(target);
    const edited = {
      ...target,
      exercises: [
        {
          ...target.exercises[0],
          sets: target.exercises[0].sets.map((s) => ({ ...s, weight: 110 })),
        },
      ],
    };
    await historyMod.useWorkoutHistoryStore.getState().updateWorkout(edited);

    // Cloud still has stale 100 kg! Now come online and call syncDown()
    mockDb.setOffline(false);
    const downAfterEdit = await cloudSyncMod.syncDown();
    assert.strictEqual(downAfterEdit.success, true);

    const afterSync = historyMod.useWorkoutHistoryStore.getState().workouts.find((w) => w.id === 'workout-user-a-1');
    assert.strictEqual(
      afterSync.exercises[0].sets[0].weight,
      110,
      'Newer local historical workout edit (110 kg) must NOT be overwritten by stale cloud row (100 kg)'
    );
    assert.strictEqual(afterSync.totalVolume, 2200);

    // Verify cloud row was also updated to 110 kg during convergence!
    const cloudRow = mockDb.tables.workout_history.find((r) => r.id === 'user-a:workout-user-a-1');
    assert.strictEqual(cloudRow.workout_data.exercises[0].sets[0].weight, 110);

    console.log('✅ TEST 4 PASSED: Historical workout edits persist updatedAt, win over stale cloud rows, and converge to Supabase');
    passed++;
  }

  // ==========================================================================
  // TEST 5: Anonymous Offline User Signing Into Account Merges Offline Logs Safely
  // ==========================================================================
  {
    await authStoreMod.useAuthStore.getState().signOut();
    // Anonymous user (not signed in, spot_last_synced_user_id removed) logs a workout offline
    await historyMod.useWorkoutHistoryStore
      .getState()
      .addCompletedWorkout(makeWorkout('anon-offline-1', 'Anonymous Gym Session', 50, '2026-11-23T09:00:00.000Z'));

    // Signs in as User B (who already has 'workout-user-b-cloud' in Supabase)
    await authStoreMod.useAuthStore.getState().signInWithPassword('user-b@spot.app', 'secret456');
    await cloudSyncMod.syncDown();
    await cloudSyncMod.syncUp();

    const mergedIds = historyMod.useWorkoutHistoryStore.getState().workouts.map((w) => w.id).sort();
    assert.deepStrictEqual(
      mergedIds,
      ['anon-offline-1', 'workout-user-b-cloud'],
      'Anonymous pre-login workouts must safely merge into user account upon first sign-in'
    );

    console.log('✅ TEST 5 PASSED: Anonymous offline workouts safely merge on first sign-in without losing cloud history');
    passed++;
  }

  // ==========================================================================
  // TEST 6: JSON Backup Export & Restore Preserves Custom Exercises & Preset Split
  // ==========================================================================
  {
    const newCustom = await customExMod.useCustomExercisesStore.getState().addCustomExercise({
      name: 'Bayesian Cable Curl',
      muscleGroup: 'Arms',
      equipment: 'cables',
      weightIncrement: 2.5,
      defaultSets: 3,
      defaultRepRange: '10-15',
      defaultWeight: 15,
    });
    await notesMod.useExerciseNotesStore.getState().setNote('Bayesian Cable Curl', 'Step forward 2 steps');
    const currentProg = programMod.useProgramStore.getState().program;
    await programMod.useProgramStore.getState().setPresetProgram({
      ...currentProg,
      splitType: 'upper_lower',
    });

    const exportedJson = JSON.stringify(backupMod.buildSpotBackupPayload('2.0.0'));
    assert.ok(exportedJson.includes('Bayesian Cable Curl'), 'Backup JSON must include customExercises');

    // Wipe local state completely
    await cloudSyncMod.clearLocalDataOnSignOut();
    assert.strictEqual(customExMod.useCustomExercisesStore.getState().customExercises.length, 0);
    assert.strictEqual(historyMod.useWorkoutHistoryStore.getState().workouts.length, 0);

    // Restore from JSON
    const restoreRes = await backupMod.restoreSpotBackupPayload(exportedJson);
    assert.strictEqual(restoreRes.ok, true);
    assert.strictEqual(restoreRes.workoutsCount, 2);
    assert.strictEqual(customExMod.useCustomExercisesStore.getState().customExercises.length, 1);
    assert.strictEqual(customExMod.useCustomExercisesStore.getState().customExercises[0].id, newCustom.id);
    assert.strictEqual(programMod.useProgramStore.getState().program.splitType, 'upper_lower');
    assert.strictEqual(notesMod.useExerciseNotesStore.getState().getNote('Bayesian Cable Curl'), 'Step forward 2 steps');

    console.log('✅ TEST 6 PASSED: JSON Backup export & restore preserves customExercises, notes, workouts, and preset splitType');
    passed++;
  }

  setSupabaseMock(null);
  console.log(`\n🎉 ALL ${passed} CLOUD SYNC & BACKUP INTEGRITY TESTS PASSED!\n`);
})().catch((err) => {
  console.error('❌ Failure in verify-cloud-sync.js:', err);
  process.exit(1);
});

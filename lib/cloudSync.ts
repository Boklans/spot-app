import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from './supabase';
import { useAuthStore } from '@/store/authStore';
import { BODY_WEIGHT_STORAGE_KEY, useBodyWeightStore } from '@/store/bodyWeightStore';
import { useCustomExercisesStore, type CustomExercise } from '@/store/customExercisesStore';
import { EXERCISE_NOTES_STORAGE_KEY, normalizeExerciseNoteKey, useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore, USER_PROGRAM_STORAGE_KEY } from '@/store/programStore';
import { useUserProfileStore, USER_PROFILE_STORAGE_KEY } from '@/store/userProfileStore';
import { useWorkoutHistoryStore, WORKOUT_HISTORY_STORAGE_KEY } from '@/store/workoutHistoryStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { clearOnboardingCache, loadOnboarding, saveOnboarding } from '@/store/workoutStore';
import type { CompletedWorkout } from '@/types/workout';

export const LAST_SYNCED_USER_ID_KEY = 'spot_last_synced_user_id';
export const PENDING_CLOUD_DELETES_KEY = 'spot_pending_cloud_deletes';

export interface PendingCloudDeletes {
  workouts: string[];
  bodyWeights: string[];
  exerciseNotes: string[];
  customExercises: string[];
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;
}

let syncStatusListeners: Array<(status: SyncStatus) => void> = [];
let currentStatus: SyncStatus = {
  isSyncing: false,
  lastSyncedAt: null,
  error: null,
};

function notifyListeners() {
  syncStatusListeners.forEach((fn) => fn(currentStatus));
}

export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  syncStatusListeners.push(listener);
  listener(currentStatus);
  return () => {
    syncStatusListeners = syncStatusListeners.filter((l) => l !== listener);
  };
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

function scopedCloudId(userId: string, rawId: string): string {
  const clean = rawId || 'default';
  return clean.startsWith(`${userId}:`) ? clean : `${userId}:${clean}`;
}

function emptyPendingDeletes(): PendingCloudDeletes {
  return {
    workouts: [],
    bodyWeights: [],
    exerciseNotes: [],
    customExercises: [],
  };
}

export async function loadPendingCloudDeletes(): Promise<PendingCloudDeletes> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_CLOUD_DELETES_KEY);
    if (!raw) return emptyPendingDeletes();
    const parsed = JSON.parse(raw) as Partial<PendingCloudDeletes>;
    return {
      workouts: Array.isArray(parsed.workouts) ? Array.from(new Set(parsed.workouts.filter(Boolean))) : [],
      bodyWeights: Array.isArray(parsed.bodyWeights) ? Array.from(new Set(parsed.bodyWeights.filter(Boolean))) : [],
      exerciseNotes: Array.isArray(parsed.exerciseNotes) ? Array.from(new Set(parsed.exerciseNotes.filter(Boolean))) : [],
      customExercises: Array.isArray(parsed.customExercises) ? Array.from(new Set(parsed.customExercises.filter(Boolean))) : [],
    };
  } catch {
    return emptyPendingDeletes();
  }
}

async function savePendingCloudDeletes(pending: PendingCloudDeletes): Promise<void> {
  const hasAny =
    pending.workouts.length > 0 ||
    pending.bodyWeights.length > 0 ||
    pending.exerciseNotes.length > 0 ||
    pending.customExercises.length > 0;
  try {
    if (!hasAny) {
      await AsyncStorage.removeItem(PENDING_CLOUD_DELETES_KEY);
    } else {
      await AsyncStorage.setItem(PENDING_CLOUD_DELETES_KEY, JSON.stringify(pending));
    }
  } catch {
    // Ignore storage error
  }
}

export async function recordDeletedWorkout(workoutId: string): Promise<void> {
  if (!workoutId) return;
  const pending = await loadPendingCloudDeletes();
  if (!pending.workouts.includes(workoutId)) {
    pending.workouts.push(workoutId);
    await savePendingCloudDeletes(pending);
  }
  const user = useAuthStore.getState().user;
  if (user && isSupabaseConfigured()) {
    await flushPendingCloudDeletes(user.id);
  }
}

export async function recordDeletedBodyWeight(entryId: string): Promise<void> {
  if (!entryId) return;
  const pending = await loadPendingCloudDeletes();
  if (!pending.bodyWeights.includes(entryId)) {
    pending.bodyWeights.push(entryId);
    await savePendingCloudDeletes(pending);
  }
  const user = useAuthStore.getState().user;
  if (user && isSupabaseConfigured()) {
    await flushPendingCloudDeletes(user.id);
  }
}

export async function recordDeletedExerciseNote(exerciseNameOrKey: string): Promise<void> {
  const key = normalizeExerciseNoteKey(exerciseNameOrKey) || exerciseNameOrKey.trim().toLowerCase();
  if (!key) return;
  const pending = await loadPendingCloudDeletes();
  if (!pending.exerciseNotes.includes(key)) {
    pending.exerciseNotes.push(key);
    await savePendingCloudDeletes(pending);
  }
  const user = useAuthStore.getState().user;
  if (user && isSupabaseConfigured()) {
    await syncProgramMetadataToCloud(user.id);
  }
}

export async function recordDeletedCustomExercise(customExerciseId: string): Promise<void> {
  if (!customExerciseId) return;
  const pending = await loadPendingCloudDeletes();
  if (!pending.customExercises.includes(customExerciseId)) {
    pending.customExercises.push(customExerciseId);
    await savePendingCloudDeletes(pending);
  }
  const user = useAuthStore.getState().user;
  if (user && isSupabaseConfigured()) {
    await syncProgramMetadataToCloud(user.id);
  }
}

async function flushPendingCloudDeletes(userId: string): Promise<PendingCloudDeletes> {
  const pending = await loadPendingCloudDeletes();
  if (!isSupabaseConfigured() || !userId) return pending;

  if (pending.workouts.length > 0) {
    try {
      const scopedIds = pending.workouts.flatMap((id) => [scopedCloudId(userId, id), id]);
      const { error } = await supabase
        .from('workout_history')
        .delete()
        .eq('user_id', userId)
        .in('id', Array.from(new Set(scopedIds)));
      if (!error) {
        pending.workouts = [];
      }
    } catch {
      // Keep tombstone queued for next sync
    }
  }

  if (pending.bodyWeights.length > 0) {
    try {
      const scopedIds = pending.bodyWeights.flatMap((id) => [scopedCloudId(userId, id), id]);
      const { error } = await supabase
        .from('body_weight_logs')
        .delete()
        .eq('user_id', userId)
        .in('id', Array.from(new Set(scopedIds)));
      if (!error) {
        pending.bodyWeights = [];
      }
    } catch {
      // Keep tombstone queued for next sync
    }
  }

  await savePendingCloudDeletes(pending);
  return pending;
}

/**
 * Purges local user-specific stores & AsyncStorage keys so signing out or switching
 * accounts on a shared device never leaks User A's workouts/weights/notes/programs to User B.
 */
export async function clearLocalDataOnSignOut(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      WORKOUT_HISTORY_STORAGE_KEY,
      BODY_WEIGHT_STORAGE_KEY,
      EXERCISE_NOTES_STORAGE_KEY,
      USER_PROGRAM_STORAGE_KEY,
      'spot-custom-program',
      'spot-active-program',
      'spot-program',
      'spot-program-progress',
      'spot-onboarding',
      'spot-deload-backup',
      PENDING_CLOUD_DELETES_KEY,
      LAST_SYNCED_USER_ID_KEY,
    ]);
  } catch {
    // Ignore storage removal errors
  }

  clearOnboardingCache();
  await useWorkoutSessionStore.getState().discardSession();
  await useWorkoutHistoryStore.getState().clearHistory();
  await useBodyWeightStore.getState().clearHistory();
  await useExerciseNotesStore.getState().clearNotes();
  await useCustomExercisesStore.getState().clearCustomExercises();
  await useUserProfileStore.getState().resetProfile();
  await useProgramStore.getState().resetProgram();

  currentStatus = {
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
  };
  notifyListeners();
}

/**
 * Ensures local stores belong to `incomingUserId` (or to an anonymous pre-login user).
 * If local storage is still stamped with a DIFFERENT authenticated user's ID, wipes local data first.
 */
export async function ensureAccountIsolation(incomingUserId: string): Promise<void> {
  if (!incomingUserId) return;
  const lastOwnerId = await AsyncStorage.getItem(LAST_SYNCED_USER_ID_KEY).catch(() => null);
  if (lastOwnerId && lastOwnerId !== incomingUserId) {
    await clearLocalDataOnSignOut();
  }
  await AsyncStorage.setItem(LAST_SYNCED_USER_ID_KEY, incomingUserId).catch(() => undefined);
}

async function syncProgramMetadataToCloud(userId: string): Promise<boolean> {
  const program = useProgramStore.getState().program;
  if (!program) return true;
  const progress = useProgramProgressStore.getState().progress;
  const profile = useUserProfileStore.getState().profile;
  const onboarding = await loadOnboarding();
  const exerciseNotes = await useExerciseNotesStore.getState().loadNotes();
  const customExercises = useCustomExercisesStore.getState().hydrated
    ? useCustomExercisesStore.getState().customExercises
    : await useCustomExercisesStore.getState().loadCustomExercises();

  const { error } = await supabase.from('user_programs').upsert({
    id: scopedCloudId(userId, program.id || 'main'),
    user_id: userId,
    name: program.name,
    days_per_week: program.daysPerWeek,
    program_data: program,
    progress_data: {
      ...progress,
      exerciseNotes,
      customExercises,
      profileMeta: {
        sex: profile.sex,
        age: profile.age,
        theme: profile.theme,
        baselineLifts: profile.baselineLifts,
        sessionDurationMinutes: onboarding?.sessionDurationMinutes ?? 45,
      },
    },
    updated_at: new Date().toISOString(),
  });

  if (!error) {
    const pending = await loadPendingCloudDeletes();
    if (pending.exerciseNotes.length > 0 || pending.customExercises.length > 0) {
      pending.exerciseNotes = [];
      pending.customExercises = [];
      await savePendingCloudDeletes(pending);
    }
    return true;
  }
  return false;
}

function getWorkoutFreshnessMs(workout: CompletedWorkout): number {
  const stamp = workout.updatedAt || workout.completedAt || workout.startedAt;
  const ms = stamp ? new Date(stamp).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Uploads local app state to Supabase for the authenticated user.
 */
export async function syncUp(): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

  const user = useAuthStore.getState().user;
  if (!user) return { success: false, error: 'User not authenticated' };

  currentStatus = { ...currentStatus, isSyncing: true, error: null };
  notifyListeners();

  try {
    await ensureAccountIsolation(user.id);
    const remainingDeletes = await flushPendingCloudDeletes(user.id);
    const deletedWorkoutSet = new Set(remainingDeletes.workouts);
    const deletedWeightSet = new Set(remainingDeletes.bodyWeights);

    const profile = useUserProfileStore.getState().profile;
    const workouts = (
      useWorkoutHistoryStore.getState().hydrated
        ? useWorkoutHistoryStore.getState().workouts
        : await useWorkoutHistoryStore.getState().loadHistory()
    ).filter((w) => w && !deletedWorkoutSet.has(w.id));

    const weightEntries = useBodyWeightStore
      .getState()
      .entries.filter((e) => e && !deletedWeightSet.has(e.id));

    // 1. Sync Profile
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: user.id,
      name: profile.name,
      avatar: profile.avatar,
      weight_kg: profile.weightKg,
      height_cm: profile.heightCm,
      goal: profile.goal,
      experience: profile.experience,
      workouts_per_week: profile.workoutsPerWeek,
      weight_unit: profile.weightUnit,
      height_unit: profile.heightUnit,
      default_rest_seconds: profile.defaultRestSeconds,
      language: profile.language,
      updated_at: new Date().toISOString(),
    });
    if (profileErr) throw profileErr;

    // 2. Sync Program, Exercise Notes, Custom Exercises & Extended Profile Meta
    const progOk = await syncProgramMetadataToCloud(user.id);
    if (!progOk) {
      throw new Error('Failed to sync program metadata');
    }

    // 3. Sync Workout History
    if (workouts.length > 0) {
      const workoutRows = workouts.map((w) => ({
        id: scopedCloudId(user.id, w.id),
        user_id: user.id,
        workout_name: w.workoutName || 'Workout',
        workout_data: w,
        completed_at: w.completedAt || new Date().toISOString(),
      }));

      const { error: histErr } = await supabase.from('workout_history').upsert(workoutRows);
      if (histErr) throw histErr;
    }

    // 4. Sync Body Weight Entries
    if (weightEntries.length > 0) {
      const weightRows = weightEntries.map((e) => ({
        id: scopedCloudId(user.id, e.id),
        user_id: user.id,
        weight_kg: e.weightKg,
        date: e.date,
        timestamp: e.timestamp,
        created_at: new Date(e.timestamp).toISOString(),
      }));

      const { error: weightErr } = await supabase.from('body_weight_logs').upsert(weightRows);
      if (weightErr) throw weightErr;
    }

    currentStatus = {
      isSyncing: false,
      lastSyncedAt: Date.now(),
      error: null,
    };
    notifyListeners();
    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || 'Sync failed';
    currentStatus = { ...currentStatus, isSyncing: false, error: errorMsg };
    notifyListeners();
    return { success: false, error: errorMsg };
  }
}

/**
 * Downloads cloud data from Supabase and hydrates local Zustand stores.
 */
export async function syncDown(): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

  const user = useAuthStore.getState().user;
  if (!user) return { success: false, error: 'User not authenticated' };

  currentStatus = { ...currentStatus, isSyncing: true, error: null };
  notifyListeners();

  try {
    await ensureAccountIsolation(user.id);
    const pendingDeletes = await flushPendingCloudDeletes(user.id);
    const deletedWorkoutSet = new Set(pendingDeletes.workouts);
    const deletedWeightSet = new Set(pendingDeletes.bodyWeights);
    const deletedNotesSet = new Set(pendingDeletes.exerciseNotes);
    const deletedCustomExSet = new Set(pendingDeletes.customExercises);

    // 1. Fetch Profile
    const { data: profileRow, error: profileFetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (profileFetchErr) throw profileFetchErr;

    // 2. Fetch User Program (also carries extended profileMeta, exerciseNotes & customExercises)
    const { data: programRow, error: programFetchErr } = await supabase
      .from('user_programs')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (programFetchErr) throw programFetchErr;

    const profileMeta = programRow?.progress_data?.profileMeta as
      | {
          sex?: 'male' | 'female' | 'unspecified';
          age?: number;
          theme?: 'dark' | 'light';
          baselineLifts?: any;
          sessionDurationMinutes?: number;
        }
      | undefined;

    if (profileRow && (profileRow.goal || profileRow.weight_kg)) {
      const existingProfile = useUserProfileStore.getState().profile;
      const isDummy = (n?: string | null) => !n || ['IHOR', 'ATHLETE', 'АТЛЕТ'].includes(n.trim().toUpperCase());
      const cleanName = !isDummy(profileRow.name)
        ? profileRow.name.trim().slice(0, 20)
        : (!isDummy(existingProfile?.name) ? existingProfile.name : 'Athlete');
      const mergedProfile = {
        ...existingProfile,
        name: cleanName,
        avatar: profileRow.avatar || existingProfile?.avatar || 'gorilla',
        sex: profileMeta?.sex || existingProfile?.sex || 'male',
        age: typeof profileMeta?.age === 'number' ? profileMeta.age : existingProfile?.age,
        theme: profileMeta?.theme || existingProfile?.theme || 'dark',
        baselineLifts: profileMeta?.baselineLifts || existingProfile?.baselineLifts,
        weightKg: Number(profileRow.weight_kg) || existingProfile?.weightKg || 78,
        heightCm: Number(profileRow.height_cm) || existingProfile?.heightCm || 180,
        goal: profileRow.goal || existingProfile?.goal || 'Build Muscle',
        experience: profileRow.experience || existingProfile?.experience || 'Intermediate',
        workoutsPerWeek: Number(profileRow.workouts_per_week) || existingProfile?.workoutsPerWeek || 3,
        weightUnit: profileRow.weight_unit || existingProfile?.weightUnit || 'kg',
        heightUnit: profileRow.height_unit || existingProfile?.heightUnit || 'cm',
        defaultRestSeconds: Number(profileRow.default_rest_seconds) || existingProfile?.defaultRestSeconds || 90,
        language: profileRow.language || existingProfile?.language || 'uk',
        notifications: existingProfile?.notifications ?? true,
        notificationTime: existingProfile?.notificationTime || '09:00',
        soundEnabled: existingProfile?.soundEnabled ?? true,
      };

      useUserProfileStore.setState({ profile: mergedProfile, hydrated: true });
      await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(mergedProfile));
      const existingOnboarding = await loadOnboarding();
      const mappedGoal =
        mergedProfile.goal === 'Lose Fat'
          ? 'lose_fat'
          : mergedProfile.goal === 'Get Stronger'
            ? 'get_stronger'
            : mergedProfile.goal === 'Recomposition'
              ? 'recomposition'
              : 'build_muscle';
      const mappedExperience =
        mergedProfile.experience === 'Beginner'
          ? 'beginner'
          : mergedProfile.experience === 'Advanced'
            ? 'advanced'
            : 'intermediate';
      await saveOnboarding({
        ...existingOnboarding,
        name: mergedProfile.name,
        sex: mergedProfile.sex,
        age: mergedProfile.age,
        goal: mappedGoal,
        experience: mappedExperience,
        trainingFrequency: mergedProfile.workoutsPerWeek,
        sessionDurationMinutes: profileMeta?.sessionDurationMinutes ?? existingOnboarding?.sessionDurationMinutes ?? 45,
        equipment: existingOnboarding?.equipment?.length ? existingOnboarding.equipment : ['full_gym'],
        completed: true,
      });
    }

    if (programRow && programRow.program_data) {
      useProgramStore.setState({ program: programRow.program_data, hydrated: true });
      await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(programRow.program_data));
      await AsyncStorage.setItem('spot-program', JSON.stringify(programRow.program_data));

      if (programRow.progress_data) {
        const {
          exerciseNotes: cloudExerciseNotes,
          customExercises: cloudCustomExercises,
          profileMeta: _pm,
          ...cleanProgress
        } = programRow.progress_data;
        useProgramProgressStore.setState({ progress: cleanProgress, hydrated: true });
        await AsyncStorage.setItem('spot-program-progress', JSON.stringify(cleanProgress));

        if (cloudExerciseNotes && typeof cloudExerciseNotes === 'object') {
          const currentNotes = await useExerciseNotesStore.getState().loadNotes();
          const mergedNotes: Record<string, string> = {};
          for (const [rawKey, val] of Object.entries(cloudExerciseNotes as Record<string, unknown>)) {
            if (typeof val === 'string' && val.trim().length > 0) {
              const normKey = normalizeExerciseNoteKey(rawKey) || rawKey.trim().toLowerCase();
              if (!deletedNotesSet.has(normKey)) {
                mergedNotes[normKey] = val.trim();
              }
            }
          }
          for (const [localKey, val] of Object.entries(currentNotes)) {
            if (typeof val === 'string' && val.trim().length > 0 && !deletedNotesSet.has(localKey)) {
              mergedNotes[localKey] = val.trim();
            }
          }
          useExerciseNotesStore.setState({ notes: mergedNotes, hydrated: true });
          await AsyncStorage.setItem(EXERCISE_NOTES_STORAGE_KEY, JSON.stringify(mergedNotes));
        }

        if (Array.isArray(cloudCustomExercises)) {
          const localCustom = useCustomExercisesStore.getState().hydrated
            ? useCustomExercisesStore.getState().customExercises
            : await useCustomExercisesStore.getState().loadCustomExercises();
          const customById = new Map<string, CustomExercise>();
          for (const ce of cloudCustomExercises as CustomExercise[]) {
            if (ce?.id && !deletedCustomExSet.has(ce.id)) {
              customById.set(ce.id, ce);
            }
          }
          for (const le of localCustom) {
            if (le?.id && !deletedCustomExSet.has(le.id)) {
              customById.set(le.id, le);
            }
          }
          await useCustomExercisesStore.getState().replaceCustomExercises(Array.from(customById.values()));
        }
      }
    }

    // 3. Fetch & MERGE Workout History (Last-Write-Wins via updatedAt, respecting deletion tombstones)
    const { data: historyRows, error: histFetchErr } = await supabase
      .from('workout_history')
      .select('workout_data')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });
    if (histFetchErr) throw histFetchErr;

    const localWorkouts = await useWorkoutHistoryStore.getState().loadHistory();
    const cloudWorkouts: CompletedWorkout[] = (historyRows || [])
      .map((r: any) => r?.workout_data as CompletedWorkout)
      .filter((w): w is CompletedWorkout => Boolean(w?.id && !deletedWorkoutSet.has(w.id)));

    if (cloudWorkouts.length > 0 || localWorkouts.length > 0) {
      const byId = new Map<string, CompletedWorkout>();
      const localNewerWorkouts: CompletedWorkout[] = [];

      for (const lw of localWorkouts) {
        if (lw?.id && !deletedWorkoutSet.has(lw.id)) {
          byId.set(lw.id, lw);
        }
      }
      for (const cw of cloudWorkouts) {
        const existingLocal = byId.get(cw.id);
        if (!existingLocal) {
          byId.set(cw.id, cw);
        } else {
          const localTime = getWorkoutFreshnessMs(existingLocal);
          const cloudTime = getWorkoutFreshnessMs(cw);
          if (cloudTime > localTime) {
            byId.set(cw.id, cw);
          } else if (localTime > cloudTime) {
            localNewerWorkouts.push(existingLocal);
          }
        }
      }

      const mergedWorkouts = Array.from(byId.values()).sort(
        (a, b) => new Date(b.completedAt || b.startedAt).getTime() - new Date(a.completedAt || a.startedAt).getTime()
      );

      useWorkoutHistoryStore.setState({ workouts: mergedWorkouts, hydrated: true });
      await AsyncStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(mergedWorkouts));

      // Push any locally edited workouts that are newer than cloud rows so cloud converges immediately
      if (localNewerWorkouts.length > 0) {
        const rowsToUpdate = localNewerWorkouts.map((w) => ({
          id: scopedCloudId(user.id, w.id),
          user_id: user.id,
          workout_name: w.workoutName || 'Workout',
          workout_data: w,
          completed_at: w.completedAt || new Date().toISOString(),
        }));
        await supabase.from('workout_history').upsert(rowsToUpdate);
      }
    }

    // 4. Fetch & MERGE Body Weight Logs (respecting deletion tombstones)
    const { data: weightRows, error: weightFetchErr } = await supabase
      .from('body_weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: true });
    if (weightFetchErr) throw weightFetchErr;

    if (weightRows && weightRows.length > 0) {
      const cloudEntries = weightRows
        .map((r: any) => ({
          id: String(r.id).startsWith(`${user.id}:`) ? String(r.id).slice(user.id.length + 1) : String(r.id),
          weightKg: Number(r.weight_kg),
          date: r.date,
          timestamp: Number(r.timestamp),
        }))
        .filter((ce: { id: string }) => ce.id && !deletedWeightSet.has(ce.id));

      const localEntries = useBodyWeightStore.getState().hydrated
        ? useBodyWeightStore.getState().entries
        : await useBodyWeightStore.getState().loadHistory();
      const weightById = new Map<string, { id: string; weightKg: number; date: string; timestamp: number }>();
      for (const le of localEntries) {
        if (le?.id && !deletedWeightSet.has(le.id)) {
          weightById.set(le.id, le);
        }
      }
      for (const ce of cloudEntries) {
        if (ce?.id && !deletedWeightSet.has(ce.id)) {
          weightById.set(ce.id, ce);
        }
      }
      const mergedEntries = Array.from(weightById.values()).sort((a, b) => a.timestamp - b.timestamp);

      useBodyWeightStore.setState({ entries: mergedEntries, hydrated: true });
      await AsyncStorage.setItem(BODY_WEIGHT_STORAGE_KEY, JSON.stringify(mergedEntries));
    }

    if (pendingDeletes.exerciseNotes.length > 0 || pendingDeletes.customExercises.length > 0) {
      await syncProgramMetadataToCloud(user.id);
    }

    currentStatus = {
      isSyncing: false,
      lastSyncedAt: Date.now(),
      error: null,
    };
    notifyListeners();
    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || 'Download sync failed';
    currentStatus = { ...currentStatus, isSyncing: false, error: errorMsg };
    notifyListeners();
    return { success: false, error: errorMsg };
  }
}

/**
 * Syncs a single newly completed or edited workout session to cloud in the background.
 */
export async function syncCompletedWorkout(session: CompletedWorkout): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const user = useAuthStore.getState().user;
  if (!user) return;

  try {
    await ensureAccountIsolation(user.id);
    const { error: wErr } = await supabase.from('workout_history').upsert({
      id: scopedCloudId(user.id, session.id),
      user_id: user.id,
      workout_name: session.workoutName || 'Workout',
      workout_data: session,
      completed_at: session.completedAt || new Date().toISOString(),
    });
    if (wErr) throw wErr;

    await syncProgramMetadataToCloud(user.id);

    currentStatus = { ...currentStatus, lastSyncedAt: Date.now() };
    notifyListeners();
  } catch {
    // Fail silently in background - local state remains authoritative via updatedAt
  }
}

/**
 * Completely wipes all cloud data for the current user from Supabase.
 * Deletes user_programs, workout_history, body_weight_logs, and deletes/clears profiles.
 */
export async function wipeAllCloudUserData(): Promise<{ success: boolean; error?: string; rpcMissing?: boolean }> {
  if (!isSupabaseConfigured()) return { success: true };

  try {
    let user = useAuthStore.getState().user;
    if (!user) {
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData?.session?.user ?? null;
    }
    if (!user) {
      const { data: userData } = await supabase.auth.getUser();
      user = userData?.user ?? null;
    }

    if (!user) {
      return { success: true };
    }

    const userId = user.id;

    try {
      await supabase.auth.updateUser({
        data: {
          name: '',
          full_name: '',
        },
      });
    } catch {
      // Continue
    }

    const { error: rpcErr } = await supabase.rpc('delete_user_account');
    let rpcMissing = false;
    if (rpcErr) {
      console.warn('[cloudSync] RPC delete_user_account error:', rpcErr.message);
      if (rpcErr.code === 'PGRST202') {
        rpcMissing = true;
      }
    }

    await supabase.from('workout_history').delete().eq('user_id', userId);
    await supabase.from('user_programs').delete().eq('user_id', userId);
    await supabase.from('body_weight_logs').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);

    await useAuthStore.getState().signOut();

    currentStatus = {
      isSyncing: false,
      lastSyncedAt: null,
      error: null,
    };
    notifyListeners();

    return { success: !rpcMissing, rpcMissing };
  } catch (err: any) {
    const errorMsg = err?.message || 'Failed to wipe cloud data';
    console.error('[cloudSync] Error during wipeAllCloudUserData:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

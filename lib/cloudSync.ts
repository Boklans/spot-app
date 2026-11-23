import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from './supabase';
import { useAuthStore } from '@/store/authStore';
import { useBodyWeightStore } from '@/store/bodyWeightStore';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore, USER_PROGRAM_STORAGE_KEY } from '@/store/programStore';
import { useUserProfileStore, USER_PROFILE_STORAGE_KEY } from '@/store/userProfileStore';
import { useWorkoutHistoryStore, WORKOUT_HISTORY_STORAGE_KEY } from '@/store/workoutHistoryStore';
import { useExerciseNotesStore, EXERCISE_NOTES_STORAGE_KEY } from '@/store/exerciseNotesStore';
import { loadOnboarding, saveOnboarding } from '@/store/workoutStore';
import type { CompletedWorkout } from '@/types/workout';

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
    const profile = useUserProfileStore.getState().profile;
    const program = useProgramStore.getState().program;
    const progress = useProgramProgressStore.getState().progress;
    const workouts = useWorkoutHistoryStore.getState().workouts;
    const weightEntries = useBodyWeightStore.getState().entries;
    const onboarding = await loadOnboarding();

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

    // 2. Sync Program, Exercise Notes & Extended Profile Meta (sex/age/theme/baselineLifts/duration)
    if (program) {
      const exerciseNotes = await useExerciseNotesStore.getState().loadNotes();
      const { error: progErr } = await supabase.from('user_programs').upsert({
        id: scopedCloudId(user.id, program.id || 'main'),
        user_id: user.id,
        name: program.name,
        days_per_week: program.daysPerWeek,
        program_data: program,
        progress_data: {
          ...progress,
          exerciseNotes,
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
      if (progErr) throw progErr;
    }

    // 3. Sync Workout History
    if (workouts && workouts.length > 0) {
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
    if (weightEntries && weightEntries.length > 0) {
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
    // 1. Fetch Profile
    const { data: profileRow, error: profileFetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (profileFetchErr) throw profileFetchErr;

    // 2. Fetch User Program (also carries extended profileMeta & exerciseNotes)
    const { data: programRow, error: programFetchErr } = await supabase
      .from('user_programs')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (programFetchErr) throw programFetchErr;

    const profileMeta = programRow?.progress_data?.profileMeta as
      | { sex?: 'male' | 'female'; age?: number; theme?: 'dark' | 'light'; baselineLifts?: any; sessionDurationMinutes?: number }
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
        const { exerciseNotes, profileMeta: _pm, ...cleanProgress } = programRow.progress_data;
        useProgramProgressStore.setState({ progress: cleanProgress, hydrated: true });
        await AsyncStorage.setItem('spot-program-progress', JSON.stringify(cleanProgress));
        if (exerciseNotes && typeof exerciseNotes === 'object') {
          const currentNotes = await useExerciseNotesStore.getState().loadNotes();
          const mergedNotes = { ...exerciseNotes, ...currentNotes };
          useExerciseNotesStore.setState({ notes: mergedNotes, hydrated: true });
          await AsyncStorage.setItem(EXERCISE_NOTES_STORAGE_KEY, JSON.stringify(mergedNotes));
        }
      }
    }

    // 3. Fetch & MERGE Workout History (preserve offline workouts!)
    const { data: historyRows, error: histFetchErr } = await supabase
      .from('workout_history')
      .select('workout_data')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });
    if (histFetchErr) throw histFetchErr;

    if (historyRows && historyRows.length > 0) {
      const cloudWorkouts: CompletedWorkout[] = historyRows
        .map((r: any) => r.workout_data)
        .filter(Boolean);
      const localWorkouts = await useWorkoutHistoryStore.getState().loadHistory();
      const byId = new Map<string, CompletedWorkout>();
      for (const lw of localWorkouts) {
        if (lw?.id) byId.set(lw.id, lw);
      }
      for (const cw of cloudWorkouts) {
        if (cw?.id) byId.set(cw.id, cw);
      }
      const mergedWorkouts = Array.from(byId.values()).sort(
        (a, b) => new Date(b.completedAt || b.startedAt).getTime() - new Date(a.completedAt || a.startedAt).getTime()
      );

      useWorkoutHistoryStore.setState({ workouts: mergedWorkouts, hydrated: true });
      await AsyncStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(mergedWorkouts));
    }

    // 4. Fetch & MERGE Body Weight Logs (preserve offline logs!)
    const { data: weightRows, error: weightFetchErr } = await supabase
      .from('body_weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: true });
    if (weightFetchErr) throw weightFetchErr;

    if (weightRows && weightRows.length > 0) {
      const cloudEntries = weightRows.map((r: any) => ({
        id: String(r.id).startsWith(`${user.id}:`) ? String(r.id).slice(user.id.length + 1) : r.id,
        weightKg: Number(r.weight_kg),
        date: r.date,
        timestamp: Number(r.timestamp),
      }));
      const localEntries = await useBodyWeightStore.getState().loadHistory();
      const weightById = new Map<string, { id: string; weightKg: number; date: string; timestamp: number }>();
      for (const le of localEntries) {
        if (le?.id) weightById.set(le.id, le);
      }
      for (const ce of cloudEntries) {
        if (ce?.id) weightById.set(ce.id, ce);
      }
      const mergedEntries = Array.from(weightById.values()).sort((a, b) => a.timestamp - b.timestamp);

      useBodyWeightStore.setState({ entries: mergedEntries });
      await AsyncStorage.setItem('spot-body-weight-history', JSON.stringify(mergedEntries));
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
 * Syncs a single newly completed workout session to cloud in the background.
 */
export async function syncCompletedWorkout(session: CompletedWorkout): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const user = useAuthStore.getState().user;
  if (!user) return;

  try {
    const { error: wErr } = await supabase.from('workout_history').upsert({
      id: scopedCloudId(user.id, session.id),
      user_id: user.id,
      workout_name: session.workoutName || 'Workout',
      workout_data: session,
      completed_at: session.completedAt || new Date().toISOString(),
    });
    if (wErr) throw wErr;

    // Also sync latest program progress WITHOUT overwriting exerciseNotes or profileMeta
    const program = useProgramStore.getState().program;
    const progress = useProgramProgressStore.getState().progress;
    const profile = useUserProfileStore.getState().profile;
    const onboarding = await loadOnboarding();
    if (program) {
      const exerciseNotes = await useExerciseNotesStore.getState().loadNotes();
      const { error: pErr } = await supabase.from('user_programs').upsert({
        id: scopedCloudId(user.id, program.id || 'main'),
        user_id: user.id,
        name: program.name,
        days_per_week: program.daysPerWeek,
        program_data: program,
        progress_data: {
          ...progress,
          exerciseNotes,
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
      if (pErr) throw pErr;
    }

    currentStatus = { ...currentStatus, lastSyncedAt: Date.now() };
    notifyListeners();
  } catch {
    // Fail silently in background - offline queue
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

    // 1. Wipe user_metadata on auth.users so name and details are removed
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

    // 2. Permanently delete user from auth.users via RPC
    const { error: rpcErr } = await supabase.rpc('delete_user_account');
    let rpcMissing = false;
    if (rpcErr) {
      console.warn('[cloudSync] RPC delete_user_account error:', rpcErr.message);
      if (rpcErr.code === 'PGRST202') {
        rpcMissing = true;
      }
    }

    // 3. Fallback explicit delete for all tables
    await supabase.from('workout_history').delete().eq('user_id', userId);
    await supabase.from('user_programs').delete().eq('user_id', userId);
    await supabase.from('body_weight_logs').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);

    // 4. Sign out
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

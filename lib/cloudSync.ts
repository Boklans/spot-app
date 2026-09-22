import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from './supabase';
import { useAuthStore } from '@/store/authStore';
import { useBodyWeightStore } from '@/store/bodyWeightStore';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore, USER_PROGRAM_STORAGE_KEY } from '@/store/programStore';
import { useUserProfileStore, USER_PROFILE_STORAGE_KEY } from '@/store/userProfileStore';
import { useWorkoutHistoryStore, WORKOUT_HISTORY_STORAGE_KEY } from '@/store/workoutHistoryStore';
import { saveOnboarding } from '@/store/workoutStore';
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

    // 1. Sync Profile
    await supabase.from('profiles').upsert({
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

    // 2. Sync Program
    if (program) {
      await supabase.from('user_programs').upsert({
        id: program.id || `prog-${user.id}`,
        user_id: user.id,
        name: program.name,
        days_per_week: program.daysPerWeek,
        program_data: program,
        progress_data: progress,
        updated_at: new Date().toISOString(),
      });
    }

    // 3. Sync Workout History
    if (workouts && workouts.length > 0) {
      const workoutRows = workouts.map((w) => ({
        id: w.id,
        user_id: user.id,
        workout_name: w.workoutName || 'Workout',
        workout_data: w,
        completed_at: w.completedAt || new Date().toISOString(),
      }));

      await supabase.from('workout_history').upsert(workoutRows);
    }

    // 4. Sync Body Weight Entries
    if (weightEntries && weightEntries.length > 0) {
      const weightRows = weightEntries.map((e) => ({
        id: e.id,
        user_id: user.id,
        weight_kg: e.weightKg,
        date: e.date,
        timestamp: e.timestamp,
        created_at: new Date(e.timestamp).toISOString(),
      }));

      await supabase.from('body_weight_logs').upsert(weightRows);
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
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileRow) {
      const mergedProfile = {
        name: profileRow.name || 'Athlete',
        avatar: profileRow.avatar || 'gorilla',
        weightKg: Number(profileRow.weight_kg) || 78,
        heightCm: Number(profileRow.height_cm) || 180,
        goal: profileRow.goal || 'Build Muscle',
        experience: profileRow.experience || 'Intermediate',
        workoutsPerWeek: Number(profileRow.workouts_per_week) || 3,
        weightUnit: profileRow.weight_unit || 'kg',
        heightUnit: profileRow.height_unit || 'cm',
        defaultRestSeconds: Number(profileRow.default_rest_seconds) || 90,
        language: profileRow.language || 'uk',
        notifications: true,
        notificationTime: '09:00',
        soundEnabled: true,
      };

      useUserProfileStore.setState({ profile: mergedProfile, hydrated: true });
      await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(mergedProfile));
      await saveOnboarding({
        name: mergedProfile.name,
        goal: mergedProfile.goal as any,
        experience: mergedProfile.experience as any,
        trainingFrequency: mergedProfile.workoutsPerWeek,
        equipment: ['full_gym'],
        completed: true,
      });
    }

    // 2. Fetch User Program
    const { data: programRow } = await supabase
      .from('user_programs')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (programRow && programRow.program_data) {
      useProgramStore.setState({ program: programRow.program_data });
      await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(programRow.program_data));
      await AsyncStorage.setItem('spot-program', JSON.stringify(programRow.program_data));

      if (programRow.progress_data) {
        useProgramProgressStore.setState({ progress: programRow.progress_data });
        await AsyncStorage.setItem('spot-program-progress', JSON.stringify(programRow.progress_data));
      }
    }

    // 3. Fetch Workout History
    const { data: historyRows } = await supabase
      .from('workout_history')
      .select('workout_data')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });

    if (historyRows && historyRows.length > 0) {
      const cloudWorkouts: CompletedWorkout[] = historyRows
        .map((r: any) => r.workout_data)
        .filter(Boolean);

      useWorkoutHistoryStore.setState({ workouts: cloudWorkouts, hydrated: true });
      await AsyncStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(cloudWorkouts));
    }

    // 4. Fetch Body Weight Logs
    const { data: weightRows } = await supabase
      .from('body_weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: true });

    if (weightRows && weightRows.length > 0) {
      const entries = weightRows.map((r: any) => ({
        id: r.id,
        weightKg: Number(r.weight_kg),
        date: r.date,
        timestamp: Number(r.timestamp),
      }));

      useBodyWeightStore.setState({ entries });
      await AsyncStorage.setItem('spot-body-weight-history', JSON.stringify(entries));
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
    await supabase.from('workout_history').upsert({
      id: session.id,
      user_id: user.id,
      workout_name: session.workoutName || 'Workout',
      workout_data: session,
      completed_at: session.completedAt || new Date().toISOString(),
    });

    // Also sync latest program progress
    const program = useProgramStore.getState().program;
    const progress = useProgramProgressStore.getState().progress;
    if (program) {
      await supabase.from('user_programs').upsert({
        id: program.id || `prog-${user.id}`,
        user_id: user.id,
        name: program.name,
        days_per_week: program.daysPerWeek,
        program_data: program,
        progress_data: progress,
        updated_at: new Date().toISOString(),
      });
    }

    currentStatus = { ...currentStatus, lastSyncedAt: Date.now() };
    notifyListeners();
  } catch {
    // Fail silently in background - offline queue
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BODY_WEIGHT_STORAGE_KEY, useBodyWeightStore } from '@/store/bodyWeightStore';
import { useCustomExercisesStore, type CustomExercise } from '@/store/customExercisesStore';
import { EXERCISE_NOTES_STORAGE_KEY, useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { useProgramStore } from '@/store/programStore';
import { useUserProfileStore, type UserProfile } from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import type { UserProgram } from '@/types/userProgram';
import type { CompletedWorkout } from '@/types/workout';

export interface SpotBackupPayload {
  app: 'SPOT';
  version: string;
  exportedAt: string;
  profile: UserProfile;
  program: UserProgram;
  workouts: CompletedWorkout[];
  notes: Record<string, string>;
  bodyWeight: Array<{
    id: string;
    date: string;
    timestamp: number;
    weightKg: number;
    note?: string;
  }>;
  customExercises: CustomExercise[];
}

export function buildSpotBackupPayload(version = '1.0.4'): SpotBackupPayload {
  return {
    app: 'SPOT',
    version,
    exportedAt: new Date().toISOString(),
    profile: useUserProfileStore.getState().profile,
    program: useProgramStore.getState().program,
    workouts: useWorkoutHistoryStore.getState().workouts,
    notes: useExerciseNotesStore.getState().notes,
    bodyWeight: useBodyWeightStore.getState().entries,
    customExercises: useCustomExercisesStore.getState().customExercises,
  };
}

function sanitizeCustomExercises(raw: unknown): CustomExercise[] {
  if (!Array.isArray(raw)) return [];
  const validMuscles = new Set(['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core']);
  const validEquipment = new Set(['barbell', 'dumbbells', 'machines', 'cables', 'bodyweight', 'kettlebells']);

  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .filter(
      (item) =>
        typeof item.id === 'string' &&
        item.id.trim().length > 0 &&
        typeof item.name === 'string' &&
        item.name.trim().length > 0
    )
    .map((item) => ({
      id: String(item.id).trim(),
      name: String(item.name).trim().slice(0, 80),
      muscleGroup: (validMuscles.has(String(item.muscleGroup)) ? item.muscleGroup : 'Chest') as CustomExercise['muscleGroup'],
      equipment: (validEquipment.has(String(item.equipment)) ? item.equipment : 'dumbbells') as CustomExercise['equipment'],
      weightIncrement:
        typeof item.weightIncrement === 'number' && item.weightIncrement > 0 ? item.weightIncrement : 2.5,
      defaultSets: typeof item.defaultSets === 'number' && item.defaultSets > 0 ? Math.round(item.defaultSets) : 3,
      defaultRepRange: typeof item.defaultRepRange === 'string' && item.defaultRepRange ? item.defaultRepRange : '8-12',
      defaultWeight: typeof item.defaultWeight === 'number' && item.defaultWeight >= 0 ? item.defaultWeight : 0,
      ...(typeof item.customImageUri === 'string' && item.customImageUri ? { customImageUri: item.customImageUri } : {}),
      createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : new Date().toISOString(),
      isCustom: true as const,
    }));
}

export async function restoreSpotBackupPayload(
  rawJson: string
): Promise<{ ok: boolean; workoutsCount?: number; reason?: 'empty' | 'invalid_json' | 'empty_payload' }> {
  const trimmed = (rawJson || '').trim();
  if (!trimmed) {
    return { ok: false, reason: 'empty' };
  }

  let parsed: Record<string, unknown>;
  try {
    const candidate = JSON.parse(trimmed);
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return { ok: false, reason: 'invalid_json' };
    }
    parsed = candidate as Record<string, unknown>;
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }

  const hasWorkouts = Array.isArray(parsed.workouts);
  const hasProgram = Boolean(
    parsed.program &&
      typeof parsed.program === 'object' &&
      Array.isArray((parsed.program as UserProgram).workouts)
  );
  const hasNotes = Boolean(parsed.notes && typeof parsed.notes === 'object' && !Array.isArray(parsed.notes));
  const hasCustomExercises = Array.isArray(parsed.customExercises);

  if (!hasWorkouts && !hasProgram && !hasNotes && !hasCustomExercises) {
    return { ok: false, reason: 'empty_payload' };
  }

  if (hasCustomExercises) {
    const sanitizedCustom = sanitizeCustomExercises(parsed.customExercises);
    await useCustomExercisesStore.getState().replaceCustomExercises(sanitizedCustom);
  }

  if (hasWorkouts) {
    await useWorkoutHistoryStore.getState().replaceHistory(parsed.workouts as CompletedWorkout[]);
  }

  if (hasProgram) {
    const incomingProg = parsed.program as UserProgram;
    if (incomingProg.splitType === 'custom') {
      await useProgramStore.getState().setCustomProgram(incomingProg);
    } else {
      await useProgramStore.getState().setPresetProgram(incomingProg);
    }
  }

  if (hasNotes) {
    const sanitizedNotes: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.notes as Record<string, unknown>)) {
      if (typeof k === 'string' && typeof v === 'string') {
        sanitizedNotes[k] = v.slice(0, 1000);
      }
    }
    await AsyncStorage.setItem(EXERCISE_NOTES_STORAGE_KEY, JSON.stringify(sanitizedNotes));
    await useExerciseNotesStore.getState().loadNotes();
  }

  if (Array.isArray(parsed.bodyWeight) && parsed.bodyWeight.length > 0) {
    const sanitizedWeight = parsed.bodyWeight
      .filter(
        (e: any) =>
          e &&
          typeof e === 'object' &&
          typeof e.weightKg === 'number' &&
          Number.isFinite(e.weightKg) &&
          e.weightKg >= 20 &&
          e.weightKg <= 350 &&
          typeof e.date === 'string'
      )
      .map((e: any, idx: number) => ({
        id: typeof e.id === 'string' && e.id ? e.id : `bw-import-${Date.now()}-${idx}`,
        weightKg: Math.round(e.weightKg * 10) / 10,
        date: e.date,
        timestamp: typeof e.timestamp === 'number' && Number.isFinite(e.timestamp) ? e.timestamp : Date.now(),
        ...(typeof e.note === 'string' ? { note: e.note } : {}),
      }));
    if (sanitizedWeight.length > 0) {
      await AsyncStorage.setItem(BODY_WEIGHT_STORAGE_KEY, JSON.stringify(sanitizedWeight));
      await useBodyWeightStore.getState().loadHistory();
    }
  }

  if (parsed.profile && typeof parsed.profile === 'object' && !Array.isArray(parsed.profile)) {
    const p = parsed.profile as Record<string, unknown>;
    const safeProfileUpdates: Partial<UserProfile> = {};
    if (typeof p.name === 'string') safeProfileUpdates.name = p.name.trim().slice(0, 20);
    if (typeof p.age === 'number' && p.age >= 12 && p.age <= 100) safeProfileUpdates.age = Math.round(p.age);
    if (p.sex === 'male' || p.sex === 'female' || p.sex === 'unspecified') safeProfileUpdates.sex = p.sex;
    if (typeof p.weightKg === 'number' && p.weightKg >= 20 && p.weightKg <= 350) safeProfileUpdates.weightKg = p.weightKg;
    if (typeof p.heightCm === 'number' && p.heightCm >= 80 && p.heightCm <= 250) safeProfileUpdates.heightCm = p.heightCm;
    if (p.weightUnit === 'kg' || p.weightUnit === 'lbs') safeProfileUpdates.weightUnit = p.weightUnit;
    if (p.heightUnit === 'cm' || p.heightUnit === 'ft') safeProfileUpdates.heightUnit = p.heightUnit;
    if (p.language === 'en' || p.language === 'uk') safeProfileUpdates.language = p.language;
    if (p.theme === 'dark' || p.theme === 'light') safeProfileUpdates.theme = p.theme;
    if (typeof p.defaultRestSeconds === 'number' && p.defaultRestSeconds >= 15 && p.defaultRestSeconds <= 600) {
      safeProfileUpdates.defaultRestSeconds = p.defaultRestSeconds;
    }
    if (typeof p.workoutsPerWeek === 'number' && p.workoutsPerWeek >= 1 && p.workoutsPerWeek <= 7) {
      safeProfileUpdates.workoutsPerWeek = p.workoutsPerWeek;
    }
    if (Object.keys(safeProfileUpdates).length > 0) {
      await useUserProfileStore.getState().updateProfile(safeProfileUpdates);
    }
  }

  return {
    ok: true,
    workoutsCount: hasWorkouts ? useWorkoutHistoryStore.getState().workouts.length : 0,
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { generateProgram, type GeneratedProgram } from '@/lib/programGenerator';
import { generateUUID, migrateGeneratedToUserProgram } from '@/lib/programMigration';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { defaultOnboarding, loadOnboarding, saveOnboarding, type OnboardingData } from '@/store/workoutStore';
import type { UserProgram } from '@/types/userProgram';

export const USER_PROGRAM_STORAGE_KEY = 'spot-user-program';
export const CUSTOM_PROGRAM_STORAGE_KEY = 'spot-custom-program';
export const LEGACY_PROGRAM_STORAGE_KEY = 'spot-active-program';
export const ACTIVE_PROGRAM_STORAGE_KEY = USER_PROGRAM_STORAGE_KEY;

type ProgramState = {
  program: UserProgram;
  hydrated: boolean;
  loadProgram: () => Promise<UserProgram>;
  refreshProgram: (onboarding?: OnboardingData) => Promise<UserProgram>;
  updateUserProgram: (updatedProgram: UserProgram) => Promise<void>;
  setCustomProgram: (customProgram: UserProgram) => Promise<void>;
  saveRoutine: (routine: UserProgram) => Promise<void>;
  getOrLoadProgram: () => Promise<UserProgram>;
};

function parseStoredUserProgram(value: string | null): UserProgram | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const prog = parsed as Record<string, unknown>;
    if (
      typeof prog.id === 'string' &&
      typeof prog.name === 'string' &&
      typeof prog.daysPerWeek === 'number' &&
      typeof prog.splitType === 'string' &&
      Array.isArray(prog.workouts) &&
      prog.workouts.length > 0
    ) {
      return parsed as UserProgram;
    }
    return null;
  } catch {
    return null;
  }
}

function parseStoredLegacyProgram(value: string | null): GeneratedProgram | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const prog = parsed as Record<string, unknown>;
    if (
      typeof prog.id === 'string' &&
      typeof prog.name === 'string' &&
      typeof prog.daysPerWeek === 'number' &&
      typeof prog.splitType === 'string' &&
      Array.isArray(prog.workouts) &&
      prog.workouts.length > 0
    ) {
      return parsed as GeneratedProgram;
    }
    return null;
  } catch {
    return null;
  }
}

const defaultProgram = migrateGeneratedToUserProgram(generateProgram(defaultOnboarding));

export const useProgramStore = create<ProgramState>((set, get) => ({
  program: defaultProgram,
  hydrated: false,

  loadProgram: async () => {
    if (get().hydrated) return get().program;

    try {
      const storedUserProgram = await AsyncStorage.getItem(USER_PROGRAM_STORAGE_KEY);
      const parsedUserProgram = parseStoredUserProgram(storedUserProgram);

      if (parsedUserProgram) {
        set({ program: parsedUserProgram, hydrated: true });
        await useProgramProgressStore.getState().loadProgress(parsedUserProgram);
        return parsedUserProgram;
      }

      const storedCustom = await AsyncStorage.getItem(CUSTOM_PROGRAM_STORAGE_KEY);
      const parsedCustom = parseStoredUserProgram(storedCustom);
      if (parsedCustom) {
        await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(parsedCustom));
        set({ program: parsedCustom, hydrated: true });
        await useProgramProgressStore.getState().loadProgress(parsedCustom);
        return parsedCustom;
      }

      const storedLegacyProgram = await AsyncStorage.getItem(LEGACY_PROGRAM_STORAGE_KEY);
      const parsedLegacyProgram = parseStoredLegacyProgram(storedLegacyProgram);

      if (parsedLegacyProgram) {
        const migrated = migrateGeneratedToUserProgram(parsedLegacyProgram);
        await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(migrated));
        await AsyncStorage.removeItem(LEGACY_PROGRAM_STORAGE_KEY);
        set({ program: migrated, hydrated: true });
        await useProgramProgressStore.getState().loadProgress(migrated);
        return migrated;
      }

      const onboarding = await loadOnboarding();
      const generated = generateProgram(onboarding ?? defaultOnboarding);
      const userProgram = migrateGeneratedToUserProgram(generated);
      await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(userProgram));
      set({ program: userProgram, hydrated: true });
      await useProgramProgressStore.getState().loadProgress(userProgram);
      return userProgram;
    } catch {
      const fallback = migrateGeneratedToUserProgram(generateProgram(defaultOnboarding));
      set({ program: fallback, hydrated: true });
      await useProgramProgressStore.getState().loadProgress(fallback);
      return fallback;
    }
  },

  refreshProgram: async (onboarding?: OnboardingData) => {
    const data = onboarding ?? (await loadOnboarding()) ?? defaultOnboarding;

    // If split preference is 'custom', check if we have a saved custom program first
    if (data.splitPreference === 'custom') {
      try {
        const savedCustom = await AsyncStorage.getItem(CUSTOM_PROGRAM_STORAGE_KEY);
        const parsedCustom = parseStoredUserProgram(savedCustom);
        if (parsedCustom) {
          await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(parsedCustom));
          set({ program: parsedCustom, hydrated: true });
          await useProgramProgressStore.getState().loadProgress(parsedCustom);
          return parsedCustom;
        }
      } catch {
        // Fallback to generate
      }
    }

    const generated = generateProgram(data);
    const userProgram = migrateGeneratedToUserProgram(generated);

    try {
      await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(userProgram));
      await AsyncStorage.removeItem(LEGACY_PROGRAM_STORAGE_KEY);
    } catch {
      // Storage write error ignored
    }

    set({ program: userProgram, hydrated: true });
    await useProgramProgressStore.getState().loadProgress(userProgram);
    return userProgram;
  },

  updateUserProgram: async (updatedProgram: UserProgram) => {
    if (updatedProgram.splitType === 'custom') {
      return get().setCustomProgram(updatedProgram);
    }

    const cloned: UserProgram = JSON.parse(JSON.stringify(updatedProgram));
    cloned.updatedAt = new Date().toISOString();

    try {
      await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(cloned));
    } catch {
      // Storage write error ignored
    }

    set({ program: cloned, hydrated: true });
    await useProgramProgressStore.getState().loadProgress(cloned);
  },

  setCustomProgram: async (customProgram: UserProgram) => {
    // Deep clone the entire custom program object including workouts, exercises, set/rep logic
    const cloned: UserProgram = JSON.parse(JSON.stringify(customProgram));
    cloned.id = cloned.id || `custom-${Date.now()}`;
    cloned.splitType = 'custom';
    cloned.name = (cloned.name && cloned.name.trim().length > 0) ? cloned.name.trim() : 'Custom Routine';
    cloned.description = cloned.description || 'Your custom workouts built from scratch.';
    cloned.createdAt = cloned.createdAt || new Date().toISOString();
    cloned.updatedAt = new Date().toISOString();

    // Deep normalize workouts and exercises to guarantee full structure and data preservation
    if (Array.isArray(cloned.workouts)) {
      cloned.workouts = cloned.workouts.map((workout, wIdx) => {
        const exercises = Array.isArray(workout.exercises)
          ? workout.exercises.map((exercise, exIdx) => ({
              id: exercise.id || generateUUID(),
              name: exercise.name || `Exercise ${exIdx + 1}`,
              muscleGroup: exercise.muscleGroup || 'Full Body',
              sets: typeof exercise.sets === 'number' && exercise.sets > 0 ? exercise.sets : 3,
              recommendedWeight: typeof exercise.recommendedWeight === 'number' ? exercise.recommendedWeight : 0,
              targetRepRange: exercise.targetRepRange || '8-12',
              equipment: exercise.equipment || 'barbell',
              weightIncrement: typeof exercise.weightIncrement === 'number' ? exercise.weightIncrement : 2.5,
              ...(typeof exercise.restSeconds === 'number' ? { restSeconds: exercise.restSeconds } : {}),
            }))
          : [];

        const uniqueMuscles = Array.isArray(workout.muscleGroups) && workout.muscleGroups.length > 0
          ? workout.muscleGroups
          : [...new Set(exercises.map((e) => e.muscleGroup))];

        return {
          id: workout.id || generateUUID(),
          name: workout.name || `Workout ${String.fromCharCode(65 + wIdx)}`,
          dayLabel: workout.dayLabel || `Day ${wIdx + 1}`,
          muscleGroups: uniqueMuscles,
          estimatedMinutes: typeof workout.estimatedMinutes === 'number' && workout.estimatedMinutes > 0
            ? workout.estimatedMinutes
            : Math.max(30, exercises.length * 9),
          ...(typeof workout.defaultRestSeconds === 'number' ? { defaultRestSeconds: workout.defaultRestSeconds } : {}),
          exercises,
        };
      });
    } else {
      cloned.workouts = [];
    }

    cloned.daysPerWeek = cloned.workouts.length > 0
      ? Math.min(7, cloned.workouts.length)
      : (typeof cloned.daysPerWeek === 'number' && cloned.daysPerWeek > 0 ? cloned.daysPerWeek : 3);

    try {
      await AsyncStorage.setItem(CUSTOM_PROGRAM_STORAGE_KEY, JSON.stringify(cloned));
      await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(cloned));
      await AsyncStorage.removeItem(LEGACY_PROGRAM_STORAGE_KEY);

      // Persist onboarding split preference to 'custom'
      const currentOnboarding = await loadOnboarding();
      await saveOnboarding({
        ...(currentOnboarding ?? defaultOnboarding),
        splitPreference: 'custom',
      });
    } catch {
      // Storage write error ignored
    }

    set({ program: cloned, hydrated: true });
    await useProgramProgressStore.getState().loadProgress(cloned);
  },

  saveRoutine: async (routine: UserProgram) => {
    return get().setCustomProgram(routine);
  },

  getOrLoadProgram: async () => {
    if (get().hydrated && get().program) {
      return get().program;
    }
    return get().loadProgram();
  },
}));

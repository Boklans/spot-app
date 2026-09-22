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
  resetProgram: () => Promise<UserProgram>;
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

      const onboarding = await loadOnboarding();
      if (onboarding?.splitPreference === 'custom') {
        const storedCustom = await AsyncStorage.getItem(CUSTOM_PROGRAM_STORAGE_KEY);
        const parsedCustom = parseStoredUserProgram(storedCustom);
        if (parsedCustom) {
          await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(parsedCustom));
          set({ program: parsedCustom, hydrated: true });
          await useProgramProgressStore.getState().loadProgress(parsedCustom);
          return parsedCustom;
        }
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

    // Only load saved custom routine if splitPreference is explicitly 'custom'
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
        const currentProg = get().program;
        if (currentProg && currentProg.splitType === 'custom' && currentProg.workouts?.length > 0) {
          await AsyncStorage.setItem(CUSTOM_PROGRAM_STORAGE_KEY, JSON.stringify(currentProg));
          await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(currentProg));
          set({ program: currentProg, hydrated: true });
          return currentProg;
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

  resetProgram: async () => {
    try {
      await AsyncStorage.multiRemove([
        USER_PROGRAM_STORAGE_KEY,
        CUSTOM_PROGRAM_STORAGE_KEY,
        LEGACY_PROGRAM_STORAGE_KEY,
        'spot-program',
      ]);
    } catch {
      // Storage write error ignored
    }

    const freshGenerated = generateProgram(defaultOnboarding);
    const freshUserProg = migrateGeneratedToUserProgram(freshGenerated);

    try {
      await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(freshUserProg));
    } catch {
      // Ignore
    }

    set({ program: freshUserProg, hydrated: true });
    await useProgramProgressStore.getState().resetProgress(freshUserProg.id, freshUserProg.workouts[0]?.id);
    return freshUserProg;
  },

  updateUserProgram: async (updatedProgram: UserProgram) => {
    return get().setCustomProgram({
      ...updatedProgram,
      splitType: 'custom',
    });
  },

  setCustomProgram: async (customProgram: UserProgram) => {
    // Deep clone the entire custom program object including workouts, exercises, set/rep logic
    const cloned: UserProgram = JSON.parse(JSON.stringify(customProgram));
    const now = new Date().toISOString();
    cloned.id = cloned.id && cloned.id.startsWith('custom-') ? cloned.id : `custom-${Date.now()}`;
    cloned.splitType = 'custom';
    cloned.name = (cloned.name && cloned.name.trim().length > 0) ? cloned.name.trim() : 'Custom Routine';
    cloned.description = cloned.description || 'Your custom workouts built from scratch.';
    cloned.createdAt = cloned.createdAt || now;
    cloned.updatedAt = now;

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

    // Reset progress to the first workout of the updated custom program
    if (cloned.workouts.length > 0) {
      await useProgramProgressStore.getState().resetProgress(cloned.id, cloned.workouts[0].id);
    } else {
      await useProgramProgressStore.getState().loadProgress(cloned);
    }

    set({ program: cloned, hydrated: true });
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

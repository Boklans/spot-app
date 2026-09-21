import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { generateProgram, type GeneratedProgram } from '@/lib/programGenerator';
import { migrateGeneratedToUserProgram } from '@/lib/programMigration';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { defaultOnboarding, loadOnboarding, type OnboardingData } from '@/store/workoutStore';
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
    const cloned: UserProgram = JSON.parse(JSON.stringify(updatedProgram));
    cloned.updatedAt = new Date().toISOString();

    try {
      await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(cloned));
      if (cloned.splitType === 'custom') {
        await AsyncStorage.setItem(CUSTOM_PROGRAM_STORAGE_KEY, JSON.stringify(cloned));
      }
    } catch {
      // Storage write error ignored
    }

    set({ program: cloned, hydrated: true });
    await useProgramProgressStore.getState().loadProgress(cloned);
  },

  setCustomProgram: async (customProgram: UserProgram) => {
    const cloned: UserProgram = JSON.parse(JSON.stringify(customProgram));
    cloned.splitType = 'custom';
    cloned.updatedAt = new Date().toISOString();

    try {
      await AsyncStorage.setItem(CUSTOM_PROGRAM_STORAGE_KEY, JSON.stringify(cloned));
      await AsyncStorage.setItem(USER_PROGRAM_STORAGE_KEY, JSON.stringify(cloned));
      await AsyncStorage.removeItem(LEGACY_PROGRAM_STORAGE_KEY);
    } catch {
      // Storage write error ignored
    }

    set({ program: cloned, hydrated: true });
    await useProgramProgressStore.getState().loadProgress(cloned);
  },

  getOrLoadProgram: async () => {
    if (get().hydrated && get().program) {
      return get().program;
    }
    return get().loadProgram();
  },
}));

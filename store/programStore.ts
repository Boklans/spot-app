import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { generateProgram, type GeneratedProgram } from '@/lib/programGenerator';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { defaultOnboarding, loadOnboarding, type OnboardingData } from '@/store/workoutStore';

export const ACTIVE_PROGRAM_STORAGE_KEY = 'spot-active-program';

type ProgramState = {
  program: GeneratedProgram;
  hydrated: boolean;
  loadProgram: () => Promise<GeneratedProgram>;
  refreshProgram: (onboarding?: OnboardingData) => Promise<GeneratedProgram>;
  getOrLoadProgram: () => Promise<GeneratedProgram>;
};

function parseStoredProgram(value: string | null): GeneratedProgram | null {
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

export const useProgramStore = create<ProgramState>((set, get) => ({
  program: generateProgram(defaultOnboarding),
  hydrated: false,

  loadProgram: async () => {
    if (get().hydrated) return get().program;

    try {
      const stored = await AsyncStorage.getItem(ACTIVE_PROGRAM_STORAGE_KEY);
      const parsed = parseStoredProgram(stored);

      if (parsed) {
        set({ program: parsed, hydrated: true });
        await useProgramProgressStore.getState().loadProgress(parsed);
        return parsed;
      }

      const onboarding = await loadOnboarding();
      const generated = generateProgram(onboarding ?? defaultOnboarding);
      await AsyncStorage.setItem(ACTIVE_PROGRAM_STORAGE_KEY, JSON.stringify(generated));
      set({ program: generated, hydrated: true });
      await useProgramProgressStore.getState().loadProgress(generated);
      return generated;
    } catch {
      const fallback = generateProgram(defaultOnboarding);
      set({ program: fallback, hydrated: true });
      await useProgramProgressStore.getState().loadProgress(fallback);
      return fallback;
    }
  },

  refreshProgram: async (onboarding?: OnboardingData) => {
    const data = onboarding ?? (await loadOnboarding()) ?? defaultOnboarding;
    const generated = generateProgram(data);

    try {
      await AsyncStorage.setItem(ACTIVE_PROGRAM_STORAGE_KEY, JSON.stringify(generated));
    } catch {
      // Storage write error ignored
    }

    set({ program: generated, hydrated: true });
    await useProgramProgressStore.getState().loadProgress(generated);
    return generated;
  },

  getOrLoadProgram: async () => {
    if (get().hydrated && get().program) {
      return get().program;
    }
    return get().loadProgram();
  },
}));


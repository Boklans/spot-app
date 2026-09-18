import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { GeneratedProgram } from '@/lib/programGenerator';

export const PROGRAM_PROGRESS_STORAGE_KEY = 'spot-program-progress';

export type ProgramProgress = {
  programId: string;
  nextSequenceIndex: number;
  completedWorkoutCount: number;
  lastCompletedWorkoutId?: string;
  lastCompletedSessionId?: string;
  updatedAt: string;
};

type ProgramProgressState = {
  progress: ProgramProgress | null;
  hydrated: boolean;
  loadProgress: (program: GeneratedProgram) => Promise<ProgramProgress>;
  advanceProgress: (program: GeneratedProgram, completedWorkoutId: string, sessionId?: string) => Promise<ProgramProgress>;
  resetProgress: (programId: string) => Promise<ProgramProgress>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function parseProgress(value: string | null): ProgramProgress | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return null;
    if (
      typeof parsed.programId !== 'string' ||
      typeof parsed.nextSequenceIndex !== 'number' ||
      typeof parsed.completedWorkoutCount !== 'number' ||
      typeof parsed.updatedAt !== 'string'
    ) {
      return null;
    }
    return {
      programId: parsed.programId,
      nextSequenceIndex: parsed.nextSequenceIndex,
      completedWorkoutCount: parsed.completedWorkoutCount,
      lastCompletedWorkoutId: typeof parsed.lastCompletedWorkoutId === 'string' ? parsed.lastCompletedWorkoutId : undefined,
      lastCompletedSessionId: typeof parsed.lastCompletedSessionId === 'string' ? parsed.lastCompletedSessionId : undefined,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export const useProgramProgressStore = create<ProgramProgressState>((set, get) => ({
  progress: null,
  hydrated: false,

  loadProgress: async (program: GeneratedProgram) => {
    try {
      const stored = await AsyncStorage.getItem(PROGRAM_PROGRESS_STORAGE_KEY);
      const parsed = parseProgress(stored);

      if (!parsed || parsed.programId !== program.id) {
        const initial: ProgramProgress = {
          programId: program.id,
          nextSequenceIndex: 0,
          completedWorkoutCount: 0,
          updatedAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(PROGRAM_PROGRESS_STORAGE_KEY, JSON.stringify(initial));
        set({ progress: initial, hydrated: true });
        return initial;
      }

      if (parsed.nextSequenceIndex < 0 || parsed.nextSequenceIndex >= program.workouts.length) {
        const corrected: ProgramProgress = {
          ...parsed,
          nextSequenceIndex: 0,
          updatedAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(PROGRAM_PROGRESS_STORAGE_KEY, JSON.stringify(corrected));
        set({ progress: corrected, hydrated: true });
        return corrected;
      }

      set({ progress: parsed, hydrated: true });
      return parsed;
    } catch {
      const fallback: ProgramProgress = {
        programId: program.id,
        nextSequenceIndex: 0,
        completedWorkoutCount: 0,
        updatedAt: new Date().toISOString(),
      };
      set({ progress: fallback, hydrated: true });
      return fallback;
    }
  },

  advanceProgress: async (program: GeneratedProgram, completedWorkoutId: string, sessionId?: string) => {
    const current = get().progress && get().progress?.programId === program.id
      ? (get().progress as ProgramProgress)
      : await get().loadProgress(program);

    if (sessionId && current.lastCompletedSessionId === sessionId) {
      return current;
    }

    const workoutsCount = Math.max(1, program.workouts.length);
    const completedIndex = program.workouts.findIndex((workout) => workout.id === completedWorkoutId);
    const nextSequenceIndex = (completedIndex >= 0 ? completedIndex + 1 : current.nextSequenceIndex + 1) % workoutsCount;

    const next: ProgramProgress = {
      programId: program.id,
      nextSequenceIndex,
      completedWorkoutCount: current.completedWorkoutCount + 1,
      lastCompletedWorkoutId: completedWorkoutId,
      lastCompletedSessionId: sessionId,
      updatedAt: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(PROGRAM_PROGRESS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Continue even if local storage temporarily failed
    }

    set({ progress: next, hydrated: true });
    return next;
  },

  resetProgress: async (programId: string) => {
    const reset: ProgramProgress = {
      programId,
      nextSequenceIndex: 0,
      completedWorkoutCount: 0,
      updatedAt: new Date().toISOString(),
    };
    try {
      await AsyncStorage.setItem(PROGRAM_PROGRESS_STORAGE_KEY, JSON.stringify(reset));
    } catch {
      // Continue
    }
    set({ progress: reset, hydrated: true });
    return reset;
  },
}));


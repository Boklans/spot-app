import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { GeneratedProgram, GeneratedWorkout } from '@/lib/programGenerator';
import type { UserProgram, UserWorkout } from '@/types/userProgram';

export const PROGRAM_PROGRESS_STORAGE_KEY = 'spot-program-progress';

export type ProgramProgress = {
  programId: string;
  nextWorkoutId: string;
  completedWorkoutCount: number;
  lastCompletedWorkoutId?: string;
  lastCompletedSessionId?: string;
  updatedAt: string;
};

type ParsedRawProgress = {
  programId: string;
  nextWorkoutId?: string;
  nextSequenceIndex?: number;
  completedWorkoutCount: number;
  lastCompletedWorkoutId?: string;
  lastCompletedSessionId?: string;
  updatedAt: string;
};

type ProgramProgressState = {
  progress: ProgramProgress | null;
  hydrated: boolean;
  loadProgress: (program: UserProgram | GeneratedProgram) => Promise<ProgramProgress>;
  advanceProgress: (program: UserProgram | GeneratedProgram, completedWorkoutId: string, sessionId?: string) => Promise<ProgramProgress>;
  resetProgress: (programId: string, initialWorkoutId?: string) => Promise<ProgramProgress>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function parseProgress(value: string | null): ParsedRawProgress | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return null;
    if (
      typeof parsed.programId !== 'string' ||
      typeof parsed.completedWorkoutCount !== 'number' ||
      typeof parsed.updatedAt !== 'string'
    ) {
      return null;
    }

    const hasNextWorkoutId = typeof parsed.nextWorkoutId === 'string';
    const hasNextSequenceIndex = typeof parsed.nextSequenceIndex === 'number';
    if (!hasNextWorkoutId && !hasNextSequenceIndex) {
      return null;
    }

    return {
      programId: parsed.programId,
      nextWorkoutId: hasNextWorkoutId ? (parsed.nextWorkoutId as string) : undefined,
      nextSequenceIndex: hasNextSequenceIndex ? (parsed.nextSequenceIndex as number) : undefined,
      completedWorkoutCount: parsed.completedWorkoutCount,
      lastCompletedWorkoutId: typeof parsed.lastCompletedWorkoutId === 'string' ? parsed.lastCompletedWorkoutId : undefined,
      lastCompletedSessionId: typeof parsed.lastCompletedSessionId === 'string' ? parsed.lastCompletedSessionId : undefined,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function getScheduledWorkout(
  program: UserProgram,
  progress?: (ProgramProgress | { programId?: string; nextWorkoutId?: string }) | null
): UserWorkout;
export function getScheduledWorkout(
  program: GeneratedProgram,
  progress?: (ProgramProgress | { programId?: string; nextWorkoutId?: string }) | null
): GeneratedWorkout;
export function getScheduledWorkout(
  program: UserProgram | GeneratedProgram,
  progress?: (ProgramProgress | { programId?: string; nextWorkoutId?: string }) | null
): UserWorkout | GeneratedWorkout {
  if (!program.workouts || program.workouts.length === 0) {
    throw new Error('Program has no workouts');
  }
  if (progress && progress.programId && progress.programId !== program.id) {
    return program.workouts[0];
  }
  if (!progress?.nextWorkoutId) {
    return program.workouts[0];
  }
  const found = program.workouts.find((w) => w.id === progress.nextWorkoutId);
  return found ?? program.workouts[0];
}

export const useProgramProgressStore = create<ProgramProgressState>((set, get) => ({
  progress: null,
  hydrated: false,

  loadProgress: async (program: UserProgram | GeneratedProgram) => {
    try {
      const stored = await AsyncStorage.getItem(PROGRAM_PROGRESS_STORAGE_KEY);
      const parsed = parseProgress(stored);

      const fallbackWorkoutId = program.workouts[0]?.id ?? '';

      if (!parsed || parsed.programId !== program.id) {
        const initial: ProgramProgress = {
          programId: program.id,
          nextWorkoutId: fallbackWorkoutId,
          completedWorkoutCount: 0,
          updatedAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(PROGRAM_PROGRESS_STORAGE_KEY, JSON.stringify(initial));
        set({ progress: initial, hydrated: true });
        return initial;
      }

      let resolvedNextWorkoutId: string = parsed.nextWorkoutId ?? '';

      // Legacy migration: if nextSequenceIndex exists but no nextWorkoutId
      if (!resolvedNextWorkoutId && typeof parsed.nextSequenceIndex === 'number') {
        const idx = parsed.nextSequenceIndex;
        const safeWorkout = idx >= 0 && idx < program.workouts.length
          ? program.workouts[idx]
          : program.workouts[0];
        resolvedNextWorkoutId = safeWorkout?.id ?? fallbackWorkoutId;
      }

      // Fallback: if nextWorkoutId points to a workout that no longer exists, safely fallback to workouts[0].id
      const workoutExists = program.workouts.some((w) => w.id === resolvedNextWorkoutId);
      if (!workoutExists) {
        resolvedNextWorkoutId = fallbackWorkoutId;
      }

      const updated: ProgramProgress = {
        programId: parsed.programId,
        nextWorkoutId: resolvedNextWorkoutId,
        completedWorkoutCount: parsed.completedWorkoutCount,
        lastCompletedWorkoutId: parsed.lastCompletedWorkoutId,
        lastCompletedSessionId: parsed.lastCompletedSessionId,
        updatedAt: parsed.updatedAt,
      };

      // If migrated from legacy nextSequenceIndex or recovered from missing workout, persist the fix
      if (!parsed.nextWorkoutId || !workoutExists) {
        updated.updatedAt = new Date().toISOString();
        await AsyncStorage.setItem(PROGRAM_PROGRESS_STORAGE_KEY, JSON.stringify(updated));
      }

      set({ progress: updated, hydrated: true });
      return updated;
    } catch {
      const fallback: ProgramProgress = {
        programId: program.id,
        nextWorkoutId: program.workouts[0]?.id ?? '',
        completedWorkoutCount: 0,
        updatedAt: new Date().toISOString(),
      };
      set({ progress: fallback, hydrated: true });
      return fallback;
    }
  },

  advanceProgress: async (program: UserProgram | GeneratedProgram, completedWorkoutId: string, sessionId?: string) => {
    const current = get().progress && get().progress?.programId === program.id
      ? (get().progress as ProgramProgress)
      : await get().loadProgress(program);

    if (sessionId && current.lastCompletedSessionId === sessionId) {
      return current;
    }

    const workouts = program.workouts;
    if (!workouts || workouts.length === 0) {
      return current;
    }

    const completedIndex = workouts.findIndex((workout) => workout.id === completedWorkoutId);
    const currentIndex = workouts.findIndex((workout) => workout.id === current.nextWorkoutId);

    const baseIndex = completedIndex >= 0 ? completedIndex : (currentIndex >= 0 ? currentIndex : 0);
    const nextIndex = (baseIndex + 1) % workouts.length;

    const nextWorkout = workouts[nextIndex] ?? workouts[0];
    const nextWorkoutId = nextWorkout?.id ?? workouts[0].id;

    const next: ProgramProgress = {
      programId: program.id,
      nextWorkoutId,
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

  resetProgress: async (programId: string, initialWorkoutId?: string) => {
    const reset: ProgramProgress = {
      programId,
      nextWorkoutId: initialWorkoutId ?? '',
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

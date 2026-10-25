import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const EXERCISE_NOTES_STORAGE_KEY = 'spot_exercise_notes_v1';

export function normalizeExerciseNoteKey(exerciseName: string): string {
  return (exerciseName || '').trim().toLowerCase();
}

type ExerciseNotesState = {
  notes: Record<string, string>;
  hydrated: boolean;
  loadNotes: () => Promise<Record<string, string>>;
  getNote: (exerciseName: string) => string;
  setNote: (exerciseName: string, note: string) => Promise<void>;
};

export const useExerciseNotesStore = create<ExerciseNotesState>((set, get) => ({
  notes: {},
  hydrated: false,

  loadNotes: async () => {
    try {
      const raw = await AsyncStorage.getItem(EXERCISE_NOTES_STORAGE_KEY);
      if (!raw) {
        set({ hydrated: true });
        return get().notes;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const sanitized: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.trim().length > 0) {
            sanitized[k] = v.trim();
          }
        }
        set({ notes: sanitized, hydrated: true });
        return sanitized;
      }
    } catch {
      // Ignore storage read errors
    }
    set({ hydrated: true });
    return get().notes;
  },

  getNote: (exerciseName: string) => {
    const key = normalizeExerciseNoteKey(exerciseName);
    if (!key) return '';
    return get().notes[key] || '';
  },

  setNote: async (exerciseName: string, note: string) => {
    const key = normalizeExerciseNoteKey(exerciseName);
    if (!key) return;
    const trimmed = (note || '').trim();
    const current = { ...get().notes };
    if (trimmed.length === 0) {
      delete current[key];
    } else {
      current[key] = trimmed;
    }
    set({ notes: current, hydrated: true });
    try {
      await AsyncStorage.setItem(EXERCISE_NOTES_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Ignore storage write errors
    }
  },
}));

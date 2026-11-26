import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { resolveCanonicalExerciseId } from '@/lib/exercises';

export const EXERCISE_NOTES_STORAGE_KEY = 'spot_exercise_notes_v1';

export function normalizeExerciseNoteKey(exerciseName: string): string {
  return resolveCanonicalExerciseId(exerciseName);
}

type ExerciseNotesState = {
  notes: Record<string, string>;
  hydrated: boolean;
  loadNotes: () => Promise<Record<string, string>>;
  getNote: (exerciseName: string) => string;
  setNote: (exerciseName: string, note: string) => Promise<void>;
  clearNotes: () => Promise<void>;
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
            const canonicalKey = normalizeExerciseNoteKey(k) || k.trim().toLowerCase();
            sanitized[canonicalKey] = v.trim();
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
    const legacyKey = (exerciseName || '').trim().toLowerCase();
    if (!key && !legacyKey) return '';
    const notes = get().notes;
    if (key && notes[key]) return notes[key];
    if (legacyKey && notes[legacyKey]) return notes[legacyKey];
    for (const [existingKey, val] of Object.entries(notes)) {
      if (val && normalizeExerciseNoteKey(existingKey) === key) {
        return val;
      }
    }
    return '';
  },

  setNote: async (exerciseName: string, note: string) => {
    const key = normalizeExerciseNoteKey(exerciseName);
    const legacyKey = (exerciseName || '').trim().toLowerCase();
    if (!key) return;
    const trimmed = (note || '').trim();
    const current = { ...get().notes };
    if (trimmed.length === 0) {
      delete current[key];
      if (legacyKey && legacyKey !== key) {
        delete current[legacyKey];
      }
    } else {
      current[key] = trimmed;
      if (legacyKey && legacyKey !== key) {
        delete current[legacyKey];
      }
    }
    set({ notes: current, hydrated: true });
    try {
      await AsyncStorage.setItem(EXERCISE_NOTES_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Ignore storage write errors
    }
  },

  clearNotes: async () => {
    set({ notes: {}, hydrated: true });
    try {
      await AsyncStorage.removeItem(EXERCISE_NOTES_STORAGE_KEY);
    } catch {
      // Ignore storage remove errors
    }
  },
}));


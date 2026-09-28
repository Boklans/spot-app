import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { EquipmentId } from '@/lib/programGenerator';
import type { LibraryExercise } from '@/lib/exerciseLibrary';

export const CUSTOM_EXERCISES_STORAGE_KEY = 'spot_custom_exercises';

export type CustomExercise = {
  id: string;
  name: string;
  muscleGroup: 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core';
  equipment: EquipmentId;
  weightIncrement: number;
  defaultSets: number;
  defaultRepRange: string;
  defaultWeight: number;
  customImageUri?: string;
  createdAt: string;
  isCustom: true;
};

type CustomExercisesState = {
  customExercises: CustomExercise[];
  hydrated: boolean;
  loadCustomExercises: () => Promise<CustomExercise[]>;
  addCustomExercise: (
    data: Omit<CustomExercise, 'id' | 'createdAt' | 'isCustom'>
  ) => Promise<CustomExercise>;
  deleteCustomExercise: (id: string) => Promise<void>;
  toLibraryExercises: () => LibraryExercise[];
};

export const useCustomExercisesStore = create<CustomExercisesState>((set, get) => ({
  customExercises: [],
  hydrated: false,

  loadCustomExercises: async () => {
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_EXERCISES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set({ customExercises: parsed, hydrated: true });
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    set({ hydrated: true });
    return [];
  },

  addCustomExercise: async (data) => {
    const newEx: CustomExercise = {
      ...data,
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      isCustom: true,
    };
    const updated = [newEx, ...get().customExercises];
    set({ customExercises: updated });
    try {
      await AsyncStorage.setItem(CUSTOM_EXERCISES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
    return newEx;
  },

  deleteCustomExercise: async (id: string) => {
    const updated = get().customExercises.filter((e) => e.id !== id);
    set({ customExercises: updated });
    try {
      await AsyncStorage.setItem(CUSTOM_EXERCISES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  },

  toLibraryExercises: () => {
    return get().customExercises.map((c) => ({
      id: c.id,
      name: c.name,
      muscleGroup: c.muscleGroup,
      equipment: c.equipment,
      weightIncrement: c.weightIncrement,
      defaultSets: c.defaultSets,
      defaultRepRange: c.defaultRepRange,
      defaultWeight: c.defaultWeight,
      customImageUri: c.customImageUri,
      isCustom: true,
    }));
  },
}));

// Auto-hydrate on startup
useCustomExercisesStore.getState().loadCustomExercises();

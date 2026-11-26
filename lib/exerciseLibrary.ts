import type { EquipmentId } from '@/lib/programGenerator';
import { CANONICAL_EXERCISES, type ExerciseCategoryMuscle } from '@/lib/exercises';

export type LibraryExercise = {
  id: string;
  name: string;
  muscleGroup: ExerciseCategoryMuscle;
  equipment: EquipmentId;
  weightIncrement: number;
  defaultSets?: number;
  defaultRepRange?: string;
  defaultWeight?: number;
  customImageUri?: string;
  isCustom?: boolean;
};

export const EXERCISE_LIBRARY: LibraryExercise[] = CANONICAL_EXERCISES.map((item) => ({
  id: item.id,
  name: item.nameEn,
  muscleGroup: item.categoryMuscle,
  equipment: item.equipment,
  weightIncrement: item.weightIncrement,
  defaultSets: item.defaultSets,
  defaultRepRange: item.defaultRepRange,
  defaultWeight: item.defaultWeight,
}));

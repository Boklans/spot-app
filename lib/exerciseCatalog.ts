import type { EquipmentId } from './programGenerator';
import { CANONICAL_EXERCISES } from './exercises';

export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: EquipmentId;
  defaultWeight: number;
  targetRepRange: string;
  sets: number;
  customImageUri?: string;
  isCustom?: boolean;
}

export const EXERCISE_CATALOG: CatalogExercise[] = CANONICAL_EXERCISES.map((item) => ({
  id: item.id,
  name: item.nameEn,
  muscleGroup: item.categoryMuscle,
  equipment: item.equipment,
  defaultWeight: item.defaultWeight,
  targetRepRange: item.defaultRepRange,
  sets: item.defaultSets,
}));

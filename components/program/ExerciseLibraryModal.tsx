import React from 'react';
import { useThemeColors } from '@/constants/colors';
import type { CatalogExercise } from '@/lib/exerciseCatalog';
import { ExercisePickerModal } from './ExercisePickerModal';

interface ExerciseLibraryModalProps {
  visible: boolean;
  embedded?: boolean;
  onSelectExercise: (exercise: CatalogExercise) => void;
  onClose: () => void;
}

/**
 * Unified delegating wrapper routing legacy ExerciseLibraryModal callers
 * onto the canonical ExercisePickerModal (equipment filter, custom delete, info sheet).
 */
export function ExerciseLibraryModal({
  visible,
  embedded = false,
  onSelectExercise,
  onClose,
}: ExerciseLibraryModalProps) {
  useThemeColors();
  return (
    <ExercisePickerModal
      visible={visible}
      embedded={embedded}
      onClose={onClose}
      onSelect={(item) =>
        onSelectExercise({
          id: item.id,
          name: item.name,
          muscleGroup: item.muscleGroup,
          equipment: item.equipment,
          defaultWeight: item.defaultWeight ?? 0,
          targetRepRange: item.defaultRepRange ?? '8-12',
          sets: item.defaultSets ?? 3,
          customImageUri: item.customImageUri,
          isCustom: item.isCustom,
        })
      }
    />
  );
}

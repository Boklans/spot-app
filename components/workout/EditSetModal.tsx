import React from 'react';
import { useThemeColors } from '@/constants/colors';
import { WorkoutKeypadSheet, type WorkoutKeypadSheetProps } from '@/components/workout/WorkoutKeypadSheet';

export interface EditSetModalProps extends Omit<WorkoutKeypadSheetProps, 'canonicalExerciseName'> {
  toKg?: (val: number) => number;
  canonicalExerciseName?: string;
}

/**
 * Backward-compatible wrapper delegating set editing to the docked WorkoutKeypadSheet
 * (zero OS keyboard, JetBrains Mono numpad, equipment-smart steppers, inline RIR).
 */
export function EditSetModal(props: EditSetModalProps) {
  // Maintain theme subscription contract
  useThemeColors();
  const { toKg: _unusedToKg, ...rest } = props;
  return <WorkoutKeypadSheet {...rest} />;
}

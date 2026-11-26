import { useCallback } from 'react';
import { getExerciseLoadType } from '@/lib/exercises';
import type { EquipmentId } from '@/lib/programGenerator';
import { useUserProfileStore, type WeightUnit } from '@/store/userProfileStore';
import type { SetType } from '@/types/workout';

export function normalizeWeight(value: number): number {
  return Math.round(value * 100) / 100;
}

export function addWeight(weight: number, increment: number): number {
  return normalizeWeight(Math.max(0, weight + increment));
}

export function subtractWeight(weight: number, increment: number, min = 0): number {
  return normalizeWeight(Math.max(min, weight - increment));
}

export function formatWeight(weight: number): string {
  const normalized = normalizeWeight(weight);
  return Number(normalized.toFixed(2)).toString();
}

export function getActiveWeightUnit(): WeightUnit {
  try {
    return useUserProfileStore.getState().profile.weightUnit ?? 'kg';
  } catch {
    return 'kg';
  }
}

export function convertWeightToActiveUnit(weightInKg: number, unit?: WeightUnit): number {
  const active = unit ?? getActiveWeightUnit();
  if (active === 'lbs') {
    return Math.round(weightInKg * 2.20462 * 2) / 2;
  }
  return weightInKg;
}

export function convertWeightFromActiveUnit(displayWeight: number, unit?: WeightUnit): number {
  const active = unit ?? getActiveWeightUnit();
  if (active === 'lbs') {
    return Math.round((displayWeight / 2.20462) * 100) / 100;
  }
  return displayWeight;
}

export function convertVolumeToActiveUnit(volumeInKg: number, unit?: WeightUnit): number {
  const active = unit ?? getActiveWeightUnit();
  if (active === 'lbs') {
    return Math.round(volumeInKg * 2.20462);
  }
  return Math.round(volumeInKg);
}

export function formatWeightWithUnit(weightInKg: number, unit?: WeightUnit): string {
  const active = unit ?? getActiveWeightUnit();
  const converted = convertWeightToActiveUnit(weightInKg, active);
  return `${formatWeight(converted)} ${active.toUpperCase()}`;
}

export function formatVolumeWithUnit(volumeInKg: number, unit?: WeightUnit): string {
  const active = unit ?? getActiveWeightUnit();
  const converted = convertVolumeToActiveUnit(volumeInKg, active);
  return `${converted.toLocaleString()} ${active.toUpperCase()}`;
}

/**
 * Returns `2` strictly for bilateral per-hand dumbbell movements (where two dumbbells
 * are lifted simultaneously while the user enters 1-hand weight), and `1` for unilateral
 * exercises, barbells, machines, single shared-dumbbell lifts, and bodyweight.
 */
export function getExerciseVolumeMultiplier(exerciseName?: string, equipment?: EquipmentId): 1 | 2 {
  const loadType = getExerciseLoadType(exerciseName, equipment);
  return loadType === 'bilateral_per_hand' ? 2 : 1;
}

/**
 * Canonical single source of truth for working set volume (in kg).
 * - Warm-up sets always contribute `0` working volume.
 * - Bilateral per-hand dumbbell exercises multiply `weightKg × 2 × reps`.
 * - Unilateral exercises (`Single-Arm Row`, `Bulgarian Split Squat`, etc.) multiply `weightKg × 1 × reps`.
 */
export function calculateSetVolumeKg(params: {
  weightKg: number;
  reps: number;
  exerciseName?: string;
  equipment?: EquipmentId;
  setType?: SetType | string;
}): number {
  const { weightKg, reps, exerciseName, equipment, setType } = params;
  if (setType === 'warmup') return 0;
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
  if (!Number.isFinite(reps) || reps <= 0) return 0;
  const multiplier = getExerciseVolumeMultiplier(exerciseName, equipment);
  return Math.round(weightKg * multiplier * reps * 100) / 100;
}

export function useWeightUnit() {
  const unit = useUserProfileStore((s) => s.profile.weightUnit) ?? 'kg';
  const language = useUserProfileStore((s) => s.profile.language) ?? 'en';
  const unitLabel = unit === 'lbs' ? 'lb' : language === 'uk' ? 'кг' : 'kg';

  const format = useCallback((weightInKg: number) => {
    const val = convertWeightToActiveUnit(weightInKg, unit);
    return formatWeight(val);
  }, [unit]);

  const formatWithUnit = useCallback((weightInKg: number) => {
    return `${format(weightInKg)} ${unitLabel}`;
  }, [format, unitLabel]);

  const formatVolume = useCallback((volumeInKg: number) => {
    const converted = convertVolumeToActiveUnit(volumeInKg, unit);
    return `${converted.toLocaleString()} ${unitLabel}`;
  }, [unit, unitLabel]);

  const step = unit === 'lbs' ? 5 : 2.5;
  const toKg = useCallback((displayVal: number) => convertWeightFromActiveUnit(displayVal, unit), [unit]);
  const fromKg = useCallback((kgVal: number) => convertWeightToActiveUnit(kgVal, unit), [unit]);

  return {
    unit,
    unitLabel,
    format,
    formatWithUnit,
    formatVolume,
    step,
    toKg,
    fromKg,
  };
}

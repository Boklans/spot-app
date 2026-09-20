import { useUserProfileStore, type WeightUnit } from '@/store/userProfileStore';

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

export function useWeightUnit() {
  const unit = useUserProfileStore((s) => s.profile.weightUnit) ?? 'kg';
  const unitLabel = unit.toUpperCase();

  const format = (weightInKg: number) => {
    const val = convertWeightToActiveUnit(weightInKg, unit);
    return formatWeight(val);
  };

  const formatWithUnit = (weightInKg: number) => {
    return `${format(weightInKg)} ${unitLabel}`;
  };

  const formatVolume = (volumeInKg: number) => {
    const converted = convertVolumeToActiveUnit(volumeInKg, unit);
    return `${converted.toLocaleString()} ${unitLabel}`;
  };

  const step = unit === 'lbs' ? 5 : 2.5;
  const toKg = (displayVal: number) => convertWeightFromActiveUnit(displayVal, unit);
  const fromKg = (kgVal: number) => convertWeightToActiveUnit(kgVal, unit);

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

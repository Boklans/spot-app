export type PlateUnit = 'kg' | 'lbs';

export interface PlateSpec {
  weight: number;
  color: string;
  textColor: string;
  heightRatio: number; // 0.45..1.0 relative height of sleeve visual
  thickness: number; // px width of plate on barbell visual
}

export interface PlateAllocation {
  weight: number;
  count: number;
  spec: PlateSpec;
}

export interface PlateCalculationResult {
  status: 'loaded' | 'bar_only' | 'below_bar' | 'invalid';
  unit: PlateUnit;
  barWeight: number;
  targetWeight: number;
  achievableTotal: number;
  perSideWeight: number;
  remainderPerSide: number;
  perSide: PlateAllocation[];
  /** Expanded flat list of individual plates on ONE side (heaviest -> lightest) for visual sleeve rendering */
  sleevePlates: PlateSpec[];
}

export const BAR_WEIGHT_OPTIONS: Record<PlateUnit, { weight: number; labelEn: string; labelUk: string }[]> = {
  kg: [
    { weight: 20, labelEn: '20 kg', labelUk: '20 кг' },
    { weight: 15, labelEn: '15 kg', labelUk: '15 кг' },
    { weight: 10, labelEn: '10 kg EZ', labelUk: '10 кг EZ' },
  ],
  lbs: [
    { weight: 45, labelEn: '45 lb', labelUk: '45 lb' },
    { weight: 35, labelEn: '35 lb', labelUk: '35 lb' },
    { weight: 25, labelEn: '25 lb EZ', labelUk: '25 lb EZ' },
  ],
};

// IPF-inspired high-contrast competition plate colors
export const STANDARD_PLATES: Record<PlateUnit, PlateSpec[]> = {
  kg: [
    { weight: 25, color: '#EF4444', textColor: '#FFFFFF', heightRatio: 1.0, thickness: 11 },
    { weight: 20, color: '#3B82F6', textColor: '#FFFFFF', heightRatio: 0.98, thickness: 10 },
    { weight: 15, color: '#EAB308', textColor: '#0B0D0F', heightRatio: 0.90, thickness: 9 },
    { weight: 10, color: '#22C55E', textColor: '#0B0D0F', heightRatio: 0.80, thickness: 8 },
    { weight: 5, color: '#E2E8F0', textColor: '#0B0D0F', heightRatio: 0.66, thickness: 7 },
    { weight: 2.5, color: '#64748B', textColor: '#FFFFFF', heightRatio: 0.56, thickness: 6 },
    { weight: 1.25, color: '#94A3B8', textColor: '#0B0D0F', heightRatio: 0.46, thickness: 5 },
  ],
  lbs: [
    { weight: 45, color: '#3B82F6', textColor: '#FFFFFF', heightRatio: 1.0, thickness: 11 },
    { weight: 35, color: '#EAB308', textColor: '#0B0D0F', heightRatio: 0.90, thickness: 9 },
    { weight: 25, color: '#22C55E', textColor: '#0B0D0F', heightRatio: 0.82, thickness: 8 },
    { weight: 10, color: '#E2E8F0', textColor: '#0B0D0F', heightRatio: 0.68, thickness: 7 },
    { weight: 5, color: '#64748B', textColor: '#FFFFFF', heightRatio: 0.56, thickness: 6 },
    { weight: 2.5, color: '#94A3B8', textColor: '#0B0D0F', heightRatio: 0.46, thickness: 5 },
  ],
};

export function getDefaultBarWeight(unit: PlateUnit, exerciseName?: string): number {
  const lower = (exerciseName || '').toLowerCase();
  if (lower.includes('ez bar') || lower.includes('ez-bar') || lower.includes('curl') || lower.includes('skullcrusher')) {
    return unit === 'lbs' ? 25 : 10;
  }
  return unit === 'lbs' ? 45 : 20;
}

/**
 * Pure, deterministic greedy plate solver for symmetric barbell loading.
 * Works accurately in both KG and LBS without floating-point drift.
 */
export function calculateBarbellPlates(
  targetWeight: number,
  unit: PlateUnit = 'kg',
  barWeight?: number
): PlateCalculationResult {
  const resolvedBar = typeof barWeight === 'number' && Number.isFinite(barWeight) && barWeight >= 0
    ? barWeight
    : unit === 'lbs'
      ? 45
      : 20;

  if (!Number.isFinite(targetWeight) || targetWeight <= 0) {
    return {
      status: 'invalid',
      unit,
      barWeight: resolvedBar,
      targetWeight: 0,
      achievableTotal: resolvedBar,
      perSideWeight: 0,
      remainderPerSide: 0,
      perSide: [],
      sleevePlates: [],
    };
  }

  const roundedTarget = Math.round(targetWeight * 100) / 100;

  if (roundedTarget < resolvedBar) {
    return {
      status: 'below_bar',
      unit,
      barWeight: resolvedBar,
      targetWeight: roundedTarget,
      achievableTotal: resolvedBar,
      perSideWeight: 0,
      remainderPerSide: 0,
      perSide: [],
      sleevePlates: [],
    };
  }

  const neededPerSide = (roundedTarget - resolvedBar) / 2;
  if (neededPerSide < 0.01) {
    return {
      status: 'bar_only',
      unit,
      barWeight: resolvedBar,
      targetWeight: roundedTarget,
      achievableTotal: resolvedBar,
      perSideWeight: 0,
      remainderPerSide: 0,
      perSide: [],
      sleevePlates: [],
    };
  }

  // Integer hundredths avoid IEEE-754 remainder glitches (e.g. 1.25 * 3)
  let remainingUnits = Math.round(neededPerSide * 100);
  const catalog = STANDARD_PLATES[unit];
  const perSide: PlateAllocation[] = [];
  const sleevePlates: PlateSpec[] = [];

  for (const spec of catalog) {
    const plateUnits = Math.round(spec.weight * 100);
    if (plateUnits <= 0) continue;
    const count = Math.floor(remainingUnits / plateUnits);
    if (count > 0) {
      perSide.push({ weight: spec.weight, count, spec });
      for (let i = 0; i < count; i++) {
        sleevePlates.push(spec);
      }
      remainingUnits -= count * plateUnits;
    }
  }

  const loadedPerSide =
    Math.round(perSide.reduce((sum, item) => sum + item.weight * item.count, 0) * 100) / 100;
  const achievableTotal = Math.round((resolvedBar + loadedPerSide * 2) * 100) / 100;
  const remainderPerSide = Math.round((remainingUnits / 100) * 100) / 100;

  return {
    status: perSide.length > 0 ? 'loaded' : 'bar_only',
    unit,
    barWeight: resolvedBar,
    targetWeight: roundedTarget,
    achievableTotal,
    perSideWeight: loadedPerSide,
    remainderPerSide,
    perSide,
    sleevePlates,
  };
}

export function formatPlateSummary(result: PlateCalculationResult, isUk: boolean): string {
  const sideUnit = isUk ? 'на сторону' : 'per side';
  const unitText = result.unit === 'lbs' ? 'lb' : isUk ? 'кг' : 'kg';

  if (result.status === 'below_bar') {
    return isUk
      ? `Менше ваги грифа (${result.barWeight} ${unitText})`
      : `Below bar weight (${result.barWeight} ${unitText})`;
  }
  if (result.status === 'bar_only' || result.perSide.length === 0) {
    return isUk
      ? `Лише порожній гриф (${result.barWeight} ${unitText})`
      : `Empty bar only (${result.barWeight} ${unitText})`;
  }

  const parts = result.perSide.map((p) => (p.count > 1 ? `${p.count}×${p.weight}` : `${p.weight}`));
  return `${parts.join(' + ')} ${unitText} ${sideUnit}`;
}

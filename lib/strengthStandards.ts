import type { AllTimeExerciseRecord } from '@/lib/personalRecords';

export type StrengthRankKey = 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'elite';

export interface StrengthRankMeta {
  key: StrengthRankKey;
  index: number; // 0..4
  labelEn: string;
  labelUk: string;
  colorDark: string;
  colorLight: string;
}

export const STRENGTH_RANKS: StrengthRankMeta[] = [
  { key: 'novice', index: 0, labelEn: 'Novice', labelUk: 'Новачок', colorDark: '#94A3B8', colorLight: '#64748B' },
  { key: 'beginner', index: 1, labelEn: 'Beginner', labelUk: 'Початківець', colorDark: '#60A5FA', colorLight: '#2563EB' },
  { key: 'intermediate', index: 2, labelEn: 'Intermediate', labelUk: 'Впевнений', colorDark: '#4ADE80', colorLight: '#16A34A' },
  { key: 'advanced', index: 3, labelEn: 'Advanced', labelUk: 'Просунутий', colorDark: '#C8FF3D', colorLight: '#15803D' },
  { key: 'elite', index: 4, labelEn: 'Elite', labelUk: 'Еліта', colorDark: '#FBBF24', colorLight: '#D97706' },
];

interface LiftStandardDef {
  id: string;
  nameEn: string;
  nameUk: string;
  matchers: string[];
  exclude?: string[];
  /** Minimum 1RM / Bodyweight ratios to ENTER [beginner, intermediate, advanced, elite] */
  maleThresholds: [number, number, number, number];
  femaleThresholds: [number, number, number, number];
}

// Athletic bodyweight-relative 1RM thresholds grounded in standard strength classification tables
const LIFT_STANDARDS: LiftStandardDef[] = [
  {
    id: 'bench',
    nameEn: 'Bench Press',
    nameUk: 'Жим лежачи',
    matchers: ['barbell bench press', 'bench press'],
    exclude: ['incline', 'dumbbell', 'close grip'],
    maleThresholds: [0.65, 1.0, 1.35, 1.75],
    femaleThresholds: [0.35, 0.55, 0.8, 1.05],
  },
  {
    id: 'incline_bench',
    nameEn: 'Incline Press',
    nameUk: 'Жим на похилій',
    matchers: ['incline bench press', 'incline barbell press'],
    exclude: ['dumbbell'],
    maleThresholds: [0.55, 0.85, 1.15, 1.45],
    femaleThresholds: [0.3, 0.48, 0.68, 0.9],
  },
  {
    id: 'incline_db_bench',
    nameEn: 'Incline Dumbbell Press',
    nameUk: 'Жим гантелей на похилій',
    matchers: ['incline dumbbell press', 'incline db press'],
    // Per single dumbbell 1RM / BW
    maleThresholds: [0.24, 0.38, 0.52, 0.68],
    femaleThresholds: [0.13, 0.21, 0.32, 0.44],
  },
  {
    id: 'db_bench',
    nameEn: 'Dumbbell Bench Press',
    nameUk: 'Жим гантелей лежачи',
    matchers: ['dumbbell bench press', 'dumbbell chest press'],
    exclude: ['incline'],
    // Per single dumbbell 1RM / BW
    maleThresholds: [0.28, 0.42, 0.58, 0.75],
    femaleThresholds: [0.15, 0.24, 0.36, 0.48],
  },
  {
    id: 'squat',
    nameEn: 'Barbell Squat',
    nameUk: 'Присідання зі штангою',
    matchers: ['barbell squat', 'back squat', 'squat'],
    exclude: ['split', 'goblet', 'bulgarian', 'hack', 'sissy', 'bodyweight'],
    maleThresholds: [0.85, 1.25, 1.75, 2.25],
    femaleThresholds: [0.55, 0.85, 1.2, 1.6],
  },
  {
    id: 'deadlift',
    nameEn: 'Deadlift',
    nameUk: 'Станова тяга',
    matchers: ['barbell deadlift', 'conventional deadlift', 'deadlift'],
    exclude: ['romanian', 'rdl', 'stiff', 'dumbbell'],
    maleThresholds: [1.0, 1.5, 2.0, 2.55],
    femaleThresholds: [0.65, 1.0, 1.4, 1.85],
  },
  {
    id: 'rdl',
    nameEn: 'Romanian Deadlift',
    nameUk: 'Румунська тяга',
    matchers: ['romanian deadlift', 'rdl'],
    exclude: ['dumbbell', 'single'],
    maleThresholds: [0.75, 1.15, 1.55, 2.0],
    femaleThresholds: [0.5, 0.8, 1.1, 1.45],
  },
  {
    id: 'ohp',
    nameEn: 'Overhead Press',
    nameUk: 'Жим над головою',
    matchers: ['overhead press', 'military press', 'barbell shoulder press'],
    exclude: ['dumbbell'],
    maleThresholds: [0.45, 0.65, 0.9, 1.15],
    femaleThresholds: [0.25, 0.4, 0.58, 0.78],
  },
  {
    id: 'barbell_row',
    nameEn: 'Barbell Row',
    nameUk: 'Тяга штанги в нахилі',
    matchers: ['barbell row', 'bent over row', 'bent-over row', 'pendlay row'],
    exclude: ['dumbbell', 'cable'],
    maleThresholds: [0.55, 0.85, 1.15, 1.45],
    femaleThresholds: [0.35, 0.55, 0.78, 1.0],
  },
  {
    id: 'lat_pulldown',
    nameEn: 'Lat Pulldown',
    nameUk: 'Тяга верхнього блоку',
    matchers: ['lat pulldown'],
    maleThresholds: [0.55, 0.8, 1.1, 1.4],
    femaleThresholds: [0.38, 0.58, 0.8, 1.05],
  },
  {
    id: 'leg_press',
    nameEn: 'Leg Press',
    nameUk: 'Жим ногами',
    matchers: ['leg press'],
    exclude: ['single'],
    maleThresholds: [1.3, 2.0, 2.8, 3.6],
    femaleThresholds: [0.9, 1.4, 2.0, 2.65],
  },
  {
    id: 'hip_thrust',
    nameEn: 'Hip Thrust',
    nameUk: 'Ягодичний місток',
    matchers: ['hip thrust', 'glute bridge'],
    maleThresholds: [0.9, 1.4, 2.0, 2.6],
    femaleThresholds: [0.75, 1.2, 1.75, 2.3],
  },
];

export interface LiftStandardEvaluation {
  standardId: string;
  exerciseName: string;
  estimated1RMKg: number;
  bodyweightRatio: number;
  rank: StrengthRankMeta;
  nextRank: StrengthRankMeta | null;
  progressToNext: number; // 0..1
  kgToNextRank: number;
}

export interface StrengthProfileSummary {
  overallRank: StrengthRankMeta;
  overallScore: number; // 0..100
  evaluatedLifts: LiftStandardEvaluation[];
}

function matchLiftStandard(exerciseName: string): LiftStandardDef | null {
  const lower = (exerciseName || '').trim().toLowerCase();
  if (!lower) return null;

  for (const def of LIFT_STANDARDS) {
    if (def.exclude?.some((ex) => lower.includes(ex))) continue;
    if (def.matchers.some((m) => lower === m || lower.includes(m))) {
      return def;
    }
  }
  return null;
}

export function evaluateLiftStandard(params: {
  exerciseName: string;
  estimated1RMKg: number;
  bodyweightKg: number;
  sex?: 'male' | 'female' | 'unspecified';
}): LiftStandardEvaluation | null {
  const { exerciseName, estimated1RMKg, bodyweightKg, sex = 'male' } = params;
  if (!Number.isFinite(estimated1RMKg) || estimated1RMKg <= 0) return null;
  if (!Number.isFinite(bodyweightKg) || bodyweightKg < 25) return null;

  const def = matchLiftStandard(exerciseName);
  if (!def) return null;

  const thresholds = sex === 'female' ? def.femaleThresholds : def.maleThresholds;
  const ratio = estimated1RMKg / bodyweightKg;

  let rankIndex = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (ratio >= thresholds[i]) {
      rankIndex = i + 1;
    }
  }

  const rank = STRENGTH_RANKS[rankIndex];
  const nextRank = rankIndex < STRENGTH_RANKS.length - 1 ? STRENGTH_RANKS[rankIndex + 1] : null;

  let progressToNext = 1;
  let kgToNextRank = 0;

  if (nextRank) {
    const floorRatio = rankIndex === 0 ? 0 : thresholds[rankIndex - 1];
    const ceilRatio = thresholds[rankIndex];
    const span = Math.max(0.05, ceilRatio - floorRatio);
    progressToNext = Math.max(0, Math.min(1, (ratio - floorRatio) / span));
    const targetKg = ceilRatio * bodyweightKg;
    kgToNextRank = Math.max(0.5, Math.ceil((targetKg - estimated1RMKg) * 2) / 2);
  }

  return {
    standardId: def.id,
    exerciseName,
    estimated1RMKg: Math.round(estimated1RMKg * 10) / 10,
    bodyweightRatio: Math.round(ratio * 100) / 100,
    rank,
    nextRank,
    progressToNext,
    kgToNextRank,
  };
}

export function evaluateStrengthProfile(
  records: AllTimeExerciseRecord[],
  bodyweightKg: number,
  sex?: 'male' | 'female' | 'unspecified'
): StrengthProfileSummary | null {
  if (!Number.isFinite(bodyweightKg) || bodyweightKg < 25 || !records.length) {
    return null;
  }

  const bestByStandard = new Map<string, LiftStandardEvaluation>();

  for (const rec of records) {
    if (rec.isBodyweight || rec.isAssisted || rec.estimated1RMKg <= 0) continue;
    const evalRes = evaluateLiftStandard({
      exerciseName: rec.exerciseName,
      estimated1RMKg: rec.estimated1RMKg,
      bodyweightKg,
      sex,
    });
    if (!evalRes) continue;
    const existing = bestByStandard.get(evalRes.standardId);
    if (!existing || evalRes.estimated1RMKg > existing.estimated1RMKg) {
      bestByStandard.set(evalRes.standardId, evalRes);
    }
  }

  const evaluatedLifts = Array.from(bestByStandard.values()).sort(
    (a, b) => b.rank.index + b.progressToNext - (a.rank.index + a.progressToNext)
  );
  if (evaluatedLifts.length === 0) return null;

  // Compute average normalized score across 0..100 (each tier = 25 pts)
  const avgTierFloat =
    evaluatedLifts.reduce(
      (sum, item) => sum + Math.min(4, item.rank.index + (item.nextRank ? item.progressToNext : 0)),
      0
    ) / evaluatedLifts.length;

  const overallScore = Math.max(5, Math.min(100, Math.round((avgTierFloat / 4) * 100)));
  const overallIdx = Math.min(4, Math.floor(avgTierFloat));

  return {
    overallRank: STRENGTH_RANKS[overallIdx],
    overallScore,
    evaluatedLifts,
  };
}

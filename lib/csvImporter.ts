import { findCanonicalExercise } from '@/lib/exercises';
import { EXERCISE_LIBRARY } from '@/lib/exerciseLibrary';
import type { CompletedExercise, CompletedSet, CompletedWorkout, SetType } from '@/types/workout';

export type CsvImportSource = 'hevy' | 'strong';

export interface CsvImportResult {
  success: boolean;
  source?: CsvImportSource;
  workouts: CompletedWorkout[];
  importedWorkoutsCount: number;
  importedSetsCount: number;
  skippedRowsCount: number;
  error?: string;
}

const LBS_TO_KG = 0.45359237;

/**
 * Auto-detects comma vs semicolon CSV delimiter from the header line (outside quotes),
 * supporting both US/UK `,` and European `;` Strong/Hevy CSV exports.
 */
function detectCsvDelimiter(text: string): ',' | ';' {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes) {
      if (ch === '\n' || ch === '\r') break;
      if (ch === ',') commas++;
      else if (ch === ';') semicolons++;
    }
  }
  return semicolons > commas ? ';' : ',';
}

/**
 * RFC-4180 compliant CSV parser supporting `,` and `;` delimiters, quoted fields,
 * escaped quotes (""), CRLF/LF newlines, and UTF-8 BOM.
 */
export function parseCsvRows(rawText: string): string[][] {
  const text = (rawText || '').replace(/^\uFEFF/, '');
  if (!text.trim()) return [];

  const delimiter = detectCsvDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function inferMuscleGroupFromExerciseName(name: string): string {
  const canonical = findCanonicalExercise(name);
  if (canonical) return canonical.categoryMuscle;

  const lower = name.trim().toLowerCase();
  const exact = EXERCISE_LIBRARY.find((ex) => ex.name.toLowerCase() === lower);
  if (exact) return exact.muscleGroup;

  const partial = EXERCISE_LIBRARY.find(
    (ex) => lower.includes(ex.name.toLowerCase()) || ex.name.toLowerCase().includes(lower)
  );
  if (partial) return partial.muscleGroup;

  if (lower.includes('bench') || lower.includes('chest') || lower.includes('pec') || lower.includes('push-up') || lower.includes('fly')) {
    return 'Chest';
  }
  if (lower.includes('row') || lower.includes('pulldown') || lower.includes('pull-up') || lower.includes('chin-up') || lower.includes('deadlift') || lower.includes('lat')) {
    return 'Back';
  }
  if (lower.includes('squat') || lower.includes('leg') || lower.includes('lunge') || lower.includes('calf') || lower.includes('hip thrust') || lower.includes('glute') || lower.includes('rdl')) {
    return 'Legs';
  }
  if (lower.includes('shoulder') || lower.includes('overhead') || lower.includes('lateral raise') || lower.includes('delt') || lower.includes('face pull')) {
    return 'Shoulders';
  }
  if (lower.includes('curl') || lower.includes('tricep') || lower.includes('pushdown') || lower.includes('dip') || lower.includes('skullcrusher')) {
    return 'Arms';
  }
  if (lower.includes('plank') || lower.includes('crunch') || lower.includes('ab') || lower.includes('core')) {
    return 'Core';
  }
  return 'Other';
}

function parseFlexibleDate(raw: string): Date | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim();
  const direct = new Date(cleaned);
  if (!isNaN(direct.getTime())) return direct;

  // Hevy format: "23 Nov 2026, 18:15" or "2026-11-23 18:15:00"
  const normalized = cleaned.replace(',', '');
  const fallback = new Date(normalized);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

function parseDurationSeconds(raw: string): number {
  if (!raw) return 2700;
  const trimmed = raw.trim().toLowerCase();
  // Strong formats: "1h 12m", "45m", "3600s", "00:45:00"
  let total = 0;
  const hMatch = trimmed.match(/(\d+)\s*h/);
  const mMatch = trimmed.match(/(\d+)\s*m/);
  const sMatch = trimmed.match(/(\d+)\s*s/);
  if (hMatch || mMatch || sMatch) {
    if (hMatch) total += parseInt(hMatch[1], 10) * 3600;
    if (mMatch) total += parseInt(mMatch[1], 10) * 60;
    if (sMatch) total += parseInt(sMatch[1], 10);
    return Math.max(60, total);
  }
  const colonParts = trimmed.split(':').map((n) => parseInt(n, 10));
  if (colonParts.length === 3 && colonParts.every((n) => Number.isFinite(n))) {
    return Math.max(60, colonParts[0] * 3600 + colonParts[1] * 60 + colonParts[2]);
  }
  const num = parseInt(trimmed, 10);
  if (Number.isFinite(num) && num > 0) {
    return num > 300 ? num : num * 60;
  }
  return 2700;
}

function mapSetType(raw: string): SetType {
  const lower = (raw || '').trim().toLowerCase();
  if (lower === 'warmup' || lower === 'warm-up' || lower === 'w') return 'warmup';
  if (lower === 'dropset' || lower === 'drop' || lower === 'd') return 'dropset';
  if (lower === 'failure' || lower === 'f') return 'failure';
  return 'normal';
}

function cleanExerciseName(raw: string): string {
  const trimmed = raw.trim();
  const directCanonical = findCanonicalExercise(trimmed);
  if (directCanonical) return directCanonical.nameEn;

  // Map Strong/Hevy "(Barbell)" / "(Dumbbell)" / "(Cable)" / "(Machine)" suffixes to canonical names
  const equipMatch = trimmed.match(/^(.+?)\s*\((Barbell|Dumbbell|Cable|Machine|Bodyweight)\)$/i);
  if (equipMatch) {
    const base = equipMatch[1].trim();
    const equip = equipMatch[2].trim();
    const withPrefix = findCanonicalExercise(`${equip} ${base}`);
    if (withPrefix) return withPrefix.nameEn;
    const baseOnly = findCanonicalExercise(base);
    if (baseOnly) return baseOnly.nameEn;
    if (/^Barbell$/i.test(equip)) return base;
  }
  return trimmed;
}

/**
 * Parses a Hevy or Strong workout CSV export into SPOT CompletedWorkout records.
 */
export function parseWorkoutHistoryCsv(rawCsv: string, defaultUnit: 'kg' | 'lbs' = 'kg'): CsvImportResult {
  const rows = parseCsvRows(rawCsv);
  if (rows.length < 2) {
    return {
      success: false,
      workouts: [],
      importedWorkoutsCount: 0,
      importedSetsCount: 0,
      skippedRowsCount: 0,
      error: 'CSV file is empty or missing data rows.',
    };
  }

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const col = (name: string) => headers.indexOf(name);

  const isHevy = col('exercise_title') !== -1 && col('start_time') !== -1;
  const isStrong = col('exercise name') !== -1 && col('date') !== -1;

  if (!isHevy && !isStrong) {
    return {
      success: false,
      workouts: [],
      importedWorkoutsCount: 0,
      importedSetsCount: 0,
      skippedRowsCount: 0,
      error: 'Unrecognized CSV format. Supported exports: Hevy (.csv) and Strong (.csv).',
    };
  }

  const source: CsvImportSource = isHevy ? 'hevy' : 'strong';
  const workoutMap = new Map<
    string,
    {
      workoutName: string;
      startedAt: Date;
      completedAt: Date;
      durationSeconds: number;
      exerciseOrder: string[];
      exercises: Map<string, { name: string; muscleGroup: string; sets: CompletedSet[] }>;
    }
  >();

  let skippedRowsCount = 0;
  let importedSetsCount = 0;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (headerName: string) => {
      const idx = col(headerName);
      return idx >= 0 && idx < cells.length ? cells[idx] : '';
    };

    let workoutTitle = '';
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let durationSec = 2700;
    let exerciseTitle = '';
    let weightKg = 0;
    let reps = 0;
    let setType: SetType = 'normal';
    let rir: number | undefined;

    if (isHevy) {
      workoutTitle = get('title') || 'Imported Workout';
      startDate = parseFlexibleDate(get('start_time'));
      endDate = parseFlexibleDate(get('end_time'));
      exerciseTitle = cleanExerciseName(get('exercise_title'));

      const wKgStr = get('weight_kg');
      const wLbsStr = get('weight_lbs');
      if (wKgStr !== '' && !isNaN(parseFloat(wKgStr))) {
        weightKg = Math.max(0, parseFloat(wKgStr));
      } else if (wLbsStr !== '' && !isNaN(parseFloat(wLbsStr))) {
        weightKg = Math.max(0, parseFloat(wLbsStr) * LBS_TO_KG);
      }

      reps = parseInt(get('reps'), 10) || 0;
      setType = mapSetType(get('set_type'));
      const rpeVal = parseFloat(get('rpe'));
      if (Number.isFinite(rpeVal) && rpeVal >= 5 && rpeVal <= 10) {
        rir = Math.max(0, Math.min(4, Math.round(10 - rpeVal)));
      }
      if (startDate && endDate && endDate.getTime() > startDate.getTime()) {
        durationSec = Math.max(60, Math.round((endDate.getTime() - startDate.getTime()) / 1000));
      }
    } else {
      // Strong CSV
      workoutTitle = get('workout name') || 'Imported Workout';
      startDate = parseFlexibleDate(get('date'));
      durationSec = parseDurationSeconds(get('duration'));
      endDate = startDate ? new Date(startDate.getTime() + durationSec * 1000) : null;
      exerciseTitle = cleanExerciseName(get('exercise name'));

      const rawWeight = parseFloat(get('weight'));
      if (Number.isFinite(rawWeight) && rawWeight >= 0) {
        weightKg = defaultUnit === 'lbs' ? rawWeight * LBS_TO_KG : rawWeight;
      }
      reps = parseInt(get('reps'), 10) || 0;
      setType = mapSetType(get('set order'));
      const rpeVal = parseFloat(get('rpe'));
      if (Number.isFinite(rpeVal) && rpeVal >= 5 && rpeVal <= 10) {
        rir = Math.max(0, Math.min(4, Math.round(10 - rpeVal)));
      }
    }

    if (!startDate || !exerciseTitle || reps <= 0) {
      skippedRowsCount++;
      continue;
    }

    const normalizedWeightKg = Math.round(weightKg * 100) / 100;
    const completedAt = endDate ?? new Date(startDate.getTime() + durationSec * 1000);
    const workoutKey = `${startDate.toISOString().slice(0, 16)}::${workoutTitle.toLowerCase()}`;

    let bucket = workoutMap.get(workoutKey);
    if (!bucket) {
      bucket = {
        workoutName: workoutTitle,
        startedAt: startDate,
        completedAt,
        durationSeconds: durationSec,
        exerciseOrder: [],
        exercises: new Map(),
      };
      workoutMap.set(workoutKey, bucket);
    }

    const exKey = exerciseTitle.toLowerCase();
    let exBucket = bucket.exercises.get(exKey);
    if (!exBucket) {
      exBucket = {
        name: exerciseTitle,
        muscleGroup: inferMuscleGroupFromExerciseName(exerciseTitle),
        sets: [],
      };
      bucket.exercises.set(exKey, exBucket);
      bucket.exerciseOrder.push(exKey);
    }

    const volume = Math.round(normalizedWeightKg * reps * 100) / 100;
    exBucket.sets.push({
      weight: normalizedWeightKg,
      reps,
      volume,
      completedAt: completedAt.toISOString(),
      setType,
      ...(rir !== undefined ? { rir } : {}),
    });
    importedSetsCount++;
  }

  const workouts: CompletedWorkout[] = [];
  let idx = 0;

  for (const [, bucket] of workoutMap.entries()) {
    const exercises: CompletedExercise[] = bucket.exerciseOrder
      .map((exKey, exIdx) => {
        const ex = bucket.exercises.get(exKey)!;
        const slug = ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `ex-${exIdx}`;
        return {
          exerciseId: `csv-${slug}`,
          exerciseName: ex.name,
          muscleGroup: ex.muscleGroup,
          sets: ex.sets,
        };
      })
      .filter((e) => e.sets.length > 0);

    if (exercises.length === 0) continue;

    const totalSets = exercises.reduce((sum, e) => sum + e.sets.length, 0);
    const totalVolume = Math.round(
      exercises.reduce(
        (sum, e) =>
          sum +
          e.sets
            .filter((s) => s.setType !== 'warmup')
            .reduce((sSum, s) => sSum + s.volume, 0),
        0
      ) * 100
    ) / 100;

    workouts.push({
      id: `csv-${source}-${bucket.startedAt.getTime()}-${idx++}`,
      programWorkoutId: `imported-${source}`,
      workoutName: bucket.workoutName,
      workoutDate: bucket.startedAt.toISOString().slice(0, 10),
      startedAt: bucket.startedAt.toISOString(),
      completedAt: bucket.completedAt.toISOString(),
      durationSeconds: bucket.durationSeconds,
      totalSets,
      plannedSets: totalSets,
      isPartial: false,
      totalVolume,
      exercises,
      personalRecords: [],
    });
  }

  // Newest first (matches SPOT history store convention)
  workouts.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  if (workouts.length === 0) {
    return {
      success: false,
      source,
      workouts: [],
      importedWorkoutsCount: 0,
      importedSetsCount: 0,
      skippedRowsCount,
      error: 'No valid completed sets were found in the CSV.',
    };
  }

  return {
    success: true,
    source,
    workouts,
    importedWorkoutsCount: workouts.length,
    importedSetsCount,
    skippedRowsCount,
  };
}

/**
 * Non-destructively merges imported workouts into existing SPOT history,
 * preventing duplicates when the same CSV file is imported more than once.
 */
export function mergeImportedWorkouts(
  existing: CompletedWorkout[],
  imported: CompletedWorkout[]
): { merged: CompletedWorkout[]; newlyAdded: number } {
  const fingerprint = (w: CompletedWorkout) =>
    `${(w.startedAt || w.completedAt || '').slice(0, 16)}::${(w.workoutName || '').trim().toLowerCase()}`;

  const existingKeys = new Set(existing.map(fingerprint));
  const toAdd = imported.filter((w) => !existingKeys.has(fingerprint(w)));

  const merged = [...existing, ...toAdd].sort(
    (a, b) => new Date(b.completedAt || b.startedAt).getTime() - new Date(a.completedAt || a.startedAt).getTime()
  );

  return { merged, newlyAdded: toAdd.length };
}

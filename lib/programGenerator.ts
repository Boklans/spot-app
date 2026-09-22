import { useUserProfileStore } from '@/store/userProfileStore';
import type { OnboardingData } from '@/store/workoutStore';

export type WorkoutSplitType = 'upper_lower' | 'full_body' | 'push_pull_legs' | 'custom' | 'blank';
export type EquipmentId = 'full_gym' | 'dumbbells' | 'barbell' | 'machines' | 'bodyweight';
export type GoalId = OnboardingData['goal'];

export type GeneratedExercise = {
  id: string;
  name: string;
  muscleGroup: string;
  sets: number;
  recommendedWeight: number;
  targetRepRange: string;
  equipment: EquipmentId;
  weightIncrement: number;
  restSeconds?: number;
};

export type GeneratedWorkout = {
  id: string;
  name: string;
  dayLabel: string;
  muscleGroups: string[];
  estimatedMinutes: number;
  defaultRestSeconds?: number;
  exercises: GeneratedExercise[];
};

export type GeneratedProgram = {
  id: string;
  name: string;
  description: string;
  daysPerWeek: number;
  estimatedWorkoutMinutes: number;
  splitType: WorkoutSplitType;
  defaultRestSeconds?: number;
  workouts: GeneratedWorkout[];
};

export function defaultWeightIncrement(equipment: EquipmentId): number {
  switch (equipment) {
    case 'barbell':
      return 2.5;
    case 'dumbbells':
      return 1;
    case 'machines':
      return 2.5;
    case 'bodyweight':
      return 0;
    case 'full_gym':
      return 2.5;
    default:
      return 2.5;
  }
}

export function formatSplitLabel(splitType: WorkoutSplitType): string {
  switch (splitType) {
    case 'upper_lower':
      return 'Upper · Lower';
    case 'full_body':
      return 'Full Body';
    case 'push_pull_legs':
      return 'Push · Pull · Legs';
    case 'custom':
      return 'Custom Split';
    case 'blank':
      return 'Custom Routine';
  }
}

type ExerciseOption = Omit<GeneratedExercise, 'sets' | 'targetRepRange'> & { targetRepRange?: string };
type WorkoutTemplate = { name: string; exercises: ExerciseOption[]; estimatedMinutes?: number };

export const DEFAULT_WEEKDAY_SCHEDULES: Record<number, string[]> = {
  1: ['SUN'],
  2: ['TUE', 'SAT'],
  3: ['MON', 'WED', 'FRI'],
  4: ['MON', 'TUE', 'THU', 'FRI'],
  5: ['MON', 'TUE', 'WED', 'FRI', 'SAT'],
  6: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  7: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
};

export function getWorkoutDayLabel(
  dayLabel?: string,
  index = 0,
  trainingDays?: string[],
  frequency = 3
): string {
  if (dayLabel && !dayLabel.toUpperCase().startsWith('WORKOUT')) {
    return dayLabel;
  }
  const days = (trainingDays && trainingDays.length > 0)
    ? trainingDays
    : (DEFAULT_WEEKDAY_SCHEDULES[frequency] ?? DEFAULT_WEEKDAY_SCHEDULES[3]);
  return days[index % days.length] ?? `DAY ${index + 1}`;
}

const defaultEquipment: EquipmentId[] = ['full_gym'];
const supportedEquipment: EquipmentId[] = ['full_gym', 'dumbbells', 'barbell', 'machines', 'bodyweight'];

function exerciseId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const option = (
  name: string,
  muscleGroup: string,
  recommendedWeight: number,
  equipment: EquipmentId,
  targetRepRange = '8-12',
  weightIncrement?: number,
  restSeconds?: number
): ExerciseOption => ({
  id: exerciseId(name),
  name,
  muscleGroup,
  recommendedWeight,
  equipment,
  targetRepRange,
  weightIncrement: weightIncrement ?? defaultWeightIncrement(equipment),
  restSeconds,
});

const exerciseOptions = {
  horizontalPush: [
    option('Bench Press', 'Chest', 70, 'barbell'),
    option('Dumbbell Bench Press', 'Chest', 24, 'dumbbells'),
    option('Machine Chest Press', 'Chest', 45, 'machines'),
    option('Push-ups', 'Chest', 0, 'bodyweight'),
  ],
  inclinePush: [
    option('Incline Dumbbell Press', 'Chest', 24, 'dumbbells'),
    option('Incline Bench Press', 'Chest', 60, 'barbell'),
    option('Incline Chest Press', 'Chest', 45, 'machines'),
    option('Push-ups', 'Chest', 0, 'bodyweight'),
  ],
  verticalPull: [
    option('Lat Pulldown', 'Back', 65, 'machines'),
    option('Barbell Row', 'Back', 70, 'barbell'),
    option('Dumbbell Row', 'Back', 24, 'dumbbells'),
    option('Pull-ups', 'Back', 0, 'bodyweight'),
  ],
  row: [
    option('Barbell Row', 'Back', 70, 'barbell'),
    option('Dumbbell Row', 'Back', 24, 'dumbbells'),
    option('Seated Row', 'Back', 55, 'machines'),
    option('Inverted Row', 'Back', 0, 'bodyweight'),
  ],
  squat: [
    option('Squat', 'Quads', 80, 'barbell'),
    option('Goblet Squat', 'Quads', 28, 'dumbbells'),
    option('Leg Press', 'Quads', 120, 'machines'),
    option('Bodyweight Squats', 'Quads', 0, 'bodyweight'),
  ],
  hinge: [
    option('Romanian Deadlift', 'Hamstrings', 70, 'barbell'),
    option('Dumbbell Romanian Deadlift', 'Hamstrings', 24, 'dumbbells'),
    option('Leg Curl', 'Hamstrings', 45, 'machines'),
    option('Glute Bridge', 'Hamstrings', 0, 'bodyweight'),
  ],
  shoulderPush: [
    option('Overhead Press', 'Shoulders', 45, 'barbell'),
    option('Dumbbell Shoulder Press', 'Shoulders', 18, 'dumbbells'),
    option('Machine Shoulder Press', 'Shoulders', 40, 'machines'),
    option('Pike Push-ups', 'Shoulders', 0, 'bodyweight'),
  ],
  biceps: [
    option('Biceps Curl', 'Biceps', 12, 'dumbbells'),
    option('Barbell Curl', 'Biceps', 25, 'barbell'),
    option('Cable Curl', 'Biceps', 25, 'machines'),
    option('Chin-ups', 'Biceps', 0, 'bodyweight'),
  ],
  triceps: [
    option('Triceps Pushdown', 'Triceps', 55, 'machines'),
    option('Dumbbell Overhead Extension', 'Triceps', 16, 'dumbbells'),
    option('Close-grip Bench Press', 'Triceps', 55, 'barbell'),
    option('Bench Dips', 'Triceps', 0, 'bodyweight'),
  ],
  core: [
    option('Plank', 'Core', 0, 'bodyweight', '30-60 sec'),
    option('Hanging Knee Raise', 'Core', 0, 'bodyweight', '10-15'),
    option('Cable Crunch', 'Core', 35, 'machines', '10-15'),
  ],
  calves: [
    option('Standing Calf Raise', 'Calves', 40, 'machines'),
    option('Dumbbell Calf Raise', 'Calves', 20, 'dumbbells'),
    option('Calf Raise', 'Calves', 0, 'bodyweight'),
  ],
  legAccessory: [
    option('Leg Extension', 'Quads', 40, 'machines'),
    option('Dumbbell Step-up', 'Quads', 16, 'dumbbells'),
    option('Step-ups', 'Quads', 0, 'bodyweight'),
  ],
  lunges: [
    option('Walking Lunges', 'Legs', 16, 'dumbbells'),
    option('Barbell Lunges', 'Legs', 40, 'barbell'),
    option('Reverse Lunges', 'Legs', 0, 'bodyweight'),
  ],
};

function isAvailable(required: EquipmentId, equipment: EquipmentId[]) {
  return required === 'bodyweight' || equipment.includes('full_gym') || equipment.includes(required);
}

function isEquipmentId(value: string): value is EquipmentId {
  return supportedEquipment.includes(value as EquipmentId);
}

function pick(options: ExerciseOption[], equipment: EquipmentId[]) {
  return options.find((item) => isAvailable(item.equipment, equipment)) ?? options[options.length - 1];
}

function fullBodyTemplates(equipment: EquipmentId[], strength = false): WorkoutTemplate[] {
  const sets = strength ? 3 : 3;
  const reps = strength ? '3-6' : '8-12';
  return [
    { name: 'Full Body A', exercises: [pick(exerciseOptions.squat, equipment), pick(exerciseOptions.horizontalPush, equipment), pick(exerciseOptions.verticalPull, equipment), pick(exerciseOptions.hinge, equipment), pick(exerciseOptions.core, equipment), pick(exerciseOptions.biceps, equipment)], estimatedMinutes: strength ? 50 : 55 },
    { name: 'Full Body B', exercises: [pick(exerciseOptions.hinge, equipment), pick(exerciseOptions.shoulderPush, equipment), pick(exerciseOptions.row, equipment), pick(exerciseOptions.lunges, equipment), pick(exerciseOptions.core, equipment), pick(exerciseOptions.triceps, equipment)], estimatedMinutes: strength ? 50 : 55 },
    { name: 'Full Body C', exercises: [pick(exerciseOptions.squat, equipment), pick(exerciseOptions.inclinePush, equipment), pick(exerciseOptions.row, equipment), pick(exerciseOptions.shoulderPush, equipment), pick(exerciseOptions.biceps, equipment), pick(exerciseOptions.triceps, equipment)], estimatedMinutes: 55 },
  ].map((template) => ({ ...template, exercises: template.exercises.map((exercise) => ({ ...exercise, targetRepRange: strength && !['Core'].includes(exercise.muscleGroup) ? reps : exercise.targetRepRange })) }));
}

function upperLowerTemplates(equipment: EquipmentId[], strength = false): WorkoutTemplate[] {
  const primaryReps = strength ? '3-6' : '8-12';
  const accessoryReps = strength ? '6-12' : '8-12';
  return [
    { name: 'Upper A', exercises: [pick(exerciseOptions.horizontalPush, equipment), pick(exerciseOptions.row, equipment), pick(exerciseOptions.verticalPull, equipment), pick(exerciseOptions.shoulderPush, equipment), pick(exerciseOptions.biceps, equipment), pick(exerciseOptions.triceps, equipment)] },
    { name: 'Lower A', exercises: [pick(exerciseOptions.squat, equipment), pick(exerciseOptions.hinge, equipment), pick(exerciseOptions.lunges, equipment), pick(exerciseOptions.legAccessory, equipment), pick(exerciseOptions.calves, equipment), pick(exerciseOptions.core, equipment)] },
    { name: 'Upper B', exercises: [pick(exerciseOptions.inclinePush, equipment), pick(exerciseOptions.verticalPull, equipment), pick(exerciseOptions.row, equipment), pick(exerciseOptions.shoulderPush, equipment), pick(exerciseOptions.biceps, equipment), pick(exerciseOptions.triceps, equipment)] },
    { name: 'Lower B', exercises: [pick(exerciseOptions.hinge, equipment), pick(exerciseOptions.squat, equipment), pick(exerciseOptions.lunges, equipment), pick(exerciseOptions.legAccessory, equipment), pick(exerciseOptions.calves, equipment), pick(exerciseOptions.core, equipment)] },
  ].map((template) => ({
    ...template,
    exercises: template.exercises.map((exercise) => ({ ...exercise, targetRepRange: ['Chest', 'Back', 'Quads', 'Hamstrings', 'Shoulders'].includes(exercise.muscleGroup) ? primaryReps : accessoryReps })),
  }));
}

function pushPullLegsTemplates(equipment: EquipmentId[]): WorkoutTemplate[] {
  return [
    {
      name: 'Push',
      exercises: [
        pick(exerciseOptions.horizontalPush, equipment),
        pick(exerciseOptions.inclinePush, equipment),
        pick(exerciseOptions.shoulderPush, equipment),
        pick(exerciseOptions.triceps, equipment),
        pick(exerciseOptions.core, equipment),
      ],
      estimatedMinutes: 50,
    },
    {
      name: 'Pull',
      exercises: [
        pick(exerciseOptions.verticalPull, equipment),
        pick(exerciseOptions.row, equipment),
        pick(exerciseOptions.biceps, equipment),
        pick(exerciseOptions.shoulderPush, equipment),
        pick(exerciseOptions.core, equipment),
      ],
      estimatedMinutes: 50,
    },
    {
      name: 'Legs',
      exercises: [
        pick(exerciseOptions.squat, equipment),
        pick(exerciseOptions.hinge, equipment),
        pick(exerciseOptions.lunges, equipment),
        pick(exerciseOptions.legAccessory, equipment),
        pick(exerciseOptions.calves, equipment),
      ],
      estimatedMinutes: 55,
    },
    {
      name: 'Push 2',
      exercises: [
        pick(exerciseOptions.inclinePush, equipment),
        pick(exerciseOptions.horizontalPush, equipment),
        pick(exerciseOptions.shoulderPush, equipment),
        pick(exerciseOptions.triceps, equipment),
      ],
      estimatedMinutes: 50,
    },
    {
      name: 'Pull 2',
      exercises: [
        pick(exerciseOptions.row, equipment),
        pick(exerciseOptions.verticalPull, equipment),
        pick(exerciseOptions.biceps, equipment),
        pick(exerciseOptions.core, equipment),
      ],
      estimatedMinutes: 50,
    },
    {
      name: 'Legs 2',
      exercises: [
        pick(exerciseOptions.hinge, equipment),
        pick(exerciseOptions.squat, equipment),
        pick(exerciseOptions.lunges, equipment),
        pick(exerciseOptions.calves, equipment),
      ],
      estimatedMinutes: 50,
    },
  ];
}

function customSplitTemplates(equipment: EquipmentId[]): WorkoutTemplate[] {
  return [
    {
      name: 'Chest & Triceps',
      exercises: [
        pick(exerciseOptions.horizontalPush, equipment),
        pick(exerciseOptions.inclinePush, equipment),
        pick(exerciseOptions.triceps, equipment),
        pick(exerciseOptions.core, equipment),
      ],
      estimatedMinutes: 45,
    },
    {
      name: 'Back & Biceps',
      exercises: [
        pick(exerciseOptions.verticalPull, equipment),
        pick(exerciseOptions.row, equipment),
        pick(exerciseOptions.biceps, equipment),
        pick(exerciseOptions.core, equipment),
      ],
      estimatedMinutes: 45,
    },
    {
      name: 'Legs & Shoulders',
      exercises: [
        pick(exerciseOptions.squat, equipment),
        pick(exerciseOptions.hinge, equipment),
        pick(exerciseOptions.shoulderPush, equipment),
        pick(exerciseOptions.calves, equipment),
      ],
      estimatedMinutes: 50,
    },
    {
      name: 'Arms & Core',
      exercises: [
        pick(exerciseOptions.biceps, equipment),
        pick(exerciseOptions.triceps, equipment),
        pick(exerciseOptions.shoulderPush, equipment),
        pick(exerciseOptions.core, equipment),
      ],
      estimatedMinutes: 40,
    },
    {
      name: 'Full Body Conditioning',
      exercises: [
        pick(exerciseOptions.squat, equipment),
        pick(exerciseOptions.horizontalPush, equipment),
        pick(exerciseOptions.verticalPull, equipment),
        pick(exerciseOptions.lunges, equipment),
      ],
      estimatedMinutes: 50,
    },
  ];
}

function repeatTemplates(templates: WorkoutTemplate[], frequency: number) {
  return Array.from({ length: frequency }, (_, index) => {
    const template = templates[index % templates.length];
    const cycle = Math.floor(index / templates.length);
    return cycle === 0 ? template : { ...template, name: `${template.name} ${cycle + 1}` };
  });
}

export function resolveRestSeconds(
  exercise?: { restSeconds?: number },
  workout?: { defaultRestSeconds?: number },
  program?: { defaultRestSeconds?: number }
): number {
  const profileRest = (() => {
    try {
      return useUserProfileStore.getState().profile.defaultRestSeconds;
    } catch {
      return undefined;
    }
  })();

  return exercise?.restSeconds
    ?? workout?.defaultRestSeconds
    ?? program?.defaultRestSeconds
    ?? profileRest
    ?? 150;
}

export function calculateRecommendedRest(
  exerciseName?: string,
  equipment?: EquipmentId,
  goal?: string,
  bodyStats?: { weightKg?: number }
): number {
  const isCompound = Boolean(
    exerciseName && (
      exerciseName.toLowerCase().includes('squat') ||
      exerciseName.toLowerCase().includes('bench') ||
      exerciseName.toLowerCase().includes('deadlift') ||
      exerciseName.toLowerCase().includes('overhead') ||
      exerciseName.toLowerCase().includes('leg press') ||
      exerciseName.toLowerCase().includes('row')
    )
  );

  let rest = isCompound ? 150 : 90;

  if (goal === 'get_stronger') {
    rest += 30;
  } else if (goal === 'lose_fat') {
    rest = Math.max(60, rest - 30);
  }

  // Heavier trainees performing compound lifts require extended ATP-CP resynthesis
  if (isCompound && bodyStats?.weightKg && bodyStats.weightKg >= 85) {
    rest = Math.min(180, rest + 15);
  }

  return rest;
}

export function calibrateInitialWeight(
  baseWeight: number,
  equipment: EquipmentId,
  experience?: string,
  goal?: string,
  bodyStats?: { weightKg?: number; heightCm?: number },
  exerciseName?: string,
  baselineLifts?: {
    benchPressKg?: number;
    squatKg?: number;
    deadliftKg?: number;
    overheadPressKg?: number;
  }
): number {
  if (equipment === 'bodyweight' || baseWeight <= 0) return 0;

  // Direct 1RM / Baseline Lifts calibration for experienced lifters
  if (baselineLifts && exerciseName) {
    const lower = exerciseName.toLowerCase();

    // Bench Press related
    if (baselineLifts.benchPressKg && baselineLifts.benchPressKg > 0) {
      const bench = baselineLifts.benchPressKg;
      if (
        lower === 'bench press' ||
        (lower.includes('bench press') &&
          !lower.includes('incline') &&
          !lower.includes('dumbbell') &&
          !lower.includes('close-grip') &&
          !lower.includes('machine'))
      ) {
        return Math.max(20, Math.round(bench / 2.5) * 2.5);
      }
      if (lower.includes('incline') && lower.includes('bench')) {
        return Math.max(20, Math.round((bench * 0.85) / 2.5) * 2.5);
      }
      if (
        lower.includes('dumbbell') &&
        (lower.includes('bench') || (lower.includes('press') && lower.includes('incline')))
      ) {
        return Math.max(4, Math.round((bench * 0.38) / 2) * 2);
      }
      if (lower.includes('close-grip')) {
        return Math.max(20, Math.round((bench * 0.75) / 2.5) * 2.5);
      }
      if (lower.includes('chest fly') || lower.includes('chest press')) {
        return Math.max(10, Math.round((bench * 0.7) / 2.5) * 2.5);
      }
    }

    // Squat related
    if (baselineLifts.squatKg && baselineLifts.squatKg > 0) {
      const squat = baselineLifts.squatKg;
      if (
        lower === 'squat' ||
        (lower.includes('squat') &&
          !lower.includes('bulgarian') &&
          !lower.includes('goblet') &&
          !lower.includes('bodyweight'))
      ) {
        return Math.max(20, Math.round(squat / 2.5) * 2.5);
      }
      if (lower.includes('leg press')) {
        return Math.max(40, Math.round((squat * 1.5) / 5) * 5);
      }
      if (lower.includes('goblet squat')) {
        return Math.max(6, Math.round((squat * 0.35) / 2) * 2);
      }
      if (lower.includes('leg extension')) {
        return Math.max(10, Math.round((squat * 0.45) / 2.5) * 2.5);
      }
      if (lower.includes('bulgarian') || lower.includes('step-up')) {
        return Math.max(4, Math.round((squat * 0.2) / 2) * 2);
      }
      if (lower.includes('barbell lunges') || (lower.includes('lunges') && equipment === 'barbell')) {
        return Math.max(20, Math.round((squat * 0.5) / 2.5) * 2.5);
      }
      if (lower.includes('lunges')) {
        return Math.max(4, Math.round((squat * 0.2) / 2) * 2);
      }
    }

    // Deadlift related
    if (baselineLifts.deadliftKg && baselineLifts.deadliftKg > 0) {
      const deadlift = baselineLifts.deadliftKg;
      if (lower === 'deadlift') {
        return Math.max(20, Math.round(deadlift / 2.5) * 2.5);
      }
      if (lower.includes('romanian deadlift')) {
        if (equipment === 'dumbbells') {
          return Math.max(4, Math.round((deadlift * 0.3) / 2) * 2);
        }
        return Math.max(20, Math.round((deadlift * 0.75) / 2.5) * 2.5);
      }
      if (lower.includes('barbell row') || lower.includes('bent over row')) {
        return Math.max(20, Math.round((deadlift * 0.6) / 2.5) * 2.5);
      }
      if (lower.includes('dumbbell row')) {
        return Math.max(4, Math.round((deadlift * 0.25) / 2) * 2);
      }
      if (lower.includes('lat pulldown') || lower.includes('seated row')) {
        return Math.max(15, Math.round((deadlift * 0.5) / 2.5) * 2.5);
      }
      if (lower.includes('leg curl')) {
        return Math.max(10, Math.round((deadlift * 0.35) / 2.5) * 2.5);
      }
    }

    // Overhead Press related
    if (baselineLifts.overheadPressKg && baselineLifts.overheadPressKg > 0) {
      const ohp = baselineLifts.overheadPressKg;
      if (lower === 'overhead press' || (lower.includes('overhead') && !lower.includes('extension'))) {
        if (equipment === 'dumbbells') {
          return Math.max(4, Math.round((ohp * 0.42) / 2) * 2);
        }
        return Math.max(20, Math.round(ohp / 2.5) * 2.5);
      }
      if (lower.includes('shoulder press')) {
        if (equipment === 'dumbbells') {
          return Math.max(4, Math.round((ohp * 0.42) / 2) * 2);
        }
        return Math.max(10, Math.round((ohp * 0.75) / 2.5) * 2.5);
      }
      if (lower.includes('lateral raise')) {
        return Math.max(2, Math.round((ohp * 0.2) / 1) * 1);
      }
    }
  }

  // 1. Experience scaling
  let expMultiplier = 1.0;
  if (experience === 'beginner') expMultiplier = 0.55;
  else if (experience === 'advanced') expMultiplier = 1.30;

  // 2. Goal scaling
  let goalMultiplier = 1.0;
  if (goal === 'get_stronger') goalMultiplier = 1.10;
  else if (goal === 'lose_fat') goalMultiplier = 0.90;

  // 3. Bodyweight allometric scaling (reference lifter: 75 kg)
  let bodyMultiplier = 1.0;
  if (bodyStats?.weightKg && bodyStats.weightKg > 35) {
    bodyMultiplier = Math.pow(bodyStats.weightKg / 75, 0.67);
    bodyMultiplier = Math.max(0.72, Math.min(1.35, bodyMultiplier));
  }

  const raw = baseWeight * expMultiplier * goalMultiplier * bodyMultiplier;

  // 4. Equipment-specific roundings
  if (equipment === 'barbell') {
    const rounded = Math.round(raw / 2.5) * 2.5;
    return Math.max(20, rounded);
  }

  if (equipment === 'dumbbells') {
    const rounded = Math.round(raw / 2) * 2;
    return Math.max(4, rounded);
  }

  if (equipment === 'machines') {
    const rounded = Math.round(raw / 2.5) * 2.5;
    return Math.max(10, rounded);
  }

  return Math.round(raw / 2.5) * 2.5;
}

function buildWorkouts(
  templates: WorkoutTemplate[],
  frequency: number,
  defaultRestSeconds = 150,
  trainingDays?: string[],
  onboarding?: OnboardingData
): GeneratedWorkout[] {
  const targetDuration = onboarding?.sessionDurationMinutes ?? 45;
  const maxExercises = targetDuration <= 35 ? 4 : targetDuration <= 50 ? 5 : 6;

  return repeatTemplates(templates, frequency).map((template, index) => {
    const candidateExercises =
      template.exercises.length > maxExercises
        ? template.exercises.slice(0, maxExercises)
        : template.exercises;

    const exercises: GeneratedExercise[] = candidateExercises.map((exercise) => {
      const calibratedWeight = onboarding
        ? calibrateInitialWeight(
            exercise.recommendedWeight,
            exercise.equipment,
            onboarding.experience,
            onboarding.goal,
            { weightKg: onboarding.weightKg, heightCm: onboarding.heightCm },
            exercise.name,
            onboarding.baselineLifts
          )
        : exercise.recommendedWeight;

      const calibratedRest = onboarding
        ? calculateRecommendedRest(
            exercise.name,
            exercise.equipment,
            onboarding.goal,
            { weightKg: onboarding.weightKg }
          )
        : exercise.restSeconds ?? defaultRestSeconds;

      const calibratedReps = exercise.targetRepRange ?? (
        onboarding?.experience === 'beginner'
          ? '12-15'
          : onboarding?.experience === 'advanced'
          ? '6-10'
          : '8-12'
      );

      return {
        ...exercise,
        recommendedWeight: calibratedWeight,
        restSeconds: calibratedRest,
        sets: exercise.muscleGroup === 'Core' ? 2 : 3,
        targetRepRange: calibratedReps,
        name: exercise.name,
        weightIncrement: exercise.weightIncrement ?? defaultWeightIncrement(exercise.equipment),
      };
    });
    return {
      id: `workout-${index + 1}`,
      name: template.name,
      dayLabel: getWorkoutDayLabel(undefined, index, trainingDays, frequency),
      muscleGroups: [...new Set(exercises.map((exercise) => exercise.muscleGroup))],
      estimatedMinutes: targetDuration,
      defaultRestSeconds,
      exercises,
    };
  });
}

export function generateProgram(onboarding: OnboardingData): GeneratedProgram {
  const frequency = Math.min(7, Math.max(1, onboarding.trainingFrequency));
  const selectedEquipment = onboarding.equipment.filter(isEquipmentId);
  const equipment = selectedEquipment.length > 0 ? selectedEquipment : defaultEquipment;
  let templates: WorkoutTemplate[];
  let name: string;
  let description: string;
  let splitType: WorkoutSplitType;

  if (onboarding.splitPreference === 'full_body') {
    splitType = 'full_body';
    templates = fullBodyTemplates(equipment, onboarding.goal === 'get_stronger');
    name = onboarding.goal === 'get_stronger' ? 'Full Body Strength' : 'Full Body Hypertrophy';
    description = 'High-frequency full-body sessions hitting every muscle group with maximum recovery.';
  } else if (onboarding.splitPreference === 'push_pull_legs') {
    splitType = 'push_pull_legs';
    templates = pushPullLegsTemplates(equipment);
    name = 'Push / Pull / Legs (PPL)';
    description = 'Specialized split targeting synergistic muscle groups with high focus and pump.';
  } else if (onboarding.splitPreference === 'upper_lower') {
    splitType = 'upper_lower';
    templates = upperLowerTemplates(equipment, onboarding.goal === 'get_stronger');
    name = 'Upper / Lower Split';
    description = 'Classic balanced structure separating upper body pushing/pulling and lower body power.';
  } else if (onboarding.splitPreference === 'custom') {
    splitType = 'custom';
    templates = customSplitTemplates(equipment);
    name = 'Custom Athlete Split';
    description = 'Targeted muscle group split with freedom to customize exercises.';
  } else if (onboarding.splitPreference === 'blank') {
    splitType = 'blank';
    templates = Array.from({ length: frequency }, (_, idx) => ({
      name: `Workout ${String.fromCharCode(65 + idx)}`,
      exercises: [],
      estimatedMinutes: 45,
    }));
    name = 'Custom Routine';
    description = 'Your custom workouts built from scratch.';
  } else if (onboarding.goal === 'get_stronger') {
    const isPpl = frequency >= 5;
    splitType = isPpl ? 'push_pull_legs' : 'upper_lower';
    const strengthBase = isPpl ? pushPullLegsTemplates(equipment) : upperLowerTemplates(equipment, true);
    templates = strengthBase.map((template) => ({ ...template, exercises: template.exercises.slice(0, 5) }));
    name = 'Strength Foundation';
    description = 'Compound-focused training with steady, measurable progress.';
  } else if (onboarding.goal === 'lose_fat') {
    splitType = frequency <= 3 ? 'full_body' : 'upper_lower';
    templates = frequency <= 3 ? fullBodyTemplates(equipment) : upperLowerTemplates(equipment);
    name = 'Lean Strength';
    description = 'Efficient full-body training built for consistent progress.';
  } else if (onboarding.goal === 'recomposition') {
    splitType = onboarding.experience === 'beginner' ? 'full_body' : 'upper_lower';
    templates = onboarding.experience === 'beginner' ? fullBodyTemplates(equipment) : upperLowerTemplates(equipment);
    name = 'Build & Refine';
    description = 'Moderate-volume hypertrophy training for strength and shape.';
  } else if (onboarding.experience === 'beginner') {
    splitType = 'full_body';
    templates = fullBodyTemplates(equipment);
    name = 'Foundation Builder';
    description = 'Simple full-body sessions to build consistency and confidence.';
  } else if (onboarding.experience === 'advanced' && frequency >= 5) {
    splitType = 'push_pull_legs';
    templates = pushPullLegsTemplates(equipment);
    name = 'Performance Split';
    description = 'A focused five-day structure for experienced training.';
  } else {
    splitType = 'upper_lower';
    templates = upperLowerTemplates(equipment);
    name = 'Upper Lower';
    description = 'A balanced split that makes every training day count.';
  }

  const defaultRestSeconds = 150;

  return {
    id: `program-${onboarding.goal}-${onboarding.experience}-${frequency}`,
    name,
    description,
    daysPerWeek: frequency,
    estimatedWorkoutMinutes: onboarding.sessionDurationMinutes ?? 45,
    splitType,
    defaultRestSeconds,
    workouts: buildWorkouts(templates, frequency, defaultRestSeconds, onboarding.trainingDays, onboarding),
  };
}

export type WorkoutFocus = 'upper' | 'lower' | 'full_body' | 'push' | 'pull' | 'arms_core';

export interface FocusOption {
  id: WorkoutFocus;
  labelUk: string;
  labelEn: string;
  icon: string;
  subtitleUk: string;
  subtitleEn: string;
}

export const WORKOUT_FOCUS_OPTIONS: FocusOption[] = [
  { id: 'upper', labelUk: 'Верх', labelEn: 'Upper', icon: '💪', subtitleUk: 'Груди, спина, руки', subtitleEn: 'Chest, back, arms' },
  { id: 'lower', labelUk: 'Низ', labelEn: 'Lower', icon: '🦵', subtitleUk: 'Ноги, сідниці, литки', subtitleEn: 'Quads, hamstrings, calves' },
  { id: 'full_body', labelUk: 'Все тіло', labelEn: 'Full Body', icon: '🔥', subtitleUk: 'Базові рухи на все тіло', subtitleEn: 'Full body compound lifts' },
  { id: 'push', labelUk: 'Груди / Плечі', labelEn: 'Push', icon: '⚡', subtitleUk: 'Груди, дельти, трицепс', subtitleEn: 'Chest, delts, triceps' },
  { id: 'pull', labelUk: 'Спина / Біцепс', labelEn: 'Pull', icon: '🏋️', subtitleUk: 'Спина, тяга, біцепс', subtitleEn: 'Back, rows, biceps' },
  { id: 'arms_core', labelUk: 'Руки / Прес', labelEn: 'Arms & Core', icon: '💥', subtitleUk: 'Біцепс, трицепс, кор', subtitleEn: 'Biceps, triceps, abs' },
];

export function generateFocusWorkout(
  focus: WorkoutFocus,
  onboarding?: OnboardingData,
  cycle = 0
): GeneratedWorkout {
  const selectedEquipment = onboarding?.equipment?.filter(isEquipmentId) ?? defaultEquipment;
  const equipment = selectedEquipment.length > 0 ? selectedEquipment : defaultEquipment;
  const duration = onboarding?.sessionDurationMinutes ?? 45;

  let variants: { name: string; pools: ExerciseOption[][] }[];

  switch (focus) {
    case 'upper':
      variants = [
        {
          name: 'Верх тіла · Варіант A',
          pools: [
            exerciseOptions.horizontalPush,
            exerciseOptions.row,
            exerciseOptions.verticalPull,
            exerciseOptions.shoulderPush,
            exerciseOptions.biceps,
            exerciseOptions.triceps,
          ],
        },
        {
          name: 'Верх тіла · Варіант B',
          pools: [
            exerciseOptions.inclinePush,
            exerciseOptions.verticalPull,
            exerciseOptions.row,
            exerciseOptions.shoulderPush,
            exerciseOptions.biceps,
            exerciseOptions.triceps,
          ],
        },
      ];
      break;

    case 'lower':
      variants = [
        {
          name: 'Низ тіла · Варіант A',
          pools: [
            exerciseOptions.squat,
            exerciseOptions.hinge,
            exerciseOptions.lunges,
            exerciseOptions.legAccessory,
            exerciseOptions.calves,
            exerciseOptions.core,
          ],
        },
        {
          name: 'Низ тіла · Варіант B',
          pools: [
            exerciseOptions.hinge,
            exerciseOptions.squat,
            exerciseOptions.lunges,
            exerciseOptions.legAccessory,
            exerciseOptions.calves,
            exerciseOptions.core,
          ],
        },
      ];
      break;

    case 'full_body':
      variants = [
        {
          name: 'Все тіло · Варіант A',
          pools: [
            exerciseOptions.squat,
            exerciseOptions.horizontalPush,
            exerciseOptions.verticalPull,
            exerciseOptions.hinge,
            exerciseOptions.core,
            exerciseOptions.biceps,
          ],
        },
        {
          name: 'Все тіло · Варіант B',
          pools: [
            exerciseOptions.hinge,
            exerciseOptions.shoulderPush,
            exerciseOptions.row,
            exerciseOptions.lunges,
            exerciseOptions.core,
            exerciseOptions.triceps,
          ],
        },
        {
          name: 'Все тіло · Варіант C',
          pools: [
            exerciseOptions.squat,
            exerciseOptions.inclinePush,
            exerciseOptions.row,
            exerciseOptions.shoulderPush,
            exerciseOptions.biceps,
            exerciseOptions.triceps,
          ],
        },
      ];
      break;

    case 'push':
      variants = [
        {
          name: 'Жимовий день · Варіант A',
          pools: [
            exerciseOptions.horizontalPush,
            exerciseOptions.inclinePush,
            exerciseOptions.shoulderPush,
            exerciseOptions.triceps,
            exerciseOptions.core,
          ],
        },
        {
          name: 'Жимовий день · Варіант B',
          pools: [
            exerciseOptions.inclinePush,
            exerciseOptions.horizontalPush,
            exerciseOptions.shoulderPush,
            exerciseOptions.triceps,
            exerciseOptions.core,
          ],
        },
      ];
      break;

    case 'pull':
      variants = [
        {
          name: 'Тяговий день · Варіант A',
          pools: [
            exerciseOptions.verticalPull,
            exerciseOptions.row,
            exerciseOptions.biceps,
            exerciseOptions.shoulderPush,
            exerciseOptions.core,
          ],
        },
        {
          name: 'Тяговий день · Варіант B',
          pools: [
            exerciseOptions.row,
            exerciseOptions.verticalPull,
            exerciseOptions.biceps,
            exerciseOptions.core,
            exerciseOptions.shoulderPush,
          ],
        },
      ];
      break;

    case 'arms_core':
      variants = [
        {
          name: 'Руки та Прес · Варіант A',
          pools: [
            exerciseOptions.biceps,
            exerciseOptions.triceps,
            exerciseOptions.biceps,
            exerciseOptions.triceps,
            exerciseOptions.core,
          ],
        },
        {
          name: 'Руки та Прес · Варіант B',
          pools: [
            exerciseOptions.triceps,
            exerciseOptions.biceps,
            exerciseOptions.shoulderPush,
            exerciseOptions.triceps,
            exerciseOptions.core,
          ],
        },
      ];
      break;
  }

  const selectedVariant = variants[Math.abs(cycle) % variants.length];

  // Adjust exercise count based on chosen session duration
  const targetExerciseCount = duration <= 30 ? 4 : duration <= 45 ? 5 : 6;
  const poolsToUse = selectedVariant.pools.slice(0, targetExerciseCount);

  // Pick suitable exercise for available equipment, cycling through options if multiple exist
  const selectedOptions = poolsToUse.map((pool, poolIdx) => {
    const valid = pool.filter((item) => isAvailable(item.equipment, equipment));
    if (valid.length === 0) return pool[pool.length - 1];
    // Rotate alternative exercise inside the pool based on cycle
    const itemIdx = (Math.floor(cycle / variants.length) + poolIdx) % valid.length;
    return valid[itemIdx] ?? valid[0];
  });

  const exercises: GeneratedExercise[] = selectedOptions.map((exercise) => {
    const calibratedWeight = onboarding
      ? calibrateInitialWeight(
          exercise.recommendedWeight,
          exercise.equipment,
          onboarding.experience,
          onboarding.goal,
          { weightKg: onboarding.weightKg, heightCm: onboarding.heightCm },
          exercise.name,
          onboarding.baselineLifts
        )
      : exercise.recommendedWeight;

    const calibratedRest = onboarding
      ? calculateRecommendedRest(
          exercise.name,
          exercise.equipment,
          onboarding.goal,
          { weightKg: onboarding.weightKg }
        )
      : exercise.restSeconds ?? 120;

    const calibratedReps = exercise.targetRepRange ?? (
      onboarding?.experience === 'beginner'
        ? '12-15'
        : onboarding?.experience === 'advanced'
        ? '6-10'
        : '8-12'
    );

    return {
      ...exercise,
      recommendedWeight: calibratedWeight,
      restSeconds: calibratedRest,
      sets: exercise.muscleGroup === 'Core' ? 2 : 3,
      targetRepRange: calibratedReps,
      name: exercise.name,
      weightIncrement: exercise.weightIncrement ?? defaultWeightIncrement(exercise.equipment),
    };
  });

  return {
    id: `focus-${focus}-${cycle}`,
    name: selectedVariant.name,
    dayLabel: 'СЬОГОДНІ',
    muscleGroups: [...new Set(exercises.map((e) => e.muscleGroup))],
    estimatedMinutes: duration,
    defaultRestSeconds: 120,
    exercises,
  };
}

export function getExerciseAlternatives(
  currentExerciseName: string,
  equipment: EquipmentId[] = defaultEquipment
): ExerciseOption[] {
  // Find which pool current exercise belongs to
  for (const pool of Object.values(exerciseOptions)) {
    const found = pool.some((e) => e.name.toLowerCase() === currentExerciseName.toLowerCase());
    if (found) {
      return pool.filter(
        (e) =>
          e.name.toLowerCase() !== currentExerciseName.toLowerCase() &&
          isAvailable(e.equipment, equipment)
      );
    }
  }

  // Fallback: match by general equipment
  return [
    ...exerciseOptions.horizontalPush,
    ...exerciseOptions.verticalPull,
    ...exerciseOptions.squat,
    ...exerciseOptions.shoulderPush,
  ].filter(
    (e) =>
      e.name.toLowerCase() !== currentExerciseName.toLowerCase() &&
      isAvailable(e.equipment, equipment)
  );
}


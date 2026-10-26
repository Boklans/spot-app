import { useUserProfileStore } from '@/store/userProfileStore';
import type { OnboardingData, PriorityMuscleFocus, TrainingLimitation } from '@/store/workoutStore';

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

export const ALL_WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export function getWorkoutDayLabel(
  dayLabel?: string,
  index = 0,
  trainingDays?: string[],
  frequency = 3
): string {
  if (dayLabel && !dayLabel.toUpperCase().startsWith('WORKOUT') && !dayLabel.toUpperCase().match(/^DAY\s*\d+$/i)) {
    return dayLabel;
  }
  const days = (trainingDays && trainingDays.length >= frequency)
    ? trainingDays
    : (DEFAULT_WEEKDAY_SCHEDULES[frequency] ?? DEFAULT_WEEKDAY_SCHEDULES[3]);
  return days[index % days.length] ?? `DAY ${index + 1}`;
}

export function getNextAvailableWeekday(
  existingWorkouts: { dayLabel?: string }[],
  trainingDays?: string[]
): string {
  const existingDays = new Set(
    existingWorkouts
      .map((w, idx) => getWorkoutDayLabel(w.dayLabel, idx, trainingDays, existingWorkouts.length).trim().toUpperCase())
      .filter(Boolean)
  );

  const lastWeekday = [...existingWorkouts]
    .reverse()
    .map((w, revIdx) => {
      const actualIdx = existingWorkouts.length - 1 - revIdx;
      return getWorkoutDayLabel(w.dayLabel, actualIdx, trainingDays, existingWorkouts.length).trim().toUpperCase();
    })
    .find((label) => label && ALL_WEEKDAYS.includes(label));

  const lastIndex = lastWeekday ? ALL_WEEKDAYS.indexOf(lastWeekday) : -1;

  for (let i = 1; i <= 7; i++) {
    const candidate = ALL_WEEKDAYS[(lastIndex + i) % 7];
    if (!existingDays.has(candidate)) {
      return candidate;
    }
  }

  return `Day ${existingWorkouts.length + 1}`;
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
    option('Bench Press', 'Chest', 65, 'barbell'),
    option('Dumbbell Bench Press', 'Chest', 20, 'dumbbells'),
    option('Machine Chest Press', 'Chest', 40, 'machines'),
    option('Push-ups', 'Chest', 0, 'bodyweight'),
  ],
  inclinePush: [
    option('Incline Dumbbell Press', 'Chest', 20, 'dumbbells'),
    option('Incline Bench Press', 'Chest', 55, 'barbell'),
    option('Incline Chest Press', 'Chest', 40, 'machines'),
    option('Push-ups', 'Chest', 0, 'bodyweight'),
  ],
  verticalPull: [
    option('Lat Pulldown', 'Back', 55, 'machines'),
    option('Dumbbell Row', 'Back', 20, 'dumbbells'),
    option('Barbell Row', 'Back', 60, 'barbell'),
    option('Pull-ups', 'Back', 0, 'bodyweight'),
  ],
  row: [
    option('Seated Row', 'Back', 50, 'machines'),
    option('Dumbbell Row', 'Back', 20, 'dumbbells'),
    option('Barbell Row', 'Back', 60, 'barbell'),
    option('Inverted Row', 'Back', 0, 'bodyweight'),
  ],
  squat: [
    option('Squat', 'Quads', 70, 'barbell'),
    option('Goblet Squat', 'Quads', 20, 'dumbbells'),
    option('Leg Press', 'Quads', 100, 'machines'),
    option('Bodyweight Squats', 'Quads', 0, 'bodyweight'),
  ],
  hinge: [
    option('Romanian Deadlift', 'Hamstrings', 65, 'barbell'),
    option('Dumbbell Romanian Deadlift', 'Hamstrings', 20, 'dumbbells'),
    option('Leg Curl', 'Hamstrings', 40, 'machines'),
    option('Glute Bridge', 'Hamstrings', 0, 'bodyweight'),
  ],
  glutes: [
    option('Hip Thrust', 'Glutes', 60, 'barbell'),
    option('Dumbbell Hip Thrust', 'Glutes', 22, 'dumbbells'),
    option('Cable Pull-Through', 'Glutes', 35, 'machines'),
    option('Glute Bridge', 'Glutes', 0, 'bodyweight', '12-15'),
  ],
  shoulderPush: [
    option('Dumbbell Shoulder Press', 'Shoulders', 16, 'dumbbells'),
    option('Overhead Press', 'Shoulders', 40, 'barbell'),
    option('Machine Shoulder Press', 'Shoulders', 35, 'machines'),
    option('Pike Push-ups', 'Shoulders', 0, 'bodyweight'),
  ],
  biceps: [
    option('Biceps Curl', 'Biceps', 12, 'dumbbells'),
    option('Cable Curl', 'Biceps', 25, 'machines'),
    option('Barbell Curl', 'Biceps', 25, 'barbell'),
    option('Chin-ups', 'Biceps', 0, 'bodyweight'),
  ],
  triceps: [
    option('Triceps Pushdown', 'Triceps', 40, 'machines'),
    option('Dumbbell Overhead Extension', 'Triceps', 14, 'dumbbells'),
    option('Close-grip Bench Press', 'Triceps', 50, 'barbell'),
    option('Bench Dips', 'Triceps', 0, 'bodyweight'),
  ],
  core: [
    option('Plank', 'Core', 0, 'bodyweight', '30-60 sec'),
    option('Cable Crunch', 'Core', 35, 'machines', '10-15'),
    option('Hanging Knee Raise', 'Core', 0, 'bodyweight', '10-15'),
  ],
  calves: [
    option('Standing Calf Raise', 'Calves', 40, 'machines'),
    option('Dumbbell Calf Raise', 'Calves', 18, 'dumbbells'),
    option('Calf Raise', 'Calves', 0, 'bodyweight'),
  ],
  legAccessory: [
    option('Leg Extension', 'Quads', 40, 'machines'),
    option('Dumbbell Step-up', 'Quads', 14, 'dumbbells'),
    option('Step-ups', 'Quads', 0, 'bodyweight'),
  ],
  lunges: [
    option('Bulgarian Split Squat', 'Glutes', 14, 'dumbbells'),
    option('Walking Lunges', 'Legs', 14, 'dumbbells'),
    option('Barbell Lunges', 'Legs', 35, 'barbell'),
    option('Reverse Lunges', 'Legs', 0, 'bodyweight'),
  ],
  lateralRaise: [
    option('Lateral Raises', 'Shoulders', 6, 'dumbbells', '12-15'),
    option('Cable Lateral Raise', 'Shoulders', 7.5, 'machines', '12-15'),
    option('Dumbbell Shoulder Press', 'Shoulders', 12, 'dumbbells'),
  ],
  gluteAccessory: [
    option('Bulgarian Split Squat', 'Glutes', 12, 'dumbbells', '10-12'),
    option('Walking Lunges', 'Legs', 12, 'dumbbells', '10-12'),
    option('Cable Pull-Through', 'Glutes', 30, 'machines', '12-15'),
    option('Glute Bridge', 'Glutes', 0, 'bodyweight', '12-15'),
  ],
};

function isAvailable(required: EquipmentId, equipment: EquipmentId[]) {
  return required === 'bodyweight' || equipment.includes('full_gym') || equipment.includes(required);
}

function normalizeEquipmentToken(value: string): EquipmentId | null {
  const cleaned = value.toLowerCase().trim().replaceAll(' ', '_');
  if (cleaned === 'cables_machines' || cleaned === 'cables_&_machines') return 'machines';
  if (supportedEquipment.includes(cleaned as EquipmentId)) return cleaned as EquipmentId;
  return null;
}

function pick(
  options: ExerciseOption[],
  equipment: EquipmentId[],
  limitations: TrainingLimitation[] = []
): ExerciseOption {
  const available = options.filter((item) => isAvailable(item.equipment, equipment));
  const pool = available.length > 0 ? available : [options[options.length - 1]];

  if (limitations.length > 0) {
    const jointSafe = pool.filter((item) => {
      const lower = item.name.toLowerCase();
      if (limitations.includes('lower_back')) {
        if (lower === 'squat' || lower === 'barbell row' || lower === 'romanian deadlift') {
          return false;
        }
      }
      if (limitations.includes('knees')) {
        if (lower.includes('lunge') || lower.includes('split squat') || lower === 'leg extension') {
          return false;
        }
      }
      if (limitations.includes('shoulders')) {
        if (lower === 'bench press' || lower === 'overhead press' || lower === 'bench dips') {
          return false;
        }
      }
      return true;
    });
    if (jointSafe.length > 0) {
      return jointSafe[0];
    }
  }

  return pool[0];
}

function hasPriority(priorities: PriorityMuscleFocus[] | undefined, target: PriorityMuscleFocus): boolean {
  return Boolean(priorities && priorities.includes(target));
}

function fullBodyTemplates(
  equipment: EquipmentId[],
  strength = false,
  priorities: PriorityMuscleFocus[] = ['balanced'],
  limitations: TrainingLimitation[] = []
): WorkoutTemplate[] {
  const reps = strength ? '3-6' : '8-12';
  const focusLowerGlutes = hasPriority(priorities, 'lower_glutes');
  const focusBackCore = hasPriority(priorities, 'back_core');

  const templates: WorkoutTemplate[] = focusLowerGlutes
    ? [
        {
          name: 'Full Body A',
          exercises: [
            pick(exerciseOptions.glutes, equipment, limitations),
            pick(exerciseOptions.squat, equipment, limitations),
            pick(exerciseOptions.verticalPull, equipment, limitations),
            pick(exerciseOptions.horizontalPush, equipment, limitations),
            pick(exerciseOptions.hinge, equipment, limitations),
            pick(exerciseOptions.core, equipment, limitations),
          ],
          estimatedMinutes: strength ? 50 : 55,
        },
        {
          name: 'Full Body B',
          exercises: [
            pick(exerciseOptions.hinge, equipment, limitations),
            pick(exerciseOptions.lunges, equipment, limitations),
            pick(exerciseOptions.row, equipment, limitations),
            pick(exerciseOptions.shoulderPush, equipment, limitations),
            pick(exerciseOptions.glutes, equipment, limitations),
            pick(exerciseOptions.core, equipment, limitations),
          ],
          estimatedMinutes: strength ? 50 : 55,
        },
        {
          name: 'Full Body C',
          exercises: [
            pick(exerciseOptions.squat, equipment, limitations),
            pick(exerciseOptions.glutes, equipment, limitations),
            pick(exerciseOptions.inclinePush, equipment, limitations),
            pick(exerciseOptions.verticalPull, equipment, limitations),
            pick(exerciseOptions.legAccessory, equipment, limitations),
            pick(exerciseOptions.core, equipment, limitations),
          ],
          estimatedMinutes: 55,
        },
      ]
    : focusBackCore
    ? [
        {
          name: 'Full Body A',
          exercises: [
            pick(exerciseOptions.verticalPull, equipment, limitations),
            pick(exerciseOptions.squat, equipment, limitations),
            pick(exerciseOptions.row, equipment, limitations),
            pick(exerciseOptions.horizontalPush, equipment, limitations),
            pick(exerciseOptions.hinge, equipment, limitations),
            pick(exerciseOptions.core, equipment, limitations),
          ],
          estimatedMinutes: 55,
        },
        {
          name: 'Full Body B',
          exercises: [
            pick(exerciseOptions.row, equipment, limitations),
            pick(exerciseOptions.hinge, equipment, limitations),
            pick(exerciseOptions.shoulderPush, equipment, limitations),
            pick(exerciseOptions.lunges, equipment, limitations),
            pick(exerciseOptions.verticalPull, equipment, limitations),
            pick(exerciseOptions.core, equipment, limitations),
          ],
          estimatedMinutes: 55,
        },
        {
          name: 'Full Body C',
          exercises: [
            pick(exerciseOptions.verticalPull, equipment, limitations),
            pick(exerciseOptions.squat, equipment, limitations),
            pick(exerciseOptions.inclinePush, equipment, limitations),
            pick(exerciseOptions.row, equipment, limitations),
            pick(exerciseOptions.biceps, equipment, limitations),
            pick(exerciseOptions.core, equipment, limitations),
          ],
          estimatedMinutes: 55,
        },
      ]
    : [
        {
          name: 'Full Body A',
          exercises: [
            pick(exerciseOptions.squat, equipment, limitations),
            pick(exerciseOptions.horizontalPush, equipment, limitations),
            pick(exerciseOptions.verticalPull, equipment, limitations),
            pick(exerciseOptions.hinge, equipment, limitations),
            pick(exerciseOptions.shoulderPush, equipment, limitations),
            pick(exerciseOptions.core, equipment, limitations),
          ],
          estimatedMinutes: strength ? 50 : 55,
        },
        {
          name: 'Full Body B',
          exercises: [
            pick(exerciseOptions.hinge, equipment, limitations),
            pick(exerciseOptions.inclinePush, equipment, limitations),
            pick(exerciseOptions.row, equipment, limitations),
            pick(exerciseOptions.lunges, equipment, limitations),
            pick(exerciseOptions.biceps, equipment, limitations),
            pick(exerciseOptions.triceps, equipment, limitations),
          ],
          estimatedMinutes: strength ? 50 : 55,
        },
        {
          name: 'Full Body C',
          exercises: [
            pick(exerciseOptions.squat, equipment, limitations),
            pick(exerciseOptions.horizontalPush, equipment, limitations),
            pick(exerciseOptions.row, equipment, limitations),
            pick(exerciseOptions.glutes, equipment, limitations),
            pick(exerciseOptions.shoulderPush, equipment, limitations),
            pick(exerciseOptions.core, equipment, limitations),
          ],
          estimatedMinutes: 55,
        },
      ];

  return templates.map((template) => ({
    ...template,
    exercises: template.exercises.map((exercise) => ({
      ...exercise,
      targetRepRange:
        strength && !['Core'].includes(exercise.muscleGroup) ? reps : exercise.targetRepRange,
    })),
  }));
}

function upperLowerTemplates(
  equipment: EquipmentId[],
  strength = false,
  priorities: PriorityMuscleFocus[] = ['balanced'],
  limitations: TrainingLimitation[] = []
): WorkoutTemplate[] {
  const primaryReps = strength ? '3-6' : '8-12';
  const accessoryReps = strength ? '6-12' : '8-12';
  const focusLowerGlutes = hasPriority(priorities, 'lower_glutes');
  const focusBackCore = hasPriority(priorities, 'back_core');

  const upperA: WorkoutTemplate = {
    name: 'Upper A',
    exercises: focusBackCore
      ? [
          pick(exerciseOptions.verticalPull, equipment, limitations),
          pick(exerciseOptions.row, equipment, limitations),
          pick(exerciseOptions.horizontalPush, equipment, limitations),
          pick(exerciseOptions.shoulderPush, equipment, limitations),
          pick(exerciseOptions.biceps, equipment, limitations),
          pick(exerciseOptions.core, equipment, limitations),
        ]
      : [
          pick(exerciseOptions.horizontalPush, equipment, limitations),
          pick(exerciseOptions.row, equipment, limitations),
          pick(exerciseOptions.verticalPull, equipment, limitations),
          pick(exerciseOptions.shoulderPush, equipment, limitations),
          pick(exerciseOptions.biceps, equipment, limitations),
          pick(exerciseOptions.triceps, equipment, limitations),
        ],
  };

  const lowerA: WorkoutTemplate = {
    name: 'Lower A',
    exercises: focusLowerGlutes
      ? [
          pick(exerciseOptions.glutes, equipment, limitations),
          pick(exerciseOptions.squat, equipment, limitations),
          pick(exerciseOptions.hinge, equipment, limitations),
          pick(exerciseOptions.lunges, equipment, limitations),
          pick(exerciseOptions.legAccessory, equipment, limitations),
          pick(exerciseOptions.core, equipment, limitations),
        ]
      : [
          pick(exerciseOptions.squat, equipment, limitations),
          pick(exerciseOptions.hinge, equipment, limitations),
          pick(exerciseOptions.lunges, equipment, limitations),
          pick(exerciseOptions.legAccessory, equipment, limitations),
          pick(exerciseOptions.calves, equipment, limitations),
          pick(exerciseOptions.core, equipment, limitations),
        ],
  };

  const upperB: WorkoutTemplate = {
    name: 'Upper B',
    exercises: [
      pick(exerciseOptions.inclinePush, equipment, limitations),
      pick(exerciseOptions.verticalPull, equipment, limitations),
      pick(exerciseOptions.row, equipment, limitations),
      pick(exerciseOptions.shoulderPush, equipment, limitations),
      pick(exerciseOptions.biceps, equipment, limitations),
      pick(exerciseOptions.triceps, equipment, limitations),
    ],
  };

  const lowerB: WorkoutTemplate = {
    name: 'Lower B',
    exercises: [
      pick(exerciseOptions.hinge, equipment, limitations),
      pick(exerciseOptions.glutes, equipment, limitations),
      pick(exerciseOptions.squat, equipment, limitations),
      pick(exerciseOptions.lunges, equipment, limitations),
      pick(exerciseOptions.calves, equipment, limitations),
      pick(exerciseOptions.core, equipment, limitations),
    ],
  };

  const ordered = focusLowerGlutes
    ? [lowerA, upperA, lowerB, upperB]
    : [upperA, lowerA, upperB, lowerB];

  return ordered.map((template) => ({
    ...template,
    exercises: template.exercises.map((exercise) => ({
      ...exercise,
      targetRepRange: ['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes', 'Shoulders'].includes(
        exercise.muscleGroup
      )
        ? primaryReps
        : accessoryReps,
    })),
  }));
}

function femaleFullBodyTemplates(
  equipment: EquipmentId[],
  strength = false,
  limitations: TrainingLimitation[] = []
): WorkoutTemplate[] {
  const compoundReps = strength ? '6-8' : '8-12';
  const accessoryReps = '10-15';

  const templates: WorkoutTemplate[] = [
    {
      name: 'Full Body A (Glutes & Quads)',
      exercises: [
        pick(exerciseOptions.glutes, equipment, limitations),
        pick(exerciseOptions.squat, equipment, limitations),
        pick(exerciseOptions.verticalPull, equipment, limitations),
        pick(exerciseOptions.inclinePush, equipment, limitations),
        pick(exerciseOptions.core, equipment, limitations),
      ],
      estimatedMinutes: 50,
    },
    {
      name: 'Full Body B (Glutes & Hamstrings)',
      exercises: [
        pick(exerciseOptions.hinge, equipment, limitations),
        pick(exerciseOptions.lunges, equipment, limitations),
        pick(exerciseOptions.row, equipment, limitations),
        pick(exerciseOptions.lateralRaise, equipment, limitations),
        pick(exerciseOptions.core, equipment, limitations),
      ],
      estimatedMinutes: 50,
    },
    {
      name: 'Full Body C (Sculpt & Silhouette)',
      exercises: [
        pick(exerciseOptions.glutes, equipment, limitations),
        pick(exerciseOptions.squat, equipment, limitations),
        pick(exerciseOptions.lateralRaise, equipment, limitations),
        pick(exerciseOptions.verticalPull, equipment, limitations),
        pick(exerciseOptions.gluteAccessory, equipment, limitations),
      ],
      estimatedMinutes: 50,
    },
  ];

  return templates.map((template) => ({
    ...template,
    exercises: template.exercises.map((exercise) => {
      const lower = exercise.name.toLowerCase();
      const isCompound =
        lower.includes('thrust') ||
        lower.includes('deadlift') ||
        lower.includes('squat');
      return {
        ...exercise,
        targetRepRange: isCompound ? compoundReps : accessoryReps,
      };
    }),
  }));
}

function femaleUpperLowerTemplates(
  equipment: EquipmentId[],
  strength = false,
  limitations: TrainingLimitation[] = []
): WorkoutTemplate[] {
  const compoundReps = strength ? '6-8' : '8-12';
  const accessoryReps = '10-15';

  const lowerA: WorkoutTemplate = {
    name: 'Lower A (Glutes & Quads)',
    exercises: [
      pick(exerciseOptions.glutes, equipment, limitations),
      pick(exerciseOptions.squat, equipment, limitations),
      pick(exerciseOptions.lunges, equipment, limitations),
      pick(exerciseOptions.legAccessory, equipment, limitations),
      pick(exerciseOptions.core, equipment, limitations),
    ],
    estimatedMinutes: 50,
  };

  const upperA: WorkoutTemplate = {
    name: 'Upper A (Back & Posture)',
    exercises: [
      pick(exerciseOptions.verticalPull, equipment, limitations),
      pick(exerciseOptions.shoulderPush, equipment, limitations),
      pick(exerciseOptions.row, equipment, limitations),
      pick(exerciseOptions.lateralRaise, equipment, limitations),
      pick(exerciseOptions.triceps, equipment, limitations),
    ],
    estimatedMinutes: 45,
  };

  const lowerB: WorkoutTemplate = {
    name: 'Lower B (Glutes & Hamstrings)',
    exercises: [
      pick(exerciseOptions.hinge, equipment, limitations),
      pick(exerciseOptions.glutes, equipment, limitations),
      pick(exerciseOptions.lunges, equipment, limitations),
      pick(exerciseOptions.calves, equipment, limitations),
      pick(exerciseOptions.core, equipment, limitations),
    ],
    estimatedMinutes: 50,
  };

  const upperB: WorkoutTemplate = {
    name: 'Upper B (Sculpt & Core)',
    exercises: [
      pick(exerciseOptions.inclinePush, equipment, limitations),
      pick(exerciseOptions.row, equipment, limitations),
      pick(exerciseOptions.lateralRaise, equipment, limitations),
      pick(exerciseOptions.biceps, equipment, limitations),
      pick(exerciseOptions.core, equipment, limitations),
    ],
    estimatedMinutes: 45,
  };

  const templates = [lowerA, upperA, lowerB, upperB];

  return templates.map((template) => ({
    ...template,
    exercises: template.exercises.map((exercise) => {
      const lower = exercise.name.toLowerCase();
      const isCompound =
        lower.includes('thrust') ||
        lower.includes('deadlift') ||
        lower.includes('squat');
      return {
        ...exercise,
        targetRepRange: isCompound ? compoundReps : accessoryReps,
      };
    }),
  }));
}

function pushPullLegsTemplates(
  equipment: EquipmentId[],
  priorities: PriorityMuscleFocus[] = ['balanced'],
  limitations: TrainingLimitation[] = []
): WorkoutTemplate[] {
  const push1: WorkoutTemplate = {
    name: 'Push',
    exercises: [
      pick(exerciseOptions.horizontalPush, equipment, limitations),
      pick(exerciseOptions.inclinePush, equipment, limitations),
      pick(exerciseOptions.shoulderPush, equipment, limitations),
      pick(exerciseOptions.triceps, equipment, limitations),
      pick(exerciseOptions.core, equipment, limitations),
    ],
    estimatedMinutes: 50,
  };
  const pull1: WorkoutTemplate = {
    name: 'Pull',
    exercises: [
      pick(exerciseOptions.verticalPull, equipment, limitations),
      pick(exerciseOptions.row, equipment, limitations),
      pick(exerciseOptions.biceps, equipment, limitations),
      pick(exerciseOptions.shoulderPush, equipment, limitations),
      pick(exerciseOptions.core, equipment, limitations),
    ],
    estimatedMinutes: 50,
  };
  const legs1: WorkoutTemplate = {
    name: 'Legs',
    exercises: [
      pick(exerciseOptions.squat, equipment, limitations),
      pick(exerciseOptions.hinge, equipment, limitations),
      pick(exerciseOptions.glutes, equipment, limitations),
      pick(exerciseOptions.lunges, equipment, limitations),
      pick(exerciseOptions.calves, equipment, limitations),
    ],
    estimatedMinutes: 55,
  };
  const push2: WorkoutTemplate = {
    name: 'Push 2',
    exercises: [
      pick(exerciseOptions.inclinePush, equipment, limitations),
      pick(exerciseOptions.horizontalPush, equipment, limitations),
      pick(exerciseOptions.shoulderPush, equipment, limitations),
      pick(exerciseOptions.triceps, equipment, limitations),
    ],
    estimatedMinutes: 50,
  };
  const pull2: WorkoutTemplate = {
    name: 'Pull 2',
    exercises: [
      pick(exerciseOptions.row, equipment, limitations),
      pick(exerciseOptions.verticalPull, equipment, limitations),
      pick(exerciseOptions.biceps, equipment, limitations),
      pick(exerciseOptions.core, equipment, limitations),
    ],
    estimatedMinutes: 50,
  };
  const legs2: WorkoutTemplate = {
    name: 'Legs 2',
    exercises: [
      pick(exerciseOptions.glutes, equipment, limitations),
      pick(exerciseOptions.hinge, equipment, limitations),
      pick(exerciseOptions.squat, equipment, limitations),
      pick(exerciseOptions.lunges, equipment, limitations),
      pick(exerciseOptions.calves, equipment, limitations),
    ],
    estimatedMinutes: 50,
  };

  if (hasPriority(priorities, 'lower_glutes')) {
    return [legs1, push1, pull1, legs2, push2, pull2];
  }
  if (hasPriority(priorities, 'back_core')) {
    return [pull1, push1, legs1, pull2, push2, legs2];
  }
  return [push1, pull1, legs1, push2, pull2, legs2];
}

function customSplitTemplates(
  equipment: EquipmentId[],
  limitations: TrainingLimitation[] = []
): WorkoutTemplate[] {
  return [
    {
      name: 'Chest & Triceps',
      exercises: [
        pick(exerciseOptions.horizontalPush, equipment, limitations),
        pick(exerciseOptions.inclinePush, equipment, limitations),
        pick(exerciseOptions.triceps, equipment, limitations),
        pick(exerciseOptions.core, equipment, limitations),
      ],
      estimatedMinutes: 45,
    },
    {
      name: 'Back & Biceps',
      exercises: [
        pick(exerciseOptions.verticalPull, equipment, limitations),
        pick(exerciseOptions.row, equipment, limitations),
        pick(exerciseOptions.biceps, equipment, limitations),
        pick(exerciseOptions.core, equipment, limitations),
      ],
      estimatedMinutes: 45,
    },
    {
      name: 'Legs & Glutes',
      exercises: [
        pick(exerciseOptions.squat, equipment, limitations),
        pick(exerciseOptions.glutes, equipment, limitations),
        pick(exerciseOptions.hinge, equipment, limitations),
        pick(exerciseOptions.calves, equipment, limitations),
      ],
      estimatedMinutes: 50,
    },
    {
      name: 'Shoulders & Arms',
      exercises: [
        pick(exerciseOptions.shoulderPush, equipment, limitations),
        pick(exerciseOptions.biceps, equipment, limitations),
        pick(exerciseOptions.triceps, equipment, limitations),
        pick(exerciseOptions.core, equipment, limitations),
      ],
      estimatedMinutes: 40,
    },
    {
      name: 'Full Body Conditioning',
      exercises: [
        pick(exerciseOptions.squat, equipment, limitations),
        pick(exerciseOptions.horizontalPush, equipment, limitations),
        pick(exerciseOptions.verticalPull, equipment, limitations),
        pick(exerciseOptions.lunges, equipment, limitations),
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
  exercise?: { restSeconds?: number; isCustomRest?: boolean },
  workout?: { defaultRestSeconds?: number },
  program?: { defaultRestSeconds?: number }
): number {
  const profileRest = (() => {
    try {
      const rest = useUserProfileStore.getState().profile.defaultRestSeconds;
      return typeof rest === 'number' && rest > 0 ? rest : undefined;
    } catch {
      return undefined;
    }
  })();

  if (exercise?.isCustomRest && typeof exercise.restSeconds === 'number') {
    return exercise.restSeconds;
  }

  return profileRest
    ?? workout?.defaultRestSeconds
    ?? program?.defaultRestSeconds
    ?? exercise?.restSeconds
    ?? 90;
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
      exerciseName.toLowerCase().includes('hip thrust') ||
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
  bodyStats?: {
    weightKg?: number;
    heightCm?: number;
    age?: number;
    sex?: 'male' | 'female' | 'unspecified';
  },
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
  if (experience === 'beginner') expMultiplier = 0.50;
  else if (experience === 'advanced') expMultiplier = 1.30;

  // 2. Goal scaling
  let goalMultiplier = 1.0;
  if (goal === 'get_stronger') goalMultiplier = 1.10;
  else if (goal === 'lose_fat') goalMultiplier = 0.90;

  // 3. Bodyweight allometric scaling (reference lifter: 75 kg)
  let bodyMultiplier = 1.0;
  if (bodyStats?.weightKg && bodyStats.weightKg > 35) {
    bodyMultiplier = Math.pow(bodyStats.weightKg / 75, 0.67);
    bodyMultiplier = Math.max(0.65, Math.min(1.35, bodyMultiplier));
  }

  // 4. Optional Sex load calibration (ONLY used for safe starting weight estimation)
  let sexMultiplier = 1.0;
  if (bodyStats?.sex === 'female') {
    const lowerName = (exerciseName || '').toLowerCase();
    const isLowerBody =
      lowerName.includes('squat') ||
      lowerName.includes('deadlift') ||
      lowerName.includes('leg') ||
      lowerName.includes('lunge') ||
      lowerName.includes('hip thrust') ||
      lowerName.includes('glute') ||
      lowerName.includes('calf');
    sexMultiplier = isLowerBody ? 0.75 : 0.60;
  }

  // 5. Age load calibration
  let ageMultiplier = 1.0;
  if (typeof bodyStats?.age === 'number') {
    if (bodyStats.age < 18) ageMultiplier = 0.80;
    else if (bodyStats.age >= 55) ageMultiplier = 0.78;
    else if (bodyStats.age >= 45) ageMultiplier = 0.90;
  }

  const raw = baseWeight * expMultiplier * goalMultiplier * bodyMultiplier * sexMultiplier * ageMultiplier;

  // 6. Equipment-specific roundings
  if (equipment === 'barbell') {
    const rounded = Math.round(raw / 2.5) * 2.5;
    return Math.max(15, rounded);
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

function isPriorityMuscleGroup(
  muscleGroup: string,
  priorities: PriorityMuscleFocus[] = ['balanced']
): boolean {
  const m = muscleGroup.toLowerCase();
  if (priorities.includes('lower_glutes') && ['glutes', 'quads', 'hamstrings', 'legs'].includes(m)) {
    return true;
  }
  if (priorities.includes('upper_push') && ['chest', 'shoulders', 'triceps'].includes(m)) {
    return true;
  }
  if (priorities.includes('back_core') && ['back', 'core'].includes(m)) {
    return true;
  }
  return false;
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
  const profile = useUserProfileStore.getState().profile;
  const activeWeightKg = (onboarding?.weightKg && onboarding.weightKg > 0) ? onboarding.weightKg : profile.weightKg;
  const activeHeightCm = (onboarding?.heightCm && onboarding.heightCm > 0) ? onboarding.heightCm : profile.heightCm;
  const activeAge = onboarding?.age ?? profile.age;
  const activeSex = onboarding?.sex ?? profile.sex;
  const activeBaselineLifts = onboarding?.baselineLifts || profile.baselineLifts;
  const activeExperience = onboarding?.experience || (profile.experience === 'Beginner' ? 'beginner' : profile.experience === 'Advanced' ? 'advanced' : 'intermediate');
  const activeGoal = onboarding?.goal || (profile.goal === 'Lose Fat' ? 'lose_fat' : profile.goal === 'Get Stronger' ? 'get_stronger' : 'build_muscle');
  const activePriorities = onboarding?.priorityMuscles ?? ['balanced'];

  return repeatTemplates(templates, frequency).map((template, index) => {
    const candidateExercises =
      template.exercises.length > maxExercises
        ? template.exercises.slice(0, maxExercises)
        : template.exercises;

    const exercises: GeneratedExercise[] = candidateExercises.map((exercise) => {
      const calibratedWeight = calibrateInitialWeight(
        exercise.recommendedWeight,
        exercise.equipment,
        activeExperience,
        activeGoal,
        {
          weightKg: activeWeightKg,
          heightCm: activeHeightCm,
          age: activeAge,
          sex: activeSex,
        },
        exercise.name,
        activeBaselineLifts
      );

      const calibratedRest = calculateRecommendedRest(
        exercise.name,
        exercise.equipment,
        activeGoal,
        { weightKg: activeWeightKg }
      ) ?? exercise.restSeconds ?? defaultRestSeconds;

      const calibratedReps = exercise.targetRepRange ?? (
        activeGoal === 'get_stronger'
          ? '5-8'
          : activeGoal === 'lose_fat'
          ? '10-15'
          : activeExperience === 'beginner'
          ? '10-12'
          : activeExperience === 'advanced'
          ? '6-10'
          : '8-12'
      );

      const baseSets = exercise.muscleGroup === 'Core' ? 2 : 3;
      const priorityBonus = isPriorityMuscleGroup(exercise.muscleGroup, activePriorities) ? 1 : 0;
      const calibratedSets = Math.min(4, baseSets + priorityBonus);

      return {
        ...exercise,
        recommendedWeight: calibratedWeight,
        restSeconds: calibratedRest,
        sets: calibratedSets,
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
  const selectedEquipment = (onboarding.equipment || [])
    .map(normalizeEquipmentToken)
    .filter((item): item is EquipmentId => Boolean(item));
  const equipment = selectedEquipment.length > 0 ? selectedEquipment : defaultEquipment;
  const priorities = onboarding.priorityMuscles ?? ['balanced'];
  const limitations = onboarding.limitations ?? [];

  let templates: WorkoutTemplate[];
  let name: string;
  let description: string;
  let splitType: WorkoutSplitType;

  const isFemale =
    onboarding.sex === 'female' ||
    useUserProfileStore.getState().profile.sex === 'female';
  const isUk = useUserProfileStore.getState().profile.language === 'uk';

  if (onboarding.splitPreference === 'custom') {
    splitType = 'custom';
    templates = customSplitTemplates(equipment, limitations);
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
  } else if (onboarding.splitPreference === 'full_body') {
    splitType = 'full_body';
    if (isFemale) {
      templates = femaleFullBodyTemplates(equipment, onboarding.goal === 'get_stronger', limitations);
      name = isUk ? 'Скульпт & Тонус (Сідниці та Кор)' : 'Sculpt & Tone (Glute Focus)';
      description = isUk
        ? 'Програма на все тіло з високою частотою на сідничні м’язи, поставу та кор, оптимізована для жіночої фізіології.'
        : 'High-frequency glute hypertrophy and aesthetic posture conditioning tailored for female athletes.';
    } else {
      templates = fullBodyTemplates(equipment, onboarding.goal === 'get_stronger', priorities, limitations);
      name = onboarding.goal === 'get_stronger' ? 'Full Body Strength' : 'Full Body Hypertrophy';
      description = 'High-frequency full-body sessions hitting every muscle group with maximum recovery.';
    }
  } else if (onboarding.splitPreference === 'upper_lower') {
    splitType = 'upper_lower';
    if (isFemale) {
      templates = femaleUpperLowerTemplates(equipment, onboarding.goal === 'get_stronger', limitations);
      name = isUk ? 'Жіночий спліт: Сідниці та Верх' : 'Glute & Silhouette Split';
      description = isUk
        ? 'Спліт Верх/Низ з акцентом на розвиток сідниць, талію та підтягнуті дельти.'
        : 'Targeted split prioritizing glute development, waist taper, and toned shoulders.';
    } else {
      templates = upperLowerTemplates(equipment, onboarding.goal === 'get_stronger', priorities, limitations);
      name = 'Upper / Lower Split';
      description = 'Classic balanced structure separating upper body pushing/pulling and lower body power.';
    }
  } else if (onboarding.splitPreference === 'push_pull_legs') {
    splitType = 'push_pull_legs';
    templates = pushPullLegsTemplates(equipment, isFemale ? ['lower_glutes'] : priorities, limitations);
    name = isFemale
      ? (isUk ? 'PPL (Сідниці & Силует)' : 'Push / Pull / Legs (Glute Focus)')
      : 'Push / Pull / Legs (PPL)';
    description = 'Specialized split targeting synergistic muscle groups with high focus and pump.';
  } else if (isFemale) {
    if (frequency <= 3) {
      splitType = 'full_body';
      templates = femaleFullBodyTemplates(equipment, onboarding.goal === 'get_stronger', limitations);
      name = isUk ? 'Скульпт & Тонус (Сідниці та Кор)' : 'Sculpt & Tone (Glute Focus)';
      description = isUk
        ? 'Програма з високою частотою на сідничні м’язи, поставу та кор, оптимізована для жіночої фізіології.'
        : 'High-frequency glute hypertrophy and aesthetic posture conditioning tailored for female athletes.';
    } else {
      splitType = 'upper_lower';
      templates = femaleUpperLowerTemplates(equipment, onboarding.goal === 'get_stronger', limitations);
      name = isUk ? 'Жіночий спліт: Сідниці та Верх' : 'Glute & Silhouette Split';
      description = isUk
        ? '4-денний спліт з акцентом на розвиток сідниць, талію та підтягнуті дельти.'
        : 'Targeted split prioritizing glute development, waist taper, and toned shoulders.';
    }
  } else if (onboarding.splitPreference === 'custom') {
    splitType = 'custom';
    templates = customSplitTemplates(equipment, limitations);
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
    splitType = isPpl ? 'push_pull_legs' : frequency <= 2 ? 'full_body' : 'upper_lower';
    const strengthBase =
      splitType === 'push_pull_legs'
        ? pushPullLegsTemplates(equipment, priorities, limitations)
        : splitType === 'full_body'
        ? fullBodyTemplates(equipment, true, priorities, limitations)
        : upperLowerTemplates(equipment, true, priorities, limitations);
    templates = strengthBase.map((template) => ({ ...template, exercises: template.exercises.slice(0, 5) }));
    name = 'Strength Foundation';
    description = 'Compound-focused training with steady, measurable progress.';
  } else if (onboarding.goal === 'lose_fat') {
    splitType = frequency <= 3 ? 'full_body' : 'upper_lower';
    templates =
      frequency <= 3
        ? fullBodyTemplates(equipment, false, priorities, limitations)
        : upperLowerTemplates(equipment, false, priorities, limitations);
    name = 'Lean Strength';
    description = 'Efficient training built for fat loss and muscle retention.';
  } else if (onboarding.goal === 'recomposition') {
    splitType = onboarding.experience === 'beginner' || frequency <= 3 ? 'full_body' : 'upper_lower';
    templates =
      splitType === 'full_body'
        ? fullBodyTemplates(equipment, false, priorities, limitations)
        : upperLowerTemplates(equipment, false, priorities, limitations);
    name = 'Build & Refine';
    description = 'Moderate-volume hypertrophy training for strength and shape.';
  } else if (onboarding.experience === 'beginner' || frequency <= 2) {
    splitType = 'full_body';
    templates = fullBodyTemplates(equipment, false, priorities, limitations);
    name = 'Foundation Builder';
    description = 'Balanced full-body sessions to build consistency and technique.';
  } else if (frequency >= 5) {
    splitType = 'push_pull_legs';
    templates = pushPullLegsTemplates(equipment, priorities, limitations);
    name = 'Performance Split';
    description = 'Focused multi-day structure for higher training volume.';
  } else {
    splitType = 'upper_lower';
    templates = upperLowerTemplates(equipment, false, priorities, limitations);
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
  const selectedEquipment = (onboarding?.equipment ?? defaultEquipment)
    .map(normalizeEquipmentToken)
    .filter((item): item is EquipmentId => Boolean(item));
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
            exerciseOptions.glutes,
            exerciseOptions.hinge,
            exerciseOptions.lunges,
            exerciseOptions.legAccessory,
            exerciseOptions.core,
          ],
        },
        {
          name: 'Низ тіла · Варіант B',
          pools: [
            exerciseOptions.hinge,
            exerciseOptions.glutes,
            exerciseOptions.squat,
            exerciseOptions.lunges,
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
            exerciseOptions.glutes,
            exerciseOptions.shoulderPush,
            exerciseOptions.core,
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
  const targetExerciseCount = duration <= 30 ? 4 : duration <= 45 ? 5 : 6;
  const poolsToUse = selectedVariant.pools.slice(0, targetExerciseCount);

  const selectedOptions = poolsToUse.map((pool, poolIdx) => {
    const valid = pool.filter((item) => isAvailable(item.equipment, equipment));
    if (valid.length === 0) return pool[pool.length - 1];
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
          {
            weightKg: onboarding.weightKg,
            heightCm: onboarding.heightCm,
            age: onboarding.age,
            sex: onboarding.sex,
          },
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
        ? '10-12'
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

  return [
    ...exerciseOptions.horizontalPush,
    ...exerciseOptions.verticalPull,
    ...exerciseOptions.squat,
    ...exerciseOptions.glutes,
    ...exerciseOptions.shoulderPush,
  ].filter(
    (e) =>
      e.name.toLowerCase() !== currentExerciseName.toLowerCase() &&
      isAvailable(e.equipment, equipment)
  );
}

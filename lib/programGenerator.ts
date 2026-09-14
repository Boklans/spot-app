import type { OnboardingData } from '@/store/workoutStore';

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
};

export type GeneratedWorkout = {
  id: string;
  name: string;
  dayLabel: string;
  muscleGroups: string[];
  estimatedMinutes: number;
  exercises: GeneratedExercise[];
};

export type GeneratedProgram = {
  id: string;
  name: string;
  description: string;
  daysPerWeek: number;
  estimatedWorkoutMinutes: number;
  workouts: GeneratedWorkout[];
};

type ExerciseOption = Omit<GeneratedExercise, 'sets' | 'targetRepRange'> & { targetRepRange?: string };
type WorkoutTemplate = { name: string; exercises: ExerciseOption[]; estimatedMinutes?: number };

const dayLabels = ['MON', 'WED', 'FRI', 'SAT', 'TUE', 'THU'];
const defaultEquipment: EquipmentId[] = ['full_gym'];
const supportedEquipment: EquipmentId[] = ['full_gym', 'dumbbells', 'barbell', 'machines', 'bodyweight'];

function exerciseId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const option = (name: string, muscleGroup: string, recommendedWeight: number, equipment: EquipmentId, targetRepRange = '8-12'): ExerciseOption => ({ id: exerciseId(name), name, muscleGroup, recommendedWeight, equipment, targetRepRange });

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
    { name: 'Upper', exercises: [pick(exerciseOptions.horizontalPush, equipment), pick(exerciseOptions.row, equipment), pick(exerciseOptions.verticalPull, equipment), pick(exerciseOptions.shoulderPush, equipment), pick(exerciseOptions.biceps, equipment)] },
    { name: 'Lower', exercises: [pick(exerciseOptions.squat, equipment), pick(exerciseOptions.hinge, equipment), pick(exerciseOptions.lunges, equipment), pick(exerciseOptions.legAccessory, equipment), pick(exerciseOptions.calves, equipment), pick(exerciseOptions.core, equipment)] },
    { name: 'Push', exercises: [pick(exerciseOptions.horizontalPush, equipment), pick(exerciseOptions.inclinePush, equipment), pick(exerciseOptions.shoulderPush, equipment), pick(exerciseOptions.triceps, equipment)] },
    { name: 'Pull', exercises: [pick(exerciseOptions.verticalPull, equipment), pick(exerciseOptions.row, equipment), pick(exerciseOptions.biceps, equipment), pick(exerciseOptions.core, equipment)] },
    { name: 'Legs', exercises: [pick(exerciseOptions.squat, equipment), pick(exerciseOptions.hinge, equipment), pick(exerciseOptions.lunges, equipment), pick(exerciseOptions.legAccessory, equipment), pick(exerciseOptions.calves, equipment), pick(exerciseOptions.core, equipment)] },
  ];
}

function repeatTemplates(templates: WorkoutTemplate[], frequency: number) {
  return Array.from({ length: frequency }, (_, index) => {
    const template = templates[index % templates.length];
    const cycle = Math.floor(index / templates.length);
    return cycle === 0 ? template : { ...template, name: `${template.name} ${cycle + 1}` };
  });
}

function buildWorkouts(templates: WorkoutTemplate[], frequency: number): GeneratedWorkout[] {
  return repeatTemplates(templates, frequency).map((template, index) => {
    const exercises = template.exercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      sets: exercise.muscleGroup === 'Core' ? 2 : 3,
      targetRepRange: exercise.targetRepRange ?? '8-12',
      name: exercise.name,
    }));
    return {
      id: `workout-${index + 1}`,
      name: template.name,
      dayLabel: dayLabels[index] ?? `DAY ${index + 1}`,
      muscleGroups: [...new Set(exercises.map((exercise) => exercise.muscleGroup))],
      estimatedMinutes: template.estimatedMinutes ?? (exercises.length >= 6 ? 55 : 50),
      exercises,
    };
  });
}

export function generateProgram(onboarding: OnboardingData): GeneratedProgram {
  const frequency = Math.min(6, Math.max(2, onboarding.trainingFrequency));
  const selectedEquipment = onboarding.equipment.filter(isEquipmentId);
  const equipment = selectedEquipment.length > 0 ? selectedEquipment : defaultEquipment;
  let templates: WorkoutTemplate[];
  let name: string;
  let description: string;

  if (onboarding.goal === 'get_stronger') {
    const strengthBase = frequency >= 5 ? pushPullLegsTemplates(equipment) : upperLowerTemplates(equipment, true);
    templates = strengthBase.map((template) => ({ ...template, exercises: template.exercises.slice(0, 5) }));
    name = 'Strength Foundation';
    description = 'Compound-focused training with steady, measurable progress.';
  } else if (onboarding.goal === 'lose_fat') {
    templates = frequency <= 3 ? fullBodyTemplates(equipment) : upperLowerTemplates(equipment);
    name = 'Lean Strength';
    description = 'Efficient full-body training built for consistent progress.';
  } else if (onboarding.goal === 'recomposition') {
    templates = onboarding.experience === 'beginner' ? fullBodyTemplates(equipment) : upperLowerTemplates(equipment);
    name = 'Build & Refine';
    description = 'Moderate-volume hypertrophy training for strength and shape.';
  } else if (onboarding.experience === 'beginner') {
    templates = fullBodyTemplates(equipment);
    name = 'Foundation Builder';
    description = 'Simple full-body sessions to build consistency and confidence.';
  } else if (onboarding.experience === 'advanced' && frequency >= 5) {
    templates = pushPullLegsTemplates(equipment);
    name = 'Performance Split';
    description = 'A focused five-day structure for experienced training.';
  } else {
    templates = upperLowerTemplates(equipment);
    name = 'Upper Lower';
    description = 'A balanced split that makes every training day count.';
  }

  return {
    id: `program-${onboarding.goal}-${onboarding.experience}-${frequency}`,
    name,
    description,
    daysPerWeek: frequency,
    estimatedWorkoutMinutes: 55,
    workouts: buildWorkouts(templates, frequency),
  };
}

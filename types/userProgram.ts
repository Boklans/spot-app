import type { EquipmentId, WorkoutSplitType } from '@/lib/programGenerator';

export type UserExercise = {
  id: string; // Stable UUID
  name: string;
  muscleGroup: string;
  sets: number;
  recommendedWeight: number;
  targetRepRange: string;
  equipment: EquipmentId;
  weightIncrement: number;
  restSeconds?: number;
};

export type UserWorkout = {
  id: string; // Stable UUID
  name: string;
  dayLabel: string;
  muscleGroups: string[];
  estimatedMinutes: number;
  defaultRestSeconds?: number;
  exercises: UserExercise[];
};

export type UserProgram = {
  id: string; // Stable UUID
  name: string;
  description: string;
  daysPerWeek: number;
  estimatedWorkoutMinutes: number;
  splitType: WorkoutSplitType;
  defaultRestSeconds?: number;
  workouts: UserWorkout[];
  sourceGeneratedProgramId?: string;
  createdAt?: string;
  updatedAt?: string;
};


export type PersonalRecordType = 'weight' | 'estimated_1rm';

export type PersonalRecord = {
  id: string;
  type: PersonalRecordType;
  exerciseId: string;
  exerciseName: string;
  value: number;
  label: string;
};

export type CompletedSet = {
  weight: number;
  reps: number;
  volume: number;
  completedAt: string;
};

export type CompletedExercise = {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sets: CompletedSet[];
};

export type CompletedWorkout = {
  id: string;
  programWorkoutId: string;
  workoutName: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  totalSets: number;
  totalVolume: number;
  exercises: CompletedExercise[];
  personalRecords: PersonalRecord[];
};

import type { GeneratedProgram } from '@/lib/programGenerator';
import type { UserExercise, UserProgram, UserWorkout } from '@/types/userProgram';

export function generateUUID(): string {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isUserProgram(value: unknown): value is UserProgram {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.daysPerWeek === 'number' &&
    typeof p.splitType === 'string' &&
    Array.isArray(p.workouts) &&
    (typeof p.sourceGeneratedProgramId === 'string' || typeof p.createdAt === 'string')
  );
}

export function migrateGeneratedToUserProgram(
  program: GeneratedProgram | UserProgram
): UserProgram {
  if (isUserProgram(program)) {
    return program;
  }

  const now = new Date().toISOString();

  const workouts: UserWorkout[] = (program.workouts || []).map((workout) => {
    const exercises: UserExercise[] = (workout.exercises || []).map((exercise) => ({
      id: generateUUID(),
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      sets: exercise.sets,
      recommendedWeight: exercise.recommendedWeight,
      targetRepRange: exercise.targetRepRange,
      equipment: exercise.equipment,
      weightIncrement: exercise.weightIncrement,
      ...(exercise.restSeconds !== undefined ? { restSeconds: exercise.restSeconds } : {}),
    }));

    return {
      id: generateUUID(),
      name: workout.name,
      dayLabel: workout.dayLabel,
      muscleGroups: [...workout.muscleGroups],
      estimatedMinutes: workout.estimatedMinutes,
      ...(workout.defaultRestSeconds !== undefined ? { defaultRestSeconds: workout.defaultRestSeconds } : {}),
      exercises,
    };
  });

  return {
    id: generateUUID(),
    name: program.name,
    description: program.description,
    daysPerWeek: program.daysPerWeek,
    estimatedWorkoutMinutes: program.estimatedWorkoutMinutes,
    splitType: program.splitType,
    ...(program.defaultRestSeconds !== undefined ? { defaultRestSeconds: program.defaultRestSeconds } : {}),
    workouts,
    sourceGeneratedProgramId: program.id,
    createdAt: now,
    updatedAt: now,
  };
}


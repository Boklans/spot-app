import { createCompletedWorkoutSnapshot } from '@/lib/completedWorkout';
import { hapticSuccess } from '@/lib/haptics';
import { detectPersonalRecords } from '@/lib/personalRecords';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { clearPersistedActiveWorkout } from '@/store/workoutSessionStore';
import { useWorkoutSessionStore, type WorkoutSession } from '@/store/workoutSessionStore';
import type { CompletedWorkout } from '@/types/workout';

export async function finalizeWorkoutSession(session: WorkoutSession): Promise<CompletedWorkout> {
  const historyStore = useWorkoutHistoryStore.getState();
  const history = await historyStore.loadHistory();
  const existing = history.find((workout) => workout.id === session.id);
  if (existing) {
    useWorkoutSessionStore.getState().setPersonalRecords(existing.personalRecords);
    await clearPersistedActiveWorkout();
    return existing;
  }

  const baseline = createCompletedWorkoutSnapshot(session);
  const personalRecords = detectPersonalRecords(baseline, history);
  const snapshot = createCompletedWorkoutSnapshot(session, personalRecords);
  const saved = await useWorkoutHistoryStore.getState().addCompletedWorkout(snapshot);
  if (!saved) throw new Error('Workout history save failed');
  useWorkoutSessionStore.getState().setPersonalRecords(personalRecords);
  await clearPersistedActiveWorkout();

  const program = await useProgramStore.getState().getOrLoadProgram();
  await useProgramProgressStore.getState().advanceProgress(program, session.programWorkoutId, session.id);

  await hapticSuccess();
  return snapshot;
}

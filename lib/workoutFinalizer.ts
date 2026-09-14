import { createCompletedWorkoutSnapshot } from '@/lib/completedWorkout';
import { detectPersonalRecords } from '@/lib/personalRecords';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { useWorkoutSessionStore, type WorkoutSession } from '@/store/workoutSessionStore';
import type { CompletedWorkout } from '@/types/workout';

export async function finalizeWorkoutSession(session: WorkoutSession): Promise<CompletedWorkout> {
  const historyStore = useWorkoutHistoryStore.getState();
  const history = await historyStore.loadHistory();
  const existing = history.find((workout) => workout.id === session.id);
  if (existing) {
    useWorkoutSessionStore.getState().setPersonalRecords(existing.personalRecords);
    return existing;
  }

  const baseline = createCompletedWorkoutSnapshot(session);
  const personalRecords = detectPersonalRecords(baseline, history);
  const snapshot = createCompletedWorkoutSnapshot(session, personalRecords);
  await useWorkoutHistoryStore.getState().addCompletedWorkout(snapshot);
  useWorkoutSessionStore.getState().setPersonalRecords(personalRecords);
  return snapshot;
}

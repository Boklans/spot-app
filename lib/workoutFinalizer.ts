import { syncCompletedWorkout } from '@/lib/cloudSync';
import { createCompletedWorkoutSnapshot } from '@/lib/completedWorkout';
import { hapticSuccess } from '@/lib/haptics';
import { detectPersonalRecords } from '@/lib/personalRecords';
import { useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import { useUserProfileStore } from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';
import { clearPersistedActiveWorkout } from '@/store/workoutSessionStore';
import { useWorkoutSessionStore, type WorkoutSession } from '@/store/workoutSessionStore';
import { scheduleWorkoutDayReminders } from '@/lib/notificationService';
import type { CompletedWorkout } from '@/types/workout';

let activeFinalizePromise: Promise<CompletedWorkout> | null = null;
let activeFinalizeSessionId: string | null = null;

export async function finalizeWorkoutSession(session: WorkoutSession): Promise<CompletedWorkout> {
  if (activeFinalizePromise && activeFinalizeSessionId === session.id) {
    return activeFinalizePromise;
  }

  activeFinalizeSessionId = session.id;
  activeFinalizePromise = (async () => {
    try {
      const historyStore = useWorkoutHistoryStore.getState();
      const history = await historyStore.loadHistory();
      const existing = history.find((workout) => workout.id === session.id);
      if (existing) {
        useWorkoutSessionStore.getState().setPersonalRecords(existing.personalRecords);
        await clearPersistedActiveWorkout();
        return existing;
      }

      const baseline = createCompletedWorkoutSnapshot(session);
      if (baseline.totalSets === 0) {
        await clearPersistedActiveWorkout();
        return baseline;
      }

      const baselineLifts = useUserProfileStore.getState().profile?.baselineLifts;
      const personalRecords = detectPersonalRecords(baseline, history, baselineLifts);
      const snapshot = createCompletedWorkoutSnapshot(session, personalRecords);
      const saved = await useWorkoutHistoryStore.getState().addCompletedWorkout(snapshot);
      if (!saved) throw new Error('Workout history save failed');

      useWorkoutSessionStore.setState((state) =>
        state.session && state.session.id === session.id
          ? {
              ...state,
              session: {
                ...state.session,
                completed: true,
                completedAt: snapshot.completedAt,
                personalRecords,
              },
              restEndsAt: null,
              restNextType: null,
            }
          : state
      );
      await clearPersistedActiveWorkout();

      // Advance program rotation ONLY when the workout was fully completed (not an interrupted partial session)
      if (!snapshot.isPartial) {
        const program = await useProgramStore.getState().getOrLoadProgram();
        await useProgramProgressStore.getState().advanceProgress(
          program,
          session.programWorkoutId,
          session.id,
          snapshot.completedAt || session.startedAt
        );
      }

      await hapticSuccess();
      syncCompletedWorkout(snapshot).catch(() => undefined);

      try {
        scheduleWorkoutDayReminders().catch(() => undefined);
      } catch {}

      return snapshot;
    } finally {
      activeFinalizePromise = null;
      activeFinalizeSessionId = null;
    }
  })();

  return activeFinalizePromise;
}

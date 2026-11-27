import React, { useEffect, useRef, useState } from 'react';
import { AppState, Text, type StyleProp, type TextStyle } from 'react-native';
import { fonts } from '@/constants/typography';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { cancelRestTimerNotification } from '@/lib/notificationService';
import { playRestCompleteSound } from '@/lib/soundEffects';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

export function formatDurationClock(totalSec: number, capHours = false): string {
  const safe = Math.max(0, Math.floor(totalSec));
  if (capHours && safe >= 6 * 3600) {
    return '6h+';
  }
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Isolated 1Hz stopwatch leaf component so parent screens (`Active`, `FloatingWorkoutBar`)
 * suffer ZERO 1-second re-renders while idle.
 */
export function WorkoutElapsedClock({
  startedAt,
  capHours = false,
  style,
}: {
  startedAt?: string | null;
  capHours?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => {
      setTick((t) => (t + 1) % 36000);
    }, 1000);
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setTick((t) => (t + 1) % 36000);
      }
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [startedAt]);

  const startedMs = startedAt ? new Date(startedAt).getTime() : NaN;
  const elapsedSeconds = Number.isFinite(startedMs)
    ? Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
    : 0;

  return (
    <Text
      style={[
        {
          fontFamily: fonts.monoBold,
          fontVariant: ['tabular-nums'],
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {formatDurationClock(elapsedSeconds, capHours)}
    </Text>
  );
}

/**
 * Isolated 1Hz rest countdown leaf component.
 */
export function RestTimerCountdown({
  restEndsAt,
  style,
}: {
  restEndsAt: number | null;
  style?: StyleProp<TextStyle>;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!restEndsAt) return;
    const id = setInterval(() => {
      setTick((t) => (t + 1) % 36000);
    }, 250);
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setTick((t) => (t + 1) % 36000);
      }
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [restEndsAt]);

  const remaining = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000)) : 0;

  return (
    <Text
      style={[
        {
          fontFamily: fonts.monoBold,
          fontVariant: ['tabular-nums'],
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {formatDurationClock(remaining)}
    </Text>
  );
}

/**
 * Single centralized rest-timer expiration watcher (mounted once in `app/_layout.tsx`).
 * Eliminates duplicate chimes/haptics between `Active` and `FloatingWorkoutBar` and
 * silently clears expired timers (>5s in the past) when waking from background lock.
 */
export function GlobalRestCompletionWatcher() {
  const restEndsAt = useWorkoutSessionStore((s) => s.restEndsAt);
  const lastCountedSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (!restEndsAt) {
      lastCountedSecondRef.current = null;
      return;
    }

    const checkRest = () => {
      const currentEnds = useWorkoutSessionStore.getState().restEndsAt;
      if (!currentEnds) return;
      const diffMs = currentEnds - Date.now();
      const remainingSec = Math.ceil(diffMs / 1000);

      if (remainingSec <= 3 && remainingSec > 0 && lastCountedSecondRef.current !== remainingSec) {
        lastCountedSecondRef.current = remainingSec;
        hapticLight();
      } else if (diffMs <= 0 && lastCountedSecondRef.current !== 0) {
        lastCountedSecondRef.current = 0;
        // Only play chime/haptic if timer expired within the last 5 seconds (not stale background wake)
        if (diffMs > -5000) {
          hapticSuccess();
          playRestCompleteSound();
        }
        useWorkoutSessionStore.getState().skipRest();
        void cancelRestTimerNotification();
      }
    };

    checkRest();
    const interval = setInterval(checkRest, 250);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkRest();
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [restEndsAt]);

  return null;
}

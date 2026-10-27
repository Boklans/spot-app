import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { cancelRestTimerNotification, dismissActiveWorkoutNotification } from '@/lib/notificationService';
import { playRestCompleteSound } from '@/lib/soundEffects';
import { useWeightUnit } from '@/lib/weightUtils';
import { finalizeWorkoutSession } from '@/lib/workoutFinalizer';
import { getSessionProgress, useWorkoutSessionStore } from '@/store/workoutSessionStore';

function formatClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function FloatingWorkoutBar() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { te, tw, language } = useI18n();
  const { format, unitLabel } = useWeightUnit();

  const session = useWorkoutSessionStore((s) => s.session);
  const restEndsAt = useWorkoutSessionStore((s) => s.restEndsAt);
  const addRestTime = useWorkoutSessionStore((s) => s.addRestTime);
  const skipRest = useWorkoutSessionStore((s) => s.skipRest);
  const completeCurrentSet = useWorkoutSessionStore((s) => s.completeCurrentSet);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!session || session.completed) return;
    const interval = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);
      const currentRestEnds = useWorkoutSessionStore.getState().restEndsAt;
      if (currentRestEnds && currentRestEnds <= currentNow) {
        hapticSuccess();
        playRestCompleteSound();
        useWorkoutSessionStore.getState().skipRest();
        void cancelRestTimerNotification();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.id, session?.completed]);

  if (!session || session.completed) {
    return null;
  }

  const currentEx = session.exercises[session.currentExerciseIndex] ?? session.exercises[0];
  if (!currentEx) return null;

  const setIdx = Math.min(
    Math.max(0, session.currentSetIndex),
    Math.max(0, currentEx.sets.length - 1)
  );
  const currentSet = currentEx.sets[setIdx] ?? currentEx.sets[0];
  const setNumber = setIdx + 1;
  const totalSets = currentEx.sets.length;

  const progress = getSessionProgress(session);
  const percent = Math.round(progress.percentage);

  const startedMs = new Date(session.startedAt).getTime();
  const elapsedSeconds = Number.isFinite(startedMs)
    ? Math.max(0, Math.floor((now - startedMs) / 1000))
    : 0;

  const restRemainingSeconds =
    restEndsAt && restEndsAt > now ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  const isResting = restRemainingSeconds > 0;

  const weightDisplay =
    currentSet && currentSet.weight > 0
      ? `${format(currentSet.weight)} ${unitLabel}`
      : language === 'uk'
      ? 'ВТ'
      : 'BW';
  const repsDisplay = currentSet?.reps ?? 10;

  const handleOpenWorkout = () => {
    hapticLight();
    router.push('/workout/active');
  };

  const handleQuickCompleteSet = async () => {
    hapticMedium();
    completeCurrentSet();
    const updated = useWorkoutSessionStore.getState().session;
    if (updated && updated.completed) {
      await dismissActiveWorkoutNotification();
      await finalizeWorkoutSession(updated);
      router.replace('/workout/complete');
    }
  };

  return (
    <View style={styles.outerWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={language === 'uk' ? 'Повернутися до активного тренування' : 'Return to active workout'}
        onPress={handleOpenWorkout}
        style={({ pressed }) => [
          styles.container,
          isResting && styles.containerResting,
          pressed && { opacity: 0.94 },
        ]}
      >
        {/* Top Progress Line */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>

        <View style={styles.contentRow}>
          {/* Left Status Pill: Rest Countdown OR Live Elapsed Timer */}
          {isResting ? (
            <View style={styles.restBadge}>
              <Ionicons name="timer-outline" size={14} color="#0B0D0F" />
              <Text style={styles.restBadgeText}>{formatClock(restRemainingSeconds)}</Text>
            </View>
          ) : (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveClockText}>{formatClock(elapsedSeconds)}</Text>
            </View>
          )}

          {/* Center Exercise & Current Set Info */}
          <View style={styles.infoCol}>
            <Text numberOfLines={1} style={styles.titleText}>
              {isResting
                ? language === 'uk'
                  ? `Відпочинок • Далі сет ${setNumber}/${totalSets}`
                  : `Resting • Next set ${setNumber}/${totalSets}`
                : te(currentEx.name)}
            </Text>
            <Text numberOfLines={1} style={styles.subtitleText}>
              {isResting
                ? `${te(currentEx.name)} • ${weightDisplay} × ${repsDisplay}`
                : `${tw(session.workoutName)} • ${language === 'uk' ? 'Сет' : 'Set'} ${setNumber}/${totalSets} (${weightDisplay} × ${repsDisplay})`}
            </Text>
          </View>

          {/* Right Quick Actions */}
          {isResting ? (
            <View style={styles.actionsRow}>
              <Pressable
                hitSlop={6}
                onPress={(e) => {
                  e.stopPropagation?.();
                  hapticLight();
                  addRestTime(-15);
                }}
                style={styles.miniActionBtn}
              >
                <Text style={styles.miniActionText}>-15с</Text>
              </Pressable>

              <Pressable
                hitSlop={6}
                onPress={(e) => {
                  e.stopPropagation?.();
                  hapticLight();
                  addRestTime(30);
                }}
                style={styles.miniActionBtn}
              >
                <Text style={styles.miniActionText}>+30с</Text>
              </Pressable>

              <Pressable
                hitSlop={6}
                onPress={(e) => {
                  e.stopPropagation?.();
                  hapticMedium();
                  skipRest();
                  void cancelRestTimerNotification();
                }}
                style={styles.skipMiniBtn}
              >
                <Ionicons name="play-skip-forward" size={13} color={colors.text} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.actionsRow}>
              <Pressable
                hitSlop={6}
                onPress={(e) => {
                  e.stopPropagation?.();
                  void handleQuickCompleteSet();
                }}
                style={styles.completeSetMiniBtn}
              >
                <Ionicons name="checkmark" size={14} color="#0B0D0F" />
                <Text style={styles.completeSetMiniText}>
                  {language === 'uk' ? 'Сет' : 'Set'}
                </Text>
              </Pressable>

              <View style={styles.chevronWrap}>
                <Ionicons name="chevron-up" size={16} color={colors.secondary} />
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    outerWrap: {
      paddingHorizontal: 10,
      paddingBottom: 6,
      paddingTop: 2,
      backgroundColor: 'transparent',
    },
    container: {
      backgroundColor: colors.isDark ? '#181C22' : '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.accentLine,
      overflow: 'hidden',
    },
    containerResting: {
      borderColor: colors.primary,
      backgroundColor: colors.isDark ? '#151B14' : '#F0FDF4',
    },
    progressTrack: {
      height: 3,
      width: '100%',
      backgroundColor: colors.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
    },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 10,
    },
    restBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 9,
    },
    restBadgeText: {
      color: '#0B0D0F',
      fontSize: 12.5,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.accentLine,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 9,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: colors.primaryText,
    },
    liveClockText: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    infoCol: {
      flex: 1,
      minWidth: 0,
    },
    titleText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    subtitleText: {
      color: colors.secondary,
      fontSize: 11.5,
      fontWeight: '600',
      marginTop: 1,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    miniActionBtn: {
      backgroundColor: colors.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.07)',
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
    },
    miniActionText: {
      color: colors.text,
      fontSize: 11.5,
      fontWeight: '800',
    },
    skipMiniBtn: {
      backgroundColor: colors.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    completeSetMiniBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 9,
    },
    completeSetMiniText: {
      color: '#0B0D0F',
      fontSize: 12,
      fontWeight: '900',
    },
    chevronWrap: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

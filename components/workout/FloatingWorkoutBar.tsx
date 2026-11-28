import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { cancelRestTimerNotification, dismissActiveWorkoutNotification } from '@/lib/notificationService';
import { useWeightUnit } from '@/lib/weightUtils';
import { finalizeWorkoutSession } from '@/lib/workoutFinalizer';
import { getSessionProgress, useWorkoutSessionStore } from '@/store/workoutSessionStore';
import { RestTimerCountdown, WorkoutElapsedClock } from './WorkoutTimers';

export function FloatingWorkoutBar() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const pathname = usePathname();
  const { te, tw, language } = useI18n();
  const isUk = language === 'uk';
  const { format, unitLabel } = useWeightUnit();

  const session = useWorkoutSessionStore((s) => s.session);
  const restEndsAt = useWorkoutSessionStore((s) => s.restEndsAt);
  const addRestTime = useWorkoutSessionStore((s) => s.addRestTime);
  const skipRest = useWorkoutSessionStore((s) => s.skipRest);
  const completeCurrentSet = useWorkoutSessionStore((s) => s.completeCurrentSet);

  const slideAnim = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const modeScaleAnim = useRef(new Animated.Value(1)).current;
  const dotPulseAnim = useRef(new Animated.Value(1)).current;

  // Hide inside `/workout/*` routes and on Home (`/(tabs)` / `/`) where the Hero IN_PROGRESS card is shown
  const isHiddenRoute =
    Boolean(pathname?.startsWith('/workout')) ||
    pathname === '/' ||
    pathname === '/index' ||
    pathname === '/(tabs)';

  const isSessionActive = Boolean(session && !session.completed && !isHiddenRoute);
  const isResting = Boolean(restEndsAt && restEndsAt > Date.now());

  useEffect(() => {
    if (!isSessionActive) {
      slideAnim.setValue(40);
      opacityAnim.setValue(0);
      return;
    }

    if (reducedMotion) {
      slideAnim.setValue(0);
      opacityAnim.setValue(1);
      dotPulseAnim.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulseAnim, {
          toValue: 1.35,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotPulseAnim, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, [isSessionActive, reducedMotion, dotPulseAnim, opacityAnim, slideAnim]);

  useEffect(() => {
    if (!isSessionActive || reducedMotion) {
      modeScaleAnim.setValue(1);
      return;
    }
    modeScaleAnim.setValue(0.97);
    Animated.spring(modeScaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 110,
      useNativeDriver: true,
    }).start();
  }, [isResting, isSessionActive, reducedMotion, modeScaleAnim]);

  if (!session || session.completed || isHiddenRoute) {
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

  const weightDisplay =
    currentSet && currentSet.weight > 0
      ? `${format(currentSet.weight)} ${unitLabel}`
      : isUk
        ? 'Власна вага'
        : 'BW';
  const repsDisplay = currentSet?.reps ?? 8;

  const handleOpenActiveWorkout = () => {
    hapticLight();
    router.push('/workout/active');
  };

  const handleQuickCompleteSet = async () => {
    hapticSuccess();
    completeCurrentSet();
    const updatedSession = useWorkoutSessionStore.getState().session;
    if (updatedSession && updatedSession.completed) {
      await dismissActiveWorkoutNotification();
      await finalizeWorkoutSession(updatedSession);
      router.push('/workout/complete');
    }
  };

  return (
    <Animated.View
      style={[
        styles.outerWrap,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }, { scale: modeScaleAnim }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isUk ? 'Повернутися до активного тренування' : 'Return to active workout'}
        onPress={handleOpenActiveWorkout}
        style={({ pressed }) => [
          styles.container,
          isResting && styles.containerResting,
          pressed && { opacity: 0.92 },
        ]}
      >
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              isResting && { backgroundColor: colors.restAccent },
              { width: `${Math.max(4, Math.min(100, percent))}%` },
            ]}
          />
        </View>

        <View style={styles.contentRow}>
          {isResting ? (
            <View style={styles.restBadge}>
              <Ionicons name="timer-outline" size={13} color="#061018" />
              <RestTimerCountdown restEndsAt={restEndsAt} style={styles.restBadgeText} />
            </View>
          ) : (
            <View style={styles.liveBadge}>
              <Animated.View
                style={[styles.liveDot, { transform: [{ scale: dotPulseAnim }] }]}
              />
              <WorkoutElapsedClock startedAt={session.startedAt} capHours style={styles.liveClockText} />
            </View>
          )}

          <View style={styles.infoCol}>
            <Text numberOfLines={1} style={styles.titleText}>
              {isResting
                ? isUk
                  ? `Відпочинок • Далі сет ${setNumber}/${totalSets}`
                  : `Resting • Next set ${setNumber}/${totalSets}`
                : te(currentEx.name)}
            </Text>
            <Text numberOfLines={1} style={styles.subtitleText}>
              {isResting
                ? `${te(currentEx.name)} • ${weightDisplay} × ${repsDisplay}`
                : `${tw(session.workoutName)} • ${isUk ? 'Сет' : 'Set'} ${setNumber}/${totalSets} (${weightDisplay} × ${repsDisplay})`}
            </Text>
          </View>

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
                <Text style={styles.miniActionText}>{isUk ? '-15с' : '-15s'}</Text>
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
                <Text style={styles.miniActionText}>{isUk ? '+30с' : '+30s'}</Text>
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
                <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                <Text style={styles.completeSetMiniText}>
                  {isUk ? 'Сет' : 'Set'}
                </Text>
              </Pressable>

              <View style={styles.chevronWrap}>
                <Ionicons name="chevron-up" size={16} color={colors.secondary} />
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
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
      backgroundColor: colors.isDark ? '#14181F' : '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.accentLine,
      overflow: 'hidden',
    },
    containerResting: {
      borderColor: colors.restAccent,
      backgroundColor: colors.isDark ? '#0D1720' : '#F0F9FF',
    },
    progressTrack: {
      height: 3,
      width: '100%',
      backgroundColor: colors.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accentIndicator,
    },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 10,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 10,
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.accentLine,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primaryText,
    },
    liveClockText: {
      color: colors.primaryText,
      fontSize: 12,
    },
    restBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 10,
      backgroundColor: colors.restAccent,
    },
    restBadgeText: {
      color: '#061018',
      fontSize: 12,
    },
    infoCol: {
      flex: 1,
      justifyContent: 'center',
    },
    titleText: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: 13,
      letterSpacing: -0.2,
    },
    subtitleText: {
      color: colors.secondary,
      fontFamily: fonts.medium,
      fontSize: 11,
      marginTop: 1,
      fontVariant: ['tabular-nums'],
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    miniActionBtn: {
      minHeight: 38,
      minWidth: 38,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniActionText: {
      color: colors.text,
      fontFamily: fonts.monoSemiBold,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
    },
    skipMiniBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    completeSetMiniBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 38,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    completeSetMiniText: {
      color: colors.onPrimary,
      fontFamily: fonts.bold,
      fontSize: 12,
    },
    chevronWrap: {
      width: 26,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

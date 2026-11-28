import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { RestTimerCountdown } from '@/components/workout/WorkoutTimers';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hapticLight, hapticMedium } from '@/lib/haptics';

interface RestCockpitDockProps {
  restEndsAt: number | null;
  restTotalSeconds: number;
  isUk: boolean;
  onAdjustRest: (deltaSeconds: number) => void;
  onSkipRest: () => void;
}

/**
 * Thumb-Zone Cryo-Cyan (#38BDF8) Rest Dock for the Obsidian Cockpit Active Workout.
 * Uses isolated <RestTimerCountdown /> + GPU-driven progress bar so Active screen
 * experiences 0 state re-renders per second while resting.
 */
export function RestCockpitDock({
  restEndsAt,
  restTotalSeconds,
  isUk,
  onAdjustRest,
  onSkipRest,
}: RestCockpitDockProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!restEndsAt || restEndsAt <= Date.now()) {
      progressAnim.setValue(0);
      return;
    }
    const durationMs = Math.max(0, restEndsAt - Date.now());
    const denomMs = Math.max(durationMs, (restTotalSeconds || 90) * 1000);
    const initialFraction = Math.max(0, Math.min(1, durationMs / denomMs));
    progressAnim.setValue(initialFraction);

    if (reducedMotion) return;

    const anim = Animated.timing(progressAnim, {
      toValue: 0,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [restEndsAt, restTotalSeconds, reducedMotion, progressAnim]);

  if (!restEndsAt || restEndsAt <= Date.now()) {
    return null;
  }

  const barTranslateX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-Math.max(1, trackWidth), 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.dockWrap}>
      <View style={styles.dockCard}>
        <View style={styles.topRow}>
          <View style={styles.leftMeta}>
            <View style={styles.cryoDot} />
            <Text style={styles.restKicker}>
              {isUk ? 'ВІДПОЧИНОК' : 'REST TIMER'}
            </Text>
          </View>

          <View style={styles.controlsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Subtract 15 seconds"
              hitSlop={8}
              onPress={() => {
                hapticLight();
                onAdjustRest(-15);
              }}
              style={({ pressed }) => [styles.deltaPill, pressed && { opacity: 0.72 }]}
            >
              <Text style={styles.deltaPillText}>{isUk ? '-15с' : '-15s'}</Text>
            </Pressable>

            <RestTimerCountdown restEndsAt={restEndsAt} style={styles.timerDigits} />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add 15 seconds"
              hitSlop={8}
              onPress={() => {
                hapticLight();
                onAdjustRest(15);
              }}
              style={({ pressed }) => [styles.deltaPill, pressed && { opacity: 0.72 }]}
            >
              <Text style={styles.deltaPillText}>{isUk ? '+15с' : '+15s'}</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUk ? 'Пропустити відпочинок' : 'Skip rest'}
            hitSlop={8}
            onPress={() => {
              hapticMedium();
              onSkipRest();
            }}
            style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.skipBtnText}>
              {isUk ? 'Пропустити' : 'Skip'}
            </Text>
          </Pressable>
        </View>

        <View
          style={styles.progressTrack}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && w !== trackWidth) setTrackWidth(w);
          }}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: '100%',
                transform: [{ translateX: trackWidth > 0 ? barTranslateX : -9999 }],
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    dockWrap: {
      paddingHorizontal: 14,
      paddingTop: 6,
      paddingBottom: 10,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    dockCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      paddingHorizontal: 14,
      paddingVertical: 11,
      gap: 9,
      ...cardElevation(colors),
      borderColor: colors.restAccentMuted,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    leftMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    cryoDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: colors.restAccent,
    },
    restKicker: {
      fontFamily: fonts.bold,
      fontSize: 10.5,
      letterSpacing: 0.8,
      color: colors.restAccent,
      includeFontPadding: false,
    },
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    deltaPill: {
      paddingHorizontal: 9,
      height: 32,
      borderRadius: radii.xs + 2,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deltaPillText: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 12,
      color: colors.text,
      includeFontPadding: false,
    },
    timerDigits: {
      fontFamily: fonts.monoBold,
      fontSize: 22,
      lineHeight: 26,
      color: colors.restAccent,
      minWidth: 64,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    skipBtn: {
      backgroundColor: colors.restAccentMuted,
      borderWidth: 1,
      borderColor: colors.restAccent,
      paddingHorizontal: 11,
      height: 32,
      borderRadius: radii.xs + 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skipBtnText: {
      fontFamily: fonts.bold,
      fontSize: 12,
      color: colors.restAccent,
      includeFontPadding: false,
    },
    progressTrack: {
      width: '100%',
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.elevated,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.restAccent,
      borderRadius: 1.5,
    },
  });

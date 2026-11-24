import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { BenchPressPhase } from '@/lib/exerciseAnimations/benchPressKinematics';
import type { ExerciseAnimationId } from '@/lib/exerciseAnimations/registry';
import { hapticLight } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { BarbellBenchPressSvg } from './BarbellBenchPressSvg';

export interface ExerciseAnimationStageProps {
  animationId: ExerciseAnimationId;
  /** True when the containing screen/modal and tab are actively visible */
  active: boolean;
}

const PHASE_LABELS: Record<BenchPressPhase, { uk: string; en: string; isActiveDrive: boolean }> = {
  setup: { uk: 'Вихідне положення', en: 'Setup', isActiveDrive: false },
  eccentric: { uk: 'Опускання під контролем', en: 'Controlled Lowering', isActiveDrive: false },
  bottom: { uk: 'Пауза на грудях', en: 'Chest Pause', isActiveDrive: true },
  concentric: { uk: 'Жим вгору по J-дузі', en: 'Pressing Up', isActiveDrive: true },
  lockout: { uk: 'Фіксація вгорі', en: 'Lockout', isActiveDrive: false },
};

/**
 * Reusable, minimal exercise demonstration stage.
 *
 * Responsibilities:
 * - Hosts the responsive 16:10 vector animation canvas without clipping.
 * - Automatically pauses on app background, modal close, or tab switch (zero leaked RAF).
 * - Respects OS Reduce Motion (displays a clean mid-press static frame until user presses Play).
 * - Provides minimal Play/Pause, Restart, live Movement Phase indicator, and a zero-re-render
 *   bottom cycle progress hairline.
 */
export function ExerciseAnimationStage({ animationId, active }: ExerciseAnimationStageProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { language } = useI18n();
  const isUk = language === 'uk';
  const reducedMotion = useReducedMotion();

  const [userPaused, setUserPaused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [restartToken, setRestartToken] = useState(0);
  const [phase, setPhase] = useState<BenchPressPhase>('setup');

  // Imperative progress hairline (updates at 60fps via native style/DOM without React re-renders)
  const progressBarRef = useRef<any>(null);
  const stageWidthRef = useRef<number>(320);

  // Sync userPaused when reducedMotion preference changes
  useEffect(() => {
    if (reducedMotion) {
      setUserPaused(true);
    }
  }, [reducedMotion]);

  // Pause automatically when app enters background or becomes inactive
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      setAppActive(nextState === 'active');
    });
    return () => {
      sub.remove();
    };
  }, []);

  const isPlaying = active && appActive && !userPaused;

  const handleTogglePlay = useCallback(() => {
    hapticLight();
    setUserPaused((prev) => !prev);
  }, []);

  const handleRestart = useCallback(() => {
    hapticLight();
    setRestartToken((prev) => prev + 1);
    setUserPaused(false);
  }, []);

  const handleProgressFrame = useCallback((cycleProgress: number) => {
    const node = progressBarRef.current;
    if (!node) return;
    const clamped = Math.max(0, Math.min(1, cycleProgress));
    if (Platform.OS === 'web') {
      if (node.style) {
        node.style.transform = `scaleX(${clamped.toFixed(4)})`;
      }
      return;
    }
    if (typeof node.setNativeProps === 'function') {
      const width = stageWidthRef.current;
      node.setNativeProps({
        style: {
          transform: [
            { translateX: -width * 0.5 * (1 - clamped) },
            { scaleX: Math.max(0.001, clamped) },
          ],
        },
      });
    }
  }, []);

  const phaseMeta = PHASE_LABELS[phase];

  return (
    <View
      style={styles.card}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) stageWidthRef.current = w;
      }}
    >
      {/* Responsive Vector Stage (16:9.8 aspect ratio matching 360x220 viewBox) */}
      <View style={styles.canvasWrap}>
        {animationId === 'barbell_bench_press' ? (
          <BarbellBenchPressSvg
            isPlaying={isPlaying}
            restartToken={restartToken}
            initialElapsedMs={reducedMotion ? 1650 : 0}
            onPhaseChange={setPhase}
            onProgressFrame={handleProgressFrame}
          />
        ) : null}

        {/* Subtle Top-Right Minimal Transport Controls */}
        <View style={styles.controlsOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause animation' : 'Play animation'}
            hitSlop={8}
            onPress={handleTogglePlay}
            style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnPressed]}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={14}
              color={colors.text}
              style={!isPlaying ? { marginLeft: 1.5 } : undefined}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restart animation"
            hitSlop={8}
            onPress={handleRestart}
            style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnPressed]}
          >
            <Ionicons name="refresh" size={14} color={colors.secondary} />
          </Pressable>
        </View>
      </View>

      {/* Minimal Footer Strip: Live Biomechanical Phase + Cycle Progress Hairline */}
      <View style={styles.footer}>
        <View style={styles.phasePill}>
          <View
            style={[
              styles.phaseDot,
              {
                backgroundColor: !isPlaying
                  ? colors.muted
                  : phaseMeta.isActiveDrive
                    ? colors.primaryText
                    : colors.secondary,
              },
            ]}
          />
          <Text style={styles.phaseText} numberOfLines={1}>
            {isUk ? phaseMeta.uk : phaseMeta.en}
          </Text>
        </View>

        <Text style={styles.tempoLabel}>
          {reducedMotion && userPaused
            ? isUk
              ? 'Зменшений рух'
              : 'Reduced motion'
            : isUk
              ? 'Темп 2-0-1'
              : 'Tempo 2-0-1'}
        </Text>
      </View>

      {/* Ultra-thin cycle progress hairline along bottom edge */}
      <View style={styles.progressTrack} pointerEvents="none">
        <View
          ref={progressBarRef}
          style={[
            styles.progressFill,
            Platform.OS === 'web' ? ({ transformOrigin: 'left center' } as any) : null,
          ]}
        />
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: radii.md + 2,
      backgroundColor: colors.isDark ? '#101318' : colors.surface,
      overflow: 'hidden',
      ...cardElevation(colors),
    },
    canvasWrap: {
      width: '100%',
      aspectRatio: 284 / 194,
      minHeight: 204,
      maxHeight: 256,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    controlsOverlay: {
      position: 'absolute',
      top: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    controlBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.isDark
        ? 'rgba(21, 24, 28, 0.82)'
        : 'rgba(255, 255, 255, 0.90)',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    controlBtnPressed: {
      opacity: 0.72,
      transform: [{ scale: 0.95 }],
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      backgroundColor: colors.surface,
      gap: 10,
    },
    phasePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      flex: 1,
    },
    phaseDot: {
      width: 6.5,
      height: 6.5,
      borderRadius: 3.25,
    },
    phaseText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.1,
    },
    tempoLabel: {
      fontFamily: fonts.medium,
      fontSize: 11,
      fontWeight: '500',
      color: colors.muted,
      fontVariant: ['tabular-nums'],
    },
    progressTrack: {
      height: 2,
      width: '100%',
      backgroundColor: colors.divider,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      width: '100%',
      backgroundColor: colors.accentLine,
      opacity: 0.75,
    },
  });

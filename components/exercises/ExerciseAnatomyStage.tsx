import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { AnatomySex, ExerciseAnatomyVideoSpec } from '@/lib/exerciseAnatomyVideos';
import { hapticLight } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';

export interface ExerciseAnatomyStageProps {
  spec: ExerciseAnatomyVideoSpec;
  defaultSex?: 'male' | 'female' | 'unspecified';
  /** True when the containing modal and Guide tab are actively visible */
  active: boolean;
}

/**
 * High-performance offline 3D anatomical demonstration player powered by expo-video.
 *
 * - Hardware-decoded H.264 MP4 rendered from medical-grade 3D écorché anatomy (Male & Female).
 * - Muted + mixWithOthers so workout music (Spotify / Apple Music) is never interrupted.
 * - Auto-pauses on background / modal close / tab switch, and respects OS Reduce Motion.
 * - Displays clear anatomical involvement legend (Primary vs Secondary muscles) — never
 *   claiming measured EMG activation, strictly showing biomechanical involvement.
 */
export function ExerciseAnatomyStage({
  spec,
  defaultSex = 'male',
  active,
}: ExerciseAnatomyStageProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { language } = useI18n();
  const isUk = language === 'uk';
  const reducedMotion = useReducedMotion();

  const initialSex: AnatomySex = defaultSex === 'female' ? 'female' : 'male';
  const [selectedSex, setSelectedSex] = useState<AnatomySex>(initialSex);
  const [userPaused, setUserPaused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    setSelectedSex(defaultSex === 'female' ? 'female' : 'male');
  }, [defaultSex, spec.id]);

  useEffect(() => {
    if (reducedMotion) {
      setUserPaused(true);
    }
  }, [reducedMotion]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      setAppActive(nextState === 'active');
    });
    return () => sub.remove();
  }, []);

  const activeSource = selectedSex === 'female' ? spec.femaleSource : spec.maleSource;
  const shouldPlay = active && appActive && !userPaused;

  const player = useVideoPlayer(activeSource, (p) => {
    p.loop = true;
    p.muted = true;
    if ('audioMixingMode' in p) {
      p.audioMixingMode = 'mixWithOthers';
    }
    if (shouldPlay) {
      p.play();
    }
  });

  useEffect(() => {
    try {
      if (shouldPlay) {
        player.play();
      } else {
        player.pause();
      }
    } catch {
      // Ignore native player teardown race on rapid modal close
    }
  }, [player, shouldPlay]);

  const handleTogglePlay = useCallback(() => {
    hapticLight();
    setUserPaused((prev) => !prev);
  }, []);

  const handleRestart = useCallback(() => {
    hapticLight();
    try {
      player.currentTime = 0;
      setUserPaused(false);
      player.play();
    } catch {
      // Safe fallback
    }
  }, [player]);

  const handleSelectSex = useCallback((nextSex: AnatomySex) => {
    if (nextSex === selectedSex) return;
    hapticLight();
    setSelectedSex(nextSex);
  }, [selectedSex]);

  return (
    <View style={styles.card}>
      {/* 3D Anatomical Video Viewport */}
      <View style={[styles.videoWrap, { aspectRatio: spec.aspectRatio }]}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="cover"
          allowsPictureInPicture={false}
          playsInline
        />

        {/* Top-Left: Subtle Male / Female 3D Model Switcher */}
        <View style={styles.sexToggleWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Male 3D anatomy model"
            onPress={() => handleSelectSex('male')}
            style={[styles.sexPillBtn, selectedSex === 'male' && styles.sexPillBtnActive]}
          >
            <Text style={[styles.sexPillText, selectedSex === 'male' && styles.sexPillTextActive]}>
              {isUk ? 'Чол' : 'M'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Female 3D anatomy model"
            onPress={() => handleSelectSex('female')}
            style={[styles.sexPillBtn, selectedSex === 'female' && styles.sexPillBtnActive]}
          >
            <Text style={[styles.sexPillText, selectedSex === 'female' && styles.sexPillTextActive]}>
              {isUk ? 'Жін' : 'F'}
            </Text>
          </Pressable>
        </View>

        {/* Top-Right: Minimal Play/Pause + Restart Transport */}
        <View style={styles.controlsOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shouldPlay ? 'Pause 3D anatomy animation' : 'Play 3D anatomy animation'}
            hitSlop={8}
            onPress={handleTogglePlay}
            style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnPressed]}
          >
            <Ionicons
              name={shouldPlay ? 'pause' : 'play'}
              size={14}
              color="#F5F7FA"
              style={!shouldPlay ? { marginLeft: 1.5 } : undefined}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restart 3D anatomy animation"
            hitSlop={8}
            onPress={handleRestart}
            style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnPressed]}
          >
            <Ionicons name="refresh" size={14} color="#CBD5E1" />
          </Pressable>
        </View>
      </View>

      {/* Anatomical Muscle Involvement Legend (Primary vs Secondary) */}
      <View style={styles.legendBar}>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#C8FF3D' }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              <Text style={styles.legendKind}>{isUk ? 'Основний: ' : 'Primary: '}</Text>
              {isUk ? spec.primaryMusclesUk : spec.primaryMusclesEn}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2E9E5B' }]} />
            <Text style={styles.legendLabelSecondary} numberOfLines={1}>
              <Text style={styles.legendKindSecondary}>{isUk ? 'Допоміжні: ' : 'Secondary: '}</Text>
              {isUk ? spec.secondaryMusclesUk : spec.secondaryMusclesEn}
            </Text>
          </View>
        </View>

        <Text style={styles.attributionText} numberOfLines={1}>
          {spec.attribution}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: radii.md + 2,
      backgroundColor: '#0B0D0F',
      overflow: 'hidden',
      ...cardElevation(colors),
    },
    videoWrap: {
      width: '100%',
      backgroundColor: '#0B0D0F',
      position: 'relative',
      overflow: 'hidden',
    },
    video: {
      width: '100%',
      height: '100%',
    },
    sexToggleWrap: {
      position: 'absolute',
      top: 10,
      left: 10,
      flexDirection: 'row',
      backgroundColor: 'rgba(11, 13, 15, 0.78)',
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      padding: 2,
      gap: 2,
    },
    sexPillBtn: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: radii.pill,
    },
    sexPillBtnActive: {
      backgroundColor: '#C8FF3D',
    },
    sexPillText: {
      fontFamily: fonts.bold,
      fontSize: 10.5,
      fontWeight: '700',
      color: '#CBD5E1',
    },
    sexPillTextActive: {
      color: '#0B0D0F',
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
      backgroundColor: 'rgba(11, 13, 15, 0.78)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    controlBtnPressed: {
      opacity: 0.72,
      transform: [{ scale: 0.94 }],
    },
    legendBar: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 6,
    },
    legendItems: {
      gap: 4,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    legendDot: {
      width: 7.5,
      height: 7.5,
      borderRadius: 4,
    },
    legendKind: {
      fontFamily: fonts.bold,
      fontWeight: '700',
      color: colors.text,
    },
    legendLabel: {
      fontFamily: fonts.medium,
      fontSize: 12,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
    },
    legendKindSecondary: {
      fontFamily: fonts.semiBold,
      fontWeight: '600',
      color: colors.secondary,
    },
    legendLabelSecondary: {
      fontFamily: fonts.regular,
      fontSize: 11.5,
      color: colors.secondary,
      flex: 1,
    },
    attributionText: {
      fontFamily: fonts.regular,
      fontSize: 10,
      color: colors.muted,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
  });

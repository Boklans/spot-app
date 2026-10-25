import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticLight } from '@/lib/haptics';

interface ExercisePhaseAnimatorProps {
  imageSource: ImageSourcePropType;
  exerciseName: string;
  selectedPhase: 1 | 2 | 3;
  onSelectPhase: (phase: 1 | 2 | 3) => void;
  setupCue: string;
  executionCue: string;
  tipsCue: string;
  isUk: boolean;
}

export function ExercisePhaseAnimator({
  imageSource,
  exerciseName,
  selectedPhase,
  onSelectPhase,
  setupCue,
  executionCue,
  tipsCue,
  isUk,
}: ExercisePhaseAnimatorProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const breathAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.2)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Auto-play timer syncing phases 1 -> 2 -> 3 -> 1
  useEffect(() => {
    if (!isPlaying) {
      loopRef.current?.stop();
      return;
    }

    // Smooth subtle physiological breathing & depth motion (scale 1.0 -> 1.04)
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(breathAnim, {
            toValue: 1.04,
            duration: 2200,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.45,
            duration: 2200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(breathAnim, {
            toValue: 1.0,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.2,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loopRef.current.start();

    // Auto-advance movement phases in realistic cadence
    // Phase 1 (Setup hold: 1.5s) -> Phase 2 (Movement lowering: 2.5s) -> Phase 3 (Lockout: 1.5s)
    let timeoutId: any;
    if (selectedPhase === 1) {
      timeoutId = setTimeout(() => {
        onSelectPhase(2);
      }, 2000);
    } else if (selectedPhase === 2) {
      timeoutId = setTimeout(() => {
        onSelectPhase(3);
      }, 2600);
    } else {
      timeoutId = setTimeout(() => {
        onSelectPhase(1);
      }, 1800);
    }

    return () => {
      clearTimeout(timeoutId);
      loopRef.current?.stop();
    };
  }, [isPlaying, selectedPhase, onSelectPhase, breathAnim, glowAnim]);

  const currentPhaseTitle =
    selectedPhase === 1
      ? isUk ? 'ФАЗА 1: ПОЗИЦІЯ ТА ХВАТ' : 'PHASE 1: SETUP & GRIP'
      : selectedPhase === 2
      ? isUk ? 'ФАЗА 2: РОБОЧИЙ РУХ' : 'PHASE 2: EXECUTION'
      : isUk ? 'ФАЗА 3: ПІКОВА ФІКСАЦІЯ' : 'PHASE 3: PEAK LOCKOUT';

  const currentCueText =
    selectedPhase === 1 ? setupCue : selectedPhase === 2 ? executionCue : tipsCue;

  const currentBreathingCue =
    selectedPhase === 1
      ? isUk ? '🫁 Кор напружений • Стабільний хват' : '🫁 Brace core • Secure grip'
      : selectedPhase === 2
      ? isUk ? '🌬️ Вдих носом • Опускання 2–3 сек' : '🌬️ Inhale • Controlled lower 2–3s'
      : isUk ? '💨 Потужний видих • Фіксація 1–2 сек' : '💨 Exhale on effort • 1–2s lockout';

  return (
    <View style={styles.container}>
      {/* 3D Render Image Container with subtle breathing depth */}
      <View style={styles.imageCard}>
        <Animated.View
          style={[
            styles.animatedImageWrap,
            {
              transform: [{ scale: breathAnim }],
            },
          ]}
        >
          <Image
            source={imageSource}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Top Badges Row */}
        <View style={styles.topRow}>
          <View style={styles.badge3D}>
            <View style={styles.pulseDot} />
            <Text style={styles.badge3DText}>
              {isUk ? '3D ДЕМОНСТРАЦІЯ ТА ФАЗИ' : '3D TECHNIQUE GUIDE'}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              setIsPlaying((prev) => !prev);
            }}
            style={styles.playPauseBtn}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={12} color="#0B0D0F" />
            <Text style={styles.playPauseText}>
              {isPlaying ? (isUk ? 'Пауза' : 'Pause') : (isUk ? 'Авто' : 'Auto')}
            </Text>
          </Pressable>
        </View>

        {/* Dynamic Phase Directives over Image */}
        <View style={styles.phaseOverlayCard}>
          <View style={styles.phasePillRow}>
            <View style={styles.phasePill}>
              <Text style={styles.phasePillText}>{currentPhaseTitle}</Text>
            </View>
            <View style={styles.breathingPill}>
              <Text style={styles.breathingPillText}>{currentBreathingCue}</Text>
            </View>
          </View>

          <Text numberOfLines={2} style={styles.phaseCueText}>
            {currentCueText}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  imageCard: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    backgroundColor: '#0E1115',
    borderWidth: 1.5,
    borderColor: 'rgba(200, 255, 61, 0.25)',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
  },
  animatedImageWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    zIndex: 10,
  },
  badge3D: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(11, 13, 15, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  badge3DText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  playPauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  playPauseText: {
    color: '#0B0D0F',
    fontSize: 11,
    fontWeight: '900',
  },
  phaseOverlayCard: {
    backgroundColor: 'rgba(11, 13, 15, 0.88)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 5,
    zIndex: 10,
  },
  phasePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  phasePill: {
    backgroundColor: 'rgba(200, 255, 61, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  phasePillText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  breathingPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  breathingPillText: {
    color: '#CBD5E1',
    fontSize: 10.5,
    fontWeight: '700',
  },
  phaseCueText: {
    color: '#F1F5F9',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
});

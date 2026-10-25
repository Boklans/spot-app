import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';

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
  setupCue,
  executionCue,
  tipsCue,
  isUk,
}: ExercisePhaseAnimatorProps) {
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
      {/* 3D Render Image Container */}
      <View style={styles.imageCard}>
        <Image
          source={imageSource}
          style={styles.heroImage}
          resizeMode="cover"
        />

        {/* Top Badge */}
        <View style={styles.topRow}>
          <View style={styles.badge3D}>
            <View style={styles.pulseDot} />
            <Text style={styles.badge3DText}>
              {isUk ? '3D АНАТОМІЯ М’ЯЗІВ ТА ТЕХНІКА' : '3D MUSCLE ANATOMY & TECHNIQUE'}
            </Text>
          </View>
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
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
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
  phaseOverlayCard: {
    backgroundColor: 'rgba(11, 13, 15, 0.90)',
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

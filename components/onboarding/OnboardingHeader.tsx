import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ThemeColors, useThemeColors } from '@/constants/colors';
import { hapticLight } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';

type OnboardingHeaderProps = {
  step: number;
  totalSteps?: number;
  onBack?: () => void;
};

export function OnboardingHeader({
  step,
  totalSteps = 5,
  onBack,
}: OnboardingHeaderProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { language } = useI18n();
  const isUk = language === 'uk';

  const segments = Array.from({ length: totalSteps }, (_, idx) => idx + 1);

  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isUk ? 'Назад' : 'Back'}
        hitSlop={12}
        onPress={() => {
          hapticLight();
          if (onBack) {
            onBack();
          } else {
            router.back();
          }
        }}
        style={({ pressed }) => [
          styles.backBtn,
          pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
        ]}
      >
        <Ionicons name="arrow-back" size={20} color={colors.text} />
      </Pressable>

      <View style={styles.progressCenter}>
        <View style={styles.segmentsRow}>
          {segments.map((seg) => {
            const isCompleted = seg < step;
            const isCurrent = seg === step;
            return (
              <View
                key={seg}
                style={[
                  styles.segmentTrack,
                  isCompleted && styles.segmentCompleted,
                  isCurrent && styles.segmentCurrent,
                ]}
              />
            );
          })}
        </View>
        <Text style={styles.stepLabel}>
          {isUk ? `КРОК ${step} З ${totalSteps}` : `STEP ${step} OF ${totalSteps}`}
        </Text>
      </View>

      <View style={styles.topBarPlaceholder} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      height: 52,
      marginBottom: 4,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressCenter: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 18,
      gap: 6,
    },
    segmentsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      width: '100%',
      maxWidth: 180,
    },
    segmentTrack: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.elevated,
    },
    segmentCompleted: {
      backgroundColor: colors.accentLine,
      opacity: 0.55,
    },
    segmentCurrent: {
      backgroundColor: colors.primary,
    },
    stepLabel: {
      fontSize: 10.5,
      fontWeight: '800',
      color: colors.secondary,
      letterSpacing: 1,
    },
    topBarPlaceholder: {
      width: 40,
    },
  });

import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import type { WorkoutInsight } from '@/lib/suggestionEngine';

type SmartInsightBannerProps = {
  insight: WorkoutInsight;
  style?: StyleProp<ViewStyle>;
};

export function SmartInsightBanner({ insight, style }: SmartInsightBannerProps) {
  const isWarning = insight.type === 'warning';
  const isPositive = insight.type === 'positive';

  const accentColor = isWarning
    ? colors.warning // #FFB84D
    : isPositive
    ? colors.primary // #C8FF3D
    : colors.secondary;

  const backgroundColor = isWarning
    ? 'rgba(255, 184, 77, 0.09)'
    : isPositive
    ? 'rgba(200, 255, 61, 0.08)'
    : 'rgba(21, 24, 28, 0.7)';

  const borderColor = isWarning
    ? 'rgba(255, 184, 77, 0.3)'
    : isPositive
    ? 'rgba(200, 255, 61, 0.25)'
    : colors.border;

  const icon = isWarning ? '⚠️' : isPositive ? '💡' : 'ℹ️';

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor,
          borderColor,
          borderLeftColor: accentColor,
        },
        style,
      ]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{insight.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  icon: {
    fontSize: 18,
    lineHeight: 22,
  },
  message: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});


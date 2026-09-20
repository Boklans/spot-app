import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Card } from '@/components/ui/Card';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import type { MuscleRecoveryStatus, RecoveryStatusType } from '@/lib/recoveryEngine';

type RecoveryCardProps = {
  recoveryData: MuscleRecoveryStatus[];
  style?: StyleProp<ViewStyle>;
};

function getStatusColor(status: RecoveryStatusType): string {
  switch (status) {
    case 'Ready':
      return colors.primary; // Lime #C8FF3D
    case 'Recovering':
      return colors.warning; // Yellow/Amber #FFB84D
    case 'Fatigued':
      return colors.danger; // Red #FF5C5C
  }
}

export function RecoveryCard({ recoveryData, style }: RecoveryCardProps) {
  const displayedMuscles = recoveryData.slice(0, 4);

  return (
    <Card style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>RECOVERY</Text>
        <Text style={styles.subtitle}>MUSCLE READINESS</Text>
      </View>

      <View style={styles.list}>
        {displayedMuscles.map((item, index) => {
          const statusColor = getStatusColor(item.status);
          const isLast = index === displayedMuscles.length - 1;

          return (
            <View
              key={item.muscleGroup}
              style={[styles.itemRow, !isLast && styles.itemBorder]}
            >
              <View style={styles.leftCol}>
                <View style={[styles.dot, { backgroundColor: statusColor }]} />
                <Text style={styles.muscleText}>
                  {item.muscleGroup}
                  <Text style={styles.separatorText}> — </Text>
                  <Text style={[styles.percentText, { color: statusColor }]}>
                    {item.readinessPercentage}%
                  </Text>
                </Text>
              </View>

              <View style={styles.rightCol}>
                <Text style={[styles.statusLabel, { color: statusColor }]}>
                  {item.status}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  list: {
    marginTop: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41, 46, 53, 0.4)',
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  muscleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  separatorText: {
    color: colors.muted,
    fontWeight: '400',
  },
  percentText: {
    fontWeight: '800',
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
});


import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Card } from '@/components/ui/Card';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import type { WeeklyReview } from '@/lib/weeklyReviewEngine';

type WeeklyReviewCardProps = {
  review: WeeklyReview;
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
};

export function WeeklyReviewCard({ review, onDismiss, style }: WeeklyReviewCardProps) {
  const formattedVolume = review.totalVolume.toLocaleString('en-US');

  return (
    <Card style={[styles.card, style]}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={styles.badgeContainer}>
          <Text style={styles.sparkleIcon}>✨</Text>
          <Text style={styles.title}>YOUR WEEKLY REVIEW</Text>
        </View>
        <Text style={styles.weekKeyText}>{review.weekKey}</Text>
      </View>

      {/* Inline Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statValue}>
            {review.workoutsCount} <Text style={styles.statUnit}>Workouts</Text>
          </Text>
        </View>

        <Text style={styles.statDivider}>|</Text>

        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>🏋️</Text>
          <Text style={styles.statValue}>
            {formattedVolume} <Text style={styles.statUnit}>kg</Text>
          </Text>
        </View>

        <Text style={styles.statDivider}>|</Text>

        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>🏆</Text>
          <Text style={styles.statValue}>
            {review.prCount} <Text style={styles.statUnit}>PR{review.prCount === 1 ? '' : 's'}</Text>
          </Text>
        </View>
      </View>

      {/* AI Summary Text */}
      <Text style={styles.summaryText}>{review.summaryText}</Text>

      {/* Dismiss Action */}
      <View style={styles.footerRow}>
        <Pressable
          accessibilityRole="button"
          onPress={onDismiss}
          style={({ pressed }) => [styles.dismissButton, pressed && styles.dismissButtonPressed]}
        >
          <Text style={styles.dismissText}>GOT IT</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161320',
    borderColor: '#3D2F6B',
    borderWidth: 1,
    borderRadius: 18,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  sparkleIcon: {
    fontSize: 12,
  },
  title: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  weekKeyText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(124, 92, 255, 0.08)',
    borderColor: 'rgba(124, 92, 255, 0.15)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statEmoji: {
    fontSize: 14,
  },
  statValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  statUnit: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  statDivider: {
    color: 'rgba(124, 92, 255, 0.3)',
    fontSize: 12,
    fontWeight: '300',
  },
  summaryText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  dismissButton: {
    backgroundColor: 'rgba(124, 92, 255, 0.14)',
    borderColor: 'rgba(124, 92, 255, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 3,
  },
  dismissButtonPressed: {
    opacity: 0.6,
  },
  dismissText: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});


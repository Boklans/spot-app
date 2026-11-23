import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import type { CoachInsight } from '@/lib/coachEngine';
import { hapticMedium } from '@/lib/haptics';

interface SpotCoachCardProps {
  insight: CoachInsight;
  onAction?: (actionType: NonNullable<CoachInsight['actionType']>) => void;
}

export function SpotCoachCard({ insight, onAction }: SpotCoachCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const accentColor =
    insight.accent === 'amber'
      ? colors.warning
      : insight.accent === 'emerald'
        ? colors.success
        : insight.accent === 'purple'
          ? colors.purple
          : colors.primaryText;

  const badgeBg =
    insight.accent === 'amber'
      ? colors.isDark
        ? 'rgba(255, 184, 77, 0.14)'
        : 'rgba(217, 119, 6, 0.12)'
      : insight.accent === 'emerald'
        ? colors.isDark
          ? 'rgba(101, 229, 114, 0.14)'
          : 'rgba(22, 163, 74, 0.12)'
        : insight.accent === 'purple'
          ? colors.isDark
            ? 'rgba(124, 92, 255, 0.16)'
            : 'rgba(109, 40, 217, 0.10)'
          : colors.primaryMuted;

  const iconName: keyof typeof Ionicons.glyphMap =
    insight.type === 'deload_active' || insight.type === 'deload_recommended'
      ? 'shield-checkmark-outline'
      : insight.type === 'strength_win'
        ? 'trending-up'
        : insight.type === 'lagging_muscle'
          ? 'body-outline'
          : 'sparkles-outline';

  return (
    <View style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Ionicons name={iconName} size={13} color={accentColor} />
          <Text style={[styles.badgeText, { color: accentColor }]}>{insight.badge}</Text>
        </View>
      </View>

      <Text style={styles.title}>{insight.title}</Text>
      <Text style={styles.body}>{insight.body}</Text>

      {insight.actionLabel && insight.actionType && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={insight.actionLabel}
          onPress={() => {
            hapticMedium();
            onAction(insight.actionType!);
          }}
          style={({ pressed }) => [
            styles.actionBtn,
            insight.actionType === 'apply_deload' || insight.actionType === 'restore_deload'
              ? { backgroundColor: badgeBg, borderColor: accentColor }
              : { backgroundColor: colors.elevated, borderColor: colors.border },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text
            style={[
              styles.actionBtnText,
              {
                color:
                  insight.actionType === 'apply_deload' || insight.actionType === 'restore_deload'
                    ? accentColor
                    : colors.text,
              },
            ]}
          >
            {insight.actionLabel}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={14}
            color={
              insight.actionType === 'apply_deload' || insight.actionType === 'restore_deload'
                ? accentColor
                : colors.secondary
            }
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      paddingLeft: 20,
      marginTop: 14,
      overflow: 'hidden',
      ...cardElevation(colors),
    },
    accentBar: {
      position: 'absolute',
      left: 0,
      top: 14,
      bottom: 14,
      width: 3.5,
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgeText: {
      fontFamily: fonts.bold,
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 15.5,
      fontWeight: '700',
      letterSpacing: -0.2,
      marginBottom: 4,
    },
    body: {
      fontFamily: fonts.regular,
      color: colors.secondary,
      fontSize: 13,
      lineHeight: 19,
    },
    actionBtn: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    actionBtnText: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      fontWeight: '600',
    },
  });

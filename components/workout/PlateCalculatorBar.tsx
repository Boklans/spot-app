import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { hapticLight } from '@/lib/haptics';
import {
  BAR_WEIGHT_OPTIONS,
  calculateBarbellPlates,
  formatPlateSummary,
  getDefaultBarWeight,
  type PlateUnit,
} from '@/lib/plateCalculator';

interface PlateCalculatorBarProps {
  /** Target total weight in active display unit (kg or lbs) */
  targetDisplayWeight: number;
  unit: PlateUnit;
  exerciseName?: string;
  isUk: boolean;
}

/**
 * Gym-floor Barbell Plate Visualizer with labeled IPF-colored plates on the sleeve,
 * selectable bar weight (20/15/10 kg or 45/35/25 lb), and scannable per-side badges.
 */
export function PlateCalculatorBar({
  targetDisplayWeight,
  unit,
  exerciseName,
  isUk,
}: PlateCalculatorBarProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [barWeight, setBarWeight] = useState<number>(() =>
    getDefaultBarWeight(unit, exerciseName)
  );

  const result = useMemo(
    () => calculateBarbellPlates(targetDisplayWeight, unit, barWeight),
    [targetDisplayWeight, unit, barWeight]
  );

  const barOptions = BAR_WEIGHT_OPTIONS[unit];
  const summaryText = formatPlateSummary(result, isUk);
  const unitText = unit === 'lbs' ? 'lb' : isUk ? 'кг' : 'kg';

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Text style={styles.kicker}>
          {isUk ? 'МЛИНЦІ НА ШТАНГУ' : 'BARBELL PLATES'}
        </Text>
        <View style={styles.barChips}>
          {barOptions.map((opt) => {
            const active = barWeight === opt.weight;
            return (
              <Pressable
                key={opt.weight}
                accessibilityRole="button"
                onPress={() => {
                  hapticLight();
                  setBarWeight(opt.weight);
                }}
                style={[styles.barChip, active && styles.barChipActive]}
              >
                <Text style={[styles.barChipText, active && styles.barChipTextActive]}>
                  {isUk ? opt.labelUk : opt.labelEn}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Visual Barbell Sleeve with Labeled Plates */}
      <View style={styles.barVisualRow}>
        <View style={styles.shaft} />
        <View style={styles.collar} />
        <View style={styles.sleeveWrap}>
          <View style={styles.sleeveBar} />
          <View style={styles.platesRow}>
            {result.sleevePlates.slice(0, 7).map((plate, idx) => {
              const plateHeight = Math.max(24, Math.round(48 * plate.heightRatio));
              const plateWidth = plate.weight >= 10 ? 24 : plate.weight >= 5 ? 21 : 24;
              return (
                <View
                  key={`${plate.weight}-${idx}`}
                  style={[
                    styles.plateBlock,
                    {
                      backgroundColor: plate.color,
                      height: plateHeight,
                      width: plateWidth,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.plateBlockText,
                      {
                        color: plate.textColor,
                        fontSize: plate.weight === 1.25 || plate.weight === 2.5 ? 8.5 : 10,
                      },
                    ]}
                  >
                    {plate.weight}
                  </Text>
                </View>
              );
            })}
            {result.sleevePlates.length > 7 && (
              <View style={styles.overflowBadge}>
                <Text style={styles.overflowText}>+{result.sleevePlates.length - 7}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Per-side color-coded pills + total breakdown */}
      {result.perSide.length > 0 ? (
        <View style={styles.badgesWrap}>
          {result.perSide.map((item) => (
            <View key={item.weight} style={styles.platePill}>
              <View style={[styles.platePillDot, { backgroundColor: item.spec.color }]} />
              <Text style={styles.platePillText}>
                {item.count > 1 ? `${item.count}×${item.weight}` : `${item.weight}`} {unitText}
              </Text>
            </View>
          ))}
          <Text style={styles.perSideSuffix}>
            {isUk ? 'на сторону' : 'per side'}
          </Text>
          {result.remainderPerSide > 0 && (
            <Text style={styles.remainderText}>
              ≈ {result.achievableTotal} {unitText}
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText} numberOfLines={2}>
            {summaryText}
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: colors.background,
      borderRadius: radii.sm + 2,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 14,
      gap: 10,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    kicker: {
      fontFamily: fonts.bold,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.7,
      color: colors.muted,
    },
    barChips: {
      flexDirection: 'row',
      gap: 4,
    },
    barChip: {
      paddingHorizontal: 7,
      paddingVertical: 3.5,
      borderRadius: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    barChipActive: {
      backgroundColor: colors.activeChipBg,
      borderColor: colors.activeChipBg,
    },
    barChipText: {
      fontFamily: fonts.semiBold,
      fontSize: 10.5,
      fontWeight: '600',
      color: colors.secondary,
      fontVariant: ['tabular-nums'],
    },
    barChipTextActive: {
      fontFamily: fonts.bold,
      color: colors.activeChipText,
      fontWeight: '700',
    },
    barVisualRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 52,
      paddingHorizontal: 2,
    },
    shaft: {
      width: 34,
      height: 7,
      borderTopLeftRadius: 3.5,
      borderBottomLeftRadius: 3.5,
      backgroundColor: colors.isDark ? '#4B5563' : '#94A3B8',
    },
    collar: {
      width: 8,
      height: 22,
      borderRadius: 2.5,
      backgroundColor: colors.isDark ? '#6B7280' : '#64748B',
    },
    sleeveWrap: {
      flex: 1,
      height: 52,
      justifyContent: 'center',
      position: 'relative',
    },
    sleeveBar: {
      position: 'absolute',
      left: 0,
      right: 6,
      height: 11,
      borderTopRightRadius: 3.5,
      borderBottomRightRadius: 3.5,
      backgroundColor: colors.isDark ? '#2F3744' : '#CBD5E1',
    },
    platesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingLeft: 4,
      zIndex: 1,
    },
    plateBlock: {
      borderRadius: 4,
      borderWidth: 0.75,
      borderColor: 'rgba(0,0,0,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    plateBlockText: {
      fontFamily: fonts.extraBold,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    overflowBadge: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 4,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    overflowText: {
      fontFamily: fonts.bold,
      fontSize: 10,
      fontWeight: '700',
      color: colors.secondary,
    },
    badgesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    platePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    platePillDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    platePillText: {
      fontFamily: fonts.bold,
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    perSideSuffix: {
      fontFamily: fonts.medium,
      fontSize: 11.5,
      fontWeight: '500',
      color: colors.secondary,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    summaryText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      fontWeight: '600',
      color: colors.secondary,
      flex: 1,
      fontVariant: ['tabular-nums'],
    },
    remainderText: {
      fontFamily: fonts.bold,
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.warning,
      fontVariant: ['tabular-nums'],
    },
  });

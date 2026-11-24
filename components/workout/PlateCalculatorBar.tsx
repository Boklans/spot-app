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
 * Compact, gym-floor Barbell Plate Visualizer showing exact plates per side
 * with IPF-inspired color coding and selectable bar weight (20/15/10 kg or 45/35/25 lb).
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

      {/* Visual Barbell Sleeve (Half-Bar Representation) */}
      <View style={styles.barVisualRow}>
        <View style={styles.shaft} />
        <View style={styles.collar} />
        <View style={styles.sleeveWrap}>
          <View style={styles.sleeveBar} />
          <View style={styles.platesRow}>
            {result.sleevePlates.slice(0, 10).map((plate, idx) => (
              <View
                key={`${plate.weight}-${idx}`}
                style={[
                  styles.plateBlock,
                  {
                    backgroundColor: plate.color,
                    height: Math.round(36 * plate.heightRatio),
                    width: plate.thickness,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Per-side breakdown + remainder warning */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText} numberOfLines={2}>
          {summaryText}
        </Text>
        {result.remainderPerSide > 0 && (
          <Text style={styles.remainderText}>
            {isUk
              ? `≈ ${result.achievableTotal} ${unit === 'lbs' ? 'lb' : 'кг'}`
              : `≈ ${result.achievableTotal} ${unit}`}
          </Text>
        )}
      </View>
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
      paddingVertical: 3,
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
      height: 40,
      paddingHorizontal: 4,
    },
    shaft: {
      width: 46,
      height: 6,
      borderTopLeftRadius: 3,
      borderBottomLeftRadius: 3,
      backgroundColor: colors.isDark ? '#4B5563' : '#94A3B8',
    },
    collar: {
      width: 7,
      height: 18,
      borderRadius: 2,
      backgroundColor: colors.isDark ? '#6B7280' : '#64748B',
    },
    sleeveWrap: {
      flex: 1,
      height: 40,
      justifyContent: 'center',
      position: 'relative',
    },
    sleeveBar: {
      position: 'absolute',
      left: 0,
      right: 10,
      height: 10,
      borderTopRightRadius: 3,
      borderBottomRightRadius: 3,
      backgroundColor: colors.isDark ? '#374151' : '#CBD5E1',
    },
    platesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2.5,
      paddingLeft: 3,
      zIndex: 1,
    },
    plateBlock: {
      borderRadius: 2.5,
      borderWidth: 0.5,
      borderColor: 'rgba(0,0,0,0.28)',
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
      color: colors.text,
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { PlateCalculatorBar } from '@/components/workout/PlateCalculatorBar';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import {
  inferEquipmentFromName,
  isBarbellExercise,
  isPerHandExercise,
} from '@/lib/adaptiveProgression';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import type { EquipmentId } from '@/lib/programGenerator';
import { resolveSavedSetWeightKg } from '@/lib/weightUtils';

export interface WorkoutKeypadSheetProps {
  visible: boolean;
  exerciseName: string;
  canonicalExerciseName?: string;
  equipment?: EquipmentId;
  setNumber: number;
  totalSets: number;
  isCompleted: boolean;
  initialWeightKg: number;
  initialReps: number;
  initialRir?: number;
  unitLabel: string;
  unit: 'kg' | 'lbs';
  fromKg: (val: number) => number;
  initialFocusField?: 'weight' | 'reps';
  onClose: () => void;
  onSave: (values: { weight: number; reps: number; rir?: number | null }) => void;
  /** Optional 1-tap "Log Set ✓" action that updates values AND marks the set completed */
  onSaveAndComplete?: (values: { weight: number; reps: number; rir?: number | null }) => void;
}

function getSmartWeightSteppers(
  equipment: EquipmentId,
  canonicalName: string,
  unit: 'kg' | 'lbs'
): number[] {
  const lower = canonicalName.toLowerCase();
  const isIsolationOrCable =
    lower.includes('cable') ||
    lower.includes('lateral') ||
    lower.includes('fly') ||
    lower.includes('curl') ||
    lower.includes('pushdown') ||
    lower.includes('extension') ||
    lower.includes('rear delt');

  if (unit === 'lbs') {
    if (equipment === 'dumbbells' || isIsolationOrCable) {
      return [-5, -2.5, 2.5, 5];
    }
    return [-10, -5, 5, 10];
  }

  if (equipment === 'dumbbells') {
    return [-2, -1, 1, 2];
  }
  if (isIsolationOrCable) {
    return [-2.5, -1.25, 1.25, 2.5];
  }
  return [-5, -2.5, 2.5, 5];
}

/**
 * Custom Docked Gym Numpad (ZERO OS Keyboard!).
 * Opens in <16ms on the native BottomSheet, supports fresh-digit overwrite,
 * equipment-smart quick steppers, inline RIR strip, barbell-only plate visualizer,
 * and 1-tap "Log Set ✓".
 */
export function WorkoutKeypadSheet({
  visible,
  exerciseName,
  canonicalExerciseName,
  equipment,
  setNumber,
  totalSets,
  isCompleted,
  initialWeightKg,
  initialReps,
  initialRir,
  unitLabel,
  unit,
  fromKg,
  initialFocusField = 'weight',
  onClose,
  onSave,
  onSaveAndComplete,
}: WorkoutKeypadSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { language } = useI18n();
  const isUk = language === 'uk';

  const detectionName = canonicalExerciseName || exerciseName;
  const resolvedEquipment = useMemo(
    () => equipment || inferEquipmentFromName(detectionName),
    [equipment, detectionName]
  );
  const isBarbell = useMemo(
    () => isBarbellExercise(detectionName, resolvedEquipment),
    [detectionName, resolvedEquipment]
  );
  const isPerHand = useMemo(
    () => isPerHandExercise(detectionName, resolvedEquipment),
    [detectionName, resolvedEquipment]
  );

  const [focusedField, setFocusedField] = useState<'weight' | 'reps'>(initialFocusField);
  const [weightText, setWeightText] = useState('0');
  const [repsText, setRepsText] = useState('8');
  const [selectedRir, setSelectedRir] = useState<number | null>(initialRir ?? null);
  const [showPlateCalc, setShowPlateCalc] = useState(false);

  const weightDirtyRef = useRef(false);
  const freshFieldEntryRef = useRef(true);

  useEffect(() => {
    if (visible) {
      weightDirtyRef.current = false;
      freshFieldEntryRef.current = true;
      const displayW = fromKg(initialWeightKg ?? 0);
      const roundedDisplay = Math.round(displayW * 100) / 100;
      setWeightText(roundedDisplay > 0 ? String(roundedDisplay) : '0');
      setRepsText(String(Math.max(1, initialReps ?? 8)));
      setSelectedRir(initialRir ?? null);
      setFocusedField(initialFocusField);
      setShowPlateCalc(false);
    }
  }, [visible, initialWeightKg, initialReps, initialRir, fromKg, initialFocusField]);

  const parsedDisplayWeight = useMemo(() => {
    const n = parseFloat(weightText.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [weightText]);

  const weightSteppers = useMemo(
    () => getSmartWeightSteppers(resolvedEquipment, detectionName, unit),
    [resolvedEquipment, detectionName, unit]
  );
  const activeSteppers = focusedField === 'weight' ? weightSteppers : [-2, -1, 1, 2];

  const handleSwitchField = (field: 'weight' | 'reps') => {
    if (field === focusedField) return;
    hapticLight();
    setFocusedField(field);
    freshFieldEntryRef.current = true;
  };

  const handlePressKey = (key: string) => {
    hapticLight();
    if (focusedField === 'weight') {
      weightDirtyRef.current = true;
      if (key === 'BACK') {
        freshFieldEntryRef.current = false;
        setWeightText((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
        return;
      }
      if (key === '.') {
        if (freshFieldEntryRef.current) {
          freshFieldEntryRef.current = false;
          setWeightText('0.');
          return;
        }
        setWeightText((prev) => (prev.includes('.') ? prev : `${prev}.`));
        return;
      }
      // Digit 0..9
      if (freshFieldEntryRef.current) {
        freshFieldEntryRef.current = false;
        setWeightText(key);
        return;
      }
      setWeightText((prev) => {
        const base = prev === '0' ? key : `${prev}${key}`;
        const parts = base.split('.');
        if (parts[1] && parts[1].length > 2) return prev;
        const parsed = parseFloat(base);
        if (!isNaN(parsed) && parsed > 999.5) return '999.5';
        return base;
      });
    } else {
      // Reps field (integers only)
      if (key === '.') return;
      if (key === 'BACK') {
        freshFieldEntryRef.current = false;
        setRepsText((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
        return;
      }
      if (freshFieldEntryRef.current) {
        freshFieldEntryRef.current = false;
        setRepsText(key === '0' ? '1' : key);
        return;
      }
      setRepsText((prev) => {
        const base = prev === '0' ? key : `${prev}${key}`;
        const parsed = parseInt(base, 10);
        if (!isNaN(parsed) && parsed > 200) return '200';
        return base;
      });
    }
  };

  const handleQuickDelta = (delta: number) => {
    hapticLight();
    freshFieldEntryRef.current = false;
    if (focusedField === 'weight') {
      weightDirtyRef.current = true;
      const curr = parseFloat(weightText.replace(',', '.')) || 0;
      const next = Math.max(0, Math.min(999.5, Math.round((curr + delta) * 100) / 100));
      setWeightText(String(next));
    } else {
      const curr = parseInt(repsText, 10) || 0;
      const next = Math.max(1, Math.min(200, curr + delta));
      setRepsText(String(next));
    }
  };

  const buildPayload = () => {
    const safeKg = resolveSavedSetWeightKg({
      initialWeightKg,
      weightText,
      weightDirty: weightDirtyRef.current,
      unit,
    });
    const parsedR = parseInt(repsText, 10);
    const safeReps = !isNaN(parsedR) && parsedR >= 1 ? Math.min(200, parsedR) : Math.max(1, initialReps || 8);
    return {
      weight: safeKg,
      reps: safeReps,
      rir: selectedRir,
    };
  };

  const handleUpdateOnly = () => {
    hapticMedium();
    onSave(buildPayload());
    onClose();
  };

  const handleSaveAndLog = () => {
    if (onSaveAndComplete && !isCompleted) {
      hapticSuccess();
      onSaveAndComplete(buildPayload());
      onClose();
      return;
    }
    handleUpdateOnly();
  };

  const showDualActions = Boolean(onSaveAndComplete && !isCompleted);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      avoidKeyboard={false}
      maxHeight="90%"
    >
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.sheetInner}
      >
        {/* 1. Compact Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.metaRow}>
              <Text style={styles.kicker}>
                {isUk
                  ? `ПІДХІД ${setNumber} / ${totalSets}`
                  : `SET ${setNumber} / ${totalSets}`}
              </Text>
              {isCompleted && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark" size={11} color={colors.onPrimary} />
                  <Text style={styles.completedBadgeText}>
                    {isUk ? 'ВИКОНАНО' : 'DONE'}
                  </Text>
                </View>
              )}
              {isPerHand && (
                <View style={styles.perHandBadge}>
                  <Text style={styles.perHandBadgeText}>
                    {isUk ? 'Вага 1 гантелі' : 'Per hand'}
                  </Text>
                </View>
              )}
            </View>
            <Text numberOfLines={1} style={styles.exerciseTitle}>
              {exerciseName}
            </Text>
          </View>

          <View style={styles.headerRight}>
            {isBarbell && parsedDisplayWeight > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isUk ? 'Калькулятор млинців' : 'Plate calculator'}
                onPress={() => {
                  hapticLight();
                  setShowPlateCalc((prev) => !prev);
                }}
                style={[styles.plateBtn, showPlateCalc && styles.plateBtnActive]}
              >
                <Ionicons
                  name="disc-outline"
                  size={14}
                  color={showPlateCalc ? colors.activeChipText : colors.secondary}
                />
                <Text style={[styles.plateBtnText, showPlateCalc && styles.plateBtnTextActive]}>
                  {isUk ? 'Млинці' : 'Plates'}
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close keypad"
              hitSlop={10}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={19} color={colors.secondary} />
            </Pressable>
          </View>
        </View>

        {/* 2. Optional Barbell Plate Visualizer */}
        {isBarbell && showPlateCalc && parsedDisplayWeight > 0 && (
          <PlateCalculatorBar
            targetDisplayWeight={parsedDisplayWeight}
            unit={unit}
            exerciseName={exerciseName}
            canonicalExerciseName={canonicalExerciseName}
            isUk={isUk}
          />
        )}

        {/* 3. Dual Focus Display Cells (Zero OS TextInput!) */}
        <View style={styles.displayRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUk ? `Вага ${weightText} ${unitLabel}` : `Weight ${weightText} ${unitLabel}`}
            onPress={() => handleSwitchField('weight')}
            style={[
              styles.displayBox,
              focusedField === 'weight' && styles.displayBoxFocused,
            ]}
          >
            <Text
              style={[
                styles.displayLabel,
                focusedField === 'weight' && styles.displayLabelFocused,
              ]}
            >
              {isUk ? `ВАГА (${unitLabel.toUpperCase()})` : `WEIGHT (${unitLabel.toUpperCase()})`}
            </Text>
            <Text numberOfLines={1} style={styles.displayValue}>
              {weightText}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUk ? `Повторення ${repsText}` : `Reps ${repsText}`}
            onPress={() => handleSwitchField('reps')}
            style={[
              styles.displayBox,
              focusedField === 'reps' && styles.displayBoxFocused,
            ]}
          >
            <Text
              style={[
                styles.displayLabel,
                focusedField === 'reps' && styles.displayLabelFocused,
              ]}
            >
              {isUk ? 'ПОВТОРЕННЯ' : 'REPS'}
            </Text>
            <Text numberOfLines={1} style={styles.displayValue}>
              {repsText}
            </Text>
          </Pressable>
        </View>

        {/* 4. Equipment-Smart Quick Delta Steppers */}
        <View style={styles.steppersRow}>
          {activeSteppers.map((delta) => (
            <Pressable
              key={`${focusedField}-${delta}`}
              accessibilityRole="button"
              onPress={() => handleQuickDelta(delta)}
              style={({ pressed }) => [styles.stepperChip, pressed && { opacity: 0.72 }]}
            >
              <Text style={styles.stepperChipText}>
                {delta > 0 ? `+${delta}` : String(delta)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 5. Inline RIR (Reps in Reserve) Strip */}
        <View style={styles.rirRow}>
          <Text style={styles.rirLabel}>RIR</Text>
          <View style={styles.rirPillsWrap}>
            {[
              { val: 0, label: isUk ? '0 Відм.' : '0 Fail' },
              { val: 1, label: '1' },
              { val: 2, label: '2' },
              { val: 3, label: '3+' },
            ].map((item) => {
              const active = selectedRir === item.val;
              return (
                <Pressable
                  key={item.val}
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    setSelectedRir((prev) => (prev === item.val ? null : item.val));
                  }}
                  style={[styles.rirPill, active && styles.rirPillActive]}
                >
                  <Text style={[styles.rirPillText, active && styles.rirPillTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 6. Tactile 3x4 Gym Numpad */}
        <View style={styles.numpadGrid}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['.', '0', 'BACK'],
          ].map((row, rIdx) => (
            <View key={`row-${rIdx}`} style={styles.numpadRow}>
              {row.map((key) => {
                const isDecimalDisabled = key === '.' && focusedField === 'reps';
                return (
                  <Pressable
                    key={key}
                    disabled={isDecimalDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={key === 'BACK' ? 'Backspace' : key}
                    onPress={() => handlePressKey(key)}
                    style={({ pressed }) => [
                      styles.numpadKey,
                      isDecimalDisabled && { opacity: 0.28 },
                      pressed && !isDecimalDisabled && styles.numpadKeyPressed,
                    ]}
                  >
                    {key === 'BACK' ? (
                      <Ionicons name="backspace-outline" size={21} color={colors.text} />
                    ) : (
                      <Text style={styles.numpadKeyText}>{key}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* 7. Action Footer */}
        <View style={styles.actionsRow}>
          {showDualActions ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={handleUpdateOnly}
                style={({ pressed }) => [styles.secondarySaveBtn, pressed && { opacity: 0.78 }]}
              >
                <Text style={styles.secondarySaveText}>
                  {isUk ? 'Оновити' : 'Update'}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleSaveAndLog}
                style={({ pressed }) => [styles.primarySaveBtn, { flex: 1.55 }, pressed && { opacity: 0.88 }]}
              >
                <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
                <Text style={styles.primarySaveText}>
                  {isUk ? 'Записати сет' : 'Log Set'}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={handleUpdateOnly}
              style={({ pressed }) => [styles.primarySaveBtn, { flex: 1 }, pressed && { opacity: 0.88 }]}
            >
              <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
              <Text style={styles.primarySaveText}>
                {isUk ? 'Зберегти підхід' : 'Save Set'}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sheetInner: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 14,
      gap: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 2,
    },
    kicker: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 11,
      color: colors.muted,
      letterSpacing: 0.6,
      includeFontPadding: false,
    },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 5,
    },
    completedBadgeText: {
      fontFamily: fonts.bold,
      fontSize: 10,
      color: colors.onPrimary,
      includeFontPadding: false,
    },
    perHandBadge: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 5,
    },
    perHandBadgeText: {
      fontFamily: fonts.semiBold,
      fontSize: 10.5,
      color: colors.primaryText,
      includeFontPadding: false,
    },
    exerciseTitle: {
      fontFamily: fonts.bold,
      fontSize: 16,
      lineHeight: 21,
      color: colors.text,
      letterSpacing: -0.25,
      includeFontPadding: false,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    plateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      height: 34,
      borderRadius: radii.pill,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    plateBtnActive: {
      backgroundColor: colors.activeChipBg,
      borderColor: colors.activeChipBg,
    },
    plateBtnText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      color: colors.secondary,
      includeFontPadding: false,
    },
    plateBtnTextActive: {
      fontFamily: fonts.bold,
      color: colors.activeChipText,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    displayRow: {
      flexDirection: 'row',
      gap: 10,
    },
    displayBox: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    displayBoxFocused: {
      borderColor: colors.accentLine,
      backgroundColor: colors.activeRowBg,
    },
    displayLabel: {
      fontFamily: fonts.bold,
      fontSize: 10.5,
      letterSpacing: 0.7,
      color: colors.muted,
      marginBottom: 2,
      includeFontPadding: false,
    },
    displayLabelFocused: {
      color: colors.primaryText,
    },
    displayValue: {
      fontFamily: fonts.monoBold,
      fontSize: 24,
      lineHeight: 30,
      color: colors.text,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    steppersRow: {
      flexDirection: 'row',
      gap: 8,
    },
    stepperChip: {
      flex: 1,
      height: 36,
      borderRadius: radii.sm,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperChipText: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 13,
      color: colors.text,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    rirRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rirLabel: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 11,
      color: colors.muted,
      width: 28,
      includeFontPadding: false,
    },
    rirPillsWrap: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
    },
    rirPill: {
      flex: 1,
      height: 32,
      borderRadius: radii.xs + 2,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rirPillActive: {
      backgroundColor: colors.activeChipBg,
      borderColor: colors.activeChipBg,
    },
    rirPillText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      color: colors.secondary,
      includeFontPadding: false,
    },
    rirPillTextActive: {
      fontFamily: fonts.bold,
      color: colors.activeChipText,
    },
    numpadGrid: {
      gap: 6,
    },
    numpadRow: {
      flexDirection: 'row',
      gap: 6,
    },
    numpadKey: {
      flex: 1,
      height: 46,
      borderRadius: radii.sm + 2,
      backgroundColor: colors.elevated,
      borderTopWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    numpadKeyPressed: {
      backgroundColor: colors.border,
    },
    numpadKeyText: {
      fontFamily: fonts.monoBold,
      fontSize: 20,
      lineHeight: 24,
      color: colors.text,
      includeFontPadding: false,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 2,
    },
    secondarySaveBtn: {
      flex: 1,
      height: 48,
      borderRadius: radii.md,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondarySaveText: {
      fontFamily: fonts.semiBold,
      fontSize: 14,
      color: colors.text,
      includeFontPadding: false,
    },
    primarySaveBtn: {
      height: 48,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    primarySaveText: {
      fontFamily: fonts.bold,
      fontSize: 15,
      color: colors.onPrimary,
      includeFontPadding: false,
    },
  });

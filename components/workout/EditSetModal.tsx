import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlateCalculatorBar } from '@/components/workout/PlateCalculatorBar';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { isBarbellExercise, isPerHandExercise } from '@/lib/adaptiveProgression';
import type { EquipmentId } from '@/lib/programGenerator';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';

interface EditSetModalProps {
  visible: boolean;
  exerciseName: string;
  equipment?: EquipmentId;
  setNumber: number;
  totalSets: number;
  isCompleted: boolean;
  initialWeightKg: number;
  initialReps: number;
  initialRir?: number;
  unitLabel: string;
  unit: 'kg' | 'lbs';
  toKg: (val: number) => number;
  fromKg: (val: number) => number;
  onClose: () => void;
  onSave: (values: { weight: number; reps: number; rir?: number | null }) => void;
  initialFocusField?: 'weight' | 'reps';
}

export function EditSetModal({
  visible,
  exerciseName,
  equipment,
  setNumber,
  totalSets,
  isCompleted,
  initialWeightKg,
  initialReps,
  initialRir,
  unitLabel,
  unit,
  toKg,
  fromKg,
  onClose,
  onSave,
  initialFocusField = 'weight',
}: EditSetModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { language } = useI18n();
  const isUk = language === 'uk';

  const [weightText, setWeightText] = useState('');
  const [repsText, setRepsText] = useState('');
  const [selectedRir, setSelectedRir] = useState<number | null>(initialRir ?? null);

  const isBarbell = useMemo(
    () => isBarbellExercise(exerciseName, equipment),
    [exerciseName, equipment]
  );
  const isPerHand = useMemo(
    () => isPerHandExercise(exerciseName, equipment),
    [exerciseName, equipment]
  );
  const [showPlateCalc, setShowPlateCalc] = useState(false);

  const parsedDisplayWeight = useMemo(() => {
    const n = parseFloat(weightText.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [weightText]);

  const weightInputRef = useRef<TextInputInstance>(null);
  const repsInputRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (visible) {
      const displayW = fromKg(initialWeightKg ?? 0);
      setWeightText(displayW > 0 ? String(Math.round(displayW * 10) / 10) : '0');
      setRepsText(String(initialReps ?? 8));
      setSelectedRir(initialRir ?? null);
      setShowPlateCalc(isBarbell);

      // Auto-focus after modal transition
      const timer = setTimeout(() => {
        if (initialFocusField === 'reps') {
          repsInputRef.current?.focus();
        } else {
          weightInputRef.current?.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible, initialWeightKg, initialReps, initialRir, fromKg, initialFocusField, isBarbell]);

  const adjustWeightDelta = (delta: number) => {
    hapticLight();
    const curr = parseFloat(weightText.replace(',', '.')) || 0;
    const next = Math.max(0, Math.min(999.5, Math.round((curr + delta) * 10) / 10));
    setWeightText(String(next));
  };

  const adjustRepsDelta = (delta: number) => {
    hapticLight();
    const curr = parseInt(repsText, 10) || 0;
    const next = Math.max(1, Math.min(200, curr + delta));
    setRepsText(String(next));
  };

  const handleSave = () => {
    hapticMedium();
    const parsedW = parseFloat(weightText.replace(',', '.'));
    const safeDisplayW = !isNaN(parsedW) && parsedW >= 0 ? Math.min(999.5, parsedW) : fromKg(initialWeightKg);
    const safeKg = toKg(safeDisplayW);

    const parsedR = parseInt(repsText, 10);
    const safeReps = !isNaN(parsedR) && parsedR >= 1 ? Math.min(200, parsedR) : initialReps;

    onSave({
      weight: Math.round(safeKg * 100) / 100,
      reps: safeReps,
      rir: selectedRir,
    });
    onClose();
  };

  const weightChips = unit === 'lbs' ? [-5, -2.5, 2.5, 5] : [-5, -2.5, 2.5, 5];
  const repsChips = [-2, -1, 1, 2];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.metaRow}>
                <Text style={styles.kicker}>
                  {isUk
                    ? `ПІДХІД ${setNumber} З ${totalSets}`
                    : `SET ${setNumber} OF ${totalSets}`}
                </Text>
                {isCompleted && (
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark" size={11} color="#0B0D0F" style={{ marginRight: 2 }} />
                    <Text style={styles.completedBadgeText}>
                      {isUk ? 'ВИКОНАНО' : 'COMPLETED'}
                    </Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} style={styles.exerciseTitle}>
                {exerciseName}
              </Text>
              {isPerHand && (
                <Text style={styles.perHandHint}>
                  {isUk
                    ? 'Вводьте вагу однієї гантелі / на 1 руку'
                    : 'Enter weight for one dumbbell / per hand'}
                </Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {parsedDisplayWeight > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Toggle plate calculator"
                  onPress={() => {
                    hapticLight();
                    setShowPlateCalc((prev) => !prev);
                  }}
                  style={[styles.plateToggleBtn, showPlateCalc && styles.plateToggleBtnActive]}
                >
                  <Ionicons
                    name="disc-outline"
                    size={14}
                    color={showPlateCalc ? colors.activeChipText : colors.secondary}
                  />
                  <Text
                    style={[
                      styles.plateToggleText,
                      showPlateCalc && styles.plateToggleTextActive,
                    ]}
                  >
                    {isUk ? 'Млинці' : 'Plates'}
                  </Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
                onPress={onClose}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={colors.secondary} />
              </Pressable>
            </View>
          </View>

          {/* Input Cards Grid */}
          <View style={styles.inputsRow}>
            {/* Weight Input Box */}
            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>
                {isUk ? `ВАГА (${unitLabel.toUpperCase()})` : `WEIGHT (${unitLabel.toUpperCase()})`}
              </Text>
              <TextInput
                ref={weightInputRef}
                style={styles.textInput}
                keyboardType="decimal-pad"
                value={weightText}
                onChangeText={(val) => {
                  const num = parseFloat(val.replace(',', '.'));
                  if (!isNaN(num) && num > 999.5) setWeightText('999.5');
                  else setWeightText(val);
                }}
                maxLength={6}
                placeholder="0"
                placeholderTextColor="#5A6472"
                selectTextOnFocus
              />
              {/* Micro-chips for quick delta */}
              <View style={styles.chipsRow}>
                {weightChips.map((delta) => (
                  <Pressable
                    key={`w-${delta}`}
                    hitSlop={4}
                    onPress={() => adjustWeightDelta(delta)}
                    style={styles.chipBtn}
                  >
                    <Text style={styles.chipText}>
                      {delta > 0 ? `+${delta}` : delta}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Reps Input Box */}
            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>
                {isUk ? 'ПОВТОРЕННЯ' : 'REPS'}
              </Text>
              <TextInput
                ref={repsInputRef}
                style={styles.textInput}
                keyboardType="number-pad"
                value={repsText}
                onChangeText={(val) => {
                  const num = parseInt(val, 10);
                  if (!isNaN(num) && num > 200) setRepsText('200');
                  else setRepsText(val);
                }}
                maxLength={3}
                placeholder="8"
                placeholderTextColor="#5A6472"
                selectTextOnFocus
              />
              {/* Micro-chips for quick delta */}
              <View style={styles.chipsRow}>
                {repsChips.map((delta) => (
                  <Pressable
                    key={`r-${delta}`}
                    hitSlop={4}
                    onPress={() => adjustRepsDelta(delta)}
                    style={styles.chipBtn}
                  >
                    <Text style={styles.chipText}>
                      {delta > 0 ? `+${delta}` : delta}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Barbell Plate Calculator Visualizer */}
          {showPlateCalc && parsedDisplayWeight > 0 && (
            <PlateCalculatorBar
              targetDisplayWeight={parsedDisplayWeight}
              unit={unit}
              exerciseName={exerciseName}
              isUk={isUk}
            />
          )}

          {/* RIR (Reps in Reserve) Selector */}
          <View style={styles.rirSection}>
            <View style={styles.rirHeaderRow}>
              <Text style={styles.rirTitle}>
                {isUk ? 'ЗАПАС ПОВТОРЕНЬ (RIR)' : 'REPS IN RESERVE (RIR)'}
              </Text>
              <Text style={styles.rirSubtitle}>
                {selectedRir === undefined || selectedRir === null
                  ? (isUk ? 'Не вказано' : 'Not set')
                  : selectedRir === 0
                    ? (isUk ? '0 — До відмови ⚡' : '0 — True failure ⚡')
                    : selectedRir === 1
                      ? (isUk ? '1 — Ще одне повт.' : '1 rep in reserve')
                      : selectedRir === 2
                        ? (isUk ? '2 — Оптимально 🔥' : '2 reps (hypertrophy)')
                        : (isUk ? '3+ — Легкий сет' : '3+ reps in reserve')}
              </Text>
            </View>

            <View style={styles.rirChipsRow}>
              {[
                { val: 0, label: isUk ? '0 Відм.' : '0 Fail' },
                { val: 1, label: '1 RIR' },
                { val: 2, label: '2 RIR' },
                { val: 3, label: '3+ RIR' },
              ].map((item) => {
                const active = selectedRir === item.val;
                return (
                  <Pressable
                    key={`rir-${item.val}`}
                    onPress={() => {
                      hapticLight();
                      setSelectedRir((prev) => (prev === item.val ? null : item.val));
                    }}
                    style={[styles.rirChip, active && styles.rirChipActive]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.rirChipText, active && styles.rirChipTextActive]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onClose}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>
                {isUk ? 'Скасувати' : 'Cancel'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save"
              onPress={handleSave}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>
                {isUk ? 'Зберегти' : 'Save'}
              </Text>
            </Pressable>
          </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
    letterSpacing: 0.5,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  completedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onPrimary,
    letterSpacing: 0.4,
  },
  exerciseTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  perHandHint: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    fontWeight: '500',
    color: colors.primaryText,
    marginTop: 2,
  },
  plateToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plateToggleBtnActive: {
    backgroundColor: colors.activeChipBg,
    borderColor: colors.activeChipBg,
  },
  plateToggleText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
  },
  plateToggleTextActive: {
    fontFamily: fonts.bold,
    color: colors.activeChipText,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  inputBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  textInput: {
    width: '100%',
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.primaryText,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: 4,
  },
  chipBtn: {
    flex: 1,
    backgroundColor: colors.elevated,
    paddingHorizontal: 2,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: fonts.bold,
    color: colors.text,
    fontSize: 10.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rirSection: {
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  rirHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rirTitle: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  rirSubtitle: {
    color: colors.primaryText,
    fontSize: 11,
    fontWeight: '700',
  },
  rirChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  rirChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rirChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rirChipText: {
    color: colors.secondary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  rirChipTextActive: {
    color: colors.onPrimary,
    fontWeight: '900',
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});

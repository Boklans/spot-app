import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';

interface EditSetModalProps {
  visible: boolean;
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  isCompleted: boolean;
  initialWeightKg: number;
  initialReps: number;
  unitLabel: string;
  unit: 'kg' | 'lbs';
  toKg: (val: number) => number;
  fromKg: (val: number) => number;
  onClose: () => void;
  onSave: (values: { weight: number; reps: number }) => void;
  initialFocusField?: 'weight' | 'reps';
}

export function EditSetModal({
  visible,
  exerciseName,
  setNumber,
  totalSets,
  isCompleted,
  initialWeightKg,
  initialReps,
  unitLabel,
  unit,
  toKg,
  fromKg,
  onClose,
  onSave,
  initialFocusField = 'weight',
}: EditSetModalProps) {
  const { language } = useI18n();
  const isUk = language === 'uk';

  const [weightText, setWeightText] = useState('');
  const [repsText, setRepsText] = useState('');

  const weightInputRef = useRef<TextInputInstance>(null);
  const repsInputRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (visible) {
      const displayW = fromKg(initialWeightKg ?? 0);
      setWeightText(displayW > 0 ? String(Math.round(displayW * 10) / 10) : '0');
      setRepsText(String(initialReps ?? 8));

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
  }, [visible, initialWeightKg, initialReps, fromKg, initialFocusField]);

  const adjustWeightDelta = (delta: number) => {
    hapticLight();
    const curr = parseFloat(weightText.replace(',', '.')) || 0;
    const next = Math.max(0, Math.round((curr + delta) * 10) / 10);
    setWeightText(String(next));
  };

  const adjustRepsDelta = (delta: number) => {
    hapticLight();
    const curr = parseInt(repsText, 10) || 0;
    const next = Math.max(1, Math.min(500, curr + delta));
    setRepsText(String(next));
  };

  const handleSave = () => {
    hapticMedium();
    const parsedW = parseFloat(weightText.replace(',', '.'));
    const safeDisplayW = !isNaN(parsedW) && parsedW >= 0 ? Math.min(999, parsedW) : fromKg(initialWeightKg);
    const safeKg = toKg(safeDisplayW);

    const parsedR = parseInt(repsText, 10);
    const safeReps = !isNaN(parsedR) && parsedR >= 1 ? Math.min(500, parsedR) : initialReps;

    onSave({
      weight: Math.round(safeKg * 100) / 100,
      reps: safeReps,
    });
    onClose();
  };

  const weightChips = unit === 'lbs' ? [-5, -1, 1, 5] : [-2.5, -0.5, 0.5, 2.5];
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
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color="#8E99A8" />
            </Pressable>
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
                onChangeText={setWeightText}
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
                onChangeText={setRepsText}
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#15191F',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#242B35',
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
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
    color: '#8E99A8',
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
    color: '#0B0D0F',
    letterSpacing: 0.4,
  },
  exerciseTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C222B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  inputBox: {
    flex: 1,
    backgroundColor: '#0E1116',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#242B35',
    padding: 12,
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E99A8',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  textInput: {
    width: '100%',
    height: 48,
    backgroundColor: '#181E27',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  chipBtn: {
    backgroundColor: '#202836',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#202836',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#8E99A8',
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
    color: '#0B0D0F',
    fontSize: 15,
    fontWeight: '800',
  },
});

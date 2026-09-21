import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import {
  ITEM_HEIGHT,
  PADDING_COUNT,
  PICKER_HEIGHT,
  WheelPicker,
} from '@/components/ui/WheelPicker';

// ─── Data sets ───────────────────────────────────────────────────────────────

const BASE_REPS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 25, 30, 40, 50, 75, 100,
];

const BASE_REST_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300];

function formatRestLabel(sec: number): string {
  const mins = Math.floor(sec / 60);
  const remaining = sec % 60;
  if (mins === 0) return `${sec}s`;
  if (remaining === 0) return `${mins}m`;
  return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Input() {
  const { t, language } = useI18n();
  const { unit, unitLabel, toKg, fromKg } = useWeightUnit();
  const session = useWorkoutSessionStore((state) => state.session);
  const updateCurrentSet = useWorkoutSessionStore((state) => state.updateCurrentSet);
  const updateExerciseRest = useWorkoutSessionStore((state) => state.updateExerciseRest);

  // Custom-entry modals
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [customWeightText, setCustomWeightText] = useState('');
  const [repsModalVisible, setRepsModalVisible] = useState(false);
  const [customRepsText, setCustomRepsText] = useState('');
  const [restModalVisible, setRestModalVisible] = useState(false);
  const [customRestText, setCustomRestText] = useState('');

  const exercise = session?.exercises[session.currentExerciseIndex];
  const activeSet = exercise?.sets[session?.currentSetIndex ?? 0];
  const increment =
    typeof exercise?.weightIncrement === 'number' && exercise.weightIncrement > 0
      ? exercise.weightIncrement
      : 2.5;

  const currentWeightKg = activeSet?.weight ?? 0;
  const currentReps = activeSet?.reps ?? 8;
  const currentRestSeconds = exercise?.restSeconds ?? 90;
  const currentDisplayWeight = fromKg(currentWeightKg);

  const weightStep = unit === 'lbs' ? 5 : (increment ?? 2.5);
  const maxWeight = unit === 'lbs' ? 660 : 300;

  // Stable base list that only recomputes when unit or step changes
  const baseWeightList = useMemo(() => {
    const list: number[] = [0];
    for (let w = weightStep; w <= maxWeight; w += weightStep) {
      list.push(Math.round(w * 10) / 10);
    }
    return list;
  }, [weightStep, maxWeight]);

  const [extraWeights, setExtraWeights] = useState<number[]>(() => {
    const rounded = Math.round(currentDisplayWeight * 10) / 10;
    if (rounded > 0 && rounded % weightStep !== 0) {
      return [rounded];
    }
    return [];
  });

  const weightList = useMemo(() => {
    if (extraWeights.length === 0) return baseWeightList;
    const combined = [...baseWeightList, ...extraWeights];
    return Array.from(new Set(combined)).sort((a, b) => a - b);
  }, [baseWeightList, extraWeights]);

  const repsList = useMemo(() => {
    if (!BASE_REPS.includes(currentReps) && currentReps >= 1 && currentReps <= 1000) {
      return [...BASE_REPS, currentReps].sort((a, b) => a - b);
    }
    return BASE_REPS;
  }, [currentReps]);

  const restList = useMemo(() => {
    if (!BASE_REST_OPTIONS.includes(currentRestSeconds)) {
      return [...BASE_REST_OPTIONS, currentRestSeconds].sort((a, b) => a - b);
    }
    return BASE_REST_OPTIONS;
  }, [currentRestSeconds]);

  // ─── Guard ───────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{t('noActiveWorkout')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(tabs)')}
            style={styles.emptyBtn}
          >
            <Text style={styles.emptyBtnText}>{t('backToHome')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleSelectWeight = (displayVal: number) => {
    const kg = toKg(Math.max(0, displayVal));
    updateCurrentSet({ weight: Math.round(kg * 100) / 100 });
  };

  const handleSelectReps = (r: number) => {
    const bounded = Math.min(1000, Math.max(1, r));
    updateCurrentSet({ reps: bounded });
  };

  const handleSelectRest = (sec: number) => {
    const bounded = Math.min(600, Math.max(10, sec));
    updateExerciseRest(session.currentExerciseIndex, bounded);
  };

  const handleSaveCustomWeight = () => {
    const parsed = parseFloat(customWeightText.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 999) {
      const rounded = Math.round(parsed * 10) / 10;
      if (!weightList.includes(rounded)) {
        setExtraWeights((prev) => [...prev, rounded]);
      }
      handleSelectWeight(rounded);
    }
    setWeightModalVisible(false);
  };

  const handleSaveCustomReps = () => {
    const parsed = parseInt(customRepsText, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 1000) handleSelectReps(parsed);
    setRepsModalVisible(false);
  };

  const handleSaveCustomRest = () => {
    const parsed = parseInt(customRestText, 10);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 600) handleSelectRest(parsed);
    setRestModalVisible(false);
  };

  const handleDone = () => {
    hapticMedium();
    router.back();
  };

  const isUk = language === 'uk';

  // Find exact or nearest value in weightList
  const pickerWeight = useMemo(() => {
    const rounded = Math.round(currentDisplayWeight * 10) / 10;
    const exact = weightList.find((w) => Math.abs(w - rounded) < 0.05);
    if (exact !== undefined) return exact;

    let closest = weightList[0];
    let minDiff = Math.abs(closest - rounded);
    for (const w of weightList) {
      const diff = Math.abs(w - rounded);
      if (diff < minDiff) {
        minDiff = diff;
        closest = w;
      }
    }
    return closest;
  }, [weightList, currentDisplayWeight]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Navigation Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.topBarTitle}>
          {t('setOf')} {session.currentSetIndex + 1} {t('of')} {exercise?.sets.length ?? 3}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={handleDone}
          style={styles.topDoneBtn}
        >
          <Text style={styles.topDoneBtnText}>{isUk ? 'ГОТОВО' : 'DONE'}</Text>
        </Pressable>
      </View>

      {/* 2. Vertically Centered Pickers Section */}
      <View style={styles.centerContainer}>
        {/* Column Headers */}
        <View style={styles.columnsHeaderRow}>
          <Text style={styles.columnHeaderLabel}>{isUk ? 'ВАГА' : 'WEIGHT'}</Text>
          <Text style={styles.columnHeaderLabel}>{isUk ? 'ПОВТОРИ' : 'REPS'}</Text>
          <Text style={styles.columnHeaderLabel}>{isUk ? 'ВІДПОЧИНОК' : 'REST'}</Text>
        </View>

        {/* Cohesive Wheel Container with Single Horizontal Highlight Bar */}
        <View style={styles.pickersFrame}>
          {/* Subtle Shared Highlight Bar across all 3 columns */}
          <View style={styles.sharedHighlightBar} pointerEvents="none" />

          {/* Seamless Top & Bottom Fades */}
          <View style={styles.sharedFadeTop} pointerEvents="none" />
          <View style={styles.sharedFadeBottom} pointerEvents="none" />

          <View style={styles.pickersColumnsRow}>
            {/* COLUMN 1: WEIGHT */}
            <View style={styles.pickerColumn}>
              <WheelPicker
                data={weightList}
                selectedValue={pickerWeight}
                onValueChange={handleSelectWeight}
                unit={unitLabel}
                formatLabel={(v) => (v === 0 ? (isUk ? 'ВВ' : 'BW') : formatWeight(v))}
                onActivePress={() => {
                  hapticLight();
                  setCustomWeightText(formatWeight(currentDisplayWeight));
                  setWeightModalVisible(true);
                }}
              />
            </View>

            <View style={styles.columnDivider} />

            {/* COLUMN 2: REPS */}
            <View style={styles.pickerColumn}>
              <WheelPicker
                data={repsList}
                selectedValue={currentReps}
                onValueChange={handleSelectReps}
                unit={isUk ? 'повт' : 'reps'}
                formatLabel={(v) => String(v)}
                onActivePress={() => {
                  hapticLight();
                  setCustomRepsText(String(currentReps));
                  setRepsModalVisible(true);
                }}
              />
            </View>

            <View style={styles.columnDivider} />

            {/* COLUMN 3: REST */}
            <View style={styles.pickerColumn}>
              <WheelPicker
                data={restList}
                selectedValue={currentRestSeconds}
                onValueChange={handleSelectRest}
                formatLabel={(v) => formatRestLabel(v)}
                onActivePress={() => {
                  hapticLight();
                  setCustomRestText(String(currentRestSeconds));
                  setRestModalVisible(true);
                }}
              />
            </View>
          </View>
        </View>

        {/* Minimalist Hint for Manual Numeric Entry */}
        <Text style={styles.hintText}>
          {isUk
            ? 'Торкніться значення для прямого вводу'
            : 'Tap center value for direct keypad input'}
        </Text>
      </View>

      {/* 3. Bottom Pinned Save Button */}
      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save and return"
          onPress={handleDone}
          style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.doneBtnText}>{isUk ? 'ЗБЕРЕГТИ' : 'SAVE'}</Text>
        </Pressable>
      </View>

      {/* ── Modal: Custom Weight ──────────────────────────────────────────── */}
      <Modal
        visible={weightModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWeightModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalHeaderTitle}>
              {isUk ? 'Введіть точну вагу' : 'Enter Exact Weight'}
            </Text>
            <Text style={styles.modalHeaderSubtitle}>
              {isUk ? `Одиниця: ${unitLabel}` : `Unit: ${unitLabel}`}
            </Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="decimal-pad"
              autoFocus
              value={customWeightText}
              onChangeText={setCustomWeightText}
              placeholder="0"
              placeholderTextColor="#5A6472"
              selectTextOnFocus
            />
            <View style={styles.modalActionsRow}>
              <Pressable onPress={() => setWeightModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelBtnText}>{isUk ? 'Скасувати' : 'Cancel'}</Text>
              </Pressable>
              <Pressable onPress={handleSaveCustomWeight} style={styles.modalSaveBtn}>
                <Text style={styles.modalSaveBtnText}>{isUk ? 'Зберегти' : 'Save'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Custom Reps ────────────────────────────────────────────── */}
      <Modal
        visible={repsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRepsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalHeaderTitle}>
              {isUk ? 'Кількість повторень' : 'Repetitions Count'}
            </Text>
            <Text style={styles.modalHeaderSubtitle}>
              {isUk ? 'Від 1 до 1000' : 'From 1 to 1000'}
            </Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              autoFocus
              value={customRepsText}
              onChangeText={setCustomRepsText}
              placeholder="10"
              placeholderTextColor="#5A6472"
              selectTextOnFocus
            />
            <View style={styles.modalActionsRow}>
              <Pressable onPress={() => setRepsModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelBtnText}>{isUk ? 'Скасувати' : 'Cancel'}</Text>
              </Pressable>
              <Pressable onPress={handleSaveCustomReps} style={styles.modalSaveBtn}>
                <Text style={styles.modalSaveBtnText}>{isUk ? 'Зберегти' : 'Save'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Custom Rest ────────────────────────────────────────────── */}
      <Modal
        visible={restModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRestModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalHeaderTitle}>
              {isUk ? 'Час відпочинку' : 'Rest Duration'}
            </Text>
            <Text style={styles.modalHeaderSubtitle}>
              {isUk ? 'Введіть секунди (10–600)' : 'Enter seconds (10–600)'}
            </Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              autoFocus
              value={customRestText}
              onChangeText={setCustomRestText}
              placeholder="90"
              placeholderTextColor="#5A6472"
              selectTextOnFocus
            />
            <View style={styles.modalActionsRow}>
              <Pressable onPress={() => setRestModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelBtnText}>{isUk ? 'Скасувати' : 'Cancel'}</Text>
              </Pressable>
              <Pressable onPress={handleSaveCustomRest} style={styles.modalSaveBtn}>
                <Text style={styles.modalSaveBtnText}>{isUk ? 'Зберегти' : 'Save'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0B0D0F',
  },
  // ── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topBarTitle: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  topDoneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  topDoneBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1,
  },
  // ── Centered Pickers Container ───────────────────────────────────────────
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  columnsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  columnHeaderLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#717B8A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  pickersFrame: {
    height: PICKER_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  sharedHighlightBar: {
    position: 'absolute',
    top: ITEM_HEIGHT * PADDING_COUNT,
    left: 4,
    right: 4,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.28)',
    backgroundColor: 'rgba(200, 255, 61, 0.04)',
    borderRadius: 8,
    zIndex: 1,
  },
  sharedFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * PADDING_COUNT,
    backgroundColor: 'rgba(11, 13, 15, 0.72)',
    zIndex: 2,
  },
  sharedFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * PADDING_COUNT,
    backgroundColor: 'rgba(11, 13, 15, 0.72)',
    zIndex: 2,
  },
  pickersColumnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PICKER_HEIGHT,
    zIndex: 3,
  },
  pickerColumn: {
    flex: 1,
    height: PICKER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnDivider: {
    width: 1,
    height: PICKER_HEIGHT - 32,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  hintText: {
    textAlign: 'center',
    color: '#555C65',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 18,
  },
  // ── Bottom bar ───────────────────────────────────────────────────────────
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 12,
  },
  doneBtn: {
    height: 56,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0B0D0F',
    letterSpacing: 1.2,
  },
  // ── Modals ───────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#12161D',
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: '#242B35',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalHeaderSubtitle: {
    fontSize: 13,
    color: '#717B8A',
    marginBottom: 20,
  },
  modalInput: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#0B0D0F',
    borderWidth: 1,
    borderColor: '#2A3140',
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A3140',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E959F',
  },
  modalSaveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0B0D0F',
  },
});

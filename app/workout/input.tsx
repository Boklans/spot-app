import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
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

const BASE_REPS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 500, 1000,
];

export default function Input() {
  const { t, language } = useI18n();
  const { unit, unitLabel, toKg, fromKg } = useWeightUnit();
  const session = useWorkoutSessionStore((state) => state.session);
  const updateCurrentSet = useWorkoutSessionStore((state) => state.updateCurrentSet);

  const weightScrollRef = useRef<ScrollView>(null);
  const repsScrollRef = useRef<ScrollView>(null);

  // Modal states for direct typing
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [customWeightText, setCustomWeightText] = useState('');
  const [repsModalVisible, setRepsModalVisible] = useState(false);
  const [customRepsText, setCustomRepsText] = useState('');

  const exercise = session?.exercises[session.currentExerciseIndex];
  const activeSet = exercise?.sets[session?.currentSetIndex ?? 0];
  const increment =
    typeof exercise?.weightIncrement === 'number' && exercise.weightIncrement > 0
      ? exercise.weightIncrement
      : 2.5;

  const currentWeightKg = activeSet?.weight ?? 70;
  const currentReps = activeSet?.reps ?? 8;
  const currentDisplayWeight = fromKg(currentWeightKg);

  const weightStep = unit === 'lbs' ? 5 : (increment ?? 2.5);
  const largeStep = unit === 'lbs' ? 20 : 10;
  const maxWeight = unit === 'lbs' ? 660 : 300;

  const BASE_WEIGHTS = useMemo(() => {
    const list: number[] = [0];
    for (let w = weightStep; w <= maxWeight; w += weightStep) {
      list.push(Math.round(w * 10) / 10);
    }
    return list;
  }, [weightStep, maxWeight]);

  const weightList = useMemo(() => {
    const roundedDisplay = Math.round(currentDisplayWeight * 10) / 10;
    if (!BASE_WEIGHTS.some((w) => Math.abs(w - roundedDisplay) < 0.05)) {
      return [...BASE_WEIGHTS, roundedDisplay].sort((a, b) => a - b);
    }
    return BASE_WEIGHTS;
  }, [BASE_WEIGHTS, currentDisplayWeight]);

  const repsList = useMemo(() => {
    if (!BASE_REPS.includes(currentReps) && currentReps >= 1 && currentReps <= 1000) {
      return [...BASE_REPS, currentReps].sort((a, b) => a - b);
    }
    return BASE_REPS;
  }, [currentReps]);

  // Auto-scroll weight wheel into view
  useEffect(() => {
    const idx = weightList.findIndex((w) => Math.abs(w - currentDisplayWeight) < 0.05);
    if (idx >= 0 && weightScrollRef.current) {
      const chipTotalWidth = 66; // 58 width + 8 gap
      weightScrollRef.current.scrollTo({
        x: Math.max(0, idx * chipTotalWidth - 130),
        animated: true,
      });
    }
  }, [currentDisplayWeight, weightList]);

  // Auto-scroll reps wheel into view
  useEffect(() => {
    const idx = repsList.indexOf(currentReps);
    if (idx >= 0 && repsScrollRef.current) {
      const chipTotalWidth = 58; // 50 width + 8 gap
      repsScrollRef.current.scrollTo({
        x: Math.max(0, idx * chipTotalWidth - 130),
        animated: true,
      });
    }
  }, [currentReps, repsList]);

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

  const handleSelectWeight = (displayVal: number) => {
    hapticLight();
    const kg = toKg(Math.max(0, displayVal));
    updateCurrentSet({ weight: kg });
  };

  const handleSelectReps = (r: number) => {
    hapticLight();
    const bounded = Math.min(1000, Math.max(1, r));
    updateCurrentSet({ reps: bounded });
  };

  const handleSaveCustomWeight = () => {
    const parsed = parseFloat(customWeightText.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 999) {
      handleSelectWeight(parsed);
    }
    setWeightModalVisible(false);
  };

  const handleSaveCustomReps = () => {
    const parsed = parseInt(customRepsText, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 1000) {
      handleSelectReps(parsed);
    }
    setRepsModalVisible(false);
  };

  const handleDone = () => {
    hapticMedium();
    router.back();
  };

  const isUk = language === 'uk';

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
        <View style={styles.topBarPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 2. Weight Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderLabel}>
            {isUk ? 'ВАГА' : 'WEIGHT'} ({unitLabel})
          </Text>

          {/* Hero Weight Display (Tap to type exact value) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter custom weight"
            onPress={() => {
              hapticLight();
              setCustomWeightText(formatWeight(currentDisplayWeight));
              setWeightModalVisible(true);
            }}
            style={styles.heroRow}
          >
            <View style={styles.weightIconWrap}>
              <MaterialCommunityIcons
                name={unit === 'lbs' ? 'weight-pound' : 'weight-kilogram'}
                size={26}
                color={colors.primary}
              />
            </View>
            <Text style={styles.heroWeightText}>
              {currentDisplayWeight === 0 ? (isUk ? 'Власна вага' : 'Bodyweight') : formatWeight(currentDisplayWeight)}
            </Text>
            {currentDisplayWeight > 0 && <Text style={styles.heroUnitText}>{unitLabel}</Text>}
            <Ionicons name="pencil" size={16} color="#8E959F" style={{ marginLeft: 6 }} />
          </Pressable>

          {/* Quick Step Buttons for Weight */}
          <View style={styles.quickStepRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleSelectWeight(Math.max(0, currentDisplayWeight - largeStep))}
              style={styles.quickStepBtn}
            >
              <Text style={styles.quickStepBtnText}>-{largeStep}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleSelectWeight(Math.max(0, currentDisplayWeight - weightStep))}
              style={styles.quickStepBtn}
            >
              <Text style={styles.quickStepBtnText}>-{weightStep}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleSelectWeight(currentDisplayWeight + weightStep)}
              style={styles.quickStepBtn}
            >
              <Text style={styles.quickStepBtnText}>+{weightStep}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleSelectWeight(currentDisplayWeight + largeStep)}
              style={styles.quickStepBtn}
            >
              <Text style={styles.quickStepBtnText}>+{largeStep}</Text>
            </Pressable>
          </View>

          {/* Scrollable Weight Wheel / Ruler */}
          <ScrollView
            ref={weightScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollStrip}
          >
            {weightList.map((val) => {
              const isSelected = Math.abs(val - currentDisplayWeight) < 0.05;
              return (
                <Pressable
                  key={val}
                  accessibilityRole="button"
                  onPress={() => handleSelectWeight(val)}
                  style={[styles.weightChip, isSelected && styles.weightChipSelected]}
                >
                  <Text style={[styles.weightChipText, isSelected && styles.weightChipTextSelected]}>
                    {val === 0 ? (isUk ? '0 (ВВ)' : '0 (BW)') : formatWeight(val)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 3. Reps Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.repsHeaderRow}>
            <Text style={styles.sectionHeaderLabel}>{t('reps')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                setCustomRepsText(String(currentReps));
                setRepsModalVisible(true);
              }}
              style={styles.customKeypadBtn}
            >
              <Ionicons name="keypad-outline" size={14} color={colors.primary} />
              <Text style={styles.customKeypadBtnText}>
                {isUk ? 'Ввести (1–1000)' : 'Type (1–1000)'}
              </Text>
            </Pressable>
          </View>

          {/* Hero Reps Display (Tap to type exact value) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter custom reps"
            onPress={() => {
              hapticLight();
              setCustomRepsText(String(currentReps));
              setRepsModalVisible(true);
            }}
            style={styles.heroRow}
          >
            <Text style={styles.heroRepsText}>{currentReps}</Text>
            <Text style={styles.heroRepsUnitText}>{isUk ? 'повт.' : 'reps'}</Text>
            <Ionicons name="pencil" size={16} color="#8E959F" style={{ marginLeft: 6 }} />
          </Pressable>

          {/* Quick Step Buttons for Reps */}
          <View style={styles.quickStepRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleSelectReps(Math.max(1, currentReps - 5))}
              style={styles.quickStepBtn}
            >
              <Text style={styles.quickStepBtnText}>-5</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleSelectReps(Math.max(1, currentReps - 1))}
              style={styles.quickStepBtn}
            >
              <Text style={styles.quickStepBtnText}>-1</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleSelectReps(Math.min(1000, currentReps + 1))}
              style={styles.quickStepBtn}
            >
              <Text style={styles.quickStepBtnText}>+1</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleSelectReps(Math.min(1000, currentReps + 5))}
              style={styles.quickStepBtn}
            >
              <Text style={styles.quickStepBtnText}>+5</Text>
            </Pressable>
          </View>

          {/* Scrollable Reps List (1 to 1000) */}
          <ScrollView
            ref={repsScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollStrip}
          >
            {repsList.map((rep) => {
              const isSelected = rep === currentReps;
              return (
                <Pressable
                  key={rep}
                  accessibilityRole="button"
                  onPress={() => handleSelectReps(rep)}
                  style={[styles.repChip, isSelected && styles.repChipSelected]}
                >
                  <Text style={[styles.repChipText, isSelected && styles.repChipTextSelected]}>
                    {rep}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 4. Bottom Pinned Save / Done Button */}
        <View style={styles.bottomBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save and return"
            onPress={handleDone}
            style={styles.nextBtn}
          >
            <Text style={styles.nextBtnText}>{t('done')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modal: Direct Weight Input */}
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
              {isUk ? `Одиниця вимірювання: ${unitLabel}` : `Unit: ${unitLabel}`}
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
              <Pressable
                onPress={() => setWeightModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>
                  {isUk ? 'Скасувати' : 'Cancel'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveCustomWeight}
                style={styles.modalSaveBtn}
              >
                <Text style={styles.modalSaveBtnText}>
                  {isUk ? 'Зберегти' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Direct Reps Input (1-1000) */}
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
              {isUk ? 'Від 1 до 1000 (наприклад для скакалки)' : 'From 1 to 1000 (e.g. for jump rope)'}
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
              <Pressable
                onPress={() => setRepsModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>
                  {isUk ? 'Скасувати' : 'Cancel'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveCustomReps}
                style={styles.modalSaveBtn}
              >
                <Text style={styles.modalSaveBtnText}>
                  {isUk ? 'Зберегти' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 48,
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
  topBarPlaceholder: {
    width: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 10,
    alignItems: 'center',
  },
  sectionContainer: {
    width: '100%',
    backgroundColor: '#12161D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2530',
    padding: 18,
    marginBottom: 20,
  },
  sectionHeaderLabel: {
    color: '#717B8A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  repsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customKeypadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.2)',
  },
  customKeypadBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 12,
    paddingVertical: 6,
  },
  weightIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heroWeightText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroUnitText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 6,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  heroRepsText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroRepsUnitText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 6,
    alignSelf: 'flex-end',
    marginBottom: 5,
  },
  quickStepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  quickStepBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#1B212B',
    borderWidth: 1,
    borderColor: '#26303E',
  },
  quickStepBtnText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  weightChip: {
    minWidth: 58,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#181D26',
    borderWidth: 1,
    borderColor: '#242D3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightChipSelected: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  weightChipText: {
    color: '#717B8A',
    fontSize: 14,
    fontWeight: '700',
  },
  weightChipTextSelected: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  repChip: {
    minWidth: 50,
    height: 44,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#181D26',
    borderWidth: 1,
    borderColor: '#242D3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repChipSelected: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  repChipText: {
    color: '#717B8A',
    fontSize: 14,
    fontWeight: '700',
  },
  repChipTextSelected: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  bottomBar: {
    width: '100%',
    maxWidth: 340,
    marginTop: 10,
  },
  nextBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  nextBtnText: {
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
  },
  emptyBtn: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBtnText: {
    color: '#0B0D0F',
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#15191F',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#242B35',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalHeaderSubtitle: {
    color: '#8E959F',
    fontSize: 13,
    marginBottom: 18,
    textAlign: 'center',
  },
  modalInput: {
    width: '100%',
    height: 60,
    backgroundColor: '#0F1217',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#1F2631',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  modalSaveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: {
    color: '#0B0D0F',
    fontSize: 14,
    fontWeight: '900',
  },
});

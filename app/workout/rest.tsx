import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
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
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { playRestCompleteSound } from '@/lib/soundEffects';
import { useWeightUnit } from '@/lib/weightUtils';
import { finalizeWorkoutSession } from '@/lib/workoutFinalizer';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

export default function Rest() {
  const { t, te, language } = useI18n();
  const { formatWithUnit } = useWeightUnit();
  const session = useWorkoutSessionStore((state) => state.session);
  const restEndsAt = useWorkoutSessionStore((state) => state.restEndsAt);
  const restNextType = useWorkoutSessionStore((state) => state.restNextType);
  const addRestTime = useWorkoutSessionStore((state) => state.addRestTime);
  const skipRest = useWorkoutSessionStore((state) => state.skipRest);
  const updateExerciseRest = useWorkoutSessionStore((state) => state.updateExerciseRest);

  const [showRestModal, setShowRestModal] = useState(false);
  const [customSecondsText, setCustomSecondsText] = useState('');
  const [now, setNow] = useState(Date.now());
  const seconds = Math.max(0, Math.ceil(((restEndsAt ?? Date.now()) - now) / 1000));
  const lastHapticSecond = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (seconds <= 3 && seconds > 0 && lastHapticSecond.current !== seconds) {
      lastHapticSecond.current = seconds;
      hapticLight();
    } else if (seconds === 0 && lastHapticSecond.current !== 0) {
      lastHapticSecond.current = 0;
      hapticSuccess();
      playRestCompleteSound();
    }
  }, [seconds]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{t('noActiveWorkout')}</Text>
          <Button onPress={() => router.replace('/(tabs)')}>{t('backToHome')}</Button>
        </View>
      </SafeAreaView>
    );
  }

  // The upcoming exercise and set that user will perform after this rest
  const targetExercise = session.exercises[session.currentExerciseIndex];
  const nextSet = targetExercise?.sets[session.currentSetIndex];
  const setNumber = (session.currentSetIndex ?? 0) + 1;
  const totalSets = targetExercise?.sets.length ?? 0;

  const continueWorkout = () => {
    hapticMedium();
    skipRest();
    router.replace('/workout/active');
  };

  const handleBack = () => {
    hapticLight();
    const hasCompletedSets = session.exercises.some((e) =>
      e.sets.some((s) => s.completed)
    );

    if (!hasCompletedSets) {
      router.replace('/(tabs)');
      return;
    }

    Alert.alert(
      language === 'uk' ? 'Перервати тренування?' : 'Interrupt Workout?',
      language === 'uk'
        ? 'Ви можете зберегти виконані підходи в історію або вийти на головну і продовжити пізніше.'
        : 'You can save completed sets to history, or pause and resume later from the home screen.',
      [
        {
          text: language === 'uk' ? 'Продовжити відпочинок' : 'Keep Resting',
          style: 'cancel',
        },
        {
          text: language === 'uk' ? 'Пауза (на головну)' : 'Pause & Exit',
          onPress: () => {
            hapticLight();
            router.replace('/(tabs)');
          },
        },
        {
          text: language === 'uk' ? 'Завершити та зберегти' : 'Finish & Save',
          style: 'default',
          onPress: async () => {
            hapticMedium();
            try {
              await finalizeWorkoutSession(session);
              router.replace('/workout/complete');
            } catch {
              router.replace('/(tabs)');
            }
          },
        },
      ]
    );
  };

  const handleAdd30 = () => {
    hapticLight();
    addRestTime(30);
  };

  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');

  const weightStr = nextSet?.weight ? formatWithUnit(nextSet.weight) : t('bodyweight');
  const repsStr = nextSet?.targetReps ? ` × ${nextSet.targetReps}` : '';

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Header Bar with Back Button and Raised SET COMPLETE */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>

        {/* Raised SET COMPLETE pill */}
        <View style={styles.statusPill}>
          <Ionicons
            name="checkmark-circle"
            size={15}
            color={colors.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.statusPillText}>{t('setComplete')}</Text>
        </View>

        {/* Placeholder to keep statusPill centered */}
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* 2. Timer Center Zone: Exactly Centered between SET COMPLETE and heroCard */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adjust rest timer"
          onPress={() => {
            hapticLight();
            setShowRestModal(true);
          }}
          style={styles.timerCenterZone}
        >
          <Text
            style={[
              styles.timerDigits,
              seconds === 0 && styles.timerDigitsComplete,
            ]}
          >
            {minutes}:{remainingSeconds}
          </Text>
          <View style={styles.timerSubtitleRow}>
            <Text style={styles.timerLabel}>{t('restTimer')}</Text>
            <View style={styles.restConfigBadge}>
              <Ionicons name="options-outline" size={12} color={colors.primary} />
              <Text style={styles.restConfigText}>
                {targetExercise?.restSeconds ?? 90}s
              </Text>
            </View>
          </View>
        </Pressable>

        {/* 3. Hero Upcoming Exercise Card (Big Centered Image + Details) */}
        <View style={styles.heroCard}>
          {/* Header Text: Kicker & Exercise Name ABOVE image */}
          <View style={styles.cardHeader}>
            <Text style={styles.kickerText}>
              {restNextType === 'exercise' ? t('nextExercise') : t('nextSet')}
            </Text>
            <Text numberOfLines={1} style={styles.exerciseTitle}>
              {targetExercise ? te(targetExercise.name) : t('nextExercise')}
            </Text>
          </View>

          {/* Big Centered Exercise 3D Illustration */}
          <View style={styles.imageContainer}>
            <Image
              source={getExerciseImage(targetExercise?.name)}
              style={styles.image}
              resizeMode="cover"
            />
          </View>

          {/* Target Weight, Reps & Set Counter Pill BELOW image */}
          <View style={styles.targetBadgesRow}>
            <View style={styles.targetWeightBadge}>
              <MaterialCommunityIcons
                name="weight-lifter"
                size={16}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.targetWeightText}>
                {weightStr}
                {repsStr}
              </Text>
            </View>

            {totalSets > 0 && (
              <View style={styles.setCounterBadge}>
                <Text style={styles.setCounterText}>
                  {t('setOf')} {setNumber}/{totalSets}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 4. Action Buttons (-15s, +30s & Start/Skip) */}
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Subtract 15 seconds"
            onPress={() => {
              hapticLight();
              addRestTime(-15);
            }}
            style={styles.subTimeBtn}
          >
            <Text style={styles.addTimeText}>-15s</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add 30 seconds"
            onPress={handleAdd30}
            style={styles.addTimeBtn}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 2 }} />
            <Text style={styles.addTimeText}>+30s</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip rest or start next set"
            onPress={continueWorkout}
            style={[
              styles.startBtn,
              seconds === 0 && styles.startBtnPulse,
            ]}
          >
            <Text style={styles.startBtnText}>
              {seconds === 0
                ? language === 'uk'
                  ? 'Почати підхід'
                  : 'Start Set'
                : language === 'uk'
                ? 'Пропустити'
                : 'Skip'}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color="#0B0D0F"
              style={{ marginLeft: 6 }}
            />
          </Pressable>
        </View>
      </ScrollView>

      {/* Rest Duration Configuration Modal */}
      <Modal
        visible={showRestModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRestModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalHeaderTitle}>
              {language === 'uk' ? 'Налаштувати відпочинок' : 'Customize Rest Duration'}
            </Text>
            <Text style={styles.modalHeaderSubtitle}>
              {language === 'uk'
                ? `Для вправи: ${targetExercise ? te(targetExercise.name) : ''}`
                : `For: ${targetExercise ? targetExercise.name : ''}`}
            </Text>

            {/* Quick preset chips */}
            <View style={styles.modalPresetRow}>
              {[30, 45, 60, 90, 120, 180, 240].map((presetSec) => {
                const isCurrent = (targetExercise?.restSeconds ?? 90) === presetSec;
                return (
                  <Pressable
                    key={presetSec}
                    onPress={() => {
                      hapticLight();
                      updateExerciseRest(session.currentExerciseIndex, presetSec);
                      useWorkoutSessionStore.setState({ restEndsAt: Date.now() + presetSec * 1000 });
                      setShowRestModal(false);
                    }}
                    style={[styles.modalPresetChip, isCurrent && styles.modalPresetChipActive]}
                  >
                    <Text style={[styles.modalPresetText, isCurrent && styles.modalPresetTextActive]}>
                      {presetSec}s
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom input */}
            <View style={styles.customRestInputRow}>
              <TextInput
                style={styles.customRestInput}
                keyboardType="number-pad"
                placeholder={String(targetExercise?.restSeconds ?? 90)}
                placeholderTextColor="#5A6472"
                value={customSecondsText}
                onChangeText={setCustomSecondsText}
              />
              <Text style={styles.customRestInputUnit}>
                {language === 'uk' ? 'сек' : 'sec'}
              </Text>
            </View>

            <View style={styles.modalActionsRow}>
              <Pressable
                onPress={() => setShowRestModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>
                  {language === 'uk' ? 'Скасувати' : 'Cancel'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const parsed = parseInt(customSecondsText, 10);
                  if (!isNaN(parsed) && parsed >= 10 && parsed <= 600) {
                    hapticLight();
                    updateExerciseRest(session.currentExerciseIndex, parsed);
                    useWorkoutSessionStore.setState({ restEndsAt: Date.now() + parsed * 1000 });
                  }
                  setShowRestModal(false);
                }}
                style={styles.modalSaveBtn}
              >
                <Text style={styles.modalSaveBtnText}>
                  {language === 'uk' ? 'Застосувати' : 'Apply'}
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
    paddingTop: 8,
    height: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topBarSpacer: {
    width: 40,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.28)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statusPillText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 26,
  },
  timerCenterZone: {
    flex: 1,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  timerDigits: {
    color: '#FFFFFF',
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  timerDigitsComplete: {
    color: colors.primary,
  },
  timerLabel: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  heroCard: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#12161D',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
    paddingHorizontal: 8,
  },
  kickerText: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  exerciseTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  imageContainer: {
    width: '100%',
    height: 195,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#080A0D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  targetBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  targetWeightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.28)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  targetWeightText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  setCounterBadge: {
    backgroundColor: '#161B24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  setCounterText: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 350,
    marginTop: 10,
  },
  addTimeBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#161B24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTimeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  startBtn: {
    flex: 1.35,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  startBtnPulse: {
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  startBtnText: {
    color: '#0B0D0F',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
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
  timerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  restConfigBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  restConfigText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  subTimeBtn: {
    width: 60,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#161B24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: 350,
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
    marginBottom: 16,
    textAlign: 'center',
  },
  modalPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  modalPresetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1A202A',
    borderWidth: 1,
    borderColor: '#283242',
  },
  modalPresetChipActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  modalPresetText: {
    color: '#8E959F',
    fontSize: 13,
    fontWeight: '700',
  },
  modalPresetTextActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  customRestInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  customRestInput: {
    width: 100,
    height: 48,
    backgroundColor: '#0F1217',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  customRestInputUnit: {
    color: '#8E959F',
    fontSize: 15,
    fontWeight: '700',
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

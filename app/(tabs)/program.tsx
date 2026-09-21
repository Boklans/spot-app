import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
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
import { WorkoutEditorModal } from '@/components/program/WorkoutEditorModal';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { getWorkoutDayLabel } from '@/lib/programGenerator';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { getScheduledWorkout, useProgramProgressStore } from '@/store/programProgressStore';
import { useProgramStore } from '@/store/programStore';
import {
  defaultOnboarding,
  loadOnboarding,
  saveOnboarding,
  type OnboardingData,
  type WorkoutSplitPreference,
} from '@/store/workoutStore';
import type { UserWorkout } from '@/types/userProgram';

type Message = {
  id: string;
  sender: 'user' | 'spot';
  text: string;
};

const SUGGESTED_QUESTIONS = [
  'Why am I stuck on bench?',
  'Should I increase my volume?',
  'Why am I not progressing?',
  'Can I replace this exercise?',
  'How should I train this week?',
];

const PREPARED_ANSWERS: Record<string, string> = {
  'Why am I stuck on bench?':
    'Your bench press plateau at 75 kg is likely due to triceps fatigue in the lockout phase. We recommend adding 2-second pause reps on your first set and increasing Triceps Pushdown volume by 2 sets this week.',
  'Should I increase my volume?':
    'Your recovery readiness is high (94%) with 42 sets on chest this month. You have room to add 1 progressive set to your secondary compound exercises without exceeding your Maximum Recoverable Volume.',
  'Why am I not progressing?':
    'Your training logs show rest periods averaged 90s instead of the optimal 2:30. Extending rest will restore intra-muscular ATP, allowing higher mechanical tension on sets 2 and 3.',
  'Can I replace this exercise?':
    'Yes! You can swap Incline Dumbbell Press with Incline Barbell Press or Low-to-High Cable Flyes. Both hit the clavicular pectoral head with equivalent stimulus.',
  'How should I train this week?':
    'Hit progressive overload on Monday’s Upper A (+2.5 kg on Bench Press). On Wednesday’s Lower A, prioritize quad volume, and keep Friday’s Upper B focused on shoulder hypertrophy.',
};

export default function Program() {
  const { t, tm, td, te, tw, language } = useI18n();
  const { formatWithUnit } = useWeightUnit();
  const program = useProgramStore((state) => state.program);
  const progress = useProgramProgressStore((state) => state.progress);
  const [activeTab, setActiveTab] = useState<'routine' | 'ai'>('routine');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingWorkout, setEditingWorkout] = useState<UserWorkout | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    useProgramStore.getState().loadProgram();
    loadOnboarding().then((data) => setOnboarding(data));
  }, []);

  const handleSwitchSplit = async (splitId: WorkoutSplitPreference) => {
    hapticMedium();
    const currentOnboarding = (await loadOnboarding()) ?? defaultOnboarding;
    const updated = { ...currentOnboarding, splitPreference: splitId };
    setOnboarding(updated);
    await saveOnboarding(updated);
    await useProgramStore.getState().refreshProgram(updated);
    const newProgram = useProgramStore.getState().program;
    await useProgramProgressStore
      .getState()
      .resetProgress(newProgram.id, newProgram.workouts[0]?.id);
  };

  const handleSaveWorkout = async (updatedWorkout: UserWorkout) => {
    const nextWorkouts = program.workouts.map((w) =>
      w.id === updatedWorkout.id ? updatedWorkout : w
    );
    await useProgramStore.getState().updateUserProgram({
      ...program,
      workouts: nextWorkouts,
    });
  };

  const scheduledWorkout = getScheduledWorkout(program, progress);

  const handleAsk = (questionText: string) => {
    if (!questionText.trim()) return;
    hapticMedium();

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: questionText,
    };

    const answer =
      PREPARED_ANSWERS[questionText] ??
      `SPOT AI analyzed your history: For "${questionText}", prioritize consistent progressive overload with +2.5 kg jumps and maintain 2:30 rest intervals for optimal hypertrophy.`;

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'spot',
      text: answer,
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInputText('');

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {/* 1. Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t('yourProgram')}</Text>
            <Text style={styles.subtitle}>
              {activeTab === 'ai'
                ? t('askAnything')
                : `${program.name} • ${program.daysPerWeek} ${t('daysPerWeek')}`}
            </Text>
          </View>

          {/* Tab Switcher: Routine first, then AI Coach */}
          <View style={styles.tabToggleWrap}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                setActiveTab('routine');
              }}
              style={[styles.toggleBtn, activeTab === 'routine' && styles.toggleBtnActive]}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  activeTab === 'routine' && styles.toggleBtnTextActive,
                ]}
              >
                {t('routine')}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticLight();
                setActiveTab('ai');
              }}
              style={[styles.toggleBtn, activeTab === 'ai' && styles.toggleBtnActive]}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  activeTab === 'ai' && styles.toggleBtnTextActive,
                ]}
              >
                {t('aiCoach')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ===================================================================== */}
        {/* TAB 1: AI COACH (SCREEN 16)                                           */}
        {/* ===================================================================== */}
        {activeTab === 'ai' ? (
          <View style={styles.aiContainer}>
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.aiScrollContent}
            >
              {/* Getting Smarter Banner (Screen 17 Preview) */}
              <View style={styles.aiBanner}>
                <View style={styles.aiBannerSparkle}>
                  <MaterialCommunityIcons name="brain" size={20} color="#7C5CFF" />
                </View>
                <View style={styles.aiBannerTextWrap}>
                  <Text style={styles.aiBannerKicker}>GETTING SMARTER</Text>
                  <Text style={styles.aiBannerSub}>
                    SPOT detected 7 progressive patterns in your training.
                  </Text>
                </View>
              </View>

              {/* Chat Message History */}
              {messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.msgWrap,
                    msg.sender === 'user' ? styles.userMsgWrap : styles.spotMsgWrap,
                  ]}
                >
                  {msg.sender === 'spot' && (
                    <View style={styles.spotAvatar}>
                      <Text style={styles.spotAvatarText}>AI</Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.msgBubble,
                      msg.sender === 'user'
                        ? styles.userMsgBubble
                        : styles.spotMsgBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.msgText,
                        msg.sender === 'user'
                          ? styles.userMsgText
                          : styles.spotMsgText,
                      ]}
                    >
                      {msg.text}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Suggested Questions Section (Screen 16) */}
              <Text style={styles.suggestedTitle}>Suggested questions</Text>
              <View style={styles.questionsList}>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <Pressable
                    accessibilityRole="button"
                    key={q}
                    onPress={() => handleAsk(q)}
                    style={({ pressed }) => [
                      styles.questionPill,
                      pressed && styles.questionPillPressed,
                    ]}
                  >
                    <Text style={styles.questionPillText}>{q}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#8E9BAE" />
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Input Bar at Bottom (Screen 16) */}
            <View style={styles.inputContainer}>
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Type your question..."
                  placeholderTextColor="#6C7A8E"
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={() => handleAsk(inputText)}
                  returnKeyType="send"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send question"
                  onPress={() => handleAsk(inputText)}
                  style={styles.sendButton}
                >
                  <Ionicons name="arrow-up" size={18} color="#0B0D0F" />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          /* ===================================================================== */
          /* TAB 2: ROUTINE SCHEDULE                                               */
          /* ===================================================================== */
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.routineScroll}
          >
            {/* Split Switcher in Routine */}
            <View style={styles.routineHeaderCard}>
              <View style={styles.routineTitleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routineProgramName}>{program.name}</Text>
                  <Text style={styles.routineDaysLabel}>
                    {program.daysPerWeek} {t('daysPerWeek').toUpperCase()} • {program.workouts.length} {t('sessions')}
                  </Text>
                </View>
                <View style={styles.splitBadge}>
                  <Text style={styles.splitBadgeText}>
                    {program.splitType === 'full_body'
                      ? 'FULL BODY'
                      : program.splitType === 'push_pull_legs'
                      ? 'PPL'
                      : program.splitType === 'custom'
                      ? 'CUSTOM'
                      : 'UPPER / LOWER'}
                  </Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.splitChipRow}
              >
                {[
                  { id: 'full_body', label: language === 'uk' ? 'Фулбоді' : 'Full Body' },
                  { id: 'upper_lower', label: language === 'uk' ? 'Верх / Низ' : 'Upper / Lower' },
                  { id: 'push_pull_legs', label: language === 'uk' ? 'Штовхай / Тягни / Ноги' : 'Push / Pull / Legs' },
                  { id: 'custom', label: language === 'uk' ? 'Власний' : 'Custom' },
                ].map((item) => {
                  const isActive = program.splitType === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      onPress={() => handleSwitchSplit(item.id as WorkoutSplitPreference)}
                      style={[
                        styles.splitChip,
                        isActive && styles.splitChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.splitChipText,
                          isActive && styles.splitChipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {program.workouts.map((workout, index) => {
              const isUpNext = workout.id === scheduledWorkout?.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={workout.id}
                  onPress={() =>
                    router.push({
                      pathname: '/workout/preview',
                      params: { workoutId: workout.id },
                    })
                  }
                  style={[styles.workoutCard, isUpNext && styles.workoutCardActive]}
                >
                  <View style={styles.workoutCardHead}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.workoutLabelRow}>
                        <Text style={styles.workoutNumber}>
                          {td(getWorkoutDayLabel(workout.dayLabel, index, onboarding?.trainingDays, program.workouts.length))}
                        </Text>
                        {isUpNext && (
                          <View style={styles.upNextBadge}>
                            <Text style={styles.upNextBadgeText}>{t('upNext')}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.workoutName}>{tw(workout.name)}</Text>
                    </View>
                    <View style={styles.cardActionsRight}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Customize workout"
                        hitSlop={8}
                        onPress={(e) => {
                          e.stopPropagation();
                          hapticLight();
                          setEditingWorkout(workout);
                        }}
                        style={styles.routineEditBtn}
                      >
                        <Ionicons name="create-outline" size={14} color={colors.primary} />
                        <Text style={styles.routineEditBtnText}>{t('edit')}</Text>
                      </Pressable>
                      <Ionicons name="chevron-forward" size={20} color="#8E9BAE" />
                    </View>
                  </View>

                  <View style={styles.muscleTagsRow}>
                    {workout.muscleGroups.map((muscle) => (
                      <View key={muscle} style={styles.muscleTag}>
                        <Text style={styles.muscleTagText}>{tm(muscle)}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.exerciseList}>
                    {workout.exercises.map((exercise) => (
                      <View key={exercise.name} style={styles.exerciseRow}>
                        <View style={styles.exerciseRowLeft}>
                          <View style={styles.exerciseThumbMini}>
                            <Image
                              source={getExerciseImage(exercise.name)}
                              style={styles.exerciseThumb}
                              resizeMode="cover"
                            />
                          </View>
                          <Text style={styles.exerciseNameText}>{te(exercise.name)}</Text>
                        </View>
                        <Text style={styles.exerciseMetaText}>
                          {exercise.sets} {t('sets').toLowerCase()} • {exercise.targetRepRange}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {editingWorkout && (
        <WorkoutEditorModal
          key={editingWorkout.id}
          visible={editingWorkout !== null}
          workout={editingWorkout}
          onSaveWorkout={handleSaveWorkout}
          onClose={() => setEditingWorkout(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  tabToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#14181F',
    borderRadius: 14,
    padding: 3,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  toggleBtnActive: {
    backgroundColor: '#1E2530',
  },
  toggleBtnText: {
    color: '#6C7A8E',
    fontSize: 13,
    fontWeight: '700',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  aiContainer: {
    flex: 1,
  },
  aiScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 92, 255, 0.12)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.3)',
    marginBottom: 20,
    marginTop: 4,
  },
  aiBannerSparkle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(124, 92, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  aiBannerTextWrap: {
    flex: 1,
  },
  aiBannerKicker: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  aiBannerSub: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  msgWrap: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  userMsgWrap: {
    justifyContent: 'flex-end',
  },
  spotMsgWrap: {
    justifyContent: 'flex-start',
    gap: 10,
  },
  spotAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C5CFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  spotAvatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  msgBubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  userMsgBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  spotMsgBubble: {
    backgroundColor: '#151921',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: 4,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMsgText: {
    color: '#0B0D0F',
    fontWeight: '700',
  },
  spotMsgText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  suggestedTitle: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  questionsList: {
    gap: 10,
  },
  questionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12161D',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  questionPillPressed: {
    backgroundColor: '#181E27',
    borderColor: colors.primary,
  },
  questionPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0B0D0F',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14181F',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    height: '100%',
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  routineScroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 14,
  },
  workoutCard: {
    backgroundColor: '#12161D',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  workoutCardActive: {
    borderColor: colors.primary,
  },
  workoutCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routineEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161B22',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242C38',
  },
  routineEditBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  workoutLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutNumber: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  upNextBadge: {
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  upNextBadgeText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  workoutName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  muscleTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  muscleTag: {
    backgroundColor: '#1A212B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  muscleTagText: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '700',
  },
  exerciseList: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  exerciseRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  exerciseThumbMini: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#242C38',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseThumb: {
    width: '100%',
    height: '100%',
  },
  exerciseNameText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  exerciseMetaText: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '500',
  },
  routineHeaderCard: {
    backgroundColor: '#12161D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1F2733',
    padding: 16,
    marginBottom: 16,
  },
  routineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  routineProgramName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  routineDaysLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E9BAE',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  splitBadge: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  splitBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  splitChipRow: {
    gap: 8,
  },
  splitChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#242C38',
  },
  splitChipActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    borderColor: colors.primary,
  },
  splitChipText: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '700',
  },
  splitChipTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});

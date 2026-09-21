import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
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
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useWeightUnit } from '@/lib/weightUtils';
import { type OnboardingExperience, saveOnboarding, loadOnboarding } from '@/store/workoutStore';

export default function Experience() {
  const { t, language } = useI18n();
  const { unitLabel, toKg, fromKg } = useWeightUnit();
  const [selected, setSelected] = useState<OnboardingExperience>('intermediate');

  // Baseline Strength Inputs for experienced lifters
  const [benchText, setBenchText] = useState('');
  const [squatText, setSquatText] = useState('');
  const [deadliftText, setDeadliftText] = useState('');
  const [ohpText, setOhpText] = useState('');

  const isUk = language === 'uk';

  React.useEffect(() => {
    loadOnboarding().then((data) => {
      if (data?.experience) {
        setSelected(data.experience);
      }
      if (data?.baselineLifts) {
        const { benchPressKg, squatKg, deadliftKg, overheadPressKg } = data.baselineLifts;
        if (typeof benchPressKg === 'number') setBenchText(String(fromKg(benchPressKg)));
        if (typeof squatKg === 'number') setSquatText(String(fromKg(squatKg)));
        if (typeof deadliftKg === 'number') setDeadliftText(String(fromKg(deadliftKg)));
        if (typeof overheadPressKg === 'number') setOhpText(String(fromKg(overheadPressKg)));
      }
    });
  }, [fromKg]);

  const experienceOptions: Array<{
    value: OnboardingExperience;
    label: string;
    detail: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }> = [
    {
      value: 'beginner',
      label: isUk ? 'Ні, я новачок' : "No, I'm a beginner",
      detail: isUk ? 'Починаю з нуля або була довга перерва' : 'Starting fresh or returning after a break',
      icon: 'account-outline',
    },
    {
      value: 'intermediate',
      label: isUk ? 'Так, маю досвід' : 'Yes, I have experience',
      detail: isUk ? 'Регулярно займаюсь, знаю свої робочі ваги' : 'Train consistently, know my working weights',
      icon: 'weight-lifter',
    },
  ];

  const handleContinue = async () => {
    hapticMedium();

    const parseVal = (str: string) => {
      const num = parseFloat(str.replace(',', '.'));
      return !isNaN(num) && num > 0 ? toKg(num) : undefined;
    };

    const bKg = parseVal(benchText);
    const sKg = parseVal(squatText);
    const dKg = parseVal(deadliftText);
    const oKg = parseVal(ohpText);

    const hasBaseline = bKg !== undefined || sKg !== undefined || dKg !== undefined || oKg !== undefined;

    await saveOnboarding({
      experience: selected,
      baselineLifts: selected !== 'beginner' && hasBaseline
        ? {
            benchPressKg: bKg,
            squatKg: sKg,
            deadliftKg: dKg,
            overheadPressKg: oKg,
          }
        : undefined,
    });

    router.push('/onboarding/frequency');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Bar with 3/5 Progress */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.stepText}>2/3</Text>
        <View style={styles.topBarPlaceholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 2. Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              {isUk ? 'Чи тренуєтесь зараз?' : 'Do you currently train?'}
            </Text>
            <Text style={styles.subtitle}>
              {isUk
                ? 'Для новачків ставимо меншу вагу та вищі повторення, для атлетів — робочі навантаження.'
                : 'Beginners get higher reps & lighter load; lifters get calibrated working weights.'}
            </Text>
          </View>

          {/* 3. Options List */}
          <View style={styles.optionsList}>
            {experienceOptions.map((opt) => {
              const isSelected = selected === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  onPress={() => {
                    hapticLight();
                    setSelected(opt.value);
                  }}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                  ]}
                >
                  <View style={styles.iconWrap}>
                    <MaterialCommunityIcons
                      name={opt.icon}
                      size={24}
                      color={isSelected ? colors.primary : '#8E9BAE'}
                    />
                  </View>

                  <View style={styles.textWrap}>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                    <Text style={styles.optionDetail}>{opt.detail}</Text>
                  </View>

                  <View
                    style={[
                      styles.checkCircle,
                      isSelected && styles.checkCircleSelected,
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color="#0B0D0F" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* 4. Baseline Strength Calibration Card (for experienced lifters) */}
          {selected !== 'beginner' && (
            <View style={styles.baselineCard}>
              <View style={styles.baselineHeaderRow}>
                <Ionicons name="flash-outline" size={18} color={colors.primary} />
                <Text style={styles.baselineTitle}>
                  {isUk ? 'Ваші робочі ваги (необовʼязково)' : 'Baseline Strength (Optional)'}
                </Text>
              </View>
              <Text style={styles.baselineSubtitle}>
                {isUk
                  ? `Введіть вагу в ${unitLabel} для вправ, які знаєте. SPOT одразу підлаштує програму під вашу реальну силу.`
                  : `Enter weights in ${unitLabel} for lifts you know. SPOT will calibrate your starting working weights.`}
              </Text>

              <View style={styles.liftsGrid}>
                {/* Bench Press */}
                <View style={styles.liftInputCol}>
                  <Text style={styles.liftLabel}>
                    {isUk ? 'Жим лежачи' : 'Bench Press'}
                  </Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.liftInput}
                      keyboardType="decimal-pad"
                      placeholder={unitLabel === 'LBS' ? '185' : '80'}
                      placeholderTextColor="#4E5A6C"
                      value={benchText}
                      onChangeText={setBenchText}
                    />
                    <Text style={styles.inputUnit}>{unitLabel}</Text>
                  </View>
                </View>

                {/* Squat */}
                <View style={styles.liftInputCol}>
                  <Text style={styles.liftLabel}>
                    {isUk ? 'Присідання' : 'Squat'}
                  </Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.liftInput}
                      keyboardType="decimal-pad"
                      placeholder={unitLabel === 'LBS' ? '225' : '100'}
                      placeholderTextColor="#4E5A6C"
                      value={squatText}
                      onChangeText={setSquatText}
                    />
                    <Text style={styles.inputUnit}>{unitLabel}</Text>
                  </View>
                </View>

                {/* Deadlift */}
                <View style={styles.liftInputCol}>
                  <Text style={styles.liftLabel}>
                    {isUk ? 'Станова тяга' : 'Deadlift'}
                  </Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.liftInput}
                      keyboardType="decimal-pad"
                      placeholder={unitLabel === 'LBS' ? '275' : '120'}
                      placeholderTextColor="#4E5A6C"
                      value={deadliftText}
                      onChangeText={setDeadliftText}
                    />
                    <Text style={styles.inputUnit}>{unitLabel}</Text>
                  </View>
                </View>

                {/* Overhead Press */}
                <View style={styles.liftInputCol}>
                  <Text style={styles.liftLabel}>
                    {isUk ? 'Жим стоячи' : 'Overhead Press'}
                  </Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.liftInput}
                      keyboardType="decimal-pad"
                      placeholder={unitLabel === 'LBS' ? '115' : '50'}
                      placeholderTextColor="#4E5A6C"
                      value={ohpText}
                      onChangeText={setOhpText}
                    />
                    <Text style={styles.inputUnit}>{unitLabel}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* 5. Bottom Continue Button */}
          <View style={styles.bottomBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue"
              onPress={handleContinue}
              style={styles.continueBtn}
            >
              <Text style={styles.continueBtnText}>{t('continue')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  stepText: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '700',
  },
  topBarPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#8E9BAE',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 20,
  },
  optionsList: {
    gap: 12,
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12161D',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(200, 255, 61, 0.04)',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#181E27',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textWrap: {
    flex: 1,
  },
  optionLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  optionDetail: {
    color: '#8E9BAE',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  baselineCard: {
    backgroundColor: '#12161D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
    padding: 18,
    marginBottom: 24,
  },
  baselineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  baselineTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  baselineSubtitle: {
    color: '#8E9BAE',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  liftsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  liftInputCol: {
    width: '47%',
  },
  liftLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1217',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242C38',
    paddingHorizontal: 12,
    height: 46,
  },
  liftInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    height: '100%',
  },
  inputUnit: {
    color: '#6C7A8E',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
  },
  bottomBar: {
    width: '100%',
    marginTop: 8,
  },
  continueBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  continueBtnText: {
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '900',
  },
});

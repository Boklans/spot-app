import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useWeightUnit } from '@/lib/weightUtils';
import { useUserProfileStore } from '@/store/userProfileStore';
import { useBodyWeightStore } from '@/store/bodyWeightStore';
import { loadOnboarding, type OnboardingSex, saveOnboarding } from '@/store/workoutStore';

export default function ParamsSetup() {
  const { t, language } = useI18n();
  const { unitLabel, toKg, fromKg } = useWeightUnit();

  const nameRef = useRef<TextInputInstance>(null);
  const ageRef = useRef<TextInputInstance>(null);
  const weightRef = useRef<TextInputInstance>(null);
  const heightRef = useRef<TextInputInstance>(null);

  const isDefaultDummy = (n?: string) =>
    !n || ['IHOR', 'ATHLETE', 'АТЛЕТ'].includes(n.trim().toUpperCase());

  const initialProfile = useUserProfileStore.getState().profile;
  const [name, setName] = useState(() => (!isDefaultDummy(initialProfile.name) ? initialProfile.name : ''));
  const [age, setAge] = useState(() => String(initialProfile.age || 28));
  const [sex, setSex] = useState<OnboardingSex>(() => initialProfile.sex || 'unspecified');
  const [weight, setWeight] = useState(() => String(fromKg(initialProfile.weightKg || 70)));
  const [height, setHeight] = useState(() => String(initialProfile.heightCm || 172));
  const [nameError, setNameError] = useState(false);

  const isUk = language === 'uk';
  const hasHydratedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const p = useUserProfileStore.getState().profile;
      if (!hasHydratedRef.current) {
        hasHydratedRef.current = true;
        if (p.name && !isDefaultDummy(p.name) && !name) setName(p.name);
        if (p.age && p.age > 0) setAge(String(p.age));
        if (p.sex) setSex(p.sex);
        if (p.weightKg && p.weightKg > 0 && !weight) setWeight(String(fromKg(p.weightKg)));
        if (p.heightCm && p.heightCm > 0 && !height) setHeight(String(p.heightCm));
        loadOnboarding().then((saved) => {
          if (!saved) return;
          if (saved.age && saved.age > 0) setAge(String(saved.age));
          if (saved.sex) setSex(saved.sex);
        }).catch(() => undefined);
      }
    }, [fromKg, name, weight, height])
  );

  const isNameValid = name.trim().length >= 2;

  const sexOptions: Array<{ value: OnboardingSex; label: string }> = [
    { value: 'female', label: isUk ? 'Жіноча' : 'Female' },
    { value: 'male', label: isUk ? 'Чоловіча' : 'Male' },
    { value: 'unspecified', label: isUk ? 'Не вказувати' : 'Prefer not to say' },
  ];

  const handleContinue = () => {
    if (!isNameValid) {
      hapticLight();
      setNameError(true);
      nameRef.current?.focus();
      return;
    }

    hapticMedium();
    setNameError(false);

    const effectiveName = name.trim();

    const parsedAge = parseInt(age.trim(), 10);
    const effectiveAge = !isNaN(parsedAge) && parsedAge >= 14 && parsedAge <= 95
      ? parsedAge
      : (initialProfile.age || 28);

    const parsedWeight = parseFloat(weight.replace(',', '.'));
    const effectiveWeightKg = !isNaN(parsedWeight) && parsedWeight >= 20 && parsedWeight <= 300
      ? Math.round(toKg(parsedWeight) * 10) / 10
      : (initialProfile.weightKg || 70);

    const parsedHeight = parseFloat(height.replace(',', '.'));
    const effectiveHeightCm = !isNaN(parsedHeight) && parsedHeight >= 80 && parsedHeight <= 250
      ? Math.round(parsedHeight)
      : (initialProfile.heightCm || 172);

    Promise.all([
      useUserProfileStore.getState().updateProfile({
        name: effectiveName,
        age: effectiveAge,
        sex,
        weightKg: effectiveWeightKg,
        heightCm: effectiveHeightCm,
      }),
      useBodyWeightStore.getState().syncBaselineWeight(effectiveWeightKg),
      saveOnboarding({
        name: effectiveName,
        age: effectiveAge,
        sex,
        weightKg: effectiveWeightKg,
        heightCm: effectiveHeightCm,
      }),
    ]).catch((err) => console.warn('Non-blocking onboarding save error:', err));

    router.push('/onboarding/goal');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Bar with 1/5 Progress */}
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
        <Text style={styles.stepText}>1/5</Text>
        <View style={styles.topBarPlaceholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {/* 2. Header */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              {isUk ? 'Ваші параметри' : 'Your Profile'}
            </Text>
            <Text style={styles.subtitle}>
              {isUk
                ? 'Дані потрібні для точного підбору безпечної стартової ваги у вправах.'
                : 'Used to calibrate safe starting weights for your exercises.'}
            </Text>
          </View>

          {/* 3. Inputs Form */}
          <View style={styles.formContainer}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>{isUk ? "Ваше ім'я" : 'Your Name'}</Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>
              <Pressable
                onPress={() => nameRef.current?.focus()}
                style={[styles.inputWrap, nameError && styles.inputWrapError]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={nameError ? '#EF4444' : '#717B8A'}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={nameRef}
                  editable={true}
                  style={styles.textInput}
                  placeholder={isUk ? 'Як до вас звертатися?' : 'Enter your name'}
                  placeholderTextColor="#4E5A6C"
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    if (nameError && val.trim().length >= 2) {
                      setNameError(false);
                    }
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => ageRef.current?.focus()}
                />
              </Pressable>
              {nameError && (
                <Text style={styles.errorText}>
                  {isUk
                    ? "Будь ласка, введіть ваше ім'я (мінімум 2 символи)"
                    : 'Please enter your name (at least 2 characters)'}
                </Text>
              )}
            </View>

            {/* Optional Sex Selector (for load calibration) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {isUk ? 'Стать (необовʼязково)' : 'Sex (Optional)'}
              </Text>
              <View style={styles.sexRow}>
                {sexOptions.map((opt) => {
                  const isActive = sex === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      accessibilityRole="button"
                      accessibilityLabel={opt.label}
                      onPress={() => {
                        hapticLight();
                        setSex(opt.value);
                      }}
                      style={[styles.sexChip, isActive && styles.sexChipActive]}
                    >
                      <Text style={[styles.sexChipText, isActive && styles.sexChipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.helperHint}>
                {isUk
                  ? 'Впливає лише на розрахунок початкової ваги. Вибір вправ і груп мʼязів ви налаштуєте на наступному кроці.'
                  : 'Only used to calibrate starting weights. Exercise selection is determined by your goals on the next step.'}
              </Text>
            </View>

            {/* Age, Weight, Height Grid */}
            <View style={styles.metricsRow}>
              {/* Age */}
              <View style={styles.metricCol}>
                <Text style={styles.inputLabel}>
                  {isUk ? 'Вік' : 'Age'}
                </Text>
                <Pressable
                  onPress={() => ageRef.current?.focus()}
                  style={styles.metricInputWrap}
                >
                  <TextInput
                    ref={ageRef}
                    editable={true}
                    style={styles.textInput}
                    placeholder="28"
                    placeholderTextColor="#4E5A6C"
                    keyboardType="number-pad"
                    maxLength={2}
                    value={age}
                    onChangeText={setAge}
                    returnKeyType="next"
                    onSubmitEditing={() => weightRef.current?.focus()}
                  />
                  <Text style={styles.unitSuffix}>{isUk ? 'РОКІВ' : 'YRS'}</Text>
                </Pressable>
              </View>

              {/* Weight */}
              <View style={styles.metricCol}>
                <Text style={styles.inputLabel}>
                  {isUk ? 'Вага' : 'Weight'}
                </Text>
                <Pressable
                  onPress={() => weightRef.current?.focus()}
                  style={styles.metricInputWrap}
                >
                  <TextInput
                    ref={weightRef}
                    editable={true}
                    style={styles.textInput}
                    placeholder="70"
                    placeholderTextColor="#4E5A6C"
                    keyboardType="decimal-pad"
                    value={weight}
                    onChangeText={setWeight}
                    returnKeyType="next"
                    onSubmitEditing={() => heightRef.current?.focus()}
                  />
                  <Text style={styles.unitSuffix}>{unitLabel}</Text>
                </Pressable>
              </View>

              {/* Height */}
              <View style={styles.metricCol}>
                <Text style={styles.inputLabel}>
                  {isUk ? 'Зріст' : 'Height'}
                </Text>
                <Pressable
                  onPress={() => heightRef.current?.focus()}
                  style={styles.metricInputWrap}
                >
                  <TextInput
                    ref={heightRef}
                    editable={true}
                    style={styles.textInput}
                    placeholder="172"
                    placeholderTextColor="#4E5A6C"
                    keyboardType="number-pad"
                    value={height}
                    onChangeText={setHeight}
                  />
                  <Text style={styles.unitSuffix}>{isUk ? 'СМ' : 'CM'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* 4. Pinned Continue Button */}
        <View style={styles.bottomBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueBtn,
              !isNameValid && styles.continueBtnDisabled,
              isNameValid && pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Text
              style={[
                styles.continueBtnText,
                !isNameValid && styles.continueBtnTextDisabled,
              ]}
            >
              {t('continue')}
            </Text>
          </Pressable>
        </View>
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
    height: 44,
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
    paddingTop: 6,
    paddingBottom: 16,
  },
  titleSection: {
    marginBottom: 18,
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
  formContainer: {
    gap: 18,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requiredStar: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12161D',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E2530',
    paddingHorizontal: 16,
    height: 54,
  },
  inputWrapError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    height: '100%',
  },
  unitSuffix: {
    color: '#717B8A',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 6,
  },
  sexRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sexChip: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#12161D',
    borderWidth: 1.5,
    borderColor: '#1E2530',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sexChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
  },
  sexChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  sexChipTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  helperHint: {
    color: '#717B8A',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCol: {
    flex: 1,
    gap: 8,
  },
  metricInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12161D',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E2530',
    paddingHorizontal: 12,
    height: 54,
  },
  bottomBar: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 24,
    backgroundColor: '#0B0D0F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
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
  continueBtnDisabled: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#212A38',
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '900',
  },
  continueBtnTextDisabled: {
    color: '#64748B',
  },
});

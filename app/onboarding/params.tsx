import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
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
import { useUserProfileStore } from '@/store/userProfileStore';
import { useBodyWeightStore } from '@/store/bodyWeightStore';
import { saveOnboarding } from '@/store/workoutStore';

export default function ParamsSetup() {
  const { t, language } = useI18n();
  const { unitLabel, toKg, fromKg } = useWeightUnit();

  const nameRef = useRef<TextInput>(null);
  const weightRef = useRef<TextInput>(null);
  const heightRef = useRef<TextInput>(null);

  const isDefaultDummy = (n?: string) =>
    !n || ['IHOR', 'ATHLETE', 'АТЛЕТ'].includes(n.trim().toUpperCase());

  const initialProfile = useUserProfileStore.getState().profile;
  const [name, setName] = useState(() => (!isDefaultDummy(initialProfile.name) ? initialProfile.name : ''));
  const [weight, setWeight] = useState(() => String(fromKg(initialProfile.weightKg || 78)));
  const [height, setHeight] = useState(() => String(initialProfile.heightCm || 180));
  const [nameError, setNameError] = useState(false);

  const isUk = language === 'uk';
  const hasHydratedRef = useRef(false);

  // Sync state cleanly whenever screen comes into focus without locking user edits
  useFocusEffect(
    useCallback(() => {
      const p = useUserProfileStore.getState().profile;
      if (!hasHydratedRef.current) {
        hasHydratedRef.current = true;
        if (p.name && !isDefaultDummy(p.name) && !name) setName(p.name);
        if (p.weightKg && p.weightKg > 0 && !weight) setWeight(String(fromKg(p.weightKg)));
        if (p.heightCm && p.heightCm > 0 && !height) setHeight(String(p.heightCm));
      }
    }, [fromKg, name, weight, height])
  );

  const isNameValid = name.trim().length >= 2;

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

    const parsedWeight = parseFloat(weight.replace(',', '.'));
    const effectiveWeightKg = !isNaN(parsedWeight) && parsedWeight >= 20 && parsedWeight <= 300
      ? Math.round(toKg(parsedWeight) * 10) / 10
      : (initialProfile.weightKg || 78);

    const parsedHeight = parseFloat(height.replace(',', '.'));
    const effectiveHeightCm = !isNaN(parsedHeight) && parsedHeight >= 80 && parsedHeight <= 250
      ? Math.round(parsedHeight)
      : (initialProfile.heightCm || 180);

    // Save in background without blocking screen transition
    Promise.all([
      useUserProfileStore.getState().updateProfile({
        name: effectiveName,
        weightKg: effectiveWeightKg,
        heightCm: effectiveHeightCm,
      }),
      useBodyWeightStore.getState().syncBaselineWeight(effectiveWeightKg),
      saveOnboarding({
        name: effectiveName,
        weightKg: effectiveWeightKg,
        heightCm: effectiveHeightCm,
      }),
    ]).catch((err) => console.warn('Non-blocking onboarding save error:', err));

    // Navigate immediately
    router.push('/onboarding/experience');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 1. Top Bar with 1/3 Progress */}
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
        <Text style={styles.stepText}>1/3</Text>
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
              {isUk ? 'Ваші параметри' : 'Your Details'}
            </Text>
            <Text style={styles.subtitle}>
              {isUk
                ? 'Ці дані потрібні для точного розрахунку навантаження та калорій.'
                : 'Helps SPOT calculate baseline working weights and progression.'}
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
                  onSubmitEditing={() => weightRef.current?.focus()}
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

            {/* Weight */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {isUk ? 'Вага' : 'Bodyweight'} ({unitLabel})
              </Text>
              <Pressable
                onPress={() => weightRef.current?.focus()}
                style={styles.inputWrap}
              >
                <Ionicons name="scale-outline" size={20} color="#717B8A" style={styles.inputIcon} />
                <TextInput
                  ref={weightRef}
                  editable={true}
                  style={styles.textInput}
                  placeholder="75"
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
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {isUk ? 'Зріст (см)' : 'Height (cm)'}
              </Text>
              <Pressable
                onPress={() => heightRef.current?.focus()}
                style={styles.inputWrap}
              >
                <Ionicons name="resize-outline" size={20} color="#717B8A" style={styles.inputIcon} />
                <TextInput
                  ref={heightRef}
                  editable={true}
                  style={styles.textInput}
                  placeholder="178"
                  placeholderTextColor="#4E5A6C"
                  keyboardType="number-pad"
                  value={height}
                  onChangeText={setHeight}
                />
                <Text style={styles.unitSuffix}>{isUk ? 'СМ' : 'CM'}</Text>
              </Pressable>
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
    marginBottom: 32,
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
    marginTop: 6,
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
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
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


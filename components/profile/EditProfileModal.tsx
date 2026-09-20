import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
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
import { hapticImpact, hapticLight, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useProgramStore } from '@/store/programStore';
import {
  BEAST_AVATARS,
  type BeastAvatarId,
  useUserProfileStore,
} from '@/store/userProfileStore';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const { t, language } = useI18n();
  const profile = useUserProfileStore((state) => state.profile);
  const updateProfile = useUserProfileStore((state) => state.updateProfile);

  const [name, setName] = useState(profile.name);
  const [selectedAvatar, setSelectedAvatar] = useState<BeastAvatarId>(profile.avatar);
  const [weightStr, setWeightStr] = useState(
    profile.weightUnit === 'lbs'
      ? Math.round(profile.weightKg * 2.20462).toString()
      : profile.weightKg.toString()
  );
  const [heightStr, setHeightStr] = useState(
    profile.heightUnit === 'ft'
      ? (profile.heightCm / 30.48).toFixed(1)
      : profile.heightCm.toString()
  );

  useEffect(() => {
    if (visible) {
      setName(profile.name);
      setSelectedAvatar(profile.avatar);
      setWeightStr(
        profile.weightUnit === 'lbs'
          ? Math.round(profile.weightKg * 2.20462).toString()
          : profile.weightKg.toString()
      );
      setHeightStr(
        profile.heightUnit === 'ft'
          ? (profile.heightCm / 30.48).toFixed(1)
          : profile.heightCm.toString()
      );
    }
  }, [visible, profile]);

  // Compute live BMI
  const parsedWeight = parseFloat(weightStr) || profile.weightKg;
  const currentWeightKg =
    profile.weightUnit === 'lbs' ? parsedWeight / 2.20462 : parsedWeight;

  const parsedHeight = parseFloat(heightStr) || profile.heightCm;
  const currentHeightCm =
    profile.heightUnit === 'ft' ? parsedHeight * 30.48 : parsedHeight;

  const heightM = currentHeightCm / 100;
  const bmi =
    heightM > 0 && currentWeightKg > 0
      ? (currentWeightKg / (heightM * heightM)).toFixed(1)
      : '24.0';

  const handleSave = async () => {
    hapticSuccess();

    const finalWeightKg = Math.max(35, Math.min(250, currentWeightKg));
    const finalHeightCm = Math.max(100, Math.min(240, Math.round(currentHeightCm)));
    const finalName = name.trim().length > 0 ? name.trim() : profile.name;

    await updateProfile({
      name: finalName,
      avatar: selectedAvatar,
      weightKg: Math.round(finalWeightKg * 10) / 10,
      heightCm: finalHeightCm,
    });

    // Refresh program generator with new body metrics
    await useProgramStore.getState().refreshProgram();

    onClose();
  };

  const beastKeys = Object.keys(BEAST_AVATARS) as BeastAvatarId[];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <SafeAreaView style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {language === 'uk' ? 'Редагувати профіль' : 'Edit Profile'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
                onPress={onClose}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* 1. Beast Avatar Selector */}
              <Text style={styles.inputLabel}>
                {language === 'uk' ? 'ОБЕРІТЬ СВІЙ АВАТАР ЗВІРА' : 'CHOOSE YOUR BEAST AVATAR'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.avatarCarousel}
              >
                {beastKeys.map((key) => {
                  const b = BEAST_AVATARS[key];
                  const isSelected = selectedAvatar === key;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      onPress={() => {
                        hapticImpact();
                        setSelectedAvatar(key);
                      }}
                      style={[
                        styles.avatarCard,
                        isSelected && { borderColor: b.color, backgroundColor: 'rgba(200, 255, 61, 0.08)' },
                      ]}
                    >
                      <View
                        style={[
                          styles.avatarCircle,
                          isSelected && { backgroundColor: b.color },
                        ]}
                      >
                        <Text style={styles.avatarEmoji}>{b.emoji}</Text>
                      </View>
                      <Text
                        style={[
                          styles.avatarLabel,
                          isSelected && { color: b.color, fontWeight: '700' },
                        ]}
                      >
                        {b.label}
                      </Text>
                      <Text style={styles.avatarTag}>{b.tag}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* 2. Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {language === 'uk' ? "ІМ'Я" : 'FULL NAME'}
                </Text>
                <View style={styles.inputBox}>
                  <Ionicons name="person-outline" size={18} color="#8E9BAE" style={styles.inputIcon} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your name"
                    placeholderTextColor="#5A687A"
                    style={styles.textInput}
                    autoCapitalize="words"
                    maxLength={30}
                  />
                </View>
              </View>

              {/* 3. Body Metrics (Weight & Height) */}
              <View style={styles.metricsRow}>
                {/* Weight */}
                <View style={styles.metricCol}>
                  <Text style={styles.inputLabel}>
                    {language === 'uk' ? 'ВАГА ТІЛА' : 'BODY WEIGHT'} ({profile.weightUnit.toUpperCase()})
                  </Text>
                  <View style={styles.inputBox}>
                    <MaterialCommunityIcons
                      name="weight-kilogram"
                      size={18}
                      color="#8E9BAE"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      value={weightStr}
                      onChangeText={setWeightStr}
                      keyboardType="numeric"
                      style={styles.textInput}
                      maxLength={5}
                    />
                  </View>
                </View>

                {/* Height */}
                <View style={styles.metricCol}>
                  <Text style={styles.inputLabel}>
                    {language === 'uk' ? 'ЗРІСТ' : 'HEIGHT'} ({profile.heightUnit.toUpperCase()})
                  </Text>
                  <View style={styles.inputBox}>
                    <MaterialCommunityIcons
                      name="ruler"
                      size={18}
                      color="#8E9BAE"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      value={heightStr}
                      onChangeText={setHeightStr}
                      keyboardType="numeric"
                      style={styles.textInput}
                      maxLength={5}
                    />
                  </View>
                </View>
              </View>

              {/* 4. AI Body Stats Card */}
              <View style={styles.aiCard}>
                <View style={styles.aiCardHeader}>
                  <View style={styles.aiIconWrap}>
                    <MaterialCommunityIcons name="brain" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.aiCardTitle}>
                    {language === 'uk' ? 'КАЛІБРУВАННЯ НАВАНТАЖЕННЯ ШІ' : 'SPOT AI LOAD CALIBRATION'}
                  </Text>
                </View>

                <View style={styles.bmiDisplay}>
                  <Text style={styles.bmiNumber}>{bmi}</Text>
                  <View style={styles.bmiMeta}>
                    <Text style={styles.bmiLabel}>
                      {language === 'uk' ? 'Індекс маси тіла (BMI)' : 'Body Mass Index (BMI)'}
                    </Text>
                    <Text style={styles.bmiCategory}>
                      {parseFloat(bmi) < 18.5
                        ? (language === 'uk' ? 'Струнка статура' : 'Lean build')
                        : parseFloat(bmi) < 25
                        ? (language === 'uk' ? 'Атлетична норма' : 'Athletic / Optimal')
                        : parseFloat(bmi) < 30
                        ? (language === 'uk' ? 'Масивна статура' : 'Power / Hypertrophy')
                        : (language === 'uk' ? 'Висока маса' : 'Heavy Class')}
                    </Text>
                  </View>
                </View>

                <Text style={styles.aiDesc}>
                  {language === 'uk'
                    ? 'ШІ автоматично адаптує стартові ваги на штанзі та таймер відпочинку під вашу масу тіла.'
                    : 'SPOT AI calibrates your compound lift baselines and recovery timers based on your body mass.'}
                </Text>
              </View>
            </ScrollView>

            {/* 5. Save Button */}
            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save profile"
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && styles.saveBtnPressed,
                ]}
              >
                <Text style={styles.saveBtnText}>
                  {language === 'uk' ? 'Зберегти зміни' : 'Save Changes'}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#11151A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 12 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A212B',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1A212B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  inputLabel: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  avatarCarousel: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 18,
  },
  avatarCard: {
    width: 90,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: '#161C24',
    borderWidth: 1.5,
    borderColor: '#1E2632',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#202936',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarEmoji: {
    fontSize: 22,
  },
  avatarLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  avatarTag: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161C24',
    borderWidth: 1,
    borderColor: '#232D3B',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  metricCol: {
    flex: 1,
  },
  aiCard: {
    backgroundColor: '#141A22',
    borderWidth: 1,
    borderColor: '#1E2938',
    borderRadius: 18,
    padding: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  aiCardTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bmiDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#1A222E',
    padding: 12,
    borderRadius: 12,
  },
  bmiNumber: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginRight: 14,
  },
  bmiMeta: {
    flex: 1,
  },
  bmiLabel: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '600',
  },
  bmiCategory: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  aiDesc: {
    color: '#8E9BAE',
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  saveBtn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  saveBtnText: {
    color: '#0B0D0F',
    fontSize: 16,
    fontWeight: '800',
  },
});


import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { hapticImpact, hapticLight, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useProgramStore } from '@/store/programStore';
import {
  BEAST_AVATARS,
  type BeastAvatarId,
  useUserProfileStore,
} from '@/store/userProfileStore';
import { saveOnboarding } from '@/store/workoutStore';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const { language } = useI18n();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const profile = useUserProfileStore((state) => state.profile);
  const updateProfile = useUserProfileStore((state) => state.updateProfile);

  const [name, setName] = useState(profile.name);
  const [sex, setSex] = useState<'male' | 'female'>(
    profile.sex === 'female' ? 'female' : 'male'
  );
  const [selectedAvatar, setSelectedAvatar] = useState<BeastAvatarId>(profile.avatar);
  const [customAvatarUri, setCustomAvatarUri] = useState<string | undefined>(
    profile.customAvatarUri
  );
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
      setSex(profile.sex === 'female' ? 'female' : 'male');
      setSelectedAvatar(profile.avatar);
      setCustomAvatarUri(profile.customAvatarUri);
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

  const handlePickFromGallery = async () => {
    hapticLight();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted && perm.status !== 'granted') {
        Alert.alert(
          language === 'uk' ? 'Потрібен дозвіл' : 'Permission Required',
          language === 'uk'
            ? 'Дозвольте доступ до фотогалереї в налаштуваннях телефона, щоб обрати аватар.'
            : 'Please grant photo library access in your device settings to choose an avatar.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        hapticSuccess();
        setCustomAvatarUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert(
        language === 'uk' ? 'Помилка' : 'Error',
        language === 'uk'
          ? 'Не вдалося відкрити галерею.'
          : 'Could not open photo library.'
      );
    }
  };

  const handleTakePhoto = async () => {
    hapticLight();
    try {
      const perm =
        typeof ImagePicker.requestCameraPermissionsAsync === 'function'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : { granted: true, status: 'granted' };

      if (!perm.granted && perm.status !== 'granted') {
        Alert.alert(
          language === 'uk' ? 'Потрібен дозвіл' : 'Permission Required',
          language === 'uk'
            ? 'Дозвольте доступ до камери в налаштуваннях телефона, щоб зробити фото.'
            : 'Please grant camera access in your device settings to take a photo.'
        );
        return;
      }

      const result =
        typeof ImagePicker.launchCameraAsync === 'function'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.75,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.75,
            });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        hapticSuccess();
        setCustomAvatarUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert(
        language === 'uk' ? 'Помилка' : 'Error',
        language === 'uk'
          ? 'Не вдалося відкрити камеру.'
          : 'Could not open camera.'
      );
    }
  };

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
    const finalName = name.trim().length > 0 ? name.trim().slice(0, 20) : profile.name.slice(0, 20);

    await updateProfile({
      name: finalName,
      sex,
      avatar: selectedAvatar,
      customAvatarUri: customAvatarUri || undefined,
      weightKg: Math.round(finalWeightKg * 10) / 10,
      heightCm: finalHeightCm,
    });

    await saveOnboarding({
      name: finalName,
      sex,
      weightKg: Math.round(finalWeightKg * 10) / 10,
      heightCm: finalHeightCm,
    }).catch(() => undefined);

    // Refresh program generator with new body metrics
    await useProgramStore.getState().refreshProgram();

    onClose();
  };

  const beastKeys = Object.keys(BEAST_AVATARS) as BeastAvatarId[];
  const activeBeast = BEAST_AVATARS[selectedAvatar] ?? BEAST_AVATARS.wolf;

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
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* 1. Custom Photo Upload (Camera / Gallery) + Preview */}
              <Text style={styles.inputLabel}>
                {language === 'uk' ? 'ФОТО ПРОФІЛЮ АБО АВАТАР' : 'PROFILE PHOTO OR AVATAR'}
              </Text>
              <View style={styles.photoPickerCard}>
                <View
                  style={[
                    styles.currentAvatarPreview,
                    { backgroundColor: activeBeast.color },
                  ]}
                >
                  {customAvatarUri ? (
                    <Image
                      source={{ uri: customAvatarUri }}
                      style={styles.currentAvatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.currentAvatarEmoji}>{activeBeast.emoji}</Text>
                  )}
                </View>

                <View style={styles.photoActionsCol}>
                  <View style={styles.photoButtonsRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={handlePickFromGallery}
                      style={({ pressed }) => [
                        styles.photoActionBtn,
                        styles.photoActionBtnPrimary,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Ionicons name="images-outline" size={16} color={colors.onPrimary} />
                      <Text style={styles.photoActionBtnPrimaryText}>
                        {language === 'uk' ? 'З галереї' : 'Gallery'}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      onPress={handleTakePhoto}
                      style={({ pressed }) => [
                        styles.photoActionBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Ionicons name="camera-outline" size={16} color={colors.text} />
                      <Text style={styles.photoActionBtnText}>
                        {language === 'uk' ? 'Камера' : 'Camera'}
                      </Text>
                    </Pressable>
                  </View>

                  {customAvatarUri ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        hapticLight();
                        setCustomAvatarUri(undefined);
                      }}
                      style={styles.removePhotoBtn}
                    >
                      <Ionicons name="trash-outline" size={13} color={colors.danger} />
                      <Text style={styles.removePhotoText}>
                        {language === 'uk'
                          ? 'Видалити фото й повернути звіра'
                          : 'Remove photo & use beast avatar'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.photoHintText}>
                      {language === 'uk'
                        ? 'Завантажте власне фото або оберіть тотемного звіра нижче'
                        : 'Upload your own photo or pick a beast avatar below'}
                    </Text>
                  )}
                </View>
              </View>

              {/* 2. Beast Avatar Selector */}
              <Text style={styles.inputLabel}>
                {language === 'uk' ? 'АБО ОБЕРІТЬ ТОТЕМНОГО ЗВІРА' : 'OR CHOOSE YOUR BEAST AVATAR'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.avatarCarousel}
              >
                {beastKeys.map((key) => {
                  const b = BEAST_AVATARS[key];
                  const isSelected = !customAvatarUri && selectedAvatar === key;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      onPress={() => {
                        hapticImpact();
                        setSelectedAvatar(key);
                        setCustomAvatarUri(undefined);
                      }}
                      style={[
                        styles.avatarCard,
                        isSelected && {
                          borderColor: b.color,
                          backgroundColor: colors.primaryMuted,
                        },
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
                          isSelected && { color: colors.text, fontWeight: '700' },
                        ]}
                      >
                        {b.label}
                      </Text>
                      <Text style={styles.avatarTag}>{b.tag}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* 3. Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {language === 'uk' ? "ІМ'Я" : 'FULL NAME'}
                </Text>
                <View style={styles.inputBox}>
                  <Ionicons name="person-outline" size={18} color={colors.secondary} style={styles.inputIcon} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={language === 'uk' ? "Введіть ваше ім'я" : 'Enter your name'}
                    placeholderTextColor={colors.muted}
                    style={styles.textInput}
                    autoCapitalize="words"
                    maxLength={20}
                  />
                </View>
              </View>

              {/* 3b. Sex Selector (Male / Female) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {language === 'uk' ? 'СТАТЬ' : 'SEX'}
                </Text>
                <View style={styles.sexRow}>
                  {([
                    { value: 'male', label: language === 'uk' ? 'Чоловіча' : 'Male', icon: 'male-outline' },
                    { value: 'female', label: language === 'uk' ? 'Жіноча' : 'Female', icon: 'female-outline' },
                  ] as const).map((opt) => {
                    const isActive = sex === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        accessibilityRole="button"
                        onPress={() => {
                          hapticLight();
                          setSex(opt.value);
                        }}
                        style={[styles.sexBtn, isActive && styles.sexBtnActive]}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={16}
                          color={isActive ? colors.primaryText : colors.secondary}
                        />
                        <Text style={[styles.sexBtnText, isActive && styles.sexBtnTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 4. Body Metrics (Weight & Height) */}
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
                      color={colors.secondary}
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
                      color={colors.secondary}
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

              {/* 5. Body Stats Card */}
              <View style={styles.aiCard}>
                <View style={styles.aiCardHeader}>
                  <View style={styles.aiIconWrap}>
                    <MaterialCommunityIcons name="scale-bathroom" size={17} color={colors.primaryText} />
                  </View>
                  <Text style={styles.aiCardTitle}>
                    {language === 'uk' ? 'КАЛІБРУВАННЯ РОБОЧИХ ВАГ' : 'LOAD CALIBRATION'}
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
                    ? 'SPOT автоматично адаптує стартові ваги на штанзі та таймер відпочинку під вашу масу тіла.'
                    : 'SPOT calibrates your compound lift baselines and recovery timers based on your body mass.'}
                </Text>
              </View>
            </ScrollView>

            {/* 6. Save Button */}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '92%',
      paddingBottom: Platform.OS === 'ios' ? 12 : 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
    },
    inputLabel: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    photoPickerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.elevated,
      borderRadius: 18,
      padding: 14,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    currentAvatarPreview: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.accentLine,
    },
    currentAvatarImage: {
      width: '100%',
      height: '100%',
    },
    currentAvatarEmoji: {
      fontSize: 32,
    },
    photoActionsCol: {
      flex: 1,
      gap: 8,
    },
    photoButtonsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    photoActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 38,
      borderRadius: 11,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
    },
    photoActionBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    photoActionBtnText: {
      color: colors.text,
      fontSize: 12.5,
      fontWeight: '700',
    },
    photoActionBtnPrimaryText: {
      color: colors.onPrimary,
      fontSize: 12.5,
      fontWeight: '800',
    },
    photoHintText: {
      color: colors.secondary,
      fontSize: 11.5,
      lineHeight: 15,
    },
    removePhotoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 2,
    },
    removePhotoText: {
      color: colors.danger,
      fontSize: 11.5,
      fontWeight: '600',
    },
    avatarCarousel: {
      flexDirection: 'row',
      gap: 10,
      paddingBottom: 18,
    },
    avatarCard: {
      width: 88,
      paddingVertical: 11,
      paddingHorizontal: 6,
      borderRadius: 16,
      backgroundColor: colors.elevated,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    avatarEmoji: {
      fontSize: 22,
    },
    avatarLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 2,
    },
    avatarTag: {
      color: colors.muted,
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
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      height: 50,
    },
    inputIcon: {
      marginRight: 10,
    },
    textInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 14,
      marginBottom: 18,
    },
    sexRow: {
      flexDirection: 'row',
      gap: 10,
    },
    sexBtn: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.elevated,
      borderWidth: 1.5,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    sexBtnActive: {
      borderColor: colors.accentLine,
      backgroundColor: colors.primaryMuted,
    },
    sexBtnText: {
      color: colors.secondary,
      fontSize: 13.5,
      fontWeight: '700',
    },
    sexBtnTextActive: {
      color: colors.primaryText,
      fontWeight: '800',
    },
    metricCol: {
      flex: 1,
    },
    aiCard: {
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      marginTop: 2,
      marginBottom: 8,
    },
    aiCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    aiIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    aiCardTitle: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    bmiDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bmiNumber: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '900',
      marginRight: 14,
      fontVariant: ['tabular-nums'],
    },
    bmiMeta: {
      flex: 1,
    },
    bmiLabel: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: '600',
    },
    bmiCategory: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 2,
    },
    aiDesc: {
      color: colors.secondary,
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
    },
    saveBtnPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.985 }],
    },
    saveBtnText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
  });

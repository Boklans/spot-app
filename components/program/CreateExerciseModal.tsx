import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@/constants/colors';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import type { EquipmentId } from '@/lib/programGenerator';
import { formatWeight, useWeightUnit } from '@/lib/weightUtils';
import { useCustomExercisesStore, type CustomExercise } from '@/store/customExercisesStore';
import type { LibraryExercise } from '@/lib/exerciseLibrary';

const MUSCLE_GROUPS: Array<'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core'> = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
];

const EQUIPMENT_OPTIONS: Array<{ id: EquipmentId; labelUk: string; labelEn: string }> = [
  { id: 'machines', labelUk: 'Тренажер / Блок', labelEn: 'Machine / Cable' },
  { id: 'barbell', labelUk: 'Штанга', labelEn: 'Barbell' },
  { id: 'dumbbells', labelUk: 'Гантелі', labelEn: 'Dumbbells' },
  { id: 'bodyweight', labelUk: 'Власна вага', labelEn: 'Bodyweight' },
];

type CreateExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (exercise: LibraryExercise) => void;
};

export function CreateExerciseModal({
  visible,
  onClose,
  onCreated,
}: CreateExerciseModalProps) {
  const { tm, language } = useI18n();
  const { unit, unitLabel, fromKg, toKg } = useWeightUnit();
  const addCustomExercise = useCustomExercisesStore((state) => state.addCustomExercise);

  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core'>('Chest');
  const [equipment, setEquipment] = useState<EquipmentId>('machines');
  const [sets, setSets] = useState(3);
  const [repRange, setRepRange] = useState('8-12');
  const [weightText, setWeightText] = useState(unit === 'lbs' ? '45' : '20');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setMuscleGroup('Chest');
    setEquipment('machines');
    setSets(3);
    setRepRange('8-12');
    setWeightText(unit === 'lbs' ? '45' : '20');
    setImageUri(null);
    setIsSubmitting(false);
  };

  const handlePickImage = async () => {
    hapticLight();
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          language === 'uk' ? 'Потрібен дозвіл' : 'Permission Required',
          language === 'uk'
            ? 'Дозвольте доступ до галереї, щоб обрати фото для вправи.'
            : 'Please grant media library access to pick an exercise photo.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert(
        language === 'uk' ? 'Помилка' : 'Error',
        language === 'uk' ? 'Не вдалося завантажити зображення' : 'Failed to pick image'
      );
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert(
        language === 'uk' ? 'Введіть назву' : 'Name Required',
        language === 'uk'
          ? 'Будь ласка, вкажіть назву для вашої вправи.'
          : 'Please enter a name for your custom exercise.'
      );
      return;
    }

    setIsSubmitting(true);
    hapticSuccess();

    const displayWeight = parseFloat(weightText.replace(',', '.')) || 0;
    const defaultWeightKg = toKg(displayWeight);
    const weightInc = equipment === 'barbell' ? 2.5 : equipment === 'dumbbells' ? 1 : 2.5;

    const created = await addCustomExercise({
      name: trimmedName,
      muscleGroup,
      equipment,
      weightIncrement: weightInc,
      defaultSets: sets,
      defaultRepRange: repRange,
      defaultWeight: defaultWeightKg,
      customImageUri: imageUri || undefined,
    });

    const libraryEx: LibraryExercise = {
      id: created.id,
      name: created.name,
      muscleGroup: created.muscleGroup,
      equipment: created.equipment,
      weightIncrement: created.weightIncrement,
      defaultSets: created.defaultSets,
      defaultRepRange: created.defaultRepRange,
      defaultWeight: created.defaultWeight,
      customImageUri: created.customImageUri,
      isCustom: true,
    };

    resetForm();
    onCreated(libraryEx);
  };

  const handleClose = () => {
    hapticLight();
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>
                {language === 'uk' ? 'ВЛАСНА ВПРАВА' : 'CUSTOM EXERCISE'}
              </Text>
              <Text style={styles.title}>
                {language === 'uk' ? 'Створити вправу' : 'Create Exercise'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={handleClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              hitSlop={12}
            >
              <Ionicons name="close" size={24} color="#8E959F" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Image Upload Section */}
            <View style={styles.imageSection}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Upload custom exercise photo"
                onPress={handlePickImage}
                style={styles.imagePickerBtn}
              >
                {imageUri ? (
                  <View style={styles.imagePreviewWrap}>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                    <View style={styles.imageBadge}>
                      <Ionicons name="camera" size={14} color="#0B0D0F" />
                      <Text style={styles.imageBadgeText}>
                        {language === 'uk' ? 'ЗМІНИТИ' : 'CHANGE'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <View style={styles.imageIconCircle}>
                      <Ionicons name="camera-outline" size={28} color={colors.primary} />
                    </View>
                    <Text style={styles.imagePlaceholderText}>
                      {language === 'uk' ? '+ Завантажити фото вправи' : '+ Add Exercise Photo'}
                    </Text>
                    <Text style={styles.imagePlaceholderSub}>
                      {language === 'uk' ? 'З галереї вашого пристрою' : 'From your device gallery'}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* 2. Exercise Name Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {language === 'uk' ? 'НАЗВА ВПРАВИ' : 'EXERCISE NAME'}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={
                  language === 'uk'
                    ? 'напр. Жим під кутом у Хаммері'
                    : 'e.g. Incline Hammer Chest Press'
                }
                placeholderTextColor="#6C7A8E"
                value={name}
                onChangeText={setName}
                autoFocus={true}
              />
            </View>

            {/* 3. Target Muscle Group */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {language === 'uk' ? 'ЦІЛЬОВИЙ М’ЯЗ' : 'TARGET MUSCLE GROUP'}
              </Text>
              <View style={styles.pillsRow}>
                {MUSCLE_GROUPS.map((m) => {
                  const isSelected = muscleGroup === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => {
                        hapticLight();
                        setMuscleGroup(m);
                      }}
                      style={[styles.pill, isSelected && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                        {tm(m)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 4. Equipment */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {language === 'uk' ? 'ОБЛАДНАННЯ' : 'EQUIPMENT'}
              </Text>
              <View style={styles.pillsRow}>
                {EQUIPMENT_OPTIONS.map((eq) => {
                  const isSelected = equipment === eq.id;
                  return (
                    <Pressable
                      key={eq.id}
                      onPress={() => {
                        hapticLight();
                        setEquipment(eq.id);
                      }}
                      style={[styles.pill, isSelected && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                        {language === 'uk' ? eq.labelUk : eq.labelEn}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 5. Default Sets & Reps */}
            <View style={styles.rowTwoCols}>
              {/* Sets Stepper */}
              <View style={[styles.section, { flex: 1 }]}>
                <Text style={styles.sectionLabel}>
                  {language === 'uk' ? 'ПІДХОДИ' : 'SETS'}
                </Text>
                <View style={styles.stepperRow}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setSets((s) => Math.max(1, s - 1));
                    }}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="remove" size={18} color="#FFFFFF" />
                  </Pressable>
                  <View style={styles.stepValueBox}>
                    <Text style={styles.stepValueText}>{sets}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setSets((s) => Math.min(10, s + 1));
                    }}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>

              {/* Target Weight */}
              <View style={[styles.section, { flex: 1.2 }]}>
                <Text style={styles.sectionLabel}>
                  {language === 'uk' ? 'СТАРТОВА ВАГА' : 'START WEIGHT'} ({unitLabel})
                </Text>
                <View style={styles.stepperRow}>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      const curr = parseFloat(weightText.replace(',', '.')) || 0;
                      const next = Math.max(0, Math.round((curr - (unit === 'lbs' ? 5 : 2.5)) * 10) / 10);
                      setWeightText(formatWeight(next));
                    }}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="remove" size={18} color="#FFFFFF" />
                  </Pressable>
                  <View style={styles.weightInputBox}>
                    <TextInput
                      style={styles.weightInputText}
                      keyboardType="numeric"
                      value={weightText}
                      onChangeText={setWeightText}
                      placeholder="0"
                      placeholderTextColor="#6C7A8E"
                    />
                  </View>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      const curr = parseFloat(weightText.replace(',', '.')) || 0;
                      const next = Math.round((curr + (unit === 'lbs' ? 5 : 2.5)) * 10) / 10;
                      setWeightText(formatWeight(next));
                    }}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Rep Range Pills */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {language === 'uk' ? 'ПОВТОРЕННЯ' : 'TARGET REPS'}
              </Text>
              <View style={styles.pillsRow}>
                {['6-8', '8-10', '8-12', '10-12', '12-15'].map((r) => {
                  const isSelected = repRange === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => {
                        hapticLight();
                        setRepRange(r);
                      }}
                      style={[styles.pill, isSelected && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                        {r}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 6. Save Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create Exercise"
              disabled={isSubmitting}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.createBtn,
                pressed && styles.createBtnPressed,
                isSubmitting && { opacity: 0.6 },
              ]}
            >
              <Ionicons name="add-circle" size={20} color="#0B0D0F" style={{ marginRight: 8 }} />
              <Text style={styles.createBtnText}>
                {language === 'uk' ? 'СТВОРИТИ ВПРАВУ' : 'CREATE EXERCISE'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0D0F',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A212D',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#161B24',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#242B35',
  },
  pressed: {
    opacity: 0.7,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  imageSection: {
    marginBottom: 20,
  },
  imagePickerBtn: {
    width: '100%',
    height: 150,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#242B35',
    borderStyle: 'dashed',
    backgroundColor: '#11151C',
  },
  imagePreviewWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  imageBadgeText: {
    color: '#0B0D0F',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  imageIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  imagePlaceholderText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 2,
  },
  imagePlaceholderSub: {
    fontSize: 12,
    color: '#8E959F',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E959F',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#151922',
    borderWidth: 1,
    borderColor: '#242B35',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#151922',
    borderWidth: 1,
    borderColor: '#242B35',
  },
  pillActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.12)',
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E959F',
  },
  pillTextActive: {
    color: colors.primary,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    width: 40,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1A212D',
    borderWidth: 1,
    borderColor: '#242B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValueBox: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#242B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValueText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  weightInputBox: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#242B35',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  weightInputText: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
    textAlign: 'center',
    width: '100%',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  createBtnPressed: {
    opacity: 0.85,
  },
  createBtnText: {
    color: '#0B0D0F',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

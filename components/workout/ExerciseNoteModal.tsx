import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { hapticLight, hapticSuccess } from '@/lib/haptics';

interface ExerciseNoteModalProps {
  visible: boolean;
  exerciseName: string;
  initialNote: string;
  language: string;
  onClose: () => void;
  onSave: (note: string) => void;
}

function getPresetsForExercise(exerciseName: string, isUk: boolean): string[] {
  const lower = (exerciseName || '').toLowerCase();
  const isFreeWeightLowerOrPull =
    lower.includes('присідання') ||
    lower.includes('squat') ||
    lower.includes('румунська') ||
    lower.includes('станова') ||
    lower.includes('deadlift') ||
    lower.includes('випади') ||
    lower.includes('lunge') ||
    lower.includes('тяга штанги') ||
    lower.includes('barbell row');

  if (isFreeWeightLowerOrPull) {
    return isUk
      ? [
          'Висота стійок — 10',
          'Пояс / лямки',
          'Тримати спину нейтрально',
          'Пауза 1 сек унизу',
          'Не підвищувати вагу через дискомфорт',
        ]
      : [
          'Rack height — 10',
          'Belt / straps',
          'Keep neutral spine',
          '1 sec pause at bottom',
          'Hold weight due to joint discomfort',
        ];
  }

  const isPress =
    lower.includes('жим') ||
    lower.includes('press') ||
    lower.includes('віджимання') ||
    lower.includes('push-up') ||
    lower.includes('брус') ||
    lower.includes('dip');

  if (isPress) {
    return isUk
      ? [
          'Спинка — кут 30°',
          'Висота стійок — 6',
          'Звести лопатки',
          'Лікті під кутом 45°',
          'Не підвищувати вагу через дискомфорт',
        ]
      : [
          'Bench — 30° incline',
          'Rack height — 6',
          'Retract scapula',
          'Elbows at 45°',
          'Hold weight due to joint discomfort',
        ];
  }

  return isUk
    ? [
        'Сидіння — рівень 4',
        'Нейтральний хват',
        'Валик — рівень 3',
        'Звести лопатки',
        'Не підвищувати вагу через дискомфорт',
      ]
    : [
        'Seat — level 4',
        'Neutral grip',
        'Pad — level 3',
        'Retract scapula',
        'Hold weight due to joint discomfort',
      ];
}

export function ExerciseNoteModal({
  visible,
  exerciseName,
  initialNote,
  language,
  onClose,
  onSave,
}: ExerciseNoteModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUk = language === 'uk';
  const [text, setText] = useState(initialNote);

  useEffect(() => {
    if (visible) {
      setText(initialNote);
    }
  }, [visible, initialNote]);

  if (!visible) return null;

  const presets = getPresetsForExercise(exerciseName, isUk);

  const appendPreset = (preset: string) => {
    hapticLight();
    setText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return preset;
      if (trimmed.toLowerCase().includes(preset.toLowerCase())) return trimmed;
      return `${trimmed}, ${preset.charAt(0).toLowerCase() + preset.slice(1)}`;
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>
                {isUk ? 'ПОСТІЙНА НОТАТКА ДО ВПРАВИ' : 'PERSISTENT EXERCISE NOTE'}
              </Text>
              <Text numberOfLines={1} style={styles.title}>
                {exerciseName}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={colors.secondary} />
            </Pressable>
          </View>

          <Text style={styles.helperText}>
            {isUk
              ? 'Зберігається між тренуваннями (налаштування тренажера, хват, самопочуття):'
              : 'Saved across all future workouts (machine settings, grip, joint cues):'}
          </Text>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={
              isUk
                ? 'Напр.: сидіння — рівень 4, нейтральний хват...'
                : 'E.g., seat level 4, neutral grip...'
            }
            placeholderTextColor="#64748B"
            multiline
            maxLength={180}
            autoFocus
            style={styles.input}
          />

          <View style={styles.presetsWrap}>
            {presets.map((chip) => (
              <Pressable
                key={chip}
                onPress={() => appendPreset(chip)}
                style={({ pressed }) => [
                  styles.presetChip,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="add" size={12} color={colors.primaryText} />
                <Text style={styles.presetChipText}>{chip}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actionsRow}>
            {text.trim().length > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticLight();
                  setText('');
                }}
                style={styles.clearBtn}
              >
                <Ionicons name="trash-outline" size={16} color="#94A3B8" />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>
                {isUk ? 'Скасувати' : 'Cancel'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticSuccess();
                onSave(text.trim());
                onClose();
              }}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>
                {isUk ? 'Зберегти' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kicker: {
    color: colors.primaryText,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 74,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  presetsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  presetChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1.3,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
});

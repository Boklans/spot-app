import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
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
import { colors } from '@/constants/colors';
import { hapticLight, hapticSuccess } from '@/lib/haptics';

interface ExerciseNoteModalProps {
  visible: boolean;
  exerciseName: string;
  initialNote: string;
  language: string;
  onClose: () => void;
  onSave: (note: string) => void;
}

const PRESETS_UK = [
  'Сидіння — рівень 4',
  'Нейтральний хват',
  'Спинка — кут 30°',
  'Звести лопатки',
  'Не підвищувати вагу через дискомфорт',
];

const PRESETS_EN = [
  'Seat — level 4',
  'Neutral grip',
  'Bench — 30° incline',
  'Retract scapula',
  'Hold weight due to joint discomfort',
];

export function ExerciseNoteModal({
  visible,
  exerciseName,
  initialNote,
  language,
  onClose,
  onSave,
}: ExerciseNoteModalProps) {
  const isUk = language === 'uk';
  const [text, setText] = useState(initialNote);

  useEffect(() => {
    if (visible) {
      setText(initialNote);
    }
  }, [visible, initialNote]);

  if (!visible) return null;

  const presets = isUk ? PRESETS_UK : PRESETS_EN;

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
              <Ionicons name="close" size={20} color="#CBD5E1" />
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
                <Ionicons name="add" size={12} color={colors.primary} />
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

const styles = StyleSheet.create({
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
    backgroundColor: '#13171F',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(182, 240, 0, 0.25)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kicker: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C222D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#0D1015',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262F3D',
    color: '#FFFFFF',
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
    backgroundColor: '#1B222D',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#2A3444',
    gap: 3,
  },
  presetChipText: {
    color: '#CBD5E1',
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
    backgroundColor: '#1B222D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1B222D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#CBD5E1',
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
    color: '#0B0D0F',
    fontSize: 14,
    fontWeight: '900',
  },
});

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useThemeColors, ThemeColors } from '@/constants/colors';
import { hapticImpact, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useBodyWeightStore } from '@/store/bodyWeightStore';
import { useUserProfileStore } from '@/store/userProfileStore';

interface LogWeightModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function LogWeightModal({ visible, onClose, onSaved }: LogWeightModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { language } = useI18n();
  const profile = useUserProfileStore((state) => state.profile);
  const addEntry = useBodyWeightStore((state) => state.addEntry);

  const [weightInput, setWeightInput] = useState('');
  const [note, setNote] = useState('');

  const isLbs = profile.weightUnit === 'lbs';

  useEffect(() => {
    if (visible) {
      const baseWeight = isLbs
        ? Math.round(profile.weightKg * 2.20462 * 10) / 10
        : profile.weightKg;
      setWeightInput(baseWeight.toString());
      setNote('');
    }
  }, [visible, profile.weightKg, isLbs]);

  const handleAdjust = (delta: number) => {
    hapticImpact();
    const current = parseFloat(weightInput) || (isLbs ? profile.weightKg * 2.20462 : profile.weightKg);
    const next = Math.max(30, Math.round((current + delta) * 10) / 10);
    setWeightInput(next.toString());
  };

  const handleSave = async () => {
    const val = parseFloat(weightInput);
    if (!val || val <= 0) return;

    hapticSuccess();
    const weightKg = isLbs ? val / 2.20462 : val;
    await addEntry(weightKg, undefined, note.trim() || undefined);
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
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
              <View style={styles.headerTitleWrap}>
                <MaterialCommunityIcons
                  name="scale-bathroom"
                  size={22}
                  color={colors.primaryText}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.title}>
                  {language === 'uk' ? 'Зафіксувати вагу' : 'Log Bodyweight'}
                </Text>
              </View>
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

            <View style={styles.content}>
              {/* Giant Weight Input Readout */}
              <View style={styles.weightBox}>
                <TextInput
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="numeric"
                  style={styles.weightInput}
                  selectTextOnFocus
                  maxLength={6}
                />
                <Text style={styles.weightUnit}>{isLbs ? 'LBS' : 'KG'}</Text>
              </View>

              {/* Quick Steppers */}
              <View style={styles.stepperRow}>
                {[-0.5, -0.1, 0.1, 0.5].map((delta) => (
                  <Pressable
                    key={delta}
                    accessibilityRole="button"
                    onPress={() => handleAdjust(delta)}
                    style={({ pressed }) => [
                      styles.stepperBtn,
                      pressed && styles.stepperBtnPressed,
                    ]}
                  >
                    <Text style={styles.stepperText}>
                      {delta > 0 ? `+${delta}` : delta}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Optional Note */}
              <View style={styles.noteBox}>
                <Ionicons name="document-text-outline" size={16} color={colors.secondary} style={{ marginRight: 8 }} />
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={language === 'uk' ? 'Нотатка (напр. ранкове зважування)' : 'Note (e.g. fasted morning)'}
                  placeholderTextColor={colors.muted}
                  style={styles.noteInput}
                  maxLength={50}
                />
              </View>

              {/* Quick Today Indicator */}
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.secondary} />
                <Text style={styles.dateText}>
                  {language === 'uk' ? 'Сьогодні' : 'Today'},{' '}
                  {new Date().toLocaleDateString(language === 'uk' ? 'uk-UA' : 'en-US', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>

              {/* Save Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save Weight"
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && styles.saveBtnPressed,
                ]}
              >
                <Text style={styles.saveBtnText}>
                  {language === 'uk' ? 'Зберегти вагу' : 'Log Weight'}
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
      backgroundColor: 'rgba(0, 0, 0, 0.72)',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    keyboardAvoid: {
      justifyContent: 'center',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
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
    headerTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      alignItems: 'center',
    },
    weightBox: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      marginBottom: 16,
    },
    weightInput: {
      color: colors.text,
      fontSize: 48,
      fontWeight: '900',
      minWidth: 120,
      textAlign: 'center',
    },
    weightUnit: {
      color: colors.secondary,
      fontSize: 20,
      fontWeight: '800',
      marginLeft: 6,
    },
    stepperRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 18,
      width: '100%',
    },
    stepperBtn: {
      flex: 1,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperBtnPressed: {
      opacity: 0.75,
    },
    stepperText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    noteBox: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      height: 44,
      marginBottom: 12,
    },
    noteInput: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 20,
    },
    dateText: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: '500',
    },
    saveBtn: {
      width: '100%',
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
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

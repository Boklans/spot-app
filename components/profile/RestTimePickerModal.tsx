import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticImpact, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';

export interface RestOption {
  seconds: number;
  label: string;
  subLabelEn: string;
  subLabelUk: string;
}

const REST_OPTIONS: RestOption[] = [
  {
    seconds: 0,
    label: '0:00 (0s)',
    subLabelEn: 'No rest · Supersets & circuits',
    subLabelUk: 'Без відпочинку · Суперсети та кругові',
  },
  {
    seconds: 15,
    label: '0:15 (15s)',
    subLabelEn: 'Micro-rest, drop sets, intense pace',
    subLabelUk: 'Мікро-відпочинок, дроп-сети, темп',
  },
  {
    seconds: 30,
    label: '0:30 (30s)',
    subLabelEn: 'Short rest, high intensity & endurance',
    subLabelUk: 'Короткий відпочинок, витривалість',
  },
  {
    seconds: 60,
    label: '1:00 (60s)',
    subLabelEn: 'Fast pace, metabolic conditioning, calves',
    subLabelUk: 'Швидкий темп, пампінг, литки',
  },
  {
    seconds: 90,
    label: '1:30 (90s)',
    subLabelEn: 'Hypertrophy & isolation exercises',
    subLabelUk: 'Гіпертрофія та ізоляційні вправи',
  },
  {
    seconds: 120,
    label: '2:00 (120s)',
    subLabelEn: 'Standard compound balance',
    subLabelUk: 'Збалансований базовий темп',
  },
  {
    seconds: 150,
    label: '2:30 (150s)',
    subLabelEn: 'SPOT recommended default for muscle & strength',
    subLabelUk: 'Рекомендовано SPOT для сили та маси',
  },
  {
    seconds: 180,
    label: '3:00 (180s)',
    subLabelEn: 'Heavy bench press, squats, rows',
    subLabelUk: 'Важкий жим, присідання, тяги',
  },
  {
    seconds: 240,
    label: '4:00 (240s)',
    subLabelEn: 'Maximal power & heavy deadlifts',
    subLabelUk: 'Максимальна сила та важка станова тяга',
  },
];

interface RestTimePickerModalProps {
  visible: boolean;
  currentSeconds: number;
  onSelect: (seconds: number) => void;
  onClose: () => void;
}

export function RestTimePickerModal({
  visible,
  currentSeconds,
  onSelect,
  onClose,
}: RestTimePickerModalProps) {
  const { t, language } = useI18n();
  const isCustomInitially = !REST_OPTIONS.some((opt) => opt.seconds === currentSeconds);
  const [customValue, setCustomValue] = useState<number>(currentSeconds || 90);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(isCustomInitially);

  const formatMinSec = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCustomDelta = (delta: number) => {
    hapticImpact();
    setCustomValue((prev) => Math.max(0, Math.min(600, prev + delta)));
  };

  const handleSaveCustom = () => {
    hapticSuccess();
    onSelect(customValue);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>{t('restTimerSetting')}</Text>
              <Text style={styles.headerSubtitle}>
                {language === 'uk'
                  ? 'Оберіть тривалість відпочинку між підходами'
                  : 'Choose default rest duration between sets'}
              </Text>
            </View>
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

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {REST_OPTIONS.map((option) => {
              const isSelected = !isCustomMode && option.seconds === currentSeconds;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.seconds}
                  onPress={() => {
                    hapticImpact();
                    setIsCustomMode(false);
                    onSelect(option.seconds);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.optionCard,
                    isSelected && styles.optionCardActive,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.optionLeft}>
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelActive]}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionSub}>
                      {language === 'uk' ? option.subLabelUk : option.subLabelEn}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={16} color="#0B0D0F" />
                    </View>
                  )}
                </Pressable>
              );
            })}

            {/* Custom Option Card */}
            <View
              style={[
                styles.customCard,
                (isCustomMode || !REST_OPTIONS.some((opt) => opt.seconds === currentSeconds)) &&
                  styles.customCardActive,
              ]}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  hapticImpact();
                  setIsCustomMode(true);
                }}
                style={styles.customCardHeader}
              >
                <View style={styles.optionLeft}>
                  <Text
                    style={[
                      styles.optionLabel,
                      (isCustomMode || !REST_OPTIONS.some((opt) => opt.seconds === currentSeconds)) &&
                        styles.optionLabelActive,
                    ]}
                  >
                    {language === 'uk' ? 'Власний варіант' : 'Custom Rest Duration'}
                  </Text>
                  <Text style={styles.optionSub}>
                    {language === 'uk'
                      ? 'Введіть будь-яку кількість секунд'
                      : 'Set custom seconds suited to your training'}
                  </Text>
                </View>
                {(isCustomMode || !REST_OPTIONS.some((opt) => opt.seconds === currentSeconds)) && (
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={16} color="#0B0D0F" />
                  </View>
                )}
              </Pressable>

              {/* Custom Controller */}
              <View style={styles.customControls}>
                <View style={styles.stepperRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleCustomDelta(-15)}
                    style={({ pressed }) => [styles.stepBtn, pressed && styles.cardPressed]}
                  >
                    <Text style={styles.stepBtnText}>-15s</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleCustomDelta(-5)}
                    style={({ pressed }) => [styles.stepBtn, pressed && styles.cardPressed]}
                  >
                    <Text style={styles.stepBtnText}>-5s</Text>
                  </Pressable>

                  <View style={styles.customValueBox}>
                    <Text style={styles.customValueMain}>{formatMinSec(customValue)}</Text>
                    <Text style={styles.customValueSec}>({customValue}s)</Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleCustomDelta(5)}
                    style={({ pressed }) => [styles.stepBtn, pressed && styles.cardPressed]}
                  >
                    <Text style={styles.stepBtnText}>+5s</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleCustomDelta(15)}
                    style={({ pressed }) => [styles.stepBtn, pressed && styles.cardPressed]}
                  >
                    <Text style={styles.stepBtnText}>+15s</Text>
                  </Pressable>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleSaveCustom}
                  style={({ pressed }) => [styles.saveCustomBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.saveCustomBtnText}>
                    {language === 'uk' ? `Встановити ${formatMinSec(customValue)}` : `Set ${formatMinSec(customValue)}`}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F1318',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A222D',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: '#8E9BAE',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#1E2633',
  },
  content: {
    padding: 20,
    gap: 10,
    paddingBottom: 30,
  },
  optionCard: {
    backgroundColor: '#141A23',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2836',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionCardActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    borderColor: colors.primary,
  },
  cardPressed: {
    opacity: 0.85,
  },
  optionLeft: {
    flex: 1,
    paddingRight: 12,
  },
  optionLabel: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '700',
  },
  optionLabelActive: {
    color: colors.primary,
  },
  optionSub: {
    color: '#8E9BAE',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCard: {
    backgroundColor: '#141A23',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2836',
    marginTop: 4,
  },
  customCardActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.06)',
    borderColor: colors.primary,
  },
  customCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customControls: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepBtn: {
    backgroundColor: '#1C2430',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3A4B',
  },
  stepBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  customValueBox: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  customValueMain: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  customValueSec: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '600',
  },
  saveCustomBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  saveCustomBtnText: {
    color: '#0B0D0F',
    fontSize: 14,
    fontWeight: '800',
  },
});

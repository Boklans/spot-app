import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticImpact } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';

export interface ReminderTimeOption {
  time: string; // "09:00"
  label: string;
  subLabelEn: string;
  subLabelUk: string;
}

export const REMINDER_TIME_OPTIONS: ReminderTimeOption[] = [
  {
    time: '07:00',
    label: '07:00',
    subLabelEn: 'Early bird start before work',
    subLabelUk: 'Ранній старт перед роботою',
  },
  {
    time: '08:00',
    label: '08:00',
    subLabelEn: 'Morning focus & energy boost',
    subLabelUk: 'Ранковий заряд енергії',
  },
  {
    time: '09:00',
    label: '09:00',
    subLabelEn: 'SPOT default recommended time',
    subLabelUk: 'Рекомендовано SPOT за замовчуванням',
  },
  {
    time: '10:00',
    label: '10:00',
    subLabelEn: 'Mid-morning training check',
    subLabelUk: 'Для тренувань у першій половині дня',
  },
  {
    time: '12:00',
    label: '12:00',
    subLabelEn: 'Lunch break workout',
    subLabelUk: 'Тренування в обідню перерву',
  },
  {
    time: '17:00',
    label: '17:00',
    subLabelEn: 'End of workday prep',
    subLabelUk: 'Підготовка до залу після роботи',
  },
  {
    time: '18:00',
    label: '18:00',
    subLabelEn: 'Prime evening workout',
    subLabelUk: 'Вечірній час для залу',
  },
  {
    time: '19:00',
    label: '19:00',
    subLabelEn: 'Evening session reminder',
    subLabelUk: 'Нагадування про вечірній сет',
  },
  {
    time: '20:00',
    label: '20:00',
    subLabelEn: 'Late night training',
    subLabelUk: 'Для пізніх тренувань',
  },
];

interface ReminderTimePickerModalProps {
  visible: boolean;
  currentTime: string;
  onSelect: (time: string) => void;
  onClose: () => void;
}

export function ReminderTimePickerModal({
  visible,
  currentTime,
  onSelect,
  onClose,
}: ReminderTimePickerModalProps) {
  const { t, language } = useI18n();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>{t('reminderTime')}</Text>
              <Text style={styles.headerSubtitle}>
                {language === 'uk'
                  ? 'Оберіть час отримання сповіщення у дні тренувань'
                  : 'Choose when to receive your workout reminder'}
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
            {REMINDER_TIME_OPTIONS.map((option) => {
              const isSelected = option.time === currentTime;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.time}
                  onPress={() => {
                    hapticImpact();
                    onSelect(option.time);
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
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#11161B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
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
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#8E9BAE',
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A212B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161C24',
    borderWidth: 1,
    borderColor: '#1F2833',
    borderRadius: 14,
    padding: 16,
  },
  optionCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#1A241F',
  },
  cardPressed: {
    opacity: 0.8,
  },
  optionLeft: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  optionLabelActive: {
    color: colors.primary,
  },
  optionSub: {
    color: '#8E9BAE',
    fontSize: 13,
    lineHeight: 18,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


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
import { hapticImpact, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';

export interface RestOption {
  seconds: number;
  label: string;
  subLabel: string;
}

const REST_OPTIONS: RestOption[] = [
  { seconds: 60, label: '1:00 (60s)', subLabel: 'Fast pace, metabolic conditioning, calves' },
  { seconds: 90, label: '1:30 (90s)', subLabel: 'Hypertrophy & isolation exercises' },
  { seconds: 120, label: '2:00 (120s)', subLabel: 'Standard compound balance' },
  { seconds: 150, label: '2:30 (150s)', subLabel: 'SPOT recommended default for muscle & strength' },
  { seconds: 180, label: '3:00 (180s)', subLabel: 'Heavy bench press, squats, rows' },
  { seconds: 240, label: '4:00 (240s)', subLabel: 'Maximal power & heavy deadlifts' },
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
  const { t } = useI18n();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>{t('restTimer')}</Text>
              <Text style={styles.headerSubtitle}>Choose default rest duration between sets</Text>
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
              const isSelected = option.seconds === currentSeconds;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.seconds}
                  onPress={() => {
                    hapticImpact();
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
                    <Text style={styles.optionSub}>{option.subLabel}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F1318',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
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
});


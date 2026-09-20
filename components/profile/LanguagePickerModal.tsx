import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticImpact } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import type { AppLanguage } from '@/store/userProfileStore';

interface LanguageOption {
  id: AppLanguage;
  label: string;
  subLabel: string;
  flag: string;
}

const LANGUAGES: LanguageOption[] = [
  { id: 'uk', label: 'Українська', subLabel: 'Українська мова інтерфейсу', flag: '🇺🇦' },
  { id: 'en', label: 'English', subLabel: 'English app interface', flag: '🇺🇸' },
];

interface LanguagePickerModalProps {
  visible: boolean;
  currentLanguage: AppLanguage;
  onSelect: (lang: AppLanguage) => void;
  onClose: () => void;
}

export function LanguagePickerModal({
  visible,
  currentLanguage,
  onSelect,
  onClose,
}: LanguagePickerModalProps) {
  const { t } = useI18n();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>{t('language')}</Text>
              <Text style={styles.headerSubtitle}>Select your preferred interface language</Text>
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

          <View style={styles.content}>
            {LANGUAGES.map((item) => {
              const isSelected = item.id === currentLanguage;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => {
                    hapticImpact();
                    onSelect(item.id);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.optionCard,
                    isSelected && styles.optionCardActive,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.flagWrap}>
                    <Text style={styles.flagText}>{item.flag}</Text>
                  </View>
                  <View style={styles.optionLeft}>
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelActive]}>
                      {item.label}
                    </Text>
                    <Text style={styles.optionSub}>{item.subLabel}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={16} color="#0B0D0F" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
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
    gap: 12,
  },
  optionCard: {
    backgroundColor: '#141A23',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2836',
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionCardActive: {
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
    borderColor: colors.primary,
  },
  cardPressed: {
    opacity: 0.85,
  },
  flagWrap: {
    marginRight: 14,
  },
  flagText: {
    fontSize: 26,
  },
  optionLeft: {
    flex: 1,
  },
  optionLabel: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '700',
  },
  optionLabelActive: {
    color: colors.primary,
  },
  optionSub: {
    color: '#8E9BAE',
    fontSize: 12,
    marginTop: 3,
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


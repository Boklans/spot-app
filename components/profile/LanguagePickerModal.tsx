import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
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
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
              <Ionicons name="close" size={22} color={colors.text} />
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.elevated,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  optionCard: {
    backgroundColor: colors.elevated,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionCardActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.accentLine,
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
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  optionLabelActive: {
    color: colors.primaryText,
  },
  optionSub: {
    color: colors.secondary,
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


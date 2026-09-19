import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { hapticSelection } from '@/lib/haptics';

type PreferencePickerModalProps<T extends string | number> = {
  visible: boolean;
  title: string;
  options: readonly T[] | T[];
  selectedValue: T;
  onSelect: (value: T) => void;
  onClose: () => void;
};

export function PreferencePickerModal<T extends string | number>({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: PreferencePickerModalProps<T>) {
  const handleSelect = (option: T) => {
    hapticSelection();
    onSelect(option);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop dismiss */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close picker"
          style={styles.backdrop}
          onPress={onClose}
        />

        {/* Bottom Sheet Content */}
        <View style={styles.sheetContainer}>
          {/* Grab Handle Indicator */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Text style={styles.closeText}>Done</Text>
            </Pressable>
          </View>

          {/* Options List */}
          <View style={styles.optionsList}>
            {options.map((option) => {
              const isSelected = option === selectedValue;
              return (
                <Pressable
                  key={String(option)}
                  accessibilityRole="button"
                  onPress={() => handleSelect(option)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    isSelected && styles.optionRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {String(option)}
                  </Text>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl + spacing.md,
    paddingHorizontal: spacing.lg,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  closeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  closeText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  optionsList: {
    gap: spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionRowSelected: {
    borderColor: 'rgba(200, 255, 61, 0.4)',
    backgroundColor: 'rgba(200, 255, 61, 0.08)',
  },
  optionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '800',
  },
  checkmark: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.6,
  },
});


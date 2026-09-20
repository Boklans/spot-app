import { PropsWithChildren } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
  style,
  textStyle,
}: PropsWithChildren<{
  onPress?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        secondary && styles.secondary,
        disabled && styles.disabled,
        style,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, secondary && styles.secondaryText, textStyle]}>
        {children}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: { minHeight: 56, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  secondary: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
  text: { color: colors.background, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  secondaryText: { color: colors.secondary, fontWeight: '600' },
});

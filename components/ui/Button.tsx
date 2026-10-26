import { PropsWithChildren } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { useThemeColors } from '@/constants/colors';
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
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: secondary ? 'transparent' : colors.primary },
        disabled && styles.disabled,
        style,
        pressed && styles.pressed,
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          style={[
            styles.text,
            { color: secondary ? colors.secondary : colors.onPrimary },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    includeFontPadding: false,
  },
});

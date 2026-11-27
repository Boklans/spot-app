import React, { PropsWithChildren, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { useThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { spacing } from '@/constants/spacing';
import { fonts } from '@/constants/typography';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hapticLight, hapticMedium } from '@/lib/haptics';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  children,
  onPress,
  variant,
  secondary = false,
  size = 'lg',
  disabled = false,
  loading = false,
  haptic = true,
  style,
  textStyle,
}: PropsWithChildren<{
  onPress?: () => void;
  variant?: ButtonVariant;
  secondary?: boolean;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}>) {
  const colors = useThemeColors();
  const reducedMotion = useReducedMotion();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const resolvedVariant: ButtonVariant = variant ?? (secondary ? 'ghost' : 'primary');
  const isDisabled = disabled || loading;

  const handlePressIn = () => {
    if (isDisabled || reducedMotion) return;
    Animated.spring(scaleAnim, {
      toValue: 0.975,
      useNativeDriver: true,
      damping: 26,
      stiffness: 420,
    }).start();
  };

  const handlePressOut = () => {
    if (reducedMotion) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 340,
    }).start();
  };

  const handlePress = () => {
    if (isDisabled) return;
    if (haptic) {
      if (resolvedVariant === 'primary' || resolvedVariant === 'danger') {
        hapticMedium();
      } else {
        hapticLight();
      }
    }
    onPress?.();
  };

  const containerVariantStyle: ViewStyle = (() => {
    switch (resolvedVariant) {
      case 'secondary':
        return {
          backgroundColor: colors.elevated,
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
      case 'danger':
        return {
          backgroundColor: colors.isDark ? 'rgba(248, 113, 113, 0.14)' : '#FEF2F2',
          borderWidth: 1,
          borderColor: colors.danger,
        };
      case 'primary':
      default:
        return {
          backgroundColor: colors.primary,
          ...(!colors.isDark
            ? { borderWidth: 1, borderColor: '#A3E635' }
            : null),
        };
    }
  })();

  const labelColor = (() => {
    switch (resolvedVariant) {
      case 'secondary':
      case 'outline':
        return colors.text;
      case 'ghost':
        return colors.secondary;
      case 'danger':
        return colors.danger;
      case 'primary':
      default:
        return colors.onPrimary;
    }
  })();

  const sizeStyle: ViewStyle =
    size === 'sm'
      ? { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radii.sm }
      : size === 'md'
        ? { minHeight: 46, paddingHorizontal: spacing.lg, borderRadius: radii.md }
        : { minHeight: 54, paddingHorizontal: spacing.xl, borderRadius: radii.md };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.base,
          sizeStyle,
          containerVariantStyle,
          isDisabled && styles.disabled,
          style,
          pressed && styles.pressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={labelColor} />
        ) : typeof children === 'string' ? (
          <Text
            style={[
              styles.text,
              size === 'sm' && { fontSize: 13 },
              { color: labelColor },
              textStyle,
            ]}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.82 },
  text: {
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: 0.2,
    textAlign: 'center',
    includeFontPadding: false,
  },
});

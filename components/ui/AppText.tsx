import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useThemeColors } from '@/constants/colors';
import { fonts, typography, type TypographyVariant } from '@/constants/typography';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  tabular?: boolean;
  align?: TextStyle['textAlign'];
}

/**
 * Canonical SPOT 2.0 Typography Primitive.
 * Enforces exact `Inter` / `JetBrains Mono` font families without synthetic `fontWeight`
 * fallback bugs, `includeFontPadding: false`, and hardware-aligned tabular numerals.
 */
export function AppText({
  variant = 'body',
  color,
  tabular = false,
  align,
  style,
  children,
  ...rest
}: AppTextProps) {
  const colors = useThemeColors();
  const baseStyle = typography[variant] ?? typography.body;

  return (
    <Text
      {...rest}
      style={[
        baseStyle,
        { color: color ?? colors.text },
        tabular && {
          fontFamily:
            baseStyle.fontFamily === fonts.monoSemiBold || baseStyle.fontFamily === fonts.monoBold
              ? baseStyle.fontFamily
              : fonts.monoSemiBold,
          fontVariant: ['tabular-nums'],
        },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hapticLight } from '@/lib/haptics';

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
}

interface SlidingSegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  /** 'pill' = compact rounded pill (e.g. Load/Recovery); 'bar' = full-width tab bar (e.g. Analytics) */
  variant?: 'pill' | 'bar';
  /** Use high-contrast active chip fill (lime/black) vs elevated surface fill */
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * 60fps native-driven spring sliding segmented control.
 * Respects OS Reduce Motion and provides subtle haptic feedback.
 */
export function SlidingSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = 'bar',
  accent = false,
  style,
}: SlidingSegmentedControlProps<T>) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors, variant, accent), [colors, variant, accent]);
  const reducedMotion = useReducedMotion();

  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.key === value)
  );
  const [trackWidth, setTrackWidth] = useState(0);
  const padding = 3;
  const segmentWidth =
    trackWidth > padding * 2 ? (trackWidth - padding * 2) / Math.max(1, options.length) : 0;

  const translateX = useRef(new Animated.Value(0)).current;
  const hasMeasuredRef = useRef(false);

  useEffect(() => {
    if (segmentWidth <= 0) return;
    const targetX = activeIndex * segmentWidth;
    if (!hasMeasuredRef.current || reducedMotion) {
      hasMeasuredRef.current = true;
      translateX.setValue(targetX);
      return;
    }
    Animated.spring(translateX, {
      toValue: targetX,
      stiffness: 340,
      damping: 28,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, segmentWidth, reducedMotion, translateX]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - trackWidth) > 0.5) {
      setTrackWidth(w);
    }
  };

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              transform: [{ translateX }],
            },
          ]}
        />
      )}
      {options.map((opt) => {
        const isActive = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={opt.label}
            onPress={() => {
              if (opt.key === value) return;
              hapticLight();
              onChange(opt.key);
            }}
            style={styles.segmentBtn}
          >
            <Text
              numberOfLines={1}
              style={[styles.segmentText, isActive && styles.segmentTextActive]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors, variant: 'pill' | 'bar', accent: boolean) => {
  const isPill = variant === 'pill';
  const indicatorBg = accent
    ? colors.activeChipBg
    : colors.isDark
      ? colors.elevated
      : colors.surface;
  const activeTextColor = accent ? colors.activeChipText : colors.text;

  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
      backgroundColor: isPill
        ? colors.elevated
        : colors.isDark
          ? colors.surface
          : colors.elevated,
      borderRadius: isPill ? radii.pill : radii.sm + 2,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    indicator: {
      position: 'absolute',
      top: 3,
      bottom: 3,
      left: 3,
      borderRadius: isPill ? radii.pill : radii.xs + 3,
      backgroundColor: indicatorBg,
      ...(colors.isDark
        ? {}
        : {
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: accent ? 0.12 : 0.06,
            shadowRadius: 3,
            elevation: 1,
          }),
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: isPill ? 5.5 : 8,
      paddingHorizontal: isPill ? 4 : 6,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    segmentText: {
      fontFamily: fonts.semiBold,
      fontSize: isPill ? 11.5 : 12.5,
      fontWeight: '600',
      color: colors.secondary,
      textAlign: 'center',
      includeFontPadding: false,
    },
    segmentTextActive: {
      fontFamily: fonts.bold,
      color: activeTextColor,
      fontWeight: '700',
    },
  });
};

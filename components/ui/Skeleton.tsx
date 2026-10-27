import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { cardElevation, useThemeColors, type ThemeColors } from '@/constants/colors';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const colors = useThemeColors();
  const pulseAnim = useRef(new Animated.Value(0.42)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.88,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.42,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const baseColor = colors.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)';

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

export function HomeSkeleton() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {/* Main Workout Card Skeleton */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Skeleton width={96} height={14} borderRadius={6} />
          <Skeleton width={88} height={24} borderRadius={12} />
        </View>
        <Skeleton width="68%" height={26} borderRadius={8} style={{ marginTop: 14 }} />
        <Skeleton width="82%" height={14} borderRadius={6} style={{ marginTop: 10, marginBottom: 18 }} />

        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.exRow, i > 0 && styles.exRowBorder]}>
            <Skeleton width={22} height={14} borderRadius={4} />
            <Skeleton width="58%" height={15} borderRadius={6} />
            <Skeleton width={56} height={15} borderRadius={6} />
          </View>
        ))}
      </View>

      {/* Primary CTA Button Skeleton */}
      <Skeleton width="100%" height={56} borderRadius={14} style={{ marginBottom: 22 }} />

      {/* Weekly Tracker Skeleton */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Skeleton width={110} height={15} borderRadius={6} />
          <Skeleton width={90} height={14} borderRadius={6} />
        </View>
        <View style={[styles.rowBetween, { marginTop: 18 }]}>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <View key={d} style={styles.dayCol}>
              <Skeleton width={32} height={32} borderRadius={16} />
              <Skeleton width={20} height={11} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function AnalyticsSkeleton() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {/* 3-Metric Summary Strip Skeleton */}
      <View style={[styles.card, styles.stripRow]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.stripCol}>
            <Skeleton width={48} height={24} borderRadius={7} />
            <Skeleton width={68} height={12} borderRadius={5} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>

      {/* Main Chart Card Skeleton */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ gap: 8, flex: 1 }}>
            <Skeleton width={120} height={13} borderRadius={5} />
            <Skeleton width="62%" height={22} borderRadius={7} />
          </View>
          <Skeleton width={84} height={32} borderRadius={10} />
        </View>
        <Skeleton width="100%" height={175} borderRadius={14} style={{ marginTop: 18 }} />
      </View>

      {/* Secondary Card Skeleton */}
      <View style={styles.card}>
        <Skeleton width="48%" height={16} borderRadius={6} />
        <Skeleton width="85%" height={13} borderRadius={5} style={{ marginTop: 10 }} />
        <Skeleton width="70%" height={13} borderRadius={5} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

export function ActiveWorkoutSkeleton() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingHorizontal: 16, paddingTop: 12 }]}>
      {/* Top Bar Skeleton */}
      <View style={[styles.rowBetween, { marginBottom: 14 }]}>
        <Skeleton width={36} height={36} borderRadius={10} />
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Skeleton width={140} height={16} borderRadius={6} />
          <Skeleton width={60} height={13} borderRadius={5} />
        </View>
        <Skeleton width={38} height={16} borderRadius={6} />
      </View>

      <Skeleton width="100%" height={4} borderRadius={2} style={{ marginBottom: 20 }} />

      {/* Exercise Card Skeleton */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <Skeleton width={48} height={48} borderRadius={12} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width={80} height={12} borderRadius={5} />
            <Skeleton width="78%" height={18} borderRadius={6} />
          </View>
        </View>

        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.rowBetween, { paddingVertical: 10 }]}>
            <Skeleton width={24} height={18} borderRadius={5} />
            <Skeleton width={70} height={16} borderRadius={5} />
            <Skeleton width={68} height={34} borderRadius={10} />
            <Skeleton width={60} height={34} borderRadius={10} />
            <Skeleton width={34} height={34} borderRadius={10} />
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
      ...cardElevation(colors),
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    exRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
      gap: 10,
    },
    exRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    dayCol: {
      alignItems: 'center',
    },
    stripRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: 16,
    },
    stripCol: {
      alignItems: 'center',
    },
  });

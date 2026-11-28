import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingWorkoutBar } from '@/components/workout/FloatingWorkoutBar';
import { useThemeColors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hapticLight } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';

function AnimatedTabIcon({
  name,
  size,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size: number;
  color: string;
  focused: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevFocusedRef = useRef(focused);

  useEffect(() => {
    if (focused && !prevFocusedRef.current && !reducedMotion) {
      scaleAnim.setValue(0.84);
      Animated.spring(scaleAnim, {
        toValue: 1,
        stiffness: 380,
        damping: 18,
        mass: 0.7,
        useNativeDriver: true,
      }).start();
    }
    prevFocusedRef.current = focused;
  }, [focused, reducedMotion, scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const bottomPad =
    Platform.OS === 'ios'
      ? Math.max(insets.bottom - 6, 22)
      : Platform.OS === 'android'
        ? Math.max(insets.bottom, 10)
        : 8;
  const tabBarHeight =
    Platform.OS === 'ios'
      ? 58 + bottomPad
      : Platform.OS === 'android'
        ? 56 + bottomPad
        : 66;

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <Tabs
        screenListeners={{
          tabPress: () => {
            hapticLight();
          },
        }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.isDark ? colors.primary : colors.text,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            elevation: 0,
            height: tabBarHeight,
            paddingTop: Platform.OS === 'web' ? 4 : 8,
            paddingBottom: bottomPad,
          },
          tabBarItemStyle: {
            paddingVertical: Platform.OS === 'web' ? 2 : 0,
          },
          tabBarIconStyle: Platform.OS === 'web' ? { height: 22 } : undefined,
          tabBarLabelStyle: {
            fontFamily: fonts.semiBold,
            fontSize: 11,
            lineHeight: 14,
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabHome'),
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabIcon
                name={focused ? 'flash' : 'flash-outline'}
                size={size}
                color={color as string}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="program"
          options={{
            title: t('tabProgram'),
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabIcon
                name={focused ? 'calendar' : 'calendar-outline'}
                size={size}
                color={color as string}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: t('tabAnalytics'),
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabIcon
                name={focused ? 'stats-chart' : 'stats-chart-outline'}
                size={size}
                color={color as string}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabProfile'),
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabIcon
                name={focused ? 'person' : 'person-outline'}
                size={size}
                color={color as string}
                focused={focused}
              />
            ),
          }}
        />
      </Tabs>

      {/* Global Floating Workout Mini-Player & Live Rest Timer across all tabs */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: tabBarHeight,
          zIndex: 60,
        }}
      >
        <FloatingWorkoutBar />
      </View>
    </View>
  );
}

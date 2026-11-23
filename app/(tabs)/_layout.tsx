import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingWorkoutBar } from '@/components/workout/FloatingWorkoutBar';
import { useThemeColors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { useI18n } from '@/lib/i18n';

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
            fontWeight: '600',
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
              <Ionicons name={focused ? 'flash' : 'flash-outline'} size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="program"
          options={{
            title: t('tabProgram'),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: t('tabAnalytics'),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabProfile'),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color as string} />
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

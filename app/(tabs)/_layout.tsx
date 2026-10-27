import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import { FloatingWorkoutBar } from '@/components/workout/FloatingWorkoutBar';
import { useThemeColors } from '@/constants/colors';
import { useI18n } from '@/lib/i18n';

export default function TabsLayout() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const tabBarHeight = Platform.OS === 'ios' ? 88 : 68;

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
            paddingTop: 8,
            paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
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

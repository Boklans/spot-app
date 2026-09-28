import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { colors } from '@/constants/colors';
import { loadAsync } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '@/store/authStore';

export default function RootLayout() {
  useEffect(() => {
    loadAsync({
      ...Ionicons.font,
      ...MaterialCommunityIcons.font,
    }).catch(() => undefined);

    useAuthStore.getState().init();
    import('@/lib/notificationService')
      .then(({ initNotifications, scheduleWorkoutDayReminders }) => {
        initNotifications().then(() => {
          scheduleWorkoutDayReminders().catch(() => undefined);
        });
      })
      .catch(() => undefined);
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

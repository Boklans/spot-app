import React, { useEffect, useMemo } from 'react';
import { Stack, ThemeProvider, DarkTheme, DefaultTheme, type ErrorBoundaryProps } from 'expo-router';
import { Pressable, StatusBar, LogBox, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useThemeColors } from '@/constants/colors';
import { useUserProfileStore } from '@/store/userProfileStore';
import { loadAsync } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import {
  initNotifications,
  scheduleWorkoutDayReminders,
  startLiveWorkoutNotificationSync,
} from '@/lib/notificationService';

LogBox.ignoreLogs(['Error configuring Purchases', 'Invalid API key']);

let bootstrapped = false;

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0B0D0F',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Text style={{ color: '#C8FF3D', fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
        SPOT
      </Text>
      <Text
        style={{
          color: '#F5F5F5',
          fontSize: 16,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        Щось пішло не так / Something went wrong
      </Text>
      <Text
        style={{
          color: '#8E959F',
          fontSize: 13,
          textAlign: 'center',
          marginBottom: 24,
        }}
      >
        {error?.message || 'Unexpected application error'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry"
        onPress={retry}
        style={{
          backgroundColor: '#C8FF3D',
          paddingHorizontal: 24,
          paddingVertical: 14,
          borderRadius: 14,
        }}
      >
        <Text style={{ color: '#0B0D0F', fontSize: 15, fontWeight: '800' }}>
          Спробувати знову / Try Again
        </Text>
      </Pressable>
    </View>
  );
}

export default function SpotAppRoot() {
  const theme = useUserProfileStore((s) => s.profile.theme) ?? 'dark';
  const colors = useThemeColors();

  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;

    loadAsync({
      ...Ionicons.font,
      ...MaterialCommunityIcons.font,
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
      Inter_800ExtraBold,
    }).catch(() => undefined);

    // Deterministic order: initialize Purchases before Auth syncUser to avoid race condition
    useSubscriptionStore
      .getState()
      .init()
      .catch(() => undefined)
      .finally(() => {
        useAuthStore.getState().init().catch(() => undefined);
      });

    useUserProfileStore.getState().loadProfile().catch(() => undefined);
    useWorkoutSessionStore.getState().hydrateSession().catch(() => undefined);

    initNotifications()
      .then(() => {
        startLiveWorkoutNotificationSync();
        return scheduleWorkoutDayReminders().catch(() => undefined);
      })
      .catch(() => undefined);
  }, []);

  const navigationTheme = useMemo(() => {
    const baseTheme = theme === 'light' ? DefaultTheme : DarkTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        primary: colors.primary,
      },
    };
  }, [theme, colors]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

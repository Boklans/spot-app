import React, { useEffect, useState } from 'react';
import { registerRouteRenderer, router, useCurrentRoute, type RouteEntry } from './shims/expo-router';
import { AlertHost } from './shims/react-native';
import { useThemeColors } from '@/constants/colors';
import { useUserProfileStore } from '@/store/userProfileStore';
import { saveOnboarding } from '@/store/workoutStore';
import { useProgramStore } from '@/store/programStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import {
  cancelRestTimerNotification,
  dismissActiveWorkoutNotification,
  getLiveShadeNotificationSnapshot,
} from '@/lib/notificationService';
import { finalizeWorkoutSession } from '@/lib/workoutFinalizer';
import { Ionicons } from '@expo/vector-icons';

import RootLayout from '../app/_layout';
import IndexScreen from '../app/index';
import TabsLayout from '../app/(tabs)/_layout';
import TodayScreen from '../app/(tabs)/index';
import ProgramScreen from '../app/(tabs)/program';
import ProgressScreen from '../app/(tabs)/progress';
import ProfileScreen from '../app/(tabs)/profile';

import WelcomeScreen from '../app/onboarding/welcome';
import GoalScreen from '../app/onboarding/goal';
import ExperienceScreen from '../app/onboarding/experience';
import FrequencyScreen from '../app/onboarding/frequency';
import EquipmentScreen from '../app/onboarding/equipment';
import ParamsScreen from '../app/onboarding/params';
import ProgramReadyScreen from '../app/onboarding/program-ready';

import EditProgramScreen from '../app/program/edit';
import WorkoutPreviewScreen from '../app/workout/preview';
import ActiveWorkoutScreen from '../app/workout/active';
import WorkoutCompleteScreen from '../app/workout/complete';
import QuickLogScreen from '../app/workout/quick-log';
import HistoryListScreen from '../app/history/index';
import HistoryDetailScreen from '../app/history/[id]';

const tabScreens: Record<string, React.ComponentType> = {
  index: TodayScreen,
  program: ProgramScreen,
  progress: ProgressScreen,
  profile: ProfileScreen,
};

function renderRoute(route: RouteEntry): React.ReactNode {
  const { pathname } = route;

  if (pathname === '/') return <IndexScreen />;
  if (pathname.startsWith('/(tabs)')) return <TabsLayout />;

  // Onboarding
  if (pathname === '/onboarding/welcome') return <WelcomeScreen />;
  if (pathname === '/onboarding/goal') return <GoalScreen />;
  if (pathname === '/onboarding/experience') return <ExperienceScreen />;
  if (pathname === '/onboarding/frequency') return <FrequencyScreen />;
  if (pathname === '/onboarding/equipment') return <EquipmentScreen />;
  if (pathname === '/onboarding/params') return <ParamsScreen />;
  if (pathname === '/onboarding/program-ready') return <ProgramReadyScreen />;

  // Program & Workout
  if (pathname === '/program/edit') return <EditProgramScreen />;
  if (pathname === '/workout/preview') return <WorkoutPreviewScreen />;
  if (pathname === '/workout/active') return <ActiveWorkoutScreen />;
  if (pathname === '/workout/complete') return <WorkoutCompleteScreen />;
  if (pathname === '/workout/quick-log') return <QuickLogScreen />;

  // History
  if (pathname === '/history' || pathname === '/history/index') return <HistoryListScreen />;
  if (pathname.startsWith('/history/')) return <HistoryDetailScreen />;

  return <TabsLayout />;
}

registerRouteRenderer(renderRoute, tabScreens);

export default function App() {
  const colors = useThemeColors();
  const theme = useUserProfileStore((s) => s.profile?.theme) ?? 'dark';
  const updateProfile = useUserProfileStore((s) => s.updateProfile);
  const session = useWorkoutSessionStore((s) => s.session);
  const restEndsAt = useWorkoutSessionStore((s) => s.restEndsAt);
  const currentRoute = useCurrentRoute();
  const isOnboarding = currentRoute.pathname.startsWith('/onboarding');

  const [showShadePreview, setShowShadePreview] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const hasActiveSession = Boolean(session && !session.completed);

  useEffect(() => {
    if (!hasActiveSession) {
      setShowShadePreview(false);
      return;
    }
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasActiveSession, restEndsAt]);

  const shadeSnapshot = hasActiveSession ? getLiveShadeNotificationSnapshot(nowMs) : null;

  const toggleTheme = () => {
    void updateProfile({ theme: theme === 'light' ? 'dark' : 'light' });
  };

  const handleQuickJump = async () => {
    if (isOnboarding) {
      await saveOnboarding({ completed: true });
      await useProgramStore.getState().getOrLoadProgram();
      router.replace('/(tabs)');
    } else {
      router.push('/onboarding/welcome');
    }
  };

  const handleShadeCompleteSet = async () => {
    useWorkoutSessionStore.getState().completeCurrentSet();
    const updated = useWorkoutSessionStore.getState().session;
    if (updated && updated.completed) {
      setShowShadePreview(false);
      await dismissActiveWorkoutNotification();
      await finalizeWorkoutSession(updated);
      router.replace('/workout/complete');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: colors.isDark ? '#07090B' : '#DFE5EE',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        transition: 'background-color 0.2s ease',
        position: 'relative',
      }}
    >
      {/* Quick Preview Controls in Top-Right */}
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {hasActiveSession && (
          <button
            onClick={() => setShowShadePreview((prev) => !prev)}
            title="Перевірити системну шторку сповіщень Android під час тренування"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${showShadePreview ? colors.primary : colors.border}`,
              backgroundColor: showShadePreview
                ? colors.primaryMuted
                : colors.surface,
              color: colors.text,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: colors.isDark
                ? '0 8px 20px rgba(0, 0, 0, 0.5)'
                : '0 8px 20px rgba(15, 23, 42, 0.10)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#22C55E',
                display: 'inline-block',
              }}
            />
            <span>Шторка ОС</span>
          </button>
        )}

        {isOnboarding && (
          <button
            onClick={handleQuickJump}
            title="Перейти одразу на головний екран застосунку"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              color: colors.primaryText,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: colors.isDark
                ? '0 8px 20px rgba(0, 0, 0, 0.5)'
                : '0 8px 20px rgba(15, 23, 42, 0.10)',
            }}
          >
            <Ionicons name="flash" size={15} color={colors.primaryText} />
            <span>В додаток</span>
          </button>
        )}

        <button
          onClick={toggleTheme}
          title="Перемкнути тему (Dark / Light)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: colors.isDark
              ? '0 8px 20px rgba(0, 0, 0, 0.5)'
              : '0 8px 20px rgba(15, 23, 42, 0.10)',
          }}
        >
          <Ionicons
            name={colors.isDark ? 'sunny-outline' : 'moon-outline'}
            size={16}
            color={colors.isDark ? colors.primary : colors.text}
          />
          <span>{colors.isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 430,
          height: '100vh',
          maxHeight: 932,
          backgroundColor: colors.background,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: colors.isDark
            ? '0 24px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.07)'
            : '0 24px 60px rgba(15,23,42,0.14), 0 0 0 1px rgba(15,23,42,0.08)',
        }}
      >
        {/* Simulated Android System Notification Shade when toggled in Web Preview */}
        {showShadePreview && shadeSnapshot && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              right: 10,
              zIndex: 9500,
              backgroundColor: '#161920',
              borderRadius: 20,
              border: '1px solid rgba(200, 255, 61, 0.35)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.75)',
              padding: '14px 16px 12px',
              color: '#F5F5F5',
            }}
          >
            {/* OS Notification Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    backgroundColor: '#C8FF3D',
                    color: '#0B0D0F',
                    fontSize: 10,
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  S
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#9CA3AF' }}>
                  SPOT • {shadeSnapshot.lang === 'uk' ? 'Активна сесія (Шторка Android)' : 'Live Session (OS Shade)'}
                </span>
              </div>

              <button
                onClick={() => setShowShadePreview(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* Notification Title & Body */}
            <div style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFF', marginBottom: 4 }}>
              {shadeSnapshot.title}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#C4CBD4', marginBottom: 12 }}>
              {shadeSnapshot.body}
            </div>

            {/* Progress bar inside shade */}
            <div
              style={{
                height: 4,
                width: '100%',
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.1)',
                overflow: 'hidden',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${shadeSnapshot.progressPercent}%`,
                  backgroundColor: '#C8FF3D',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            {/* Interactive OS Shade Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {shadeSnapshot.mode === 'resting' ? (
                <>
                  <button
                    onClick={() => useWorkoutSessionStore.getState().addRestTime(-15)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.12)',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      color: '#F5F5F5',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {shadeSnapshot.lang === 'uk' ? '-15 сек' : '-15s'}
                  </button>
                  <button
                    onClick={() => useWorkoutSessionStore.getState().addRestTime(30)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.12)',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      color: '#F5F5F5',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {shadeSnapshot.lang === 'uk' ? '+30 сек' : '+30s'}
                  </button>
                  <button
                    onClick={() => {
                      useWorkoutSessionStore.getState().skipRest();
                      void cancelRestTimerNotification();
                    }}
                    style={{
                      flex: 1.2,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: 'none',
                      backgroundColor: '#C8FF3D',
                      color: '#0B0D0F',
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    {shadeSnapshot.lang === 'uk' ? 'Пропустити' : 'Skip'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => void handleShadeCompleteSet()}
                    style={{
                      flex: 1.4,
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: 'none',
                      backgroundColor: '#C8FF3D',
                      color: '#0B0D0F',
                      fontSize: 12.5,
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    {shadeSnapshot.lang === 'uk' ? '✓ Завершити сет' : '✓ Complete Set'}
                  </button>
                  <button
                    onClick={() => {
                      setShowShadePreview(false);
                      router.push('/workout/active');
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.14)',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      color: '#F5F5F5',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {shadeSnapshot.lang === 'uk' ? 'До тренування' : 'Open Workout'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <RootLayout />
        <AlertHost />
      </div>
    </div>
  );
}

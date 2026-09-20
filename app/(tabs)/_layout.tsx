import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useI18n } from '@/lib/i18n';

const icons = {
  index: 'home-outline',
  progress: 'trending-up-outline',
  program: 'layers-outline',
  profile: 'person-outline',
} as const;

export default function TabsLayout() {
  const { t } = useI18n();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 78,
          paddingTop: 10,
          paddingBottom: 14,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={icons[route.name as keyof typeof icons] || 'ellipse-outline'}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: t('tabHome') }} />
      <Tabs.Screen name="progress" options={{ title: t('tabAnalytics') }} />
      <Tabs.Screen name="program" options={{ title: t('tabProgram') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabProfile') }} />
    </Tabs>
  );
}

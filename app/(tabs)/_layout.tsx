import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

const icons = { index: 'home-outline', progress: 'trending-up-outline', program: 'layers-outline', profile: 'person-outline' } as const;
export default function TabsLayout() { return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 78, paddingTop: 10, paddingBottom: 14 }, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' }, tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name as keyof typeof icons] || 'ellipse-outline'} size={size} color={color} /> })}><Tabs.Screen name="index" options={{ title: 'Home' }} /><Tabs.Screen name="progress" options={{ title: 'Progress' }} /><Tabs.Screen name="program" options={{ title: 'Program' }} /><Tabs.Screen name="profile" options={{ title: 'Profile' }} /></Tabs>; }

import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { loadOnboarding } from '@/store/workoutStore';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

export default function Index() {
	useEffect(() => {
		let mounted = true;
		Promise.all([loadOnboarding(), useWorkoutSessionStore.getState().hydrateSession()]).then(([data]) => {
			if (!mounted) return;
			router.replace(data?.completed ? '/(tabs)' : '/onboarding/welcome');
		}).catch(() => {
			if (!mounted) return;
			router.replace('/onboarding/welcome');
		});

		return () => { mounted = false; };
	}, []);

	return <Screen scroll={false} style={styles.loading}><Text style={styles.logo}>SPOT</Text><Text style={styles.message}>Loading your training...</Text></Screen>;
}

const styles = StyleSheet.create({ loading: { alignItems: 'center', justifyContent: 'center' }, logo: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: 5 }, message: { color: colors.secondary, fontSize: 14, marginTop: spacing.md } });

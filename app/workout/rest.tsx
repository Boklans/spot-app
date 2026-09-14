import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RestTimer } from '@/components/workout/RestTimer';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

export default function Rest() {
	const session = useWorkoutSessionStore((state) => state.session);
	const restEndsAt = useWorkoutSessionStore((state) => state.restEndsAt);
	const restNextType = useWorkoutSessionStore((state) => state.restNextType);
	const addRestTime = useWorkoutSessionStore((state) => state.addRestTime);
	const skipRest = useWorkoutSessionStore((state) => state.skipRest);
	const [now, setNow] = useState(Date.now());
	const seconds = Math.max(0, Math.ceil(((restEndsAt ?? Date.now()) - now) / 1000));

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	if (!session) {
		return <Screen><Text style={styles.empty}>No active workout.</Text><Button onPress={() => router.replace('/(tabs)')}>BACK HOME</Button></Screen>;
	}

	const exercise = session.exercises[session.currentExerciseIndex];
	const nextSet = exercise.sets[session.currentSetIndex];

	const continueWorkout = () => {
		skipRest();
		router.replace('/workout/active');
	};
	const handleClose = () => {
		const completedSets = session.exercises.reduce((total, item) => total + item.sets.filter((set) => set.completed).length, 0);
		if (completedSets === 0) {
			router.replace('/(tabs)');
			return;
		}
		Alert.alert('ABANDON WORKOUT?', 'Your current workout progress will be saved so you can resume it later.', [
			{ text: 'KEEP WORKOUT', style: 'cancel' },
			{ text: 'EXIT WORKOUT', style: 'destructive', onPress: () => router.replace('/(tabs)') },
		]);
	};
	const isReady = seconds === 0;
	const nextLabel = restNextType === 'exercise' ? 'NEXT EXERCISE' : 'NEXT SET';

	return <Screen style={styles.screen}>
		<Pressable accessibilityRole="button" hitSlop={12} onPress={handleClose} style={styles.closeButton}><Text style={styles.close}>×</Text></Pressable>
		<View style={styles.main}><Text style={styles.complete}>SET COMPLETE</Text><RestTimer seconds={seconds} /><Text style={styles.ready}>{isReady ? `READY FOR ${nextLabel}` : 'REST TIME'}</Text></View>
		<View style={styles.actions}><Card style={styles.nextCard}><Text style={styles.nextCardLabel}>{nextLabel}</Text><Text style={styles.nextExercise}>{exercise.name}</Text><Text style={styles.nextCardValue}>Set {session.currentSetIndex + 1} of {exercise.sets.length}  •  {nextSet.weight ? `${nextSet.weight} kg` : 'Bodyweight'} × {nextSet.targetReps}</Text></Card>{!isReady && <View style={styles.buttons}><Button secondary onPress={() => addRestTime(30)}>+30 SEC</Button></View>}<Button onPress={continueWorkout}>{isReady ? 'CONTINUE' : 'SKIP REST'}</Button></View>
	</Screen>;
}

const styles = StyleSheet.create({ screen: { paddingTop: spacing.xl }, closeButton: { minHeight: 44, justifyContent: 'center', width: 44 }, close: { color: colors.secondary, fontSize: 30 }, main: { alignItems: 'center', marginTop: spacing.huge }, complete: { color: colors.primary, fontSize: 12, letterSpacing: 1.6, fontWeight: '900' }, ready: { color: colors.success, fontSize: 14, letterSpacing: 1.1, fontWeight: '900', marginTop: spacing.xl }, actions: { marginTop: 'auto' }, nextCard: { marginBottom: spacing.md }, nextCardLabel: { color: colors.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1 }, nextExercise: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: spacing.sm }, nextCardValue: { color: colors.secondary, fontSize: 14, marginTop: spacing.sm }, buttons: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.sm }, empty: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.xl } });

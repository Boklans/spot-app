import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
	const addRestTime = useWorkoutSessionStore((state) => state.addRestTime);
	const skipRest = useWorkoutSessionStore((state) => state.skipRest);
	const [now, setNow] = useState(Date.now());
	const seconds = Math.max(0, Math.ceil(((restEndsAt ?? Date.now()) - now) / 1000));

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		if (restEndsAt !== null && seconds === 0) {
			skipRest();
			router.replace('/workout/active');
		}
	}, [restEndsAt, seconds, skipRest]);

	if (!session) {
		return <Screen><Text style={styles.empty}>No active workout.</Text><Button onPress={() => router.replace('/(tabs)')}>BACK HOME</Button></Screen>;
	}

	const exercise = session.exercises[session.currentExerciseIndex];
	const nextSet = exercise.sets[session.currentSetIndex];

	const leaveRest = () => {
		skipRest();
		router.replace('/workout/active');
	};

	return <Screen style={styles.screen}>
		<Pressable accessibilityRole="button" hitSlop={12} onPress={leaveRest} style={styles.closeButton}><Text style={styles.close}>×</Text></Pressable>
		<View style={styles.main}><Text style={styles.complete}>SET COMPLETE</Text><RestTimer seconds={seconds} /><Text style={styles.nextLabel}>NEXT SET</Text><Text style={styles.next}>{nextSet.weight} kg × {nextSet.targetReps}</Text>{seconds === 0 && <Text style={styles.ready}>READY FOR YOUR NEXT SET</Text>}</View>
		<View style={styles.actions}><Card style={styles.nextCard}><Text style={styles.nextCardLabel}>UP NEXT</Text><Text style={styles.nextCardValue}>{exercise.name}  •  Set {session.currentSetIndex + 1}</Text></Card><View style={styles.buttons}><Button secondary onPress={() => addRestTime(30)}>+30 SEC</Button><Button secondary onPress={leaveRest}>SKIP</Button></View><Button onPress={leaveRest}>RETURN TO WORKOUT</Button></View>
	</Screen>;
}

const styles = StyleSheet.create({ screen: { paddingTop: spacing.xl }, closeButton: { minHeight: 44, justifyContent: 'center', width: 44 }, close: { color: colors.secondary, fontSize: 30 }, main: { alignItems: 'center', marginTop: spacing.huge }, complete: { color: colors.primary, fontSize: 12, letterSpacing: 1.6, fontWeight: '900' }, nextLabel: { color: colors.secondary, fontSize: 11, letterSpacing: 1.2, fontWeight: '800', marginTop: spacing.lg }, next: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: spacing.sm }, ready: { color: colors.success, fontWeight: '800', marginTop: spacing.xl }, actions: { marginTop: 'auto' }, nextCard: { marginBottom: spacing.md }, nextCardLabel: { color: colors.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1 }, nextCardValue: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: spacing.sm }, buttons: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.sm }, empty: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.xl } });

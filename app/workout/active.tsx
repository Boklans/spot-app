import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SetRow } from '@/components/workout/SetRow';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { getSessionProgress, useWorkoutSessionStore } from '@/store/workoutSessionStore';

export default function Active() {
	const session = useWorkoutSessionStore((state) => state.session);
	const completeCurrentSet = useWorkoutSessionStore((state) => state.completeCurrentSet);

	if (!session) {
		return <Screen><Text style={styles.empty}>No active workout.</Text><Button onPress={() => router.replace('/workout/preview')}>BACK TO WORKOUT</Button></Screen>;
	}

	const exercise = session.exercises[session.currentExerciseIndex];
	const activeSet = exercise.sets[session.currentSetIndex];
	const progress = getSessionProgress(session);
	const isFinalSet = session.currentSetIndex === exercise.sets.length - 1;
	const isFinalExercise = session.currentExerciseIndex === session.exercises.length - 1;

	const finishSet = () => {
		completeCurrentSet();
		if (isFinalSet && isFinalExercise) {
			router.replace('/workout/complete');
		} else {
			router.push('/workout/rest');
		}
	};

	return <Screen>
		<View style={styles.header}>
			<Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.replace('/(tabs)')} style={styles.closeButton}><Text style={styles.close}>×</Text></Pressable>
			<View style={styles.headCenter}><Text style={styles.title}>{session.workoutName}</Text><Text style={styles.progress}>EXERCISE {session.currentExerciseIndex + 1} / {session.exercises.length}</Text></View>
			<Text style={styles.percent}>{Math.round(progress.percentage)}%</Text>
		</View>
		<ProgressBar value={progress.percentage} />
		<View style={styles.exerciseHead}><Text style={styles.exercise}>{exercise.name.toUpperCase()}</Text><Text style={styles.muscle}>{exercise.muscleGroup.toUpperCase()}</Text></View>
		<Card style={styles.previous}><Text style={styles.label}>PREVIOUS WORKOUT</Text><Text style={styles.previousValue}>{exercise.previousSets.map((set) => `${set.weight} kg × ${set.reps}`).join('   ')}</Text></Card>
		<View style={styles.today}><Text style={styles.label}>TODAY</Text><Text style={styles.weight}>{activeSet.weight} <Text style={styles.unit}>KG</Text></Text><Text style={styles.target}>Target {activeSet.targetReps}</Text></View>
		<Card style={styles.sets}>{exercise.sets.map((set, index) => <SetRow key={set.id} number={index + 1} reps={set.reps} active={index === session.currentSetIndex} completed={set.completed} />)}</Card>
		<Button onPress={finishSet}>{isFinalSet && isFinalExercise ? 'FINISH WORKOUT' : 'COMPLETE SET'}</Button>
		<Pressable accessibilityRole="button" onPress={() => router.push('/workout/input')} style={styles.adjustButton}><Text style={styles.adjust}>Adjust weight or reps</Text></Pressable>
	</Screen>;
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }, closeButton: { width: 40, minHeight: 44, justifyContent: 'center' }, close: { color: colors.secondary, fontSize: 30, fontWeight: '300' }, headCenter: { alignItems: 'center' }, title: { color: colors.text, fontSize: 18, fontWeight: '800' }, progress: { color: colors.secondary, fontSize: 10, letterSpacing: 1, marginTop: 5 }, percent: { color: colors.primary, fontSize: 13, fontWeight: '800', width: 50, textAlign: 'right' }, exerciseHead: { marginTop: spacing.xxl, marginBottom: spacing.lg }, exercise: { color: colors.text, fontSize: 28, fontWeight: '900' }, muscle: { color: colors.primary, fontSize: 11, letterSpacing: 1.3, fontWeight: '800', marginTop: 7 }, previous: { padding: spacing.md, marginBottom: spacing.xxl }, label: { color: colors.secondary, fontSize: 10, letterSpacing: 1.2, fontWeight: '800' }, previousValue: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: spacing.sm }, today: { marginBottom: spacing.lg }, weight: { color: colors.text, fontSize: 46, fontWeight: '900', marginTop: spacing.sm }, unit: { color: colors.secondary, fontSize: 13 }, target: { color: colors.secondary, marginTop: 4 }, sets: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, marginBottom: spacing.lg }, adjustButton: { alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: spacing.sm }, adjust: { color: colors.muted, fontSize: 12 }, empty: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.xl } });

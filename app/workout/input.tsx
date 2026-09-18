import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { addWeight, formatWeight, subtractWeight } from '@/lib/weightUtils';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

export default function Input() {
	const session = useWorkoutSessionStore((state) => state.session);
	const updateCurrentSet = useWorkoutSessionStore((state) => state.updateCurrentSet);

	if (!session) {
		return <Screen><Text style={styles.empty}>No active workout.</Text><Button onPress={() => router.replace('/(tabs)')}>BACK HOME</Button></Screen>;
	}

	const exercise = session.exercises[session.currentExerciseIndex];
	const activeSet = exercise.sets[session.currentSetIndex];
	const increment = typeof exercise.weightIncrement === 'number' && exercise.weightIncrement > 0 ? exercise.weightIncrement : 2.5;

	return <Screen style={styles.screen}>
		<Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹  BACK TO WORKOUT</Text></Pressable>
		<Text style={styles.title}>Set your target</Text><Text style={styles.subtitle}>{exercise.name}  •  Set {session.currentSetIndex + 1}</Text>
		<Text style={styles.label}>WEIGHT</Text>
		<Card style={styles.weightCard}><Pressable accessibilityRole="button" onPress={() => updateCurrentSet({ weight: subtractWeight(activeSet.weight, increment) })} style={styles.control}><Text style={styles.controlText}>−</Text></Pressable><View style={styles.weightValue}><Text style={styles.weight}>{formatWeight(activeSet.weight)}</Text><Text style={styles.unit}>KG</Text></View><Pressable accessibilityRole="button" onPress={() => updateCurrentSet({ weight: addWeight(activeSet.weight, increment) })} style={styles.control}><Text style={styles.controlText}>+</Text></Pressable></Card>
		<Text style={styles.label}>TARGET REPS</Text>
		<View style={styles.reps}>{[6, 7, 8, 9, 10].map((value) => <Pressable accessibilityRole="button" key={value} onPress={() => updateCurrentSet({ reps: value })} style={[styles.rep, activeSet.reps === value && styles.selected]}><Text style={[styles.repText, activeSet.reps === value && styles.selectedText]}>{value}</Text></Pressable>)}</View>
		<View style={styles.spacer} /><Button onPress={() => router.back()}>SAVE SET</Button>
	</Screen>;
}

const styles = StyleSheet.create({ screen: { paddingTop: spacing.xl }, backButton: { minHeight: 44, justifyContent: 'center', marginBottom: spacing.xxl }, back: { color: colors.secondary, fontSize: 12, fontWeight: '800', letterSpacing: 1 }, title: { color: colors.text, fontSize: 30, fontWeight: '800' }, subtitle: { color: colors.secondary, marginTop: spacing.sm, marginBottom: spacing.huge }, label: { color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: spacing.md }, weightCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xxl }, control: { width: 56, height: 56, borderRadius: 14, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }, controlText: { color: colors.text, fontSize: 30, fontWeight: '300' }, weightValue: { alignItems: 'center' }, weight: { color: colors.primary, fontSize: 44, fontWeight: '900' }, unit: { color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 }, reps: { flexDirection: 'row', justifyContent: 'space-between' }, rep: { width: 54, height: 54, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, selected: { backgroundColor: colors.primary, borderColor: colors.primary }, repText: { color: colors.text, fontSize: 17, fontWeight: '800' }, selectedText: { color: colors.background }, spacer: { flex: 1 }, empty: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.xl } });

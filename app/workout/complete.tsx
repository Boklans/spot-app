import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { getSessionSummary, useWorkoutSessionStore } from '@/store/workoutSessionStore';

export default function Complete() {
	const session = useWorkoutSessionStore((state) => state.session);
	const clearSession = useWorkoutSessionStore((state) => state.clearSession);

	if (!session) {
		return <Screen><Text style={styles.empty}>No completed workout.</Text><Button onPress={() => router.replace('/(tabs)')}>BACK HOME</Button></Screen>;
	}

	const summary = getSessionSummary(session);
	const stats = [[`${summary.durationMinutes} min`, 'DURATION'], [String(summary.exerciseCount), 'EXERCISES'], [String(summary.completedSets), 'SETS'], [`${summary.volume.toLocaleString()} kg`, 'VOLUME']];

	return <Screen style={styles.screen}>
		<View style={styles.hero}><Text style={styles.kicker}>{session.workoutName.toUpperCase()}</Text><Text style={styles.title}>Workout complete</Text><Text style={styles.subtitle}>Strong work, Ihor. Your next session is already getting smarter.</Text></View>
		<View style={styles.stats}>{stats.map(([value, label]) => <Card key={label} style={styles.stat}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></Card>)}</View>
		<Card style={styles.prs}><Text style={styles.prTitle}>2 PERSONAL RECORDS</Text><View style={styles.prRow}><Text style={styles.prName}>Bench Press</Text><Text style={styles.prValue}>72.5 × 8</Text></View><View style={styles.prRow}><Text style={styles.prName}>Incline DB Press</Text><Text style={styles.prValue}>24 × 9</Text></View></Card>
		<Button onPress={() => { clearSession(); router.replace('/(tabs)'); }}>DONE</Button>
	</Screen>;
}

const styles = StyleSheet.create({ screen: { paddingTop: spacing.huge }, hero: { alignItems: 'center', marginBottom: spacing.xxl }, kicker: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 }, title: { color: colors.text, fontSize: 34, fontWeight: '900', marginTop: spacing.md, textAlign: 'center' }, subtitle: { color: colors.secondary, textAlign: 'center', lineHeight: 22, marginTop: spacing.md, maxWidth: 290 }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }, stat: { width: '48%', minHeight: 92 }, value: { color: colors.text, fontSize: 23, fontWeight: '900' }, label: { color: colors.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: spacing.sm }, prs: { marginBottom: spacing.xl }, prTitle: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: spacing.md }, prRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, prName: { color: colors.text, fontWeight: '700' }, prValue: { color: colors.secondary, fontWeight: '800' }, empty: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.xl } });

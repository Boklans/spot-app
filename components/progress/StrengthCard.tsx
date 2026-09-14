import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { Card } from '../ui/Card';
import { spacing } from '@/constants/spacing';
import type { StrengthProgress } from '@/lib/progressCalculator';

export function StrengthCard({ progress }: { progress: StrengthProgress }) {
	if (!progress) return <Card><Text style={styles.emptyTitle}>NOT ENOUGH DATA YET</Text><Text style={styles.emptyBody}>Complete a few Bench Press workouts to see your strength trend.</Text></Card>;

	const values = progress.trend.map((point) => point.value);
	const minimum = Math.min(...values);
	const maximum = Math.max(...values);
	const range = Math.max(1, maximum - minimum);
	return <Card><View style={styles.header}><View><Text style={styles.label}>BENCH PRESS EST. 1RM</Text><Text style={styles.value}>{progress.bestEstimated1RM} <Text style={styles.unit}>KG</Text></Text></View><Text style={styles.delta}>BEST SET {progress.latestBestSet.weight} × {progress.latestBestSet.reps}</Text></View><View style={styles.chart}>{progress.trend.map((point) => <View key={point.date} style={[styles.point, { height: 24 + ((point.value - minimum) / range) * 76 }]} />)}</View><View style={styles.axis}><Text style={styles.axisText}>{progress.trend.length} WORKOUTS</Text><Text style={styles.axisText}>TODAY</Text></View></Card>;
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, label: { color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, value: { color: colors.text, fontSize: 32, fontWeight: '800', marginTop: spacing.sm }, unit: { color: colors.secondary, fontSize: 12 }, delta: { color: colors.success, fontSize: 10, fontWeight: '800', textAlign: 'right' }, chart: { height: 100, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border }, point: { flex: 1, maxWidth: 12, backgroundColor: colors.primary, borderRadius: 4 }, axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }, axisText: { color: colors.muted, fontSize: 10 }, emptyTitle: { color: colors.secondary, fontSize: 11, letterSpacing: 1.2, fontWeight: '800' }, emptyBody: { color: colors.text, fontSize: 15, lineHeight: 22, marginTop: spacing.md } });

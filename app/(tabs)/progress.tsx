import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { StrengthCard } from '@/components/progress/StrengthCard';
import { MuscleProgress } from '@/components/progress/MuscleProgress';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { muscleProgress } from '@/data/mockProgress';

export default function Progress() { return <Screen><View style={styles.header}><View><Text style={styles.eyebrow}>OVERVIEW</Text><Text style={styles.title}>Your progress</Text></View><Text style={styles.range}>Last 30 days⌄</Text></View><View style={styles.stats}><StatCard value="12" label="WORKOUTS" /><StatCard value="+14%" label="VOLUME" accent={colors.success} /><StatCard value="5" label="NEW PRs" accent={colors.purple} /></View><Text style={styles.section}>STRENGTH</Text><StrengthCard /><Text style={styles.section}>MUSCLE PROGRESS</Text><Card>{muscleProgress.map(item => <MuscleProgress key={item.name} {...item} />)}</Card></Screen>; }
const styles = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.xl }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { color: colors.text, fontSize: 30, fontWeight: '800', marginTop: 8 }, range: { color: colors.secondary, fontSize: 12 }, stats: { flexDirection: 'row', marginBottom: spacing.xxl }, section: { color: colors.secondary, fontSize: 11, letterSpacing: 1.3, fontWeight: '800', marginBottom: spacing.md, marginTop: spacing.sm } });

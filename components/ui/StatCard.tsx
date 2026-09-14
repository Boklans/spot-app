import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import { Card } from './Card';

export function StatCard({ value, label, accent = colors.primary }: { value: string; label: string; accent?: string }) { return <Card style={styles.card}><Text style={[styles.value, { color: accent }]}>{value}</Text><Text style={styles.label}>{label}</Text></Card>; }
const styles = StyleSheet.create({ card: { flex: 1, minHeight: 96, justifyContent: 'space-between', marginRight: spacing.sm }, value: { fontSize: typography.title, fontWeight: '800' }, label: { color: colors.secondary, fontSize: typography.label, fontWeight: '700', letterSpacing: 0.7 } });

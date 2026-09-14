import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import { Card } from './Card';

export function StatCard({ value, label, accent = colors.primary, style }: { value: string; label: string; accent?: string; style?: StyleProp<ViewStyle> }) { return <Card style={[styles.card, style]}><Text style={[styles.value, { color: accent }]}>{value}</Text><Text style={styles.label}>{label}</Text></Card>; }
const styles = StyleSheet.create({ card: { flex: 1, minHeight: 96, justifyContent: 'space-between', marginRight: spacing.sm }, value: { fontSize: typography.title, fontWeight: '800' }, label: { color: colors.secondary, fontSize: typography.label, fontWeight: '700', letterSpacing: 0.7 } });

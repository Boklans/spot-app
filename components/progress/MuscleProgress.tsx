import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { ProgressBar } from '../ui/ProgressBar';

export function MuscleProgress({ name, value }: { name: string; value: number }) { return <View style={styles.row}><View style={styles.top}><Text style={styles.name}>{name}</Text><Text style={[styles.value, value < 0 && styles.negative]}>{value > 0 ? '+' : ''}{value}%</Text></View><ProgressBar value={Math.abs(value) * 4} color={value < 0 ? colors.warning : colors.primary} /></View>; }
const styles = StyleSheet.create({ row: { marginBottom: spacing.lg }, top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }, name: { color: colors.text, fontSize: 14, fontWeight: '700' }, value: { color: colors.success, fontWeight: '800' }, negative: { color: colors.warning } });

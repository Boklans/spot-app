import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { ProgressBar } from '../ui/ProgressBar';

export function MuscleProgress({ name, volume, maxVolume, changePercent }: { name: string; volume: number; maxVolume: number; changePercent?: number }) { const change = changePercent === undefined ? 'CURRENT' : `${changePercent > 0 ? '+' : ''}${changePercent}%`; return <View style={styles.row}><View style={styles.top}><View><Text style={styles.name}>{name}</Text><Text style={styles.volume}>{Math.round(volume).toLocaleString()} kg</Text></View><Text style={[styles.value, changePercent !== undefined && changePercent < 0 && styles.negative]}>{change}</Text></View><ProgressBar value={maxVolume > 0 ? (volume / maxVolume) * 100 : 0} color={changePercent !== undefined && changePercent < 0 ? colors.warning : colors.primary} /></View>; }
const styles = StyleSheet.create({ row: { marginBottom: spacing.lg }, top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }, name: { color: colors.text, fontSize: 14, fontWeight: '700' }, volume: { color: colors.secondary, fontSize: 12, marginTop: 3 }, value: { color: colors.success, fontWeight: '800' }, negative: { color: colors.warning } });

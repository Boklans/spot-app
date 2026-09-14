import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/colors';

export function ProgressBar({ value, color = colors.primary }: { value: number; color?: string }) { return <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }]} /></View>; }
const styles = StyleSheet.create({ track: { height: 6, backgroundColor: colors.elevated, borderRadius: 5, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 5 } });

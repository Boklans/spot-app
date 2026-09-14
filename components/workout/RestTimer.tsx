import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

export function RestTimer({ seconds }: { seconds: number }) { const minutes = Math.floor(seconds / 60).toString().padStart(2, '0'); const rest = (seconds % 60).toString().padStart(2, '0'); return <View style={styles.wrap}><Text style={styles.time}>{minutes}:{rest}</Text><Text style={styles.label}>REST TIME</Text></View>; }
const styles = StyleSheet.create({ wrap: { alignItems: 'center', paddingVertical: 30 }, time: { color: colors.text, fontSize: typography.display, fontWeight: '800', letterSpacing: 2 }, label: { color: colors.secondary, fontSize: 12, letterSpacing: 2, fontWeight: '800', marginTop: 8 } });

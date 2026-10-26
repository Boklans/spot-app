import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/constants/colors';

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const colors = useThemeColors();
  const barColor = color ?? colors.primary;
  return (
    <View style={[styles.track, { backgroundColor: colors.elevated }]}>
      <View
        style={[
          styles.fill,
          { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: barColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
});

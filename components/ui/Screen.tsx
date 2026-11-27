import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

/**
 * Returns the bottom scroll padding needed so `FloatingWorkoutBar` never overlaps
 * bottom cards on `Program`, `Progress`, `Profile`, or `Home` during an active workout.
 */
export function useWorkoutBarBottomInset(basePadding: number = spacing.huge): number {
  const hasActiveSession = useWorkoutSessionStore((s) => Boolean(s.session && !s.session.completed));
  return hasActiveSession ? Math.max(basePadding + 78, 116) : basePadding;
}

export function Screen({
  children,
  scroll = true,
  style,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
  const colors = useThemeColors();
  const bottomInset = useWorkoutBarBottomInset(spacing.huge);
  const content = (
    <View
      style={[
        styles.content,
        { paddingBottom: bottomInset },
        style,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {scroll ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: spacing.lg },
});

import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { useWorkoutSessionStore } from '@/store/workoutSessionStore';

export function Screen({
  children,
  scroll = true,
  style,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
  const colors = useThemeColors();
  const hasActiveSession = useWorkoutSessionStore((s) => Boolean(s.session && !s.session.completed));
  const content = (
    <View
      style={[
        styles.content,
        hasActiveSession && { paddingBottom: 108 },
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
  content: { flex: 1, padding: spacing.xl, paddingBottom: spacing.huge },
});

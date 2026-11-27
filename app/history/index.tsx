import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HistoryFeed } from '@/components/history/HistoryFeed';
import { useWorkoutBarBottomInset } from '@/components/ui/Screen';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';

export default function History() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = useWorkoutBarBottomInset(40);
  const loadHistory = useWorkoutHistoryStore((state) => state.loadHistory);
  const loadNotes = useExerciseNotesStore((state) => state.loadNotes);

  useEffect(() => {
    void loadHistory();
    void loadNotes();
  }, [loadHistory, loadNotes]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
      void loadNotes();
    }, [loadHistory, loadNotes])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <HistoryFeed bottomInset={bottomInset} showBackHeader />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });

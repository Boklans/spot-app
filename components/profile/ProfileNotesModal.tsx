import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExerciseNoteModal } from '@/components/workout/ExerciseNoteModal';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { hapticLight } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';

interface ProfileNotesModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ProfileNotesModal({ visible, onClose }: ProfileNotesModalProps) {
  const { te, language } = useI18n();
  const isUk = language === 'uk';
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const notes = useExerciseNotesStore((s) => s.notes);
  const setNote = useExerciseNotesStore((s) => s.setNote);
  const [editingNoteExercise, setEditingNoteExercise] = useState<string | null>(null);

  const notesEntries = Object.entries(notes).filter(([, text]) => text && text.trim().length > 0);

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.header}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.title}>
                  {isUk ? 'Мої нотатки до вправ' : 'My Exercise Notes'}
                </Text>
                <Text style={styles.subtitle}>
                  {isUk
                    ? 'Зберігаються між тренуваннями й показуються під назвою вправи'
                    : 'Saved across workouts and shown under the exercise name'}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.listContent}>
              {notesEntries.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="bookmark-outline" size={28} color={colors.muted} />
                  <Text style={styles.emptyTitle}>
                    {isUk ? 'Поки немає збережених нотаток' : 'No saved notes yet'}
                  </Text>
                  <Text style={styles.emptyDesc}>
                    {isUk
                      ? 'Під час тренування натисніть «Нотатка» біля будь-якої вправи, щоб записати рівень сидіння, хват або підказку.'
                      : 'Tap "Note" on any exercise during a workout to save seat settings, grip, or cues.'}
                  </Text>
                </View>
              ) : (
                notesEntries.map(([exKey, noteText]) => (
                  <Pressable
                    key={exKey}
                    onPress={() => {
                      hapticLight();
                      setEditingNoteExercise(exKey);
                    }}
                    style={styles.noteCard}
                  >
                    <View style={styles.noteHeader}>
                      <Text style={styles.noteTitle}>{te(exKey)}</Text>
                      <Ionicons name="create-outline" size={16} color={colors.secondary} />
                    </View>
                    <Text style={styles.noteBody}>{noteText}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {editingNoteExercise && (
        <ExerciseNoteModal
          visible={Boolean(editingNoteExercise)}
          exerciseName={te(editingNoteExercise)}
          initialNote={notes[editingNoteExercise] || ''}
          language={language}
          onClose={() => setEditingNoteExercise(null)}
          onSave={(newNote) => setNote(editingNoteExercise, newNote)}
        />
      )}
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.78)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      maxHeight: '82%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    title: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    subtitle: {
      fontFamily: fonts.regular,
      color: colors.secondary,
      fontSize: 12,
      marginTop: 2,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      padding: 20,
      gap: 10,
    },
    emptyWrap: {
      paddingVertical: 32,
      alignItems: 'center',
      gap: 8,
    },
    emptyTitle: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    emptyDesc: {
      fontFamily: fonts.regular,
      color: colors.secondary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
    noteCard: {
      backgroundColor: colors.elevated,
      borderRadius: radii.md,
      padding: 14,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    noteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    noteTitle: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    noteBody: {
      fontFamily: fonts.regular,
      color: colors.secondary,
      fontSize: 13,
      lineHeight: 18,
    },
  });

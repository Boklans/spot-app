import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { hapticError, hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';
import { BODY_WEIGHT_STORAGE_KEY, useBodyWeightStore } from '@/store/bodyWeightStore';
import { EXERCISE_NOTES_STORAGE_KEY, useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { useProgramStore } from '@/store/programStore';
import { useUserProfileStore } from '@/store/userProfileStore';
import { useWorkoutHistoryStore } from '@/store/workoutHistoryStore';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.4';

interface ProfileBackupModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ProfileBackupModal({ visible, onClose }: ProfileBackupModalProps) {
  const { language } = useI18n();
  const isUk = language === 'uk';
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const workouts = useWorkoutHistoryStore((s) => s.workouts);
  const program = useProgramStore((s) => s.program);
  const notes = useExerciseNotesStore((s) => s.notes);
  const profile = useUserProfileStore((s) => s.profile);

  const [backupJsonInput, setBackupJsonInput] = useState('');
  const [backupCopied, setBackupCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const notesCount = Object.values(notes).filter((v) => v && v.trim().length > 0).length;

  const buildBackupPayload = () => ({
    app: 'SPOT',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: useUserProfileStore.getState().profile,
    program: useProgramStore.getState().program,
    workouts: useWorkoutHistoryStore.getState().workouts,
    notes: useExerciseNotesStore.getState().notes,
    bodyWeight: useBodyWeightStore.getState().entries,
  });

  const handleDownloadBackupJson = async () => {
    hapticMedium();
    setStatusMessage(null);
    const jsonString = JSON.stringify(buildBackupPayload(), null, 2);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `spot-backup-${dateStamp}.json`;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        hapticSuccess();
        setStatusMessage({
          type: 'success',
          text: isUk ? `Файл ${fileName} успішно завантажено!` : `File ${fileName} downloaded!`,
        });
        return;
      } catch {
        // Fallback to Share
      }
    }

    try {
      await Share.share({ title: fileName, message: jsonString });
    } catch {
      setStatusMessage({
        type: 'error',
        text: isUk ? 'Не вдалося експортувати файл.' : 'Could not export backup file.',
      });
    }
  };

  const handleCopyBackupJson = async () => {
    hapticLight();
    setStatusMessage(null);
    const jsonString = JSON.stringify(buildBackupPayload(), null, 2);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(jsonString);
      } else {
        await Share.share({ message: jsonString });
      }
      setBackupCopied(true);
      hapticSuccess();
      setTimeout(() => setBackupCopied(false), 2500);
    } catch {
      setStatusMessage({
        type: 'error',
        text: isUk ? 'Не вдалося скопіювати JSON.' : 'Could not copy JSON.',
      });
    }
  };

  const applyBackupJsonString = async (rawJson: string) => {
    setStatusMessage(null);
    const trimmed = rawJson.trim();
    if (!trimmed) {
      setStatusMessage({
        type: 'error',
        text: isUk
          ? 'Вставте JSON-код резервної копії або виберіть файл.'
          : 'Paste backup JSON or choose a file first.',
      });
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON structure');
      }

      const hasWorkouts = Array.isArray(parsed.workouts);
      const hasProgram = parsed.program && Array.isArray(parsed.program.workouts);
      const hasNotes = parsed.notes && typeof parsed.notes === 'object';

      if (!hasWorkouts && !hasProgram && !hasNotes) {
        setStatusMessage({
          type: 'error',
          text: isUk
            ? 'Файл не містить даних тренувань або програми SPOT.'
            : 'File does not contain valid SPOT workout or program data.',
        });
        return;
      }

      if (hasWorkouts) {
        await useWorkoutHistoryStore.getState().replaceHistory(parsed.workouts);
      }
      if (hasProgram) {
        await useProgramStore.getState().updateUserProgram(parsed.program);
      }
      if (hasNotes && parsed.notes && typeof parsed.notes === 'object' && !Array.isArray(parsed.notes)) {
        const sanitizedNotes: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed.notes)) {
          if (typeof k === 'string' && typeof v === 'string') {
            sanitizedNotes[k] = v.slice(0, 1000);
          }
        }
        await AsyncStorage.setItem(EXERCISE_NOTES_STORAGE_KEY, JSON.stringify(sanitizedNotes));
        await useExerciseNotesStore.getState().loadNotes();
      }
      if (Array.isArray(parsed.bodyWeight) && parsed.bodyWeight.length > 0) {
        const sanitizedWeight = parsed.bodyWeight
          .filter(
            (e: any) =>
              e &&
              typeof e === 'object' &&
              typeof e.weightKg === 'number' &&
              Number.isFinite(e.weightKg) &&
              e.weightKg >= 20 &&
              e.weightKg <= 350 &&
              typeof e.date === 'string'
          )
          .map((e: any, idx: number) => ({
            id: typeof e.id === 'string' && e.id ? e.id : `bw-import-${Date.now()}-${idx}`,
            weightKg: Math.round(e.weightKg * 10) / 10,
            date: e.date,
            timestamp: typeof e.timestamp === 'number' && Number.isFinite(e.timestamp) ? e.timestamp : Date.now(),
          }));
        if (sanitizedWeight.length > 0) {
          await AsyncStorage.setItem(BODY_WEIGHT_STORAGE_KEY, JSON.stringify(sanitizedWeight));
          await useBodyWeightStore.getState().loadHistory();
        }
      }
      if (parsed.profile && typeof parsed.profile === 'object' && !Array.isArray(parsed.profile)) {
        const p = parsed.profile as Record<string, unknown>;
        const safeProfileUpdates: Partial<typeof profile> = {};
        if (typeof p.name === 'string') safeProfileUpdates.name = p.name.trim().slice(0, 20);
        if (typeof p.age === 'number' && p.age >= 12 && p.age <= 100) safeProfileUpdates.age = Math.round(p.age);
        if (p.sex === 'male' || p.sex === 'female') safeProfileUpdates.sex = p.sex;
        if (typeof p.weightKg === 'number' && p.weightKg >= 20 && p.weightKg <= 350) safeProfileUpdates.weightKg = p.weightKg;
        if (typeof p.heightCm === 'number' && p.heightCm >= 80 && p.heightCm <= 250) safeProfileUpdates.heightCm = p.heightCm;
        if (p.weightUnit === 'kg' || p.weightUnit === 'lbs') safeProfileUpdates.weightUnit = p.weightUnit;
        if (p.heightUnit === 'cm' || p.heightUnit === 'ft') safeProfileUpdates.heightUnit = p.heightUnit;
        if (p.language === 'en' || p.language === 'uk') safeProfileUpdates.language = p.language;
        if (p.theme === 'dark' || p.theme === 'light') safeProfileUpdates.theme = p.theme;
        if (typeof p.defaultRestSeconds === 'number' && p.defaultRestSeconds >= 15 && p.defaultRestSeconds <= 600) {
          safeProfileUpdates.defaultRestSeconds = p.defaultRestSeconds;
        }
        if (typeof p.workoutsPerWeek === 'number' && p.workoutsPerWeek >= 1 && p.workoutsPerWeek <= 7) {
          safeProfileUpdates.workoutsPerWeek = p.workoutsPerWeek;
        }
        if (Object.keys(safeProfileUpdates).length > 0) {
          await useUserProfileStore.getState().updateProfile(safeProfileUpdates);
        }
      }

      hapticSuccess();
      setBackupJsonInput('');
      setStatusMessage({
        type: 'success',
        text: isUk
          ? `Дані успішно відновлено! (${hasWorkouts ? parsed.workouts.length : 0} тренувань)`
          : `Backup restored! (${hasWorkouts ? parsed.workouts.length : 0} workouts)`,
      });
    } catch {
      hapticError();
      setStatusMessage({
        type: 'error',
        text: isUk
          ? 'Помилка формату JSON. Перевірте правильність скопійованих даних.'
          : 'Invalid JSON format. Please check the backup data.',
      });
    }
  };

  const handlePickBackupFileWeb = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    hapticLight();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (event: any) => {
      const file = event?.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = typeof e.target?.result === 'string' ? e.target.result : '';
        if (content) {
          setBackupJsonInput(content);
          await applyBackupJsonString(content);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="88%">
      <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.title}>{isUk ? 'Резервна копія (JSON)' : 'JSON Data Backup'}</Text>
              <Text style={styles.subtitle}>
                {isUk
                  ? `${workouts.length} тренувань · ${program.workouts.length} днів програми · ${notesCount} нотаток`
                  : `${workouts.length} workouts · ${program.workouts.length} program days · ${notesCount} notes`}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {statusMessage && (
              <View
                style={[
                  styles.statusBanner,
                  {
                    backgroundColor:
                      statusMessage.type === 'success' ? colors.primaryMuted : 'rgba(239, 68, 68, 0.12)',
                    borderColor:
                      statusMessage.type === 'success' ? colors.accentLine : 'rgba(239, 68, 68, 0.35)',
                  },
                ]}
              >
                <Ionicons
                  name={statusMessage.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={statusMessage.type === 'success' ? colors.primaryText : colors.danger}
                />
                <Text style={styles.statusText}>{statusMessage.text}</Text>
              </View>
            )}

            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>
                {isUk ? '1. Експорт ваших даних' : '1. Export Your Data'}
              </Text>
              <Text style={styles.sectionDesc}>
                {isUk
                  ? 'Збережіть повну копію історії тренувань, рекордів, власної програми та нотаток у файл .json.'
                  : 'Save a full copy of your workout history, PRs, custom routine, and exercise notes as a .json file.'}
              </Text>

              <View style={styles.btnRow}>
                <Pressable accessibilityRole="button" onPress={handleDownloadBackupJson} style={styles.primaryBtn}>
                  <Ionicons name="download-outline" size={17} color={colors.onPrimary} />
                  <Text style={styles.primaryBtnText}>
                    {isUk ? 'Завантажити .JSON' : 'Download .JSON'}
                  </Text>
                </Pressable>

                <Pressable accessibilityRole="button" onPress={handleCopyBackupJson} style={styles.copyBtn}>
                  <Ionicons
                    name={backupCopied ? 'checkmark' : 'copy-outline'}
                    size={16}
                    color={backupCopied ? colors.primaryText : colors.text}
                  />
                  <Text style={[styles.copyBtnText, backupCopied && { color: colors.primaryText }]}>
                    {backupCopied ? (isUk ? 'Скопійовано' : 'Copied') : isUk ? 'Копіювати' : 'Copy'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.sectionBox}>
              <View style={styles.importHead}>
                <Text style={styles.sectionTitle}>
                  {isUk ? '2. Відновлення з копії' : '2. Restore from Backup'}
                </Text>
                {Platform.OS === 'web' && (
                  <Pressable accessibilityRole="button" onPress={handlePickBackupFileWeb} style={styles.pickFileBtn}>
                    <Ionicons name="folder-open-outline" size={14} color={colors.primaryText} />
                    <Text style={styles.pickFileText}>{isUk ? 'Вибрати файл' : 'Choose File'}</Text>
                  </Pressable>
                )}
              </View>

              <Text style={styles.sectionDesc}>
                {isUk
                  ? 'Виберіть раніше збережений .json файл або вставте його вміст нижче, щоб відновити дані.'
                  : 'Choose a previously saved .json file or paste its contents below to restore your data.'}
              </Text>

              <TextInput
                value={backupJsonInput}
                onChangeText={setBackupJsonInput}
                placeholder='{"app": "SPOT", "workouts": [...], "program": {...}}'
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={4}
                style={styles.jsonInput}
              />

              <Pressable
                accessibilityRole="button"
                onPress={() => applyBackupJsonString(backupJsonInput)}
                style={styles.restoreBtn}
              >
                <Ionicons name="cloud-upload-outline" size={17} color={colors.primaryText} />
                <Text style={styles.restoreBtnText}>
                  {isUk ? 'Відновити дані з JSON' : 'Restore Data from JSON'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
    </BottomSheet>
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
      maxHeight: '88%',
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
      fontFamily: fonts.medium,
      color: colors.secondary,
      fontSize: 12,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      padding: 20,
      gap: 16,
    },
    statusBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: radii.sm,
      borderWidth: 1,
    },
    statusText: {
      fontFamily: fonts.semiBold,
      color: colors.text,
      fontSize: 12.5,
      fontWeight: '600',
      flex: 1,
    },
    sectionBox: {
      backgroundColor: colors.elevated,
      borderRadius: radii.md,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    sectionTitle: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    sectionDesc: {
      fontFamily: fonts.regular,
      color: colors.secondary,
      fontSize: 12.5,
      lineHeight: 18,
    },
    btnRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    primaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: radii.sm,
    },
    primaryBtnText: {
      fontFamily: fonts.bold,
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: radii.sm,
    },
    copyBtnText: {
      fontFamily: fonts.semiBold,
      color: colors.text,
      fontSize: 12.5,
      fontWeight: '600',
    },
    importHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pickFileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.accentLine,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radii.xs,
    },
    pickFileText: {
      fontFamily: fonts.bold,
      color: colors.primaryText,
      fontSize: 11.5,
      fontWeight: '700',
    },
    jsonInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      padding: 12,
      color: colors.text,
      fontSize: 12,
      minHeight: 90,
      textAlignVertical: 'top',
    },
    restoreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.accentLine,
      paddingVertical: 12,
      borderRadius: radii.sm,
    },
    restoreBtnText: {
      fontFamily: fonts.bold,
      color: colors.primaryText,
      fontSize: 13,
      fontWeight: '700',
    },
  });

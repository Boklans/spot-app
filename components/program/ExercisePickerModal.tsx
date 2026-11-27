import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useThemeColors, type ThemeColors } from '@/constants/colors';
import { radii } from '@/constants/radii';
import { fonts } from '@/constants/typography';
import { resolveCanonicalExerciseId } from '@/lib/exercises';
import { getExerciseImage } from '@/lib/exerciseImages';
import { EXERCISE_LIBRARY, type LibraryExercise } from '@/lib/exerciseLibrary';
import { hapticImpact, hapticLight, hapticMedium } from '@/lib/haptics';
import { translateExercise, useI18n } from '@/lib/i18n';
import { getExerciseAlternatives, type EquipmentId } from '@/lib/programGenerator';
import { useCustomExercisesStore } from '@/store/customExercisesStore';
import { CreateExerciseModal } from './CreateExerciseModal';
import { ExerciseDetailModal } from './ExerciseDetailModal';

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'] as const;
type MuscleGroupFilter = (typeof MUSCLE_GROUPS)[number];

const EQUIPMENT_FILTERS: Array<{ id: 'All' | EquipmentId; labelEn: string; labelUk: string }> = [
  { id: 'All', labelEn: 'All Gear', labelUk: 'Все обладн.' },
  { id: 'barbell', labelEn: 'Barbell', labelUk: 'Штанга' },
  { id: 'dumbbells', labelEn: 'Dumbbells', labelUk: 'Гантелі' },
  { id: 'machines', labelEn: 'Machines / Cables', labelUk: 'Тренажери / Блоки' },
  { id: 'bodyweight', labelEn: 'Bodyweight', labelUk: 'Власна вага' },
];

export type ExercisePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: LibraryExercise) => void;
  /** Optional batch callback enabling multi-select mode in routine builders */
  onSelectMultiple?: (exercises: LibraryExercise[]) => void;
  mode?: 'add' | 'swap' | string;
  initialMuscle?: string;
  activeExerciseName?: string;
  embedded?: boolean;
};

export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  onSelectMultiple,
  mode = 'add',
  initialMuscle,
  activeExerciseName,
  embedded = false,
}: ExercisePickerModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { tm, te, tq, language } = useI18n();
  const isUk = language === 'uk';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroupFilter>(
    (MUSCLE_GROUPS.includes(initialMuscle as MuscleGroupFilter)
      ? (initialMuscle as MuscleGroupFilter)
      : 'All')
  );
  const [selectedEquipment, setSelectedEquipment] = useState<'All' | EquipmentId>('All');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [detailExercise, setDetailExercise] = useState<LibraryExercise | null>(null);

  const customExercises = useCustomExercisesStore((state) => state.customExercises);
  const customHydrated = useCustomExercisesStore((state) => state.hydrated);
  const deleteCustomExercise = useCustomExercisesStore((state) => state.deleteCustomExercise);

  const isMultiSelect = Boolean(onSelectMultiple && mode !== 'swap');

  useEffect(() => {
    if (visible) {
      if (!customHydrated) {
        void useCustomExercisesStore.getState().loadCustomExercises();
      }
      setSelectedMuscle(
        MUSCLE_GROUPS.includes(initialMuscle as MuscleGroupFilter)
          ? (initialMuscle as MuscleGroupFilter)
          : 'All'
      );
      setSelectedEquipment('All');
      setSelectedBatchIds([]);
      setSearchQuery('');
    }
  }, [visible, initialMuscle, customHydrated]);

  const combinedLibrary = useMemo(() => {
    const customAsLibrary: LibraryExercise[] = customExercises.map((c) => ({
      id: c.id,
      name: c.name,
      muscleGroup: c.muscleGroup,
      equipment: c.equipment,
      weightIncrement: c.weightIncrement,
      defaultSets: c.defaultSets,
      defaultRepRange: c.defaultRepRange,
      defaultWeight: c.defaultWeight,
      customImageUri: c.customImageUri,
      isCustom: true,
    }));
    return [...customAsLibrary, ...EXERCISE_LIBRARY];
  }, [customExercises]);

  const recommendedIds = useMemo(() => {
    if (mode !== 'swap' || !activeExerciseName) return new Set<string>();
    const alts = getExerciseAlternatives(activeExerciseName, ['full_gym']);
    const set = new Set<string>();
    for (const alt of alts) {
      const cid = resolveCanonicalExerciseId(alt.name) || alt.id;
      if (cid) set.add(cid);
    }
    return set;
  }, [mode, activeExerciseName]);

  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = combinedLibrary.filter((item) => {
      const translatedName = translateExercise(item.name, language).toLowerCase();
      const translatedMuscle = tm(item.muscleGroup).toLowerCase();
      const translatedEquipment = tq(item.equipment).toLowerCase();

      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        translatedName.includes(query) ||
        item.muscleGroup.toLowerCase().includes(query) ||
        translatedMuscle.includes(query) ||
        item.equipment.toLowerCase().includes(query) ||
        translatedEquipment.includes(query);

      const matchesMuscle =
        selectedMuscle === 'All' || item.muscleGroup === selectedMuscle;

      const matchesEquipment =
        selectedEquipment === 'All' || item.equipment === selectedEquipment;

      return matchesSearch && matchesMuscle && matchesEquipment;
    });

    if (recommendedIds.size > 0 && !query) {
      return [...list].sort((a, b) => {
        const aRec = recommendedIds.has(resolveCanonicalExerciseId(a.name) || a.id) ? 1 : 0;
        const bRec = recommendedIds.has(resolveCanonicalExerciseId(b.name) || b.id) ? 1 : 0;
        return bRec - aRec;
      });
    }
    return list;
  }, [
    combinedLibrary,
    searchQuery,
    selectedMuscle,
    selectedEquipment,
    language,
    tm,
    tq,
    recommendedIds,
  ]);

  const handleClose = () => {
    hapticLight();
    setSearchQuery('');
    setSelectedBatchIds([]);
    onClose();
  };

  const handleRowPress = (exercise: LibraryExercise) => {
    if (isMultiSelect) {
      hapticLight();
      setSelectedBatchIds((prev) =>
        prev.includes(exercise.id)
          ? prev.filter((id) => id !== exercise.id)
          : [...prev, exercise.id]
      );
      return;
    }
    hapticImpact();
    onSelect(exercise);
    setSearchQuery('');
    onClose();
  };

  const handleConfirmBatch = () => {
    if (!onSelectMultiple || selectedBatchIds.length === 0) return;
    hapticMedium();
    const selectedItems = selectedBatchIds
      .map((id) => combinedLibrary.find((item) => item.id === id))
      .filter((item): item is LibraryExercise => Boolean(item));
    onSelectMultiple(selectedItems);
    setSelectedBatchIds([]);
    setSearchQuery('');
    onClose();
  };

  const handleConfirmDeleteCustom = (item: LibraryExercise) => {
    hapticLight();
    Alert.alert(
      isUk ? 'Видалити власну вправу?' : 'Delete Custom Exercise?',
      isUk
        ? `Вправу «${item.name}» буде видалено з вашого каталогу. Історія попередніх тренувань збережеться.`
        : `"${item.name}" will be removed from your custom catalog. Logged workout history is preserved.`,
      [
        { text: isUk ? 'Скасувати' : 'Cancel', style: 'cancel' },
        {
          text: isUk ? 'Видалити' : 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteCustomExercise(item.id);
            setSelectedBatchIds((prev) => prev.filter((id) => id !== item.id));
          },
        },
      ]
    );
  };

  const activeCanonical = activeExerciseName
    ? resolveCanonicalExerciseId(activeExerciseName) || activeExerciseName.trim().toLowerCase()
    : '';

  const contentNode = (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            {mode === 'swap'
              ? isUk
                ? 'ЗАМІНА ВПРАВИ'
                : 'SWAP EXERCISE'
              : isUk
                ? 'КАТАЛОГ ВПРАВ'
                : 'EXERCISE LIBRARY'}
          </Text>
          <Text style={styles.title}>
            {mode === 'swap'
              ? isUk
                ? 'Оберіть альтернативу'
                : 'Select Alternative'
              : isUk
                ? 'Оберіть вправу'
                : 'Select Exercise'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={handleClose}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.72 }]}
          hitSlop={10}
        >
          <Ionicons name="close" size={20} color={colors.secondary} />
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={colors.muted} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={
            isUk
              ? 'Пошук за назвою або мʼязом...'
              : 'Search by exercise or muscle...'
          }
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <Pressable hitSlop={8} onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={17} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {/* Row 1: Muscle Filter Pills */}
      <View style={styles.filterRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {MUSCLE_GROUPS.map((item) => {
            const active = selectedMuscle === item;
            const label = item === 'All' ? (isUk ? 'Всі мʼязи' : 'All Muscles') : tm(item);
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                onPress={() => {
                  hapticLight();
                  setSelectedMuscle(item);
                }}
                style={[styles.filterPill, active && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Row 2: Equipment Filter Pills */}
      <View style={styles.filterRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {EQUIPMENT_FILTERS.map((eq) => {
            const active = selectedEquipment === eq.id;
            return (
              <Pressable
                key={eq.id}
                accessibilityRole="button"
                onPress={() => {
                  hapticLight();
                  setSelectedEquipment(eq.id);
                }}
                style={[styles.equipPill, active && styles.equipPillActive]}
              >
                <Text style={[styles.equipPillText, active && styles.equipPillTextActive]}>
                  {isUk ? eq.labelUk : eq.labelEn}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Virtualized Exercise FlatList */}
      <FlatList
        data={filteredExercises}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          selectedBatchIds.length > 0 && { paddingBottom: 92 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create custom exercise"
            onPress={() => {
              hapticLight();
              setIsCreateModalVisible(true);
            }}
            style={({ pressed }) => [styles.createCard, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.createIconCircle}>
              <Ionicons name="add" size={19} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.createTitle}>
                {isUk ? 'Створити власну вправу' : 'Create Custom Exercise'}
              </Text>
              <Text style={styles.createSubtitle}>
                {isUk
                  ? 'Тренажер або рух з власним фото'
                  : 'Custom gym machine or movement with photo'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.primaryText} />
          </Pressable>
        }
        renderItem={({ item }) => {
          const itemCanonical =
            resolveCanonicalExerciseId(item.name) || item.name.trim().toLowerCase();
          const isCurrent = Boolean(activeCanonical && itemCanonical === activeCanonical);
          const isRecommended = !isCurrent && recommendedIds.has(itemCanonical);
          const isSelectedBatch = selectedBatchIds.includes(item.id);

          return (
            <View
              style={[
                styles.rowCard,
                (isCurrent || isSelectedBatch) && styles.rowCardSelected,
              ]}
            >
              {/* Main Selectable Left & Center Area */}
              <Pressable
                accessibilityRole="button"
                onPress={() => handleRowPress(item)}
                style={({ pressed }) => [styles.rowSelectZone, pressed && { opacity: 0.78 }]}
              >
                <View style={styles.thumbWrap}>
                  <Image
                    source={getExerciseImage(item.name, item.customImageUri)}
                    style={styles.thumbImg}
                    resizeMode="cover"
                  />
                </View>

                <View style={styles.infoCol}>
                  <View style={styles.badgesLine}>
                    {isRecommended && (
                      <View style={styles.recBadge}>
                        <Text style={styles.recBadgeText}>
                          {isUk ? 'РЕКОМЕНДОВАНО' : 'RECOMMENDED'}
                        </Text>
                      </View>
                    )}
                    {item.isCustom && (
                      <View style={styles.customBadge}>
                        <Text style={styles.customBadgeText}>
                          {isUk ? 'ВЛАСНА' : 'CUSTOM'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={2} style={styles.exerciseName}>
                    {te(item.name)}
                  </Text>
                  <Text style={styles.exerciseMeta}>
                    {tm(item.muscleGroup)} · {tq(item.equipment)}
                  </Text>
                </View>

                {isMultiSelect ? (
                  <View
                    style={[
                      styles.multiCheckCircle,
                      isSelectedBatch && styles.multiCheckCircleActive,
                    ]}
                  >
                    {isSelectedBatch && (
                      <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
                    )}
                  </View>
                ) : (
                  <View
                    style={[
                      styles.actionTag,
                      isCurrent && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionTagText,
                        isCurrent && { color: colors.onPrimary },
                      ]}
                    >
                      {isCurrent
                        ? isUk
                          ? 'АКТИВНА'
                          : 'ACTIVE'
                        : mode === 'swap'
                          ? isUk
                            ? 'ЗАМІНИТИ'
                            : 'SWAP'
                          : isUk
                            ? '+ ДОДАТИ'
                            : '+ ADD'}
                    </Text>
                  </View>
                )}
              </Pressable>

              {/* Separate 44x44pt Right-Side Actions: Info (i) + Delete Custom */}
              <View style={styles.rightIconsCol}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isUk ? 'Техніка та анатомія' : 'Exercise guide'}
                  hitSlop={6}
                  onPress={() => {
                    hapticLight();
                    setDetailExercise(item);
                  }}
                  style={({ pressed }) => [styles.infoBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={colors.secondary}
                  />
                </Pressable>

                {item.isCustom && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isUk ? 'Видалити власну вправу' : 'Delete custom exercise'}
                    hitSlop={6}
                    onPress={() => handleConfirmDeleteCustom(item)}
                    style={({ pressed }) => [styles.deleteCustomBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>
              {isUk ? 'ВПРАВ НЕ ЗНАЙДЕНО' : 'NO EXERCISES FOUND'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {isUk
                ? 'Спробуйте інший запит або скиньте фільтри обладнання.'
                : 'Try another search query or reset your equipment filter.'}
            </Text>
          </View>
        }
      />

      {/* Sticky Multi-Select Batch Footer */}
      {isMultiSelect && selectedBatchIds.length > 0 && (
        <View style={styles.batchFooter}>
          <Pressable
            accessibilityRole="button"
            onPress={handleConfirmBatch}
            style={({ pressed }) => [styles.batchConfirmBtn, pressed && { opacity: 0.88 }]}
          >
            <Ionicons name="checkmark-circle" size={19} color={colors.onPrimary} />
            <Text style={styles.batchConfirmText}>
              {isUk
                ? `Додати вправи (${selectedBatchIds.length})`
                : `Add ${selectedBatchIds.length} ${selectedBatchIds.length === 1 ? 'Exercise' : 'Exercises'}`}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Create Custom Exercise Modal */}
      <CreateExerciseModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onCreated={(newExercise) => {
          setIsCreateModalVisible(false);
          if (isMultiSelect) {
            setSelectedBatchIds((prev) => [...prev, newExercise.id]);
          } else {
            onSelect(newExercise);
            onClose();
          }
        }}
      />

      {/* Exercise Detail Modal */}
      {detailExercise && (
        <ExerciseDetailModal
          visible={detailExercise !== null}
          onClose={() => setDetailExercise(null)}
          exerciseName={detailExercise.name}
          muscleGroup={detailExercise.muscleGroup}
          customImageUri={detailExercise.customImageUri}
          equipment={detailExercise.equipment}
        />
      )}
    </View>
  );

  if (embedded) {
    return visible ? contentNode : null;
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      maxHeight="92%"
      backgroundColor={colors.background}
    >
      {contentNode}
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      height: 620,
      maxHeight: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingBottom: 10,
      gap: 10,
    },
    eyebrow: {
      fontFamily: fonts.bold,
      fontSize: 10.5,
      letterSpacing: 1.0,
      color: colors.primaryText,
      includeFontPadding: false,
    },
    title: {
      fontFamily: fonts.bold,
      fontSize: 21,
      lineHeight: 26,
      color: colors.text,
      marginTop: 2,
      letterSpacing: -0.35,
      includeFontPadding: false,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 18,
      marginBottom: 10,
      paddingHorizontal: 12,
      height: 44,
      borderRadius: radii.sm + 2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      fontFamily: fonts.regular,
      flex: 1,
      fontSize: 14.5,
      color: colors.text,
      paddingVertical: 0,
    },
    filterRowWrap: {
      marginBottom: 8,
    },
    filterScroll: {
      paddingHorizontal: 18,
      gap: 7,
    },
    filterPill: {
      paddingHorizontal: 13,
      paddingVertical: 6.5,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterPillActive: {
      backgroundColor: colors.activeChipBg,
      borderColor: colors.activeChipBg,
    },
    filterPillText: {
      fontFamily: fonts.semiBold,
      fontSize: 12.5,
      color: colors.secondary,
      includeFontPadding: false,
    },
    filterPillTextActive: {
      fontFamily: fonts.bold,
      color: colors.activeChipText,
    },
    equipPill: {
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: radii.xs + 2,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    equipPillActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.accentLine,
    },
    equipPillText: {
      fontFamily: fonts.medium,
      fontSize: 11.5,
      color: colors.secondary,
      includeFontPadding: false,
    },
    equipPillTextActive: {
      fontFamily: fonts.bold,
      color: colors.primaryText,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 18,
      paddingTop: 4,
      paddingBottom: 28,
      gap: 8,
    },
    createCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.accentLine,
      borderRadius: radii.md,
      padding: 12,
      marginBottom: 4,
    },
    createIconCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createTitle: {
      fontFamily: fonts.bold,
      fontSize: 14.5,
      color: colors.text,
      includeFontPadding: false,
    },
    createSubtitle: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: colors.secondary,
      marginTop: 1,
      includeFontPadding: false,
    },
    rowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingLeft: 10,
      paddingRight: 6,
      paddingVertical: 9,
    },
    rowCardSelected: {
      borderColor: colors.accentLine,
      backgroundColor: colors.primaryMuted,
    },
    rowSelectZone: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    thumbWrap: {
      width: 46,
      height: 46,
      borderRadius: radii.xs + 2,
      backgroundColor: colors.elevated,
      overflow: 'hidden',
    },
    thumbImg: {
      width: '100%',
      height: '100%',
    },
    infoCol: {
      flex: 1,
      gap: 2,
    },
    badgesLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    recBadge: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 5,
      paddingVertical: 1.5,
      borderRadius: 4,
    },
    recBadgeText: {
      fontFamily: fonts.bold,
      fontSize: 9.5,
      color: colors.primaryText,
      letterSpacing: 0.4,
      includeFontPadding: false,
    },
    customBadge: {
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.accentLine,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    customBadgeText: {
      fontFamily: fonts.bold,
      fontSize: 9.5,
      color: colors.primaryText,
      includeFontPadding: false,
    },
    exerciseName: {
      fontFamily: fonts.semiBold,
      fontSize: 14.5,
      lineHeight: 19,
      color: colors.text,
      includeFontPadding: false,
    },
    exerciseMeta: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: colors.secondary,
      includeFontPadding: false,
    },
    actionTag: {
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.accentLine,
      borderRadius: 8,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    actionTagText: {
      fontFamily: fonts.bold,
      fontSize: 10.5,
      color: colors.primaryText,
      letterSpacing: 0.4,
      includeFontPadding: false,
    },
    multiCheckCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    multiCheckCircleActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    rightIconsCol: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 4,
    },
    infoBtn: {
      width: 40,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteCustomBtn: {
      width: 34,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 44,
      gap: 6,
    },
    emptyTitle: {
      fontFamily: fonts.bold,
      fontSize: 13.5,
      letterSpacing: 0.8,
      color: colors.text,
      includeFontPadding: false,
    },
    emptySubtitle: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.secondary,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
    batchFooter: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 14,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    batchConfirmBtn: {
      height: 50,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    batchConfirmText: {
      fontFamily: fonts.bold,
      fontSize: 15,
      color: colors.onPrimary,
      includeFontPadding: false,
    },
  });

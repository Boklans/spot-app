import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { EXERCISE_CATALOG, type CatalogExercise } from '@/lib/exerciseCatalog';
import { getExerciseImage } from '@/lib/exerciseImages';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useI18n } from '@/lib/i18n';

const CATEGORIES = ['All', 'Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core'];

interface ExerciseLibraryModalProps {
  visible: boolean;
  onSelectExercise: (exercise: CatalogExercise) => void;
  onClose: () => void;
}

export function ExerciseLibraryModal({
  visible,
  onSelectExercise,
  onClose,
}: ExerciseLibraryModalProps) {
  const { t, tm, te, language } = useI18n();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredExercises = useMemo(() => {
    return EXERCISE_CATALOG.filter((ex) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        ex.muscleGroup.toLowerCase() === selectedCategory.toLowerCase();
      const localizedName = te(ex.name);
      const matchesSearch =
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        localizedName.toLowerCase().includes(search.toLowerCase()) ||
        ex.muscleGroup.toLowerCase().includes(search.toLowerCase()) ||
        tm(ex.muscleGroup).toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory, tm, te]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t('exerciseLibrary')}</Text>
              <Text style={styles.subtitle}>{t('selectExerciseToAdd')}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Search Input */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#8E9BAE" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('searchExercisePlaceholder')}
              placeholderTextColor="#64748B"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Category Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryRow}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  accessibilityRole="button"
                  onPress={() => {
                    hapticLight();
                    setSelectedCategory(cat);
                  }}
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextSelected,
                    ]}
                  >
                    {tm(cat)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Exercise List */}
          <ScrollView
            style={styles.listScrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {filteredExercises.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                onPress={() => {
                  hapticMedium();
                  onSelectExercise(item);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.exerciseCard,
                  pressed && styles.exerciseCardPressed,
                ]}
              >
                <View style={styles.exerciseCardLeft}>
                  <View style={styles.exerciseThumbWrap}>
                    <Image
                      source={getExerciseImage(item.name)}
                      style={styles.exerciseThumb}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{te(item.name)}</Text>
                    <Text style={styles.exerciseMeta}>
                      {tm(item.muscleGroup)} • {item.equipment} • {t('base')} {item.defaultWeight} {t('kg')}
                    </Text>
                  </View>
                </View>

                <View style={styles.addBtnBadge}>
                  <Ionicons name="add" size={16} color="#0B0D0F" />
                  <Text style={styles.addBtnBadgeText}>
                    {language === 'uk' ? 'ДОДАТИ' : 'ADD'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {/* Sticky Bottom Close Bar */}
          <View style={styles.bottomBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Workout"
              onPress={onClose}
              style={({ pressed }) => [
                styles.bottomCloseBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
              <Text style={styles.bottomCloseBtnText}>
                {language === 'uk' ? 'Назад до редагування' : 'Back to Workout'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#12161D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#242C38',
    height: '88%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C232E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242C38',
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  categoryScroll: {
    flexGrow: 0,
    height: 38,
    marginBottom: 12,
  },
  categoryRow: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
    height: 38,
  },
  categoryChip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#242C38',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryChipSelected: {
    backgroundColor: 'rgba(200, 255, 61, 0.15)',
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E9BAE',
  },
  categoryChipTextSelected: {
    color: colors.primary,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 30,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161B22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2733',
    padding: 14,
  },
  exerciseCardPressed: {
    opacity: 0.8,
    backgroundColor: '#1A212B',
  },
  exerciseCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  exerciseThumbWrap: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#242C38',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseThumb: {
    width: '100%',
    height: '100%',
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  exerciseMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E9BAE',
    marginTop: 2,
  },
  listScrollView: {
    flex: 1,
  },
  addBtnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnBadgeText: {
    color: '#0B0D0F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#1E2633',
    backgroundColor: '#12161D',
    flexShrink: 0,
  },
  bottomCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E2633',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2E3847',
  },
  bottomCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});


import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef } from 'react';
import { FlatList, Platform, StyleSheet, Text, View, ViewToken } from 'react-native';
import { colors } from '@/constants/colors';

const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface WheelPickerProps<T extends number | string> {
  data: T[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  formatLabel?: (value: T) => string;
  label?: string;
  unit?: string;
  keyExtractor?: (value: T, index: number) => string;
}

// Padding items so selected value is always centered
const PADDING_COUNT = Math.floor(VISIBLE_ITEMS / 2);

export function WheelPicker<T extends number | string>({
  data,
  selectedValue,
  onValueChange,
  formatLabel,
  label,
  unit,
  keyExtractor,
}: WheelPickerProps<T>) {
  const listRef = useRef<FlatList<T>>(null);
  const lastReportedIndex = useRef<number>(-1);
  const isScrollingProgrammatically = useRef(false);

  // Build padded data: empty slots at start & end for centering
  const paddedData: Array<T | null> = [
    ...Array(PADDING_COUNT).fill(null),
    ...data,
    ...Array(PADDING_COUNT).fill(null),
  ];

  const selectedIndex = data.findIndex((item) => item === selectedValue);

  // Scroll to selected on mount / when selectedValue changes externally
  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    isScrollingProgrammatically.current = true;
    listRef.current.scrollToOffset({
      offset: selectedIndex * ITEM_HEIGHT,
      animated: true,
    });
    setTimeout(() => {
      isScrollingProgrammatically.current = false;
    }, 400);
  }, [selectedValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (isScrollingProgrammatically.current) return;
      // The center visible item corresponds to the selected value
      const centerItems = viewableItems.filter(
        (item) => item.index !== null && item.index >= PADDING_COUNT
      );
      if (centerItems.length === 0) return;

      // Pick the middle viewable item
      const midItem = centerItems[Math.floor(centerItems.length / 2)];
      if (!midItem || midItem.index === null) return;

      const dataIndex = midItem.index - PADDING_COUNT;
      if (dataIndex < 0 || dataIndex >= data.length) return;
      if (dataIndex === lastReportedIndex.current) return;

      lastReportedIndex.current = dataIndex;
      const value = data[dataIndex];
      if (value !== selectedValue) {
        onValueChange(value);
        if (Platform.OS !== 'web') {
          Haptics.selectionAsync();
        }
      }
    },
    [data, selectedValue, onValueChange]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  });

  const renderItem = ({ item, index }: { item: T | null; index: number }) => {
    if (item === null) {
      return <View style={styles.item} />;
    }
    const dataIndex = index - PADDING_COUNT;
    const distance = Math.abs(dataIndex - selectedIndex);
    const isSelected = distance === 0;
    const isMid = distance === 1;

    const opacity = isSelected ? 1 : isMid ? 0.45 : 0.18;
    const fontSize = isSelected ? 34 : isMid ? 24 : 18;
    const fontWeight: '900' | '700' | '400' = isSelected ? '900' : isMid ? '700' : '400';
    const textColor = isSelected ? colors.primary : '#FFFFFF';

    const label = formatLabel ? formatLabel(item) : String(item);

    return (
      <View style={styles.item}>
        <Text
          style={[
            styles.itemText,
            { opacity, fontSize, fontWeight, color: textColor },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.pickerContainer}>
        {/* Top & bottom fade overlays */}
        <View style={styles.topFade} pointerEvents="none" />
        <View style={styles.bottomFade} pointerEvents="none" />

        {/* Selection highlight lines */}
        <View style={styles.selectionTop} pointerEvents="none" />
        <View style={styles.selectionBottom} pointerEvents="none" />

        <FlatList
          ref={listRef}
          data={paddedData as T[]}
          keyExtractor={(item, index) => {
            if (item === null) return `pad-${index}`;
            if (keyExtractor) return keyExtractor(item, index);
            return `item-${String(item)}-${index}`;
          }}
          renderItem={renderItem}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.85}
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig.current}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      </View>

      {unit ? <Text style={styles.unit}>{unit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  pickerContainer: {
    height: PICKER_HEIGHT,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  list: {
    height: PICKER_HEIGHT,
  },
  listContent: {
    // no extra padding — padding items handle centering
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * PADDING_COUNT,
    zIndex: 2,
    // We'll just use backgroundColor with low alpha — no LinearGradient dep needed
    // because the bg is solid #0B0D0F
    backgroundColor: 'rgba(11, 13, 15, 0.55)',
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * PADDING_COUNT,
    zIndex: 2,
    backgroundColor: 'rgba(11, 13, 15, 0.55)',
  },
  selectionTop: {
    position: 'absolute',
    top: ITEM_HEIGHT * PADDING_COUNT,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(200, 255, 61, 0.25)',
    zIndex: 3,
  },
  selectionBottom: {
    position: 'absolute',
    top: ITEM_HEIGHT * (PADDING_COUNT + 1),
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(200, 255, 61, 0.25)',
    zIndex: 3,
  },
  unit: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#717B8A',
    letterSpacing: 0.8,
  },
});

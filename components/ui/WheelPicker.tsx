import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';

export const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
export const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 220
export const PADDING_COUNT = Math.floor(VISIBLE_ITEMS / 2); // 2

interface WheelItemProps {
  label: string;
  unit?: string;
  isSelected: boolean;
  onPress: () => void;
  itemHeight: number;
}

const WheelItem = React.memo(
  function WheelItem({ label, unit, isSelected, onPress, itemHeight }: WheelItemProps) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.item, { height: itemHeight }]}
        accessibilityRole="button"
        hitSlop={{ top: 2, bottom: 2, left: 4, right: 4 }}
      >
        <View style={styles.itemRow}>
          <Text
            style={[
              styles.itemText,
              isSelected ? styles.itemTextSelected : styles.itemTextFaded,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {isSelected && unit ? (
            <Text style={styles.itemUnitSelected} numberOfLines={1}>
              {' '}{unit}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.label === next.label &&
    prev.unit === next.unit &&
    prev.isSelected === next.isSelected &&
    prev.itemHeight === next.itemHeight
);

type ListItem<T> =
  | { isPad: true; key: string }
  | { isPad: false; value: T; key: string };

export interface WheelPickerProps<T extends number | string> {
  data: T[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  formatLabel?: (value: T) => string;
  unit?: string;
  onActivePress?: () => void;
}

export function WheelPicker<T extends number | string>({
  data,
  selectedValue,
  onValueChange,
  formatLabel,
  unit,
  onActivePress,
}: WheelPickerProps<T>) {
  const listRef = useRef<FlatList<ListItem<T>>>(null);
  const isInteractingRef = useRef(false);
  const lastReportedIndexRef = useRef<number>(-1);
  const lastHapticIndexRef = useRef<number>(-1);

  const selectedIndex = Math.max(0, data.findIndex((item) => item === selectedValue));

  const paddedData: ListItem<T>[] = useMemo(() => {
    const topPads: ListItem<T>[] = Array.from({ length: PADDING_COUNT }, (_, i) => ({
      isPad: true,
      key: `pad-top-${i}`,
    }));
    const items: ListItem<T>[] = data.map((value, i) => ({
      isPad: false,
      value,
      key: `item-${String(value)}-${i}`,
    }));
    const botPads: ListItem<T>[] = Array.from({ length: PADDING_COUNT }, (_, i) => ({
      isPad: true,
      key: `pad-bot-${i}`,
    }));
    return [...topPads, ...items, ...botPads];
  }, [data]);

  // Initial scroll position
  useEffect(() => {
    lastReportedIndexRef.current = selectedIndex;
    lastHapticIndexRef.current = selectedIndex;
    const timeout = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 30);
    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to selected value if changed externally
  useEffect(() => {
    const targetIdx = data.findIndex((item) => item === selectedValue);
    if (targetIdx < 0) return;

    if (!isInteractingRef.current && targetIdx !== lastReportedIndexRef.current) {
      lastReportedIndexRef.current = targetIdx;
      lastHapticIndexRef.current = targetIdx;
      listRef.current?.scrollToOffset({
        offset: targetIdx * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedValue, data]);

  // Pure 60 FPS haptics check — NO state updates during onScroll
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const rawIdx = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, rawIdx));

      if (clamped !== lastHapticIndexRef.current) {
        lastHapticIndexRef.current = clamped;
        if (Platform.OS !== 'web') {
          Haptics.selectionAsync().catch(() => {});
        }
      }
    },
    [data.length]
  );

  // Commit selected value only when scroll settles
  const commitIndex = useCallback(
    (offsetY: number) => {
      isInteractingRef.current = false;
      const rawIdx = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, rawIdx));

      listRef.current?.scrollToOffset({
        offset: clamped * ITEM_HEIGHT,
        animated: true,
      });

      if (clamped !== lastReportedIndexRef.current) {
        lastReportedIndexRef.current = clamped;
        onValueChange(data[clamped]);
      }
    },
    [data, onValueChange]
  );

  const handleScrollBeginDrag = () => {
    isInteractingRef.current = true;
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const velocity = Math.abs(e.nativeEvent.velocity?.y ?? 0);
    if (velocity < 0.1) {
      commitIndex(e.nativeEvent.contentOffset.y);
    }
  };

  const handleMomentumScrollBegin = () => {
    isInteractingRef.current = true;
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    commitIndex(e.nativeEvent.contentOffset.y);
  };

  const renderItem = useCallback(
    ({ item, index }: { item: ListItem<T>; index: number }) => {
      if (item.isPad) {
        return <View style={{ height: ITEM_HEIGHT }} />;
      }

      const dataIdx = index - PADDING_COUNT;
      const isSelected = dataIdx === selectedIndex;
      const displayLabel = formatLabel ? formatLabel(item.value) : String(item.value);

      const handlePress = () => {
        if (isSelected) {
          onActivePress?.();
        } else {
          isInteractingRef.current = false;
          lastReportedIndexRef.current = dataIdx;
          lastHapticIndexRef.current = dataIdx;
          listRef.current?.scrollToOffset({
            offset: dataIdx * ITEM_HEIGHT,
            animated: true,
          });
          if (Platform.OS !== 'web') {
            Haptics.selectionAsync().catch(() => {});
          }
          onValueChange(data[dataIdx]);
        }
      };

      return (
        <WheelItem
          label={displayLabel}
          unit={unit}
          isSelected={isSelected}
          onPress={handlePress}
          itemHeight={ITEM_HEIGHT}
        />
      );
    },
    [selectedIndex, formatLabel, unit, onActivePress, data, onValueChange]
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={paddedData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        windowSize={5}
        maxToRenderPerBatch={5}
        initialNumToRender={7}
        removeClippedSubviews={Platform.OS !== 'web'}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={styles.list}
        nestedScrollEnabled
        bounces={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: PICKER_HEIGHT,
    width: '100%',
    overflow: 'hidden',
  },
  list: {
    height: PICKER_HEIGHT,
    width: '100%',
  },
  item: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  itemText: {
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  itemTextSelected: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.primary,
  },
  itemTextFaded: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E959F',
    opacity: 0.22,
  },
  itemUnitSelected: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.2,
    opacity: 0.9,
  },
});

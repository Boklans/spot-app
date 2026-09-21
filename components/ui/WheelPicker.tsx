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
  const lastHapticTimeRef = useRef<number>(0);
  const isHapticBusyRef = useRef<boolean>(false);
  const lastOffsetRef = useRef<number>(0);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Initial scroll position on mount
  useEffect(() => {
    lastReportedIndexRef.current = selectedIndex;
    lastHapticIndexRef.current = selectedIndex;
    lastOffsetRef.current = selectedIndex * ITEM_HEIGHT;
    const timeout = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 20);
    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to selected value ONLY if changed externally (e.g. keypad input)
  useEffect(() => {
    const targetIdx = data.findIndex((item) => item === selectedValue);
    if (targetIdx < 0) return;

    if (!isInteractingRef.current && targetIdx !== lastReportedIndexRef.current) {
      lastReportedIndexRef.current = targetIdx;
      lastHapticIndexRef.current = targetIdx;
      lastOffsetRef.current = targetIdx * ITEM_HEIGHT;
      listRef.current?.scrollToOffset({
        offset: targetIdx * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedValue, data]);

  // Commit and snap to closest item
  const commitIndex = useCallback(
    (offsetY: number) => {
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
        settleTimeoutRef.current = null;
      }
      isInteractingRef.current = false;
      const rawIdx = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, rawIdx));

      listRef.current?.scrollToOffset({
        offset: clamped * ITEM_HEIGHT,
        animated: true,
      });

      lastOffsetRef.current = clamped * ITEM_HEIGHT;

      if (clamped !== lastReportedIndexRef.current) {
        lastReportedIndexRef.current = clamped;
        onValueChange(data[clamped]);
      }
    },
    [data, onValueChange]
  );

  // Pure 60 FPS scroll handler with idle fallback timer to prevent ANY freeze
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      lastOffsetRef.current = offsetY;
      const rawIdx = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, rawIdx));

      // Throttled haptics
      if (clamped !== lastHapticIndexRef.current) {
        const now = Date.now();
        if (!isHapticBusyRef.current && now - lastHapticTimeRef.current >= 70) {
          lastHapticIndexRef.current = clamped;
          lastHapticTimeRef.current = now;
          if (Platform.OS !== 'web') {
            isHapticBusyRef.current = true;
            Haptics.selectionAsync()
              .catch(() => {})
              .finally(() => {
                isHapticBusyRef.current = false;
              });
          }
        }
      }

      // Safety Idle Timer: if momentum/drag event is dropped by the OS,
      // this ensures the wheel ALWAYS snaps and commits after 140ms of inactivity.
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
      settleTimeoutRef.current = setTimeout(() => {
        commitIndex(lastOffsetRef.current);
      }, 140);
    },
    [data.length, commitIndex]
  );

  const handleScrollBeginDrag = () => {
    isInteractingRef.current = true;
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
    }
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
          if (settleTimeoutRef.current) {
            clearTimeout(settleTimeoutRef.current);
          }
          lastReportedIndexRef.current = dataIdx;
          lastHapticIndexRef.current = dataIdx;
          lastOffsetRef.current = dataIdx * ITEM_HEIGHT;
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

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={paddedData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        windowSize={11}
        maxToRenderPerBatch={15}
        removeClippedSubviews={false}
        scrollEventThrottle={32}
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

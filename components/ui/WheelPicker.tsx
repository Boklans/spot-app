import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef } from 'react';
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
export const PADDING_OFFSET = PADDING_COUNT * ITEM_HEIGHT; // 88

interface WheelItemProps {
  label: string;
  unit?: string;
  isSelected: boolean;
  onPress: () => void;
}

const WheelItem = React.memo(
  function WheelItem({ label, unit, isSelected, onPress }: WheelItemProps) {
    return (
      <Pressable
        onPress={onPress}
        style={styles.item}
        accessibilityRole="button"
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
    prev.isSelected === next.isSelected
);

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
  const listRef = useRef<FlatList<T>>(null);
  const isInteractingRef = useRef(false);
  const lastReportedIndexRef = useRef<number>(-1);
  const lastVibratedIndexRef = useRef<number>(-1);
  const lastOffsetRef = useRef<number>(0);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = Math.max(0, data.findIndex((item) => item === selectedValue));

  // Initial scroll position on mount
  useEffect(() => {
    lastReportedIndexRef.current = selectedIndex;
    lastVibratedIndexRef.current = selectedIndex;
    lastOffsetRef.current = selectedIndex * ITEM_HEIGHT;
    const timeout = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 20);
    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to selected value ONLY if changed externally (e.g. direct keypad input)
  useEffect(() => {
    const targetIdx = data.findIndex((item) => item === selectedValue);
    if (targetIdx < 0) return;

    if (!isInteractingRef.current && targetIdx !== lastReportedIndexRef.current) {
      lastReportedIndexRef.current = targetIdx;
      lastVibratedIndexRef.current = targetIdx;
      lastOffsetRef.current = targetIdx * ITEM_HEIGHT;
      listRef.current?.scrollToOffset({
        offset: targetIdx * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedValue, data]);

  // Snap into clean geometric alignment and commit value
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
        lastVibratedIndexRef.current = clamped;
        onValueChange(data[clamped]);
      }
    },
    [data, onValueChange]
  );

  // Pure 60 FPS scroll handler:
  // - Haptics ONLY when calculated mathematical index actually changes
  // - Idle timeout fallback if native momentum stops abruptly
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      lastOffsetRef.current = offsetY;
      const rawIdx = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, rawIdx));

      // Haptics fire ONLY once per item when index actually changes
      if (clamped !== lastVibratedIndexRef.current) {
        lastVibratedIndexRef.current = clamped;
        if (Platform.OS !== 'web') {
          Haptics.selectionAsync().catch(() => {});
        }
      }

      // Safety Idle Timer for abrupt finger stops
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
      settleTimeoutRef.current = setTimeout(() => {
        commitIndex(lastOffsetRef.current);
      }, 100);
    },
    [data.length, commitIndex]
  );

  const handleScrollBeginDrag = () => {
    isInteractingRef.current = true;
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
    }
  };

  // Critical fix for Finger Stops:
  // If velocity is 0 or close to 0, no momentum phase will happen.
  // Immediately calculate and snap to prevent stopping halfway!
  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const velocityY = Math.abs(e.nativeEvent.velocity?.y ?? 0);
    if (velocityY < 0.1) {
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
    ({ item, index }: { item: T; index: number }) => {
      const isSelected = index === selectedIndex;
      const displayLabel = formatLabel ? formatLabel(item) : String(item);

      const handlePress = () => {
        if (isSelected) {
          onActivePress?.();
        } else {
          isInteractingRef.current = false;
          if (settleTimeoutRef.current) {
            clearTimeout(settleTimeoutRef.current);
          }
          lastReportedIndexRef.current = index;
          lastVibratedIndexRef.current = index;
          lastOffsetRef.current = index * ITEM_HEIGHT;
          listRef.current?.scrollToOffset({
            offset: index * ITEM_HEIGHT,
            animated: true,
          });
          if (Platform.OS !== 'web') {
            Haptics.selectionAsync().catch(() => {});
          }
          onValueChange(data[index]);
        }
      };

      return (
        <WheelItem
          label={displayLabel}
          unit={unit}
          isSelected={isSelected}
          onPress={handlePress}
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
        data={data}
        keyExtractor={(item) => String(item)}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        decelerationRate="fast"
        disableIntervalMomentum={true}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        windowSize={11}
        maxToRenderPerBatch={15}
        removeClippedSubviews={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={styles.list}
        contentContainerStyle={styles.listContent}
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
  listContent: {
    paddingVertical: PADDING_OFFSET,
  },
  item: {
    width: '100%',
    height: ITEM_HEIGHT,
    minHeight: ITEM_HEIGHT,
    maxHeight: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemRow: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: ITEM_HEIGHT,
    includeFontPadding: false,
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
    lineHeight: ITEM_HEIGHT,
    includeFontPadding: false,
  },
});

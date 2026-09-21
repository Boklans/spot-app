import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';

const ITEM_HEIGHT = 56;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING_COUNT = Math.floor(VISIBLE_ITEMS / 2); // 2 padding slots

interface WheelPickerProps<T extends number | string> {
  data: T[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  formatLabel?: (value: T) => string;
  label?: string;
  unit?: string;
}

export function WheelPicker<T extends number | string>({
  data,
  selectedValue,
  onValueChange,
  formatLabel,
  label,
  unit,
}: WheelPickerProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const isUserInteractingRef = useRef(false);
  const lastEmittedIndexRef = useRef<number>(-1);
  const lastHapticIndexRef = useRef<number>(-1);

  const initialIndex = Math.max(0, data.findIndex((item) => item === selectedValue));
  const [activeIndex, setActiveIndex] = useState(initialIndex >= 0 ? initialIndex : 0);

  // Sync scroll position when selectedValue changes externally (not by user dragging)
  useEffect(() => {
    const targetIdx = data.findIndex((item) => item === selectedValue);
    if (targetIdx < 0) return;

    setActiveIndex(targetIdx);
    lastEmittedIndexRef.current = targetIdx;
    lastHapticIndexRef.current = targetIdx;

    // Do NOT fight user interaction or re-scroll if already at the right spot
    if (!isUserInteractingRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({
        y: targetIdx * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedValue, data]);

  // Initial scroll position on mount
  useEffect(() => {
    const targetIdx = Math.max(0, data.findIndex((item) => item === selectedValue));
    lastEmittedIndexRef.current = targetIdx;
    lastHapticIndexRef.current = targetIdx;
    if (scrollRef.current) {
      // Small timeout to guarantee layout is ready
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: targetIdx * ITEM_HEIGHT,
          animated: false,
        });
      }, 50);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live tracking during scroll for real-time visual highlight and mechanical haptics
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const rawIndex = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, rawIndex));

      if (clamped !== activeIndex) {
        setActiveIndex(clamped);
      }

      if (clamped !== lastHapticIndexRef.current) {
        lastHapticIndexRef.current = clamped;
        if (Platform.OS !== 'web') {
          Haptics.selectionAsync().catch(() => {});
        }
      }
    },
    [data.length, activeIndex]
  );

  // Commit selected value when motion stops
  const commitSelection = useCallback(
    (offsetY: number) => {
      isUserInteractingRef.current = false;
      const rawIndex = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, rawIndex));

      setActiveIndex(clamped);

      // Snap cleanly into position
      scrollRef.current?.scrollTo({
        y: clamped * ITEM_HEIGHT,
        animated: true,
      });

      if (clamped !== lastEmittedIndexRef.current) {
        lastEmittedIndexRef.current = clamped;
        const newVal = data[clamped];
        onValueChange(newVal);
      }
    },
    [data, onValueChange]
  );

  const handleScrollBeginDrag = () => {
    isUserInteractingRef.current = true;
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const velocity = Math.abs(e.nativeEvent.velocity?.y ?? 0);
    // If user gently released without momentum, commit right away
    if (velocity < 0.1) {
      commitSelection(e.nativeEvent.contentOffset.y);
    }
  };

  const handleMomentumScrollBegin = () => {
    isUserInteractingRef.current = true;
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    commitSelection(e.nativeEvent.contentOffset.y);
  };

  const handleItemPress = (index: number) => {
    isUserInteractingRef.current = false;
    setActiveIndex(index);
    lastEmittedIndexRef.current = index;
    lastHapticIndexRef.current = index;

    scrollRef.current?.scrollTo({
      y: index * ITEM_HEIGHT,
      animated: true,
    });

    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onValueChange(data[index]);
  };

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.pickerContainer}>
        {/* Center selection highlight band */}
        <View style={styles.selectionBand} pointerEvents="none" />

        {/* Top and bottom gradient fade overlays */}
        <View style={styles.topFade} pointerEvents="none" />
        <View style={styles.bottomFade} pointerEvents="none" />

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.95}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollBegin={handleMomentumScrollBegin}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          nestedScrollEnabled
          bounces={true}
        >
          {/* Top padding to center the first element */}
          {Array.from({ length: PADDING_COUNT }).map((_, i) => (
            <View key={`pad-top-${i}`} style={styles.item} />
          ))}

          {data.map((item, index) => {
            const distance = Math.abs(index - activeIndex);
            const isSelected = distance === 0;
            const isAdjacent = distance === 1;

            const opacity = isSelected ? 1 : isAdjacent ? 0.45 : 0.18;
            const fontSize = isSelected ? 32 : isAdjacent ? 22 : 16;
            const fontWeight: '900' | '700' | '500' = isSelected
              ? '900'
              : isAdjacent
              ? '700'
              : '500';
            const color = isSelected ? colors.primary : '#FFFFFF';
            const displayLabel = formatLabel ? formatLabel(item) : String(item);

            return (
              <Pressable
                key={`item-${String(item)}-${index}`}
                onPress={() => handleItemPress(index)}
                style={styles.item}
              >
                <Text
                  style={[
                    styles.itemText,
                    { opacity, fontSize, fontWeight, color },
                  ]}
                  numberOfLines={1}
                >
                  {displayLabel}
                </Text>
              </Pressable>
            );
          })}

          {/* Bottom padding to center the last element */}
          {Array.from({ length: PADDING_COUNT }).map((_, i) => (
            <View key={`pad-bot-${i}`} style={styles.item} />
          ))}
        </ScrollView>
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
    fontSize: 11,
    fontWeight: '800',
    color: '#717B8A',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  pickerContainer: {
    height: PICKER_HEIGHT,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  scroll: {
    height: PICKER_HEIGHT,
  },
  scrollContent: {
    // padding slots handle alignment
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  // Glowing lime frame around center item
  selectionBand: {
    position: 'absolute',
    top: ITEM_HEIGHT * PADDING_COUNT,
    left: 8,
    right: 8,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.28)',
    backgroundColor: 'rgba(200, 255, 61, 0.03)',
    borderRadius: 8,
    zIndex: 3,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * PADDING_COUNT,
    backgroundColor: 'rgba(11, 13, 15, 0.72)',
    zIndex: 2,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * PADDING_COUNT,
    backgroundColor: 'rgba(11, 13, 15, 0.72)',
    zIndex: 2,
  },
  unit: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#717B8A',
    letterSpacing: 0.8,
  },
});

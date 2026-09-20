import React, { useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { hapticLight } from '@/lib/haptics';

export type StrengthSessionPoint = {
  date: string;
  formattedDate: string;
  weight: number;
  reps: number;
  volume: number;
  est1RM: number;
};

type RealStrengthGraphProps = {
  data: StrengthSessionPoint[];
  width?: number;
  height?: number;
  unit?: string;
};

export function RealStrengthGraph({
  data,
  width,
  height = 160,
  unit = 'kg',
}: RealStrengthGraphProps) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = width ?? Math.min(screenWidth - 68, 330);

  const [selectedIdx, setSelectedIdx] = useState<number>(
    data.length > 0 ? data.length - 1 : 0
  );

  if (!data || data.length === 0) return null;

  // 1. Calculate smart scaling for Y-axis
  const weights = data.map((d) => d.weight);
  let rawMin = Math.min(...weights);
  let rawMax = Math.max(...weights);

  let minY: number;
  let maxY: number;

  if (rawMin === rawMax) {
    minY = Math.max(0, rawMin - 10);
    maxY = rawMax + 10;
  } else {
    const pad = Math.max(2.5, (rawMax - rawMin) * 0.25);
    minY = Math.max(0, Math.floor((rawMin - pad) / 2.5) * 2.5);
    maxY = Math.ceil((rawMax + pad) / 2.5) * 2.5;
  }

  const rangeY = maxY - minY || 1;
  const midY = Math.round(((minY + maxY) / 2) * 10) / 10;

  // Geometry dimensions
  const yAxisWidth = 42;
  const graphAreaWidth = chartWidth - yAxisWidth - 10;
  const graphAreaHeight = height - 42; // leave space for X-axis dates
  const topPadding = 16;
  const bottomPadding = 12;
  const usableHeight = graphAreaHeight - topPadding - bottomPadding;

  // 2. Map data to coordinates
  const points = data.map((item, idx) => {
    const x =
      data.length === 1
        ? graphAreaWidth / 2
        : (idx / (data.length - 1)) * (graphAreaWidth - 24) + 12;

    const normalizedVal = (item.weight - minY) / rangeY;
    const y = topPadding + usableHeight - normalizedVal * usableHeight;

    return {
      ...item,
      x,
      y,
      idx,
    };
  });

  const selectedPoint = points[selectedIdx] ?? points[points.length - 1];

  const handlePointPress = (idx: number) => {
    hapticLight();
    setSelectedIdx(idx);
  };

  return (
    <View style={[styles.wrapper, { width: chartWidth, height }]}>
      {/* Tooltip for Selected Point */}
      {selectedPoint && (
        <View style={styles.tooltipContainer}>
          <View style={styles.tooltipPill}>
            <Text style={styles.tooltipWeight}>
              {selectedPoint.weight} {unit}
            </Text>
            <Text style={styles.tooltipDivider}>•</Text>
            <Text style={styles.tooltipReps}>
              {selectedPoint.reps} reps
            </Text>
            <Text style={styles.tooltipDivider}>•</Text>
            <Text style={styles.tooltipDate}>
              {selectedPoint.formattedDate}
            </Text>
          </View>
        </View>
      )}

      {/* Main Chart Body: Y-Axis + Graph Canvas */}
      <View style={[styles.mainBody, { height: graphAreaHeight }]}>
        {/* Y-Axis Labels */}
        <View style={[styles.yAxis, { width: yAxisWidth }]}>
          <Text style={styles.yAxisText}>{maxY}</Text>
          <Text style={styles.yAxisText}>{midY}</Text>
          <Text style={styles.yAxisText}>{minY}</Text>
        </View>

        {/* Plot Area */}
        <View style={[styles.plotArea, { width: graphAreaWidth }]}>
          {/* Horizontal Grid Lines */}
          <View style={[styles.gridLine, { top: topPadding }]} />
          <View style={[styles.gridLine, { top: topPadding + usableHeight / 2 }]} />
          <View style={[styles.gridLine, { top: topPadding + usableHeight }]} />

          {/* Vertical Stems down from points */}
          {points.map((p) => {
            const isSelected = p.idx === selectedIdx;
            return (
              <View
                key={`stem-${p.idx}`}
                style={{
                  position: 'absolute',
                  left: p.x - 0.5,
                  top: p.y,
                  width: 1,
                  height: topPadding + usableHeight - p.y,
                  backgroundColor: isSelected
                    ? 'rgba(200, 255, 61, 0.35)'
                    : 'rgba(255, 255, 255, 0.05)',
                }}
              />
            );
          })}

          {/* Connecting Line Segments */}
          {points.length > 1 &&
            points.slice(0, -1).map((p1, idx) => {
              const p2 = points[idx + 1];
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;

              return (
                <View
                  key={`seg-${idx}`}
                  style={{
                    position: 'absolute',
                    left: midX - length / 2,
                    top: midY - 1.5,
                    width: length,
                    height: 3,
                    backgroundColor: colors.primary,
                    borderRadius: 1.5,
                    transform: [{ rotate: `${angle}deg` }],
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.7,
                    shadowRadius: 5,
                  }}
                />
              );
            })}

          {/* Data Nodes */}
          {points.map((p) => {
            const isSelected = p.idx === selectedIdx;
            return (
              <Pressable
                key={`node-${p.idx}`}
                hitSlop={14}
                onPress={() => handlePointPress(p.idx)}
                style={{
                  position: 'absolute',
                  left: p.x - 12,
                  top: p.y - 12,
                  width: 24,
                  height: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: isSelected ? 10 : 2,
                }}
              >
                {isSelected ? (
                  <View style={styles.selectedNodeOuter}>
                    <View style={styles.selectedNodeInner} />
                  </View>
                ) : (
                  <View style={styles.standardNode} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* X-Axis Timeline Dates */}
      <View style={[styles.xAxis, { marginLeft: yAxisWidth, width: graphAreaWidth }]}>
        {points.map((p, idx) => {
          // If too many points, show first, middle, last
          const showLabel =
            points.length <= 4 ||
            idx === 0 ||
            idx === points.length - 1 ||
            idx === Math.floor(points.length / 2);

          if (!showLabel) return null;

          return (
            <Text
              key={`date-${idx}`}
              style={[
                styles.xAxisText,
                {
                  left: Math.max(0, Math.min(graphAreaWidth - 45, p.x - 20)),
                },
                p.idx === selectedIdx && styles.xAxisTextActive,
              ]}
            >
              {p.formattedDate}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginTop: 6,
    marginBottom: 4,
  },
  tooltipContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  tooltipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#161B24',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  tooltipWeight: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  tooltipDivider: {
    color: '#4B5565',
    fontSize: 12,
  },
  tooltipReps: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipDate: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '600',
  },
  mainBody: {
    flexDirection: 'row',
    width: '100%',
  },
  yAxis: {
    justifyContent: 'space-between',
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  yAxisText: {
    color: '#6C7A8E',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  plotArea: {
    position: 'relative',
    height: '100%',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  standardNode: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  selectedNodeOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#12161D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  selectedNodeInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  xAxis: {
    position: 'relative',
    height: 20,
    marginTop: 4,
  },
  xAxisText: {
    position: 'absolute',
    color: '#6C7A8E',
    fontSize: 10,
    fontWeight: '600',
  },
  xAxisTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});


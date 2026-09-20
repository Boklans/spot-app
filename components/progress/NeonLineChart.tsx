import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/colors';

type NeonLineChartProps = {
  data: number[];
  width?: number;
  height?: number;
  lineColor?: string;
};

export function NeonLineChart({
  data,
  width = 280,
  height = 90,
  lineColor = colors.primary,
}: NeonLineChartProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const paddingX = 10;
  const paddingY = 12;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = data.map((val, idx) => {
    const x = paddingX + (idx / (data.length - 1)) * chartWidth;
    const y = paddingY + chartHeight - ((val - min) / range) * chartHeight;
    return { x, y, val };
  });

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Grid lines */}
      <View style={[styles.gridLine, { top: paddingY }]} />
      <View style={[styles.gridLine, { top: paddingY + chartHeight / 2 }]} />
      <View style={[styles.gridLine, { top: paddingY + chartHeight }]} />

      {/* Segments */}
      {points.slice(0, -1).map((p1, idx) => {
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
              top: midY - 1.25,
              width: length,
              height: 2.5,
              backgroundColor: lineColor,
              borderRadius: 1.25,
              transform: [{ rotate: `${angle}deg` }],
              shadowColor: lineColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 4,
            }}
          />
        );
      })}

      {/* Nodes */}
      {points.map((p, idx) => {
        const isLast = idx === points.length - 1;
        if (isLast) {
          return (
            <View
              key={`node-${idx}`}
              style={[
                styles.lastNodeOuter,
                { left: p.x - 7, top: p.y - 7, borderColor: lineColor },
              ]}
            >
              <View style={[styles.lastNodeInner, { backgroundColor: lineColor }]} />
            </View>
          );
        }
        return (
          <View
            key={`node-${idx}`}
            style={[
              styles.node,
              { left: p.x - 3.5, top: p.y - 3.5, backgroundColor: lineColor },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'visible',
    marginVertical: 8,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  node: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  lastNodeOuter: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    backgroundColor: '#12161D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  lastNodeInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});


import React, { useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '@/constants/colors';
import { hapticLight } from '@/lib/haptics';
import { BodyWeightEntry } from '@/store/bodyWeightStore';

interface BodyWeightGraphProps {
  entries: BodyWeightEntry[];
  width?: number;
  height?: number;
  unit?: string;
  fromKg?: (kg: number) => number;
}

export function BodyWeightGraph({
  entries,
  width,
  height = 180,
  unit = 'kg',
  fromKg = (kg) => kg,
}: BodyWeightGraphProps) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = width ?? Math.min(screenWidth - 48, 340);

  const [selectedIdx, setSelectedIdx] = useState<number>(
    entries.length > 0 ? entries.length - 1 : 0
  );

  if (!entries || entries.length === 0) return null;

  // Transform entries into display points
  const points = entries.map((e) => ({
    id: e.id,
    date: e.date,
    weight: Math.round(fromKg(e.weightKg) * 10) / 10,
    timestamp: e.timestamp,
  }));

  const weights = points.map((p) => p.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);

  // Y axis bounds with breathing room
  let minY: number;
  let maxY: number;
  if (minWeight === maxWeight) {
    minY = Math.max(0, Math.floor(minWeight - 3));
    maxY = Math.ceil(maxWeight + 3);
  } else {
    const pad = Math.max(1.5, (maxWeight - minWeight) * 0.25);
    minY = Math.floor(minWeight - pad);
    maxY = Math.ceil(maxWeight + pad);
  }
  const rangeY = maxY - minY || 1;

  // Chart padding
  const padLeft = 42;
  const padRight = 20;
  const padTop = 24;
  const padBottom = 30;

  const plotW = chartWidth - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Coordinates
  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? padLeft + plotW / 2
        : padLeft + (i / (points.length - 1)) * plotW;
    const normY = (p.weight - minY) / rangeY;
    const y = padTop + plotH - normY * plotH;
    return { x, y, ...p };
  });

  // SVG Line path & Gradient Area
  let linePath = '';
  let areaPath = '';

  if (coords.length === 1) {
    linePath = `M ${coords[0].x - 20} ${coords[0].y} L ${coords[0].x + 20} ${coords[0].y}`;
  } else {
    coords.forEach((c, i) => {
      if (i === 0) {
        linePath = `M ${c.x} ${c.y}`;
      } else {
        // Smooth bezier curve
        const prev = coords[i - 1];
        const cp1x = prev.x + (c.x - prev.x) / 2;
        const cp1y = prev.y;
        const cp2x = prev.x + (c.x - prev.x) / 2;
        const cp2y = c.y;
        linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${c.x} ${c.y}`;
      }
    });

    const first = coords[0];
    const last = coords[coords.length - 1];
    areaPath = `${linePath} L ${last.x} ${padTop + plotH} L ${first.x} ${padTop + plotH} Z`;
  }

  const selectedPoint = coords[Math.min(selectedIdx, coords.length - 1)] ?? coords[coords.length - 1];

  return (
    <View style={styles.container}>
      {/* Selected Value Callout */}
      <View style={styles.calloutRow}>
        <View>
          <Text style={styles.calloutWeight}>
            {selectedPoint.weight} <Text style={styles.calloutUnit}>{unit}</Text>
          </Text>
          <Text style={styles.calloutDate}>
            {new Date(selectedPoint.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>

        <View style={styles.calloutMeta}>
          <Text style={styles.rangeText}>
            Min {minWeight} • Max {maxWeight} {unit}
          </Text>
        </View>
      </View>

      {/* SVG Chart */}
      <View style={{ width: chartWidth, height }}>
        <Svg width={chartWidth} height={height}>
          <Defs>
            <LinearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.35} />
              <Stop offset="70%" stopColor={colors.primary} stopOpacity={0.06} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {/* Grid lines & Y-axis labels */}
          {[minY, (minY + maxY) / 2, maxY].map((val, idx) => {
            const norm = (val - minY) / rangeY;
            const y = padTop + plotH - norm * plotH;
            return (
              <React.Fragment key={idx}>
                <Line
                  x1={padLeft}
                  y1={y}
                  x2={chartWidth - padRight}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.07)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              </React.Fragment>
            );
          })}

          {/* Area under curve */}
          {areaPath ? <Path d={areaPath} fill="url(#bwGrad)" /> : null}

          {/* Glowing Stroke Line */}
          <Path
            d={linePath}
            fill="none"
            stroke={colors.primary}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {coords.map((c, i) => {
            const isSelected = i === selectedIdx;
            return (
              <React.Fragment key={c.id}>
                {isSelected && (
                  <Circle
                    cx={c.x}
                    cy={c.y}
                    r={9}
                    fill="rgba(200, 255, 61, 0.3)"
                  />
                )}
                <Circle
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 5 : 3.5}
                  fill={isSelected ? '#0B0D0F' : colors.primary}
                  stroke={isSelected ? colors.primary : '#0B0D0F'}
                  strokeWidth={2}
                />
              </React.Fragment>
            );
          })}
        </Svg>

        {/* Y Axis Numbers Overlay */}
        <View style={[styles.yAxisLabels, { top: padTop, height: plotH }]}>
          <Text style={styles.axisLabel}>{Math.round(maxY)}</Text>
          <Text style={styles.axisLabel}>{Math.round((minY + maxY) / 2)}</Text>
          <Text style={styles.axisLabel}>{Math.round(minY)}</Text>
        </View>

        {/* Interactive Tap Zones */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {coords.map((c, i) => (
            <Pressable
              key={c.id}
              hitSlop={15}
              onPress={() => {
                hapticLight();
                setSelectedIdx(i);
              }}
              style={{
                position: 'absolute',
                left: c.x - 18,
                top: c.y - 18,
                width: 36,
                height: 36,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  calloutRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  calloutWeight: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  calloutUnit: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  calloutDate: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  calloutMeta: {
    alignItems: 'flex-end',
  },
  rangeText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  yAxisLabels: {
    position: 'absolute',
    left: 4,
    width: 34,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  axisLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
});


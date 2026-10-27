import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { ThemeColors, useThemeColors } from '@/constants/colors';
import { hapticLight } from '@/lib/haptics';

export type StrengthSessionPoint = {
  date: string;
  formattedDate: string;
  weight: number;
  reps: number;
  volume: number;
  est1RM: number;
};

export type StrengthChartMetric = 'weight' | 'est1RM' | 'volume';

type RealStrengthGraphProps = {
  data: StrengthSessionPoint[];
  width?: number;
  height?: number;
  unit?: string;
  metric?: StrengthChartMetric;
};

export function RealStrengthGraph({
  data,
  width,
  height = 175,
  unit = 'kg',
  metric = 'weight',
}: RealStrengthGraphProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = width ?? Math.min(screenWidth - 68, 330);

  const [selectedIdx, setSelectedIdx] = useState<number>(
    data.length > 0 ? data.length - 1 : 0
  );

  useEffect(() => {
    if (data.length > 0) {
      setSelectedIdx(data.length - 1);
    }
  }, [data.length, data[0]?.date, data[data.length - 1]?.weight, metric]);

  if (!data || data.length === 0) return null;

  const getMetricValue = (d: StrengthSessionPoint) => {
    if (metric === 'est1RM') return Math.round(d.est1RM * 10) / 10;
    if (metric === 'volume') return Math.round(d.volume);
    return Math.round(d.weight * 10) / 10;
  };

  // 1. Calculate smart scaling for Y-axis + Average
  const values = data.map(getMetricValue);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const avgVal =
    Math.round((values.reduce((acc, v) => acc + v, 0) / values.length) * 10) / 10;

  let minY: number;
  let maxY: number;

  if (rawMin === rawMax) {
    const step = metric === 'volume' ? Math.max(50, Math.round(rawMax * 0.2)) : 10;
    minY = Math.max(0, rawMin - step);
    maxY = rawMax + step;
  } else {
    const pad = Math.max(metric === 'volume' ? 25 : 2.5, (rawMax - rawMin) * 0.25);
    const snap = metric === 'volume' ? 10 : 2.5;
    minY = Math.max(0, Math.floor((rawMin - pad) / snap) * snap);
    maxY = Math.ceil((rawMax + pad) / snap) * snap;
  }

  const rangeY = maxY - minY || 1;
  const midY = Math.round(((minY + maxY) / 2) * 10) / 10;

  // Geometry dimensions
  const yAxisWidth = metric === 'volume' ? 46 : 40;
  const graphAreaWidth = chartWidth - yAxisWidth - 6;
  const graphAreaHeight = height - 48; // leave space for tooltip & X-axis dates
  const topPadding = 14;
  const bottomPadding = 10;
  const usableHeight = graphAreaHeight - topPadding - bottomPadding;

  // 2. Map data to coordinates
  const points = data.map((item, idx) => {
    const val = getMetricValue(item);
    const x =
      data.length === 1
        ? graphAreaWidth / 2
        : (idx / (data.length - 1)) * (graphAreaWidth - 28) + 14;

    const normalizedVal = (val - minY) / rangeY;
    const y = topPadding + usableHeight - normalizedVal * usableHeight;

    return {
      ...item,
      metricVal: val,
      x,
      y,
      idx,
    };
  });

  const avgNorm = (avgVal - minY) / rangeY;
  const avgY = topPadding + usableHeight - avgNorm * usableHeight;

  // 3. Smooth Cubic Bezier SVG Path & Gradient Area
  let linePath = '';
  let areaPath = '';

  if (points.length === 1) {
    const p = points[0];
    linePath = `M ${Math.max(8, p.x - 28)} ${p.y} L ${Math.min(graphAreaWidth - 8, p.x + 28)} ${p.y}`;
    areaPath = `${linePath} L ${Math.min(graphAreaWidth - 8, p.x + 28)} ${topPadding + usableHeight} L ${Math.max(8, p.x - 28)} ${topPadding + usableHeight} Z`;
  } else {
    points.forEach((p, i) => {
      if (i === 0) {
        linePath = `M ${p.x} ${p.y}`;
      } else {
        const prev = points[i - 1];
        const cp1x = prev.x + (p.x - prev.x) * 0.45;
        const cp1y = prev.y;
        const cp2x = prev.x + (p.x - prev.x) * 0.55;
        const cp2y = p.y;
        linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
      }
    });

    const first = points[0];
    const last = points[points.length - 1];
    const baselineY = topPadding + usableHeight;
    areaPath = `${linePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
  }

  const safeSelectedIdx = Math.min(selectedIdx, points.length - 1);
  const selectedPoint = points[safeSelectedIdx] ?? points[points.length - 1];
  const prevPoint = safeSelectedIdx > 0 ? points[safeSelectedIdx - 1] : null;
  const deltaVal = prevPoint
    ? Math.round((selectedPoint.metricVal - prevPoint.metricVal) * 10) / 10
    : 0;

  const handlePointPress = (idx: number) => {
    hapticLight();
    setSelectedIdx(idx);
  };

  return (
    <View style={[styles.wrapper, { width: chartWidth, height }]}>
      {/* Interactive Selected Point Callout Pill */}
      {selectedPoint && (
        <View style={styles.tooltipContainer}>
          <View style={styles.tooltipPill}>
            <Text style={styles.tooltipWeight}>
              {metric === 'est1RM'
                ? `1RM ${selectedPoint.metricVal} ${unit}`
                : metric === 'volume'
                  ? `${selectedPoint.metricVal} ${unit}`
                  : `${selectedPoint.weight} ${unit}`}
            </Text>
            {metric === 'weight' && (
              <>
                <Text style={styles.tooltipDivider}>×</Text>
                <Text style={styles.tooltipReps}>{selectedPoint.reps}</Text>
              </>
            )}
            {deltaVal !== 0 && (
              <View
                style={[
                  styles.deltaBadge,
                  deltaVal < 0 && styles.deltaBadgeNegative,
                ]}
              >
                <Text
                  style={[
                    styles.deltaBadgeText,
                    deltaVal < 0 && styles.deltaBadgeTextNegative,
                  ]}
                >
                  {deltaVal > 0 ? `+${deltaVal}` : `${deltaVal}`} {unit}
                </Text>
              </View>
            )}
            <Text style={styles.tooltipDivider}>•</Text>
            <Text style={styles.tooltipDate}>
              {selectedPoint.formattedDate}
            </Text>
          </View>
        </View>
      )}

      {/* Main Chart Body: Y-Axis + SVG Graph Canvas */}
      <View style={[styles.mainBody, { height: graphAreaHeight }]}>
        {/* Y-Axis Labels */}
        <View style={[styles.yAxis, { width: yAxisWidth }]}>
          <Text style={styles.yAxisText}>{maxY}</Text>
          <Text style={styles.yAxisText}>{midY}</Text>
          <Text style={styles.yAxisText}>{minY}</Text>
        </View>

        {/* Plot Area */}
        <View style={[styles.plotArea, { width: graphAreaWidth, height: graphAreaHeight }]}>
          <Svg width={graphAreaWidth} height={graphAreaHeight}>
            <Defs>
              <LinearGradient id="strengthGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0%"
                  stopColor={colors.accentLine}
                  stopOpacity={colors.isDark ? 0.34 : 0.22}
                />
                <Stop
                  offset="65%"
                  stopColor={colors.accentLine}
                  stopOpacity={colors.isDark ? 0.08 : 0.05}
                />
                <Stop offset="100%" stopColor={colors.accentLine} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Horizontal Grid Lines */}
            {[topPadding, topPadding + usableHeight / 2, topPadding + usableHeight].map(
              (yPos, idx) => (
                <Line
                  key={`grid-${idx}`}
                  x1={0}
                  y1={yPos}
                  x2={graphAreaWidth}
                  y2={yPos}
                  stroke={colors.divider}
                  strokeWidth={1}
                />
              )
            )}

            {/* Dashed Average Reference Line (when multiple sessions exist) */}
            {points.length > 1 && (
              <Line
                x1={0}
                y1={avgY}
                x2={graphAreaWidth}
                y2={avgY}
                stroke={colors.isDark ? 'rgba(200, 255, 61, 0.32)' : 'rgba(22, 163, 74, 0.32)'}
                strokeDasharray="4 4"
                strokeWidth={1.2}
              />
            )}

            {/* Gradient Area Fill under Curve */}
            {areaPath ? <Path d={areaPath} fill="url(#strengthGrad)" /> : null}

            {/* Selected Point Vertical Crosshair Stem */}
            {selectedPoint && (
              <Line
                x1={selectedPoint.x}
                y1={topPadding}
                x2={selectedPoint.x}
                y2={topPadding + usableHeight}
                stroke={colors.isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(15, 23, 42, 0.14)'}
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}

            {/* Main Smooth Data Curve */}
            <Path
              d={linePath}
              fill="none"
              stroke={colors.accentLine}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {points.map((p) => {
              const isSelected = p.idx === safeSelectedIdx;
              return (
                <React.Fragment key={`pt-${p.idx}`}>
                  {isSelected && (
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r={10}
                      fill={colors.primaryMuted}
                    />
                  )}
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 5.5 : 3.5}
                    fill={isSelected ? colors.surface : colors.accentLine}
                    stroke={isSelected ? colors.accentLine : colors.surface}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Average Label Tag on Right Edge */}
          {points.length > 1 && (
            <View
              pointerEvents="none"
              style={[
                styles.avgTag,
                { top: Math.max(2, Math.min(graphAreaHeight - 18, avgY - 8)) },
              ]}
            >
              <Text style={styles.avgTagText}>AVG {avgVal}</Text>
            </View>
          )}

          {/* Interactive Touch Targets */}
          {points.map((p) => (
            <Pressable
              key={`touch-${p.idx}`}
              hitSlop={14}
              onPress={() => handlePointPress(p.idx)}
              style={{
                position: 'absolute',
                left: p.x - 16,
                top: p.y - 16,
                width: 32,
                height: 32,
              }}
            />
          ))}
        </View>
      </View>

      {/* X-Axis Timeline Dates */}
      <View style={[styles.xAxis, { marginLeft: yAxisWidth, width: graphAreaWidth }]}>
        {points.map((p, idx) => {
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
                  left: Math.max(0, Math.min(graphAreaWidth - 48, p.x - 22)),
                },
                p.idx === safeSelectedIdx && styles.xAxisTextActive,
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      position: 'relative',
      marginTop: 4,
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
      backgroundColor: colors.elevated,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tooltipWeight: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    tooltipDivider: {
      color: colors.muted,
      fontSize: 11,
    },
    tooltipReps: {
      color: colors.text,
      fontSize: 12.5,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    deltaBadge: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 6,
    },
    deltaBadgeNegative: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
    },
    deltaBadgeText: {
      color: colors.primaryText,
      fontSize: 10.5,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    deltaBadgeTextNegative: {
      color: colors.danger,
    },
    tooltipDate: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    mainBody: {
      flexDirection: 'row',
      width: '100%',
    },
    yAxis: {
      justifyContent: 'space-between',
      paddingVertical: 10,
      alignItems: 'flex-start',
    },
    yAxisText: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    plotArea: {
      position: 'relative',
      height: '100%',
    },
    avgTag: {
      position: 'absolute',
      right: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
      opacity: 0.9,
    },
    avgTagText: {
      color: colors.secondary,
      fontSize: 8.5,
      fontWeight: '800',
      letterSpacing: 0.3,
      fontVariant: ['tabular-nums'],
    },
    xAxis: {
      position: 'relative',
      height: 18,
      marginTop: 4,
    },
    xAxisText: {
      position: 'absolute',
      color: colors.muted,
      fontSize: 10,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    xAxisTextActive: {
      color: colors.text,
      fontWeight: '800',
    },
  });


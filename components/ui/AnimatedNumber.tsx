import React, { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  delay?: number;
  format?: (val: number) => string;
  style?: StyleProp<TextStyle>;
}

/**
 * Smooth ease-out-cubic count-up number for celebratory metrics (e.g. Workout Complete).
 * Honors OS Reduce Motion by rendering the final number immediately.
 */
export function AnimatedNumber({
  value,
  duration = 650,
  delay = 180,
  format,
  style,
}: AnimatedNumberProps) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reducedMotion || value <= 0) {
      setDisplay(value);
      return;
    }

    setDisplay(0);
    timeoutRef.current = setTimeout(() => {
      const startTime = Date.now();
      const step = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(1, elapsed / Math.max(1, duration));
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        const current = Math.round(value * eased);
        setDisplay(current);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          setDisplay(value);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, delay, reducedMotion]);

  return <Text style={style}>{format ? format(display) : String(display)}</Text>;
}

import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

/**
 * Standardized, defensive haptic feedback utilities across SPOT.
 * Uses expo-haptics with native Vibration fallback to guarantee crisp feedback across all devices.
 */

/**
 * Light impact for minor UI interactions (e.g., stepper +/- buttons).
 */
export async function hapticLight(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    try {
      Vibration.vibrate(25);
    } catch {}
  }
}

/**
 * Medium impact for structural actions (e.g., completing a set, moving items up/down).
 */
export async function hapticMedium(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    try {
      Vibration.vibrate(45);
    } catch {}
  }
}

/**
 * Success notification for major positive milestones (e.g., finalizing a workout, saving a program).
 */
export async function hapticSuccess(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    try {
      Vibration.vibrate([0, 50, 60, 50]);
    } catch {}
  }
}

/**
 * Selection feedback for tab changes or modal toggles.
 */
export async function hapticSelection(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.selectionAsync();
  } catch {
    try {
      Vibration.vibrate(15);
    } catch {}
  }
}

export const hapticImpact = hapticLight;


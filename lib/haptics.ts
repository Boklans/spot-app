import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Standardized, defensive haptic feedback utilities across SPOT.
 * Automatically no-ops on web and unsupported platforms to prevent runtime crashes.
 */

/**
 * Light impact for minor UI interactions (e.g., stepper +/- buttons).
 */
export async function hapticLight(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Fail silently on unsupported devices
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
    // Fail silently on unsupported devices
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
    // Fail silently on unsupported devices
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
    // Fail silently on unsupported devices
  }
}

export const hapticImpact = hapticLight;


import { Platform } from 'react-native';
import { useUserProfileStore } from '@/store/userProfileStore';

/**
 * High-performance, cross-platform audio chime player for SPOT rest timer.
 * Synthesizes a bright, triumphant 3-tone chime (C5 -> E5 -> G5) via Web Audio API on web.
 * On native mobile (Expo Go / iOS / Android), timer completion is paired with rich haptics (hapticSuccess)
 * without relying on legacy/removed native audio modules like expo-av.
 */

let webAudioCtx: any = null;

function getWebAudioContext() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!webAudioCtx) {
    webAudioCtx = new AudioCtx();
  }
  if (webAudioCtx.state === 'suspended') {
    webAudioCtx.resume().catch(() => undefined);
  }
  return webAudioCtx;
}

/**
 * Synthesizes a beautiful bell chime using oscillators (Web Audio API)
 */
function playWebChime() {
  try {
    const ctx = getWebAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.65);
    });
  } catch {
    // Fail silently
  }
}

export async function playRestCompleteSound(): Promise<void> {
  const soundEnabled = useUserProfileStore.getState().profile.soundEnabled ?? true;
  if (!soundEnabled) return;

  if (Platform.OS === 'web') {
    playWebChime();
    return;
  }

  // On native mobile platforms (Expo Go / iOS / Android),
  // timer completion is handled gracefully by hapticSuccess()
  // without importing ExponentAV native modules.
}

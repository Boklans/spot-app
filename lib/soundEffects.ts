import { Platform } from 'react-native';
import { useUserProfileStore } from '@/store/userProfileStore';

/**
 * Cross-platform audio chime player for SPOT rest timer.
 * - Web: Synthesizes a 3-tone bell chime (C5 -> E5 -> G5) via Web Audio API.
 * - iOS / Android: Plays assets/sounds/rest-complete.wav via expo-audio,
 *   configured with `interruptionMode: 'mixWithOthers'` so gym music (Spotify/Apple Music)
 *   is never paused or interrupted.
 */

let webAudioCtx: any = null;
let nativeAudioPlayer: any = null;
let nativeAudioConfigured = false;

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

async function playNativeChime() {
  try {
    const expoAudio = await import('expo-audio');
    if (!nativeAudioConfigured && typeof expoAudio.setAudioModeAsync === 'function') {
      await expoAudio
        .setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: 'mixWithOthers',
        })
        .catch(() => undefined);
      nativeAudioConfigured = true;
    }

    if (!nativeAudioPlayer && typeof expoAudio.createAudioPlayer === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const chimeAsset = require('@/assets/sounds/rest-complete.wav');
      nativeAudioPlayer = expoAudio.createAudioPlayer(chimeAsset);
    }

    if (nativeAudioPlayer) {
      if (typeof nativeAudioPlayer.seekTo === 'function') {
        await nativeAudioPlayer.seekTo(0).catch(() => undefined);
      }
      if (typeof nativeAudioPlayer.play === 'function') {
        nativeAudioPlayer.play();
      }
    }
  } catch {
    // Graceful fallback: haptics still fire even if native audio module isn't linked (e.g. older dev client)
  }
}

export async function playRestCompleteSound(): Promise<void> {
  const soundEnabled = useUserProfileStore.getState().profile.soundEnabled ?? true;
  if (!soundEnabled) return;

  if (Platform.OS === 'web') {
    playWebChime();
    return;
  }

  await playNativeChime();
}

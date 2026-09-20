import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { useUserProfileStore } from './userProfileStore';

export const BODY_WEIGHT_STORAGE_KEY = 'spot-body-weight-history';

export interface BodyWeightEntry {
  id: string;
  date: string; // ISO date string 'YYYY-MM-DD'
  timestamp: number;
  weightKg: number;
  note?: string;
}

export interface BodyWeightStats {
  currentWeight: number;
  startWeight: number;
  deltaWeight: number;
  deltaPercent: number;
  highestWeight: number;
  lowestWeight: number;
  entriesCount: number;
}

interface BodyWeightState {
  entries: BodyWeightEntry[];
  hydrated: boolean;
  loadHistory: () => Promise<BodyWeightEntry[]>;
  addEntry: (weightKg: number, dateStr?: string, note?: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getStats: (days?: number) => BodyWeightStats;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const useBodyWeightStore = create<BodyWeightState>((set, get) => ({
  entries: [],
  hydrated: false,

  loadHistory: async () => {
    try {
      const raw = await AsyncStorage.getItem(BODY_WEIGHT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BodyWeightEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sorted = parsed.sort((a, b) => a.timestamp - b.timestamp);
          set({ entries: sorted, hydrated: true });
          return sorted;
        }
      }
    } catch {
      // Fall through to seed
    }

    // Seed initial history if empty based on current profile weight
    const currentProfileWeight = useUserProfileStore.getState().profile.weightKg || 78;
    const now = new Date();
    const seeded: BodyWeightEntry[] = [];

    // Create 4 realistic weekly data points leading up to today
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      // Subtle realistic variation
      const variation = i === 0 ? 0 : (i === 1 ? -0.3 : (i === 2 ? 0.4 : 0.8));
      const w = Math.round((currentProfileWeight + variation) * 10) / 10;
      seeded.push({
        id: `seed-${d.getTime()}`,
        date: formatDate(d),
        timestamp: d.getTime(),
        weightKg: w,
        note: i === 0 ? 'Current baseline' : undefined,
      });
    }

    set({ entries: seeded, hydrated: true });
    try {
      await AsyncStorage.setItem(BODY_WEIGHT_STORAGE_KEY, JSON.stringify(seeded));
    } catch {
      // Continue
    }

    return seeded;
  },

  addEntry: async (weightKg: number, dateStr?: string, note?: string) => {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const dateFormatted = formatDate(targetDate);
    const timestamp = targetDate.getTime();
    const cleanWeight = Math.round(weightKg * 10) / 10;

    const current = get().entries;
    // Check if an entry already exists for this date - if so, update it
    const existingIndex = current.findIndex((e) => e.date === dateFormatted);
    let updated: BodyWeightEntry[];

    if (existingIndex >= 0) {
      updated = current.map((e, idx) =>
        idx === existingIndex
          ? { ...e, weightKg: cleanWeight, timestamp, note: note ?? e.note }
          : e
      );
    } else {
      const newEntry: BodyWeightEntry = {
        id: `bw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: dateFormatted,
        timestamp,
        weightKg: cleanWeight,
        note,
      };
      updated = [...current, newEntry].sort((a, b) => a.timestamp - b.timestamp);
    }

    set({ entries: updated });

    try {
      await AsyncStorage.setItem(BODY_WEIGHT_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Continue
    }

    // Always update userProfileStore with the latest weight
    const latest = updated[updated.length - 1];
    if (latest) {
      await useUserProfileStore.getState().updateProfile({ weightKg: latest.weightKg });
    }
  },

  deleteEntry: async (id: string) => {
    const current = get().entries;
    const filtered = current.filter((e) => e.id !== id);
    set({ entries: filtered });

    try {
      await AsyncStorage.setItem(BODY_WEIGHT_STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // Continue
    }

    // Update profile with new latest if entries remain
    if (filtered.length > 0) {
      const latest = filtered[filtered.length - 1];
      await useUserProfileStore.getState().updateProfile({ weightKg: latest.weightKg });
    }
  },

  getStats: (days = 30): BodyWeightStats => {
    const entries = get().entries;
    if (entries.length === 0) {
      const fallback = useUserProfileStore.getState().profile.weightKg || 78;
      return {
        currentWeight: fallback,
        startWeight: fallback,
        deltaWeight: 0,
        deltaPercent: 0,
        highestWeight: fallback,
        lowestWeight: fallback,
        entriesCount: 0,
      };
    }

    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const filtered = entries.filter((e) => e.timestamp >= cutoff);
    const targetSet = filtered.length > 0 ? filtered : entries;

    const currentWeight = targetSet[targetSet.length - 1].weightKg;
    const startWeight = targetSet[0].weightKg;
    const deltaWeight = Math.round((currentWeight - startWeight) * 10) / 10;
    const deltaPercent =
      startWeight > 0 ? Math.round((deltaWeight / startWeight) * 1000) / 10 : 0;

    const weights = targetSet.map((e) => e.weightKg);
    const highestWeight = Math.max(...weights);
    const lowestWeight = Math.min(...weights);

    return {
      currentWeight,
      startWeight,
      deltaWeight,
      deltaPercent,
      highestWeight,
      lowestWeight,
      entriesCount: targetSet.length,
    };
  },
}));


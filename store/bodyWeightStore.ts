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
  clearHistory: () => Promise<void>;
  syncBaselineWeight: (weightKg: number) => Promise<void>;
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
    const profileWeight = useUserProfileStore.getState().profile.weightKg || 78;
    try {
      const raw = await AsyncStorage.getItem(BODY_WEIGHT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BodyWeightEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Purge any legacy mock seed entries
          const nonSeed = parsed.filter((e) => !e.id.startsWith('seed-'));
          if (nonSeed.length > 0) {
            // If the entries only consist of baseline logs, ensure the weight reflects the profile weight
            const hasOnlyBaselines = nonSeed.every((e) => e.note === 'Baseline' || e.id.startsWith('baseline-'));
            const cleaned = hasOnlyBaselines
              ? nonSeed.map((e) => ({ ...e, weightKg: profileWeight }))
              : nonSeed;
            const sorted = cleaned.sort((a, b) => a.timestamp - b.timestamp);
            set({ entries: sorted, hydrated: true });
            return sorted;
          }
        }
      }
    } catch {
      // Fall through to initial baseline
    }

    // Initialize with the user's actual profile weight without mock variations
    const now = new Date();
    const initialEntry: BodyWeightEntry = {
      id: `baseline-${now.getTime()}`,
      date: formatDate(now),
      timestamp: now.getTime(),
      weightKg: Math.round(profileWeight * 10) / 10,
      note: 'Baseline',
    };
    const initial = [initialEntry];

    set({ entries: initial, hydrated: true });
    try {
      await AsyncStorage.setItem(BODY_WEIGHT_STORAGE_KEY, JSON.stringify(initial));
    } catch {
      // Continue
    }

    return initial;
  },

  syncBaselineWeight: async (weightKg: number) => {
    const cleanWeight = Math.round(weightKg * 10) / 10;
    const now = new Date();
    const todayStr = formatDate(now);
    const current = get().entries;

    // Purge fake mock seed entries
    const nonSeed = current.filter((e) => !e.id.startsWith('seed-'));

    let updated: BodyWeightEntry[];
    const hasOnlyBaselines = nonSeed.length <= 1 || nonSeed.every((e) => e.note === 'Baseline' || e.id.startsWith('baseline-'));
    if (hasOnlyBaselines) {
      // Single baseline or clean start -> set strictly to user's input
      updated = [
        {
          id: `baseline-${now.getTime()}`,
          date: todayStr,
          timestamp: now.getTime(),
          weightKg: cleanWeight,
          note: 'Baseline',
        },
      ];
    } else {
      // Update today's entry or append
      const existingToday = nonSeed.findIndex((e) => e.date === todayStr);
      if (existingToday >= 0) {
        updated = nonSeed.map((e, idx) =>
          idx === existingToday ? { ...e, weightKg: cleanWeight } : e
        );
      } else {
        updated = [
          ...nonSeed,
          {
            id: `bw-${Date.now()}`,
            date: todayStr,
            timestamp: now.getTime(),
            weightKg: cleanWeight,
          },
        ].sort((a, b) => a.timestamp - b.timestamp);
      }
    }

    set({ entries: updated, hydrated: true });
    try {
      await AsyncStorage.setItem(BODY_WEIGHT_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Continue
    }
  },

  clearHistory: async () => {
    try {
      await AsyncStorage.removeItem(BODY_WEIGHT_STORAGE_KEY);
    } catch {
      // Ignore
    }
    set({ entries: [], hydrated: false });
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
    const entries = get().entries.filter((e) => !e.id.startsWith('seed-'));
    const profileWeight = useUserProfileStore.getState().profile.weightKg || 78;

    if (entries.length === 0) {
      return {
        currentWeight: profileWeight,
        startWeight: profileWeight,
        deltaWeight: 0,
        deltaPercent: 0,
        highestWeight: profileWeight,
        lowestWeight: profileWeight,
        entriesCount: 0,
      };
    }

    if (entries.length === 1) {
      const w = profileWeight || entries[0].weightKg;
      return {
        currentWeight: w,
        startWeight: w,
        deltaWeight: 0,
        deltaPercent: 0,
        highestWeight: w,
        lowestWeight: w,
        entriesCount: 1,
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


import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const USER_PROFILE_STORAGE_KEY = 'spot-user-profile';

export type UserGoal = 'Build Muscle' | 'Lose Fat' | 'Get Stronger' | 'Recomposition';
export type UserExperience = 'Beginner' | 'Intermediate' | 'Advanced';

export type UserProfile = {
  goal: UserGoal;
  experience: UserExperience;
  workoutsPerWeek: number;
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  goal: 'Build Muscle',
  experience: 'Intermediate',
  workoutsPerWeek: 4,
};

type UserProfileState = {
  profile: UserProfile;
  hydrated: boolean;
  loadProfile: () => Promise<UserProfile>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  resetProfile: () => Promise<void>;
};

function isValidProfile(parsed: unknown): parsed is UserProfile {
  if (!parsed || typeof parsed !== 'object') return false;
  const p = parsed as Partial<UserProfile>;
  const validGoals: UserGoal[] = ['Build Muscle', 'Lose Fat', 'Get Stronger', 'Recomposition'];
  const validExp: UserExperience[] = ['Beginner', 'Intermediate', 'Advanced'];

  return (
    typeof p.goal === 'string' &&
    validGoals.includes(p.goal as UserGoal) &&
    typeof p.experience === 'string' &&
    validExp.includes(p.experience as UserExperience) &&
    typeof p.workoutsPerWeek === 'number' &&
    p.workoutsPerWeek >= 2 &&
    p.workoutsPerWeek <= 6
  );
}

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  profile: DEFAULT_USER_PROFILE,
  hydrated: false,

  loadProfile: async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isValidProfile(parsed)) {
          set({ profile: parsed, hydrated: true });
          return parsed;
        }
      }
    } catch {
      // Fall through to default on parse/load error
    }

    set({ profile: DEFAULT_USER_PROFILE, hydrated: true });
    return DEFAULT_USER_PROFILE;
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    const current = get().profile;
    const updated: UserProfile = {
      ...current,
      ...updates,
    };

    set({ profile: updated });

    try {
      await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Continue even if local storage failed
    }
  },

  resetProfile: async () => {
    set({ profile: DEFAULT_USER_PROFILE });
    try {
      await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(DEFAULT_USER_PROFILE));
    } catch {
      // Continue
    }
  },
}));


import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const USER_PROFILE_STORAGE_KEY = 'spot-user-profile';
const ONBOARDING_STORAGE_KEY = 'spot-onboarding';

export type BeastAvatarId =
  | 'gorilla'
  | 'lion'
  | 'wolf'
  | 'eagle'
  | 'cheetah'
  | 'bear'
  | 'rhino'
  | 'shark'
  | 'bull'
  | 'dragon';

export const BEAST_AVATARS: Record<
  BeastAvatarId,
  { emoji: string; label: string; tag: string; color: string }
> = {
  gorilla: { emoji: '🦍', label: 'Gorilla', tag: 'Pure Power', color: '#C8FF3D' },
  lion: { emoji: '🦁', label: 'Lion', tag: 'King of Gym', color: '#FFB800' },
  wolf: { emoji: '🐺', label: 'Wolf', tag: 'Lone Hunter', color: '#60A5FA' },
  eagle: { emoji: '🦅', label: 'Eagle', tag: 'Hyper Focus', color: '#38BDF8' },
  cheetah: { emoji: '🐆', label: 'Cheetah', tag: 'Speed & Agility', color: '#F59E0B' },
  bear: { emoji: '🐻', label: 'Bear', tag: 'Massive Force', color: '#A78BFA' },
  rhino: { emoji: '🦏', label: 'Rhino', tag: 'Unstoppable', color: '#94A3B8' },
  shark: { emoji: '🦈', label: 'Shark', tag: 'Apex Predator', color: '#2DD4BF' },
  bull: { emoji: '🐂', label: 'Bull', tag: 'Relentless Drive', color: '#F43F5E' },
  dragon: { emoji: '🐉', label: 'Dragon', tag: 'Legendary Will', color: '#EC4899' },
};

export type UserGoal = 'Build Muscle' | 'Lose Fat' | 'Get Stronger' | 'Recomposition';
export type UserExperience = 'Beginner' | 'Intermediate' | 'Advanced';
export type WeightUnit = 'kg' | 'lbs';
export type HeightUnit = 'cm' | 'ft';
export type AppLanguage = 'en' | 'uk';

export type UserProfile = {
  name: string;
  avatar: BeastAvatarId;
  weightKg: number;
  heightCm: number;
  goal: UserGoal;
  experience: UserExperience;
  workoutsPerWeek: number;
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  defaultRestSeconds: number;
  language: AppLanguage;
  notifications: boolean;
  soundEnabled: boolean;
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'IHOR',
  avatar: 'gorilla',
  weightKg: 78,
  heightCm: 180,
  goal: 'Build Muscle',
  experience: 'Intermediate',
  workoutsPerWeek: 3,
  weightUnit: 'kg',
  heightUnit: 'cm',
  defaultRestSeconds: 150,
  language: 'en',
  notifications: true,
  soundEnabled: true,
};

type UserProfileState = {
  profile: UserProfile;
  hydrated: boolean;
  loadProfile: () => Promise<UserProfile>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  resetProfile: () => Promise<void>;
};

function normalizeLoadedProfile(parsed: unknown): UserProfile {
  if (!parsed || typeof parsed !== 'object') return DEFAULT_USER_PROFILE;
  const p = parsed as Partial<UserProfile>;
  const validGoals: UserGoal[] = ['Build Muscle', 'Lose Fat', 'Get Stronger', 'Recomposition'];
  const validExp: UserExperience[] = ['Beginner', 'Intermediate', 'Advanced'];
  const validAvatars = Object.keys(BEAST_AVATARS) as BeastAvatarId[];

  return {
    name: typeof p.name === 'string' && p.name.trim().length > 0 ? p.name.trim() : DEFAULT_USER_PROFILE.name,
    avatar: validAvatars.includes(p.avatar as BeastAvatarId) ? (p.avatar as BeastAvatarId) : DEFAULT_USER_PROFILE.avatar,
    weightKg: typeof p.weightKg === 'number' && p.weightKg >= 30 && p.weightKg <= 250 ? Math.round(p.weightKg * 10) / 10 : DEFAULT_USER_PROFILE.weightKg,
    heightCm: typeof p.heightCm === 'number' && p.heightCm >= 100 && p.heightCm <= 240 ? Math.round(p.heightCm) : DEFAULT_USER_PROFILE.heightCm,
    goal: validGoals.includes(p.goal as UserGoal) ? (p.goal as UserGoal) : DEFAULT_USER_PROFILE.goal,
    experience: validExp.includes(p.experience as UserExperience) ? (p.experience as UserExperience) : DEFAULT_USER_PROFILE.experience,
    workoutsPerWeek:
      typeof p.workoutsPerWeek === 'number' && p.workoutsPerWeek >= 2 && p.workoutsPerWeek <= 6
        ? p.workoutsPerWeek
        : DEFAULT_USER_PROFILE.workoutsPerWeek,
    weightUnit: p.weightUnit === 'lbs' ? 'lbs' : 'kg',
    heightUnit: p.heightUnit === 'ft' ? 'ft' : 'cm',
    defaultRestSeconds: typeof p.defaultRestSeconds === 'number' ? p.defaultRestSeconds : 150,
    language: p.language === 'uk' ? 'uk' : 'en',
    notifications: typeof p.notifications === 'boolean' ? p.notifications : true,
    soundEnabled: typeof p.soundEnabled === 'boolean' ? p.soundEnabled : true,
  };
}

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  profile: DEFAULT_USER_PROFILE,
  hydrated: false,

  loadProfile: async () => {
    let normalized = DEFAULT_USER_PROFILE;

    try {
      const stored = await AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY);
      if (stored) {
        normalized = normalizeLoadedProfile(JSON.parse(stored));
      }
    } catch {
      // Fall through
    }

    // Sync with onboarding data if present to ensure 100% harmony
    try {
      const onboardingRaw = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (onboardingRaw) {
        const ob = JSON.parse(onboardingRaw) as Record<string, unknown>;
        const obFreq = typeof ob.trainingFrequency === 'number' ? ob.trainingFrequency : undefined;
        if (obFreq && obFreq >= 2 && obFreq <= 6) {
          normalized.workoutsPerWeek = obFreq;
        }
        if (typeof ob.name === 'string' && ob.name.trim().length > 0 && normalized.name === DEFAULT_USER_PROFILE.name) {
          normalized.name = ob.name.trim();
        }
        if (typeof ob.weightKg === 'number' && ob.weightKg > 30) {
          normalized.weightKg = ob.weightKg;
        }
        if (typeof ob.heightCm === 'number' && ob.heightCm > 100) {
          normalized.heightCm = ob.heightCm;
        }
        if (typeof ob.avatar === 'string' && ob.avatar in BEAST_AVATARS) {
          normalized.avatar = ob.avatar as BeastAvatarId;
        }
        const goalMap: Record<string, UserGoal> = {
          build_muscle: 'Build Muscle',
          'Build Muscle': 'Build Muscle',
          get_stronger: 'Get Stronger',
          'Get Stronger': 'Get Stronger',
          lose_fat: 'Lose Fat',
          'Lose Fat': 'Lose Fat',
          recomposition: 'Recomposition',
          Recomposition: 'Recomposition',
        };
        if (typeof ob.goal === 'string' && goalMap[ob.goal]) {
          normalized.goal = goalMap[ob.goal];
        }
        const expMap: Record<string, UserExperience> = {
          beginner: 'Beginner',
          Beginner: 'Beginner',
          intermediate: 'Intermediate',
          Intermediate: 'Intermediate',
          advanced: 'Advanced',
          Advanced: 'Advanced',
        };
        if (typeof ob.experience === 'string' && expMap[ob.experience]) {
          normalized.experience = expMap[ob.experience];
        }
      }
    } catch {
      // Continue
    }

    set({ profile: normalized, hydrated: true });
    return normalized;
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
      // Continue
    }

    // Synchronize updates back to onboarding storage as well
    try {
      const onboardingRaw = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
      const existing = onboardingRaw ? (JSON.parse(onboardingRaw) as Record<string, unknown>) : {};
      const nextOnboarding = {
        ...existing,
        name: updated.name,
        trainingFrequency: updated.workoutsPerWeek,
        weightKg: updated.weightKg,
        heightCm: updated.heightCm,
        avatar: updated.avatar,
      };
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(nextOnboarding));
    } catch {
      // Continue
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

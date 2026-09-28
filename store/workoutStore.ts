import AsyncStorage from '@react-native-async-storage/async-storage';

export type OnboardingGoal = 'build_muscle' | 'get_stronger' | 'lose_fat' | 'recomposition';
export type OnboardingExperience = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutSplitPreference = 'full_body' | 'upper_lower' | 'push_pull_legs' | 'custom' | 'blank';

export type BaselineLifts = {
  benchPressKg?: number;
  squatKg?: number;
  deadliftKg?: number;
  overheadPressKg?: number;
};

export type OnboardingData = {
  name: string;
  avatar?: string;
  weightKg?: number;
  heightCm?: number;
  goal: OnboardingGoal;
  experience: OnboardingExperience;
  trainingFrequency: number;
  trainingDays?: string[];
  equipment: string[];
  splitPreference?: WorkoutSplitPreference;
  baselineLifts?: BaselineLifts;
  sessionDurationMinutes?: number;
  completed: boolean;
};

export type OnboardingPatch = Partial<OnboardingData>;

const KEY = 'spot-onboarding';

export const defaultOnboarding: OnboardingData = {
  name: 'Ihor',
  avatar: 'gorilla',
  weightKg: 78,
  heightCm: 180,
  goal: 'build_muscle',
  experience: 'intermediate',
  trainingFrequency: 3,
  trainingDays: ['MON', 'WED', 'FRI'],
  equipment: ['full_gym'],
  splitPreference: 'upper_lower',
  sessionDurationMinutes: 45,
  completed: false,
};

function normalizeGoal(value: unknown): OnboardingGoal {
  const goals: Record<string, OnboardingGoal> = { build_muscle: 'build_muscle', 'Build Muscle': 'build_muscle', get_stronger: 'get_stronger', 'Get Stronger': 'get_stronger', lose_fat: 'lose_fat', 'Lose Fat': 'lose_fat', recomposition: 'recomposition', Recomposition: 'recomposition' };
  return typeof value === 'string' && goals[value] ? goals[value] : defaultOnboarding.goal;
}

function normalizeExperience(value: unknown): OnboardingExperience {
  const experiences: Record<string, OnboardingExperience> = { beginner: 'beginner', Beginner: 'beginner', intermediate: 'intermediate', Intermediate: 'intermediate', advanced: 'advanced', Advanced: 'advanced' };
  return typeof value === 'string' && experiences[value] ? experiences[value] : defaultOnboarding.experience;
}

function normalizeEquipment(value: unknown): string[] {
  if (!Array.isArray(value)) return defaultOnboarding.equipment;
  const equipment = value.map((item) => typeof item === 'string' ? item.toLowerCase().replaceAll(' ', '_') : '').filter(Boolean);
  return equipment.length > 0 ? equipment : defaultOnboarding.equipment;
}

function normalizeSplitPreference(value: unknown): WorkoutSplitPreference | undefined {
  if (value === 'full_body' || value === 'upper_lower' || value === 'push_pull_legs' || value === 'custom' || value === 'blank') {
    return value;
  }
  return undefined;
}

function normalizeTrainingDays(value: unknown): string[] | undefined {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }
  return undefined;
}

function normalizeOnboarding(value: Record<string, unknown>): OnboardingData {
  const legacyFrequency = typeof value.frequency === 'number' ? value.frequency : undefined;
  const storedFrequency = typeof value.trainingFrequency === 'number' ? value.trainingFrequency : legacyFrequency;
  return {
    name: typeof value.name === 'string' && value.name.length > 0 ? value.name : defaultOnboarding.name,
    avatar: typeof value.avatar === 'string' ? value.avatar : defaultOnboarding.avatar,
    weightKg: typeof value.weightKg === 'number' && value.weightKg >= 20 ? value.weightKg : defaultOnboarding.weightKg,
    heightCm: typeof value.heightCm === 'number' && value.heightCm > 50 ? value.heightCm : defaultOnboarding.heightCm,
    goal: normalizeGoal(value.goal),
    experience: normalizeExperience(value.experience),
    trainingFrequency: storedFrequency ? Math.min(7, Math.max(1, storedFrequency)) : defaultOnboarding.trainingFrequency,
    trainingDays: normalizeTrainingDays(value.trainingDays),
    equipment: normalizeEquipment(value.equipment),
    splitPreference: normalizeSplitPreference(value.splitPreference),
    baselineLifts: typeof value.baselineLifts === 'object' && value.baselineLifts !== null ? (value.baselineLifts as BaselineLifts) : undefined,
    sessionDurationMinutes: typeof value.sessionDurationMinutes === 'number' ? value.sessionDurationMinutes : defaultOnboarding.sessionDurationMinutes,
    completed: value.completed === true,
  };
}

export async function saveOnboarding(data: OnboardingPatch) {
  const existing = await loadOnboarding();
  const next: OnboardingData = { ...defaultOnboarding, ...existing, ...data };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));

  try {
    const { useUserProfileStore } = await import('./userProfileStore');
    const profileUpdates: Record<string, unknown> = {};
    if (data.name) profileUpdates.name = data.name;
    if (typeof data.weightKg === 'number' && data.weightKg >= 20) profileUpdates.weightKg = data.weightKg;
    if (typeof data.heightCm === 'number' && data.heightCm > 50) profileUpdates.heightCm = data.heightCm;
    if (data.experience) {
      profileUpdates.experience =
        data.experience === 'beginner' ? 'Beginner' : data.experience === 'advanced' ? 'Advanced' : 'Intermediate';
    }
    if (data.baselineLifts !== undefined) {
      profileUpdates.baselineLifts = data.baselineLifts;
    }
    if (typeof data.trainingFrequency === 'number') {
      profileUpdates.workoutsPerWeek = data.trainingFrequency;
    }
    if (data.avatar) {
      profileUpdates.avatar = data.avatar;
    }
    if (Object.keys(profileUpdates).length > 0) {
      await useUserProfileStore.getState().updateProfile(profileUpdates);
    }
  } catch {
    // Continue
  }
}

export async function loadOnboarding(): Promise<OnboardingData | null> {
  const value = await AsyncStorage.getItem(KEY);
  if (!value) return null;

  try {
    return normalizeOnboarding(JSON.parse(value) as Record<string, unknown>);
  } catch {
    return null;
  }
}

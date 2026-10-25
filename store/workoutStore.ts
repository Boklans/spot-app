import AsyncStorage from '@react-native-async-storage/async-storage';

export type OnboardingGoal = 'build_muscle' | 'get_stronger' | 'lose_fat' | 'recomposition';
export type OnboardingExperience = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutSplitPreference = 'full_body' | 'upper_lower' | 'push_pull_legs' | 'custom' | 'blank';
export type OnboardingSex = 'male' | 'female' | 'unspecified';
export type PriorityMuscleFocus = 'balanced' | 'lower_glutes' | 'upper_push' | 'back_core';
export type TrainingLimitation = 'knees' | 'lower_back' | 'shoulders';

export type BaselineLifts = {
  benchPressKg?: number;
  squatKg?: number;
  deadliftKg?: number;
  overheadPressKg?: number;
};

export type OnboardingData = {
  name: string;
  avatar?: string;
  age?: number;
  sex?: OnboardingSex;
  weightKg?: number;
  heightCm?: number;
  goal: OnboardingGoal;
  experience: OnboardingExperience;
  trainingFrequency: number;
  trainingDays?: string[];
  equipment: string[];
  priorityMuscles?: PriorityMuscleFocus[];
  limitations?: TrainingLimitation[];
  splitPreference?: WorkoutSplitPreference;
  baselineLifts?: BaselineLifts;
  sessionDurationMinutes?: number;
  completed: boolean;
};

export type OnboardingPatch = Partial<OnboardingData>;

const KEY = 'spot-onboarding';

export const defaultOnboarding: OnboardingData = {
  name: '',
  avatar: 'gorilla',
  age: 28,
  sex: 'unspecified',
  weightKg: 70,
  heightCm: 172,
  goal: 'build_muscle',
  experience: 'beginner',
  trainingFrequency: 3,
  trainingDays: ['MON', 'WED', 'FRI'],
  equipment: ['full_gym'],
  priorityMuscles: ['balanced'],
  limitations: [],
  splitPreference: undefined,
  sessionDurationMinutes: 45,
  completed: false,
};

function normalizeGoal(value: unknown): OnboardingGoal {
  const goals: Record<string, OnboardingGoal> = {
    build_muscle: 'build_muscle',
    'Build Muscle': 'build_muscle',
    get_stronger: 'get_stronger',
    'Get Stronger': 'get_stronger',
    lose_fat: 'lose_fat',
    'Lose Fat': 'lose_fat',
    recomposition: 'recomposition',
    Recomposition: 'recomposition',
  };
  return typeof value === 'string' && goals[value] ? goals[value] : defaultOnboarding.goal;
}

function normalizeExperience(value: unknown): OnboardingExperience {
  const experiences: Record<string, OnboardingExperience> = {
    beginner: 'beginner',
    Beginner: 'beginner',
    intermediate: 'intermediate',
    Intermediate: 'intermediate',
    advanced: 'advanced',
    Advanced: 'advanced',
  };
  return typeof value === 'string' && experiences[value] ? experiences[value] : defaultOnboarding.experience;
}

function normalizeEquipment(value: unknown): string[] {
  if (!Array.isArray(value)) return defaultOnboarding.equipment;
  const equipment = value
    .map((item) => {
      if (typeof item !== 'string') return '';
      const cleaned = item.toLowerCase().replaceAll(' ', '_');
      if (cleaned === 'cables_machines' || cleaned === 'cables_&_machines') return 'machines';
      return cleaned;
    })
    .filter(Boolean);
  return equipment.length > 0 ? Array.from(new Set(equipment)) : defaultOnboarding.equipment;
}

function normalizeSplitPreference(value: unknown): WorkoutSplitPreference | undefined {
  if (
    value === 'full_body' ||
    value === 'upper_lower' ||
    value === 'push_pull_legs' ||
    value === 'custom' ||
    value === 'blank'
  ) {
    return value;
  }
  return undefined;
}

function normalizeSex(value: unknown): OnboardingSex {
  if (value === 'male' || value === 'female' || value === 'unspecified') {
    return value;
  }
  return 'unspecified';
}

function normalizePriorityMuscles(value: unknown): PriorityMuscleFocus[] {
  if (!Array.isArray(value)) return ['balanced'];
  const valid: PriorityMuscleFocus[] = ['balanced', 'lower_glutes', 'upper_push', 'back_core'];
  const filtered = value.filter((item): item is PriorityMuscleFocus => valid.includes(item as PriorityMuscleFocus));
  return filtered.length > 0 ? filtered : ['balanced'];
}

function normalizeLimitations(value: unknown): TrainingLimitation[] {
  if (!Array.isArray(value)) return [];
  const valid: TrainingLimitation[] = ['knees', 'lower_back', 'shoulders'];
  return value.filter((item): item is TrainingLimitation => valid.includes(item as TrainingLimitation));
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
    age: typeof value.age === 'number' && value.age >= 12 && value.age <= 100 ? Math.round(value.age) : defaultOnboarding.age,
    sex: normalizeSex(value.sex),
    weightKg: typeof value.weightKg === 'number' && value.weightKg >= 20 ? value.weightKg : defaultOnboarding.weightKg,
    heightCm: typeof value.heightCm === 'number' && value.heightCm > 50 ? value.heightCm : defaultOnboarding.heightCm,
    goal: normalizeGoal(value.goal),
    experience: normalizeExperience(value.experience),
    trainingFrequency: storedFrequency ? Math.min(7, Math.max(1, storedFrequency)) : defaultOnboarding.trainingFrequency,
    trainingDays: normalizeTrainingDays(value.trainingDays),
    equipment: normalizeEquipment(value.equipment),
    priorityMuscles: normalizePriorityMuscles(value.priorityMuscles),
    limitations: normalizeLimitations(value.limitations),
    splitPreference: normalizeSplitPreference(value.splitPreference),
    baselineLifts:
      typeof value.baselineLifts === 'object' && value.baselineLifts !== null
        ? (value.baselineLifts as BaselineLifts)
        : undefined,
    sessionDurationMinutes:
      typeof value.sessionDurationMinutes === 'number'
        ? value.sessionDurationMinutes
        : defaultOnboarding.sessionDurationMinutes,
    completed: value.completed === true,
  };
}

export async function saveOnboarding(data: OnboardingPatch) {
  const existing = await loadOnboarding();
  const next: OnboardingData = { ...defaultOnboarding, ...existing, ...data };
  next.equipment = normalizeEquipment(next.equipment);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));

  try {
    const { useUserProfileStore } = await import('./userProfileStore');
    const profileUpdates: Record<string, unknown> = {};
    if (data.name) profileUpdates.name = data.name;
    if (typeof data.age === 'number' && data.age >= 12) profileUpdates.age = data.age;
    if (data.sex) profileUpdates.sex = data.sex;
    if (typeof data.weightKg === 'number' && data.weightKg >= 20) profileUpdates.weightKg = data.weightKg;
    if (typeof data.heightCm === 'number' && data.heightCm > 50) profileUpdates.heightCm = data.heightCm;
    if (data.goal) {
      profileUpdates.goal =
        data.goal === 'lose_fat'
          ? 'Lose Fat'
          : data.goal === 'get_stronger'
          ? 'Get Stronger'
          : data.goal === 'recomposition'
          ? 'Recomposition'
          : 'Build Muscle';
    }
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

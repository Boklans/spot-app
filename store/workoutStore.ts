import AsyncStorage from '@react-native-async-storage/async-storage';

export type OnboardingGoal = 'build_muscle' | 'get_stronger' | 'lose_fat' | 'recomposition';
export type OnboardingExperience = 'beginner' | 'intermediate' | 'advanced';

export type OnboardingData = {
  name: string;
  goal: OnboardingGoal;
  experience: OnboardingExperience;
  trainingFrequency: number;
  equipment: string[];
  completed: boolean;
};

export type OnboardingPatch = Partial<OnboardingData>;

const KEY = 'spot-onboarding';

export const defaultOnboarding: OnboardingData = {
  name: 'Ihor',
  goal: 'build_muscle',
  experience: 'intermediate',
  trainingFrequency: 3,
  equipment: ['full_gym'],
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

function normalizeOnboarding(value: Record<string, unknown>): OnboardingData {
  const legacyFrequency = typeof value.frequency === 'number' ? value.frequency : undefined;
  const storedFrequency = typeof value.trainingFrequency === 'number' ? value.trainingFrequency : legacyFrequency;
  return {
    name: typeof value.name === 'string' && value.name.length > 0 ? value.name : defaultOnboarding.name,
    goal: normalizeGoal(value.goal),
    experience: normalizeExperience(value.experience),
    trainingFrequency: storedFrequency ? Math.min(6, Math.max(2, storedFrequency)) : defaultOnboarding.trainingFrequency,
    equipment: normalizeEquipment(value.equipment),
    completed: value.completed === true,
  };
}

export async function saveOnboarding(data: OnboardingPatch) {
  const existing = await loadOnboarding();
  const next: OnboardingData = { ...defaultOnboarding, ...existing, ...data };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
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

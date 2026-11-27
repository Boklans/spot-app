import { isAssistedExercise } from '@/lib/adaptiveProgression';
import { resolveCanonicalExerciseId } from '@/lib/exercises';
import { calculateMuscleRecoveryStats } from '@/lib/progressCalculator';
import type { CompletedWorkout } from '@/types/workout';
import type { AppLanguage } from '@/store/userProfileStore';

export type CoachInsightType = 'deload_active' | 'deload_recommended' | 'strength_win' | 'lagging_muscle' | 'onboarding_momentum';

export interface CoachInsight {
  id: string;
  type: CoachInsightType;
  badge: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionType?: 'apply_deload' | 'restore_deload' | 'open_muscles';
  accent: 'lime' | 'amber' | 'emerald' | 'purple';
}

function estimateTopE1RM(
  sets: Array<{ weight: number; reps: number; setType?: string }>,
  assisted = false,
  referenceBodyweightKg = 80
): number {
  let best = 0;
  for (const s of sets) {
    if (s.setType === 'warmup') continue;
    if (s.weight > 0 && s.reps > 0) {
      const effectiveLoad = assisted
        ? Math.max(5, referenceBodyweightKg - s.weight)
        : s.weight;
      const e1rm = effectiveLoad * (1 + s.reps / 30);
      if (e1rm > best) best = e1rm;
    }
  }
  return best;
}

/**
 * Generates one crisp, data-driven SPOT Coach insight from the athlete's real workout history.
 */
export function generateCoachInsight(params: {
  history: CompletedWorkout[];
  deloadActive: boolean;
  language: AppLanguage;
  translateExercise: (name: string) => string;
  translateMuscle: (muscle: string) => string;
  formatWeightDiff: (kgDiff: number) => string;
}): CoachInsight | null {
  const { history, deloadActive, language, translateExercise, translateMuscle, formatWeightDiff } = params;
  const isUk = language === 'uk';

  // 1. Deload currently active — always show clear restore banner
  if (deloadActive) {
    return {
      id: 'deload-active',
      type: 'deload_active',
      badge: isUk ? 'DELOAD АКТИВНИЙ' : 'DELOAD WEEK ACTIVE',
      title: isUk ? 'Робочі ваги знижено на 15%' : 'Working weights reduced by 15%',
      body: isUk
        ? 'Цей тиждень працює на відновлення ЦНС і суглобів. Коли будете готові — поверніть звичайні ваги в 1 клік.'
        : 'This week prioritizes CNS and joint recovery. Restore your full working weights in 1 tap whenever ready.',
      actionLabel: isUk ? 'Повернути робочі ваги' : 'Restore Working Weights',
      actionType: 'restore_deload',
      accent: 'amber',
    };
  }

  const fullWorkouts = (history || [])
    .filter((w) => !w.isPartial && w.totalSets > 0)
    .sort(
      (a, b) =>
        new Date(b.completedAt || b.startedAt).getTime() -
        new Date(a.completedAt || a.startedAt).getTime()
    );

  // Need at least 1 workout to start giving personalized insights
  if (fullWorkouts.length === 0) {
    return {
      id: 'coach-start',
      type: 'onboarding_momentum',
      badge: 'SPOT COACH',
      title: isUk ? 'Калібрування подвійної прогресії' : 'Calibrating Double Progression',
      body: isUk
        ? 'Завершіть перше тренування — і SPOT автоматично розрахує цільові повторення та вагу для наступного прогресу.'
        : 'Complete your first session and SPOT will automatically calibrate your next target reps and weights.',
      accent: 'lime',
    };
  }

  // 2. Check for Plateau / Regression (2 consecutive declines or 3 stalled sessions on a key lift) OR 12+ workouts in 28d
  const now = Date.now();
  const last28d = fullWorkouts.filter(
    (w) => now - new Date(w.completedAt || w.startedAt).getTime() <= 28 * 24 * 60 * 60 * 1000
  );

  // Group exercise e1RM history chronologically (newest first)
  const liftHistory = new Map<
    string,
    { name: string; assisted: boolean; e1rms: number[]; topWeights: number[] }
  >();
  for (const w of fullWorkouts.slice(0, 24)) {
    for (const ex of w.exercises || []) {
      const key = resolveCanonicalExerciseId(ex.exerciseName) || ex.exerciseName.trim().toLowerCase();
      const assisted = isAssistedExercise(ex.exerciseName);
      const working = (ex.sets || []).filter((s) => s.setType !== 'warmup' && (s.weight || 0) > 0);
      if (working.length === 0) continue;
      const e1rm = estimateTopE1RM(working, assisted);
      const topW = assisted
        ? Math.min(...working.map((s) => s.weight || 0))
        : Math.max(0, ...working.map((s) => s.weight || 0));
      if (e1rm <= 0) continue;
      if (!liftHistory.has(key)) {
        liftHistory.set(key, { name: ex.exerciseName, assisted, e1rms: [], topWeights: [] });
      }
      const entry = liftHistory.get(key)!;
      entry.e1rms.push(e1rm);
      entry.topWeights.push(topW);
    }
  }

  // Detect regression across 3 sessions (newest < prev < prev2)
  for (const [, data] of liftHistory) {
    if (data.e1rms.length >= 3) {
      const [latest, prev, older] = data.e1rms;
      if (latest < prev * 0.97 && prev <= older) {
        return {
          id: `deload-plateau-${data.name}`,
          type: 'deload_recommended',
          badge: isUk ? 'РЕКОМЕНДАЦІЯ DELOAD' : 'DELOAD RECOMMENDED',
          title: isUk
            ? `Помітна втома у «${translateExercise(data.name)}»`
            : `Fatigue detected in ${translateExercise(data.name)}`,
          body: isUk
            ? 'Показники знижуються два тренування поспіль. Тиждень розвантаження (-15% ваги) зніме втому ЦНС і запустить новий ріст.'
            : 'Performance dipped across consecutive sessions. A 1-week deload (-15% weight) clears fatigue and sparks new gains.',
          actionLabel: isUk ? 'Увімкнути Deload (-15%)' : 'Activate Deload (-15%)',
          actionType: 'apply_deload',
          accent: 'amber',
        };
      }
    }
  }

  // High sustained training block (12+ full workouts in 28 days)
  if (last28d.length >= 12) {
    return {
      id: 'deload-high-volume',
      type: 'deload_recommended',
      badge: isUk ? 'ЧАС ВІДНОВЛЕННЯ' : 'RECOVERY CHECK',
      title: isUk
        ? `${last28d.length} тренувань за 4 тижні — сильний темп!`
        : `${last28d.length} sessions in 4 weeks — strong streak!`,
      body: isUk
        ? 'Після 4 тижнів інтенсивної роботи короткий Deload (-15% ваги) допоможе суглобам і нервовій системі вийти на новий пік.'
        : 'After 4 weeks of hard training, a quick -15% deload week resets your joints and nervous system for new PRs.',
      actionLabel: isUk ? 'Увімкнути Deload (-15%)' : 'Activate Deload (-15%)',
      actionType: 'apply_deload',
      accent: 'amber',
    };
  }

  // 3. Detect biggest positive strength win across 2+ sessions
  let bestGain: { name: string; diffKg: number; pct: number } | null = null;
  for (const [, data] of liftHistory) {
    if (data.topWeights.length >= 2) {
      const latest = data.topWeights[0];
      const earliest = data.topWeights[data.topWeights.length - 1];
      // For assisted exercises, reducing counterweight (earliest - latest > 0) is a positive strength win!
      const diff = data.assisted ? earliest - latest : latest - earliest;
      if (diff >= 2.5 && earliest > 0) {
        const pct = Math.round((diff / earliest) * 100);
        if (!bestGain || diff > bestGain.diffKg) {
          bestGain = { name: data.name, diffKg: diff, pct };
        }
      }
    }
  }

  if (bestGain) {
    return {
      id: `win-${bestGain.name}`,
      type: 'strength_win',
      badge: isUk ? 'ПРОГРЕС СИЛИ' : 'STRENGTH WIN',
      title: isUk
        ? `${translateExercise(bestGain.name)}: +${formatWeightDiff(bestGain.diffKg)} (+${bestGain.pct}%)`
        : `${translateExercise(bestGain.name)}: +${formatWeightDiff(bestGain.diffKg)} (+${bestGain.pct}%)`,
      body: isUk
        ? 'Подвійна прогресія працює! Тримайте техніку чистою — SPOT продовжить плавно підвищувати ціль.'
        : 'Double progression is paying off! Keep your reps crisp and SPOT will continue nudging your targets up.',
      accent: 'emerald',
    };
  }

  // 4. Lagging muscle group alert (if user trained in last 7 days but missed a major group)
  const recovery = calculateMuscleRecoveryStats(fullWorkouts);
  const activeGroups = Object.values(recovery).filter((r) => r.weeklySets > 0);
  const lagging = ['Legs', 'Back', 'Chest', 'Shoulders'].find(
    (m) => recovery[m] && recovery[m].weeklySets === 0
  );

  if (activeGroups.length >= 2 && lagging) {
    return {
      id: `lagging-${lagging}`,
      type: 'lagging_muscle',
      badge: isUk ? 'БАЛАНС МʼЯЗІВ' : 'MUSCLE BALANCE',
      title: isUk
        ? `${translateMuscle(lagging)} — 0 сетів за останні 7 днів`
        : `${translateMuscle(lagging)} — 0 sets in the last 7 days`,
      body: isUk
        ? 'Перевірте анатомічну карту мʼязів в Аналітиці, щоб тримати гармонійний баланс навантаження.'
        : 'Open your Anatomy Heatmap in Analytics to keep weekly volume balanced across all muscle groups.',
      actionLabel: isUk ? 'Відкрити карту мʼязів' : 'Open Anatomy Map',
      actionType: 'open_muscles',
      accent: 'purple',
    };
  }

  // 5. General momentum message
  return {
    id: 'coach-momentum',
    type: 'onboarding_momentum',
    badge: 'SPOT COACH',
    title: isUk
      ? `Серія триває: ${fullWorkouts.length} ${fullWorkouts.length === 1 ? 'тренування' : fullWorkouts.length < 5 ? 'тренування' : 'тренувань'} у лозі`
      : `Building momentum: ${fullWorkouts.length} ${fullWorkouts.length === 1 ? 'workout' : 'workouts'} logged`,
    body: isUk
      ? 'Додайте хоча б +1 повторення до минулого результату в базових вправах сьогодні — це гарантований стимул росту.'
      : 'Aim for +1 rep over your previous session on your main lifts today — consistent micro-overload drives real growth.',
    actionLabel: isUk ? 'Карта мʼязів' : 'Anatomy Map',
    actionType: 'open_muscles',
    accent: 'lime',
  };
}

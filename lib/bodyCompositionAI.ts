import { BodyWeightStats } from '@/store/bodyWeightStore';
import { UserGoal } from '@/store/userProfileStore';

export interface AICorrelationAnalysis {
  status: 'optimal' | 'good' | 'warning' | 'plateau';
  badge: string;
  badgeColor: string;
  title: string;
  insight: string;
  recommendation: string;
}

export function analyzeBodyAndStrength(
  goal: UserGoal,
  stats: BodyWeightStats,
  strengthDeltaPercent: number,
  lang: 'en' | 'uk' = 'en'
): AICorrelationAnalysis {
  const { deltaWeight } = stats;
  const isUk = lang === 'uk';

  switch (goal) {
    case 'Lose Fat': {
      // Ideal: Weight drops (-0.3kg to -1.0kg/week, or negative delta), while Strength stays flat or increases
      if (deltaWeight < -0.3 && strengthDeltaPercent >= -1) {
        return {
          status: 'optimal',
          badge: isUk ? 'ІДЕАЛЬНИЙ ДЕФІЦИТ' : 'OPTIMAL CUT',
          badgeColor: '#C8FF3D',
          title: isUk
            ? 'Чисте спалювання жиру зі збереженням мʼязів'
            : 'Pure Fat Loss & Muscle Retention',
          insight: isUk
            ? `Вага тіла знизилася на ${Math.abs(deltaWeight)} кг, а силовий об'єм зріс/зберігся (${strengthDeltaPercent >= 0 ? '+' : ''}${strengthDeltaPercent}%). Це найкращий можливий результат: підшкірний жир спалюється, а м'язова тканина повністю захищена.`
            : `Bodyweight decreased by ${Math.abs(deltaWeight)} kg while strength held strong (${strengthDeltaPercent >= 0 ? '+' : ''}${strengthDeltaPercent}%). You are burning fat while preserving lean contractile tissue.`,
          recommendation: isUk
            ? 'Зберігайте поточний дефіцит калорій та норму білка (~1.8-2.2 г/кг). Додаткових змін не потрібно.'
            : 'Maintain current caloric deficit and protein intake (~1.8-2.2 g/kg). Training stimulus is spot on.',
        };
      }

      // Warning: Weight dropping fast but strength crashing
      if (deltaWeight < -1.5 && strengthDeltaPercent < -4) {
        return {
          status: 'warning',
          badge: isUk ? 'ЗАГОСТРЕНИЙ ДЕФІЦИТ' : 'AGGRESSIVE DEFICIT',
          badgeColor: '#F59E0B',
          title: isUk
            ? 'Ризик втрати мʼязової маси'
            : 'Potential Muscle Depletion Warning',
          insight: isUk
            ? `Вага падає надто різко (${Math.abs(deltaWeight)} кг), проте силові показники просіли на ${Math.abs(strengthDeltaPercent)}%. Тіло починає спалювати м'язовий глікоген та амінокислоти.`
            : `Weight dropped quickly (${Math.abs(deltaWeight)} kg) but your strength decreased by ${Math.abs(strengthDeltaPercent)}%. The deficit may be too aggressive for recovery.`,
          recommendation: isUk
            ? 'Додайте +150-200 ккал повільних вуглеводів перед тренуванням або зробіть 2-денний рефід, щоб відновити глікоген.'
            : 'Add +150-200 kcal of complex carbs pre-workout or schedule a 2-day refeed to replenish glycogen stores.',
        };
      }

      // Plateau: Weight not moving
      if (deltaWeight >= 0) {
        return {
          status: 'plateau',
          badge: isUk ? 'ПЛАТО ВАГИ' : 'WEIGHT PLATEAU',
          badgeColor: '#60A5FA',
          title: isUk
            ? 'Адаптація метаболізму'
            : 'Weight Stagnation Detected',
          insight: isUk
            ? `За обраний період вага залишилася стабільною (${deltaWeight >= 0 ? '+' : ''}${deltaWeight} кг). Силові показники: ${strengthDeltaPercent >= 0 ? '+' : ''}${strengthDeltaPercent}%. Якщо талія зменшується, відбувається рекомпозиція.`
            : `Bodyweight is flat (${deltaWeight >= 0 ? '+' : ''}${deltaWeight} kg) over this period. Strength is ${strengthDeltaPercent >= 0 ? '+' : ''}${strengthDeltaPercent}%. If waist measurements drop, you may be recomping.`,
          recommendation: isUk
            ? 'Зменшіть калорійність на 150 ккал/день або додайте 15 хвилин кардіо низької інтенсивності після силового блоку.'
            : 'Reduce daily intake by ~150 kcal or add 15 minutes of low-intensity incline walking after lifting.',
        };
      }

      return {
        status: 'good',
        badge: isUk ? 'СТАБІЛЬНИЙ ПРОГРЕС' : 'STEADY PROGRESS',
        badgeColor: '#C8FF3D',
        title: isUk ? 'Плавна динаміка сушки' : 'Controlled Fat Loss',
        insight: isUk
          ? `Вага зменшилася на ${Math.abs(deltaWeight)} кг. Силові тренування забезпечують щільність м'язів.`
          : `Weight is down by ${Math.abs(deltaWeight)} kg. Strength training is keeping muscle tone tight.`,
        recommendation: isUk
          ? 'Продовжуйте за планом, слідкуйте за якістю сну.'
          : 'Continue the plan and maintain high sleep quality.',
      };
    }

    case 'Build Muscle':
    case 'Get Stronger': {
      // Ideal: Weight slowly going up (+0.2 to +1.5kg), and strength increasing steadily
      if (deltaWeight > 0.2 && strengthDeltaPercent > 2) {
        return {
          status: 'optimal',
          badge: isUk ? 'ЧИСТИЙ МАСОНАБІР' : 'PEAK LEAN BULK',
          badgeColor: '#C8FF3D',
          title: isUk
            ? 'Якісна гіпертрофія без зайвого жиру'
            : 'Lean Hypertrophy & Overload',
          insight: isUk
            ? `Маса тіла плавно зросла на +${deltaWeight} кг у поєднанні з ростом силового об'єму на +${strengthDeltaPercent}%. Це класичний ознака чистого синтезу м'язових волокон без надлишку жиру.`
            : `Bodyweight increased smoothly by +${deltaWeight} kg alongside a +${strengthDeltaPercent}% strength volume surge. You are synthesizing new contractile tissue.`,
          recommendation: isUk
            ? 'Ідеальний енергетичний профіцит. Продовжуйте прогресивне перевантаження з робочими вагами.'
            : 'Spot-on energy surplus. Continue progressive overload on your core lifts.',
        };
      }

      // Warning: Weight going up fast, but strength isn't moving
      if (deltaWeight > 1.8 && strengthDeltaPercent <= 0) {
        return {
          status: 'warning',
          badge: isUk ? 'НАДЛИШОК КАЛОРІЙ' : 'SURPLUS SPIKE',
          badgeColor: '#F59E0B',
          title: isUk
            ? 'Зростання маси без росту сили'
            : 'Rapid Scale Gain Without Strength',
          insight: isUk
            ? `Вага додалася на +${deltaWeight} кг, але силовий тоннаж не зріс (${strengthDeltaPercent}%). Частина набраної ваги може бути водою або жировою масою.`
            : `Weight climbed by +${deltaWeight} kg without corresponding strength gains (${strengthDeltaPercent}%). Some gains may be water retention or fat.`,
          recommendation: isUk
            ? 'Трохи зменшіть профіцит калорій (-150 ккал) і сфокусуйтеся на техніці вправ до відмови.'
            : 'Trim your daily surplus by ~150 kcal and ensure you are pushing within 1-2 reps of failure.',
        };
      }

      // Plateau: Weight not growing on bulk
      if (deltaWeight <= 0) {
        return {
          status: 'plateau',
          badge: isUk ? 'ПЛАТО НАБОРУ' : 'LEAN STALL',
          badgeColor: '#60A5FA',
          title: isUk
            ? 'Брак будівельного матеріалу'
            : 'Weight Stalled on Bulking Phase',
          insight: isUk
            ? `Вага не зростає (${deltaWeight} кг), хоча ціль — ріст м'язів. Метаболізм підлаштувався під навантаження і спалює всі спожиті калорії.`
            : `Body mass has not increased (${deltaWeight} kg). Your metabolic rate has adapted to your training volume.`,
          recommendation: isUk
            ? 'Додайте +200-300 ккал на день (наприклад, жменю горіхів, порцію вівсянки або білковий смузі).'
            : 'Add a small +200-300 kcal bump daily (e.g. a serving of oats, nuts, or a whey shake).',
        };
      }

      return {
        status: 'good',
        badge: isUk ? 'ПОСТУПОВИЙ РІСТ' : 'PROGRESSIVE BULK',
        badgeColor: '#C8FF3D',
        title: isUk ? 'Контрольований масонабір' : 'Controlled Hypertrophy',
        insight: isUk
          ? `Вага зростає помірно (+${deltaWeight} кг). Сила відповідає фазі адаптації.`
          : `Steady gain of +${deltaWeight} kg. Progressive overload is tracking well.`,
        recommendation: isUk
          ? 'Дотримуйтесь графіку відновлення між сесіями.'
          : 'Keep sticking to your recovery and sleep window.',
      };
    }

    case 'Recomposition':
    default: {
      if (strengthDeltaPercent > 2 && Math.abs(deltaWeight) <= 1.2) {
        return {
          status: 'optimal',
          badge: isUk ? 'РЕКОМПОЗИЦІЯ УСПІШНА' : 'PRIME RECOMP',
          badgeColor: '#C8FF3D',
          title: isUk
            ? 'Заміна жиру на міцні мʼязи'
            : 'Fat-to-Muscle Recomposition',
          insight: isUk
            ? `Стрілка вагів майже нерухома (${deltaWeight >= 0 ? '+' : ''}${deltaWeight} кг), але сила виросла на +${strengthDeltaPercent}%. Ваше тіло спалює жирові запаси для синтезу м'язових волокон.`
            : `Scale weight is steady (${deltaWeight >= 0 ? '+' : ''}${deltaWeight} kg), yet strength climbed +${strengthDeltaPercent}%. You are converting adipose stores into dense muscle tissue.`,
          recommendation: isUk
            ? 'Ідеальний баланс. Не міняйте калорійність, зберігайте високу інтенсивність.'
            : 'Perfection. Keep intake near maintenance and maintain hard training intensity.',
        };
      }

      return {
        status: 'good',
        badge: isUk ? 'БАЛАНС ТІЛА' : 'BODY BALANCE',
        badgeColor: '#60A5FA',
        title: isUk ? 'Стабільний тренувальний баланс' : 'Bodyweight Baseline Maintained',
        insight: isUk
          ? `Вага тіла: ${stats.currentWeight} кг (зміна: ${deltaWeight >= 0 ? '+' : ''}${deltaWeight} кг).`
          : `Current mass: ${stats.currentWeight} kg (delta: ${deltaWeight >= 0 ? '+' : ''}${deltaWeight} kg).`,
        recommendation: isUk
          ? 'Продовжуйте записувати щотижневі зважування для точного аналізу тренду.'
          : 'Continue logging weekly weigh-ins to establish an accurate trend line.',
      };
    }
  }
}


import { useUserProfileStore, type AppLanguage } from '@/store/userProfileStore';

export type TranslationKey = keyof typeof en;

const en = {
  // Tabs Navigation
  tabHome: 'Home',
  tabProgram: 'Program',
  tabHistory: 'History',
  tabAnalytics: 'Analytics',
  tabProfile: 'Profile',

  // Home Dashboard
  readyToTrain: 'READY TO TRAIN',
  targetRecovered: 'Target muscles fully recovered',
  optimalState: 'OPTIMAL STATE',
  targetRecovering: 'Target muscles recovering',
  recovering: 'RECOVERING',
  highFatigue: 'High fatigue detected',
  todaysWorkout: "TODAY'S WORKOUT",
  startWorkout: 'START WORKOUT',
  resumeWorkout: 'Resume workout',
  thisWeek: 'THIS WEEK',
  spotInsight: 'SPOT INSIGHT',
  viewProgram: 'VIEW PROGRAM',
  restDay: 'REST DAY',
  optimalRecovery: 'Optimal Recovery',
  weeklyReadiness: 'Weekly Readiness',
  activeStreak: 'Active Streak',

  // Program Screen
  yourProgram: 'Your Program',
  routine: 'Routine',
  aiCoach: 'AI Coach',
  askAnything: 'Ask anything about your training.',
  sessions: 'SESSIONS',
  upNext: 'UP NEXT',
  exercises: 'Exercises',
  sets: 'Sets',
  edit: 'Edit',
  customizeWorkout: 'Customize Workout',
  workoutSequence: 'WORKOUT SEQUENCE',
  suggestedQuestions: 'Suggested questions',
  gettingSmarter: 'GETTING SMARTER',
  gettingSmarterText: 'SPOT detected 7 progressive patterns in your training.',
  askPlaceholder: 'Type your question...',

  // Analytics & Progress Screen
  analytics: 'Analytics',
  overview: 'Overview',
  muscleGroups: 'Muscle Groups',
  prs: 'PRs',
  totalVolume: 'TOTAL VOLUME',
  workouts: 'WORKOUTS',
  avgIntensity: 'AVG INTENSITY',
  strengthTrend: 'STRENGTH TREND',
  muscleBreakdown: 'MUSCLE GROUP BREAKDOWN',
  strengthOverTime: 'STRENGTH OVER TIME',
  allTimeBest: 'All-Time Best',
  estimated1RM: 'Estimated 1RM',
  current: 'Current',
  last7Days: 'Last 7 Days',
  last30Days: 'Last 30 Days',
  last90Days: 'Last 90 Days',
  allTime: 'All Time',
  noDataYet: 'No workout data yet. Complete your first session!',

  // Workout Flow - Preview
  workoutPreview: 'WORKOUT PREVIEW',
  estimatedTime: 'Estimated Time',
  targetMuscles: 'Target Muscles',
  replaceExercise: 'Replace Exercise',

  // Workout Flow - Active
  activeWorkout: 'ACTIVE WORKOUT',
  finish: 'FINISH',
  finishWorkout: 'FINISH WORKOUT',
  set: 'SET',
  previous: 'PREVIOUS',
  reps: 'REPS',
  weight: 'WEIGHT',
  status: 'STATUS',
  today: 'Today',
  lastWorkout: 'LAST WORKOUT',
  noPreviousData: 'No previous workout data',
  completeSet: 'COMPLETE SET',
  swap: 'Swap',
  swapExercise: 'Swap Exercise',
  searchExercisePlaceholder: 'Search exercise or muscle...',
  noActiveWorkout: 'No active workout.',
  backToHome: 'Back to Home',
  abandonWorkout: 'Abandon workout?',
  abandonWorkoutDesc: 'Your workout progress will be saved so you can resume it later.',
  keepWorkout: 'Keep workout',
  exitWorkout: 'Exit workout',
  couldNotSave: 'Could not save workout',
  couldNotSaveDesc: 'Your workout is still on this device. Try saving again.',
  savingWorkout: 'Saving workout...',
  adjustWeightReps: 'Adjust weight & reps',
  activeBadge: 'ACTIVE',
  base: 'Base',
  alternativesFor: 'Alternatives for',

  // Workout Flow - Rest
  setComplete: 'SET COMPLETE',
  restTimer: 'REST TIMER',
  plus30Sec: '+30 SEC',
  skipRest: 'SKIP REST',
  start: 'Start',
  skip: 'Skip',
  nextExercise: 'NEXT EXERCISE',
  nextSet: 'NEXT SET',

  // Workout Flow - Complete
  workoutComplete: 'WORKOUT COMPLETE',
  noCompletedWorkout: 'No completed workout.',
  greatWork: 'Great work! Session logged.',
  duration: 'Duration',
  volume: 'Volume',
  personalRecords: 'PERSONAL RECORDS',
  baselineSaved: 'Baseline saved. Overload weights will advance next session!',

  // Workout Flow - Input
  setOf: 'Set',
  of: 'of',

  // Profile & Settings
  training: 'TRAINING',
  preferences: 'PREFERENCES',
  account: 'ACCOUNT',
  dangerZone: 'DANGER ZONE',
  customRoutine: 'Custom Routine',
  customizedRoutine: 'Customized routine',
  frequency: 'Frequency',
  daysPerWeek: 'days / week',
  weightUnit: 'Weight unit',
  heightUnit: 'Height unit',
  restTimerSetting: 'Rest timer',
  language: 'Language',
  notifications: 'Notifications',
  reminderTime: 'Reminder time',
  reminderTimeDesc: 'Workout day alert time',
  sendTestNotification: 'Send test notification',
  testNotificationSent: 'Test notification scheduled! It will arrive in 1-2 seconds.',
  testNotificationError: 'Could not send test notification. Check system notification permissions.',
  soundEffects: 'Sound effects',
  subscription: 'Subscription',
  restorePurchases: 'Restore purchase',
  privacy: 'Privacy',
  support: 'Support',
  restartOnboarding: 'Restart Onboarding',
  restartSubtitle: 'Re-run initial welcome & plan setup',
  resetAppData: 'Reset App Data',
  resetSubtitle: 'Wipe workout history, custom programs, and progress',

  // Workout Editor Modal
  workoutName: 'WORKOUT NAME',
  addExercise: 'Add Exercise',
  saveChanges: 'Save Changes',
  saveWorkout: 'Save Workout',
  exerciseLibrary: 'Exercise Library',
  selectExerciseToAdd: 'Select an exercise to add',
  allMuscles: 'All',
  cannotRemove: 'Cannot remove',
  minOneExercise: 'A workout must have at least 1 exercise.',

  // Muscle Categories
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  legs: 'Legs',
  arms: 'Arms',
  core: 'Core',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  biceps: 'Biceps',
  triceps: 'Triceps',

  // Rest Times
  rest60: '60s (1:00) — Fast Pace',
  rest90: '90s (1:30) — Hypertrophy',
  rest120: '120s (2:00) — Balanced',
  rest150: '150s (2:30) — Standard (SPOT)',
  rest180: '180s (3:00) — Heavy Compound',
  rest240: '240s (4:00) — Max Strength',

  // Onboarding
  welcomeTagline: 'Train smarter.\nProgress automatically.',
  welcomeSubTagline: 'Your personal AI-powered training system.',
  getStarted: 'Get started',
  logIn: 'Log in',
  whatsYourGoal: "What's your goal?",
  goalSubtitle: "We'll use this to build your training plan.",
  buildMuscle: 'Build Muscle',
  buildMuscleDetail: 'Build size & shape',
  getStronger: 'Get Stronger',
  getStrongerDetail: 'Increase strength',
  loseFat: 'Lose Fat',
  loseFatDetail: 'Reduce body fat',
  experienceLevel: "What's your experience level?",
  experienceSubtitle: 'This helps calibrate initial volume and intensity.',
  beginner: 'Beginner',
  beginnerDetail: 'Less than 1 year of consistent lifting',
  intermediate: 'Intermediate',
  intermediateDetail: '1–3 years of consistent barbell training',
  advanced: 'Advanced',
  advancedDetail: '3+ years of structured strength programming',
  frequencyTitle: 'How often do you want to train?',
  frequencySubtitle: 'Select your ideal weekly schedule.',
  equipmentTitle: 'What equipment do you have access to?',
  equipmentSubtitle: "We'll filter exercises based on your gear.",
  fullGym: 'Full Commercial Gym',
  fullGymDetail: 'Barbells, dumbbells, machines, and cables',
  dumbbellsOnly: 'Dumbbells Only',
  dumbbellsOnlyDetail: 'Adjustable or fixed dumbbell set and bench',
  bodyweightOnly: 'Bodyweight & Calisthenics',
  bodyweightDetail: 'Pull-up bar, dip station, or floor space',
  planCreationMode: 'HOW DO YOU WANT TO BUILD YOUR ROUTINE?',
  creationModeSubtitle: 'Choose between an AI-calibrated routine or full manual control.',
  aiSmartPlan: 'AI-Calibrated Routine',
  aiSmartPlanBadge: 'RECOMMENDED',
  aiSmartPlanDesc: 'SPOT analyzes your goal, experience, and equipment to calculate optimal volume and progressive overload.',
  customRoutineMode: 'Custom Routine',
  customRoutineBadge: 'ATHLETE',
  customRoutineDesc: 'For experienced lifters who already follow a specific program, split, or custom exercise sequence.',
  selectYourSplit: 'Select your preferred split',
  planReady: 'YOUR PLAN IS READY',
  startTraining: 'START TRAINING',
  continue: 'Continue',

  // History Screen
  workoutHistory: 'Workout history',
  noWorkoutsYet: 'NO WORKOUTS YET',
  noWorkoutsBody: 'Your completed workouts will appear here.',
  workoutNotFound: 'Workout not found.',
  backToHistory: 'BACK TO HISTORY',
  todayUpper: 'TODAY',
  yesterdayUpper: 'YESTERDAY',

  // Program Editor
  editProgram: 'Edit Program',
  editWorkout: 'Edit Workout',
  programName: 'PROGRAM NAME',
  moveUp: 'Move Up',
  moveDown: 'Move Down',
  delete: 'Delete',
  discardChanges: 'Discard Changes',
  reorderHelp: 'Tap Edit to configure exercises',
  reorderVariables: 'Reorder & adjust variables',
  recWeight: 'REC. WEIGHT (KG)',
  increment: 'INCREMENT (KG)',
  validationError: 'Validation Error',
  programNameEmpty: 'Program name cannot be empty.',
  programMustHaveWorkout: 'Program must have at least one workout.',

  // Common UI
  cancel: 'Cancel',
  save: 'Save',
  done: 'Done',
  navBack: 'Back',
  close: 'Close',
  min: 'min',
  kg: 'kg',
  lbs: 'lbs',
  bodyweight: 'Bodyweight',
};

const uk: Record<TranslationKey, string> = {
  // Tabs Navigation
  tabHome: 'Головна',
  tabProgram: 'Програма',
  tabHistory: 'Історія',
  tabAnalytics: 'Аналітика',
  tabProfile: 'Профіль',

  // Home Dashboard
  readyToTrain: 'ГОТОВІ ДО ТРЕНУВАННЯ',
  targetRecovered: 'Цільові м’язи повністю відновилися',
  optimalState: 'ОПТИМАЛЬНИЙ СТАН',
  targetRecovering: 'Цільові м’язи відновлюються',
  recovering: 'ВІДНОВЛЕННЯ',
  highFatigue: 'Виявлено високу втому',
  todaysWorkout: 'СЬОГОДНІШНЄ ТРЕНУВАННЯ',
  startWorkout: 'ПОЧАТИ ТРЕНУВАННЯ',
  resumeWorkout: 'Продовжити тренування',
  thisWeek: 'ЦЬОГО ТИЖНЯ',
  spotInsight: 'АНАЛІТИКА SPOT',
  viewProgram: 'ПЕРЕГЛЯНУТИ ПРОГРАМУ',
  restDay: 'ДЕНЬ ВІДПОЧИНКУ',
  optimalRecovery: 'Оптимальне відновлення',
  weeklyReadiness: 'Тижнева готовність',
  activeStreak: 'Серія тренувань',

  // Program Screen
  yourProgram: 'Ваша програма',
  routine: 'Розклад',
  aiCoach: 'ШІ Тренер',
  askAnything: 'Запитуйте будь-що про ваші тренування.',
  sessions: 'СЕСІЙ',
  upNext: 'НАСТУПНЕ',
  exercises: 'Вправи',
  sets: 'Сети',
  edit: 'Змінити',
  customizeWorkout: 'Налаштувати тренування',
  workoutSequence: 'ПОСЛІДОВНІСТЬ ТРЕНУВАНЬ',
  suggestedQuestions: 'Рекомендовані запитання',
  gettingSmarter: 'РОЗУМНИЙ АНАЛІЗ',
  gettingSmarterText: 'SPOT виявив 7 патернів прогресії у ваших тренуваннях.',
  askPlaceholder: 'Напишіть запитання...',

  // Analytics & Progress Screen
  analytics: 'Аналітика',
  overview: 'Огляд',
  muscleGroups: 'Групи м’язів',
  prs: 'Рекорди',
  totalVolume: 'ЗАГАЛЬНИЙ ОБ’ЄМ',
  workouts: 'ТРЕНУВАННЯ',
  avgIntensity: 'СЕРЕДНЯ ІНТЕНСИВНІСТЬ',
  strengthTrend: 'ТРЕНД СИЛИ',
  muscleBreakdown: 'РОЗПОДІЛ ПО ГРУПАХ М’ЯЗІВ',
  strengthOverTime: 'ДИНАМІКА СИЛИ',
  allTimeBest: 'Найкращий результат',
  estimated1RM: 'Розрахунковий 1ПМ',
  current: 'Поточний',
  last7Days: 'Останні 7 днів',
  last30Days: 'Останні 30 днів',
  last90Days: 'Останні 90 днів',
  allTime: 'За весь час',
  noDataYet: 'Ще немає даних. Завершіть перше тренування!',

  // Workout Flow - Preview
  workoutPreview: 'ОГЛЯД ТРЕНУВАННЯ',
  estimatedTime: 'Орієнтовний час',
  targetMuscles: 'Цільові м’язи',
  replaceExercise: 'Замінити вправу',

  // Workout Flow - Active
  activeWorkout: 'АКТИВНЕ ТРЕНУВАННЯ',
  finish: 'ЗАВЕРШИТИ',
  finishWorkout: 'ЗАВЕРШИТИ ТРЕНУВАННЯ',
  set: 'СЕТ',
  previous: 'ПОПЕРЕДНІЙ',
  reps: 'ПОВТОРЕННЯ',
  weight: 'ВАГА',
  status: 'СТАТУС',
  today: 'Сьогодні',
  lastWorkout: 'ПОПЕРЕДНЄ ТРЕНУВАННЯ',
  noPreviousData: 'Немає попередніх даних',
  completeSet: 'ЗАВЕРШИТИ СЕТ',
  swap: 'Заміна',
  swapExercise: 'Замінити вправу',
  searchExercisePlaceholder: 'Пошук вправи або м’яза...',
  noActiveWorkout: 'Немає активного тренування.',
  backToHome: 'На головну',
  abandonWorkout: 'Перервати тренування?',
  abandonWorkoutDesc: 'Ваш прогрес тренування буде збережено, ви зможете продовжити пізніше.',
  keepWorkout: 'Продовжити',
  exitWorkout: 'Вийти',
  couldNotSave: 'Не вдалося зберегти тренування',
  couldNotSaveDesc: 'Ваше тренування збережено на цьому пристрої. Спробуйте ще раз.',
  savingWorkout: 'Збереження...',
  adjustWeightReps: 'Налаштувати вагу та повторення',
  activeBadge: 'АКТИВНА',
  base: 'База',
  alternativesFor: 'Альтернативи для',

  // Workout Flow - Rest
  setComplete: 'СЕТ ЗАВЕРШЕНО',
  restTimer: 'ТАЙМЕР ВІДПОЧИНКУ',
  plus30Sec: '+30 СЕК',
  skipRest: 'ПРОПУСТИТИ',
  start: 'Почати',
  skip: 'Пропустити',
  nextExercise: 'НАСТУПНА ВПРАВА',
  nextSet: 'НАСТУПНИЙ СЕТ',

  // Workout Flow - Complete
  workoutComplete: 'ТРЕНУВАННЯ ЗАВЕРШЕНО',
  noCompletedWorkout: 'Немає завершеного тренування.',
  greatWork: 'Чудова робота! Сесію збережено.',
  duration: 'Тривалість',
  volume: 'Об’єм',
  personalRecords: 'ОСОБИСТІ РЕКОРДИ',
  baselineSaved: 'Базу збережено. Вага прогресивно збільшиться наступного разу!',

  // Workout Flow - Input
  setOf: 'Сет',
  of: 'з',

  // Profile & Settings
  training: 'ТРЕНУВАННЯ',
  preferences: 'НАЛАШТУВАННЯ',
  account: 'АКАУНТ',
  dangerZone: 'НЕБЕЗПЕЧНА ЗОНА',
  customRoutine: 'Власна програма',
  customizedRoutine: 'Індивідуальний розклад',
  frequency: 'Частота',
  daysPerWeek: 'днів / тиждень',
  weightUnit: 'Одиниці ваги',
  heightUnit: 'Одиниці зросту',
  restTimerSetting: 'Таймер відпочинку',
  language: 'Мова застосунку',
  notifications: 'Сповіщення',
  reminderTime: 'Час нагадування',
  reminderTimeDesc: 'Час сповіщення у дні тренувань',
  sendTestNotification: 'Надіслати тестове сповіщення',
  testNotificationSent: 'Тестове сповіщення заплановано! Очікуйте за 1-2 секунди.',
  testNotificationError: 'Не вдалося надіслати сповіщення. Перевірте дозволи в налаштуваннях пристрою.',
  soundEffects: 'Звукові ефекти',
  subscription: 'Підписка',
  restorePurchases: 'Відновити покупки',
  privacy: 'Конфіденційність',
  support: 'Підтримка',
  restartOnboarding: 'Перезапустити онбординг',
  restartSubtitle: 'Пройти опитування та створити план знову',
  resetAppData: 'Скинути всі дані',
  resetSubtitle: 'Видалити історію тренувань, програми та прогрес',

  // Workout Editor Modal
  workoutName: 'НАЗВА ТРЕНУВАННЯ',
  addExercise: 'Додати вправу',
  saveChanges: 'Зберегти зміни',
  saveWorkout: 'Зберегти тренування',
  exerciseLibrary: 'Бібліотека вправ',
  selectExerciseToAdd: 'Оберіть вправу для додавання',
  allMuscles: 'Всі',
  cannotRemove: 'Неможливо видалити',
  minOneExercise: 'У тренуванні має бути щонайменше 1 вправа.',

  // Muscle Categories
  chest: 'Груди',
  back: 'Спина',
  shoulders: 'Плечі',
  legs: 'Ноги',
  arms: 'Руки',
  core: 'Кор',
  quads: 'Квадрицепси',
  hamstrings: 'Біцепс стегна',
  calves: 'Литки',
  biceps: 'Біцепс',
  triceps: 'Трицепс',

  // Rest Times
  rest60: '60с (1:00) — Швидкий темп',
  rest90: '90с (1:30) — Гіпертрофія',
  rest120: '120с (2:00) — Збалансований',
  rest150: '150с (2:30) — Стандарт (SPOT)',
  rest180: '180с (3:00) — Важкі базові',
  rest240: '240с (4:00) — Макс. сила',

  // Onboarding
  welcomeTagline: 'Тренуйтеся розумніше.\nПрогресуйте автоматично.',
  welcomeSubTagline: 'Ваша персональна тренувальна система на базі ШІ.',
  getStarted: 'Почати',
  logIn: 'Увійти',
  whatsYourGoal: 'Яка ваша мета?',
  goalSubtitle: 'Ми використаємо це для побудови тренувального плану.',
  buildMuscle: "Набрати м'язову масу",
  buildMuscleDetail: "Збільшити об'єм та рельєф",
  getStronger: 'Стати сильнішим',
  getStrongerDetail: 'Збільшити силові показники',
  loseFat: 'Скинути жир',
  loseFatDetail: 'Зменшити відсоток жиру',
  experienceLevel: 'Який ваш рівень досвіду?',
  experienceSubtitle: 'Це допоможе підібрати початковий об’єм та інтенсивність.',
  beginner: 'Початківець',
  beginnerDetail: 'Менше 1 року регулярних тренувань',
  intermediate: 'Середній',
  intermediateDetail: '1–3 роки регулярних тренувань зі штангою',
  advanced: 'Досвідчений',
  advancedDetail: 'Понад 3 роки структурованих силових тренувань',
  frequencyTitle: 'Як часто ви хочете тренуватися?',
  frequencySubtitle: 'Оберіть ваш ідеальний розклад на тиждень.',
  equipmentTitle: 'До якого інвентарю у вас є доступ?',
  equipmentSubtitle: 'Ми підберемо вправи під ваше спорядження.',
  fullGym: 'Повноцінний спортзал',
  fullGymDetail: 'Штанги, гантелі, тренажери та кабельні блоки',
  dumbbellsOnly: 'Тільки гантелі',
  dumbbellsOnlyDetail: 'Набір гантелей та тренувальна лава',
  bodyweightOnly: 'Власна вага / Калістеніка',
  bodyweightDetail: 'Турнік, бруси або домашні тренування',
  planCreationMode: 'ЯК ВИ ХОЧЕТЕ СТВОРИТИ ПРОГРАМУ?',
  creationModeSubtitle: 'Оберіть між автоматичним калібруванням ШІ або повним контролем.',
  aiSmartPlan: 'ШІ-програма SPOT',
  aiSmartPlanBadge: 'РЕКОМЕНДОВАНО',
  aiSmartPlanDesc: 'SPOT аналізує ваші цілі, досвід та інвентар для розрахунку оптимального навантаження та прогресії.',
  customRoutineMode: 'Власна програма',
  customRoutineBadge: 'ДЛЯ АТЛЕТІВ',
  customRoutineDesc: 'Для досвідчених атлетів, які мають власний спліт, послідовність або хочуть скласти тренування з нуля.',
  selectYourSplit: 'Оберіть бажану структуру спліту',
  planReady: 'ВАШ ПЛАН ГОТОВИЙ',
  startTraining: 'РОЗПОЧАТИ ТРЕНУВАННЯ',
  continue: 'Продовжити',

  // History Screen
  workoutHistory: 'Історія тренувань',
  noWorkoutsYet: 'ЩЕ НЕМАЄ ТРЕНУВАНЬ',
  noWorkoutsBody: 'Ваші завершені тренування з’являться тут.',
  workoutNotFound: 'Тренування не знайдено.',
  backToHistory: 'НАЗАД ДО ІСТОРІЇ',
  todayUpper: 'СЬОГОДНІ',
  yesterdayUpper: 'ВЧОРА',

  // Program Editor
  editProgram: 'Редагувати програму',
  editWorkout: 'Редагувати тренування',
  programName: 'НАЗВА ПРОГРАМИ',
  moveUp: 'Вгору',
  moveDown: 'Вниз',
  delete: 'Видалити',
  discardChanges: 'Відхилити зміни',
  reorderHelp: 'Натисніть Змінити для налаштування вправ',
  reorderVariables: 'Зміна порядку та параметрів вправ',
  recWeight: 'РЕК. ВАГА (КГ)',
  increment: 'КРОК ВАГИ (КГ)',
  validationError: 'Помилка валідації',
  programNameEmpty: 'Назва програми не може бути порожньою.',
  programMustHaveWorkout: 'Програма повинна містити щонайменше одне тренування.',

  // Common UI
  cancel: 'Скасувати',
  save: 'Зберегти',
  done: 'Готово',
  navBack: 'Назад',
  close: 'Закрити',
  min: 'хв',
  kg: 'кг',
  lbs: 'фунти',
  bodyweight: 'Власна вага',
};

export const dictionaries = { en, uk };

export function getTranslation(key: TranslationKey, lang: AppLanguage = 'en'): string {
  const dict = dictionaries[lang] ?? dictionaries.en;
  return dict[key] ?? dictionaries.en[key] ?? key;
}

export function translateMuscle(muscle: string, lang: AppLanguage = 'en'): string {
  if (lang !== 'uk') return muscle;
  const m = muscle.toLowerCase().trim();
  const map: Record<string, string> = {
    all: 'Всі',
    chest: 'Груди',
    back: 'Спина',
    shoulders: 'Плечі',
    legs: 'Ноги',
    arms: 'Руки',
    core: 'Кор',
    quads: 'Квадрицепси',
    hamstrings: 'Біцепс стегна',
    calves: 'Литки',
    biceps: 'Біцепс',
    triceps: 'Трицепс',
  };
  return map[m] ?? muscle;
}

export function formatDayLabel(dayLabel?: string, lang: AppLanguage = 'en'): string {
  if (!dayLabel) return '';
  if (lang !== 'uk') return dayLabel;

  const clean = dayLabel.trim().toUpperCase();

  const dayMatch = clean.match(/^DAY\s*(\d+)$/i);
  if (dayMatch) {
    return `ДЕНЬ ${dayMatch[1]}`;
  }
  const workoutMatch = clean.match(/^WORKOUT\s*(\d+)$/i);
  if (workoutMatch) {
    return `ТРЕНУВАННЯ ${workoutMatch[1]}`;
  }

  const map: Record<string, string> = {
    MON: 'ПН',
    TUE: 'ВТ',
    WED: 'СР',
    THU: 'ЧТ',
    FRI: 'ПТ',
    SAT: 'СБ',
    SUN: 'НД',
    MONDAY: 'ПОНЕДІЛОК',
    TUESDAY: 'ВІВТОРОК',
    WEDNESDAY: 'СЕРЕДА',
    THURSDAY: 'ЧЕТВЕР',
    FRIDAY: 'П’ЯТНИЦЯ',
    SATURDAY: 'СУБОТА',
    SUNDAY: 'НЕДІЛЯ',
  };

  return map[clean] ?? dayLabel;
}

const UKRAINIAN_EXERCISES: Record<string, string> = {
  // Chest
  'barbell bench press': 'Жим штанги лежачи',
  'bench press': 'Жим штанги лежачи',
  'incline dumbbell press': 'Жим гантелей під кутом',
  'dumbbell bench press': 'Жим гантелей лежачи',
  'incline barbell press': 'Жим штанги під кутом',
  'incline bench press': 'Жим штанги під кутом',
  'incline bench': 'Жим штанги під кутом',
  'incline press': 'Жим під кутом',
  'incline chest press': 'Жим у похилому тренажері',
  'machine chest press': 'Жим у тренажері на груди',
  'cable chest fly': 'Зведення в кросовері',
  'cable fly': 'Зведення в кросовері',
  'push-ups': 'Відтискання від підлоги',
  'push ups': 'Відтискання від підлоги',
  'push-up': 'Відтискання',
  'push up': 'Відтискання',
  'chest dips': 'Відтискання на брусах',
  'dips': 'Відтискання на брусах',
  'bench dips': 'Зворотні відтискання від лави',

  // Back
  'lat pulldown': 'Тяга верхнього блоку',
  'barbell bent-over row': 'Тяга штанги в нахилі',
  'barbell row': 'Тяга штанги в нахилі',
  'single-arm dumbbell row': 'Тяга гантелі в нахилі',
  'dumbbell row': 'Тяга гантелі в нахилі',
  'seated cable row': 'Горизонтальна тяга блоку',
  'seated row': 'Горизонтальна тяга блоку',
  'cable row': 'Горизонтальна тяга блоку',
  'inverted row': 'Австралійські підтягування',
  'pull-ups': 'Підтягування',
  'pull ups': 'Підтягування',
  'pull-up': 'Підтягування',
  'pull up': 'Підтягування',
  'chin-ups': 'Підтягування зворотним хватом',
  'chin ups': 'Підтягування зворотним хватом',
  'face pulls': 'Тяга до обличчя (Face Pulls)',
  'face pull': 'Тяга до обличчя',

  // Shoulders
  'overhead barbell press': 'Армійський жим штанги',
  'overhead press': 'Армійський жим (над головою)',
  'military press': 'Армійський жим',
  'dumbbell shoulder press': 'Жим гантелей сидячи',
  'shoulder press': 'Жим на плечі',
  'machine shoulder press': 'Жим на плечі в тренажері',
  'pike push-ups': 'Відтискання куточком (Pike)',
  'lateral dumbbell raises': 'Махи гантелями в сторони',
  'lateral raises': 'Махи гантелями в сторони',
  'lateral raise': 'Махи в сторони',
  'cable lateral raise': 'Відведення руки в кросовері',

  // Legs & Glutes
  'barbell back squat': 'Присідання зі штангою',
  'barbell squat': 'Присідання зі штангою',
  'squat': 'Присідання зі штангою',
  'squats': 'Присідання',
  'goblet squat': 'Кубкові присідання (Goblet)',
  'bodyweight squats': 'Присідання з власною вагою',
  'romanian deadlift': 'Румунська тяга',
  'deadlift': 'Станова тяга',
  'dumbbell romanian deadlift': 'Румунська тяга з гантелями',
  'leg press': 'Жим ногами в тренажері',
  'bulgarian split squat': 'Болгарські випади',
  'leg extension': 'Розгинання ніг у тренажері',
  'lying leg curl': 'Згинання ніг лежачи',
  'leg curl': 'Згинання ніг у тренажері',
  'glute bridge': 'Сідничний місток',
  'walking lunges': 'Крокуючі випади',
  'barbell lunges': 'Випади зі штангою',
  'reverse lunges': 'Зворотні випади',
  'lunges': 'Випади',
  'dumbbell step-up': 'Зашагування на тумбу',
  'step-ups': 'Зашагування на платформу',

  // Arms
  'barbell biceps curl': 'Підйом штанги на біцепс',
  'barbell curl': 'Підйом штанги на біцепс',
  'incline dumbbell curl': 'Згинання гантелей на похилій лаві',
  'hammer curl': 'Молотки (Hammer Curls)',
  'biceps curl': 'Згинання рук на біцепс',
  'dumbbell curl': 'Згинання гантелей на біцепс',
  'cable curl': 'Згинання на біцепс у кросовері',
  'triceps cable pushdown': 'Розгинання на трицепс у блоці',
  'triceps pushdown': 'Розгинання на трицепс у блоці',
  'overhead triceps extension': 'Французький жим гантелі стоячи',
  'dumbbell overhead extension': 'Французький жим гантелі стоячи',
  'close-grip bench press': 'Жим вузьким хватом',
  'ez-bar skull crushers': 'Французький жим (Skull Crushers)',
  'skull crushers': 'Французький жим (Skull Crushers)',

  // Calves & Core
  'standing calf raise': 'Підйоми на носки стоячи',
  'dumbbell calf raise': 'Підйоми на носки з гантелями',
  'calf raise': 'Підйоми на носки',
  'hanging knee raise': 'Підйом колін у висі',
  'cable kneeling crunch': 'Скручування в кросовері',
  'cable crunch': 'Скручування в блоці на прес',
  'weighted plank': 'Планка з обтяженням',
  'plank': 'Планка',
};

export function translateExercise(name?: string, lang: AppLanguage = 'en'): string {
  if (!name) return '';
  if (lang !== 'uk') return name;

  const clean = name.trim();
  const lower = clean.toLowerCase();

  if (UKRAINIAN_EXERCISES[lower]) {
    return UKRAINIAN_EXERCISES[lower];
  }

  for (const [key, translated] of Object.entries(UKRAINIAN_EXERCISES)) {
    if (lower.includes(key)) {
      return translated;
    }
  }

  return name;
}

const UKRAINIAN_WORKOUTS: Record<string, string> = {
  'full body a': 'Фулбоді A',
  'full body b': 'Фулбоді B',
  'full body c': 'Фулбоді C',
  'full body': 'Фулбоді',
  'upper a': 'Верх тіла A',
  'lower a': 'Низ тіла A',
  'upper b': 'Верх тіла B',
  'lower b': 'Низ тіла B',
  'upper': 'Верх тіла',
  'lower': 'Низ тіла',
  'push': 'Штовхай (Push)',
  'pull': 'Тягни (Pull)',
  'legs': 'Ноги (Legs)',
  'push 1': 'Штовхай 1',
  'pull 1': 'Тягни 1',
  'legs 1': 'Ноги 1',
  'push 2': 'Штовхай 2',
  'pull 2': 'Тягни 2',
  'legs 2': 'Ноги 2',
  'chest & triceps': 'Груди та трицепс',
  'back & biceps': 'Спина та біцепс',
  'legs & shoulders': 'Ноги та плечі',
  'arms & core': 'Руки та прес',
  'full body conditioning': 'Фулбоді кондиція',
  'custom routine': 'Власна програма',
  'custom workout': 'Власне тренування',
  'rest day': 'День відпочинку',
};

export function translateWorkoutName(name?: string, lang: AppLanguage = 'en'): string {
  if (!name) return '';
  if (lang !== 'uk') return name;

  const lower = name.trim().toLowerCase();
  if (UKRAINIAN_WORKOUTS[lower]) {
    return UKRAINIAN_WORKOUTS[lower];
  }
  for (const [key, translated] of Object.entries(UKRAINIAN_WORKOUTS)) {
    if (lower.includes(key)) {
      return translated;
    }
  }
  return name;
}

export function useI18n() {
  const language = useUserProfileStore((state) => state.profile.language) ?? 'en';
  const t = (key: TranslationKey): string => getTranslation(key, language);
  const tm = (muscle: string): string => translateMuscle(muscle, language);
  const td = (day?: string): string => formatDayLabel(day, language);
  const te = (exercise?: string): string => translateExercise(exercise, language);
  const tw = (workout?: string): string => translateWorkoutName(workout, language);
  return { t, tm, td, te, tw, language };
}

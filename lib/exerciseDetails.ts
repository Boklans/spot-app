export interface ExerciseDetailInfo {
  primaryMusclesUk: string;
  primaryMusclesEn: string;
  secondaryMusclesUk: string;
  secondaryMusclesEn: string;
  setupUk: string;
  setupEn: string;
  executionUk: string;
  executionEn: string;
  tipsUk: string;
  tipsEn: string;
  mistakesUk: string;
  mistakesEn: string;
}

const DETAILS_MAP: Record<string, ExerciseDetailInfo> = {
  // --- CHEST ---
  'bench press': {
    primaryMusclesUk: 'Груди (велика грудна)',
    primaryMusclesEn: 'Chest (Pectoralis Major)',
    secondaryMusclesUk: 'Передні дельти, трицепс',
    secondaryMusclesEn: 'Anterior Deltoids, Triceps',
    setupUk: 'Ляжте на лаву, зведіть лопатки, стопи міцно впираються в підлогу. Хват трохи ширший за плечі.',
    setupEn: 'Lie flat, retract shoulder blades, drive feet into the floor. Grip barbell slightly wider than shoulder-width.',
    executionUk: 'Плавно опустіть гриф на середину грудей під контролем, зберігаючи кут у ліктях близько 75°.',
    executionEn: 'Lower bar under control to mid-chest, keeping elbows tucked at roughly 75 degrees.',
    tipsUk: 'Потужно вичавте штангу вгору за рахунок скорочення грудних м’язів, не розмикаючи лопаток.',
    tipsEn: 'Drive the bar upward by squeezing your pecs, keeping your upper back pinned to the bench.',
    mistakesUk: 'Не відривайте таз від лави та уникайте розведення ліктів під кутом 90° до корпусу.',
    mistakesEn: 'Avoid flaring elbows to 90 degrees or lifting hips off the bench during the press.',
  },
  'incline dumbbell press': {
    primaryMusclesUk: 'Верхня частина грудей (ключична головка)',
    primaryMusclesEn: 'Upper Chest (Clavicular Head)',
    secondaryMusclesUk: 'Передні дельти, трицепс',
    secondaryMusclesEn: 'Anterior Deltoids, Triceps',
    setupUk: 'Встановіть лаву під кутом 30-45°. Візьміть гантелі, впирайтеся ногами в підлогу, зведіть лопатки.',
    setupEn: 'Set bench to 30-45 degrees. Lift dumbbells to shoulders, retract shoulder blades, plant feet firmly.',
    executionUk: 'Опускайте гантелі по боках грудей до відчуття глибокого розтягнення верхньої частини грудних.',
    executionEn: 'Lower dumbbells toward upper chest until you feel a deep stretch in the upper pecs.',
    tipsUk: 'Тисніть вгору по дузі, зближуючи гантелі у верхній точці без торкання.',
    tipsEn: 'Press upward in a slight converging arc, squeezing pecs at the top without banging weights.',
    mistakesUk: 'Не виставляйте кут нахилу лави вище 45°, щоб навантаження не перейшло повністю на плечі.',
    mistakesEn: 'Do not set incline above 45 degrees, which shifts excessive load onto front deltoids.',
  },
  'dumbbell bench press': {
    primaryMusclesUk: 'Груди (велика грудна)',
    primaryMusclesEn: 'Chest (Pectoralis Major)',
    secondaryMusclesUk: 'Передні дельти, трицепс',
    secondaryMusclesEn: 'Anterior Deltoids, Triceps',
    setupUk: 'Ляжте на горизонтальну лаву з гантелями на рівні грудей, лопатки зведені, поперек у природному прогині.',
    setupEn: 'Lie flat with dumbbells at chest level, shoulder blades retracted, natural arch in lower back.',
    executionUk: 'Опускайте гантелі глибоко для максимальної амплітуди, контролюючи рух у кожному сантиметрі.',
    executionEn: 'Lower dumbbells with control to maximize range of motion and stretch at the bottom.',
    tipsUk: 'Вичавлюйте гантелі вгору, фокусуючись на скороченні грудей у верхній точці.',
    tipsEn: 'Press straight up, focusing on contracting the chest muscles forcefully at the top.',
    mistakesUk: 'Не скидайте гантелі вниз занадто різко у нижній фазі амплітуди.',
    mistakesEn: 'Avoid dropping dumbbells rapidly at the bottom turnaround to protect rotator cuffs.',
  },
  'cable chest fly': {
    primaryMusclesUk: 'Груди (ізоляція та зведення)',
    primaryMusclesEn: 'Chest (Sternal Head Isolation)',
    secondaryMusclesUk: 'Передні дельти',
    secondaryMusclesEn: 'Anterior Deltoids',
    setupUk: 'Встановіть блоки на рівні плечей або вище, зробіть крок вперед для стабільного балансу.',
    setupEn: 'Set pulleys at chest or shoulder height, take a step forward with staggered stance for balance.',
    executionUk: 'Злегка зігніть лікті і зведіть рукояті перед собою по широкій дузі, фокусуючись на піковому скороченні.',
    executionEn: 'With a slight bend in elbows, bring handles together in a wide hugging motion, squeezing hard.',
    tipsUk: 'Уявляйте, ніби ви обіймаєте велике дерево, зберігаючи фіксований кут у ліктях.',
    tipsEn: 'Imagine hugging a large barrel to keep your elbow bend constant throughout the movement.',
    mistakesUk: 'Не згинайте та не випрямляйте руки під час руху — це ізоляційна вправа, а не жим.',
    mistakesEn: 'Do not turn the fly into a press by excessively bending and extending your elbows.',
  },
  'push-up': {
    primaryMusclesUk: 'Груди, кор',
    primaryMusclesEn: 'Chest, Core',
    secondaryMusclesUk: 'Трицепс, передні дельти',
    secondaryMusclesEn: 'Triceps, Anterior Deltoids',
    setupUk: 'Планка на прямих руках, кисті під плечима або трохи ширше, тіло утворює пряму лінію від п’ят до верхівки.',
    setupEn: 'High plank position, hands slightly outside shoulder width, body forming a straight line from heels to head.',
    executionUk: 'Опускайтеся вниз до торкання грудьми підлоги, тримаючи лікті під кутом приблизно 45°.',
    executionEn: 'Lower your chest toward the floor with elbows tracking back at approximately 45 degrees.',
    tipsUk: 'Тримайте сідниці та прес напруженими протягом усього підходу.',
    tipsEn: 'Keep glutes and core fully braced to prevent hip sagging or excessive spinal arching.',
    mistakesUk: 'Не прогинайте поперек і не задирайте голову вгору.',
    mistakesEn: 'Avoid sagging hips or looking up, keep neck neutral throughout each repetition.',
  },
  'chest dips': {
    primaryMusclesUk: 'Нижня частина грудей, трицепс',
    primaryMusclesEn: 'Lower Chest, Triceps',
    secondaryMusclesUk: 'Передні дельти',
    secondaryMusclesEn: 'Anterior Deltoids',
    setupUk: 'Зафіксуйтеся на брусах, нахиліть корпус трохи вперед і підігніть коліна.',
    setupEn: 'Mount parallel bars, lean torso forward roughly 15-20 degrees, bend knees slightly.',
    executionUk: 'Опускайтеся, розводячи лікті трохи в сторони, до кута 90° у ліктях.',
    executionEn: 'Lower yourself under control until elbows reach approximately 90 degrees.',
    tipsUk: 'Нахил корпусу вперед зміщує навантаження на груди; вертикальний корпус — на трицепс.',
    tipsEn: 'Leaning forward engages chest pecs; staying upright shifts load more onto triceps.',
    mistakesUk: 'Не опускайтеся надто глибоко при дискомфорті в плечах, не робіть ривків.',
    mistakesEn: 'Do not dive excessively low if you feel anterior shoulder impingement.',
  },

  // --- BACK ---
  'deadlift': {
    primaryMusclesUk: 'Спина, сідниці, біцепс стегна',
    primaryMusclesEn: 'Lower Back, Glutes, Hamstrings',
    secondaryMusclesUk: 'Найширші, трапеції, передпліччя',
    secondaryMusclesEn: 'Lats, Trapezius, Forearms',
    setupUk: 'Стопи на ширині тазу, гриф над серединою стопи, хват трохи ширший за стегна. Спина рівна, лопатки над грифом.',
    setupEn: 'Feet hip-width, bar over mid-foot, grip just outside shins. Keep neutral spine with shoulders slightly in front of bar.',
    executionUk: 'Штовхайте підлогу ногами, піднімаючи штангу впритул до гомілок, одночасно розгинаючи коліна і таз.',
    executionEn: 'Push the floor away through mid-foot, keeping bar close to legs until full hip and knee extension.',
    tipsUk: 'Тягніть ногами, а не спиною. Напружте найширші м’язи, ніби захищаєте пахви.',
    tipsEn: 'Engage lats by pulling shoulder blades down before breaking the floor. Drive with legs first.',
    mistakesUk: 'Ніколи не округлюйте поперек і не перерозгинайтеся назад у верхній точці.',
    mistakesEn: 'Never round lower back, and avoid hyperextending backward at the top lockout.',
  },
  'barbell row': {
    primaryMusclesUk: 'Найширші м’язи спини, ромбоподібні',
    primaryMusclesEn: 'Latissimus Dorsi, Rhomboids',
    secondaryMusclesUk: 'Біцепс, задня дельта, розгиначі спини',
    secondaryMusclesEn: 'Biceps, Rear Deltoids, Erector Spinae',
    setupUk: 'Нахиліть корпус під кутом 45°, коліна злегка зігнуті, спина рівна, хват трохи ширший за плечі.',
    setupEn: 'Hinge hips back at 45 degrees, soft knees, neutral spine, grip slightly outside shoulder width.',
    executionUk: 'Тягніть штангу до низу живота, скеровуючи лікті назад і зводячи лопатки.',
    executionEn: 'Pull bar toward lower abdomen/belly button, driving elbows back and squeezing shoulder blades.',
    tipsUk: 'Тягніть ліктями, а не кистями, щоб максимізувати роботу спини.',
    tipsEn: 'Think of hands as hooks and pull with your elbows to isolate back muscles over biceps.',
    mistakesUk: 'Не допомагайте корпусом за рахунок ривків (чітингу) та не округлюйте верх спини.',
    mistakesEn: 'Avoid excessive torso swinging or rounding upper back under heavy weight.',
  },
  'lat pulldown': {
    primaryMusclesUk: 'Найширші м’язи спини',
    primaryMusclesEn: 'Latissimus Dorsi',
    secondaryMusclesUk: 'Біцепс, середня частина спини',
    secondaryMusclesEn: 'Biceps, Mid-Back',
    setupUk: 'Сядьте в тренажер, зафіксуйте стегна валиками, візьміть рукоять ширше за плечі.',
    setupEn: 'Sit tall, secure thighs under pads, grip bar wider than shoulder-width with overhand grip.',
    executionUk: 'Тягніть рукоять до верхньої частини грудей, відводячи плечі вниз і назад.',
    executionEn: 'Pull bar down toward upper chest, driving elbows downward and pulling shoulders down.',
    tipsUk: 'Зробіть коротку паузу в нижній точці для максимального скорочення найширших.',
    tipsEn: 'Hold for a brief pause at the bottom to maximize peak lat contraction.',
    mistakesUk: 'Не відхиляйтеся назад більше ніж на 15° і не тягніть штангу за голову.',
    mistakesEn: 'Do not lean back excessively or pull behind the neck, which strains cervical spine.',
  },
  'pull-up': {
    primaryMusclesUk: 'Найширші м’язи, спина',
    primaryMusclesEn: 'Lats, Upper Back',
    secondaryMusclesUk: 'Біцепс, передпліччя, кор',
    secondaryMusclesEn: 'Biceps, Forearms, Core',
    setupUk: 'Повисність на перекладині повним хватом, руки на ширині або трохи ширше за плечі.',
    setupEn: 'Hang from pull-up bar with overhand grip, slightly wider than shoulder width, body engaged.',
    executionUk: 'Підтягуйтеся грудьми до перекладини за рахунок руху ліктів вниз до боків.',
    executionEn: 'Pull yourself up toward the bar by driving elbows down to your ribs until chin clears bar.',
    tipsUk: 'Почніть рух з опускання лопаток, а не зі згинання рук.',
    tipsEn: 'Initiate by depressing scapulae down before bending your arms.',
    mistakesUk: 'Уникайте розгойдування та ривків ногами (кіпінгу) для чистої сили.',
    mistakesEn: 'Avoid swinging legs or kicking (kipping) to ensure strict muscle recruitment.',
  },
  'seated cable row': {
    primaryMusclesUk: 'Середня частина спини, ромбоподібні, найширші',
    primaryMusclesEn: 'Mid-Back, Rhomboids, Lats',
    secondaryMusclesUk: 'Біцепс, задня дельта',
    secondaryMusclesEn: 'Biceps, Rear Deltoids',
    setupUk: 'Сядьте, впріться ногами в упори з м’якими колінами, візьміть рукоять, випряміть спину.',
    setupEn: 'Sit upright, plant feet with slight knee bend, grip handle with straight spine and braced core.',
    executionUk: 'Тягніть рукоять до пупка, скеровуючи лікті назад і зводячи лопатки разом.',
    executionEn: 'Pull handle toward lower ribcage, driving elbows back and pinching shoulder blades tightly.',
    tipsUk: 'Не рухайте корпусом вперед-назад; нехай працюють лише плечі та спина.',
    tipsEn: 'Maintain an upright torso; avoid excessive back-and-forth rocking.',
    mistakesUk: 'Не округлюйте спину під час повернення ваги у вихідне положення.',
    mistakesEn: 'Do not let your back round during the eccentric return phase.',
  },

  // --- LEGS ---
  'squat': {
    primaryMusclesUk: 'Квадрицепси, сідниці',
    primaryMusclesEn: 'Quadriceps, Glutes',
    secondaryMusclesUk: 'Біцепс стегна, розгиначі спини, кор',
    secondaryMusclesEn: 'Hamstrings, Lower Back, Core',
    setupUk: 'Штанга на трапеціях, стопи на ширині плечей або трохи ширше, носки злегка розведені.',
    setupEn: 'Rest bar on upper traps, feet shoulder-width or slightly wider, toes turned out roughly 20 degrees.',
    executionUk: 'Опускайтеся, відводячи таз назад і розводячи коліна в бік носків до паралелі або нижче.',
    executionEn: 'Sit back and down, driving knees outward in line with toes until hips reach parallel or below.',
    tipsUk: 'Тримайте груди піднятими, а вагу рівномірно розподіленою по всій стопі.',
    tipsEn: 'Keep chest upright, core tightly braced, and pressure evenly distributed across whole foot.',
    mistakesUk: 'Не допускайте завалювання колін всередину та відриву п’ят від підлоги.',
    mistakesEn: 'Do not let knees cave inward or heels lift off the ground during the ascent.',
  },
  'leg press': {
    primaryMusclesUk: 'Квадрицепси, сідниці',
    primaryMusclesEn: 'Quadriceps, Glutes',
    secondaryMusclesUk: 'Біцепс стегна',
    secondaryMusclesEn: 'Hamstrings',
    setupUk: 'Сядьте в тренажер, притисніть поперек до спинки, стопи на платформі на ширині плечей.',
    setupEn: 'Sit firmly against backrest, place feet shoulder-width apart in middle of platform.',
    executionUk: 'Плавно згинайте коліна, опускаючи платформу до кута 90°, не відриваючи куприк від сидіння.',
    executionEn: 'Lower platform smoothly until knees are bent 90 degrees without letting tailbone lift off pad.',
    tipsUk: 'Витискайте платформу п’ятами, залишаючи коліна злегка м’якими у верхній точці.',
    tipsEn: 'Drive platform back up through midfoot and heels, keeping knees soft at the top.',
    mistakesUk: 'Ніколи не випрямляйте коліна до упору (локауту) під навантаженням.',
    mistakesEn: 'Never lock out your knees forcefully at the top of the press.',
  },
  'romanian deadlift': {
    primaryMusclesUk: 'Біцепс стегна, сідниці',
    primaryMusclesEn: 'Hamstrings, Glutes',
    secondaryMusclesUk: 'Поперек, розгиначі спини',
    secondaryMusclesEn: 'Lower Back, Spinal Erectors',
    setupUk: 'Стопи на ширині тазу, гриф або гантелі у руках, плечі розправлені, коліна злегка зігнуті.',
    setupEn: 'Stand hip-width, hold barbell or dumbbells against thighs, soft knees, shoulders back.',
    executionUk: 'Відводьте таз далеко назад, ковзаючи вагою вздовж стегон до середини гомілки.',
    executionEn: 'Push hips backward while sliding weights down thighs until you feel a deep hamstring stretch.',
    tipsUk: 'Рух відбувається тільки за рахунок тазостегнового суглоба (hip hinge), коліна зафіксовані.',
    tipsEn: 'Movement is a pure hip hinge; maintain the same slight knee bend throughout.',
    mistakesUk: 'Не присідайте вниз і не округлюйте спину — це розтяжка біцепса стегна, а не присідання.',
    mistakesEn: 'Do not squat down or round upper back; keep tension focused strictly on hamstrings.',
  },

  // --- SHOULDERS ---
  'overhead press': {
    primaryMusclesUk: 'Передні та середні дельти',
    primaryMusclesEn: 'Anterior & Lateral Deltoids',
    secondaryMusclesUk: 'Трицепс, верх грудей, трапеції, кор',
    secondaryMusclesEn: 'Triceps, Upper Chest, Trapezius, Core',
    setupUk: 'Стоячи, стопи на ширині плечей, штанга на верхній частині грудей, хват трохи ширший за плечі.',
    setupEn: 'Stand hip-to-shoulder width, bar resting across clavicles, elbows forward, core tight.',
    executionUk: 'Вичавлюйте штангу строго вертикально вгору, злегка відвівши голову назад у початковій фазі.',
    executionEn: 'Press bar vertically overhead, tilting head slightly back until bar clears forehead, then lock out.',
    tipsUk: 'Напружуйте сідниці та прес, щоб створити міцний стовп стабільності.',
    tipsEn: 'Squeeze glutes and brace abs hard to prevent lumbar hyperextension.',
    mistakesUk: 'Не прогинайте поперек назад для полегшення підйому ваги.',
    mistakesEn: 'Avoid leaning backward excessively to turn the lift into an incline bench press.',
  },
  'lateral raise': {
    primaryMusclesUk: 'Середня дельта (ширина плечей)',
    primaryMusclesEn: 'Lateral Deltoids (Shoulder Width)',
    secondaryMusclesUk: 'Трапеції',
    secondaryMusclesEn: 'Trapezius',
    setupUk: 'Стоячи або сидячи, гантелі по боках, лікті злегка зігнуті, корпус трохи нахилений вперед.',
    setupEn: 'Stand or sit with dumbbells at sides, slight elbow bend, torso leaning forward 5 degrees.',
    executionUk: 'Піднімайте руки через сторони ліктями вгору до рівня плечей.',
    executionEn: 'Raise arms out to the sides leading with elbows until dumbbells reach shoulder height.',
    tipsUk: 'Уявляйте, що виливаєте воду з глечиків у верхній точці для максимального фокусу на середній дельті.',
    tipsEn: 'Lead with elbows rather than hands to ensure mid-delt activation over traps.',
    mistakesUk: 'Не використовуйте ривки корпусом і не піднімайте гантелі вище рівня плечей.',
    mistakesEn: 'Do not swing hips or shrug shoulders upward to throw the weight up.',
  },

  // --- ARMS ---
  'bicep curl': {
    primaryMusclesUk: 'Двоголовий м’яз плеча (біцепс)',
    primaryMusclesEn: 'Biceps Brachii',
    secondaryMusclesUk: 'Брахіаліс, передпліччя',
    secondaryMusclesEn: 'Brachialis, Forearms',
    setupUk: 'Стоячи або сидячи, гантелі в руках, лікті притиснуті до боків корпусу.',
    setupEn: 'Stand tall with dumbbells, elbows pinned closely to your sides, chest up.',
    executionUk: 'Згинайте руки в ліктях, супінуючи кисті (розвертаючи долоні догори) під час підйому.',
    executionEn: 'Curl weights upward, supinating palms toward ceiling at mid-point, squeezing biceps at top.',
    tipsUk: 'Утримуйте лікті нерухомими на одній лінії з корпусом протягом усього руху.',
    tipsEn: 'Keep elbows completely stationary; do not swing them forward during the curl.',
    mistakesUk: 'Не розгойдуйте корпус назад для полегшення підйому.',
    mistakesEn: 'Do not rock your hips or swing back to initiate the rep.',
  },
  'triceps pushdown': {
    primaryMusclesUk: 'Трицепс (триголовий м’яз плеча)',
    primaryMusclesEn: 'Triceps Brachii (All Heads)',
    secondaryMusclesUk: 'Передпліччя',
    secondaryMusclesEn: 'Forearms',
    setupUk: 'Встаньте перед верхнім блоком, візьміть канат або пряму рукоять, притисніть лікті до боків.',
    setupEn: 'Stand before high pulley, grip rope or straight bar, pin upper arms and elbows firmly to sides.',
    executionUk: 'Розгинайте руки вниз, розводячи кінці каната в сторони в нижній точці для пікового скорочення.',
    executionEn: 'Extend forearms downward until arms are straight, spreading rope ends apart at the bottom.',
    tipsUk: 'Затримайтеся на півсекунди внизу з максимально розігнутими ліктями.',
    tipsEn: 'Hold the lockout for half a second to maximize peak tricep contraction.',
    mistakesUk: 'Не дозволяйте ліктям рухатися вперед або назад під час підходу.',
    mistakesEn: 'Do not let your elbows drift forward or flare out away from your ribs.',
  },
};

/**
 * Intelligent helper to resolve exercise details with graceful fallback
 */
export function getExerciseDetails(exerciseName: string, muscleGroup?: string): ExerciseDetailInfo {
  const normalized = exerciseName.trim().toLowerCase();

  for (const [key, details] of Object.entries(DETAILS_MAP)) {
    if (normalized.includes(key)) {
      return details;
    }
  }

  // Graceful fallback for custom exercises or less common exercises based on muscleGroup
  const mg = (muscleGroup || '').toLowerCase();

  if (mg.includes('chest') || mg.includes('груд')) {
    return {
      primaryMusclesUk: 'Груди (велика та мала грудні)',
      primaryMusclesEn: 'Chest (Pectorals)',
      secondaryMusclesUk: 'Трицепс, передні дельти',
      secondaryMusclesEn: 'Triceps, Front Delts',
      setupUk: 'Займіть стабільне положення, зведіть лопатки, напружте кор.',
      setupEn: 'Set a stable foundation, retract shoulder blades, brace core.',
      executionUk: 'Виконуйте рух плавно під контролем, зберігаючи напругу в грудних м’язах.',
      executionEn: 'Perform movement with control, keeping continuous tension on target pecs.',
      tipsUk: 'Фокусуйтеся на скороченні грудей у фазі зусилля.',
      tipsEn: 'Focus on contracting chest muscles at the peak of the movement.',
      mistakesUk: 'Уникайте різких ривків та не відривайте плечі від опори.',
      mistakesEn: 'Avoid jerking weights or losing scapular stability.',
    };
  }

  if (mg.includes('back') || mg.includes('спин')) {
    return {
      primaryMusclesUk: 'Найширші м’язи, середина спини',
      primaryMusclesEn: 'Latissimus Dorsi, Mid-Back',
      secondaryMusclesUk: 'Біцепс, задня дельта, передпліччя',
      secondaryMusclesEn: 'Biceps, Rear Delts, Forearms',
      setupUk: 'Зафіксуйте поперек у нейтральному положенні, розправте плечі.',
      setupEn: 'Set spine in neutral alignment, engage lats, secure base.',
      executionUk: 'Тягніть вагу зусиллям ліктів назад, зводячи лопатки разом.',
      executionEn: 'Pull weight by driving elbows back and retracting shoulder blades.',
      tipsUk: 'Тягніть спиною, а не руками; уявляйте лікті головною точкою тяги.',
      tipsEn: 'Drive movement with elbows to maximize back recruitment over arms.',
      mistakesUk: 'Не округлюйте спину та не робіть ривків корпусом.',
      mistakesEn: 'Do not round spine or use excessive torso swing.',
    };
  }

  if (mg.includes('leg') || mg.includes('ніг') || mg.includes('quad') || mg.includes('hamstring')) {
    return {
      primaryMusclesUk: 'Квадрицепси, сідниці, біцепс стегна',
      primaryMusclesEn: 'Quadriceps, Glutes, Hamstrings',
      secondaryMusclesUk: 'Литкові, розгиначі спини, кор',
      secondaryMusclesEn: 'Calves, Spinal Erectors, Core',
      setupUk: 'Стопи надійно впираються в підлогу або платформу, спина рівна, кор напружений.',
      setupEn: 'Plant feet securely, brace core, align knees with toes.',
      executionUk: 'Виконуйте плавний рух по повній комфортній амплітуді.',
      executionEn: 'Lower under control through full active range of motion.',
      tipsUk: 'Тисніть через усю площу стопи, утримуючи коліна на одній лінії з носками.',
      tipsEn: 'Drive through whole foot, ensuring knees track over toes.',
      mistakesUk: 'Не зводьте коліна всередину і не відривайте п’яти.',
      mistakesEn: 'Avoid knees caving inward or heels leaving platform/floor.',
    };
  }

  if (mg.includes('shoulder') || mg.includes('плеч') || mg.includes('delt')) {
    return {
      primaryMusclesUk: 'Дельтоподібні м’язи (плечі)',
      primaryMusclesEn: 'Deltoids (Shoulders)',
      secondaryMusclesUk: 'Трапеції, трицепс',
      secondaryMusclesEn: 'Trapezius, Triceps',
      setupUk: 'Стійка міцна, прес та сідниці напружені для стабільності хребта.',
      setupEn: 'Solid athletic stance, brace core and glutes for spinal support.',
      executionUk: 'Піднімайте вагу під контролем, зберігаючи напругу в плечах.',
      executionEn: 'Move weights under control, keeping tension on shoulder caps.',
      tipsUk: 'Слідкуйте, щоб трапеції не перебирали навантаження з плечей.',
      tipsEn: 'Keep shoulders depressed to avoid excessive upper trap shrugging.',
      mistakesUk: 'Не допомагайте собі розгойдуванням корпусу.',
      mistakesEn: 'Avoid hip swinging or momentum to initiate the lift.',
    };
  }

  if (mg.includes('arm') || mg.includes('рук') || mg.includes('bicep') || mg.includes('tricep')) {
    return {
      primaryMusclesUk: 'М’язи рук (біцепс / трицепс)',
      primaryMusclesEn: 'Arms (Biceps / Triceps)',
      secondaryMusclesUk: 'Передпліччя',
      secondaryMusclesEn: 'Forearms',
      setupUk: 'Зафіксуйте лікті в стабільному положенні поруч із корпусом.',
      setupEn: 'Pin elbows securely in place relative to your torso.',
      executionUk: 'Працюйте в чистій амплітуді без розгойдування ліктів вперед чи назад.',
      executionEn: 'Move through complete flexion/extension without shifting elbows.',
      tipsUk: 'Зосередьтеся на піковому скороченні в кінці кожного повторення.',
      tipsEn: 'Pause for a microsecond at peak contraction on every rep.',
      mistakesUk: 'Не використовуйте інерцію тіла для підкидання ваги.',
      mistakesEn: 'Avoid torso momentum or swinging.',
    };
  }

  // Generic core / general fitness
  return {
    primaryMusclesUk: 'Цільова група м’язів',
    primaryMusclesEn: 'Target Muscle Group',
    secondaryMusclesUk: 'М’язи-стабілізатори, кор',
    secondaryMusclesEn: 'Stabilizers, Core',
    setupUk: 'Займіть вихідне положення, перевірте стійкість та напружте кор.',
    setupEn: 'Set an athletic base, check your alignment, brace core.',
    executionUk: 'Виконуйте рух плавно та підконтрольно з акцентом на відчуття м’язів.',
    executionEn: 'Perform repetitions with control, focusing on muscle tension.',
    tipsUk: 'Контролюйте як позитивну, так і негативну фазу кожного повторення.',
    tipsEn: 'Control both the eccentric lowering and concentric lifting phases.',
    mistakesUk: 'Не робіть різких рухів без належної розминки.',
    mistakesEn: 'Avoid ballistic or jerky movements under load.',
  };
}

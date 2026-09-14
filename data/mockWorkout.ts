export type Exercise = { name: string; muscle: string; sets: number; weight: string; target: string };

export const exercises: Exercise[] = [
  { name: 'Bench Press', muscle: 'Chest', sets: 3, weight: '72.5 kg', target: '6–8 reps' },
  { name: 'Incline Dumbbell Press', muscle: 'Chest', sets: 3, weight: '24 kg', target: '8–10 reps' },
  { name: 'Barbell Row', muscle: 'Back', sets: 3, weight: '70 kg', target: '6–8 reps' },
  { name: 'Lat Pulldown', muscle: 'Back', sets: 3, weight: '65 kg', target: '8–10 reps' },
  { name: 'Shoulder Press', muscle: 'Shoulders', sets: 3, weight: '45 kg', target: '8–10 reps' },
  { name: 'Triceps Pushdown', muscle: 'Arms', sets: 3, weight: '55 kg', target: '10–12 reps' },
  { name: 'Biceps Curl', muscle: 'Arms', sets: 3, weight: '12 kg', target: '10–12 reps' },
];

export const currentWorkout = { name: 'Upper A', focus: 'Chest • Back • Arms', duration: '~55 min', exerciseCount: 7 };

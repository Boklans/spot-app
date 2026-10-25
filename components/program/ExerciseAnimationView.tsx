import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors } from '@/constants/colors';
import { hapticLight } from '@/lib/haptics';

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'horizontal_press'
  | 'vertical_press'
  | 'vertical_pull'
  | 'horizontal_pull'
  | 'knee_isolation'
  | 'arm_curl'
  | 'tricep_extension'
  | 'core';

export function inferMovementPattern(exerciseName: string, muscleGroup?: string): MovementPattern {
  const n = (exerciseName || '').toLowerCase();
  const m = (muscleGroup || '').toLowerCase();

  if (
    n.includes('romanian') ||
    n.includes('rdl') ||
    n.includes('deadlift') ||
    n.includes('hip thrust') ||
    n.includes('glute bridge') ||
    n.includes('hyperextension') ||
    n.includes('back extension') ||
    n.includes('good morning') ||
    n.includes('румунськ') ||
    n.includes('становая') ||
    n.includes('станова') ||
    n.includes('сідничн')
  ) {
    return 'hinge';
  }

  if (
    n.includes('leg extension') ||
    n.includes('leg curl') ||
    n.includes('hamstring curl') ||
    n.includes('calf') ||
    n.includes('розгинання ніг') ||
    n.includes('згинання ніг') ||
    n.includes('литки')
  ) {
    return 'knee_isolation';
  }

  if (
    n.includes('squat') ||
    n.includes('lunge') ||
    n.includes('split squat') ||
    n.includes('leg press') ||
    n.includes('step-up') ||
    n.includes('присідання') ||
    n.includes('випад') ||
    n.includes('жим ногами') ||
    m === 'quads' ||
    m === 'legs'
  ) {
    return 'squat';
  }

  if (
    n.includes('pulldown') ||
    n.includes('pull-up') ||
    n.includes('pull up') ||
    n.includes('chin-up') ||
    n.includes('chin up') ||
    n.includes('assisted pull') ||
    n.includes('gravitron') ||
    n.includes('верхнього блоку') ||
    n.includes('підтягування')
  ) {
    return 'vertical_pull';
  }

  if (
    n.includes('row') ||
    n.includes('face pull') ||
    n.includes('reverse fly') ||
    n.includes('rear delt') ||
    n.includes('тяга') ||
    m === 'back'
  ) {
    return 'horizontal_pull';
  }

  if (
    n.includes('overhead') ||
    n.includes('shoulder press') ||
    n.includes('military') ||
    n.includes('arnold') ||
    n.includes('lateral raise') ||
    n.includes('front raise') ||
    n.includes('upright row') ||
    n.includes('жим стоячи') ||
    n.includes('жим гантелей сидячи') ||
    n.includes('махи') ||
    m === 'shoulders'
  ) {
    return 'vertical_press';
  }

  if (
    n.includes('tricep') ||
    n.includes('pushdown') ||
    n.includes('skullcrusher') ||
    n.includes('extension') ||
    n.includes('dip') ||
    n.includes('трицепс') ||
    n.includes('брусах') ||
    m === 'triceps'
  ) {
    return 'tricep_extension';
  }

  if (
    n.includes('curl') ||
    n.includes('bicep') ||
    n.includes('hammer') ||
    n.includes('біцепс') ||
    n.includes('молотки') ||
    m === 'biceps' ||
    m === 'arms'
  ) {
    return 'arm_curl';
  }

  if (
    n.includes('plank') ||
    n.includes('crunch') ||
    n.includes('leg raise') ||
    n.includes('knee raise') ||
    n.includes('ab ') ||
    n.includes('планка') ||
    n.includes('скручування') ||
    m === 'core' ||
    m === 'abs'
  ) {
    return 'core';
  }

  return 'horizontal_press';
}

interface ExerciseAnimationViewProps {
  exerciseName: string;
  muscleGroup?: string;
  selectedPhase: 1 | 2 | 3;
  onSelectPhase: (phase: 1 | 2 | 3) => void;
  isUk: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function ExerciseAnimationView({
  exerciseName,
  muscleGroup,
  selectedPhase,
  onSelectPhase,
  isUk,
}: ExerciseAnimationViewProps) {
  const pattern = useMemo(
    () => inferMovementPattern(exerciseName, muscleGroup),
    [exerciseName, muscleGroup]
  );
  const [isPlaying, setIsPlaying] = useState(true);
  // t in [0, 1]: 0 = Setup/Extended position, 1 = Peak contraction / Bottom of squat/press
  const [progress, setProgress] = useState(0);
  const [breathState, setBreathState] = useState<'setup' | 'eccentric' | 'concentric'>('setup');
  const lastPhaseRef = useRef<1 | 2 | 3>(selectedPhase);

  // Sync manual phase selection when paused
  useEffect(() => {
    if (!isPlaying) {
      if (selectedPhase === 1) setProgress(0.05);
      else if (selectedPhase === 2) setProgress(0.85);
      else setProgress(1.0);
    }
  }, [selectedPhase, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    const cycleDurationMs = 4200; // Realistic 4.2s controlled hypertrophy tempo
    const startTime = Date.now();

    const tick = () => {
      const elapsed = (Date.now() - startTime) % cycleDurationMs;
      const norm = elapsed / cycleDurationMs;

      // Cycle breakdown:
      // 0.00 - 0.15: Phase 1 (Setup hold, progress = 0)
      // 0.15 - 0.58: Phase 2 (Controlled movement / lowering or pulling, progress 0 -> 1)
      // 0.58 - 0.72: Phase 3 (Bottom/Peak pause & contraction hold, progress = 1)
      // 0.72 - 1.00: Return / Concentric drive (progress 1 -> 0)
      let p = 0;
      let nextPhase: 1 | 2 | 3 = 1;
      let nextBreath: 'setup' | 'eccentric' | 'concentric' = 'setup';

      if (norm < 0.15) {
        p = 0;
        nextPhase = 1;
        nextBreath = 'setup';
      } else if (norm < 0.58) {
        const local = (norm - 0.15) / 0.43;
        // Smooth ease-in-out
        p = 0.5 - 0.5 * Math.cos(local * Math.PI);
        nextPhase = 2;
        nextBreath = 'eccentric';
      } else if (norm < 0.74) {
        p = 1;
        nextPhase = 3;
        nextBreath = 'concentric';
      } else {
        const local = (norm - 0.74) / 0.26;
        p = 0.5 + 0.5 * Math.cos(local * Math.PI);
        nextPhase = 3;
        nextBreath = 'concentric';
      }

      setProgress(p);
      setBreathState(nextBreath);

      if (lastPhaseRef.current !== nextPhase) {
        lastPhaseRef.current = nextPhase;
        onSelectPhase(nextPhase);
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, onSelectPhase]);

  const breathCueLabel = useMemo(() => {
    const isPullOrIso =
      pattern === 'vertical_pull' ||
      pattern === 'horizontal_pull' ||
      pattern === 'knee_isolation' ||
      pattern === 'arm_curl' ||
      pattern === 'tricep_extension' ||
      pattern === 'core';

    if (breathState === 'setup') {
      return isUk ? '1. Стабільна позиція • Кор напружений' : '1. Stable Setup • Brace Core';
    }
    if (breathState === 'eccentric') {
      return isPullOrIso
        ? isUk
          ? '2. Видих на зусиллі • Плавно без ривків (1–2 с)'
          : '2. Exhale on Effort • Smooth Pull/Lift (1–2s)'
        : isUk
          ? '2. Вдих носом • Підконтрольне опускання (2–3 с)'
          : '2. Inhale • Controlled Lowering (2–3s)';
    }
    return isPullOrIso
      ? isUk
        ? '3. Пауза в піковій точці → Вдих на поверненні'
        : '3. Peak Squeeze → Controlled Return'
      : isUk
        ? '3. Видих на зусиллі • Потужний підйом (1–2 с)'
        : '3. Exhale • Drive Up to Lockout (1–2s)';
  }, [breathState, pattern, isUk]);

  const renderBiomechanicsSvg = () => {
    const t = progress;

    if (pattern === 'squat') {
      // Squat biomechanics: ankle fixed, knee moves slightly forward, hip drops down & back, bar stays over mid-foot
      const ankleX = 165;
      const ankleY = 172;
      const kneeX = lerp(168, 194, t);
      const kneeY = lerp(130, 142, t);
      const hipX = lerp(158, 132, t);
      const hipY = lerp(92, 138, t);
      const shoulderX = lerp(164, 158, t);
      const shoulderY = lerp(46, 88, t);
      const headX = shoulderX + 6;
      const headY = shoulderY - 14;

      return (
        <G>
          {/* Floor & Squat Rack */}
          <Line x1="50" y1="178" x2="270" y2="178" stroke="#263040" strokeWidth="3" strokeLinecap="round" />
          <Line x1="210" y1="25" x2="210" y2="178" stroke="#1E2633" strokeWidth="4" />

          {/* Vertical Bar Path Guide (Mid-foot alignment) */}
          <Line
            x1="162"
            y1="38"
            x2="162"
            y2="172"
            stroke="rgba(200, 255, 61, 0.35)"
            strokeWidth="2"
            strokeDasharray="4,4"
          />
          <SvgText x="72" y="46" fill="#C8FF3D" fontSize="9" fontWeight="700">
            {isUk ? 'Траєкторія штанги' : 'Vertical Bar Path'}
          </SvgText>

          {/* Depth Parallel Guide */}
          <Line
            x1="110"
            y1="140"
            x2="205"
            y2="140"
            stroke={t > 0.75 ? 'rgba(200, 255, 61, 0.5)' : 'rgba(255,255,255,0.12)'}
            strokeWidth="1.5"
            strokeDasharray="3,3"
          />
          <SvgText x="62" y="143" fill="#94A3B8" fontSize="8" fontWeight="600">
            {isUk ? 'Паралель' : 'Parallel'}
          </SvgText>

          {/* Athlete Lower Leg */}
          <Line x1={ankleX} y1={ankleY} x2={kneeX} y2={kneeY} stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
          {/* Foot */}
          <Line x1={ankleX - 6} y1={ankleY + 3} x2={ankleX + 18} y2={ankleY + 3} stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round" />

          {/* Thigh (Highlighted Primary Muscle: Quads/Glutes) */}
          <Line x1={kneeX} y1={kneeY} x2={hipX} y2={hipY} stroke="#C8FF3D" strokeWidth="9" strokeLinecap="round" />

          {/* Torso */}
          <Line x1={hipX} y1={hipY} x2={shoulderX} y2={shoulderY} stroke="#E2E8F0" strokeWidth="8" strokeLinecap="round" />

          {/* Head */}
          <Circle cx={headX} cy={headY} r="9" fill="#CBD5E1" />

          {/* Joints */}
          <Circle cx={hipX} cy={hipY} r="5" fill="#C8FF3D" />
          <Circle cx={kneeX} cy={kneeY} r="4.5" fill="#C8FF3D" />

          {/* Barbell on Traps */}
          <Circle cx={shoulderX - 2} cy={shoulderY + 2} r="13" fill="rgba(200, 255, 61, 0.2)" stroke="#C8FF3D" strokeWidth="3" />
          <Circle cx={shoulderX - 2} cy={shoulderY + 2} r="4" fill="#C8FF3D" />
        </G>
      );
    }

    if (pattern === 'hinge') {
      // Romanian Deadlift / Hinge: Shins stay nearly vertical, hips push far back, flat spine hinges
      const ankleX = 165;
      const ankleY = 172;
      const kneeX = lerp(166, 162, t);
      const kneeY = lerp(132, 135, t);
      const hipX = lerp(160, 118, t);
      const hipY = lerp(94, 104, t);
      const shoulderX = lerp(164, 178, t);
      const shoulderY = lerp(46, 92, t);
      const headX = lerp(168, 192, t);
      const headY = lerp(32, 86, t);
      const barX = lerp(168, 168, t);
      const barY = lerp(96, 142, t);

      return (
        <G>
          <Line x1="50" y1="178" x2="270" y2="178" stroke="#263040" strokeWidth="3" strokeLinecap="round" />

          {/* Hip Push-Back Arrow */}
          <Line x1="156" y1="98" x2="108" y2="98" stroke="rgba(200, 255, 61, 0.45)" strokeWidth="2" strokeDasharray="3,3" />
          <SvgText x="60" y="92" fill="#C8FF3D" fontSize="9" fontWeight="700">
            {isUk ? 'Таз назад ←' : 'Hips Back ←'}
          </SvgText>

          {/* Bar Path close to legs */}
          <Line x1="168" y1="92" x2="168" y2="148" stroke="rgba(200, 255, 61, 0.35)" strokeWidth="2" strokeDasharray="4,4" />

          {/* Shin */}
          <Line x1={ankleX} y1={ankleY} x2={kneeX} y2={kneeY} stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
          <Line x1={ankleX - 5} y1={ankleY + 3} x2={ankleX + 18} y2={ankleY + 3} stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round" />

          {/* Hamstrings / Glutes (Highlighted) */}
          <Line x1={kneeX} y1={kneeY} x2={hipX} y2={hipY} stroke="#C8FF3D" strokeWidth="9" strokeLinecap="round" />

          {/* Flat Spine Torso */}
          <Line x1={hipX} y1={hipY} x2={shoulderX} y2={shoulderY} stroke="#E2E8F0" strokeWidth="8" strokeLinecap="round" />
          <Circle cx={headX} cy={headY} r="9" fill="#CBD5E1" />

          {/* Arms holding bar */}
          <Line x1={shoulderX} y1={shoulderY} x2={barX} y2={barY} stroke="#94A3B8" strokeWidth="5" strokeLinecap="round" />

          {/* Barbell Plates */}
          <Circle cx={barX} cy={barY} r="13" fill="rgba(200, 255, 61, 0.2)" stroke="#C8FF3D" strokeWidth="3" />
          <Circle cx={hipX} cy={hipY} r="5" fill="#C8FF3D" />
        </G>
      );
    }

    if (pattern === 'horizontal_press') {
      // Bench Press / Horizontal Press side view: Bench, athlete lying down, bar moves in slight arc from lockout to lower chest
      const shoulderX = 135;
      const shoulderY = 122;
      const barX = lerp(135, 148, t);
      const barY = lerp(64, 108, t);
      const elbowX = lerp(138, 152, t);
      const elbowY = lerp(94, 134, t);

      return (
        <G>
          {/* Floor */}
          <Line x1="50" y1="178" x2="270" y2="178" stroke="#263040" strokeWidth="3" strokeLinecap="round" />
          {/* Bench Pad & Legs */}
          <Rect x="95" y="132" width="105" height="8" rx="4" fill="#263040" />
          <Line x1="110" y1="140" x2="110" y2="178" stroke="#1E2633" strokeWidth="5" />
          <Line x1="185" y1="140" x2="185" y2="178" stroke="#1E2633" strokeWidth="5" />

          {/* Athlete Body on Bench with slight thoracic arch */}
          <Circle cx="108" cy="122" r="9" fill="#CBD5E1" />
          <Path d="M 120 124 Q 152 114 185 126" stroke="#C8FF3D" strokeWidth="8" fill="none" strokeLinecap="round" />
          <Line x1="185" y1="126" x2="215" y2="145" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
          <Line x1="215" y1="145" x2="215" y2="175" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />

          {/* J-Curve Bar Trajectory */}
          <Path
            d="M 135 60 Q 146 85 148 110"
            stroke="rgba(200, 255, 61, 0.4)"
            strokeWidth="2"
            strokeDasharray="4,4"
            fill="none"
          />
          <SvgText x="62" y="64" fill="#C8FF3D" fontSize="9" fontWeight="700">
            {isUk ? 'Дуга жиму (J-curve)' : 'J-Curve Path'}
          </SvgText>

          {/* Upper Arm & Forearm */}
          <Line x1={shoulderX} y1={shoulderY} x2={elbowX} y2={elbowY} stroke="#E2E8F0" strokeWidth="6" strokeLinecap="round" />
          <Line x1={elbowX} y1={elbowY} x2={barX} y2={barY} stroke="#CBD5E1" strokeWidth="5.5" strokeLinecap="round" />

          {/* Barbell / Dumbbells */}
          <Circle cx={barX} cy={barY} r="13" fill="rgba(200, 255, 61, 0.22)" stroke="#C8FF3D" strokeWidth="3" />
          <Circle cx={barX} cy={barY} r="4" fill="#C8FF3D" />
        </G>
      );
    }

    if (pattern === 'vertical_press') {
      // Overhead Press / Shoulder Press / Lateral Raise (Front/Side view)
      const isLateral = exerciseName.toLowerCase().includes('lateral') || exerciseName.toLowerCase().includes('махи');
      const shoulderY = 86;
      const handY = isLateral ? lerp(132, 84, t) : lerp(84, 34, t);
      const handSpread = isLateral ? lerp(28, 66, t) : lerp(30, 26, t);
      const elbowY = isLateral ? lerp(110, 86, t) : lerp(108, 60, t);
      const elbowSpread = isLateral ? lerp(24, 46, t) : lerp(34, 28, t);

      return (
        <G>
          <Line x1="60" y1="178" x2="260" y2="178" stroke="#263040" strokeWidth="3" strokeLinecap="round" />
          {/* Torso & Legs (Front symmetric view) */}
          <Circle cx="160" cy="60" r="10" fill="#CBD5E1" />
          <Line x1="160" y1="72" x2="160" y2="132" stroke="#E2E8F0" strokeWidth="10" strokeLinecap="round" />
          <Line x1="160" y1="132" x2="146" y2="175" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
          <Line x1="160" y1="132" x2="174" y2="175" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />

          {/* Deltoid Caps (Highlighted) */}
          <Circle cx="142" cy={shoulderY} r="7" fill="#C8FF3D" />
          <Circle cx="178" cy={shoulderY} r="7" fill="#C8FF3D" />

          {/* Left & Right Arms */}
          <Line x1="142" y1={shoulderY} x2={160 - elbowSpread} y2={elbowY} stroke="#C8FF3D" strokeWidth="6" strokeLinecap="round" />
          <Line x1={160 - elbowSpread} y1={elbowY} x2={160 - handSpread} y2={handY} stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round" />

          <Line x1="178" y1={shoulderY} x2={160 + elbowSpread} y2={elbowY} stroke="#C8FF3D" strokeWidth="6" strokeLinecap="round" />
          <Line x1={160 + elbowSpread} y1={elbowY} x2={160 + handSpread} y2={handY} stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round" />

          {/* Barbell / Dumbbells */}
          {!isLateral && (
            <Line
              x1={160 - handSpread - 18}
              y1={handY}
              x2={160 + handSpread + 18}
              y2={handY}
              stroke="#C8FF3D"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}
          <Circle cx={160 - handSpread} cy={handY} r="7" fill="#C8FF3D" />
          <Circle cx={160 + handSpread} cy={handY} r="7" fill="#C8FF3D" />
        </G>
      );
    }

    if (pattern === 'vertical_pull') {
      // Lat Pulldown / Pull-Up: Arms reach overhead at t=0, pull elbows down & in to chest at t=1
      const shoulderY = 96;
      const barY = lerp(38, 86, t);
      const elbowY = lerp(64, 114, t);
      const elbowSpread = lerp(34, 28, t);

      return (
        <G>
          {/* Overhead Cable / Pull-up Frame */}
          <Line x1="100" y1="22" x2="220" y2="22" stroke="#263040" strokeWidth="4" strokeLinecap="round" />
          <Line x1="160" y1="22" x2="160" y2={barY} stroke="rgba(200, 255, 61, 0.45)" strokeWidth="2" strokeDasharray="3,3" />

          {/* Head & Torso with highlighted Lats */}
          <Circle cx="160" cy="72" r="9.5" fill="#CBD5E1" />
          <Path d="M 140 94 L 152 142 L 168 142 L 180 94 Z" fill="rgba(200, 255, 61, 0.22)" stroke="#C8FF3D" strokeWidth="2" />

          {/* Arms pulling down */}
          <Line x1="142" y1={shoulderY} x2={160 - elbowSpread} y2={elbowY} stroke="#C8FF3D" strokeWidth="6" strokeLinecap="round" />
          <Line x1={160 - elbowSpread} y1={elbowY} x2="122" y2={barY} stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round" />

          <Line x1="178" y1={shoulderY} x2={160 + elbowSpread} y2={elbowY} stroke="#C8FF3D" strokeWidth="6" strokeLinecap="round" />
          <Line x1={160 + elbowSpread} y1={elbowY} x2="198" y2={barY} stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round" />

          {/* Wide Lat Bar */}
          <Path
            d={`M 112 ${barY + 6} L 124 ${barY} L 196 ${barY} L 208 ${barY + 6}`}
            stroke="#C8FF3D"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <SvgText x="62" y="128" fill="#C8FF3D" fontSize="9" fontWeight="700">
            {isUk ? 'Лікті вниз до корпусу ↓' : 'Drive Elbows Down ↓'}
          </SvgText>
        </G>
      );
    }

    if (pattern === 'horizontal_pull') {
      // Seated Row / Bent-Over Row: Pulling handle horizontally toward torso, squeezing shoulder blades
      const shoulderX = 148;
      const shoulderY = 82;
      const handX = lerp(212, 156, t);
      const handY = lerp(102, 108, t);
      const elbowX = lerp(180, 126, t);
      const elbowY = lerp(94, 104, t);

      return (
        <G>
          <Line x1="50" y1="178" x2="270" y2="178" stroke="#263040" strokeWidth="3" strokeLinecap="round" />
          {/* Cable line */}
          <Line x1="250" y1="104" x2={handX} y2={handY} stroke="rgba(200, 255, 61, 0.4)" strokeWidth="2" strokeDasharray="4,4" />

          {/* Seated / Hinged Athlete */}
          <Circle cx="152" cy="58" r="9.5" fill="#CBD5E1" />
          <Line x1="148" y1="70" x2="142" y2="132" stroke="#C8FF3D" strokeWidth="9" strokeLinecap="round" />
          <Line x1="142" y1="132" x2="195" y2="136" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
          <Line x1="195" y1="136" x2="215" y2="174" stroke="#94A3B8" strokeWidth="6.5" strokeLinecap="round" />

          {/* Arm & Elbow driving back */}
          <Line x1={shoulderX} y1={shoulderY} x2={elbowX} y2={elbowY} stroke="#E2E8F0" strokeWidth="6" strokeLinecap="round" />
          <Line x1={elbowX} y1={elbowY} x2={handX} y2={handY} stroke="#CBD5E1" strokeWidth="5.5" strokeLinecap="round" />
          <Circle cx={handX} cy={handY} r="8" fill="#C8FF3D" />

          <SvgText x="62" y="62" fill="#C8FF3D" fontSize="9" fontWeight="700">
            {isUk ? 'Зведення лопаток ←' : 'Squeeze Scapula ←'}
          </SvgText>
        </G>
      );
    }

    if (pattern === 'knee_isolation') {
      // Leg Extension / Leg Curl: Seated knee pivot arc
      const isCurl = exerciseName.toLowerCase().includes('curl') || exerciseName.toLowerCase().includes('згинання');
      const kneeX = 172;
      const kneeY = 122;
      const angleDeg = isCurl ? lerp(12, 82, t) : lerp(82, 12, t);
      const rad = (angleDeg * Math.PI) / 180;
      const ankleX = kneeX + Math.cos(rad) * 48;
      const ankleY = kneeY + Math.sin(rad) * 48;

      return (
        <G>
          {/* Machine Seat */}
          <Line x1="112" y1="72" x2="124" y2="128" stroke="#263040" strokeWidth="6" strokeLinecap="round" />
          <Line x1="124" y1="128" x2="172" y2="128" stroke="#263040" strokeWidth="6" strokeLinecap="round" />

          {/* Arc Path */}
          <Path
            d="M 180 168 A 48 48 0 0 0 218 132"
            stroke="rgba(200, 255, 61, 0.4)"
            strokeWidth="2"
            strokeDasharray="4,4"
            fill="none"
          />

          {/* Athlete Seated */}
          <Circle cx="128" cy="56" r="9" fill="#CBD5E1" />
          <Line x1="126" y1="68" x2="130" y2="122" stroke="#E2E8F0" strokeWidth="8" strokeLinecap="round" />
          {/* Thigh */}
          <Line x1="130" y1="122" x2={kneeX} y2={kneeY} stroke="#C8FF3D" strokeWidth="9" strokeLinecap="round" />
          {/* Moving Lower Leg & Roller Pad */}
          <Line x1={kneeX} y1={kneeY} x2={ankleX} y2={ankleY} stroke="#CBD5E1" strokeWidth="7" strokeLinecap="round" />
          <Circle cx={kneeX} cy={kneeY} r="5" fill="#C8FF3D" />
          <Circle cx={ankleX} cy={ankleY} r="7" fill="#C8FF3D" />
        </G>
      );
    }

    // Default: Arm Curl / Tricep Extension (Pinned elbow pivot arc!)
    const isTricep = pattern === 'tricep_extension';
    const shoulderX = 145;
    const shoulderY = 74;
    const elbowX = 148;
    const elbowY = 114;
    const angleDeg = isTricep ? lerp(-25, 68, t) : lerp(68, -35, t);
    const rad = (angleDeg * Math.PI) / 180;
    const handX = elbowX + Math.cos(rad) * 44;
    const handY = elbowY + Math.sin(rad) * 44;

    return (
      <G>
        {/* Athlete Torso */}
        <Circle cx="145" cy="48" r="9.5" fill="#CBD5E1" />
        <Line x1="145" y1="60" x2="145" y2="148" stroke="#94A3B8" strokeWidth="9" strokeLinecap="round" />
        <Line x1="145" y1="148" x2="145" y2="178" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />

        {/* Forearm Arc Trajectory */}
        <Path
          d="M 164 154 A 44 44 0 0 0 184 88"
          stroke="rgba(200, 255, 61, 0.45)"
          strokeWidth="2"
          strokeDasharray="4,4"
          fill="none"
        />

        {/* Upper Arm (Highlighted Bicep/Tricep) */}
        <Line x1={shoulderX} y1={shoulderY} x2={elbowX} y2={elbowY} stroke="#C8FF3D" strokeWidth="8" strokeLinecap="round" />

        {/* Pinned Elbow Indicator */}
        <Circle cx={elbowX} cy={elbowY} r="8" fill="rgba(200, 255, 61, 0.2)" stroke="#C8FF3D" strokeWidth="1.5" />
        <Circle cx={elbowX} cy={elbowY} r="4" fill="#C8FF3D" />
        <SvgText x="62" y="118" fill="#C8FF3D" fontSize="9" fontWeight="700">
          {isUk ? 'Лікоть зафіксовано →' : 'Elbow Pinned →'}
        </SvgText>

        {/* Moving Forearm & Dumbbell/Handle */}
        <Line x1={elbowX} y1={elbowY} x2={handX} y2={handY} stroke="#E2E8F0" strokeWidth="6.5" strokeLinecap="round" />
        <Circle cx={handX} cy={handY} r="8" fill="#C8FF3D" />
      </G>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <View style={styles.liveDot} />
          <Text style={styles.badgeText}>
            {isUk ? 'БІОМЕХАНІКА ТА ТРАЄКТОРІЯ РУХУ' : 'LIVE BIOMECHANICS & TEMPO'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticLight();
            setIsPlaying((prev) => !prev);
          }}
          style={styles.playPauseBtn}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={12} color="#0B0D0F" />
          <Text style={styles.playPauseText}>
            {isPlaying ? (isUk ? 'Пауза' : 'Pause') : (isUk ? 'Пуск' : 'Play')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.canvasWrap}>
        <Svg width="100%" height="190" viewBox="0 0 320 190">
          <Defs>
            <LinearGradient id="bgGlow" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#C8FF3D" stopOpacity="0.06" />
              <Stop offset="1" stopColor="#0E1218" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="320" height="190" fill="url(#bgGlow)" />
          {renderBiomechanicsSvg()}
        </Svg>
      </View>

      {/* Live Tempo & Breathing Bar */}
      <View style={styles.tempoBar}>
        <View style={styles.tempoHeaderRow}>
          <Ionicons name="pulse" size={14} color={colors.primary} />
          <Text style={styles.tempoCueText}>{breathCueLabel}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#11161F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(200, 255, 61, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 61, 0.25)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  playPauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  playPauseText: {
    color: '#0B0D0F',
    fontSize: 11,
    fontWeight: '900',
  },
  canvasWrap: {
    height: 190,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempoBar: {
    backgroundColor: 'rgba(11, 13, 15, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
  },
  tempoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tempoCueText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});


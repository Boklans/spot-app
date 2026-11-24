import React, { useEffect, useId, useMemo, useRef } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useThemeColors } from '@/constants/colors';
import {
  BENCH_RIG,
  BENCH_VIEWBOX,
  buildJointMatrix,
  buildTranslationMatrix,
  evaluateBenchPressPose,
  getBenchBarPathSvg,
  matrixToSvgString,
  type BenchPressPhase,
  type BenchPressPose,
} from '@/lib/exerciseAnimations/benchPressKinematics';
import { applySvgGroupMatrix, applySvgOpacity } from './svgNativeBridge';

export interface BarbellBenchPressSvgProps {
  /** Whether the animation loop is actively advancing */
  isPlaying: boolean;
  /** Incrementing counter to deterministically reset the animation to t = 0 */
  restartToken: number;
  /** Initial pose offset in ms (e.g. mid-rep static frame when Reduce Motion is enabled) */
  initialElapsedMs?: number;
  /** Fired ONLY when the movement phase changes (at most ~5 times per 4.1s cycle, never 60fps) */
  onPhaseChange?: (phase: BenchPressPhase) => void;
  /** Optional imperative callback for a progress indicator bar (called per frame, no React state!) */
  onProgressFrame?: (cycleProgress: number) => void;
}

/**
 * Production-grade 2D vector biomechanical demonstration for:
 * **Barbell Bench Press (Жим штанги лежачи)** — Side View.
 *
 * Architecture:
 * - React renders the static + rigged SVG tree ONCE (zero per-frame React re-renders).
 * - A single requestAnimationFrame loop advances deterministic analytical 2-bone IK
 *   and pushes 2D affine matrices directly to SVG `<G>` nodes via `svgNativeBridge`.
 * - Adapts seamlessly to SPOT Carbon Dark and Daylight Athletic themes.
 */
export function BarbellBenchPressSvg({
  isPlaying,
  restartToken,
  initialElapsedMs = 0,
  onPhaseChange,
  onProgressFrame,
}: BarbellBenchPressSvgProps) {
  const colors = useThemeColors();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  // Imperative refs for zero-re-render 60fps updates
  const torsoBreathRef = useRef<any>(null);
  const pecGlowRef = useRef<any>(null);
  const nearUpperArmRef = useRef<any>(null);
  const nearUpperArmMuscleRef = useRef<any>(null);
  const nearForearmRef = useRef<any>(null);
  const farUpperArmRef = useRef<any>(null);
  const farForearmRef = useRef<any>(null);
  const barbellRef = useRef<any>(null);

  // Timing refs (kept outside React state to guarantee zero re-renders during playback)
  const elapsedMsRef = useRef<number>(initialElapsedMs);
  const lastPhaseRef = useRef<BenchPressPhase | null>(null);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onProgressFrameRef = useRef(onProgressFrame);
  onPhaseChangeRef.current = onPhaseChange;
  onProgressFrameRef.current = onProgressFrame;

  const palette = useMemo(() => {
    if (colors.isDark) {
      return {
        stageGlow: '#C8FF3D',
        floorLine: 'rgba(255, 255, 255, 0.10)',
        floorShadow: 'rgba(0, 0, 0, 0.55)',
        rackMetal: '#202631',
        rackStroke: '#313A49',
        benchFrame: '#232935',
        benchFrameStroke: '#353F50',
        benchPad: '#2A3240',
        benchPadHighlight: 'rgba(255, 255, 255, 0.14)',
        benchPadStroke: '#3B4557',
        // Athlete — sleek matte anatomical sculpture (matches SPOT 3D clay & AnatomyPreview aesthetic)
        skinFill: '#8E99AB',
        skinShadow: '#6F7A8C',
        skinStroke: '#141820',
        farLimbFill: '#545F71',
        farLimbStroke: '#141820',
        hairFill: '#2A313E',
        apparelTop: '#242B37',
        apparelTopStroke: '#394354',
        apparelShorts: '#1C222C',
        apparelShortsStroke: '#303949',
        shoeUpper: '#2E3646',
        shoeSole: '#C8FF3D',
        // Active muscle highlight (SPOT signature lime)
        musclePrimaryStart: '#D9FF66',
        musclePrimaryEnd: '#A3E619',
        muscleSecondary: '#C8FF3D',
        // Barbell & translucent technical plate
        barSteel: '#DCE3EC',
        barSteelStroke: '#12161D',
        plateRim: '#2E3645',
        plateRimStroke: '#526077',
        plateWeb: '#C8FF3D',
        plateInnerRing: 'rgba(220, 227, 236, 0.34)',
        plateAccent: '#C8FF3D',
        // J-curve path guide
        guideEccentric: 'rgba(255, 255, 255, 0.22)',
        guideConcentric: 'rgba(200, 255, 61, 0.42)',
        jointDot: 'rgba(255, 255, 255, 0.28)',
      };
    }
    return {
      stageGlow: '#16A34A',
      floorLine: 'rgba(15, 23, 42, 0.12)',
      floorShadow: 'rgba(15, 23, 42, 0.14)',
      rackMetal: '#CBD5E1',
      rackStroke: '#94A3B8',
      benchFrame: '#94A3B8',
      benchFrameStroke: '#64748B',
      benchPad: '#334155',
      benchPadHighlight: 'rgba(255, 255, 255, 0.22)',
      benchPadStroke: '#1E293B',
      skinFill: '#94A3B8',
      skinShadow: '#64748B',
      skinStroke: '#1E293B',
      farLimbFill: '#64748B',
      farLimbStroke: '#1E293B',
      hairFill: '#334155',
      apparelTop: '#1E293B',
      apparelTopStroke: '#334155',
      apparelShorts: '#0F172A',
      apparelShortsStroke: '#334155',
      shoeUpper: '#334155',
      shoeSole: '#16A34A',
      musclePrimaryStart: '#4ADE80',
      musclePrimaryEnd: '#15803D',
      muscleSecondary: '#16A34A',
      barSteel: '#E2E8F0',
      barSteelStroke: '#0F172A',
      plateRim: '#334155',
      plateRimStroke: '#0F172A',
      plateWeb: '#16A34A',
      plateInnerRing: 'rgba(15, 23, 42, 0.28)',
      plateAccent: '#16A34A',
      guideEccentric: 'rgba(15, 23, 42, 0.22)',
      guideConcentric: 'rgba(22, 163, 74, 0.50)',
      jointDot: 'rgba(15, 23, 42, 0.25)',
    };
  }, [colors.isDark]);

  const initialPose = useMemo(
    () => evaluateBenchPressPose(initialElapsedMs),
    [initialElapsedMs]
  );

  const barPathGuide = useMemo(() => getBenchBarPathSvg(), []);

  const applyPoseToSvg = (pose: BenchPressPose) => {
    // 1. Subtle thoracic inhale/brace lift (keeps upper back pinned on bench)
    applySvgGroupMatrix(
      torsoBreathRef.current,
      buildTranslationMatrix(0, -pose.chestBraceLift * 0.55)
    );

    // 2. Active muscle highlight opacity (primary Pectoralis Major + secondary Delts/Triceps)
    applySvgOpacity(pecGlowRef.current, pose.pecActivation);
    applySvgOpacity(nearUpperArmMuscleRef.current, pose.secondaryActivation * 0.72);

    // 3. Near Arm (100% analytical 2-bone IK, foreshortened upper arm + constant forearm)
    const nearUpperMat = buildJointMatrix(
      pose.shoulder.x,
      pose.shoulder.y,
      pose.upperArmRad,
      pose.upperArmScaleX
    );
    const nearForearmMat = buildJointMatrix(pose.elbow.x, pose.elbow.y, pose.forearmRad, 1);
    applySvgGroupMatrix(nearUpperArmRef.current, nearUpperMat);
    applySvgGroupMatrix(nearForearmRef.current, nearForearmMat);

    // 4. Far Arm (synchronized depth offset for natural bilateral 3D read)
    const farDx = -5;
    const farDy = -3.2;
    const farUpperMat = buildJointMatrix(
      pose.shoulder.x + farDx,
      pose.shoulder.y + farDy,
      pose.upperArmRad,
      pose.upperArmScaleX
    );
    const farForearmMat = buildJointMatrix(
      pose.elbow.x + farDx,
      pose.elbow.y + farDy,
      pose.forearmRad,
      1
    );
    applySvgGroupMatrix(farUpperArmRef.current, farUpperMat);
    applySvgGroupMatrix(farForearmRef.current, farForearmMat);

    // 5. Barbell + Weight Plates (strictly locked to wrist grip center)
    applySvgGroupMatrix(barbellRef.current, buildTranslationMatrix(pose.bar.x, pose.bar.y));

    // 6. Notify phase changes ONLY on transition + progress hairline imperatively
    if (lastPhaseRef.current !== pose.phase) {
      lastPhaseRef.current = pose.phase;
      onPhaseChangeRef.current?.(pose.phase);
    }
    onProgressFrameRef.current?.(pose.cycleProgress);
  };

  // Handle explicit Restart button (deterministic reset to t = 0)
  useEffect(() => {
    if (restartToken > 0) {
      elapsedMsRef.current = 0;
      const resetPose = evaluateBenchPressPose(0);
      applyPoseToSvg(resetPose);
    }
  }, [restartToken]);

  // Apply initial pose immediately on mount or theme switch so SVG never flickers
  useEffect(() => {
    const pose = evaluateBenchPressPose(elapsedMsRef.current);
    applyPoseToSvg(pose);
  }, [colors.isDark]);

  // Main 60fps requestAnimationFrame loop with delta clamping & clean teardown
  useEffect(() => {
    if (!isPlaying) return;

    let rafId: number | null = null;
    let lastTimestamp: number | null = null;

    const tick = (now: number) => {
      if (lastTimestamp !== null) {
        // Clamp frame delta to <= 50ms so returning from background never jumps
        const dt = Math.min(50, Math.max(0, now - lastTimestamp));
        elapsedMsRef.current += dt;
      }
      lastTimestamp = now;

      const pose = evaluateBenchPressPose(elapsedMsRef.current);
      applyPoseToSvg(pose);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isPlaying]);

  // Initial SVG transforms for frame-0 first paint (prevents any initial jump)
  const initNearUpper = matrixToSvgString(
    buildJointMatrix(
      initialPose.shoulder.x,
      initialPose.shoulder.y,
      initialPose.upperArmRad,
      initialPose.upperArmScaleX
    )
  );
  const initNearForearm = matrixToSvgString(
    buildJointMatrix(initialPose.elbow.x, initialPose.elbow.y, initialPose.forearmRad, 1)
  );
  const initFarUpper = matrixToSvgString(
    buildJointMatrix(
      initialPose.shoulder.x - 5,
      initialPose.shoulder.y - 3.2,
      initialPose.upperArmRad,
      initialPose.upperArmScaleX
    )
  );
  const initFarForearm = matrixToSvgString(
    buildJointMatrix(
      initialPose.elbow.x - 5,
      initialPose.elbow.y - 3.2,
      initialPose.forearmRad,
      1
    )
  );
  const initBarbell = matrixToSvgString(
    buildTranslationMatrix(initialPose.bar.x, initialPose.bar.y)
  );

  const pecGradId = `bp-pec-${uid}`;
  const skinGradId = `bp-skin-${uid}`;
  const stageGlowId = `bp-glow-${uid}`;
  const L1 = BENCH_RIG.upperArmLengthTop; // 34.5
  const L2 = BENCH_RIG.forearmLength; // 35.0

  return (
    <Svg
      viewBox={`${BENCH_VIEWBOX.x} ${BENCH_VIEWBOX.y} ${BENCH_VIEWBOX.width} ${BENCH_VIEWBOX.height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      <Defs>
        <RadialGradient id={stageGlowId} cx="46%" cy="48%" rx="44%" ry="46%">
          <Stop offset="0%" stopColor={palette.stageGlow} stopOpacity={colors.isDark ? 0.08 : 0.06} />
          <Stop offset="100%" stopColor={palette.stageGlow} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={pecGradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={palette.musclePrimaryStart} />
          <Stop offset="100%" stopColor={palette.musclePrimaryEnd} />
        </LinearGradient>
        <LinearGradient id={skinGradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={palette.skinFill} />
          <Stop offset="100%" stopColor={palette.skinShadow} />
        </LinearGradient>
      </Defs>

      {/* 1. Subtle Ambient Radial Spotlight & Ground Plane */}
      <Ellipse cx={166} cy={104} rx={150} ry={92} fill={`url(#${stageGlowId})`} />

      {/* Grounding floor shadows */}
      <Ellipse cx={155} cy={193.5} rx={116} ry={4.2} fill={palette.floorShadow} />
      <Line
        x1={26}
        y1={BENCH_VIEWBOX.floorY}
        x2={334}
        y2={BENCH_VIEWBOX.floorY}
        stroke={palette.floorLine}
        strokeWidth={1.25}
        strokeLinecap="round"
      />

      {/* 2. Background Barbell Upright Rack (Clean Architectural Equipment) */}
      <G>
        {/* Rack base foot */}
        <Rect
          x={58}
          y={187.5}
          width={36}
          height={4.5}
          rx={2}
          fill={palette.rackMetal}
          stroke={palette.rackStroke}
          strokeWidth={1}
        />
        {/* Vertical rack upright post */}
        <Rect
          x={72}
          y={40}
          width={7.5}
          height={148}
          rx={2}
          fill={palette.rackMetal}
          stroke={palette.rackStroke}
          strokeWidth={1}
        />
        {/* Precision rack adjustment holes */}
        {[52, 66, 80, 94, 108].map((hy) => (
          <Circle key={hy} cx={75.75} cy={hy} r={1.1} fill={palette.rackStroke} />
        ))}
        {/* J-Cup hook (positioned cleanly behind lockout line) */}
        <Path
          d="M 79.5 52 L 87 52 L 87 60.5 C 87 62.5, 85.5 63.5, 83.5 63.5 L 79.5 63.5 Z"
          fill={palette.benchFrame}
          stroke={palette.rackStroke}
          strokeWidth={1}
          strokeLinejoin="round"
        />
        {/* Rear diagonal rack gusset */}
        <Path
          d="M 72 174 L 61 187.5 L 66 187.5 L 72 180 Z"
          fill={palette.rackMetal}
          stroke={palette.rackStroke}
          strokeWidth={0.9}
        />
      </G>

      {/* 3. Subtle J-Curve Trajectory Blueprint Guide (Behind Bar & Arms) */}
      <G>
        {/* Eccentric lowering arc */}
        <Path
          d={barPathGuide.eccentricPath}
          fill="none"
          stroke={palette.guideEccentric}
          strokeWidth={1.25}
          strokeDasharray="3.5 3.5"
          strokeLinecap="round"
        />
        {/* Concentric J-curve pressing arc */}
        <Path
          d={barPathGuide.concentricPath}
          fill="none"
          stroke={palette.guideConcentric}
          strokeWidth={1.35}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        {/* Lockout & Chest-touch reference ticks */}
        <Circle cx={BENCH_RIG.barTop.x} cy={BENCH_RIG.barTop.y} r={2.2} fill={palette.guideConcentric} />
        <Circle cx={BENCH_RIG.barBottom.x} cy={BENCH_RIG.barBottom.y} r={2.2} fill={palette.guideEccentric} />
      </G>

      {/* 4. Far-Side Arm (Synchronized IK, Subtle Recessed Tone for Depth) */}
      <G>
        <G ref={farUpperArmRef} transform={initFarUpper}>
          <Path
            d={`M -3 -5.5 C 6 -7.2, 22 -6.5, ${L1} -4.8 C ${L1 + 4} -3.5, ${L1 + 4} 3.5, ${L1} 4.8 C 22 6.5, 6 7.2, -3 5.5 C -7.5 3.8, -7.5 -3.8, -3 -5.5 Z`}
            fill={palette.farLimbFill}
            stroke={palette.farLimbStroke}
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
        </G>
        <G ref={farForearmRef} transform={initFarForearm}>
          <Path
            d={`M -2 -4.6 C 8 -5.4, 21 -4.2, ${L2 - 3} -3.1 L ${L2 + 1} -3.1 C ${L2 + 4} -2.5, ${L2 + 4} 2.5, ${L2 + 1} 3.1 L ${L2 - 3} 3.1 C 21 4.2, 8 5.4, -2 4.6 C -5.2 3.2, -5.2 -3.2, -2 -4.6 Z`}
            fill={palette.farLimbFill}
            stroke={palette.farLimbStroke}
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
        </G>
      </G>

      {/* 5. Far-Side Planted Leg (Subtle Recessed Depth) */}
      <G>
        <Path
          d="M 205 126 C 224 123, 240 126, 250 133 C 254 136, 254 142, 252 149 L 246 184 L 236 184 L 239 144 C 228 139, 216 138, 205 137 Z"
          fill={palette.farLimbFill}
          stroke={palette.farLimbStroke}
          strokeWidth={1.15}
          strokeLinejoin="round"
        />
        {/* Far training shoe firmly planted on floor */}
        <Path
          d="M 234 182 L 247 182 L 262 187.5 C 264.5 188.5, 265 190.5, 264 191.5 L 232.5 191.5 C 231.5 190.5, 232 185, 234 182 Z"
          fill={palette.farLimbFill}
          stroke={palette.farLimbStroke}
          strokeWidth={1.1}
          strokeLinejoin="round"
        />
      </G>

      {/* 6. Flat Workout Bench (Structural Steel + Cushioned Pad) */}
      <G>
        {/* Horizontal stabilizer bar */}
        <Rect
          x={96}
          y={173}
          width={114}
          height={4.5}
          rx={1.5}
          fill={palette.benchFrame}
          stroke={palette.benchFrameStroke}
          strokeWidth={1}
        />
        {/* Rear support column */}
        <Rect
          x={91}
          y={150}
          width={7.5}
          height={38}
          rx={1.5}
          fill={palette.benchFrame}
          stroke={palette.benchFrameStroke}
          strokeWidth={1}
        />
        {/* Rear rubber foot */}
        <Rect
          x={84}
          y={187.5}
          width={21.5}
          height={4.5}
          rx={2}
          fill={palette.benchPad}
          stroke={palette.benchFrameStroke}
          strokeWidth={1}
        />
        {/* Front support column */}
        <Path
          d="M 203 150 L 210.5 150 L 214.5 188 L 207 188 Z"
          fill={palette.benchFrame}
          stroke={palette.benchFrameStroke}
          strokeWidth={1}
          strokeLinejoin="round"
        />
        {/* Front rubber foot */}
        <Rect
          x={200}
          y={187.5}
          width={22}
          height={4.5}
          rx={2}
          fill={palette.benchPad}
          stroke={palette.benchFrameStroke}
          strokeWidth={1}
        />
        {/* Under-pad longitudinal steel beam */}
        <Rect
          x={74}
          y={146}
          width={142}
          height={5.5}
          rx={2}
          fill={palette.benchFrame}
          stroke={palette.benchFrameStroke}
          strokeWidth={1}
        />
        {/* Main cushioned bench pad (top surface strictly at y = 136) */}
        <Rect
          x={63}
          y={BENCH_VIEWBOX.benchTopY}
          width={162}
          height={10.5}
          rx={4}
          fill={palette.benchPad}
          stroke={palette.benchPadStroke}
          strokeWidth={1.15}
        />
        {/* Subtle upholstery top sheen */}
        <Line
          x1={68}
          y1={137.4}
          x2={220}
          y2={137.4}
          stroke={palette.benchPadHighlight}
          strokeWidth={1}
          strokeLinecap="round"
        />
      </G>

      {/* 7. Athlete — Head, Neck, Torso, Core, Glutes & Near Leg */}
      <G>
        {/* Neck connecting skull to retracted upper traps */}
        <Path
          d="M 94 123 L 107 121 L 109 135.5 L 93 134.5 Z"
          fill={`url(#${skinGradId})`}
          stroke={palette.skinStroke}
          strokeWidth={1.25}
          strokeLinejoin="round"
        />

        {/* Head — refined, minimal athletic side profile resting on bench pad */}
        <G>
          <Path
            d="M 73.5 127.5 C 71.8 120.5, 74.2 113.8, 80.8 112.2 C 84 111.4, 86.2 111.4, 88.2 109.6 C 89.2 108.8, 90.3 109.6, 90.2 111.3 C 91.6 112.6, 92.2 114.2, 92 116 C 93.8 117.2, 95.6 119.5, 95.8 122.8 C 96 127.4, 93.8 132.4, 89 135 C 83.6 136.6, 76 135.2, 73.5 127.5 Z"
            fill={`url(#${skinGradId})`}
            stroke={palette.skinStroke}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          {/* Clean cropped athletic hair cap */}
          <Path
            d="M 73.3 127 C 71.7 120.4, 74 113.8, 80.5 112.2 C 82.4 111.8, 83.5 112.8, 82.6 114.8 C 80 118, 79.4 123, 81.4 128 C 82.6 130.6, 85.4 132.6, 88.4 133.8 C 82.8 136.2, 75.6 134.5, 73.3 127 Z"
            fill={palette.hairFill}
          />
          {/* Subtle ear contour positioned anatomically near mastoid/back of jaw */}
          <Path
            d="M 83 126.4 C 84.3 126, 85.2 127.4, 84.4 129 C 83.6 130.1, 82.4 129.6, 82.5 128.2"
            fill="none"
            stroke={palette.skinStroke}
            strokeOpacity={0.75}
            strokeWidth={0.95}
            strokeLinecap="round"
          />
        </G>

        {/* Torso & Chest (with subtle ribcage breathing lift) */}
        <G ref={torsoBreathRef}>
          {/* Fitted athletic torso & ribcage with natural lumbar arch */}
          <Path
            d="M 103 135.6 L 138 135.6 Q 158 131.0, 178 135.6 L 204 135.6 C 210 135.6, 214 131.5, 213 125.5 C 212 119.5, 206 115.8, 196 115.5 L 176 115 C 166 114.5, 158 113, 150 110 C 143 107.4, 136 106.2, 129 106.2 C 118.5 106.2, 110 111.8, 104.5 119.5 C 101.8 123.5, 101 131, 103 135.6 Z"
            fill={palette.apparelTop}
            stroke={palette.apparelTopStroke}
            strokeWidth={1.25}
            strokeLinejoin="round"
          />

          {/* Subtle collar neckline & ribcage athletic contour */}
          <Path
            d="M 104.5 119.5 C 107.5 122, 108.5 126.5, 107.5 130.5"
            fill="none"
            stroke={palette.apparelTopStroke}
            strokeWidth={1.05}
            strokeLinecap="round"
          />
          <Path
            d="M 150 112 C 155 118, 164 121.8, 177 122.4"
            fill="none"
            stroke={palette.apparelTopStroke}
            strokeWidth={0.9}
            strokeLinecap="round"
          />

          {/* Active Primary Muscle Highlight: Sculpted Pectoralis Major */}
          <G ref={pecGlowRef} opacity={initialPose.pecActivation}>
            <Path
              d="M 114 114.2 C 120 108, 130.5 106.8, 141.5 108.6 C 146 109.4, 148.6 111.5, 147.6 114.2 C 145.6 119.4, 135.5 122.2, 124.5 121.6 C 117.5 121.2, 113 118.2, 114 114.2 Z"
              fill={`url(#${pecGradId})`}
              fillOpacity={0.92}
            />
            {/* Delicate anatomical muscle fiber striations */}
            <Path
              d="M 120 114.2 C 128 112.2, 136.5 111.8, 144.2 112.6"
              fill="none"
              stroke={palette.skinStroke}
              strokeOpacity={0.24}
              strokeWidth={0.85}
              strokeLinecap="round"
            />
            <Path
              d="M 122 117.8 C 129 116.4, 135.5 116.2, 141.5 116.6"
              fill="none"
              stroke={palette.skinStroke}
              strokeOpacity={0.18}
              strokeWidth={0.8}
              strokeLinecap="round"
            />
          </G>
        </G>

        {/* Pelvis & Athletic Shorts */}
        <Path
          d="M 176 135.6 L 207 135.6 C 216 135.6, 224 134, 228 130.5 L 224 117.5 C 216 115.5, 205 114.6, 193 115 L 177 115.4 C 174.5 121.5, 174 129.5, 176 135.6 Z"
          fill={palette.apparelShorts}
          stroke={palette.apparelShortsStroke}
          strokeWidth={1.25}
          strokeLinejoin="round"
        />

        {/* Near Leg — Quadriceps, Knee, Shin & Calf */}
        <Path
          d="M 224 117.8 C 234 119.8, 243 123.5, 247.5 129.5 C 250.5 133.5, 250.5 139.5, 248.5 147 L 242 183.5 L 231.5 183.5 L 233 166 C 230.2 158, 229.8 148.5, 233.5 140 C 230 137.5, 225.5 136, 218.5 135.6 L 222.5 129.5 Z"
          fill={`url(#${skinGradId})`}
          stroke={palette.skinStroke}
          strokeWidth={1.25}
          strokeLinejoin="round"
        />
        {/* Subtle knee & calf anatomical contour lines */}
        <Path
          d="M 241.5 131.5 C 244.5 133.5, 245.5 137, 244 140.5"
          fill="none"
          stroke={palette.skinStroke}
          strokeOpacity={0.35}
          strokeWidth={1}
          strokeLinecap="round"
        />
        <Path
          d="M 234.5 147 C 233 153.5, 233.5 160, 236 165"
          fill="none"
          stroke={palette.skinStroke}
          strokeOpacity={0.28}
          strokeWidth={1}
          strokeLinecap="round"
        />

        {/* Near Athletic Training Shoe (Firmly Planted Flat on Floor y = 192) */}
        <G>
          <Path
            d="M 230 181.5 L 243.5 181.5 L 258.5 187.2 C 261.2 188.2, 261.8 190.4, 260.5 191.6 L 228.5 191.6 C 227.2 190.4, 228 184.5, 230 181.5 Z"
            fill={palette.shoeUpper}
            stroke={palette.skinStroke}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          {/* Crisp flat lifting sole */}
          <Path
            d="M 228.5 189.8 L 260.5 189.8 L 260.2 191.6 L 228.5 191.6 Z"
            fill={palette.shoeSole}
          />
        </G>
      </G>

      {/* 8. Articulated Near Arm — Organic Joint Blending (Zero Doll-Hinge Seams) */}
      {/* 8A. Upper Arm (Origin = Shoulder S, points along +X to Elbow at x = L1) */}
      <G ref={nearUpperArmRef} transform={initNearUpper}>
        {/* Anatomically sculpted Deltoid -> Biceps/Triceps -> Elbow */}
        <Path
          d={`M -3.5 -6.8 C 4.5 -8.6, 17 -7.6, ${L1 - 1} -5.3 C ${L1 + 4.8} -4.1, ${L1 + 4.8} 4.1, ${L1 - 1} 5.3 C 19 8.0, 5.5 8.6, -3.5 6.8 C -9.0 4.8, -9.0 -4.8, -3.5 -6.8 Z`}
          fill={`url(#${skinGradId})`}
          stroke={palette.skinStroke}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        {/* Fitted athletic short sleeve over shoulder cap */}
        <Path
          d="M -3.5 -6.8 C 3.5 -8.5, 10 -8.2, 13.5 -7.5 L 12.2 7.5 C 8.5 8.3, 3.2 8.4, -3.5 6.8 C -9.0 4.8, -9.0 -4.8, -3.5 -6.8 Z"
          fill={palette.apparelTop}
          stroke={palette.apparelTopStroke}
          strokeWidth={1.1}
          strokeLinejoin="round"
        />
        {/* Secondary muscle activation glow (Anterior Deltoid + Triceps Lateral Head) */}
        <G ref={nearUpperArmMuscleRef} opacity={initialPose.secondaryActivation * 0.72}>
          {/* Anterior deltoid highlight */}
          <Path
            d="M -3.2 -5.8 C 2.2 -7.4, 8.2 -6.8, 11 -3.8 C 8.8 -0.9, 3.2 -0.6, -3.0 -1.6 C -6.2 -2.4, -6.2 -4.8, -3.2 -5.8 Z"
            fill={palette.muscleSecondary}
            fillOpacity={0.5}
          />
          {/* Triceps belly (local +Y = posterior side of humerus) */}
          <Path
            d={`M 13.5 1.8 C 19 2.2, 24 2.4, ${L1 - 6} 4.0 C 23 6.6, 16 6.8, 13 4.8 Z`}
            fill={palette.muscleSecondary}
            fillOpacity={0.5}
          />
        </G>
      </G>

      {/* 8B. Forearm + Seamless Elbow Blend + Aligned Wrist & Closed-Grip Hand */}
      <G ref={nearForearmRef} transform={initNearForearm}>
        {/* Forearm outer silhouette (open inner elbow blend prevents mannequin ring seam) */}
        <Path
          d={`M -1.5 -5.0 C 7.5 -6.3, 17.5 -5.0, ${L2 - 6} -3.3 L ${L2 - 2} -3.2 L ${L2 - 2} 3.2 L ${L2 - 6} 3.3 C 17.5 5.0, 7.5 6.3, -1.5 5.0 C -5.5 3.8, -5.5 -3.8, -1.5 -5.0 Z`}
          fill={`url(#${skinGradId})`}
        />
        {/* Seamless elbow blend disc (masks upper-arm stroke cleanly across elbow pivot) */}
        <Circle cx={0} cy={0} r={4.6} fill={`url(#${skinGradId})`} />
        {/* Crisp outer contour lines only along forearm edges (seamless elbow transition) */}
        <Path
          d={`M -1.2 -5.0 C 7.5 -6.3, 17.5 -5.0, ${L2 - 4} -3.3`}
          fill="none"
          stroke={palette.skinStroke}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <Path
          d={`M -1.8 5.0 C 7.5 6.3, 17.5 5.0, ${L2 - 4} 3.3`}
          fill="none"
          stroke={palette.skinStroke}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        {/* Subtle anatomical forearm line & inner elbow crease */}
        <Path
          d="M 5.5 -2.4 C 12 -3.0, 18.5 -2.1, 24 -1.2"
          fill="none"
          stroke={palette.skinStroke}
          strokeOpacity={0.24}
          strokeWidth={0.85}
          strokeLinecap="round"
        />
        {/* Closed-grip hand wrapping the bar cleanly (wrist aligned straight with forearm) */}
        <Path
          d={`M ${L2 - 4} -3.5 C ${L2 - 1} -5.4, ${L2 + 4.8} -5.2, ${L2 + 5.8} -1.8 C ${L2 + 6.4} 0.4, ${L2 + 5.8} 3.6, ${L2 + 3.2} 4.7 C ${L2 + 0.2} 5.6, ${L2 - 2.8} 4.7, ${L2 - 4} 3.3 Z`}
          fill={palette.skinFill}
          stroke={palette.skinStroke}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </G>

      {/* 9. Barbell & Technical Translucent Olympic Weight Plate (Locked to Hand Grip Center) */}
      <G ref={barbellRef} transform={initBarbell}>
        {/* Translucent inner bumper plate web (allows hand & wrist alignment to remain 100% visible) */}
        <Circle
          cx={0}
          cy={0}
          r={22}
          fill={palette.plateWeb}
          fillOpacity={colors.isDark ? 0.055 : 0.065}
        />
        {/* Machined inner weight ring */}
        <Circle
          cx={0}
          cy={0}
          r={14.5}
          fill="none"
          stroke={palette.plateInnerRing}
          strokeWidth={1.1}
        />
        {/* Outer Olympic 20kg bumper rim */}
        <Circle
          cx={0}
          cy={0}
          r={22.2}
          fill="none"
          stroke={palette.plateRim}
          strokeWidth={4.2}
        />
        {/* Crisp outer rim contour stroke */}
        <Circle
          cx={0}
          cy={0}
          r={24.3}
          fill="none"
          stroke={palette.plateRimStroke}
          strokeWidth={1.05}
        />
        <Circle
          cx={0}
          cy={0}
          r={20.1}
          fill="none"
          stroke={palette.plateRimStroke}
          strokeWidth={0.85}
          strokeOpacity={0.7}
        />
        {/* Signature SPOT accent arc on bumper plate collar */}
        <Path
          d="M -16 -15.4 A 22.2 22.2 0 0 1 16 -15.4"
          fill="none"
          stroke={palette.plateAccent}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeOpacity={0.78}
        />
        {/* Olympic barbell sleeve collar */}
        <Circle
          cx={0}
          cy={0}
          r={5.8}
          fill={palette.plateRim}
          fillOpacity={0.55}
          stroke={palette.plateRimStroke}
          strokeWidth={1}
        />
        {/* Center machined steel barbell shaft end */}
        <Circle
          cx={0}
          cy={0}
          r={BENCH_VIEWBOX.barRadius}
          fill={palette.barSteel}
          stroke={palette.barSteelStroke}
          strokeWidth={1.15}
        />
        <Circle cx={-0.8} cy={-0.8} r={1} fill="#FFFFFF" fillOpacity={0.65} />
      </G>
    </Svg>
  );
}

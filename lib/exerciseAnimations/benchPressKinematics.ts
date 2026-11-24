/**
 * Deterministic 2D Biomechanical Kinematics Engine — Barbell Bench Press (Side View)
 *
 * Pure TypeScript (zero React dependencies) so every pose, joint angle,
 * bar J-curve trajectory, clearance check, and loop seam can be mathematically
 * verified via automated tests.
 *
 * Coordinate Space (SVG viewBox: 0 0 360 220, ~0.85 cm per SVG unit):
 * - Floor plane:           y = 192
 * - Flat bench pad top:    y = 136 (pad thickness 11px: y = 136..147)
 * - Athlete head:          left side (~x = 84), resting on bench pad
 * - Shoulder pivot (GH):   S = (122, 120)
 * - Sternum touch zone:    lower-mid chest crest at (146, 107)
 * - Bar top lockout:       (122, 52) — directly stacked over shoulder joint
 * - Bar bottom touch:      (146, 102) — bar bottom edge (r=3.5 -> y=105.5) meets chest without penetration
 */

export type BenchPressPhase = 'setup' | 'eccentric' | 'bottom' | 'concentric' | 'lockout';

export interface Vec2 {
  x: number;
  y: number;
}

/** Standard 2D SVG affine matrix [a, b, c, d, tx, ty] */
export type AffineMatrix = readonly [number, number, number, number, number, number];

export interface BenchPressTiming {
  setupMs: number;
  eccentricMs: number;
  bottomMs: number;
  concentricMs: number;
  lockoutMs: number;
  totalMs: number;
}

export const BENCH_PRESS_TIMING: BenchPressTiming = {
  setupMs: 500,
  eccentricMs: 1750,
  bottomMs: 250,
  concentricMs: 1200,
  lockoutMs: 400,
  totalMs: 4100,
};

export const BENCH_VIEWBOX = {
  x: 24,
  y: 14,
  width: 284,
  height: 194,
  floorY: 192,
  benchTopY: 136,
  chestSurfaceYAtTouch: 106.5,
  barRadius: 3.5,
} as const;

export const BENCH_RIG = {
  /** Glenohumeral (shoulder) joint center */
  shoulder: { x: 122, y: 120 } as Vec2,
  /** Bar center at top lockout (directly over shoulder joint) */
  barTop: { x: 122, y: 52 } as Vec2,
  /** Bar center at chest touch (lower-to-mid sternum) */
  barBottom: { x: 146, y: 102 } as Vec2,
  /** Quadratic Bezier control point for controlled eccentric lowering */
  eccentricControl: { x: 137, y: 74 } as Vec2,
  /** Quadratic Bezier control point for realistic concentric J-curve back toward shoulders */
  concentricControl: { x: 131, y: 80 } as Vec2,
  /** True 3D humerus length in SVG units */
  upperArmLengthTop: 34.8,
  /** Minimum 2D projected upper arm at peak mid-rep 3D lateral elbow abduction (~65° out of plane) */
  upperArmLengthMidMin: 21.8,
  /** 2D projected upper-arm length at bottom chest touch */
  upperArmLengthBottom: 29.2,
  /** 2D projected forearm length (stacks near-vertical throughout the press) */
  forearmLength: 35.0,
} as const;

/**
 * Computes the physically realistic 2D side-view projected upper arm length as
 * the humerus abducts laterally out of the sagittal plane (~60–70° elbow tuck)
 * during descent and drops beside the ribcage at the chest touch.
 */
export function getProjectedUpperArmLength(depth: number): number {
  const d = clamp01(depth);
  // Smooth baseline transition from top to bottom
  const baseline = lerp(BENCH_RIG.upperArmLengthTop, BENCH_RIG.upperArmLengthBottom, d);
  // Peak 3D lateral foreshortening occurs mid-rep (~depth 0.45..0.55) when humerus points toward camera
  const midForeshorten = Math.sin(Math.PI * d);
  const dip = (baseline - BENCH_RIG.upperArmLengthMidMin) * 0.82 * Math.pow(midForeshorten, 1.15);
  return baseline - dip;
}

export interface BenchPressPose {
  /** Normalized cycle progress 0..1 */
  cycleProgress: number;
  /** Current biomechanical phase */
  phase: BenchPressPhase;
  /** Progress within current phase 0..1 */
  phaseProgress: number;
  /** Depth of press: 0 = lockout top, 1 = chest touch bottom */
  depth: number;
  /** Shoulder joint world position (subtle scapular settling <= 0.6px) */
  shoulder: Vec2;
  /** Computed analytical IK elbow world position */
  elbow: Vec2;
  /** Barbell / wrist grip center world position */
  bar: Vec2;
  /** Upper arm angle in radians (from shoulder -> elbow) */
  upperArmRad: number;
  /** Forearm & aligned wrist angle in radians (from elbow -> bar) */
  forearmRad: number;
  /** Interior elbow joint angle in degrees (anatomically valid ~55°..165°) */
  elbowAngleDeg: number;
  /** Forearm deviation from dead vertical in degrees */
  forearmVerticalDeviationDeg: number;
  /** Effective 2D projected upper arm length (for realistic 3D foreshortening scaleX) */
  upperArmScaleX: number;
  /** Primary muscle activation intensity (Pectoralis Major): 0.25..1.0 */
  pecActivation: number;
  /** Secondary muscle activation intensity (Anterior Deltoid & Triceps): 0.2..0.85 */
  secondaryActivation: number;
  /** Subtle ribcage inhale/brace vertical shift in px (0..1.1) */
  chestBraceLift: number;
}

/** Smooth cubic-bezier style ease-in-out with gentle eccentric deceleration */
export function easeInOutSine(t: number): number {
  const clamped = clamp01(t);
  return -(Math.cos(Math.PI * clamped) - 1) / 2;
}

/** Controlled eccentric easing: smooth start, steady mid-descent, cushioned touch on chest */
export function easeEccentric(t: number): number {
  const c = clamp01(t);
  // Quintic-blended sine for controlled muscular braking approaching the chest
  const sine = easeInOutSine(c);
  const smoothCubic = c * c * (3 - 2 * c);
  return sine * 0.55 + smoothCubic * 0.45;
}

/** Athletic concentric easing: decisive drive off the chest, controlled deceleration into soft lockout */
export function easeConcentric(t: number): number {
  const c = clamp01(t);
  // Smooth S-curve slightly front-loaded for realistic explosive press + controlled finish
  if (c < 0.42) {
    const u = c / 0.42;
    return 0.48 * (u * u * (2.2 - 1.2 * u));
  }
  const u = (c - 0.42) / 0.58;
  return 0.48 + 0.52 * (1 - Math.pow(1 - u, 2.35));
}

export function clamp01(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Evaluate a quadratic Bezier curve at parameter t in [0, 1] */
export function evalQuadBezier(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

/**
 * Analytical 2-bone Inverse Kinematics solver in 2D.
 * Computes elbow position `E` connecting `shoulder` (length L1) to `target` (length L2),
 * choosing the anatomically correct downward/caudal elbow bend (`bendSign = +1`).
 */
export function solveTwoBoneIK(
  shoulder: Vec2,
  target: Vec2,
  l1: number,
  l2: number,
  bendSign: 1 | -1 = 1
): { elbow: Vec2; elbowAngleDeg: number } {
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const rawDist = Math.hypot(dx, dy);

  // Guard against unreachable singularity while preserving smooth soft-lock
  const minDist = Math.abs(l1 - l2) + 0.5;
  const maxDist = l1 + l2 - 0.35;
  const d = Math.max(minDist, Math.min(maxDist, rawDist));

  const ux = rawDist > 1e-6 ? dx / rawDist : 0;
  const uy = rawDist > 1e-6 ? dy / rawDist : -1;

  // For vector pointing UP (0, -1), right-hand perpendicular (-uy, ux) = (+1, 0) points toward feet (+X) & floor (+Y)
  const nx = -uy * bendSign;
  const ny = ux * bendSign;

  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const hSq = Math.max(0, l1 * l1 - a * a);
  const h = Math.sqrt(hSq);

  const elbow: Vec2 = {
    x: shoulder.x + a * ux + h * nx,
    y: shoulder.y + a * uy + h * ny,
  };

  // Interior angle at the elbow joint via Law of Cosines
  const cosAngle = Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)));
  const elbowAngleDeg = (Math.acos(cosAngle) * 180) / Math.PI;

  return { elbow, elbowAngleDeg };
}

/**
 * Computes the complete, deterministic biomechanical pose of the Barbell Bench Press
 * at any elapsed time `elapsedMs` (automatically wraps seamlessly over `totalMs`).
 */
export function evaluateBenchPressPose(elapsedMs: number): BenchPressPose {
  const T = BENCH_PRESS_TIMING;
  const wrapped = ((elapsedMs % T.totalMs) + T.totalMs) % T.totalMs;
  const cycleProgress = wrapped / T.totalMs;

  const tSetupEnd = T.setupMs;
  const tEccEnd = tSetupEnd + T.eccentricMs;
  const tBotEnd = tEccEnd + T.bottomMs;
  const tConEnd = tBotEnd + T.concentricMs;

  let phase: BenchPressPhase;
  let phaseProgress: number;
  let depth: number;
  let bar: Vec2;
  let pecActivation: number;
  let secondaryActivation: number;
  let chestBraceLift: number;

  if (wrapped < tSetupEnd) {
    phase = 'setup';
    phaseProgress = wrapped / T.setupMs;
    depth = 0;
    bar = { ...BENCH_RIG.barTop };
    pecActivation = 0.28;
    secondaryActivation = 0.22;
    // Gentle inhale brace right before descent begins
    chestBraceLift = easeInOutSine(phaseProgress) * 0.45;
  } else if (wrapped < tEccEnd) {
    phase = 'eccentric';
    phaseProgress = (wrapped - tSetupEnd) / T.eccentricMs;
    depth = easeEccentric(phaseProgress);
    bar = evalQuadBezier(
      BENCH_RIG.barTop,
      BENCH_RIG.eccentricControl,
      BENCH_RIG.barBottom,
      depth
    );
    // Pec stretches and loads progressively toward the chest
    pecActivation = lerp(0.28, 0.88, depth);
    secondaryActivation = lerp(0.22, 0.65, depth);
    chestBraceLift = lerp(0.45, 1.05, depth);
  } else if (wrapped < tBotEnd) {
    phase = 'bottom';
    phaseProgress = (wrapped - tEccEnd) / T.bottomMs;
    depth = 1;
    bar = { ...BENCH_RIG.barBottom };
    // Peak tension at the chest turnaround
    pecActivation = lerp(0.88, 0.98, easeInOutSine(phaseProgress));
    secondaryActivation = lerp(0.65, 0.78, easeInOutSine(phaseProgress));
    chestBraceLift = 1.05;
  } else if (wrapped < tConEnd) {
    phase = 'concentric';
    phaseProgress = (wrapped - tBotEnd) / T.concentricMs;
    const pressProgress = easeConcentric(phaseProgress);
    depth = 1 - pressProgress;
    // Realistic J-curve: drives up & slightly back toward shoulder line earlier
    bar = evalQuadBezier(
      BENCH_RIG.barBottom,
      BENCH_RIG.concentricControl,
      BENCH_RIG.barTop,
      pressProgress
    );
    // Strong pec drive through mid-range, triceps + front delt peak toward lockout
    pecActivation = lerp(0.98, 0.34, Math.pow(pressProgress, 1.4));
    secondaryActivation = 0.78 + Math.sin(pressProgress * Math.PI) * 0.14 - pressProgress * 0.48;
    chestBraceLift = lerp(1.05, 0.2, pressProgress);
  } else {
    phase = 'lockout';
    phaseProgress = (wrapped - tConEnd) / T.lockoutMs;
    depth = 0;
    bar = { ...BENCH_RIG.barTop };
    pecActivation = lerp(0.34, 0.28, easeInOutSine(phaseProgress));
    secondaryActivation = lerp(0.3, 0.22, easeInOutSine(phaseProgress));
    chestBraceLift = lerp(0.2, 0, easeInOutSine(phaseProgress));
  }

  // Scapulae remain retracted & pinned to the bench (negligible ~0.5px natural load compression)
  const shoulder: Vec2 = {
    x: BENCH_RIG.shoulder.x + depth * 0.4,
    y: BENCH_RIG.shoulder.y + depth * 0.5,
  };

  const upperArmLen = getProjectedUpperArmLength(depth);
  const forearmLen = BENCH_RIG.forearmLength;

  const { elbow, elbowAngleDeg } = solveTwoBoneIK(shoulder, bar, upperArmLen, forearmLen, 1);

  const upperArmRad = Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x);
  const forearmRad = Math.atan2(bar.y - elbow.y, bar.x - elbow.x);

  // Forearm verticality relative to straight up (-PI/2)
  const verticalRad = -Math.PI / 2;
  const forearmVerticalDeviationDeg = Math.abs(((forearmRad - verticalRad) * 180) / Math.PI);

  const upperArmScaleX = upperArmLen / BENCH_RIG.upperArmLengthTop;

  return {
    cycleProgress,
    phase,
    phaseProgress,
    depth,
    shoulder,
    elbow,
    bar,
    upperArmRad,
    forearmRad,
    elbowAngleDeg,
    forearmVerticalDeviationDeg,
    upperArmScaleX,
    pecActivation,
    secondaryActivation,
    chestBraceLift,
  };
}

/**
 * Builds a 2D affine matrix `[a, b, c, d, tx, ty]` that translates local `(0,0)`
 * to `(px, py)`, rotates by `rad`, and optionally scales along local X (`scaleX`).
 */
export function buildJointMatrix(
  px: number,
  py: number,
  rad: number,
  scaleX = 1
): AffineMatrix {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [cos * scaleX, sin * scaleX, -sin, cos, px, py];
}

/** Pure translation 2D affine matrix `[1, 0, 0, 1, tx, ty]` */
export function buildTranslationMatrix(tx: number, ty: number): AffineMatrix {
  return [1, 0, 0, 1, tx, ty];
}

/** Formats `[a, b, c, d, tx, ty]` for SVG `transform="matrix(...)"` on Web */
export function matrixToSvgString(m: AffineMatrix): string {
  return `matrix(${m[0].toFixed(4)} ${m[1].toFixed(4)} ${m[2].toFixed(4)} ${m[3].toFixed(4)} ${m[4].toFixed(2)} ${m[5].toFixed(2)})`;
}

/** Returns the static SVG path for the realistic J-curve guide (eccentric + concentric) */
export function getBenchBarPathSvg(): { eccentricPath: string; concentricPath: string } {
  const { barTop, barBottom, eccentricControl, concentricControl } = BENCH_RIG;
  return {
    eccentricPath: `M ${barTop.x} ${barTop.y} Q ${eccentricControl.x} ${eccentricControl.y} ${barBottom.x} ${barBottom.y}`,
    concentricPath: `M ${barBottom.x} ${barBottom.y} Q ${concentricControl.x} ${concentricControl.y} ${barTop.x} ${barTop.y}`,
  };
}

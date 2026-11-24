/**
 * SPOT 3D Muscular Anatomy Prototype Verification Suite (Project 001: Barbell Bench Press)
 *
 * Verifies:
 * 1. Locally bundled Male & Female 3D anatomical MP4 assets exist, have valid MP4 ftyp headers,
 *    and stay lightweight for offline mobile delivery.
 * 2. Strict exercise registry matching (EN/UK Barbell Bench Press vs excluded variants).
 * 3. ExerciseAnatomyStage lifecycle safety (muted, mixWithOthers, AppState pause, ReducedMotion,
 *    Male/Female model switcher, and CC BY-SA attribution).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');

function loadTsWithAssetStub(relPath) {
  const fullPath = path.resolve(ROOT, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: fullPath,
  });

  const mod = { exports: {} };
  const localRequire = (spec) => {
    if (spec.endsWith('.mp4')) return spec;
    return {};
  };
  const fn = vm.runInThisContext(
    `(function(exports, require, module, __filename, __dirname) {\n${transpiled.outputText}\n})`,
    { filename: fullPath }
  );
  fn(mod.exports, localRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

console.log('\n--- Running SPOT 3D Muscular Anatomy Verification Suite ---\n');

// TEST 1: Verify rendered Male & Female MP4 assets exist, are valid MP4 containers, and mobile-optimized
const maleMp4 = path.join(ROOT, 'assets/animations/barbell_bench_press_male.mp4');
const femaleMp4 = path.join(ROOT, 'assets/animations/barbell_bench_press_female.mp4');

for (const [label, filePath] of [['Male', maleMp4], ['Female', femaleMp4]]) {
  assert(fs.existsSync(filePath), `${label} 3D anatomy MP4 missing: ${filePath}`);
  const stat = fs.statSync(filePath);
  assert(stat.size > 50 * 1024, `${label} MP4 unexpectedly small (${stat.size} bytes)`);
  assert(stat.size < 3 * 1024 * 1024, `${label} MP4 exceeds 3MB mobile budget (${stat.size} bytes)`);

  // Check ISO Base Media 'ftyp' box in header bytes 4..8
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  const boxType = buf.slice(4, 8).toString('ascii');
  assert.strictEqual(boxType, 'ftyp', `${label} file is not a valid MP4 container (got '${boxType}')`);
}
console.log(
  `✅ TEST 1 PASSED: Male (${(fs.statSync(maleMp4).size / 1024).toFixed(0)} KB) & Female (${(fs.statSync(femaleMp4).size / 1024).toFixed(0)} KB) 3D MP4 assets verified`
);

// TEST 2: Strict exercise video registry matching
const reg = loadTsWithAssetStub('lib/exerciseAnatomyVideos.ts');
assert.strictEqual(reg.getExerciseAnatomyVideo('Barbell Bench Press', 'barbell')?.id, 'barbell_bench_press');
assert.strictEqual(reg.getExerciseAnatomyVideo('Bench Press')?.id, 'barbell_bench_press');
assert.strictEqual(reg.getExerciseAnatomyVideo('Жим штанги лежачи', 'barbell')?.id, 'barbell_bench_press');
assert.strictEqual(reg.getExerciseAnatomyVideo('Жим лежачи')?.id, 'barbell_bench_press');
assert.strictEqual(reg.getExerciseAnatomyVideo('Incline Barbell Bench Press', 'barbell'), null);
assert.strictEqual(reg.getExerciseAnatomyVideo('Dumbbell Bench Press', 'dumbbells'), null);
assert.strictEqual(reg.getExerciseAnatomyVideo('Machine Chest Press', 'machines'), null);
assert.strictEqual(reg.getExerciseAnatomyVideo('Жим гантелей під кутом', 'dumbbells'), null);
console.log('✅ TEST 2 PASSED: Registry strictly resolves Flat Barbell Bench Press (EN/UK) and rejects mismatched variants');

// TEST 3: Mobile player hygiene, audio mixing, lifecycle pause, Male/Female toggle, and attribution
const stageSrc = fs.readFileSync(path.join(ROOT, 'components/exercises/ExerciseAnatomyStage.tsx'), 'utf8');
assert(stageSrc.includes('useVideoPlayer'), 'Must use expo-video useVideoPlayer');
assert(stageSrc.includes('mixWithOthers'), 'Must configure mixWithOthers so workout music never stops');
assert(stageSrc.includes('p.muted = true'), 'Must mute video loop');
assert(stageSrc.includes('p.loop = true'), 'Must loop seamlessly');
assert(stageSrc.includes('AppState.addEventListener'), 'Must pause when app goes to background');
assert(stageSrc.includes('useReducedMotion'), 'Must respect OS Reduce Motion');
assert(stageSrc.includes('selectedSex'), 'Must support Male / Female 3D anatomical model switching');
assert(stageSrc.includes('spec.attribution'), 'Must display Z-Anatomy / BodyParts3D attribution');
console.log('✅ TEST 3 PASSED: ExerciseAnatomyStage verified (expo-video, mixWithOthers, AppState, ReduceMotion, M/F toggle, attribution)');

// TEST 4: Blender pipeline script exists and classifies Pectoralis Major (primary) & Anterior Deltoid + Triceps (secondary)
const blenderSrc = fs.readFileSync(path.join(ROOT, 'tools/3d-anatomy/build_bench_press.py'), 'utf8');
assert(blenderSrc.includes('"pectoralis major"'), 'Blender pipeline must classify Pectoralis Major as primary');
assert(blenderSrc.includes('"clavicular part of deltoid"'), 'Blender pipeline must classify Anterior Deltoid as secondary');
assert(blenderSrc.includes('"triceps brachii"'), 'Blender pipeline must classify Triceps Brachii as secondary');
console.log('✅ TEST 4 PASSED: Blender 3D écorché pipeline verified (Primary: Pectoralis Major, Secondary: Anterior Deltoid + Triceps Brachii)');

console.log('\n🎉 ALL 4 3D MUSCULAR ANATOMY TESTS PASSED!\n');

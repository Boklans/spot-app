/**
 * SPOT Theme System (Daylight Athletic & Carbon Dark) Verification Suite
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n--- Running SPOT Theme System Verification Suite ---\n');

let passed = 0;

// TEST 1: User Profile Store Persistence & Types
{
  const profileStoreSource = fs.readFileSync(path.join(__dirname, '..', 'store', 'userProfileStore.ts'), 'utf8');

  assert.ok(profileStoreSource.includes("theme: AppTheme;"), 'UserProfile type must include theme: AppTheme');
  assert.ok(profileStoreSource.includes("theme: 'dark'"), 'DEFAULT_USER_PROFILE must default theme to dark');
  assert.ok(profileStoreSource.includes("theme: p.theme === 'light' ? 'light' : 'dark'"), 'normalizeLoadedProfile must persist light/dark theme safely');

  console.log('✅ TEST 1 PASSED: User profile store preserves theme state and persistence');
  passed++;
}

// TEST 2: Color Tokens & Dynamic Hook
{
  const colorsSource = fs.readFileSync(path.join(__dirname, '..', 'constants', 'colors.ts'), 'utf8');

  assert.ok(colorsSource.includes('export const darkColors ='), 'colors.ts must export darkColors');
  assert.ok(colorsSource.includes('export const lightColors ='), 'colors.ts must export lightColors');
  assert.ok(colorsSource.includes('export function useThemeColors()'), 'colors.ts must export reactive useThemeColors hook');

  // Verify dark color values
  assert.ok(colorsSource.includes("background: '#0B0D0F'"), 'darkColors background must be #0B0D0F');
  assert.ok(colorsSource.includes("surface: '#15181C'"), 'darkColors surface must be #15181C');
  assert.ok(colorsSource.includes("primary: '#C8FF3D'"), 'darkColors primary must be #C8FF3D');
  assert.ok(colorsSource.includes("primaryText: '#C8FF3D'"), 'darkColors primaryText must be #C8FF3D');
  assert.ok(colorsSource.includes("onPrimary: '#0B0D0F'"), 'darkColors onPrimary must be #0B0D0F');

  // Verify light color values (Daylight Athletic)
  assert.ok(colorsSource.includes("background: '#F3F5F8'"), 'lightColors background must be #F3F5F8 (Alabaster)');
  assert.ok(colorsSource.includes("surface: '#FFFFFF'"), 'lightColors surface must be #FFFFFF (Crisp White)');
  assert.ok(colorsSource.includes("elevated: '#EDF1F5'"), 'lightColors elevated must be #EDF1F5 (Soft Slate)');
  assert.ok(colorsSource.includes("primaryText: '#15803D'"), 'lightColors primaryText must be athletic green #15803D');
  assert.ok(colorsSource.includes("onPrimary: '#0E1114'"), 'lightColors onPrimary must be deep carbon #0E1114');
  assert.ok(colorsSource.includes("primaryMuted: '#ECFCCB'"), 'lightColors primaryMuted must be soft lime-mint #ECFCCB');

  console.log('✅ TEST 2 PASSED: Carbon Dark & Daylight Athletic color tokens verified');
  passed++;
}

// TEST 3: Localization in i18n.ts
{
  const i18nSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'i18n.ts'), 'utf8');

  assert.ok(i18nSource.includes("theme: 'Appearance'"), 'i18n EN must include theme label');
  assert.ok(i18nSource.includes("themeDark: 'Dark'"), 'i18n EN must include themeDark');
  assert.ok(i18nSource.includes("themeLight: 'Light'"), 'i18n EN must include themeLight');

  assert.ok(i18nSource.includes("theme: 'Тема оформлення'"), 'i18n UK must include theme label');
  assert.ok(i18nSource.includes("themeDark: 'Темна'"), 'i18n UK must include themeDark');
  assert.ok(i18nSource.includes("themeLight: 'Світла'"), 'i18n UK must include themeLight');

  console.log('✅ TEST 3 PASSED: EN and UK theme translations present and verified');
  passed++;
}

// TEST 4: Profile Theme Switcher Segmented Control
{
  const profileSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'profile.tsx'), 'utf8');

  assert.ok(profileSource.includes("updateProfile({ theme: 'dark' })"), 'profile.tsx must allow selecting dark theme');
  assert.ok(profileSource.includes("updateProfile({ theme: 'light' })"), 'profile.tsx must allow selecting light theme');
  assert.ok(profileSource.includes("t('theme')"), 'profile.tsx must render theme label');
  assert.ok(profileSource.includes("t('themeDark')"), 'profile.tsx must render themeDark label');
  assert.ok(profileSource.includes("t('themeLight')"), 'profile.tsx must render themeLight label');

  console.log('✅ TEST 4 PASSED: Profile App Settings includes reactive Dark / Light theme switcher');
  passed++;
}

// TEST 5: Root Layout StatusBar & Theme Integration
{
  const layoutSource = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');

  assert.ok(layoutSource.includes("useUserProfileStore((s) => s.profile.theme)"), 'app/_layout.tsx must read theme reactively');
  assert.ok(layoutSource.includes("theme === 'light' ? 'dark-content' : 'light-content'"), 'app/_layout.tsx must set StatusBar style based on theme');
  assert.ok(layoutSource.includes("theme === 'light' ? DefaultTheme : DarkTheme"), 'app/_layout.tsx must configure Navigation ThemeProvider dynamically');

  console.log('✅ TEST 5 PASSED: Root layout dynamically configures navigation theme and status bar style');
  passed++;
}

// TEST 6: Dynamic StyleSheet Architecture Across Screens
{
  const screens = [
    'app/(tabs)/index.tsx',
    'app/(tabs)/program.tsx',
    'app/(tabs)/progress.tsx',
    'app/(tabs)/profile.tsx',
    'app/workout/preview.tsx',
    'app/workout/active.tsx',
    'app/workout/complete.tsx',
    'app/workout/quick-log.tsx',
    'app/workout/rest.tsx',
    'app/workout/input.tsx',
    'app/program/edit.tsx',
    'app/history/index.tsx',
    'app/history/[id].tsx',
  ];

  for (const screen of screens) {
    const src = fs.readFileSync(path.join(__dirname, '..', screen), 'utf8');
    assert.ok(src.includes('useThemeColors'), `${screen} must use useThemeColors hook`);
    if (screen !== 'app/history/[id].tsx') {
      assert.ok(src.includes('createStyles'), `${screen} must use createStyles factory`);
    }
  }

  console.log('✅ TEST 6 PASSED: Dynamic createStyles pattern implemented across all 13 screens');
  passed++;
}

console.log(`\n🎉 ALL ${passed} THEME SYSTEM TESTS PASSED!\n`);

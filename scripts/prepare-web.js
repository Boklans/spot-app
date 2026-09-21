const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const htmlFile = path.join(distDir, 'index.html');
const redirectsFile = path.join(distDir, '_redirects');

if (!fs.existsSync(distDir) || !fs.existsSync(htmlFile)) {
  console.error('dist/index.html not found. Run "npx expo export -p web" first.');
  process.exit(1);
}

// 1. Ensure SPA routing redirect
fs.writeFileSync(redirectsFile, '/*    /index.html   200\n', 'utf8');
console.log('✓ Created dist/_redirects for SPA routing');

// 2. Find font files
const fontsBaseDir = path.join(
  distDir,
  'assets',
  'node_modules',
  '@expo',
  'vector-icons',
  'build',
  'vendor',
  'react-native-vector-icons',
  'Fonts'
);

const cleanFontsDir = path.join(distDir, 'fonts');
if (!fs.existsSync(cleanFontsDir)) {
  fs.mkdirSync(cleanFontsDir, { recursive: true });
}

let ioniconsFile = null;
let mciFile = null;

if (fs.existsSync(fontsBaseDir)) {
  for (const f of fs.readdirSync(fontsBaseDir)) {
    if (f.startsWith('Ionicons.') && f.endsWith('.ttf')) {
      ioniconsFile = path.join(fontsBaseDir, f);
      fs.copyFileSync(ioniconsFile, path.join(cleanFontsDir, 'Ionicons.ttf'));
    }
    if (f.startsWith('MaterialCommunityIcons.') && f.endsWith('.ttf')) {
      mciFile = path.join(fontsBaseDir, f);
      fs.copyFileSync(mciFile, path.join(cleanFontsDir, 'MaterialCommunityIcons.ttf'));
    }
  }
}

// Fallback to node_modules directly if not found in dist
if (!ioniconsFile) {
  ioniconsFile = path.resolve(
    __dirname,
    '..',
    'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'
  );
  if (fs.existsSync(ioniconsFile)) {
    fs.copyFileSync(ioniconsFile, path.join(cleanFontsDir, 'Ionicons.ttf'));
  }
}
if (!mciFile) {
  mciFile = path.resolve(
    __dirname,
    '..',
    'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'
  );
  if (fs.existsSync(mciFile)) {
    fs.copyFileSync(mciFile, path.join(cleanFontsDir, 'MaterialCommunityIcons.ttf'));
  }
}

if (!fs.existsSync(ioniconsFile) || !fs.existsSync(mciFile)) {
  console.error('Could not locate Ionicons or MaterialCommunityIcons TTF files!');
  process.exit(1);
}

const ioniconsBase64 = fs.readFileSync(ioniconsFile).toString('base64');
const mciBase64 = fs.readFileSync(mciFile).toString('base64');

const ioniconsDataUri = `data:font/truetype;charset=utf-8;base64,${ioniconsBase64}`;
const mciDataUri = `data:font/truetype;charset=utf-8;base64,${mciBase64}`;

const fontRules = [];

// Ionicons aliases
const ioniconsFamilies = [
  'ionicons',
  'Ionicons',
  'Ionicons, "Helvetica Neue", Arial',
];

// MaterialCommunityIcons aliases
const mciFamilies = [
  'material-community',
  'MaterialCommunityIcons',
  'Material Community Icons',
  'MaterialDesignIcons',
  'MaterialCommunityIcons, "Helvetica Neue", Arial',
];

for (const fam of ioniconsFamilies) {
  fontRules.push(`@font-face {
  font-family: ${JSON.stringify(fam)};
  src: url("${ioniconsDataUri}") format('truetype'),
       url("/fonts/Ionicons.ttf") format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}`);
}

for (const fam of mciFamilies) {
  fontRules.push(`@font-face {
  font-family: ${JSON.stringify(fam)};
  src: url("${mciDataUri}") format('truetype'),
       url("/fonts/MaterialCommunityIcons.ttf") format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}`);
}

// Also add a universal fallback class for React Native Web icon elements
fontRules.push(`
[style*="font-family: ionicons"],
[style*="font-family: Ionicons"],
[style*="font-family: 'ionicons'"],
[style*="font-family: 'Ionicons'"] {
  font-family: ionicons, Ionicons !important;
}

[style*="font-family: material-community"],
[style*="font-family: MaterialCommunityIcons"],
[style*="font-family: 'material-community'"],
[style*="font-family: 'MaterialCommunityIcons'"] {
  font-family: material-community, MaterialCommunityIcons !important;
}
`);

let html = fs.readFileSync(htmlFile, 'utf8');
html = html.replace(/<style id="expo-vector-icons-fonts">[\s\S]*?<\/style>/, '');

const styleTag = `\n    <style id="expo-vector-icons-fonts">\n${fontRules.join('\n')}\n    </style>`;
html = html.replace('</head>', `${styleTag}\n  </head>`);

fs.writeFileSync(htmlFile, html, 'utf8');
console.log('✓ Successfully embedded Base64 Data URIs for Ionicons & MaterialCommunityIcons into dist/index.html');
console.log('✓ Copied font files to dist/fonts/ as fallback');

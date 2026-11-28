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

// 2. Find Ionicons font file (MaterialCommunityIcons removed in SPOT 2.0 to save 1.15 MB)
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

if (fs.existsSync(fontsBaseDir)) {
  for (const f of fs.readdirSync(fontsBaseDir)) {
    if (f.startsWith('Ionicons.') && f.endsWith('.ttf')) {
      ioniconsFile = path.join(fontsBaseDir, f);
      fs.copyFileSync(ioniconsFile, path.join(cleanFontsDir, 'Ionicons.ttf'));
    }
  }
}

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

if (!fs.existsSync(ioniconsFile)) {
  console.error('Could not locate Ionicons TTF file!');
  process.exit(1);
}

const ioniconsBase64 = fs.readFileSync(ioniconsFile).toString('base64');
const ioniconsDataUri = `data:font/truetype;charset=utf-8;base64,${ioniconsBase64}`;

const fontRules = [];
const ioniconsFamilies = [
  'ionicons',
  'Ionicons',
  'Ionicons, "Helvetica Neue", Arial',
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

fontRules.push(`
[style*="font-family: ionicons"],
[style*="font-family: Ionicons"],
[style*="font-family: 'ionicons'"],
[style*="font-family: 'Ionicons'"] {
  font-family: ionicons, Ionicons !important;
}
`);

let html = fs.readFileSync(htmlFile, 'utf8');
html = html.replace(/<style id="expo-vector-icons-fonts">[\s\S]*?<\/style>/, '');

const styleTag = `\n    <style id="expo-vector-icons-fonts">\n${fontRules.join('\n')}\n    </style>`;
html = html.replace('</head>', `${styleTag}\n  </head>`);

fs.writeFileSync(htmlFile, html, 'utf8');
console.log('✓ Successfully embedded Base64 Data URI for Ionicons into dist/index.html (-1.15 MB MaterialCommunityIcons purged)');
console.log('✓ Copied Ionicons.ttf to dist/fonts/ as fallback');

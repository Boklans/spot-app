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

// 2. Scan for icon font files in dist
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

let fontFaces = [];

if (fs.existsSync(fontsBaseDir)) {
  const files = fs.readdirSync(fontsBaseDir);
  for (const file of files) {
    if (!file.endsWith('.ttf')) continue;

    const baseName = file.split('.')[0]; // e.g. "Ionicons"
    const publicUrl = `/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/${file}`;
    const assetPathWithoutExt = publicUrl.replace(/\.ttf$/, '');

    // List of aliases to cover every possible way react-native-vector-icons or web requests this font
    const familyAliases = new Set([
      baseName,
      baseName.toLowerCase(),
      assetPathWithoutExt,
    ]);

    if (baseName === 'Ionicons') {
      familyAliases.add('ionicons');
      familyAliases.add('Ionicons');
    } else if (baseName === 'MaterialCommunityIcons') {
      familyAliases.add('material-community');
      familyAliases.add('MaterialCommunityIcons');
      familyAliases.add('Material Community Icons');
      familyAliases.add('MaterialDesignIcons');
    } else if (baseName === 'MaterialIcons') {
      familyAliases.add('material');
      familyAliases.add('MaterialIcons');
      familyAliases.add('Material Icons');
    } else if (baseName === 'FontAwesome') {
      familyAliases.add('FontAwesome');
      familyAliases.add('fontawesome');
    } else if (baseName === 'Feather') {
      familyAliases.add('feather');
      familyAliases.add('Feather');
    }

    for (const family of familyAliases) {
      fontFaces.push(`@font-face {
  font-family: ${JSON.stringify(family)};
  src: url(${JSON.stringify(publicUrl)}) format('truetype');
  font-display: swap;
}`);
    }
  }
}

console.log(`✓ Generated ${fontFaces.length} @font-face rules`);

// 3. Inject into index.html
let html = fs.readFileSync(htmlFile, 'utf8');

// Remove any previous injection if present
html = html.replace(/<style id="expo-vector-icons-fonts">[\s\S]*?<\/style>/, '');

const styleBlock = `\n    <style id="expo-vector-icons-fonts">\n${fontFaces.join('\n')}\n    </style>`;

html = html.replace('</head>', `${styleBlock}\n  </head>`);
fs.writeFileSync(htmlFile, html, 'utf8');
console.log('✓ Successfully injected icon fonts into dist/index.html');

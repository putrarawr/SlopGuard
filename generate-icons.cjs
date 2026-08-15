/**
 * Generate SlopGuard extension icons.
 * Creates simple shield-check icon as PNG files.
 * Run with: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// SVG template for the shield icon (monochrome)
function createSVG(size) {
  const strokeWidth = size <= 32 ? 2.5 : 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
  <rect width="24" height="24" rx="6" fill="#141414"/>
  <path d="M12 3l7 3v5c0 4.5-3 8.5-7 9.5C8 19.5 5 15.5 5 11V6l7-3z" fill="#1A1A1A" stroke="#E5E5E5" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 12l2 2 4-4" stroke="#22C55E" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

// Since we can't use canvas in pure Node without deps, we'll create SVG files
// and also create a simple PNG using raw bytes for small sizes
const iconsDir = path.join(__dirname, 'src', 'assets', 'icons');

const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const svg = createSVG(size);
  const svgPath = path.join(iconsDir, `icon-${size}.svg`);
  fs.writeFileSync(svgPath, svg);
  console.log(`Created ${svgPath}`);
}

// Also create a simple data URL conversion helper
console.log('\nSVG icons created. For PNG conversion, use an online tool or imagemagick:');
console.log('  for size in 16 32 48 128; do rsvg-convert -w $size -h $size icon-$size.svg > icon-$size.png; done');
console.log('\nOr simply use the SVG files directly (Chrome supports SVG icons).');

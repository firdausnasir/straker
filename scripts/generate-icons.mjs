// One-off: render brand PWA icons from the earthy palette into public/icons.
// Run after changing the mark or palette:  node scripts/generate-icons.mjs
//
// Output: icon-192/512 (any), icon-192/512-maskable (safe-zone padded),
// apple-touch-icon (180, full-bleed). All derive from an inline SVG so there
// is no binary source asset to keep in sync.

import { mkdirSync } from "node:fs";
import sharp from "sharp";

const CLAY = "#b75a3c"; // --clay (brand)
const CLAY_DEEP = "#9c4a30"; // gradient foot, adds depth
const CREAM = "#faf5ea"; // --parchment (the mark)

const OUT_DIR = "public/icons";
mkdirSync(OUT_DIR, { recursive: true });

// `corner` rounds the plate (0 = full square for maskable/apple — the OS masks).
// `letterRatio` is the cap height as a fraction of the canvas (smaller = more
// safe-zone padding, required for maskable icons).
function svg(size, { corner, letterRatio }) {
  const fontPx = Math.round(size * letterRatio);
  const radius = Math.round(size * corner);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${CLAY}"/>
      <stop offset="1" stop-color="${CLAY_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#g)"/>
  <text x="50%" y="50%" dy="0.02em" text-anchor="middle" dominant-baseline="central"
    font-family="Georgia, 'Times New Roman', serif" font-weight="600"
    font-size="${fontPx}" fill="${CREAM}">S</text>
</svg>`);
}

const targets = [
  { file: "icon-192.png", size: 192, opts: { corner: 0.22, letterRatio: 0.62 } },
  { file: "icon-512.png", size: 512, opts: { corner: 0.22, letterRatio: 0.62 } },
  { file: "icon-192-maskable.png", size: 192, opts: { corner: 0, letterRatio: 0.46 } },
  { file: "icon-512-maskable.png", size: 512, opts: { corner: 0, letterRatio: 0.46 } },
  { file: "apple-touch-icon.png", size: 180, opts: { corner: 0, letterRatio: 0.62 } },
];

for (const { file, size, opts } of targets) {
  const dir = file === "apple-touch-icon.png" ? "public" : OUT_DIR;
  await sharp(svg(size, opts)).png().toFile(`${dir}/${file}`);
  console.log(`wrote ${dir}/${file}`);
}

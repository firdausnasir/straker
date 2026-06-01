// One-off: render brand PWA icons from the earthy palette into public/icons.
// Run after changing the mark or palette:  node scripts/generate-icons.mjs
//
// Output: icon-192/512 (any), icon-192/512-maskable (safe-zone padded),
// apple-touch-icon (180, full-bleed). All derive from an inline SVG so there
// is no binary source asset to keep in sync. The glyph is the "Coin Day"
// brand mark (scripts/lib/brand-mark.mjs), not typography. On the clay plate
// both the calendar and the coin-day render in cream — the plate itself is the
// clay accent, so cream-on-clay gives the highest-contrast, cleanest icon.

import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { mark } from "./lib/brand-mark.mjs";

const CLAY = "#b75a3c"; // --clay (brand)
const CLAY_DEEP = "#9c4a30"; // gradient foot, adds depth
const CREAM = "#faf5ea"; // --parchment (the mark)

const OUT_DIR = "public/icons";
mkdirSync(OUT_DIR, { recursive: true });

// `corner` rounds the plate (0 = full square for maskable/apple — the OS masks).
// `ratio` is the mark's card half-width as a fraction of the canvas (smaller =
// more safe-zone padding, required for maskable icons).
function svg(size, { corner, ratio }) {
  const radius = Math.round(size * corner);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${CLAY}"/>
      <stop offset="1" stop-color="${CLAY_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#g)"/>
  ${mark(size, CREAM, CREAM, ratio)}
</svg>`);
}

const targets = [
  { file: "icon-192.png", size: 192, opts: { corner: 0.22, ratio: 0.28 } },
  { file: "icon-512.png", size: 512, opts: { corner: 0.22, ratio: 0.28 } },
  { file: "icon-192-maskable.png", size: 192, opts: { corner: 0, ratio: 0.22 } },
  { file: "icon-512-maskable.png", size: 512, opts: { corner: 0, ratio: 0.22 } },
  { file: "apple-touch-icon.png", size: 180, opts: { corner: 0, ratio: 0.28 } },
];

for (const { file, size, opts } of targets) {
  const dir = file === "apple-touch-icon.png" ? "public" : OUT_DIR;
  await sharp(svg(size, opts)).png().toFile(`${dir}/${file}`);
  console.log(`wrote ${dir}/${file}`);
}

// Browser-tab favicon: a multi-size .ico (16/32/48). Next App Router serves
// src/app/favicon.ico automatically. A slightly larger `ratio` keeps the
// calendar legible at 16px; corners stay nearly square so the mark fills the tab.
const favBuffers = await Promise.all(
  [16, 32, 48].map((size) =>
    sharp(svg(size, { corner: 0.18, ratio: 0.34 })).png().toBuffer()
  )
);
writeFileSync("src/app/favicon.ico", await pngToIco(favBuffers));
console.log("wrote src/app/favicon.ico");

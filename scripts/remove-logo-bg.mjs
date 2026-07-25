// One-shot: convert public/logo.jpg → public/logo.png with a transparent background.
// Every pixel whose RGB values are all >= WHITE_THRESHOLD becomes fully transparent.
// Pixels near the threshold get a soft alpha edge to avoid hard/jagged outlines.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const inPath  = resolve(__dirname, "..", "public", "logo.jpg");
const outPath = resolve(__dirname, "..", "public", "logo.png");

const HARD_WHITE = 245;   // >= this on all channels → fully transparent
const SOFT_EDGE  = 220;   // 220–244 → gradient alpha

const img = sharp(inPath).ensureAlpha();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

if (channels !== 4) throw new Error(`Expected 4 channels, got ${channels}`);

const out = Buffer.alloc(data.length);
let cleared = 0, kept = 0, soft = 0;

for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const minRGB = Math.min(r, g, b);

  out[i]     = r;
  out[i + 1] = g;
  out[i + 2] = b;

  if (minRGB >= HARD_WHITE) {
    out[i + 3] = 0; cleared++;
  } else if (minRGB >= SOFT_EDGE) {
    // Linear ramp: 220 → 255 alpha, 244 → 0 alpha
    const t = (minRGB - SOFT_EDGE) / (HARD_WHITE - SOFT_EDGE);
    out[i + 3] = Math.round(255 * (1 - t));
    soft++;
  } else {
    out[i + 3] = 255; kept++;
  }
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(outPath);

const totalPx = width * height;
console.log(`✓ Wrote ${outPath}`);
console.log(`  ${width}×${height} px, ${(cleared/totalPx*100).toFixed(1)}% transparent, ${(soft/totalPx*100).toFixed(1)}% soft edge, ${(kept/totalPx*100).toFixed(1)}% opaque.`);

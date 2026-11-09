// Topographic rings: a few Gaussian hills, then thick iso-bands between thresholds. Not a sine.
import { SHEET } from "../geometry.mjs";
import { blankMask, poseOf } from "./pose.mjs";
import { fillMask } from "./chords.mjs";

export const CONTOUR = { size: 5.6, pitch: 6.6 };
const FIXED = [
  [0.4, 0.4, 200, 1],
  [0.68, 0.58, 160, 0.85],
  [0.5, 0.78, 140, 0.7],
];

function hills(floor, pose) {
  const n = pose.identity ? 3 : 2 + Math.floor(pose.rnd() * 3);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (pose.identity) {
      const [x, y, s, a] = FIXED[i];
      out.push({ x: x * SHEET.width, y: y * floor, s, a });
    } else {
      out.push({
        x: SHEET.width * (0.32 + pose.rnd() * 0.4),
        y: floor * (0.28 + pose.rnd() * 0.48),
        s: 130 + pose.rnd() * 120,
        a: 0.65 + pose.rnd() * 0.45,
      });
    }
  }
  return out;
}

function paint(mask, floor, bumps, bands) {
  const { step, w, h, bits } = mask;
  const thick = 0.07;
  for (let y = 0; y < h; y++) {
    const py = (y + 0.5) * step;
    if (py > floor) break;
    for (let x = 0; x < w; x++) {
      const px = (x + 0.5) * step;
      let f = 0;
      for (const b of bumps) {
        const dx = (px - b.x) / b.s;
        const dy = (py - b.y) / b.s;
        f += b.a * Math.exp(-(dx * dx + dy * dy));
      }
      for (const level of bands) {
        if (f >= level && f < level + thick) {
          bits[y * w + x] = 1;
          break;
        }
      }
    }
  }
  // A second pass fattens each ring so the bands read at thumbnail size.
  const grown = new Uint8Array(bits);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!bits[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) grown[(y + dy) * w + (x + dx)] = 1;
    }
  }
  bits.set(grown);
}

/** Rows of nested contour rings. */
export function contourRows(region, parts, opts) {
  const pose = poseOf(region.seed);
  const nBand = pose.identity ? 5 : 4 + Math.floor(pose.rnd() * 4);
  const bands = Array.from({ length: nBand }, (_, i) => 0.22 + (i * 0.62) / nBand);
  const mask = blankMask(opts.floor);
  paint(mask, opts.floor, hills(opts.floor, pose), bands);
  return fillMask(mask, region, parts, opts, CONTOUR);
}

// Slabs: stacked bars of type, horizontal slabs with gaps between them. Edges stagger; they do not share a sine.
import { SHEET } from "../geometry.mjs";
import { blankMask, poseOf, stampRect } from "./pose.mjs";
import { fillMask } from "./chords.mjs";

export const SLABS = { size: 6.4, pitch: 7.4 };
const LEFTS = [56, 180, 48, 240, 96, 200, 64, 150, 80, 220, 52, 120];

function slabs(floor, parts, pose) {
  const n = pose.identity ? 9 : 6 + Math.floor(pose.rnd() * 7);
  const gap = pose.identity ? 16 : 8 + pose.rnd() * 16;
  const sky = Math.min(floor * 0.16, 170);
  const h = (floor - sky - gap * (n - 1)) / n;
  const total = parts.reduce((s, p) => s + Math.max(1, p.loc), 0) || 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const share = Math.max(1, parts[i % parts.length].loc) / total;
    const jitter = pose.identity ? 0 : (pose.rnd() - 0.5) * 70;
    const left = Math.max(48, Math.min(SHEET.width * 0.4, LEFTS[i % LEFTS.length] + jitter));
    const width = Math.min(SHEET.width - left - 8, 400 + share * 1100);
    const y = sky + i * (h + gap);
    out.push([left, y, left + width, y + Math.max(h, 8)]);
  }
  return out;
}

/** Rows of staggered horizontal bars. */
export function slabsRows(region, parts, opts) {
  if (!parts.length) return [];
  const pose = poseOf(region.seed);
  const mask = blankMask(opts.floor);
  for (const [l, t, r, b] of slabs(opts.floor, parts, pose)) stampRect(mask, l, t, r, b);
  return fillMask(mask, region, parts, opts, SLABS);
}

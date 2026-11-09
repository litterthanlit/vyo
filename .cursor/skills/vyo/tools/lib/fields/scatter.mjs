// Stipple clouds: separate ellipses of type, with real gaps between them. Not a band.
import { SHEET } from "../geometry.mjs";
import { blankMask, poseOf, stampEllipse } from "./pose.mjs";
import { fillMask } from "./chords.mjs";

export const SCATTER = { size: 6.2, pitch: 7.2 };

// Sheet fractions, clear of the left edge so a record line can sit there. Seed 0 is this picture.
const CLOUDS = [
  [0.22, 0.16, 110, 72],
  [0.55, 0.13, 78, 52],
  [0.8, 0.3, 96, 70],
  [0.28, 0.44, 120, 88],
  [0.64, 0.5, 140, 64],
  [0.38, 0.68, 84, 84],
  [0.78, 0.72, 108, 68],
  [0.52, 0.88, 124, 56],
];

function blobs(floor, pose) {
  if (pose.identity) return CLOUDS.map(([x, y, rx, ry]) => [x * SHEET.width, y * floor, rx, ry]);
  const n = 5 + Math.floor(pose.rnd() * 8);
  const out = [];
  for (let i = 0; i < n; i++) {
    const rx = 40 + pose.rnd() * 120;
    const ry = 40 + pose.rnd() * 120;
    const cx = 56 + rx + pose.rnd() * Math.max(1, SHEET.width - 64 - 2 * rx);
    const cy = ry + pose.rnd() * Math.max(1, floor - 2 * ry);
    out.push([cx, cy, rx, ry]);
  }
  return out;
}

/** Rows of scattered ellipses. The gaps between clouds are the silhouette. */
export function scatterRows(region, parts, opts) {
  const pose = poseOf(region.seed);
  const mask = blankMask(opts.floor);
  for (const [cx, cy, rx, ry] of blobs(opts.floor, pose)) stampEllipse(mask, cx, cy, rx, ry);
  return fillMask(mask, region, parts, opts, SCATTER);
}

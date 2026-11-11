// An Archimedean coil: r = a + bθ, stamped as a thick stroke and scanned into chords. Not sin(y).
import { SHEET } from "../geometry.mjs";
import { blankMask, poseOf, stampEllipse } from "./pose.mjs";
import { fillMask } from "./chords.mjs";

export const SPIRAL = { size: 5.6, pitch: 6.6 };

function coil(floor, pose) {
  const thetaMax = (pose.identity ? 5.4 : 4 + pose.rnd() * 3) * Math.PI;
  const b = pose.identity ? 26 : 14 + pose.rnd() * 18;
  const a = pose.identity ? 20 : 10 + pose.rnd() * 24;
  const hand = pose.identity || pose.rnd() < 0.5 ? 1 : -1;
  const cx = pose.identity ? SHEET.width * 0.62 : SHEET.width * (0.46 + pose.rnd() * 0.16);
  const cy = pose.identity ? floor * 0.5 : floor * (0.38 + pose.rnd() * 0.2);
  const thick = pose.identity ? 52 : 34 + pose.rnd() * 24;
  return { thetaMax, a, b, hand, cx, cy, thick };
}

function stampCoil(mask, coil) {
  const { thetaMax, a, b, hand, cx, cy, thick } = coil;
  const step = Math.max(0.03, 8 / Math.max(20, a + b * thetaMax));
  for (let th = 0; th <= thetaMax; th += step) {
    const r = a + b * th;
    stampEllipse(mask, cx + hand * r * Math.cos(th), cy + r * Math.sin(th), thick / 2, thick / 2);
  }
}

/** Rows along a spiral stroke. A horizontal scan crosses several arms. */
export function spiralRows(region, parts, opts) {
  const pose = poseOf(region.seed);
  const mask = blankMask(opts.floor);
  stampCoil(mask, coil(opts.floor, pose));
  return fillMask(mask, region, parts, opts, SPIRAL);
}

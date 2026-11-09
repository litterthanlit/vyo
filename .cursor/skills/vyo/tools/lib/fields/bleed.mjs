// One large ellipse whose centre sits off the sheet. Only the part on the sheet is filled.
import { SHEET } from "../geometry.mjs";
import { blankMask, poseOf, stampEllipse } from "./pose.mjs";
import { fillMask } from "./chords.mjs";

export const BLEED = { size: 6.2, pitch: 7.2 };

function form(floor, pose) {
  const edge = pose.identity ? 1 : Math.floor(pose.rnd() * 4);
  const off = pose.identity ? 90 : 40 + pose.rnd() * 140;
  const rx = pose.identity ? 700 : 460 + pose.rnd() * 280;
  const ry = pose.identity ? floor * 0.42 : floor * (0.34 + pose.rnd() * 0.16);
  let cx = SHEET.width * 0.5;
  let cy = floor * 0.5;
  if (edge === 0) cy = -off;
  else if (edge === 1) cx = SHEET.width + off;
  else if (edge === 2) cy = floor + off;
  else cx = -off;
  if (!pose.identity && pose.rnd() < 0.5) {
    if (edge === 0 || edge === 2) cx = pose.rnd() < 0.5 ? -off * 0.4 : SHEET.width + off * 0.4;
    else cy = pose.rnd() < 0.5 ? -off * 0.3 : floor + off * 0.3;
  }
  return { cx, cy, rx, ry };
}

/** Rows of the on-sheet part of an off-canvas ellipse. */
export function bleedRows(region, parts, opts) {
  const pose = poseOf(region.seed);
  const mask = blankMask(opts.floor);
  const { cx, cy, rx, ry } = form(opts.floor, pose);
  stampEllipse(mask, cx, cy, rx, ry);
  return fillMask(mask, region, parts, opts, BLEED);
}

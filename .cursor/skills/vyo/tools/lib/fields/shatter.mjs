// A grid that breaks: cells on one side of a fault slide along it, and some cells are dropped.
import { SHEET } from "../geometry.mjs";
import { blankMask, poseOf, stampRect } from "./pose.mjs";
import { fillMask } from "./chords.mjs";

export const SHATTER = { size: 5.8, pitch: 6.8 };

function drop(i, j, seed, p) {
  let x = (Math.imul(i + 3, 374761393) ^ Math.imul(j + 11, 668265263) ^ (seed | 0)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x >>> 0) / 4294967296) < p;
}

function cells(floor, pose, seed) {
  const cols = pose.identity ? 6 : 5 + Math.floor(pose.rnd() * 4);
  const rows = pose.identity ? 8 : 7 + Math.floor(pose.rnd() * 4);
  const gutter = 14;
  const inset = 48;
  const cw = (SHEET.width - inset - gutter) / cols;
  const ch = (floor - gutter) / rows;
  const angle = pose.identity ? 0.85 : pose.rnd() * Math.PI;
  const shift = pose.identity ? 64 : 28 + pose.rnd() * 72;
  const dropP = pose.identity ? 0.16 : 0.1 + pose.rnd() * 0.15;
  const ox = SHEET.width * 0.55;
  const oy = floor * 0.5;
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  const tx = -ny;
  const ty = nx;
  const out = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (drop(i, j, seed, dropP)) continue;
      const cx = inset + gutter / 2 + cw * (i + 0.5);
      const cy = gutter / 2 + ch * (j + 0.5);
      const side = (cx - ox) * nx + (cy - oy) * ny;
      const s = side > 0 ? shift : 0;
      const x = cx + tx * s;
      const y = cy + ty * s;
      out.push([x - cw * 0.36, y - ch * 0.36, x + cw * 0.36, y + ch * 0.36]);
    }
  }
  return out;
}

/** Rows of a broken lattice. Cells stay separate; one side is translated along the fault. */
export function shatterRows(region, parts, opts) {
  const pose = poseOf(region.seed);
  const mask = blankMask(opts.floor);
  for (const [l, t, r, b] of cells(opts.floor, pose, region.seed | 0)) stampRect(mask, l, t, r, b);
  return fillMask(mask, region, parts, opts, SHATTER);
}

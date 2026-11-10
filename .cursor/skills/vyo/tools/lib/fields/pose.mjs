// A field's pose: one integer seed moves the silhouette. Seed 0, or no seed, is the identity, so the
// existing fields keep their numbers. A non-zero seed is mulberry32, the same in Node and the page.
import { SHEET } from "../geometry.mjs";

export const SEED_MAX = 2147483647;

/** mulberry32. Same seed, same sequence. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The pose for a region seed. Identity when the seed is omitted or 0: no crop, scale 1, no flip,
 * no rotation, pitch unchanged, no void. Otherwise every knob moves, and `rnd` is left for the
 * field's own parameters.
 */
export function poseOf(seed) {
  if (!seed) {
    return {
      identity: true,
      crop: [0, 0, 0, 0],
      scale: 1,
      anchor: { x: 0.5, y: 0.5 },
      mirror: false,
      rotation: 0,
      density: 1,
      voidR: 0,
      voidAt: { x: 0.5, y: 0.5 },
      rnd: () => 0,
    };
  }
  const rnd = mulberry32(seed >>> 0);
  return {
    identity: false,
    crop: [rnd(), rnd(), rnd(), rnd()].map((u) => u * 0.12),
    scale: 0.78 + rnd() * 0.5,
    anchor: { x: 0.25 + rnd() * 0.5, y: 0.25 + rnd() * 0.5 },
    mirror: rnd() < 0.5,
    rotation: (rnd() * 2 - 1) * ((12 * Math.PI) / 180),
    density: 0.85 + rnd() * 0.4,
    voidR: rnd() < 0.45 ? 0 : 50 + rnd() * 90,
    voidAt: { x: 0.2 + rnd() * 0.6, y: 0.2 + rnd() * 0.6 },
    rnd,
  };
}

/** Pose for a mask drawn unmirrored. The masthead's mirror flips once, and does not flip again. */
export function posed(region, mirror) {
  const pose = poseOf(region.seed);
  if (mirror) pose.mirror = !pose.mirror;
  return pose;
}

/** A mask in sheet pixels, sampled every 2px. `bits` is 0 off the silhouette, else a label: 1 for a plain shape, a part's index + 1 for a posed field. */
export function blankMask(floor) {
  const step = 2;
  const w = Math.ceil(SHEET.width / step);
  const h = Math.ceil(Math.max(1, floor) / step);
  return { step, w, h, bits: new Uint8Array(w * h) };
}

export function stampRect(mask, l, t, r, b, label = 1) {
  const x0 = Math.max(0, Math.floor(l / mask.step));
  const x1 = Math.min(mask.w - 1, Math.ceil(r / mask.step) - 1);
  const y0 = Math.max(0, Math.floor(t / mask.step));
  const y1 = Math.min(mask.h - 1, Math.ceil(b / mask.step) - 1);
  for (let y = y0; y <= y1; y++) {
    const row = y * mask.w;
    for (let x = x0; x <= x1; x++) mask.bits[row + x] = label;
  }
}

export function stampEllipse(mask, cx, cy, rx, ry) {
  if (rx < 1 || ry < 1) return;
  const y0 = Math.max(0, Math.floor((cy - ry) / mask.step));
  const y1 = Math.min(mask.h - 1, Math.ceil((cy + ry) / mask.step));
  for (let y = y0; y <= y1; y++) {
    const py = (y + 0.5) * mask.step;
    const dy = (py - cy) / ry;
    if (dy * dy > 1) continue;
    const half = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
    stampRect(mask, cx - half, py - mask.step, cx + half, py);
  }
}

/** Rasterise laid-out rows, each labelled `labelOf(item)` (1 to 255), so a posed field keeps which part drew where. */
export function maskFromItems(items, floor, labelOf = () => 1) {
  const mask = blankMask(floor);
  for (const it of items) stampRect(mask, it.x, it.y, it.x + it.width, it.y + it.height, labelOf(it));
  return mask;
}

const subtract = (runs, l, r) => runs.flatMap(([a, b, lab]) => (r <= a || l >= b ? [[a, b, lab]] : [...(l > a ? [[a, l, lab]] : []), ...(r < b ? [[r, b, lab]] : [])]));

/** Punch a circular void out of horizontal chords. Radius 0 leaves them alone. */
export function punchVoid(chords, cx, cy, radius) {
  if (!radius) return chords;
  return chords.map((row) => {
    const dy = row.y + 1 - cy;
    if (Math.abs(dy) >= radius) return row;
    const half = Math.sqrt(Math.max(0, radius * radius - dy * dy));
    return { y: row.y, runs: subtract(row.runs, cx - half, cx + half) };
  });
}

/**
 * Turn a sheet-space mask into horizontal chords on `[0, SHEET.width] x [0, floor]`. Each run is
 * `[left, right, label]`; a run ends where the label changes.
 * Rotation happens in mask space; the scan that follows is horizontal, not another sine.
 * @param {{ step: number, w: number, h: number, bits: Uint8Array }} mask
 * @param {ReturnType<poseOf>} pose
 * @param {{ floor: number, pitch: number }} o
 */
export function applyPoseToMask(mask, pose, { floor, pitch }) {
  const W = SHEET.width;
  const H = floor;
  const scale = pose.scale;
  const rot = pose.rotation;
  const [cL, cR, cT, cB] = pose.crop;
  const spanX = Math.max(0.05, 1 - cL - cR);
  const spanY = Math.max(0.05, 1 - cT - cB);
  const ax = pose.anchor.x * W;
  const ay = pose.anchor.y * H;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const step = mask.step;
  const n = Math.max(0, Math.floor(H / pitch));
  const chords = [];
  for (let i = 0; i < n; i++) {
    const y = Math.round(i * pitch * 10) / 10;
    const runs = [];
    let open = -1;
    let label = 0;
    for (let x = 0; x < W; x += step) {
      let qx = ax + (x + step / 2 - ax) / scale;
      let qy = ay + (y - ay) / scale;
      if (pose.mirror) qx = W - qx;
      const dx = qx - W / 2;
      const dy = qy - H / 2;
      const rx = dx * cos + dy * sin;
      const ry = -dx * sin + dy * cos;
      const um = cL + ((rx + W / 2) / W) * spanX;
      const vm = cT + ((ry + H / 2) / H) * spanY;
      const ix = Math.floor((um * W) / step);
      const iy = Math.floor((vm * H) / step);
      const v = ix >= 0 && iy >= 0 && ix < mask.w && iy < mask.h ? mask.bits[iy * mask.w + ix] : 0;
      if (open >= 0 && v !== label) {
        runs.push([open, x, label]);
        open = -1;
      }
      if (v && open < 0) {
        open = x;
        label = v;
      }
    }
    if (open >= 0) runs.push([open, W - 1, label]);
    chords.push({ y, runs });
  }
  const cx = pose.voidAt.x * W;
  const cy = pose.voidAt.y * H;
  return punchVoid(chords, cx, cy, pose.voidR).map((row) => ({ y: row.y, runs: row.runs.filter(([l, r]) => r - l >= 1 && r > 0 && l < W) }));
}

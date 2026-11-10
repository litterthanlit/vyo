#!/usr/bin/env node
// Draw the bundled wings mask: two swept wings, each a few bands of feathers laid along the leading
// edge with white gaps between them, the far wing smaller as if seen in flight. The symbol fill reads
// those bands as clusters. Writes tools/presets/masks/wings.png; rerun after changing the numbers.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng } from "../../tools/lib/fields/png.mjs";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../tools/presets/masks/wings.png");
const W = 900;
const H = 1000;
const ink = new Uint8Array(W * H);
const dot = (x, y) => {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const px = Math.round(x + dx);
    const py = Math.round(y + dy);
    if (px >= 0 && py >= 0 && px < W && py < H) ink[py * W + px] = 1;
  }
};

/**
 * One wing from `shoulder` to `tip`, the leading edge bowed by `bow`. At each point the wing is `chord`
 * deep, split into `bands` with a gap after each; the last band ends in feather tips.
 */
function wing(shoulder, tip, { bow, chord, bands, feathers, side }) {
  const steps = 1400;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bend = Math.sin(Math.PI * t) * bow;
    const dx = tip[0] - shoulder[0];
    const dy = tip[1] - shoulder[1];
    const len = Math.hypot(dx, dy);
    const nx = (-dy / len) * side;
    const ny = (dx / len) * side;
    const lx = shoulder[0] + dx * t + nx * -bend;
    const ly = shoulder[1] + dy * t + ny * -bend;
    const depth = chord * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.15))) * (1 - 0.55 * t * t);
    const tipCut = 0.78 + 0.22 * Math.abs(Math.sin(t * Math.PI * feathers));
    for (let k = 0; k < bands; k++) {
      const from = k / bands;
      const to = (k + 0.68) / bands;
      const end = k === bands - 1 ? from + (to - from) * tipCut : to;
      for (let s = from; s <= end; s += 0.004) dot(lx + nx * s * depth, ly + ny * s * depth);
    }
  }
}

wing([480, 900], [870, 40], { bow: 60, chord: 470, bands: 4, feathers: 11, side: 1 });
wing([420, 910], [40, 330], { bow: 44, chord: 340, bands: 3, feathers: 8, side: -1 });

const rgba = Buffer.alloc(W * H * 4, 255);
for (let i = 0; i < W * H; i++) if (ink[i]) rgba.fill(0, i * 4, i * 4 + 3);
fs.writeFileSync(OUT, encodePng(W, H, rgba));
process.stdout.write(`Wrote ${OUT}\n`);

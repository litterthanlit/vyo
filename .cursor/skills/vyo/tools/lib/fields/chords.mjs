// Shared filler: horizontal chords become rows of part names. Render inlines this after wave.mjs.
import { SHEET, clearOf } from "../geometry.mjs";
import { rowsPerPart, repeatTo, toneSet, depthTone } from "./wave.mjs";
import { applyPoseToMask, maskFromItems, poseOf } from "./pose.mjs";

const clip = (runs) => runs.map(([l, r]) => [Math.max(0, Math.ceil(l)), Math.min(SHEET.width - 1, Math.floor(r))]).filter(([l, r]) => r - l >= 24);

/**
 * One row of type per chord that still has a run. Parts share the rows by lines, at least one each.
 * Text blocks are cut unless `behindTexts`. Runs shorter than 24px are dropped.
 * @param {{ y: number, runs: [number, number][] }[]} chords
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts
 */
export function rowsFromChords(chords, parts, { size, pitch, measure, theme = "light", frame, blocks = [], behindTexts = true, sentence, every = 5, digits = false }) {
  if (!parts.length) return [];
  const slots = [];
  for (const row of chords) {
    const raw = clip(row.runs);
    const runs = behindTexts ? raw : clearOf(raw, row.y, pitch, blocks);
    if (runs.length) slots.push({ y: row.y, runs });
  }
  if (!slots.length) return [];
  const counts = rowsPerPart(parts, slots.length);
  const rows = parts.flatMap((p, i) => Array(counts[i] || 0).fill(p)).slice(0, slots.length);
  const cw = Math.round(measure(digits ? "0" : "M", size) * 20) / 20;
  const tones = toneSet(theme, frame);
  const out = [];
  rows.forEach((p, i) => {
    if (!p) return;
    const { y, runs } = slots[i];
    const said = !digits && sentence && i % every === every - 1;
    const word = said ? sentence : p.name;
    const tone = p.hot ? (digits ? "hot" : tones.hot) : digits ? (i % 2 ? "mid" : "ink") : depthTone(p.id, theme, frame);
    const spacing = 0.35;
    for (const [l, r] of runs) {
      const right = Math.min(r, SHEET.width - 1);
      const width = right - l;
      // Fit the letters a few px short of the box so advance rounding does not overflow it.
      const placed = digits ? digitsTo(Math.max(0, width - 8), cw, spacing) : repeatTo(word.toLowerCase(), Math.max(0, width - 8), cw, spacing);
      if (placed.text) out.push({ x: l, y, width, height: pitch, size, text: placed.text, spacing, part: p.id, word, hot: !!p.hot, tone });
    }
  });
  return out;
}

function digitsTo(room, cw, spacing) {
  const n = Math.floor((room + spacing) / (cw + spacing));
  const text = Array.from({ length: Math.max(0, n) }, (_, i) => (i % 2 ? "1" : "0")).join("");
  return { text, width: text.length ? text.length * cw + (text.length - 1) * spacing : 0 };
}

/** Pose a mask and fill it. New primitives draw the mask, then call this. */
export function fillMask(mask, region, parts, opts, { size, pitch }) {
  const pose = poseOf(region.seed);
  if (opts.mirror) pose.mirror = !pose.mirror;
  const step = Math.round(pitch * pose.density * 10) / 10;
  const chords = applyPoseToMask(mask, pose, { floor: opts.floor, pitch: step });
  return rowsFromChords(chords, parts, {
    size,
    pitch: step,
    measure: opts.measure,
    theme: opts.theme,
    frame: opts.frame,
    blocks: opts.blocks,
    behindTexts: true,
  });
}

/**
 * Run an existing field's own layout, then pose that silhouette. Seed 0 returns the layout unchanged.
 * The masthead mirror is already in the raster, so the pose does not flip a second time.
 */
export function relayout(region, parts, opts, identity, { size, pitch, behindTexts, digits = false }) {
  const pose = poseOf(region.seed);
  if (pose.identity) return identity(region, parts, opts);
  if (opts.mirror) pose.mirror = false;
  const items = identity({ ...region, seed: 0 }, parts, { ...opts, blocks: [] });
  const mask = maskFromItems(items, opts.floor);
  const step = Math.round(pitch * pose.density * 10) / 10;
  const chords = applyPoseToMask(mask, pose, { floor: opts.floor, pitch: step });
  return rowsFromChords(chords, parts, {
    size,
    pitch: step,
    measure: opts.measure,
    theme: opts.theme,
    frame: opts.frame,
    blocks: opts.blocks,
    behindTexts,
    digits,
    sentence: region.sentence,
    every: region.every,
  });
}

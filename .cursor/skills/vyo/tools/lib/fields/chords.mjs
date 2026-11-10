// Shared filler: horizontal chords become rows of part names. Render inlines this after wave.mjs.
import { SHEET, clearOf } from "../geometry.mjs";
import { rowsPerPart, repeatTo, toneSet, depthTone } from "./wave.mjs";
import { applyPoseToMask, maskFromItems, poseOf } from "./pose.mjs";

const clip = (runs) => runs.map(([l, r, lab]) => [Math.max(0, Math.ceil(l)), Math.min(SHEET.width - 1, Math.floor(r)), lab]).filter(([l, r]) => r - l >= 24);
const labelAt = (raw, l, r) => raw.find(([a, b]) => (l + r) / 2 >= a && (l + r) / 2 <= b)?.[2];

/**
 * One row of type per chord that still has a run. Parts share the rows by lines, at least one each,
 * unless `labelled`: then each run's label (a part's index + 1) names its part, and `toneOf` its tone.
 * Text blocks are cut unless `behindTexts`. Runs shorter than 24px are dropped.
 * @param {{ y: number, runs: [number, number, number?][] }[]} chords
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts
 */
export function rowsFromChords(chords, parts, { size, pitch, measure, theme = "light", frame, blocks = [], behindTexts = true, sentence, every = 5, digits = false, labelled = false, toneOf = {} }) {
  if (!parts.length) return [];
  const slots = [];
  for (const row of chords) {
    const raw = clip(row.runs);
    const runs = behindTexts ? raw : clearOf(raw, row.y, pitch, blocks).map(([l, r]) => [l, r, labelAt(raw, l, r)]);
    if (runs.length) slots.push({ y: row.y, runs });
  }
  if (!slots.length) return [];
  const counts = rowsPerPart(parts, slots.length);
  const rows = labelled ? slots.map(() => null) : parts.flatMap((p, i) => Array(counts[i] || 0).fill(p)).slice(0, slots.length);
  const cw = Math.round(measure(digits ? "0" : "M", size) * 20) / 20;
  const tones = toneSet(theme, frame);
  const out = [];
  rows.forEach((rowPart, i) => {
    const { y, runs } = slots[i];
    const said = !digits && sentence && i % every === every - 1;
    const spacing = 0.35;
    for (const [l, r, lab] of runs) {
      const p = labelled ? parts[lab - 1] : rowPart;
      if (!p) continue;
      const word = said ? sentence : p.name;
      const tone = (labelled && toneOf[p.id]) || (p.hot ? (digits ? "hot" : tones.hot) : digits ? (i % 2 ? "mid" : "ink") : depthTone(p.id, theme, frame));
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
 * Run an existing field's own layout, then pose that silhouette, each run keeping the part that drew it.
 * Seed 0 returns the layout unchanged. The masthead mirror is already in the raster, so the pose does not
 * flip a second time. A pose that crops a part away softens (no crop or void, then no scale or rotation),
 * and the unposed layout is the last resort, so every part the field draws stays drawn.
 */
export function relayout(region, parts, opts, identity, { size, pitch, behindTexts, digits = false }) {
  const pose = poseOf(region.seed);
  if (pose.identity) return identity(region, parts, opts);
  if (opts.mirror) pose.mirror = false;
  const items = identity({ ...region, seed: 0 }, parts, { ...opts, blocks: [] });
  const index = new Map(parts.map((p, i) => [p.id, i + 1]));
  const toneOf = {};
  for (const it of items) toneOf[it.part] ??= it.tone;
  const drawn = new Set(items.map((it) => it.part));
  const mask = maskFromItems(items, opts.floor, (it) => index.get(it.part) ?? 0);
  const soft = { ...pose, crop: [0, 0, 0, 0], voidR: 0 };
  for (const p of [pose, soft, { ...soft, scale: 1, rotation: 0 }]) {
    const step = Math.round(pitch * p.density * 10) / 10;
    const chords = applyPoseToMask(mask, p, { floor: opts.floor, pitch: step });
    const rows = rowsFromChords(chords, parts, {
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
      labelled: true,
      toneOf,
    });
    const kept = new Set(rows.map((r) => r.part));
    if ([...drawn].every((id) => kept.has(id))) return rows;
  }
  return identity(region, parts, opts);
}

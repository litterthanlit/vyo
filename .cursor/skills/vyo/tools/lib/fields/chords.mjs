// Shared filler: horizontal chords become rows of part names. Render inlines this after wave.mjs.
import { SHEET, clearOf } from "../geometry.mjs";
import { rowsPerPart, repeatTo, toneSet, depthTone } from "./wave.mjs";
import { applyPoseToMask, maskFromItems, poseOf } from "./pose.mjs";

const clip = (runs, min = 24) => runs.map(([l, r, lab]) => [Math.max(0, Math.ceil(l)), Math.min(SHEET.width - 1, Math.floor(r)), lab]).filter(([l, r]) => r - l >= min);
const labelAt = (raw, l, r) => raw.find(([a, b]) => (l + r) / 2 >= a && (l + r) / 2 <= b)?.[2];

// The symbol fill: letters 10px on 12px rows, spaced so the characters read as marks, light to dense.
export const SYMBOLS = { size: 9, pitch: 10.5, spacing: 2.2, ramp: "-:=+#" };

const hash2 = (x, y) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** Smooth value noise in [0, 1): the same at a cell in Node and in the page. */
function noise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash2(x0, y0) + (hash2(x0 + 1, y0) - hash2(x0, y0)) * sx;
  const bottom = hash2(x0, y0 + 1) + (hash2(x0 + 1, y0 + 1) - hash2(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
}

/**
 * For the symbol fill: a function from a chord's index and a run to the run's text, one symbol per
 * column of `adv` px. Each cell's character comes from how much of the shape surrounds it, so the
 * middle of a form is `#` and its edges `-`; smooth noise leaves gaps, more of them near the edges,
 * so the form breaks into clusters.
 */
function symbolTexts(chords, adv, cw) {
  const cols = Math.ceil(SHEET.width / adv);
  const on = chords.map((row) => {
    const line = new Uint8Array(cols);
    for (const [l, r] of row.runs) for (let c = Math.ceil(l / adv); c * adv + cw <= r && c < cols; c++) line[c] = 1;
    return line;
  });
  const near = (j, c) => {
    let n = 0;
    let all = 0;
    for (let dj = -1; dj <= 1; dj++) {
      const line = on[j + dj];
      for (let dc = -2; dc <= 2; dc++) {
        all++;
        if (line && line[c + dc]) n++;
      }
    }
    return n / all;
  };
  return (j, l, r) => {
    const first = Math.ceil(l / adv);
    let text = "";
    for (let c = first; c * adv + cw <= r && c < cols; c++) {
      const d = near(j, c);
      const n = noise(c / 2.4, j / 1.25);
      const keep = n > 0.3 + 0.45 * (1 - d) ** 1.4;
      text += keep ? SYMBOLS.ramp[Math.min(SYMBOLS.ramp.length - 1, Math.floor((0.75 * d + 0.4 * n) * SYMBOLS.ramp.length))] : " ";
    }
    return { x: first * adv, text };
  };
}

/**
 * One row of type per chord that still has a run. Parts share the rows by lines, at least one each,
 * unless `labelled`: then each run's label (a part's index + 1) names its part, and `toneOf` its tone.
 * Text blocks are cut unless `behindTexts`. Runs shorter than 24px are dropped. With `symbols`, each run
 * is drawn in symbols shaded by the form instead of the part's name.
 * @param {{ y: number, runs: [number, number, number?][] }[]} chords
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts
 */
export function rowsFromChords(chords, parts, { size, pitch, measure, theme = "light", frame, blocks = [], behindTexts = true, sentence, every = 5, digits = false, labelled = false, toneOf = {}, symbols = false }) {
  if (!parts.length) return [];
  const slots = [];
  chords.forEach((row, j) => {
    // A symbol is a mark on its own, so a run one symbol wide still draws.
    const raw = clip(row.runs, symbols ? 8 : 24);
    const runs = behindTexts ? raw : clearOf(raw, row.y, pitch, blocks).map(([l, r]) => [l, r, labelAt(raw, l, r)]);
    if (runs.length) slots.push({ y: row.y, runs, j });
  });
  if (!slots.length) return [];
  const counts = rowsPerPart(parts, slots.length);
  const rows = labelled ? slots.map(() => null) : parts.flatMap((p, i) => Array(counts[i] || 0).fill(p)).slice(0, slots.length);
  const cw = Math.round(measure(digits ? "0" : "M", size) * 20) / 20;
  const symbolText = symbols && symbolTexts(chords, cw + SYMBOLS.spacing, cw);
  const tones = toneSet(theme, frame);
  const out = [];
  rows.forEach((rowPart, i) => {
    const { y, runs, j } = slots[i];
    const said = !digits && sentence && i % every === every - 1;
    const spacing = symbols ? SYMBOLS.spacing : 0.35;
    for (const [l, r, lab] of runs) {
      const p = labelled ? parts[lab - 1] : rowPart;
      if (!p) continue;
      const word = said ? sentence : p.name;
      const tone = (labelled && toneOf[p.id]) || (p.hot ? (digits ? "hot" : tones.hot) : digits ? (i % 2 ? "mid" : "ink") : depthTone(p.id, theme, frame));
      const right = Math.min(r, SHEET.width - 1);
      if (symbolText) {
        const { x, text } = symbolText(j, l, right);
        if (text.trim()) out.push({ x, y, width: text.length * cw + (text.length - 1) * spacing, height: pitch, size, text, spacing, part: p.id, word, hot: !!p.hot, tone });
        continue;
      }
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

/** Pose a mask and fill it, with part names or, when `region.symbols`, with symbols. `own.mirror: false` keeps it unflipped. New primitives draw the mask, then call this. */
export function fillMask(mask, region, parts, opts, own) {
  const { size, pitch } = region.symbols ? SYMBOLS : own;
  const pose = poseOf(region.seed);
  if (own.mirror === false) pose.mirror = false;
  else if (opts.mirror) pose.mirror = !pose.mirror;
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
    symbols: !!region.symbols,
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

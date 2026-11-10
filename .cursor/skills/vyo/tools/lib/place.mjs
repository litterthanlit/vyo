// Where the loose frame's text blocks go around a drawn shape when the spec leaves out their x and y: one column
// stacked in reading order (label, headline, legend, paragraphs, list) in the room the shape and the record line
// leave, or split across two places when no one place holds it all. Pure and deterministic, so `vyo sketch` and
// render place every block in the same spot.
import { SHEET } from "./geometry.mjs";
import { shapeMask } from "./mask.mjs";
import { frameOf, roleOf, textSize, lineHeight, ruleText, recordRect, sizeRange } from "./frame.mjs";
import { listItems, recordOf } from "./render.mjs";

function wrap(text, perLine) {
  const lines = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + 1 + word.length <= perLine) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

/**
 * Where a text block's letters land, estimated from its role's line height and average advance; `em` scales the
 * advance, so a placement can reserve room for a wider font than the average.
 */
export function estimateText(t, spec, facts, em = 1) {
  const role = roleOf(spec, t);
  const size = textSize(spec, t);
  const per = (frameOf(spec) === "swiss" && t.role === "label" && t.hot ? role.em + 0.06 : role.em) * size * em;
  const one = (text) => [text];
  const lines = {
    name: () => one(frameOf(spec) === "swiss" ? `${spec.product.name}.` : spec.product.name.toUpperCase()),
    headline: () => wrap(spec.headline, Math.max(1, Math.floor(t.w / per))),
  }[role.prints]?.() ?? (t.role === "list" ? (facts || !t.parts ? listItems(spec, t, facts) : ["x".repeat(12)]) : t.role === "rule" ? [ruleText(t)] : t.role === "label" ? one(t.text) : wrap(t.text.replace(/\*\*/g, ""), Math.max(1, Math.floor(t.w / per))));
  const width = Math.min(t.w, Math.max(...lines.map((l) => l.length)) * per);
  const left = t.align === "right" ? t.x + t.w - width : t.align === "center" ? t.x + (t.w - width) / 2 : t.x;
  return { id: t.id, left, top: t.y, right: left + width, bottom: t.y + lines.length * lineHeight(spec, t), lines: lines.length };
}

// The room: 40px from the sheet's edges, 16px from the shape plus 4 for antialiasing, 10px from the record line.
// Blocks in a column sit `after` px below the one above (the label closer to its headline). Each role's widest
// and narrowest column, and `em`, the advance the room is reserved for: Newsreader's average at 0.45 em
// underestimates a line of long words.
export const PLACE = {
  inset: 40, clear: 20, record: 10, cell: 4, em: 1.12, after: { label: 10, other: 22 },
  w: { label: [120, 300], headline: [240, 520], legend: [190, 300], paragraph: [190, 300], list: [140, 240], rule: [120, 300] },
};
const ORDER = ["label", "headline", "legend", "paragraph", "list", "rule"];

/** The sheet as a grid of PLACE.cell px, 1 where no block may go, with a summed-area table to test rects in O(1). */
function roomGrid(mask, rec, fixed) {
  const C = PLACE.cell;
  const [w, h] = [Math.ceil(SHEET.width / C), Math.ceil(SHEET.height / C)];
  const taken = new Uint8Array(w * h);
  const take = (l, t, r, b) => {
    for (let y = Math.max(0, Math.floor(t / C)); y < Math.min(h, Math.ceil(b / C)); y++)
      for (let x = Math.max(0, Math.floor(l / C)); x < Math.min(w, Math.ceil(r / C)); x++) taken[y * w + x] = 1;
  };
  const I = PLACE.inset;
  take(0, 0, SHEET.width, I);
  take(0, SHEET.height - I, SHEET.width, SHEET.height);
  take(0, 0, I, SHEET.height);
  take(SHEET.width - I, 0, SHEET.width, SHEET.height);
  mask.runs.forEach((row, y) => row.forEach(([l, r]) => take(l - PLACE.clear, y - PLACE.clear, r + PLACE.clear, y + 1 + PLACE.clear)));
  take(rec.left - PLACE.record, rec.top - PLACE.record, rec.right + PLACE.record, rec.bottom + PLACE.record);
  for (const b of fixed) take(b.left - PLACE.after.other, b.top - PLACE.after.other, b.right + PLACE.after.other, b.bottom + PLACE.after.other);
  const sum = new Int32Array((w + 1) * (h + 1));
  let stale = true;
  const free = (l, t, r, b) => {
    if (stale) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sum[(y + 1) * (w + 1) + x + 1] = taken[y * w + x] + sum[y * (w + 1) + x + 1] + sum[(y + 1) * (w + 1) + x] - sum[y * (w + 1) + x];
      stale = false;
    }
    const [x0, y0, x1, y1] = [Math.floor(l / C), Math.floor(t / C), Math.ceil(r / C), Math.ceil(b / C)];
    if (x0 < 0 || y0 < 0 || x1 > w || y1 > h) return false;
    return sum[y1 * (w + 1) + x1] - sum[y0 * (w + 1) + x1] - sum[y1 * (w + 1) + x0] + sum[y0 * (w + 1) + x0] === 0;
  };
  return { free, take: (...rect) => ((stale = true), take(...rect)) };
}

/**
 * Stack `blocks` in a column `width` px wide: each block as wide as its role allows within it, flush to the
 * column's side `align`, `size` overriding the headline's default. Returns each placed text and the column's height.
 */
function stack(spec, facts, blocks, width, align, headSize) {
  let y = 0;
  const out = blocks.map((t, i) => {
    const [, most] = PLACE.w[t.role];
    const w = Math.round(Math.min(t.w ?? most, most, width));
    const size = t.size ?? (t.role === "headline" ? headSize : undefined);
    const placed = { ...t, w, ...(size !== undefined ? { size } : {}), align: t.align ?? align };
    const est = estimateText({ ...placed, x: 0, y: 0 }, spec, facts, PLACE.em);
    const top = y;
    y += est.bottom + (i < blocks.length - 1 ? (t.role === "label" ? PLACE.after.label : PLACE.after.other) : 0);
    return { placed, top, dx: align === "right" ? width - w : 0 };
  });
  return { out, height: y };
}

/**
 * The first free spot for a column, scanning top to bottom: the column hugs the left margin or the right one,
 * whichever is nearer the free room, and faces away from the shape (flush left on the left, flush right on the right).
 */
function findSpot(room, width, height, centre) {
  const C = 2 * PLACE.cell;
  for (let y = PLACE.inset; y + height <= SHEET.height - PLACE.inset; y += C) {
    const xs = [];
    for (let x = PLACE.inset; x + width <= SHEET.width - PLACE.inset; x += C) if (room.free(x, y, x + width, y + height)) xs.push(x);
    if (!xs.length) continue;
    // Nearest a margin: a column beside the shape belongs against the sheet's edge, not floating in the gap.
    const edge = (x) => Math.min(x - PLACE.inset, SHEET.width - PLACE.inset - (x + width));
    const x = xs.reduce((a, b) => (edge(b) < edge(a) ? b : a));
    return { x, y, align: x + width / 2 > centre ? "right" : "left" };
  }
  return null;
}

/** Try to place `blocks` as one column, widest first and the headline from its default size down. */
function placeColumn(spec, facts, room, blocks, centre) {
  const head = blocks.find((t) => t.role === "headline");
  const [, lo, hi] = head ? sizeRange(spec, head) : [0, 0, 0];
  const sizes = head && head.size === undefined ? [textSize(spec, head), 38, 35, lo].filter((s, i, a) => s >= lo && s <= hi && a.indexOf(s) === i) : [undefined];
  const widest = Math.max(...blocks.map((t) => Math.min(t.w ?? PLACE.w[t.role][1], PLACE.w[t.role][1])));
  const narrowest = Math.max(...blocks.map((t) => PLACE.w[t.role][0]));
  for (const size of sizes) {
    for (let width = widest; width >= narrowest; width -= 20) {
      for (const align of ["left", "right"]) {
        const col = stack(spec, facts, blocks, width, align, size);
        const spot = findSpot(room, width, col.height, centre);
        if (!spot || spot.align !== align) continue;
        return col.out.map(({ placed, top, dx }) => ({ ...placed, x: spot.x + dx, y: spot.y + top }));
      }
    }
  }
  return null;
}

/**
 * The spec with every text block of a shape poster placed: blocks with x and y keep them, the others go in the
 * room the shape leaves. Specs without a drawn shape, or with every block placed, come back as they are.
 */
export function placeTexts(spec, facts) {
  const region = spec.figure?.regions?.find((r) => r.kind === "field" && r.field === "shape");
  const loose = spec.figure.texts.filter((t) => t.x === undefined || t.y === undefined);
  if (!region || !loose.length || frameOf(spec) !== "loose") return spec;
  const mask = shapeMask(region.shape);
  const fixed = spec.figure.texts.filter((t) => !loose.includes(t)).map((t) => estimateText({ w: PLACE.w[t.role]?.[1] ?? 300, ...t }, spec, facts));
  const centre = (mask.box.left + mask.box.right) / 2;
  const rec = recordRect(recordOf(spec, facts));
  const todo = [...loose].sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));
  const placed = new Map();
  // One column, then the label and headline apart from the rest, then each block alone.
  const groups = [[todo], [todo.filter((t) => ["label", "headline"].includes(t.role)), todo.filter((t) => !["label", "headline"].includes(t.role))], todo.map((t) => [t])];
  for (const tries of groups) {
    const parts = tries.filter((g) => g.length);
    const trial = roomGrid(mask, rec, fixed);
    const got = [];
    for (const g of parts) {
      const col = placeColumn(spec, facts, trial, g, centre);
      if (!col) break;
      for (const t of col) {
        const e = estimateText(t, spec, facts, PLACE.em);
        trial.take(e.left - PLACE.after.other, e.top - PLACE.after.other, Math.max(e.right, t.x + t.w) + PLACE.after.other, e.bottom + PLACE.after.other);
      }
      got.push(...col);
    }
    if (got.length === todo.length) {
      for (const t of got) placed.set(t.id, t);
      break;
    }
  }
  // No room anywhere: the blocks go top left in reading order, and shape-room says how much to shrink the shape.
  if (!placed.size) {
    let y = PLACE.inset;
    for (const t of todo) {
      const p = { ...t, x: PLACE.inset, y, w: Math.min(t.w ?? PLACE.w[t.role][1], PLACE.w[t.role][1]), align: t.align ?? "left" };
      y = estimateText(p, spec, facts, PLACE.em).bottom + PLACE.after.other;
      placed.set(t.id, p);
    }
  }
  return { ...spec, figure: { ...spec.figure, texts: spec.figure.texts.map((t) => placed.get(t.id) ?? { w: PLACE.w[t.role]?.[1] ?? 300, ...t }) } };
}

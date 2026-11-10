// The frames a poster can sit in, and each frame's text roles: a closed set per frame. Spec validation,
// render, sketch and compose read the same table. Pure.
import { SHEET, ADVANCE, CORNERS } from "./geometry.mjs";

/**
 * A text role: its size as [default, min, max] in px, line height from size, how many a figure holds,
 * what it prints (`name` and `headline` print the spec's own; `parts` lists the field's parts), its
 * character limit and sentence limit for written text, and its average advance in em for the sketch.
 * @typedef {{ size: [number, number, number], lh: (s: number) => number, count: [number, number],
 *             prints?: "name" | "headline", max?: number, sentences?: number, em: number, mono?: boolean }} Role
 */

/** @type {Record<"swiss" | "loose" | "signal", Record<string, Role>>} */
export const ROLES = {
  swiss: {
    masthead: { size: [84, 48, 120], lh: (s) => Math.round(s * 1.05), count: [1, 1], prints: "name", em: 0.45 },
    headline: { size: [22, 18, 40], lh: (s) => s + 6, count: [0, 1], prints: "headline", em: 0.45 },
    display: { size: [56, 32, 64], lh: (s) => s, count: [0, 6], max: 40, em: 0.5 },
    aside: { size: [12, 10, 14], lh: (s) => Math.round(s * 1.5), count: [0, 6], max: 160, em: ADVANCE, mono: true },
    label: { size: [12, 10, 32], lh: (s) => Math.round(s * 1.25), count: [0, 6], max: 32, em: ADVANCE + 0.12, mono: true },
  },
  loose: {
    label: { size: [13, 11, 16], lh: (s) => Math.round(s * 1.2), count: [1, 1], prints: "name", em: ADVANCE + 0.17, mono: true },
    headline: { size: [42, 32, 48], lh: (s) => Math.round(s * 1.06), count: [1, 1], prints: "headline", em: 0.45 },
    paragraph: { size: [15, 13, 17], lh: (s) => Math.round(s * 1.4), count: [0, 2], max: 220, sentences: 2, em: 0.45 },
    legend: { size: [15, 13, 17], lh: (s) => Math.round(s * 1.4), count: [1, 1], max: 180, sentences: 2, em: 0.45 },
    list: { size: [13, 11, 14], lh: (s) => Math.round(s * 1.55), count: [0, 1], em: ADVANCE, mono: true },
    rule: { size: [13, 11, 14], lh: (s) => s, count: [0, 1], em: ADVANCE, mono: true },
  },
  // Charcoal or paper, one signal colour, grotesque headline, archival meta, highlighter marks.
  signal: {
    label: { size: [12, 10, 16], lh: (s) => Math.round(s * 1.2), count: [1, 1], prints: "name", em: ADVANCE + 0.18, mono: true },
    headline: { size: [52, 36, 72], lh: (s) => Math.round(s * 0.98), count: [1, 1], prints: "headline", em: 0.42 },
    paragraph: { size: [13, 12, 15], lh: (s) => Math.round(s * 1.35), count: [0, 2], max: 220, sentences: 2, em: 0.45 },
    legend: { size: [12, 10, 14], lh: (s) => Math.round(s * 1.4), count: [1, 1], max: 180, sentences: 2, em: ADVANCE, mono: true },
    // The stepped list: bold grotesque caps, each item a bullet and one step further in, four steps then back.
    list: { size: [13, 10, 44], lh: (s) => Math.round(s * (s < 20 ? 1.4 : 1.02)), count: [0, 1], em: 0.66 },
    rule: { size: [12, 10, 14], lh: (s) => s, count: [0, 1], em: ADVANCE, mono: true },
    meta: { size: [11, 9, 13], lh: (s) => Math.round(s * 1.25), count: [0, 1], max: 80, sentences: 1, em: ADVANCE, mono: true },
    display: { size: [96, 64, 160], lh: (s) => Math.round(s * 0.9), count: [0, 2], max: 8, em: 0.5 },
    mark: { size: [12, 1, 200], lh: () => 0, count: [0, 3], em: 0 },
  },
};
export const FRAMES = Object.keys(ROLES);
/** Frames that draw a record line instead of the swiss footer. */
export const RECORD_FRAMES = ["loose", "signal"];
export const hasRecord = (spec) => RECORD_FRAMES.includes(frameOf(spec));
// A swiss label set hot is the accent word set large, like the hourglass waist.
export const HOT_LABEL = [26, 10, 32];
export const LIST = { items: 16, item: 24 };

/** The frame a spec sits in: loose unless it says swiss. */
export const frameOf = (spec) => spec?.frame ?? "loose";
export const roleOf = (spec, t) => ROLES[frameOf(spec)][t.role];
export const sizeRange = (spec, t) => (frameOf(spec) === "swiss" && t.role === "label" && t.hot ? HOT_LABEL : roleOf(spec, t).size);
export const textSize = (spec, t) => t.size ?? sizeRange(spec, t)[0];
export const lineHeight = (spec, t) => roleOf(spec, t).lh(textSize(spec, t));

/** A rule's text: its one character repeated across w. */
export const ruleText = (t) => t.text.repeat(Math.max(1, Math.floor(t.w / (ADVANCE * textSize({ frame: "loose" }, t)))));

// The record line: "<name> at <sha>, <date>. Drawn by Vyo.", 10px mono, at the bottom edge or rotated up the left.
export const RECORD = { size: 10, spacing: 0.3, inset: 40, bottom: 30, left: 18, gap: 10 };
export const recordWidth = (text) => text.length * (ADVANCE * RECORD.size + RECORD.spacing);

const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Where the record line goes: along the bottom edge when the field leaves the bottom-left clear, else rotated
 * up the left edge at the lowest clear run, else back on the bottom. `side` forces one.
 * @param {string} text
 * @param {{ left: number, top: number, right: number, bottom: number }[]} rects  the field's rows
 * @param {"bottom" | "left"} [side]
 * @returns {{ side: "bottom" | "left", x: number, y: number, w: number }}  for "left", y is where the line starts, at its bottom
 */
export function recordSpot(text, rects, side) {
  const w = recordWidth(text);
  const { size, inset, bottom, left, gap } = RECORD;
  const flat = { side: "bottom", x: inset, y: SHEET.height - bottom - size, w };
  const flatBox = { left: flat.x - gap, top: flat.y - gap, right: flat.x + w + gap, bottom: flat.y + size + gap };
  if (side === "bottom" || (!side && !rects.some((r) => hit(r, flatBox)))) return flat;
  for (let y = SHEET.height - bottom; y - w >= inset; y -= size) {
    const box = { left: 0, top: y - w - gap, right: left + size + gap, bottom: y + gap };
    if (!rects.some((r) => hit(r, box))) return { side: "left", x: left, y, w };
  }
  return side === "left" ? { side: "left", x: left, y: SHEET.height - bottom, w } : flat;
}

/** The record's rect on the sheet. */
export const recordRect = (spot) =>
  spot.side === "bottom"
    ? { left: spot.x, top: spot.y, right: spot.x + spot.w, bottom: spot.y + RECORD.size }
    : { left: spot.x, top: spot.y - spot.w, right: spot.x + RECORD.size, bottom: spot.y };

// How compose fills the corners: 40px from the sheet's edges, 16px from the field, 24px between blocks; the
// bottom stacks end above the record line. Widths and the lines each block is given room for.
export const SCAFFOLD = { inset: 40, gap: 16, between: 24, bottomEnd: 60, minW: 160, minH: 60 };
// A block's width, and the characters it is given room for: three quarters of its role's limit (the headline's 72).
const BLOCKS = { label: { w: 220 }, headline: { w: 380, chars: 54 }, list: { w: 240 }, legend: { w: 260, chars: 135 }, paragraph: { w: 240, chars: 165 } };

/**
 * Where compose puts the loose frame's texts, by i-loose's rule: the headline in the largest empty corner,
 * the label in the smallest, the list in the tallest, the legend in the corner nearest the accent part, the
 * paragraph where the most room is left. A block that does not fit its corner goes to the corner with the most
 * room left; the list and the paragraph are dropped when none has room, the others are placed anyway.
 * @param {ReturnType<import("./geometry.mjs").corners>} corners
 * @param {{ x: number, y: number }} accent  the centre of the accent part's rows, or of all rows
 * @param {number} listLines  how many parts the list prints
 * @param {"loose" | "signal"} frame  whose role sizes to plan by
 * @returns {Record<string, { x: number, y: number, w: number, align: "left" | "right" }>}
 */
export function scaffoldPlaces(corners, accent, listLines, frame = "loose") {
  const { inset, gap, between, bottomEnd, minW, minH } = SCAFFOLD;
  const room = Object.fromEntries(
    CORNERS.map((n) => {
      const c = corners[n];
      const top = n.startsWith("top");
      const h = top ? c.h - inset - gap : c.h - gap - bottomEnd;
      return [n, { name: n, c, w: c.w - inset - gap, h, used: 0 }];
    }),
  );
  const usable = Object.values(room).filter((r) => r.w >= minW && r.h >= minH);
  if (!usable.length) usable.push(...Object.values(room).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 1));
  const area = (r) => r.c.w * r.c.h;
  const by = (f) => [...usable].sort((a, b) => f(a) - f(b));
  const dist = (r) => Math.hypot(r.c.x + r.c.w / 2 - accent.x, r.c.y + r.c.h / 2 - accent.y);
  const want = {
    label: by(area)[0],
    headline: by((r) => -area(r))[0],
    list: by((r) => -r.h)[0],
    legend: by(dist)[0],
    paragraph: null,
  };
  const out = {};
  for (const [role, b] of Object.entries(BLOCKS)) {
    const { size: [size], lh, em } = ROLES[frame][role];
    const widthIn = (r) => Math.max(minW / 2, Math.min(b.w, r.w));
    // Wrapping at word breaks fills about 85% of each line, so plan for that many characters per line.
    const heightIn = (r) => lh(size) * (role === "list" ? listLines : b.chars ? Math.ceil(b.chars / Math.floor((0.85 * widthIn(r)) / (em * size))) : 1);
    const fits = (r) => r.h - r.used - (r.used ? between : 0) >= heightIn(r);
    const most = by((r) => -(r.h - r.used))[0];
    const r = [want[role], most].find((x) => x && fits(x)) ?? (role === "list" || role === "paragraph" ? null : want[role] ?? most);
    if (!r) continue;
    const w = widthIn(r);
    const height = heightIn(r);
    const top = r.name.startsWith("top");
    const right = r.name.endsWith("right");
    const offset = r.used + (r.used ? between : 0);
    const y = top ? inset + offset : SHEET.height - bottomEnd - offset - height;
    r.used = offset + height;
    out[role] = { x: right ? SHEET.width - inset - w : inset, y: Math.round(y), w: Math.round(w), align: right ? "right" : "left" };
  }
  return out;
}

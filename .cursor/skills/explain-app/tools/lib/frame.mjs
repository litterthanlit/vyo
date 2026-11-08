// The frames a poster can sit in, and each frame's text roles: a closed set per frame. Spec validation,
// render, sketch and compose read the same table. Pure.
import { SHEET, ADVANCE } from "./geometry.mjs";

/**
 * A text role: its size as [default, min, max] in px, line height from size, how many a figure holds,
 * what it prints (`name` and `headline` print the spec's own; `parts` lists the field's parts), its
 * character limit and sentence limit for written text, and its average advance in em for the sketch.
 * @typedef {{ size: [number, number, number], lh: (s: number) => number, count: [number, number],
 *             prints?: "name" | "headline", max?: number, sentences?: number, em: number, mono?: boolean }} Role
 */

/** @type {Record<"swiss" | "loose", Record<string, Role>>} */
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
};
export const FRAMES = Object.keys(ROLES);
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

// The shape field: a silhouette the agent draws, filled from its mask. A style reads the mask and the parts and
// returns the rows of type and the ground under them; `bands` is the only style so far. Pure, like wave.mjs.
import { SHEET, ADVANCE } from "../geometry.mjs";
import { shapeMask, intersectRuns } from "../mask.mjs";
import { ringsStyle } from "./shape-rings.mjs";
import { reliefStyle } from "./shape-relief.mjs";

// b-scale's numbers. A band per part, its area by lines; the biggest part's name one line as tall as its band,
// every other part's type that size times (its lines / the biggest's) to the power `gamma`, never under `min` px.
// Bands are at least `minBand` px tall and `gap` px apart; lines sit `pitch` em apart.
export const BANDS = { gamma: 2.4, min: 5, minBand: 8, gap: 3, pitch: 0.86, bold: 12, grow: 1.4 };
// Commit Mono's ascender top and descender bottom, in em below the top of a line set at `pitch` em.
const GLYPH = { top: 0.04, bottom: 0.99 };
// How far the last line's descenders reach past its pitch, in em: a band leaves room for them.
const TAIL = GLYPH.bottom - BANDS.pitch;
// Per theme: the token for type on the accent fill (paper type on orange washed out on paper, and navy on orange
// read as ink), the fills the bands take in turn, and the tone of the shadow cast down and right, if any. All ink
// on paper read as flat signage; alternating ink and slate, over a pale shadow, reads as a printed object in layers.
export const SHAPE_TONES = {
  light: { tokens: { "on-hot": "#161616" }, fills: ["ink", "cool"], shadow: "cold" },
  dark: { tokens: { "on-hot": "#0E1424" }, fills: ["ink"], shadow: null },
};
const SHADOW = 14;

/** Letter-spacing in em: tight for display sizes, a little open for texture. */
const trackOf = (size) => (size > 40 ? -0.06 : size > 14 ? -0.03 : 0.02);

/** Covered px per sheet row. */
const rowAreas = (mask) => mask.runs.map((row) => row.reduce((a, [l, r]) => a + r - l, 0));

/**
 * One band per part, top to bottom in tree order, each covering its part's share of the mask's area, at least
 * `minBand` px tall, with its type size and line count. Type is sized by weight, never larger than lets the name
 * sit whole on a line of its band, and a band fills its height with as many lines as that size takes.
 * @param {import("../mask.mjs").Mask} mask
 * @param {{ id: string, name: string, loc: number }[]} parts
 * @returns {{ part: object, y0: number, y1: number, lines: number, size: number }[]}
 */
export function shapeBands(mask, parts) {
  if (!parts.length) return [];
  const { gamma, min, minBand } = BANDS;
  const area = rowAreas(mask);
  const top = area.findIndex((a) => a > 0);
  const bottom = area.length - [...area].reverse().findIndex((a) => a > 0);
  const total = parts.reduce((s, p) => s + p.loc, 0) || 1;
  let [y, acc, want] = [top, 0, 0];
  const bands = parts.map((part, i) => {
    want += (part.loc / total) * mask.area;
    const y0 = y;
    const last = bottom - minBand * (parts.length - 1 - i);
    if (i === parts.length - 1) y = bottom;
    else while (y < last && (acc + area[y] / 2 < want || y < y0 + minBand)) acc += area[y++];
    return { part, y0, y1: Math.max(y, y0 + 1) };
  });
  const big = bands.reduce((a, b) => (b.part.loc > a.part.loc ? b : a));
  // The biggest part's type would be one line as tall as its band; every other part's scales from that by weight.
  const display = (big.y1 - big.y0) / BANDS.pitch;
  const set = (b, i, cap = Infinity) => {
    const wanted = Math.min(cap, Math.max(min, display * Math.pow(b.part.loc / big.part.loc, gamma)));
    Object.assign(b, typeset(mask, b.y0 + (i ? BANDS.gap : 0), b.y1, b.part.name.toLowerCase(), wanted));
  };
  bands.forEach((b, i) => set(b, i));
  // A smaller part never gets larger type than the biggest, whatever room its band has.
  bands.forEach((b, i) => b.part.loc < big.part.loc && b.size > big.size && set(b, i, big.size));
  return bands;
}

/**
 * A band's type from `a` to `floor`: as near `wanted` px as the band sets its name large and fills its height.
 * The size starts at the largest that holds the name whole on some line; a large size steps down while a smaller
 * one would cover much more of the band with whole names (a tall band whose width breaks up below its widest
 * line, across wheels, takes several lines of slightly smaller type and not one huge line).
 */
function typeset(mask, a, floor, name, wanted) {
  const h = floor - a;
  const most = fitSize(mask, a, floor, name);
  const linesAt = (size) => Math.max(1, Math.floor((h - TAIL * size) / (size * BANDS.pitch)));
  const start = Math.min(wanted, most);
  if (linesAt(start) === 1 && start <= h / (BANDS.pitch + TAIL) && start < BANDS.bold) {
    // A one-line band grows its type toward its height, but size encodes weight: a small part stretched to the
    // minimum height keeps its small type.
    return { size: Math.min(most, h / (BANDS.pitch + TAIL), wanted), lines: 1 };
  }
  const cover = (size) => {
    const lines = linesAt(size);
    const tops = lineTops(mask, a, floor, lines, size, name);
    const inked = tops.reduce((s, top) => s + lineSpans(mask, top, size, floor).reduce((n, [l, r]) => n + wholeNames(name, size, r - l), 0), 0);
    return { size, lines, cover: inked * nameWidth(name, size) * size };
  };
  const tries = [cover(start)];
  for (let s = start * 0.88; s >= Math.max(BANDS.bold, start / 3) && start >= BANDS.bold; s *= 0.88) tries.push(cover(s));
  const best = Math.max(...tries.map((t) => t.cover));
  const pick = tries.find((t) => t.cover >= 0.7 * best);
  if (pick.lines === 1) {
    // A lone line grows toward the band's height, at most `grow` times what its weight asks for.
    return { size: Math.min(most, h / (BANDS.pitch + TAIL), BANDS.grow * wanted), lines: 1 };
  }
  // Small type stretches to fill the band's height exactly, as far as the name still fits.
  if (pick.size < BANDS.bold) return { size: Math.max(pick.size, Math.min(most, h / (pick.lines * BANDS.pitch + TAIL))), lines: pick.lines };
  return { size: pick.size, lines: pick.lines };
}

/**
 * The largest type, at most one line as tall as the band from `a` to `floor`, at which `name` sits whole on some
 * line of it (a span inside the mask over the line's whole glyph height); never under BANDS.min.
 */
function fitSize(mask, a, floor, name) {
  const fits = (size) => {
    for (let top = a; top + GLYPH.bottom * size <= floor + 0.5; top += Math.max(1, size / 6)) {
      if (lineSpans(mask, top, size, floor).some(([l, r]) => r - l >= nameWidth(name, size))) return true;
    }
    return false;
  };
  let [lo, hi] = [BANDS.min, (floor - a) / (BANDS.pitch + TAIL)];
  if (hi <= lo || fits(hi)) return Math.max(lo, hi);
  if (!fits(lo)) return lo;
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Where a line of `size` px type whose top is `top` can sit: the spans inside the mask over its whole glyph height. */
export function lineSpans(mask, top, size, floor) {
  const y0 = Math.max(0, Math.floor(top + GLYPH.top * size));
  const y1 = Math.min(floor, Math.ceil(top + GLYPH.bottom * size), SHEET.height);
  if (y1 <= y0) return [];
  let spans = mask.runs[y0];
  for (let y = y0 + 1; y < y1 && spans.length; y++) spans = intersectRuns(spans, mask.runs[y]);
  return spans;
}

/** The px a name takes at `size`, with its tracking. */
export const nameWidth = (name, size) => name.length * (ADVANCE + trackOf(size)) * size - trackOf(size) * size;

/**
 * The bands style: each band in its theme's fill (the accent band in the accent) with its part's name repeated in
 * paper across every line, whole names only, centred in each span. A line holds letters only where the mask covers
 * its whole glyph height, so no letter is cut by a slanted edge, and a span too short for one name stays plain fill.
 * @param {import("../mask.mjs").Mask} mask
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts  in tree order
 * @param {{ measure: (text: string, size: number) => number, theme?: "light" | "dark" }} frame
 */
export function bandsStyle(mask, parts, { measure, theme = "light" }) {
  const { fills, shadow } = SHAPE_TONES[theme];
  const bands = shapeBands(mask, parts);
  const rows = [];
  const ground = [];
  bands.forEach((b, i) => {
    const a = b.y0 + (i ? BANDS.gap : 0);
    const h = b.y1 - a;
    const name = b.part.name.toLowerCase();
    ground.push({ part: b.part.id, hot: b.part.hot, tone: b.part.hot ? "hot" : fills[i % fills.length], rows: Array.from({ length: Math.max(0, h) }, (_, k) => [a + k, mask.runs[a + k]]) });
    if (h <= 0) return;
    const { size, lines } = b;
    const holds = (top) => lineSpans(mask, top, size, b.y1).some(([l, r]) => r - l >= nameWidth(name, size) - 0.01);
    let tops = lines === 1 ? [a + h / 2 - ((GLYPH.top + GLYPH.bottom) / 2) * size] : lineTops(mask, a, b.y1, lines, size, name);
    // Where no line holds the name, the lines slide (a lone line to the nearest place that does) until one does.
    if (!tops.some(holds)) {
      const room = b.y1 - (tops[tops.length - 1] + GLYPH.bottom * size);
      const shifts = Array.from({ length: Math.ceil(tops[0] - a) + Math.ceil(room) + 1 }, (_, k) => k - Math.ceil(tops[0] - a)).sort((p, q) => Math.abs(p) - Math.abs(q));
      const shift = shifts.find((d) => tops.some((t) => holds(t + d)));
      if (shift !== undefined) tops = tops.map((t) => t + shift);
    }
    const cycle = `${name} `;
    const track = trackOf(size) * size;
    const cw = ADVANCE * size;
    // The page's own advance differs from Commit Mono's 0.6em by a hair; the spacing takes it up so both agree.
    const spacing = track + cw - measure("M", size);
    for (const top of tops) {
      const height = Math.min(GLYPH.bottom * size, b.y1 - top);
      for (const [l, r] of lineSpans(mask, top, size, b.y1)) {
        const whole = wholeNames(name, size, r - l);
        if (!whole) continue;
        const text = cycle.repeat(whole).slice(0, -1);
        const width = text.length * cw + (text.length - 1) * track;
        rows.push({
          x: l + (r - l - width) / 2, y: top, width, height, lineHeight: BANDS.pitch * size,
          size, text, spacing, weight: size >= BANDS.bold ? 700 : 400, part: b.part.id, word: b.part.name, hot: b.part.hot, tone: b.part.hot ? "on-hot" : "paper",
        });
      }
    }
  });
  if (shadow) {
    // The whole shape cast down and right, under the fills, so their edges blend into the shadow and not into a
    // seam of paper; the gaps between bands are then painted back in paper.
    const cast = mask.runs.map((row, y) => [y + SHADOW, row.map(([l, r]) => [l + SHADOW, Math.min(SHEET.width, r + SHADOW)])]).filter(([y, spans]) => y < SHEET.height && spans.length);
    const gaps = bands.slice(1).flatMap((b) => Array.from({ length: BANDS.gap }, (_, k) => [b.y0 + k, mask.runs[b.y0 + k]]));
    ground.unshift({ part: null, hot: false, tone: shadow, rows: cast }, { part: null, hot: false, tone: "paper", rows: gaps });
  }
  return { bands, rows, ground };
}

/** How many whole copies of `name` at `size` fit across a span `width` px wide, a space between each. */
export function wholeNames(name, size, width) {
  const track = trackOf(size) * size;
  return Math.floor((Math.floor((width + track) / (ADVANCE * size + track)) + 1) / (name.length + 1));
}

/**
 * Where a band's lines go: the layout of at most `lines` lines `pitch` em apart that sets the most whole names,
 * among a few counts and offsets, centred in the band's slack when that ties. Under a slanted lid that is fewer
 * lines slid down; across wheels, every line that is wide enough somewhere.
 */
function lineTops(mask, a, floor, lines, size, name) {
  const step = BANDS.pitch * size;
  const names = (top) => lineSpans(mask, top, size, floor).reduce((n, [l, r]) => n + wholeNames(name, size, r - l), 0);
  let pick = null;
  for (let n = lines; n >= Math.max(1, lines - 6); n--) {
    const slack = Math.max(0, floor - a - (n - 1) * step - GLYPH.bottom * size);
    for (const t of [2, 1, 3, 0, 4]) {
      const tops = Array.from({ length: n }, (_, j) => a + (slack * t) / 4 + j * step);
      const count = tops.reduce((c, top) => c + names(top), 0);
      if (!pick || count > pick.count) pick = { tops, count };
    }
  }
  return pick.tops;
}

// The looks a shape can take over the same mask, by the region's `style`.
export const SHAPE_STYLES = { bands: bandsStyle, rings: ringsStyle, relief: reliefStyle };

/** A shape region drawn: its mask, its bands, its rows of type and the ground under them. */
export function shapeLayout(region, parts, frame) {
  const mask = shapeMask(region.shape);
  return { mask, ...SHAPE_STYLES[region.style ?? "bands"](mask, parts, { ...frame, region }) };
}

export const shapeRows = (region, parts, frame) => shapeLayout(region, parts, frame).rows;
export const shapeGround = (region, parts, frame) => shapeLayout(region, parts, frame).ground;

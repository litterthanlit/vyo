// The shape field: a silhouette the agent draws, filled from its mask. A style reads the mask and the parts and
// returns the rows of type and the ground under them; `bands` is the only style so far. Pure, like wave.mjs.
import { SHEET, ADVANCE } from "../geometry.mjs";
import { shapeMask, intersectRuns, subtractRuns } from "../mask.mjs";

// b-scale's numbers. A band per part, its area by lines; the biggest part's name one line as tall as its band,
// every other part's type that size times (its lines / the biggest's) to the power `gamma`, never under `min` px.
// Bands are at least `minBand` px tall and `gap` px apart; lines sit `pitch` em apart.
export const BANDS = { gamma: 2.4, min: 5, minBand: 8, gap: 3, pitch: 0.86, bold: 12 };
// Commit Mono's ascender top and descender bottom, in em below the top of a line set at `pitch` em.
const GLYPH = { top: 0.04, bottom: 0.99 };
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
 * `minBand` px tall, with its type size and line count.
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
  const display = (big.y1 - big.y0) / BANDS.pitch;
  for (const b of bands) {
    const h = b.y1 - b.y0;
    const wanted = Math.max(min, display * Math.pow(b.part.loc / big.part.loc, gamma));
    b.lines = Math.max(1, Math.floor(h / (wanted * BANDS.pitch)));
    b.size = h / b.lines / BANDS.pitch;
    // A small part stretched to the minimum height keeps its small type: size encodes weight.
    if (b.lines === 1 && wanted < BANDS.bold) b.size = Math.min(b.size, wanted);
  }
  return bands;
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
 * The bands style: each band filled with ink (the accent band with the accent) and its part's name repeated in
 * paper across every line, odd lines shifted half a name. A line holds letters only where the mask covers its
 * whole glyph height, so no letter is cut by a slanted edge. A one-line band shrinks its type until one whole
 * name fits, and centres the line.
 * @param {import("../mask.mjs").Mask} mask
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts  in tree order
 * @param {{ measure: (text: string, size: number) => number }} frame
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
    let { size, lines } = b;
    const centred = (s) => a + h / 2 - ((GLYPH.top + GLYPH.bottom) / 2) * s;
    if (lines === 1) {
      for (let k = 0; k < 4; k++) {
        const widest = Math.max(0, ...lineSpans(mask, centred(size), size, b.y1).map(([l, r]) => r - l));
        if (nameWidth(name, size) <= widest) break;
        size = Math.max(BANDS.min, (size * widest) / nameWidth(name, size));
      }
    }
    b.size = size;
    const tops = lines === 1 ? [centred(size)] : lineTops(mask, a, b.y1, lines, size);
    const cycle = `${name} `;
    const track = trackOf(size) * size;
    const cw = ADVANCE * size;
    // The page's own advance differs from Commit Mono's 0.6em by a hair; the spacing takes it up so both agree.
    const spacing = track + cw - measure("M", size);
    tops.forEach((top, j) => {
      const height = Math.min(GLYPH.bottom * size, b.y1 - top);
      let k = (j % 2) * Math.round(cycle.length / 2);
      for (const [l, r] of lineSpans(mask, top, size, b.y1)) {
        let n = Math.floor((r - l + track) / (cw + track));
        let x = l;
        if (lines === 1) {
          // A lone line starts on the name and centres its whole repeats.
          const whole = Math.max(1, Math.floor((n + 1) / cycle.length));
          n = Math.min(n, whole * cycle.length - 1);
          x = l + (r - l - (n * (cw + track) - track)) / 2;
          k = 0;
        }
        let text = Array.from({ length: Math.max(0, n) }, (_, c) => cycle[(k + c) % cycle.length]).join("");
        const lead = text.length - text.trimStart().length;
        text = text.trim();
        k += n;
        if (!text) continue;
        rows.push({
          x: x + lead * (cw + track), y: top, width: text.length * cw + (text.length - 1) * track, height, lineHeight: BANDS.pitch * size,
          size, text, spacing, weight: size >= BANDS.bold ? 700 : 400, part: b.part.id, word: b.part.name, hot: b.part.hot, tone: b.part.hot ? "on-hot" : "paper",
        });
      }
    });
  });
  if (shadow) {
    const cast = mask.runs
      .map((row, y) => [y + SHADOW, subtractRuns(row.map(([l, r]) => [l + SHADOW, Math.min(SHEET.width, r + SHADOW)]), mask.runs[y + SHADOW] ?? [])])
      .filter(([y, spans]) => y < SHEET.height && spans.length);
    ground.unshift({ part: null, hot: false, tone: shadow, rows: cast });
  }
  return { bands, rows, ground };
}

/**
 * Where a band's lines go: `lines` of them `pitch` em apart from its top, unless a line there would hold less
 * than half the band's widest line, as under a slanted lid. Then one line fewer, slid down the freed room to
 * where its narrowest line is widest, and so on while that helps.
 */
function lineTops(mask, a, floor, lines, size) {
  const step = BANDS.pitch * size;
  const room = (top) => Math.max(0, ...lineSpans(mask, top, size, floor).map(([l, r]) => r - l));
  const layout = (n, off) => {
    const tops = Array.from({ length: n }, (_, j) => a + off + j * step);
    return { tops, worst: Math.min(...tops.map(room)), best: Math.max(...tops.map(room)) };
  };
  let pick = layout(lines, 0);
  const widest = pick.best;
  for (let n = lines - 1; n >= 1 && pick.worst < widest / 2; n--) {
    const slack = floor - a - n * step;
    const tries = [0, 1, 2, 3, 4].map((t) => layout(n, (slack * t) / 4));
    const better = tries.reduce((p, q) => (q.worst > p.worst ? q : p));
    if (better.worst <= pick.worst) break;
    pick = better;
  }
  return pick.tops;
}

// The looks a shape can take over the same mask, by the region's `style`.
export const SHAPE_STYLES = { bands: bandsStyle };

/** A shape region drawn: its mask, its bands, its rows of type and the ground under them. */
export function shapeLayout(region, parts, frame) {
  const mask = shapeMask(region.shape);
  return { mask, ...SHAPE_STYLES[region.style ?? "bands"](mask, parts, frame) };
}

export const shapeRows = (region, parts, frame) => shapeLayout(region, parts, frame).rows;
export const shapeGround = (region, parts, frame) => shapeLayout(region, parts, frame).ground;

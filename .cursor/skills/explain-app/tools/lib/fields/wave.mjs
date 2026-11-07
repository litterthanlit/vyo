// The wave field: rows of part names, one per `unit` lines of each part, bent into one band that enters at
// the top on the side away from the masthead, swings across and leaves through the floor. Pure: render
// inlines it, `vyo sketch` imports it.
import { SHEET, clearOf } from "../geometry.mjs";

// 60 to 72 rows from the top edge to the floor at size 11: the density of the mockups' bands at 7px.
export const WAVE = { rows: [60, 72], size: 11, every: 5 };
// The mockup's letter spacing was tuned for a 6.9px font; it scales with the size.
const MOCKUP_SIZE = 6.9;

/** A part's tint: parts near the top of the tree darker than the ones deep inside it. */
export const depthTone = (id) => (id === "area:." || id.split("/").length <= 2 ? "mid" : "soft");

/** `word` and three spaces, repeated letter by letter from the left, as many letters as fit in `room` at this spacing. */
export function repeatTo(word, room, cw, spacing) {
  const cycle = `${word}   `;
  const n = Math.floor((room + spacing) / (cw + spacing));
  const text = Array.from({ length: Math.max(0, n) }, (_, i) => cycle[i % cycle.length]).join("").trimEnd();
  return { text, width: text.length ? text.length * cw + (text.length - 1) * spacing : 0 };
}

const rowCount = (parts, unit) => parts.reduce((n, p) => n + Math.max(1, Math.round(p.loc / unit)), 0);

/** Lines per row: about total / 66, nudged until the band has 60 to 72 rows. */
export function waveUnit(parts) {
  const [lo, hi] = WAVE.rows;
  let unit = Math.max(1, Math.ceil(parts.reduce((s, p) => s + p.loc, 0) / ((lo + hi) / 2)));
  while (unit > 1 && rowCount(parts, unit) < lo) unit--;
  while (rowCount(parts, unit) > hi && rowCount(parts, unit + 1) < rowCount(parts, unit)) unit++;
  return unit;
}

/**
 * The rows of a wave region, top to bottom, each cut around the text blocks.
 * @param {{ sentence?: string, every?: number }} region
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts  in tree order
 * @param {{ floor: number, mirror: boolean, blocks: { left: number, top: number, right: number, bottom: number }[], measure: (text: string, size: number) => number }} frame
 */
export function waveRows(region, parts, { floor, mirror, blocks, measure }) {
  const { size } = WAVE;
  const every = region.every ?? WAVE.every;
  const unit = waveUnit(parts);
  const rows = parts.flatMap((p) => Array(Math.max(1, Math.round(p.loc / unit))).fill(p));
  const pitch = floor / rows.length;
  const height = Math.floor(pitch);
  const cw = measure("M", size);
  const out = [];
  rows.forEach((p, i) => {
    const y = Math.round(i * pitch);
    const t = rows.length > 1 ? i / (rows.length - 1) : 0;
    // The first mockup's swell: in at the top right, deep to the left, out through the bottom.
    const cx = 760 - 400 * Math.sin(Math.PI * t ** 0.75) - 230 * t;
    const centre = mirror ? SHEET.width - cx : cx;
    // The band thickens where the line turns, less toward the bottom, and its letters open up with it.
    const slope = Math.cos(Math.PI * t ** 0.75);
    const half = 120 + 95 * slope * slope * (1 - 0.5 * t);
    const spacing = (0.6 + (half - 120) / 9) * (size / MOCKUP_SIZE);
    const said = region.sentence && i % every === every - 1;
    const word = (said ? region.sentence : p.name).toLowerCase();
    const tone = p.hot ? "hot" : depthTone(p.id);
    for (const [l, r] of clearOf([[Math.max(0, centre - half), Math.min(SHEET.width - 1, centre + half)]], y, height, blocks)) {
      const { text, width } = repeatTo(word, r - l, cw, spacing);
      if (text) out.push({ x: l, y, width, height, size, text, spacing, part: p.id, word: said ? region.sentence : p.name, hot: p.hot, tone });
    }
  });
  return out;
}

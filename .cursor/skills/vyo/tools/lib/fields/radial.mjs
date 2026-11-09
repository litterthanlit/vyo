// The radial field: part names repeated on horizontal chords that widen from an apex, like a type-only
// vanishing point. Pure: render inlines it, `vyo sketch` imports it.
import { SHEET, clearOf } from "../geometry.mjs";
import { rowsPerPart, repeatTo, toneSet, depthTone } from "./wave.mjs";

export const RADIAL = { size: 5.6, pitch: 6.4 };

/**
 * Rows of a radial region: a triangle of type from near the top of the sheet to the floor.
 * @param {{}} region
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts
 * @param {{ floor: number, theme?: string, frame?: string, measure: (text: string, size: number) => number }} o
 */
export function radialRows(region, parts, { floor, theme = "light", frame, measure }) {
  const { size, pitch } = RADIAL;
  const cx = SHEET.width * 0.5;
  const apex = 36;
  const slots = Array.from({ length: Math.floor(floor / pitch) }, (_, i) => {
    const y = Math.round(i * pitch * 10) / 10;
    const t = Math.max(0, (y - apex) / Math.max(1, floor - apex));
    const half = 28 + t * 390;
    const left = Math.max(0, cx - half);
    const right = Math.min(SHEET.width - 2, cx + half);
    return { y, runs: clearOf([[left, right]], y, pitch, []) };
  });
  const counts = rowsPerPart(parts, slots.length);
  const rows = parts.flatMap((p, i) => Array(counts[i]).fill(p)).slice(0, slots.length);
  const cw = Math.round(measure("M", size) * 20) / 20;
  const tones = toneSet(theme, frame);
  const out = [];
  rows.forEach((p, i) => {
    const { y, runs } = slots[i];
    const spacing = 0.3 + (i % 7) * 0.04;
    for (const [l, r] of runs) {
      const { text, width } = repeatTo(p.name.toLowerCase(), r - l, cw, spacing);
      if (text) out.push({ x: l, y, width, height: pitch, size, text, spacing, part: p.id, word: p.name, hot: p.hot, tone: p.hot ? tones.hot : depthTone(p.id, theme, frame) });
    }
  });
  return out;
}

// The sphere field: a grid of type-built ellipses that flatten down the page, one parameter at a time.
// Pure: render inlines it, `vyo sketch` imports it.
import { SHEET, clearOf } from "../geometry.mjs";
import { rowsPerPart, repeatTo, toneSet, depthTone } from "./wave.mjs";
import { relayout } from "./chords.mjs";

export const SPHERE = { size: 4.6, pitch: 5.2, cols: 3, rows: 5, pad: 18 };

/**
 * Rows of a sphere region: `cols` by `rows` ellipses of tiny letters. Flatten grows down the page.
 * @param {{}} region
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts
 * @param {{ floor: number, theme?: string, frame?: string, measure: (text: string, size: number) => number }} o
 */
export function sphereRows(region, parts, opts) {
  if (region.seed) return relayout(region, parts, opts, sphereRows, { size: SPHERE.size, pitch: SPHERE.pitch, behindTexts: true });
  const { floor, theme = "light", frame, measure } = opts;
  const { size, pitch, cols, rows: nRows, pad } = SPHERE;
  const cellW = (SHEET.width - pad * 2) / cols;
  const cellH = (floor - pad * 2) / nRows;
  const rx = cellW * 0.42;
  const ry0 = Math.min(cellH * 0.42, rx);
  const slots = [];
  for (let j = 0; j < nRows; j++) {
    const flatten = nRows === 1 ? 0 : j / (nRows - 1);
    const ry = Math.max(14, ry0 * (1 - 0.72 * flatten));
    for (let i = 0; i < cols; i++) {
      const cx = pad + cellW * (i + 0.5);
      const cy = pad + cellH * (j + 0.5);
      const top = cy - ry;
      const bottom = cy + ry;
      const bands = [];
      for (let y = top; y <= bottom; y += pitch) {
        const dy = (y - cy) / ry;
        const half = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
        if (half < 10) continue;
        bands.push({ y: Math.round(y * 10) / 10, runs: clearOf([[cx - half, cx + half]], y, pitch, []) });
      }
      slots.push({ bands, i, j });
    }
  }
  const counts = rowsPerPart(parts, slots.length);
  const owner = parts.flatMap((p, i) => Array(counts[i]).fill(p)).slice(0, slots.length);
  const cw = Math.round(measure("M", size) * 20) / 20;
  const tones = toneSet(theme, frame);
  const out = [];
  slots.forEach((slot, s) => {
    const p = owner[s];
    if (!p) return;
    const spacing = 0.2;
    for (const { y, runs } of slot.bands) {
      for (const [l, r] of runs) {
        const { text, width } = repeatTo(p.name.toLowerCase(), r - l, cw, spacing);
        if (text) out.push({ x: l, y, width, height: pitch, size, text, spacing, part: p.id, word: p.name, hot: p.hot, tone: p.hot ? tones.hot : depthTone(p.id, theme, frame) });
      }
    }
  });
  return out;
}

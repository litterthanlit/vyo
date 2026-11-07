// The terrain field: one peak per part, as tall as its share of lines and as wide as its share of files,
// left to right in tree order; rows of the names of the slopes they cross. Pure, like wave.mjs.
import { SHEET, GRID, clearOf } from "../geometry.mjs";

export const TERRAIN = {
  size: 11,
  span: [0, SHEET.width], // edge peaks stand on the edges, so the range runs off both sides
  below: 70, // the base sits this far under the floor, so the range runs off the bottom too
  summit: 0.32, // the tallest peak's top, as a share of the floor
  minWidth: 40, // a small part still shows as a foothill
  footRows: 2, // no valley drops below this many rows above the floor
};
const RIDGE_NORM = 4;
const RIM_ROWS = 1.2;

/** Each part's share of `span` by its files, with no part narrower than `min`. */
function peakWidths(parts, span, min) {
  const fixed = new Set();
  for (;;) {
    const free = parts.filter((p) => !fixed.has(p.id));
    const room = span - fixed.size * min;
    const files = free.reduce((s, p) => s + Math.max(1, p.files), 0);
    const narrow = free.filter((p) => (Math.max(1, p.files) / files) * room < min);
    if (!narrow.length) return parts.map((p) => (fixed.has(p.id) ? min : (Math.max(1, p.files) / files) * room));
    for (const p of narrow) fixed.add(p.id);
  }
}

/** The ridge: at each whole x its height above the base, the part whose slope it is, and the foothill under it. */
export function ridge(parts, floor) {
  const { span: [x0, x1], below, summit, minWidth, footRows } = TERRAIN;
  const { pitch } = GRID[TERRAIN.size];
  const foot = below + footRows * pitch;
  const top = Math.max(1, ...parts.map((p) => p.loc));
  const scale = (floor + below - floor * summit) / top;
  const widths = peakWidths(parts, x1 - x0, minWidth);
  let left = x0;
  const peaks = parts.map((p, i) => {
    const q = { part: p, centre: left + widths[i] / 2, width: widths[i], height: Math.max(p.loc * scale, foot + 2 * pitch) };
    left += widths[i];
    return q;
  });
  // The mockup's peak: a stretched exponential, merged with its neighbours through a p-norm.
  const bump = (q, x) => q.height * Math.exp(-Math.pow(Math.abs(x - q.centre) / (q.width * 1.25 + 30), 1.5) * 1.1);
  // A slope belongs to the tallest bump over it, except low across the middle `minWidth` of each peak, up to
  // its own height: a foothill under a big neighbour's shoulder still shows, as a foothill.
  const core = (x) => peaks.find((q) => Math.abs(x - q.centre) <= minWidth / 2);
  const at = (x) => {
    let sum = 0;
    let owner = peaks[0];
    let best = -1;
    for (const q of peaks) {
      const b = bump(q, x);
      sum += b ** RIDGE_NORM;
      if (b > best) [best, owner] = [b, q];
    }
    const own = core(x);
    return { h: Math.max(foot, sum ** (1 / RIDGE_NORM)), part: owner.part, foothill: own && { part: own.part, h: bump(own, x) } };
  };
  const xs = Array.from({ length: SHEET.width + 9 }, (_, i) => at(i - 4));
  return (x) => xs[Math.min(xs.length - 1, Math.max(0, Math.round(x) + 4))];
}

/**
 * The rows of a terrain region, bottom to top: runs of letters, each one part, one shade and one spacing.
 * @param {object} region
 * @param {{ id: string, name: string, loc: number, files: number, hot: boolean }[]} parts  in tree order
 * @param {{ floor: number, blocks: { left: number, top: number, right: number, bottom: number }[], measure: (text: string, size: number) => number }} frame
 */
export function terrainRows(region, parts, { floor, blocks, measure }) {
  if (!parts.length) return [];
  const { size, below } = TERRAIN;
  const { pitch } = GRID[size];
  // Rounded so the page's measured advance and the sketch's fixed one place every letter alike.
  const cw = Math.round(measure("M", size) * 100) / 100;
  const at = ridge(parts, floor);
  const base = floor + below;
  const out = [];
  for (let y = Math.floor((floor - pitch) / pitch) * pitch; y >= 0; y -= pitch) {
    const level = base - (y + pitch / 2);
    const clear = clearOf([[0, SHEET.width - 1]], y, pitch, blocks);
    let run = null;
    const close = () => {
      if (run) {
        const lead = run.text.length - run.text.trimStart().length;
        const text = run.text.trim();
        if (text) out.push({ ...run, x: run.x + lead * run.advance, text, width: text.length * cw + (text.length - 1) * (run.advance - cw), spacing: run.advance - cw });
      }
      run = null;
    };
    let px = 0;
    let part = null;
    let k = 0;
    while (px + cw <= SHEET.width - 1) {
      const here = at(px);
      const owner = here.foothill && level <= here.foothill.h ? here.foothill.part : here.part;
      if (here.h < level || !clear.some(([l, r]) => px >= l && px + cw <= r)) {
        close();
        part = null;
        px += cw;
        continue;
      }
      if (owner !== part) {
        close();
        if (part) px += cw * 2;
        part = owner;
        k = 0;
        continue;
      }
      const slope = (at(px + 4).h - at(px - 4).h) / 8;
      const lit = Math.min(1, Math.max(0, 0.5 + slope * 0.5));
      const tone = part.hot ? "hot" : here.h - level < RIM_ROWS * pitch ? "ink" : lit >= 0.5 ? "mid" : "soft";
      // Letters spread on steep slopes and sit tight on flats, in half-pixel steps so runs stay long.
      const advance = Math.round(cw * (0.94 + 0.36 * Math.min(Math.abs(slope), 1.6)) * 2) / 2;
      if (run && (run.tone !== tone || run.advance !== advance)) close();
      const word = `${part.name.toLowerCase()}   `;
      run ??= { x: px, y, height: pitch, size, text: "", advance, part: part.id, word: part.name, hot: part.hot, tone };
      run.text += word[k++ % word.length];
      px += advance;
    }
    close();
  }
  return out.map(({ advance, ...r }) => r);
}

// The terrain field: one peak per part, as tall as its share of lines and as wide as its share of files,
// left to right in tree order; rows of the names of the slopes they cross. Pure, like wave.mjs.
import { SHEET, clearOf } from "../geometry.mjs";

// e-terrain's numbers: 6.9px letters on 7.6px rows.
export const TERRAIN = {
  size: 6.9,
  pitch: 7.6,
  span: [0, SHEET.width], // edge peaks stand on the edges, so the range runs off both sides
  below: 70, // the base sits this far under the floor, so the range runs off the bottom too
  summit: 0.32, // the tallest peak's top, as a share of the floor
  minWidth: 40, // a small part still shows as a foothill
  footRows: 2, // no valley drops below this many rows above the floor
  // Alpha added to every letter, and to the accent's letters on top: the dark alphas wash out on paper (i-loose).
  lift: { light: [0.14, 0.5], dark: [0, 0.3] },
};
const RIDGE_NORM = 4;
// Within this depth under the ridge a letter is the rim: ink, brighter.
const RIM = 9;

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
  const { pitch } = TERRAIN;
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
  // A slope belongs to the tallest bump over it, except inside a foothill: under the nearest peak whose own
  // width holds x, a hill of that peak's height that narrows to nothing at its edges. A part under a big
  // neighbour's shoulder still shows, as a pointed hill, never as a column.
  const near = (x) => peaks.reduce((n, q) => (Math.abs(x - q.centre) < Math.abs(x - n.centre) ? q : n));
  const at = (x) => {
    let sum = 0;
    let owner = peaks[0];
    let best = -1;
    for (const q of peaks) {
      const b = bump(q, x);
      sum += b ** RIDGE_NORM;
      if (b > best) [best, owner] = [b, q];
    }
    const own = near(x);
    const edge = 1 - Math.abs(x - own.centre) / (own.width / 2);
    const foothill = own !== owner && edge > 0 ? { part: own.part, h: foot + (bump(own, x) - foot) * edge } : null;
    return { h: Math.max(foot, sum ** (1 / RIDGE_NORM)), part: owner.part, foothill };
  };
  const xs = Array.from({ length: SHEET.width + 9 }, (_, i) => at(i - 4));
  return (x) => xs[Math.min(xs.length - 1, Math.max(0, Math.round(x) + 4))];
}

/** How bright a letter is, as e-terrain shades it: slopes facing left catch the light, the rim and the accent stand out. */
function shade(slope, depth, hot, theme) {
  const [lift, hotLift] = TERRAIN.lift[theme] ?? TERRAIN.lift[String(theme).endsWith("dark") ? "dark" : "light"];
  const lit = Math.min(1, Math.max(0, 0.5 + slope * 0.5));
  let a = 0.42 + 0.5 * lit - Math.min(0.2, depth / 1600) + lift;
  if (depth < RIM) a += 0.35;
  if (hot) a += hotLift;
  return Math.round(Math.min(1, Math.max(0.22, a)) * 10) / 10;
}

/** A run's letters cut back to its last whole word, unless not one word fits. */
function wholeWords(letters) {
  const end = letters.findLastIndex((l) => l.wordEnd);
  return end < 0 ? letters : letters.slice(0, end + 1);
}

/** True when the `n`th letter of a part's repeated name falls inside a word, after its first letter. */
function midWord(part, n) {
  const cycle = `${part.name.toLowerCase()}   `;
  const k = n % cycle.length;
  return k > 0 && cycle[k] !== " " && cycle[k - 1] !== " ";
}

/**
 * The rows of a terrain region, bottom to top: runs of letters, each one part, one shade and one spacing.
 * A word in progress runs on past the border into the next part's slope, so no name breaks there.
 * @param {object} region
 * @param {{ id: string, name: string, loc: number, files: number, hot: boolean }[]} parts  in tree order
 * @param {{ floor: number, blocks: { left: number, top: number, right: number, bottom: number }[], measure: (text: string, size: number) => number, theme?: "light" | "dark" }} frame
 */
export function terrainRows(region, parts, { floor, blocks, measure, theme = "dark" }) {
  if (!parts.length) return [];
  const { size, pitch, below } = TERRAIN;
  // Rounded to 0.05px so the page's measured advance (4.134 at 6.9px) and the sketch's fixed 4.14 agree.
  const cw = Math.round(measure("M", size) * 20) / 20;
  const at = ridge(parts, floor);
  const base = floor + below;
  const out = [];
  const emit = (letters, y) => {
    let item = null;
    const close = () => {
      if (!item) return;
      const text = item.text.trimEnd();
      if (text) out.push({ ...item, text, width: text.length * cw + (text.length - 1) * item.spacing });
      item = null;
    };
    for (const l of letters) {
      const spacing = l.advance - cw;
      if (item && (item.tone !== l.tone || item.alpha !== l.alpha || item.spacing !== spacing)) close();
      if (!item && l.ch === " ") continue;
      item ??= { x: l.x, y, height: pitch, size, text: "", spacing, part: l.part.id, word: l.part.name, hot: l.part.hot, tone: l.tone, alpha: l.alpha };
      item.text += l.ch;
    }
    close();
  };
  for (let y = Math.round((floor - pitch) * 10) / 10; y >= 0; y = Math.round((y - pitch) * 10) / 10) {
    const level = base - (y + pitch / 2);
    const clear = clearOf([[0, SHEET.width - 1]], y, pitch, blocks);
    let px = 0;
    let part = null;
    let claim = null;
    let run = [];
    const flush = () => {
      if (run.length) emit(run, y);
      run = [];
    };
    while (px + cw <= SHEET.width - 2) {
      const here = at(px);
      if (here.h < level || !clear.some(([l, r]) => px >= l && px + cw <= r)) {
        flush();
        part = null;
        px += cw;
        continue;
      }
      const inFoothill = here.foothill && level <= here.foothill.h;
      // A word runs on over a border, except into a foothill, which would vanish under it: there the run
      // before it ends on its last whole word, and the foothill's name starts where the cut word began.
      let owner = part && !inFoothill && midWord(part, run.length) ? part : inFoothill ? here.foothill.part : here.part;
      if (claim && px < claim.to) owner = claim.part;
      if (owner !== part) {
        if (inFoothill && part) {
          const kept = wholeWords(run);
          if (kept.length < run.length) {
            claim = { part: owner, to: px };
            px = run[kept.length].x;
            run = kept;
          }
        }
        flush();
        if (part) px += cw * 2;
        part = owner;
        continue;
      }
      const slope = (at(px + 4).h - at(px - 4).h) / 8;
      const depth = here.h - level;
      const cycle = `${part.name.toLowerCase()}   `;
      const k = run.length % cycle.length;
      // Letters spread on steep slopes and sit tight on flats, in quarter-pixel steps so runs stay long.
      const advance = Math.round((cw * 0.94 + 1.5 * Math.min(Math.abs(slope), 1.6)) * 4) / 4;
      run.push({
        x: px, ch: cycle[k], part, advance, wordEnd: cycle[k] !== " " && cycle[k + 1] === " ",
        tone: part.hot ? "hot" : depth < RIM ? "ink" : "mid", alpha: shade(slope, depth, part.hot, theme),
      });
      px += advance;
    }
    flush();
  }
  return out;
}

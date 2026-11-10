// The rings style of the shape field: the parts' names set along inward offsets of the silhouette's outline, a
// run of rings per part in tree order from the outline in, as much area as its lines. Where the rings would fold
// over the shape's skeleton they stop, and the core left inside is set in level lines. Everything is read from
// the mask's signed distance field. Pure, like shape.mjs: render inlines it, `vyo sketch` and the checks import it.
import { SHEET, ADVANCE } from "../geometry.mjs";
import { edt } from "../mask.mjs";

// Rings sit `gap` px apart, set in `size` px type, rounded over up to `round` px. A loop that runs more than `fold`
// of its length within reach of the skeleton (where the field's slope drops under `slope`) would pile up, so what
// it encloses is a core; so is the innermost `core` of the shape's area. The accent spans at least `accent`
// rings, so its band shows at thumbnail size; a shape wants `perPart` rings per part. A name reads upright when
// it leans at most `upright` degrees, and is dropped where it turns more than `bend` degrees between two letters.
// Hairlines are `hairline` px either side of their line. Echoes sit `echoGap` rings apart outside the outline,
// kept `clear` px off text, at most `maxEcho` of them.
export const RINGS = { gap: 7, size: 6.6, round: 14, fold: 0.3, core: 0.1, perPart: 1.5, slope: 0.55, accent: 2, upright: 30, bend: 24, hairline: 0.32, echoGap: 1.4, clear: 16, maxEcho: 12 };
const RING_SEP = " · ";
// Per theme: the fill under the whole shape, the core's fill, the type, the hairlines, and how strong the echoes are. On
// paper, ink type on paper read as a grey outline at thumbnail size, so the light shape is solid ink with type
// reversed out, like the dark theme's sheet.
export const RING_TONES = {
  light: { base: "ink", core: "cool", type: "paper", line: "paper", echo: 0.7 },
  dark: { base: null, core: "cold", type: "ink", line: "ink", echo: 1 },
};
// Where a glyph's ink sits around its ring: the baseline this far below the ring, in em, and a glyph's half
// height for spacing, in em.
const RING_BASE = 0.34;
const RING_HALF = 0.36;

/** The mask's signed distance at every sheet pixel's centre: positive inside, in px, and its slope. */
export function ringField(mask) {
  const { width: W, height: H } = SHEET;
  const inside = new Uint8Array(W * H);
  mask.runs.forEach((row, y) => {
    for (const [l, r] of row) for (let x = Math.max(0, Math.ceil(l - 0.5)); x < W && x + 0.5 < r; x++) inside[y * W + x] = 1;
  });
  const din = edt(Float64Array.from(inside, (b) => (b ? 1e12 : 0)), W, H);
  const dout = edt(Float64Array.from(inside, (b) => (b ? 0 : 1e12)), W, H);
  const sd = new Float32Array(W * H);
  let deepest = 0;
  for (let i = 0; i < W * H; i++) {
    sd[i] = inside[i] ? Math.sqrt(din[i]) - 0.5 : 0.5 - Math.sqrt(dout[i]);
    if (sd[i] > deepest) deepest = sd[i];
  }
  const at = (x, y) => sd[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  const slope = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) slope[y * W + x] = Math.hypot(at(x + 2, y) - at(x - 2, y), at(x, y + 2) - at(x, y - 2)) / 4;
  // Each cell's lowest and highest corner, so tracing a level skips the cells it cannot cross.
  const lo = new Float32Array(W * H).fill(Infinity);
  const hi = new Float32Array(W * H).fill(-Infinity);
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const i = y * W + x;
      const [a, b, c, d] = [sd[i], sd[i + 1], sd[i + W], sd[i + W + 1]];
      lo[i] = Math.min(a, b, c, d);
      hi[i] = Math.max(a, b, c, d);
    }
  }
  return { sd, slope, lo, hi, W, H, deepest, at };
}

/** Marching squares at one level: lines of points in sheet px inside the box [x0, x1) by [y0, y1), closed or not. */
function isoLoops(field, level, [x0, y0, x1, y1]) {
  const { sd, W } = field;
  const v = (x, y) => sd[y * W + x] - level;
  const pt = new Map();
  const link = new Map();
  const point = (id) => {
    if (pt.has(id)) return;
    const cell = id >> 1;
    const [x, y] = [cell % W, Math.floor(cell / W)];
    const [x2, y2] = id & 1 ? [x, y + 1] : [x + 1, y];
    const [a, b] = [v(x, y), v(x2, y2)];
    const t = a / (a - b);
    pt.set(id, [x + 0.5 + (x2 - x) * t, y + 0.5 + (y2 - y) * t]);
  };
  const join = (a, b) => {
    point(a);
    point(b);
    (link.get(a) ?? link.set(a, []).get(a)).push(b);
    (link.get(b) ?? link.set(b, []).get(b)).push(a);
  };
  const { lo, hi } = field;
  for (let y = y0; y < y1 - 1; y++) {
    for (let x = x0; x < x1 - 1; x++) {
      if (lo[y * W + x] > level || hi[y * W + x] <= level) continue;
      const [a, b, c, d] = [v(x, y), v(x + 1, y), v(x + 1, y + 1), v(x, y + 1)];
      const code = (a > 0) | ((b > 0) << 1) | ((c > 0) << 2) | ((d > 0) << 3);
      if (code === 0 || code === 15) continue;
      const T = 2 * (y * W + x);
      const B = 2 * ((y + 1) * W + x);
      const L = T + 1;
      const R = 2 * (y * W + x + 1) + 1;
      const mid = a + b + c + d > 0;
      const segs = {
        1: [[L, T]], 2: [[T, R]], 3: [[L, R]], 4: [[R, B]], 6: [[T, B]], 7: [[L, B]], 8: [[B, L]],
        9: [[B, T]], 11: [[B, R]], 12: [[R, L]], 13: [[R, T]], 14: [[T, L]],
        5: mid ? [[L, T], [R, B]] : [[L, B], [R, T]],
        10: mid ? [[T, R], [B, L]] : [[T, L], [B, R]],
      }[code];
      for (const [p, q] of segs) join(p, q);
    }
  }
  // Lines that leave the box (a shape that bleeds off the sheet) are open: trace those from their ends first.
  const loops = [];
  const seen = new Set();
  const ends = [...link.keys()].filter((k) => link.get(k).length === 1);
  for (const start of [...ends, ...link.keys()]) {
    if (seen.has(start)) continue;
    const pts = [];
    let [prev, cur] = [-1, start];
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur);
      pts.push(pt.get(cur));
      const next = link.get(cur).find((n) => n !== prev && !seen.has(n));
      [prev, cur] = [cur, next];
    }
    if (pts.length > 8) loops.push({ pts, closed: link.get(start).length === 2 });
  }
  return loops;
}

const loopArea = (pts) => pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0) / 2;

/** Points every `step` px along a line, round its end back to its start when closed. */
function resampleLoop(pts, step, closed) {
  const out = [];
  let carry = 0;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = carry; t < len; t += step) out.push([a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len]);
    carry = (((carry - len) % step) + step) % step;
  }
  if (!closed) out.push(pts[pts.length - 1]);
  return out;
}

/** A moving average over `half` points either side; an open line's ends average over what they have. */
function averageLoop(pts, half, closed) {
  if (half < 1) return pts;
  const n = pts.length;
  return pts.map((_, i) => {
    let [x, y, k] = [0, 0, 0];
    for (let j = -half; j <= half; j++) {
      if (!closed && (i + j < 0 || i + j >= n)) continue;
      const p = pts[(i + j + n) % n];
      x += p[0];
      y += p[1];
      k++;
    }
    return [x / k, y / k];
  });
}

/** A traced line rounded over `round` px; a closed one clockwise on screen, so every ring runs the same way. */
function smoothLoop({ pts, closed }, round) {
  let out = averageLoop(resampleLoop(pts, 1.5, closed), Math.round(round / 3), closed);
  if (closed && loopArea(out) < 0) out = out.reverse();
  return { pts: out, closed };
}

/** A line as a walk: its length, and the point and heading at arc length s. */
function walkOf({ pts, closed }) {
  const cum = [0];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) cum.push(cum[i] + Math.hypot(pts[(i + 1) % pts.length][0] - pts[i][0], pts[(i + 1) % pts.length][1] - pts[i][1]));
  const length = cum[n];
  const pointAt = (s) => {
    s = closed ? ((s % length) + length) % length : Math.min(length, Math.max(0, s));
    let [lo, hi] = [0, n];
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= s) lo = m;
      else hi = m;
    }
    const [a, b] = [pts[lo], pts[(lo + 1) % pts.length]];
    const t = (s - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  const headingAt = (s) => {
    const [a, b] = [pointAt(s - 2), pointAt(s + 2)];
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  return { length, closed, pointAt, headingAt };
}

/** A closed or open line as a ribbon `half` px either side, for a clip path. */
function ribbon(pts, half, closed) {
  const n = pts.length;
  const side = (k) =>
    pts.map((p, i) => {
      const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
      const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [p[0] - (k * half * (b[1] - a[1])) / len, p[1] + (k * half * (b[0] - a[0])) / len];
    });
  const f = (q) => `${Math.round(q[0] * 100) / 100} ${Math.round(q[1] * 100) / 100}`;
  const line = (q) => `M${q.map(f).join("L")}Z`;
  return closed ? line(side(1)) + line(side(-1).reverse()) : line([...side(1), ...side(-1).reverse()]);
}

/** Where `level` <= sd < `upper` on each pixel row from yFrom to yTo, as [y, spans] with sub-pixel ends. */
function levelRows(field, level, upper, yFrom = 0, yTo = field.H, skip = () => false) {
  const { sd, W } = field;
  const rows = [];
  const cross = (x, prev, here) => {
    const edge = Math.min(prev, here) < level ? level : upper;
    return x - 0.5 + Math.min(1, Math.max(0, (edge - prev) / (here - prev || 1)));
  };
  for (let y = Math.max(0, yFrom); y < Math.min(field.H, yTo); y++) {
    const spans = [];
    let open = null;
    for (let x = 0; x <= W; x++) {
      const here = x < W ? sd[y * W + x] : -Infinity;
      const on = here >= level && here < upper && !skip(y * W + x);
      if (on && open === null) open = x ? cross(x, sd[y * W + x - 1], here) : 0;
      else if (!on && open !== null) {
        spans.push([open, x < W ? cross(x, sd[y * W + x - 1], here) : W]);
        open = null;
      }
    }
    if (spans.length) rows.push([y, spans]);
  }
  return rows;
}

/**
 * How the parts share the shape, outline in and in tree order, each covering its share of the shape's area. A
 * place in the rings is a ring coordinate u: ring floor(u), a fraction u - floor(u) of the way round it, so a
 * part may end part way round a ring and the next part take the rest; the boundary steps in by one ring there.
 * Past the last ring the core is cut into runs of pixel rows. Every part spans at least `least(k, u)` rings,
 * which keeps room for its name and the accent's band wide enough to see. `start` is the ring coordinate the
 * first part starts at: the parts share what lies inside it, each in proportion to its lines.
 * @param {{ loc: number }[]} parts  in the order they run inward
 * @param {number[]} ringAreas  px² of each ring's strip, outline first
 * @param {number[]} coreRows   px² of the core on each sheet row
 * @param {(k: number, u: number) => number} least  the fewest rings part k may span from u
 * @returns {{ from: number, to: number, core: [number, number] | null, area: number }[]}
 */
export function allotRings(parts, ringAreas, coreRows, least = () => 0, start = 0) {
  const R = ringAreas.length;
  const cum = [0];
  for (const a of ringAreas) cum.push(cum[cum.length - 1] + a);
  const ringTotal = cum[R];
  const coreTotal = coreRows.reduce((s, a) => s + a, 0);
  const total = ringTotal + coreTotal;
  const loc = parts.reduce((s, p) => s + p.loc, 0) || 1;
  const coreTop = Math.max(0, coreRows.findIndex((a) => a > 0));
  const coreEnd = coreRows.length - [...coreRows].reverse().findIndex((a) => a > 0);
  const areaAt = (u) => (u >= R ? ringTotal : cum[Math.floor(u)] + (u - Math.floor(u)) * ringAreas[Math.floor(u)]);
  const placeOf = (t) => {
    if (t >= ringTotal) return R;
    let i = 0;
    while (cum[i + 1] <= t) i++;
    return i + (t - cum[i]) / (ringAreas[i] || 1);
  };
  const base = areaAt(start);
  let [u, row, rowArea, before] = [start, coreTop, 0, 0];
  return parts.map((p, k) => {
    before += p.loc;
    const target = base + (before / loc) * (total - base);
    const from = u;
    const last = k === parts.length - 1;
    if (last) u = R;
    else {
      u = Math.min(R, Math.max(placeOf(target), from + least(k, from)));
      // A boundary a hair from a whole ring takes the whole ring: no sliver of a ring is worth a step.
      if (Math.abs(u - Math.round(u)) < 0.04) u = Math.round(u);
    }
    let core = null;
    let coreArea = 0;
    if (coreTotal && u === R && (last || target > ringTotal + rowArea)) {
      const start = row;
      if (last) row = coreEnd;
      else while (row < coreEnd && ringTotal + rowArea + coreRows[row] / 2 < target) rowArea += coreRows[row++];
      if (last) for (let y = start; y < row; y++) rowArea += coreRows[y];
      if (row > start) {
        core = [start, row];
        for (let y = start; y < row; y++) coreArea += coreRows[y];
      }
    }
    return { from, to: u, core, area: areaAt(u) - areaAt(from) + coreArea };
  });
}

const glyphRadius = RINGS.size * RING_HALF;

/** A grid of placed glyph centres, to keep names from landing on each other. */
function glyphGrid() {
  const cell = 8;
  const cells = new Map();
  const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  return {
    clear(glyphs) {
      const min = (2 * glyphRadius) ** 2;
      for (const [x, y] of glyphs) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (const [px, py] of cells.get(key(x + dx * cell, y + dy * cell)) ?? []) if ((px - x) ** 2 + (py - y) ** 2 < min) return false;
          }
        }
      }
      return true;
    },
    add(glyphs) {
      for (const g of glyphs) (cells.get(key(g[0], g[1])) ?? cells.set(key(g[0], g[1]), []).get(key(g[0], g[1]))).push(g);
    },
  };
}

/**
 * One copy of a name set along a walk: its letters' centres from arc length s at `step` px each, read left to
 * right whichever way the ring runs. Null where it bends too sharply to set.
 */
function setName(walk, text, s, step) {
  const centres = [...text].map((_, c) => s + (c + 0.5) * step);
  const heads = centres.map((c) => walk.headingAt(c));
  for (let i = 1; i < heads.length; i++) {
    const turn = Math.abs(((heads[i] - heads[i - 1] + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    if (turn > (RINGS.bend * Math.PI) / 180) return null;
  }
  const mean = Math.atan2(heads.reduce((a, h) => a + Math.sin(h), 0), heads.reduce((a, h) => a + Math.cos(h), 0));
  const flip = Math.cos(mean) < 0;
  const order = flip ? centres.map((_, i) => centres.length - 1 - i) : centres.map((_, i) => i);
  const lean = ((((mean + (flip ? Math.PI : 0)) * 180) / Math.PI + 540) % 360) - 180;
  return { centres: order.map((i) => walk.pointAt(centres[i])), heads: order.map((i) => heads[i] + (flip ? Math.PI : 0)), lean };
}

/** A name's letters as SVG positions: each glyph's origin on its baseline and its rotation in degrees. */
function glyphOrigins(centres, heads, size) {
  const adv = ADVANCE * size;
  return centres.map(([x, y], i) => {
    const [c, s] = [Math.cos(heads[i]), Math.sin(heads[i])];
    return [x - (c * adv) / 2 - s * RING_BASE * size, y - (s * adv) / 2 + c * RING_BASE * size, (heads[i] * 180) / Math.PI];
  });
}

/** The box around a name's glyph cells, as the page measures it. */
function glyphBox(origins, size) {
  const adv = ADVANCE * size;
  const [up, down] = [0.8 * size, 0.2 * size];
  let [l, t, r, b] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y, deg] of origins) {
    const [c, s] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
    for (const [u, v] of [[0, -up], [adv, -up], [adv, down], [0, down]]) {
      const [px, py] = [x + u * c - v * s, y + u * s + v * c];
      [l, t, r, b] = [Math.min(l, px), Math.min(t, py), Math.max(r, px), Math.max(b, py)];
    }
  }
  return { x: l, y: t, width: r - l, height: b - t };
}

/** Is the point within `reach` px of the skeleton, where a ring folds back on itself? */
function onCrease(field, [x, y], reach = RINGS.size * 0.35) {
  for (const [dx, dy] of [[0, 0], [reach, 0], [-reach, 0], [0, reach], [0, -reach]]) {
    const [px, py] = [Math.round(x + dx), Math.round(y + dy)];
    if (px < 0 || py < 0 || px >= field.W || py >= field.H || field.slope[py * field.W + px] < RINGS.slope) return true;
  }
  return false;
}

/** The box of the mask, widened by `pad` px and kept on the sheet: [x0, y0, x1, y1]. */
const ringsBox = (mask, pad) => [
  Math.max(0, Math.floor(mask.box.left - pad)), Math.max(0, Math.floor(mask.box.top - pad)),
  Math.min(SHEET.width, Math.ceil(mask.box.right + pad)), Math.min(SHEET.height, Math.ceil(mask.box.bottom + pad)),
];

/** A traced line as a walk that knows which side is deeper in the shape; a closed one starts at its seam. */
function ringWalk(field, line) {
  let { pts } = line;
  if (line.closed) {
    // The seam, where a part that ends part way round steps in a ring: the bottom of the loop, near its middle.
    const cx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const score = (p) => p[1] - 0.05 * Math.abs(p[0] - cx);
    const low = pts.reduce((best, p, i) => (score(p) > score(pts[best]) ? i : best), 0);
    pts = [...pts.slice(low), ...pts.slice(0, low)];
  }
  const walk = walkOf({ pts, closed: line.closed });
  let lean = 0;
  for (let k = 0; k < 16; k++) {
    const s = (walk.length * (k + 0.5)) / 16;
    const [x, y] = walk.pointAt(s);
    const h = walk.headingAt(s);
    const [nx, ny] = [-Math.sin(h), Math.cos(h)];
    lean += field.at(Math.round(x + 2 * nx), Math.round(y + 2 * ny)) - field.at(Math.round(x - 2 * nx), Math.round(y - 2 * ny));
  }
  const side = lean >= 0 ? 1 : -1;
  /** The point `delta` px deeper than the walk at arc length s. */
  const deeper = (s, delta) => {
    const [x, y] = walk.pointAt(s);
    const h = walk.headingAt(s);
    return [x - side * delta * Math.sin(h), y + side * delta * Math.cos(h)];
  };
  /** The walk from a to b, moved `delta` px deeper, as points about 1.5 px apart. */
  const offset = (a, b, delta) => {
    const n = Math.max(1, Math.ceil((b - a) / 1.5));
    return Array.from({ length: n + 1 }, (_, j) => deeper(a + ((b - a) * j) / n, delta));
  };
  return { ...walk, pts, offset };
}

/**
 * The rings style: per part a run of rings of its plain name from the outline in, then the core in level lines,
 * the accent part on a solid accent band with its names reversed out, a hairline between parts, and `echo`
 * faded outlines outside the shape.
 * @param {import("../mask.mjs").Mask} mask
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts  in tree order
 * @param {{ theme?: "light" | "dark", blocks?: { left: number, top: number, right: number, bottom: number }[], region?: { echo?: number } }} frame
 */
export function ringsStyle(mask, parts, { theme = "light", blocks = [], region = {} } = {}) {
  // Sketch and check lay the same region out several times over; the last layout is kept for the same inputs.
  const key = JSON.stringify([mask.runs, parts.map((p) => [p.id, p.name, p.loc, p.hot]), theme, blocks, region.echo]);
  if (ringsMemo?.key !== key) ringsMemo = { key, value: ringsLayout(mask, parts, theme, blocks, region.echo ?? 0) };
  return ringsMemo.value;
}
let ringsMemo = null;

function ringsLayout(mask, parts, theme, blocks, echo) {
  const { gap, size } = RINGS;
  const tones = RING_TONES[theme];
  const adv = ADVANCE * size;
  const field = ringField(mask);
  const box = ringsBox(mask, gap * RINGS.echoGap * (echo + 1) + 2);
  const traced = new Map();
  const walksAt = (level) => {
    if (!traced.has(level)) {
      const lines = isoLoops(field, level, box).map((raw) => smoothLoop(raw, Math.min(Math.abs(level), RINGS.round))).filter((q) => q.pts.length > 4);
      traced.set(level, lines.map((line) => ringWalk(field, line)).sort((a, b) => b.length - a.length));
    }
    return traced.get(level);
  };

  // Every ring that fits. Where a ring's loop runs more than `fold` of its length over the skeleton it would pile
  // up, so it stops there, with every ring inside it: what that loop encloses is a core, set in level lines.
  const levels = [];
  for (let d = gap / 2; d < field.deepest - 1; d += gap) levels.push(d);
  const R = levels.length;
  const { W } = field;
  // The level each core pixel's core starts at, or -1 outside every core.
  const coreFrom = new Float32Array(W * field.H).fill(-1);
  const inCore = (walk) => {
    const [x, y] = walk.pointAt(walk.length / 2).map(Math.round);
    return coreFrom[y * W + x] >= 0;
  };
  const cores = [];
  const ringWalksAt = [];
  const deeper = Array(R + 1).fill(0);
  for (let c = 0; c < field.sd.length; c++) if (field.sd[c] > 0) deeper[Math.min(R, Math.floor(field.sd[c] / gap))]++;
  for (let i = R - 1; i >= 0; i--) deeper[i] += deeper[i + 1];
  for (let i = 0; i < R; i++) {
    const kept = [];
    // The innermost `core` of the shape's area is a core wherever it lies, folded or not.
    const inmost = deeper[i] <= RINGS.core * deeper[0];
    for (const walk of walksAt(levels[i])) {
      if (inCore(walk)) continue;
      let [all, folded] = [0, 0];
      for (let s = 0; s < walk.length; s += 3) {
        all++;
        if (onCrease(field, walk.pointAt(s), gap * 0.6)) folded++;
      }
      if (!inmost && folded / (all || 1) <= RINGS.fold) {
        kept.push(walk);
        continue;
      }
      // Only what the loop itself encloses: a loop round a hole bounds the shape on its outer side, not a core.
      const from = i * gap;
      const limit = walk.closed ? Math.abs(loopArea(walk.pts)) * 1.05 + walk.length * (gap / 2 + 1) + 50 : 0;
      const [sx, sy] = walk.offset(0, 0, 1.5)[0].map(Math.round);
      const queue = [sy * W + sx];
      coreFrom[queue[0]] = from;
      for (let q = 0; q < queue.length && queue.length <= limit; q++) {
        const c = queue[q];
        for (const n of [c - 1, c + 1, c - W, c + W]) {
          if (n >= 0 && n < coreFrom.length && coreFrom[n] < 0 && field.sd[n] >= from) {
            coreFrom[n] = from;
            queue.push(n);
          }
        }
      }
      if (queue.length > limit) {
        for (const c of queue) coreFrom[c] = -1;
        kept.push(walk);
        continue;
      }
      cores.push({ from, size: queue.length });
    }
    ringWalksAt.push(kept);
  }
  const ringAreas = Array(R).fill(0);
  const coreRows = Array(field.H).fill(0);
  for (let y = box[1]; y < box[3]; y++) {
    for (let x = box[0]; x < box[2]; x++) {
      const d = field.sd[y * W + x];
      if (d <= 0) continue;
      if (coreFrom[y * W + x] >= 0) coreRows[y]++;
      // Past the deepest ring, the last sliver belongs to it.
      else ringAreas[Math.min(R - 1, Math.floor(d / gap))]++;
    }
  }
  /** The core's pixels on rows y0 to y1 at least `inset` px inside it, as [y, spans]. */
  const coreSpans = (y0, y1, inset = 0) => {
    const out = [];
    for (let y = Math.max(0, y0); y < Math.min(field.H, y1); y++) {
      const spans = [];
      let open = null;
      for (let x = box[0]; x <= box[2]; x++) {
        const from = x < box[2] ? coreFrom[y * W + x] : -1;
        const on = from >= 0 && field.sd[y * W + x] >= from + inset;
        if (on && open === null) open = x;
        if (!on && open !== null) spans.push([open, x]), (open = null);
      }
      if (spans.length) out.push([y, spans]);
    }
    return out;
  };
  const ringLength = ringWalksAt.map((ws) => ws.reduce((s, w) => s + w.length, 0));
  const nameArc = (p) => (p.name.length + RING_SEP.length) * adv;
  // Room for two copies of the name on the ring the part starts on; the accent at least `RINGS.accent` rings.
  const least = (k, u) => Math.max(parts[k].hot ? RINGS.accent : 0, Math.floor(u) < R ? (2 * nameArc(parts[k])) / (ringLength[Math.floor(u)] || 1) : 0);
  // The order the parts run inward. With an accent, one other part's outermost ring is a rim, then the accent's
  // band of whole rings, so the accent traces the outline as one closed band; then every other part in tree order,
  // the rim's part with what is left of its share. Ring order encodes nothing, so the rim is the part whose
  // share is nearest one outer ring's area. The rim and the accent are whole rings and miss their shares a little;
  // the parts inside share what is left in proportion to their lines, so the difference spreads thin.
  const allLines = parts.reduce((t, p) => t + p.loc, 0) || 1;
  const shapeArea = ringAreas.reduce((t, a) => t + a, 0) + coreRows.reduce((t, a) => t + a, 0);
  const hot = parts.findIndex((p) => p.hot);
  const outer = (ringAreas[0] ?? 0) / (shapeArea || 1);
  const rim = parts.reduce((best, p, k) => (p.hot || (best >= 0 && Math.abs(parts[best].loc / allLines - outer) <= Math.abs(p.loc / allLines - outer)) ? best : k), -1);
  let runs;
  let accentFloor = false;
  if (hot < 0 || rim < 0 || R < 2 + RINGS.accent) runs = allotRings(parts, ringAreas, coreRows, least).map((r, k) => ({ ...r, k }));
  else {
    const cum = [0];
    for (const a of ringAreas) cum.push(cum[cum.length - 1] + a);
    const want = cum[1] + (parts[hot].loc / allLines) * shapeArea;
    let end = 1;
    for (let e = 2; e <= R; e++) if (Math.abs(cum[e] - want) < Math.abs(cum[end] - want)) end = e;
    accentFloor = end < 1 + RINGS.accent;
    end = Math.min(R, Math.max(end, 1 + RINGS.accent));
    const rimLines = outer * allLines;
    // A rim whose ring holds its whole share has nothing left to run inside.
    const rest = parts.map((p, k) => ({ k, loc: k === rim ? p.loc - rimLines : p.loc })).filter(({ k, loc }) => k !== hot && loc > 0);
    const restParts = rest.map(({ loc }) => ({ loc }));
    const leastRest = (j, u) => least(rest[j].k, u);
    runs = [
      { k: rim, from: 0, to: 1, core: null, area: ringAreas[0] },
      { k: hot, from: 1, to: end, core: null, area: cum[end] - cum[1] },
      ...allotRings(restParts, ringAreas, coreRows, leastRest, end).map((r, j) => ({ ...r, k: rest[j].k })),
    ].filter((r) => r.to > r.from || r.core);
  }
  const total = mask.area || 1;
  const bands = parts.map((part, k) => {
    const mine = runs.filter((r) => r.k === k);
    const area = mine.reduce((t, r) => t + r.area, 0);
    return { part, runs: mine, core: mine.find((r) => r.core)?.core ?? null, area, rings: 0, share: area / total, lines: 0, size, names: 0, upright: 0 };
  });

  /** The arcs of ring i between ring coordinates u0 and u1, loop by loop: [walk, from, to]. */
  const arcs = (i, u0, u1) => {
    const [a, b] = [Math.max(0, u0 - i) * ringLength[i], Math.min(1, u1 - i) * ringLength[i]];
    const out = [];
    let at = 0;
    for (const walk of ringWalksAt[i]) {
      const [lo, hi] = [Math.max(a, at), Math.min(b, at + walk.length)];
      if (hi - lo > 0.5) out.push([walk, lo - at, hi - at]);
      at += walk.length;
    }
    return out;
  };

  /** The ring a pixel inside the shape belongs to, or -1 in a core. */
  const ringOf = (c) => (coreFrom[c] >= 0 ? -1 : Math.min(R - 1, Math.floor(field.sd[c] / gap)));
  /** For ring i: how far round the ring, from its seam, the ring point nearest (x, y) lies. */
  const arcOf = (i) => {
    const cell = 8;
    const near = new Map();
    let at = 0;
    for (const walk of ringWalksAt[i]) {
      for (let s = 0; s < walk.length; s += 1.5) {
        const [x, y] = walk.pointAt(s);
        const k = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
        (near.get(k) ?? near.set(k, []).get(k)).push([x, y, at + s]);
      }
      at += walk.length;
    }
    return (x, y) => {
      let [best, arc] = [Infinity, 0];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const [px, py, s] of near.get(`${Math.floor(x / cell) + dx},${Math.floor(y / cell) + dy}`) ?? []) {
            const dd = (px - x - 0.5) ** 2 + (py - y - 0.5) ** 2;
            if (dd < best) [best, arc] = [dd, s];
          }
        }
      }
      return arc;
    };
  };
  /** The pixels of ring i between ring coordinates u0 and u1, as [y, spans]: a part's strip of a ring it holds part way round. */
  const arcRows = (i, u0, u1) => {
    const [a, b] = [Math.max(0, u0 - i) * ringLength[i], Math.min(1, u1 - i) * ringLength[i]];
    const arc = arcOf(i);
    const out = [];
    for (let y = box[1]; y < box[3]; y++) {
      const spans = [];
      for (let x = box[0]; x < box[2]; x++) {
        if (field.sd[y * W + x] <= 0 || ringOf(y * W + x) !== i) continue;
        const s = arc(x, y);
        if (s < a || s >= b) continue;
        const last = spans[spans.length - 1];
        if (last && last[1] === x) last[1] = x + 1;
        else spans.push([x, x + 1]);
      }
      if (spans.length) out.push([y, spans]);
    }
    return out;
  };
  /** Each pixel's part index as drawn, by its ring and how far round, or its core row; -1 outside the shape. */
  const owners = () => {
    const own = new Int16Array(W * field.H).fill(-1);
    const arcs = new Map();
    const rings = runs.filter((r) => r.to > r.from);
    const partAt = (u) => (rings.find((r, j) => u < r.to || j === rings.length - 1) ?? runs[0]).k;
    for (let y = box[1]; y < box[3]; y++) {
      for (let x = box[0]; x < box[2]; x++) {
        const c = y * W + x;
        if (field.sd[c] <= 0) continue;
        const i = ringOf(c);
        if (i < 0) own[c] = runs.find((r) => r.core && y >= r.core[0] && y < r.core[1])?.k ?? -1;
        else {
          if (!arcs.has(i)) arcs.set(i, ringLength[i] ? arcOf(i) : () => 0);
          own[c] = partAt(i + arcs.get(i)(x, y) / (ringLength[i] || 1));
        }
      }
    }
    return own;
  };

  const rows = [];
  const grid = glyphGrid();
  const place = (b, centres, heads, text, lean) => {
    const glyphs = glyphOrigins(centres, heads, size);
    rows.push({ ...glyphBox(glyphs, size), size, text, glyphs, weight: b.part.hot ? 700 : 400, part: b.part.id, word: b.part.name, hot: b.part.hot, tone: b.part.hot ? "on-hot" : tones.type, lean });
    grid.add(centres);
    b.names++;
    if (Math.abs(lean) <= RINGS.upright) b.upright++;
  };

  // The rings, outline first, so an outer name wins where two would meet.
  for (let i = 0; i < R; i++) {
    for (const run of runs) {
      if (run.to <= i || run.from >= i + 1 || !ringLength[i]) continue;
      const b = bands[run.k];
      b.lines++;
      const name = b.part.name.toLowerCase();
      for (const [walk, a, z] of arcs(i, run.from, run.to)) {
        const whole = walk.closed && a < 0.5 && z > walk.length - 0.5;
        const unit = nameArc(b.part);
        let n = Math.floor((z - a) / unit);
        if (!n && z - a >= (name.length + 1) * adv) n = 1;
        if (!n) continue;
        // Letters keep their advance and the separators take up the slack, so a whole ring closes with no seam.
        const span = (z - a) / n;
        const gapLen = span - name.length * adv;
        const start = a + (whole ? ((i % 2) * span) / 2 : gapLen / 2);
        let kept = false;
        for (let j = 0; j < n; j++) {
          const s = start + j * span;
          const set = setName(walk, name, s, adv);
          if (!set || set.centres.some((c) => onCrease(field, c)) || !grid.clear(set.centres)) {
            kept = false;
            continue;
          }
          const dot = walk.pointAt(s - gapLen / 2);
          const sep = kept && grid.clear([dot]) ? [dot] : [];
          place(b, [...set.centres, ...sep], [...set.heads, ...sep.map(() => set.heads[set.heads.length - 1])], `${name}${sep.length ? "·" : ""}`, set.lean);
          kept = true;
        }
      }
    }
  }

  // The core in level lines, a run of lines per part, each line the whole names its span holds, centred.
  const lines = [];
  for (const run of runs) {
    if (!run.core) continue;
    const b = bands[run.k];
    const name = b.part.name.toLowerCase();
    const [y0, y1] = run.core;
    for (let yc = y0 + (((y1 - y0) % gap) + gap) / 2; yc + gap / 2 <= y1 + 0.01; yc += gap) {
      let spans = null;
      for (const [, here] of coreSpans(Math.floor(yc - glyphRadius), Math.ceil(yc + glyphRadius) + 1, glyphRadius)) {
        spans = spans === null ? here : spans.flatMap(([l, r]) => here.filter(([p, q]) => q > l && p < r).map(([p, q]) => [Math.max(p, l), Math.min(q, r)]));
      }
      spans ??= [];
      if (!spans.length) continue;
      b.lines++;
      lines.push(yc);
      for (const [l, r] of spans) {
        const unit = nameArc(b.part);
        const n = Math.floor((r - l + RING_SEP.length * adv) / unit);
        let x = l + (r - l - (n * unit - RING_SEP.length * adv)) / 2;
        for (let j = 0; j < n; j++, x += unit) {
          const last = j === n - 1;
          const centres = [...name].map((_, c) => [x + (c + 0.5) * adv, yc]);
          if (!last) centres.push([x + (name.length + 1.5) * adv, yc]);
          if (grid.clear(centres)) place(b, centres, centres.map(() => 0), `${name}${last ? "" : "·"}`, 0);
        }
      }
    }
  }

  // Fills: the whole shape in the light theme, then the accent's arcs of rings and its core rows.
  const ground = [];
  if (tones.base) ground.push({ part: null, hot: false, tone: tones.base, rows: mask.runs.map((s, y) => [y, s]).filter(([, s]) => s.length) });
  if (cores.length) ground.push({ part: null, hot: false, tone: tones.core, rows: coreSpans(box[1], box[3]) });
  for (const b of runs.filter((r) => parts[r.k].hot).map((r) => ({ ...r, part: parts[r.k] }))) {
    if (b.to > b.from) {
      // Whole rings fill between their levels; a ring the part holds only part way round fills along its arc.
      const [whole0, whole1] = [Math.ceil(b.from), b.to >= R ? R : Math.floor(b.to)];
      const rows = whole1 > whole0 ? levelRows(field, whole0 * gap, whole1 >= R ? Infinity : whole1 * gap, box[1], box[3], (c) => coreFrom[c] >= 0) : [];
      for (const i of new Set([Math.floor(b.from), Math.min(R - 1, Math.floor(b.to))])) if (i < whole0 || i >= whole1) rows.push(...arcRows(i, b.from, b.to));
      ground.push({ part: b.part.id, hot: true, tone: "hot", rows: rows.sort((p, q) => p[0] - q[0]).reduce((out, [y, spans]) => {
        if (out.length && out[out.length - 1][0] === y) out[out.length - 1][1].push(...spans);
        else out.push([y, [...spans]]);
        return out;
      }, []) });
    }
    if (b.core) ground.push({ part: b.part.id, hot: true, tone: "hot", rows: coreSpans(...b.core) });
  }

  // Hairlines between parts: the edge of the ring a part starts on, stepping in a ring where it starts part way round.
  const edges = [];
  const hair = (pts, closed) => edges.push(ribbon(pts, RINGS.hairline, closed));
  runs.forEach((b, k) => {
    if (!k) return;
    if (b.from < R) {
      const i = Math.floor(b.from);
      const cut = (b.from - i) * ringLength[i];
      let at = 0;
      for (const walk of ringWalksAt[i]) {
        const [lo, hi] = [Math.min(walk.length, Math.max(0, cut - at)), walk.length];
        if (lo === 0) hair(walk.offset(0, walk.length, -gap / 2), walk.closed);
        else if (lo >= hi) hair(walk.offset(0, walk.length, gap / 2), walk.closed);
        else {
          hair(walk.offset(0, lo, gap / 2), false);
          hair(walk.offset(lo, hi, -gap / 2), false);
          hair([walk.offset(lo, lo, -gap / 2)[0], walk.offset(lo, lo, gap / 2)[0]], false);
        }
        at += walk.length;
      }
    } else if (b.core && runs[k - 1].core) {
      for (const [y, spans] of coreSpans(b.core[0], b.core[0] + 1)) for (const [l, r] of spans) edges.push(`M${l} ${y}H${r}V${y + 2 * RINGS.hairline}H${l}Z`);
    }
  });
  // Each core's edge: the lines at its level whose deeper side is that core.
  for (const from of new Set(cores.map((c) => c.from))) {
    for (const walk of walksAt(from)) {
      const [x, y] = walk.offset(walk.length / 2, walk.length / 2, 1.5)[0].map(Math.round);
      if (coreFrom[y * W + x] === from) hair(walk.offset(0, walk.length, 0), walk.closed);
    }
  }
  if (edges.length) ground.push({ part: null, hot: false, tone: tones.line, rows: [], path: edges.join("") });

  // Echoes, faded outward, broken where they would pass within `clear` px of a text block.
  const near = ([x, y]) => blocks.some((t) => x > t.left - RINGS.clear && x < t.right + RINGS.clear && y > t.top - RINGS.clear && y < t.bottom + RINGS.clear);
  for (let e = 0; e < echo; e++) {
    const paths = [];
    for (const walk of walksAt(-gap * RINGS.echoGap * (e + 1))) {
      const pts = walk.offset(0, walk.length, 0);
      const runs = [[]];
      for (const p of pts) {
        if (near(p)) runs.push([]);
        else runs[runs.length - 1].push(p);
      }
      for (const run of runs) if (run.length > 3) paths.push(ribbon(run, RINGS.hairline * 0.9, runs.length === 1 && walk.closed));
    }
    if (paths.length) ground.unshift({ part: null, hot: false, tone: "soft", rows: [], path: paths.join(""), alpha: Math.round(tones.echo * (1 - e / echo) * 100) / 100 });
  }

  // What the sketch and the checks say: rings per part against its share, and what to change when it fails.
  const P = parts.length;
  // A ring and a half per part: fewer, and the outer parts take whole rings while the inner ones are crushed into the core.
  const need = Math.ceil(RINGS.perPart * P);
  const pct = (n) => `${Math.round(n * 1000) / 10}%`;
  const loc = parts.reduce((t, p) => t + p.loc, 0) || 1;
  const across = Math.round(2 * field.deepest);
  for (const b of bands) {
    b.rings = ringLength.filter((len, i) => len > 0 && b.runs.some((r) => i < r.to && i + 1 > r.from)).length;
    b.missing = b.rings || b.core
      ? `its ${b.rings} rings${b.core ? " and its core lines" : ""} hold no whole copy of "${b.part.name.toLowerCase()}" (${Math.ceil(nameArc(b.part))}px with its dot), where they run short or fold; make the shape fatter there or give the part a shorter name`
      : `the shape ran out of rings before it (${R} rings of ${gap}px fit); draw it fatter or use style bands`;
  }
  const findings = {
    "shape-rings": R < need ? [`the shape is ${across}px across at its thickest, room for ${R} rings of ${gap}px; its ${P} parts need about ${need}, so draw it fatter (about ${2 * need * gap}px across at its thickest), raise fit.h, or use style bands`] : [],
    "shape-upright": bands.filter((b) => b.names && !b.upright).map((b) => `part "${b.part.name}" never reads upright: none of its ${b.names} names leans under ${RINGS.upright} degrees; turn the shape (shape.rotate) so more of its outline runs level, or draw it rounder`),
  };
  const summary = [
    `rings: ${R} rings of ${gap}px fit (the shape is ${across}px across at its thickest; ${P} parts want about ${need})${cores.length ? `, then ${cores.length === 1 ? "a core" : `${cores.length} cores`} of ${lines.length} level lines` : ""}`,
    "parts, outline in (* the accent): rings, core lines, share of the shape's area for share of the lines",
    ...(accentFloor ? [`the accent's share fills under ${RINGS.accent} rings, too thin to show at thumbnail size, so it takes ${RINGS.accent} (${RINGS.accent * RINGS.gap}px) and more area than its share`] : []),
    ...bands.map((b) => `  ${b.part.hot ? "*" : " "} ${b.part.name.toLowerCase().padEnd(24)} ${String(b.rings).padStart(2)} ${b.rings === 1 ? "ring" : "rings"}${b.core ? `, ${b.lines - b.rings} core lines` : ""}, ${pct(b.share)} of the area for ${pct(b.part.loc / loc)} of the lines`),
  ];
  return { bands, rows, ground, findings, summary, owners, rings: { levels: R, deepest: field.deepest, cores, lines } };
}

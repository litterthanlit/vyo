// The rings style of the shape field: the parts' names set along inward offsets of the silhouette's outline, a
// run of rings per part in tree order from the outline in, as much area as its lines. Where the rings would fold
// over the shape's skeleton they stop, and the core left inside is set in level lines. Everything is read from
// the mask's signed distance field. Pure, like shape.mjs: render inlines it, `vyo sketch` and the checks import it.
import { SHEET, ADVANCE } from "../geometry.mjs";
import { edt } from "../mask.mjs";

// Rings sit `gap` px apart, set in `size` px type. A ring is rounded over up to `round` px. A ring whose loops run
// more than `fold` of their length over the skeleton (where the field's slope drops under `slope`) is the first
// that would pile up, so the core starts there. The accent gets at least `accent` rings, every other part one.
// A name reads upright when it leans at most `upright` degrees; it is dropped where it turns more than `bend`
// degrees between two letters. Echoes sit `echoGap` rings apart outside the outline, kept `clear` px off text.
export const RINGS = { gap: 7, size: 6.6, round: 14, fold: 0.2, slope: 0.55, accent: 2, upright: 30, bend: 24, hairline: 0.32, echoGap: 1.4, clear: 16, maxEcho: 12 };
const RING_SEP = " · ";
// Per theme: the fill under the whole shape, the type on it, the hairlines, and how strong the echoes are. On
// paper, ink type on paper read as a grey outline at thumbnail size, so the light shape is solid ink with type
// reversed out, like the dark theme's sheet.
export const RING_TONES = {
  light: { base: "ink", type: "paper", line: "paper", echo: 0.7 },
  dark: { base: null, type: "ink", line: "ink", echo: 1 },
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
function levelRows(field, level, upper, yFrom = 0, yTo = field.H) {
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
      const on = here >= level && here < upper;
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
 * How the parts share the shape: each part a run of rings from the outline in, in tree order, then the core's
 * rows top to bottom, each covering about its share of the shape's area. A ring is indivisible, so a boundary
 * between two parts falls on the ring edge nearest its share; the core is cut by pixel rows. Every part gets at
 * least one ring and the accent `RINGS.accent`, while rings last.
 * @param {number[]} ringAreas  px² of each ring's strip, outline first
 * @param {number[]} coreRows   px² of the core on each sheet row
 * @returns {{ rings: [number, number], core: [number, number] | null }[]}  per part: ring indices [from, to), core rows [from, to)
 */
export function allotRings(parts, ringAreas, coreRows) {
  const R = ringAreas.length;
  const coreTotal = coreRows.reduce((s, a) => s + a, 0);
  const total = ringAreas.reduce((s, a) => s + a, 0) + coreTotal;
  const loc = parts.reduce((s, p) => s + p.loc, 0) || 1;
  const cumRing = [0];
  for (const a of ringAreas) cumRing.push(cumRing[cumRing.length - 1] + a);
  const coreTop = coreRows.findIndex((a) => a > 0);
  const coreEnd = coreRows.length - [...coreRows].reverse().findIndex((a) => a > 0);
  const want = (p) => (p.hot ? RINGS.accent : 1);
  let [ring, row, acc, rowAcc, before] = [0, coreTop, 0, 0, 0];
  return parts.map((p, k) => {
    before += p.loc;
    const target = (before / loc) * total;
    const last = k === parts.length - 1;
    const from = ring;
    if (last) ring = R;
    else {
      // The ring edge nearest the target, past this part's minimum, leaving the parts after it theirs.
      const leave = parts.slice(k + 1).reduce((s, q) => s + want(q), 0);
      const lo = Math.min(R, from + want(p));
      const hi = Math.max(lo, R - (coreTotal ? 0 : leave));
      let best = lo;
      for (let j = lo; j <= hi; j++) if (Math.abs(cumRing[j] - target) < Math.abs(cumRing[best] - target)) best = j;
      ring = best;
    }
    acc = cumRing[ring];
    let core = null;
    if (coreTotal && (ring === R || last) && (last || target > acc)) {
      const start = row;
      if (last) row = coreEnd;
      else {
        const need = target - acc - rowAcc;
        let got = 0;
        while (row < coreEnd && got + coreRows[row] / 2 < need) got += coreRows[row++];
        rowAcc += got;
      }
      if (row > start) core = [start, row];
    }
    return { rings: [from, ring], core };
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

/** Is any letter centre within reach of the skeleton, where the ring folds back on itself? */
function onCrease(field, [x, y]) {
  const reach = RINGS.size * 0.35;
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
  const field = ringField(mask);
  const box = ringsBox(mask, gap * RINGS.echoGap * (echo + 1) + 2);
  const traced = new Map();
  const loopsAt = (level) => {
    if (!traced.has(level)) traced.set(level, isoLoops(field, level, box).map((raw) => smoothLoop(raw, Math.min(Math.abs(level), RINGS.round))).filter((q) => q.pts.length > 4));
    return traced.get(level);
  };

  // Every ring that fits, and how much of each runs over the skeleton; the core starts at the first that folds.
  const levels = [];
  for (let d = gap / 2; d < field.deepest - 1; d += gap) levels.push(d);
  let R = levels.length;
  for (let i = 0; i < levels.length; i++) {
    let [all, folded] = [0, 0];
    for (const loop of loopsAt(levels[i])) {
      for (let j = 0; j < loop.pts.length; j += 2) {
        all++;
        if (onCrease(field, loop.pts[j])) folded++;
      }
    }
    if (all && folded / all > RINGS.fold) {
      R = i;
      break;
    }
  }
  const coreLevel = R * gap;
  const ringAreas = Array(R).fill(0);
  const coreRows = Array(field.H).fill(0);
  for (let y = 0; y < field.H; y++) {
    for (let x = box[0]; x < box[2]; x++) {
      const d = field.sd[y * field.W + x];
      if (d <= 0) continue;
      // With no core, the last sliver past the deepest ring belongs to it.
      const i = R === levels.length ? Math.min(R - 1, Math.floor(d / gap)) : Math.floor(d / gap);
      if (i < R) ringAreas[i]++;
      else coreRows[y]++;
    }
  }
  const allot = allotRings(parts, ringAreas, coreRows);
  const bands = parts.map((part, k) => {
    const { rings, core } = allot[k];
    const area = ringAreas.slice(...rings).reduce((s, a) => s + a, 0) + (core ? coreRows.slice(...core).reduce((s, a) => s + a, 0) : 0);
    return { part, rings: rings[1] - rings[0], from: rings[0] * gap, to: rings[1] * gap, core, lines: 0, size, area, names: 0, upright: 0 };
  });
  const total = mask.area || 1;
  for (const b of bands) b.share = b.area / total;

  const rows = [];
  const grid = glyphGrid();
  const typeTone = (p) => (p.hot ? "on-hot" : tones.type);
  const adv = ADVANCE * size;
  const place = (b, centres, heads, text, lean) => {
    const glyphs = glyphOrigins(centres, heads, size);
    rows.push({ ...glyphBox(glyphs, size), size, text, glyphs, weight: b.part.hot ? 700 : 400, part: b.part.id, word: b.part.name, hot: b.part.hot, tone: typeTone(b.part), lean });
    grid.add(centres);
    b.names++;
    if (Math.abs(lean) <= RINGS.upright) b.upright++;
  };

  // The rings, outline first, so an outer name wins where two would meet.
  bands.forEach((b, k) => {
    const name = b.part.name.toLowerCase();
    for (let i = allot[k].rings[0]; i < allot[k].rings[1]; i++) {
      b.lines++;
      for (const loop of loopsAt(levels[i])) {
        const walk = walkOf(loop);
        const unit = (name.length + RING_SEP.length) * adv;
        const n = Math.floor(walk.length / unit);
        if (!n) continue;
        // Letters keep their advance and the separators take up the slack, so every ring closes with no seam.
        const span = walk.length / n;
        const start = walk.closed ? ((i % 2) * span) / 2 : (span - name.length * adv) / 2;
        let kept = null;
        for (let j = 0; j < n; j++) {
          const s = start + j * span;
          const set = setName(walk, name, s, adv);
          if (!set || set.centres.some((c) => onCrease(field, c)) || !grid.clear(set.centres)) {
            kept = null;
            continue;
          }
          const dot = walk.pointAt(s - (span - name.length * adv) / 2);
          const sep = kept && grid.clear([dot]) ? [dot] : [];
          place(b, [...set.centres, ...sep], [...set.heads, ...sep.map(() => set.heads[set.heads.length - 1])], `${name}${sep.length ? "·" : ""}`, set.lean);
          kept = true;
        }
      }
    }
  });

  // The core in level lines, a run of lines per part, each line the whole names its span holds, centred.
  const ground = [];
  const lines = [];
  const coreLoops = R < levels.length ? loopsAt(coreLevel) : [];
  bands.forEach((b) => {
    if (!b.core) return;
    const name = b.part.name.toLowerCase();
    const [y0, y1] = b.core;
    for (let top = y0 + (((y1 - y0) % gap) + gap) / 2 - gap / 2; top + gap <= y1 + 0.01; top += gap) {
      const yc = top + gap / 2;
      const [ya, yb] = [Math.floor(yc - glyphRadius), Math.ceil(yc + glyphRadius)];
      let spans = null;
      for (let y = ya; y <= yb; y++) {
        const here = [];
        let open = null;
        for (let x = box[0]; x <= box[2]; x++) {
          const on = x < box[2] && field.sd[y * field.W + x] >= coreLevel + glyphRadius;
          if (on && open === null) open = x;
          if (!on && open !== null) here.push([open, x]), (open = null);
        }
        spans = spans === null ? here : spans.flatMap(([l, r]) => here.filter(([a, c]) => c > l && a < r).map(([a, c]) => [Math.max(a, l), Math.min(c, r)]));
      }
      b.lines++;
      lines.push(yc);
      for (const [l, r] of spans ?? []) {
        const unit = (name.length + RING_SEP.length) * adv;
        const n = Math.floor((r - l + RING_SEP.length * adv) / unit);
        if (!n) continue;
        let x = l + (r - l - (n * unit - RING_SEP.length * adv)) / 2;
        for (let j = 0; j < n; j++, x += unit) {
          const last = j === n - 1;
          const text = `${name}${last ? "" : "·"}`;
          const centres = [...name].map((_, c) => [x + (c + 0.5) * adv, yc]);
          if (!last) centres.push([x + (name.length + 1.5) * adv, yc]);
          if (!grid.clear(centres)) continue;
          place(b, centres, centres.map(() => 0), text, 0);
        }
      }
    }
  });

  // Fills: the whole shape on paper in the light theme, the accent's rings and core rows, then the hairlines.
  if (tones.base) ground.push({ part: null, hot: false, tone: tones.base, rows: mask.runs.map((s, y) => [y, s]).filter(([, s]) => s.length) });
  bands.forEach((b, k) => {
    if (!b.part.hot) return;
    const [r0, r1] = allot[k].rings;
    if (r1 > r0) ground.push({ part: b.part.id, hot: true, tone: "hot", rows: levelRows(field, r0 * gap, r1 < levels.length ? r1 * gap : Infinity, box[1], box[3]) });
    if (b.core) ground.push({ part: b.part.id, hot: true, tone: "hot", rows: levelRows(field, coreLevel, Infinity, ...b.core) });
  });
  const edges = [];
  bands.forEach((b, k) => {
    const [r0, r1] = allot[k].rings;
    if (r1 > r0 && r0 > 0) edges.push(...loopsAt(r0 * gap).map((q) => ribbon(q.pts, RINGS.hairline, q.closed)));
    else if (r1 === r0 && b.core && bands[k - 1]?.core) {
      for (const [y, spans] of levelRows(field, coreLevel, Infinity, b.core[0], b.core[0] + 1)) for (const [l, r] of spans) edges.push(`M${l} ${y}H${r}V${y + 2 * RINGS.hairline}H${l}Z`);
    }
  });
  if (coreLoops.length && bands.some((b) => b.core)) edges.push(...coreLoops.map((q) => ribbon(q.pts, RINGS.hairline, q.closed)));
  if (edges.length) ground.push({ part: null, hot: false, tone: tones.line, rows: [], path: edges.join("") });

  // Echoes, faded outward, broken where they would pass within `clear` px of a text block.
  const near = ([x, y]) => blocks.some((t) => x > t.left - RINGS.clear && x < t.right + RINGS.clear && y > t.top - RINGS.clear && y < t.bottom + RINGS.clear);
  for (let e = 0; e < echo; e++) {
    const paths = [];
    for (const loop of loopsAt(-gap * RINGS.echoGap * (e + 1))) {
      const runs = [[]];
      for (const p of loop.pts) {
        if (near(p)) runs.push([]);
        else runs[runs.length - 1].push(p);
      }
      const whole = runs.length === 1 && loop.closed;
      for (const run of runs) if (run.length > 3) paths.push(ribbon(run, RINGS.hairline * 0.9, whole));
    }
    if (paths.length) ground.unshift({ part: null, hot: false, tone: "soft", rows: [], path: paths.join(""), alpha: Math.round(tones.echo * (1 - e / echo) * 100) / 100 });
  }

  return { bands, rows, ground, rings: { levels: R, fit: levels.length, deepest: field.deepest, core: R < levels.length ? coreLevel : null, lines } };
}

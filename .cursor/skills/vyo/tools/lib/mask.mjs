// A drawn silhouette: ops painted in order into one mask at sheet resolution. Everything the shape field draws,
// places and checks is read from the mask, never from the ops. Pure: render inlines it after geometry.mjs,
// `vyo sketch` and the checks import it.
import { SHEET, parsePath } from "./geometry.mjs";

/**
 * @typedef {[number, number]} Point
 * @typedef {{ add?: string, cut?: string, rotate?: number, at?: Point, r?: number | Point, size?: Point, round?: number,
 *             from?: Point | number, to?: Point | number, width?: number, points?: Point[], d?: string }} ShapeOp
 * @typedef {{ ops: ShapeOp[], rotate?: number, fit?: { w?: number, h?: number, cx?: number, cy?: number }, room?: { top: number } }} Shape
 * @typedef {{ runs: [number, number][][], area: number, box: { left: number, top: number, right: number, bottom: number },
 *             fit: { w: number, h: number }, xf: { s: number, tx: number, ty: number } }} Mask
 *   runs[y]: where the shape is inside on the pixel row y to y + 1 (sampled at y + 0.5), as sorted, disjoint
 *   [left, right] in sheet px, clipped to the sheet. area: covered px on the sheet. box: the whole fitted shape,
 *   bleed included. fit: its width and height as shares of the sheet's. xf: shape units to sheet px, x * s + tx.
 */

// Each kind's keys and their types: "point" is [x, y], "pair" two numbers above 0, "points" a list of points.
export const SHAPE_KINDS = {
  circle: { at: "point", r: "positive" },
  ellipse: { at: "point", r: "pair" },
  rect: { at: "point", size: "pair", round: "optional" },
  capsule: { from: "point", to: "point", r: "positive" },
  arc: { at: "point", r: "positive", from: "number", to: "number", width: "positive" },
  polygon: { points: "points", round: "optional" },
  path: { d: "string" },
};
// With no fit.w or fit.h, the shape is as large as fits in the sheet less these margins, standing on the bottom
// one: the top margin is room for the label, headline and legend, the bottom one for the record line. A fit.w or
// fit.h without a centre centres it across at cx and at cy down. lib/place.mjs may set `room` on a shape with
// neither: the top of the room its words leave, which the shape then grows into and centres in, down to the
// bottom margin. Authors never write `room`; the spec rejects it.
export const SHAPE_ROOM = { left: 40, right: 40, top: 250, bottom: 56 };
export const SHAPE_FIT = { cx: 0.5, cy: 0.61 };
const QUARTER = 16;

const arcRing = (cx, cy, rx, ry, a0, a1, n) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });

/** A polygon with each corner rounded to radius `r`, or less where its edges are short. */
function roundedRing(points, r) {
  if (!r) return points;
  const n = points.length;
  return points.flatMap((p, i) => {
    const a = points[(i + n - 1) % n];
    const b = points[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    if (!la || !lb) return [p];
    const u = [(a[0] - p[0]) / la, (a[1] - p[1]) / la];
    const v = [(b[0] - p[0]) / lb, (b[1] - p[1]) / lb];
    const half = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) / 2;
    if (half < 1e-3 || Math.PI / 2 - half < 1e-3) return [p];
    const t = Math.min(r / Math.tan(half), la / 2, lb / 2);
    const rr = t * Math.tan(half);
    const bis = [u[0] + v[0], u[1] + v[1]];
    const bl = Math.hypot(...bis);
    const c = [p[0] + (bis[0] / bl) * (rr / Math.sin(half)), p[1] + (bis[1] / bl) * (rr / Math.sin(half))];
    const s = [p[0] + u[0] * t, p[1] + u[1] * t];
    const e = [p[0] + v[0] * t, p[1] + v[1] * t];
    let a0 = Math.atan2(s[1] - c[1], s[0] - c[0]);
    let a1 = Math.atan2(e[1] - c[1], e[0] - c[0]);
    if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
    if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    return arcRing(c[0], c[1], rr, rr, a0, a1, 8);
  });
}

const clockPoint = (cx, cy, r, deg) => [cx + r * Math.sin((deg * Math.PI) / 180), cy - r * Math.cos((deg * Math.PI) / 180)];

// Each kind as closed rings in its own units, filled with the nonzero rule, and the centre its rotate turns about.
const KIND_RINGS = {
  circle: (o) => [arcRing(o.at[0], o.at[1], o.r, o.r, 0, 2 * Math.PI, 4 * QUARTER)],
  ellipse: (o) => [arcRing(o.at[0], o.at[1], o.r[0], o.r[1], 0, 2 * Math.PI, 4 * QUARTER)],
  rect: (o) => {
    const [x, y] = o.at;
    const [w, h] = o.size;
    return [roundedRing([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], Math.min(o.round ?? 0, w / 2, h / 2))];
  },
  capsule: (o) => {
    const [a, b] = [o.from, o.to];
    const d = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return [[...arcRing(b[0], b[1], o.r, o.r, d - Math.PI / 2, d + Math.PI / 2, 2 * QUARTER), ...arcRing(a[0], a[1], o.r, o.r, d + Math.PI / 2, d + (3 * Math.PI) / 2, 2 * QUARTER)]];
  },
  arc: (o) => {
    const sweep = ((((o.to - o.from) % 360) + 360) % 360) || 360;
    const n = Math.max(4, Math.ceil(sweep / 4));
    const side = (r) => Array.from({ length: n + 1 }, (_, i) => clockPoint(o.at[0], o.at[1], r, o.from + (sweep * i) / n));
    return [[...side(o.r + o.width / 2), ...side(Math.max(0, o.r - o.width / 2)).reverse()]];
  },
  polygon: (o) => [roundedRing(o.points, o.round ?? 0)],
  path: (o) => parsePath(o.d).rings ?? [],
};

const turn = (rings, deg, [cx, cy]) => {
  if (!deg) return rings;
  const [c, s] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  return rings.map((ring) => ring.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]));
};

function ringBox(rings) {
  const b = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const ring of rings) for (const [x, y] of ring) [b.left, b.top, b.right, b.bottom] = [Math.min(b.left, x), Math.min(b.top, y), Math.max(b.right, x), Math.max(b.bottom, y)];
  return b;
}

/** An op's verb and kind: the one of `add`, `cut` and `crease` it has. */
export const opKind = (op) => ("add" in op ? ["add", op.add] : "crease" in op ? ["crease", op.crease] : ["cut", op.cut]);

/** Every op as `{ verb, cut, rings }` in shape units: its own rotate about its centre (a path's: its box's), then the shape's. */
export function opRings(shape, ops = shape.ops) {
  return ops.map((op) => {
    const [verb, kind] = opKind(op);
    let rings = KIND_RINGS[kind](op);
    const b = ringBox(rings);
    rings = turn(rings, op.rotate, [(b.left + b.right) / 2, (b.top + b.bottom) / 2]);
    return { verb, cut: verb === "cut", rings: turn(rings, shape.rotate, [0, 0]) };
  });
}

/** Where row y's centre crosses the rings, filled nonzero: sorted [left, right] spans. */
function rowSpans(edges, yc) {
  const xs = [];
  for (const [x0, y0, x1, y1] of edges) {
    if ((y0 <= yc) !== (y1 <= yc)) xs.push([x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0), y1 > y0 ? 1 : -1]);
  }
  xs.sort((a, b) => a[0] - b[0]);
  const out = [];
  let wind = 0;
  for (const [x, d] of xs) {
    const was = wind;
    wind += d;
    if (!was && wind) out.push([x, x]);
    else if (was && !wind) out[out.length - 1][1] = x;
  }
  return out.filter(([l, r]) => r > l);
}

/** The union of two sorted span lists. */
export function unionRuns(a, b) {
  const all = [...a, ...b].sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const [l, r] of all) {
    const last = out[out.length - 1];
    if (last && l <= last[1]) last[1] = Math.max(last[1], r);
    else out.push([l, r]);
  }
  return out;
}

/** `a` with `b` taken out. */
export function subtractRuns(a, b) {
  let out = a.map((s) => [...s]);
  for (const [l, r] of b) out = out.flatMap(([p, q]) => (r <= p || l >= q ? [[p, q]] : [...(l > p ? [[p, l]] : []), ...(r < q ? [[r, q]] : [])]));
  return out;
}

/** Where both `a` and `b` are inside. */
export function intersectRuns(a, b) {
  const out = [];
  for (const [l1, r1] of a) for (const [l2, r2] of b) if (Math.min(r1, r2) > Math.max(l1, l2)) out.push([Math.max(l1, l2), Math.min(r1, r2)]);
  return out;
}

/** The ops' rings, scaled by `s` and moved by (tx, ty), painted into `rows` pixel rows of spans. */
export function paintRows(ops, s, tx, ty, rows) {
  const runs = Array.from({ length: rows }, () => []);
  for (const op of ops) {
    const edges = op.rings.flatMap((ring) => ring.map((p, i) => {
      const q = ring[(i + 1) % ring.length];
      return [p[0] * s + tx, p[1] * s + ty, q[0] * s + tx, q[1] * s + ty];
    }));
    const lo = Math.max(0, Math.floor(Math.min(...edges.map((e) => Math.min(e[1], e[3])))));
    const hi = Math.min(rows, Math.ceil(Math.max(...edges.map((e) => Math.max(e[1], e[3])))));
    for (let y = lo; y < hi; y++) {
      const spans = rowSpans(edges, y + 0.5);
      runs[y] = op.cut ? subtractRuns(runs[y], spans) : unionRuns(runs[y], spans);
    }
  }
  return runs;
}

/** The extent of painted spans, in their own pixels. */
function runsBox(runs) {
  const rows = runs.map((r, y) => [r, y]).filter(([r]) => r.length);
  if (!rows.length) return null;
  return {
    left: Math.min(...rows.map(([r]) => r[0][0])),
    right: Math.max(...rows.map(([r]) => r[r.length - 1][1])),
    top: rows[0][1],
    bottom: rows[rows.length - 1][1] + 1,
  };
}

/**
 * The shape fitted to the sheet: its painted extent (cuts and rotations counted) scaled uniformly so that it is
 * `fit.w` of the sheet's width or `fit.h` of its height (the smaller scale when both are given), centred on
 * (`fit.cx`, `fit.cy`). Without either, as large as fits inside SHAPE_ROOM, on its bottom margin, so it never
 * bleeds. Returns null when the ops paint nothing.
 * @param {Shape} shape
 * @returns {Mask | null}
 */
export function shapeMask(shape) {
  // A crease folds the relief style's surface; it never changes the silhouette.
  const ops = opRings(shape).filter((o) => o.verb !== "crease");
  const raw = ringBox(ops.filter((o) => !o.cut).flatMap((o) => o.rings));
  const span = Math.max(raw.right - raw.left, raw.bottom - raw.top);
  if (!(span > 0) || !Number.isFinite(span)) return null;
  // Measure the painted extent on a 1000px probe first: cuts can trim it.
  const p = 1000 / span;
  const probe = runsBox(paintRows(ops, p, -raw.left * p, -raw.top * p, Math.ceil((raw.bottom - raw.top) * p) + 1));
  if (!probe) return null;
  const box = { left: raw.left + probe.left / p, top: raw.top + probe.top / p, w: (probe.right - probe.left) / p, h: (probe.bottom - probe.top) / p };
  const { width: W, height: H } = SHEET;
  const given = shape.fit ?? {};
  const R = SHAPE_ROOM;
  const sized = given.w !== undefined || given.h !== undefined;
  const top = sized ? R.top : shape.room?.top ?? R.top;
  const s = sized
    ? Math.min(...[given.w !== undefined && (given.w * W) / box.w, given.h !== undefined && (given.h * H) / box.h].filter(Boolean))
    : Math.min((W - R.left - R.right) / box.w, (H - top - R.bottom) / box.h);
  const cx = given.cx ?? (sized ? SHAPE_FIT.cx : (R.left + (W - R.left - R.right) / 2) / W);
  const cy = given.cy ?? (sized ? SHAPE_FIT.cy : shape.room ? (top + H - R.bottom) / 2 / H : (H - R.bottom - (box.h * s) / 2) / H);
  const tx = cx * W - (box.left + box.w / 2) * s;
  const ty = cy * H - (box.top + box.h / 2) * s;
  const runs = paintRows(ops, s, tx, ty, H).map((row) => row.map(([l, r]) => [Math.max(0, l), Math.min(W, r)]).filter(([l, r]) => r > l));
  const area = runs.reduce((sum, row) => sum + row.reduce((a, [l, r]) => a + r - l, 0), 0);
  const placed = { left: box.left * s + tx, top: box.top * s + ty, right: (box.left + box.w) * s + tx, bottom: (box.top + box.h) * s + ty };
  return { runs, area, box: placed, fit: { w: (box.w * s) / W, h: (box.h * s) / H }, xf: { s, tx, ty } };
}

// Felzenszwalb and Huttenlocher's exact squared Euclidean distance transform, in place, on a w by h grid.
export function edt(f, w, h) {
  const n = Math.max(w, h);
  const [d, v, z, g] = [new Float64Array(n), new Int32Array(n), new Float64Array(n + 1), new Float64Array(n)];
  const pass = (get, set, len) => {
    for (let q = 0; q < len; q++) g[q] = get(q);
    let k = 0;
    [v[0], z[0], z[1]] = [0, -Infinity, Infinity];
    for (let q = 1; q < len; q++) {
      let s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      [v[k], z[k], z[k + 1]] = [q, s, Infinity];
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) ** 2 + g[v[k]];
    }
    for (let q = 0; q < len; q++) set(q, d[q]);
  };
  for (let x = 0; x < w; x++) pass((y) => f[y * w + x], (y, val) => (f[y * w + x] = val), h);
  for (let y = 0; y < h; y++) pass((x) => f[y * w + x], (x, val) => (f[y * w + x] = val), w);
  return f;
}

/**
 * The mask as a grid of `cell`-px cells, 1 where the cell's centre is inside.
 * @param {Mask} mask
 * @returns {{ w: number, h: number, bits: Uint8Array }}
 */
export function maskGrid(mask, cell) {
  const w = Math.ceil(SHEET.width / cell);
  const h = Math.ceil(SHEET.height / cell);
  const bits = new Uint8Array(w * h);
  for (let gy = 0; gy < h; gy++) {
    const row = mask.runs[Math.min(SHEET.height - 1, Math.floor((gy + 0.5) * cell))];
    for (const [l, r] of row) for (let gx = Math.max(0, Math.ceil(l / cell - 0.5)); gx < w && (gx + 0.5) * cell < r; gx++) bits[gy * w + gx] = 1;
  }
  return { w, h, bits };
}

/**
 * Rows of spans as one SVG path. Each span is sampled at its row's centre, so a trapezoid joins it to the spans
 * it touches one row down, centre to centre, and slanted edges stay smooth; where nothing touches above or
 * below, a half-row strip closes the edge. `rows` is [y, spans][], each y once, in order.
 * @param {[number, [number, number][]][]} rows
 */
export function runsPath(rows) {
  const f = (n) => Math.round(n * 100) / 100;
  const touching = (spans, l, r) => spans.filter(([a, b]) => a < r && b > l);
  const out = [];
  rows.forEach(([y, spans], i) => {
    const above = rows[i - 1]?.[0] === y - 1 ? rows[i - 1][1] : [];
    const next = rows[i + 1]?.[0] === y + 1 ? rows[i + 1][1] : [];
    for (const [l, r] of spans) {
      if (!touching(above, l, r).length) out.push(`M${f(l)} ${y}H${f(r)}V${y + 0.5}H${f(l)}Z`);
      // Toward the outer ends of every span below that it touches: a span that splits in two below (a loop
      // leaving the body) must not taper to one of them and leave a sliver of paper.
      const below = touching(next, l, r);
      if (below.length) out.push(`M${f(l)} ${y + 0.5}H${f(r)}L${f(Math.max(...below.map((s) => s[1])))} ${y + 1.5}H${f(Math.min(...below.map((s) => s[0])))}Z`);
      else out.push(`M${f(l)} ${y + 0.5}H${f(r)}V${y + 1}H${f(l)}Z`);
    }
  });
  return out.join("");
}

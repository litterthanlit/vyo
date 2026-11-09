// A figure's geometry and the rows of words that fill it. Pure and DOM-free: render inlines this
// file into the page and `vyo sketch` imports it, so the sketch and the poster lay out the same rows.

export const SHEET = { width: 840, height: 1190 };
export const SHAPE_KEYS = ["profile", "ellipse", "polygon", "path"];
// Row pitch and the two heights a row samples, per font size. A row is inside where both are.
export const GRID = { 11: { pitch: 14, probes: [2, 12] }, 12: { pitch: 16, probes: [3, 13] } };
// Commit Mono advances 0.6em, so a row's text width is its length times this.
export const ADVANCE = 0.6;
/** Commit Mono's fixed advance, standing in for the page's measured text in Node. */
export const fixedMeasure = (text, size) => text.length * ADVANCE * size;
const MIN_RUN = 24;
const TEXT_PAD = 12;

// Monotone cubic interpolation (Fritsch and Carlson) through ascending xs: no overshoot between stops.
function monotone(xs, ys) {
  const n = xs.length;
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const m = xs.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      m[i] = (3 / Math.sqrt(s)) * a * d[i];
      m[i + 1] = (3 / Math.sqrt(s)) * b * d[i];
    }
  }
  return (x) => {
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = Math.min(1, Math.max(0, (x - xs[i]) / h));
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

function profileRing(stops) {
  const ys = stops.map((s) => s[0]);
  const cx = monotone(ys, stops.map((s) => s[1]));
  const hw = monotone(ys, stops.map((s) => s[2]));
  const top = ys[0];
  const bottom = ys[ys.length - 1];
  const samples = [];
  for (let y = top; y < bottom; y += 1) samples.push(y);
  samples.push(bottom);
  const left = samples.map((y) => [cx(y) - Math.max(0, hw(y)), y]);
  const right = samples.map((y) => [cx(y) + Math.max(0, hw(y)), y]).reverse();
  return [...left, ...right];
}

function ellipseRing({ cx, cy, rx, ry }) {
  const n = 360;
  return Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)]);
}

const PATH_TOKEN = /\s*,?\s*([MmLlHhVvCcQqAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/y;
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, A: 7, Z: 0 };

/** The tokens of an SVG path string, or an error naming where it stopped parsing. */
function tokenize(d) {
  const out = [];
  PATH_TOKEN.lastIndex = 0;
  let at = 0;
  while (at < d.length) {
    if (/^[\s,]*$/.test(d.slice(at))) break;
    PATH_TOKEN.lastIndex = at;
    const m = PATH_TOKEN.exec(d);
    if (!m) return { error: `cannot read "${d.slice(at, at + 12).trim()}"` };
    out.push(/[a-z]/i.test(m[1]) ? m[1] : Number(m[1]));
    at = PATH_TOKEN.lastIndex;
  }
  return { tokens: out };
}

// The arc from the current point, converted to its centre form (SVG 1.1 implementation notes F.6.5) and sampled.
function arcPoints([x1, y1], [rx, ry, rot, large, sweep, x2, y2]) {
  if (rx === 0 || ry === 0) return [[x2, y2]];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (rot * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy;
  const yp = -sin * dx + cos * dy;
  const scale = Math.max(1, Math.sqrt((xp * xp) / (rx * rx) + (yp * yp) / (ry * ry)));
  rx *= scale;
  ry *= scale;
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / (rx * rx * yp * yp + ry * ry * xp * xp)));
  const cxp = (k * rx * yp) / ry;
  const cyp = (-k * ry * xp) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(2, Math.ceil(Math.abs(dt) / (Math.PI / 36)));
  return Array.from({ length: n }, (_, i) => {
    const t = t1 + (dt * (i + 1)) / n;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy];
  });
}

const bezier = (pts, steps = 16) =>
  Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps;
    let p = pts;
    while (p.length > 1) p = p.slice(1).map((q, j) => [p[j][0] + (q[0] - p[j][0]) * t, p[j][1] + (q[1] - p[j][1]) * t]);
    return p[0];
  });

/**
 * An SVG path flattened to closed rings, one per subpath. Supports M L H V C Q A Z, absolute and relative.
 * @param {string} d
 * @returns {{ rings: [number, number][][] } | { error: string }}
 */
export function parsePath(d) {
  const { tokens, error } = tokenize(d);
  if (error) return { error };
  if (!tokens.length) return { error: "empty" };
  if (tokens[0] !== "M" && tokens[0] !== "m") return { error: "must start with M" };
  const rings = [];
  let ring = null;
  let cur = [0, 0];
  let start = [0, 0];
  let i = 0;
  let cmd = null;
  while (i < tokens.length) {
    if (typeof tokens[i] === "string") cmd = tokens[i++];
    else if (cmd === null) return { error: "a number before any command" };
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    if (!(up in ARITY)) return { error: `"${cmd}" is not supported; use M L H V C Q A Z` };
    if (up === "Z") {
      if (ring) rings.push(ring);
      ring = null;
      cur = start;
      continue;
    }
    const args = tokens.slice(i, i + ARITY[up]);
    if (args.length < ARITY[up] || args.some((a) => typeof a !== "number")) return { error: `"${cmd}" needs ${ARITY[up]} numbers` };
    i += ARITY[up];
    const abs = (x, y) => (rel ? [cur[0] + x, cur[1] + y] : [x, y]);
    let pts;
    if (up === "M") {
      if (ring) rings.push(ring);
      cur = start = abs(args[0], args[1]);
      ring = [cur];
      cmd = rel ? "l" : "L";
      continue;
    }
    if (!ring) ring = [cur];
    if (up === "L") pts = [abs(args[0], args[1])];
    else if (up === "H") pts = [[rel ? cur[0] + args[0] : args[0], cur[1]]];
    else if (up === "V") pts = [[cur[0], rel ? cur[1] + args[0] : args[0]]];
    else if (up === "C") pts = bezier([cur, abs(args[0], args[1]), abs(args[2], args[3]), abs(args[4], args[5])]);
    else if (up === "Q") pts = bezier([cur, abs(args[0], args[1]), abs(args[2], args[3])]);
    else {
      if (![0, 1].includes(args[3]) || ![0, 1].includes(args[4])) return { error: "arc flags must be 0 or 1" };
      pts = arcPoints(cur, [...args.slice(0, 5), ...abs(args[5], args[6])]);
    }
    ring.push(...pts);
    cur = pts[pts.length - 1];
  }
  if (ring) rings.push(ring);
  const closed = rings.filter((r) => r.length >= 3);
  return closed.length ? { rings: closed } : { error: "no closed shape" };
}

/** The rings of one shape: `{ profile }`, `{ ellipse }`, `{ polygon }` or `{ path }`. Paths that do not parse give no rings. */
export function shapeRings(shape) {
  if (shape.profile) return [profileRing(shape.profile)];
  if (shape.ellipse) return [ellipseRing(shape.ellipse)];
  if (shape.polygon) return [shape.polygon];
  const parsed = parsePath(shape.path);
  return parsed.rings || [];
}

/** The outline and every hole of a region, filled together with the even-odd rule. */
export const regionRings = (region) => [...shapeRings(region), ...(region.holes || []).flatMap(shapeRings)];

export function bbox(rings) {
  const pts = rings.flat();
  if (!pts.length) return { left: 0, top: 0, right: 0, bottom: 0 };
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

/** Where the line at height y is inside the rings (even-odd), as sorted [left, right] intervals. */
export function spans(rings, y) {
  const xs = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (a[1] <= y !== b[1] <= y) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
  }
  xs.sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] > xs[i]) out.push([xs[i], xs[i + 1]]);
  return out;
}

function intersect(a, b) {
  const out = [];
  for (const [l1, r1] of a) for (const [l2, r2] of b) if (Math.min(r1, r2) > Math.max(l1, l2)) out.push([Math.max(l1, l2), Math.min(r1, r2)]);
  return out;
}

function mergeGaps(runs, gap) {
  const out = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && r[0] - last[1] < gap) last[1] = Math.max(last[1], r[1]);
    else out.push([...r]);
  }
  return out;
}

const cut = (runs, [l, r]) => runs.flatMap(([a, b]) => (r <= a || l >= b ? [[a, b]] : [...(l > a ? [[a, l]] : []), ...(r < b ? [[r, b]] : [])]));

/**
 * The rows of a fill region: each grid row the shape covers, with its runs of inside space after the
 * text blocks (padded 12px) are cut out. Runs are whole pixels and at least 24px wide.
 * @param {object} region
 * @param {{ left: number, top: number, right: number, bottom: number }[]} blocks
 */
export function regionRows(region, blocks) {
  const { pitch, probes } = GRID[region.size || 12];
  const rings = regionRings(region);
  const box = bbox(rings);
  const rows = [];
  for (let y = Math.floor(box.top / pitch) * pitch; y < box.bottom; y += pitch) {
    const runs = clearOf(mergeGaps(intersect(spans(rings, y + probes[0]), spans(rings, y + probes[1])), MIN_RUN), y, pitch, blocks);
    if (runs.length) rows.push({ y, runs });
  }
  return rows;
}

/** Runs of a row at y, `height` tall, with the text blocks (padded 12px) cut out: whole pixels, at least 24px wide. */
export function clearOf(runs, y, height, blocks) {
  for (const b of blocks) if (b.top - TEXT_PAD < y + height && b.bottom + TEXT_PAD > y) runs = cut(runs, [b.left - TEXT_PAD, b.right + TEXT_PAD]);
  return runs.map(([l, r]) => [Math.ceil(l), Math.floor(r)]).filter(([l, r]) => r - l >= MIN_RUN);
}

const stopsOf = (tone) => (Array.isArray(tone) ? tone : [tone]);

/**
 * Every word of a fill region placed in its rows: one word per row (or per `band` rows), repeated
 * and letter-spaced across each run, or centred at its natural width when the run is short.
 * @param {object} region
 * @param {{ y: number, runs: [number, number][] }[]} rows
 * @param {{ measure: (text: string) => number, isHot: (word: string) => boolean }} o
 */
export function fillRows(region, rows, { measure, isHot }) {
  const words = region.words;
  const caps = region.caps !== false;
  const shown = (w) => (caps ? w.toUpperCase() : w);
  const band = region.band || 1;
  const stops = stopsOf(region.tone);
  const owed = new Set();
  let cursor = 0;
  const pick = (room) => {
    let j = cursor % words.length;
    for (let i = 0; i < words.length; i++) {
      j = (cursor + i) % words.length;
      if (measure(shown(words[j])) <= room || owed.has(j)) break;
      owed.add(j);
      if (i === words.length - 1) j = cursor % words.length;
    }
    owed.delete(j);
    cursor = j + 1;
    return words[j];
  };
  const out = [];
  let word = null;
  rows.forEach((row, i) => {
    if (i % band === 0) word = pick(Math.max(...row.runs.map(([l, r]) => r - l)));
    const text = shown(word);
    const natural = measure(text);
    const hot = !!region.hot || isHot(word);
    const tone = stops[rows.length === 1 ? 0 : Math.round((i / (rows.length - 1)) * (stops.length - 1))];
    for (const [l, r] of row.runs) {
      const room = r - l;
      const base = { y: row.y, word, hot, tone, run: room };
      if (room < 2 * natural) {
        out.push({ ...base, x: (l + r) / 2 - natural / 2, width: natural, text, spacing: 0 });
        continue;
      }
      let k = Math.max(1, Math.round(room / (natural * 1.9)));
      let plain;
      let width;
      do {
        plain = Array(k).fill(text).join("   ");
        width = measure(plain);
      } while (width > room && --k > 1);
      const spacing = Math.max(0, (room - width - 0.5) / Math.max(1, plain.length - 1));
      out.push({ ...base, x: l, width: room, text: plain, spacing });
    }
  });
  return out;
}

/** The rows a dots region draws: one line per word, a 5x7 letter grid of 29 cells by 7. */
export const DOTS = { cols: 29, rows: 7, pitch: 9 };
export const dotsLines = (region) =>
  region.lines.map((word, i) => ({ word, x: region.x, y: region.y + i * DOTS.pitch * region.cell, width: DOTS.cols * region.cell, height: DOTS.rows * region.cell }));

// The empty corners a field leaves, on a 20px grid like `vyo sketch`.
export const CORNER_CELL = 20;
// A corner narrower than this holds no text block, so a wider one wins over a larger sliver; and height past
// CORNER_MAX_H holds nothing a corner's text needs, so it does not count toward a corner's size.
export const CORNER_MIN_W = 220;
export const CORNER_MAX_H = 400;
export const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];

/**
 * The largest empty rectangle anchored at each corner of the sheet: a cell is taken when any rect touches it.
 * Grown row by row from the corner, keeping the run of empty cells from the edge. The largest wins, its height
 * counted up to CORNER_MAX_H, among those at least CORNER_MIN_W wide when there are any. Two corners that
 * overlap along an edge split the overlap evenly.
 * @param {{ left: number, top: number, right: number, bottom: number }[]} rects
 * @returns {Record<"top-left" | "top-right" | "bottom-left" | "bottom-right", { x: number, y: number, w: number, h: number }>}
 */
export function corners(rects) {
  const C = CORNER_CELL;
  const cols = Math.ceil(SHEET.width / C);
  const rows = Math.ceil(SHEET.height / C);
  const taken = Array.from({ length: rows }, () => new Uint8Array(cols));
  for (const r of rects) {
    for (let q = Math.max(0, Math.floor(r.top / C)); q < Math.min(rows, Math.ceil(r.bottom / C)); q++)
      for (let c = Math.max(0, Math.floor(r.left / C)); c < Math.min(cols, Math.ceil(r.right / C)); c++) taken[q][c] = 1;
  }
  const out = {};
  for (const name of CORNERS) {
    const [vert, horiz] = name.split("-");
    // Capped area first, then the whole area, so of two corners equal under the cap the larger wins.
    const score = (b) => b.cols * Math.min(b.rows, CORNER_MAX_H / C) * 1e6 + b.cols * b.rows;
    let best = { cols: 0, rows: 0 };
    let wide = { cols: 0, rows: 0 };
    let run = cols;
    for (let k = 0; k < rows && run > 0; k++) {
      const row = taken[vert === "top" ? k : rows - 1 - k];
      let n = 0;
      while (n < run && !row[horiz === "left" ? n : cols - 1 - n]) n++;
      run = n;
      const here = { cols: run, rows: k + 1 };
      if (score(here) > score(best)) best = here;
      if (run * C >= CORNER_MIN_W && score(here) > score(wide)) wide = here;
    }
    if (wide.cols) best = wide;
    const w = Math.min(SHEET.width, best.cols * C);
    // The bottom row of cells hangs past the sheet's edge, which is not a whole number of cells.
    const h = Math.max(0, Math.min(SHEET.height, best.rows * C - (vert === "bottom" ? rows * C - SHEET.height : 0)));
    out[name] = { w, h };
  }
  const split = (a, b, size) => {
    const over = out[a][size] + out[b][size] - (size === "w" ? SHEET.width : SHEET.height);
    if (over <= 0 || !out[a][size === "w" ? "h" : "w"] || !out[b][size === "w" ? "h" : "w"]) return;
    // A strip too narrow for any text block gives up the whole overlap to a corner that can hold one.
    const narrow = size === "h" ? [a, b].filter((n) => out[n].w < CORNER_MIN_W) : [];
    if (narrow.length === 1) {
      out[narrow[0]][size] = Math.max(0, out[narrow[0]][size] - Math.ceil(over / C) * C);
      return;
    }
    const cut = Math.ceil(over / 2 / C) * C;
    out[a][size] = Math.max(0, out[a][size] - cut);
    out[b][size] = Math.max(0, out[b][size] - cut);
  };
  split("top-left", "top-right", "w");
  split("bottom-left", "bottom-right", "w");
  split("top-left", "bottom-left", "h");
  split("top-right", "bottom-right", "h");
  for (const name of CORNERS) {
    const { w, h } = out[name];
    out[name] = { x: name.endsWith("left") ? 0 : SHEET.width - w, y: name.startsWith("top") ? 0 : SHEET.height - h, w, h };
  }
  return out;
}

/** One line per corner for the agent: "top-left at 0,0 is 420 by 380". */
export const cornersLine = (c) => `corners: ${CORNERS.map((n) => `${n} at ${c[n].x},${c[n].y} is ${c[n].w} by ${c[n].h}`).join("; ")}`;

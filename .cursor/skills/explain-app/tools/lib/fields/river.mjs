// The river field: one stream of 0s and 1s per part entering the left edge, as thick as its share of lines,
// merging pairwise by how many imports tie them, into one channel that leaves the right edge. Ported from
// g-flow. Pure, like wave.mjs: render inlines it, `vyo sketch` imports it.
import { SHEET } from "../geometry.mjs";

// g-flow's numbers: 5px digits in 3.1px cells on 5px rows; streams start off the left edge and the last merge
// is at x 600. The channel that leaves is `trunk` of the sheet's height; the streams enter across `span` of it.
export const RIVER = {
  size: 5, cell: 3.1, pitch: 5,
  trunk: 0.2, minThick: 3.6, minDens: 0.4, span: [0.2, 0.78], gap: [4, 40],
  start: -30, last: 600, x0: 0.22, pow: 0.9, core: 0.6, gamma: 1.4,
  accent: { rows: 1, length: 17, back: 10 },
};

/** A hash of two whole numbers to [0, 1): the same in Node and the page, so digits and gaps never differ. */
export function cellHash(a, b) {
  let x = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) ^ 0x5bd1e995;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * The merge tree: leaves are the parts, and each step joins the two clusters with the most imports between
 * them per unit of size (average linkage, as g-flow), the one earlier in tree order on top.
 * @param {{ loc: number }[]} parts
 * @param {[number, number, number][]} ties
 */
export function mergeTree(parts, ties) {
  const n = parts.length;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [i, j, k] of ties) {
    A[i][j] += k;
    A[j][i] += k;
  }
  let active = parts.map((p, i) => ({ leaf: true, i, loc: Math.max(1, p.loc), members: [i] }));
  const affinity = (x, y) => {
    let s = 0;
    for (const i of x.members) for (const j of y.members) s += A[i][j];
    return s / Math.sqrt(x.loc * y.loc);
  };
  const mean = (x) => x.members.reduce((s, m) => s + m, 0) / x.members.length;
  while (active.length > 1) {
    let best = -1;
    let bx = 0;
    let by = 1;
    for (let x = 0; x < active.length; x++)
      for (let y = x + 1; y < active.length; y++) {
        const v = affinity(active[x], active[y]);
        if (v > best) [best, bx, by] = [v, x, y];
      }
    const [a, b] = [active[bx], active[by]];
    const kids = mean(a) <= mean(b) ? [a, b] : [b, a];
    const node = { leaf: false, kids, loc: a.loc + b.loc, members: [...kids[0].members, ...kids[1].members] };
    active = [...active.filter((_, k) => k !== bx && k !== by), node];
  }
  return active[0];
}

/** Each stream as a ribbon: from xa to xb, its centre easing from ya to yb, `thick` px across. */
function ribbons(parts, ties, floor) {
  const { trunk, minThick, minDens, span, gap, start, last, x0, pow } = RIVER;
  const root = mergeTree(parts, ties);
  const total = parts.reduce((s, p) => s + Math.max(1, p.loc), 0);
  const per = total / (trunk * floor);
  const leaves = [];
  (function size(nd) {
    if (nd.leaf) {
      nd.thick = Math.max(minThick, nd.loc / per);
      // A stream thinner than minThick draws fewer digits, but never so few that the part vanishes.
      nd.dens = Math.max(minDens, Math.min(1, nd.loc / per / minThick));
      leaves.push(nd);
    } else {
      nd.kids.forEach(size);
      nd.thick = nd.kids[0].thick + nd.kids[1].thick;
      nd.dens = 1;
    }
    nd.height = nd.leaf ? 0 : 1 + Math.max(nd.kids[0].height, nd.kids[1].height);
  })(root);
  const [top, bottom] = span.map((s) => s * floor);
  const sum = leaves.reduce((s, l) => s + l.thick, 0);
  const g = leaves.length > 1 ? Math.min(gap[1], Math.max(gap[0], (bottom - top - sum) / (leaves.length - 1))) : 0;
  let y = (top + bottom) / 2 - (sum + g * (leaves.length - 1)) / 2;
  for (const l of leaves) {
    l.cy = y + l.thick / 2;
    y += l.thick + g;
  }
  (function centre(nd) {
    if (nd.leaf) return;
    nd.kids.forEach(centre);
    nd.cy = (nd.kids[0].cy * nd.kids[0].thick + nd.kids[1].cy * nd.kids[1].thick) / nd.thick;
  })(root);
  const mergeX = (nd) => (nd === root ? last : start + (last - start) * (x0 + (1 - x0) * Math.pow(nd.height / Math.max(1, root.height), pow)));
  const out = [];
  (function place(nd, yb, xb) {
    const xa = nd.leaf ? start : mergeX(nd);
    const main = nd.members.reduce((m, i) => (parts[i].loc > parts[m].loc ? i : m), nd.members[0]);
    out.push({ xa, xb, ya: nd.cy, yb, thick: nd.thick, dens: nd.dens, part: nd.leaf ? nd.i : main, leaf: nd.leaf });
    if (nd.leaf) return;
    let o = nd.cy - nd.thick / 2;
    for (const k of nd.kids) {
      place(k, o + k.thick / 2, xa);
      o += k.thick;
    }
  })(root, root.cy, SHEET.width + 40);
  return { ribbons: out, exit: root.cy };
}

const ease = (t) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * u * (u * (6 * u - 15) + 10);
};

/**
 * The rows of a river region, top to bottom: runs of 0s and 1s, one stream and one shade each.
 * The texture is digits only, so no part name is printed; each run carries its part for the checks.
 * @param {{ ties?: [number, number, number][] }} region  ties: imports between parts, from parts.mjs
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts  in tree order
 * @param {{ floor: number, measure: (text: string, size: number) => number }} frame
 */
export function riverRows(region, parts, { floor, measure }) {
  if (!parts.length) return [];
  const { size, cell, pitch, core, gamma, accent, last } = RIVER;
  const { ribbons: ribs, exit } = ribbons(parts, region.ties ?? [], floor);
  const cols = Math.floor((SHEET.width - 2) / cell);
  const rows = Math.floor(floor / pitch);
  const dens = new Float32Array(cols * rows);
  const own = new Int32Array(cols * rows).fill(-1);
  const leaf = new Uint8Array(cols * rows);
  for (const r of ribs) {
    for (let c = Math.max(0, Math.floor(r.xa / cell)); c < Math.min(cols, Math.ceil(r.xb / cell)); c++) {
      const x = c * cell + cell / 2;
      if (x < r.xa || x > r.xb) continue;
      const yc = r.ya + (r.yb - r.ya) * ease((x - r.xa) / (r.xb - r.xa));
      const half = r.thick / 2;
      for (let q = Math.max(0, Math.floor((yc - half) / pitch)); q < Math.min(rows, Math.ceil((yc + half) / pitch)); q++) {
        const u = Math.abs(q * pitch + pitch / 2 - yc) / half;
        if (u > 1) continue;
        const d = (u < core ? 1 : 1 - (u - core) / (1 - core)) * r.dens;
        const k = q * cols + c;
        if (d > dens[k]) [dens[k], own[k], leaf[k]] = [d, r.part, r.leaf ? 1 : 0];
      }
    }
  }
  // Rounded to 0.05px so the page's measured advance and the sketch's fixed one agree.
  const cw = Math.round(measure("0", size) * 20) / 20;
  const spacing = Math.round((cell - cw) * 1000) / 1000;
  const startCol = Math.floor((last - accent.back) / cell);
  const exitRow = Math.round((exit - pitch / 2) / pitch);
  const out = [];
  for (let q = 0; q < rows; q++) {
    let run = null;
    const close = () => {
      if (run) {
        const text = run.text.trimEnd();
        if (text) out.push({ ...run, text, width: text.length * cw + (text.length - 1) * spacing });
      }
      run = null;
    };
    for (let c = 0; c < cols; c++) {
      const k = q * cols + c;
      const d = dens[k];
      if (d <= 0) {
        close();
        continue;
      }
      const p = parts[own[k]];
      const merge = Math.abs(q - exitRow) <= accent.rows && c >= startCol && c < startCol + accent.length;
      const hot = merge || (p.hot && leaf[k] === 1);
      const tone = hot ? "hot" : leaf[k] ? (own[k] % 2 ? "mid" : "ink") : "ink";
      const alpha = hot ? 1 : Math.round((0.3 + 0.48 * d) * 5) / 5;
      if (run && (run.part !== p.id || run.tone !== tone || run.alpha !== alpha)) close();
      const on = cellHash(c, q) <= Math.pow(d, gamma);
      if (!run && !on) continue;
      run ??= { x: c * cell + (cell - cw) / 2, y: q * pitch, height: pitch, size, text: "", spacing, part: p.id, word: p.name, hot, tone, alpha };
      run.text += on ? (cellHash(c + 977, q + 31) < 0.5 ? "0" : "1") : " ";
    }
    close();
  }
  return out;
}

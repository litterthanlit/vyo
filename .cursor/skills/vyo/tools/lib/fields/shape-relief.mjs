// The relief style of the shape field: the silhouette as a lit, sculpted volume set in dense 6px type. The mask's
// distance field gives a rounded height, strata split it among the parts by lines, and a light from the top left
// shades every glyph cell; each part's name repeats in its own stratum, the accent bold in the accent over a glow.
// Pure, like shape.mjs: the page inlines it and `vyo sketch` runs it in Node. Its top-level names all start with
// relief or RELIEF, because the page concatenates the field modules into one scope.
import { SHEET, ADVANCE } from "../geometry.mjs";
import { maskGrid, opRings, opKind, paintRows, intersectRuns } from "../mask.mjs";

// size, leading: the glyph grid. cell: the px of the height field. bevel: the default share of the shape's
// inscribed radius that is rounded. pillow: the px each stratum rounds off its seams. fold: a crease's width.
// rim: px inside the outline that never fade. light: toward the light, x right, y down, z up. phase: how far each
// line's names shift. accent, share, tone: the floors the findings hold, the tone floors set between good forms
// (lit 0.46 to 0.59, spread 0.36 to 0.42) and dim or flat ones (lit under 0.32, spread under 0.2).
export const RELIEF = {
  size: 6, leading: 1.04, cell: 2, bevel: 0.7, pillow: 12, fold: 14, rim: 5, light: [-0.62, -0.78, 0.75], phase: 7,
  accent: 40, share: { points: 0.6, part: 0.2 },
  tone: { lit: 0.38, spread: 0.3 },
};
// Per theme: the field's own token, the letters' colour, the underlay (the shading in `levels` soft steps under
// the letters, its alpha running from `from` in the shadow to `to` in the light), the glow under the accent and
// the shadow the form casts down and right, and how the accent stratum is drawn. On the dark sheet the letters are
// the light and the underlay a faint haze of it, and the accent glows. On paper, letters lit the same way on paper
// alone fade into it, so the form is a body in a deep cool ink, darkest in its shadow, and the letters are paper;
// an accent glowing over that body read as a muddy orange haze, so it is a solid stratum of the accent with dark
// letters, shaded by `shade` steps of the body's ink where it turns from the light, over a narrow glow.
export const RELIEF_TONES = {
  light: {
    tokens: { shade: "#2A3446" }, glyph: "paper", underlay: { tone: "shade", levels: 5, from: 0.97, to: 0.62 },
    glow: { spread: 6, blur: 8, alpha: 0.35 }, shadow: { tone: "shade", alpha: 0.22, blur: 14, at: [0.04, 0.06] },
    accent: { glyph: "on-hot", shade: [[0.8, 0.1], [0.6, 0.1], [0.4, 0.1]] },
  },
  dark: {
    tokens: {}, glyph: "ink", underlay: { tone: "ink", levels: 6, from: 0, to: 0.3 },
    glow: { spread: 12, blur: 18, alpha: 0.6 }, shadow: null, accent: null,
  },
};
// Ink a glyph lays on its cell, as a share of the cell, for the thumbnail the sketch predicts.
const RELIEF_COVER = { letter: [0.2, 0.3], dot: [0.035, 0.06], colon: [0.07, 0.11] };
// Measured against real thumbnails: the screenshot's antialiasing and downscale thin the glyphs this much.
const RELIEF_GAIN = 0.75;

/** Squared Euclidean distance, in cells, from each cell to the nearest cell where `f` is 0 (Felzenszwalb). */
function reliefEdt(f, w, h) {
  const n = Math.max(w, h);
  const [d, v, z, g] = [new Float64Array(n), new Int32Array(n), new Float64Array(n + 1), new Float64Array(n)];
  const pass = (len, at, step) => {
    for (let q = 0; q < len; q++) g[q] = f[at + q * step];
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
    for (let q = 0; q < len; q++) f[at + q * step] = d[q];
  };
  for (let x = 0; x < w; x++) pass(h, x, w);
  for (let y = 0; y < h; y++) pass(w, y * w, 1);
  return f;
}

/** Px from every cell to the nearest cell where `on` is false. */
const reliefDistance = (on, w, h, cell) => reliefEdt(Float64Array.from(on, (b) => (b ? 1e12 : 0)), w, h).map((d) => Math.sqrt(d) * cell);

/** An op painted alone onto the mask's sheet, as a grid of cells. */
function reliefOpGrid(shape, op, mask) {
  const { s, tx, ty } = mask.xf;
  const [, kind] = opKind(op);
  // A crease along a capsule or an arc is its centre line, 3px wide on the sheet.
  const thin = kind === "capsule" ? { r: 1.5 / s } : kind === "arc" ? { width: 3 / s } : {};
  const runs = paintRows(opRings(shape, [{ ...op, ...thin, add: kind, cut: undefined, crease: undefined }]).map((o) => ({ ...o, cut: false })), s, tx, ty, SHEET.height);
  return maskGrid({ runs }, RELIEF.cell).bits;
}

/** Where each inside cell falls along the strata: its distance along the direction, or in from the outline. */
function reliefStrataKey(inside, dIn, strata, w) {
  const a = ((strata?.angle ?? 90) * Math.PI) / 180;
  const [ca, sa] = [Math.cos(a), Math.sin(a)];
  const key = new Float64Array(inside.length);
  for (let i = 0; i < inside.length; i++) {
    if (!inside[i]) continue;
    const [x, y] = [i % w, Math.floor(i / w)];
    key[i] = strata?.by === "depth" ? dIn[i] + 0.001 * (x * ca + y * sa) : x * ca + y * sa + 1e-4 * (y * ca - x * sa);
  }
  return key;
}

/** Items sorted by key and cut into the parts in tree order, each as many items as its share of the lines. */
function reliefCut(items, keyOf, parts) {
  const order = items.map((_, k) => k).sort((p, q) => keyOf(items[p]) - keyOf(items[q]) || p - q);
  const label = new Int16Array(items.length);
  const total = parts.reduce((s, p) => s + p.loc, 0) || 1;
  // A cut where many items share a key (every cell of one row, for level strata) would split that row between
  // two parts, a step in the seam. So a cut lands where the key changes by half a cell or more, within about one
  // glyph line of exact, at the place that keeps both the running total and this part's own count nearest exact.
  // A ring of equal depth too big to fit that window keeps the exact cut.
  const gap = (j) => j <= 0 || j >= order.length || keyOf(items[order[j]]) - keyOf(items[order[j - 1]]) >= 0.5;
  let [acc, k, before] = [0, 0, 0];
  parts.forEach((p, pi) => {
    acc += p.loc;
    const exact = Math.round((acc / total) * order.length);
    let end = exact;
    if (pi < parts.length - 1) {
      let best = Infinity;
      for (let e = Math.max(k + 1, exact - 240); e <= Math.min(order.length - 1, exact + 240); e++) {
        const miss = Math.max(Math.abs(e - exact), Math.abs(e - k - (exact - before)));
        if (gap(e) && miss < best) [best, end] = [miss, e];
      }
    } else end = order.length;
    before = exact;
    for (; k < end; k++) label[order[k]] = pi;
  });
  return label;
}

/** Strata on the grid: each inside cell to one part, in tree order along the strata, area by lines of code. */
function reliefStrata(inside, key, parts) {
  const cells = [];
  for (let i = 0; i < inside.length; i++) if (inside[i]) cells.push(i);
  const cut = reliefCut(cells, (i) => key[i], parts);
  const label = new Int16Array(inside.length).fill(-1);
  cells.forEach((i, k) => (label[i] = cut[k]));
  return label;
}

/**
 * The lit surface on a grid of RELIEF.cell px: per cell, inside or not, its part, its light (0 on faces turned
 * away, 0.5 on a flat top, 1 toward the light) and its distance to the outline.
 */
function reliefSurface(mask, parts, region) {
  const C = RELIEF.cell;
  const { w, h, bits: inside } = maskGrid(mask, C);
  const dIn = reliefDistance(inside, w, h, C);
  const key = reliefStrataKey(inside, dIn, region.strata, w);
  const label = reliefStrata(inside, key, parts);
  const seam = new Uint8Array(w * h);
  for (let i = 0; i < seam.length; i++) {
    if (label[i] < 0) continue;
    const right = i % w < w - 1 ? label[i + 1] : -1;
    const down = i + w < seam.length ? label[i + w] : -1;
    if ((right >= 0 && right !== label[i]) || (down >= 0 && down !== label[i])) seam[i] = 1;
  }
  const dSeam = reliefDistance(seam.map((b) => 1 - b), w, h, C);
  const shape = region.shape;
  const face = new Int8Array(w * h);
  const crease = new Uint8Array(w * h);
  for (const op of shape.ops) {
    const [verb] = opKind(op);
    if (verb === "add" && (op.face === "lit" || op.face === "dim")) {
      const g = reliefOpGrid(shape, op, mask);
      for (let i = 0; i < g.length; i++) if (g[i]) face[i] = op.face === "lit" ? 1 : -1;
    } else if (verb === "add") {
      // A later round add over a facet rounds that part again.
      const g = reliefOpGrid(shape, op, mask);
      for (let i = 0; i < g.length; i++) if (g[i]) face[i] = 0;
    } else if (verb === "crease") {
      const g = reliefOpGrid(shape, op, mask);
      const stroke = ["capsule", "arc"].includes(op.crease);
      for (let i = 0; i < g.length; i++) {
        if (!g[i]) continue;
        const [x, y] = [i % w, Math.floor(i / w)];
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || !g[i - 1] || !g[i + 1] || !g[i - w] || !g[i + w];
        if (stroke || edge) crease[i] = 1;
      }
    }
  }
  const hasCrease = crease.some((b) => b);
  const dCrease = hasCrease ? reliefDistance(crease.map((b) => 1 - b), w, h, C) : null;
  let deepest = 0;
  for (let i = 0; i < dIn.length; i++) if (inside[i] && dIn[i] > deepest) deepest = dIn[i];
  const R = Math.max(8, (region.bevel ?? RELIEF.bevel) * deepest);
  const RS = Math.min(RELIEF.pillow, Math.max(4, R * 0.22));
  const dome = (d, r) => {
    const t = Math.min(d / r, 1);
    return r * Math.sqrt(1 - (1 - t) * (1 - t));
  };
  const L = RELIEF.light.map((c) => c / Math.hypot(...RELIEF.light));
  const away = [-L[0] / Math.hypot(L[0], L[1]), -L[1] / Math.hypot(L[0], L[1])];
  // The dome off the outline, softened: a distance field alone peaks in hard ridges along the shape's middle
  // (a roof over a rectangle), which reads as facets the author never drew.
  const base = new Float32Array(w * h);
  for (let i = 0; i < base.length; i++) if (inside[i]) base[i] = dome(dIn[i], R);
  reliefBlur(base, w, h, Math.max(1, Math.round((R * 0.25) / C)));
  const height = new Float64Array(w * h);
  for (let i = 0; i < height.length; i++) {
    if (!inside[i]) continue;
    const [x, y] = [(i % w) * C, Math.floor(i / w) * C];
    let z = base[i] + 0.45 * dome(dSeam[i], RS);
    if (face[i]) z = 0.35 * base[i] + 0.3 * dome(dSeam[i], RS) + face[i] * 0.55 * (x * away[0] + y * away[1]);
    if (dCrease) {
      const t = Math.max(0, 1 - dCrease[i] / RELIEF.fold);
      z -= RELIEF.fold * 0.9 * t * t;
    }
    height[i] = z;
  }
  const half = [L[0], L[1], L[2] + 1].map((c, _, v) => c / Math.hypot(...v));
  const flat = L[2];
  const light = new Float32Array(w * h);
  for (let i = 0; i < light.length; i++) {
    if (!inside[i]) continue;
    const [x, y] = [i % w, Math.floor(i / w)];
    const at = (dx, dy) => {
      const [nx, ny] = [x + dx, y + dy];
      return nx < 0 || ny < 0 || nx >= w || ny >= h ? height[i] : height[ny * w + nx];
    };
    const hx = (at(1, 0) - at(-1, 0)) / (2 * C);
    const hy = (at(0, 1) - at(0, -1)) / (2 * C);
    const n = Math.hypot(hx, hy, 1);
    const nl = (-hx * L[0] - hy * L[1] + L[2]) / n;
    const spec = Math.pow(Math.max(0, (-hx * half[0] - hy * half[1] + half[2]) / n), 16);
    const lam = nl >= flat ? 0.5 + (0.5 * (nl - flat)) / (1 - flat) : (0.5 * Math.max(0, nl)) / flat;
    light[i] = Math.min(1, lam + 0.45 * spec);
  }
  return { w, h, inside, label, key, dIn, light, R };
}

/**
 * How strongly a cell's letter shows, 0 to 1: the light, contrast-stretched so a flat top sits above the middle
 * and the lit side runs to full strength, the rim held up so the outline never fades.
 */
function reliefInk(b, dIn) {
  return Math.max(dIn < RELIEF.rim ? 0.8 : 0.18, Math.min(1, 0.62 + 1.9 * (b - 0.5)));
}

/** What a cell draws: a letter of its part's name, or a tone mark where no whole name fits; never a hole, so a dim surface stays a surface. */
function reliefGlyph(ch, gap, v) {
  if (!gap) return ch;
  return v < 0.65 ? "·" : ":";
}

/** A cell's look: its alpha in tenths, weight and colour token. */
function reliefLook(v, b, hot, theme) {
  if (hot) return { alpha: Math.round(10 * (0.6 + 0.4 * b)) / 10, weight: 700, tone: RELIEF_TONES[theme].accent?.glyph ?? "hot" };
  return { alpha: Math.round(10 * (0.24 + 0.76 * Math.pow(v, 1.1))) / 10, weight: v > 0.45 ? 700 : 400, tone: RELIEF_TONES[theme].glyph };
}

/** Cells of the grid where `on` holds, as sheet rows of spans: [y, [[l, r], ...]][]. */
function reliefRuns(on, w, h, C) {
  const out = [];
  for (let gy = 0; gy < h; gy++) {
    const spans = [];
    for (let gx = 0; gx < w; gx++) {
      if (!on[gy * w + gx]) continue;
      const last = spans[spans.length - 1];
      if (last && last[1] === gx * C) last[1] += C;
      else spans.push([gx * C, gx * C + C]);
    }
    if (spans.length) for (let k = 0; k < C; k++) out.push([gy * C + k, spans.map((s) => [...s])]);
  }
  return out;
}

/** The cells within `r` px of where `on` holds. */
function reliefGrow(on, w, h, r, C) {
  const d = reliefDistance(on.map((b) => 1 - b), w, h, C);
  return d.map((x) => (x <= r ? 1 : 0));
}

const reliefCache = { key: null, value: null };

/**
 * The relief style: one row of type per run of a part's cells on a glyph line, each a set of spans by look. A
 * part's name streams across its stratum, clipped clean at the strata seams; where no line would show it whole,
 * its longest run is re-phased to centre one name.
 * @param {import("../mask.mjs").Mask} mask
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts  in tree order
 * @param {{ measure: (text: string, size: number) => number, theme?: "light" | "dark" }} frame
 * @param {{ shape: object, bevel?: number, strata?: object }} region
 */
export function reliefStyle(mask, parts, { measure, theme = "light", tokens, region }) {
  const key = JSON.stringify([region.shape, region.bevel, region.strata, parts.map((p) => [p.id, p.name, p.loc, p.hot]), theme]);
  if (reliefCache.key === key) {
    // Only the thumbnail prediction reads the colours, so new ones redo it and nothing else.
    const value = reliefCache.value;
    if (tokens && JSON.stringify(tokens) !== JSON.stringify(value.tokens)) Object.assign(value, { tokens, tone: undefined });
    return value;
  }
  const surface = reliefSurface(mask, parts, region);
  const { w, h, inside, label, dIn, light } = surface;
  const C = RELIEF.cell;
  const size = RELIEF.size;
  const cw = ADVANCE * size;
  const lh = size * RELIEF.leading;
  // A 2px margin keeps the last column's row, rounded up to whole px, on the sheet.
  const cols = Math.floor((SHEET.width - 4) / cw);
  const lines = Math.floor(SHEET.height / lh);
  const x0 = (SHEET.width - cols * cw) / 2;
  const spacing = cw - measure("M", size);
  const cellAt = (x, y) => Math.min(h - 1, Math.floor(y / C)) * w + Math.min(w - 1, Math.floor(x / C));
  const names = parts.map((p) => p.name.toLowerCase());

  // The type's strata are cut again over the glyph cells, by the same key as the shading's: glyph lines sample
  // a thin stratum (a 3px shell) unevenly, and each part must hold its share of the glyphs, not of the grid.
  const glyphCells = [];
  for (let j = 0; j < lines; j++) for (let c = 0; c < cols; c++) {
    const i = cellAt(x0 + c * cw + cw / 2, j * lh + lh / 2);
    if (inside[i]) glyphCells.push(j * cols + c);
  }
  const glyphCut = reliefCut(glyphCells, (g) => surface.key[cellAt(x0 + (g % cols) * cw + cw / 2, Math.floor(g / cols) * lh + lh / 2)], parts);
  const glyphLabel = new Map(glyphCells.map((g, k) => [g, glyphCut[k]]));

  // Runs: on each glyph line, the stretches of one part, split where the part changes. A cell whose left
  // neighbour is another part holds a tone mark and never a letter, so no two names touch across a seam.
  const runs = [];
  for (let j = 0; j < lines; j++) {
    const y = j * lh + lh / 2;
    let run = null;
    for (let c = 0; c < cols; c++) {
      const i = cellAt(x0 + c * cw + cw / 2, y);
      const pi = glyphLabel.get(j * cols + c) ?? -1;
      if (run && pi === run.part) {
        run.cells.push(i);
        continue;
      }
      if (run) runs.push(run);
      run = pi < 0 ? null : { line: j, c0: c, part: pi, cells: [i], seam: runs.length > 0 && runs[runs.length - 1].line === j && runs[runs.length - 1].c0 + runs[runs.length - 1].cells.length === c };
    }
    if (run) runs.push(run);
  }
  // Every word is whole: a run packs as many whole names as fit, set in from its start by a share of its slack
  // that changes line to line, and the cells no whole name fills take tone marks. So the strata's edges stay
  // clean and no fragment of a name is ever set.
  const usable = (r) => r.cells.length - (r.seam ? 1 : 0);
  // A part whose runs are all shorter than its name, as across a thin diagonal stratum, borrows the cells it
  // lacks from the stratum beside it on one line: one local step in a seam, where keeping every name whole by
  // stepping would step every seam.
  parts.forEach((p, pi) => {
    const mine = runs.filter((r) => r.part === pi);
    const n = names[pi].length;
    if (!mine.length || mine.some((r) => usable(r) >= n)) return;
    {
      const options = mine.flatMap((r) => {
        const at = runs.indexOf(r);
        const [prev, next] = [runs[at - 1], runs[at + 1]];
        const lack = n - usable(r);
        return [
          r.seam && prev?.line === r.line && prev.cells.length - lack >= 2 ? [{ r, from: prev, lack, left: prev.cells.length - lack }] : [],
          next?.seam && next.line === r.line && next.cells.length - lack >= 2 ? [{ r, from: next, lack, left: next.cells.length - lack }] : [],
        ].flat();
      });
      const pick = options.sort((a, b) => a.lack - b.lack || b.left - a.left)[0];
      if (!pick) return;
      const own = pick.r;
      if (pick.from.c0 > own.c0) {
        own.cells.push(...pick.from.cells.splice(0, pick.lack));
        pick.from.c0 += pick.lack;
      } else {
        own.cells.unshift(...pick.from.cells.splice(-pick.lack));
        own.c0 -= pick.lack;
      }
    }
  });
  for (const run of runs) {
    const cycle = names[run.part].length + 2;
    run.names = Math.max(0, Math.floor((usable(run) + 2) / cycle));
    const slack = usable(run) - (run.names * cycle - 2);
    run.start = (run.seam ? 1 : 0) + (run.names ? (run.line * RELIEF.phase) % (slack + 1) : 0);
  }

  const rows = [];
  for (const run of runs) {
    const part = parts[run.part];
    const name = names[run.part];
    const spans = [];
    let text = "";
    run.cells.forEach((i, k) => {
      const b = light[i];
      const v = reliefInk(b, dIn[i]);
      const at = k - run.start;
      const p = at >= 0 && at < run.names * (name.length + 2) - 2 ? at % (name.length + 2) : -1;
      const ch = reliefGlyph(name[p] ?? " ", p < 0 || p >= name.length, v);
      text += ch;
      const look = reliefLook(v, b, part.hot, theme);
      const last = spans[spans.length - 1];
      if (last && (ch === " " || (last.alpha === look.alpha && last.weight === look.weight && last.tone === look.tone))) last.text += ch;
      else spans.push({ text: ch, ...look });
    });
    if (!text.trim()) continue;
    rows.push({
      x: x0 + run.c0 * cw, y: run.line * lh, width: run.cells.length * cw, height: lh, lineHeight: lh, size, text, spacing,
      weight: 400, part: part.id, word: part.name, hot: part.hot, tone: part.hot ? "hot" : "ink", spans,
    });
  }

  const tones = RELIEF_TONES[theme];
  const ground = [];
  if (tones.shadow) {
    const { at, ...look } = tones.shadow;
    const short = Math.min(mask.box.right - mask.box.left, mask.box.bottom - mask.box.top);
    const [dx, dy] = at.map((f) => Math.round((f * short) / C));
    const cast = new Uint8Array(w * h);
    for (let i = 0; i < cast.length; i++) {
      const [x, y] = [i % w - dx, Math.floor(i / w) - dy];
      if (!inside[i] && x >= 0 && y >= 0 && x < w && y < h && inside[y * w + x]) cast[i] = 1;
    }
    ground.push({ part: null, hot: false, rows: reliefRuns(cast, w, h, C), ...look });
  }
  const hi = parts.findIndex((p) => p.hot);
  // The underlay: the shading itself in a few soft steps under the glyphs, so the form carries at thumbnail
  // size where 6px type alone is a grey haze.
  // A haze of light would wash the accent out, but a body must run under it too.
  const { levels, from, to, blur, tone } = tones.underlay;
  const step = new Int8Array(w * h).fill(-1);
  for (let i = 0; i < step.length; i++) {
    if (!inside[i] || (label[i] === hi && !from)) continue;
    const v = reliefInk(light[i], dIn[i]);
    step[i] = Math.max(0, Math.min(levels, Math.round(((v - 0.3) / 0.7) * levels)));
  }
  // Steps side by side would show a hairline of paper where their antialiased edges meet, so each layer covers
  // every cell at least as dense as its step, and its alpha brings the stack to that step's target.
  const target = (k) => from + ((to - from) * k) / levels;
  const order = Array.from({ length: levels + 1 }, (_, k) => k).filter((k) => target(k) > 0).sort((a, b) => target(a) - target(b));
  let below = 0;
  for (const k of order) {
    const alpha = Math.round((1 - (1 - target(k)) / (1 - below)) * 1000) / 1000;
    const on = step.map((s) => (s >= 0 && target(s) >= target(k) ? 1 : 0));
    // A body's outer layer is the mask's own spans, so its outline is smooth and not the grid's 2px steps.
    const whole = from > 0 && k === order[0];
    const rows = whole ? mask.runs.map((s, y) => [y, s]).filter(([, s]) => s.length) : reliefRuns(on, w, h, C).map(([y, spans]) => [y, intersectRuns(spans, mask.runs[y])]).filter(([, s]) => s.length);
    ground.push({ part: null, hot: false, tone, rows, alpha, blur });
    below = target(k);
  }
  if (hi >= 0) {
    const hot = label.map((l) => (l === hi ? 1 : 0));
    ground.push({ part: parts[hi].id, hot: true, tone: "hot", rows: reliefRuns(reliefGrow(hot, w, h, tones.glow.spread, C), w, h, C), alpha: tones.glow.alpha, blur: tones.glow.blur });
    if (tones.accent) {
      // The stratum itself, on the mask's own edge where it meets the outline, then its shading in a few steps.
      const clip = (on) => reliefRuns(on, w, h, C).map(([y, spans]) => [y, intersectRuns(spans, mask.runs[y])]).filter(([, sp]) => sp.length);
      ground.push({ part: parts[hi].id, hot: true, tone: "hot", rows: clip(hot) });
      for (const [below, alpha] of tones.accent.shade) {
        const dim = hot.map((on, i) => (on && reliefInk(light[i], dIn[i]) < below ? 1 : 0));
        if (dim.some((b) => b)) ground.push({ part: null, hot: false, tone: tones.underlay.tone, rows: clip(dim), alpha, blur: 2 });
      }
    }
  }
  const value = { strata: reliefStrataOf(surface, parts, rows), rows, ground, surface, tokens };
  value.findings = (drawn) => reliefFindings(value, parts, drawn, mask, region);
  value.ascii = (x, y) => {
    const i = cellAt(x, y);
    if (!inside[i]) return null;
    return label[i] === hi ? "@" : " ·:-=+*#"[Math.min(7, Math.floor(reliefInk(light[i], 99) * 8))];
  };
  // The thumbnail prediction is only for the sketch and the checks, so the page never pays for it.
  value.summary = () => {
    value.tone ??= reliefTone(value, mask, value.tokens);
    return reliefSummary(value, region);
  };
  value.picture = () => reliefPicture(value);
  Object.assign(reliefCache, { key, value });
  return value;
}

/** Each part's stratum in numbers: its share of the cells, its thickness, its glyph cells and whole names. */
function reliefStrataOf({ w, h, label }, parts, rows) {
  const C = RELIEF.cell;
  const total = parts.reduce((s, p) => s + p.loc, 0) || 1;
  const all = label.reduce((s, l) => s + (l >= 0 ? 1 : 0), 0) || 1;
  return parts.map((part, pi) => {
    const mine = label.map((l) => (l === pi ? 1 : 0));
    const cells = mine.reduce((s, b) => s + b, 0);
    // Only the accent's thickness is checked, and a distance field per part is the slow step.
    const thick = part.hot ? 2 * reliefDistance(mine, w, h, C).reduce((m, d, i) => (mine[i] && d > m ? d : m), 0) : 0;
    const name = part.name.toLowerCase();
    const glyphs = rows.filter((r) => r.part === part.id).reduce((s, r) => s + r.text.length, 0);
    const whole = rows.filter((r) => r.part === part.id).reduce((s, r) => s + r.text.split(name).length - 1, 0);
    return { part, lines: part.loc / total, area: cells / all, thick: Math.round(thick), glyphs, whole };
  });
}

/**
 * The thumbnail the poster will make, predicted from the rows and the ground and composited in the page's order:
 * paper, each ground (blurred like the page's), then the letters. Each glyph cell lays its look's ink cover over
 * its area. Returns RGB per pixel at 1/`scale` of the sheet.
 */
export function reliefThumb(value, tokens, scale = 3) {
  const [W, H] = [Math.ceil(SHEET.width / scale), Math.ceil(SHEET.height / scale)];
  const rgb = new Float32Array(W * H * 3);
  const paper = reliefHex(tokens.paper);
  for (let i = 0; i < W * H; i++) rgb.set(paper, i * 3);
  const cw = ADVANCE * RELIEF.size;
  const lay = (x, y, wd, ht, a, into) => {
    for (let py = Math.max(0, Math.floor(y / scale)); py < Math.min(H, Math.ceil((y + ht) / scale)); py++) {
      const oy = Math.min(y + ht, (py + 1) * scale) - Math.max(y, py * scale);
      for (let px = Math.max(0, Math.floor(x / scale)); px < Math.min(W, Math.ceil((x + wd) / scale)); px++) {
        const ox = Math.min(x + wd, (px + 1) * scale) - Math.max(x, px * scale);
        if (ox > 0 && oy > 0) into[py * W + px] += (a * ox * oy) / (scale * scale);
      }
    }
  };
  const over = (cover, tone) => {
    const c = reliefHex(tokens[tone]);
    for (let i = 0; i < W * H; i++) {
      const a = Math.min(1, cover[i]);
      if (a > 0) for (let k = 0; k < 3; k++) rgb[i * 3 + k] = rgb[i * 3 + k] * (1 - a) + c[k] * a;
    }
  };
  for (const g of value.ground) {
    const cover = new Float32Array(W * H);
    for (const [y, spans] of g.rows) for (const [l, r] of spans) lay(l, y, r - l, 1, 1, cover);
    // Three box passes of radius r spread like a Gaussian of sigma about r + 0.5.
    reliefBlur(cover, W, H, Math.round(Math.max(0, (g.blur ?? 0) / scale - 0.5)));
    over(cover.map((v) => v * (g.alpha ?? 1)), g.tone);
  }
  const letters = {};
  for (const r of value.rows) {
    let k = 0;
    for (const s of r.spans) {
      for (const ch of s.text) {
        const cover = ch === " " ? 0 : RELIEF_COVER[ch === "·" ? "dot" : ch === ":" ? "colon" : "letter"][s.weight === 700 ? 1 : 0];
        if (cover) lay(r.x + k * cw, r.y, cw, r.height, cover * s.alpha * RELIEF_GAIN, (letters[s.tone] ??= new Float32Array(W * H)));
        k++;
      }
    }
  }
  for (const [tone, cover] of Object.entries(letters)) over(cover, tone);
  return { w: W, h: H, rgb };
}

const reliefHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** A box blur of radius r, three passes (near Gaussian), in place, by running sums with the edges held. */
function reliefBlur(a, w, h, r) {
  if (r < 1) return;
  const line = new Float64Array(Math.max(w, h));
  const run = (len, at, step) => {
    for (let q = 0; q < len; q++) line[q] = a[at + q * step];
    let s = line[0] * (r + 1);
    for (let k = 1; k <= r; k++) s += line[Math.min(len - 1, k)];
    for (let q = 0; q < len; q++) {
      a[at + q * step] = s / (2 * r + 1);
      s += line[Math.min(len - 1, q + r + 1)] - line[Math.max(0, q - r)];
    }
  };
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) run(w, y * w, 1);
    for (let x = 0; x < w; x++) run(h, x, w);
  }
}

/**
 * The shape's pixels of the predicted thumbnail as contrast with the paper (0 is paper, 1 is as far from it as
 * the ink is, by luminance), and from that how lit the form looks: on the dark sheet the light is the contrast,
 * on paper the body is dark and its light is what it gives back. `lit` is the light's 90th percentile, how bright
 * the lit side gets; `spread` its 10th to 90th, how much volume the shading shows.
 */
export function reliefTone(value, mask, tokens, scale = 3) {
  const t = reliefThumb(value, tokens, scale);
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const [lp, li] = [lum(...reliefHex(tokens.paper)), lum(...reliefHex(tokens.ink))];
  const vals = [];
  for (let py = 0; py < t.h; py++) {
    const row = mask.runs[Math.min(SHEET.height - 1, Math.floor((py + 0.5) * scale))];
    for (let px = 0; px < t.w; px++) {
      const x = (px + 0.5) * scale;
      const i = (py * t.w + px) * 3;
      if (row.some(([l, r]) => x >= l && x < r)) vals.push(Math.min(1, Math.abs(lum(t.rgb[i], t.rgb[i + 1], t.rgb[i + 2]) - lp) / Math.abs(li - lp)));
    }
  }
  vals.sort((a, b) => a - b);
  const q = (f) => vals[Math.min(vals.length - 1, Math.floor(f * vals.length))] ?? 0;
  const lit = lp < li ? q(0.9) : 1 - q(0.1);
  return { mean: vals.reduce((s, v) => s + v, 0) / (vals.length || 1), lit, spread: q(0.9) - q(0.1), p10: q(0.1), p90: q(0.9) };
}

const reliefPct = (n) => `${(Math.round(n * 1000) / 10).toFixed(1)}%`;

/** The sketch's lines for a relief: how it is lit and the predicted thumbnail's tone, then each stratum. */
function reliefSummary(value, region) {
  const st = region.strata?.by === "depth" ? "by depth, outline in" : `at ${region.strata?.angle ?? 90} degrees`;
  const t = value.tone;
  return [
    `relief: bevel ${region.bevel ?? RELIEF.bevel} (${Math.round(value.surface.R)}px rounded), strata ${st}; thumbnail lit side ${reliefPct(t.lit)} (needs ${reliefPct(RELIEF.tone.lit)}), spread ${reliefPct(t.spread)} (needs ${reliefPct(RELIEF.tone.spread)})`,
    "strata, in tree order (* the accent; ASCII tones ·:-=+*# from dark to lit, @ the accent):",
    ...value.strata.map((s) => `  ${s.part.hot ? "*" : " "} ${s.part.name.toLowerCase().padEnd(24)} ${reliefPct(s.area)} of the area for ${reliefPct(s.lines)} of the lines, ${s.glyphs} glyph cells, whole name ${s.whole}x${s.part.hot ? `, ${s.thick}px thick` : ""}`),
  ];
}

/** The predicted thumbnail as RGB bytes at a third of the sheet. */
const reliefPicture = (value) => Uint8Array.from(reliefThumb(value, value.tokens).rgb, (v) => Math.round(v));

/** The relief's own findings, by check id; `drawn` are the rows as drawn, each { part, text, width }. */
function reliefFindings(value, parts, drawn, mask, region) {
  const out = { "shape-accent": [], "shape-name": [], "shape-share": [], "shape-tone": [] };
  const strata = value.strata;
  const L = RELIEF;
  const hot = strata.find((s) => s.part.hot);
  if (hot && hot.thick < L.accent) {
    out["shape-accent"].push(
      `the accent stratum "${hot.part.name}" is ${hot.thick}px thick at its thickest; it needs ${L.accent}px to show in the thumbnail, so turn the strata (strata.angle) to cut across the shape's narrow side, use strata by depth, scale the shape up, or put the accent on a bigger part`,
    );
  }
  const cw = ADVANCE * L.size;
  for (const p of parts) {
    const name = p.name.toLowerCase();
    const mine = drawn.filter((r) => r.part === p.id);
    if (mine.some((r) => (r.text ?? "").includes(name))) continue;
    const widest = Math.round(Math.max(0, ...mine.map((r) => r.width)));
    const need = Math.ceil(name.length * cw);
    out["shape-name"].push(`part "${p.name}" never shows its whole name: its stratum's widest run of type is ${widest}px and the name needs ${need}px; widen the shape where the stratum falls, turn the strata (strata.angle) so it crosses the shape's long side, or give the part a shorter name`);
  }
  const total = parts.reduce((s, p) => s + p.loc, 0) || 1;
  const counts = parts.map((p) => drawn.filter((r) => r.part === p.id).reduce((s, r) => s + (r.text ?? "").length, 0));
  const all = counts.reduce((s, n) => s + n, 0) || 1;
  parts.forEach((p, i) => {
    const [want, got] = [(100 * p.loc) / total, (100 * counts[i]) / all];
    if (Math.abs(got - want) > Math.max(L.share.points, want * L.share.part)) {
      out["shape-share"].push(`"${p.name}" has ${got.toFixed(1)}% of the relief's glyphs for ${want.toFixed(1)}% of the lines; its stratum is cut off by the sheet edge or too thin across the glyph lines, so keep the shape on the sheet or turn the strata (strata.angle)`);
    }
  });
  // An accent stratum over half the shape holds the tone in its own flat fill whatever the hints do (on the Got
  // bone at 95%, bevel 0.3 to 1 moved the spread 8.6% to 9.7%); shape-dominant names the fix, so tone waits.
  if (strata.filter((s) => s.part.hot).reduce((n, s) => n + s.area, 0) > 0.5) return out;
  value.tone ??= reliefTone(value, mask, value.tokens);
  const tone = value.tone;
  const bevel = region.bevel ?? L.bevel;
  const faces = new Set(region.shape.ops.filter((o) => o.add !== undefined && o.face).map((o) => o.face));
  // What moves the numbers, measured on the bone and the jar: one-sided faces flatten the form, a bevel under the
  // default flattens its top (0.3 to 0.7 moved the bone's spread 28.9% to 37.1%, 0.7 to 1 by 0.1 points).
  const lever =
    faces.size === 1
      ? `every face is ${[...faces][0]}, which turns the whole form one way: give one add the other face, or drop the faces`
      : bevel < L.bevel
        ? `raise bevel (it is ${bevel}) to ${L.bevel} or more, so the form rounds toward the light`
        : `its ${Math.round(value.surface.R)}px of rounding is too shallow to shade at this size: draw it fatter, or fold it with a crease along its length`;
  if (tone.lit < L.tone.lit) {
    out["shape-tone"].push(`at thumbnail size the relief's lit side reaches ${reliefPct(tone.lit)} light (90th percentile); it needs ${reliefPct(L.tone.lit)} to read as a bright object, so ${faces.has("dim") ? "turn a dim face to lit or drop its face" : lever}`);
  }
  if (tone.spread < L.tone.spread) {
    out["shape-tone"].push(`at thumbnail size the relief's tones span ${reliefPct(tone.spread)} (10th to 90th percentile); it needs ${reliefPct(L.tone.spread)} to read as a volume, so ${lever}`);
  }
  return out;
}

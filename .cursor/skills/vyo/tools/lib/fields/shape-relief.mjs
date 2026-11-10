// The relief style of the shape field: the silhouette as a lit, sculpted volume set in dense 6px type. The mask's
// distance field gives a rounded height, strata split it among the parts by lines, and a light from the top left
// shades every glyph cell; each part's name repeats in its own stratum, the accent bold in the accent over a glow.
// Pure, like shape.mjs: the page inlines it and `vyo sketch` runs it in Node. Its top-level names all start with
// relief or RELIEF, because the page concatenates the field modules into one scope.
import { SHEET, ADVANCE } from "../geometry.mjs";
import { maskGrid, opRings, opKind, paintRows } from "../mask.mjs";

// size, leading: the glyph grid. cell: the px of the height field. fold: a crease's half width and depth. bevel: the default share of the shape's
// inscribed radius that is rounded. pillow: the px each stratum rounds off its seams. rim: px inside the outline
// that never fade. light: toward the light, x right, y down, z up. accent, tone: the floors the findings hold.
export const RELIEF = {
  size: 6, leading: 1.04, cell: 2, bevel: 0.7, pillow: 12, fold: 14, rim: 5, light: [-0.62, -0.78, 0.75], phase: 7,
  accent: 40, share: { points: 0.6, part: 0.2 },
  tone: { bright: 0.26, spread: 0.3 },
};
// Per theme: the field's own token (a deep cool ink for the shadow side on paper), the glow under the accent and
// the shadow the form casts down and right.
export const RELIEF_TONES = {
  light: { tokens: { shade: "#2A3446" }, glow: { spread: 10, blur: 14, alpha: 0.55 }, shadow: { tone: "shade", alpha: 0.16, blur: 12, at: [0.035, 0.05] }, underlay: { tone: "shade", levels: 4, alpha: 0.22, blur: 3 } },
  dark: { tokens: {}, glow: { spread: 12, blur: 18, alpha: 0.6 }, shadow: null, underlay: { tone: "ink", levels: 4, alpha: 0.22, blur: 3 } },
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

/** Strata: each inside cell to one part, in tree order along the strata direction, area by lines of code. */
function reliefStrata(inside, dIn, parts, strata, w) {
  const by = strata?.by ?? "angle";
  const a = ((strata?.angle ?? 90) * Math.PI) / 180;
  const [ca, sa] = [Math.cos(a), Math.sin(a)];
  const cells = [];
  const key = new Float64Array(inside.length);
  for (let i = 0; i < inside.length; i++) {
    if (!inside[i]) continue;
    const [x, y] = [i % w, Math.floor(i / w)];
    key[i] = by === "depth" ? dIn[i] + 0.001 * (x * ca + y * sa) : x * ca + y * sa + 1e-4 * (y * ca - x * sa);
    cells.push(i);
  }
  cells.sort((i, j) => key[i] - key[j]);
  const label = new Int16Array(inside.length).fill(-1);
  const total = parts.reduce((s, p) => s + p.loc, 0) || 1;
  let [acc, k] = [0, 0];
  parts.forEach((p, pi) => {
    acc += p.loc;
    const end = pi === parts.length - 1 ? cells.length : Math.round((acc / total) * cells.length);
    for (; k < end; k++) label[cells[k]] = pi;
  });
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
  const label = reliefStrata(inside, dIn, parts, region.strata, w);
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
  return { w, h, inside, label, dIn, light, R };
}

/**
 * Ink density of a cell, 0 to 1, the rim held up. On the dark sheet ink is light, so a flat top sits above
 * the middle and the lit side runs to full ink. On paper the shadow side is the ink, and the lit side keeps
 * enough grey to stay a surface and not the paper.
 */
function reliefInk(b, dIn, theme) {
  const v = theme === "dark" ? 0.62 + 1.9 * (b - 0.5) : 0.42 + 1.9 * (0.5 - b);
  const floor = theme === "dark" ? 0.08 : 0.16;
  return Math.max(dIn < RELIEF.rim ? 0.8 : floor, Math.min(1, v));
}

/** What a cell draws: a letter of its part's name, a tone mark between names, or nothing. */
function reliefGlyph(ch, gap, v) {
  if (!gap) return ch;
  return v < 0.3 ? " " : v < 0.65 ? "·" : ":";
}

/** A cell's look: its alpha in tenths, weight and colour token. */
function reliefLook(v, b, hot, theme) {
  if (hot) return { alpha: Math.round(10 * (theme === "dark" ? 0.6 + 0.4 * b : 0.82 + 0.18 * v)) / 10, weight: 700, tone: "hot" };
  const alpha = Math.round(10 * (0.24 + 0.76 * Math.pow(v, 1.1))) / 10;
  const tone = theme === "light" && v > 0.6 ? "shade" : "ink";
  return { alpha, weight: v > 0.45 ? 700 : 400, tone };
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
export function reliefStyle(mask, parts, { measure, theme = "light" }, region) {
  const key = JSON.stringify([region.shape, region.bevel, region.strata, parts.map((p) => [p.id, p.name, p.loc, p.hot]), theme]);
  if (reliefCache.key === key) return reliefCache.value;
  const surface = reliefSurface(mask, parts, region);
  const { w, h, inside, label, dIn, light } = surface;
  const C = RELIEF.cell;
  const size = RELIEF.size;
  const cw = ADVANCE * size;
  const lh = size * RELIEF.leading;
  const cols = Math.floor(SHEET.width / cw);
  const lines = Math.floor(SHEET.height / lh);
  const x0 = (SHEET.width - cols * cw) / 2;
  const spacing = cw - measure("M", size);
  const cellAt = (x, y) => Math.min(h - 1, Math.floor(y / C)) * w + Math.min(w - 1, Math.floor(x / C));
  const names = parts.map((p) => p.name.toLowerCase());

  // Runs: on each glyph line, the stretches of one part, split where the part changes. A cell whose left
  // neighbour is another part stays blank, so a seam is a clean groove and no two names touch.
  const runs = [];
  for (let j = 0; j < lines; j++) {
    const y = j * lh + lh / 2;
    let run = null;
    for (let c = 0; c < cols; c++) {
      const i = cellAt(x0 + c * cw + cw / 2, y);
      const pi = inside[i] ? label[i] : -1;
      if (run && pi === run.part) {
        run.cells.push(i);
        continue;
      }
      if (run) runs.push(run);
      run = pi < 0 ? null : { line: j, c0: c, part: pi, cells: [i], seam: runs.length > 0 && runs[runs.length - 1].line === j && runs[runs.length - 1].c0 + runs[runs.length - 1].cells.length === c };
    }
    if (run) runs.push(run);
  }
  const cycle = (pi) => names[pi].length + 2;
  const phaseOf = (run) => (k) => (run.c0 + k + run.line * RELIEF.phase) % cycle(run.part);
  for (const run of runs) run.phase = phaseOf(run);
  const wholeIn = (run) => {
    const n = names[run.part].length;
    const from = run.seam ? 1 : 0;
    let count = 0;
    for (let k = from; k + n <= run.cells.length; k++) if (run.phase(k) === 0) count++;
    return count;
  };
  parts.forEach((p, pi) => {
    const mine = runs.filter((r) => r.part === pi);
    if (!mine.length || mine.some((r) => wholeIn(r) > 0)) return;
    const longest = mine.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
    const from = longest.seam ? 1 : 0;
    const start = from + Math.floor((longest.cells.length - from - names[pi].length) / 2);
    if (start < from) return;
    longest.phase = (k) => (((k - start) % cycle(pi)) + cycle(pi)) % cycle(pi);
  });

  const rows = [];
  for (const run of runs) {
    const part = parts[run.part];
    const name = names[run.part];
    const spans = [];
    let text = "";
    run.cells.forEach((i, k) => {
      const b = light[i];
      const v = reliefInk(b, dIn[i], theme);
      const p = run.phase(k);
      const ch = run.seam && k === 0 ? " " : reliefGlyph(name[p] ?? " ", p >= name.length, v);
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
  const { levels, alpha, blur, tone } = tones.underlay;
  const step = new Uint8Array(w * h);
  for (let i = 0; i < step.length; i++) {
    if (!inside[i] || label[i] === hi) continue;
    const v = reliefInk(light[i], dIn[i], theme);
    step[i] = Math.max(0, Math.min(levels, Math.round(((v - 0.3) / 0.7) * levels)));
  }
  for (let k = 1; k <= levels; k++) {
    ground.push({ part: null, hot: false, tone, rows: reliefRuns(step.map((s) => (s === k ? 1 : 0)), w, h, C), alpha: Math.round((alpha * k * 100) / levels) / 100, blur });
  }
  if (hi >= 0) {
    const hot = label.map((l) => (l === hi ? 1 : 0));
    ground.push({ part: parts[hi].id, hot: true, tone: "hot", rows: reliefRuns(reliefGrow(hot, w, h, tones.glow.spread, C), w, h, C), alpha: tones.glow.alpha, blur: tones.glow.blur });
  }
  const value = { strata: reliefStrataOf(surface, parts, rows), rows, ground, surface };
  value.findings = (drawn) => reliefFindings(value, parts, drawn, mask, region, theme);
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
 * The thumbnail the poster will make, predicted from the rows and the ground: per 280px pixel, ink (0 to 1)
 * against the paper and the accent's share. Each glyph cell lays its look's ink over its area.
 */
export function reliefThumb(value, scale = 3) {
  const [W, H] = [Math.ceil(SHEET.width / scale), Math.ceil(SHEET.height / scale)];
  const ink = new Float32Array(W * H);
  const hot = new Float32Array(W * H);
  const cw = ADVANCE * RELIEF.size;
  const lay = (x, y, wd, ht, a, into) => {
    for (let py = Math.floor(y / scale); py < Math.min(H, Math.ceil((y + ht) / scale)); py++) {
      const oy = Math.min(y + ht, (py + 1) * scale) - Math.max(y, py * scale);
      for (let px = Math.floor(x / scale); px < Math.min(W, Math.ceil((x + wd) / scale)); px++) {
        const ox = Math.min(x + wd, (px + 1) * scale) - Math.max(x, px * scale);
        if (ox > 0 && oy > 0) into[py * W + px] += (a * ox * oy) / (scale * scale);
      }
    }
  };
  for (const g of value.ground) {
    const into = g.hot ? hot : ink;
    for (const [y, spans] of g.rows) for (const [l, r] of spans) lay(l, y, r - l, 1, g.alpha ?? 1, into);
  }
  if (value.ground.some((g) => g.hot)) reliefBlur(hot, W, H, Math.round((RELIEF_TONES.light.glow.blur / scale) * 0.6));
  for (const r of value.rows) {
    let k = 0;
    for (const s of r.spans) {
      for (const ch of s.text) {
        const cover = ch === " " ? 0 : RELIEF_COVER[ch === "·" ? "dot" : ch === ":" ? "colon" : "letter"][s.weight === 700 ? 1 : 0];
        lay(r.x + k * cw, r.y, cw, r.height, cover * s.alpha * RELIEF_GAIN, s.tone === "hot" ? hot : ink);
        k++;
      }
    }
  }
  return { w: W, h: H, ink, hot };
}

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

/** The shape's pixels of the predicted thumbnail, as ink against the paper: their mean and their spread. */
export function reliefTone(value, mask, scale = 3) {
  const t = reliefThumb(value, scale);
  const vals = [];
  for (let py = 0; py < t.h; py++) {
    const row = mask.runs[Math.min(SHEET.height - 1, Math.floor((py + 0.5) * scale))];
    for (let px = 0; px < t.w; px++) {
      const x = (px + 0.5) * scale;
      if (row.some(([l, r]) => x >= l && x < r)) vals.push(Math.min(1, t.ink[py * t.w + px] + t.hot[py * t.w + px]));
    }
  }
  vals.sort((a, b) => a - b);
  const q = (f) => vals[Math.min(vals.length - 1, Math.floor(f * vals.length))] ?? 0;
  return { mean: vals.reduce((s, v) => s + v, 0) / (vals.length || 1), spread: q(0.9) - q(0.1), p10: q(0.1), p90: q(0.9) };
}

const reliefPct = (n) => `${(Math.round(n * 1000) / 10).toFixed(1)}%`;

/** The relief's own findings, by check id; `drawn` are the rows as drawn, each { part, text, width }. */
function reliefFindings(value, parts, drawn, mask, region, theme) {
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
  value.tone ??= reliefTone(value, mask);
  const tone = value.tone;
  const bevel = region.bevel ?? L.bevel;
  if (tone.mean < L.tone.bright) {
    out["shape-tone"].push(`at thumbnail size the relief lays ${reliefPct(tone.mean)} ink on average; it needs ${reliefPct(L.tone.bright)} to read as a ${theme === "dark" ? "bright" : "solid"} object, so drop the dim faces, raise bevel (it is ${bevel}) toward 1, or draw the shape fatter`);
  }
  if (tone.spread < L.tone.spread) {
    out["shape-tone"].push(`at thumbnail size the relief's tones span ${reliefPct(tone.spread)} (10th to 90th percentile); it needs ${reliefPct(L.tone.spread)} to read as a volume, so raise bevel (it is ${bevel}) toward 1 or add a lit and a dim face`);
  }
  return out;
}

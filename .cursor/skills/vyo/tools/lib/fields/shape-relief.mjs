// The relief style of the shape field: the silhouette as a lit volume drawn only by the density of 6px type. The
// mask's distance field gives a rounded height, strata split it among the parts by lines, and a light from the top
// left sets how strongly every glyph cell inks; each line is set word by word across the strata, the accent bold in
// the accent over a glow. Pure, like shape.mjs: the page inlines it and `vyo sketch` runs it in Node. Its top-level
// names all start with relief or RELIEF, because the page concatenates the field modules into one scope.
import { SHEET, ADVANCE } from "../geometry.mjs";
import { maskGrid, opRings, opKind, paintRows, unionRuns } from "../mask.mjs";

// size, leading: the glyph grid. cell: the px of the height field. bevel: the default share of the shape's
// inscribed radius that is rounded. pillow: the px each stratum rounds off its seams. fold: a crease's width.
// rim: px inside the outline whose ink never falls under `edge`. stretch: the contrast about the middle tone.
// light: toward the light, x right, y down, z up. phase: how far each line's names shift. look: the cells a word
// reads ahead to choose its part. shadow: the cast shadow's offset and softness, as shares of the shape's short
// side. accent, share, tone, cover: the floors the findings hold. The tone floors sit between good forms (lit 0.28
// to 0.30, spread 0.25 to 0.26 on real thumbnails of the plane and the jar) and dim ones (lit under 0.22, spread
// under 0.2). A relief is drawn by its type's density over a dot grid, so a thin form with air around it still
// reads as the picture at `cover` of the sheet. slab: the accent's share of the shape past which shape-dominant
// (DOMINANT.share in parts.mjs) speaks for the tone.
export const RELIEF = {
  size: 6, leading: 1.04, cell: 2, bevel: 0.7, pillow: 12, fold: 14, rim: 5, edge: 0.6, stretch: 1.5, light: [-0.62, -0.78, 0.75], phase: 7, look: 14,
  shadow: { at: [0.045, 0.065], soft: 0.07 },
  accent: 40, share: { points: 0.6, part: 0.2 }, slab: 0.75,
  tone: { lit: 0.25, spread: 0.22 }, cover: 0.18,
};
// Per theme: the field's own tokens, which side of the light the letters ink (the light on the dark sheet, the
// shadow on paper), the accent letters' alpha (from `from` toward 1 by the light or by the ink), the glow under
// them (and a glow on each letter, in px), and the sheet's dots (their alpha, plus `shadow` times the cast shadow).
// The glows are sheet px: twice as wide read as a haze over the strata, not light off the letters.
export const RELIEF_TONES = {
  light: { tokens: {}, letters: "shadow", hot: { from: 0.88, by: "ink" }, glow: { blur: 5, alpha: 0.4, letters: 0 }, dots: { alpha: 0.07, shadow: 0.38 } },
  dark: { tokens: {}, letters: "light", hot: { from: 0.55, by: "light" }, glow: { blur: 7, alpha: 0.55, letters: 2.5 }, dots: { alpha: 0.12, shadow: -0.12 } },
};
// Ink a glyph lays on its cell, as a share of the cell, for the thumbnail the sketch predicts.
const RELIEF_COVER = { letter: [0.2, 0.3], dot: [0.035, 0.06], colon: [0.07, 0.11] };

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

/**
 * Items sorted by key and cut into the parts in tree order, each exactly as many items as its share of the lines.
 * The cut ignores the glyph lines, so a level seam can step partway along one: the relief's strata are staggered.
 */
function reliefCut(items, keyOf, parts) {
  const order = items.map((_, k) => k).sort((p, q) => keyOf(items[p]) - keyOf(items[q]) || p - q);
  const label = new Int16Array(items.length);
  const total = parts.reduce((s, p) => s + p.loc, 0) || 1;
  let [acc, k] = [0, 0];
  parts.forEach((p, pi) => {
    acc += p.loc;
    for (const end = Math.round((acc / total) * order.length); k < end; k++) label[order[k]] = pi;
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
  for (const op of shape.ops ?? []) {
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
    const spec = Math.pow(Math.max(0, (-hx * half[0] - hy * half[1] + half[2]) / n), 60);
    const lam = nl >= flat ? 0.5 + (0.5 * (nl - flat)) / (1 - flat) : (0.5 * Math.max(0, nl)) / flat;
    light[i] = Math.min(1, lam + 0.35 * spec);
  }
  return { w, h, inside, label, key, dIn, light, R };
}

/**
 * How strongly a cell's letter shows, 0 to 1: its ink against the sheet (the light on the dark sheet, the shadow
 * on paper), contrast-stretched about the middle, the rim held up so the outline never fades.
 */
function reliefInk(b, dIn, theme) {
  const ink = RELIEF_TONES[theme].letters === "light" ? b : 1 - b;
  return Math.max(dIn < RELIEF.rim ? RELIEF.edge : 0, Math.min(1, Math.max(0, 0.5 + RELIEF.stretch * (ink - 0.5))));
}

/** What a cell draws: a letter of its word, or between repeated names a tone mark, or nothing where the ink is faint. */
function reliefGlyph(ch, gap, v) {
  if (!gap) return ch;
  return v < 0.3 ? " " : v < 0.7 ? "·" : ":";
}

/** A cell's look: its alpha in twentieths, weight and colour token, and the accent's own glow. */
function reliefLook(v, b, hot, theme) {
  const t = RELIEF_TONES[theme];
  const q = (a) => Math.round(20 * a) / 20;
  if (hot) return { alpha: q(t.hot.from + (1 - t.hot.from) * (t.hot.by === "light" ? b : v)), weight: 700, tone: "hot", ...(t.glow.letters ? { glow: t.glow.letters } : {}) };
  return { alpha: q(0.3 + 0.7 * Math.pow(v, 1.1)), weight: v > 0.42 ? 700 : 400, tone: "ink" };
}

const reliefCache = { key: null, value: null };

/**
 * The relief style: the shape drawn only by the density of its type. Each glyph line is set word by word: a word
 * runs to its end across any seam between strata and is cut only by the shape's edge, and it takes whichever
 * part under its next few cells is owed the most cells so far (error diffusion), so shares stay honest while
 * strata stagger, shear and end in part-names. A line enters the shape partway through a name. Outside the shape,
 * a faint dot grid on the sheet carries the form's cast shadow.
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
  const tones = RELIEF_TONES[theme];

  // The strata are cut again over the glyph cells, by the same key as the shading's: glyph lines sample a thin
  // stratum unevenly, and each part is owed its share of the glyphs, not of the grid.
  const glyphCells = [];
  for (let j = 0; j < lines; j++) for (let c = 0; c < cols; c++) {
    const i = cellAt(x0 + c * cw + cw / 2, j * lh + lh / 2);
    if (inside[i]) glyphCells.push(j * cols + c);
  }
  const glyphCut = reliefCut(glyphCells, (g) => surface.key[cellAt(x0 + (g % cols) * cw + cw / 2, Math.floor(g / cols) * lh + lh / 2)], parts);
  const owner = new Int16Array(lines * cols).fill(-1);
  glyphCells.forEach((g, k) => (owner[g] = glyphCut[k]));

  // Each line as its inside cells: [c, part of the word, letter index in its name + 2 gap cells].
  const set = Array.from({ length: lines }, () => []);
  const owed = new Float64Array(parts.length);
  const choose = (j, c) => {
    const cover = new Float64Array(parts.length);
    for (let k = c; k < Math.min(cols, c + RELIEF.look) && owner[j * cols + k] >= 0; k++) cover[owner[j * cols + k]]++;
    let best = -1;
    cover.forEach((n, p) => {
      if (n && (best < 0 || owed[p] + n > owed[best] + cover[best])) best = p;
    });
    return best;
  };
  for (let j = 0; j < lines; j++) {
    let [pi, k, len] = [-1, 0, 0];
    for (let c = 0; c < cols; c++) {
      const own = owner[j * cols + c];
      if (own < 0) {
        pi = -1;
        continue;
      }
      if (pi < 0 || k >= len) {
        const fresh = pi < 0;
        pi = choose(j, c);
        len = names[pi].length + 2;
        k = fresh ? (j * RELIEF.phase) % len : 0;
      }
      owed[own]++;
      owed[pi]--;
      set[j].push([c, pi, k++]);
    }
  }
  // A part that never shows its whole name, as a stratum under one glyph line can, writes it once over the
  // stretch of a line that holds most of its own cells.
  const whole = (pi) => {
    const n = names[pi].length;
    return set.some((cells) => cells.some(([c, p, k], a) => p === pi && k === 0 && cells[a + n - 1]?.[1] === pi && cells[a + n - 1][2] === n - 1 && cells[a + n - 1][0] - c === n - 1));
  };
  parts.forEach((p, pi) => {
    if (whole(pi)) return;
    const n = names[pi].length;
    let best = null;
    set.forEach((cells, j) => {
      for (let a = 0; a + n <= cells.length; a++) {
        if (cells[a + n - 1][0] - cells[a][0] !== n - 1) continue;
        let mine = 0;
        for (let b = a; b < a + n; b++) mine += owner[j * cols + cells[b][0]] === pi ? 1 : 0;
        if (mine && (!best || mine > best.mine)) best = { j, a, mine };
      }
    });
    if (best) for (let b = 0; b < n; b++) set[best.j][best.a + b] = [set[best.j][best.a + b][0], pi, b];
  });

  // Rows: on each line, the stretches of one word's part, each a set of spans by look.
  const rows = [];
  const hotCells = [];
  set.forEach((cells, j) => {
    let run = null;
    const flush = () => {
      if (run && run.text.trim()) {
        const part = parts[run.part];
        rows.push({
          x: x0 + run.c0 * cw, y: j * lh, width: run.text.length * cw, height: lh, lineHeight: lh, size, text: run.text, spacing,
          weight: 400, part: part.id, word: part.name, hot: part.hot, tone: part.hot ? "hot" : "ink", spans: run.spans,
        });
      }
      run = null;
    };
    for (const [c, pi, k] of cells) {
      if (run && (run.part !== pi || run.c0 + run.text.length !== c)) flush();
      run ??= { part: pi, c0: c, text: "", spans: [] };
      const i = cellAt(x0 + c * cw + cw / 2, j * lh + lh / 2);
      const v = reliefInk(light[i], dIn[i], theme);
      const ch = reliefGlyph(names[pi][k] ?? " ", k >= names[pi].length, v);
      const look = reliefLook(v, light[i], parts[pi].hot, theme);
      if (parts[pi].hot && ch !== " ") hotCells.push([j, c]);
      run.text += ch;
      const last = run.spans[run.spans.length - 1];
      if (last && (ch === " " || (last.alpha === look.alpha && last.weight === look.weight && last.tone === look.tone))) last.text += ch;
      else run.spans.push({ text: ch, ...look });
    }
    flush();
  });

  const ground = [];
  const hi = parts.findIndex((p) => p.hot);
  if (hotCells.length) {
    // The glow: the accent's letter cells in the accent, blurred under them.
    const byY = new Map();
    for (const [j, c] of hotCells) {
      for (let y = Math.floor(j * lh); y < Math.ceil((j + 1) * lh); y++) {
        const spans = byY.get(y) ?? [];
        const [l, r] = [x0 + c * cw, x0 + (c + 1) * cw];
        const last = spans[spans.length - 1];
        if (last && Math.abs(last[1] - l) < 0.01) last[1] = r;
        else spans.push([l, r]);
        byY.set(y, spans);
      }
    }
    const glowRows = [...byY].sort((a, b) => a[0] - b[0]).map(([y, spans]) => [y, unionRuns(spans, [])]);
    ground.push({ part: parts[hi].id, hot: true, tone: "hot", rows: glowRows, alpha: tones.glow.alpha, blur: tones.glow.blur });
  }

  // The sheet: a dot on every other glyph cell outside the shape, the cast shadow down and right of the form
  // taking dots away on the dark sheet and darkening them on paper (where it fills the skipped cells too).
  const short = Math.min(mask.box.right - mask.box.left, mask.box.bottom - mask.box.top);
  const [ox, oy, soft] = [RELIEF.shadow.at[0] * short, RELIEF.shadow.at[1] * short, RELIEF.shadow.soft * short];
  const dOut = reliefDistance(inside.map((b) => 1 - b), w, h, C);
  const shadowAt = (x, y) => {
    const [sx, sy] = [x - ox, y - oy];
    if (sx < 0 || sy < 0 || sx >= SHEET.width || sy >= SHEET.height) return 0;
    const i = cellAt(sx, sy);
    const d = inside[i] ? dIn[i] : -dOut[i];
    return Math.max(0, Math.min(1, 0.5 + d / (2 * soft)));
  };
  const sheet = [];
  for (let j = 0; j < lines; j++) {
    const y = j * lh + lh / 2;
    const spans = [];
    let text = "";
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * cw + cw / 2;
      let a = 0;
      if (!inside[cellAt(x, y)]) {
        const s = shadowAt(x, y);
        if (!((j + c) % 2 && s < 0.08)) a = Math.round(100 * (tones.dots.alpha + tones.dots.shadow * s)) / 100;
      }
      const ch = a >= 0.015 ? "·" : " ";
      text += ch;
      const last = spans[spans.length - 1];
      if (last && (ch === " " || last.alpha === a)) last.text += ch;
      else spans.push({ text: ch, alpha: ch === " " ? 0 : a, weight: 400, tone: "ink" });
    }
    sheet.push({ x: x0, y: j * lh, width: cols * cw, height: lh, lineHeight: lh, size, text, spacing, spans });
  }

  const value = { strata: reliefStrataOf(surface, parts, rows), rows, ground, sheet, surface, tokens };
  value.findings = (drawn) => reliefFindings(value, parts, drawn, mask, region, theme);
  value.ascii = (x, y) => {
    const i = cellAt(x, y);
    if (!inside[i]) return null;
    return label[i] === hi ? "@" : " ·:-=+*#"[Math.min(7, Math.floor(reliefInk(light[i], 99, "dark") * 8))];
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
        if (cover) lay(r.x + k * cw, r.y, cw, r.height, cover * s.alpha, (letters[s.tone] ??= new Float32Array(W * H)));
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
 * the ink is, by luminance). The letters are the ink on either sheet, so `lit` is the contrast's 90th percentile,
 * how strongly the form's inked side stands off the sheet (the lit side on the dark sheet, the shadow side on
 * paper); `spread` its 10th to 90th, how much volume the shading shows.
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
  return { mean: vals.reduce((s, v) => s + v, 0) / (vals.length || 1), lit: q(0.9), spread: q(0.9) - q(0.1), p10: q(0.1), p90: q(0.9) };
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
  // An accent stratum over half the shape holds the tone in its own flat fill whatever the hints do (on the Got
  // bone at 95%, bevel 0.3 to 1 moved the spread 8.6% to 9.7%; at 22% it read 37%). Past `slab` shape-dominant
  // names the fix, so tone waits; below it, tone names the accent.
  const accent = strata.filter((s) => s.part.hot).reduce((n, s) => n + s.area, 0);
  if (accent > L.slab) return out;
  value.tone ??= reliefTone(value, mask, value.tokens);
  const tone = value.tone;
  const bevel = region.bevel ?? L.bevel;
  const faces = new Set((region.shape.ops ?? []).filter((o) => o.add !== undefined && o.face).map((o) => o.face));
  // What moves the numbers, measured on the bone and the jar: one-sided faces flatten the form, a bevel under the
  // default flattens its top (0.3 to 0.7 moved the bone's spread 28.9% to 37.1%, 0.7 to 1 by 0.1 points).
  const lever =
    accent > 0.5
      ? `the accent covers ${reliefPct(accent)} of the shape and its flat fill holds the tone whatever the bevel, so put the accent on a smaller part`
      : faces.size === 1
      ? `every face is ${[...faces][0]}, which turns the whole form one way: give one add the other face, or drop the faces`
      : bevel < L.bevel
        ? `raise bevel (it is ${bevel}) to ${L.bevel} or more, so the form rounds toward the light`
        : `its ${Math.round(value.surface.R)}px of rounding is too shallow to shade at this size: draw it fatter, or fold it with a crease along its length`;
  if (tone.lit < L.tone.lit) {
    const [side, away, toward] = RELIEF_TONES[theme].letters === "light" ? ["lit", "dim", "lit"] : ["shadow", "lit", "dim"];
    out["shape-tone"].push(`at thumbnail size the relief's ${side} side reaches ${reliefPct(tone.lit)} of the ink's contrast (90th percentile); it needs ${reliefPct(L.tone.lit)} to stand off the sheet, so ${faces.has(away) ? `turn a ${away} face to ${toward} or drop its face` : lever}`);
  }
  if (tone.spread < L.tone.spread) {
    out["shape-tone"].push(`at thumbnail size the relief's tones span ${reliefPct(tone.spread)} (10th to 90th percentile); it needs ${reliefPct(L.tone.spread)} to read as a volume, so ${lever}`);
  }
  return out;
}

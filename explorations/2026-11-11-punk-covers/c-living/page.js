// One living cover, drawn into one canvas. window.frame(f, scale) draws loop frame f and returns its PNG and a
// report: each part's share of the printed glyphs, the accent's glyphs, and how often each part's name prints whole.
// The solid comes from render.mjs as a middle surface and a half thickness per cell; here it is sampled, turned,
// lit by one fixed lamp and set in the relief's 6px type.
const D = window.DATA;
const W = 840;
const H = 1190;
const M = 44;
const R = D.relief;
const CW = R.size * 0.6;
const LH = R.size * R.leading;
const COLS = Math.floor((W - 4) / CW);
const ROWS = Math.floor(H / LH);
const X0 = (W - COLS * CW) / 2;
const N = D.frames;
const DARK = D.theme === "dark";
const TONES = R.tones;
const LOOK = 14;
// The relief's glow, tightened: on a turning form a wide accent band's glow reads as a haze.
const GLOW = 0.7;

const decode = (s, T) => {
  const b = atob(s);
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return new T(u.buffer);
};
const hash = (a, b) => {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// A glyph's alpha by its ink: the relief's 0.3 to 1, with a higher floor on paper, where the lit side's letters
// are the faint ones and would otherwise wash out.
const FLOOR = DARK ? 0.3 : 0.5;
const inkAlpha = (kind, v) => (kind === "mark" ? (DARK ? 1 : 0.8) : FLOOR + (1 - FLOOR) * Math.pow(v, 1.1));
const HI = 0.86;
// The relief's contrast about the middle tone; paper takes more, or its lit side washes out at thumbnail size.
const STRETCH = DARK ? R.stretch : R.stretch * 1.35;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The solid as surface samples: position and normal in px about the form's centre, the strata key, and a material
// cell (mc, mr) about one glyph in size, so a dither decided by it rides the surface instead of flickering.
const S = (() => {
  const { w, h, cell } = D.solid;
  const inside = decode(D.solid.inside, Uint8Array);
  const half = decode(D.solid.half, Float32Array);
  const mid = decode(D.solid.mid, Float32Array);
  const key = decode(D.solid.key, Float32Array);
  let [sx, sy, n] = [0, 0, 0];
  for (let i = 0; i < inside.length; i++) if (inside[i]) [sx, sy, n] = [sx + (i % w), sy + Math.floor(i / w), n + 1];
  const [cx, cy] = [(sx / n) * cell, (sy / n) * cell];
  const front = (i) => mid[i] + half[i];
  const back = (i) => mid[i] - half[i];
  const out = { x: [], y: [], z: [], nx: [], ny: [], nz: [], key: [], mc: [], mr: [] };
  const push = (x, y, z, nx, ny, nz, k) => {
    const l = Math.hypot(nx, ny, nz) || 1;
    out.x.push(x - cx), out.y.push(y - cy), out.z.push(z);
    out.nx.push(nx / l), out.ny.push(ny / l), out.nz.push(nz / l), out.key.push(k);
    out.mc.push(Math.floor(x / CW)), out.mr.push(Math.floor(y / LH) * 2 + (nz < 0 ? 1 : 0));
  };
  for (let gy = 1; gy < h - 1; gy++) {
    for (let gx = 1; gx < w - 1; gx++) {
      const i = gy * w + gx;
      if (!inside[i]) continue;
      const [x, y] = [(gx + 0.5) * cell, (gy + 0.5) * cell];
      const fx = (front(i + 1) - front(i - 1)) / (2 * cell);
      const fy = (front(i + w) - front(i - w)) / (2 * cell);
      const bx = (back(i + 1) - back(i - 1)) / (2 * cell);
      const by = (back(i + w) - back(i - w)) / (2 * cell);
      push(x, y, front(i), -fx, -fy, 1, key[i]);
      push(x, y, back(i), bx, by, -1, key[i]);
      // The rim: where the surface is steep, fill between back and front, its normal rolling from out to up.
      const hx = (half[i + 1] - half[i - 1]) / (2 * cell);
      const hy = (half[i + w] - half[i - w]) / (2 * cell);
      const steep = Math.hypot(hx, hy);
      if (steep > 0.8 && half[i] > cell) {
        const [ox, oy] = [-hx / steep, -hy / steep];
        for (let z = back(i) + cell; z < front(i) - cell * 0.5; z += cell) {
          const u = (z - mid[i]) / half[i];
          const c = Math.sqrt(Math.max(0, 1 - u * u));
          push(x, y, z, ox * c, oy * c, u, key[i]);
        }
      }
    }
  }
  for (const k of Object.keys(out)) out[k] = Float32Array.from(out[k]);
  out.n = out.x.length;
  out.rad = 0;
  for (let j = 0; j < out.n; j++) out.rad = Math.max(out.rad, Math.hypot(out.x[j], out.y[j], out.z[j]));
  // A row's names start at the axis: the front surface along x = 0, by y, for the anchor.
  out.axis = (y) => {
    const gy = Math.round((y + cy) / cell - 0.5);
    const gx = Math.round(cx / cell - 0.5);
    const i = Math.min(h - 1, Math.max(0, gy)) * w + gx;
    return inside[i] ? front(i) : 0;
  };
  return out;
})();

const T = D.solid.turn;
const RAD = Math.PI / 180;
const FOCAL = S.rad * 5;
const LAMP = (() => {
  const l = Math.hypot(...R.light);
  return R.light.map((c) => c / l);
})();
const HALF = (() => {
  const v = [LAMP[0], LAMP[1], LAMP[2] + 1];
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
})();

/** The pose at loop time t (0 to 1): the yaw swings, the pitch swings a quarter turn behind, so the form circles. */
function pose(t) {
  const yaw = T.yaw * Math.sin(2 * Math.PI * t) * RAD;
  const pitch = T.pitch * Math.cos(2 * Math.PI * t) * RAD;
  const lean = T.lean * RAD;
  const [cy, sy, cp, sp, cl, sl] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch), Math.cos(lean), Math.sin(lean)];
  return (x, y, z) => {
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return [x1 * cl - y2 * sl, x1 * sl + y2 * cl, z2];
  };
}

let FIT = null;
function fitTo(box) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let k = 0; k < 24; k++) {
    const rot = pose(k / 24);
    for (let j = 0; j < S.n; j += 5) {
      const [x, y, z] = rot(S.x[j], S.y[j], S.z[j]);
      const f = FOCAL / (FOCAL - z);
      [x0, y0, x1, y1] = [Math.min(x0, x * f), Math.min(y0, y * f), Math.max(x1, x * f), Math.max(y1, y * f)];
    }
  }
  const s = Math.min((box.right - box.left) / (x1 - x0), (box.bottom - box.top) / (y1 - y0), D.solid.maxScale ?? 1.25);
  FIT = { s, ox: (box.left + box.right) / 2 - ((x0 + x1) / 2) * s, oy: (box.top + box.bottom) / 2 - ((y0 + y1) / 2) * s, short: Math.min(x1 - x0, y1 - y0) * s };
}

// One frame as glyph cells. Each visible cell has its nearest sample; the lamp sets its tone; the cells that print
// are cut, in strata order, into the parts by their share of the lines; each row sets its names from an anchor
// that turns with the form.
const cache = new Map();
function cells(f) {
  f = ((f % N) + N) % N;
  if (cache.has(f)) return cache.get(f);
  const t = f / N;
  const rot = pose(t);
  const n = COLS * ROWS;
  const zb = new Float32Array(n).fill(-Infinity);
  const who = new Int32Array(n).fill(-1);
  for (let j = 0; j < S.n; j++) {
    const [x, y, z] = rot(S.x[j], S.y[j], S.z[j]);
    const k = (FOCAL / (FOCAL - z)) * FIT.s;
    const c = Math.floor((FIT.ox + x * k - X0) / CW);
    const r = Math.floor((FIT.oy + y * k) / LH);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
    const i = r * COLS + c;
    if (z > zb[i]) [zb[i], who[i]] = [z, j];
  }
  const flat = LAMP[2];
  const look = [];
  for (let i = 0; i < n; i++) {
    const j = who[i];
    if (j < 0) continue;
    const [nx, ny, nz] = rot(S.nx[j], S.ny[j], S.nz[j]);
    const nl = nx * LAMP[0] + ny * LAMP[1] + nz * LAMP[2];
    const spec = Math.pow(Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]), 60);
    const lam = nl >= flat ? 0.5 + (0.5 * (nl - flat)) / (1 - flat) : (0.5 * Math.max(0, nl)) / flat;
    const b = Math.min(1, lam + 0.35 * spec);
    const ink = DARK ? b : 1 - b;
    const v = Math.min(1, Math.max(0, 0.5 + STRETCH * (ink - 0.5)));
    // A face turning away from the viewer fades toward the ground, but holds enough ink to keep the silhouette:
    // the turn never goes edge-on, so the far side proper never shows.
    const fade = 0.45 + 0.55 * smooth(-0.25, 0.25, nz);
    const d = hash(S.mc[j], S.mr[j]);
    let kind = "letter";
    if (b > HI) {
      // Lit faces give their letters up to bold marks, and only the brightest cells thin out: a glint, which a
      // wider thinning on a dark ground reads as a hole.
      if (d > 1 - 0.9 * smooth(HI, 0.97, b)) {
        kind = "mark";
        if (d > 1 - 0.3 * smooth(0.95, 1, b)) continue;
      }
    }
    const strength = inkAlpha(kind, v) * fade;
    if (strength < 0.14 && d > strength / 0.14) continue;
    look.push({ i, j, b, v, kind, fade, d });
  }
  // The strata: the printed cells in key order, cut into the parts. Each row is then set word by word, as the
  // relief sets it: a word runs to its end across a seam and belongs to the part that owns most of its next cells.
  // That choice is local, so a word keeps its part from frame to frame (error diffusion along the rows, as the relief
  // does it, flipped about a tenth of the cells every frame: one changed cell changes every word after it). Whole
  // words at the seams then trade parts until each part prints its share of the lines. The row's first word starts
  // at its anchor, the screen column of the form's axis at the row's height, so the names ride the turn and never
  // squeeze.
  const byKey = look.map((_, n) => n).sort((a, b) => S.key[look[a].j] - S.key[look[b].j] || look[a].i - look[b].i);
  const rows = [];
  for (let a = 0; a < look.length; ) {
    const r = Math.floor(look[a].i / COLS);
    let e = a;
    while (e < look.length && Math.floor(look[e].i / COLS) === r) e++;
    const list = look.slice(a, e);
    const ys = list.map((c) => S.y[c.j]).sort((p, q) => p - q);
    const my = ys[ys.length >> 1];
    const [x, , z] = rot(0, my, S.axis(my));
    rows.push({ r, list, anchor: Math.round((FIT.ox + x * (FOCAL / (FOCAL - z)) * FIT.s - X0) / CW) });
    a = e;
  }
  const P = D.parts.length;
  const cut = (target) => {
    let [acc, k] = [0, 0];
    target.forEach((share, pi) => {
      acc += share;
      for (const end = pi === P - 1 ? look.length : Math.round(acc * look.length); k < end; k++) look[byKey[k]].own = pi;
    });
  };
  let words = [];
  const set = () => {
    const counts = new Float64Array(P);
    words = [];
    for (const { r, list, anchor } of rows) {
      let [pi, q, len, word] = [-1, 0, 0, null];
      list.forEach((c, b) => {
        const col = c.i % COLS;
        const joined = b > 0 && list[b - 1].i % COLS === col - 1;
        if (!joined || q >= len) {
          const cover = new Float64Array(P);
          for (let e = b; e < list.length && e - b < LOOK && list[e].i % COLS === col + e - b; e++) cover[list[e].own]++;
          pi = 0;
          for (let p = 1; p < P; p++) if (cover[p] > cover[pi]) pi = p;
          len = D.parts[pi].name.length + 2;
          q = joined ? 0 : (((col - anchor + r * R.phase) % len) + len) % len;
          word = { part: pi, q0: q, cells: [], own: new Float64Array(P) };
          words.push(word);
        }
        c.part = pi;
        c.q = q++;
        word.cells.push(c);
        word.own[c.own]++;
        counts[pi]++;
      });
    }
    return counts;
  };
  cut(D.parts.map((p) => p.share));
  const counts = set();
  // A long name overruns its stratum, so whole words at the seams settle the shares: a word moves from a part over its share to one
  // under it that owns some of its cells, the word most owned by the new part first, until neither gains.
  const want = D.parts.map((p) => p.share * look.length);
  for (let guard = 0; guard < 400; guard++) {
    let best = null;
    for (const w of words) {
      const from = w.part;
      const over = counts[from] - want[from];
      if (over <= 0) continue;
      for (let p = 0; p < P; p++) {
        if (p === from || !w.own[p]) continue;
        const under = want[p] - counts[p];
        const n = w.cells.length;
        // The move must shrink the larger of the two errors.
        if (Math.max(Math.abs(over - n), Math.abs(under - n)) >= Math.max(over, under)) continue;
        const score = w.own[p] / n;
        if (!best || score > best.score) best = { w, p, score };
      }
    }
    if (!best) break;
    const { w, p } = best;
    counts[w.part] -= w.cells.length;
    counts[p] += w.cells.length;
    w.part = p;
    const len = D.parts[p].name.length + 2;
    w.cells.forEach((c, k) => {
      c.part = p;
      c.q = (w.q0 + k) % len;
    });
  }

  for (const c of look) {
    const name = D.parts[c.part].name;
    if (c.kind === "mark") c.ch = c.b > 0.96 ? (DARK ? "·" : ":") : c.b > 0.92 ? ":" : c.d < 0.5 ? "+" : "=";
    else if (c.q >= name.length) c.ch = c.v < 0.5 ? "·" : ":";
    else c.ch = name[c.q];
    c.letter = c.kind === "letter" && c.q < name.length;
  }
  const out = { cells: look };
  cache.set(f, out);
  return out;
}

function measure({ cells: list }) {
  const counts = D.parts.map(() => 0);
  const whole = D.parts.map(() => 0);
  let letters = 0;
  let run = { r: -1, c: -1, part: -1, text: "" };
  const flush = () => {
    if (run.part >= 0) whole[run.part] += run.text.split(D.parts[run.part].name).length - 1;
  };
  for (const c of list) {
    counts[c.part]++;
    if (c.letter) letters++;
    const [r, col] = [Math.floor(c.i / COLS), c.i % COLS];
    if (r !== run.r || col !== run.c + 1 || c.part !== run.part) {
      flush();
      run = { r, c: col, part: c.part, text: "" };
    }
    run.c = col;
    run.text += c.kind === "letter" ? c.ch : "\u0000";
  }
  flush();
  const total = list.length || 1;
  const shares = counts.map((x) => x / total);
  return {
    shares,
    shareGap: Math.max(...shares.map((s, i) => Math.abs(s - D.parts[i].share))),
    accentCells: counts[D.parts.findIndex((p) => p.hot)],
    whole,
    letters,
  };
}

const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const glow = document.createElement("canvas");
const gctx = glow.getContext("2d");
const GROT = '"Grot", sans-serif';
const NAME = '"Name", sans-serif';
const MONO = '"Mono", monospace';
let LAYOUT = null;

function wrap(text, font, width) {
  ctx.font = font;
  const out = [];
  let line = "";
  for (const w of text.split(" ")) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > width && line) [out[out.length], line] = [line, w];
    else line = t;
  }
  return [...out, line];
}

const SMALL = 11.5;
const LEAD = 14.5;
const NAME_SIZE = 168;

function layout() {
  const small = `500 ${SMALL}px ${GROT}`;
  const headline = wrap(D.headline, small, 230);
  const legend = wrap(D.legend, small, 330);
  const base = H - M + 4;
  const legendY = base - NAME_SIZE * 0.73 - 30 - legend.length * LEAD;
  const metaBottom = M + Math.max(3, headline.length) * LEAD;
  LAYOUT = { headline, legend, legendY, base, box: { left: M / 2, right: W - M / 2, top: metaBottom + 34, bottom: legendY - 30 } };
}

function rgba(hex, a) {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

function draw(f, scale) {
  const frame = cells(f);
  cv.width = W * scale;
  cv.height = H * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = D.colors.ground;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  const q = (a) => Math.round(20 * a) / 20;

  // The sheet: a dot on every other glyph cell off the form, the form's cast shadow (down and right of the lamp)
  // taking dots away on a dark ground and darkening them on paper.
  const occ = new Float32Array(COLS * ROWS);
  for (const c of frame.cells) occ[c.i] = 1;
  const [dx, dy] = [Math.round((0.045 * FIT.short) / CW), Math.round((0.065 * FIT.short) / LH)];
  const shadow = new Float32Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const [sr, sc] = [r - dy, c - dx];
    if (sr >= 0 && sc >= 0) shadow[r * COLS + c] = occ[sr * COLS + sc];
  }
  boxBlur(shadow, COLS, ROWS, Math.round((0.07 * FIT.short) / CW), Math.round((0.07 * FIT.short) / LH));
  ctx.font = `400 ${R.size}px ${MONO}`;
  const dots = new Map();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    if (occ[i]) continue;
    const s = shadow[i];
    if ((r + c) % 2 && s < 0.08) continue;
    const a = Math.round(100 * (TONES.dots.alpha + TONES.dots.shadow * s)) / 100;
    if (a < 0.015) continue;
    if (!dots.has(a)) dots.set(a, []);
    dots.get(a).push(i);
  }
  for (const [a, list] of dots) {
    ctx.fillStyle = rgba(D.colors.ink, a);
    for (const i of list) ctx.fillText("·", X0 + (i % COLS) * CW, Math.floor(i / COLS) * LH + LH * 0.8);
  }

  // The accent's glow: its cells, blurred under the letters.
  const hot = D.parts.findIndex((p) => p.hot);
  glow.width = cv.width;
  glow.height = cv.height;
  gctx.setTransform(scale, 0, 0, scale, 0, 0);
  gctx.fillStyle = D.colors.accent;
  for (const c of frame.cells) if (c.part === hot && c.letter) gctx.fillRect(X0 + (c.i % COLS) * CW, Math.floor(c.i / COLS) * LH, CW, LH);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = TONES.glow.alpha * GLOW * Math.min(1, Math.max(0.45, 0.15 / D.parts[hot].share));
  ctx.filter = `blur(${TONES.glow.blur * GLOW * scale}px)`;
  ctx.drawImage(glow, 0, 0);
  ctx.restore();

  const groups = new Map();
  for (const c of frame.cells) {
    const isHot = c.part === hot;
    const alpha = isHot ? q((TONES.hot.from + (1 - TONES.hot.from) * (TONES.hot.by === "light" ? c.b : c.v)) * Math.max(0.5, c.fade)) : q(inkAlpha(c.kind, c.v) * c.fade);
    const weight = isHot || c.kind === "mark" || c.v > 0.42 ? 700 : 400;
    const g = `${isHot ? 1 : 0}|${weight}|${alpha}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  }
  for (const [g, list] of groups) {
    const [isHot, weight, alpha] = g.split("|");
    ctx.font = `${weight} ${R.size}px ${MONO}`;
    ctx.fillStyle = rgba(isHot === "1" ? D.colors.accent : D.colors.ink, +alpha);
    if (isHot === "1" && TONES.glow.letters) [ctx.shadowColor, ctx.shadowBlur] = [rgba(D.colors.accent, 0.8), TONES.glow.letters * scale];
    for (const c of list) ctx.fillText(c.ch, X0 + (c.i % COLS) * CW, Math.floor(c.i / COLS) * LH + LH * 0.8);
    ctx.shadowBlur = 0;
  }
  template();
  return frame;
}

function boxBlur(f, w, h, rx, ry) {
  const tmp = new Float32Array(f.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -rx; x <= rx; x++) acc += f[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / (2 * rx + 1);
        acc += f[y * w + Math.min(w - 1, x + rx + 1)] - f[y * w + Math.max(0, x - rx)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -ry; y <= ry; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        f[y * w + x] = acc / (2 * ry + 1);
        acc += tmp[Math.min(h - 1, y + ry + 1) * w + x] - tmp[Math.max(0, y - ry) * w + x];
      }
    }
  }
}

// The template, the same on every cover: two small columns at the top (the record, the headline), the series mark
// top right, and at the foot the legend over the name in a tight grotesque.
function template() {
  ctx.fillStyle = D.colors.ink;
  ctx.font = `500 ${SMALL}px ${GROT}`;
  D.record.forEach((t, i) => ctx.fillText(t, M, M + 10 + i * LEAD));
  LAYOUT.headline.forEach((t, i) => ctx.fillText(t, M + 214, M + 10 + i * LEAD));
  ctx.textAlign = "right";
  ctx.fillText("Vyo", W - M, M + 10);
  const vw = ctx.measureText("Vyo").width;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(W - M - vw - 10, M + 0.5, 1, 12);
  ctx.globalAlpha = 1;
  ctx.fillText(D.number, W - M - vw - 20, M + 10);
  ctx.textAlign = "left";
  LAYOUT.legend.forEach((t, i) => ctx.fillText(t, M, LAYOUT.legendY + 10 + i * LEAD));
  ctx.font = `600 ${NAME_SIZE}px ${NAME}`;
  ctx.letterSpacing = `${-NAME_SIZE * 0.045}px`;
  ctx.fillText(D.name, M - NAME_SIZE * 0.05, LAYOUT.base);
  ctx.letterSpacing = "0px";
}

window.frame = (f, scale) => {
  const frame = draw(f, scale);
  const t = f / N;
  return { url: cv.toDataURL("image/png"), report: { frame: f, yaw: T.yaw * Math.sin(2 * Math.PI * t), turned: Math.abs(Math.sin(2 * Math.PI * t)), ...measure(frame) } };
};

// Glyphs that change from each frame to the next, the last to the first included: the seam must look like any other step.
window.steps = () => {
  const grid = (f) => {
    const g = new Uint16Array(COLS * ROWS);
    for (const c of cells(f).cells) g[c.i] = c.ch.charCodeAt(0) + (D.parts[c.part].hot ? 1000 : 0);
    return g;
  };
  const parts = (f) => {
    const g = new Int16Array(COLS * ROWS).fill(-1);
    for (const c of cells(f).cells) g[c.i] = c.part;
    return g;
  };
  window.flips = Array.from({ length: N }, (_, f) => {
    const [a, b] = [parts(f), parts((f + 1) % N)];
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] >= 0 && b[i] >= 0 && a[i] !== b[i]) n++;
    return n;
  });
  return Array.from({ length: N }, (_, f) => {
    const [a, b] = [grid(f), grid((f + 1) % N)];
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
    return n;
  });
};

(async () => {
  const faces = [["Mono", D.fonts.mono400, 400], ["Mono", D.fonts.mono700, 700], ["Grot", D.fonts.grot500, 500], ["Name", D.fonts.grot700, 600]];
  for (const [family, url, weight] of faces) document.fonts.add(await new FontFace(family, `url(${url})`, { weight: String(weight) }).load());
  layout();
  fitTo(LAYOUT.box);
  window.ready = true;
})().catch((e) => {
  window.failed = String(e);
  throw e;
});

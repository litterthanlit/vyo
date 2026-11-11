// The cover, drawn into one canvas. window.frame(f, scale) draws loop frame f and returns its PNG and a report:
// how far each part's share of the visible cells is from its share of the lines, how many part names read whole
// on one row, and whether the frame is a glitch frame. Everything is flat colour: ground, ink, signal.
const D = window.DATA;
const W = 840;
const H = 1190;
const M = 30;
const FS = 10.5;
const CW = FS * 0.6;
const CH = FS;
const COLS = Math.floor(W / CW);
const ROWS = Math.floor(H / CH);
const N = D.frames;
const BEATS = [18, 42, 66, 87];
const SEP = "/";

const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The silhouette as a solid: surface points { x, y, z, nx, ny, nz, oz, wall }. (0, y, oz) is the point's anchor, where
// its row of text starts: a face's names slide with the anchor as it turns but never squeeze, so a paused frame reads.
function solid() {
  const { w, h, cell, bits } = D.grid;
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && bits.charCodeAt(y * w + x) === 49;
  const cx = (w * cell) / 2;
  const cy = (h * cell) / 2;
  const pts = [];
  const push = (x, y, z, nx, ny, nz, oz, wall = false) => pts.push({ x, y, z, nx, ny, nz, oz, wall });
  if (D.solid.kind === "revolve") {
    const r = [];
    for (let y = 0; y < h; y++) {
      let m = 0;
      for (let x = 0; x < w; x++) if (inside(x, y)) m = Math.max(m, Math.abs((x + 0.5) * cell - cx));
      r.push(m);
    }
    const ring = (rad, y, ny, slope) => {
      const n = Math.max(1, Math.round((2 * Math.PI * rad) / cell));
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * k) / n;
        const l = Math.hypot(1, slope);
        push(rad * Math.sin(a), y, rad * Math.cos(a), (Math.sin(a) * (ny ? 0 : 1)) / l, ny || slope / l, (Math.cos(a) * (ny ? 0 : 1)) / l, rad);
      }
    };
    for (let y = 0; y < h; y++) {
      if (!r[y]) continue;
      const yy = (y + 0.5) * cell - cy;
      ring(r[y], yy, 0, ((r[y + 1] ?? 0) - (r[y - 1] ?? 0)) / (2 * cell));
      // A step in the profile is a flat annulus facing up or down; the first and last rows are caps.
      const next = r[y + 1] ?? 0;
      if (Math.abs(next - r[y]) > 2 * cell) for (let rad = Math.min(next, r[y]); rad < Math.max(next, r[y]); rad += cell) ring(rad, yy + cell / 2, next > r[y] ? -1 : 1, 0);
      if (!r[y - 1]) for (let rad = 0; rad < r[y]; rad += cell) ring(rad, yy - cell / 2, -1, 0);
    }
  } else {
    const depth = D.solid.depth * Math.max(w, h) * cell * 0.5;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!inside(x, y)) continue;
        const px = (x + 0.5) * cell - cx;
        const py = (y + 0.5) * cell - cy;
        push(px, py, depth, 0, 0, 1, depth);
        push(px, py, -depth, 0, 0, -1, -depth);
        let [nx, ny] = [0, 0];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!inside(x + dx, y + dy)) [nx, ny] = [nx + dx, ny + dy];
        const l = Math.hypot(nx, ny);
        if (!l) continue;
        [nx, ny] = [nx / l, ny / l];
        for (let z = -depth + cell / 2; z < depth; z += cell) push(px + (nx * cell) / 2, py + (ny * cell) / 2, z, nx, ny, 0, 0, true);
      }
    }
  }
  return pts;
}

const PTS = solid();
const T = (D.solid.tilt * Math.PI) / 180;
const L = (D.solid.lean * Math.PI) / 180;
const RAD = PTS.reduce((m, p) => Math.max(m, Math.hypot(p.x, p.y, p.z)), 0);
const F = RAD * 3.2;

function turn(p, th, n) {
  const [x, y, z] = n ? [p.nx, p.ny, p.nz] : [p.x, p.y, p.z];
  const [c, s] = [Math.cos(th), Math.sin(th)];
  const x1 = x * c + z * s;
  const z1 = -x * s + z * c;
  const y2 = y * Math.cos(T) - z1 * Math.sin(T);
  const z2 = y * Math.sin(T) + z1 * Math.cos(T);
  return [x1 * Math.cos(L) - y2 * Math.sin(L), x1 * Math.sin(L) + y2 * Math.cos(L), z2];
}

let FIT = null;
function fitTo(box) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let k = 0; k < 24; k++) {
    for (let i = 0; i < PTS.length; i += 7) {
      const [x, y, z] = turn(PTS[i], (2 * Math.PI * k) / 24);
      const f = F / (F - z);
      [x0, y0, x1, y1] = [Math.min(x0, x * f), Math.min(y0, y * f), Math.max(x1, x * f), Math.max(y1, y * f)];
    }
  }
  const s = Math.min((box.right - box.left) / (x1 - x0), (box.bottom - box.top) / (y1 - y0));
  FIT = { s, ox: (box.left + box.right) / 2 - ((x0 + x1) / 2) * s, oy: (box.top + box.bottom) / 2 - ((y0 + y1) / 2) * s };
}

// One frame of the spin as cells: for each screen cell, the nearest surface point, then among the points close to
// that depth the one nearest the cell's centre, so a face seen square on reads one letter per column.
const cache = new Map();
function cells(f) {
  f = ((f % N) + N) % N;
  if (cache.has(f)) return cache.get(f);
  const th = (2 * Math.PI * f) / N;
  const zb = new Float32Array(COLS * ROWS).fill(-Infinity);
  const proj = PTS.map((p) => {
    const [x, y, z] = turn(p, th);
    const k = F / (F - z);
    const sx = FIT.ox + x * k * FIT.s;
    const sy = FIT.oy + y * k * FIT.s;
    const c = Math.floor(sx / CW);
    const r = Math.floor(sy / CH);
    const i = c >= 0 && r >= 0 && c < COLS && r < ROWS ? r * COLS + c : -1;
    if (i >= 0 && z > zb[i]) zb[i] = z;
    return { sx, sy, z, k, i };
  });
  const best = new Int32Array(COLS * ROWS).fill(-1);
  const bd = new Float32Array(COLS * ROWS).fill(Infinity);
  const tol = MASKTOL();
  proj.forEach((q, j) => {
    if (q.i < 0 || q.z < zb[q.i] - tol) return;
    const c = q.i % COLS;
    const r = (q.i - c) / COLS;
    const d = Math.hypot(q.sx - (c + 0.5) * CW, q.sy - (r + 0.5) * CH);
    if (d < bd[q.i]) [bd[q.i], best[q.i]] = [d, j];
  });
  const grid = [];
  for (let i = 0; i < best.length; i++) {
    const j = best[i];
    if (j < 0) {
      grid.push(null);
      continue;
    }
    const p = PTS[j];
    const q = proj[j];
    const [, , nz] = turn(p, th, true);
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const [ax, , az] = turn({ x: 0, y: p.y, z: p.oz }, th);
    const anchor = Math.floor((FIT.ox + ax * (F / (F - az)) * FIT.s) / CW);
    grid.push({ wall: p.wall, z: q.z / RAD, face: nz, k: c - anchor + r * 3 });
  }
  cache.set(f, grid);
  return grid;
}
const MASKTOL = () => D.grid.cell * 2.5;

// Each part takes its share of the visible cells, top to bottom in tree order, in every frame: the legend's
// claim is about what the viewer sees, so it is cut on the final grid, glitch included.
function assign(grid) {
  const at = [];
  grid.forEach((c, i) => c && at.push(i));
  const out = new Array(grid.length).fill(null);
  let k = 0;
  let cum = 0;
  D.parts.forEach((p, part) => {
    cum += p.share;
    const end = part === D.parts.length - 1 ? at.length : Math.round(cum * at.length);
    for (; k < end; k++) out[at[k]] = { ...grid[at[k]], part };
  });
  return out;
}

// The glitch: on each beat the form slips sideways in slices, holds a dropped frame, then tears and snaps back.
function frameCells(f) {
  const beat = BEATS.find((b) => f >= b && f < b + 3);
  if (beat === undefined) return { grid: assign(cells(f)), glitch: false };
  const phase = f - beat;
  const rand = rng(D.seed * 977 + beat);
  const out = new Array(COLS * ROWS).fill(null);
  const copy = (src, r, dx) => {
    for (let c = 0; c < COLS; c++) {
      const from = c - dx;
      if (from >= 0 && from < COLS) out[r * COLS + c] = src[r * COLS + from];
    }
  };
  const rows = [];
  for (let r = 0; r < ROWS; r++) if (cells(f).slice(r * COLS, r * COLS + COLS).some(Boolean)) rows.push(r);
  const [top, bottom] = [rows[0], rows[rows.length - 1]];
  if (phase === 0) {
    const bands = Array.from({ length: 5 }, () => {
      const r0 = top + Math.floor(rand() * (bottom - top));
      return { r0, r1: r0 + 2 + Math.floor(rand() * 7), dx: Math.round((rand() < 0.5 ? -1 : 1) * (3 + rand() * 9)), from: rand() < 0.4 ? f - 8 : f };
    });
    for (let r = 0; r < ROWS; r++) {
      const b = bands.find((x) => r >= x.r0 && r < x.r1);
      copy(cells(b ? b.from : f), r, b ? b.dx : 0);
    }
  } else if (phase === 1) {
    for (let r = 0; r < ROWS; r++) copy(cells(f - 2), r, 3);
  } else {
    const cut = top + Math.floor((0.35 + rand() * 0.3) * (bottom - top));
    for (let r = 0; r < ROWS; r++) copy(r < cut ? cells(f) : cells(f + 3), r, r < cut ? 0 : -5);
  }
  return { grid: assign(out), glitch: true, phase, beat };
}

// Near cells are bold and large, far ones small. Faces carry the names; the solid's walls, and any face turned
// edge-on, carry marks, so a gap in the silhouette stays a gap of marks instead of a smear of letters.
function glyph(cell) {
  const p = D.parts[cell.part];
  const near = (cell.z + 1) / 2;
  if (cell.wall || cell.face < 0.3) return { ch: near > 0.55 ? "#" : near > 0.4 ? "+" : ":", bold: near > 0.55, size: 1, letter: false };
  const text = p.name + SEP;
  const ch = text[((cell.k % text.length) + text.length) % text.length];
  if (near > 0.6) return { ch, bold: true, size: 1.14, letter: true };
  if (near > 0.38) return { ch, bold: false, size: 1, letter: true };
  return { ch, bold: false, size: 0.8, letter: true };
}

function measure(grid) {
  const counts = D.parts.map(() => 0);
  let total = 0;
  let letters = 0;
  const lines = D.parts.map(() => []);
  for (let r = 0; r < ROWS; r++) {
    let run = "";
    let part = -1;
    const flush = () => {
      if (part >= 0 && run) lines[part].push(run);
      run = "";
    };
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r * COLS + c];
      if (cell) [counts[cell.part], total] = [counts[cell.part] + 1, total + 1];
      const g = cell && glyph(cell);
      if (!g || !g.letter || cell.part !== part) {
        flush();
        part = g && g.letter ? cell.part : -1;
      }
      if (g && g.letter) [run, letters] = [run + g.ch, letters + 1];
    }
    flush();
  }
  const readableBy = D.parts.map((p, i) => lines[i].filter((l) => l.includes(p.name)).length);
  const shares = counts.map((n) => n / total);
  return {
    shareGap: Math.max(...shares.map((s, i) => Math.abs(s - D.parts[i].share))),
    shares,
    accentCells: counts[D.parts.findIndex((p) => p.hot)],
    readableBy,
    readable: readableBy.reduce((a, b) => a + b, 0),
    readableParts: readableBy.filter(Boolean).length,
    letters,
  };
}

// The template: two columns of metadata stamped crooked at the top, the mark at the top right, the legend and
// a reversed label over a name too big for the sheet, its foot cut by the bottom edge.
const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const GROT = '"Grot", sans-serif';
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

function layout() {
  ctx.font = `900 100px ${GROT}`;
  ctx.letterSpacing = "-4.5px";
  const m = ctx.measureText(D.name);
  ctx.letterSpacing = "0px";
  const size = (100 * (W - M + 34)) / m.width;
  const cap = size * 0.72;
  const base = H + cap * 0.06;
  const nameTop = base - cap;
  const labelY = nameTop - 30;
  const legend = wrap(D.legend, `400 10.5px ${MONO}`, 330);
  const legendY = labelY - 16 - legend.length * 14;
  LAYOUT = { size, base, labelY, legend, legendY, formBox: { left: M + 10, right: W - M - 10, top: 100, bottom: legendY - 22 } };
}

function stamp(rand, glitch, draw) {
  ctx.save();
  const a = ((rand() - 0.5) * 3.2 + (glitch ? (rand() - 0.5) * 4 : 0)) * (Math.PI / 180);
  ctx.translate(glitch ? Math.round((rand() - 0.5) * 8) : 0, glitch ? Math.round((rand() - 0.5) * 4) : 0);
  draw(a);
  ctx.restore();
}

function draw(f, scale) {
  const { grid, glitch, phase, beat } = frameCells(f);
  cv.width = W * scale;
  cv.height = H * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = D.colors.ground;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // On the slip, one slice burns: a bar of ink behind its rows, the glyphs knocked out to the ground.
  const burn = new Set();
  if (glitch && phase === 0) {
    const rows = [];
    grid.forEach((c, i) => c && rows.push(Math.floor(i / COLS)));
    const r0 = rows[Math.floor(rng(D.seed + beat)() * rows.length * 0.8)];
    for (let r = r0; r < r0 + 4; r++) burn.add(r);
    const cols = [];
    grid.forEach((c, i) => c && burn.has(Math.floor(i / COLS)) && cols.push(i % COLS));
    ctx.fillStyle = D.colors.ink;
    ctx.fillRect((Math.min(...cols) - 2) * CW, r0 * CH, (Math.max(...cols) - Math.min(...cols) + 5) * CW, 4 * CH);
  }

  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    if (!cell) continue;
    const g = glyph(cell);
    if (g.ch === " ") continue;
    const c = i % COLS;
    const r = (i - c) / COLS;
    const hot = D.parts[cell.part].hot;
    ctx.fillStyle = hot ? D.colors.signal : burn.has(r) ? D.colors.ground : D.colors.ink;
    ctx.font = `${g.bold || hot ? 700 : 400} ${FS * g.size}px ${MONO}`;
    ctx.fillText(g.ch, c * CW + (CW - CW * g.size) / 2, r * CH + CH * 0.82);
  }

  const rand = rng(D.seed * 31 + (glitch ? beat * 7 + phase : 0));
  ctx.fillStyle = D.colors.ink;
  const [facts, headline] = D.meta;
  stamp(rand, glitch, (a) => {
    ctx.translate(M, M);
    ctx.rotate(a);
    ctx.font = `600 11px ${GROT}`;
    facts.forEach((t, i) => ctx.fillText(t, 0, 10 + i * 13));
  });
  stamp(rand, glitch, (a) => {
    ctx.translate(M + 190, M);
    ctx.rotate(a);
    wrap(headline, `600 11px ${GROT}`, 210).forEach((t, i) => ctx.fillText(t, 0, 10 + i * 13));
  });
  stamp(rand, glitch, (a) => {
    ctx.font = `900 13px ${GROT}`;
    const t = `VYO ${D.number}`.trim();
    const w = ctx.measureText(t).width + 14;
    ctx.translate(W - M - w, M - 3);
    ctx.rotate(a * 1.6);
    ctx.fillRect(0, 0, w, 19);
    ctx.fillStyle = D.colors.ground;
    ctx.fillText(t, 7, 14);
  });
  stamp(rand, glitch, (a) => {
    ctx.translate(M, LAYOUT.legendY);
    ctx.rotate(a * 0.5);
    ctx.font = `400 10.5px ${MONO}`;
    LAYOUT.legend.forEach((t, i) => ctx.fillText(t, 0, 10 + i * 14));
  });
  stamp(rand, glitch, (a) => {
    ctx.font = `600 11px ${GROT}`;
    const w = ctx.measureText(D.label).width + 12;
    ctx.translate(M, LAYOUT.labelY);
    ctx.rotate(a);
    ctx.fillRect(-1, -12, w, 17);
    ctx.fillStyle = D.colors.ground;
    ctx.fillText(D.label, 5, 1);
  });

  // The name, cut into a slice that slips on the beat.
  ctx.font = `900 ${LAYOUT.size}px ${GROT}`;
  ctx.letterSpacing = `${-LAYOUT.size * 0.045}px`;
  const slip = glitch && phase !== 1;
  const sliceTop = LAYOUT.base - LAYOUT.size * (0.25 + rng(beat ?? 0)() * 0.35);
  const bands = slip ? [[0, sliceTop, 0], [sliceTop, sliceTop + LAYOUT.size * 0.16, (phase === 0 ? 1 : -1) * 64], [sliceTop + LAYOUT.size * 0.16, H, 0]] : [[0, H, 0]];
  for (const [y0, y1, dx] of bands) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, W, y1 - y0);
    ctx.clip();
    ctx.fillText(D.name, M - LAYOUT.size * 0.04 + dx, LAYOUT.base);
    ctx.restore();
  }
  ctx.letterSpacing = "0px";
  return { grid, glitch };
}

window.frame = (f, scale) => {
  const { grid, glitch } = draw(f, scale);
  return { url: cv.toDataURL("image/png"), report: { frame: f, glitch, facing: Math.abs(Math.cos((2 * Math.PI * f) / N)), ...measure(grid) } };
};

// How many cells change from each frame to the next, the last to the first included: the seam must look like
// any other step.
window.steps = () =>
  Array.from({ length: N }, (_, f) => {
    const [a, b] = [frameCells(f).grid, frameCells((f + 1) % N).grid];
    let n = 0;
    for (let i = 0; i < a.length; i++) if ((a[i] && glyph(a[i]).ch) !== (b[i] && glyph(b[i]).ch)) n++;
    return n;
  });

(async () => {
  const faces = [["Mono", D.fonts.mono400, 400], ["Mono", D.fonts.mono700, 700], ["Grot", D.fonts.grot900, 900], ["Grot", D.fonts.grot600, 600]];
  for (const [family, url, weight] of faces) document.fonts.add(await new FontFace(family, `url(${url})`, { weight: String(weight) }).load());
  layout();
  fitTo(LAYOUT.formBox);
  window.ready = true;
})().catch((e) => {
  window.failed = String(e);
  throw e;
});

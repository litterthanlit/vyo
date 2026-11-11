// The cover frame's living relief: the silhouette inflated into a solid, turned on a slow ellipse under one fixed
// lamp, and set frame by frame in the relief's 6px type, each part a stratum of its own name. Ported from the
// "Living" prototype (explorations/2026-11-11-punk-covers/c-living). Pure: the page inlines it after geometry.mjs,
// silhouettes.mjs, mask.mjs and shape-relief.mjs, and `vyo sketch` and the checks run it in Node, so both draw the
// same cells. Its top-level names start with cover or COVER, because the page concatenates the modules.
import { SHEET } from "./geometry.mjs";
import { shapeMask, maskGrid, edt, opRings, opKind, paintRows } from "./mask.mjs";
import { SILHOUETTES } from "./silhouettes.mjs";
import { RELIEF, RELIEF_TONES } from "./fields/shape-relief.mjs";

// The sheet, its 44px margin and the loop: 7 seconds at 24 fps, the GIF at every other frame. cell: the solid's
// grid in px. The template: two 11.5px columns at the top (the record, then the headline at `headlineX`, wrapped
// at `headlineW`), the legend wrapped at `legendW`, and the name at `name` px with `track` em tracking. glow: the
// relief's glow, tightened, since a wide accent band's glow reads as a haze on a turning form. look: the cells a
// word reads ahead to choose its part. hi: the light past which lit letters give way to marks. still: the share of
// the turn the still sits nearest. big: the share of the lines from which a part must print its name whole in the
// still. gap: the most a part's share of the printed glyphs may stray from its share of the lines, in any frame.
export const COVER = {
  margin: 44, cell: 1.5, fps: 24, seconds: 7, gifFps: 12,
  small: 11.5, lead: 14.5, headlineX: 214, headlineW: 230, legendW: 330, name: 168, track: -0.045,
  fit: { w: 0.78, h: 0.5, cx: 0.5, cy: 0.5 },
  solid: { bevel: 0.8, depth: 1 }, turn: { yaw: 34, pitch: 12, lean: 0 },
  glow: 0.7, look: 14, still: 0.55, big: 0.02, gap: 0.01, seam: 1.05,
};
export const COVER_FRAMES = COVER.fps * COVER.seconds;

// The grounds, each with its ink and the orange. Navy, paper and charcoal are the engine's own; forest is a deep
// grey-green at the navy's depth, which answers a green cover without its saturation. floor: the least alpha a
// letter keeps. glow: how much of the relief's glow the accent takes. hi: the light past which lit letters give
// way to glint marks (1 never). fill: the alpha of a highlighter under the accent's cells, its letters then in
// ink. Paper takes a higher floor and no glint, or its lit side washes out, and a highlighter instead of a glow,
// since thin orange letters on cream average to salmon at thumbnail size.
const COVER_HI = 0.86;
export const COVER_GROUNDS = {
  navy: { ground: "#0E1424", ink: "#ECEEF2", accent: "#FF5A1F", theme: "dark", floor: 0.3, glow: 1, hi: COVER_HI },
  charcoal: { ground: "#121212", ink: "#F4F0E6", accent: "#FF5A1F", theme: "dark", floor: 0.3, glow: 1, hi: COVER_HI },
  forest: { ground: "#14281F", ink: "#E8ECE4", accent: "#FF5A1F", theme: "dark", floor: 0.3, glow: 1, hi: COVER_HI },
  paper: { ground: "#EAE8E2", ink: "#161616", accent: "#FF4F12", theme: "light", floor: 0.62, glow: 0, hi: 1, fill: 0.9 },
};

// How the strata run, by name. outline: shells from the outline in, the accent part the outer shell and the
// others inside it in tree order. down: bands top to bottom. diagonal: bands from top right to bottom left.
export const COVER_STRATA = {
  outline: { by: "depth", outline: true },
  down: { by: "angle", angle: 90 },
  diagonal: { by: "angle", angle: 135 },
};
export const coverStrataOf = (region) => (typeof region.strata === "string" ? COVER_STRATA[region.strata] : region.strata ?? COVER_STRATA.outline);

// Inter Medium's and Inter Display SemiBold's advances from space to tilde, in thousandths of an em, from the
// bundled fonts: the template's lines are wrapped by these in Node and in the page alike.
const COVER_SMALL_EM = [267, 304, 494, 639, 646, 993, 653, 313, 369, 369, 521, 667, 303, 462, 303, 370, 646, 415, 616, 627, 656, 618, 630, 571, 629, 630, 303, 315, 667, 667, 667, 527, 982, 709, 657, 733, 722, 603, 589, 748, 745, 272, 575, 688, 565, 913, 756, 767, 642, 769, 648, 646, 653, 740, 709, 1003, 701, 696, 641, 369, 370, 369, 477, 463, 337, 568, 618, 577, 618, 587, 379, 620, 602, 252, 252, 559, 252, 888, 602, 604, 618, 618, 387, 539, 340, 602, 575, 829, 557, 575, 559, 440, 346, 440, 667];
const COVER_NAME_EM = [226, 238, 449, 617, 640, 906, 634, 266, 321, 321, 513, 646, 236, 439, 236, 351, 638, 380, 586, 613, 644, 591, 606, 539, 604, 606, 236, 239, 646, 646, 646, 553, 996, 693, 643, 725, 697, 599, 572, 734, 715, 250, 553, 668, 550, 882, 720, 748, 625, 748, 644, 640, 627, 704, 688, 981, 680, 674, 627, 321, 351, 321, 455, 468, 277, 541, 587, 544, 587, 553, 349, 587, 573, 232, 233, 536, 232, 869, 573, 570, 587, 587, 356, 505, 350, 573, 540, 796, 527, 540, 508, 421, 330, 421, 646];
const coverWidth = (table, text, size, track = 0) => [...text].reduce((w, ch) => w + (table[ch.charCodeAt(0) - 32] ?? table[78]) / 1000 + track, 0) * size;

/** `text` broken into lines no wider than `width` px in the template's small type. */
export function coverWrap(text, width) {
  const out = [];
  let line = "";
  for (const w of text.split(" ")) {
    const t = line ? `${line} ${w}` : w;
    if (coverWidth(COVER_SMALL_EM, t, COVER.small) > width && line) [out[out.length], line] = [line, w];
    else line = t;
  }
  return [...out, line];
}

const COVER_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const COVER_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The record the engine writes: the day, the commit, and the line and file counts. */
export function coverRecord(product, parts) {
  const [yy, mm, dd] = product.date.split("-").map(Number);
  const day = COVER_DAYS[new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()];
  const lines = parts.reduce((s, p) => s + p.loc, 0);
  const files = parts.reduce((s, p) => s + p.files, 0);
  return [`On ${day}, ${COVER_MONTHS[mm - 1]} ${dd},`, `${product.name} stood at ${product.commit ?? "no commit"}:`, `${lines.toLocaleString("en-US")} lines in ${files} files.`];
}

/**
 * The template's blocks in sheet px, and the box the form fills: between the top columns and the legend, sized
 * to fit every pose of the loop. The name is one size on every cover, shrunk only when it would leave the sheet.
 */
export function coverTemplate({ name, headline, legend }) {
  const { margin: M, lead, legendW, headlineW } = COVER;
  const W = SHEET.width;
  const H = SHEET.height;
  const room = W - 2 * M;
  const nameSize = Math.min(COVER.name, Math.floor((COVER.name * room) / coverWidth(COVER_NAME_EM, name, COVER.name, COVER.track)));
  const headlineLines = coverWrap(headline, headlineW);
  const legendLines = coverWrap(legend, legendW);
  const base = H - M + 4;
  const legendY = base - nameSize * 0.73 - 30 - legendLines.length * lead;
  const metaBottom = M + Math.max(3, headlineLines.length) * lead;
  return {
    headline: headlineLines, legend: legendLines, legendY, base, nameSize,
    box: { left: M / 2, right: W - M / 2, top: metaBottom + 34, bottom: legendY - 30 },
  };
}

/** A box blur, in place, of radius r cells, twice over (close to a gaussian). */
function coverBlur(f, w, h, r) {
  if (r < 1) return f;
  const tmp = new Float32Array(f.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += f[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / (2 * r + 1);
        acc += f[y * w + Math.min(w - 1, x + r + 1)] - f[y * w + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        f[y * w + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
  return f;
}

/** A box blur in place with radii rx and ry, twice over. */
export function coverBoxBlur(f, w, h, rx, ry) {
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

const coverDistance = (on, w, h) => edt(Float64Array.from(on, (b) => (b ? 1e12 : 0)), w, h).map((d) => Math.sqrt(d) * COVER.cell);

/** One op painted alone on the mask's sheet, as cells; a crease along a capsule or arc is its centre line. */
function coverOpGrid(shape, op, mask) {
  const { s, tx, ty } = mask.xf;
  const [, kind] = opKind(op);
  const thin = kind === "capsule" ? { r: 1.5 / s } : kind === "arc" ? { width: 3 / s } : {};
  const runs = paintRows(opRings(shape, [{ ...op, ...thin, add: kind, cut: undefined, crease: undefined }]).map((o) => ({ ...o, cut: false })), s, tx, ty, SHEET.height);
  return maskGrid({ runs }, COVER.cell).bits;
}

/** The silhouette the cover inflates: the region's shape fitted to the solid's sheet. */
export const coverShape = (shape) => ({ ...(shape.mask !== undefined ? { mask: shape.mask } : { ops: shape.ops ?? SILHOUETTES[shape.like].ops, ...(shape.rotate ? { rotate: shape.rotate } : {}) }), fit: COVER.fit });

/**
 * The solid, on a grid of COVER.cell px: per inside cell, the middle surface `mid` and the half thickness `half`,
 * so the front is mid + half and the back mid - half. A round add inflates off the outline (a dome of radius bevel
 * times the deepest point, times `depth`); a `face` add is a plate tilted toward the lamp ("lit") or away ("dim")
 * about the fold where the faces meet; a crease is a groove on both sides. `key` orders the cells for the strata.
 */
export function coverSolid(shapeSpec, mask, solid, strata) {
  const CELL = COVER.cell;
  const g = maskGrid(mask, CELL);
  let [x0, y0, x1, y1] = [g.w, g.h, -1, -1];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.bits[y * g.w + x]) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  const pad = 2;
  [x0, y0, x1, y1] = [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const crop = (bits) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [gx, gy] = [x + x0, y + y0];
      if (gx >= 0 && gy >= 0 && gx < g.w && gy < g.h) out[y * w + x] = bits[gy * g.w + gx];
    }
    return out;
  };
  const inside = crop(g.bits);
  const dIn = coverDistance(inside, w, h);
  const face = new Int8Array(w * h);
  const crease = new Uint8Array(w * h);
  for (const op of shapeSpec.ops ?? []) {
    const [verb] = opKind(op);
    if (verb === "add" && (op.face === "lit" || op.face === "dim")) {
      const b = crop(coverOpGrid(shapeSpec, op, mask));
      for (let i = 0; i < b.length; i++) if (b[i]) face[i] = op.face === "lit" ? 1 : -1;
    } else if (verb === "add") {
      const b = crop(coverOpGrid(shapeSpec, op, mask));
      for (let i = 0; i < b.length; i++) if (b[i]) face[i] = 0;
    } else if (verb === "crease") {
      const b = crop(coverOpGrid(shapeSpec, op, mask));
      const stroke = ["capsule", "arc"].includes(op.crease);
      for (let i = 0; i < b.length; i++) {
        if (!b[i]) continue;
        const edge = !b[i - 1] || !b[i + 1] || !b[i - w] || !b[i + w];
        if (stroke || edge) crease[i] = 1;
      }
    }
  }
  let deepest = 0;
  for (let i = 0; i < dIn.length; i++) if (inside[i]) deepest = Math.max(deepest, dIn[i]);
  const R = Math.max(8, (solid.bevel ?? RELIEF.bevel) * deepest);
  const dome = (d) => {
    const t = Math.min(d / R, 1);
    return R * Math.sqrt(1 - (1 - t) * (1 - t));
  };
  const half = new Float32Array(w * h);
  for (let i = 0; i < half.length; i++) if (inside[i]) half[i] = dome(dIn[i]) * (solid.depth ?? 1);
  coverBlur(half, w, h, Math.max(1, Math.round((R * 0.18) / CELL)));
  for (let i = 0; i < half.length; i++) if (!inside[i]) half[i] = 0;

  // The fold: where a lit face meets a dim one. Each plate rises away from it, toward or away from the lamp.
  const L = RELIEF.light;
  const away = [-L[0] / Math.hypot(L[0], L[1]), -L[1] / Math.hypot(L[0], L[1])];
  const mid = new Float32Array(w * h);
  if (face.some((f) => f)) {
    let [sum, n] = [0, 0];
    for (let i = 0; i < face.length; i++) {
      if (face[i] !== 1) continue;
      if ([1, -1, w, -w].some((d) => face[i + d] === -1)) [sum, n] = [sum + ((i % w) * away[0] + Math.floor(i / w) * away[1]) * CELL, n + 1];
    }
    const fold = n ? sum / n : 0;
    const tilt = solid.tilt ?? 0.5;
    for (let i = 0; i < mid.length; i++) {
      if (!inside[i]) continue;
      const s = ((i % w) * away[0] + Math.floor(i / w) * away[1]) * CELL - fold;
      mid[i] = face[i] ? -tilt * Math.abs(s) : 0;
    }
    coverBlur(mid, w, h, 2);
  }
  if (crease.some((b) => b)) {
    const dC = coverDistance(crease.map((b) => 1 - b), w, h);
    const fold = solid.groove ?? RELIEF.fold;
    for (let i = 0; i < half.length; i++) {
      const t = Math.max(0, 1 - dC[i] / fold);
      if (inside[i]) half[i] = Math.max(half[i] * 0.4, half[i] - fold * 0.8 * t * t);
    }
  }
  const a = ((strata?.angle ?? 90) * Math.PI) / 180;
  const key = new Float32Array(w * h);
  for (let i = 0; i < key.length; i++) {
    const [x, y] = [(i % w) * CELL, Math.floor(i / w) * CELL];
    key[i] = strata?.by === "depth" ? dIn[i] + 0.001 * y : x * Math.cos(a) + y * Math.sin(a) + 1e-4 * (y * Math.cos(a) - x * Math.sin(a));
  }
  return { w, h, cell: CELL, inside, half, mid, key, R };
}

// The glyph grid, as the relief sets it: 6px Commit Mono, 0.6em advances, on the whole sheet.
const COVER_CW = RELIEF.size * 0.6;
const COVER_LH = RELIEF.size * RELIEF.leading;
export const COVER_GRID = { cw: COVER_CW, lh: COVER_LH, cols: Math.floor((SHEET.width - 4) / COVER_CW), rows: Math.floor(SHEET.height / COVER_LH) };
COVER_GRID.x0 = (SHEET.width - COVER_GRID.cols * COVER_CW) / 2;

/**
 * The solid as surface samples: position and normal in px about the form's centre, the strata key, and a
 * material cell (mc, mr) about one glyph in size, so a dither decided by it rides the surface instead of flickering.
 */
function coverSurface(solid) {
  const { w, h, cell, inside, half, mid, key } = solid;
  let [sx, sy, count] = [0, 0, 0];
  for (let i = 0; i < inside.length; i++) if (inside[i]) [sx, sy, count] = [sx + (i % w), sy + Math.floor(i / w), count + 1];
  const [cx, cy] = [(sx / count) * cell, (sy / count) * cell];
  const front = (i) => mid[i] + half[i];
  const back = (i) => mid[i] - half[i];
  // Two passes over the same samples: the first counts them, the second writes them, so ten million rim samples
  // never pass through growing arrays.
  let out = null;
  let n = 0;
  const push = (x, y, z, nx, ny, nz, k) => {
    if (out) {
      const l = Math.hypot(nx, ny, nz) || 1;
      out.x[n] = x - cx, out.y[n] = y - cy, out.z[n] = z;
      out.nx[n] = nx / l, out.ny[n] = ny / l, out.nz[n] = nz / l, out.key[n] = k;
      out.mc[n] = Math.floor(x / COVER_CW), out.mr[n] = Math.floor(y / COVER_LH) * 2 + (nz < 0 ? 1 : 0);
    }
    n++;
  };
  const sample = () => {
    n = 0;
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
  };
  sample();
  out = { x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n), key: new Float32Array(n), mc: new Float32Array(n), mr: new Float32Array(n) };
  sample();
  out.n = n;
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
}

const COVER_RAD = Math.PI / 180;

/** The pose at loop time t (0 to 1): the yaw swings and the pitch swings a quarter turn behind, so the form circles. */
export function coverPose(T, t) {
  const yaw = T.yaw * Math.sin(2 * Math.PI * t) * COVER_RAD;
  const pitch = T.pitch * Math.cos(2 * Math.PI * t) * COVER_RAD;
  const lean = T.lean * COVER_RAD;
  const [cy, sy, cp, sp, cl, sl] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch), Math.cos(lean), Math.sin(lean)];
  return (x, y, z) => {
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return [x1 * cl - y2 * sl, x1 * sl + y2 * cl, z2];
  };
}

/** The scale and offset that fit every pose of the loop inside `box`. */
function coverFit(S, T, focal, box) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let k = 0; k < 24; k++) {
    const rot = coverPose(T, k / 24);
    for (let j = 0; j < S.n; j += 5) {
      const [x, y, z] = rot(S.x[j], S.y[j], S.z[j]);
      const f = focal / (focal - z);
      [x0, y0, x1, y1] = [Math.min(x0, x * f), Math.min(y0, y * f), Math.max(x1, x * f), Math.max(y1, y * f)];
    }
  }
  const s = Math.min((box.right - box.left) / (x1 - x0), (box.bottom - box.top) / (y1 - y0), 1.25);
  return { s, ox: (box.left + box.right) / 2 - ((x0 + x1) / 2) * s, oy: (box.top + box.bottom) / 2 - ((y0 + y1) / 2) * s, short: Math.min(x1 - x0, y1 - y0) * s };
}

/**
 * A cover's model: everything a frame is drawn from. `parts` are the region's parts in tree order with `hot` set;
 * `texts` are the name, headline and legend the template wraps.
 */
export function coverModel(region, parts, { ground, texts }) {
  const G = COVER_GROUNDS[ground];
  const like = SILHOUETTES[region.shape.like] ?? {};
  const strata = coverStrataOf(region);
  const shapeSpec = coverShape(region.shape);
  const mask = shapeMask(shapeSpec);
  const solid = coverSolid(shapeSpec, mask, { ...COVER.solid, ...like.solid, ...region.solid }, strata);
  const S = coverSurface(solid);
  const turn = { ...COVER.turn, ...like.turn, ...region.turn };
  const template = coverTemplate(texts);
  const focal = S.rad * 5;
  const total = parts.reduce((s, p) => s + p.loc, 0) || 1;
  const list = parts.map((p) => ({ id: p.id, name: p.name.toLowerCase(), share: p.loc / total, hot: !!p.hot }));
  const hot = list.findIndex((p) => p.hot);
  // The order the strata take the parts in: tree order, or for an outline the accent first, as the outer shell.
  const order = list.map((_, i) => i);
  if (strata.outline && hot >= 0) order.sort((a, b) => (b === hot) - (a === hot));
  const theme = G.theme;
  const dark = theme === "dark";
  return {
    ground, colors: G, theme, dark, tones: RELIEF_TONES[theme], parts: list, hot, order, strata, solid, S, turn, focal, template,
    fit: coverFit(S, turn, focal, template.box), frames: COVER_FRAMES, cache: new Map(),
  };
}

// A glyph's alpha by its ink: the relief's 0.3 to 1, with a higher floor on paper, where the lit side's letters
// are the faint ones and would otherwise wash out.
export const coverInkAlpha = (m, kind, v) => {
  const floor = m.colors.floor;
  return kind === "mark" ? (m.dark ? 1 : 0.8) : floor + (1 - floor) * Math.pow(v, 1.1);
};
const coverSmooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const coverHash = (a, b) => {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const coverUnit = (v) => {
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
};
const COVER_LAMP = coverUnit(RELIEF.light);
const COVER_HALF = coverUnit([COVER_LAMP[0], COVER_LAMP[1], COVER_LAMP[2] + 1]);

/**
 * One frame as glyph cells. Each visible cell has its nearest sample; the lamp sets its tone; the cells that print
 * are cut, in strata order, into the parts by their share of the lines; each row sets its names from an anchor
 * that turns with the form. Each cell is { i, j, b, v, kind, fade, d, own, part, q, ch, letter }.
 */
export function coverCells(m, f) {
  const N = m.frames;
  f = ((f % N) + N) % N;
  if (m.cache.has(f)) return m.cache.get(f);
  const { S, fit: FIT, focal: FOCAL, parts: PARTS, dark: DARK } = m;
  const { cols: COLS, rows: ROWS, cw: CW, lh: LH, x0: X0 } = COVER_GRID;
  const STRETCH = DARK ? RELIEF.stretch : RELIEF.stretch * 1.35;
  const HI = m.colors.hi;
  const rot = coverPose(m.turn, f / N);
  const n = COLS * ROWS;
  const zb = new Float32Array(n).fill(-Infinity);
  const who = new Int32Array(n).fill(-1);
  // coverPose inlined, operation for operation, so the hot loop allocates nothing and rounds as the pose does.
  const t = f / N;
  const yaw = m.turn.yaw * Math.sin(2 * Math.PI * t) * COVER_RAD;
  const pitch = m.turn.pitch * Math.cos(2 * Math.PI * t) * COVER_RAD;
  const lean = m.turn.lean * COVER_RAD;
  const [cy, sy, cp, sp, cl, sl] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch), Math.cos(lean), Math.sin(lean)];
  const [SX, SY, SZ, SN] = [S.x, S.y, S.z, S.n];
  const [FS, FOX, FOY] = [FIT.s, FIT.ox, FIT.oy];
  for (let j = 0; j < SN; j++) {
    const px = SX[j];
    const py = SY[j];
    const pz = SZ[j];
    const x1 = px * cy + pz * sy;
    const z1 = -px * sy + pz * cy;
    const y2 = py * cp - z1 * sp;
    const z = py * sp + z1 * cp;
    const x = x1 * cl - y2 * sl;
    const y = x1 * sl + y2 * cl;
    const k = (FOCAL / (FOCAL - z)) * FS;
    const c = Math.floor((FOX + x * k - X0) / CW);
    const r = Math.floor((FOY + y * k) / LH);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
    const i = r * COLS + c;
    if (z > zb[i]) {
      zb[i] = z;
      who[i] = j;
    }
  }
  const flat = COVER_LAMP[2];
  const look = [];
  for (let i = 0; i < n; i++) {
    const j = who[i];
    if (j < 0) continue;
    const [nx, ny, nz] = rot(S.nx[j], S.ny[j], S.nz[j]);
    const nl = nx * COVER_LAMP[0] + ny * COVER_LAMP[1] + nz * COVER_LAMP[2];
    const spec = Math.pow(Math.max(0, nx * COVER_HALF[0] + ny * COVER_HALF[1] + nz * COVER_HALF[2]), 60);
    const lam = nl >= flat ? 0.5 + (0.5 * (nl - flat)) / (1 - flat) : (0.5 * Math.max(0, nl)) / flat;
    const b = Math.min(1, lam + 0.35 * spec);
    const ink = DARK ? b : 1 - b;
    const v = Math.min(1, Math.max(0, 0.5 + STRETCH * (ink - 0.5)));
    // A face turning away from the viewer fades toward the ground, but holds enough ink to keep the silhouette:
    // the turn never goes edge-on, so the far side proper never shows.
    const fade = 0.45 + 0.55 * coverSmooth(-0.25, 0.25, nz);
    const d = coverHash(S.mc[j], S.mr[j]);
    let kind = "letter";
    if (b > HI) {
      // Lit faces give their letters up to bold marks, and only the brightest cells thin out: a glint, which a
      // wider thinning on a dark ground reads as a hole.
      if (d > 1 - 0.9 * coverSmooth(HI, 0.97, b)) {
        kind = "mark";
        if (d > 1 - 0.3 * coverSmooth(0.95, 1, b)) continue;
      }
    }
    const strength = coverInkAlpha(m, kind, v) * fade;
    if (strength < 0.14 && d > strength / 0.14) continue;
    look.push({ i, j, b, v, kind, fade, d });
  }
  // The strata: the printed cells in key order, cut into the parts. Each row is then set word by word: a word runs
  // to its end across a seam and belongs to the part that owns most of its next cells. That choice is local, so a
  // word keeps its part from frame to frame (error diffusion along the rows flipped about a tenth of the cells
  // every frame: one changed cell changes every word after it). Whole words at the seams then trade parts until
  // each part prints its share of the lines. The row's first word starts at its anchor, the screen column of the
  // form's axis at the row's height, so the names ride the turn and never squeeze.
  const byKey = look.map((_, k) => k).sort((a, b) => S.key[look[a].j] - S.key[look[b].j] || look[a].i - look[b].i);
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
  const P = PARTS.length;
  // An outline: the accent takes the outer shell, and inside it the other parts stack in bands top to bottom.
  // Shells all the way in made every small part a ring a glyph or two thick, too thin to print its share.
  if (m.strata.outline && m.hot >= 0 && P > 1) {
    const shell = Math.round(PARTS[m.hot].share * look.length);
    const inner = byKey.slice(shell).sort((a, b) => S.y[look[a].j] - S.y[look[b].j] || S.x[look[a].j] - S.x[look[b].j] || look[a].i - look[b].i);
    byKey.splice(shell, inner.length, ...inner);
  }
  let [acc, k] = [0, 0];
  m.order.forEach((pi, at) => {
    acc += PARTS[pi].share;
    for (const end = at === P - 1 ? look.length : Math.round(acc * look.length); k < end; k++) look[byKey[k]].own = pi;
  });
  const counts = new Float64Array(P);
  const words = [];
  for (const { r, list, anchor } of rows) {
    let [pi, q, len, word] = [-1, 0, 0, null];
    list.forEach((c, b) => {
      const col = c.i % COLS;
      const joined = b > 0 && list[b - 1].i % COLS === col - 1;
      if (!joined || q >= len) {
        const cover = new Float64Array(P);
        for (let e = b; e < list.length && e - b < COVER.look && list[e].i % COLS === col + e - b; e++) cover[list[e].own]++;
        pi = 0;
        for (let p = 1; p < P; p++) if (cover[p] > cover[pi]) pi = p;
        len = PARTS[pi].name.length + 2;
        q = joined ? 0 : (((col - anchor + r * RELIEF.phase) % len) + len) % len;
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
  // A long name overruns its stratum, so whole words at the seams settle the shares: a word moves from a part over
  // its share to one under it that owns some of its cells, the word most owned by the new part first, until neither gains.
  const want = PARTS.map((p) => p.share * look.length);
  for (let guard = 0; guard < 400; guard++) {
    let best = null;
    for (const w of words) {
      const from = w.part;
      const over = counts[from] - want[from];
      if (over <= 0) continue;
      for (let p = 0; p < P; p++) {
        if (p === from || !w.own[p]) continue;
        const under = want[p] - counts[p];
        const cn = w.cells.length;
        // The move must shrink the larger of the two errors.
        if (Math.max(Math.abs(over - cn), Math.abs(under - cn)) >= Math.max(over, under)) continue;
        const score = w.own[p] / cn;
        if (!best || score > best.score) best = { w, p, score };
      }
    }
    if (!best) break;
    const { w, p } = best;
    counts[w.part] -= w.cells.length;
    counts[p] += w.cells.length;
    w.part = p;
    const len = PARTS[p].name.length + 2;
    w.cells.forEach((c, kk) => {
      c.part = p;
      c.q = (w.q0 + kk) % len;
    });
  }
  for (const c of look) {
    const name = PARTS[c.part].name;
    if (c.kind === "mark") c.ch = c.b > 0.96 ? (DARK ? "·" : ":") : c.b > 0.92 ? ":" : c.d < 0.5 ? "+" : "=";
    else if (c.q >= name.length) c.ch = c.v < 0.5 ? "·" : ":";
    else c.ch = name[c.q];
    c.letter = c.kind === "letter" && c.q < name.length;
  }
  m.cache.set(f, look);
  return look;
}

/**
 * A frame's honesty: each part's share of the printed glyphs, the worst gap to its share of the lines, the
 * accent's glyphs, how often each part's whole name prints, the letters, and the accent's outer shell in sheet px:
 * the depth into the solid at which its stratum ends, scaled to the sheet.
 */
export function coverMeasure(m, f) {
  const list = coverCells(m, f);
  const { cols: COLS } = COVER_GRID;
  const counts = m.parts.map(() => 0);
  const whole = m.parts.map(() => 0);
  let letters = 0;
  let run = { r: -1, c: -1, part: -1, text: "" };
  const flush = () => {
    if (run.part >= 0) whole[run.part] += run.text.split(m.parts[run.part].name).length - 1;
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
  const t = f / m.frames;
  return {
    frame: f,
    yaw: m.turn.yaw * Math.sin(2 * Math.PI * t),
    turned: Math.abs(Math.sin(2 * Math.PI * t)),
    shares,
    shareGap: Math.max(...shares.map((s, i) => Math.abs(s - m.parts[i].share))),
    accentCells: m.hot >= 0 ? counts[m.hot] : 0,
    whole,
    letters,
  };
}

/** The parts of COVER.big or more of the lines, by index: each must print its name whole in the still. */
export const coverBig = (m) => m.parts.map((p, i) => (p.share >= COVER.big ? i : -1)).filter((i) => i >= 0);

/**
 * The still: the frame where every big part prints its whole name, then the pose nearest COVER.still of the turn
 * (the far end shows the most volume but the least of the silhouette), then the most letters. Frames are measured
 * nearest pose first, and the search stops at the first pose band where every big name prints, which gives the
 * same frame as measuring them all.
 */
export function coverStill(m) {
  const big = coverBig(m);
  const band = (f) => Math.round(Math.abs(Math.abs(Math.sin(2 * Math.PI * (f / m.frames))) - COVER.still) * 10);
  const readable = (r) => big.filter((i) => r.whole[i] > 0).length;
  const frames = Array.from({ length: m.frames }, (_, f) => f);
  const better = (a, b) => readable(b) - readable(a) || band(a.frame) - band(b.frame) || b.letters - a.letters || a.frame - b.frame;
  for (const b of [...new Set(frames.map(band))].sort((x, y) => x - y)) {
    const full = frames.filter((f) => band(f) === b).map((f) => coverMeasure(m, f)).filter((r) => readable(r) === big.length);
    if (full.length) return full.sort(better)[0];
  }
  return frames.map((f) => coverMeasure(m, f)).sort(better)[0];
}

/** Glyphs that change from each frame to the next, the last to the first included, and the part flips among them. */
export function coverSteps(m) {
  const N = m.frames;
  const { cols, rows } = COVER_GRID;
  const grid = (f) => {
    const g = new Uint16Array(cols * rows);
    for (const c of coverCells(m, f)) g[c.i] = c.ch.charCodeAt(0) + (m.parts[c.part].hot ? 1000 : 0);
    return g;
  };
  const steps = [];
  let a = grid(0);
  for (let f = 0; f < N; f++) {
    const b = grid((f + 1) % N);
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
    steps.push(n);
    a = b;
  }
  return steps;
}

/**
 * The accent's outer shell in the still, for an outline: how deep into the solid its stratum reaches, in sheet px.
 * Null when the strata are not an outline. `at(share)` gives the depth a shell of that share would reach.
 */
export function coverShell(m, still) {
  if (!m.strata.outline || m.hot < 0) return null;
  const cells = coverCells(m, still.frame);
  const keys = cells.map((c) => m.S.key[c.j]).sort((a, b) => a - b);
  const at = (share) => keys[Math.min(keys.length - 1, Math.max(0, Math.round(share * keys.length) - 1))] * m.fit.s;
  return { px: at(m.parts[m.hot].share), share: m.parts[m.hot].share, at };
}

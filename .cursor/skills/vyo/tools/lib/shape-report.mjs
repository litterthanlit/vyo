// What goes wrong with a drawn silhouette, measured on its mask: features too thin for the thumbnail, too little
// of the sheet covered, an accent band too small to see, a name never drawn whole, a band split across separate
// pieces, a text block on the shape. `vyo sketch` prints these at the level lib/check.mjs gives each check, which render uses too;
// every message says what to change, with a number.
import { SHEET, corners, CORNERS, fixedMeasure } from "./geometry.mjs";
import { maskGrid, edt, SHAPE_ROOM, opRings, paintRows } from "./mask.mjs";
import { shapeLayout, nameWidth } from "./fields/shape.mjs";
import { regionParts, partOptions, dominance, DOMINANT } from "./parts.mjs";
import { tokensOf } from "./render.mjs";
import { FIELDS } from "./fields/index.mjs";

// A feature narrower than `thin` px is under 3px at a sixth of the size and does not read as form; a thin piece
// counts once it is `thinArea` px² (a sharp corner's tip is less). The shape should cover `cover` of the sheet;
// the accent band needs `accent` px to show in the thumbnail; text keeps `clear` px off the shape; a band's
// piece counts once it holds `piece` of the band's area; a bleed under `bleed` of the shape's extent is a mistake.
export const SHAPE_LIMITS = { thin: 18, thinArea: 324, cover: 0.35, accent: 40, clear: 16, piece: 0.1, bleed: 0.05 };
// Past `ops` adds and cuts a silhouette stops reading as one object at thumbnail size (the cold runs' 11-op
// locomotive was half legible, the 3-op flask instant); `repeat` or more ops of one kind and about one size
// (within `alike`), each under `small` of the shape, are details like wheels or windows that merge there.
export const SHAPE_SIMPLE = { ops: 8, repeat: 3, alike: 0.3, small: 0.1 };
// A limb: rows at the top or bottom of the shape under `width` of its widest row, about as wide all along (`steady`
// of them within `even` of the median, so a tapering tip is not one), taking `height` or more of the shape's height
// for at most `area` of its area. The cold run's mailbox post took 33% of the height for 10% of the area and
// read as a signpost; a flask's neck is 32% of its body's width and passes.
export const SHAPE_LIMB = { width: 0.25, even: 1.5, steady: 0.8, height: 0.25, area: 0.15 };
// Every check id the findings fill, in the order the sketch prints them.
export const SHAPE_CHECKS = ["shape-dominant", "shape-simple", "shape-limb", "shape-thin", "shape-cover", "shape-edge", "shape-accent", "shape-name", "shape-split", "shape-room", "shape-rings", "shape-upright", "shape-share", "shape-tone"];
const CELL = 2;

/** A shape region laid out in Node: its parts, mask, bands, rows and ground. */
export function shapeReport(spec, region, facts) {
  const parts = regionParts(region, facts);
  const tokens = { ...tokensOf(spec), ...FIELDS.shape.tokens(spec.theme) };
  return { region, parts, dominant: dominance(facts, partOptions(region)), ...shapeLayout(region, parts, { theme: spec.theme, measure: fixedMeasure, tokens }) };
}

/** Squared distance, in cells, from every cell to the nearest cell where `on` is false. */
const distanceTo = (on, w, h) => edt(Float64Array.from(on, (b) => (b ? 1e12 : 0)), w, h);

/** 4-connected groups of the cells where `on` is set: each its cells. */
function groups(on, w, h) {
  const seen = new Uint8Array(w * h);
  const out = [];
  for (let i = 0; i < on.length; i++) {
    if (!on[i] || seen[i]) continue;
    const cells = [i];
    seen[i] = 1;
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k];
      const [x, y] = [c % w, Math.floor(c / w)];
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const j = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && on[j] && !seen[j]) (seen[j] = 1), cells.push(j);
      }
    }
    out.push(cells);
  }
  return out;
}

/**
 * The places where the shape, or a gap cut in it, is narrower than SHAPE_LIMITS.thin: what a disc that wide
 * cannot reach (a morphological opening of the shape, and of the paper inside the shape's box). Off the sheet
 * counts as shape, so a bleed is not thin.
 * @returns {{ kind: "part" | "gap", width: number, x: number, y: number, area: number }[]}
 */
export function thinFeatures(mask) {
  const { w, h, bits } = maskGrid(mask, CELL);
  const r = SHAPE_LIMITS.thin / 2 / CELL;
  const box = { left: Math.floor(mask.box.left / CELL), right: Math.ceil(mask.box.right / CELL), top: Math.floor(mask.box.top / CELL), bottom: Math.ceil(mask.box.bottom / CELL) };
  const inBox = (i) => {
    const [x, y] = [i % w, Math.floor(i / w)];
    return x >= box.left && x < box.right && y >= box.top && y < box.bottom;
  };
  const out = [];
  for (const kind of ["part", "gap"]) {
    const on = kind === "part" ? bits : bits.map((b) => 1 - b);
    const depth = distanceTo(on, w, h);
    const core = depth.map((d) => (d >= r * r ? 0 : 1));
    const reach = distanceTo(core, w, h);
    const thin = on.map((b, i) => (b && reach[i] > r * r && (kind === "part" || inBox(i)) ? 1 : 0));
    for (const cells of groups(thin, w, h)) {
      const area = cells.length * CELL * CELL;
      if (area < SHAPE_LIMITS.thinArea) continue;
      const width = 2 * Math.sqrt(Math.max(...cells.map((c) => depth[c]))) * CELL;
      const mid = cells[Math.floor(cells.length / 2)];
      out.push({ kind, width: Math.max(CELL, Math.round(width)), x: (mid % w) * CELL, y: Math.floor(mid / w) * CELL, area });
    }
  }
  return out;
}

/** Each run of the mask with the piece of the whole shape it belongs to, by runs that touch from row to row. */
function runPieces(mask) {
  const parent = [];
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  let prev = [];
  const rows = mask.runs.map((row) => {
    const here = row.map(([l, r]) => {
      const id = parent.push(parent.length) - 1;
      for (const p of prev) if (p.l < r && p.r > l) parent[find(p.id)] = find(id);
      return { l, r, id };
    });
    prev = here;
    return here;
  });
  return rows.map((row) => row.map((run) => ({ ...run, piece: find(run.id) })));
}

/**
 * The pieces of the shape that rows y0 to y1 cross, each with its area, left and right within those rows. Two
 * spans are one piece when the shape joins them anywhere, so a cup's handle is not a piece apart from the cup.
 */
export function piecesBetween(mask, y0, y1) {
  const runs = runPieces(mask);
  const pieces = new Map();
  for (let y = y0; y < y1; y++) {
    for (const { l, r, piece } of runs[y]) {
      const q = pieces.get(piece) ?? { area: 0, left: l, right: r, top: y, bottom: y + 1 };
      pieces.set(piece, { area: q.area + r - l, left: Math.min(q.left, l), right: Math.max(q.right, r), top: q.top, bottom: y + 1 });
    }
  }
  return [...pieces.values()].sort((a, b) => b.area - a.area);
}

/** The empty corners the shape leaves, kept `clear` px off it. */
export function shapeCorners(mask) {
  const c = SHAPE_LIMITS.clear;
  return corners(mask.runs.flatMap((row, y) => row.map(([l, r]) => ({ left: l - c, top: y - c, right: r + c, bottom: y + 1 + c }))));
}

/** Does the rect come within `clear` px of the shape? */
export function onShape(mask, rect) {
  const c = SHAPE_LIMITS.clear;
  for (let y = Math.max(0, Math.floor(rect.top - c)); y < Math.min(SHEET.height, Math.ceil(rect.bottom + c)); y++) {
    if (mask.runs[y].some(([l, r]) => l < rect.right + c && r > rect.left - c)) return true;
  }
  return false;
}

const px = (n) => Math.round(n);
const share = (n) => Math.round(n * 100) / 100;
const pct = (n) => `${Math.round(n * 100)}%`;
const thinCache = { key: null, value: null };
const bandOf = (report, part) => report.bands?.find((b) => b.part.id === part.id);

/** A long, even, narrow run of rows at the top or bottom of the shape: a post or a pole that holds little of it. */
export function limbFindings(mask) {
  const L = SHAPE_LIMB;
  const widths = mask.runs.map((row) => row.reduce((a, [l, r]) => a + r - l, 0));
  const rows = widths.map((w, y) => y).filter((y) => widths[y] > 0);
  if (!rows.length) return [];
  const [top, bottom] = [rows[0], rows[rows.length - 1] + 1];
  const widest = Math.max(...widths);
  const out = [];
  for (const [end, from, step] of [["top", top, 1], ["bottom", bottom - 1, -1]]) {
    const run = [];
    for (let y = from; y >= top && y < bottom && widths[y] < L.width * widest; y += step) run.push(widths[y]);
    if (!run.length) continue;
    const median = [...run].sort((a, b) => a - b)[Math.floor(run.length / 2)];
    const [height, area] = [run.length / (bottom - top), run.reduce((a, w) => a + w, 0) / mask.area];
    if (height < L.height || area > L.area || run.filter((w) => w <= L.even * median).length < L.steady * run.length) continue;
    const [a, b] = step > 0 ? [from, from + run.length] : [from - run.length + 1, from + 1];
    out.push(`a thin limb at the ${end} (y ${a} to ${b}, ${px(median)}px wide) takes ${pct(height)} of the shape's height for ${pct(area)} of its area; at thumbnail size the object reads as a post with a small head, and its bands there are too narrow to read, so shorten it to under ${pct(L.height)} of the height or drop it`);
  }
  return out;
}

/**
 * shape-dominant: one part is most of the shape, or there are too few parts. Each case says the one action that
 * changes the picture, and a case with no such action says nothing:
 * - the biggest part has folders inside it: split it, and if it is the accent, move the accent onto one of them;
 * - the accent holds most of the lines and cannot be split: outside bands it is one slab of the accent, so a
 *   smaller accent or bands (whose type still names every part) is the fix; in bands nothing is wrong;
 * - few parts, the biggest unsplittable and not the accent alone over the line: the accent shows; nothing to do.
 */
function dominantFindings({ dominant: d, parts, region }) {
  const accents = parts.filter((p) => p.hot);
  if (!d || !accents.length) return [];
  const total = parts.reduce((s, p) => s + p.loc, 0) || 1;
  const hotShare = accents.reduce((s, p) => s + p.loc, 0) / total;
  const style = region.style ?? "bands";
  const bigIsAccent = accents.some((p) => p.id === d.part.id);
  if (d.split) {
    const add = `add "split": [${[...(region.split ?? []), d.split.id].map((id) => `"${id}"`).join(", ")}] to the region to cut "${d.part.name}" into the folders inside it (${d.split.count} parts, the largest ${pct(d.split.largest)})`;
    return bigIsAccent
      ? [`the accent "${d.part.name}" holds ${pct(d.share)} of the lines and the shape has ${parts.length} parts, so every style draws it as one slab; ${add}, then put the accent on the one the story is about (vyo parts <facts> --field shape --split ${d.split.id} lists them)`]
      : [`"${d.part.name}" holds ${pct(d.share)} of the lines and the shape has ${parts.length} parts, so it draws as one slab around the accent; ${add}; the accent stays where it is`];
  }
  if (hotShare > DOMINANT.share && style !== "bands") {
    return [`the accent "${accents.map((p) => p.name).join('", "')}" holds ${pct(hotShare)} of the lines, so ${style} draws it as one slab of the accent; "${d.part.name}" has no folders inside it to split, so put the accent on a smaller part, or set style to bands, whose type still names every part`];
  }
  return [];
}

/**
 * Every finding on a shape region, by check id. `rows` are the rows as drawn (the page's, or Node's for the
 * sketch); `blocks` are the text blocks, each `{ id, left, top, right, bottom }`.
 * @returns {Record<(typeof SHAPE_CHECKS)[number], string[]>}
 */
export function shapeFindings(report, { rows = report.rows, blocks = [] } = {}) {
  const { mask, bands = [], parts, region } = report;
  const L = SHAPE_LIMITS;
  const out = Object.fromEntries(SHAPE_CHECKS.map((id) => [id, []]));
  // A style that is not cut top to bottom judges its own depth and reading; the band checks are the bands'.
  const banded = (region.style ?? "bands") === "bands";
  // Rings' findings are fixed by the layout; relief's read the rows as drawn, so they are a function of them.
  const own = typeof report.findings === "function" ? report.findings(rows) : report.findings ?? {};
  for (const [id, messages] of Object.entries(own)) out[id].push(...messages);

  out["shape-dominant"].push(...dominantFindings(report));

  const drawn = region.shape.ops.map((op, i) => ({ op, i })).filter(({ op }) => op.crease === undefined);
  if (drawn.length > SHAPE_SIMPLE.ops) {
    out["shape-simple"].push(`the shape has ${drawn.length} ops; past ${SHAPE_SIMPLE.ops} a silhouette stops reading as one object at thumbnail size, so simplify it: one object with one telling feature, in 3 to 6 ops`);
  }
  const { s, tx, ty } = mask.xf;
  const alone = opRings(region.shape).map((o) => paintRows([{ ...o, cut: false }], s, tx, ty, SHEET.height).reduce((a, row) => a + row.reduce((n, [l, r]) => n + r - l, 0), 0) / mask.area);
  const seen = new Set();
  for (const { op, i } of drawn) {
    if (seen.has(i) || alone[i] >= SHAPE_SIMPLE.small) continue;
    const kind = op.add ?? op.cut;
    const like = drawn.filter((d) => (d.op.add ?? d.op.cut) === kind && alone[d.i] < SHAPE_SIMPLE.small && Math.abs(alone[d.i] - alone[i]) <= SHAPE_SIMPLE.alike * alone[i]);
    if (like.length < SHAPE_SIMPLE.repeat) continue;
    like.forEach((d) => seen.add(d.i));
    out["shape-simple"].push(`ops ${like.map((d) => d.i).join(", ")} are ${like.length} ${kind}s of about ${pct(alone[i])} of the shape each: small repeated details like wheels or windows merge at thumbnail size, so drop them or draw them as one shape`);
  }

  out["shape-limb"].push(...limbFindings(mask));

  // Every shape check asks for these findings; the opening is the slow part and depends on the shape alone.
  const key = JSON.stringify(region.shape);
  if (thinCache.key !== key) Object.assign(thinCache, { key, value: thinFeatures(mask) });
  for (const t of thinCache.value) {
    out["shape-thin"].push(
      t.kind === "part"
        ? `the shape is ${t.width}px thick near ${t.x},${t.y}; under ${L.thin}px it is a hairline at thumbnail size, so make that feature at least ${L.thin}px thick or remove it`
        : `a cut in the shape is ${t.width}px wide near ${t.x},${t.y}; under ${L.thin}px it closes up at thumbnail size, so widen the cut to at least ${L.thin}px or remove it`,
    );
  }

  const fit = region.shape.fit ?? {};
  const sized = fit.w !== undefined || fit.h !== undefined;
  const cover = mask.area / (SHEET.width * SHEET.height);
  if (cover < L.cover) {
    // A little over the bare ratio, so the suggested fit clears the floor after rounding.
    const k = Math.sqrt(L.cover / cover) * 1.02;
    const by = fit.w !== undefined && fit.h === undefined ? "w" : "h";
    const [now, next] = [share(mask.fit[by]), share(mask.fit[by] * k)];
    const [w, h] = [px(mask.box.right - mask.box.left), px(mask.box.bottom - mask.box.top)];
    const say = `the shape covers ${pct(cover)} of the sheet; it needs ${pct(L.cover)} to read as the picture, so `;
    out["shape-cover"].push(
      sized && next > now && mask.fit.w * k <= 1 && mask.fit.h * k <= 1
        ? `${say}scale it up ${share(k)}x (set fit.${by} to ${next}, it is ${now}) or draw it fatter`
        : `${say}draw it fatter: it fills ${pct(mask.area / (w * h))} of its ${w} by ${h}px box${sized ? "" : ", already as large as the room the text leaves"}; thicken its thin parts or make it closer to as tall as it is wide`,
    );
  }

  // A deliberate bleed runs well off the sheet; a sliver off one edge reads as a mistake.
  const { width: W, height: H } = SHEET;
  const b = mask.box;
  for (const [edge, over, extent, key, sign] of [["left", -b.left, b.right - b.left, "cx", 1], ["right", b.right - W, b.right - b.left, "cx", -1], ["top", -b.top, b.bottom - b.top, "cy", 1], ["bottom", b.bottom - H, b.bottom - b.top, "cy", -1]]) {
    if (over <= 0.5 || over >= L.bleed * extent) continue;
    const size = key === "cx" ? W : H;
    const centre = key === "cx" ? (b.left + b.right) / 2 / W : (b.top + b.bottom) / 2 / H;
    const move = Math.ceil(over) + SHAPE_ROOM.bottom;
    out["shape-edge"].push(
      `the shape runs ${Math.ceil(over)}px off the ${edge} edge, too little to read as a bleed, so it looks cut by mistake; ${sized ? `leave out fit.w and fit.h to fit it inside the sheet, or move it ${move}px ${sign > 0 ? (key === "cx" ? "right" : "down") : key === "cx" ? "left" : "up"} (fit.${key} ${share(centre)} to ${share(centre + (sign * move) / size)})` : `move fit.${key} back toward the middle`}, or bleed it boldly, by a fifth of the shape or more`,
    );
  }

  const hot = !banded ? null : bands.filter((b) => b.part.hot).sort((a, b) => b.y1 - b.y0 - (a.y1 - a.y0))[0];
  if (hot && hot.y1 - hot.y0 < L.accent) {
    const h = hot.y1 - hot.y0;
    out["shape-accent"].push(`the accent band "${hot.part.name}" is ${h}px tall (y ${hot.y0} to ${hot.y1}); it needs ${L.accent}px to show in the thumbnail, so scale the shape up ${share(L.accent / h)}x, narrow it where the band falls, or put the accent on a bigger part`);
  }

  for (const p of parts) {
    const name = p.name.toLowerCase();
    const mine = rows.filter((r) => r.part === p.id);
    if (mine.some((r) => (r.text ?? "").includes(name))) continue;
    const b = bandOf(report, p);
    if (!b) continue;
    if (!banded) {
      out["shape-name"].push(`part "${p.name}" never shows its whole name: ${b.missing}`);
      continue;
    }
    const need = Math.ceil(nameWidth(name, b.size));
    const widest = px(Math.max(0, ...mine.map((r) => r.width)));
    out["shape-name"].push(`part "${p.name}" never shows its whole name: its band (y ${b.y0} to ${b.y1}) holds ${widest}px of ${b.size.toFixed(1)}px type and the name needs ${need}px; widen the shape there to at least ${need}px or give the part a shorter name`);
  }

  for (const b of banded ? bands : []) {
    const pieces = piecesBetween(mask, b.y0, b.y1);
    const total = pieces.reduce((s, q) => s + q.area, 0);
    const big = pieces.filter((q) => q.area >= L.piece * total);
    if (big.length < 2) continue;
    const at = big.map((q) => `x ${px(q.left)} to ${px(q.right)}`).join(" and ");
    out["shape-split"].push(`the band of "${b.part.name}" (y ${b.y0} to ${b.y1}) falls on ${big.length} separate pieces of the shape, at ${at}; join them there, or move one piece up or down by ${b.y1 - b.y0}px so they do not share those rows`);
  }

  const free = shapeCorners(mask);
  const roomy = CORNERS.map((n) => ({ n, ...free[n] })).sort((a, b) => b.w * b.h - a.w * a.h)[0];
  for (const t of blocks) {
    if (!onShape(mask, t)) continue;
    const [w, h] = [px(t.right - t.left), px(t.bottom - t.top)];
    const fits = roomy.w >= w && roomy.h >= h;
    out["shape-room"].push(
      `the ${t.id} (${w} by ${h} at ${px(t.left)},${px(t.top)}) sits on the shape or within ${L.clear}px of it; ${
        fits
          ? `move it into the ${roomy.n} corner, ${roomy.w} by ${roomy.h} at ${roomy.x},${roomy.y}`
          : `no corner holds it (the largest, ${roomy.n}, is ${roomy.w} by ${roomy.h}), so shrink the shape (fit.h ${share(mask.fit.h)} to ${share(mask.fit.h * 0.85)}) or move it with fit.cx and fit.cy`
      }`,
    );
  }
  return out;
}

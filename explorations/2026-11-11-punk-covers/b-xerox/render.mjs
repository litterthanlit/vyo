// Xerox covers. Usage: node render.mjs <config.json>... [--series] [--out <dir>] [--keep-frames]
// Per config: out/<id>.png (840x1190 at 2x, the still), <id>-thumb.png (280 wide), <id>.mp4 and <id>.gif (560 wide,
// a seamless loop). With --series: out/series.png, series.mp4 and series.gif, the covers in a row moving together.
// Node builds the model (parts, mask, cells, the shading class of every cell on every key, the timeline) and checks
// it; page.js only paints it and runs the copier. Prints the checks; a line starting with "✗" fails the run.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { partsFromFacts, accentIds } from "../../../.cursor/skills/vyo/tools/lib/parts.mjs";
import { shapeMask, edt } from "../../../.cursor/skills/vyo/tools/lib/mask.mjs";
import "../../../.cursor/skills/vyo/tools/lib/png-mask.mjs";
import { decodePng } from "../../../.cursor/skills/vyo/tools/lib/png.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VYO_FONTS = path.join(HERE, "../../../.cursor/skills/vyo/fonts");
const { chromium } = createRequire(import.meta.url)("playwright");

const W = 840;
const H = 1190;
const MARGIN = 28;
const CELL = { w: 7, h: 11 };
const FPS = 10;
// Stop motion on twos: each key holds for 2 frames.
const HOLD = 2;
const FORM_TOP = 118;

// The loop, one entry per key. gen: copier generations away from the master (0 is the clean master). slip: how far
// the pasted strips wander, in px. spot: the spot plate's misregistration in px. The snap is the clean, registered
// key the worst copy jumps back to; the still is the key the PNG is cut from.
const TIMELINE = [
  { gen: 0, slip: 3, spot: 3 },
  { gen: 0, slip: 4, spot: 4 },
  { gen: 0, slip: 3, spot: 2 },
  { gen: 1, slip: 6, spot: 5, still: true },
  { gen: 1, slip: 8, spot: 7 },
  { gen: 2, slip: 10, spot: 9 },
  { gen: 2, slip: 12, spot: 8 },
  { gen: 3, slip: 14, spot: 11 },
  { gen: 3, slip: 16, spot: 12 },
  { gen: 4, slip: 18, spot: 14 },
  { gen: 4, slip: 20, spot: 12 },
  { gen: 0, slip: 0, spot: 0, snap: true },
  { gen: 0, slip: 0, spot: 0, snap: true },
  { gen: 0, slip: 2, spot: 3 },
  { gen: 0, slip: 3, spot: 2 },
  { gen: 0, slip: 2, spot: 4 },
];

// Shading classes, from the lit side to the dark side. A cell's class decides what it prints.
const CLASSES = ["blank", "dot", "symbol", "letter", "bold", "solid"];
const PRINTS_LETTER = new Set(["letter", "bold"]);

const hash = (...n) => {
  let h = 2166136261;
  for (const v of n) {
    h = Math.imul(h ^ (v | 0), 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

function fail(msg) {
  throw new Error(msg);
}

function loadConfig(file) {
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  const dir = path.dirname(file);
  const need = ["id", "facts", "product", "headline", "legend", "accent", "names", "ground", "ink", "spot", "shape", "archive", "commit", "date"];
  const missing = need.filter((k) => cfg[k] === undefined);
  if (missing.length) fail(`${file}: missing ${missing.join(", ")}`);
  for (const k of ["ground", "ink", "spot"]) if (!/^#[0-9a-f]{6}$/i.test(cfg[k])) fail(`${file}: ${k} must be #rrggbb`);
  // A mask is a bundled name ("wings") or a PNG path, relative to the config.
  if (cfg.shape.mask?.endsWith(".png")) cfg.shape.mask = path.resolve(dir, cfg.shape.mask);
  cfg.facts = path.resolve(dir, cfg.facts);
  return cfg;
}

/** The parts, each with its plain name, share and whether it is the accent. */
function partsOf(cfg, facts) {
  const parts = partsFromFacts(facts, { names: cfg.names, maxParts: cfg.maxParts ?? 12, split: cfg.split ?? [] });
  const hot = accentIds(parts, cfg.accent);
  if (hot.size !== 1) fail(`accent "${cfg.accent}" must name exactly one part (parts: ${parts.map((p) => p.id).join(", ")})`);
  const unnamed = parts.filter((p) => !cfg.names[p.id]).map((p) => p.id);
  if (unnamed.length) fail(`names missing for ${unnamed.join(", ")}`);
  const total = parts.reduce((s, p) => s + p.loc, 0);
  return parts.map((p) => ({ id: p.id, name: cfg.names[p.id], loc: p.loc, files: p.files, share: p.loc / total, hot: hot.has(p.id) }));
}

/** The silhouette fitted into the form box: as wide as the box allows unless that makes it too tall. */
function fitMask(shape, box) {
  const cx = (box.left + box.right) / 2 / W;
  const cy = (box.top + box.bottom) / 2 / H;
  const wide = shapeMask({ ...shape, fit: { w: (box.right - box.left) / W, cx, cy } });
  if (!wide) fail("the shape paints nothing");
  if (wide.box.bottom - wide.box.top <= box.bottom - box.top) return wide;
  return shapeMask({ ...shape, fit: { h: (box.bottom - box.top) / H, cx, cy } });
}

const inside = (runs, x, y) => (runs[Math.floor(y)] ?? []).some(([l, r]) => x >= l && x < r);

/**
 * Height of the lit volume at every 2px of the sheet: a rounded rim `bevel` px wide, flat on top. From the mask's
 * distance to its outline, so any silhouette, drawn or traced, gets the same relief.
 */
function heightField(mask, bevel) {
  const S = 2;
  const gw = Math.ceil(W / S);
  const gh = Math.ceil(H / S);
  const f = new Float64Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) f[y * gw + x] = inside(mask.runs, x * S + 1, y * S + 1) ? 1e20 : 0;
  edt(f, gw, gh);
  const hgt = new Float64Array(gw * gh);
  for (let i = 0; i < f.length; i++) {
    const t = Math.min(1, (Math.sqrt(f[i]) * S) / bevel);
    hgt[i] = Math.sqrt(1 - (1 - t) * (1 - t));
  }
  const at = (x, y) => hgt[Math.min(gh - 1, Math.max(0, Math.round(y / S))) * gw + Math.min(gw - 1, Math.max(0, Math.round(x / S)))];
  return (x, y) => {
    const d = 4;
    const gx = (at(x + d, y) - at(x - d, y)) / (2 * d);
    const gy = (at(x, y + d) - at(x, y - d)) / (2 * d);
    const k = bevel * 0.55;
    const n = [-gx * k, -gy * k, 1];
    const l = Math.hypot(...n);
    return n.map((v) => v / l);
  };
}

/**
 * Every cell of the form: which part it belongs to and its letter. Cells inside the silhouette are ordered across
 * the sheet along `strata` degrees and dealt to the parts in tree order, each as many cells as its share of the
 * lines (largest remainder), so each part's area is its share. Each row's run of one part spells its name, repeated.
 */
function cellsOf(mask, parts, cfg) {
  const cols = Math.floor((W - 2 * MARGIN) / CELL.w);
  const x0 = (W - cols * CELL.w) / 2;
  const cells = [];
  for (let r = 0; r * CELL.h + FORM_TOP < H; r++)
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * CELL.w + CELL.w / 2;
      const y = FORM_TOP + r * CELL.h + CELL.h / 2;
      if (inside(mask.runs, x, y)) cells.push({ c, r, x, y });
    }
  const a = ((cfg.strata ?? 120) * Math.PI) / 180;
  const order = [...cells].sort((p, q) => p.x * Math.cos(a) + p.y * Math.sin(a) - (q.x * Math.cos(a) + q.y * Math.sin(a)));
  const exact = parts.map((p) => p.share * cells.length);
  const counts = exact.map(Math.floor);
  const byRemainder = exact.map((e, i) => [e - Math.floor(e), i]).sort((p, q) => q[0] - p[0]);
  const short = cells.length - counts.reduce((s, n) => s + n, 0);
  for (let k = 0; k < short; k++) counts[byRemainder[k][1]]++;
  let i = 0;
  counts.forEach((n, p) => order.slice(i, (i += n)).forEach((cell) => (cell.part = p)));
  // Letters: each row's run of one part spells its name from a staggered start, so names never stack in columns.
  const rows = new Map();
  for (const cell of cells) (rows.get(cell.r) ?? rows.set(cell.r, []).get(cell.r)).push(cell);
  for (const [r, row] of rows) {
    row.sort((p, q) => p.c - q.c);
    let start = 0;
    for (let k = 1; k <= row.length; k++) {
      const breaks = k === row.length || row[k].part !== row[start].part || row[k].c !== row[k - 1].c + 1;
      if (!breaks) continue;
      const text = `${parts[row[start].part].name} / `;
      // A short run spells the name from its first letter, so the name fits whole; a long one starts anywhere.
      const off = k - start < 3 * text.length ? 0 : Math.floor(hash(r, start, cfg.seed ?? 1) * text.length);
      for (let j = start; j < k; j++) {
        row[j].ch = text[(j - start + off) % text.length];
        row[j].wordStart = (j - start + off) % text.length === 0;
      }
      start = k;
    }
  }
  return { cells, rows, cols, x0, counts };
}

/** The light for a key: swinging around the top left like a hand lamp, back where it started when the loop ends. */
function lightAt(key, keys, swing) {
  const az = ((-135 + swing * Math.sin((2 * Math.PI * key) / keys)) * Math.PI) / 180;
  const el = (38 * Math.PI) / 180;
  return [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
}

/**
 * The class of every cell under one light: how far its face turns toward the light from the flat top's. Dark ink
 * on a light ground prints the shadows; light ink on a dark ground prints the light, so `lightInk` turns it over.
 */
function classesFor(cells, normal, L, lightInk) {
  return cells.map((cell) => {
    const n = normal(cell.x, cell.y);
    const lit = n[0] * L[0] + n[1] * L[1] + n[2] * L[2] - L[2];
    const s = (lightInk ? -lit : lit) + (BAYER[(cell.r % 4) * 4 + (cell.c % 4)] - 0.5) * 0.16;
    if (s > 0.42) return 0;
    if (s > 0.3) return 1;
    if (s > 0.17) return 2;
    if (s > -0.13) return 3;
    if (s > -0.27) return 4;
    return 5;
  });
}

/** Every place a part's whole name fits in one unbroken run of its cells: [part, cell indexes]. */
function nameSlots(model) {
  const index = new Map(model.cells.map((c, i) => [c, i]));
  const slots = [];
  for (const row of model.rows.values())
    for (let j = 0; j < row.length; j++) {
      if (!row[j].wordStart) continue;
      const name = model.parts[row[j].part].name;
      if (j + name.length > row.length) continue;
      const span = row.slice(j, j + name.length);
      if (span.every((cell, k) => cell.part === row[j].part && cell.c === row[j].c + k)) slots.push([row[j].part, span.map((c) => index.get(c))]);
    }
  return slots;
}

const printsWhole = (model, classes, [part, span]) => span.every((i, k) => model.parts[part].name[k] === " " || PRINTS_LETTER.has(CLASSES[classes[i]]));

/**
 * The legend promises every part by name, so a part whose name the light hides everywhere (a thin stem, a lit
 * shoulder) gets one slot printed in letters regardless: the one nearest its middle. Mutates `classes`.
 */
function labelHiddenParts(model, slots, classes) {
  for (const [p] of model.parts.entries()) {
    const mine = slots.filter(([part]) => part === p);
    if (!mine.length || mine.some((s) => printsWhole(model, classes, s))) continue;
    const cells = model.cells.filter((c) => c.part === p);
    const my = cells.reduce((s, c) => s + c.r, 0) / cells.length;
    const [, span] = mine.sort((a, b) => Math.abs(model.cells[a[1][0]].r - my) - Math.abs(model.cells[b[1][0]].r - my))[0];
    for (const i of span) classes[i] = classes[i] === 5 ? 4 : Math.max(3, classes[i]);
  }
  return classes;
}

/** Per part, how many times its whole name prints in letters under these classes. */
function legibleNames(model, slots, classes) {
  const seen = new Array(model.parts.length).fill(0);
  for (const slot of slots) if (printsWhole(model, classes, slot)) seen[slot[0]]++;
  return seen;
}

/** Where each pasted strip is cut: at cell-row boundaries, so a slip never halves a line of type. */
function stripsOf(seed) {
  const cuts = [FORM_TOP];
  while (cuts.at(-1) < H) cuts.push(Math.min(H, cuts.at(-1) + CELL.h * (3 + Math.floor(hash(seed, cuts.length) * 9))));
  return cuts.slice(0, -1).map((y, i) => [y, cuts[i + 1]]);
}

function timelineFor(seed, strips) {
  return TIMELINE.map((k, i) => {
    const sign = (n) => (hash(seed, i, n) < 0.5 ? -1 : 1);
    const slips = strips.map((_, s) => {
      const moved = hash(seed, i, s, 7) < (k.gen ? 0.55 : 0.25);
      return moved ? Math.round(sign(s) * k.slip * (0.4 + 0.6 * hash(seed, i, s, 9))) : 0;
    });
    const spot = k.spot ? [Math.round(sign(91) * k.spot * (0.5 + 0.5 * hash(seed, i, 92))), Math.round(sign(93) * k.spot * 0.6 * hash(seed, i, 94))] : [0, 0];
    return { ...k, slips, spotOffset: spot };
  });
}

function buildModel(cfg) {
  const facts = JSON.parse(fs.readFileSync(cfg.facts, "utf8"));
  const parts = partsOf(cfg, facts);
  const accent = parts.findIndex((p) => p.hot);
  const name = parts[accent].name;
  if (!cfg.legend.toLowerCase().includes(name.toLowerCase())) fail(`legend must name the accent part "${name}"`);
  for (const p of parts) {
    if (p.name.length > 24) fail(`name "${p.name}" is over 24 characters`);
    if (p.name.toLowerCase().includes(cfg.product.toLowerCase())) fail(`name "${p.name}" repeats the product's name`);
  }
  return { facts, parts, accent };
}

function pageModel(cfg, base, layout) {
  const box = { left: MARGIN + 8, right: W - MARGIN - 8, top: FORM_TOP + 6, bottom: layout.formBottom };
  const mask = fitMask(cfg.shape, box);
  const normal = heightField(mask, cfg.bevel ?? 46);
  const grid = cellsOf(mask, base.parts, cfg);
  const model = { ...grid, parts: base.parts };
  const strips = stripsOf(cfg.seed ?? 1).filter(([y0]) => y0 < H);
  const timeline = timelineFor(cfg.seed ?? 1, strips);
  const slots = nameSlots(model);
  const lightInk = luminance(cfg.ink) > luminance(cfg.ground);
  const classes = timeline.map((_, k) => labelHiddenParts(model, slots, classesFor(grid.cells, normal, lightAt(k, timeline.length, cfg.swing ?? 70), lightInk)));
  const legible = classes.map((cl) => legibleNames(model, slots, cl));
  const lines = base.parts.reduce((s, p) => s + p.loc, 0);
  const files = base.parts.reduce((s, p) => s + p.files, 0);
  return {
    report: { mask, grid, legible, lines, files },
    data: {
      W,
      H,
      cell: CELL,
      formTop: FORM_TOP,
      x0: grid.x0,
      seed: cfg.seed ?? 1,
      colors: { ground: cfg.ground, ink: cfg.ink, spot: cfg.spot },
      cells: grid.cells.map((c) => [c.c, c.r, c.part, c.ch]),
      accent: base.accent,
      classes,
      timeline,
      strips,
      maskBox: mask.box,
      text: {
        product: cfg.product,
        headline: cfg.headline,
        legend: cfg.legend,
        accentName: base.parts[base.accent].name,
        archive: cfg.archive,
        series: cfg.series ?? "",
        record: [`${cfg.product} at ${cfg.commit}`, longDate(cfg.date), `${lines.toLocaleString("en-GB")} lines, ${files} files`, `${base.parts.length} parts`],
        meta: cfg.meta ?? [],
      },
    },
  };
}

const luminance = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);

const longDate =(iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const fontFace = (family, file, weight) =>
  `@font-face{font-family:"${family}";src:url(data:font/otf;base64,${fs.readFileSync(file).toString("base64")});font-weight:${weight}}`;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const css = [
    fontFace("Commit", path.join(VYO_FONTS, "commit-400.otf"), 400),
    fontFace("Commit", path.join(VYO_FONTS, "commit-700.otf"), 700),
    fontFace("Grot", path.join(HERE, "fonts/InterDisplay-Black.otf"), 900),
  ].join("\n");
  await page.setContent(`<!doctype html><style>${css}html,body{margin:0}</style><body></body>`);
  await page.addScriptTag({ content: fs.readFileSync(path.join(HERE, "page.js"), "utf8") });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all(['400 20px Commit', '700 20px Commit', '900 20px Grot'].map((f) => document.fonts.load(f))));
  return page;
}

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });

async function renderCover(browser, cfgFile, outDir) {
  const t0 = Date.now();
  const cfg = loadConfig(cfgFile);
  const base = buildModel(cfg);
  const page = await openPage(browser);
  const layout = await page.evaluate((t) => window.xerox.layout(t), { product: cfg.product });
  const { report, data } = pageModel(cfg, base, layout);
  const out = [];
  const say = (s) => out.push(s);
  say(`${cfg.id}: ${base.parts.length} parts, ${report.grid.cells.length} cells, shape ${Math.round(report.mask.box.right - report.mask.box.left)}x${Math.round(report.mask.box.bottom - report.mask.box.top)}px`);
  for (const [i, p] of base.parts.entries()) {
    const cells = report.grid.counts[i];
    const minLegible = Math.min(...report.legible.map((l) => l[i]));
    say(`  ${p.hot ? "*" : " "} ${p.name.padEnd(24)} ${(p.share * 100).toFixed(1).padStart(5)}% of lines  ${((cells / report.grid.cells.length) * 100).toFixed(1).padStart(5)}% of cells  names readable per frame ≥ ${minLegible}`);
    if (minLegible === 0 && p.share >= 0.02) say(`✗ "${p.name}" never prints its whole name in some frame`);
    else if (minLegible === 0) say(`! "${p.name}" (${(p.share * 100).toFixed(1)}%) is too small to print its name`);
  }
  await page.evaluate((d) => window.xerox.setup(d), data);
  const frameDir = path.join(outDir, `.frames-${cfg.id}`);
  fs.rmSync(frameDir, { recursive: true, force: true });
  fs.mkdirSync(frameDir);
  const frames = data.timeline.length * HOLD;
  const stats = [];
  for (let f = 0; f < frames; f++) {
    const r = await page.evaluate((f) => window.xerox.frame(f, 2), f);
    stats.push(r.stats);
    fs.writeFileSync(path.join(frameDir, `f${String(f).padStart(3, "0")}.png`), Buffer.from(r.png, "base64"));
  }
  await page.close();
  // The legend's claim in every frame: the spot plate still covers the accent, the ink plate still holds the form.
  const clean = stats[data.timeline.findIndex((k) => k.snap) * HOLD];
  for (const [f, s] of stats.entries()) {
    const spot = s.spot / clean.spot;
    const ink = s.ink / clean.ink;
    if (spot < 0.75 || spot > 1.3) say(`✗ frame ${f}: the accent's spot area is ${(spot * 100).toFixed(0)}% of the clean copy's`);
    if (ink < 0.7 || ink > 1.4) say(`✗ frame ${f}: the form's ink is ${(ink * 100).toFixed(0)}% of the clean copy's`);
  }
  say(`  spot area per frame ${pct(stats.map((s) => s.spot / clean.spot))}, ink ${pct(stats.map((s) => s.ink / clean.ink))} of the clean copy`);
  // The seam: the step from the last frame back to the first must be no bigger than an ordinary clean step.
  const gray = (f) => decodePng(fs.readFileSync(path.join(frameDir, `f${String(f).padStart(3, "0")}.png`))).gray;
  const changed = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 40) n++;
    return n / a.length;
  };
  const cleanSteps = data.timeline.flatMap((k, i) => (i && !k.gen && !data.timeline[i - 1].gen && !k.snap ? [changed(gray(i * HOLD - 1), gray(i * HOLD))] : []));
  const seam = changed(gray(frames - 1), gray(0));
  const worst = Math.max(...cleanSteps);
  say(`${seam > worst * 1.15 ? "✗" : " "} loop seam changes ${(seam * 100).toFixed(2)}% of pixels; clean steps inside the loop change ${(Math.min(...cleanSteps) * 100).toFixed(2)}–${(worst * 100).toFixed(2)}%`);
  const stillFrame = data.timeline.findIndex((k) => k.still) * HOLD;
  const file = (ext) => path.join(outDir, `${cfg.id}${ext}`);
  fs.copyFileSync(path.join(frameDir, `f${String(stillFrame).padStart(3, "0")}.png`), file(".png"));
  sh("ffmpeg", ["-y", "-i", file(".png"), "-vf", "scale=280:-1:flags=area", file("-thumb.png")]);
  const input = ["-y", "-framerate", String(FPS), "-i", path.join(frameDir, "f%03d.png")];
  sh("ffmpeg", [...input, "-vf", "scale=840:-2:flags=area", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", file(".mp4")]);
  sh("ffmpeg", [...input, "-vf", "scale=560:-1:flags=area,split[a][b];[a]palettegen=max_colors=32:stats_mode=full[p];[b][p]paletteuse=dither=none", "-loop", "0", file(".gif")]);
  const gif = fs.statSync(file(".gif")).size;
  if (gif > 8e6) say(`✗ ${cfg.id}.gif is ${(gif / 1e6).toFixed(1)} MB, over 8 MB`);
  say(`  wrote ${cfg.id}.png, -thumb.png, .mp4, .gif (${(gif / 1e6).toFixed(1)} MB) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(out.join("\n"));
  return { id: cfg.id, frameDir, frames, stillFrame, failed: out.some((l) => l.startsWith("✗")) };
}

const pct = (xs) => `${(Math.min(...xs) * 100).toFixed(0)}–${(Math.max(...xs) * 100).toFixed(0)}%`;

/** The covers in a row on raw paper, as in the reference, every cover on the same frame. */
function renderSeries(covers, outDir) {
  const gap = 28;
  const cw = 420;
  const row = (inputs, scaleW) => {
    const s = scaleW / cw;
    const g = Math.round(gap * s);
    const filters = inputs.map((_, i) => `[${i}:v]scale=${scaleW}:-2:flags=area,pad=iw+${g}:ih+${2 * g}:${g}:${g}:color=#E9E6DD[c${i}]`);
    return `${filters.join(";")};${inputs.map((_, i) => `[c${i}]`).join("")}hstack=inputs=${inputs.length},pad=iw+${g}:ih:0:0:color=#E9E6DD`;
  };
  const stills = covers.flatMap((c) => ["-i", path.join(c.frameDir, `f${String(covers[0].stillFrame).padStart(3, "0")}.png`)]);
  sh("ffmpeg", ["-y", ...stills, "-filter_complex", row(covers, cw), path.join(outDir, "series.png")]);
  const loops = covers.flatMap((c) => ["-framerate", String(FPS), "-i", path.join(c.frameDir, "f%03d.png")]);
  sh("ffmpeg", ["-y", ...loops, "-filter_complex", row(covers, cw), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", path.join(outDir, "series.mp4")]);
  const small = 260;
  sh("ffmpeg", ["-y", ...loops, "-filter_complex", `${row(covers, small)},split[a][b];[a]palettegen=max_colors=48:stats_mode=full[p];[b][p]paletteuse=dither=none`, "-loop", "0", path.join(outDir, "series.gif")]);
  console.log(`series: wrote series.png, series.mp4, series.gif (${(fs.statSync(path.join(outDir, "series.gif")).size / 1e6).toFixed(1)} MB)`);
}

const args = process.argv.slice(2);
const series = args.includes("--series");
const outAt = args.indexOf("--out");
const outDir = path.resolve(outAt >= 0 ? args[outAt + 1] : path.join(HERE, "out"));
const configs = args.filter((a, i) => !a.startsWith("--") && (outAt < 0 || i !== outAt + 1));
if (!configs.length) {
  console.error("Usage: node render.mjs <config.json>... [--series] [--out <dir>] [--keep-frames]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch(process.env.VYO_CHROMIUM ? { executablePath: process.env.VYO_CHROMIUM } : {});
const covers = [];
try {
  for (const c of configs) covers.push(await renderCover(browser, path.resolve(c), outDir));
  if (series) renderSeries(covers, outDir);
} finally {
  await browser.close();
  if (!args.includes("--keep-frames")) for (const c of covers) fs.rmSync(c.frameDir, { recursive: true, force: true });
}
process.exit(covers.some((c) => c.failed) ? 1 : 0);

// Living covers. Usage: node render.mjs [configs/*.json] [--frames-only]
// -> out/<id>.png (still, 840x1190 at 2x), out/<id>-thumb.png (280px), out/<id>.mp4 and out/<id>.gif (seamless
// loop, 560px), out/<id>-report.json; with two or more configs, out/series.{png,mp4,gif}.
// The silhouette is vyo's own mask (ops or a PNG). Here it is inflated into a solid (a pillow off the distance
// field, faces as tilted plates, creases as grooves); page.js turns that solid under one fixed lamp and sets it in
// relief type, frame by frame (see README.md).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { regionParts } from "../../../.cursor/skills/vyo/tools/lib/parts.mjs";
import { shapeMask, maskGrid, edt, opRings, opKind, paintRows } from "../../../.cursor/skills/vyo/tools/lib/mask.mjs";
import { SHEET } from "../../../.cursor/skills/vyo/tools/lib/geometry.mjs";
import { RELIEF, RELIEF_TONES } from "../../../.cursor/skills/vyo/tools/lib/fields/shape-relief.mjs";
import "../../../.cursor/skills/vyo/tools/lib/png-mask.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(HERE, "../../../.cursor/skills/vyo");
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try {
    return require("playwright");
  } catch {
    return createRequire(path.join(SKILL, "package.json"))("playwright");
  }
})();

const FPS = 24;
const SECONDS = 7;
const FRAMES = FPS * SECONDS;
const CELL = 1.5;
// The GIFs take every other frame: at 24 fps the crawling type runs past 8 MB, the MP4s keep all of them.
const GIF_RATE = `fps=${FPS / 2}`;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const INTER = "/usr/share/fonts/opentype/inter";
const font = (file) => `data:font/otf;base64,${fs.readFileSync(file).toString("base64")}`;
const FONTS = {
  mono400: font(path.join(SKILL, "fonts/commit-400.otf")),
  mono700: font(path.join(SKILL, "fonts/commit-700.otf")),
  grot500: font(path.join(INTER, "Inter-Medium.otf")),
  grot700: font(path.join(INTER, "InterDisplay-SemiBold.otf")),
};
const b64 = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString("base64");

/** A box blur, in place, of radius r cells, twice over (close to a gaussian). */
function blur(f, w, h, r) {
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

const distance = (on, w, h) => edt(Float64Array.from(on, (b) => (b ? 1e12 : 0)), w, h).map((d) => Math.sqrt(d) * CELL);

/** One op painted alone on the mask's sheet, as cells; a crease along a capsule or arc is its centre line. */
function opGrid(shape, op, mask) {
  const { s, tx, ty } = mask.xf;
  const [, kind] = opKind(op);
  const thin = kind === "capsule" ? { r: 1.5 / s } : kind === "arc" ? { width: 3 / s } : {};
  const runs = paintRows(opRings(shape, [{ ...op, ...thin, add: kind, cut: undefined, crease: undefined }]).map((o) => ({ ...o, cut: false })), s, tx, ty, SHEET.height);
  return maskGrid({ runs }, CELL).bits;
}

/**
 * The solid, on a grid of CELL px: per inside cell, the middle surface `mid` and the half thickness `half`, so the
 * front is mid + half and the back mid - half. A round add inflates off the outline (a dome of radius bevel times
 * the deepest point, times `depth`); a `face` add is a plate tilted toward the lamp ("lit") or away ("dim") about
 * the fold where the faces meet; a crease is a groove on both sides. `key` orders the cells for the strata.
 */
function buildSolid(shapeSpec, mask, solid, strata) {
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
  const dIn = distance(inside, w, h);
  const face = new Int8Array(w * h);
  const crease = new Uint8Array(w * h);
  for (const op of shapeSpec.ops ?? []) {
    const [verb] = opKind(op);
    if (verb === "add" && (op.face === "lit" || op.face === "dim")) {
      const b = crop(opGrid(shapeSpec, op, mask));
      for (let i = 0; i < b.length; i++) if (b[i]) face[i] = op.face === "lit" ? 1 : -1;
    } else if (verb === "add") {
      const b = crop(opGrid(shapeSpec, op, mask));
      for (let i = 0; i < b.length; i++) if (b[i]) face[i] = 0;
    } else if (verb === "crease") {
      const b = crop(opGrid(shapeSpec, op, mask));
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
  blur(half, w, h, Math.max(1, Math.round((R * 0.18) / CELL)));
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
    blur(mid, w, h, 2);
  }
  if (crease.some((b) => b)) {
    const dC = distance(crease.map((b) => 1 - b), w, h);
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
  return { w, h, cell: CELL, inside: b64(inside), half: b64(half), mid: b64(mid), key: b64(key), R };
}

function load(cfgPath) {
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const at = (p) => path.resolve(path.dirname(cfgPath), p);
  const facts = JSON.parse(fs.readFileSync(at(cfg.facts), "utf8"));
  const parts = regionParts({ field: "shape", accent: cfg.accent, names: cfg.names, ...(cfg.split ? { split: cfg.split } : {}) }, facts);
  const problems = [];
  const missing = parts.filter((p) => !cfg.names[p.id]).map((p) => p.id);
  if (missing.length) problems.push(`no plain name for ${missing.join(", ")}`);
  const hot = parts.filter((p) => p.hot);
  if (hot.length !== 1) problems.push(`accent ${cfg.accent} must name exactly one part, names ${hot.length}`);
  else if (!cfg.legend.toLowerCase().includes(cfg.names[hot[0].id].toLowerCase())) problems.push(`legend does not name the accent part "${cfg.names[hot[0].id]}"`);
  if (!/\bcode\b|\blines\b/.test(cfg.legend)) problems.push("legend does not name the measure (code or lines)");
  for (const p of parts) if (cfg.names[p.id] && cfg.names[p.id].length > 24) problems.push(`name "${cfg.names[p.id]}" is over 24 characters`);
  if (problems.length) throw new Error(`${cfgPath}: ${problems.join("; ")}`);

  const shapeSpec = cfg.shape.mask ? { mask: at(cfg.shape.mask) } : { ops: cfg.shape.ops, ...(cfg.shape.rotate ? { rotate: cfg.shape.rotate } : {}) };
  const mask = shapeMask({ ...shapeSpec, fit: { w: 0.78, h: 0.5, cx: 0.5, cy: 0.5 } });
  const solid = { bevel: 0.8, depth: 1, ...cfg.solid };
  const total = parts.reduce((s, p) => s + p.loc, 0);
  const files = parts.reduce((s, p) => s + p.files, 0);
  const [yy, mm, dd] = cfg.date.split("-").map(Number);
  const day = DAYS[new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()];
  const lum = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255).reduce((s, c, k) => s + c * [0.2126, 0.7152, 0.0722][k], 0);
  const theme = lum(cfg.palette.ground) < 0.4 ? "dark" : "light";
  return {
    id: cfg.id ?? path.basename(cfgPath, ".json"),
    cfg,
    data: {
      frames: FRAMES,
      theme,
      colors: cfg.palette,
      name: cfg.product,
      number: cfg.number ?? "",
      record: [`On ${day}, ${MONTHS[mm - 1]} ${dd},`, `${cfg.product} stood at ${cfg.commit}:`, `${total.toLocaleString("en-US")} lines in ${files} files.`],
      headline: cfg.headline,
      legend: cfg.legend,
      accentName: cfg.names[hot[0].id].toLowerCase(),
      parts: parts.map((p) => ({ id: p.id, name: cfg.names[p.id].toLowerCase(), share: p.loc / total, hot: p.hot })),
      solid: { ...buildSolid(shapeSpec, mask, solid, cfg.strata), turn: { yaw: 34, pitch: 12, lean: 0, ...cfg.turn } },
      relief: { size: RELIEF.size, leading: RELIEF.leading, light: RELIEF.light, phase: RELIEF.phase, stretch: RELIEF.stretch, tones: RELIEF_TONES[theme] },
      fonts: FONTS,
    },
  };
}

const PAGE = fs.readFileSync(path.join(HERE, "page.js"), "utf8");
const html = (data) => `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#888}</style></head>
<body><canvas id="c"></canvas><script>window.DATA=${JSON.stringify(data).replace(/</g, "\\u003c")};</script><script>${PAGE}</script></body></html>`;

const dataUrlTo = (file, url) => fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
const ff = (...args) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args]);
const gifFilter = (chain, colors = 32) => `${chain},split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`;
const pct = (x) => `${(x * 100).toFixed(1)}%`;

async function cover(browser, cfgPath, outDir) {
  const t0 = Date.now();
  const { id, data } = load(cfgPath);
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.setContent(html(data), { waitUntil: "load" });
  await page.waitForFunction(() => window.ready === true || window.failed, null, { timeout: 120000 });
  if (errors.length || (await page.evaluate(() => window.failed))) throw new Error(`${id}: ${errors.join("; ")}`);

  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), `living-${id}-`));
  const reports = [];
  for (let f = 0; f < FRAMES; f++) {
    const { url, report } = await page.evaluate((f) => window.frame(f, 1), f);
    dataUrlTo(path.join(frameDir, `f${String(f).padStart(3, "0")}.png`), url);
    reports.push(report);
  }
  const big = data.parts.map((p, i) => (p.share >= 0.02 ? i : -1)).filter((i) => i >= 0);
  const readable = (r) => big.filter((i) => r.whole[i] > 0).length;
  // The still: every big part's name whole, then a pose about half into the turn (the far end shows the most volume
  // but the least of the silhouette), then the most letters.
  const pose = (r) => Math.round(Math.abs(r.turned - 0.55) * 10);
  const best = [...reports].sort((a, b) => readable(b) - readable(a) || pose(a) - pose(b) || b.letters - a.letters)[0];
  const still = await page.evaluate((f) => window.frame(f, 2), best.frame);
  dataUrlTo(path.join(outDir, `${id}.png`), still.url);
  const steps = await page.evaluate(() => window.steps());
  const flips = await page.evaluate(() => window.flips);
  await page.close();

  const seq = path.join(frameDir, "f%03d.png");
  ff("-i", path.join(outDir, `${id}.png`), "-vf", "scale=280:-1:flags=area", path.join(outDir, `${id}-thumb.png`));
  ff("-framerate", String(FPS), "-i", seq, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-vf", "scale=560:-2:flags=area", path.join(outDir, `${id}.mp4`));
  ff("-framerate", String(FPS), "-i", seq, "-filter_complex", gifFilter(`${GIF_RATE},scale=560:-1:flags=area`), "-loop", "0", path.join(outDir, `${id}.gif`));

  const gifMB = fs.statSync(path.join(outDir, `${id}.gif`)).size / 1e6;
  const worst = reports.reduce((m, r) => (r.shareGap > m.shareGap ? r : m));
  const inner = steps.slice(0, FRAMES - 1);
  const seam = steps[FRAMES - 1];
  const fails = [];
  const missing = big.filter((i) => !best.whole[i]).map((i) => data.parts[i].name);
  if (missing.length) fails.push(`still frame ${best.frame} does not print whole: ${missing.join(", ")}`);
  if (worst.shareGap > 0.01) fails.push(`share gap ${pct(worst.shareGap)} in frame ${worst.frame}`);
  if (Math.min(...reports.map((r) => r.accentCells)) === 0) fails.push("the accent vanishes in some frame");
  if (seam > Math.max(...inner) * 1.05) fails.push(`seam step ${seam} cells is over the largest inner step ${Math.max(...inner)}`);
  if (gifMB > 8) fails.push(`gif is ${gifMB.toFixed(1)} MB`);
  const minNames = data.parts.map((p, i) => Math.min(...reports.map((r) => r.whole[i])));
  console.log(`${id}: still frame ${best.frame}/${FRAMES} (yaw ${best.yaw.toFixed(0)}°), ${readable(best)}/${big.length} parts of 2%+ print whole there`);
  data.parts.forEach((p, i) => console.log(`  ${p.hot ? "*" : " "} ${p.name.padEnd(22)} lines ${pct(p.share).padStart(6)}  cells in still ${pct(best.shares[i]).padStart(6)}  whole names in still ${best.whole[i]}, fewest in a frame ${minNames[i]}`));
  console.log(`  worst share gap ${pct(worst.shareGap)} points (frame ${worst.frame}); accent cells ${Math.min(...reports.map((r) => r.accentCells))} to ${Math.max(...reports.map((r) => r.accentCells))}`);
  console.log(`  seam step ${seam} glyph changes; inner steps ${Math.min(...inner)} to ${Math.max(...inner)} (median ${[...inner].sort((a, b) => a - b)[inner.length >> 1]}); part flips per step median ${[...flips].sort((a, b) => a - b)[FRAMES >> 1]}, seam ${flips[FRAMES - 1]}`);
  console.log(`  gif ${gifMB.toFixed(1)} MB, mp4 ${(fs.statSync(path.join(outDir, `${id}.mp4`)).size / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const f of fails) console.log(`  ✗ ${f}`);
  fs.writeFileSync(path.join(outDir, `${id}-report.json`), JSON.stringify({ still: best.frame, seam, steps, reports: reports.map(({ shares, whole, ...r }) => ({ ...r, shares: shares.map((s) => +s.toFixed(4)), whole })) }));
  return { id, frameDir, fails };
}

function series(covers, outDir, bg = "0xF4F3EF") {
  const n = covers.length;
  const ins = covers.flatMap((c) => ["-framerate", String(FPS), "-i", path.join(c.frameDir, "f%03d.png")]);
  const chain = (cw, g) =>
    covers.map((_, i) => `[${i}]scale=${cw}:-2:flags=area${i < n - 1 ? `,pad=iw+${g}:ih:0:0:${bg}` : ""}[s${i}]`).join(";") +
    `;${covers.map((_, i) => `[s${i}]`).join("")}hstack=${n},pad=iw+${2 * g}:ih+${2 * g}:${g}:${g}:${bg}`;
  ff(...ins, "-filter_complex", chain(420, 24), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", path.join(outDir, "series.mp4"));
  ff(...ins, "-filter_complex", gifFilter(`${chain(270, 16)},${GIF_RATE}`, 64), "-loop", "0", path.join(outDir, "series.gif"));
  const stills = covers.flatMap((c) => ["-i", path.join(outDir, `${c.id}.png`)]);
  ff(...stills, "-filter_complex", chain(840, 48), "-frames:v", "1", path.join(outDir, "series.png"));
  console.log(`series: gif ${(fs.statSync(path.join(outDir, "series.gif")).size / 1e6).toFixed(1)} MB`);
}

const args = process.argv.slice(2);
const configs = args.length ? args : fs.readdirSync(path.join(HERE, "configs")).filter((f) => f.endsWith(".json")).sort().map((f) => path.join(HERE, "configs", f));
const outDir = path.join(HERE, "out");
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch(process.env.VYO_CHROMIUM ? { executablePath: process.env.VYO_CHROMIUM } : {});
const covers = [];
for (const c of configs) covers.push(await cover(browser, path.resolve(c), outDir));
await browser.close();
if (covers.length > 1) series(covers, outDir);
if (!process.env.KEEP_FRAMES) for (const c of covers) fs.rmSync(c.frameDir, { recursive: true, force: true });
else console.log(covers.map((c) => c.frameDir).join("\n"));
if (covers.some((c) => c.fails.length)) process.exitCode = 1;

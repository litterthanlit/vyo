// Spin covers. Usage: node render.mjs [configs/*.json]  -> out/<id>.png (still, 2x), out/<id>-thumb.png (280px),
// out/<id>.mp4 and out/<id>.gif (seamless loop), and with two or more configs out/series.{png,mp4,gif}.
// The silhouette comes from vyo's own mask (ops or a PNG); the page extrudes or revolves it into a cloud of glyph
// cells, cut into the parts by their share of the lines, and spins it with a glitch on a fixed beat (see README.md).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { regionParts } from "../../../.cursor/skills/vyo/tools/lib/parts.mjs";
import { shapeMask, maskGrid } from "../../../.cursor/skills/vyo/tools/lib/mask.mjs";
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

const FRAMES = 96;
const FPS = 12;
const MASK_CELL = 1.5;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const INTER = "/usr/share/fonts/opentype/inter";
const font = (file) => `data:font/otf;base64,${fs.readFileSync(file).toString("base64")}`;
const FONTS = {
  mono400: font(path.join(SKILL, "fonts/commit-400.otf")),
  mono700: font(path.join(SKILL, "fonts/commit-700.otf")),
  grot900: font(path.join(INTER, "InterDisplay-Black.otf")),
  grot600: font(path.join(INTER, "InterDisplay-SemiBold.otf")),
};

function load(cfgPath) {
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const at = (p) => path.resolve(path.dirname(cfgPath), p);
  const facts = JSON.parse(fs.readFileSync(at(cfg.facts), "utf8"));
  const parts = regionParts({ field: "shape", accent: cfg.accent, names: cfg.names }, facts);
  const problems = [];
  const missing = parts.filter((p) => !cfg.names[p.id]).map((p) => p.id);
  if (missing.length) problems.push(`no plain name for ${missing.join(", ")}`);
  const hot = parts.filter((p) => p.hot);
  if (hot.length !== 1) problems.push(`accent ${cfg.accent} must name exactly one part`);
  else if (!cfg.legend.toLowerCase().includes(hot[0].name.toLowerCase())) problems.push(`legend does not name the accent part "${hot[0].name}"`);
  if (!/\bcode\b|\blines\b/.test(cfg.legend)) problems.push("legend does not name the measure (code or lines)");
  if (problems.length) throw new Error(`${cfgPath}: ${problems.join("; ")}`);

  const shape = cfg.shape.mask ? { mask: at(cfg.shape.mask) } : { ops: cfg.shape.ops };
  const mask = shapeMask({ ...shape, fit: { w: 0.8, h: 0.62, cx: 0.5, cy: 0.5 } });
  const g = maskGrid(mask, MASK_CELL);
  let [x0, y0, x1, y1] = [g.w, g.h, -1, -1];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.bits[y * g.w + x]) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  let bits = "";
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) bits += g.bits[y * g.w + x];

  const total = parts.reduce((s, p) => s + p.loc, 0);
  const files = parts.reduce((s, p) => s + p.files, 0);
  const [yy, mm, dd] = cfg.date.split("-").map(Number);
  return {
    id: path.basename(cfgPath, ".json"),
    data: {
      frames: FRAMES,
      seed: cfg.seed ?? 1,
      colors: { ground: cfg.ground, ink: cfg.ink, signal: cfg.signal },
      name: cfg.name ?? cfg.product,
      number: cfg.number ?? "",
      meta: [
        [`${total.toLocaleString("en-US")} lines`, `${files} files`, `${parts.length} parts`],
        cfg.headline,
      ],
      legend: cfg.legend,
      label: `${cfg.product} at ${cfg.commit}, ${dd} ${MONTHS[mm - 1]} ${yy}. Drawn by Vyo`,
      parts: parts.map((p) => ({ name: p.name.toLowerCase(), share: p.loc / total, hot: p.hot })),
      grid: { w, h, cell: MASK_CELL, bits },
      solid: { kind: "extrude", depth: 0.32, tilt: -16, lean: -8, ...cfg.solid },
      fonts: FONTS,
    },
  };
}

const PAGE = fs.readFileSync(path.join(HERE, "page.js"), "utf8");
const html = (data) => `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#888}</style></head>
<body><canvas id="c"></canvas><script>window.DATA=${JSON.stringify(data).replace(/</g, "\\u003c")};</script><script>${PAGE}</script></body></html>`;

const dataUrlTo = (file, url) => fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
const ff = (...args) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args]);
const gifFilter = (chain) => `${chain},split[a][b];[a]palettegen=max_colors=12:stats_mode=full[p];[b][p]paletteuse=dither=none`;

async function cover(browser, cfgPath, outDir) {
  const t0 = Date.now();
  const { id, data } = load(cfgPath);
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent(html(data), { waitUntil: "load" });
  await page.waitForFunction(() => window.ready === true || window.failed, null, { timeout: 60000 });
  if (errors.length) throw new Error(`${id}: ${errors.join("; ")}`);

  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), `spin-${id}-`));
  const reports = [];
  for (let f = 0; f < FRAMES; f++) {
    const { url, report } = await page.evaluate((f) => window.frame(f, 1), f);
    dataUrlTo(path.join(frameDir, `f${String(f).padStart(3, "0")}.png`), url);
    reports.push(report);
  }
  const best = reports.filter((r) => !r.glitch && r.facing > Math.cos(Math.PI / 5.2)).sort((a, b) => b.readableParts - a.readableParts || b.letters - a.letters)[0];
  const still = await page.evaluate((f) => window.frame(f, 2), best.frame);
  dataUrlTo(path.join(outDir, `${id}.png`), still.url);
  const steps = await page.evaluate(() => window.steps());
  await page.close();

  const seq = path.join(frameDir, "f%03d.png");
  ff("-i", path.join(outDir, `${id}.png`), "-vf", "scale=280:-1:flags=area", path.join(outDir, `${id}-thumb.png`));
  ff("-framerate", String(FPS), "-i", seq, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-vf", "scale=840:-2", path.join(outDir, `${id}.mp4`));
  ff("-framerate", String(FPS), "-i", seq, "-filter_complex", gifFilter("scale=560:-1:flags=area"), "-loop", "0", path.join(outDir, `${id}.gif`));

  const worst = Math.max(...reports.map((r) => r.shareGap));
  const unread = data.parts.filter((p, i) => !best.readableBy[i]).map((p) => p.name);
  const seam = { last: steps[FRAMES - 1], before: steps[FRAMES - 2], after: steps[0] };
  console.log(
    `${id}: still frame ${best.frame}, ${best.readableParts}/${data.parts.length} names readable${unread.length ? ` (not: ${unread.join(", ")})` : ""}, ` +
      `worst share gap ${(worst * 100).toFixed(1)} points (frame ${reports.find((r) => r.shareGap === worst).frame}), ` +
      `seam step ${seam.last} cells (neighbours ${seam.before}, ${seam.after}), accent cells min ${Math.min(...reports.map((r) => r.accentCells))}, gif ${(fs.statSync(path.join(outDir, `${id}.gif`)).size / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  fs.writeFileSync(path.join(outDir, `${id}-report.json`), JSON.stringify({ best: best.frame, reports }, null, 1));
  return { id, frameDir, seam };
}

function series(covers, outDir) {
  const n = covers.length;
  const w = 420;
  const gap = 28;
  const ins = covers.flatMap((c) => ["-framerate", String(FPS), "-i", path.join(c.frameDir, "f%03d.png")]);
  const chain = (cw, g) =>
    covers.map((_, i) => `[${i}]scale=${cw}:-2:flags=area${i < n - 1 ? `,pad=iw+${g}:ih:0:0:white` : ""}[s${i}]`).join(";") +
    `;${covers.map((_, i) => `[s${i}]`).join("")}hstack=${n},pad=iw+${2 * g}:ih+${2 * g}:${g}:${g}:white`;
  ff(...ins, "-filter_complex", chain(w, gap), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", path.join(outDir, "series.mp4"));
  ff(...ins, "-filter_complex", gifFilter(chain(280, 18)), "-loop", "0", path.join(outDir, "series.gif"));
  const stills = covers.flatMap((c) => ["-i", path.join(outDir, `${c.id}.png`)]);
  ff(...stills, "-filter_complex", chain(w * 2, gap * 2), "-frames:v", "1", path.join(outDir, "series.png"));
  console.log(`series: ${(fs.statSync(path.join(outDir, "series.gif")).size / 1e6).toFixed(1)} MB gif`);
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
for (const c of covers) fs.rmSync(c.frameDir, { recursive: true, force: true });

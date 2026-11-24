#!/usr/bin/env node
// Exploration F (f-luminous): Optical Light-Field -> Codebase Strata Refraction -> 7px Luminous Mosaic
// Renders 4 bespoke gallery posters (840x1190 @ 2x DPR = 1680x2380px) + 280px thumbnails:
//   1. out/vyo-luminous.png     (Obsidian Optical Mosaic — Luminous Prism & Refracted Spectrum)
//   2. out/hypher-luminous.png  (Obsidian Optical Mosaic — Monumental Folded Origami Wing)
//   3. out/flask-luminous.png   (Obsidian Optical Mosaic — Luminous Ember Seed & Optical Ripples)
//   4. out/pantry-luminous.png  (Daylight Alabaster Mosaic — Terraced Harvest Hills & Weekly Tide)
// Usage: node render.mjs [id...]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildStrataModel } from "./strata-data.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const SKILL = path.join(REPO, ".cursor/skills/vyo");
const FONTS_DIR = path.join(SKILL, "fonts");
const OUT_DIR = path.join(HERE, "out");

const { chromium } = createRequire(path.join(SKILL, "package.json"))("playwright");

const VYO_FACTS = path.resolve(HERE, "../facts/vyo-facts.json");
const HYPHER_FACTS = path.join(
  REPO,
  "explorations/2026-11-11-punk-covers/c-living/facts/hypher-facts.json"
);
const FLASK_FACTS = path.join(
  REPO,
  "explorations/2026-11-11-punk-covers/c-living/facts/flask-facts.json"
);
const PANTRY_FACTS = path.join(
  REPO,
  "explorations/2026-11-11-punk-covers/c-living/facts/pantry-facts.json"
);

// ---- REAL CODEBASE ACCENT & LAYER CLASSIFIERS ----
const vyoAccent = (fp, info) => info.area === "area:tools/lib/fields";
const vyoLayer = (fp, info) => {
  if (info.area === "area:tools") return 0;
  if (info.area === "area:tools/lib/fields") return 1;
  if (info.area === "area:tools/lib") return 2;
  return 3;
};

const hypherAccent = (fp, info) =>
  info.area === "area:script/baton" ||
  info.area === "area:hypher-web/shared" ||
  fp.toLowerCase().includes("handoff") ||
  fp.toLowerCase().includes("baton") ||
  fp.toLowerCase().includes("capture");
const hypherLayer = (fp, info) => {
  if (info.area === "area:packages/hypher-cli/src/commands" || info.area === "area:packages/hypher-cli/src") return 0;
  if (hypherAccent(fp, info)) return 1;
  if (info.area === "area:hypher-web/convex" || info.area === "area:hypher-web/src/lib") return 2;
  return 3;
};

const flaskAccent = (fp, info) =>
  info.area === "area:src/flask/sansio" ||
  [
    "src/flask/app.py",
    "src/flask/ctx.py",
    "src/flask/wrappers.py",
    "src/flask/blueprints.py",
    "src/flask/globals.py",
  ].includes(fp);
const flaskLayer = (fp, info) => {
  if (fp === "src/flask/__init__.py" || fp === "src/flask/__main__.py") return 0;
  if (flaskAccent(fp, info) || fp === "src/flask/signals.py") return 1;
  if (info.area === "area:src/flask" || info.area === "area:src/flask/json") return 2;
  return 3;
};

const pantryAccent = (fp, info) =>
  info.area === "area:lib/plan" ||
  info.area === "area:components/plan" ||
  fp.includes("plan");
const pantryLayer = (fp, info) => {
  if (info.area === "area:app/(app)" || info.area === "area:app/api") return 0;
  if (pantryAccent(fp, info)) return 1;
  if (info.area === "area:components/recipes" || info.area === "area:lib/recipes") return 2;
  return 3;
};

// ---- ZONE-AWARE PLAIN-LANGUAGE MICRO-TYPE POOLS (ZERO JARGON!) ----
const VYO_MICRO = [
  // Incoming mist beam (upper-left)
  { text: "source files", u: 0.20, v: 0.165, rad: 0.08, style: "phrase" },
  { text: "read the tree", u: 0.34, v: 0.205, rad: 0.08, style: "phrase" },
  { text: "no network", u: 0.25, v: 0.255, rad: 0.08, style: "dew" },
  { text: "scan", u: 0.14, v: 0.130, rad: 0.06, style: "dew" },
  { text: "tree", u: 0.39, v: 0.145, rad: 0.07, style: "dew" },

  // Glowing prism refraction heart (upper-center-right)
  { text: "drawing engine", u: 0.62, v: 0.325, rad: 0.08, style: "core" },
  { text: "light and shadow", u: 0.74, v: 0.275, rad: 0.09, style: "phrase" },
  { text: "plain words", u: 0.54, v: 0.275, rad: 0.08, style: "phrase" },
  { text: "find the core", u: 0.63, v: 0.205, rad: 0.08, style: "phrase" },
  { text: "prism", u: 0.77, v: 0.175, rad: 0.08, style: "dew" },
  { text: "edge", u: 0.89, v: 0.315, rad: 0.08, style: "dew" },
  { text: "turn", u: 0.45, v: 0.335, rad: 0.06, style: "dew" },

  // Cascading refracted spectrum waterfall (mid & lower right)
  { text: "one sheet", u: 0.59, v: 0.445, rad: 0.08, style: "core" },
  { text: "every line counts", u: 0.78, v: 0.465, rad: 0.09, style: "phrase" },
  { text: "true scale", u: 0.58, v: 0.565, rad: 0.08, style: "core" },
  { text: "quiet ground", u: 0.73, v: 0.545, rad: 0.09, style: "phrase" },
  { text: "cut the noise", u: 0.87, v: 0.585, rad: 0.09, style: "phrase" },
  { text: "small choices", u: 0.65, v: 0.665, rad: 0.09, style: "phrase" },
  { text: "check the margin", u: 0.81, v: 0.695, rad: 0.09, style: "phrase" },
  { text: "leave room", u: 0.57, v: 0.745, rad: 0.08, style: "core" },
  { text: "clean grain", u: 0.86, v: 0.785, rad: 0.08, style: "phrase" },
  { text: "keep it clear", u: 0.71, v: 0.825, rad: 0.09, style: "phrase" },
  { text: "one picture", u: 0.58, v: 0.885, rad: 0.08, style: "core" },
  { text: "open sky", u: 0.84, v: 0.905, rad: 0.08, style: "phrase" },
  { text: "calm", u: 0.45, v: 0.685, rad: 0.07, style: "dew" },
  { text: "grid", u: 0.47, v: 0.815, rad: 0.07, style: "dew" },
  { text: "form", u: 0.46, v: 0.935, rad: 0.07, style: "dew" },
];

const HYPHER_MICRO = [
  // Upper-left glacier-cyan wing (first agent)
  { text: "first agent", u: 0.36, v: 0.305, rad: 0.09, style: "phrase" },
  { text: "shared memory", u: 0.54, v: 0.245, rad: 0.09, style: "phrase" },
  { text: "leading edge", u: 0.70, v: 0.185, rad: 0.09, style: "phrase" },
  { text: "wing", u: 0.22, v: 0.275, rad: 0.07, style: "dew" },
  { text: "lift", u: 0.44, v: 0.215, rad: 0.07, style: "dew" },
  { text: "glide", u: 0.64, v: 0.115, rad: 0.07, style: "dew" },
  { text: "open", u: 0.26, v: 0.385, rad: 0.07, style: "dew" },

  // Molten crimson spine / fold crease (the handoff note!)
  { text: "handoff note", u: 0.60, v: 0.365, rad: 0.08, style: "core" },
  { text: "carry context", u: 0.49, v: 0.445, rad: 0.08, style: "core" },
  { text: "fold", u: 0.74, v: 0.285, rad: 0.07, style: "core" },

  // Lower-right twilight-amethyst wing (next agent)
  { text: "next agent", u: 0.80, v: 0.405, rad: 0.09, style: "phrase" },
  { text: "pick up cleanly", u: 0.74, v: 0.505, rad: 0.09, style: "phrase" },
  { text: "editor", u: 0.88, v: 0.305, rad: 0.07, style: "dew" },
  { text: "browser", u: 0.88, v: 0.485, rad: 0.08, style: "phrase" },
  { text: "seam", u: 0.64, v: 0.465, rad: 0.07, style: "dew" },

  // Trailing kinetic slipstream strata (continuity wake)
  { text: "keep moving", u: 0.58, v: 0.585, rad: 0.08, style: "core" },
  { text: "no lost thread", u: 0.76, v: 0.625, rad: 0.09, style: "phrase" },
  { text: "relay", u: 0.56, v: 0.685, rad: 0.07, style: "core" },
  { text: "same state", u: 0.72, v: 0.725, rad: 0.09, style: "phrase" },
  { text: "pass it on", u: 0.86, v: 0.685, rad: 0.08, style: "phrase" },
  { text: "clean trail", u: 0.62, v: 0.805, rad: 0.09, style: "phrase" },
  { text: "never reset", u: 0.80, v: 0.835, rad: 0.09, style: "phrase" },
  { text: "fresh eyes", u: 0.57, v: 0.905, rad: 0.08, style: "core" },
  { text: "still flying", u: 0.76, v: 0.925, rad: 0.09, style: "phrase" },
  { text: "wake", u: 0.47, v: 0.785, rad: 0.07, style: "dew" },
  { text: "turn", u: 0.46, v: 0.885, rad: 0.07, style: "dew" },
];

const FLASK_MICRO = [
  // Compact luminous ember-crimson core seed (upper-right-center)
  { text: "request core", u: 0.66, v: 0.275, rad: 0.08, style: "core" },
  { text: "one small file", u: 0.58, v: 0.345, rad: 0.09, style: "core" },
  { text: "start small", u: 0.76, v: 0.195, rad: 0.09, style: "phrase" },
  { text: "seed", u: 0.53, v: 0.215, rad: 0.08, style: "dew" },
  { text: "core", u: 0.80, v: 0.285, rad: 0.08, style: "dew" },

  // Inner luminous glacier-cyan & rose concentric optical ripples
  { text: "route a path", u: 0.49, v: 0.175, rad: 0.09, style: "phrase" },
  { text: "render a page", u: 0.84, v: 0.375, rad: 0.09, style: "phrase" },
  { text: "clean replies", u: 0.65, v: 0.435, rad: 0.09, style: "phrase" },
  { text: "session cookie", u: 0.80, v: 0.505, rad: 0.09, style: "phrase" },
  { text: "path", u: 0.37, v: 0.245, rad: 0.08, style: "dew" },
  { text: "view", u: 0.88, v: 0.225, rad: 0.08, style: "dew" },
  { text: "reply", u: 0.48, v: 0.365, rad: 0.08, style: "dew" },

  // Outer blossoming cobalt & twilight-amethyst waves
  { text: "thin layer", u: 0.60, v: 0.555, rad: 0.09, style: "phrase" },
  { text: "grow on demand", u: 0.76, v: 0.615, rad: 0.09, style: "phrase" },
  { text: "simple views", u: 0.56, v: 0.665, rad: 0.09, style: "core" },
  { text: "command line", u: 0.82, v: 0.715, rad: 0.09, style: "phrase" },
  { text: "keep it light", u: 0.67, v: 0.765, rad: 0.09, style: "phrase" },
  { text: "build a link", u: 0.56, v: 0.815, rad: 0.09, style: "core" },
  { text: "add a piece", u: 0.83, v: 0.845, rad: 0.09, style: "phrase" },
  { text: "plain page", u: 0.67, v: 0.885, rad: 0.09, style: "phrase" },
  { text: "by hand", u: 0.81, v: 0.935, rad: 0.09, style: "phrase" },
  { text: "grow", u: 0.41, v: 0.675, rad: 0.08, style: "dew" },
  { text: "hook", u: 0.42, v: 0.765, rad: 0.08, style: "dew" },
  { text: "link", u: 0.40, v: 0.865, rad: 0.08, style: "dew" },
  { text: "open", u: 0.44, v: 0.935, rad: 0.08, style: "dew" },
];

const PANTRY_MICRO = [
  // Seven days of the week woven rhythmically across the 7 terraced harvest waves!
  { text: "mon", u: 0.76, v: 0.245, rad: 0.07, style: "dew" },
  { text: "tue", u: 0.62, v: 0.345, rad: 0.07, style: "dew" },
  { text: "wed", u: 0.82, v: 0.455, rad: 0.07, style: "dew" },
  { text: "thu", u: 0.45, v: 0.545, rad: 0.07, style: "dew" },
  { text: "fri", u: 0.75, v: 0.675, rad: 0.07, style: "dew" },
  { text: "sat", u: 0.40, v: 0.785, rad: 0.07, style: "dew" },
  { text: "sun", u: 0.66, v: 0.895, rad: 0.07, style: "dew" },

  // ONE unified vermilion-crimson weekly dinner plan tide (central unifying hearth!)
  { text: "the weekly plan", u: 0.62, v: 0.585, rad: 0.08, style: "core" },
  { text: "one week", u: 0.84, v: 0.595, rad: 0.08, style: "core" },
  { text: "plan ahead", u: 0.43, v: 0.615, rad: 0.08, style: "core" },

  // Recipes, meal cards, shopping list, suggestions woven organically across the hills
  { text: "saved recipes", u: 0.52, v: 0.395, rad: 0.09, style: "phrase" },
  { text: "suggestions", u: 0.85, v: 0.295, rad: 0.08, style: "phrase" },
  { text: "dinner ready", u: 0.78, v: 0.375, rad: 0.09, style: "phrase" },
  { text: "meal cards", u: 0.68, v: 0.485, rad: 0.09, style: "phrase" },
  { text: "cook what you have", u: 0.34, v: 0.515, rad: 0.09, style: "phrase" },
  { text: "shopping list", u: 0.56, v: 0.715, rad: 0.09, style: "phrase" },
  { text: "pantry shelf", u: 0.84, v: 0.745, rad: 0.09, style: "phrase" },
  { text: "fresh ideas", u: 0.26, v: 0.685, rad: 0.09, style: "phrase" },
  { text: "simple meals", u: 0.52, v: 0.835, rad: 0.09, style: "phrase" },
  { text: "pick seven", u: 0.82, v: 0.845, rad: 0.09, style: "phrase" },
  { text: "less waste", u: 0.28, v: 0.845, rad: 0.09, style: "phrase" },
  { text: "home table", u: 0.44, v: 0.935, rad: 0.09, style: "phrase" },
  { text: "ready to cook", u: 0.80, v: 0.945, rad: 0.09, style: "phrase" },
  { text: "list", u: 0.19, v: 0.765, rad: 0.07, style: "dew" },
  { text: "prep", u: 0.20, v: 0.915, rad: 0.07, style: "dew" },
];

const TARGETS = [
  {
    id: "vyo-luminous",
    subject: "vyo",
    theme: "obsidian",
    factsPath: VYO_FACTS,
    yStart: 0.06,
    repoName: "vyo",
    headline: ["Code turned into", "one sheet anyone", "can read."],
    legend: "crimson marks the drawing engine",
    typoPos: { x: 56, y: 428, headlineSize: 41 },
    isAccent: vyoAccent,
    classifyLayer: vyoLayer,
    microType: VYO_MICRO,
  },
  {
    id: "hypher-luminous",
    subject: "hypher",
    theme: "obsidian",
    factsPath: HYPHER_FACTS,
    yStart: 0.06,
    repoName: "hypher",
    headline: ["Switch agents", "without starting", "over."],
    legend: "crimson marks the handoff note",
    typoPos: { x: 56, y: 654, headlineSize: 42 },
    isAccent: hypherAccent,
    classifyLayer: hypherLayer,
    microType: HYPHER_MICRO,
  },
  {
    id: "flask-luminous",
    subject: "flask",
    theme: "obsidian",
    factsPath: FLASK_FACTS,
    yStart: 0.06,
    repoName: "flask",
    headline: ["One small file,", "grown only as far", "as you need."],
    legend: "crimson marks the request core",
    typoPos: { x: 56, y: 432, headlineSize: 41 },
    isAccent: flaskAccent,
    classifyLayer: flaskLayer,
    microType: FLASK_MICRO,
  },
  {
    id: "pantry-luminous",
    subject: "pantry",
    theme: "daylight",
    factsPath: PANTRY_FACTS,
    yStart: 0.16,
    repoName: "pantry",
    headline: ["A week of dinners,", "planned in one go."],
    legend: "crimson marks the weekly plan",
    typoPos: { x: 54, y: 58, headlineSize: 43 },
    isAccent: pantryAccent,
    classifyLayer: pantryLayer,
    microType: PANTRY_MICRO,
  },
];

function fontDataUri(filename, mime) {
  const buf = fs.readFileSync(path.join(FONTS_DIR, filename));
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function buildHtml(subjectsCode, engineCode) {
  const interDisplay = fontDataUri("inter-display-600.woff2", "font/woff2");
  const inter500 = fontDataUri("inter-500.woff2", "font/woff2");
  const commit400 = fontDataUri("commit-400.otf", "font/otf");
  const commit700 = fontDataUri("commit-700.otf", "font/otf");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: "Inter Display";
    src: url("${interDisplay}") format("woff2");
    font-weight: 600;
    font-style: normal;
  }
  @font-face {
    font-family: "Inter";
    src: url("${inter500}") format("woff2");
    font-weight: 500;
    font-style: normal;
  }
  @font-face {
    font-family: "Commit Mono";
    src: url("${commit400}") format("opentype");
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: "Commit Mono";
    src: url("${commit700}") format("opentype");
    font-weight: 700;
    font-style: normal;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #090A0D;
  }
  canvas {
    display: block;
    width: 840px;
    height: 1190px;
  }
</style>
</head>
<body>
<canvas id="poster" width="1680" height="2380"></canvas>
<script>
${subjectsCode}
</script>
<script>
${engineCode}
</script>
</body>
</html>`;
}

function saveDataUrl(dataUrl, destPath) {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  fs.writeFileSync(destPath, Buffer.from(base64, "base64"));
}

async function main() {
  const filter = process.argv.slice(2);
  const selected = filter.length
    ? TARGETS.filter((t) => filter.some((f) => t.id.includes(f)))
    : TARGETS;

  if (!selected.length) {
    console.error("No matching targets. Available:", TARGETS.map((t) => t.id).join(", "));
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const subjectsCode = fs.readFileSync(path.join(HERE, "subjects.js"), "utf8");
  const engineCode = fs.readFileSync(path.join(HERE, "engine.js"), "utf8");
  const html = buildHtml(subjectsCode, engineCode);

  const executablePath = process.env.VYO_CHROMIUM || "/usr/bin/google-chrome";
  const browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-gpu-sandbox"],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 840, height: 1190 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([
        document.fonts.load('600 42px "Inter Display"'),
        document.fonts.load('500 42px "Inter"'),
        document.fonts.load('400 11px "Commit Mono"'),
        document.fonts.load('700 10px "Commit Mono"'),
      ]);
    });

    for (const target of selected) {
      const t0 = Date.now();
      const model = buildStrataModel(target.factsPath, target);

      const res = await page.evaluate((m) => {
        const canvas = document.getElementById("poster");
        const info = window.renderLuminousPoster(canvas, m);
        const fullUrl = canvas.toDataURL("image/png");

        // Crisp 2-step high-quality downscale to 280x397 thumbnail
        const mid = document.createElement("canvas");
        mid.width = 560;
        mid.height = 793;
        const mctx = mid.getContext("2d");
        mctx.imageSmoothingEnabled = true;
        mctx.imageSmoothingQuality = "high";
        mctx.drawImage(canvas, 0, 0, mid.width, mid.height);

        const thumb = document.createElement("canvas");
        thumb.width = 280;
        thumb.height = 397;
        const tctx = thumb.getContext("2d");
        tctx.imageSmoothingEnabled = true;
        tctx.imageSmoothingQuality = "high";
        tctx.drawImage(mid, 0, 0, thumb.width, thumb.height);

        return {
          info,
          fullUrl,
          thumbUrl: thumb.toDataURL("image/png"),
        };
      }, model);

      const fullPath = path.join(OUT_DIR, `${target.id}.png`);
      const thumbPath = path.join(OUT_DIR, `${target.id}-thumb.png`);
      saveDataUrl(res.fullUrl, fullPath);
      saveDataUrl(res.thumbUrl, thumbPath);

      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      const kb = (fs.statSync(fullPath).size / 1024).toFixed(0);
      console.log(
        `[${target.id}] ${model.stats.files} files, ${model.stats.totalLoc.toLocaleString()} LOC, ` +
          `${model.stats.imports} imports | slices=${res.info.slices}, microtype=${res.info.placedCount}/${target.microType.length} ` +
          `(dew=${res.info.dewPlaced}, phrase=${res.info.phrasePlaced}, core=${res.info.corePlaced}) -> ${fullPath} (${kb} KB, ${elapsed}s)`
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
// Exploration D (d-mosaic-strata): Fusion of Exploration A (a-mosaic) + Exploration C (c-strata)
// Renders 4 distinct gallery posters (840x1190 @ 2x DPR = 1680x2380px) + 280px thumbnails:
//   1. out/vyo-signal-mosaic.png     (Obsidian Signal Mosaic — vyo)
//   2. out/flask-signal-mosaic.png   (Obsidian Signal Mosaic — flask)
//   3. out/vyo-bloom-strata.png      (Obsidian Refracted Bloom — vyo)
//   4. out/vyo-daylight-strata.png   (Daylight Strata Mosaic — vyo)
// Usage: node render.mjs [id...]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildStrataModel } from "./strata-data.mjs";
import { buildObsidianBloomScene } from "./bloom-data.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const SKILL = path.join(REPO, ".cursor/skills/vyo");
const FONTS_DIR = path.join(SKILL, "fonts");
const OUT_DIR = path.join(HERE, "out");

const { chromium } = createRequire(path.join(SKILL, "package.json"))("playwright");

const VYO_FACTS = path.resolve(HERE, "../facts/vyo-facts.json");
const FLASK_FACTS = path.join(
  REPO,
  "explorations/2026-11-11-punk-covers/c-living/facts/flask-facts.json"
);

// Strictly 100% plain-language micro-type pools (zero code jargon!)
const VYO_PHRASES = [
  "plain words",
  "leave room",
  "drawing engine",
  "one sheet",
  "no network",
  "every line counts",
  "read the tree",
  "check the margin",
  "light and shadow",
  "cut the noise",
  "true scale",
  "quiet ground",
  "small choices",
  "open sky",
  "clean grain",
  "keep it clear",
  "find the core",
  "hold the air",
  "make it plain",
  "one picture",
  "draw it calm",
  "from the tree",
  "true form",
  "every line",
];

const VYO_DEW = [
  "scan",
  "form",
  "grid",
  "edge",
  "calm",
  "turn",
  "layer",
  "frame",
  "signal",
  "choice",
  "line",
  "tree",
  "part",
  "read",
];

const FLASK_PHRASES = [
  "one small file",
  "request core",
  "grow on demand",
  "clean replies",
  "route a path",
  "render a page",
  "keep it small",
  "start small",
  "thin layer",
  "session cookie",
  "simple views",
  "command line",
  "send a reply",
  "clear path",
  "one file",
  "small core",
  "open page",
  "grow slow",
  "plain page",
  "clean route",
  "light core",
  "build a link",
  "keep it light",
  "by hand",
];

const FLASK_DEW = [
  "path",
  "route",
  "page",
  "core",
  "hook",
  "view",
  "reply",
  "grow",
  "thin",
  "rule",
  "send",
  "step",
  "link",
  "open",
];

const vyoAccent = (fp, info) => info.area === "area:tools/lib/fields";
const vyoLayer = (fp, info) => {
  if (info.area === "area:tools") return 0;
  if (info.area === "area:tools/lib/fields") return 1;
  if (info.area === "area:tools/lib") return 2;
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
  if (
    info.area === "area:src/flask/sansio" ||
    [
      "src/flask/app.py",
      "src/flask/ctx.py",
      "src/flask/wrappers.py",
      "src/flask/blueprints.py",
      "src/flask/globals.py",
      "src/flask/signals.py",
    ].includes(fp)
  ) {
    return 1;
  }
  if (info.area === "area:src/flask" || info.area === "area:src/flask/json") return 2;
  return 3;
};

const TARGETS = [
  {
    id: "vyo-signal-mosaic",
    mode: "signal-mosaic",
    factsPath: VYO_FACTS,
    title: ["VYO", "POSTER ENGINE"],
    subtitle: ["ONE SHEET THAT", "PEOPLE WHO DO NOT", "CODE CAN READ"],
    accentCoreName: "THE DRAWING ENGINE",
    colophonName: "VYO",
    isAccent: vyoAccent,
    classifyLayer: vyoLayer,
    phrases: VYO_PHRASES,
    dewWords: VYO_DEW,
  },
  {
    id: "flask-signal-mosaic",
    mode: "signal-mosaic",
    factsPath: FLASK_FACTS,
    title: ["FLASK", "WEB CORE"],
    subtitle: ["A WEB APP FROM", "ONE SMALL FILE,", "GROWN AS NEEDED"],
    accentCoreName: "REQUEST CORE",
    colophonName: "FLASK",
    isAccent: flaskAccent,
    classifyLayer: flaskLayer,
    phrases: FLASK_PHRASES,
    dewWords: FLASK_DEW,
  },
  {
    id: "vyo-bloom-strata",
    mode: "bloom-strata",
    factsPath: VYO_FACTS,
    title: ["VYO", "POSTER ENGINE"],
    subtitle: ["ONE SHEET THAT", "PEOPLE WHO DO NOT", "CODE CAN READ"],
    accentCoreName: "THE DRAWING ENGINE",
    colophonName: "VYO",
    isAccent: vyoAccent,
    classifyLayer: vyoLayer,
    phrases: VYO_PHRASES,
    dewWords: VYO_DEW,
  },
  {
    id: "vyo-daylight-strata",
    mode: "daylight-strata",
    factsPath: VYO_FACTS,
    yStart: 0.14,
    brand: "vyo",
    headline: ["Small choices", "draw the bigger picture"],
    daylightColophon: (s) =>
      `red marks the drawing engine · ${s.files} files · ${s.totalLoc.toLocaleString("en-US")} lines`,
    isAccent: vyoAccent,
    classifyLayer: vyoLayer,
    phrases: VYO_PHRASES,
    dewWords: VYO_DEW,
  },
];

function fontDataUri(filename, mime) {
  const buf = fs.readFileSync(path.join(FONTS_DIR, filename));
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function buildHtml(engineCode) {
  const interDisplay = fontDataUri("inter-display-600.woff2", "font/woff2");
  const inter500 = fontDataUri("inter-500.woff2", "font/woff2");
  const commit400 = fontDataUri("commit-400.otf", "font/otf");
  const commit700 = fontDataUri("commit-700.otf", "font/otf");
  const newsreader = fontDataUri("newsreader-400.ttf", "font/ttf");

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
  @font-face {
    font-family: "Newsreader";
    src: url("${newsreader}") format("truetype");
    font-weight: 400;
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
  const engineCode = fs.readFileSync(path.join(HERE, "engine.js"), "utf8");
  const html = buildHtml(engineCode);

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
        document.fonts.load('600 40px "Inter Display"'),
        document.fonts.load('500 47px "Inter"'),
        document.fonts.load('400 18px "Commit Mono"'),
        document.fonts.load('700 14px "Commit Mono"'),
        document.fonts.load('400 12px "Newsreader"'),
      ]);
    });

    for (const target of selected) {
      const t0 = Date.now();
      const model = buildStrataModel(target.factsPath, target);
      const bloomScene =
        target.mode === "bloom-strata" ? buildObsidianBloomScene(target.factsPath) : null;

      const res = await page.evaluate(
        ({ m, b }) => {
          const canvas = document.getElementById("poster");
          let info;
          if (m.mode === "signal-mosaic") {
            info = window.renderSignalMosaic(canvas, m);
          } else if (m.mode === "bloom-strata") {
            info = window.renderBloomStrata(canvas, m, b);
          } else if (m.mode === "daylight-strata") {
            info = window.renderDaylightStrata(canvas, m);
          }

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
        },
        { m: model, b: bloomScene }
      );

      const fullPath = path.join(OUT_DIR, `${target.id}.png`);
      const thumbPath = path.join(OUT_DIR, `${target.id}-thumb.png`);
      saveDataUrl(res.fullUrl, fullPath);
      saveDataUrl(res.thumbUrl, thumbPath);

      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      const kb = (fs.statSync(fullPath).size / 1024).toFixed(0);
      console.log(
        `[${target.id}] ${model.stats.files} files, ${model.stats.totalLoc.toLocaleString()} LOC, ` +
          `${model.stats.imports} imports | slices=${res.info.slices}, microtype=${res.info.placedCount} ` +
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

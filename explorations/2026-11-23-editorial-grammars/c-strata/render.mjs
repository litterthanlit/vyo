#!/usr/bin/env node
// Exploration C (c-strata): Atmospheric Chromatic Strata Book-Cover Grammar
// Usage: node render.mjs [vyo|flask]
// Renders 840x1190 @ 2x DPR (1680x2380px) PNGs + 280px thumbnails into ./out/.

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

const require = createRequire(import.meta.url);
const { chromium } = createRequire(path.join(SKILL, "package.json"))("playwright");

const TARGETS = [
  {
    id: "vyo-strata",
    short: "vyo",
    factsPath: path.resolve(HERE, "../facts/vyo-facts.json"),
    title: ["VYO", "POSTER ENGINE"],
    subtitle: ["ONE SHEET THAT", "PEOPLE WHO DO NOT", "CODE CAN READ"],
    accentCoreName: "THE DRAWING ENGINE",
    colophonName: "VYO",
    isAccent: (fp, info) => info.area === "area:tools/lib/fields",
    classifyLayer: (fp, info) => {
      if (info.area === "area:tools") return 0; // CLI entry
      if (info.area === "area:tools/lib/fields") return 1; // Drawing engine (focal accent core)
      if (info.area === "area:tools/lib") return 2; // Core render/layout/check pipeline
      return 3; // Scanner & examples
    },
  },
  {
    id: "flask-strata",
    short: "flask",
    factsPath: path.join(REPO, "explorations/2026-11-11-punk-covers/c-living/facts/flask-facts.json"),
    title: ["FLASK", "WEB CORE"],
    subtitle: ["A WEB APP FROM", "ONE SMALL FILE,", "GROWN AS NEEDED"],
    accentCoreName: "REQUEST CORE",
    colophonName: "FLASK",
    isAccent: (fp, info) =>
      info.area === "area:src/flask/sansio" ||
      [
        "src/flask/app.py",
        "src/flask/ctx.py",
        "src/flask/wrappers.py",
        "src/flask/blueprints.py",
        "src/flask/globals.py",
      ].includes(fp),
    classifyLayer: (fp, info) => {
      if (fp === "src/flask/__init__.py" || fp === "src/flask/__main__.py") return 0; // Entry
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
        return 1; // Request core (focal accent core)
      }
      if (info.area === "area:src/flask" || info.area === "area:src/flask/json") return 2; // Runtime, CLI, JSON
      return 3; // Examples & docs
    },
  },
];

function fontDataUri(filename, mime) {
  const buf = fs.readFileSync(path.join(FONTS_DIR, filename));
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function buildHtml(synthCode) {
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
    background: #0A0A0D;
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
${synthCode}
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
    ? TARGETS.filter((t) => filter.includes(t.short) || filter.includes(t.id))
    : TARGETS;

  if (!selected.length) {
    console.error("No matching targets. Use: node render.mjs [vyo|flask]");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const synthCode = fs.readFileSync(path.join(HERE, "synth.js"), "utf8");
  const html = buildHtml(synthCode);

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
      // Trigger font loads explicitly so Canvas sees every face immediately
      await Promise.all([
        document.fonts.load('600 40px "Inter Display"'),
        document.fonts.load('400 18px "Commit Mono"'),
        document.fonts.load('700 15px "Commit Mono"'),
        document.fonts.load('400 12px "Newsreader"'),
      ]);
    });

    for (const target of selected) {
      const t0 = Date.now();
      const model = buildStrataModel(target.factsPath, target);

      const res = await page.evaluate((m) => {
        const canvas = document.getElementById("poster");
        const info = window.renderStrataPoster(canvas, m);
        const fullUrl = canvas.toDataURL("image/png");

        // Crisp 2-step high-quality downscale to 280px wide thumbnail (280 x 397)
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
        `[${target.id}] ${model.stats.files} files, ${model.stats.totalLoc.toLocaleString()} lines, ` +
          `${model.stats.imports} imports, ${res.info.slices} slices -> ${fullPath} (${kb} KB, ${elapsed}s)`
      );
      console.log(
        `  copy: "${model.copy.title.join(" / ")}" | "${model.copy.accentLine}" | "${model.copy.colophon}"`
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

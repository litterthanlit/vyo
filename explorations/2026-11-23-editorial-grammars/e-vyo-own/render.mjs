#!/usr/bin/env node
// Exploration E (e-vyo-own): Vyo's Own Original Signature Grammar
// Renders 4 bespoke agent-drawn visual-explanation posters (840x1190 @ 2x DPR = 1680x2380px)
// + 280px thumbnails across 4 real repos & 4 original Vyo palettes:
//   01. out/vyo-own.png     (sumi   — obsidian ink + glacier slate + Japanese vermilion)
//   02. out/flask-own.png   (washi  — warm archival paper + mineral indigo + vermilion)
//   03. out/pantry-own.png  (cobalt — archival chalk + charcoal ink + electric Klein cobalt)
//   04. out/hypher-own.png  (pine   — deep night-forest + celadon silver + molten amber-vermilion)
//
// Usage: node render.mjs [id...]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildStrataModel } from "./strata-data.mjs";
import { SCENES_BY_ID } from "./scenes.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const SKILL = path.join(REPO, ".cursor/skills/vyo");
const FONTS_DIR = path.join(SKILL, "fonts");
const OUT_DIR = path.join(HERE, "out");

const { chromium } = createRequire(path.join(SKILL, "package.json"))("playwright");

const FACTS_BASE = path.join(REPO, "explorations/2026-11-11-punk-covers/c-living/facts");

const TARGETS = [
  {
    id: "vyo-own",
    sheetIndex: "01",
    productName: "VYO",
    repoName: "litterthanlit/vyo",
    factsPath: path.resolve(HERE, "../facts/vyo-facts.json"),
    headline: ["Code turned into", "one sheet anyone can read."],
    legendColorWord: "vermilion",
    legendSubject: "the drawing engine",
    isAccent: (fp, info) => info.area === "area:tools/lib/fields",
    classifyLayer: (fp, info) => {
      if (info.area === "area:tools") return 0;
      if (info.area === "area:tools/lib/fields") return 1;
      if (info.area === "area:tools/lib") return 2;
      return 3;
    },
  },
  {
    id: "flask-own",
    sheetIndex: "02",
    productName: "FLASK",
    repoName: "pallets/flask",
    factsPath: path.join(FACTS_BASE, "flask-facts.json"),
    headline: ["One small file,", "grown only as far as you need."],
    legendColorWord: "vermilion",
    legendSubject: "the request core",
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
    },
  },
  {
    id: "pantry-own",
    sheetIndex: "03",
    productName: "PANTRY",
    repoName: "pantry",
    factsPath: path.join(FACTS_BASE, "pantry-facts.json"),
    headline: ["A week of dinners,", "planned in one go."],
    legendColorWord: "cobalt",
    legendSubject: "the weekly plan",
    isAccent: (fp, info) =>
      info.area === "area:lib/plan" ||
      info.area === "area:components/plan" ||
      info.area === "area:lib/ai",
    classifyLayer: (fp, info) => {
      if (info.area === "area:app" || info.area === "area:app/(app)") return 0;
      if (
        info.area === "area:lib/plan" ||
        info.area === "area:components/plan" ||
        info.area === "area:lib/ai"
      ) {
        return 1;
      }
      if (
        info.area === "area:components/recipes" ||
        info.area === "area:lib/recipes" ||
        info.area === "area:app/(app)/recipes"
      ) {
        return 2;
      }
      return 3;
    },
  },
  {
    id: "hypher-own",
    sheetIndex: "04",
    productName: "HYPHER",
    repoName: "hypher",
    factsPath: path.join(FACTS_BASE, "hypher-facts.json"),
    headline: ["Switch coding agents", "without starting over."],
    legendColorWord: "amber",
    legendSubject: "the handoff bridge",
    isAccent: (fp, info) =>
      info.area === "area:hypher-web/shared" ||
      info.area === "area:script/baton" ||
      info.area === "area:packages/core/src" ||
      fp.includes("Handoff") ||
      fp.includes("handoff"),
    classifyLayer: (fp, info) => {
      if (
        info.area === "area:packages/hypher-cli/src" ||
        info.area === "area:packages/hypher-cli/src/commands" ||
        info.area === "area:extensions/cursor/scripts"
      ) {
        return 0;
      }
      if (
        info.area === "area:hypher-web/shared" ||
        info.area === "area:script/baton" ||
        info.area === "area:packages/core/src"
      ) {
        return 1;
      }
      if (
        info.area === "area:hypher-web/convex" ||
        info.area === "area:hypher-web/convex/lib" ||
        info.area === "area:hypher-web/src/lib"
      ) {
        return 2;
      }
      return 3;
    },
  },
];

function fontDataUri(filename, mime) {
  const buf = fs.readFileSync(path.join(FONTS_DIR, filename));
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function buildHtml(engineCode) {
  const newsreader = fontDataUri("newsreader-400.ttf", "font/ttf");
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
    font-family: "Newsreader";
    src: url("${newsreader}") format("truetype");
    font-weight: 400;
    font-style: normal;
  }
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
    background: #0B0C10;
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
        document.fonts.load('400 52px "Newsreader"'),
        document.fonts.load('400 10px "Commit Mono"'),
        document.fonts.load('700 9px "Commit Mono"'),
        document.fonts.load('600 20px "Inter Display"'),
        document.fonts.load('500 20px "Inter"'),
      ]);
    });

    for (const target of selected) {
      const t0 = Date.now();
      const model = buildStrataModel(target.factsPath, target);
      const scene = SCENES_BY_ID[target.id];
      if (!scene) throw new Error(`Missing scene for target ${target.id}`);

      const res = await page.evaluate(
        async ({ m, s, p }) => {
          const canvas = document.getElementById("poster");
          const info = await window.renderVyoPoster(canvas, m, s, p);
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
        { m: model, s: scene, p: scene.palette }
      );

      const fullPath = path.join(OUT_DIR, `${target.id}.png`);
      const thumbPath = path.join(OUT_DIR, `${target.id}-thumb.png`);
      saveDataUrl(res.fullUrl, fullPath);
      saveDataUrl(res.thumbUrl, thumbPath);

      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      const kb = (fs.statSync(fullPath).size / 1024).toFixed(0);
      console.log(
        `[${target.id}] palette=${scene.palette.name} | ${model.stats.files} files, ` +
          `${model.stats.totalLoc.toLocaleString()} LOC, ${model.stats.imports} imports | ` +
          `slices=${res.info.slices}, faults=${res.info.faultRows}, cells=${res.info.cellsDrawn}, ` +
          `callouts=${res.info.calloutsPlaced}/${res.info.calloutsRequested} -> ${fullPath} (${kb} KB, ${elapsed}s)`
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

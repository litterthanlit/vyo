// Exploration A: Pixel-Mosaic Botanical Editorial Posters (a-mosaic)
// Usage: node render.mjs
// Renders out/vyo-mosaic.png, out/vyo-mosaic-thumb.png, out/flask-mosaic.png, out/flask-mosaic-thumb.png

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { analyzeCodebase, buildBotanicalScene } from "./botany.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const SKILL = path.join(REPO, ".cursor/skills/vyo");
const OUT = path.join(HERE, "out");
fs.mkdirSync(OUT, { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try {
    return require("playwright");
  } catch {
    return createRequire(path.join(SKILL, "package.json"))("playwright");
  }
})();

const fontUri = (file, mime) =>
  `data:${mime};base64,${fs.readFileSync(path.join(SKILL, "fonts", file)).toString("base64")}`;

const FONTS = {
  inter500: fontUri("inter-500.woff2", "font/woff2"),
  interDisplay600: fontUri("inter-display-600.woff2", "font/woff2"),
  commit400: fontUri("commit-400.otf", "font/otf"),
  commit700: fontUri("commit-700.otf", "font/otf"),
};

const MOSAIC_SCRIPT = fs.readFileSync(path.join(HERE, "mosaic.js"), "utf8");

// Real codebase poster specifications (zero hardcoded counts!)
const POSTERS = [
  {
    id: "vyo",
    factsPath: path.resolve(HERE, "../facts/vyo-facts.json"),
    brand: "vyo",
    headline: ["Small choices", "draw the bigger picture"],
    colophon: (s) =>
      `red marks the drawing engine · ${s.fileCount} files · ${s.totalLoc.toLocaleString("en-US")} lines`,
    classify(file) {
      if (file.path.startsWith("tools/lib/fields/")) {
        if (file.name.startsWith("shape")) return "accentPrimary";
        return "accentSecondary";
      }
      if (file.path.startsWith("tools/lib/scan/") || file.path.startsWith("examples/")) {
        return "canopy";
      }
      return "foliage";
    },
    phrases: [
      "scan the code",
      "plain words",
      "leave room",
      "no network",
      "check the margin",
      "read the tree",
      "make it plain",
      "cut the noise",
      "every line counts",
      "light and shadow",
      "quiet ground",
      "real imports",
      "open sky",
      "true scale",
      "one picture",
      "small choices",
      "trace the graph",
      "shape the field",
      "hold the air",
      "keep it clear",
      "from the tree",
      "find the core",
      "draw it calm",
      "clean grain",
    ],
    shortCorePhrases: [
      "drawing engine",
      "the relief",
      "shape rings",
      "one sheet",
      "chords",
      "mask grid",
      "contours",
      "field wave",
      "light & shade",
      "surface",
      "real code",
      "every line",
      "by hand",
      "true form",
    ],
    dewWords: [
      "scan",
      "tree",
      "code",
      "line",
      "calm",
      "form",
      "grid",
      "edge",
      "leaf",
      "pure",
      "ring",
      "part",
      "open",
      "read",
    ],
    layout: {
      // Multi-stemmed garden spray rooted broadly across bottom edge, sweeping to top-right
      hero1: [248, 576],
      hero1Scale: 1.0,
      hero1Tilt: -0.32,
      hero1PetalOffset: 0.08,
      hero2: [734, 968], // bleeds cleanly off the right edge!
      hero2Scale: 1.04,
      hero2Tilt: 0.16,
      hero2PetalOffset: -0.14,
      canopy: [452, 378],
      canopyScale: 1.02,
      canopyTilt: -0.22,
      midRight: [652, 748],
      midRightScale: 0.96,
      tendrilRootRange: [130, 620],
      mainLeftStem: [
        [168, 1235],
        [152, 995],
        [158, 782],
        [232, 622],
      ],
      leftArchStem: [
        [156, 1238],
        [136, 1020],
        [102, 858],
        [96, 738],
      ],
      centerLeafStem: [
        [252, 1245],
        [288, 1062],
        [322, 912],
        [298, 756],
      ],
      rightSweepStem: [
        [524, 1240],
        [566, 1060],
        [598, 908],
        [642, 792],
      ],
      hero2Stem: [
        [588, 1238],
        [644, 1130],
        [682, 1055],
        [718, 1002],
      ],
      canopyStem: [
        [362, 1245],
        [376, 965],
        [394, 662],
        [442, 428],
      ],
      panicleSpine: [
        [382, 865],
        [482, 692],
        [598, 498],
        [698, 262],
      ],
      panicleSpine2: [
        [452, 995],
        [572, 812],
        [684, 606],
        [794, 368],
      ],
      // Natural splayed botanical rose/peony leaf spray (varied angles, broad cupped blades!)
      foliageClusters: [
        { x: 266, y: 848, angle: -2.08, len: 132, wid: 56, curve: -0.26, tone: "slate", depth: 1.5 },
        { x: 288, y: 888, angle: -1.12, len: 138, wid: 60, curve: 0.24, tone: "slate", depth: 1.6 },
        { x: 242, y: 958, angle: -2.32, len: 134, wid: 58, curve: -0.30, tone: "slate", depth: 1.4 },
        { x: 306, y: 966, angle: -0.88, len: 128, wid: 54, curve: 0.28, tone: "slate", depth: 1.3 },
        { x: 212, y: 1038, angle: -1.96, len: 144, wid: 62, curve: -0.22, tone: "slate", depth: 1.5 },
        { x: 284, y: 1068, angle: -1.24, len: 138, wid: 58, curve: 0.20, tone: "slate", depth: 1.4 },
        { x: 158, y: 946, angle: -2.52, len: 112, wid: 48, curve: -0.34, tone: "slate", depth: 1.2 },
        { x: 344, y: 878, angle: -0.78, len: 114, wid: 46, curve: 0.30, tone: "mist", depth: 0.3 },
        { x: 218, y: 1152, angle: -1.52, len: 124, wid: 54, curve: -0.14, tone: "slate", depth: 1.5 },
        { x: 356, y: 1118, angle: -1.05, len: 116, wid: 48, curve: 0.26, tone: "mist", depth: 0.2 },
      ],
      buds: [
        { x: 96, y: 738, angle: -1.72, size: 50, hasCrimsonPeek: false, stemFrom: [132, 855] },
        { x: 488, y: 540, angle: -1.32, size: 52, hasCrimsonPeek: false, stemFrom: [446, 648] },
        { x: 482, y: 882, angle: -1.45, size: 40, hasCrimsonPeek: false, stemFrom: [448, 972] },
        { x: 446, y: 1072, angle: -1.48, size: 46, hasCrimsonPeek: true, stemFrom: [420, 1188] },
      ],
    },
  },
  {
    id: "flask",
    factsPath: path.join(REPO, "explorations/2026-11-11-punk-covers/c-living/facts/flask-facts.json"),
    brand: "flask",
    headline: ["One small file,", "grown as far as you need"],
    colophon: (s) =>
      `red marks the request & app core · ${s.fileCount} files · ${s.totalLoc.toLocaleString("en-US")} lines`,
    classify(file) {
      if (
        file.path === "src/flask/app.py" ||
        file.path === "src/flask/ctx.py" ||
        file.path === "src/flask/wrappers.py" ||
        file.path === "src/flask/sessions.py" ||
        file.path === "src/flask/blueprints.py"
      ) {
        return "accentPrimary";
      }
      if (file.path.startsWith("src/flask/sansio/")) {
        return "accentSecondary";
      }
      if (file.path.startsWith("src/flask/json/") || file.path.startsWith("examples/")) {
        return "canopy";
      }
      return "foliage";
    },
    phrases: [
      "one small file",
      "route a path",
      "render a page",
      "session cookie",
      "keep it small",
      "grow on demand",
      "cli commands",
      "clean replies",
      "json provider",
      "dispatch rule",
      "simple views",
      "start small",
      "send response",
      "thin layer",
      "plain flask",
      "url builder",
      "template hook",
      "signal hook",
      "test client",
      "local proxy",
      "cookie signer",
      "view helper",
      "error handler",
      "static route",
    ],
    shortCorePhrases: [
      "request core",
      "sansio core",
      "app context",
      "blueprints",
      "url map",
      "sessions",
      "scaffold",
      "wrappers",
      "wsgi app",
      "routing",
      "one file",
      "pure core",
      "dispatch",
      "context",
    ],
    dewWords: [
      "route",
      "view",
      "app",
      "path",
      "json",
      "hook",
      "core",
      "page",
      "grow",
      "thin",
      "task",
      "blog",
      "send",
      "rule",
    ],
    layout: {
      // Stately SINGLE-ORIGIN rising stem ("One small file, grown as far as you need")!
      // All primary stems emerge from one graceful slender root trunk near bottom-center-left and unfurl!
      hero1: [256, 514],
      hero1Scale: 0.94,
      hero1Tilt: -0.18,
      hero1PetalOffset: 0.42,
      hero2: [738, 892], // positioned higher and sweeping cleanly off the right edge!
      hero2Scale: 0.96,
      hero2Tilt: 0.30,
      hero2PetalOffset: -0.35,
      canopy: [544, 384], // shifted further right & higher for distinct silhouette!
      canopyScale: 0.96,
      canopyTilt: -0.10,
      midRight: [662, 654],
      midRightScale: 0.90,
      tendrilRootRange: [255, 420], // converges tightly toward the single root origin!
      mainLeftStem: [
        [292, 1248],
        [258, 1020],
        [216, 775],
        [246, 566],
      ],
      leftArchStem: [
        [282, 1242],
        [218, 1030],
        [142, 845],
        [118, 695],
      ],
      centerLeafStem: [
        [308, 1248],
        [314, 1055],
        [332, 885],
        [356, 738],
      ],
      rightSweepStem: [
        [336, 1245],
        [458, 1052],
        [562, 868],
        [648, 694],
      ],
      hero2Stem: [
        [354, 1248],
        [515, 1118],
        [626, 1018],
        [716, 926],
      ],
      canopyStem: [
        [318, 1248],
        [366, 958],
        [446, 658],
        [530, 434],
      ],
      panicleSpine: [
        [388, 842],
        [512, 658],
        [632, 464],
        [734, 242],
      ],
      panicleSpine2: [
        [485, 968],
        [612, 782],
        [716, 568],
        [814, 344],
      ],
      // Leaner, gracefully arching leaf fan rising from the slender central origin
      foliageClusters: [
        { x: 262, y: 816, angle: -2.26, len: 132, wid: 52, curve: -0.28, tone: "slate", depth: 1.5 },
        { x: 318, y: 856, angle: -0.96, len: 138, wid: 54, curve: 0.24, tone: "slate", depth: 1.6 },
        { x: 256, y: 924, angle: -2.42, len: 128, wid: 50, curve: -0.32, tone: "slate", depth: 1.4 },
        { x: 334, y: 944, angle: -0.78, len: 124, wid: 48, curve: 0.26, tone: "slate", depth: 1.3 },
        { x: 274, y: 1028, angle: -2.14, len: 134, wid: 52, curve: -0.24, tone: "slate", depth: 1.5 },
        { x: 332, y: 1048, angle: -1.04, len: 126, wid: 50, curve: 0.20, tone: "slate", depth: 1.4 },
        { x: 196, y: 878, angle: -2.58, len: 106, wid: 42, curve: -0.34, tone: "slate", depth: 1.2 },
        { x: 384, y: 842, angle: -0.68, len: 108, wid: 40, curve: 0.26, tone: "mist", depth: 0.3 },
      ],
      buds: [
        { x: 118, y: 695, angle: -1.86, size: 46, hasCrimsonPeek: false, stemFrom: [162, 810] },
        { x: 458, y: 582, angle: -1.24, size: 46, hasCrimsonPeek: false, stemFrom: [426, 682] },
        { x: 518, y: 1062, angle: -1.22, size: 44, hasCrimsonPeek: true, stemFrom: [462, 1172] },
      ],
    },
  },
];

function buildHtml(scene) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: "Inter";
    font-weight: 500;
    src: url("${FONTS.inter500}") format("woff2");
  }
  @font-face {
    font-family: "Inter Display";
    font-weight: 600;
    src: url("${FONTS.interDisplay600}") format("woff2");
  }
  @font-face {
    font-family: "Commit Mono";
    font-weight: 400;
    src: url("${FONTS.commit400}") format("opentype");
  }
  @font-face {
    font-family: "Commit Mono";
    font-weight: 700;
    src: url("${FONTS.commit700}") format("opentype");
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 840px;
    height: 1190px;
    overflow: hidden;
    background: #F1F3F6;
  }
  canvas {
    display: block;
    width: 840px;
    height: 1190px;
  }
</style>
</head>
<body>
<canvas id="poster"></canvas>
<script>
${MOSAIC_SCRIPT}
</script>
<script>
  window.__SCENE__ = ${JSON.stringify(scene)};
</script>
</body>
</html>`;
}

async function makeThumb(page, pngPath, thumbPath, thumbW = 280) {
  const b64 = fs.readFileSync(pngPath).toString("base64");
  const thumbH = Math.round((thumbW * 1190) / 840);
  const dataUrl = await page.evaluate(
    async ({ b64, thumbW, thumbH }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = thumbW;
      c.height = thumbH;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, thumbW, thumbH);
      return c.toDataURL("image/png");
    },
    { b64, thumbW, thumbH }
  );
  const raw = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
  fs.writeFileSync(thumbPath, raw);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.VYO_CHROMIUM || "/usr/bin/google-chrome",
    headless: true,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 840, height: 1190 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    for (const cfg of POSTERS) {
      const rawJson = JSON.parse(fs.readFileSync(cfg.factsPath, "utf8"));
      const analysis = analyzeCodebase(rawJson, cfg);
      const scene = buildBotanicalScene(analysis, cfg);

      await page.setContent(buildHtml(scene), { waitUntil: "load" });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const report = await page.evaluate(() => window.renderMosaicPoster(window.__SCENE__));
      const outPng = path.join(OUT, `${cfg.id}-mosaic.png`);
      const outThumb = path.join(OUT, `${cfg.id}-mosaic-thumb.png`);

      await page.screenshot({ path: outPng, type: "png" });
      await makeThumb(page, outPng, outThumb, 280);

      console.log(
        `Rendered ${cfg.id}: ${outPng} (${analysis.stats.fileCount} files, ${analysis.stats.totalLoc} LOC, ` +
          `accent=${analysis.stats.accentTotalLoc} LOC, microtype=${report.placedCount} [dew=${report.dewPlaced}, mist=${report.mistPlaced}, core=${report.corePlaced}])`
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

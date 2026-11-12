// Contour shape field. Usage: node render.mjs <config.json> [more configs...]
// Writes <config>.png (840x1190 at 2x), <config>-thumb.png (280px wide) and <config>.html beside each config,
// and prints the checks and an ASCII sketch of the sheet.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { partsFromFacts, accentIds } from "../../../.cursor/skills/vyo/tools/lib/parts.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(HERE, "../../../.cursor/skills/vyo/fonts");
const { chromium } = createRequire(import.meta.url)("playwright");

const THEMES = {
  light: { paper: "#EAE8E2", ink: "#161616", soft: "#8E8C84", mid: "#55534D", cold: "#A9B8C8", cool: "#5F7389", hot: "#FF4F12" },
  dark: { paper: "#0E1424", ink: "#ECEEF2", soft: "#4F5A74", mid: "#97A0B6", cold: "#2F3B57", cool: "#5C6C8F", hot: "#FF5A1F" },
};

// The shape format: what each primitive needs. Validated here so an author gets the op's index and the missing key.
const KINDS = {
  circle: { at: "point", r: "num" },
  ellipse: { at: "point", r: "point" },
  rect: { at: "point", size: "point" },
  capsule: { from: "point", to: "point", r: "num" },
  arc: { at: "point", r: "num", from: "num", to: "num", width: "num" },
  polygon: { points: "points" },
  path: { d: "string" },
};
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const TYPES = {
  num: isNum,
  point: (v) => Array.isArray(v) && v.length === 2 && v.every(isNum),
  points: (v) => Array.isArray(v) && v.length >= 3 && v.every((p) => TYPES.point(p)),
  string: (v) => typeof v === "string" && v.trim().length > 0,
};

function parseShape(shape) {
  const errors = [];
  if (!TYPES.point(shape?.view) || shape.view.some((n) => n <= 0)) errors.push("shape.view must be [width, height], both > 0");
  if (!Array.isArray(shape?.ops) || !shape.ops.length) errors.push("shape.ops must be a non-empty list");
  for (const [i, op] of (shape?.ops ?? []).entries()) {
    const verbs = ["add", "cut"].filter((v) => v in op);
    if (verbs.length !== 1) {
      errors.push(`ops[${i}]: needs exactly one of "add" or "cut"`);
      continue;
    }
    const kind = op[verbs[0]];
    if (!KINDS[kind]) {
      errors.push(`ops[${i}]: unknown kind "${kind}" (one of ${Object.keys(KINDS).join(", ")})`);
      continue;
    }
    for (const [key, type] of Object.entries(KINDS[kind])) if (!TYPES[type](op[key])) errors.push(`ops[${i}] ${kind}: "${key}" must be a ${type}`);
    if ("round" in op && !isNum(op.round)) errors.push(`ops[${i}]: "round" must be a number`);
  }
  if (!ops0IsAdd(shape)) errors.push("ops[0] must be an add: a cut on an empty sheet removes nothing");
  if (errors.length) throw new Error(`shape is invalid:\n  ${errors.join("\n  ")}`);
  return shape;
}
const ops0IsAdd = (shape) => !shape?.ops?.length || "add" in shape.ops[0];

const LONG_DATE = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function pageData(cfg, cfgDir) {
  const shape = parseShape(cfg.shape);
  const facts = JSON.parse(fs.readFileSync(path.resolve(cfgDir, cfg.facts), "utf8"));
  const parts = partsFromFacts(facts, { names: cfg.names, maxParts: cfg.maxParts ?? 10 });
  const hot = accentIds(parts, cfg.accent);
  if (!hot.size) throw new Error(`accent "${cfg.accent}" names no part (parts: ${parts.map((p) => p.id).join(", ")})`);
  const missing = parts.filter((p) => !cfg.names?.[p.id]).map((p) => p.id);
  if (missing.length) throw new Error(`names missing for ${missing.join(", ")}`);
  return {
    product: cfg.product,
    headline: cfg.headline,
    legend: cfg.legend,
    record: `${cfg.product} at ${cfg.commit}, ${LONG_DATE(cfg.date)}. Drawn by Vyo`,
    theme: THEMES[cfg.theme],
    // Soft hairlines read twice as dark on paper as on navy.
    echoInk: cfg.theme === "light" ? 0.5 : 1,
    shape,
    rings: { gap: 7, size: 6.6, round: 12, order: "tree", ...cfg.rings },
    parts: parts.map((p) => ({ id: p.id, name: p.name.toLowerCase(), loc: p.loc, hot: hot.has(p.id) })),
  };
}

const b64 = (f) => fs.readFileSync(path.join(FONT_DIR, f)).toString("base64");
const FONTS = `
@font-face{font-family:"Commit Mono";font-weight:400;src:url(data:font/otf;base64,${b64("commit-400.otf")})}
@font-face{font-family:"Commit Mono";font-weight:700;src:url(data:font/otf;base64,${b64("commit-700.otf")})}
@font-face{font-family:"Newsreader";font-weight:400;src:url(data:font/ttf;base64,${b64("newsreader-400.ttf")})}`;

const page = (data) => `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
* { box-sizing: border-box; margin: 0; padding: 0 }
:root { ${Object.entries(data.theme).map(([k, v]) => `--${k}:${v}`).join(";")} }
html, body { background: var(--paper) }
.sheet { position: relative; width: 840px; height: 1190px; overflow: hidden; background: var(--paper); color: var(--ink); font-family: "Commit Mono", monospace }
.t { position: absolute; z-index: 1 }
svg { position: absolute; left: 0; top: 0 }
</style></head><body><div class="sheet"></div>
<script>${fs.readFileSync(path.join(HERE, "page.js"), "utf8")}</script></body></html>`;

const browser = await chromium.launch(process.env.VYO_CHROMIUM ? { executablePath: process.env.VYO_CHROMIUM } : {});
let failed = false;
try {
  for (const file of process.argv.slice(2)) {
    const cfgPath = path.resolve(file);
    const base = cfgPath.replace(/\.json$/, "");
    let data;
    try {
      data = pageData(JSON.parse(fs.readFileSync(cfgPath, "utf8")), path.dirname(cfgPath));
    } catch (e) {
      console.log(`✗ ${path.basename(file)}: ${e.message}`);
      failed = true;
      continue;
    }
    const html = page(data);
    fs.writeFileSync(`${base}.html`, html);
    const tab = await browser.newPage({ viewport: { width: 840, height: 1190 }, deviceScaleFactor: 2 });
    const errors = [];
    tab.on("pageerror", (e) => errors.push(e.message));
    await tab.setContent(html, { waitUntil: "load" });
    const report = await tab.evaluate((d) => window.draw(d), data);
    const shot = await tab.locator(".sheet").screenshot({ path: `${base}.png` });
    await tab.close();
    const thumb = await browser.newPage({ viewport: { width: 280, height: 397 }, deviceScaleFactor: 1 });
    await thumb.setContent(`<body style="margin:0"><img width="280" height="397" style="display:block" src="data:image/png;base64,${shot.toString("base64")}">`);
    await thumb.waitForFunction(() => document.images[0].complete);
    await thumb.screenshot({ path: `${base}-thumb.png` });
    await thumb.close();
    const bad = [...errors.map((e) => `✗ page error: ${e}`), ...report.checks.filter((c) => c.startsWith("✗"))];
    failed ||= bad.length > 0;
    console.log(`\n${path.basename(base)}: ${report.rings} rings at ${report.gap}px, ${report.loops} loops`);
    console.log(report.bands.map((b) => `  ${b.hot ? "*" : " "} ${b.name.padEnd(20)} ${String(b.loc).padStart(6)} lines  ${b.rings} rings`).join("\n"));
    console.log([...errors.map((e) => `✗ page error: ${e}`), ...report.checks].join("\n"));
    console.log(report.ascii);
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);

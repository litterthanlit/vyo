// Relief shape field prototype. Usage: node render.mjs <config.json> [...]  -> out/<config>.png (2x), out/<config>-thumb.png (280px wide)
// A config names a facts file, the words, the theme and a shape (see README.md). The page rasterises the shape,
// lights it as a rounded volume and sets every glyph cell inside it with the plain name of the part that owns it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { regionParts } from "../../../.cursor/skills/vyo/tools/lib/parts.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(HERE, "../../../.cursor/skills/vyo/fonts");
const { chromium } = createRequire(import.meta.url)("playwright");

const THEMES = {
  light: { paper: "#EAE8E2", ink: "#161616", soft: "#8E8C84", mid: "#55534D", cool: "#5F7389", hot: "#FF4F12" },
  dark: { paper: "#0E1424", ink: "#ECEEF2", soft: "#4F5A74", mid: "#97A0B6", cool: "#5C6C8F", hot: "#FF5A1F" },
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const b64 = (f) => fs.readFileSync(path.join(FONT_DIR, f)).toString("base64");
const FONTS = `
@font-face{font-family:"Commit Mono";font-weight:400;src:url(data:font/otf;base64,${b64("commit-400.otf")})}
@font-face{font-family:"Commit Mono";font-weight:700;src:url(data:font/otf;base64,${b64("commit-700.otf")})}
@font-face{font-family:"Newsreader";font-weight:400;src:url(data:font/ttf;base64,${b64("newsreader-400.ttf")})}`;

function pageData(cfgPath) {
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const facts = JSON.parse(fs.readFileSync(path.resolve(path.dirname(cfgPath), cfg.facts), "utf8"));
  const parts = regionParts({ accent: cfg.accent, names: cfg.names }, facts);
  const missing = parts.filter((p) => !cfg.names[p.id]).map((p) => p.id);
  if (missing.length) throw new Error(`${cfgPath}: no plain name for ${missing.join(", ")}`);
  if (!parts.some((p) => p.hot)) throw new Error(`${cfgPath}: accent ${cfg.accent} names no part`);
  const [y, m, d] = cfg.date.split("-").map(Number);
  return {
    theme: { ...THEMES[cfg.theme] },
    themeName: cfg.theme,
    name: cfg.product,
    headline: cfg.headline,
    legend: cfg.legend,
    record: `${cfg.product} at ${cfg.commit}, ${d} ${MONTHS[m - 1]} ${y}. Drawn by Vyo`,
    parts: parts.map((p) => ({ name: p.name.toLowerCase(), loc: p.loc, hot: p.hot })),
    shape: typeof cfg.shape === "string" ? JSON.parse(fs.readFileSync(path.resolve(path.dirname(cfgPath), cfg.shape), "utf8")) : cfg.shape,
    type: { size: 6, ...cfg.type },
  };
}

const page = (data) => `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
* { box-sizing: border-box; margin: 0; padding: 0 }
:root { ${Object.entries(data.theme).map(([k, v]) => `--${k}:${v}`).join(";")} }
html, body { background: var(--paper) }
.sheet { position: relative; width: 840px; height: 1190px; overflow: hidden; background: var(--paper); color: var(--ink); font-family: "Commit Mono", monospace }
canvas { position: absolute; left: 0; top: 0; width: 840px; height: 1190px }
.t { position: absolute; visibility: hidden }
.label { font-size: 13px; line-height: 16px; letter-spacing: .17em; white-space: nowrap }
.headline { font-family: "Newsreader", serif; letter-spacing: -.01em }
.legend { font-family: "Newsreader", serif; font-size: 15px; line-height: 21px }
.record { font-size: 10px; line-height: 10px; letter-spacing: .4px; color: var(--mid); white-space: nowrap }
</style></head><body><div class="sheet"><canvas id="c" width="1680" height="2380"></canvas>
<div class="t label" id="label"></div><div class="t headline" id="headline"></div><div class="t legend" id="legend"></div><div class="t record" id="record"></div>
</div><script>window.DATA = ${JSON.stringify(data).replace(/</g, "\\u003c")};</script><script src="field.js"></script></body></html>`;

const args = process.argv.slice(2);
const configs = args.length ? args : fs.readdirSync(path.join(HERE, "configs")).filter((f) => f.endsWith(".json")).map((f) => path.join("configs", f));
const field = fs.readFileSync(path.join(HERE, "field.js"), "utf8");
fs.mkdirSync(path.join(HERE, "out"), { recursive: true });
const browser = await chromium.launch(process.env.VYO_CHROMIUM ? { executablePath: process.env.VYO_CHROMIUM } : {});
let failed = false;
for (const c of configs) {
  const cfgPath = path.resolve(HERE, c);
  const base = path.join(HERE, "out", path.basename(c, ".json"));
  const html = page(pageData(cfgPath)).replace('<script src="field.js"></script>', `<script>${field}</script>`);
  fs.writeFileSync(`${base}.html`, html);
  const p = await browser.newPage({ viewport: { width: 840, height: 1190 }, deviceScaleFactor: 2 });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.setContent(html, { waitUntil: "load" });
  await p.waitForFunction(() => window.report, null, { timeout: 30000 }).catch(() => errors.push("page never drew"));
  const report = (await p.evaluate(() => window.report)) ?? { problems: [] };
  const shot = await p.locator(".sheet").screenshot({ path: `${base}.png` });
  await p.close();
  const t = await browser.newPage({ viewport: { width: 280, height: 397 }, deviceScaleFactor: 1 });
  await t.setContent(`<body style="margin:0"><img width="280" height="397" style="display:block" src="data:image/png;base64,${shot.toString("base64")}">`);
  await t.waitForFunction(() => document.images[0].complete);
  await t.screenshot({ path: `${base}-thumb.png` });
  await t.close();
  const problems = [...errors, ...report.problems];
  failed ||= problems.length > 0;
  console.log(`${path.basename(base)}: ${problems.length ? problems.map((x) => `✗ ${x}`).join("; ") : "ok"}`);
  for (const line of report.notes ?? []) console.log(`  ${line}`);
}
await browser.close();
process.exit(failed ? 1 : 0);

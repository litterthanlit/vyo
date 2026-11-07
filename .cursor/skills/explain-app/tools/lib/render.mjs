// spec + facts -> one self-contained HTML page, then PNG (2x) and PDF through Playwright.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { hasWord, TEXT_SIZE } from "./spec.mjs";
import { SHEET } from "./geometry.mjs";
import { bandCounts, bandLine, provenance } from "./band.mjs";
import { regionParts } from "./parts.mjs";

const TOOLS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FONT_DIR = path.join(TOOLS, "fonts");
const FONTS = [
  ["Commit Mono", 400, "commit-400.otf", "font/otf"],
  ["Commit Mono", 700, "commit-700.otf", "font/otf"],
  ["Newsreader", 400, "newsreader-400.ttf", "font/ttf"],
];
export const FONT_FACES = FONTS.map(([family, weight]) => ({ family, weight }));
const MAST_FONT = `"Inter Display", Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
export { SHEET };

// Theme tokens. Rows, dots and texts use only these; `accent` replaces hot.
export const THEMES = {
  light: { paper: "#EAE8E2", ink: "#161616", soft: "#8E8C84", mid: "#55534D", cold: "#A9B8C8", cool: "#5F7389", hot: "#FF4F12" },
  dark: { paper: "#0E1424", ink: "#ECEEF2", soft: "#4F5A74", mid: "#97A0B6", cold: "#2F3B57", cool: "#5C6C8F", hot: "#FF5A1F" },
};
export const tokensOf = (spec) => ({ ...THEMES[spec.theme], ...(spec.accent ? { hot: spec.accent.toUpperCase() } : {}) });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
const line = (s) => {
  const m = /^\*\*([^*]+)\*\*/.exec(s);
  return m ? `<b>${esc(m[1])}</b>${esc(s.slice(m[0].length))}` : esc(s);
};

// The footer, top to bottom in CSS px from the hairline: counts at 14, notes at 60 (9 lines of 18px
// for three notes, 7 for two), a 16px gap, then 16px meta lines. "Not built yet: …" takes its own
// meta lines, flush left, wrapped at spaces to the 728px width; the last meta line holds provenance
// on the left and the credit on the right. The hairline sits 36px above the sheet's bottom edge plus the footer.
const FOOT = { counts: 14, notes: 60, noteLine: 18, noteLines: { 2: 7, 3: 9 }, gap: 16, meta: 16, metaSize: 11, width: 728, below: 36 };
// Commit Mono advances 0.6em, so a meta line holds a known number of characters.
const META_CHARS = Math.floor(FOOT.width / (FOOT.metaSize * 0.6));

function wrapMeta(text) {
  const lines = [];
  for (const word of text.split(" ")) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + 1 + word.length <= META_CHARS) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

const notBuiltLines = (notBuilt) => (notBuilt.length ? wrapMeta(`Not built yet: ${notBuilt.join(", ")}`) : []);
const footerHeight = (notes, notBuilt) => FOOT.notes + FOOT.noteLines[notes] * FOOT.noteLine + FOOT.gap + (notBuilt + 1) * FOOT.meta;
/** The y of the footer's hairline for a notes count and a number of not-built lines: the figure sits above it. */
export const floorFor = (notes, notBuilt) => SHEET.height - footerHeight(notes, notBuilt) - FOOT.below;
export const floorOf = (spec) => floorFor(spec.notes.length, notBuiltLines(spec.notBuilt).length);
export const FLOOR_STEP = FOOT.meta;

function footer(spec, facts) {
  const notBuilt = notBuiltLines(spec.notBuilt);
  const n = spec.notes.length;
  const height = footerHeight(n, notBuilt.length);
  const lastLine = height - FOOT.meta;
  const gutter = 22;
  const col = (FOOT.width - gutter * (n - 1)) / n;
  const meta = `position:absolute;font-size:${FOOT.metaSize}px;line-height:${FOOT.meta}px;color:var(--soft);white-space:nowrap`;
  const counts = bandLine(bandCounts(facts));
  const notes = spec.notes
    .map((note, i) => `<div class="t" data-block="note" data-owner="notes" style="left:${i * (col + gutter)}px;top:${FOOT.notes}px;width:${col}px"><b>${esc(note.title)}</b><br>${esc(note.text)}</div>`)
    .join("");
  return `<div style="position:absolute;left:56px;top:${floorOf(spec)}px;width:${FOOT.width}px;height:${height}px">
<div data-footer style="position:absolute;left:0;top:0;width:${FOOT.width}px;height:1px;background:var(--ink)"></div>
${counts ? `<div class="t" data-block="counts" data-owner="render" style="left:0;top:${FOOT.counts}px;width:${FOOT.width}px;font-size:11px;line-height:16px;color:var(--soft)">${esc(counts)}</div>` : ""}
${notes}
${notBuilt.length ? `<div data-block="notBuilt" data-owner="notBuilt" style="${meta};left:0;top:${lastLine - notBuilt.length * FOOT.meta}px">${notBuilt.map(esc).join("<br>")}</div>` : ""}
<div data-block="provenance" data-owner="render" style="${meta};left:0;top:${lastLine}px">${esc(provenance(spec.product))}</div>
<div data-block="credit" data-owner="render" style="${meta};right:0;top:${lastLine}px">Drawn by Vyo<span data-hot data-owner="render" style="color:var(--hot)">.</span></div>
</div>`;
}

// Line height per text role from its font size: the masthead is 88px at 84, a headline 28px at 22, an aside 18px at 12.
export const LINE_HEIGHT = {
  masthead: (s) => Math.round(s * 1.05),
  headline: (s) => s + 6,
  display: (s) => s,
  aside: (s) => Math.round(s * 1.5),
  label: (s) => Math.round(s * 1.25),
};
export const textSize = (t) => t.size ?? TEXT_SIZE[t.role === "label" && t.hot ? "hotLabel" : t.role][0];

const ROLE_STYLE = {
  masthead: `font-weight:700;letter-spacing:-.035em;white-space:nowrap;font-family:${esc(MAST_FONT)}`,
  headline: `font-family:${esc(`"Newsreader", serif`)};letter-spacing:-.005em`,
  display: `font-weight:700;letter-spacing:-.025em;font-family:${esc(MAST_FONT)}`,
  aside: "",
  label: "letter-spacing:.12em",
};

function textBlock(spec, t) {
  const size = textSize(t);
  const hot = t.role === "label" && t.hot;
  const style = `left:${t.x}px;top:${t.y}px;width:${t.w}px;font-size:${size}px;line-height:${LINE_HEIGHT[t.role](size)}px;text-align:${t.align || "left"};${
    hot ? "font-weight:700;letter-spacing:.18em;color:var(--hot)" : ROLE_STYLE[t.role]
  }`;
  const body = {
    masthead: () => `${esc(spec.product.name)}<span data-hot data-owner="render" style="color:var(--hot)">.</span>`,
    headline: () => esc(spec.headline),
    display: () => esc(t.text),
    aside: () => line(t.text),
    label: () => esc(t.text.toUpperCase()),
  }[t.role]();
  return `<div class="t" data-block="${esc(t.id)}" data-role="${t.role}" data-owner="figure"${hot ? " data-hot" : ""} style="${style}">${body}</div>`;
}

function fontFaces() {
  const missing = FONTS.filter(([, , file]) => !fs.existsSync(path.join(FONT_DIR, file)));
  if (missing.length) throw new Error(`fonts missing in ${FONT_DIR} (${missing.map((f) => f[2]).join(", ")}): run tools/fetch-fonts.sh`);
  return FONTS.map(
    ([family, weight, file, type]) =>
      `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:${type};base64,${fs.readFileSync(path.join(FONT_DIR, file)).toString("base64")})}`,
  ).join("\n");
}

const PRELUDE = `
window.fontsReady = Promise.all([...document.fonts].map((f) => f.load())).then(() => document.fonts.ready);
window.hasWord = ${hasWord.toString()};
window.fitWidth = (el, max) => {
  const r = document.createRange();
  r.selectNodeContents(el);
  let size = parseFloat(getComputedStyle(el).fontSize);
  const ratio = parseFloat(getComputedStyle(el).lineHeight) / size;
  while (r.getBoundingClientRect().width > max && size > 16) {
    size -= 1;
    el.style.fontSize = size + "px";
    el.style.lineHeight = size * ratio + "px";
  }
};`;

// The page lays out the figure with the same geometry and field modules `vyo sketch` runs in Node,
// concatenated into one script: their imports are each other, so they are dropped.
const LIB = path.join(TOOLS, "lib");
const PAGE_MODULES = ["geometry.mjs", "fields/wave.mjs", "fields/terrain.mjs", "fields/index.mjs"];
const figureScript = () =>
  [...PAGE_MODULES.map((f) => fs.readFileSync(path.join(LIB, f), "utf8").replace(/^import .*\n/gm, "").replace(/^export /gm, "")), fs.readFileSync(path.join(LIB, "fill.js"), "utf8")]
    .join("\n")
    .replace(/<\/script/gi, "<\\/script");

/** What a field's layout needs from the rest of the poster: the floor, whether the masthead sits on the right, and the theme. */
export function fieldFrame(spec) {
  const m = spec.figure.texts.find((t) => t.role === "masthead");
  return { floor: floorOf(spec), mirror: !!m && m.x + m.w / 2 > SHEET.width / 2, theme: spec.theme };
}

/** The figure as the page reads it: field regions carry their parts, computed from facts.json. */
const figureData = (spec, facts) => ({
  regions: spec.figure.regions.map((r) => (r.kind === "field" ? { ...r, parts: regionParts(r, facts) } : r)),
  hot: spec.hot ?? null,
  ...fieldFrame(spec),
});

/** The poster as one HTML string. Throws when the fonts are missing. */
export function buildPage(spec, facts) {
  const vars = Object.entries(tokensOf(spec)).map(([k, v]) => `--${k}:${v}`).join(";");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(spec.product.name)} poster</title><style>
${fontFaces()}
* { box-sizing: border-box; margin: 0; padding: 0 }
:root { ${vars} }
html, body { background: var(--paper) }
.sheet { position: relative; width: ${SHEET.width}px; height: ${SHEET.height}px; overflow: hidden; background: var(--paper); color: var(--ink); font-family: "Commit Mono", monospace }
.row { position: absolute; white-space: nowrap; overflow: hidden }
.dots { position: absolute }
.t { position: absolute; font-size: 12px; line-height: 18px }
</style><script>${PRELUDE}</script></head><body><div class="sheet">
${spec.figure.texts.map((t) => textBlock(spec, t)).join("\n")}
${footer(spec, facts)}
</div><script type="application/json" id="figure">${json(figureData(spec, facts))}</script><script type="module">${figureScript()}</script></body></html>`;
}

const PAPER = {
  fit: () => ({ width: `${SHEET.width}px`, height: `${SHEET.height}px` }),
  a4: () => paged("A4", 794, 1122),
  letter: () => paged("Letter", 816, 1055),
};
function paged(format, w, h) {
  const scale = Math.min(w / SHEET.width, h / SHEET.height);
  const x = Math.floor((w - SHEET.width * scale) / 2);
  const y = Math.floor((h - SHEET.height * scale) / 2);
  return { format, scale, margin: { left: `${x}px`, right: "0px", top: `${y}px`, bottom: "0px" } };
}
export const PAPERS = Object.keys(PAPER);

function chromium() {
  const { chromium } = createRequire(import.meta.url)("playwright");
  return chromium.launch(process.env.VYO_CHROMIUM ? { executablePath: process.env.VYO_CHROMIUM } : {});
}

/**
 * Write <base>.html, then render it: PNG at 2x and PDF unless turned off. Returns the page measurements.
 * @param {{ html: string, base: string, png?: boolean, pdf?: boolean, paper?: string }} o
 */
export async function renderPage({ html, base, png = true, pdf = true, paper = "fit" }) {
  fs.mkdirSync(path.dirname(base), { recursive: true });
  fs.writeFileSync(`${base}.html`, html);
  const browser = await chromium();
  try {
    const page = await browser.newPage({ viewport: SHEET, deviceScaleFactor: 2 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForFunction(() => window.drawn === true, null, { timeout: 15000 }).catch(() => {});
    const report = await page.evaluate(`(${fs.readFileSync(path.join(TOOLS, "lib", "inspect.js"), "utf8").replace(/^\/\/.*\n/, "")})()`);
    report.errors = errors;
    if (png) await page.locator(".sheet").screenshot({ path: `${base}.png` });
    if (pdf) {
      await page.emulateMedia({ media: "screen" });
      await page.pdf({ path: `${base}.pdf`, printBackground: true, ...PAPER[paper]() });
    }
    return report;
  } finally {
    await browser.close();
  }
}

// spec + facts -> one self-contained HTML page, then PNG (2x) and PDF through Playwright.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { hasWord } from "./spec.mjs";
import { bandCounts, bandLine, provenance } from "./band.mjs";

const TOOLS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FONT_DIR = path.join(TOOLS, "fonts");
const FONTS = [
  ["Commit Mono", 400, "commit-400.otf", "font/otf"],
  ["Commit Mono", 700, "commit-700.otf", "font/otf"],
  ["Newsreader", 400, "newsreader-400.ttf", "font/ttf"],
];
export const FONT_FACES = FONTS.map(([family, weight]) => ({ family, weight }));
const MAST_FONT = `"Inter Display", Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
export const SHEET = { width: 840, height: 1190 };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
const line = (s) => {
  const m = /^\*\*([^*]+)\*\*/.exec(s);
  return m ? `<b>${esc(m[1])}</b>${esc(s.slice(m[0].length))}` : esc(s);
};

// The footer, top to bottom in CSS px from the hairline: counts at 14, notes at 60 (9 lines of 18px
// for three notes, 7 for two), a 16px gap, then 16px meta lines. "Not built yet: …" takes its own
// meta lines, flush left, wrapped at spaces to the 728px width; the last meta line holds provenance
// on the left and the credit on the right.
const FOOT = { counts: 14, notes: 60, noteLine: 18, noteLines: { 2: 7, 3: 9 }, gap: 16, meta: 16, metaSize: 11, width: 728 };
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

function footer(spec, facts, shape) {
  const notBuilt = spec.notBuilt.length ? wrapMeta(`Not built yet: ${spec.notBuilt.join(", ")}`) : [];
  const height = FOOT.notes + FOOT.noteLines[shape.notes] * FOOT.noteLine + FOOT.gap + (notBuilt.length + 1) * FOOT.meta;
  const lastLine = height - FOOT.meta;
  const gutter = 22;
  const col = (FOOT.width - gutter * (shape.notes - 1)) / shape.notes;
  const meta = `position:absolute;font-size:${FOOT.metaSize}px;line-height:${FOOT.meta}px;color:var(--soft);white-space:nowrap`;
  const counts = bandLine(bandCounts(facts));
  const notes = spec.notes
    .map((n, i) => `<div class="t" data-block="note" data-owner="notes" style="left:${i * (col + gutter)}px;top:${FOOT.notes}px;width:${col}px"><b>${esc(n.title)}</b><br>${esc(n.text)}</div>`)
    .join("");
  const html = `<div data-footer style="position:absolute;left:0;top:0;width:${FOOT.width}px;height:1px;background:var(--ink)"></div>
${counts ? `<div class="t" data-block="counts" data-owner="render" style="left:0;top:${FOOT.counts}px;width:${FOOT.width}px;font-size:11px;line-height:16px;color:var(--soft)">${esc(counts)}</div>` : ""}
${notes}
${notBuilt.length ? `<div data-block="notBuilt" data-owner="notBuilt" style="${meta};left:0;top:${lastLine - notBuilt.length * FOOT.meta}px">${notBuilt.map(esc).join("<br>")}</div>` : ""}
<div data-block="provenance" data-owner="render" style="${meta};left:0;top:${lastLine}px">${esc(provenance(spec.product))}</div>
<div data-block="credit" data-owner="render" style="${meta};right:0;top:${lastLine}px">Drawn by Vyo<span data-hot data-owner="render" style="color:var(--hot)">.</span></div>`;
  return { html, height };
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

/** The poster as one HTML string. Throws when the fonts are missing. */
export function buildPage(spec, facts, shape) {
  const tokens = shape.themes[spec.theme];
  const foot = footer(spec, facts, shape);
  const ctx = {
    masthead: `${esc(spec.product.name)}<span data-hot data-owner="render" style="color:var(--hot)">.</span>`,
    mastFont: esc(MAST_FONT),
    headline: esc(spec.headline),
    footer: foot.html,
    footerHeight: foot.height,
    esc,
    line,
    json,
  };
  const vars = Object.entries(tokens).map(([k, v]) => `--${k}:${v}`).join(";");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(spec.product.name)} poster</title><style>
${fontFaces()}
* { box-sizing: border-box; margin: 0; padding: 0 }
:root { ${vars} }
html, body { background: var(--paper) }
.sheet { position: relative; width: ${SHEET.width}px; height: ${SHEET.height}px; overflow: hidden; background: var(--paper); color: var(--ink); font-family: "Commit Mono", monospace }
.row { position: absolute; white-space: nowrap; overflow: hidden; text-transform: uppercase }
.serif { font-family: "Newsreader", serif }
.t { position: absolute; font-size: 12px; line-height: 18px }
</style><script>${PRELUDE}</script></head><body><div class="sheet">${shape.draw(spec, ctx)}</div></body></html>`;
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

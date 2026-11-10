// spec + facts -> one self-contained HTML page, then PNG (2x) and PDF through Playwright.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasWord } from "./spec.mjs";
import { SHEET, fixedMeasure, corners } from "./geometry.mjs";
import { frameOf, textSize, lineHeight, ruleText, recordSpot, RECORD } from "./frame.mjs";
import { bandCounts, bandLine, provenance } from "./band.mjs";
import { regionParts, partTies } from "./parts.mjs";
import { FIELDS } from "./fields/index.mjs";
import { launchChromium } from "./browser.mjs";

const TOOLS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FONT_DIR = path.join(TOOLS, "..", "fonts");
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
/** The colour tokens each field region adds for its own rows, by region id. */
export const fieldTokensOf = (spec) =>
  Object.fromEntries(spec.figure.regions.filter((r) => r.kind === "field").map((r) => [r.id, FIELDS[r.field].tokens(spec.theme)]));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hotStop = `<span data-hot data-owner="render" style="color:var(--hot)">.</span>`;
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
/** The y a field's rows stop at: the swiss footer's hairline, or the sheet's bottom edge in the loose frame. */
export const floorOf = (spec) => (frameOf(spec) === "loose" ? SHEET.height : floorFor(spec.notes.length, notBuiltLines(spec.notBuilt).length));
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
<div data-block="credit" data-owner="render" style="${meta};right:0;top:${lastLine}px">Drawn by Vyo${hotStop}</div>
</div>`;
}

const SERIF = `font-family:${esc(`"Newsreader", serif`)}`;
// Per frame, per role: the block's own CSS and what it prints. Sizes and line heights are in lib/frame.mjs.
const ROLE_PAGE = {
  swiss: {
    masthead: { style: `font-weight:700;letter-spacing:-.035em;white-space:nowrap;font-family:${esc(MAST_FONT)}`, body: (spec) => `${esc(spec.product.name)}${hotStop}` },
    headline: { style: `${SERIF};letter-spacing:-.005em`, body: (spec) => esc(spec.headline) },
    display: { style: `font-weight:700;letter-spacing:-.025em;font-family:${esc(MAST_FONT)}`, body: (spec, t) => esc(t.text) },
    aside: { style: "", body: (spec, t) => line(t.text) },
    label: { style: "letter-spacing:.12em", body: (spec, t) => esc(t.text.toUpperCase()) },
  },
  loose: {
    label: { style: "letter-spacing:.17em;white-space:nowrap", body: (spec) => esc(spec.product.name.toUpperCase()) },
    headline: { style: `${SERIF};letter-spacing:-.01em`, body: (spec) => esc(spec.headline) },
    paragraph: { style: SERIF, body: (spec, t) => line(t.text) },
    legend: { style: SERIF, body: (spec, t) => line(t.text) },
    list: { style: "white-space:pre", body: (spec, t, facts) => listItems(spec, t, facts).map(esc).join("\n") },
    rule: { style: "white-space:nowrap;overflow:hidden", body: (spec, t) => esc(ruleText(t)) },
  },
};

/** A list's lines: its items, or the plain names of the field's parts in tree order. */
export function listItems(spec, t, facts) {
  if (!t.parts) return t.items;
  const field = spec.figure.regions.find((r) => r.kind === "field");
  return field ? regionParts(field, facts).map((p) => p.name.toLowerCase()) : [];
}

function textBlock(spec, t, facts) {
  const frame = frameOf(spec);
  const size = textSize(spec, t);
  const hot = frame === "swiss" && t.role === "label" && t.hot;
  const { style: own, body } = ROLE_PAGE[frame][t.role];
  const style = `left:${t.x}px;top:${t.y}px;width:${t.w}px;font-size:${size}px;line-height:${lineHeight(spec, t)}px;text-align:${t.align || "left"};${
    hot ? "font-weight:700;letter-spacing:.18em;color:var(--hot)" : own
  }`;
  return `<div class="t" data-block="${esc(t.id)}" data-role="${t.role}" data-owner="figure"${hot ? " data-hot" : ""} style="${style}">${body(spec, t, facts)}</div>`;
}

/** The record line's words, without the accent full stop render adds. */
export const recordText = (product) => `${provenance(product)}. Drawn by Vyo`;

/** The field's rows as Node lays them out with Commit Mono's fixed advance, around `blocks`. */
export function fieldItems(spec, region, facts, blocks, measure = fixedMeasure) {
  const r = fieldInput(region, facts);
  return FIELDS[region.field].layout(r, r.parts, { ...fieldFrame(spec), blocks, measure });
}

/** The fills a field draws under its rows (only a shape has any), as its style lays them out. */
export function fieldGround(spec, region, facts) {
  const ground = FIELDS[region.field].ground;
  if (!ground) return [];
  const r = fieldInput(region, facts);
  return ground(r, r.parts, { ...fieldFrame(spec), blocks: [], measure: fixedMeasure });
}

/** Ground fills as one rect per span, for the corners and the record line to keep clear of. */
export const groundRects = (ground) => ground.flatMap((g) => g.rows.flatMap(([y, spans]) => spans.map(([l, r]) => ({ left: l, top: y, right: r, bottom: y + 1 }))));

/** A field region as its layout reads it: with its parts and the imports that tie them, both from facts.json. */
function fieldInput(region, facts) {
  const parts = regionParts(region, facts);
  return { ...region, parts, ties: partTies(parts, facts) };
}

/**
 * The room a field leaves: its rows laid out with no text blocks to dodge, the empty corners around them, and
 * the centre of the accent part's rows (of all rows when nothing is hot). Compose, sketch and the record read it.
 */
export function fieldSpace(spec, facts) {
  const fields = spec.figure.regions.filter((r) => r.kind === "field");
  const items = fields.flatMap((r) => fieldItems(spec, r, facts, []));
  const rects = [...items.map((it) => ({ left: it.x, top: it.y, right: it.x + it.width, bottom: it.y + it.height })), ...fields.flatMap((r) => groundRects(fieldGround(spec, r, facts)))];
  const hot = items.some((it) => it.hot) ? items.filter((it) => it.hot) : items;
  const mean = (f) => hot.reduce((s, it) => s + f(it), 0) / (hot.length || 1);
  return { rects, corners: corners(rects), accent: { x: mean((it) => it.x + it.width / 2), y: mean((it) => it.y + it.height / 2) } };
}

/** Where the record line sits: clear of the field's rows. */
export function recordOf(spec, facts) {
  const text = `${recordText(spec.product)}.`;
  return { text, ...recordSpot(text, fieldSpace(spec, facts).rects, spec.record) };
}

function record(spec, facts) {
  const spot = recordOf(spec, facts);
  const place = spot.side === "bottom" ? `left:${spot.x}px;top:${spot.y}px` : `left:${spot.x}px;top:${spot.y}px;transform:rotate(-90deg);transform-origin:left top`;
  return `<div data-block="record" data-owner="render" style="position:absolute;${place};font-size:${RECORD.size}px;line-height:${RECORD.size}px;letter-spacing:${RECORD.spacing}px;color:var(--mid);white-space:nowrap">${esc(recordText(spec.product))}${hotStop}</div>`;
}

const CHROME = { swiss: footer, loose: record };

function fontFaces() {
  const missing = FONTS.filter(([, , file]) => !fs.existsSync(path.join(FONT_DIR, file)));
  if (missing.length) throw new Error(`fonts missing in ${FONT_DIR} (${missing.map((f) => f[2]).join(", ")}): reinstall @litterthanlit/vyo`);
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
const PAGE_MODULES = ["geometry.mjs", "mask.mjs", "fields/wave.mjs", "fields/terrain.mjs", "fields/river.mjs", "fields/shape.mjs", "fields/index.mjs"];
const figureScript = () =>
  [...PAGE_MODULES.map((f) => fs.readFileSync(path.join(LIB, f), "utf8").replace(/^import .*\n/gm, "").replace(/^export /gm, "")), fs.readFileSync(path.join(LIB, "fill.js"), "utf8")]
    .join("\n")
    .replace(/<\/script/gi, "<\\/script");

/** What a field's layout needs from the rest of the poster: the floor, whether the masthead sits on the right, and the theme. */
export function fieldFrame(spec) {
  const m = frameOf(spec) === "swiss" && spec.figure.texts.find((t) => t.role === "masthead");
  return { floor: floorOf(spec), mirror: !!m && m.x + m.w / 2 > SHEET.width / 2, theme: spec.theme };
}

/** The figure as the page reads it: field regions carry their parts, computed from facts.json. */
const figureData = (spec, facts) => ({
  regions: spec.figure.regions.map((r) => (r.kind === "field" ? fieldInput(r, facts) : r)),
  hot: spec.hot ?? null,
  ...fieldFrame(spec),
});

/** The poster as one HTML string. Throws when the fonts are missing. */
export function buildPage(spec, facts) {
  const vars = Object.entries(Object.assign({}, ...Object.values(fieldTokensOf(spec)), tokensOf(spec))).map(([k, v]) => `--${k}:${v}`).join(";");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(spec.product.name)} poster</title><style>
${fontFaces()}
* { box-sizing: border-box; margin: 0; padding: 0 }
:root { ${vars} }
html, body { background: var(--paper) }
.sheet { position: relative; width: ${SHEET.width}px; height: ${SHEET.height}px; overflow: hidden; background: var(--paper); color: var(--ink); font-family: "Commit Mono", monospace }
.row { position: absolute; white-space: nowrap; overflow: hidden }
.dots { position: absolute }
.t { position: absolute; font-size: 12px; line-height: 18px }
/* A field runs on behind the figure's texts: each sits above the rows with a 6px paper outline. */
[data-role] { z-index: 1; -webkit-text-stroke: 12px var(--paper); paint-order: stroke fill }
</style><script>${PRELUDE}</script></head><body><div class="sheet">
${spec.figure.texts.map((t) => textBlock(spec, t, facts)).join("\n")}
${CHROME[frameOf(spec)](spec, facts)}
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

/** The poster at 1/6 scale (140x198 CSS px, 2x): the size at which the accent part must still stand out. */
export const THUMB = { width: 140, height: 198 };
async function writeThumb(browser, shot, file) {
  const page = await browser.newPage({ viewport: THUMB, deviceScaleFactor: 2 });
  try {
    await page.setContent(`<body style="margin:0"><img width="${THUMB.width}" height="${THUMB.height}" style="display:block" src="data:image/png;base64,${shot.toString("base64")}">`);
    await page.waitForFunction(() => document.images[0].complete);
    await page.screenshot({ path: file });
  } finally {
    await page.close();
  }
}

/**
 * Write <base>.html, then render it: PNG at 2x and PDF unless turned off. Returns the page measurements.
 * @param {{ html: string, base: string, png?: boolean, pdf?: boolean, paper?: string }} o
 */
export async function renderPage({ html, base, png = true, pdf = true, paper = "fit" }) {
  fs.mkdirSync(path.dirname(base), { recursive: true });
  fs.writeFileSync(`${base}.html`, html);
  const browser = await launchChromium();
  try {
    const page = await browser.newPage({ viewport: SHEET, deviceScaleFactor: 2 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForFunction(() => window.drawn === true, null, { timeout: 15000 }).catch(() => {});
    const report = await page.evaluate(`(${fs.readFileSync(path.join(TOOLS, "lib", "inspect.js"), "utf8").replace(/^\/\/.*\n/, "")})()`);
    report.errors = errors;
    if (png) {
      const shot = await page.locator(".sheet").screenshot({ path: `${base}.png` });
      await writeThumb(browser, shot, `${base}-thumb.png`);
    }
    if (pdf) {
      await page.emulateMedia({ media: "screen" });
      await page.pdf({ path: `${base}.pdf`, printBackground: true, ...PAPER[paper]() });
    }
    return report;
  } finally {
    await browser.close();
  }
}

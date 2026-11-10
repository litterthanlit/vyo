// spec + facts -> one self-contained HTML page, then PNG (2x) and PDF through Playwright.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasWord } from "./spec.mjs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { SHEET, fixedMeasure, corners, flattenPath } from "./geometry.mjs";
import { frameOf, hasRecord, textSize, lineHeight, ruleText, recordSpot, RECORD } from "./frame.mjs";
import { bandCounts, bandLine, provenance } from "./band.mjs";
import { regionParts, partTies } from "./parts.mjs";
import { FIELDS } from "./fields/index.mjs";
import { loadMaskImage } from "./png-mask.mjs";
import { launchChromium } from "./browser.mjs";
import { placeTexts } from "./place.mjs";

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
  "signal-light": { paper: "#F3EEE4", ink: "#111111", soft: "#6B6860", mid: "#3A3834", cold: "#8A9AAB", cool: "#4E6578", hot: "#C8FF00" },
  "signal-dark": { paper: "#111111", ink: "#F4F0E6", soft: "#6A675F", mid: "#A8A49A", cold: "#3D4A5C", cool: "#6B7C94", hot: "#C8FF00" },
};
export const tokensOf = (spec) => {
  const key = frameOf(spec) === "signal" ? `signal-${spec.theme}` : spec.theme;
  return { ...THEMES[key], ...(spec.accent ? { hot: spec.accent.toUpperCase() } : {}) };
};
/** The colour tokens each field region adds for its own rows, by region id. */
export const fieldTokensOf = (spec) =>
  Object.fromEntries(spec.figure.regions.filter((r) => r.kind === "field").map((r) => [r.id, FIELDS[r.field].tokens(spec.theme, frameOf(spec))]));

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
/** The y a field's rows stop at: the swiss footer's hairline, or the sheet's bottom edge in a record frame. */
export const floorOf = (spec) => (hasRecord(spec) ? SHEET.height : floorFor(spec.notes.length, notBuiltLines(spec.notBuilt).length));
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

// The halo: paper shadows at 6px and 3px all round, close enough together to read as one outline.
const HALO = [6, 3]
  .flatMap((r) => Array.from({ length: r * 4 }, (_, i) => [r * Math.cos((i * Math.PI) / (r * 2)), r * Math.sin((i * Math.PI) / (r * 2))]))
  .map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px 0 var(--paper)`)
  .join(",");

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
  signal: {
    label: { style: "letter-spacing:.22em;white-space:nowrap", body: (spec) => esc(spec.product.name.toUpperCase()) },
    headline: { style: `font-weight:700;letter-spacing:-.04em;font-family:${esc(MAST_FONT)}`, body: (spec) => esc(spec.headline) },
    paragraph: { style: `font-family:${esc(MAST_FONT)};letter-spacing:-.01em`, body: (spec, t) => line(t.text) },
    legend: { style: "letter-spacing:.04em", body: (spec, t) => line(t.text) },
    list: {
      style: `white-space:pre;font-family:${esc(MAST_FONT)};font-weight:700;letter-spacing:-.02em;text-transform:uppercase`,
      body: (spec, t, facts) => listItems(spec, t, facts).map((s, i) => `${"\u00a0".repeat((i % 4) * 4)}\u2022\u2009${esc(s)}`).join("\n"),
    },
    rule: { style: "white-space:nowrap;overflow:hidden", body: (spec, t) => esc(ruleText(t)) },
    meta: { style: "letter-spacing:.16em;white-space:nowrap;text-transform:uppercase", body: (spec, t) => esc(t.text) },
    display: { style: `font-weight:700;letter-spacing:-.05em;font-family:${esc(MAST_FONT)}`, body: (spec, t) => esc(t.text) },
    mark: { style: "background:var(--hot)", body: () => "" },
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
  const hot = (frame === "swiss" && t.role === "label" && t.hot) || t.role === "mark";
  const { style: own, body } = ROLE_PAGE[frame][t.role];
  const box = t.role === "mark" ? `height:${t.h}px;` : `font-size:${size}px;line-height:${lineHeight(spec, t)}px;`;
  const style = `left:${t.x}px;top:${t.y}px;width:${t.w}px;${box}text-align:${t.align || "left"};${
    hot && t.role !== "mark" ? "font-weight:700;letter-spacing:.18em;color:var(--hot)" : own
  }`;
  const inner = body(spec, t, facts);
  const block = `<div class="t" data-block="${esc(t.id)}" data-role="${t.role}" data-owner="figure"${hot ? " data-hot" : ""}${t.role === "mark" ? ` data-mark-w="${t.w}"` : ""} style="${style}">${inner}</div>`;
  // A mark is a highlighter laid over the type, so it has no halo of its own.
  if (t.role === "mark") return block;
  // The halo is a copy of the block under every block's letters, so no block's halo covers another's descenders.
  return `<div class="t" data-halo="${esc(t.id)}" aria-hidden="true" style="${style}">${inner}</div>
${block}`;
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

const CHROME = { swiss: footer, loose: record, signal: record };

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
const FIELD_DIR = path.join(LIB, "fields");
// pose, wave and chords first: the other fields call them. index.mjs last: its table names them all.
const FIELD_FIRST = ["pose.mjs", "wave.mjs", "chords.mjs"];
const FIELD_SKIP = new Set([...FIELD_FIRST, "index.mjs"]);
const fieldModules = () => {
  const rest = fs.readdirSync(FIELD_DIR).filter((f) => f.endsWith(".mjs") && !FIELD_SKIP.has(f)).sort();
  return [...FIELD_FIRST, ...rest, "index.mjs"].map((f) => `fields/${f}`);
};
export const PAGE_MODULES = ["geometry.mjs", "mask.mjs", ...fieldModules()];
const figureScript = () =>
  [...PAGE_MODULES.map((f) => fs.readFileSync(path.join(LIB, f), "utf8").replace(/^import .*\n/gm, "").replace(/^export /gm, "")), fs.readFileSync(path.join(LIB, "fill.js"), "utf8")]
    .join("\n")
    .replace(/<\/script/gi, "<\\/script");

/** What a field's layout needs from the rest of the poster: the floor, whether the masthead sits on the right, and the theme. */
export function fieldFrame(spec) {
  const m = frameOf(spec) === "swiss" && spec.figure.texts.find((t) => t.role === "masthead");
  return { floor: floorOf(spec), mirror: !!m && m.x + m.w / 2 > SHEET.width / 2, theme: spec.theme, frame: frameOf(spec) };
}

/** The figure as the page reads it: field regions carry their parts, computed from facts.json, and a traced shape its image. */
const figureData = (spec, facts) => ({
  regions: spec.figure.regions.map((r) => (r.kind === "field" ? fieldInput(r, facts) : r.kind === "routes" ? routeData(r) : r)),
  images: Object.fromEntries(spec.figure.regions.filter((r) => r.shape?.mask !== undefined).map((r) => [r.shape.mask, loadMaskImage(r.shape.mask)])),
  hot: spec.hot ?? null,
  motion: spec.motion ?? null,
  ...fieldFrame(spec),
});

function routeData(r) {
  return {
    ...r,
    paths: r.paths.map((p) => ({ ...p, points: (flattenPath(p.d).paths || [])[0] || [] })),
  };
}

/** The poster as one HTML string. Throws when the fonts are missing. */
export function buildPage(given, facts) {
  const spec = placeTexts(given, facts);
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
/* A field runs on behind the figure's texts: each sits above the rows with a 6px paper halo. The halos are copies
   of the blocks one layer down, so no halo covers letters: a text-stroke on the block itself painted line by line
   and covered the descenders of the line above, and a block's halo covered the block above it. */
[data-halo] { z-index: 1; color: transparent; text-shadow: ${HALO} }
[data-halo] * { color: transparent !important }
[data-role] { z-index: 2 }
/* A mark blends over the letters under it, so they stay legible through the highlighter. */
[data-role=mark] { z-index: 3; mix-blend-mode: ${spec.theme === "dark" ? "difference" : "multiply"} }
.routes { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 0; overflow: visible; pointer-events: none }
.node { position: absolute; border-radius: 50%; z-index: 0; pointer-events: none }
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
 * How much of each figure text block's letters something else paints over: the block screenshotted as the poster
 * draws it, then alone on the sheet with no halo. A pixel that is letter alone and not letter in the poster is
 * covered, by a field's ground, an echo, or a halo of its own lines.
 * @returns {Promise<{ block: string, ink: number, covered: number, x: number, y: number }[]>}  pixels at 2x, sheet px
 */
async function coveredText(page) {
  // A highlighter mark is laid over type on purpose: it is never covered, and it covers nothing.
  const names = await page.evaluate(() => {
    for (const el of document.querySelectorAll(".sheet > [data-role=mark]")) el.style.visibility = "hidden";
    return [...document.querySelectorAll(".sheet > [data-role]:not([data-role=mark])")].map((el) => el.dataset.block);
  });
  const out = [];
  for (const name of names) {
    const clip = await page.evaluate((n) => {
      const el = document.querySelector(`.sheet > [data-block="${n}"]`);
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      const s = document.querySelector(".sheet").getBoundingClientRect();
      const [x, y] = [Math.max(s.left, Math.floor(r.left - 3)), Math.max(s.top, Math.floor(r.top - 3))];
      return { x, y, width: Math.min(s.right, Math.ceil(r.right + 3)) - x, height: Math.min(s.bottom, Math.ceil(r.bottom + 3)) - y };
    }, name);
    if (!(clip.width > 0 && clip.height > 0)) continue;
    const full = (await page.screenshot({ clip })).toString("base64");
    await page.evaluate((n) => {
      for (const el of document.querySelector(".sheet").children) {
        if (el.dataset.block === n) Object.assign(el.style, { textShadow: "none", webkitTextStroke: "0" });
        else el.style.visibility = "hidden";
      }
    }, name);
    const alone = (await page.screenshot({ clip })).toString("base64");
    await page.evaluate(() => {
      for (const el of document.querySelector(".sheet").children) Object.assign(el.style, { textShadow: "", webkitTextStroke: "", visibility: el.dataset.role === "mark" ? "hidden" : "" });
    });
    out.push({ block: name, ...(await page.evaluate(compareInk, { full, alone, name, clip })) });
  }
  await page.evaluate(() => {
    for (const el of document.querySelectorAll(".sheet > [data-role=mark]")) el.style.visibility = "";
  });
  return out;
}

/** In the page: the letter pixels of `alone` that `full` does not show, against the block's paper and ink. */
async function compareInk({ full, alone, name, clip }) {
  const pixels = async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return { w: img.width, data: ctx.getImageData(0, 0, img.width, img.height).data };
  };
  const [a, b] = [await pixels(alone), await pixels(full)];
  const rgb = (s) => s.match(/\d+/g).slice(0, 3).map(Number);
  const lum = ([r, g, bl]) => 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  const el = document.querySelector(`.sheet > [data-block="${name}"]`);
  const paper = lum(rgb(getComputedStyle(document.querySelector(".sheet")).backgroundColor));
  const span = lum(rgb(getComputedStyle(el).color)) - paper || 1;
  let [ink, covered, sx, sy] = [0, 0, 0, 0];
  for (let i = 0; i < a.data.length; i += 4) {
    const la = lum([a.data[i], a.data[i + 1], a.data[i + 2]]);
    if ((la - paper) / span < 0.5) continue;
    ink++;
    const lf = lum([b.data[i], b.data[i + 1], b.data[i + 2]]);
    if (Math.abs(lf - la) / Math.abs(span) > 0.35) {
      covered++;
      sx += (i / 4) % a.w;
      sy += Math.floor(i / 4 / a.w);
    }
  }
  return { ink, covered, x: Math.round(clip.x + sx / (covered || 1) / 2), y: Math.round(clip.y + sy / (covered || 1) / 2) };
}

/**
 * Write <base>.html, then render it: PNG at 2x and PDF unless turned off. Returns the page measurements.
 * @param {{ html: string, base: string, png?: boolean, pdf?: boolean, paper?: string, gif?: boolean, motion?: { kind: string, frames: number, fps: number } }} o
 */
export async function renderPage({ html, base, png = true, pdf = true, paper = "fit", gif = false, motion = null }) {
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
    report.covered = await coveredText(page);
    if (png) {
      const shot = await page.locator(".sheet").screenshot({ path: `${base}.png` });
      await writeThumb(browser, shot, `${base}-thumb.png`);
    }
    if (pdf) {
      await page.emulateMedia({ media: "screen" });
      await page.pdf({ path: `${base}.pdf`, printBackground: true, ...PAPER[paper]() });
    }
    if (gif && motion) await writeGif(page, base, motion);
    return report;
  } finally {
    await browser.close();
  }
}

/** A GIF or MP4 could not be written: ffmpeg is missing or refused the frames. */
export class GifFailure extends Error {}

function ffmpeg(args, what) {
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8" });
  if (r.error?.code === "ENOENT") throw new GifFailure("render --gif needs ffmpeg on PATH; install it (apt install ffmpeg, brew install ffmpeg) or render without --gif");
  if (r.error || r.status !== 0) throw new GifFailure(`ffmpeg could not write the ${what}: ${(r.stderr || r.error?.message || `exit ${r.status}`).trim()}`);
}

async function writeGif(page, base, motion) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vyo-gif-"));
  const n = motion.frames;
  const fps = motion.fps;
  try {
    for (let i = 0; i < n; i++) {
      // Nodes loop: t in [0, 1). Wipe and resolve land on 1 so the last frame is the finished state.
      const t = motion.kind === "nodes" ? i / n : n === 1 ? 0 : i / (n - 1);
      await page.evaluate((t) => window.applyMotion && window.applyMotion(t), t);
      await page.locator(".sheet").screenshot({ path: path.join(dir, `frame-${String(i).padStart(3, "0")}.png`) });
    }
    const seq = path.join(dir, "frame-%03d.png");
    const pal = path.join(dir, "palette.png");
    ffmpeg(["-framerate", String(fps), "-i", seq, "-vf", "scale=560:-1:flags=lanczos,palettegen=max_colors=48", pal], "GIF palette");
    ffmpeg(["-framerate", String(fps), "-i", seq, "-i", pal, "-lavfi", "scale=560:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer", "-loop", "0", `${base}.gif`], "GIF");
    ffmpeg(["-framerate", String(fps), "-i", seq, "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-vf", "scale=840:-2", `${base}.mp4`], "MP4");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

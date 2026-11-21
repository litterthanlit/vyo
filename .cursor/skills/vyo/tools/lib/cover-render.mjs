// The cover frame in Node: its model and still, computed once per spec, and its page: a canvas for the living,
// xerox or spin cover under the template's text blocks, with the same modules inlined that `vyo sketch` runs here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sheetOf } from "./geometry.mjs";
import { regionParts } from "./parts.mjs";
import { loadMaskImage } from "./png-mask.mjs";
import { coverModel, coverStill, coverShell, coverRecord, coverStampBox, coverBlackWidth, COVER_GROUNDS } from "./cover.mjs";
import { buildLayoutChrome, chromeSmallType, spanOf, typeCss } from "./layout-chrome.mjs";

const LIB = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(LIB, "..", "..", "fonts");
/** The faces a cover's page loads: the relief's mono, and the template's grotesque for the words and the name. */
export const COVER_FONTS = [
  ["Commit Mono", 400, "commit-400.otf", "font/otf"],
  ["Commit Mono", 700, "commit-700.otf", "font/otf"],
  ["Inter", 500, "inter-500.woff2", "font/woff2"],
  ["Inter Display", 600, "inter-display-600.woff2", "font/woff2"],
  ["Inter Display", 900, "inter-display-900.woff2", "font/woff2"],
];
export const COVER_PAGE_MODULES = ["geometry.mjs", "silhouettes.mjs", "mask.mjs", "fields/shape-relief.mjs", "cover.mjs"];

const cache = new WeakMap();

/**
 * A cover spec computed: its region and parts, the model every frame is drawn from, the still's measurements, the
 * accent's shell, and the record. Once per spec object, so sketch, render and the checks share it.
 */
export function coverOf(spec, facts) {
  if (cache.has(spec)) return cache.get(spec);
  const region = spec.figure.regions.find((r) => r.kind === "field");
  const parts = regionParts(region, facts);
  const legend = spec.figure.texts.find((t) => t.role === "legend").text;
  const look = spec.look ?? "living";
  const format = spec.format ?? "poster";
  const crop = spec.crop ?? "center";
  const layout = spec.layout ?? "classic";
  const finish = spec.finish ?? "type";
  const model = coverModel(region, parts, { ground: spec.ground, look, format, crop, layout, finish, texts: { name: spec.product.name, headline: spec.headline, legend } });
  const still = coverStill(model);
  const out = { region, parts, model, still, shell: coverShell(model, still), record: coverRecord(spec.product, parts), product: spec.product.name, look, format, crop, layout, finish };
  cache.set(spec, out);
  return out;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

/** The template's text blocks in sheet px, as the page places them: each a box and its positioned origin. */
export function coverBlocks(spec, facts) {
  const { parts, model, record, look, layout, format } = coverOf(spec, facts);
  return buildLayoutChrome({ spec, parts, record, template: model.template, ground: spec.ground, look, layout, format, series: spec.series ?? "" }).blocks;
}

/**
 * Xerox spot-plate highlighter coordinates behind the commit hash in the record and the accent name in the legend,
 * one per line the words fall on, each read from the line's place in the layout's chrome (`set`).
 */
function xeroxMarkers(spec, facts, B) {
  const { model } = coverOf(spec, facts);
  const out = [];
  // Mark characters `from` to `to` of a block's text, its lines joined by single spaces.
  const mark = (set, from, to) => {
    let start = 0;
    for (const line of set) {
      const a = Math.max(from, start) - start;
      const b = Math.min(to, start + line.text.length) - start;
      start += line.text.length + 1;
      if (b <= a) continue;
      const { x, w } = spanOf(line, a, b);
      out.push({ x: x - 3, y: line.top + 1, w: w + 6, h: line.lineHeight - 1 });
    }
  };
  const find = (set, needle) => {
    const from = set.map((l) => l.text).join(" ").toLowerCase().indexOf(needle.toLowerCase());
    if (from >= 0) mark(set, from, from + needle.length);
  };
  if (spec.product.commit) find(B.record.set, spec.product.commit);
  const hotPart = model.parts[model.hot];
  if (hotPart) find(B.legend.set, hotPart.name);
  return out;
}

/** Every box the layout's chrome sets on the sheet, in sheet px: its text blocks' lines, the name, the series tag, a table, a title block, a plaque. */
function chromeBoxes(spec, B, layout) {
  const out = [];
  for (const k of ["record", "headline", "legend"]) for (const l of B[k]?.set ?? []) out.push({ left: l.x, top: l.top, right: l.x + l.width, bottom: l.top + l.lineHeight });
  if (B.name) out.push({ left: B.name.left, top: B.name.top, right: B.name.left + coverBlackWidth(spec.product.name, B.name.size, B.name.track), bottom: B.name.top + B.name.size });
  // The classic xerox cover leaves the series mark to the stamp; the other layouts print a tag, mono 10px at .08em.
  if (B.series && layout !== "classic") {
    const tag = `VYO${B.series.number ? ` ${B.series.number}` : ""}`;
    out.push({ left: B.series.right - tag.length * 6.8, top: B.series.top, right: B.series.right, bottom: B.series.top + 14 });
  }
  for (const k of ["table", "titleBlock"]) if (B[k]) out.push(B[k]);
  for (const c of Object.values(B.cards ?? {})) out.push({ left: c.x, top: c.y, right: c.x + c.w, bottom: c.y + c.h });
  return out;
}

/**
 * Where the xerox look's rubber archive stamp sits: top right, slightly crooked, or, when the layout sets something
 * there, the nearest place whose box keeps 8px clear of every box the chrome sets, so the stamp never prints over
 * the record or any other words. Null on an og card, which has no room for it.
 */
function xeroxStamp(spec, facts, B, S, layout) {
  if ((spec.format ?? "poster") === "og") return null;
  const M = coverOf(spec, facts).model.template.margin;
  const want = { cx: S.width - M - 76, cy: M + 28 };
  const keep = chromeBoxes(spec, B, layout).map((r) => ({ left: r.left - 8, top: r.top - 8, right: r.right + 8, bottom: r.bottom + 8 }));
  const clear = (cx, cy) => {
    const s = coverStampBox(cx, cy);
    if (s.left < 16 || s.top < 16 || s.right > S.width - 16 || s.bottom > S.height - 16) return false;
    return keep.every((r) => s.right <= r.left || r.right <= s.left || s.bottom <= r.top || r.bottom <= s.top);
  };
  if (clear(want.cx, want.cy)) return want;
  let best = null;
  for (let cy = 0; cy <= S.height; cy += 2) {
    for (let cx = 0; cx <= S.width; cx += 2) {
      const d = (cx - want.cx) ** 2 + (cy - want.cy) ** 2;
      if ((!best || d < best.d) && clear(cx, cy)) best = { cx, cy, d };
    }
  }
  if (!best) throw new Error(`the ${layout} layout leaves no room for the xerox archive stamp`);
  return { cx: best.cx, cy: best.cy };
}

function fontFaces() {
  return COVER_FONTS.map(([family, weight, file, type]) => {
    const where = path.join(FONT_DIR, file);
    if (!fs.existsSync(where)) throw new Error(`fonts missing in ${FONT_DIR} (${file}): reinstall @litterthanlit/vyo`);
    return `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:${type};base64,${fs.readFileSync(where).toString("base64")})}`;
  }).join("\n");
}

const script = () =>
  [...COVER_PAGE_MODULES.map((f) => fs.readFileSync(path.join(LIB, f), "utf8").replace(/^import .*\n/gm, "").replace(/^export /gm, "")), fs.readFileSync(path.join(LIB, "cover-page.js"), "utf8")]
    .join("\n")
    .replace(/<\/script/gi, "<\\/script");

/** A cover as one HTML page. `prelude` is render's page prelude (fonts ready, text fitting). */
export function coverPage(spec, facts, prelude) {
  const { region, parts, model, still, record, look, format, crop, layout, finish } = coverOf(spec, facts);
  const S = sheetOf(format);
  const G = COVER_GROUNDS[spec.ground];
  const chrome = buildLayoutChrome({ spec, parts, record, template: model.template, ground: spec.ground, look, layout, format, series: spec.series ?? "" });
  const small = `${typeCss(chromeSmallType(look))};white-space:pre`;
  const markers = look === "xerox" ? xeroxMarkers(spec, facts, chrome.blocks) : [];
  const stamp = look === "xerox" ? xeroxStamp(spec, facts, chrome.blocks, S, layout) : null;
  const figure = {
    region, parts, ground: spec.ground, look, format, crop, layout, finish, still: still.frame,
    series: spec.series ?? "", commit: spec.product.commit ?? "", markers, stamp, washes: look === "xerox" ? (chrome.blocks.washes ?? []) : [], canvasChrome: chrome.canvasChrome,
    texts: { name: spec.product.name, headline: spec.headline, legend: spec.figure.texts.find((t) => t.role === "legend").text },
    images: region.shape.mask !== undefined ? { [region.shape.mask]: loadMaskImage(region.shape.mask) } : {},
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(spec.product.name)} cover</title><style>
${fontFaces()}
* { box-sizing: border-box; margin: 0; padding: 0 }
:root { --paper:${G.ground}; --ink:${G.ink}; --hot:${G.accent} }
html, body { background: var(--paper) }
.sheet { position: relative; width: ${S.width}px; height: ${S.height}px; overflow: hidden; background: var(--paper); color: var(--ink) }
#cover { position: absolute; left: 0; top: 0; width: ${S.width}px; height: ${S.height}px }
.t { position: absolute; ${small} }
</style><script>${prelude}</script></head><body><div class="sheet">
<canvas id="cover" width="${S.width}" height="${S.height}"></canvas>
${chrome.html}
</div><script type="application/json" id="figure">${json(figure)}</script><script type="module">${script()}</script></body></html>`;
}

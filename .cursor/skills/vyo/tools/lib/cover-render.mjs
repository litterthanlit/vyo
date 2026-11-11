// The cover frame in Node: its model and still, computed once per spec, and its page: a canvas for the living
// relief under the template's text blocks, with the same modules inlined that `vyo sketch` runs here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SHEET } from "./geometry.mjs";
import { regionParts } from "./parts.mjs";
import { loadMaskImage } from "./png-mask.mjs";
import { coverModel, coverStill, coverShell, coverRecord, COVER, COVER_GROUNDS, COVER_FRAMES } from "./cover.mjs";

const LIB = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(LIB, "..", "..", "fonts");
/** The faces a cover's page loads: the relief's mono, and the template's grotesque for the words and the name. */
export const COVER_FONTS = [
  ["Commit Mono", 400, "commit-400.otf", "font/otf"],
  ["Commit Mono", 700, "commit-700.otf", "font/otf"],
  ["Inter", 500, "inter-500.woff2", "font/woff2"],
  ["Inter Display", 600, "inter-display-600.woff2", "font/woff2"],
];
export const COVER_PAGE_MODULES = ["geometry.mjs", "silhouettes.mjs", "mask.mjs", "fields/shape-relief.mjs", "cover.mjs"];

// Inter's ascent and descent in em, from its hhea table: a line box of height L at size s puts the baseline
// (L - (asc + desc) s) / 2 + asc s below its top.
const ASC = 1984 / 2048;
const DESC = 494 / 2048;
const baselineIn = (lineHeight, size) => (lineHeight - (ASC + DESC) * size) / 2 + ASC * size;

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
  const model = coverModel(region, parts, { ground: spec.ground, texts: { name: spec.product.name, headline: spec.headline, legend } });
  const still = coverStill(model);
  const out = { region, parts, model, still, shell: coverShell(model, still), record: coverRecord(spec.product, parts) };
  cache.set(spec, out);
  return out;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

/** The template's text blocks in sheet px, as the page places them: each a box and the baseline of its first line. */
export function coverBlocks(spec, facts) {
  const { model, record } = coverOf(spec, facts);
  const T = model.template;
  const { margin: M, small, lead, headlineX } = COVER;
  const top = (baseline) => baseline - baselineIn(lead, small);
  const vyo = 21.7;
  const name = T.nameSize;
  return {
    record: { left: M, top: top(M + 10), lines: record },
    headline: { left: M + headlineX, top: top(M + 10), lines: T.headline },
    series: { right: SHEET.width - M, top: top(M + 10), number: spec.series ?? "", rule: SHEET.width - M - vyo - 10 },
    legend: { left: M, top: top(T.legendY + 10), lines: T.legend },
    name: { left: M - name * 0.05, top: T.base - baselineIn(name, name), size: name },
  };
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
  const { region, parts, still } = coverOf(spec, facts);
  const G = COVER_GROUNDS[spec.ground];
  const B = coverBlocks(spec, facts);
  const small = `font-family:"Inter",sans-serif;font-weight:500;font-size:${COVER.small}px;line-height:${COVER.lead}px;white-space:pre`;
  const lines = (list) => list.map(esc).join("\n");
  const figure = {
    region, parts, ground: spec.ground, still: still.frame,
    texts: { name: spec.product.name, headline: spec.headline, legend: spec.figure.texts.find((t) => t.role === "legend").text },
    images: region.shape.mask !== undefined ? { [region.shape.mask]: loadMaskImage(region.shape.mask) } : {},
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(spec.product.name)} cover</title><style>
${fontFaces()}
* { box-sizing: border-box; margin: 0; padding: 0 }
:root { --paper:${G.ground}; --ink:${G.ink}; --hot:${G.accent} }
html, body { background: var(--paper) }
.sheet { position: relative; width: ${SHEET.width}px; height: ${SHEET.height}px; overflow: hidden; background: var(--paper); color: var(--ink) }
#cover { position: absolute; left: 0; top: 0; width: ${SHEET.width}px; height: ${SHEET.height}px }
.t { position: absolute; ${small} }
</style><script>${prelude}</script></head><body><div class="sheet">
<canvas id="cover" width="${SHEET.width}" height="${SHEET.height}"></canvas>
<div class="t" data-block="record" data-owner="render" style="left:${B.record.left}px;top:${B.record.top}px">${lines(B.record.lines)}</div>
<div class="t" data-block="headline" data-role="headline" data-owner="figure" style="left:${B.headline.left}px;top:${B.headline.top}px">${lines(B.headline.lines)}</div>
<div class="t" data-block="series" data-owner="render" style="right:${SHEET.width - B.series.right}px;top:${B.series.top}px">Vyo</div>
${B.series.number ? `<div data-owner="render" style="position:absolute;left:${B.series.rule}px;top:${COVER.margin + 0.5}px;width:1px;height:12px;background:var(--ink);opacity:.5"></div>` : ""}
${B.series.number ? `<div class="t" data-block="number" data-owner="render" style="right:${SHEET.width - B.series.rule + 10}px;top:${B.series.top}px">${esc(B.series.number)}</div>` : ""}
<div class="t" data-block="legend" data-role="legend" data-owner="figure" style="left:${B.legend.left}px;top:${B.legend.top}px">${lines(B.legend.lines)}</div>
<div class="t" data-block="name" data-owner="render" style="left:${B.name.left}px;top:${B.name.top}px;font-family:'Inter Display',sans-serif;font-weight:600;font-size:${B.name.size}px;line-height:${B.name.size}px;letter-spacing:${(COVER.track * B.name.size).toFixed(2)}px">${esc(spec.product.name)}</div>
</div><script type="application/json" id="figure">${json(figure)}</script><script type="module">${script()}</script></body></html>`;
}

export { COVER_FRAMES };

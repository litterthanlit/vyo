// The cover frame in Node: its model and still, computed once per spec, and its page: a canvas for the living,
// xerox or spin cover under the template's text blocks, with the same modules inlined that `vyo sketch` runs here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sheetOf } from "./geometry.mjs";
import { regionParts } from "./parts.mjs";
import { loadMaskImage } from "./png-mask.mjs";
import { coverModel, coverStill, coverShell, coverRecord, coverSmallWidth, COVER, COVER_GROUNDS } from "./cover.mjs";

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
  const look = spec.look ?? "living";
  const format = spec.format ?? "poster";
  const crop = spec.crop ?? "center";
  const model = coverModel(region, parts, { ground: spec.ground, look, format, crop, texts: { name: spec.product.name, headline: spec.headline, legend } });
  const still = coverStill(model);
  const out = { region, parts, model, still, shell: coverShell(model, still), record: coverRecord(spec.product, parts), product: spec.product.name, look, format, crop };
  cache.set(spec, out);
  return out;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

/** The template's text blocks in sheet px, as the page places them: each a box and the baseline of its first line. */
export function coverBlocks(spec, facts) {
  const { model, record } = coverOf(spec, facts);
  const T = model.template;
  const { small, lead, headlineX } = COVER;
  const M = T.margin;
  const W = T.width;
  const top = (baseline) => baseline - baselineIn(lead, small);
  const vyo = coverSmallWidth("Vyo");
  const name = T.nameSize;
  const isOg = T.format === "og";
  return {
    record: { left: M, top: top(M + 10), lines: record },
    headline: isOg
      ? { left: M, top: top(M + 10 + (record.length + 1) * lead), lines: T.headline }
      : { left: M + headlineX, top: top(M + 10), lines: T.headline },
    series: { right: W - M, top: top(M + 10), number: spec.series ?? "", rule: W - M - vyo - 10 },
    legend: { left: M, top: top(T.legendY + 10), lines: T.legend },
    name: { left: M - name * 0.05, top: T.base - baselineIn(name, name), size: name, track: T.track },
  };
}

/** Xerox spot-plate highlighter coordinates behind the commit hash and the accent name in the legend. */
function xeroxMarkers(spec, facts, B) {
  const { model } = coverOf(spec, facts);
  const out = [];
  const lead = COVER.lead;
  // Xerox metadata uses 10px Commit Mono (0.6em = 6px fixed advance per glyph).
  const monoW = (s) => s.length * 6;
  const commit = spec.product.commit;
  if (commit) {
    const line = B.record.lines[1] ?? "";
    const idx = line.indexOf(commit);
    if (idx >= 0) {
      const pre = monoW(line.slice(0, idx));
      const w = monoW(commit);
      out.push({ x: B.record.left + pre - 3, y: B.record.top + lead + 1, w: w + 6, h: lead - 1 });
    }
  }
  const hotPart = model.parts[model.hot];
  if (hotPart) {
    const needle = hotPart.name.toLowerCase();
    const joined = B.legend.lines.join(" ").toLowerCase();
    const from = joined.indexOf(needle);
    if (from >= 0) {
      const to = from + needle.length;
      let start = 0;
      B.legend.lines.forEach((line, i) => {
        const a = Math.max(from, start) - start;
        const b = Math.min(to, start + line.length) - start;
        start += line.length + 1;
        if (b <= a) return;
        const x = B.legend.left + monoW(line.slice(0, a));
        const w = monoW(line.slice(a, b));
        out.push({ x: x - 3, y: B.legend.top + i * lead + 1, w: w + 6, h: lead - 1 });
      });
    }
  }
  return out;
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
  const { region, parts, still, look, format, crop } = coverOf(spec, facts);
  const S = sheetOf(format);
  const G = COVER_GROUNDS[spec.ground];
  const B = coverBlocks(spec, facts);
  const punk = look === "xerox" || look === "spin";
  const smallFont = look === "xerox" ? '"Commit Mono",monospace' : '"Inter",sans-serif';
  const smallSize = look === "xerox" ? 10 : COVER.small;
  const small = `font-family:${smallFont};font-weight:${look === "xerox" ? 400 : 500};font-size:${smallSize}px;line-height:${COVER.lead}px;white-space:pre`;
  const lines = (list) => list.map(esc).join("\n");
  const markers = look === "xerox" ? xeroxMarkers(spec, facts, B) : [];
  const figure = {
    region, parts, ground: spec.ground, look, format, crop, still: still.frame,
    series: spec.series ?? "", commit: spec.product.commit ?? "", markers,
    texts: { name: spec.product.name, headline: spec.headline, legend: spec.figure.texts.find((t) => t.role === "legend").text },
    images: region.shape.mask !== undefined ? { [region.shape.mask]: loadMaskImage(region.shape.mask) } : {},
  };
  const nameWeight = punk ? 900 : 600;
  const seriesHtml =
    look === "xerox" && format !== "og"
      ? ""
      : look === "spin"
        ? `<div class="t" data-block="series" data-owner="render" style="right:${S.width - B.series.right}px;top:${B.series.top - 2}px;background:var(--ink);color:var(--paper);padding:2px 8px;font-family:'Inter Display',sans-serif;font-weight:900;font-size:12px;letter-spacing:.04em;transform:rotate(-2deg)">VYO${B.series.number ? ` ${esc(B.series.number)}` : ""}</div>`
        : `<div class="t" data-block="series" data-owner="render" style="right:${S.width - B.series.right}px;top:${B.series.top}px">Vyo</div>
${B.series.number ? `<div data-owner="render" style="position:absolute;left:${B.series.rule}px;top:${COVER.margin + 0.5}px;width:1px;height:12px;background:var(--ink);opacity:.5"></div>` : ""}
${B.series.number ? `<div class="t" data-block="number" data-owner="render" style="right:${S.width - B.series.rule + 10}px;top:${B.series.top}px">${esc(B.series.number)}</div>` : ""}`;
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
<div class="t" data-block="record" data-owner="render" style="left:${B.record.left}px;top:${B.record.top}px${look === "spin" ? ";transform:rotate(-1deg)" : ""}">${lines(B.record.lines)}</div>
<div class="t" data-block="headline" data-role="headline" data-owner="figure" style="left:${B.headline.left}px;top:${B.headline.top}px${look === "spin" ? ";transform:rotate(0.8deg)" : ""}">${lines(B.headline.lines)}</div>
${seriesHtml}
<div class="t" data-block="legend" data-role="legend" data-owner="figure" style="left:${B.legend.left}px;top:${B.legend.top}px">${lines(B.legend.lines)}</div>
<div class="t" data-block="name" data-owner="render" style="left:${B.name.left}px;top:${B.name.top}px;font-family:'Inter Display',sans-serif;font-weight:${nameWeight};font-size:${B.name.size}px;line-height:${B.name.size}px;letter-spacing:${(B.name.track * B.name.size).toFixed(2)}px">${esc(spec.product.name)}</div>
</div><script type="application/json" id="figure">${json(figure)}</script><script type="module">${script()}</script></body></html>`;
}

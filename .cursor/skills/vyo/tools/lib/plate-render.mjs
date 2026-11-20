// The plate frame in Node: deterministic vector plate geometry (seismic, topo, blueprint), computed once per spec,
// its self-contained HTML page for 2x canvas rendering and GIF/MP4 loops, plus sketch text and 1/3-scale PNG preview.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sheetOf } from "./geometry.mjs";
import { regionParts, partOptions, partTies, fileSlices } from "./parts.mjs";
import { coverTemplate, coverRecord, COVER, COVER_GROUNDS } from "./cover.mjs";
import { COVER_FONTS } from "./cover-render.mjs";
import { buildLayoutChrome, chromeSmallType, typeCss } from "./layout-chrome.mjs";
import { PLATES } from "./plates/index.mjs";
import { seismicCurveAt } from "./plates/seismic.mjs";
import { encodePng } from "./png.mjs";

const LIB = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(LIB, "..", "..", "fonts");

export const PLATE_FRAMES = 48;
export const PLATE_FPS = 24;

const cache = new WeakMap();

/**
 * A plate spec computed once per spec object: its region, parts, file slices, import ties, layout template,
 * vector plate geometry, archival record, and conserved slice line total.
 */
export function plateOf(spec, facts) {
  if (cache.has(spec)) return cache.get(spec);
  const region = spec.figure.regions.find((r) => r.kind === "plate");
  const opts = partOptions(region);
  const parts = regionParts(region, facts);
  const slices = fileSlices(facts, opts);
  const ties = partTies(parts, facts);
  const layout = spec.layout ?? "classic";
  const format = spec.format ?? "poster";
  const ground = spec.ground;
  const legend = spec.figure.texts.find((t) => t.role === "legend")?.text ?? "";
  const template = coverTemplate({ name: spec.product.name, headline: spec.headline, legend, format, look: "living", layout });
  const seed = region.seed ?? ((parseInt(String(facts.hash).slice(0, 8), 16) || 1) % 2147483646 + 1);
  const data = PLATES[region.plate].build({ slices, parts, ties, box: template.box, seed });
  const record = coverRecord(spec.product, parts);
  const totalSliceLoc = Math.round(slices.reduce((s, x) => s + x.loc, 0));
  const out = { region, parts, slices, ties, template, data, record, ground, layout, format, seed, totalSliceLoc };
  cache.set(spec, out);
  return out;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

function fontFaces() {
  return COVER_FONTS.map(([family, weight, file, type]) => {
    const where = path.join(FONT_DIR, file);
    if (!fs.existsSync(where)) throw new Error(`fonts missing in ${FONT_DIR} (${file}): reinstall @litterthanlit/vyo`);
    return `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:${type};base64,${fs.readFileSync(where).toString("base64")})}`;
  }).join("\n");
}

const plateScript = () =>
  [
    fs.readFileSync(path.join(LIB, "plates", "seismic.mjs"), "utf8").replace(/^import .*\n/gm, "").replace(/^export /gm, ""),
    fs.readFileSync(path.join(LIB, "plate-page.js"), "utf8"),
  ]
    .join("\n")
    .replace(/<\/script/gi, "<\\/script");

/** A plate as one self-contained HTML page. `prelude` is render's page prelude (fonts ready, text fitting). */
export function platePage(spec, facts, prelude) {
  const { region, parts, template, data, record, ground, layout, format, seed } = plateOf(spec, facts);
  const S = sheetOf(format);
  const G = COVER_GROUNDS[ground];
  const chrome = buildLayoutChrome({ spec, parts, record, template, ground, look: "living", layout, format, series: spec.series ?? "", subtitle: "" });
  const small = `${typeCss(chromeSmallType("living"))};white-space:pre`;
  const figure = {
    region,
    parts,
    ground,
    colors: G,
    layout,
    format,
    motion: spec.motion ?? null,
    data,
    canvasChrome: chrome.canvasChrome,
    // The sheet's safe margin and the chrome cards the page keeps the plate's labels clear of.
    margin: template.margin,
    cards: Object.values(chrome.blocks.cards ?? {}).map(({ x, y, w, h }) => ({ x, y, w, h })),
    frames: PLATE_FRAMES,
    seed,
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(spec.product.name)} plate</title><style>
${fontFaces()}
* { box-sizing: border-box; margin: 0; padding: 0 }
:root { --paper:${G.ground}; --ink:${G.ink}; --hot:${G.accent} }
html, body { background: var(--paper) }
.sheet { position: relative; width: ${S.width}px; height: ${S.height}px; overflow: hidden; background: var(--paper); color: var(--ink) }
#plate { position: absolute; left: 0; top: 0; width: ${S.width}px; height: ${S.height}px }
.t { position: absolute; ${small} }
</style><script>${prelude}</script></head><body><div class="sheet">
<canvas id="plate" width="${S.width}" height="${S.height}"></canvas>
${chrome.html}
</div><script type="application/json" id="figure">${json(figure)}</script><script type="module">${plateScript()}</script></body></html>`;
}

const pct = (n) => `${(Math.round(n * 1000) / 10).toFixed(1)}%`;

/** The sketch's text summary for a plate: kind, ground, layout, format, geometry counts, and per-part breakdown. */
export function plateSketchLines(spec, facts) {
  const { region, parts, slices, ties, data, ground, layout, format, totalSliceLoc } = plateOf(spec, facts);
  const totalLoc = parts.reduce((s, p) => s + p.loc, 0) || 1;
  let geomSummary;
  if (region.plate === "seismic") {
    geomSummary = `${data.traces.length} traces across ${data.partBands.length} bands (${data.accentCount} accented)`;
  } else if (region.plate === "topo") {
    geomSummary = `${data.contours.length} contours across ${data.levels} levels, ${data.summits.length} summits (${data.accentCount} accented contours)`;
  } else {
    const cells = data.chambers.reduce((s, c) => s + c.cells.length, 0);
    geomSummary = `${data.chambers.length} chambers (${cells} file cells), ${data.traces.length} traces, ${data.vias.length} vias (${data.accentCount} accented)`;
  }
  const width = Math.max(24, ...parts.map((p) => p.id.length));
  return [
    `plate: ${region.plate} on ${ground} ground, ${layout} layout${format !== "poster" ? `, ${format}` : ""}; ${slices.length} slices, ${parts.length} parts, ${ties.length} import ties, ${totalSliceLoc.toLocaleString("en-US")} lines`,
    `geometry: ${geomSummary}`,
    `parts (id, name, share, lines, files):`,
    ...parts.map((p) => `  ${p.hot ? "*" : " "} ${p.id.padEnd(width)}  ${p.name.padEnd(24)} ${pct(p.loc / totalLoc).padStart(6)}  ${String(p.loc).padStart(6)}  ${String(p.files).padStart(4)}`),
  ];
}

/** A 1/3-scale Node PNG preview of the plate: ground, vector traces/contours/chambers in ink & accent, and layout bars. */
export function plateSketchImage(spec, facts) {
  const { region, parts, template, data, record, ground, layout, format } = plateOf(spec, facts);
  const S = 3;
  const W = template.width;
  const H = template.height;
  const w = Math.ceil(W / S);
  const h = Math.ceil(H / S);
  const G = COVER_GROUNDS[ground];
  const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  const [cGround, cInk, cAccent] = [rgb(G.ground), rgb(G.ink), rgb(G.accent)];

  const buf = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = cGround[0];
    buf[i * 3 + 1] = cGround[1];
    buf[i * 3 + 2] = cGround[2];
  }

  const blend = (px, py, color, a) => {
    if (px < 0 || py < 0 || px >= w || py >= h || a <= 0) return;
    const clamped = a > 1 ? 1 : a;
    const idx = (py * w + px) * 3;
    buf[idx] = buf[idx] * (1 - clamped) + color[0] * clamped;
    buf[idx + 1] = buf[idx + 1] * (1 - clamped) + color[1] * clamped;
    buf[idx + 2] = buf[idx + 2] * (1 - clamped) + color[2] * clamped;
  };

  const lay = (x0, y0, x1, y1, color, a) => {
    const ix0 = Math.max(0, Math.floor(x0 / S));
    const ix1 = Math.min(w, Math.ceil(x1 / S));
    const iy0 = Math.max(0, Math.floor(y0 / S));
    const iy1 = Math.min(h, Math.ceil(y1 / S));
    for (let y = iy0; y < iy1; y++) {
      for (let x = ix0; x < ix1; x++) {
        const cov = ((Math.min(x1, (x + 1) * S) - Math.max(x0, x * S)) * (Math.min(y1, (y + 1) * S) - Math.max(y0, y * S))) / (S * S);
        if (cov > 0) blend(x, y, color, a * cov);
      }
    }
  };

  const drawSeg = (x0, y0, x1, y1, color, a) => {
    const ax = x0 / S;
    const ay = y0 / S;
    const bx = x1 / S;
    const by = y1 / S;
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 1.5));
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      blend(Math.round(ax + (bx - ax) * u), Math.round(ay + (by - ay) * u), color, a);
    }
  };

  const strokeBox = (b, color, a) => {
    lay(b.x, b.y, b.x + b.w, b.y + S, color, a);
    lay(b.x, b.y + b.h - S, b.x + b.w, b.y + b.h, color, a);
    lay(b.x, b.y, b.x + S, b.y + b.h, color, a);
    lay(b.x + b.w - S, b.y, b.x + b.w, b.y + b.h, color, a);
  };

  if (region.plate === "seismic") {
    for (const tr of data.traces) {
      const pts = seismicCurveAt(tr, 0);
      const col = tr.hot ? cAccent : cInk;
      const alpha = tr.hot ? 0.95 : 0.72;
      for (let k = 1; k < pts.length; k++) {
        drawSeg(pts[k - 1].x, pts[k - 1].y, pts[k].x, pts[k].y, col, alpha);
      }
    }
  } else if (region.plate === "topo") {
    for (const c of data.contours) {
      const pts = c.points;
      if (!pts || pts.length < 2) continue;
      const col = c.hot ? cAccent : cInk;
      const alpha = c.major ? (c.hot ? 0.95 : 0.85) : c.hot ? 0.55 : 0.35;
      for (let k = 1; k < pts.length; k++) {
        drawSeg(pts[k - 1].x, pts[k - 1].y, pts[k].x, pts[k].y, col, alpha);
      }
      if (c.closed) drawSeg(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y, col, alpha);
    }
    for (const s of data.summits) {
      const col = s.hot ? cAccent : cInk;
      drawSeg(s.x - 6, s.y, s.x + 6, s.y, col, 0.95);
      drawSeg(s.x, s.y - 6, s.x, s.y + 6, col, 0.95);
    }
  } else if (region.plate === "blueprint") {
    for (const c of data.chambers) {
      const col = c.hot ? cAccent : cInk;
      lay(c.x, c.y, c.x + c.w, c.y + c.h, col, c.hot ? 0.1 : 0.04);
      for (const cell of c.cells) {
        strokeBox(cell, col, c.hot ? 0.28 : 0.16);
      }
      strokeBox(c, col, c.hot ? 0.9 : 0.6);
    }
    for (const tr of data.traces) {
      const col = tr.hot ? cAccent : cInk;
      const alpha = tr.hot ? 0.95 : 0.58;
      for (let k = 1; k < tr.points.length; k++) {
        drawSeg(tr.points[k - 1].x, tr.points[k - 1].y, tr.points[k].x, tr.points[k].y, col, alpha);
      }
    }
    for (const v of data.vias) {
      const col = v.hot ? cAccent : cInk;
      lay(v.x - 2, v.y - 2, v.x + 2, v.y + 2, col, 0.85);
    }
  }

  const B = buildLayoutChrome({ spec, parts, record, template, ground, look: "living", layout, format, series: spec.series ?? "", subtitle: "" }).blocks;
  if (layout === "editorial") {
    const rw = format === "og" ? template.tableW : W - 2 * template.margin;
    lay(template.margin, template.ruleY, template.margin + rw, template.ruleY + S, cInk, 0.25);
    lay(template.margin, template.bottomRuleY, template.margin + rw, template.bottomRuleY + S, cInk, 0.25);
  } else if (layout === "blueprint" && template.frame) {
    strokeBox(template.frame, cInk, 0.35);
    if (template.titleBlock) strokeBox(template.titleBlock, cInk, 0.3);
  } else if (layout === "macro" && B.cards) {
    for (const c of Object.values(B.cards)) {
      lay(c.x, c.y, c.x + c.w, c.y + c.h, cGround, 0.85);
      strokeBox(c, cInk, 0.22);
    }
  }

  const bar = (left, top, lines, size) =>
    lines.forEach((t, i) => lay(left, top + i * COVER.lead + 3, left + t.length * size * 0.52, top + i * COVER.lead + 11, cInk, 0.35));
  bar(B.record.left, B.record.top, B.record.lines, COVER.small);
  bar(B.headline.left, B.headline.top, B.headline.lines, COVER.small);
  bar(B.legend.left, B.legend.top, B.legend.lines, COVER.small);
  const name = B.name.size;
  lay(B.name.left + name * 0.05, B.name.top + name * 0.14, B.name.left + spec.product.name.length * name * 0.55, B.name.top + name * 0.86, cInk, 0.45);

  const out = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h * 3; i++) {
    out[i] = Math.max(0, Math.min(255, Math.round(buf[i])));
  }
  return encodePng(w, h, out);
}

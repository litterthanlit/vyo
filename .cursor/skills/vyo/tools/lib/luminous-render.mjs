// The luminous frame in Node: codebase strata model computation, self-contained HTML page
// with bundled fonts and inlined luminous-page.js, and crisp CLI sketch summary.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLuminousStrata } from "./luminous-strata.mjs";
import { partsFromFacts } from "./parts.mjs";
import { SHEET } from "./geometry.mjs";

const LIB = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(LIB, "..", "..", "fonts");

/** Fonts bundled into every luminous HTML page. */
export const LUMINOUS_FONTS = [
  ["Commit Mono", 400, "commit-400.otf", "font/otf"],
  ["Commit Mono", 700, "commit-700.otf", "font/otf"],
  ["Inter Display", 600, "inter-display-600.woff2", "font/woff2"],
];

export const LUMINOUS_GROUNDS = {
  obsidian: { paper: "#090A0D", ink: "#FFFFFF", hot: "#E23848" },
  alabaster: { paper: "#F2F3F6", ink: "#111316", hot: "#CC262F" },
};

const cache = new WeakMap();

/**
 * Compute the luminous frame payload once per spec object: region, real codebase strata,
 * theme, product metadata, copy, soft-lit subject, microType, and deterministic seed.
 */
export function luminousOf(spec, facts) {
  if (cache.has(spec)) return cache.get(spec);
  const region = spec.figure.regions.find((r) => r.kind === "luminous");
  const rawAccent = region?.accent;
  const accentIds = Array.isArray(rawAccent)
    ? rawAccent.filter((a) => typeof a === "string" && !a.trim().startsWith("…"))
    : typeof rawAccent === "string" && !rawAccent.trim().startsWith("…")
      ? [rawAccent]
      : [];
  const strata = buildLuminousStrata(facts, accentIds, { pitch: 7, seed: region?.seed });
  const theme = spec.theme === "alabaster" ? "alabaster" : "obsidian";
  const legend = spec.figure.texts.find((t) => t.role === "legend")?.text ?? "";
  const subject = region?.subject ?? {};
  const microType = Array.isArray(region?.microType) ? region.microType : [];
  const out = {
    region,
    strata,
    theme,
    product: spec.product,
    headline: spec.headline,
    legend,
    subject,
    microType,
    seed: strata.seed,
  };
  cache.set(spec, out);
  return out;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

function fontFaces() {
  return LUMINOUS_FONTS.map(([family, weight, file, type]) => {
    const where = path.join(FONT_DIR, file);
    if (!fs.existsSync(where)) throw new Error(`fonts missing in ${FONT_DIR} (${file}): reinstall @litterthanlit/vyo`);
    return `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:${type};base64,${fs.readFileSync(where).toString("base64")})}`;
  }).join("\n");
}

const luminousScript = () =>
  fs.readFileSync(path.join(LIB, "luminous-page.js"), "utf8").replace(/<\/script/gi, "<\\/script");

/** Build one self-contained HTML page for the luminous frame. */
export function luminousPage(spec, facts, prelude) {
  const { theme, product, headline, legend, strata, subject, microType, seed } = luminousOf(spec, facts);
  const G = LUMINOUS_GROUNDS[theme];
  const payload = { theme, product, headline, legend, strata, subject, microType, seed };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(product.name)} luminous poster</title><style>
${fontFaces()}
* { box-sizing: border-box; margin: 0; padding: 0 }
:root { --paper:${G.paper}; --ink:${G.ink}; --hot:${G.hot} }
html, body { background: var(--paper) }
.sheet { position: relative; width: ${SHEET.width}px; height: ${SHEET.height}px; overflow: hidden; background: var(--paper); color: var(--ink) }
#luminous { position: absolute; left: 0; top: 0; width: ${SHEET.width}px; height: ${SHEET.height}px; display: block }
</style><script>${prelude}</script></head><body><div class="sheet">
<canvas id="luminous" width="${SHEET.width}" height="${SHEET.height}"></canvas>
</div><script>window.__VYO_LUMINOUS__ = ${json(payload)};</script><script>${luminousScript()}</script></body></html>`;
}

/** Print a crisp CLI sketch report for a luminous poster. */
export function luminousSketchText(spec, facts) {
  const { strata, theme, subject, microType } = luminousOf(spec, facts);
  const isAlabaster = theme === "alabaster";
  const defaultSanctuary = isAlabaster ? { x: 0, y: 0, w: 540, h: 252 } : { x: 0, y: 392, w: 396, h: 350 };
  const sBox = subject?.sanctuary && Number.isFinite(subject.sanctuary.x) ? subject.sanctuary : defaultSanctuary;
  const svgStr = typeof subject?.svg === "string" ? subject.svg : "";
  const svgReady = svgStr.trim().length > 0 && !svgStr.trim().startsWith("…") && /<svg\b/i.test(svgStr);
  const core = microType.filter((m) => m?.style === "core").length;
  const whisper = microType.filter((m) => m?.style === "whisper").length;
  const part = microType.length - core - whisper;

  const parts = partsFromFacts(facts);
  const totalLoc = parts.reduce((s, p) => s + p.loc, 0) || 1;
  const width = Math.max(20, ...parts.map((p) => p.id.length));
  const pct = (n) => `${(Math.round(n * 1000) / 10).toFixed(1)}%`;

  const lines = [
    `luminous: ${theme} theme; ${strata.totalFiles} files, ${strata.totalLoc.toLocaleString("en-US")} lines, ${strata.totalImports} imports, ${strata.slices.length} strata slices (${strata.accentFiles} accent files, ${strata.faultRows.length} fault rows)`,
    `concept: ${typeof subject?.concept === "string" ? subject.concept : "(missing)"}`,
    `subject: ${svgReady ? `soft-lit SVG (${svgStr.length} bytes)` : "placeholder / not yet authored"}; refractMask: ${subject?.refractMaskSvg ? "custom SVG" : "auto-derived"}, strength: ${subject?.refractStrength ?? 1}`,
    `sanctuary: x=${sBox.x} y=${sBox.y} w=${sBox.w} h=${sBox.h} (${subject?.sanctuary ? "custom" : `default ${theme}`})`,
    `microType: ${microType.length} phrases (${core} core, ${part} part, ${whisper} whisper)`,
  ];
  if (parts.length) {
    lines.push("areas (id, share, lines, files, scanned name):");
    for (const p of parts.slice(0, 12)) {
      lines.push(`  ${p.id.padEnd(width)}  ${pct(p.loc / totalLoc).padStart(6)}  ${String(p.loc).padStart(6)}  ${String(p.files).padStart(4)}  ${p.name}`);
    }
  }
  return lines.join("\n") + "\n";
}

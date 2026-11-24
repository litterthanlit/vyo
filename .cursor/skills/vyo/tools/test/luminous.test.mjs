// Luminous frame unit + browser tests (vyo v3):
// - buildLuminousStrata determinism, LOC conservation, accent matching, empty scan handling
// - compose --frame luminous (--style, --palette, --theme, --facts hint when facts live elsewhere)
// - validateSpec accepting all 5 styles & 5 palettes, backwards-compatible theme-only specs,
//   rejecting bad style/palette/theme, <script>/external URLs in SVG, jargon in microType
// - luminous-subject & luminous-tonal warning on flat rectangle SVG vs passing on soft-lit SVG
// - auto dark/light SVG normalization (same dark-ground SVG renders cleanly across all 5 styles + palettes,
//   and light-ground SVG renders cleanly in dark styles)
// - spec-stem output filenames on vyo render so multiple styles coexist in one folder without overwriting
// - end-to-end vyo sketch & vyo render across all 5 styles (1680x2380 PNG, 280x396 thumb, PDF, metrics)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scanRepo } from "../lib/scan/index.mjs";
import { buildLuminousStrata } from "../lib/luminous-strata.mjs";
import { luminousOf, luminousPage, luminousSketchText } from "../lib/luminous-render.mjs";
import { LUMINOUS_STYLES, LUMINOUS_PALETTES, LUMINOUS_PALETTE_WORDS } from "../lib/frame.mjs";
import { luminousScaffold, validateSpec } from "../lib/spec.mjs";
import { runChecks } from "../lib/check.mjs";
import { buildPage, renderPage } from "../lib/render.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.join(HERE, "..");
const LIB = path.join(TOOLS, "lib");
const VYO = path.join(TOOLS, "vyo.mjs");
const recipe = scanRepo(path.join(HERE, "fixtures", "recipe"));
const emptyScan = scanRepo(path.join(HERE, "fixtures", "empty"));

const vyo = (...args) => spawnSync(process.execPath, [VYO, ...args], { encoding: "utf8" });

const SOFT_OBSIDIAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 1190">
  <defs>
    <radialGradient id="coolAura" cx="68%" cy="32%" r="48%">
      <stop offset="0%" stop-color="#DDF6FF" stop-opacity="0.98"/>
      <stop offset="30%" stop-color="#48B8E8" stop-opacity="0.88"/>
      <stop offset="65%" stop-color="#2B48A8" stop-opacity="0.58"/>
      <stop offset="100%" stop-color="#090A0D" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="crimsonHeart" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF7880" stop-opacity="0.98"/>
      <stop offset="40%" stop-color="#E52D38" stop-opacity="0.94"/>
      <stop offset="78%" stop-color="#8A1424" stop-opacity="0.52"/>
      <stop offset="100%" stop-color="#090A0D" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="waterfall" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#6AD2FA" stop-opacity="0.82"/>
      <stop offset="45%" stop-color="#3E68C8" stop-opacity="0.64"/>
      <stop offset="85%" stop-color="#4A2F7A" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#090A0D" stop-opacity="0"/>
    </linearGradient>
    <filter id="softBlur"><feGaussianBlur stdDeviation="24"/></filter>
    <filter id="canyonBlur"><feGaussianBlur stdDeviation="16"/></filter>
  </defs>
  <rect width="840" height="1190" fill="#000000"/>
  <ellipse cx="590" cy="360" rx="280" ry="300" fill="url(#coolAura)" filter="url(#softBlur)"/>
  <path d="M 430 430 C 520 390, 740 410, 780 560 L 760 1120 L 420 1120 Z" fill="url(#waterfall)" filter="url(#softBlur)"/>
  <polygon points="590,145 430,365 770,385" fill="url(#coolAura)" opacity="0.85"/>
  <path d="M 590 160 L 580 330 L 745 375" stroke="#000000" stroke-width="26" fill="none" filter="url(#canyonBlur)" opacity="0.72"/>
  <ellipse cx="615" cy="340" rx="115" ry="96" fill="url(#crimsonHeart)" filter="url(#softBlur)"/>
  <circle cx="592" cy="175" r="24" fill="#FFFFFF" opacity="0.9" filter="url(#canyonBlur)"/>
</svg>`;

const SOFT_ALABASTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 1190">
  <defs>
    <linearGradient id="mistHill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#6B8FA8" stop-opacity="0.75"/>
      <stop offset="50%" stop-color="#A8C0D2" stop-opacity="0.48"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="deepHill" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22445C" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#4A7492" stop-opacity="0.78"/>
      <stop offset="100%" stop-color="#C8D6E2" stop-opacity="0.25"/>
    </linearGradient>
    <radialGradient id="vermilionTide" cx="55%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#CC262F" stop-opacity="0.96"/>
      <stop offset="55%" stop-color="#D9454E" stop-opacity="0.78"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="hillBlur"><feGaussianBlur stdDeviation="20"/></filter>
  </defs>
  <path d="M 380 290 Q 590 210 840 310 L 840 620 L 220 620 Z" fill="url(#mistHill)" filter="url(#hillBlur)"/>
  <path d="M 120 460 Q 460 340 840 470 L 840 1190 L 60 1190 Z" fill="url(#deepHill)" filter="url(#hillBlur)"/>
  <path d="M 160 660 Q 480 580 840 680" stroke="#FFFFFF" stroke-width="24" fill="none" filter="url(#hillBlur)" opacity="0.85"/>
  <ellipse cx="560" cy="610" rx="220" ry="110" fill="url(#vermilionTide)" filter="url(#hillBlur)"/>
  <path d="M 100 840 Q 470 760 840 860 L 840 1190 L 80 1190 Z" fill="url(#deepHill)" opacity="0.88" filter="url(#hillBlur)"/>
</svg>`;

const FLAT_RECT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 1190">
  <rect x="440" y="180" width="320" height="720" fill="#FFFFFF"/>
  <rect x="520" y="340" width="160" height="160" fill="#E52D38"/>
</svg>`;

const SAMPLE_MICRO = [
  { text: "saved recipes", u: 0.56, v: 0.24, style: "part" },
  { text: "the weekly plan", u: 0.62, v: 0.34, style: "core" },
  { text: "one week", u: 0.76, v: 0.44, style: "core" },
  { text: "meal cards", u: 0.68, v: 0.54, style: "part" },
  { text: "shopping list", u: 0.58, v: 0.68, style: "part" },
  { text: "cook what you have", u: 0.72, v: 0.78, style: "part" },
  { text: "fresh ideas", u: 0.54, v: 0.86, style: "whisper" },
  { text: "pantry shelf", u: 0.80, v: 0.62, style: "whisper" },
];

function filledLuminousSpec({ style = "obsidian", palette, theme, svg } = {}) {
  const spec = luminousScaffold(recipe, {
    commit: "04186f4",
    date: "2026-11-07",
    accent: "area:lib/plan",
    style,
    palette,
    theme,
  });
  const colorWord = LUMINOUS_PALETTE_WORDS[spec.palette] || "crimson";
  spec.product.name = "Pantry";
  spec.headline = "A week of dinners, planned from the recipes you already cook.";
  spec.figure.regions[0].subject.concept = "A glowing crystal prism turning saved recipes into one calm weekly plan.";
  spec.figure.regions[0].subject.svg = svg ?? (style === "alabaster" ? SOFT_ALABASTER_SVG : SOFT_OBSIDIAN_SVG);
  spec.figure.regions[0].microType = SAMPLE_MICRO.map((m) => ({ ...m }));
  spec.figure.texts[0].text = `${colorWord} marks the weekly plan`;
  return spec;
}

test("buildLuminousStrata: deterministic, conserves LOC, matches single/glob/array accents, handles empty scans", () => {
  const a = buildLuminousStrata(recipe, "area:lib/plan");
  const b = buildLuminousStrata(recipe, "area:lib/plan");
  assert.deepEqual(a, b, "buildLuminousStrata is deterministic");

  const expectedLoc = Object.values(recipe.files).reduce((s, f) => s + (f.gen ? 0 : f.loc), 0);
  const expectedFiles = Object.values(recipe.files).filter((f) => !f.gen).length;
  assert.equal(a.totalLoc, expectedLoc, "conserves exact non-generated LOC");
  assert.equal(a.totalFiles, expectedFiles, "conserves exact non-generated file count");
  assert.equal(a.cols, 120);
  assert.equal(a.rows, 170);
  assert.ok(a.slices.length > 0, "produces strata slices");
  assert.ok(a.accentFiles > 0, "matches area:lib/plan accent files");
  assert.ok(Math.abs(a.slices[0].y0 - 0.06) < 1e-6, "starts at y0=0.06");
  assert.ok(Math.abs(a.slices[a.slices.length - 1].y1 - 1.0) < 1e-6, "ends at y1=1.0");
  assert.ok(Array.isArray(a.faultRows), "returns faultRows array");
  assert.ok(a.topRows.length > 0 && a.topRows.length <= 6, "returns up to 6 topRows");

  const multi = buildLuminousStrata(recipe, ["area:lib/plan", "area:lib/ai"]);
  assert.ok(multi.accentFiles >= a.accentFiles, "array of accents matches union");

  const glob = buildLuminousStrata(recipe, "area:lib/*");
  assert.ok(glob.accentFiles >= a.accentFiles, "glob accent matches subtree");

  const empty = buildLuminousStrata(emptyScan, "area:lib/plan");
  assert.equal(empty.totalFiles, 0);
  assert.equal(empty.totalLoc, 0);
  assert.deepEqual(empty.slices, []);
});

test("luminousScaffold, 5 styles x 5 palettes validation, backwards-compatibility, and script compilation", () => {
  const scriptCode = fs.readFileSync(path.join(LIB, "luminous-page.js"), "utf8");
  assert.doesNotThrow(() => new vm.Script(`"use strict"; {\n${scriptCode}\n}`), "luminous-page.js compiles cleanly");

  assert.deepEqual(LUMINOUS_STYLES, ["obsidian", "alabaster", "optics", "riso", "contour"]);
  assert.deepEqual(LUMINOUS_PALETTES, ["crimson", "pine", "abyss", "vermilion", "cobalt"]);

  // Unfilled scaffold fails validation with clear placeholder messages and palette-matched color words
  for (const [pal, word] of Object.entries(LUMINOUS_PALETTE_WORDS)) {
    const raw = luminousScaffold(recipe, { commit: "04186f4", date: "2026-11-07", style: "contour", palette: pal });
    assert.ok(raw.figure.regions[0].subject.svg.includes(word), `subject.svg placeholder mentions ${word} for ${pal}`);
    assert.ok(raw.figure.texts[0].text.includes(word), `legend placeholder mentions ${word} for ${pal}`);
  }
  const raw = luminousScaffold(recipe, { commit: "04186f4", date: "2026-11-07", theme: "obsidian" });
  const rawErrs = validateSpec(raw);
  assert.ok(rawErrs.some((e) => e.includes("product.name: still the placeholder")));
  assert.ok(rawErrs.some((e) => e.includes("headline: still the placeholder")));
  assert.ok(rawErrs.some((e) => e.includes("subject.svg: still the placeholder")));
  assert.ok(rawErrs.some((e) => e.includes("microType: still has placeholder")));

  // All 5 styles validate cleanly, produce valid HTML and sketch text
  for (const style of LUMINOUS_STYLES) {
    const spec = filledLuminousSpec({ style });
    assert.deepEqual(validateSpec(spec), [], `${style} valid spec has 0 validateSpec errors`);
    const findings = runChecks("spec", { spec, facts: recipe, presets: {} });
    assert.deepEqual(findings, [], `${style} valid spec has 0 spec-stage findings`);

    const html = luminousPage(spec, recipe, "");
    assert.ok(html.includes("window.__VYO_LUMINOUS__"), `${style} page embeds payload`);
    assert.ok(html.includes('<canvas id="luminous"'), `${style} page includes canvas`);

    const sketchTxt = luminousSketchText(spec, recipe);
    assert.match(sketchTxt, new RegExp(`^luminous: ${style} style \\(`), `${style} sketch report starts cleanly`);
  }

  // Legacy backwards-compatible spec with theme only (no style or palette) validates & resolves defaults
  const legacyObs = filledLuminousSpec({ style: "obsidian" });
  delete legacyObs.style;
  delete legacyObs.palette;
  assert.deepEqual(validateSpec(legacyObs), [], "legacy theme-only obsidian spec validates cleanly");
  assert.equal(luminousOf(legacyObs, recipe).style, "obsidian");
  assert.equal(luminousOf(legacyObs, recipe).palette, "crimson");

  const legacyAla = filledLuminousSpec({ style: "alabaster" });
  delete legacyAla.style;
  delete legacyAla.palette;
  assert.deepEqual(validateSpec(legacyAla), [], "legacy theme-only alabaster spec validates cleanly");
  assert.equal(luminousOf(legacyAla, recipe).style, "alabaster");
  assert.equal(luminousOf(legacyAla, recipe).palette, "vermilion");

  // New spec with style + palette only (theme omitted) validates cleanly
  const styleOnly = filledLuminousSpec({ style: "optics", palette: "pine" });
  delete styleOnly.theme;
  assert.deepEqual(validateSpec(styleOnly), [], "style-only optics spec validates cleanly");
  assert.equal(luminousOf(styleOnly, recipe).style, "optics");
  assert.equal(luminousOf(styleOnly, recipe).palette, "pine");

  // Reject bad theme, bad style, bad palette
  const badTheme = filledLuminousSpec({ style: "obsidian" });
  badTheme.theme = "dark";
  assert.ok(validateSpec(badTheme).some((e) => /theme: "dark" is not a luminous theme; use obsidian or alabaster/.test(e)));

  const badStyle = filledLuminousSpec({ style: "obsidian" });
  badStyle.style = "neon";
  assert.ok(validateSpec(badStyle).some((e) => /style: "neon" is not a luminous style; use obsidian, alabaster, optics, riso, contour/.test(e)));

  const badPalette = filledLuminousSpec({ style: "obsidian" });
  badPalette.palette = "gold";
  assert.ok(validateSpec(badPalette).some((e) => /palette: "gold" is not a luminous palette; use crimson, pine, abyss, vermilion, cobalt/.test(e)));

  // Reject <script> and external URLs in SVG
  const scriptSvg = filledLuminousSpec({ style: "obsidian" });
  scriptSvg.figure.regions[0].subject.svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`;
  assert.ok(validateSpec(scriptSvg).some((e) => /<script> tags are not allowed/.test(e)));

  const extSvg = filledLuminousSpec({ style: "obsidian" });
  extSvg.figure.regions[0].subject.svg = `<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>`;
  assert.ok(validateSpec(extSvg).some((e) => /external http\/https URLs are not allowed/.test(e)));

  // Reject jargon in microType
  const jargonSpec = filledLuminousSpec({ style: "obsidian" });
  jargonSpec.figure.regions[0].microType[0].text = "fast api endpoints";
  assert.ok(validateSpec(jargonSpec).some((e) => /microType\[0\]\.text: jargon: "api", "endpoints"/.test(e)));

  // luminous-subject warns on flat SVG with no gradients/blur/opacity
  const flatSpec = filledLuminousSpec({ style: "obsidian", svg: FLAT_RECT_SVG });
  assert.deepEqual(validateSpec(flatSpec), [], "flat SVG still passes structural schema");
  const flatSpecFindings = runChecks("spec", { spec: flatSpec, facts: recipe, presets: {} });
  assert.ok(flatSpecFindings.some((f) => f.id === "luminous-subject" && f.level === "warn"), "flat SVG warns luminous-subject");
});

test("CLI compose --frame luminous (--style/--palette/--facts hint), spec-stem outputs, auto-normalization, and all 5 styles", { timeout: 240_000 }, async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vyo-luminous-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const factsDir = path.join(tmp, "facts-store");
  fs.mkdirSync(factsDir, { recursive: true });
  const factsFile = path.join(factsDir, "recipe-facts.json");
  const scanRes = vyo("scan", path.join(HERE, "fixtures", "recipe"), "--out", factsFile);
  assert.equal(scanRes.status, 0, scanRes.stderr);

  // 1. compose --frame luminous with --style and --palette in a different dir includes --facts hint
  const specsDir = path.join(tmp, "specs");
  fs.mkdirSync(specsDir, { recursive: true });
  const scaffoldFile = path.join(specsDir, "recipe-riso.json");
  const compRes = vyo(
    "compose", factsFile,
    "--frame", "luminous",
    "--style", "riso",
    "--palette", "cobalt",
    "--accent", "area:lib/plan",
    "--out", scaffoldFile,
  );
  assert.equal(compRes.status, 0, compRes.stderr);
  assert.match(compRes.stdout, /luminous riso style, cobalt palette/);
  assert.ok(compRes.stdout.includes(`--facts ${factsFile}`), "composeLuminous prints --facts hint when facts live in another dir");
  const scaffold = JSON.parse(fs.readFileSync(scaffoldFile, "utf8"));
  assert.equal(scaffold.frame, "luminous");
  assert.equal(scaffold.style, "riso");
  assert.equal(scaffold.palette, "cobalt");
  assert.equal(scaffold.theme, "alabaster");
  assert.equal(scaffold.figure.regions[0].accent, "area:lib/plan");

  // compose in same dir as <repo>-facts.json omits redundant --facts hint
  const sameDirSpec = path.join(factsDir, "recipe-obsidian.json");
  const compSame = vyo("compose", factsFile, "--frame", "luminous", "--theme", "obsidian", "--out", sameDirSpec);
  assert.equal(compSame.status, 0, compSame.stderr);
  assert.ok(!compSame.stdout.includes("--facts "), "composeLuminous omits --facts hint when beside <repo>-facts.json");

  const skPlaceholder = vyo("sketch", scaffoldFile, "--facts", factsFile);
  assert.equal(skPlaceholder.status, 0, skPlaceholder.stderr);
  assert.match(skPlaceholder.stdout, /sketch PNG: skipped \(subject\.svg is still a placeholder/);

  // 2. Flat rectangle SVG triggers luminous-tonal warning via vyo check
  const flatFile = path.join(tmp, "flat-poster.json");
  fs.writeFileSync(flatFile, JSON.stringify(filledLuminousSpec({ style: "obsidian", svg: FLAT_RECT_SVG }), null, 2));
  const flatCheck = vyo("check", flatFile, "--facts", factsFile);
  assert.equal(flatCheck.status, 0, flatCheck.stderr);
  assert.match(flatCheck.stderr, /^! luminous-subject:/m, "flat SVG warns luminous-subject");
  assert.match(flatCheck.stderr, /^! luminous-tonal: subject\.svg reads as flat clip-art/m, "flat SVG warns luminous-tonal");

  // 3. Render ALL 5 STYLES in the SAME directory sharing the EXACT SAME dark-ground SOFT_OBSIDIAN_SVG!
  //    Verifies auto dark/light SVG normalization + spec-stem output filenames (zero overwrites) + 1680x2380 PNG + metrics.
  const sharedDir = path.join(tmp, "all-5-styles");
  fs.mkdirSync(sharedDir, { recursive: true });
  const styleCases = [
    { stem: "recipe-obsidian", style: "obsidian", palette: "crimson" },
    { stem: "recipe-alabaster", style: "alabaster", palette: "vermilion" },
    { stem: "recipe-optics", style: "optics", palette: "pine" },
    { stem: "recipe-riso", style: "riso", palette: "cobalt" },
    { stem: "recipe-contour", style: "contour", palette: "abyss" },
  ];

  for (const tc of styleCases) {
    const file = path.join(sharedDir, `${tc.stem}.json`);
    const spec = filledLuminousSpec({ style: tc.style, palette: tc.palette, svg: SOFT_OBSIDIAN_SVG });
    fs.writeFileSync(file, JSON.stringify(spec, null, 2));

    const r = vyo("render", file, "--facts", factsFile);
    assert.equal(r.status, 0, `${tc.style} render failed:\n${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /^PASS$/m, `${tc.style} render prints PASS`);
    assert.doesNotMatch(r.stderr, /^✗/m, `${tc.style} render has zero failures`);
    assert.doesNotMatch(r.stderr, /^! luminous-(tonal|accent|subject):/m, `${tc.style} render has zero luminous quality warnings:\n${r.stderr}`);

    const png = path.join(sharedDir, `${tc.stem}.png`);
    const thumb = path.join(sharedDir, `${tc.stem}-thumb.png`);
    const pdf = path.join(sharedDir, `${tc.stem}.pdf`);
    assert.ok(fs.existsSync(png) && fs.existsSync(thumb) && fs.existsSync(pdf), `${tc.style} writes ${tc.stem}.png, -thumb.png, and .pdf`);

    const pngBuf = fs.readFileSync(png);
    assert.equal(pngBuf.readUInt32BE(16), 1680, `${tc.style} PNG width is 1680`);
    assert.equal(pngBuf.readUInt32BE(20), 2380, `${tc.style} PNG height is 2380`);
    const thumbBuf = fs.readFileSync(thumb);
    assert.equal(thumbBuf.readUInt32BE(16), 280, `${tc.style} thumb width is 280`);
    assert.equal(thumbBuf.readUInt32BE(20), 396, `${tc.style} thumb height is 396`);

    // Verify window.__vyoLuminousMetrics directly through renderPage
    const pageReport = await renderPage({ html: buildPage(spec, recipe), base: path.join(sharedDir, `${tc.stem}-metrics`), png: false, pdf: false });
    assert.ok(pageReport.drawn, `${tc.style} pageReport.drawn is true`);
    assert.ok(pageReport.luminous, `${tc.style} exposes __vyoLuminousMetrics`);
    assert.equal(pageReport.luminous.style, tc.style);
    assert.equal(pageReport.luminous.palette, tc.palette);
    assert.equal(pageReport.luminous.sourceIsDark, true, `${tc.style} auto-detected dark-ground source SVG`);
    assert.ok(pageReport.luminous.tonalRichness.activeBins >= 4, `${tc.style} activeBins=${pageReport.luminous.tonalRichness.activeBins} >= 4`);
    assert.ok(pageReport.luminous.tonalRichness.midToneRatio >= 0.18, `${tc.style} midToneRatio=${pageReport.luminous.tonalRichness.midToneRatio} >= 0.18`);
    assert.ok(pageReport.luminous.litShare > 0.12, `${tc.style} litShare=${pageReport.luminous.litShare} > 0.12`);
    assert.ok(pageReport.luminous.accentShare >= 0.03 && pageReport.luminous.accentShare <= 0.45, `${tc.style} accentShare=${pageReport.luminous.accentShare} in [0.03, 0.45]`);
    assert.equal(pageReport.luminous.sanctuaryCollisions, 0, `${tc.style} sanctuaryCollisions === 0`);
    assert.ok(pageReport.luminous.microPlaced >= 5, `${tc.style} microPlaced=${pageReport.luminous.microPlaced} >= 5`);
  }

  // Confirm all 5 spec-stem PNGs still coexist in sharedDir without overwriting each other
  for (const tc of styleCases) {
    assert.ok(fs.existsSync(path.join(sharedDir, `${tc.stem}.png`)), `${tc.stem}.png preserved alongside other styles`);
  }

  // 4. Reverse auto-normalization check: light-ground SOFT_ALABASTER_SVG renders cleanly in dark optics & light contour!
  for (const [style, palette] of [["optics", "crimson"], ["contour", "vermilion"]]) {
    const revSpec = filledLuminousSpec({ style, palette, svg: SOFT_ALABASTER_SVG });
    const revReport = await renderPage({ html: buildPage(revSpec, recipe), base: path.join(sharedDir, `rev-${style}`), png: false, pdf: false });
    assert.ok(revReport.drawn, `light-SVG -> ${style} drawn`);
    assert.equal(revReport.luminous.sourceIsDark, false, `light-SVG -> ${style} detected light-ground source SVG`);
    assert.equal(revReport.luminous.sanctuaryCollisions, 0, `light-SVG -> ${style} has 0 sanctuary collisions`);
    assert.ok(revReport.luminous.litShare > 0.12 && revReport.luminous.accentShare >= 0.03 && revReport.luminous.accentShare <= 0.45);
  }
});

// Luminous frame unit + browser tests:
// - buildLuminousStrata determinism, LOC conservation, accent matching, empty scan handling
// - compose --frame luminous scaffold & placeholder validation
// - validateSpec rejecting bad themes, <script>/external URLs in SVG, jargon in microType
// - luminous-subject & luminous-tonal warning on flat rectangle SVG vs passing on soft-lit gradient+blur SVG
// - end-to-end vyo sketch & vyo render on both obsidian and alabaster themes (1680x2380 PNG, 280x396 thumb, PDF, metrics)
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

function filledLuminousSpec(theme = "obsidian", svg = theme === "alabaster" ? SOFT_ALABASTER_SVG : SOFT_OBSIDIAN_SVG) {
  const spec = luminousScaffold(recipe, {
    commit: "04186f4",
    date: "2026-11-07",
    accent: "area:lib/plan",
    theme,
  });
  spec.product.name = "Pantry";
  spec.headline = "A week of dinners, planned from the recipes you already cook.";
  spec.figure.regions[0].subject.concept = theme === "alabaster"
    ? "Seven terraced harvest hills beneath a vermilion weekly dinner tide."
    : "A glowing crystal prism turning saved recipes into one calm weekly plan.";
  spec.figure.regions[0].subject.svg = svg;
  spec.figure.regions[0].microType = SAMPLE_MICRO.map((m) => ({ ...m }));
  spec.figure.texts[0].text = theme === "alabaster"
    ? "vermilion marks the weekly plan"
    : "crimson marks the weekly plan";
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

test("luminousScaffold, validateSpec, luminous-jargon, luminous-subject, and script compilation", () => {
  const scriptCode = fs.readFileSync(path.join(LIB, "luminous-page.js"), "utf8");
  assert.doesNotThrow(() => new vm.Script(`"use strict"; {\n${scriptCode}\n}`), "luminous-page.js compiles cleanly");

  // Unfilled scaffold fails validation with clear placeholder messages
  const raw = luminousScaffold(recipe, { commit: "04186f4", date: "2026-11-07", theme: "obsidian" });
  const rawErrs = validateSpec(raw);
  assert.ok(rawErrs.some((e) => e.includes("product.name: still the placeholder")));
  assert.ok(rawErrs.some((e) => e.includes("headline: still the placeholder")));
  assert.ok(rawErrs.some((e) => e.includes("subject.svg: still the placeholder")));
  assert.ok(rawErrs.some((e) => e.includes("microType: still has placeholder")));

  // Valid obsidian & alabaster specs pass validateSpec & spec-stage checks cleanly
  for (const theme of ["obsidian", "alabaster"]) {
    const spec = filledLuminousSpec(theme);
    assert.deepEqual(validateSpec(spec), [], `${theme} valid spec has 0 validateSpec errors`);
    const findings = runChecks("spec", { spec, facts: recipe, presets: {} });
    assert.deepEqual(findings, [], `${theme} valid spec has 0 spec-stage findings`);

    const html = luminousPage(spec, recipe, "");
    assert.ok(html.includes("window.__VYO_LUMINOUS__"), `${theme} page embeds payload`);
    assert.ok(html.includes('<canvas id="luminous"'), `${theme} page includes canvas`);

    const sketchTxt = luminousSketchText(spec, recipe);
    assert.match(sketchTxt, new RegExp(`^luminous: ${theme} theme;`), `${theme} sketch report starts cleanly`);
  }

  // Reject bad theme
  const badTheme = filledLuminousSpec("obsidian");
  badTheme.theme = "dark";
  assert.ok(validateSpec(badTheme).some((e) => /theme: "dark" is not a luminous theme; use obsidian or alabaster/.test(e)));

  // Reject <script> in SVG
  const scriptSvg = filledLuminousSpec("obsidian");
  scriptSvg.figure.regions[0].subject.svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`;
  assert.ok(validateSpec(scriptSvg).some((e) => /<script> tags are not allowed/.test(e)));

  // Reject external URLs in SVG (while standard xmlns is allowed above)
  const extSvg = filledLuminousSpec("obsidian");
  extSvg.figure.regions[0].subject.svg = `<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>`;
  assert.ok(validateSpec(extSvg).some((e) => /external http\/https URLs are not allowed/.test(e)));

  // Reject jargon in microType via both validateSpec and luminous-jargon
  const jargonSpec = filledLuminousSpec("obsidian");
  jargonSpec.figure.regions[0].microType[0].text = "fast api endpoints";
  assert.ok(validateSpec(jargonSpec).some((e) => /microType\[0\]\.text: jargon: "api", "endpoints"/.test(e)));
  const jargonFindings = runChecks("spec", { spec: jargonSpec, facts: recipe, presets: {} });
  assert.ok(jargonFindings.some((f) => f.id === "spec" && /jargon/.test(f.message)));

  // luminous-subject warns on flat SVG with no gradients/blur/opacity
  const flatSpec = filledLuminousSpec("obsidian", FLAT_RECT_SVG);
  assert.deepEqual(validateSpec(flatSpec), [], "flat SVG still passes structural schema");
  const flatSpecFindings = runChecks("spec", { spec: flatSpec, facts: recipe, presets: {} });
  assert.ok(flatSpecFindings.some((f) => f.id === "luminous-subject" && f.level === "warn"), "flat SVG warns luminous-subject");
});

test("CLI compose --frame luminous, sketch, luminous-tonal warning on flat SVG, and full obsidian/alabaster renders", { timeout: 180_000 }, async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vyo-luminous-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const factsFile = path.join(tmp, "recipe-facts.json");
  const scanRes = vyo("scan", path.join(HERE, "fixtures", "recipe"), "--out", factsFile);
  assert.equal(scanRes.status, 0, scanRes.stderr);

  // 1. compose --frame luminous creates scaffold, and sketch prints text-only when svg is placeholder
  const scaffoldFile = path.join(tmp, "recipe-poster.json");
  const compRes = vyo("compose", factsFile, "--frame", "luminous", "--theme", "obsidian", "--accent", "area:lib/plan", "--out", scaffoldFile);
  assert.equal(compRes.status, 0, compRes.stderr);
  assert.match(compRes.stdout, /luminous obsidian theme/);
  const scaffold = JSON.parse(fs.readFileSync(scaffoldFile, "utf8"));
  assert.equal(scaffold.frame, "luminous");
  assert.equal(scaffold.theme, "obsidian");
  assert.equal(scaffold.figure.regions[0].accent, "area:lib/plan");

  const skPlaceholder = vyo("sketch", scaffoldFile, "--facts", factsFile);
  assert.equal(skPlaceholder.status, 0, skPlaceholder.stderr);
  assert.match(skPlaceholder.stdout, /sketch PNG: skipped \(subject\.svg is still a placeholder/);

  // 2. Flat rectangle SVG triggers luminous-tonal warning via vyo check
  const flatFile = path.join(tmp, "flat-poster.json");
  fs.writeFileSync(flatFile, JSON.stringify(filledLuminousSpec("obsidian", FLAT_RECT_SVG), null, 2));
  const flatCheck = vyo("check", flatFile, "--facts", factsFile);
  assert.equal(flatCheck.status, 0, flatCheck.stderr);
  assert.match(flatCheck.stderr, /^! luminous-subject:/m, "flat SVG warns luminous-subject");
  assert.match(flatCheck.stderr, /^! luminous-tonal: subject\.svg reads as flat clip-art/m, "flat SVG warns luminous-tonal");

  // 3. vyo sketch on authored obsidian SVG writes <stem>-sketch.png (840x1190) and prints metrics
  const obsDir = path.join(tmp, "obsidian");
  fs.mkdirSync(obsDir, { recursive: true });
  const obsFile = path.join(obsDir, "recipe-poster.json");
  const obsSpec = filledLuminousSpec("obsidian");
  fs.writeFileSync(obsFile, JSON.stringify(obsSpec, null, 2));
  const skObs = vyo("sketch", obsFile, "--facts", factsFile);
  assert.equal(skObs.status, 0, skObs.stdout + skObs.stderr);
  const skPng = path.join(obsDir, "recipe-poster-sketch.png");
  assert.ok(fs.existsSync(skPng), "vyo sketch wrote <stem>-sketch.png");
  assert.match(skObs.stdout, /metrics: lit=/);

  // 4. End-to-end vyo render on both obsidian and alabaster: 1680x2380 PNG, 280x396 thumb, PDF, PASS, clean metrics
  for (const theme of ["obsidian", "alabaster"]) {
    const dir = path.join(tmp, `render-${theme}`);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "recipe-poster.json");
    const spec = filledLuminousSpec(theme);
    fs.writeFileSync(file, JSON.stringify(spec, null, 2));

    const r = vyo("render", file, "--facts", factsFile);
    assert.equal(r.status, 0, `${theme} render failed:\n${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /^PASS$/m, `${theme} render prints PASS`);
    assert.doesNotMatch(r.stderr, /^✗/m, `${theme} render has zero failures`);
    assert.doesNotMatch(r.stderr, /^! luminous-(tonal|accent|subject):/m, `${theme} render has zero luminous quality warnings:\n${r.stderr}`);

    const png = path.join(dir, "recipe-poster.png");
    const thumb = path.join(dir, "recipe-poster-thumb.png");
    const pdf = path.join(dir, "recipe-poster.pdf");
    assert.ok(fs.existsSync(png) && fs.existsSync(thumb) && fs.existsSync(pdf), `${theme} writes png, thumb, and pdf`);

    const pngBuf = fs.readFileSync(png);
    assert.equal(pngBuf.readUInt32BE(16), 1680, `${theme} PNG width is 1680`);
    assert.equal(pngBuf.readUInt32BE(20), 2380, `${theme} PNG height is 2380`);
    const thumbBuf = fs.readFileSync(thumb);
    assert.equal(thumbBuf.readUInt32BE(16), 280, `${theme} thumb width is 280`);
    assert.equal(thumbBuf.readUInt32BE(20), 396, `${theme} thumb height is 396`);

    // Verify window.__vyoLuminousMetrics directly through renderPage
    const pageReport = await renderPage({ html: buildPage(spec, recipe), base: path.join(dir, "metrics-check"), png: false, pdf: false });
    assert.ok(pageReport.drawn, `${theme} pageReport.drawn is true`);
    assert.ok(pageReport.luminous, `${theme} exposes __vyoLuminousMetrics`);
    assert.ok(pageReport.luminous.tonalRichness.activeBins >= 4, `${theme} activeBins=${pageReport.luminous.tonalRichness.activeBins} >= 4`);
    assert.ok(pageReport.luminous.tonalRichness.midToneRatio >= 0.18, `${theme} midToneRatio=${pageReport.luminous.tonalRichness.midToneRatio} >= 0.18`);
    assert.ok(pageReport.luminous.litShare > 0.12, `${theme} litShare=${pageReport.luminous.litShare} > 0.12`);
    assert.ok(pageReport.luminous.accentShare >= 0.03 && pageReport.luminous.accentShare <= 0.45, `${theme} accentShare=${pageReport.luminous.accentShare} in [0.03, 0.45]`);
    assert.equal(pageReport.luminous.sanctuaryCollisions, 0, `${theme} sanctuaryCollisions === 0`);
    assert.ok(pageReport.luminous.microPlaced >= 5, `${theme} microPlaced=${pageReport.luminous.microPlaced} >= 5`);
  }
});

// The plate frame and file-slice foundation: fileSlices conservation/bounds/coupling, marching-squares topo contours,
// octilinear blueprint schematics, spec validation, scaffolds, layouts, HTML chrome, and sketch output. Everything here
// runs in Node with zero browser dependency.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { scanRepo } from "../lib/scan/index.mjs";
import { fileSlices, partsFromFacts, regionParts, partTies } from "../lib/parts.mjs";
import { buildTopoPlate } from "../lib/plates/topo.mjs";
import { buildBlueprintPlate } from "../lib/plates/blueprint.mjs";
import { PLATES, PLATE_NAMES } from "../lib/plates/index.mjs";
import { plateOf, platePage, plateSketchLines, plateSketchImage } from "../lib/plate-render.mjs";
import { validateSpec, plateScaffold } from "../lib/spec.mjs";
import { COVER_GROUNDS, COVER_LAYOUTS, coverTemplate } from "../lib/cover.mjs";
import { runChecks } from "../lib/check.mjs";
import { decodePng } from "../lib/png.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.join(HERE, "..", "lib");
const recipe = scanRepo(path.join(HERE, "fixtures", "recipe"));
const got = JSON.parse(fs.readFileSync(path.join(HERE, "fixtures", "got-facts.json"), "utf8"));
const emptyScan = scanRepo(path.join(HERE, "fixtures", "empty"));
const coverPreset = JSON.parse(fs.readFileSync(path.join(HERE, "..", "presets", "cover.json"), "utf8"));

const RECIPE_NAMES = coverPreset.figure.regions[0].names;
const RECIPE_ACCENT = "area:app/(app)";
const STD_BOX = { left: 60, right: 780, top: 180, bottom: 1020 };

/** Non-generated total LOC in a facts object. */
const nonGenLoc = (facts) =>
  Object.values(facts.files ?? {}).reduce((s, f) => s + (f && !f.gen ? Number(f.loc) || 0 : 0), 0);

/** Build a synthetic small 4-file repo (2 parts, explicit imports, plus a generated file). */
function syntheticTinyFacts() {
  return {
    hash: "a1b2c3d4e5f6",
    repo: { name: "tiny" },
    facts: [
      { id: "area:.", kind: "area", name: "Tiny", loc: 420, meta: { leaf: false } },
      { id: "area:core", kind: "area", name: "Core", loc: 260, meta: { leaf: true } },
      { id: "area:ui", kind: "area", name: "Ui", loc: 160, meta: { leaf: true } },
    ],
    files: {
      "core/engine.js": { area: "area:core", loc: 180 },
      "core/state.js": { area: "area:core", loc: 80 },
      "ui/panel.js": { area: "area:ui", loc: 110 },
      "ui/button.js": { area: "area:ui", loc: 50 },
      "core/generated.d.ts": { area: "area:core", loc: 999, gen: 1 },
    },
    imports: [
      ["ui/panel.js", "core/engine.js"],   // cross-part: panel out+1 coup+1, engine in+1 coup+1
      ["ui/button.js", "core/state.js"],   // cross-part: button out+1 coup+1, state in+1 coup+1
      ["ui/panel.js", "ui/button.js"],     // intra-part: panel out+1, button in+1
      ["core/engine.js", "core/state.js"], // intra-part: engine out+1, state in+1
      ["core/engine.js", "core/engine.js"], // self-import: ignored
    ],
  };
}

/** Build a synthetic 200-file monorepo (10 leaf areas × 20 files each) with rich cross-area imports. */
function syntheticMonorepoFacts() {
  const areaNames = ["auth", "billing", "catalog", "search", "orders", "shipping", "notify", "analytics", "admin", "web"];
  const facts = [{ id: "area:.", kind: "area", name: "Mono", loc: 0, meta: { leaf: false } }];
  const files = {};
  const imports = [];
  let totalLoc = 0;

  for (let a = 0; a < areaNames.length; a++) {
    const name = areaNames[a];
    let areaLoc = 0;
    for (let f = 0; f < 20; f++) {
      const p = `pkg/${name}/mod_${String(f).padStart(2, "0")}.ts`;
      const loc = 40 + ((a * 37 + f * 29) % 240);
      files[p] = { area: `area:pkg/${name}`, loc };
      areaLoc += loc;
    }
    totalLoc += areaLoc;
    facts.push({ id: `area:pkg/${name}`, kind: "area", name, loc: areaLoc, meta: { leaf: true } });
  }
  facts[0].loc = totalLoc;

  // Deterministic cross-part and intra-part imports.
  for (let a = 0; a < areaNames.length; a++) {
    const cur = areaNames[a];
    const next = areaNames[(a + 1) % areaNames.length];
    const prev = areaNames[(a + 2) % areaNames.length];
    for (let f = 0; f < 10; f++) {
      imports.push([`pkg/${cur}/mod_${String(f).padStart(2, "0")}.ts`, `pkg/${next}/mod_${String(f % 5).padStart(2, "0")}.ts`]);
      if (f % 2 === 0) {
        imports.push([`pkg/${cur}/mod_${String(f).padStart(2, "0")}.ts`, `pkg/${prev}/mod_00.ts`]);
        imports.push([`pkg/${cur}/mod_${String(f + 1).padStart(2, "0")}.ts`, `pkg/${cur}/mod_${String(f).padStart(2, "0")}.ts`]);
      }
    }
  }

  return { hash: "deadbeef1234", repo: { name: "mono" }, facts, files, imports };
}

/** Fill a plateScaffold for recipe with valid plain copy so it validates cleanly. */
function filledPlateSpec(plate = "topo", { ground = "obsidian", layout = "editorial", format = "poster", seed } = {}) {
  const parts = partsFromFacts(recipe);
  const spec = plateScaffold(recipe, {
    plate,
    commit: "04186f4",
    date: "2026-11-07",
    accent: RECIPE_ACCENT,
    parts,
    ground,
    layout,
    format,
    ...(seed !== undefined ? { seed } : {}),
  });
  spec.product.name = "Pantry";
  spec.headline = "A week of dinners, planned in one go from the recipes you already cook.";
  spec.figure.regions[0].names = { ...RECIPE_NAMES };
  const colorName = COVER_GROUNDS[ground].colorName;
  spec.figure.texts[0].text = PLATES[plate].legend("Pantry", "screens", colorName);
  return spec;
}

test("fileSlices: deterministic, conserves exact LOC, stays in [40, 72], represents every part, computes degrees accurately, and handles empty scans", () => {
  const tiny = syntheticTinyFacts();
  const mono = syntheticMonorepoFacts();

  // Determinism across repeated calls.
  const first = fileSlices(recipe, { accent: RECIPE_ACCENT, names: RECIPE_NAMES });
  const second = fileSlices(recipe, { accent: RECIPE_ACCENT, names: RECIPE_NAMES });
  assert.deepEqual(first, second, "fileSlices is deterministic across repeated calls");

  // Slice count in [40, 72], exact LOC conservation, and every part represented across 4 repo sizes.
  for (const [label, facts, opts] of [
    ["recipe fixture", recipe, { accent: RECIPE_ACCENT, names: RECIPE_NAMES }],
    ["got-facts (3-part repo)", got, { accent: "area:source" }],
    ["synthetic tiny 4-file repo", tiny, { accent: "area:core" }],
    ["synthetic 200-file monorepo", mono, { accent: "area:pkg/orders" }],
  ]) {
    const slices = fileSlices(facts, opts);
    const parts = regionParts(opts, facts);
    const expectedLoc = nonGenLoc(facts);
    const sliceLoc = Math.round(slices.reduce((s, x) => s + x.loc, 0));

    assert.ok(slices.length >= 40 && slices.length <= 72, `${label}: expected slice count in [40, 72], got ${slices.length}`);
    assert.equal(sliceLoc, expectedLoc, `${label}: conserved LOC ${sliceLoc} === ${expectedLoc}`);

    const seenParts = new Set(slices.map((s) => s.partId));
    assert.equal(seenParts.size, parts.length, `${label}: every part represented (${seenParts.size}/${parts.length})`);
    for (const p of parts) {
      assert.ok(seenParts.has(p.id), `${label}: part ${p.id} is present in slices`);
    }
    assert.ok(slices.some((s) => s.hot), `${label}: accent part slices are flagged hot`);
  }

  // Exact import degree (inDegree, outDegree, degree, coupling) accuracy on synthetic tiny repo.
  // Edges (excluding self-import):
  //   ui/panel -> core/engine (cross)
  //   ui/button -> core/state (cross)
  //   ui/panel -> ui/button (intra)
  //   core/engine -> core/state (intra)
  // Total: out=4, in=4, degree=8, cross-part edges=2 => total coupling=4.
  // Part core: in=3 (engine:1, state:2), out=1 (engine:1), degree=4, coupling=2.
  // Part ui:   in=1 (button:1), out=3 (panel:2, button:1), degree=4, coupling=2.
  const tinySlices = fileSlices(tiny, { accent: "area:core" });
  const sum = (arr, fn) => arr.reduce((s, x) => s + fn(x), 0);
  assert.ok(Math.abs(sum(tinySlices, (s) => s.inDegree) - 4) < 1e-6, "total inDegree equals 4");
  assert.ok(Math.abs(sum(tinySlices, (s) => s.outDegree) - 4) < 1e-6, "total outDegree equals 4");
  assert.ok(Math.abs(sum(tinySlices, (s) => s.degree) - 8) < 1e-6, "total degree equals 8");
  assert.ok(Math.abs(sum(tinySlices, (s) => s.coupling) - 4) < 1e-6, "total cross-part coupling equals 4");

  const coreSlices = tinySlices.filter((s) => s.partId === "area:core");
  const uiSlices = tinySlices.filter((s) => s.partId === "area:ui");
  assert.ok(Math.abs(sum(coreSlices, (s) => s.inDegree) - 3) < 1e-6, "core inDegree = 3");
  assert.ok(Math.abs(sum(coreSlices, (s) => s.outDegree) - 1) < 1e-6, "core outDegree = 1");
  assert.ok(Math.abs(sum(coreSlices, (s) => s.coupling) - 2) < 1e-6, "core coupling = 2");
  assert.ok(Math.abs(sum(uiSlices, (s) => s.inDegree) - 1) < 1e-6, "ui inDegree = 1");
  assert.ok(Math.abs(sum(uiSlices, (s) => s.outDegree) - 3) < 1e-6, "ui outDegree = 3");
  assert.ok(Math.abs(sum(uiSlices, (s) => s.coupling) - 2) < 1e-6, "ui coupling = 2");
  for (const s of tinySlices) {
    assert.ok(Math.abs(s.degree - (s.inDegree + s.outDegree)) < 1e-6, `slice ${s.index}: degree === inDegree + outDegree`);
  }

  // Empty scan returns [].
  assert.deepEqual(fileSlices(emptyScan), [], "empty fixture scan returns []");
  assert.deepEqual(fileSlices({ facts: [], files: {}, imports: [] }), [], "empty object scan returns []");
});

test("buildTopoPlate: 18-24 elevation levels, Chaikin-smoothed major/minor/hot contours, summits for every part, all inside box", () => {
  const opts = { accent: RECIPE_ACCENT, names: RECIPE_NAMES };
  const parts = regionParts(opts, recipe);
  const slices = fileSlices(recipe, opts);
  const ties = partTies(parts, recipe);

  const a = buildTopoPlate({ slices, parts, ties, box: STD_BOX, seed: 7 });
  const b = buildTopoPlate({ slices, parts, ties, box: STD_BOX, seed: 7 });
  assert.deepEqual(a, b, "buildTopoPlate is deterministic");
  assert.equal(a.kind, "topo");
  assert.ok(a.levels >= 18 && a.levels <= 24, `levels ${a.levels} in [18, 24]`);
  assert.ok(a.contours.length > 0, "non-empty contours");
  assert.ok(a.contours.some((c) => c.major), "has major contours");
  assert.ok(a.contours.some((c) => !c.major), "has minor contours");
  assert.ok(a.accentCount > 0, "has hot contours");
  assert.equal(a.contours.filter((c) => c.hot).length, a.accentCount, "accentCount matches hot contour count");
  assert.equal(a.representedParts, parts.length, "representedParts equals parts.length");
  assert.equal(a.summits.length, parts.length, "one summit per part");

  const summitParts = new Set(a.summits.map((s) => s.partId));
  for (const p of parts) assert.ok(summitParts.has(p.id), `summit exists for ${p.id}`);

  for (const c of a.contours) {
    assert.ok(c.points.length >= 3, "Chaikin-smoothed polyline has >= 3 points");
    for (const pt of c.points) {
      assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.y), "contour point finite");
      assert.ok(pt.x >= STD_BOX.left && pt.x <= STD_BOX.right, `contour x=${pt.x} inside box`);
      assert.ok(pt.y >= STD_BOX.top && pt.y <= STD_BOX.bottom, `contour y=${pt.y} inside box`);
    }
  }
  for (const s of a.summits) {
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y), "summit finite");
    assert.ok(s.x >= STD_BOX.left && s.x <= STD_BOX.right, `summit x=${s.x} inside box`);
    assert.ok(s.y >= STD_BOX.top && s.y <= STD_BOX.bottom, `summit y=${s.y} inside box`);
  }
});

test("buildBlueprintPlate: non-overlapping proportional chambers with sub-cells, strictly octilinear traces, vias, accent flags, and synthetic bus fallback", () => {
  const opts = { accent: RECIPE_ACCENT, names: RECIPE_NAMES };
  const parts = regionParts(opts, recipe);
  const slices = fileSlices(recipe, opts);
  const ties = partTies(parts, recipe);
  assert.ok(ties.length > 0, "recipe fixture has real cross-part imports");

  const a = buildBlueprintPlate({ slices, parts, ties, box: STD_BOX, seed: 11 });
  const b = buildBlueprintPlate({ slices, parts, ties, box: STD_BOX, seed: 11 });
  assert.deepEqual(a, b, "buildBlueprintPlate is deterministic");
  assert.equal(a.kind, "blueprint");
  assert.equal(a.representedParts, parts.length, "chamber for every part");
  assert.equal(a.chambers.length, parts.length);

  // Zero chamber-to-chamber overlaps and valid internal file sub-cells inside every chamber.
  for (let i = 0; i < a.chambers.length; i++) {
    const ci = a.chambers[i];
    assert.ok(ci.w > 0 && ci.h > 0, `chamber ${ci.partId} has positive dimensions`);
    assert.ok(ci.cells.length >= 1, `chamber ${ci.partId} has internal file sub-cells`);
    for (const cell of ci.cells) {
      assert.ok(cell.x >= ci.x - 0.05 && cell.x + cell.w <= ci.x + ci.w + 0.05, `sub-cell x inside chamber ${ci.partId}`);
      assert.ok(cell.y >= ci.y - 0.05 && cell.y + cell.h <= ci.y + ci.h + 0.05, `sub-cell y inside chamber ${ci.partId}`);
    }
    for (let j = i + 1; j < a.chambers.length; j++) {
      const cj = a.chambers[j];
      const overlaps = ci.x < cj.x + cj.w - 0.01 && cj.x < ci.x + ci.w - 0.01 && ci.y < cj.y + cj.h - 0.01 && cj.y < ci.y + ci.h - 0.01;
      assert.ok(!overlaps, `chambers ${ci.partId} and ${cj.partId} must not overlap`);
    }
  }

  // Strictly octilinear (0/45/90 deg) segments, positive lengths, accent traces, and vias.
  const assertOctilinear = (traces, label) => {
    assert.ok(traces.length > 0, `${label}: non-empty traces`);
    for (const tr of traces) {
      assert.ok(tr.length > 0, `${label}: trace ${tr.index} has positive length`);
      assert.ok(tr.points.length >= 2, `${label}: trace ${tr.index} has >= 2 points`);
      for (let k = 1; k < tr.points.length; k++) {
        const dx = tr.points[k].x - tr.points[k - 1].x;
        const dy = tr.points[k].y - tr.points[k - 1].y;
        assert.ok(
          dx === 0 || dy === 0 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.05,
          `${label}: trace ${tr.index} seg ${k} is octilinear (dx=${dx.toFixed(3)}, dy=${dy.toFixed(3)})`,
        );
      }
    }
  };
  assertOctilinear(a.traces, "real-ties blueprint");
  assert.ok(a.traces.every((t) => t.syntheticBus === false), "real ties produce non-synthetic traces");
  assert.ok(a.traces.some((t) => t.hot), "accent traces flagged hot");
  assert.ok(a.accentCount > 0, "accentCount > 0");
  assert.ok(a.vias.length > 0, "circular via pads placed");
  assert.ok(a.vias.some((v) => v.kind === "pin"), "pin vias placed");
  for (const v of a.vias) {
    assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y) && v.r > 0, "via has finite coords and positive radius");
  }

  // Zero-ties synthetic bus fallback.
  const bus = buildBlueprintPlate({ slices, parts, ties: [], box: STD_BOX, seed: 11 });
  assert.equal(bus.representedParts, parts.length);
  assertOctilinear(bus.traces, "synthetic-bus blueprint");
  assert.ok(bus.traces.every((t) => t.syntheticBus === true), "empty ties fall back to syntheticBus: true");
  assert.ok(bus.vias.length > 0, "synthetic bus places pin and junction vias");
});

test("plateScaffold, spec validation, layouts, platePage HTML chrome, script compilation, and sketch outputs", () => {
  // 1. Scaffolds for both plate kinds validate cleanly once placeholders are replaced.
  for (const plate of PLATE_NAMES) {
    const raw = plateScaffold(recipe, { plate, commit: "04186f4", date: "2026-11-07", parts: partsFromFacts(recipe) });
    assert.equal(raw.frame, "plate");
    assert.equal(raw.figure.regions[0].kind, "plate");
    assert.equal(raw.figure.regions[0].plate, plate);
    assert.equal(raw.motion.kind, PLATES[plate].motion);
    assert.ok(validateSpec(raw).length > 0, `${plate} scaffold with placeholders reports errors before filling`);

    const filled = filledPlateSpec(plate);
    assert.deepEqual(validateSpec(filled), [], `${plate} filled scaffold has 0 validateSpec errors`);
    assert.deepEqual(
      runChecks("spec", { spec: filled, facts: recipe, presets: {} }).filter((f) => f.level === "fail"),
      [],
      `${plate} filled scaffold passes all spec-stage fail checks`,
    );
  }

  // 2. Invalid plate, ground, layout, motion, and stray theme/look/finish are each rejected with clear messages.
  const grounds = Object.keys(COVER_GROUNDS).map((g) => `"${g}"`).join(", ");
  const layouts = COVER_LAYOUTS.map((l) => `"${l}"`).join(", ");
  const bad = filledPlateSpec("topo");
  bad.figure.regions[0].plate = "radar";
  bad.ground = "#102030";
  bad.layout = "grid";
  bad.theme = "dark";
  bad.look = "xerox";
  bad.finish = "studio";
  bad.motion = { kind: "turn" };
  const errors = validateSpec(bad);
  for (const want of [
    'figure.regions[0].plate: "radar" is not a plate; use "topo", "blueprint"',
    `ground: "#102030" is not a ground; a free colour is not offered; use ${grounds}`,
    `layout: "grid" is not a layout; use ${layouts}`,
    `theme: a plate takes a ground instead; remove theme and set ground to ${grounds}`,
    "look: only the cover frame takes look; remove look",
    "finish: only the cover frame takes finish; remove finish",
    'motion.kind: "turn" is not a motion; use pulse or signal',
  ]) {
    assert.ok(errors.includes(want), `expected ${JSON.stringify(want)} in ${JSON.stringify(errors, null, 1)}`);
  }

  const badTimed = filledPlateSpec("topo");
  badTimed.motion = { kind: "pulse", frames: 24, fps: 12 };
  const timedErrs = validateSpec(badTimed);
  assert.ok(timedErrs.includes("motion.frames: a pulse loop sets its own length and rate; remove frames"));
  assert.ok(timedErrs.includes("motion.fps: a pulse loop sets its own length and rate; remove fps"));

  // 3. plate-page.js compiles cleanly under vm.Script.
  const scriptCode = fs.readFileSync(path.join(LIB, "plate-page.js"), "utf8");
  assert.doesNotThrow(() => new vm.Script(`"use strict"; {\n${scriptCode}\n}`), "plate page script compiles cleanly");

  // 4. All 4 layouts produce valid platePage HTML (zero rgba in CSS/DOM, exact record, headline & legend roles),
  //    clean plateSketchLines, and valid PNG header from plateSketchImage.
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const plateForLayout = { classic: "topo", editorial: "topo", blueprint: "blueprint", macro: "blueprint" };
  for (const layout of COVER_LAYOUTS) {
    const plate = plateForLayout[layout];
    const spec = filledPlateSpec(plate, { ground: layout === "macro" ? "carbon" : "obsidian", layout });
    assert.deepEqual(validateSpec(spec), [], `layout ${layout} spec validates`);

    const info = plateOf(spec, recipe);
    const html = platePage(spec, recipe, "");
    const domAndCss = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    assert.ok(!domAndCss.includes("rgba("), `layout ${layout}: zero rgba( in CSS/DOM`);
    assert.ok(html.includes('<canvas id="plate"'), `layout ${layout}: contains plate canvas`);
    assert.ok(domAndCss.includes('data-block="record"'), `layout ${layout}: contains record block`);
    assert.ok(domAndCss.includes(info.record[0]) && domAndCss.includes(info.record[1]) && domAndCss.includes(info.record[2]), `layout ${layout}: contains exact record lines`);
    assert.ok(domAndCss.includes('data-role="headline"'), `layout ${layout}: contains headline role`);
    assert.ok(domAndCss.includes('data-role="legend"'), `layout ${layout}: contains legend role`);

    const lines = plateSketchLines(spec, recipe);
    assert.ok(lines.length >= info.parts.length + 3, `layout ${layout}: sketch lines include summary + parts`);
    assert.match(lines[0], new RegExp(`^plate: ${plate} on .* ground, ${layout} layout;`));
    assert.match(lines[1], /^geometry: /);

    const pngBuf = Buffer.from(plateSketchImage(spec, recipe));
    assert.deepEqual(pngBuf.subarray(0, 8), PNG_SIG, `layout ${layout}: valid PNG header`);
    const decoded = decodePng(pngBuf);
    assert.equal(decoded.width, Math.ceil(info.template.width / 3), `layout ${layout}: 1/3 width`);
    assert.equal(decoded.height, Math.ceil(info.template.height / 3), `layout ${layout}: 1/3 height`);
  }
});

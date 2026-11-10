// The rings style of the shape field: area by lines, no glyph on another, legible names, the core, thin and
// steep shapes, echo validation, the sketch, and the same layout twice.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSpec } from "../lib/spec.mjs";
import { shapeMask } from "../lib/mask.mjs";
import { ringsStyle, allotRings, RINGS } from "../lib/fields/shape-rings.mjs";
import { shapeReport, shapeFindings } from "../lib/shape-report.mjs";
import { sketch, sketchImage } from "../lib/sketch.mjs";
import { scanRepo } from "../lib/scan/index.mjs";
import { SHEET } from "../lib/geometry.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const recipe = scanRepo(path.join(HERE, "fixtures", "recipe"));
const hypher = JSON.parse(fs.readFileSync(path.join(HERE, "..", "..", "..", "..", "..", "explorations", "2026-11-07-abstract-fields", "hypher-facts.json"), "utf8"));
const jar = () => ({ ...JSON.parse(fs.readFileSync(path.join(HERE, "..", "presets", "shape-rings.json"), "utf8")), facts: recipe.hash });
// Hypher's twelve parts in a paper plane: a dart with a fold slit, the shape the proof poster uses.
const PLANE = { rotate: -5, fit: { h: 0.83, cx: 0.5, cy: 0.58 }, ops: [{ add: "polygon", points: [[0, 50], [82, 0], [66, 100], [44, 62]], round: 5 }, { cut: "capsule", from: [74, 15], to: [60, 42], r: 1.4 }] };
const plane = (theme = "dark") => {
  const s = jar();
  s.facts = hypher.hash;
  s.theme = theme;
  s.product = { ...s.product, name: "Hypher", repo: "hypher" };
  Object.assign(s.figure.regions[0], {
    accent: "area:hypher-web/shared",
    shape: PLANE,
    names: {
      "area:.": "project setup", "area:Hypher": "mac app", "area:extensions": "browser add-on", "area:hypher-web/convex": "server",
      "area:hypher-web/convex/lib": "server helpers", "area:hypher-web/shared": "handoff note", "area:hypher-web/src/app": "web pages",
      "area:hypher-web/src/app/api": "web requests", "area:hypher-web/src/components": "screen pieces", "area:hypher-web/src/lib": "web helpers",
      "area:packages/hypher-cli/src": "command line", "area:script": "scripts",
    },
  });
  return s;
};
const CASES = [["the jar", jar, recipe], ["Hypher's plane", plane, hypher]];
const reportOf = (spec, facts) => shapeReport(spec, spec.figure.regions[0], facts);

test("the rings preset and a plane in rings are valid specs; echo is checked", () => {
  assert.deepEqual(validateSpec(jar()), []);
  assert.deepEqual(validateSpec(plane()), []);
  const f = "figure.regions[0]";
  const bad = (over) => validateSpec(Object.assign(jar(), { figure: { ...jar().figure, regions: [{ ...jar().figure.regions[0], ...over }] } }));
  assert.ok(bad({ echo: 13 }).includes(`${f}.echo: a whole number of faded outlines from 0 to 12`));
  assert.ok(bad({ echo: 2.5 }).includes(`${f}.echo: a whole number of faded outlines from 0 to 12`));
  assert.ok(bad({ style: "bands", echo: 3 }).includes(`${f}.echo: only the rings style draws echoes; set style to rings or remove echo`));
});

for (const [name, specOf, facts] of CASES) {
  test(`${name}: the accent is a closed band of whole rings one ring in, and every part's area, measured pixel by pixel, tracks its share of lines`, () => {
    const report = reportOf(specOf(), facts);
    const own = report.owners();
    const counts = report.parts.map(() => 0);
    let inside = 0;
    for (const k of own) {
      if (k < 0) continue;
      inside++;
      counts[k]++;
    }
    const loc = report.parts.reduce((s, p) => s + p.loc, 0);
    assert.ok(inside >= 0.99 * report.mask.area, `every pixel of the shape belongs to a part (${inside} of ${report.mask.area})`);
    const hot = report.bands.find((b) => b.part.hot);
    const rim = report.bands.find((b) => b.runs.some((r) => r.from === 0));
    assert.ok(!rim.part.hot && rim.runs.find((r) => r.from === 0).to === 1, "another part's outermost ring is the rim");
    assert.equal(hot.runs.length, 1, "the accent is one run");
    assert.ok(hot.runs[0].from === 1 && Number.isInteger(hot.runs[0].to) && hot.runs[0].to >= 1 + RINGS.accent, "of whole rings, from one ring in");
    report.parts.forEach((p, k) => {
      const [area, lines] = [counts[k] / inside, p.loc / loc];
      const say = `${p.name}: ${(area * 100).toFixed(1)}% of the area for ${(lines * 100).toFixed(1)}% of the lines`;
      // Whole rings miss the accent's share by up to half a ring, unless the two-ring floor holds it up; the parts
      // inside the rim and the accent share the difference.
      if (p.hot) assert.ok(Math.abs(area - lines) <= area / hot.rings / 2 + 0.002 || (hot.rings === RINGS.accent && area > lines), say);
      else assert.ok(Math.abs(area - lines) <= 0.02, say);
    });
  });

  test(`${name}: no two glyphs overlap, every name is whole, and every part reads upright at least once`, () => {
    const report = reportOf(specOf(), facts);
    const centres = report.rows.flatMap((r, i) =>
      r.glyphs.map(([x, y, deg]) => {
        const t = (deg * Math.PI) / 180;
        // The origin sits on the baseline at the glyph's left; its centre is half an advance on and 0.34 em up.
        return [x + Math.cos(t) * 0.3 * r.size + Math.sin(t) * 0.34 * r.size, y + Math.sin(t) * 0.3 * r.size - Math.cos(t) * 0.34 * r.size, i];
      }),
    );
    const cell = new Map();
    for (const c of centres) {
      const k = `${Math.floor(c[0] / 8)},${Math.floor(c[1] / 8)}`;
      (cell.get(k) ?? cell.set(k, []).get(k)).push(c);
    }
    let close = 0;
    for (const [x, y, i] of centres) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const [px, py, j] of cell.get(`${Math.floor(x / 8) + dx},${Math.floor(y / 8) + dy}`) ?? []) if (j !== i && Math.hypot(px - x, py - y) < 0.6 * RINGS.size) close++;
        }
      }
    }
    assert.equal(close, 0, "glyphs of different names closer than 0.6 em");
    for (const r of report.rows) assert.equal(r.glyphs.length, r.text.length, `one glyph per character of "${r.text}"`);
    for (const p of report.parts) {
      const mine = report.rows.filter((r) => r.part === p.id);
      assert.ok(mine.some((r) => r.text.includes(p.name.toLowerCase())), `${p.name} shows its whole name`);
      assert.ok(mine.some((r) => Math.abs(r.lean) <= RINGS.upright), `${p.name} reads upright at least once`);
    }
    const upright = report.rows.filter((r) => Math.abs(r.lean) <= RINGS.upright).length / report.rows.length;
    // A plane's arms run steep, so its share is lower than the jar's; neither falls under a fifth.
    assert.ok(upright >= 0.2, `${(upright * 100).toFixed(0)}% of the names lean under ${RINGS.upright} degrees`);
    const found = shapeFindings(report);
    assert.deepEqual([...found["shape-rings"], ...found["shape-upright"], ...found["shape-name"]], []);
  });
}

test("the centre is a core in level lines on a tone of its own, with the accent band in the accent", () => {
  for (const [, specOf, facts] of CASES) {
    for (const theme of ["light", "dark"]) {
      const report = reportOf({ ...specOf(), theme }, facts);
      assert.ok(report.rings.cores.length >= 1 && report.rings.lines.length >= 10, "a core of level lines");
      const level = report.rows.filter((r) => r.glyphs.every((g) => g[2] === 0));
      assert.ok(level.length >= 10, "names set level in the core");
      const tones = report.ground.map((g) => g.tone);
      assert.ok(tones.includes(theme === "light" ? "cool" : "cold"), "the core has its own fill");
      assert.ok(report.ground.some((g) => g.hot && g.tone === "hot" && g.rows.length), "the accent is filled");
      assert.equal(report.ground.some((g) => !g.part && g.tone === "ink" && g.rows.length), theme === "light", "the light shape is solid ink, the dark one is not");
      assert.ok(report.rows.filter((r) => r.hot).every((r) => r.tone === "on-hot" && r.weight === 700), "accent names are reversed out, bold");
    }
  }
});

test("allotRings: each part's share of area, part way round a ring when its share needs it", () => {
  const parts = [{ loc: 10 }, { loc: 30 }, { loc: 5 }, { loc: 55 }];
  const out = allotRings(parts, [100, 100, 100, 100, 100], Array(10).fill(50));
  assert.deepEqual(out.map((p) => Math.round(p.area)), [100, 300, 50, 550]);
  assert.deepEqual(out.map((p) => [p.from, p.to]), [[0, 1], [1, 4], [4, 4.5], [4.5, 5]]);
  assert.deepEqual(out.map((p) => p.core), [null, null, null, [0, 10]]);
  const floor = allotRings([{ loc: 1 }, { loc: 99, hot: true }], [100, 100, 100, 100], [], (k) => (k === 0 ? 0.5 : 0));
  assert.deepEqual(floor.map((p) => [p.from, p.to]), [[0, 0.5], [0.5, 4]], "a part spans at least its least");
});

test("a thin shape warns shape-rings before render, with the rings it has, the rings it needs and what to change", () => {
  const s = jar();
  s.figure.regions[0].shape = { ops: [{ add: "rect", at: [0, 0], size: [100, 12], round: 4 }], fit: { w: 0.9 } };
  const report = reportOf(s, recipe);
  const [message] = shapeFindings(report)["shape-rings"];
  assert.match(message, /^the shape is \d+px across at its thickest, room for \d rings of 7px; its 12 parts need about 18, so draw it fatter \(about 252px across at its thickest\), raise fit\.h, or use style bands$/);
  assert.match(sketch(s, recipe), /^! the shape is \d+px across at its thickest, room for \d rings of 7px; its 12 parts need about 18/m);
  assert.match(sketch(s, recipe), /^rings: \d rings of 7px fit \(the shape is \d+px across at its thickest; 12 parts want about 18\)/m);
});

test("a shape whose rings never run level warns shape-upright for the parts on it", () => {
  const s = jar();
  s.figure.regions[0].shape = { ops: [{ add: "rect", at: [0, 0], size: [40, 100], round: 2 }], rotate: 45, fit: { h: 0.7 } };
  const found = shapeFindings(reportOf(s, recipe))["shape-upright"];
  assert.ok(found.length >= 1, JSON.stringify(found));
  assert.match(found[0], /^part "[a-z ]+" never reads upright: none of its \d+ names leans under 30 degrees; turn the shape \(shape\.rotate\) so more of its outline runs level, or draw it rounder$/);
});

test("the sketch prints each part's rings and shares, and the sketch PNG shows the rings without a browser", () => {
  const out = sketch(jar(), recipe);
  assert.match(out, /^rings: \d+ rings of 7px fit \(the shape is \d+px across at its thickest; 12 parts want about 18\), then \d cores? of \d+ level lines$/m);
  assert.match(out, /^ {2}\* the plan +\d+ rings?(, \d+ core lines)?, [\d.]+% of the area for [\d.]+% of the lines$/m);
  assert.match(out, /@/);
  assert.match(out, /^the accent's share fills under 2 rings, too thin to show at thumbnail size, so it takes 2 \(14px\) and more area than its share$/m, "the jar's plan is held up by the two-ring floor, and the sketch says so");
  assert.doesNotMatch(sketch(plane(), hypher), /^the accent's share fills under/m, "Hypher's handoff note fills its rings on its own");
  const png = sketchImage(jar(), recipe);
  assert.equal(png.readUInt32BE(16), Math.ceil(SHEET.width / 3));
});

test("the same spec lays out the same rings", () => {
  const parts = reportOf(jar(), recipe).parts;
  const layout = (theme) => JSON.stringify(ringsStyle(shapeMask(jar().figure.regions[0].shape), parts, { theme, region: { echo: 2 } }));
  const first = layout("dark");
  layout("light");
  assert.equal(layout("dark"), first);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sketch } from "../lib/sketch.mjs";
import { scaffoldSpec } from "../lib/spec.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const preset = (id) => JSON.parse(fs.readFileSync(path.join(HERE, "..", "presets", `${id}.json`), "utf8"));

test("the hourglass sketch: 42 columns, both regions, hot rows, texts, the floor and passing numbers", () => {
  const out = sketch(preset("hourglass"));
  const grid = out.split("\n\nregions:")[0].split("\n");
  assert.ok(grid.every((l) => l.length <= 42));
  assert.equal(grid.at(-1), "=".repeat(42), "the footer line");
  assert.equal(grid.length, Math.floor(884 / 20) + 1);
  assert.match(out, /A{20}/);
  assert.match(out, /B{20}/);
  assert.match(out, /·{8}/, "the leftovers rows are hot");
  assert.match(out, /\|masthead/);
  assert.match(out, /^regions: A inputs \(21 rows\), B outputs \(19 rows\)/m);
  assert.match(out, /^floor: 884$/m);
  assert.match(out, /^coverage \d+% \(needs 15%, ok\), height \d+% \(needs 55%, ok\), width \d+% \(needs 60%, ok\)$/m);
  assert.match(out, /^region inputs: spread\/mean 0\.\d\d \(needs 0\.25\), \d{3}px across on average \(needs 160\)$/m);
  assert.match(out, /^region outputs: spread\/mean /m);
  assert.doesNotMatch(out, /^! /m, "the hourglass has no warnings");
});

test("a figure under the width floor prefixes the coverage line with !", () => {
  const spec = preset("hourglass");
  const thin = spec.figure.regions.map((r) => (r.profile ? { ...r, profile: r.profile.map(([y, cx, hw]) => [y, cx, hw / 3]) } : r));
  const out = sketch({ ...spec, figure: { ...spec.figure, regions: thin } });
  assert.match(out, /^! coverage \d+% .*too low/m);
});

test("dots draw as #, and a figure with no fill rows says so", () => {
  const out = sketch(preset("warm-start"));
  assert.match(out, /#{29}/);
  assert.match(out, /^regions: no fill rows$/m);
  assert.match(out, /^floor: 920$/m);
});

test("the compose starter is a box, and the sketch says so before render", () => {
  const spec = scaffoldSpec({ hash: "d73b88fe2d4e", repo: { name: "recipe" } }, { theme: "light", date: "2026-11-07", floor: 884 });
  const id = spec.figure.regions[0].id;
  assert.match(sketch(spec), new RegExp(`^! region ${id} is a box; a silhouette changes width along its whole height \\(spread/mean 0\\.\\d\\d, needs 0\\.25\\)$`, "m"));
});

test("a box with a slanted top is a box, and a 90px column reads as a column", () => {
  const spec = preset("hourglass");
  spec.figure.regions[1] = { kind: "fill", id: "slab", polygon: [[100, 600], [500, 560], [500, 860], [100, 860]], words: ["lists", "dinners"], tone: "ink" };
  spec.figure.regions.push({ kind: "fill", id: "post", polygon: [[640, 560], [730, 560], [730, 860], [640, 860]], words: ["a", "b"], tone: "ink" });
  const out = sketch(spec);
  assert.match(out, /^! region slab is a box; a silhouette changes width along its whole height/m);
  assert.match(out, /^! region post reads as a column; widen it or make it part of the main silhouette \(\d+px across on average, under 160px\)$/m);
  assert.doesNotMatch(out, /^! region inputs/m);
});

test("a region too short or below the floor is flagged before render", () => {
  const spec = preset("hourglass");
  spec.figure.regions[1].profile.at(-1)[0] = 950;
  spec.figure.regions.push({ kind: "fill", id: "sliver", polygon: [[600, 760], [780, 760], [780, 790], [600, 790]], words: ["a", "b"], tone: "ink" });
  const out = sketch(spec);
  assert.match(out, /^! region outputs reaches \d+px below the floor$/m);
  assert.match(out, /^! region sliver has [0-3] rows; it needs at least 4$/m);
});

test("a field sketches from the facts: its parts, its rows, and the parts a text block hides", async () => {
  const { scanRepo } = await import("../lib/scan/index.mjs");
  const facts = scanRepo(path.join(HERE, "fixtures", "recipe"));
  const spec = preset("hourglass");
  spec.figure.regions = [{ kind: "field", id: "wave", field: "wave", accent: "area:lib/plan" }];
  const out = sketch(spec, facts);
  assert.match(out, /^regions: A wave \(wave, 12 parts, \d\d rows\); · marks hot rows$/m);
  assert.match(out, /·{5}/, "the accent part's rows are hot");
  assert.doesNotMatch(out, /^! /m);
  const lines = (n, chars) => Array(n).fill("x".repeat(chars)).join(" ");
  spec.figure.texts.push({ role: "aside", id: "cover", text: lines(8, 74), x: 300, y: 0, w: 540 }, { role: "aside", id: "cover2", text: lines(8, 41), x: 0, y: 0, w: 300 });
  assert.match(sketch(spec, facts), /^! region wave: part "Recipe" \(area:\.\) is never drawn$/m);
});

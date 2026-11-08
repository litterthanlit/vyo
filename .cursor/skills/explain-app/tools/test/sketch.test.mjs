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

test("the compose scaffold is a field that sketches from the facts with no warnings", async () => {
  const { scanRepo } = await import("../lib/scan/index.mjs");
  const facts = scanRepo(path.join(HERE, "fixtures", "recipe"));
  const spec = scaffoldSpec(facts, { frame: "swiss", theme: "light", date: "2026-11-07", floor: 884, accent: "area:lib/plan" });
  const out = sketch(spec, facts);
  assert.match(out, /^regions: A wave \(wave, 12 parts, \d+ rows\); · marks hot rows$/m);
  assert.doesNotMatch(out, /^! /m);
});

test("a loose sketch: no footer line, the record among the texts, and the four corners the field leaves", async () => {
  const { scanRepo } = await import("../lib/scan/index.mjs");
  const facts = scanRepo(path.join(HERE, "fixtures", "recipe"));
  const spec = { ...preset("hourglass"), frame: "loose", notes: undefined, notBuilt: undefined, product: { name: "Pantry", repo: "recipe", commit: "04186f4", date: "2026-11-07" } };
  spec.figure = { regions: [{ kind: "field", id: "wave", field: "wave", fits: "x", accent: "area:lib/plan" }], texts: [{ role: "label", id: "label", x: 600, y: 40, w: 200 }, { role: "headline", id: "headline", x: 420, y: 70, w: 380 }, { role: "legend", id: "legend", x: 40, y: 900, w: 240, text: "Rows of code." }] };
  const out = sketch(spec, facts);
  assert.doesNotMatch(out, /^=+$/m, "no footer line");
  assert.match(out, /^floor: the sheet's bottom edge \(loose frame\)$/m);
  assert.match(out, /; record 40,1150 to \d+,1160$/m, "the record along the bottom edge");
  assert.match(out, /^corners: top-left at 0,0 is \d+ by \d+; top-right at \d+,0 is \d+ by \d+; bottom-left at 0,\d+ is \d+ by \d+; bottom-right at \d+,\d+ is \d+ by \d+$/m);
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

test("a wave sketches from the facts: its parts, its rows, all of them drawn behind a text block", async () => {
  const { scanRepo } = await import("../lib/scan/index.mjs");
  const facts = scanRepo(path.join(HERE, "fixtures", "recipe"));
  const spec = preset("hourglass");
  spec.figure.regions = [{ kind: "field", id: "wave", field: "wave", accent: "area:lib/plan" }];
  const out = sketch(spec, facts);
  assert.match(out, /^regions: A wave \(wave, 12 parts, \d+ rows\); · marks hot rows$/m);
  assert.match(out, /·{5}/, "the accent part's rows are hot");
  assert.doesNotMatch(out, /^! /m);
  const lines = (n, chars) => Array(n).fill("x".repeat(chars)).join(" ");
  // The band runs on behind the texts, so a block over the whole sheet hides no part.
  spec.figure.texts.push({ role: "aside", id: "cover", text: lines(46, 120), x: 0, y: 0, w: 840 });
  assert.doesNotMatch(sketch(spec, facts), /never drawn/);
});

test("two text blocks whose estimated rects intersect are warned about before render", () => {
  const spec = preset("hourglass");
  spec.figure.texts.push({ role: "aside", id: "one", text: "Plan once and eat well.", x: 600, y: 300, w: 160 }, { role: "aside", id: "two", text: "Shop for the week.", x: 620, y: 310, w: 160 });
  assert.match(sketch(spec), /^! text blocks "one" and "two" overlap; move one \(render fails blocks-apart\)$/m);
  assert.doesNotMatch(sketch(preset("hourglass")), /overlap/);
});

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
  assert.match(out, /^row widths: spread\/mean 0\.\d\d \(needs 0\.15, ok\)$/m);
});

test("dots draw as #, and a figure with no fill rows says so", () => {
  const out = sketch(preset("warm-start"));
  assert.match(out, /#{29}/);
  assert.match(out, /^row widths: no fill rows$/m);
  assert.match(out, /^floor: 920$/m);
});

test("the compose starter is a box, and the sketch says its widths are too even", () => {
  const spec = scaffoldSpec({ hash: "d73b88fe2d4e", repo: { name: "recipe" } }, { theme: "light", date: "2026-11-07", floor: 884 });
  assert.match(sketch(spec), /^row widths: spread\/mean 0\.\d\d \(needs 0\.15, too low\)$/m);
});

test("a region too short or below the floor is flagged before render", () => {
  const spec = preset("hourglass");
  spec.figure.regions[1].profile.at(-1)[0] = 950;
  spec.figure.regions.push({ kind: "fill", id: "sliver", polygon: [[600, 760], [780, 760], [780, 790], [600, 790]], words: ["a", "b"], tone: "ink" });
  const out = sketch(spec);
  assert.match(out, /^! region outputs reaches \d+px below the floor$/m);
  assert.match(out, /^! region sliver has [0-3] rows; it needs at least 4$/m);
});

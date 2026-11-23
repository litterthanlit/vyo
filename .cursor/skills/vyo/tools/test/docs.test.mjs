// The docs name the checks and the examples they ship. Both must match the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHECKS, runChecks } from "../lib/check.mjs";
import { coverLegend } from "../lib/cover.mjs";
import { validateSpec } from "../lib/spec.mjs";
import { scanRepo } from "../lib/scan/index.mjs";

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(TOOLS, ...p), "utf8");

/** First-column backticked ids of the table under the heading that matches `heading`. */
function tableIds(md, heading) {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => /^#{1,6} /.test(l) && heading.test(l));
  assert.ok(start >= 0, `no heading ${heading}`);
  const rows = [];
  for (const l of lines.slice(start + 1)) {
    if (/^#{1,6} /.test(l)) break;
    const id = /^\|\s*`([^`]+)`/.exec(l);
    if (id) rows.push(id[1]);
  }
  return rows;
}

const real = CHECKS.map((c) => c.id).sort();

test("CONTRACTS and README list exactly the real check ids", () => {
  assert.deepEqual(tableIds(read("CONTRACTS.md"), /Checks/).sort(), real);
  assert.deepEqual(tableIds(read("README.md"), /What `check` enforces/).sort(), real);
});

test("every spec example in examples.md validates against a fresh scan of the recipe fixture", () => {
  const facts = scanRepo(path.join(TOOLS, "test", "fixtures", "recipe"));
  const blocks = [...read("..", "examples.md").matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1])).filter((s) => s.figure && s.version);
  assert.ok(blocks.length >= 1, "at least one full spec example");
  for (const spec of blocks) assert.deepEqual(validateSpec({ ...spec, facts: facts.hash }), [], spec.figure.fits);
});

test("every drawn shape SKILL.md shows under \"Draw the shape\" validates, reads as its object, and passes every shape check on a cover", () => {
  const facts = scanRepo(path.join(TOOLS, "test", "fixtures", "recipe"));
  const skill = read("..", "SKILL.md");
  const section = skill.slice(skill.indexOf("## Draw the shape"), skill.indexOf("### Reference shapes"));
  const shapes = [...section.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
  assert.deepEqual(shapes.map((s) => s.object), ["gear", "cursor", "shield"]);
  for (const shape of shapes) {
    const spec = { ...JSON.parse(read("presets", "cover.json")), facts: facts.hash };
    const region = spec.figure.regions[0];
    delete region.solid;
    region.shape = shape;
    spec.figure.texts[0].text = coverLegend(region, "Pantry", "the screens");
    assert.deepEqual(validateSpec(spec), [], shape.object);
    const found = runChecks("spec", { spec, facts, presets: {} }).filter((f) => f.id.startsWith("shape-") || f.id === "legend");
    assert.deepEqual(found, [], `${shape.object}: ${JSON.stringify(found)}`);
    assert.ok(shape.ops.length >= 2 && shape.ops.length <= 6, `${shape.object} is drawn in a few ops`);
  }
});

// The docs name the checks and the examples they ship. Both must match the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHECKS } from "../lib/check.mjs";
import { SHAPES } from "../lib/shapes/index.mjs";
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

test("CONTRACTS §6 and README list exactly the real check ids", () => {
  assert.deepEqual(tableIds(read("CONTRACTS.md"), /Checks/).sort(), real);
  assert.deepEqual(tableIds(read("README.md"), /What `check` enforces/).sort(), real);
});

test("every JSON example in examples.md validates against a fresh scan of the recipe fixture", async () => {
  const facts = await scanRepo(path.join(TOOLS, "test", "fixtures", "recipe"));
  const blocks = [...read("..", "examples.md").matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1])).filter((s) => s.shape);
  assert.equal(blocks.length, Object.keys(SHAPES).length, "one example per shape");
  for (const spec of blocks) assert.deepEqual(validateSpec({ ...spec, facts: facts.hash }, SHAPES), [], spec.shape);
});

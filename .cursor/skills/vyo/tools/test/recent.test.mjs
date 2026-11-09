import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FIELDS } from "../lib/fields/index.mjs";
import { pickField, readRecent, recordShape, usedAgo } from "../lib/recent.mjs";

const names = Object.keys(FIELDS);
const nonwave = names.filter((n) => n !== "wave");

test("picking never returns wave", () => {
  for (const recent of [[], ["wave"], ["wave", "wave"], nonwave, nonwave.slice(0, 3)]) {
    assert.notEqual(pickField(names, recent), "wave");
  }
});

test("picking avoids fields already in the log, in registry order", () => {
  assert.equal(pickField(names, []), nonwave[0]);
  const recent = nonwave.slice(-8);
  const pick = pickField(names, recent);
  assert.ok(!recent.includes(pick), pick);
  assert.equal(pick, nonwave.find((n) => !recent.includes(n)));
});

test("when every non-wave field is in the log, picking takes the oldest", () => {
  assert.equal(pickField(names, nonwave), nonwave[0]);
  assert.equal(pickField(names, ["wave", ...nonwave.slice(1), nonwave[0]]), nonwave[1]);
  const rotated = [...nonwave.slice(2), nonwave[0], nonwave[1]];
  assert.equal(pickField(names, rotated), nonwave[2]);
});

test("recording appends, trims to 8, and reads back", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vyo-recent-"));
  const file = path.join(dir, "nested", "recent-shapes.json");
  try {
    assert.deepEqual(readRecent(file).shapes, []);
    for (let i = 0; i < 9; i++) recordShape(file, nonwave[i % nonwave.length]);
    const shapes = readRecent(file).shapes;
    assert.equal(shapes.length, 8);
    assert.equal(shapes.at(-1), nonwave[8 % nonwave.length]);
    assert.equal(shapes[0], nonwave[1 % nonwave.length]);
    assert.equal(usedAgo(shapes, shapes.at(-1)), 0);
    assert.equal(usedAgo(shapes, "nope"), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

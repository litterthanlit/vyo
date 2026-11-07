import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIELDS } from "../lib/fields/index.mjs";
import { waveRows } from "../lib/fields/wave.mjs";
import { terrainRows, TERRAIN } from "../lib/fields/terrain.mjs";
import { regionParts } from "../lib/parts.mjs";
import { scanRepo } from "../lib/scan/index.mjs";
import { fixedMeasure } from "../lib/sketch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const recipe = scanRepo(path.join(HERE, "fixtures", "recipe"));
const hypher = JSON.parse(fs.readFileSync(path.join(HERE, "..", "..", "..", "..", "..", "explorations", "2026-11-07-abstract-fields", "hypher-facts.json"), "utf8"));
const masthead = { left: 44, top: 36, right: 397, bottom: 154 };
const aside = { left: 56, top: 760, right: 294, bottom: 832 };
const frame = (over = {}) => ({ floor: 900, mirror: false, blocks: [masthead, aside], measure: fixedMeasure, ...over });
const touches = (it, b, pad) => it.x < b.right + pad && it.x + it.width > b.left - pad && it.y < b.bottom + pad && it.y + it.height > b.top - pad;

test("the registry names each field once, with its layout and the options only it takes", () => {
  assert.deepEqual(Object.keys(FIELDS), ["wave", "terrain"]);
  assert.deepEqual(FIELDS.wave.options, ["sentence", "every"]);
  assert.deepEqual(FIELDS.terrain.options, []);
});

for (const [name, facts] of [["recipe", recipe], ["hypher", hypher]]) {
  test(`wave on ${name}: 60 to 72 rows from the top edge to the floor, every part drawn, clear of the text blocks`, () => {
    const parts = regionParts({ accent: "area:hypher-web/shared" }, facts);
    const items = waveRows({ sentence: "plan once", every: 5 }, parts, frame());
    const ys = [...new Set(items.map((i) => i.y))];
    assert.ok(ys.length >= 58 && ys.length <= 72, `${ys.length} rows drawn`);
    assert.equal(Math.min(...ys), 0, "the band starts at the top edge");
    assert.ok(Math.max(...items.map((i) => i.y + i.height)) <= 900, "and stays above the floor");
    assert.ok(Math.max(...items.map((i) => i.y)) > 860, "down to the floor");
    for (const p of parts) assert.ok(items.some((i) => i.part === p.id), `${p.id} has a row`);
    for (const it of items) for (const b of [masthead, aside]) assert.ok(!touches(it, b, 12), `row at ${it.y} clears the block at ${b.top}`);
    for (const it of items) assert.ok(it.x >= 0 && it.x + it.width <= 839);
    const order = items.map((i) => parts.findIndex((p) => p.id === i.part));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), "parts run top to bottom in tree order");
  });
}

test("wave: every fifth row carries the sentence, the accent part is hot, the masthead side flips the band", () => {
  const parts = regionParts({ accent: "area:hypher-web/shared" }, hypher);
  const items = waveRows({ sentence: "switch agents without starting over" }, parts, frame({ blocks: [] }));
  const ys = [...new Set(items.map((i) => i.y))];
  const said = ys.filter((y) => items.find((i) => i.y === y).word === "switch agents without starting over");
  assert.deepEqual(said, ys.filter((_, i) => i % 5 === 4));
  assert.ok(items.filter((i) => i.part === "area:hypher-web/shared").every((i) => i.hot && i.tone === "hot"));
  assert.ok(items.filter((i) => i.part !== "area:hypher-web/shared").every((i) => !i.hot && ["mid", "soft"].includes(i.tone)));
  const flipped = waveRows({}, parts, frame({ blocks: [], mirror: true }));
  const first = (list) => list.find((i) => i.y === 0);
  assert.ok(first(items).x > 420 && first(flipped).x + first(flipped).width < 420, "the band enters on the side away from the masthead");
});

test("terrain: every part shows, small parts as foothills, valleys keep a foot, rows clear the text blocks", () => {
  const parts = regionParts({ accent: "area:hypher-web/shared" }, hypher);
  const items = terrainRows({}, parts, frame());
  for (const p of parts) assert.ok(items.some((i) => i.part === p.id), `${p.id} has letters`);
  for (const it of items) for (const b of [masthead, aside]) assert.ok(!touches(it, b, 12), `letters at ${it.x},${it.y} clear the block at ${b.top}`);
  for (const it of items) assert.ok(it.x >= 0 && it.x + it.width <= 840 && it.y + it.height <= 900);
  const open = terrainRows({}, parts, frame({ blocks: [] }));
  const bottom = Math.max(...open.map((i) => i.y));
  const footRow = open.filter((i) => i.y === bottom);
  const gaps = footRow.slice(1).map((it, i) => it.x - (footRow[i].x + footRow[i].width));
  assert.ok(footRow[0].x < 20 && footRow.at(-1).x + footRow.at(-1).width > 800, "the bottom row runs edge to edge");
  assert.ok(Math.max(...gaps) < 40, `with no valley cutting it (widest gap ${Math.round(Math.max(...gaps))}px)`);
  const tallest = Math.min(...items.filter((i) => i.part === "area:hypher-web/shared").map((i) => i.y));
  const small = Math.min(...items.filter((i) => i.part === "area:packages").map((i) => i.y));
  assert.ok(tallest < 330, `the biggest part reaches high (${tallest})`);
  assert.ok(small > 900 - (TERRAIN.below + 6 * 14), `the smallest part stays a foothill (${small})`);
  assert.ok(items.filter((i) => i.part === "area:hypher-web/shared").every((i) => i.hot));
});

test("terrain: letters spread on steep slopes and sit tight on flats", () => {
  const parts = regionParts({}, recipe);
  const items = terrainRows({}, parts, frame({ blocks: [] }));
  const spacings = items.map((i) => i.spacing);
  assert.ok(Math.min(...spacings) < 0, "tighter than the font's own advance on the flats");
  assert.ok(Math.max(...spacings) > 2, "wider on the slopes");
});

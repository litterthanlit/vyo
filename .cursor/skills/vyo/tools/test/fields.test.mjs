import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIELDS } from "../lib/fields/index.mjs";
import { waveRows, rowsPerPart, WAVE } from "../lib/fields/wave.mjs";
import { terrainRows, TERRAIN } from "../lib/fields/terrain.mjs";
import { riverRows, mergeTree, RIVER } from "../lib/fields/river.mjs";
import { radialRows, RADIAL } from "../lib/fields/radial.mjs";
import { sphereRows, SPHERE } from "../lib/fields/sphere.mjs";
import { scatterRows } from "../lib/fields/scatter.mjs";
import { shatterRows } from "../lib/fields/shatter.mjs";
import { glyphRows } from "../lib/fields/glyph.mjs";
import { bleedRows } from "../lib/fields/bleed.mjs";
import { slabsRows } from "../lib/fields/slabs.mjs";
import { spiralRows } from "../lib/fields/spiral.mjs";
import { contourRows } from "../lib/fields/contour.mjs";
import { traceRows } from "../lib/fields/trace.mjs";
import { encodePng } from "../lib/png.mjs";
import { traceChords } from "../lib/png-mask.mjs";
import { PAGE_MODULES } from "../lib/render.mjs";
import { regionParts, partTies } from "../lib/parts.mjs";
import { scanRepo } from "../lib/scan/index.mjs";
import { fixedMeasure } from "../lib/geometry.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const recipe = scanRepo(path.join(HERE, "fixtures", "recipe"));
const hypher = JSON.parse(fs.readFileSync(path.join(HERE, "..", "..", "..", "..", "..", "explorations", "2026-11-07-abstract-fields", "hypher-facts.json"), "utf8"));
const masthead = { left: 44, top: 36, right: 397, bottom: 154 };
const aside = { left: 56, top: 760, right: 294, bottom: 832 };
const frame = (over = {}) => ({ floor: 900, mirror: false, blocks: [masthead, aside], measure: fixedMeasure, ...over });
const touches = (it, b, pad) => it.x < b.right + pad && it.x + it.width > b.left - pad && it.y < b.bottom + pad && it.y + it.height > b.top - pad;

test("the registry names each field once, with its layout and the options only it takes", () => {
  assert.deepEqual(Object.keys(FIELDS), ["wave", "terrain", "river", "shape", "radial", "sphere", "scatter", "shatter", "glyph", "bleed", "slabs", "spiral", "contour", "trace"]);
  assert.deepEqual(FIELDS.river.options, ["seed"]);
  assert.deepEqual(FIELDS.wave.options, ["sentence", "every", "seed"]);
  assert.deepEqual(FIELDS.terrain.options, ["seed"]);
  assert.deepEqual(FIELDS.glyph.options, ["letter", "seed", "symbols"]);
  assert.deepEqual(FIELDS.trace.options, ["mask", "seed", "symbols"]);
  for (const f of ["scatter", "shatter", "bleed", "slabs", "spiral", "contour"]) assert.deepEqual(FIELDS[f].options, ["seed", "symbols"], f);
});

test("every field module is inlined into the page, and the PNG codec stays in Node", () => {
  const dir = path.join(HERE, "..", "lib", "fields");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mjs"));
  for (const f of files) assert.ok(PAGE_MODULES.includes(`fields/${f}`), f);
  assert.equal(PAGE_MODULES.indexOf("fields/pose.mjs") < PAGE_MODULES.indexOf("fields/wave.mjs"), true);
  assert.equal(PAGE_MODULES.indexOf("fields/wave.mjs") < PAGE_MODULES.indexOf("fields/chords.mjs"), true);
  assert.equal(PAGE_MODULES.indexOf("fields/chords.mjs") < PAGE_MODULES.indexOf("fields/index.mjs"), true);
  assert.ok(!PAGE_MODULES.some((f) => /png/.test(f)));
});

test("the inlined page script compiles: no two modules declare the same top-level name", async () => {
  const vm = await import("node:vm");
  const lib = path.join(HERE, "..", "lib");
  const code = [...PAGE_MODULES.map((f) => fs.readFileSync(path.join(lib, f), "utf8").replace(/^import .*\n/gm, "").replace(/^export /gm, "")), fs.readFileSync(path.join(lib, "fill.js"), "utf8")].join("\n");
  // The page runs it as a module, where a repeated top-level name is an error; a strict block has the same rule.
  assert.doesNotThrow(() => new vm.Script(`"use strict"; {\n${code}\n}`), "a clash such as two `spans` fails every poster with a page error");
});

for (const [name, facts] of [["recipe", recipe], ["hypher", hypher]]) {
  test(`wave on ${name}: 7.9px rows from the top edge to the floor, every part on a row, the band unbroken behind the text blocks`, () => {
    const parts = regionParts({ accent: "area:hypher-web/shared" }, facts);
    const items = waveRows({ sentence: "plan once", every: 5 }, parts, frame());
    const ys = [...new Set(items.map((i) => i.y))];
    assert.ok(ys.length >= 80 && ys.length <= Math.floor(900 / WAVE.pitch), `${ys.length} rows drawn`);
    for (const y of ys) assert.ok(Math.abs(y / WAVE.pitch - Math.round(y / WAVE.pitch)) < 0.02, `row at ${y} sits on the 7.9px grid`);
    assert.ok(items.every((i) => i.size === 6.9 && i.height === WAVE.pitch));
    assert.equal(Math.min(...ys), 0, "the band starts at the top edge");
    assert.ok(Math.max(...items.map((i) => i.y + i.height)) <= 900, "and stays above the floor");
    assert.ok(Math.max(...items.map((i) => i.y)) > 860, "down to the floor");
    for (const p of parts) assert.ok(items.some((i) => i.part === p.id), `${p.id} has a row`);
    assert.equal(ys.length, Math.floor(900 / WAVE.pitch), "every slot carries a row, those behind the masthead included");
    assert.ok(items.some((it) => touches(it, masthead, 0)), "the band passes behind the masthead");
    for (const it of items) assert.ok(it.x >= 0 && it.x + it.width <= 839);
    const order = items.map((i) => parts.findIndex((p) => p.id === i.part));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), "parts run top to bottom in tree order");
  });
}

test("wave: rows go to parts by lines, at least one each, all of them used", () => {
  const counts = rowsPerPart([{ loc: 900 }, { loc: 90 }, { loc: 10 }, { loc: 0 }], 20);
  assert.deepEqual(counts, [15, 3, 1, 1]);
  assert.equal(rowsPerPart([{ loc: 5 }, { loc: 5 }, { loc: 5 }], 7).reduce((s, n) => s + n, 0), 7);
  assert.equal(rowsPerPart([{ loc: 1470 }, { loc: 713 }, { loc: 7926 }, { loc: 2361 }, { loc: 8637 }, { loc: 370 }], 113).reduce((s, n) => s + n, 0), 113, "with several remainders to hand out");
});

test("wave: every fifth row carries the sentence, the accent part is hot, the band enters behind the masthead", () => {
  const parts = regionParts({ accent: "area:hypher-web/shared" }, hypher);
  const items = waveRows({ sentence: "switch agents without starting over" }, parts, frame({ blocks: [] }));
  const ys = [...new Set(items.map((i) => i.y))];
  const said = ys.filter((y) => items.find((i) => i.y === y).word === "switch agents without starting over");
  assert.deepEqual(said, ys.filter((_, i) => i % 5 === 4));
  assert.ok(items.filter((i) => i.part === "area:hypher-web/shared").every((i) => i.hot && i.tone === "ink"), "the accent part in ink on paper");
  const tones = new Set(items.filter((i) => !i.hot).map((i) => i.tone));
  assert.deepEqual([...tones].sort(), ["wave", "wave-soft"], "the other parts in the two violets on paper");
  const dark = waveRows({}, parts, frame({ blocks: [], theme: "dark" }));
  assert.ok(dark.filter((i) => i.hot).every((i) => i.tone === "hot"), "the accent part in the accent on navy");
  assert.ok(dark.filter((i) => !i.hot).every((i) => ["mid", "soft"].includes(i.tone)), "mid and soft on navy");
  const flipped = waveRows({}, parts, frame({ blocks: [], mirror: true }));
  const first = (list) => list.find((i) => i.y === 0);
  assert.ok(first(items).x + first(items).width < 420 && first(flipped).x > 420, "the band enters on the masthead's side, behind it");
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
  assert.ok(small > 900 - (TERRAIN.below + 12 * TERRAIN.pitch), `the smallest part stays a foothill (${small})`);
  assert.ok(items.filter((i) => i.part === "area:hypher-web/shared").every((i) => i.hot));
});

test("terrain: letters spread on steep slopes and sit tight on flats", () => {
  const parts = regionParts({}, recipe);
  const items = terrainRows({}, parts, frame({ blocks: [] }));
  const spacings = items.map((i) => i.spacing);
  assert.ok(Math.min(...spacings) < 0, "tighter than the font's own advance on the flats");
  assert.ok(Math.max(...spacings) > 2, "wider on the slopes");
});

test("terrain: a name starts whole at each run and never breaks where the next part's slope begins", () => {
  const parts = regionParts({ accent: "area:hypher-web/shared" }, hypher);
  const items = terrainRows({}, parts, frame({ blocks: [] }));
  const cw = fixedMeasure("M", TERRAIN.size);
  const name = (id) => parts.find((p) => p.id === id).name.toLowerCase();
  const runs = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = runs.at(-1);
    const step = cw + it.spacing;
    if (last && last.y === it.y && last.part === it.part && Math.abs(it.x - last.end) < 2 * cw) last.text += " ".repeat(Math.max(0, Math.round((it.x - last.end) / step))) + it.text;
    else runs.push({ ...it });
    runs.at(-1).end = it.x + it.text.length * step;
  }
  for (const r of runs) r.text = r.text.replace(/ {1,2}(?=\S)/g, " ").replace(/^ /, "");
  for (const r of runs) assert.ok(name(r.part).startsWith(r.text.slice(0, name(r.part).length).trimEnd()), `run at ${r.x},${r.y} starts "${r.text.slice(0, 12)}"`);
  const broken = runs.filter((r, i) => {
    const next = runs[i + 1];
    if (!next || next.y !== r.y || next.part === r.part || next.x - r.end > 3 * cw) return false;
    const words = name(r.part).split(" ");
    const tail = r.text.split(/\s+/).at(-1);
    return r.text.trim().length >= Math.min(...words.map((w) => w.length)) && !words.includes(tail);
  });
  assert.deepEqual(broken.map((r) => `${r.text.slice(-12)} | ${runs[runs.indexOf(r) + 1].text.slice(0, 8)}`), []);
});

test("river: digits only, every part a stream from the left edge, one channel off the right, the accent's stream and the last merge in the accent", () => {
  const region = { field: "river", accent: "area:hypher-web/shared" };
  const parts = regionParts(region, hypher);
  assert.equal(parts.length, 21, "the river's own part defaults draw more, smaller parts than the wave's 13");
  const ties = partTies(parts, hypher);
  assert.ok(ties.length > 10 && ties.every(([i, j, n]) => i < j && n > 0));
  const items = riverRows({ ...region, ties }, parts, frame({ floor: 1190, blocks: [] }));
  assert.ok(items.every((it) => /^[01 ]+$/.test(it.text) && it.text.trim() === it.text), "binary digits only, no part names");
  for (const p of parts) assert.ok(items.some((i) => i.part === p.id), `${p.id} has digits`);
  for (const it of items) assert.ok(it.x >= 0 && it.x + it.width <= 840 && it.y >= 0 && it.y + it.height <= 1190, `run at ${it.x},${it.y} on the sheet`);
  for (const it of items) assert.ok(Math.abs(it.y / RIVER.pitch - Math.round(it.y / RIVER.pitch)) < 1e-9, "rows on the 5px grid");
  assert.ok(items.some((it) => it.x < 4), "streams enter at the left edge");
  assert.ok(items.some((it) => it.x + it.width > 830), "the channel leaves the right edge");
  const hot = items.filter((i) => i.hot);
  assert.ok(hot.some((i) => i.part === "area:hypher-web/shared" && i.x < 300), "the accent part's stream is hot");
  assert.ok(hot.some((i) => i.x >= RIVER.last - RIVER.accent.back - 4), "and so is a short run at the last merge");
  assert.ok(items.filter((i) => !i.hot).every((i) => ["ink", "mid"].includes(i.tone)));
});

test("river: parts tied by imports merge before parts that are not", () => {
  const parts = [{ loc: 100 }, { loc: 100 }, { loc: 100 }];
  const root = mergeTree(parts, [[0, 2, 9]]);
  const first = root.kids.find((k) => !k.leaf);
  assert.deepEqual(first.members, [0, 2]);
});

test("radial: every part has a row, the triangle spreads from the apex", () => {
  const parts = regionParts({ accent: "area:lib/plan" }, recipe);
  const items = radialRows({}, parts, frame({ floor: 1190, blocks: [] }));
  for (const p of parts) assert.ok(items.some((i) => i.part === p.id), `${p.id} has a row`);
  assert.ok(items.every((i) => i.size === RADIAL.size && i.x >= 0 && i.x + i.width <= 840));
  const top = items.filter((i) => i.y < 80);
  const mid = items.filter((i) => i.y > 500 && i.y < 600);
  const topW = top.reduce((s, i) => s + i.width, 0) / (top.length || 1);
  const midW = mid.reduce((s, i) => s + i.width, 0) / (mid.length || 1);
  assert.ok(midW > topW, `the field spreads out (${midW} vs ${topW})`);
  assert.ok(items.some((i) => i.hot), "the accent part is hot");
});

test("sphere: a grid of ellipses, every part drawn, flattening down the page", () => {
  const parts = regionParts({ accent: "area:lib/plan" }, recipe);
  const items = sphereRows({}, parts, frame({ floor: 1190, blocks: [] }));
  for (const p of parts) assert.ok(items.some((i) => i.part === p.id), `${p.id} has a cell`);
  assert.ok(items.every((i) => i.size === SPHERE.size && i.x >= 0 && i.x + i.width <= 840 && i.y + i.height <= 1190));
  const top = items.filter((i) => i.y < 250);
  const bot = items.filter((i) => i.y > 900);
  const tall = (set) => {
    const ys = [...new Set(set.map((i) => i.y))];
    return ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
  };
  assert.ok(tall(top) > tall(bot), `lower cells flatten (${tall(top)} vs ${tall(bot)})`);
  assert.ok(items.some((i) => i.hot), "the accent part is hot");
});

const recipeParts = () => regionParts({ accent: "area:lib/plan" }, recipe);
const open = (over = {}) => frame({ floor: 1000, blocks: [], ...over });
const byY = (items) => {
  const map = new Map();
  for (const it of items) {
    const row = map.get(it.y) ?? [];
    row.push(it);
    map.set(it.y, row);
  }
  return [...map.values()];
};
const sig = (items) => {
  const n = items.length || 1;
  return [items.length, Math.round(items.reduce((s, i) => s + i.x, 0) / n), Math.round(items.reduce((s, i) => s + i.y, 0) / n)];
};
const onSheet = (items, floor) => {
  assert.ok(items.length > 0, "draws something");
  for (const it of items) assert.ok(it.x >= 0 && it.x + it.width <= 839 && it.y >= 0 && it.y + it.height <= floor + 0.01, `run at ${it.x},${it.y} on the sheet`);
};

test("seed 0 is the identity pose, and a non-zero seed is reproducible and different", () => {
  const parts = recipeParts();
  const plain = waveRows({}, parts, open());
  const zero = waveRows({ seed: 0 }, parts, open());
  assert.deepEqual(plain, zero, "omitted and 0 draw the same rows");
  assert.equal(plain[0].y, 0);
  assert.ok(plain[0].x < 200, "the unposed band still enters on the left");
  const once = waveRows({ seed: 1 }, parts, open());
  const twice = waveRows({ seed: 1 }, parts, open());
  assert.deepEqual(once, twice);
  assert.notDeepEqual(sig(once), sig(waveRows({ seed: 2 }, parts, open())));
  assert.notDeepEqual(sig(once), sig(plain));
  const clouds = scatterRows({}, parts, open());
  assert.deepEqual(clouds, scatterRows({ seed: 0 }, parts, open()));
  assert.deepEqual(scatterRows({ seed: 4 }, parts, open()), scatterRows({ seed: 4 }, parts, open()));
  assert.notDeepEqual(sig(scatterRows({ seed: 1 }, parts, open())), sig(scatterRows({ seed: 2 }, parts, open())));
});

test("a seed poses terrain, river and sphere without reassigning their area or the accent's tone", () => {
  const parts = recipeParts();
  const share = (items) => {
    const area = new Map();
    for (const it of items) area.set(it.part, (area.get(it.part) ?? 0) + it.width * it.height);
    const total = [...area.values()].reduce((a, b) => a + b, 0);
    return new Map([...area].map(([k, v]) => [k, v / total]));
  };
  for (const [name, layout] of [["terrain", terrainRows], ["river", riverRows], ["sphere", sphereRows]]) {
    const ties = partTies(parts, recipe);
    const plain = layout({ ties }, parts, open());
    for (const seed of [7, 905663158]) {
      const posed = layout({ ties, seed }, parts, open());
      const a = share(plain);
      const b = share(posed);
      for (const p of parts) assert.ok(Math.abs((a.get(p.id) ?? 0) - (b.get(p.id) ?? 0)) < 0.1, `${name} seed ${seed}: ${p.id} keeps its share of the drawing`);
      const hotTone = new Set(plain.filter((i) => i.hot).map((i) => i.tone));
      for (const it of posed.filter((i) => i.hot)) assert.ok(hotTone.has(it.tone), `${name} seed ${seed}: the accent keeps tone ${[...hotTone]}`);
    }
  }
});

test("scatter: clouds with gaps, every part drawn, the accent hot", () => {
  const parts = recipeParts();
  const items = scatterRows({}, parts, open());
  onSheet(items, 1000);
  for (const p of parts) assert.ok(items.some((i) => i.part === p.id), p.id);
  assert.ok(items.some((i) => i.hot));
  const gapped = byY(items).filter((row) => {
    const xs = [...row].sort((a, b) => a.x - b.x);
    return xs.slice(1).some((it, i) => it.x - (xs[i].x + xs[i].width) > 80);
  });
  assert.ok(gapped.length > 0, "some rows have a wide gap between clouds");
});

test("shatter: disjoint cells, not one band", () => {
  const parts = recipeParts();
  const items = shatterRows({}, parts, open());
  onSheet(items, 1000);
  for (const p of parts) assert.ok(items.some((i) => i.part === p.id), p.id);
  assert.ok(items.some((i) => i.hot));
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const near = (a, b) => a.x < b.x + b.width + 6 && b.x < a.x + a.width + 6 && a.y < b.y + b.height + 6 && b.y < a.y + a.height + 6;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (near(items[i], items[j])) parent[find(i)] = find(j);
  const clusters = new Set(items.map((_, i) => find(i)));
  assert.ok(clusters.size >= 8, `broken into ${clusters.size} clusters`);
});

test("no seed takes a field under the silhouette minimum (height, width, area) that its unposed form meets", () => {
  const parts = recipeParts();
  const span = (rows) => ({ w: Math.max(...rows.map((r) => r.x + r.width)) - Math.min(...rows.map((r) => r.x)), h: Math.max(...rows.map((r) => r.y + r.height)) - Math.min(...rows.map((r) => r.y)), c: rows.reduce((a, r) => a + r.width * r.height, 0) / (840 * 1000) });
  const fields = { scatter: scatterRows, shatter: shatterRows, glyph: glyphRows, bleed: bleedRows, slabs: slabsRows, spiral: spiralRows, contour: contourRows, terrain: terrainRows, river: riverRows, sphere: sphereRows, radial: radialRows, wave: waveRows };
  for (const [name, layout] of Object.entries(fields)) {
    const ties = partTies(parts, recipe);
    const base = span(layout({ ties, letter: "P" }, parts, open({ blocks: [] })));
    for (let seed = 1; seed <= 40; seed++) {
      const s = span(layout({ ties, letter: "P", seed }, parts, open({ blocks: [] })));
      assert.ok(s.h >= Math.min(550, base.h) - 1 && s.w >= Math.min(504, base.w) - 1, `${name} seed ${seed}: ${Math.round(s.w)} by ${Math.round(s.h)}, unposed ${Math.round(base.w)} by ${Math.round(base.h)}`);
      assert.ok(s.c >= Math.min(0.15, base.c) - 0.002, `${name} seed ${seed}: covers ${s.c.toFixed(3)}, unposed ${base.c.toFixed(3)}`);
    }
  }
});

test("glyph: no seed or masthead draws the letter backwards", () => {
  const parts = recipeParts();
  for (const mirror of [false, true]) {
    for (let seed = 1; seed <= 30; seed++) {
      const items = glyphRows({ letter: "F", seed }, parts, open({ mirror, blocks: [] }));
      const left = Math.min(...items.map((i) => i.x));
      const right = Math.max(...items.map((i) => i.x + i.width));
      const top = Math.min(...items.map((i) => i.y));
      const bottom = Math.max(...items.map((i) => i.y + i.height));
      const low = items.filter((i) => i.y > top + (bottom - top) * 0.75);
      const stem = low.reduce((s, i) => s + i.x + i.width / 2, 0) / low.length;
      assert.ok(stem < (left + right) / 2, `seed ${seed}${mirror ? " under a right masthead" : ""}: the F's stem is on its left`);
    }
  }
});

test("glyph: a letter with a counter, every part drawn", () => {
  const parts = recipeParts();
  for (const letter of ["A", "8", "0", "P"]) {
    const items = glyphRows({ letter }, parts, open());
    onSheet(items, 1000);
    for (const p of parts) assert.ok(items.some((i) => i.part === p.id), `${letter} ${p.id}`);
    const split = byY(items).filter((row) => row.length >= 2);
    assert.ok(split.length >= 4, `${letter} has a hole or crotch`);
    const minX = Math.min(...items.map((i) => i.x));
    const maxX = Math.max(...items.map((i) => i.x + i.width));
    const minY = Math.min(...items.map((i) => i.y));
    const maxY = Math.max(...items.map((i) => i.y + i.height));
    assert.ok(maxY - minY > (maxX - minX) * 0.7, `${letter} reads as a tall mark`);
  }
  assert.ok(glyphRows({ letter: "A" }, parts, open()).some((i) => i.hot));
});

test("bleed: the form leaves the sheet, and its mass sits near an edge", () => {
  const parts = recipeParts();
  const items = bleedRows({}, parts, open());
  onSheet(items, 1000);
  for (const p of parts) assert.ok(items.some((i) => i.part === p.id), p.id);
  assert.ok(items.some((i) => i.hot));
  assert.ok(items.some((i) => i.x < 2 || i.x + i.width > 838));
  const com = items.reduce((s, i) => s + i.x + i.width / 2, 0) / items.length;
  assert.ok(com > 520, `centre of mass near the right edge (${Math.round(com)})`);
});

test("slabs: bars with empty rows between them, edges not one shared curve", () => {
  const parts = recipeParts();
  const items = slabsRows({}, parts, open());
  onSheet(items, 1000);
  for (const p of parts) assert.ok(items.some((i) => i.part === p.id), p.id);
  assert.ok(items.some((i) => i.hot));
  const ys = [...new Set(items.map((i) => i.y))].sort((a, b) => a - b);
  const gap = Math.max(...ys.slice(1).map((y, i) => y - ys[i]));
  assert.ok(gap > 14, `empty rows between bars (largest step ${gap})`);
  const lefts = byY(items).map((row) => Math.min(...row.map((i) => i.x)));
  const unique = new Set(lefts.map((x) => Math.round(x / 8)));
  assert.ok(unique.size >= 4, "left edges stagger");
});

test("spiral: a coil, several arms on one row", () => {
  const parts = recipeParts();
  const items = spiralRows({}, parts, open());
  onSheet(items, 1000);
  for (const p of parts) assert.ok(items.some((i) => i.part === p.id), p.id);
  assert.ok(items.some((i) => i.hot));
  const arms = Math.max(...byY(items).map((row) => row.length));
  assert.ok(arms >= 3, `a row crosses ${arms} arms`);
});

test("contour: nested rings, several runs on one row", () => {
  const parts = recipeParts();
  const items = contourRows({}, parts, open());
  onSheet(items, 1000);
  for (const p of parts) assert.ok(items.some((i) => i.part === p.id), p.id);
  assert.ok(items.some((i) => i.hot));
  const rings = Math.max(...byY(items).map((row) => row.length));
  assert.ok(rings >= 4, `a row crosses ${rings} ring edges`);
});

test("trace: a disc stays round, and no seed swaps the shape for its background", () => {
  const n = 64;
  const disc = Buffer.from(Array.from({ length: n * n }, (_, i) => ((i % n) - 31.5) ** 2 + (Math.floor(i / n) - 31.5) ** 2 < 28 ** 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]).flat());
  const file = path.join(HERE, ".trace-disc.png");
  fs.writeFileSync(file, encodePng(n, n, disc));
  try {
    const box = (chords) => {
      const on = chords.filter((c) => c.runs.length);
      const xs = on.flatMap((c) => c.runs.flatMap(([l, r]) => [l, r]));
      return { w: Math.max(...xs) - Math.min(...xs), h: on.at(-1).y - on[0].y, area: on.reduce((s, c) => s + c.runs.reduce((a, [l, r]) => a + r - l, 0), 0) };
    };
    const plain = box(traceChords({ mask: file, seed: 0 }, 1190).chords);
    assert.ok(Math.abs(plain.w / plain.h - 1) < 0.08, `the disc is ${plain.w} by ${plain.h}`);
    for (let seed = 1; seed <= 24; seed++) {
      const posed = box(traceChords({ mask: file, seed }, 1190).chords);
      assert.ok(posed.area < plain.area * 2, `seed ${seed} fills ${posed.area}, the disc ${plain.area}`);
    }
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test("trace: chords follow the PNG, not the whole sheet", () => {
  const parts = recipeParts();
  const png = encodePng(32, 32, Buffer.from(Array.from({ length: 32 * 32 }, (_, i) => (i % 32 < 16 ? [0, 0, 0, 255] : [255, 255, 255, 255])).flat()));
  const file = path.join(HERE, ".trace-mask.png");
  fs.writeFileSync(file, png);
  try {
    const traced = traceChords({ mask: file, seed: 0 }, 1000, false);
    const items = traceRows({ chords: traced.chords, pitch: traced.pitch }, parts, open());
    onSheet(items, 1000);
    for (const p of parts) assert.ok(items.some((i) => i.part === p.id), p.id);
    assert.ok(items.some((i) => i.hot));
    const right = Math.max(...items.map((i) => i.x + i.width));
    const left = Math.min(...items.map((i) => i.x));
    const top = Math.min(...items.map((i) => i.y));
    const bottom = Math.max(...items.map((i) => i.y + i.height));
    assert.ok(Math.abs((right - left) / (bottom - top) - 0.5) < 0.06, `the dark half, 16 by 32, draws ${right - left} by ${bottom - top}`);
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test("symbols: a mask field drawn in shaded symbols with gaps, every part and the accent kept", () => {
  const parts = recipeParts();
  const items = scatterRows({ symbols: true }, parts, open());
  onSheet(items, 1000);
  for (const p of parts) assert.ok(items.some((i) => i.part === p.id), p.id);
  assert.ok(items.some((i) => i.hot));
  const all = items.map((i) => i.text).join("");
  assert.match(all, /^[-:=+# ]+$/, "only the ramp's symbols and gaps");
  for (const ch of ["#", "+", "="]) assert.ok(all.includes(ch), `uses ${ch}`);
  const gaps = (all.match(/ /g) || []).length / all.length;
  assert.ok(gaps > 0.15 && gaps < 0.7, `gaps are ${Math.round(gaps * 100)}% of the cells`);
  assert.deepEqual(items, scatterRows({ symbols: true }, parts, open()), "the same every time");
  const wings = traceChords({ mask: "wings", symbols: true }, 1190);
  const traced = traceRows({ chords: wings.chords, pitch: wings.pitch, symbols: true }, parts, open({ floor: 1190 }));
  assert.ok(traced.length > 100 && traced.every((i) => /^[-:=+# ]+$/.test(i.text)), "the bundled wings mask fills with symbols");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKS, runChecks } from "../lib/check.mjs";
import { SHAPES } from "../lib/shapes/index.mjs";

const shape = SHAPES.hourglass;
const spec = { theme: "light", hot: "leftovers", slots: { top: ["leftovers"], bottom: [] } };
const facts = { facts: [], empty: true, repo: { name: "recipe" } };
const sheet = { left: 0, top: 0, right: 840, bottom: 1190 };
const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
const page = (over = {}) => ({
  sheet, errors: [], drawn: true, inter: true,
  faces: [["Commit Mono", "400"], ["Commit Mono", "700"], ["Newsreader", "400"]].map(([family, weight]) => ({ family, weight, status: "loaded" })),
  texts: [{ text: "LEFTOVERS", color: "rgb(255, 79, 18)", hot: true, where: "a row" }],
  boxes: [{ color: "rgb(234, 232, 226)", hot: false, where: "sheet" }],
  rows: [{ word: "leftovers", text: "LEFTOVERS", scrollWidth: 80, clientWidth: 90, rect: rect(10, 10, 100, 26) }],
  blocks: [{ name: "note", text: "a", rect: rect(0, 900, 200, 950), lines: 2, owner: "notes" }, { name: "note", text: "b", rect: rect(220, 900, 400, 950) }, { name: "note", text: "c", rect: rect(420, 900, 600, 950) }],
  figureHot: ["leftovers"],
  ...over,
});
const failures = (p) => runChecks("page", { spec, facts, shape, page: p }).filter((f) => f.level === "fail");

test("a clean page passes every page check", () => assert.deepEqual(failures(page()), []));

test("each page check catches its defect", () => {
  const cases = [
    ["palette", { boxes: [{ color: "rgb(1, 2, 3)", hot: false, where: "a square" }] }, /a square uses rgb\(1, 2, 3\), not a light token/],
    ["hot-tagged", { texts: [{ text: "x", color: "rgb(255, 79, 18)", hot: false, where: "asideLeft" }] }, /asideLeft is in the accent colour without data-hot/],
    ["words-drawn", { figureHot: [] }, /the hot word "leftovers" is not drawn in the accent colour/],
    ["rows-fit", { rows: [{ word: "leftovers", scrollWidth: 120, clientWidth: 90, rect: rect(10, 10, 100, 26) }] }, /needs 120px but has 90px/],
    ["fonts", { faces: [] }, /Commit Mono 400 did not load/],
    ["blocks-inside", { blocks: [...page().blocks, { name: "headline", text: "h", rect: rect(0, 1180, 10, 1200), lines: 1 }] }, /headline runs off the sheet/],
    ["blocks-apart", { blocks: [...page().blocks, { name: "asideLeft", text: "x", rect: rect(10, 910, 50, 920), lines: 1 }] }, /note overlaps asideLeft/],
    ["notes", { blocks: page().blocks.slice(0, 2) }, /shows 2 notes; hourglass takes 3/],
    ["copy", { rows: [{ word: "webhooks", scrollWidth: 1, clientWidth: 1, rect: rect(10, 10, 100, 26) }] }, /a row: jargon: "webhooks"/],
    ["drawn", { drawn: false }, /never set window\.drawn/],
  ];
  for (const [id, over, re] of cases) {
    const found = failures(page(over));
    assert.ok(found.some((f) => f.id === id && re.test(f.message)), `${id}: expected ${re} in ${JSON.stringify(found)}`);
  }
});

test("every check has a unique id, a level, a stage and a description", () => {
  assert.equal(new Set(CHECKS.map((c) => c.id)).size, CHECKS.length);
  for (const c of CHECKS) assert.ok(["fail", "warn"].includes(c.level) && ["spec", "page"].includes(c.stage) && c.about, c.id);
});

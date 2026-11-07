import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SHAPES } from "../lib/shapes/index.mjs";
import { scaffoldSpec, validateSpec } from "../lib/spec.mjs";
import { scanRepo } from "../lib/scan/index.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const recipe = scanRepo(path.join(HERE, "fixtures", "recipe"));
const golden = (id) => ({ ...JSON.parse(fs.readFileSync(path.join(HERE, "golden", `${id}.json`), "utf8")), facts: recipe.hash });

const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima"];
const LETTERS = ["ECHO", "GOLF", "KILO", "LIMA"];
const fill = (s) => (s.kind === "words" ? (s.letters ? LETTERS : WORDS).slice(0, s.min) : s.kind === "phrase" ? "ONE THING" : "One plain sentence.");

for (const shape of Object.values(SHAPES)) {
  test(`${shape.id}: a scaffold is rejected until every placeholder is filled, then passes`, () => {
    for (const theme of Object.keys(shape.themes)) {
      const spec = scaffoldSpec(recipe, shape, { theme, date: "2026-10-28" });
      const errors = validateSpec(spec, SHAPES);
      for (const k of Object.keys(shape.slots)) assert.ok(errors.some((e) => e.startsWith(`slots.${k}: still the placeholder`)), `slots.${k} placeholder rejected`);
      assert.ok(errors.some((e) => e.startsWith("headline: still the placeholder")));
      assert.ok(errors.some((e) => e.startsWith("hot: still the placeholder")));

      spec.headline = "A plain sentence about the outcome.";
      spec.slots = Object.fromEntries(Object.entries(shape.slots).map(([k, s]) => [k, fill(s)]));
      spec.hot = shape.hotWords(spec.slots)[0].split(" ")[0];
      spec.notes = spec.notes.map((_, i) => ({ title: `Note ${i + 1}`, text: "Plain words." }));
      assert.deepEqual(validateSpec(spec, SHAPES), [], `${shape.id} ${theme} filled scaffold`);
    }
  });

  test(`${shape.id}: the golden spec for the recipe fixture is valid`, () => {
    assert.deepEqual(validateSpec(golden(shape.id), SHAPES), []);
  });
}

test("the golden specs reject the planted errors with their messages", () => {
  const cases = [
    ["a path", (s) => (s.notes[0].text = "Saved by lib/plan/save.ts each week."), /^notes\[0\]\.text: a file path/],
    ["jargon", (s) => (s.headline = "Your recipes behind one API."), /^headline: jargon: "api"/],
    ["hot not in the slots", (s) => (s.hot = "breakfast"), /^hot: "breakfast" must be a word from slots\.top or slots\.waist/],
    ["a fourth note", (s) => s.notes.push({ title: "More", text: "One more." }), /^notes: 4 notes; hourglass takes exactly 3/],
  ];
  for (const [name, mutate, re] of cases) {
    const spec = golden("hourglass");
    mutate(spec);
    const errors = validateSpec(spec, SHAPES);
    assert.ok(errors.some((e) => re.test(e)), `${name}: expected ${re} in ${JSON.stringify(errors)}`);
  }
});

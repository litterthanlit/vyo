import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSpec, textProblems, hasWord } from "../lib/spec.mjs";
import { BANNED, isJargon } from "../lib/jargon.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const funnel = {
  id: "funnel",
  themes: { light: { paper: "#ffffff", ink: "#000000", hot: "#ff0000" } },
  notes: 3,
  slots: {
    top: { kind: "words", min: 2, max: 4, prompt: "what goes in" },
    waist: { kind: "phrase", max: 10, prompt: "what it becomes" },
    aside: { kind: "line", max: 40, prompt: "one sentence" },
  },
  hotWords: (s) => [...s.top, s.waist],
  hotRule: "a word from slots.top or slots.waist",
};
const SHAPES = { funnel };

const good = () => ({
  version: 2,
  facts: "d73b88fe2d4e",
  product: { name: "Pantry", repo: "recipe", commit: "04186f4", date: "2026-10-28" },
  theme: "light",
  shape: "funnel",
  headline: "Dinner, planned for the week.",
  hot: "recipes",
  slots: { top: ["saved recipes", "photos", "notes"], waist: "ONE PLAN", aside: "**Every week:** a plan." },
  notes: [
    { title: "How it works", text: "Save recipes." },
    { title: "Proof", text: "Runs on Mondays." },
    { title: "Yours", text: "Your recipes stay yours." },
  ],
  notBuilt: [],
});
const errorsOf = (mutate) => {
  const s = good();
  mutate(s);
  return validateSpec(s, SHAPES);
};
const rejects = (mutate, re) => {
  const errors = errorsOf(mutate);
  assert.ok(errors.some((e) => re.test(e)), `expected ${re} in ${JSON.stringify(errors)}`);
};

test("a good spec passes", () => assert.deepEqual(validateSpec(good(), SHAPES), []));

test("unknown keys are rejected at every level", () => {
  rejects((s) => (s.colour = "red"), /^colour: unknown field/);
  rejects((s) => (s.product.logo = "x"), /^product\.logo: unknown field/);
  rejects((s) => (s.slots.extra = "x"), /^slots\.extra: unknown field/);
  rejects((s) => (s.notes[0].icon = "x"), /^notes\[0\]\.icon: unknown field/);
});

test("limits name the field", () => {
  rejects((s) => (s.headline = "x".repeat(73)), /^headline: 73 characters; at most 72/);
  rejects((s) => (s.slots.top = ["a"]), /^slots\.top: 1 words; use 2 to 4/);
  rejects((s) => (s.slots.waist = "ELEVEN CHAR"), /^slots\.waist: 11 characters; at most 10/);
  rejects((s) => (s.notes[1].text = "y".repeat(221)), /^notes\[1\]\.text: 221 characters; at most 220/);
  rejects((s) => (s.notes[1].title = "z".repeat(25)), /^notes\[1\]\.title: 25 characters; at most 24/);
  rejects((s) => (s.notBuilt = ["a", "b", "c", "d", "e", "f", "g"]), /^notBuilt: 7 items; at most 6/);
});

test("slots must all be present, filled, and of their kind", () => {
  rejects((s) => delete s.slots.waist, /^slots\.waist: missing \(what it becomes\)/);
  rejects((s) => (s.slots.top = ["… what goes in"]), /^slots\.top: still the placeholder/);
  rejects((s) => (s.slots.waist = ["ONE"]), /^slots\.waist: must be a short phrase/);
  rejects((s) => (s.slots.aside = "A **bold** middle."), /^slots\.aside: \*\*bold\*\* is allowed only at the start/);
});

test("the notes count is the shape's", () => {
  rejects((s) => s.notes.push({ title: "More", text: "One more note." }), /^notes: 4 notes; funnel takes exactly 3/);
});

test("hot must be a whole word from the shape's hot slots, case-folded", () => {
  assert.deepEqual(errorsOf((s) => (s.hot = "RECIPES")), []);
  assert.deepEqual(errorsOf((s) => (s.hot = "one plan")), []);
  rejects((s) => (s.hot = "recipe"), /^hot: "recipe" must be a word from slots\.top or slots\.waist/);
  rejects((s) => (s.hot = "dinner"), /^hot: "dinner" must be/);
});

test("shape and theme must exist; the facts hash must look like one", () => {
  rejects((s) => (s.shape = "spiral"), /^shape: "spiral" is not a shape; use one of funnel/);
  rejects((s) => (s.theme = "dark"), /^theme: "dark" is not a theme of funnel; use light/);
  rejects((s) => (s.facts = "abc"), /^facts: must be the 12-character hash/);
  rejects((s) => (s.version = 1), /^version: must be 2/);
});

test("copy is free of jargon, file paths and AI tells", () => {
  rejects((s) => (s.notes[0].text = "Talks to the API."), /^notes\[0\]\.text: jargon: "api" in "Talks to the API\."/);
  rejects((s) => (s.slots.aside = "Lives in lib/plan.ts today."), /^slots\.aside: a file path/);
  rejects((s) => (s.headline = "01 Plan dinner"), /^headline: a "01\/02\/03" style marker/);
  rejects((s) => (s.notes[2].title = "Fast · simple"), /^notes\[2\]\.title: a middle dot/);
  assert.deepEqual(textProblems("Ask for ideas with OpenAI, Stripe and Clerk."), [], "vendor names are not jargon");
  assert.deepEqual(textProblems("24/7 and either/or"), [], "a slash alone is not a path");
});

test("isJargon is exact, whole-word tokens", () => {
  assert.deepEqual(isJargon("The Backend and an env var, plus the API."), ["backend", "env var", "api"]);
  assert.deepEqual(isJargon("rapid, apiary, prototype, reporting, deployed"), []);
});

test("hasWord matches whole words only", () => {
  assert.ok(hasWord("Decisions and why", "decisions"));
  assert.ok(!hasWord("indecisions", "decisions"));
  assert.ok(hasWord("what's done", "what's done"));
});

test("every term in the plain-language-rules banned table is in BANNED", () => {
  const md = fs.readFileSync(path.join(HERE, "..", "..", "plain-language-rules.md"), "utf8");
  const lines = md.slice(md.search(/^#+ .*banned/im)).split("\n");
  const start = lines.findIndex((l) => l.startsWith("|"));
  const end = lines.findIndex((l, i) => i > start && !l.startsWith("|"));
  const rows = lines.slice(start + 2, end === -1 ? undefined : end);
  const terms = rows.flatMap((row) => row.split("|")[1].split("/").map((t) => t.replace(/[`"*]/g, "").trim().toLowerCase())).filter(Boolean);
  assert.ok(terms.length >= 10, `found the table (${terms.length} terms)`);
  const missing = terms.filter((t) => !BANNED.includes(t));
  assert.deepEqual(missing, [], "terms in the doc's table that lib/jargon.mjs does not ban");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSpec, textProblems, hasWord, scaffoldSpec } from "../lib/spec.mjs";
import { BANNED, isJargon } from "../lib/jargon.mjs";
import { scanRepo } from "../lib/scan/index.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRESETS = path.join(HERE, "..", "presets");
const IDS = fs.readdirSync(PRESETS).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
const preset = (id) => ({ ...JSON.parse(fs.readFileSync(path.join(PRESETS, `${id}.json`), "utf8")), facts: "d73b88fe2d4e" });
const good = () => preset("hourglass");

const errorsOf = (mutate, base = good) => {
  const s = base();
  mutate(s);
  return validateSpec(s);
};
const rejects = (mutate, re, base) => {
  const errors = errorsOf(mutate, base);
  assert.ok(errors.some((e) => re.test(e)), `expected ${re} in ${JSON.stringify(errors)}`);
};

test("every preset is a valid spec", () => {
  assert.deepEqual(IDS.sort(), ["eye", "hourglass", "ribbon", "warm-start"]);
  for (const id of IDS) assert.deepEqual(validateSpec(preset(id)), [], id);
});

test("unknown keys are rejected at every level", () => {
  rejects((s) => (s.colour = "red"), /^colour: unknown field/);
  rejects((s) => (s.product.logo = "x"), /^product\.logo: unknown field/);
  rejects((s) => (s.figure.extra = "x"), /^figure\.extra: unknown field/);
  rejects((s) => (s.figure.regions[0].colour = "x"), /^figure\.regions\[0\]\.colour: unknown field/);
  rejects((s) => (s.figure.texts[0].bold = true), /^figure\.texts\[0\]\.bold: unknown field/);
  rejects((s) => (s.notes[0].icon = "x"), /^notes\[0\]\.icon: unknown field/);
});

test("regions: kind, geometry and counts", () => {
  rejects((s) => (s.figure.regions[0].kind = "spiral"), /^figure\.regions\[0\]\.kind: "spiral" is not a region kind/);
  rejects((s) => (s.figure.regions[0].path = "M 0 0 L 1 1 Z"), /^figure\.regions\[0\]: give exactly one of profile, ellipse, polygon, path \(found profile, path\)/);
  rejects((s) => {
    delete s.figure.regions[0].profile;
    s.figure.regions[0].path = "M 10 10 Q 20";
  }, /^figure\.regions\[0\]\.path: does not parse: "Q" needs 4 numbers/);
  rejects((s) => {
    delete s.figure.regions[0].profile;
    s.figure.regions[0].polygon = [[10, 10], [200, 200]];
  }, /^figure\.regions\[0\]\.polygon: 3 to 40 points/);
  rejects((s) => (s.figure.regions[1].profile = [[1200, 420, 30], [1300, 420, 40], [1400, 420, 50]]), /^figure\.regions\[1\]\.profile\[0\]: y must be 0 to 1190/);
  rejects((s) => (s.figure.regions[0].profile[2][0] = 100), /^figure\.regions\[0\]\.profile\[2\]: y must be greater than the stop before/);
  rejects((s) => (s.figure.regions = Array.from({ length: 7 }, (_, i) => ({ ...s.figure.regions[0], id: `r${i}` }))), /^figure\.regions: 1 to 6 regions/);
  rejects((s) => (s.figure.regions[1].id = "inputs"), /^figure\.regions\[1\]\.id: "inputs" is used twice/);
  rejects((s) => (s.figure.regions[0].tone = ["soft", "hot"]), /^figure\.regions\[0\]\.tone: one of soft, mid, ink, cold, cool/);
  rejects((s) => (s.figure.regions[0].holes = [{ ellipse: { cx: 420, cy: 300, rx: 0, ry: 10 } }]), /^figure\.regions\[0\]\.holes\[0\]\.ellipse: rx and ry/);
});

test("words and dots lines have limits", () => {
  rejects((s) => (s.figure.regions[0].words = ["one"]), /^figure\.regions\[0\]\.words: 1 words; use 2 to 14/);
  rejects((s) => (s.figure.regions[0].words[0] = "x".repeat(25)), /words\[0\]: "x+" is 25 characters; at most 24/);
  const warm = () => preset("warm-start");
  rejects((s) => (s.figure.regions[0].lines[1] = "BREADS"), /^figure\.regions\[0\]\.lines\[1\]: "BREADS" is 6 characters; at most 5/, warm);
  rejects((s) => (s.figure.regions[0].lines[1] = "ONCE!"), /^figure\.regions\[0\]\.lines\[1\]: "ONCE!" must be letters A to Z and spaces/, warm);
  rejects((s) => s.figure.regions[0].tones.pop(), /^figure\.regions\[0\]\.tones: one of soft, mid, ink, cold, cool, hot per line \(4\)/, warm);
  rejects((s) => (s.figure.regions[0].cell = 40), /^figure\.regions\[0\]\.cell: a whole number of px, 8 to 32/, warm);
});

test("texts: one masthead, at most one headline, roles and sizes", () => {
  rejects((s) => s.figure.texts.splice(5, 1, { role: "masthead", id: "second", x: 10, y: 10, w: 200 }), /^figure\.texts: 2 mastheads; use exactly one/);
  rejects((s) => (s.figure.texts = s.figure.texts.filter((t) => t.role !== "masthead")), /^figure\.texts: 0 mastheads/);
  rejects((s) => s.figure.texts.splice(5, 1, { role: "headline", id: "again", x: 10, y: 900, w: 200 }), /^figure\.texts: 2 headlines/);
  rejects((s) => (s.figure.texts[0].size = 200), /^figure\.texts\[0\]\.size: 48 to 120/);
  rejects((s) => (s.figure.texts[3].hot = true), /^figure\.texts\[3\]\.hot: only a label can be hot/);
  rejects((s) => (s.figure.texts[0].text = "Pantry"), /^figure\.texts\[0\]\.text: the masthead prints product\.name/);
  rejects((s) => (s.figure.texts[3].id = "note"), /^figure\.texts\[3\]\.id: "note" is a footer block/);
  rejects((s) => (s.figure.texts[4].text = "A **bold** middle."), /^figure\.texts\[4\]\.text: \*\*bold\*\* is allowed only at the start/);
});

test("hot must come from the figure's words, a hot label, or a hot region", () => {
  assert.deepEqual(errorsOf((s) => (s.hot = "LEFTOVERS")), []);
  assert.deepEqual(errorsOf((s) => (s.hot = "one week")), [], "the hot label's text");
  rejects((s) => (s.hot = "leftover"), /^hot: "leftover" must be in a fill region's words, a dots line or a hot label/);
  rejects((s) => (s.hot = "breakfast"), /^hot: "breakfast" must be/);
  assert.deepEqual(errorsOf((s) => (s.hot = "eat"), () => preset("warm-start")), [], "a dots line");
  assert.deepEqual(errorsOf((s) => (s.hot = "anything"), () => preset("eye")), [], "the eye's iris region is hot");
});

test("limits name the field; notes are 2 or 3", () => {
  rejects((s) => (s.headline = "x".repeat(73)), /^headline: 73 characters; at most 72/);
  rejects((s) => (s.figure.fits = "x".repeat(161)), /^figure\.fits: 161 characters; at most 160/);
  rejects((s) => (s.notes[1].text = "y".repeat(221)), /^notes\[1\]\.text: 221 characters; at most 220/);
  rejects((s) => (s.notBuilt = ["a", "b", "c", "d", "e", "f", "g"]), /^notBuilt: 7 items; at most 6/);
  rejects((s) => s.notes.push({ title: "More", text: "One more note." }), /^notes: 4 notes; use 2 or 3/);
  rejects((s) => (s.theme = "sepia"), /^theme: "sepia" is not a theme; use light or dark/);
  rejects((s) => (s.accent = "violet"), /^accent: a hex colour/);
  rejects((s) => (s.version = 2), /^version: must be 3/);
  rejects((s) => (s.facts = "abc"), /^facts: must be the 12-character hash/);
});

test("copy is free of jargon, file paths and AI tells, in words, texts and notes", () => {
  rejects((s) => (s.figure.regions[0].words[1] = "webhooks"), /^figure\.regions\[0\]\.words\[1\]: jargon: "webhooks"/);
  rejects((s) => (s.figure.texts[3].text = "Lives in lib/plan.ts today."), /^figure\.texts\[3\]\.text: a file path/);
  rejects((s) => (s.notes[0].text = "Talks to the API."), /^notes\[0\]\.text: jargon: "api" in "Talks to the API\."/);
  rejects((s) => (s.headline = "01 Plan dinner"), /^headline: a "01\/02\/03" style marker/);
  rejects((s) => (s.notes[2].title = "Fast · simple"), /^notes\[2\]\.title: a middle dot/);
  assert.deepEqual(textProblems("Ask for ideas with OpenAI, Stripe and Clerk."), [], "vendor names are not jargon");
  assert.deepEqual(textProblems("24/7 and either/or"), [], "a slash alone is not a path");
});

test("a scaffold is rejected until every placeholder is written, with or without a preset", () => {
  const facts = scanRepo(path.join(HERE, "fixtures", "recipe"));
  for (const from of [undefined, ...IDS]) {
    const p = from && preset(from);
    const spec = scaffoldSpec(facts, { theme: p ? p.theme : "light", date: "2026-10-28", floor: 884, preset: p });
    const errors = validateSpec(spec);
    for (const want of [/^headline: still the placeholder/, /^hot: still the placeholder/, /^figure\.fits: still the placeholder/, /^notes\[0\]\.title: still the placeholder/, /still the placeholder; write \d+ to \d+ (nouns|words)/]) {
      assert.ok(errors.some((e) => want.test(e)), `${from ?? "no preset"}: expected ${want} in ${JSON.stringify(errors)}`);
    }
    if (p) assert.deepEqual(spec.figure.regions.map((r) => r.profile ?? r.ellipse ?? r.x), p.figure.regions.map((r) => r.profile ?? r.ellipse ?? r.x), "geometry kept");
  }
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

test("a field region: its keys, the options only its kind takes, and copy rules on names and the sentence", () => {
  const withField = (region) => () => {
    const s = good();
    delete s.hot;
    s.figure.regions = [{ kind: "field", id: "wave", field: "wave", ...region }];
    return s;
  };
  assert.deepEqual(validateSpec(withField({ accent: "area:lib/plan", names: { "area:lib": "kitchen" }, sentence: "plan once", every: 4 })()), []);
  assert.deepEqual(validateSpec(withField({ field: "terrain" })()), [], "accent and hot are optional");
  const cases = [
    [{ field: "river" }, /^figure\.regions\[0\]\.field: "river" is not a field; use wave or terrain$/],
    [{ field: "terrain", sentence: "plan once" }, /^figure\.regions\[0\]\.sentence: a terrain field has no sentence; only wave takes it$/],
    [{ accent: "lib/plan" }, /^figure\.regions\[0\]\.accent: an area id like "area:lib\/plan"/],
    [{ names: { "area:lib": "the API" } }, /^figure\.regions\[0\]\.names\["area:lib"\]: jargon: "api"/],
    [{ names: { "area:lib": "… a plain name" } }, /still the placeholder/],
    [{ sentence: "x".repeat(41) }, /^figure\.regions\[0\]\.sentence: 41 characters; at most 40$/],
    [{ every: 1 }, /^figure\.regions\[0\]\.every: a whole number, 2 to 20$/],
    [{ maxParts: 40 }, /maxParts: a whole number, 2 to 24/],
    [{ minShare: 0.5 }, /minShare: 0 to 0\.2/],
    [{ words: ["a", "b"] }, /^figure\.regions\[0\]\.words: unknown field$/],
  ];
  for (const [region, re] of cases) rejects(() => {}, re, withField(region));
  rejects((s) => s.figure.regions.push({ kind: "field", id: "two", field: "terrain" }), /^figure\.regions: at most 1 field region$/, withField({}));
  assert.deepEqual(errorsOf((s) => (s.hot = "kitchen"), withField({})), [], "a field's hot word is checked on the page, where its part names exist");
});

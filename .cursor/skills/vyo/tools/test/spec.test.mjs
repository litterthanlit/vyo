import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSpec, textProblems, hasWord, scaffoldSpec } from "../lib/spec.mjs";
import { FIELDS } from "../lib/fields/index.mjs";
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
  assert.deepEqual(IDS.sort(), ["bleed", "eye", "glyph", "hourglass", "radial", "ribbon", "river", "scatter", "signal-paper", "signal-wave", "sphere", "spiral", "terrain", "warm-start", "wave", "wave-swiss"]);
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
  rejects((s) => s.figure.texts.splice(5, 1, { role: "masthead", id: "second", x: 10, y: 10, w: 200 }), /^figure\.texts: 2 mastheads; use exactly 1/);
  rejects((s) => (s.figure.texts = s.figure.texts.filter((t) => t.role !== "masthead")), /^figure\.texts: 0 mastheads/);
  rejects((s) => s.figure.texts.splice(5, 1, { role: "headline", id: "again", x: 10, y: 900, w: 200 }), /^figure\.texts: 2 headlines; use 0 to 1/);
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

test("a scaffold is rejected until every placeholder is written: a field by default, or a fill preset", () => {
  const facts = scanRepo(path.join(HERE, "fixtures", "recipe"));
  const fillPresets = IDS.filter((id) => !preset(id).figure.regions.some((r) => r.kind === "field"));
  for (const from of [undefined, ...fillPresets]) {
    const p = from && preset(from);
    const spec = scaffoldSpec(facts, { frame: "swiss", theme: p ? p.theme : "light", date: "2026-10-28", floor: 884, preset: p, field: p ? undefined : "wave", unplain: [{ id: "area:lib", name: "Convex" }] });
    const errors = validateSpec(spec);
    const field = p ? [/^hot: still the placeholder/, /still the placeholder; write \d+ to \d+ (nouns|words)/] : [/^figure\.regions\[0\]\.sentence: still the placeholder/, /^figure\.regions\[0\]\.names\["area:lib"\]: still the placeholder/];
    const fits = p ? /^figure\.fits: still the placeholder/ : /^figure\.regions\[0\]\.fits: still the placeholder/;
    for (const want of [/^headline: still the placeholder/, fits, /^notes\[0\]\.title: still the placeholder/, ...field]) {
      assert.ok(errors.some((e) => want.test(e)), `${from ?? "no preset"}: expected ${want} in ${JSON.stringify(errors)}`);
    }
    if (p) assert.deepEqual(spec.figure.regions.map((r) => r.profile ?? r.ellipse ?? r.x), p.figure.regions.map((r) => r.profile ?? r.ellipse ?? r.x), "geometry kept");
    else assert.ok(!errors.some((e) => /^hot/.test(e)), "a field scaffold has no hot word to write");
  }
  const terrain = scaffoldSpec(facts, { frame: "swiss", theme: "dark", date: "2026-10-28", floor: 884, field: "terrain", accent: "area:lib/ai" });
  assert.deepEqual(terrain.figure.regions.map(({ fits, ...r }) => r), [{ kind: "field", id: "terrain", field: "terrain", accent: "area:lib/ai" }]);
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
    delete s.figure.fits;
    s.figure.regions = [{ kind: "field", id: "wave", field: "wave", fits: "Pantry's week travels down the page.", ...region }];
    return s;
  };
  assert.deepEqual(validateSpec(withField({ accent: "area:lib/plan", names: { "area:lib": "kitchen" }, sentence: "plan once", every: 4 })()), []);
  assert.deepEqual(validateSpec(withField({ seed: 0 })()), []);
  assert.deepEqual(validateSpec(withField({ seed: 2147483647 })()), []);
  assert.deepEqual(validateSpec(withField({ field: "glyph", letter: "Q" })()), []);
  assert.deepEqual(validateSpec(withField({ field: "trace", mask: "masks/trace.png" })()), []);
  assert.deepEqual(validateSpec(withField({ field: "terrain" })()), [], "accent and hot are optional");
  const cases = [
    [{ field: "lake" }, new RegExp(`^figure\\.regions\\[0\\]\\.field: "lake" is not a field; use ${Object.keys(FIELDS).join(" or ")}$`)],
    [{ field: "terrain", sentence: "plan once" }, /^figure\.regions\[0\]\.sentence: a terrain field has no sentence; only wave takes it$/],
    [{ accent: "lib/plan" }, /^figure\.regions\[0\]\.accent: an area id like "area:lib\/plan"/],
    [{ names: { "area:lib": "the API" } }, /^figure\.regions\[0\]\.names\["area:lib"\]: jargon: "api"/],
    [{ names: { "area:lib": "… a plain name" } }, /still the placeholder/],
    [{ sentence: "x".repeat(41) }, /^figure\.regions\[0\]\.sentence: 41 characters; at most 40$/],
    [{ every: 1 }, /^figure\.regions\[0\]\.every: a whole number, 2 to 20$/],
    [{ maxParts: 40 }, /maxParts: a whole number, 2 to 24/],
    [{ minShare: 0.5 }, /minShare: 0 to 0\.2/],
    [{ seed: -1 }, /seed: a whole number, 0 to 2147483647/],
    [{ seed: 1.5 }, /seed: a whole number, 0 to 2147483647/],
    [{ seed: 2147483648 }, /seed: a whole number, 0 to 2147483647/],
    [{ letter: "A" }, /letter: a wave field has no letter; only glyph takes it/],
    [{ mask: "mark.png" }, /mask: a wave field has no mask; only trace takes it/],
    [{ field: "glyph", letter: "a" }, /letter: one character A to Z or 0 to 9/],
    [{ field: "glyph", letter: "AA" }, /letter: one character A to Z or 0 to 9/],
    [{ field: "trace", mask: "  " }, /mask: a path to a PNG/],
    [{ words: ["a", "b"] }, /^figure\.regions\[0\]\.words: unknown field$/],
  ];
  for (const [region, re] of cases) rejects(() => {}, re, withField(region));
  rejects((s) => s.figure.regions.push({ kind: "field", id: "two", field: "terrain", fits: "x" }), /^figure\.regions: at most 1 field region$/, withField({}));
  rejects(() => {}, /^figure\.regions\[0\]\.fits: missing$/, withField({ fits: undefined }));
  rejects((s) => (s.figure.fits = "A shape."), /^figure\.fits: a field poster says why it fits on its field region/, withField({}));
  assert.deepEqual(errorsOf((s) => (s.hot = "kitchen"), withField({})), [], "a field's hot word is checked on the page, where its part names exist");
});

test("a loose scaffold: no notes, the texts where compose placed them, and placeholders that spell out the legend and fits rules", () => {
  const facts = scanRepo(path.join(HERE, "fixtures", "recipe"));
  const at = (x, y) => ({ x, y, w: 240, align: "left" });
  const places = { label: at(40, 40), headline: at(40, 80), legend: at(40, 900), paragraph: at(560, 40), list: at(560, 300) };
  const spec = scaffoldSpec(facts, { theme: "light", commit: "04186f4", date: "2026-11-07", floor: 1190, field: "river", accent: "area:lib/plan", accentNames: ["the plan"], places });
  assert.equal(spec.frame, "loose");
  assert.equal(spec.notes, undefined);
  assert.deepEqual(spec.figure.texts.map((t) => [t.role, t.x, t.y]), [["label", 40, 40], ["headline", 40, 80], ["legend", 40, 900], ["paragraph", 560, 40], ["list", 560, 300]]);
  const errors = validateSpec(spec);
  assert.ok(errors.includes('figure.texts[2].text: still the placeholder; write what the picture encodes, at most 2 sentences and 180 characters: name "the plan" and the measure ("merge" or "join" or "flow")'), JSON.stringify(errors));
  assert.ok(errors.some((e) => /^figure\.regions\[0\]\.fits: still the placeholder; write one sentence/.test(e)));
  assert.ok(!errors.some((e) => /^notes/.test(e)));
});

test("frames: loose takes its own roles and counts, no notes, and a field; swiss rejects a record", () => {
  const loose = () => ({ ...preset("wave"), frame: "loose", notes: undefined, notBuilt: undefined });
  rejects((s) => (s.figure.texts = [{ role: "masthead", id: "masthead", x: 50, y: 36, w: 490 }]), /^figure\.texts\[0\]\.role: "masthead" is not a role in the loose frame; use label, headline, paragraph, legend, list, rule$/, loose);
  rejects((s) => (s.notes = []), /^notes: the loose frame has no footer/, loose);
  rejects((s) => (s.frame = "poster"), /^frame: "poster" is not a frame; use swiss or loose or signal$/);
  rejects((s) => (s.record = "left"), /^record: only the loose and signal frames have a record line/);
});

test("signal: grotesque roles, marks, routes and motion", () => {
  assert.deepEqual(validateSpec(preset("signal-wave")), []);
  assert.deepEqual(validateSpec(preset("signal-paper")), []);
  const signal = () => preset("signal-wave");
  rejects((s) => (s.figure.texts = [{ role: "masthead", id: "masthead", x: 50, y: 36, w: 490 }]), /"masthead" is not a role in the signal frame/, signal);
  rejects((s) => (s.figure.regions = []), /^figure\.regions: 1 to 6 regions/, signal);
  rejects((s) => (s.figure.regions = [{ kind: "dots", id: "dots", lines: ["PLAN", "WEEK"], x: 40, y: 40, cell: 12, tones: ["ink", "hot"] }]), /^figure\.regions: the signal frame draws a field or a fill/, signal);
  rejects((s) => (s.motion = { kind: "spin", frames: 12, fps: 12 }), /motion.kind: "spin" is not a motion; use nodes or resolve or wipe/, signal);
  rejects((s) => (s.motion = { kind: "nodes", frames: 2, fps: 12 }), /motion.frames: a whole number, 8 to 36/, signal);
  const withRoutes = () => {
    const s = preset("signal-wave");
    s.figure.regions.push({
      kind: "routes",
      id: "lines",
      paths: [{ d: "M 40 40 L 200 200", tone: "hot" }],
      nodes: [{ path: 0, t: 0.4, tone: "ink" }],
    });
    s.motion = { kind: "nodes", frames: 12, fps: 10 };
    return s;
  };
  assert.deepEqual(validateSpec(withRoutes()), []);
  rejects((s) => (s.figure.regions[1].paths[0].d = "Q 1 2"), /paths\[0\]\.d: does not parse/, withRoutes);
  rejects((s) => (s.figure.regions[1].nodes[0].path = 4), /nodes\[0\]\.path: index of a path, 0 to 0/, withRoutes);
  const paper = () => preset("signal-paper");
  rejects((s) => {
    const m = s.figure.texts.find((t) => t.role === "mark");
    m.h = 2;
  }, /figure\.texts\[\d+\]\.h: 4 to 1190/, paper);
});

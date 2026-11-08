import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHECKS, runChecks } from "../lib/check.mjs";
import { partsFromFacts } from "../lib/parts.mjs";
import { scanRepo } from "../lib/scan/index.mjs";

const region = (id, words, extra = {}) => ({ kind: "fill", id, polygon: [[0, 0], [10, 0], [10, 10]], words, tone: "mid", ...extra });
const spec = {
  frame: "swiss",
  theme: "light",
  hot: "leftovers",
  figure: { regions: [region("top", ["leftovers", "recipes"]), region("bottom", ["lists", "dinners"])], texts: [{ role: "masthead", id: "masthead" }] },
  notes: [{}, {}, {}],
};
const facts = { facts: [], empty: true, repo: { name: "recipe" } };
const sheet = { left: 0, top: 0, right: 840, bottom: 1190 };
const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
// Two regions of 20 rows each, narrowing then widening, filling most of the area above a footer at 884.
const rows = [
  ...Array.from({ length: 20 }, (_, i) => ({ word: i % 2 ? "recipes" : "leftovers", region: "top", hot: i % 2 === 0, scrollWidth: 80, clientWidth: 90, rect: rect(60 + i * 15, 176 + i * 16, 780 - i * 15, 192 + i * 16) })),
  ...Array.from({ length: 20 }, (_, i) => ({ word: i % 2 ? "lists" : "dinners", region: "bottom", hot: false, scrollWidth: 80, clientWidth: 90, rect: rect(360 - i * 15, 560 + i * 16, 480 + i * 15, 576 + i * 16) })),
];
const page = (over = {}) => ({
  sheet, errors: [], drawn: true, inter: true, footerTop: 884,
  faces: [["Commit Mono", "400"], ["Commit Mono", "700"], ["Newsreader", "400"]].map(([family, weight]) => ({ family, weight, status: "loaded" })),
  texts: [{ text: "LEFTOVERS", color: "rgb(255, 79, 18)", hot: true, where: "region top" }],
  boxes: [{ color: "rgb(234, 232, 226)", hot: false, where: "sheet" }],
  rows,
  dots: [],
  regions: [{ id: "top", kind: "fill", bbox: rect(60, 176, 780, 500), rows: 20 }, { id: "bottom", kind: "fill", bbox: rect(75, 560, 765, 880), rows: 20 }],
  blocks: [{ name: "note", text: "a", rect: rect(0, 900, 200, 950), lines: 2, owner: "notes" }, { name: "note", text: "b", rect: rect(220, 900, 400, 950) }, { name: "note", text: "c", rect: rect(420, 900, 600, 950) }],
  figureHot: ["leftovers"],
  ...over,
});
const findings = (p, s = spec) => runChecks("page", { spec: s, facts, page: p });
const failures = (p, s) => findings(p, s).filter((f) => f.level === "fail");

test("a clean page passes every page check", () => assert.deepEqual(failures(page()), []));

test("each page check catches its defect", () => {
  const cases = [
    ["palette", { boxes: [{ color: "rgb(1, 2, 3)", hot: false, where: "a square" }] }, /a square uses rgb\(1, 2, 3\), not a light token/],
    ["hot-tagged", { texts: [{ text: "x", color: "rgb(255, 79, 18)", hot: false, where: "aside" }] }, /aside is in the accent colour without data-hot/],
    ["words-drawn", { figureHot: [] }, /the hot word "leftovers" is not drawn in the accent colour/],
    ["words-drawn", { rows: rows.filter((r) => r.word !== "dinners") }, /^region bottom: "dinners" never drawn; shorten the list or enlarge the path$/],
    ["rows-fit", { rows: [{ ...rows[0], scrollWidth: 120, clientWidth: 90 }] }, /needs 120px but has 90px/],
    ["fonts", { faces: [] }, /Commit Mono 400 did not load/],
    ["blocks-inside", { blocks: [...page().blocks, { name: "headline", text: "h", rect: rect(0, 1180, 10, 1200), lines: 1 }] }, /headline runs off the sheet/],
    ["blocks-apart", { blocks: [...page().blocks, { name: "aside", text: "x", rect: rect(10, 910, 50, 920), lines: 1 }] }, /note overlaps aside/],
    ["blocks-apart", { blocks: [...page().blocks, { name: "aside", text: "x", rect: rect(100, 180, 200, 200), lines: 1 }] }, /aside overlaps the row "leftovers"|the row "leftovers" overlaps aside/],
    ["notes", { blocks: page().blocks.slice(0, 2) }, /the footer shows 2 notes; the spec has 3/],
    ["copy", { rows: [...rows, { ...rows[0], word: "webhooks" }] }, /region top: jargon: "webhooks"/],
    ["drawn", { drawn: false }, /never set window\.drawn/],
    ["path", { regions: [{ id: "bottom", kind: "fill", bbox: rect(75, 560, 765, 910), rows: 20 }] }, /^region bottom reaches 26px below the footer; move it up by 26$/],
    ["path", { regions: [{ id: "bottom", kind: "fill", bbox: rect(75, 560, 900, 800), rows: 20 }] }, /^region bottom runs off the sheet/],
    ["region-size", { regions: [{ id: "top", kind: "fill", bbox: rect(60, 176, 780, 200), rows: 2 }] }, /^region top has 2 rows; it needs at least 4/],
    ["region-size", { regions: [{ id: "words", kind: "dots", bbox: rect(130, 300, 710, 900), rows: 4 }] }, /^region words does not fit/],
    ["regions-apart", { rows: [...rows, { ...rows[25], region: "top", rect: rect(482, 640, 600, 656) }] }, /^regions bottom and top touch at y 640/],
    ["silhouette", { rows: rows.slice(0, 3) }, /covers \d+% of the sheet above the footer; it needs 15%/],
    ["silhouette", { rows: rows.slice(0, 20) }, /spans \d+% of the height above the footer; it needs 55%/],
    ["row-variety", { rows: rows.map((r, i) => (r.region === "bottom" ? { ...r, rect: rect(100, 560 + (i - 20) * 16, 740, 576 + (i - 20) * 16) } : r)) }, /^region bottom is a box; a silhouette changes width along its whole height \(spread\/mean 0\.00, needs 0\.25\)$/],
  ];
  for (const [id, over, re] of cases) {
    const found = failures(page(over));
    assert.ok(found.some((f) => f.id === id && re.test(f.message)), `${id}: expected ${re} in ${JSON.stringify(found)}`);
  }
});

test("thin-region warns for a narrow region, and a hole does not make a wide region thin", () => {
  const narrow = rows.map((r, i) => (r.region === "bottom" ? { ...r, rect: rect(380 - (i % 5) * 10, r.rect.top, 460 + (i % 5) * 10, r.rect.bottom) } : r));
  const thin = findings(page({ rows: narrow })).filter((f) => f.id === "thin-region");
  assert.deepEqual(thin.map((f) => [f.level, f.message]), [["warn", "region bottom reads as a column; widen it or make it part of the main silhouette (120px across on average, under 160px)"]]);
  const split = rows.flatMap((r) => (r.region === "top" ? [{ ...r, rect: { ...r.rect, right: r.rect.left + 40 } }, { ...r, rect: { ...r.rect, left: r.rect.right - 40 } }] : [r]));
  assert.deepEqual(findings(page({ rows: split })).filter((f) => ["thin-region", "row-variety"].includes(f.id)), []);
});

test("row-variety, thin-region and one-region are skipped when the figure has no fill regions", () => {
  const dotsOnly = { ...spec, figure: { ...spec.figure, regions: [{ kind: "dots", id: "words", lines: ["PLAN", "EAT"], x: 130, y: 56, cell: 20, tones: ["ink", "hot"] }] } };
  const p = page({ rows: [], regions: [{ id: "words", kind: "dots", bbox: rect(130, 56, 710, 736), rows: 2 }], dots: [{ word: "PLAN", region: "words", hot: false, rect: rect(130, 56, 710, 196) }, { word: "EAT", region: "words", hot: true, rect: rect(130, 236, 710, 736) }] });
  assert.deepEqual(findings(p, dotsOnly).filter((f) => ["row-variety", "thin-region", "one-region"].includes(f.id)), []);
});

test("one-region warns for a single plain fill region and not when there is an accent", () => {
  const one = { ...spec, figure: { ...spec.figure, regions: [region("top", ["leftovers", "recipes"])] } };
  const plain = page({ rows: rows.slice(0, 20).map((r) => ({ ...r, hot: false })) });
  assert.ok(findings(plain, one).some((f) => f.id === "one-region" && f.level === "warn"));
  assert.ok(!findings(page({ rows: rows.slice(0, 20) }), one).some((f) => f.id === "one-region"));
});

test("preset-copy warns only when every region's geometry is a preset's", () => {
  const p = { figure: { regions: [region("a", ["x", "y"]), region("b", ["x", "y"], { polygon: [[1, 1], [9, 1], [9, 9]] })] } };
  const warn = (regions) => runChecks("spec", { spec: { ...validish, figure: { ...validish.figure, regions } }, facts: { ...facts, hash: validish.facts }, presets: { p } }).filter((f) => f.id === "preset-copy");
  const validish = JSON.parse(JSON.stringify({ version: 3, frame: "swiss", facts: "d73b88fe2d4e", product: { name: "Pantry", repo: "recipe", date: "2026-11-07" }, theme: "light", headline: "Dinner.", hot: "x", figure: { fits: "A shape.", regions: [], texts: [{ role: "masthead", id: "masthead", x: 50, y: 36, w: 490 }] }, notes: [{ title: "a", text: "b" }, { title: "c", text: "d" }], notBuilt: [] }));
  assert.equal(warn([region("mine", ["x", "y"])]).length, 1);
  assert.equal(warn([region("mine", ["x", "y"], { polygon: [[2, 2], [9, 2], [9, 9]] })]).length, 0);
});

test("every check has a unique id, a level, a stage and a description", () => {
  assert.equal(new Set(CHECKS.map((c) => c.id)).size, CHECKS.length);
  for (const c of CHECKS) assert.ok(["fail", "warn"].includes(c.level) && ["spec", "page"].includes(c.stage) && c.about, c.id);
  assert.deepEqual(
    CHECKS.map((c) => c.id).sort(),
    ["accent-part", "band", "blocks-apart", "blocks-inside", "copy", "drawn", "facts-empty", "facts-hash", "field-parts", "fonts", "headline-lines", "hot-tagged", "masthead-font", "notes", "one-region", "palette", "part-name", "path", "preset-copy", "product-name", "record", "region-size", "regions-apart", "row-variety", "rows-fit", "silhouette", "spec", "thin-region", "words-drawn"],
  );
});

const recipe = scanRepo(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "recipe"));
const recipeParts = partsFromFacts(recipe);
const field = (over = {}) => ({ kind: "field", id: "wave", field: "wave", accent: "area:lib/plan", ...over });
const fieldSpec = (over) => ({ ...spec, hot: undefined, figure: { ...spec.figure, regions: [field(over)] } });
// One box-shaped row per part, all the same width: a field that a fill region's rules would call a box.
const fieldRows = recipeParts.map((p, i) => ({ word: p.name, region: "wave", part: p.id, hot: p.id === "area:lib/plan", scrollWidth: 80, clientWidth: 90, rect: rect(100, 40 + i * 14, 500, 53 + i * 14) }));
const fieldPage = (over = {}) => page({ rows: fieldRows, regions: [{ id: "wave", kind: "field", bbox: rect(100, 40, 500, 300), rows: fieldRows.length }], figureHot: ["Plan"], ...over });
const fieldFindings = (p, s) => runChecks("page", { spec: s, facts: recipe, page: p });

test("field-parts passes a field that draws every part, and names each part it never draws", () => {
  assert.deepEqual(fieldFindings(fieldPage(), fieldSpec()).filter((f) => f.id === "field-parts"), []);
  const missing = fieldFindings(fieldPage({ rows: fieldRows.filter((r) => r.part !== "area:lib/ai") }), fieldSpec());
  assert.deepEqual(missing.filter((f) => f.id === "field-parts").map((f) => [f.level, f.message]), [["fail", 'region wave: part "AI features" (area:lib/ai) is never drawn; move the text blocks that cover it']]);
  const lost = fieldFindings(fieldPage(), fieldSpec({ accent: "area:nowhere" })).filter((f) => f.id === "field-parts");
  assert.deepEqual(lost.map((f) => f.message), ["region wave: accent area:nowhere names no part; vyo parts lists the part ids"]);
});

test("a field is exempt from row-variety, region-size, thin-region and the rows-crowding rule, not from blocks-apart", () => {
  const crowded = fieldRows.map((r) => ({ ...r, rect: { ...r.rect, top: 40, bottom: 53 } }));
  const ids = fieldFindings(fieldPage({ rows: crowded }), fieldSpec()).map((f) => f.id);
  for (const id of ["row-variety", "region-size", "thin-region"]) assert.ok(!ids.includes(id), id);
  assert.ok(!fieldFindings(fieldPage({ rows: crowded }), fieldSpec()).some((f) => f.id === "blocks-apart"));
  const covered = fieldFindings(fieldPage({ blocks: [...page().blocks, { name: "aside", text: "x", rect: rect(120, 44, 200, 60), lines: 1 }] }), fieldSpec());
  assert.ok(covered.some((f) => f.id === "blocks-apart" && /aside/.test(f.message)));
});

test("a wave's rows may pass behind the figure's texts and take the wave's violets; a terrain's may not, nor may a text", () => {
  const masthead = { name: "masthead", role: "masthead", text: "Pantry.", rect: rect(120, 44, 400, 120), lines: 1 };
  const behind = (over) => fieldFindings(fieldPage({ blocks: [...page().blocks, masthead] }), fieldSpec(over)).filter((f) => f.id === "blocks-apart");
  assert.deepEqual(behind(), []);
  assert.ok(behind({ field: "terrain" }).some((f) => /masthead/.test(f.message)));
  const violet = "rgb(122, 100, 220)";
  const palette = (texts) => fieldFindings(fieldPage({ texts }), fieldSpec()).filter((f) => f.id === "palette").map((f) => f.message);
  assert.deepEqual(palette([{ text: "server", color: violet, hot: false, where: "region wave" }]), []);
  assert.deepEqual(palette([{ text: "x", color: violet, hot: false, where: "aside" }]), ["aside uses rgb(122, 100, 220), not a light token"]);
});

test("a field poster without a hot word passes words-drawn; with one, the word must be in the accent", () => {
  assert.ok(!fieldFindings(fieldPage({ figureHot: [] }), fieldSpec()).some((f) => f.id === "words-drawn"));
  const withHot = { ...fieldSpec(), hot: "plan" };
  assert.ok(!fieldFindings(fieldPage(), withHot).some((f) => f.id === "words-drawn"));
  assert.ok(fieldFindings(fieldPage({ figureHot: [] }), withHot).some((f) => f.id === "words-drawn"));
});

test("part-name warns for vendor names, stray names and two parts with one name; accent-part warns when no accent is set", () => {
  const hypher = { facts: [{ id: "area:.", kind: "area", name: "Hypher", meta: { leaf: false } }, { id: "area:convex", kind: "area", name: "Convex", meta: { leaf: true } }, { id: "area:web", kind: "area", name: "Web", meta: { leaf: true } }], files: { "convex/a.ts": { area: "area:convex", loc: 50 }, "web/a.ts": { area: "area:web", loc: 50 } } };
  const run = (region) =>
    CHECKS.filter((c) => ["part-name", "accent-part"].includes(c.id)).flatMap((c) => c.run({ spec: { figure: { regions: [region] } }, facts: hypher }).map((message) => ({ id: c.id, level: c.level, message })));
  assert.deepEqual(run(field({ accent: "area:web" })).map((f) => [f.id, f.level, f.message]), [["part-name", "warn", 'part "Convex" (area:convex) looks like a vendor or code name; add a plain name in names']]);
  assert.deepEqual(run(field({ accent: "area:web", names: { "area:convex": "server", "area:gone": "old" } })).map((f) => f.message), ["names has area:gone, which is not a part of region wave; vyo parts lists the part ids"]);
  assert.deepEqual(run(field({ accent: undefined, names: { "area:convex": "server" } })).map((f) => [f.id, f.message]), [["accent-part", "no accent part in region wave; set accent to the id of the part the poster is about (vyo parts lists them)"]]);
  assert.deepEqual(run(field({ accent: "area:web", names: { "area:convex": "Web" } })).map((f) => [f.level, f.message]), [["warn", 'parts area:convex and area:web are all called "Web"; give each a plain name of its own in names']]);
});

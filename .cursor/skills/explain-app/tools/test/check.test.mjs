import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKS, runChecks } from "../lib/check.mjs";

const region = (id, words, extra = {}) => ({ kind: "fill", id, polygon: [[0, 0], [10, 0], [10, 10]], words, tone: "mid", ...extra });
const spec = {
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
  const validish = JSON.parse(JSON.stringify({ version: 3, facts: "d73b88fe2d4e", product: { name: "Pantry", repo: "recipe", date: "2026-11-07" }, theme: "light", headline: "Dinner.", hot: "x", figure: { fits: "A shape.", regions: [], texts: [{ role: "masthead", id: "masthead", x: 50, y: 36, w: 490 }] }, notes: [{ title: "a", text: "b" }, { title: "c", text: "d" }], notBuilt: [] }));
  assert.equal(warn([region("mine", ["x", "y"])]).length, 1);
  assert.equal(warn([region("mine", ["x", "y"], { polygon: [[2, 2], [9, 2], [9, 9]] })]).length, 0);
});

test("every check has a unique id, a level, a stage and a description", () => {
  assert.equal(new Set(CHECKS.map((c) => c.id)).size, CHECKS.length);
  for (const c of CHECKS) assert.ok(["fail", "warn"].includes(c.level) && ["spec", "page"].includes(c.stage) && c.about, c.id);
  assert.deepEqual(
    CHECKS.map((c) => c.id).sort(),
    ["band", "blocks-apart", "blocks-inside", "copy", "drawn", "facts-empty", "facts-hash", "fonts", "headline-lines", "hot-tagged", "masthead-font", "notes", "one-region", "palette", "path", "preset-copy", "product-name", "region-size", "regions-apart", "row-variety", "rows-fit", "silhouette", "spec", "thin-region", "words-drawn"],
  );
});

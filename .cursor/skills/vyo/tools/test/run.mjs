// npm test: the pure tests, then every preset rendered and checked, then the planted bugs, then the packed package installed and run.
// Posters land in test/.out/<preset>/ for a human to look at.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildPage, renderPage } from "../lib/render.mjs";
import { fieldItems } from "../lib/sketch.mjs";
import { BROWSER_NOTE } from "../lib/browser.mjs";
import { runChecks } from "../lib/check.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.join(HERE, "..");
const OUT = path.join(HERE, ".out");
const VYO = path.join(TOOLS, "vyo.mjs");
const PRESETS = fs.readdirSync(path.join(TOOLS, "presets")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();

const pure = spawnSync(process.execPath, ["--test", ...["scan", "spec", "geometry", "parts", "fields", "band", "check", "sketch", "shape", "place", "rings", "shape-relief", "docs", "init"].map((t) => path.join(HERE, `${t}.test.mjs`))], { stdio: "inherit" });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const factsFile = path.join(OUT, "recipe-facts.json");
const vyo = (...args) => spawnSync(process.execPath, [VYO, ...args], { encoding: "utf8" });
const scan = vyo("scan", path.join(HERE, "fixtures", "recipe"), "--out", factsFile);
if (scan.status !== 0) {
  console.error(scan.stderr);
  process.exit(1);
}
const hash = JSON.parse(fs.readFileSync(factsFile, "utf8")).hash;
const preset = (id) => ({ ...JSON.parse(fs.readFileSync(path.join(TOOLS, "presets", `${id}.json`), "utf8")), facts: hash });

let failed = 0;
const result = (ok, name, detail) => {
  console.log(`${ok ? "ok" : "not ok"} - ${name}`);
  if (!ok) {
    failed++;
    console.log(detail.replace(/^/gm, "    "));
  }
};

for (const id of PRESETS) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const specFile = path.join(dir, "recipe-poster.json");
  fs.writeFileSync(specFile, JSON.stringify(preset(id), null, 2));
  const r = vyo("render", specFile, "--facts", factsFile);
  result(r.status === 0 && /^PASS$/m.test(r.stdout) && !/^✗/m.test(r.stderr), `preset ${id} renders and passes every check`, r.stdout + r.stderr);
  const thumb = path.join(dir, "recipe-poster-thumb.png");
  const wh = fs.existsSync(thumb) ? [fs.readFileSync(thumb).readUInt32BE(16), fs.readFileSync(thumb).readUInt32BE(20)] : [];
  result(wh[0] === 280 && wh[1] === 396 && r.stdout.includes(thumb), `preset ${id} writes a 280x396 thumb and prints it`, `${wh}\n${r.stdout}`);
}

const fill = (id, shape, words, extra = {}) => ({ kind: "fill", id, ...shape, words, tone: "mid", ...extra });
const PLANTED = [
  ["a file path", "hourglass", (s) => (s.notes[0].text = "Saved by lib/plan/save.ts each week."), /^✗ spec: notes\[0\]\.text: a file path/m],
  ["jargon", "eye", (s) => (s.headline = "Your recipes behind one API."), /^✗ spec: headline: jargon: "api"/m],
  ["a hot word not in the figure", "ribbon", (s) => (s.hot = "breakfast"), /^✗ spec: hot: "breakfast" must be in a fill region's words/m],
  ["a fourth note", "hourglass", (s) => s.notes.push({ title: "More", text: "One more note." }), /^✗ spec: notes: 4 notes; use 2 or 3/m],
  ["a stale facts hash", "warm-start", (s) => (s.facts = "000000000000"), /^✗ facts-hash: spec\.facts is 000000000000 but facts\.json is /m],
  ["a note that runs into the bottom line", "eye", (s) => (s.notes[1].text = "Plain words that keep going. ".repeat(8).slice(0, 220).replace(/ /g, "")), /^✗ blocks-(apart|inside): /m],
  ["an accent equal to the ink, so ink reads as hot without data-hot", "hourglass", (s) => (s.accent = "#161616"), /^✗ hot-tagged: .+ is in the accent colour without data-hot/m],
  [
    "two overlapping paths",
    "hourglass",
    (s) => s.figure.regions.push(fill("pile", { path: "M 300 200 H 540 V 400 H 300 Z" }, ["recipes", "cravings"])),
    /^✗ regions-apart: regions inputs and pile touch at y \d+/m,
  ],
  ["a 30px path", "hourglass", (s) => s.figure.regions.push(fill("sliver", { path: "M 600 760 H 780 V 790 H 600 Z" }, ["recipes", "cravings"])), /^✗ region-size: region sliver has \d rows; it needs at least 4/m],
  [
    "one tiny region",
    "hourglass",
    (s) => (s.figure.regions = [fill("dot", { ellipse: { cx: 420, cy: 620, rx: 90, ry: 60 } }, ["recipes", "cravings", "leftovers"])]),
    /^✗ silhouette: the figure covers \d+% of the sheet above the footer; it needs 15%/m,
  ],
  [
    "14 long words in a small path",
    "hourglass",
    (s) => (s.figure.regions[1] = fill("outputs", { ellipse: { cx: 420, cy: 760, rx: 200, ry: 70 } }, Array.from({ length: 14 }, (_, i) => `weeknight dinner ${"abcdefghijklmn"[i]}`))),
    /^✗ words-drawn: region outputs: "weeknight dinner [a-n]" never drawn; shorten the list or enlarge the path/m,
  ],
  ["an aside placed on a dots line", "warm-start", (s) => s.figure.texts.push({ role: "aside", id: "stray", text: "Plan once.", x: 200, y: 120, w: 160 }), /^✗ blocks-apart: (stray overlaps the dots line "PLAN"|the dots line "PLAN" overlaps stray)/m],
  [
    "a box with a slanted top",
    "hourglass",
    (s) => (s.figure.regions[1] = fill("outputs", { polygon: [[100, 640], [740, 600], [740, 860], [100, 860]] }, ["lists", "dinners", "the plan"])),
    /^✗ row-variety: region outputs is a box; a silhouette changes width along its whole height/m,
  ],
  ["a region below the footer", "hourglass", (s) => (s.figure.regions[1].profile.at(-1)[0] = 950), /^✗ path: region outputs reaches 66px below the footer; move it up by 66$/m],
  [
    "a text block over a field's foothill",
    "terrain",
    (s) => s.figure.texts.push({ role: "paragraph", id: "lid", text: "Plan once and eat well.", x: 40, y: 1140, w: 110 }),
    /^✗ field-parts: region terrain: part "page frame" \(area:app\) is never drawn; move the text blocks that cover it$/m,
  ],
  ["an accent that names no part", "terrain", (s) => (s.figure.regions[0].accent = "area:nowhere"), /^✗ field-parts: region terrain: accent area:nowhere names no part/m],
  ["a loose poster with no legend", "wave", (s) => (s.figure.texts = s.figure.texts.filter((t) => t.role !== "legend")), /^✗ spec: figure\.texts: 0 legends; use exactly 1$/m],
  [
    "a legend without the accent part's name",
    "river",
    (s) => (s.figure.texts.find((t) => t.role === "legend").text = "Each stream is a part of Pantry, as thick as its code; streams merge where they use each other."),
    /^✗ legend: must say what the picture encodes; name the accent part \("the plan"\) and the measure \("merge" or "join" or "flow"\)$/m,
  ],
  ["a record line with no commit", "terrain", (s) => delete s.product.commit, /^✗ record: the record line has no commit; set product\.commit to the short hash/m],
  ["a fits without the field's keyword", "wave", (s) => (s.figure.regions[0].fits = "Pantry as a band of its own parts."), /^✗ fits: region wave: fits must say why a wave matches the product's story; use "travel" or "flow" or "hand" or "move"$/m],
  [
    "a shape whose first band falls in a stem too narrow for its name",
    "shape",
    (s) => (s.figure.regions[0].shape = { ops: [{ add: "rect", at: [0, 0], size: [6, 120] }, { add: "rect", at: [-40, 120], size: [84, 60], round: 10 }], fit: { h: 0.8 } }),
    /^✗ shape-name: part "saved recipes" never shows its whole name: its band \(y \d+ to \d+\) holds \d+px of 5\.0px type and the name needs \d+px; widen the shape there to at least \d+px or give the part a shorter name$/m,
  ],
  ["a legend placed on the shape", "shape", (s) => Object.assign(s.figure.texts.find((t) => t.role === "legend"), { x: 300, y: 600 }), /^✗ shape-room: the legend \(\d+ by \d+ at \d+,\d+\) sits on the shape or within 16px of it; move it into the top-(left|right) corner/m],
  ["a shape that paints nothing", "shape", (s) => s.figure.regions[0].shape.ops.push({ cut: "rect", at: [-50, -50], size: [300, 300] }), /^✗ spec: figure\.regions\[0\]\.shape: the ops paint nothing on the sheet/m],
];

// A drawn shape's flaws are warnings: the poster still renders, and the agent weighs the `!` line.
const jarShape = () => preset("shape").figure.regions[0].shape;
const SHAPE_WARNINGS = [
  ["a hairline handle", (s) => s.ops.push({ add: "capsule", from: [96, 60], to: [130, 40], r: 0.6 }), /^! shape-thin: the shape is \d+px thick near \d+,\d+; under 18px it is a hairline at thumbnail size, so make that feature at least 18px thick or remove it$/m],
  ["a tiny jar", (s) => (s.fit = { h: 0.3, cx: 0.52, cy: 0.64 }), /^! shape-cover: the shape covers 7% of the sheet; it needs 35% to read as the picture, so scale it up 2\.\d+x \(set fit\.h to 0\.\d+, it is 0\.3\) or draw it fatter$/m],
  ["a jar cut in two", (s) => s.ops.push({ cut: "rect", at: [-10, 70], size: [120, 4] }), /^! shape-split: the band of "[a-z ]+" \(y \d+ to \d+\) falls on 2 separate pieces of the shape/m],
];
const RINGS_WARNINGS = [
  ["a thin bar in rings", { ops: [{ add: "rect", at: [0, 0], size: [100, 12], round: 4 }], fit: { w: 0.9 } }, /^! shape-rings: the shape is \d+px across at its thickest, room for \d rings of 7px; its 12 parts need about 18, so draw it fatter/m],
  ["a bar of rings turned 45 degrees", { ops: [{ add: "rect", at: [0, 0], size: [40, 100], round: 2 }], rotate: 45, fit: { h: 0.7 } }, /^! shape-upright: part "[a-z ]+" never reads upright: none of its \d+ names leans under 30 degrees/m],
];
for (const [name, shape, expect] of RINGS_WARNINGS) {
  const spec = preset("shape-rings");
  spec.figure.regions[0].shape = shape;
  const file = path.join(OUT, "planted-rings.json");
  fs.writeFileSync(file, JSON.stringify(spec, null, 2));
  const r = vyo("check", file, "--facts", factsFile);
  result(expect.test(r.stderr), `planted rings flaw (${name}) warns with ${expect}`, `exit ${r.status}\n${r.stderr}`);
}

for (const [name, mutate, expect] of SHAPE_WARNINGS) {
  const spec = preset("shape");
  const shape = jarShape();
  mutate(shape);
  spec.figure.regions[0].shape = shape;
  const file = path.join(OUT, "planted-shape.json");
  fs.writeFileSync(file, JSON.stringify(spec, null, 2));
  const r = vyo("check", file, "--facts", factsFile);
  result(expect.test(r.stderr), `planted shape flaw (${name}) warns with ${expect}`, `exit ${r.status}\n${r.stderr}`);
}

// A relief's flaws, through the CLI: a form turned away from the light, and an accent stratum too thin to see.
const RELIEF_WARNINGS = [
  ["every face dim", (r) => r.shape.ops.forEach((o) => o.add && (o.face = "dim")), /^! shape-tone: at thumbnail size the relief's lit side reaches \d+\.\d% light \(90th percentile\); it needs 38\.0% to read as a bright object, so turn a dim face to lit or drop its face$/m],
  ["a flat strip", (r) => (r.shape = { ops: [{ add: "rect", at: [0, 0], size: [100, 40] }], fit: { w: 0.95 } }), /^! shape-accent: the accent stratum "the plan" is \d+px thick at its thickest; it needs 40px to show in the thumbnail, so turn the strata \(strata\.angle\) to cut across the shape's narrow side/m],
];
for (const [name, mutate, expect] of RELIEF_WARNINGS) {
  const spec = preset("shape-relief");
  mutate(spec.figure.regions[0]);
  const file = path.join(OUT, "planted-relief.json");
  fs.writeFileSync(file, JSON.stringify(spec, null, 2));
  const r = vyo("check", file, "--facts", factsFile);
  result(expect.test(r.stderr), `planted relief flaw (${name}) warns with ${expect}`, `exit ${r.status}\n${r.stderr}`);
}

for (const [name, id, mutate, expect] of PLANTED) {
  const spec = preset(id);
  mutate(spec);
  const file = path.join(OUT, "planted.json");
  fs.writeFileSync(file, JSON.stringify(spec, null, 2));
  const r = vyo("check", file, "--facts", factsFile);
  result(r.status === 1 && expect.test(r.stderr), `planted bug (${name}) fails with ${expect}`, `exit ${r.status}\n${r.stderr}`);
}

{
  const spec = preset("warm-start");
  spec.notBuilt = ["a", "b", "c", "d", "e", "f"].map((c) => `${c} weekly summary email to people`);
  const file = path.join(OUT, "long-not-built.json");
  fs.writeFileSync(file, JSON.stringify(spec, null, 2));
  const r = vyo("check", file, "--facts", factsFile);
  result(r.status === 0 && !/^✗/m.test(r.stderr), "six 32-character not-built items render on their own lines and pass", `exit ${r.status}\n${r.stderr}`);
}

{
  const spec = preset("hourglass");
  spec.figure.regions.push(fill("post", { polygon: [[690, 380], [780, 380], [780, 500], [690, 500]] }, ["recipes", "cravings"]));
  const file = path.join(OUT, "column.json");
  fs.writeFileSync(file, JSON.stringify(spec, null, 2));
  const r = vyo("check", file, "--facts", factsFile);
  result(/^! thin-region: region post reads as a column; widen it or make it part of the main silhouette/m.test(r.stderr), "a 90px-wide column warns thin-region", `exit ${r.status}\n${r.stderr}`);
}

// The sketch lays a field out in Node with Commit Mono's fixed advance; the page measures the font. Given the
// page's own text blocks, both must place every row within 2px.
const facts = JSON.parse(fs.readFileSync(factsFile, "utf8"));
for (const id of PRESETS.filter((p) => preset(p).figure.regions.some((r) => r.kind === "field"))) {
  const spec = preset(id);
  const page = await renderPage({ html: buildPage(spec, facts), base: path.join(OUT, `${id}-twin`), png: false, pdf: false });
  const blocks = page.blocks.filter((b) => b.role).map((b) => b.rect);
  const node = spec.figure.regions.flatMap((r) => fieldItems(spec, r, facts, blocks));
  const far = node.filter((n, i) => {
    const r = page.rows[i]?.rect;
    return !r || Math.abs(r.left - n.x) > 2 || Math.abs(r.top - n.y) > 2 || Math.abs(r.right - (n.x + n.width)) > 2;
  });
  result(node.length === page.rows.length && !far.length, `${id}: the sketch and the page place the same ${node.length} rows within 2px`, `node ${node.length} rows, page ${page.rows.length}; first apart: ${JSON.stringify(far[0])} vs ${JSON.stringify(page.rows[node.indexOf(far[0])]?.rect)}`);
}

// A halo drawn line by line covered the y of "type" with the stroke of "The" below it; text-clear must see that.
{
  const spec = preset("shape");
  spec.figure.texts.find((t) => t.role === "legend").text = "Every band is a part of Hypher, its type as big as its share of the code. The orange band is the handoff note.";
  const html = buildPage(spec, facts);
  const stroked = html.replace("[data-role] { z-index: 2 }", "[data-role] { z-index: 2; -webkit-text-stroke: 12px var(--paper); paint-order: stroke fill }");
  const covered = async (h) => runChecks("page", { spec, facts, presets: {}, page: await renderPage({ html: h, base: path.join(OUT, "halo"), png: false, pdf: false }) }).filter((f) => f.id === "text-clear");
  const [now, then] = [await covered(html), await covered(stroked)];
  result(stroked !== html && !now.length && /^\d+ px of the legend's letters are painted over near \d+,\d+;/.test(then[0]?.message ?? ""), "text-clear passes the halo and catches a stroke that covers the line above", `now ${JSON.stringify(now)}\nthen ${JSON.stringify(then)}`);
}

const emptyFacts = path.join(OUT, "empty-facts.json");
vyo("scan", path.join(HERE, "fixtures", "empty"), "--out", emptyFacts);
{
  const r = vyo("compose", emptyFacts, "--out", path.join(OUT, "empty-field.json"));
  result(r.status === 1 && /^✗ no parts to draw; the scan found no code\. Compose a fill poster instead: vyo compose .+ --from <preset>/m.test(r.stderr) && !fs.existsSync(path.join(OUT, "empty-field.json")), "compose refuses a field when the scan found no code", `exit ${r.status}\n${r.stderr}`);
}
{
  const spec = { ...preset("hourglass"), facts: JSON.parse(fs.readFileSync(emptyFacts, "utf8")).hash };
  const file = path.join(OUT, "empty.json");
  fs.writeFileSync(file, JSON.stringify(spec, null, 2));
  const r = vyo("check", file, "--facts", emptyFacts);
  result(r.status === 0 && /^! facts-empty: no application facts/m.test(r.stderr), "an app with no facts still renders, with a warning", `exit ${r.status}\n${r.stderr}`);
}

{
  const file = path.join(OUT, "no-browser.json");
  fs.writeFileSync(file, JSON.stringify(preset("wave"), null, 2));
  const r = spawnSync(process.execPath, [VYO, "render", file, "--facts", factsFile], { encoding: "utf8", env: { ...process.env, VYO_CHROMIUM: path.join(OUT, "no-such-chromium") } });
  result(r.status === 1 && r.stderr === `✗ ${BROWSER_NOTE}\n` && !fs.existsSync(path.join(OUT, "recipe-poster.png")), "render with no browser prints the browser note and exits 1", `exit ${r.status}\n${r.stderr}`);
}

{
  const spec = preset("terrain");
  spec.figure.regions[0].accent = "area:nowhere";
  const file = path.join(OUT, "render-fails.json");
  fs.writeFileSync(file, JSON.stringify(spec, null, 2));
  const r = vyo("render", file, "--facts", factsFile);
  const last = r.stderr.trimEnd().split("\n").at(-1);
  result(
    r.status === 1 && /^Wrote, with failures: /m.test(r.stdout) && /^POSTER NOT FINISHED: fix the 1 ✗ line above, then run vyo render again\./.test(last),
    "a render with a failing check exits 1 and ends on a line that says the poster is not finished",
    `exit ${r.status}\n${r.stdout}\n${r.stderr}`,
  );
}
{
  const spec = preset("wave");
  spec.figure.texts = spec.figure.texts.filter((t) => t.role !== "legend");
  const file = path.join(OUT, "render-spec-fails.json");
  fs.writeFileSync(file, JSON.stringify(spec, null, 2));
  const r = spawnSync(process.execPath, [VYO, "render", file, "--facts", factsFile], { encoding: "utf8", env: { ...process.env, VYO_CHROMIUM: path.join(OUT, "no-such-chromium") } });
  result(r.status === 1 && /^POSTER NOT FINISHED: fix the 1 ✗ line above/.test(r.stderr.trimEnd().split("\n").at(-1)), "a failing spec exits 1 with a nonexistent VYO_CHROMIUM and ends on the not-finished line", `exit ${r.status}\n${r.stderr}`);
}

console.log(failed ? `✗ ${failed} browser test(s) failed` : `browser: ${PRESETS.length} preset posters in ${OUT}, ${PLANTED.length + SHAPE_WARNINGS.length + RINGS_WARNINGS.length + RELIEF_WARNINGS.length} planted bugs caught`);

const pack = spawnSync(process.execPath, ["--test", path.join(HERE, "pack.test.mjs")], { stdio: "inherit" });

if (pure.status !== 0) console.log("✗ the pure tests failed (see above)");
if (pack.status !== 0) console.log("✗ the pack test failed (see above)");
process.exit(failed || pure.status !== 0 || pack.status !== 0 ? 1 : 0);

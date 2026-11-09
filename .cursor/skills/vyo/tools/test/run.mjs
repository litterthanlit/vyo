// npm test: the pure tests, then every preset rendered and checked, then the planted bugs, then the packed package installed and run.
// Posters land in test/.out/<preset>/ for a human to look at.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildPage, renderPage } from "../lib/render.mjs";
import { fieldItems } from "../lib/sketch.mjs";
import { BROWSER_NOTE } from "../lib/browser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.join(HERE, "..");
const OUT = path.join(HERE, ".out");
const VYO = path.join(TOOLS, "vyo.mjs");
const PRESETS = fs.readdirSync(path.join(TOOLS, "presets")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();

const pure = spawnSync(process.execPath, ["--test", ...["scan", "spec", "geometry", "parts", "fields", "band", "check", "sketch", "docs", "init", "recent", "png"].map((t) => path.join(HERE, `${t}.test.mjs`))], { stdio: "inherit" });

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
];

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
  const file = path.join(OUT, "no-motion.json");
  fs.writeFileSync(file, JSON.stringify(preset("signal-wave"), null, 2));
  const r = vyo("render", file, "--facts", factsFile, "--gif", "--no-png", "--no-pdf");
  result(r.status === 1 && /^✗ render --gif needs motion on the spec: \{ kind, frames, fps \}$/m.test(r.stderr), "render --gif without motion fails", `exit ${r.status}\n${r.stderr}`);
}

console.log(failed ? `✗ ${failed} browser test(s) failed` : `browser: ${PRESETS.length} preset posters in ${OUT}, ${PLANTED.length} planted bugs caught`);

const pack = spawnSync(process.execPath, ["--test", path.join(HERE, "pack.test.mjs")], { stdio: "inherit" });

if (pure.status !== 0) console.log("✗ the pure tests failed (see above)");
if (pack.status !== 0) console.log("✗ the pack test failed (see above)");
process.exit(failed || pure.status !== 0 || pack.status !== 0 ? 1 : 0);

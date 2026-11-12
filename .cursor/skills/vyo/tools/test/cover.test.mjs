// The cover frame: its solid, its turn, its strata, its grounds and ready silhouettes, its validation, its
// findings, its scaffold and its sketch. Everything here runs in Node with the module the page inlines.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateSpec } from "../lib/spec.mjs";
import { shapeMask } from "../lib/mask.mjs";
import { regionParts, aroundProduct } from "../lib/parts.mjs";
import { runChecks, CHECKS } from "../lib/check.mjs";
import { SILHOUETTES, SILHOUETTE_NAMES } from "../lib/silhouettes.mjs";
import { COVER, COVER_FRAMES, COVER_GROUNDS, COVER_STRATA, coverLegend, coverSolid, coverShape, coverPose, coverModel, coverCells, coverMeasure, coverStill, coverSteps, coverTemplate } from "../lib/cover.mjs";
import { coverOf } from "../lib/cover-render.mjs";
import { coverFindings, accentCandidates, coverWindow, COVER_LIMITS } from "../lib/cover-report.mjs";
import { OP_EXAMPLES } from "../vyo.mjs";
import { scanRepo } from "../lib/scan/index.mjs";
import { decodePng } from "../lib/png.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VYO = path.join(HERE, "..", "vyo.mjs");
const recipe = scanRepo(path.join(HERE, "fixtures", "recipe"));
const preset = () => ({ ...JSON.parse(fs.readFileSync(path.join(HERE, "..", "presets", "cover.json"), "utf8")), facts: recipe.hash });
/** The cover preset with its region changed by `over`, and the spec by `top`. */
const coverWith = (over = {}, top = {}) => {
  const s = preset();
  Object.assign(s.figure.regions[0], over);
  return Object.assign(s, top);
};
const cover = coverWith;
const region = (over = {}) => cover(over).figure.regions[0];
const modelOf = (spec) => coverOf(spec, recipe).model;

test("the cover preset and a ready silhouette validate; every cover rule is reported at once, in the house style", () => {
  assert.deepEqual(validateSpec(preset()), []);
  const f = "figure.regions[0]";
  const errors = validateSpec({
    ...cover({ shape: { like: "anchor" }, strata: "spiral", solid: { depth: 4, shine: 1 }, turn: { yaw: 80 }, style: "rings" }, { theme: "dark", accent: "#00FF00", ground: "#14281F" }),
    motion: { kind: "turn", frames: 24 },
  });
  for (const want of [
    `${f}.shape.like: "anchor" is not a ready silhouette; use one of ${SILHOUETTE_NAMES.join(", ")} (vyo shapes describes them), or draw your own as { ops: [...] }`,
    `${f}.strata: "spiral" is not a strata; use "outline", "down", "diagonal"`,
    `${f}.solid.depth: 0.2 to 1.5`,
    `${f}.solid.shine: unknown field; solid takes bevel, depth, tilt, groove`,
    `${f}.turn.yaw: 0 to 40`,
    `${f}.style: the cover draws its own living relief; remove style`,
    'theme: the cover takes a ground instead; remove theme and set ground to "navy", "charcoal", "forest", "paper"',
    "accent: the cover's accent is always its ground's orange; remove accent",
    'ground: "#14281F" is not a ground; a free colour is not offered; use "navy", "charcoal", "forest", "paper"',
    "motion.frames: a turn is a 7 second loop at 24 fps; remove frames",
  ]) assert.ok(errors.includes(want), `expected ${JSON.stringify(want)} in ${JSON.stringify(errors, null, 1)}`);
  const placed = cover();
  Object.assign(placed.figure.texts[0], { x: 40, y: 900 });
  placed.figure.regions[0].shape = { like: "pear", ops: [{ add: "circle", at: [0, 0], r: 1 }], fit: { h: 0.5 } };
  const more = validateSpec(placed);
  for (const want of ["figure.texts[0].x: the cover places every block itself; remove x", `${f}.shape: give like, ops or mask, not two of them; like is the whole silhouette`, `${f}.shape.fit: the cover sizes the form to its template; remove fit`]) assert.ok(more.includes(want), `expected ${want} in ${JSON.stringify(more, null, 1)}`);
  assert.ok(validateSpec({ ...cover(), ground: undefined }).includes('ground: missing; use "navy", "charcoal", "forest", "paper"'));
  assert.ok(validateSpec({ ...JSON.parse(fs.readFileSync(path.join(HERE, "..", "presets", "wave.json"), "utf8")), ground: "navy" }).includes("ground: only the cover frame takes ground; set frame to cover or remove ground"));
});

test("the cover's page script compiles: its modules declare no top-level name twice", async () => {
  const vm = await import("node:vm");
  const { COVER_PAGE_MODULES } = await import("../lib/cover-render.mjs");
  const lib = path.join(HERE, "..", "lib");
  const code = [...COVER_PAGE_MODULES.map((f) => fs.readFileSync(path.join(lib, f), "utf8").replace(/^import .*\n/gm, "").replace(/^export /gm, "")), fs.readFileSync(path.join(lib, "cover-page.js"), "utf8")].join("\n");
  assert.doesNotThrow(() => new vm.Script(`"use strict"; {\n${code}\n}`));
  for (const f of COVER_PAGE_MODULES) assert.doesNotMatch(fs.readFileSync(path.join(lib, f), "utf8"), /^import .*node:/m, `${f} runs in the page, so it imports nothing from Node`);
});

test("the grounds are a closed set: each an ink and the orange, dark ones with the relief's glow, paper with a highlighter", () => {
  assert.deepEqual(Object.keys(COVER_GROUNDS), ["navy", "charcoal", "forest", "paper"]);
  for (const [name, g] of Object.entries(COVER_GROUNDS)) {
    for (const k of ["ground", "ink", "accent"]) assert.match(g[k], /^#[0-9A-F]{6}$/, `${name}.${k}`);
    assert.match(g.accent, /^#FF[45]/, `${name}'s accent is the engine's orange`);
  }
  assert.equal(COVER_GROUNDS.paper.theme, "light");
  assert.ok(COVER_GROUNDS.paper.fill > 0 && !COVER_GROUNDS.paper.glow, "paper highlights its accent instead of glowing it");
  for (const g of ["navy", "charcoal", "forest"]) assert.ok(COVER_GROUNDS[g].glow && !COVER_GROUNDS[g].fill, `${g} glows`);
});

test("the solid: a dome over the outline, zero outside, a lit plate rising toward the lamp, a crease a groove", () => {
  const spec = coverShape({ ops: [{ add: "circle", at: [50, 50], r: 40 }] });
  const solid = coverSolid(spec, shapeMask(spec), { bevel: 1, depth: 1 }, COVER_STRATA.outline);
  const { w, h, inside, half, key } = solid;
  let [top, at] = [0, 0];
  for (let i = 0; i < half.length; i++) {
    if (!inside[i]) assert.equal(half[i], 0, "no thickness outside the outline");
    if (half[i] > top) [top, at] = [half[i], i];
  }
  const [cx, cy] = [at % w, Math.floor(at / w)];
  assert.ok(Math.abs(cx - w / 2) < w * 0.05 && Math.abs(cy - h / 2) < h * 0.05, "the dome peaks at the middle of a disc");
  assert.ok(key[Math.floor(h / 2) * w + Math.floor(w / 2)] > key[Math.floor(h / 2) * w + 4], "outline keys grow inward");
  const creased = coverShape({ ops: [{ add: "circle", at: [50, 50], r: 40 }, { crease: "capsule", from: [50, 50], to: [50, 15] }] });
  const groove = coverSolid(creased, shapeMask(creased), { bevel: 1, depth: 1, groove: 10 }, COVER_STRATA.down);
  const on = Math.floor(h / 2 - h * 0.2) * w + Math.round(cx);
  assert.ok(groove.half[on] < half[on] - 4, "a crease lowers the surface along its line");
  const plane = coverShape({ ops: SILHOUETTES.plane.ops });
  const faces = coverSolid(plane, shapeMask(plane), SILHOUETTES.plane.solid, COVER_STRATA.diagonal);
  assert.ok(faces.mid.some((v) => v < -1), "faces tilt off the middle surface about their fold");
});

test("the turn: periodic over the loop, never edge-on, the pitch a quarter turn behind the yaw", () => {
  const T = { ...COVER.turn };
  const point = [37.5, -12.25, 8];
  coverPose(T, 0)(...point).forEach((v, k) => assert.ok(Math.abs(v - coverPose(T, 1)(...point)[k]) < 1e-9, "the pose at the end of the loop is the pose at its start"));
  const m = modelOf(cover());
  assert.equal(coverCells(m, COVER_FRAMES), coverCells(m, 0), "frame N is frame 0");
  for (let f = 0; f < COVER_FRAMES; f++) {
    const [, , nz] = coverPose(T, f / COVER_FRAMES)(0, 0, 1);
    assert.ok(nz > Math.cos((40 * Math.PI) / 180), `frame ${f}: the face never turns more than 40 degrees from the viewer`);
  }
  const quarter = coverPose(T, 0.25)(0, 0, 1);
  assert.ok(Math.abs(quarter[0] - Math.sin((T.yaw * Math.PI) / 180)) < 1e-9, "a quarter in, the yaw is at its full swing");
});

test("the strata cut: an outline gives the accent the outer shell whatever its tree order, and every frame keeps each part's share", () => {
  const spec = cover();
  const m = modelOf(spec);
  assert.notEqual(m.hot, 0, "the accent is not the first part in tree order");
  assert.equal(m.order[0], m.hot, "an outline cuts the accent first");
  for (const f of [0, 40, 99, 130]) {
    const cells = coverCells(m, f);
    const keys = (pick) => cells.filter(pick).map((c) => m.S.key[c.j]);
    const hot = keys((c) => c.own === m.hot);
    const rest = keys((c) => c.own !== m.hot);
    assert.ok(Math.max(...hot) <= Math.min(...rest), `frame ${f}: the accent's cells are the outermost`);
    assert.ok(Math.abs(hot.length / cells.length - m.parts[m.hot].share) < 0.002, `frame ${f}: the shell is the accent's share of the cells`);
    assert.ok(coverMeasure(m, f).shareGap <= COVER.gap, `frame ${f}: every part prints its share within a point`);
  }
  const down = modelOf(cover({ strata: "down" }));
  assert.deepEqual(down.order, down.parts.map((_, i) => i), "other strata keep tree order");
});

test("the still: every big part's name whole, nearest the turn's middle, and the same frame measured in full", () => {
  const m = modelOf(cover());
  const still = coverStill(m);
  const all = Array.from({ length: COVER_FRAMES }, (_, f) => coverMeasure(m, f));
  const big = m.parts.map((p, i) => (p.share >= COVER.big ? i : -1)).filter((i) => i >= 0);
  const readable = (r) => big.filter((i) => r.whole[i] > 0).length;
  const band = (r) => Math.round(Math.abs(r.turned - COVER.still) * 10);
  const best = [...all].sort((a, b) => readable(b) - readable(a) || band(a) - band(b) || b.letters - a.letters)[0];
  assert.equal(still.frame, best.frame, "the band search finds the frame a full sort finds");
  assert.equal(readable(still), big.length);
  const steps = coverSteps(m);
  assert.ok(steps[COVER_FRAMES - 1] <= Math.max(...steps.slice(0, -1)) * COVER.seam, "the seam is no bigger than an inner step");
  assert.deepEqual(coverMeasure(modelOf(cover()), still.frame), coverMeasure(m, still.frame), "the same spec draws the same cells");
});

test("every ready silhouette validates, passes every shape check, and makes a visible outline at the share the owner liked", () => {
  for (const name of SILHOUETTE_NAMES) {
    const shape = { like: name };
    // Each object's legend names it, as the legend check asks.
    const cover = (over) => {
      const s = coverWith(over);
      s.figure.texts[0].text = coverLegend(s.figure.regions[0], "Pantry", "the screens");
      return s;
    };
    assert.deepEqual(validateSpec(cover({ shape })), [], name);
    const relief = { ...JSON.parse(fs.readFileSync(path.join(HERE, "..", "presets", "shape.json"), "utf8")), facts: recipe.hash };
    relief.figure.regions[0].shape = { like: name };
    // The silhouette's own checks; a relief poster's cover, accent and tone checks judge the jar preset's layout.
    const own = ["shape-simple", "shape-limb", "shape-thin", "shape-dominant"];
    assert.deepEqual(runChecks("spec", { spec: relief, facts: recipe, presets: {} }).filter((f) => own.includes(f.id)), [], `${name} as a relief poster`);
    assert.deepEqual(runChecks("spec", { spec: cover({ shape }), facts: recipe, presets: {} }).filter((f) => f.id !== "cover-shell"), [], `${name} as a cover`);
    const spec = cover({ shape });
    const c = coverOf(spec, recipe);
    assert.ok(c.shell.at(0.27) >= COVER_LIMITS.thin - 0.5, `${name}: 27% of the code makes a shell of ${Math.round(c.shell.at(0.27))}px`);
    assert.deepEqual(Object.values(coverFindings(c, { facts: recipe })).flat().filter((m) => !/orange shell/.test(m)), [], name);
    assert.ok(SILHOUETTES[name].about.length > 20 && SILHOUETTES[name].ops.length <= 8, `${name} says what it suits, in at most 8 ops`);
    const S = SILHOUETTES[name];
    assert.ok(S.noun && S.suits.length > 20 && S.words.length >= 5, `${name} has a noun for the legend, the products it suits, and README words`);
    const legend = coverLegend(cover({ shape }).figure.regions[0], "Supercalifragilistic", "x".repeat(24));
    assert.ok(legend.length <= 180, `${name}'s legend fits 180 characters at the longest names: ${legend.length}`);
  }
  assert.equal(SILHOUETTE_NAMES.length, 12);
});

test("vyo shapes' op examples are each a valid op of their kind", () => {
  for (const [kind, op] of Object.entries(OP_EXAMPLES)) {
    const s = cover({ shape: { ops: [op] } });
    assert.deepEqual(validateSpec(s), [], kind);
    assert.ok(shapeMask({ ops: [op] }).area > 0, `${kind} paints`);
  }
});

test("cover findings: each names one action, with the parts that would work", () => {
  const recipeParts = regionParts(region(), recipe);
  const id = (name) => recipeParts.find((p) => p.name === name).id;
  const thin = coverOf(cover({ accent: id("buttons") }), recipe);
  const [tooThin] = coverFindings(thin, { facts: recipe })["cover-shell"];
  assert.match(tooThin, /^the orange shell is \d+px thick \(4% of the code\); under 16px it reads as a hairline, not a shell, at thumbnail size, so put the accent on area:app\/\(app\) \("screens", 19%, a \d+px shell\)$/);
  const none = coverOf(cover({ accent: "area:nowhere" }), recipe);
  assert.match(coverFindings(none)["cover-accent"][0], /^the accent area:nowhere names no part, so nothing prints in orange; put the accent on one of area:app\/\(app\) \("screens", 19%\)/);
  const many = coverOf(cover({ accent: "area:components/*" }), recipe);
  assert.match(coverFindings(many)["cover-accent"][0], /^the accent area:components\/\* names 3 parts \(.*\); set it to the id of one of them/);
  const c = coverOf(cover(), recipe);
  const still = { ...c.still, whole: c.still.whole.map(() => 0), shares: c.still.shares.map((s, i) => (i === 0 ? s + 0.05 : s)), shareGap: 0.05 };
  const f = coverFindings(c, { still, loop: { reports: [still], steps: [10, 12, 400] } });
  assert.match(f["cover-names"][0], /^"saved recipes" \(8% of the code\) never prints its whole name in the still, frame \d+; at 13 characters it does not fit its stratum there, so shorten it to \d+ characters or fewer$/);
  assert.match(f["cover-share"][0], /^in frame \d+ "saved recipes" prints 13% of the glyphs for 8% of the lines, 5\.0 points off where at most 1\.0 is allowed; its plain name is too long for its stratum there, so shorten it from 13 characters to 7 or fewer$/);
  assert.equal(f["cover-seam"][0], "the step from the last frame back to the first changes 400 glyphs where the largest step inside the loop changes 12, so the GIF jumps at its seam; this is an engine fault, so render without --gif and report it");
  const vanish = coverFindings(c, { still: { ...c.still, accentCells: 0 } })["cover-accent"][0];
  assert.match(vanish, /^the accent "screens" prints no glyph in frame \d+; at 19% of the code it is too small to show in every pose, so /);
  // An accent over 40% fails in any strata: the orange would be most of the object.
  for (const strata of ["outline", "down"]) {
    const big = coverOf(cover({ strata }), recipe);
    const most = { ...big, model: { ...big.model, parts: big.model.parts.map((p) => (p.hot ? { ...p, share: 0.58 } : p)) } };
    const f58 = coverFindings(most, { facts: recipe });
    assert.match(f58["cover-accent"][0], /^the accent "screens" is 58% of the code, so the orange would be most of the object \(at most 40%\); /, strata);
    assert.deepEqual(f58["cover-shell"], [], `${strata}: a thick accent is cover-accent's to fail, not a shell warning`);
  }
  assert.equal(CHECKS.find((x) => x.id === "cover-accent").level, "fail");
  // A ring too thin keeps the accent: the fix is a band, with the legend to write.
  const saved = coverOf(cover({ accent: id("saved recipes") }), recipe);
  assert.match(coverFindings(saved, { facts: recipe })["cover-shell"][0], /so keep the accent and set "strata": "down", which draws it as an orange band, and change the legend to "This pear is the code of Pantry, one band per part, each as big as its share\. The orange band is saved recipes\."$/);
  // Code around the product is never offered as an accent, in rings or bands.
  for (const strata of ["outline", "down"]) {
    const offered = accentCandidates(coverOf(cover({ strata, accent: "area:nowhere" }), recipe), 20);
    assert.ok(offered.length && !offered.some((o) => o.startsWith("area:. ")), `${strata}: ${offered.join(", ")}`);
  }
});

test("a cover's legend names its object and what the orange is, and the finding gives the sentence to write", () => {
  const legendOf = (text, over = {}) => {
    const s = cover(over);
    s.figure.texts[0].text = text;
    return runChecks("spec", { spec: s, facts: recipe, presets: {} }).filter((f) => f.id === "legend").map((f) => f.message);
  };
  assert.deepEqual(legendOf("Every ring of the pear is a part of Pantry, as big as its share of the code. The orange ring is the screens."), [], "the earlier pattern still passes");
  assert.deepEqual(legendOf("Every ring of the plane is a part of Pantry, as big as its share of the code. The orange ring is the screens.", { shape: { like: "plane" } }), [], "the object by its last word");
  assert.deepEqual(legendOf("Every part of the pear is a part of Pantry, as big as its share of the code. The orange part is the screens."), [
    'must say what the picture is: the object, the parts cut by their share of the code, and what the orange is; write "This pear is the code of Pantry, one layer per part, each as big as its share. The orange outer ring is screens."',
  ]);
  assert.equal(legendOf("This pear is the code of Pantry, one layer per part, each as big as its share. The orange outer ring is screens.", { strata: "down" }).length, 1, "a ring on bands is wrong");
});

test("code around the product is named as such: samples, tests, docs, scripts and the root's setup", () => {
  for (const [id, word] of [["area:examples", "sample code"], ["area:examples/auth", "sample code"], ["area:test/unit", "tests"], ["area:docs/scripts", "docs"], ["area:scripts", "scripts"], ["area:.", "setup"]]) assert.equal(aroundProduct(id), word, id);
  for (const id of ["area:lib", "area:src/requests/sessions.py", "area:lib/adapters", "area:tools"]) assert.equal(aroundProduct(id), null, id);
});

test("every check a cover can hit is scoped: the poster-only checks never run on it, the cover's never on a poster", () => {
  const coverIds = CHECKS.filter((c) => c.id.startsWith("cover-")).map((c) => c.id);
  assert.deepEqual(coverIds.sort(), ["cover-accent", "cover-names", "cover-seam", "cover-share", "cover-shell"]);
  for (const c of CHECKS.filter((x) => x.id.startsWith("cover-"))) assert.deepEqual(c.frames, ["cover"], c.id);
  for (const id of ["fits", "field-parts", "notes", "blocks-apart", "blocks-inside"]) assert.ok(!CHECKS.find((c) => c.id === id).frames.includes("cover"), id);
  assert.deepEqual(runChecks("spec", { spec: preset(), facts: recipe, presets: {} }), [], "the cover preset passes every spec-stage check");
});

test("the template: the name one size until it would leave the sheet, the box between the top columns and the legend", () => {
  const short = coverTemplate({ name: "Flask", headline: "A short line.", legend: "One line." });
  const long = coverTemplate({ name: "Supercalifragilistic", headline: "A short line.", legend: "One line." });
  assert.equal(short.nameSize, COVER.name);
  assert.ok(long.nameSize < COVER.name && long.nameSize > 40, "a long name shrinks to fit the width");
  const tall = coverTemplate({ name: "Flask", headline: "word ".repeat(40).trim(), legend: "word ".repeat(34).trim() });
  assert.ok(tall.box.top > short.box.top && tall.box.bottom < short.box.bottom, "more lines of words leave the form less room, never overlap it");
});

test("compose --frame cover writes a scaffold whose only blanks are the words, the names and the accent, and the filled spec sketches clean", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vyo-cover-"));
  const factsFile = path.join(dir, "recipe-facts.json");
  fs.writeFileSync(factsFile, JSON.stringify(recipe));
  const out = path.join(dir, "recipe-poster.json");
  const r = spawnSync(process.execPath, [VYO, "compose", factsFile, "--frame", "cover", "--out", out], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const spec = JSON.parse(fs.readFileSync(out, "utf8"));
  const like = spec.figure.regions[0].shape.like;
  assert.ok(SILHOUETTES[like], "compose picks a ready object");
  // The window, printed once, is the one the sketch's shell check holds the object to.
  const probe = cover({ shape: { like }, strata: "outline" });
  probe.figure.texts[0].text = coverLegend(probe.figure.regions[0], "recipe", "a plain name");
  const win = coverWindow(coverOf(probe, recipe));
  const strata = spec.figure.regions[0].strata;
  const [lo, hi] = strata === "outline" ? win.ring : win.band;
  assert.equal(r.stdout.match(/\d+% to \d+% of the code/g).length, 1, r.stdout);
  assert.match(r.stdout, new RegExp(`^parts \\(id, share of the code, scanned name\\)\\. \\* marks a part that makes a good orange (outer ring on|band across) the ${SILHOUETTES[like].noun}: ${Math.round(lo * 100)}% to ${Math.round(hi * 100)}% of the code\\.`, "m"));
  const parts = regionParts(spec.figure.regions[0], recipe);
  const total = parts.reduce((s, p) => s + p.loc, 0);
  const ringable = !!win.ring && parts.some((p) => !aroundProduct(p.id) && p.loc / total >= win.ring[0] && p.loc / total <= win.ring[1]);
  assert.equal(strata, ringable ? "outline" : "down", "an outline when a part the product could be about makes a ring on this object, else bands");
  assert.match(r.stdout, /^  - area:\.\s+8%\s+Recipe  setup, never the accent$/m, "the root's files are marked as setup");
  assert.doesNotMatch(r.stdout, /^  \* area:\.\s/m);
  const blanks = [];
  const walk = (v, at) => (typeof v === "string" ? v.startsWith("…") && blanks.push(at) : v && typeof v === "object" && Object.entries(v).forEach(([k, x]) => walk(x, `${at}.${k}`)));
  walk(spec, "spec");
  assert.deepEqual(blanks.filter((b) => !/\.names\./.test(b)), ["spec.product.name", "spec.headline", "spec.figure.regions.0.accent", "spec.figure.texts.0.text"]);
  assert.equal(blanks.filter((b) => /\.names\./.test(b)).length, regionParts(spec.figure.regions[0], recipe).length, "every part is named");
  assert.equal(spec.figure.texts[0].text, `… ${coverLegend(spec.figure.regions[0], "<product>", "<the accent's plain name>")}`, "the legend's pattern names this object and this strata");
  assert.match(spec.figure.texts[0].text, new RegExp(`^… This ${SILHOUETTES[like].noun} is the code of <product>, one (layer|band) per part`));
  assert.equal(spec.ground, "navy");
  assert.deepEqual(spec.motion, { kind: "turn" });
  // The folder's log keeps two covers off the same object, and composing the same spec again keeps its object.
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "recent-shapes.json"), "utf8")).shapes, [like]);
  const second = path.join(dir, "other-poster.json");
  assert.equal(spawnSync(process.execPath, [VYO, "compose", factsFile, "--frame", "cover", "--out", second], { encoding: "utf8" }).status, 0);
  assert.notEqual(JSON.parse(fs.readFileSync(second, "utf8")).figure.regions[0].shape.like, like, "a second cover in the folder takes another object");
  assert.equal(spawnSync(process.execPath, [VYO, "compose", factsFile, "--frame", "cover", "--out", out, "--force"], { encoding: "utf8" }).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(out, "utf8")).figure.regions[0].shape.like, like, "composing again keeps the object");
  const filled = preset();
  filled.product = { ...spec.product, name: "Pantry", commit: "04186f4" };
  fs.writeFileSync(out, JSON.stringify(filled));
  const s = spawnSync(process.execPath, [VYO, "sketch", out], { encoding: "utf8" });
  assert.equal(s.status, 0, s.stdout + s.stderr);
  assert.doesNotMatch(s.stdout, /^(✗|!) /m, s.stdout);
  assert.match(s.stdout, /^shell: the orange shell is \d+px thick, 18\.5% of the code/m);
  const png = decodePng(fs.readFileSync(path.join(dir, "recipe-sketch.png")));
  assert.equal(png.width, 280, "the sketch PNG is the still at a third of its size");
  const blank = { ...filled, headline: "… one plain sentence" };
  blank.figure.regions[0].shape = "… a shape";
  fs.writeFileSync(out, JSON.stringify(blank));
  const b = spawnSync(process.execPath, [VYO, "sketch", out], { encoding: "utf8" });
  assert.equal(b.status, 1);
  assert.match(b.stdout, /^✗ spec: headline: still the placeholder; write it$/m);
  assert.match(b.stdout, /^✗ spec: figure\.regions\[0\]\.shape: still the placeholder; .*\{ "like": "<name>" \}/m);
});

test("a cover spec that lost its commit or date gets the exact values to restore from sketch", () => {
  const repo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vyo-commit-")), "recipe");
  fs.mkdirSync(repo);
  const run = (...a) => spawnSync("git", ["-C", repo, ...a], { encoding: "utf8" });
  run("init", "-q");
  fs.writeFileSync(path.join(repo, "a.txt"), "a\n");
  run("add", ".");
  run("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "a");
  const [hash, date] = run("log", "-1", "--format=%h %cs").stdout.trim().split(" ");
  fs.mkdirSync(path.join(repo, "vyo"));
  fs.writeFileSync(path.join(repo, "vyo", "recipe-facts.json"), JSON.stringify(recipe));
  const out = path.join(repo, "vyo", "recipe-poster.json");
  const lost = preset();
  lost.product = { name: "Pantry", repo: "recipe", date: "2026-01-01" };
  fs.writeFileSync(out, JSON.stringify(lost));
  const s = spawnSync(process.execPath, [VYO, "sketch", out], { encoding: "utf8" });
  assert.match(s.stdout, new RegExp(`^✗ record: product has no commit, which compose wrote; set "commit": "${hash}" and "date": "${date}" in product`, "m"), s.stdout);
});

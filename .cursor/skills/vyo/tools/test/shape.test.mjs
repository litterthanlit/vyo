// The shape field: its validation, its mask and fit, its bands, its feedback in sketch and the checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { validateSpec } from "../lib/spec.mjs";
import { shapeMask, maskGrid, runsPath } from "../lib/mask.mjs";
import { shapeBands, bandsStyle, nameWidth, BANDS } from "../lib/fields/shape.mjs";
import { shapeReport, shapeFindings, thinFeatures } from "../lib/shape-report.mjs";
import { sketch, sketchImage } from "../lib/sketch.mjs";
import { regionParts } from "../lib/parts.mjs";
import { scanRepo } from "../lib/scan/index.mjs";
import { fixedMeasure, SHEET } from "../lib/geometry.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const recipe = scanRepo(path.join(HERE, "fixtures", "recipe"));
const jar = () => ({ ...JSON.parse(fs.readFileSync(path.join(HERE, "..", "presets", "shape.json"), "utf8")), facts: recipe.hash });
const withShape = (shape, over = {}) => {
  const s = jar();
  Object.assign(s.figure.regions[0], { shape }, over);
  return s;
};
const rect = (at, size, extra = {}) => ({ add: "rect", at, size, ...extra });
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} is not within ${tol} of ${b}`);
const W = SHEET.width;
const H = SHEET.height;

test("the jar preset is a valid spec, and every kind of op validates", () => {
  assert.deepEqual(validateSpec(jar()), []);
  const ops = [
    { add: "circle", at: [0, 0], r: 10 },
    { add: "ellipse", at: [30, 0], r: [12, 6], rotate: 20 },
    rect([0, 20], [40, 10], { round: 3 }),
    { add: "capsule", from: [0, 40], to: [40, 50], r: 4 },
    { add: "arc", at: [20, 70], r: 12, from: 270, to: 90, width: 5 },
    { add: "polygon", points: [[0, 90], [40, 90], [20, 110]], round: 2 },
    { add: "path", d: "M 0 120 L 40 120 Q 20 140 0 120 Z" },
    { cut: "circle", at: [20, 25], r: 2 },
  ];
  assert.deepEqual(validateSpec(withShape({ ops, rotate: 5, fit: { w: 0.6, h: 0.7, cx: 0.5, cy: 0.6 } })), []);
});

test("every shape error is reported at once, by op index, in the house style", () => {
  const errors = validateSpec(
    withShape({
      ops: [
        { cut: "circle", at: [0, 0], r: 5 },
        { add: "square", at: [0, 0] },
        { add: "rect", cut: "rect", at: [0, 0], size: [1, 1] },
        rect([0, 0], [0, 4]),
        { add: "circle", at: [0, 0] },
        { add: "circle", at: [0, 0], r: 3, radius: 3 },
        { add: "polygon", points: [[0, 0], [1, 1]] },
        { add: "path", d: "M 0 0 X 3" },
        { add: "arc", at: [0, 0], r: 4, from: "noon", to: 90, width: 1 },
        { add: "circle", at: [0, 0], r: 3, rotate: "a bit" },
      ],
      fit: { h: 5, cx: 9 },
      spin: 3,
    }),
  );
  const f = "figure.regions[0].shape";
  for (const want of [
    `${f}.spin: unknown field`,
    `${f}.fit.h: 0.05 to 3, a share of the sheet's height (over 1 bleeds off)`,
    `${f}.fit.cx: -0.5 to 1.5, where the centre sits as a share of the sheet's width`,
    `${f}.ops[1].add: "square" is not a kind; use circle, ellipse, rect, capsule, arc, polygon, path`,
    `${f}.ops[2]: give exactly one of add, cut or crease (found add, cut)`,
    `${f}.ops[3].size: must be two numbers above 0`,
    `${f}.ops[4].r: missing; it must be a number above 0`,
    `${f}.ops[5].radius: a circle takes at, r, rotate and face`,
    `${f}.ops[6].points: must be 3 to 40 points of [x, y]`,
    `${f}.ops[7].d: does not parse: cannot read "X 3"`,
    `${f}.ops[8].from: must be a number of degrees, clockwise from twelve o'clock`,
    `${f}.ops[9].rotate: a number of degrees, clockwise about the op's centre`,
    `${f}.ops[0]: must be an add; a cut on an empty sheet removes nothing`,
  ]) assert.ok(errors.includes(want), `expected ${JSON.stringify(want)} in ${JSON.stringify(errors, null, 1)}`);
});

test("a shape that paints nothing, a placeholder, a missing shape, a swiss shape and a stray style are refused", () => {
  const f = "figure.regions[0]";
  assert.deepEqual(validateSpec(withShape({ ops: [rect([0, 0], [10, 10]), { cut: "rect", at: [-1, -1], size: [12, 12] }] })), [`${f}.shape: the ops paint nothing on the sheet; the cuts remove all of it, or fit.cx and fit.cy move it off`]);
  assert.match(validateSpec(withShape("… the silhouette"))[0], /^figure\.regions\[0\]\.shape: still the placeholder; draw the silhouette as \{ ops: \[\.\.\.\] \}/);
  assert.match(validateSpec(withShape(undefined)).join("\n"), /^figure\.regions\[0\]\.shape: missing; draw the silhouette/m);
  assert.ok(validateSpec(withShape(jar().figure.regions[0].shape, { style: "spiral" })).some((e) => /^figure\.regions\[0\]\.style: "spiral" is not a style; use bands or rings\b.*, or leave it out$/.test(e)));
  const swiss = { ...jar(), frame: "swiss" };
  assert.ok(validateSpec(swiss).includes(`${f}.field: a shape field draws only in the loose frame; remove frame or set it to loose`));
  const wave = JSON.parse(fs.readFileSync(path.join(HERE, "..", "presets", "wave.json"), "utf8"));
  wave.figure.regions[0].shape = { ops: [rect([0, 0], [1, 1])] };
  assert.ok(validateSpec(wave).includes(`${f}.shape: a wave field has no shape; only shape takes it`));
});

test("the mask fits the painted extent: fit.w, fit.h, the default, the centre and bleed", () => {
  const box = (m) => m.box;
  const wide = shapeMask({ ops: [rect([5, 5], [200, 100])], fit: { w: 0.5 } });
  near(box(wide).right - box(wide).left, 420, 1, "fit.w 0.5 is 420px wide");
  near(box(wide).bottom - box(wide).top, 210, 1, "and keeps its proportions");
  near((box(wide).left + box(wide).right) / 2, W / 2, 1, "centred across by default");
  near((box(wide).top + box(wide).bottom) / 2, 0.61 * H, 1, "a little low by default");
  near(wide.area, 420 * 210, 420 * 2, "every covered px counted");
  const both = shapeMask({ ops: [rect([0, 0], [10, 10])], fit: { w: 0.5, h: 0.2 } });
  near(both.box.bottom - both.box.top, 0.2 * H, 1, "with both, the smaller scale wins");
  const tall = shapeMask({ ops: [rect([0, 0], [10, 40])] });
  near(tall.fit.h, 0.74, 0.01, "with no fit, the default height");
  const bleed = shapeMask({ ops: [rect([0, 0], [10, 10])], fit: { w: 1.4, cx: 0.5, cy: 0.5 } });
  assert.ok(bleed.box.left < 0 && bleed.box.right > W, "over 1 runs off the sheet");
  assert.ok(bleed.runs.every((row) => row.every(([l, r]) => l >= 0 && r <= W)), "runs are clipped to the sheet");
  const cutExtent = shapeMask({ ops: [rect([0, 0], [100, 100]), { cut: "rect", at: [0, 50], size: [100, 60] }], fit: { h: 0.5 } });
  near(cutExtent.box.bottom - cutExtent.box.top, 0.5 * H, 1, "the fit measures what survives the cuts");
});

test("each kind paints its area, cuts subtract, rotate turns about the op's centre and the shape's", () => {
  const areaOf = (ops, extra = {}) => shapeMask({ ops: [rect([0, 0], [100, 100]), { cut: "rect", at: [0, 0], size: [100, 100] }, ...ops], fit: { w: 0.8 }, ...extra });
  const unit = (m) => (m.box.right - m.box.left) / 100;
  const circle = shapeMask({ ops: [{ add: "circle", at: [50, 50], r: 50 }], fit: { w: 0.8 } });
  near(circle.area, Math.PI * (0.4 * W) ** 2, 0.01 * circle.area, "a circle is pi r squared");
  const ring = shapeMask({ ops: [{ add: "arc", at: [50, 50], r: 40, from: 0, to: 360, width: 20 }], fit: { w: 0.8 } });
  const u = unit(ring);
  near(ring.area, Math.PI * ((50 * u) ** 2 - (30 * u) ** 2), 0.02 * ring.area, "a full arc is a ring");
  const half = shapeMask({ ops: [{ add: "arc", at: [50, 50], r: 40, from: 0, to: 180, width: 20 }], fit: { h: 0.8 } });
  assert.ok(half.box.right - half.box.left < half.box.bottom - half.box.top, "an arc from twelve to six o'clock is the right half");
  const holed = shapeMask({ ops: [rect([0, 0], [100, 100]), { cut: "circle", at: [50, 50], r: 25 }], fit: { w: 0.8 } });
  near(holed.area, (0.8 * W) ** 2 * (1 - Math.PI / 16), 0.01 * holed.area, "a cut takes its area out");
  const flat = shapeMask({ ops: [rect([0, 0], [100, 20])], fit: { w: 0.5 } });
  const upright = shapeMask({ ops: [rect([0, 0], [100, 20], { rotate: 90 })], fit: { h: 0.5 } });
  near(upright.box.right - upright.box.left, 0.2 * 0.5 * H, 2, "an op's rotate turns it about its centre");
  const turned = shapeMask({ ops: [rect([0, 0], [100, 20])], rotate: 90, fit: { h: 0.5 } });
  assert.deepEqual(turned.runs.map((r) => r.length), upright.runs.map((r) => r.length), "the shape's rotate turns the whole");
  assert.ok(flat.box.right - flat.box.left > flat.box.bottom - flat.box.top);
  const rounded = shapeMask({ ops: [rect([0, 0], [100, 100], { round: 50 })], fit: { w: 0.5 } });
  near(rounded.area, Math.PI * (0.25 * W) ** 2, 0.01 * rounded.area, "a fully rounded square is a circle");
  const path = shapeMask({ ops: [{ add: "path", d: "M0 0 H100 V100 H0 Z" }, { add: "capsule", from: [0, 150], to: [100, 150], r: 10 }], fit: { w: 0.5 } });
  assert.ok(path.area > 340 * 340, "a path and a capsule both paint");
  assert.equal(areaOf([]), null, "an add then a whole cut paints nothing");
});

test("the mask is a grid for pixel work and a smooth SVG path for the page", () => {
  const m = shapeMask({ ops: [rect([0, 0], [100, 100])], fit: { w: 0.5, cx: 0.5, cy: 0.5 } });
  const g = maskGrid(m, 20);
  assert.equal(g.w, 42);
  assert.equal(g.bits.reduce((a, b) => a + b, 0), 21 * 21);
  const d = runsPath([[0, [[10, 20]]], [1, [[11, 21]]]]);
  assert.equal(d, "M10 0H20V0.5H10ZM10 0.5H20L21 1.5H11ZM11 1.5H21V2H11Z", "neighbouring rows join centre to centre, half rows close the ends");
});

test("bands: one per part in tree order, areas within 15% of line shares, type by weight", () => {
  const spec = jar();
  const parts = regionParts(spec.figure.regions[0], recipe);
  const mask = shapeMask(spec.figure.regions[0].shape);
  const bands = shapeBands(mask, parts);
  assert.deepEqual(bands.map((b) => b.part.id), parts.map((p) => p.id));
  const total = parts.reduce((s, p) => s + p.loc, 0);
  for (const b of bands) {
    const area = mask.runs.slice(b.y0, b.y1).reduce((s, row) => s + row.reduce((a, [l, r]) => a + r - l, 0), 0);
    const share = b.part.loc / total;
    if (b.y1 - b.y0 > BANDS.minBand) near(area / mask.area, share, 0.15 * share + 0.004, `${b.part.name}'s area`);
    assert.ok(b.y1 - b.y0 >= BANDS.minBand, `${b.part.name} is at least ${BANDS.minBand}px tall`);
  }
  for (const [a, b] of bands.slice(1).map((b, i) => [bands[i], b])) assert.equal(a.y1, b.y0, "bands touch, top to bottom");
  const { bands: drawn } = bandsStyle(mask, parts, { measure: fixedMeasure });
  const big = drawn.reduce((a, b) => (b.part.loc > a.part.loc ? b : a));
  for (const b of drawn) {
    assert.ok(b.size >= BANDS.min, `${b.part.name} at ${b.size}px is at least 5px`);
    if (b.part.loc < big.part.loc / 4) assert.ok(b.size < big.size / 2, `${b.part.name}, a small part, is set much smaller than ${big.part.name}`);
  }
});

test("every line sits where the mask covers its whole glyph height, and every part shows its whole name", () => {
  const spec = jar();
  const parts = regionParts(spec.figure.regions[0], recipe);
  const mask = shapeMask(spec.figure.regions[0].shape);
  const { rows } = bandsStyle(mask, parts, { measure: fixedMeasure });
  for (const r of rows) {
    for (let y = Math.ceil(r.y + 0.04 * r.size); y < Math.floor(r.y + Math.min(0.99 * r.size, r.height)); y++) {
      assert.ok(mask.runs[y].some(([l, rr]) => l <= r.x + 0.01 && rr >= r.x + r.width - 0.01), `"${r.text.slice(0, 12)}" at ${Math.round(r.x)},${Math.round(r.y)} is inside the mask on row ${y}`);
    }
  }
  for (const p of parts) assert.ok(rows.some((r) => r.part === p.id && r.text.includes(p.name.toLowerCase())), `${p.name} is drawn whole`);
  const lid = rows.filter((r) => r.part === "area:.");
  assert.ok(lid.every((r) => r.width > 200), `under the slanted lid no line is a sliver (${lid.map((r) => Math.round(r.width))})`);
  assert.equal(nameWidth("abc", 10), 3 * 0.62 * 10 - 0.2, "a name's width counts its tracking between letters");
});

test("the light theme alternates fills over a cast shadow; the dark theme fills in ink", () => {
  const spec = jar();
  const parts = regionParts(spec.figure.regions[0], recipe);
  const mask = shapeMask(spec.figure.regions[0].shape);
  const light = bandsStyle(mask, parts, { measure: fixedMeasure, theme: "light" }).ground;
  assert.equal(light[0].part, null, "the shadow comes first");
  assert.equal(light[0].tone, "cold");
  assert.equal(light[1].tone, "paper", "then the gaps between bands, in paper");
  assert.deepEqual(light.slice(2, 5).map((g) => g.tone), ["ink", "cool", "ink"]);
  assert.equal(light.find((g) => g.hot).tone, "hot");
  const dark = bandsStyle(mask, parts, { measure: fixedMeasure, theme: "dark" }).ground;
  assert.ok(dark.every((g) => g.part && (g.hot ? g.tone === "hot" : g.tone === "ink")));
});

test("findings: the jar has none, and each planted shape trips its own, with a number and an instruction", () => {
  const findings = (spec, blocks = []) => shapeFindings(shapeReport(spec, spec.figure.regions[0], recipe), { blocks });
  const nothing = (f) => Object.values(f).flat();
  assert.deepEqual(nothing(findings(jar())), []);
  const base = jar().figure.regions[0].shape;

  const hairline = findings(withShape({ ...base, ops: [...base.ops, { add: "capsule", from: [96, 60], to: [130, 40], r: 0.6 }] }));
  assert.match(hairline["shape-thin"][0], /^the shape is \d+px thick near \d+,\d+; under 18px it is a hairline at thumbnail size, so make that feature at least 18px thick or remove it$/);
  const slit = findings(withShape({ ...base, ops: [...base.ops, { cut: "rect", at: [0, 70], size: [100, 0.8] }] }));
  assert.match(slit["shape-thin"][0], /^a cut in the shape is \d+px wide near \d+,\d+; under 18px it closes up at thumbnail size, so widen the cut to at least 18px or remove it$/);
  assert.match(slit["shape-split"][0], /^the band of "[a-z ]+" \(y \d+ to \d+\) falls on 2 separate pieces of the shape, at x \d+ to \d+ and x \d+ to \d+; join them there, or move one piece up or down by \d+px so they do not share those rows$/);

  const tiny = findings(withShape({ ...base, fit: { h: 0.3 } }));
  assert.match(tiny["shape-cover"][0], /^the shape covers 7% of the sheet; it needs 35% to read as the picture, so scale it up 2\.\d+x \(set fit\.h to 0\.6\d, it is 0\.3\) or draw it fatter$/);
  assert.match(tiny["shape-accent"][0], /^the accent band "the plan" is \d\dpx tall \(y \d+ to \d+\); it needs 40px to show in the thumbnail, so scale the shape up 1\.\d+x, narrow it where the band falls, or put the accent on a bigger part$/);

  const stem = findings(withShape({ ops: [rect([0, 0], [6, 120]), rect([-40, 120], [84, 60], { round: 10 })], fit: { h: 0.8 } }));
  assert.match(stem["shape-name"][0], /^part "saved recipes" never shows its whole name: its band \(y \d+ to \d+\) holds \d+px of 5\.0px type and the name needs \d+px; widen the shape there to at least \d+px or give the part a shorter name$/);

  const room = findings(jar(), [{ id: "legend", left: 400, top: 600, right: 660, bottom: 680 }]);
  assert.match(room["shape-room"][0], /^the legend \(260 by 80 at 400,600\) sits on the shape or within 16px of it; move it into the top-(left|right) corner, \d+ by \d+ at \d+,0$/);
  const crowded = findings(withShape({ ...base, fit: { w: 1, h: 1, cy: 0.5 } }), [{ id: "legend", left: 40, top: 40, right: 300, bottom: 120 }]);
  assert.match(crowded["shape-room"][0], /; no corner holds it \(the largest, [a-z-]+, is \d+ by \d+\), so shrink the shape \(fit\.h 0\.\d+ to 0\.\d+\) or move it with fit\.cx and fit\.cy$/);
});

test("a sharp tip is not a thin feature, a bleed is not thin, and a 10px bar is", () => {
  assert.deepEqual(thinFeatures(shapeMask({ ops: [{ add: "polygon", points: [[0, 0], [100, 50], [0, 100]] }], fit: { w: 0.7 } })), []);
  assert.deepEqual(thinFeatures(shapeMask({ ops: [rect([0, 0], [100, 100])], fit: { w: 1.5 } })), []);
  const bar = thinFeatures(shapeMask({ ops: [rect([0, 0], [100, 100]), rect([100, 45], [60, 2])], fit: { w: 0.8 } }));
  assert.equal(bar.length, 1);
  assert.equal(bar[0].kind, "part");
  near(bar[0].width, 0.8 * W * (2 / 160), 3, "its width is measured");
});

test("sketch of the jar: the mask at 20px with the accent band, each band's numbers, the corners, no warnings", () => {
  const out = sketch(jar(), recipe);
  const grid = out.split("\n\nregions:")[0].split("\n");
  assert.ok(grid.every((l) => l.length <= 42));
  assert.match(out, /A{20}/);
  assert.match(out, /@{20}/, "the accent band");
  assert.match(out, /^regions: A shape \(shape, 12 bands; @ marks the accent band\); · marks hot rows$/m);
  assert.match(out, /^shape: covers 6\d% of the sheet \(needs 35%\), \d+ by \d+px \(fit\.w 0\.9\d, fit\.h 0\.9\), bleeds bottom$/m);
  assert.match(out, /^ {4}screens {18}y \d+ to \d+, \d+px tall, 1 line of \d+\.\dpx type$/m);
  assert.match(out, /^ {2}\* the plan {17}y \d+ to \d+, \d+px tall, 2 lines of \d+\.\dpx type$/m);
  assert.match(out, /^corners: top-left at 0,0 is 420 by \d+;/m);
  assert.doesNotMatch(out, /^! /m);
  const tiny = sketch(withShape({ ...jar().figure.regions[0].shape, fit: { h: 0.3 } }), recipe);
  assert.match(tiny, /^! the shape covers 7% of the sheet; it needs 35%/m);
});

test("the sketch PNG is a 280px picture of the silhouette with its accent band, encoded without a browser", () => {
  const png = sketchImage(jar(), recipe);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 280);
  assert.equal(png.readUInt32BE(20), 397);
  const idat = png.subarray(png.indexOf("IDAT") + 4, png.indexOf("IEND") - 8);
  const raw = zlib.inflateSync(idat);
  const pixels = new Set();
  for (let y = 0; y < 397; y++) for (let x = 0; x < 280; x++) pixels.add(raw.subarray(y * 841 + 1 + x * 3, y * 841 + 4 + x * 3).toString("hex"));
  for (const hex of ["eae8e2", "161616", "5f7389", "ff4f12"]) assert.ok(pixels.has(hex), `the paper, both fills and the accent appear (${hex})`);
  assert.equal(sketchImage(JSON.parse(fs.readFileSync(path.join(HERE, "..", "presets", "wave.json"), "utf8")), recipe), null, "no PNG without a drawn shape");
});

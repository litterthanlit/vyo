// The relief style of the shape field: its hints' validation, its strata and whole words, its light, its
// findings, and its sketch.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { validateSpec } from "../lib/spec.mjs";
import { shapeMask } from "../lib/mask.mjs";
import { shapeReport, shapeFindings } from "../lib/shape-report.mjs";
import { reliefTone, RELIEF } from "../lib/fields/shape-relief.mjs";
import { sketch, sketchImage } from "../lib/sketch.mjs";
import { scanRepo } from "../lib/scan/index.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const recipe = scanRepo(path.join(HERE, "fixtures", "recipe"));
const preset = () => ({ ...JSON.parse(fs.readFileSync(path.join(HERE, "..", "presets", "shape-relief.json"), "utf8")), facts: recipe.hash });
/** The relief preset with its region changed by `over` (a shape replaces the preset's). */
const relief = (over = {}, theme = "dark") => {
  const s = preset();
  s.theme = theme;
  Object.assign(s.figure.regions[0], over);
  return s;
};
const report = (spec) => shapeReport(spec, spec.figure.regions[0], recipe);
const findings = (spec, rows) => shapeFindings(report(spec), rows ? { rows } : {});
const plainJar = { fit: { h: 0.74, cx: 0.5, cy: 0.6 }, ops: [{ add: "rect", at: [12, 0], size: [76, 16], round: 4 }, { add: "rect", at: [20, 15], size: [60, 10] }, { add: "rect", at: [0, 24], size: [100, 112], round: 26 }] };
const noHints = () => {
  const s = relief({ shape: plainJar });
  delete s.figure.regions[0].bevel;
  delete s.figure.regions[0].strata;
  return s;
};

test("the relief preset is valid, and face, crease, bevel and strata validate", () => {
  assert.deepEqual(validateSpec(preset()), []);
  const ops = [
    { add: "polygon", points: [[0, 0], [100, 0], [50, 80]], face: "lit" },
    { add: "rect", at: [0, 0], size: [40, 40], face: "dim" },
    { add: "circle", at: [80, 80], r: 20, face: "round" },
    { crease: "capsule", from: [10, 10], to: [90, 10] },
    { crease: "arc", at: [50, 50], r: 20, from: 0, to: 180 },
    { crease: "rect", at: [20, 20], size: [30, 30] },
  ];
  assert.deepEqual(validateSpec(relief({ shape: { ops }, bevel: 0.4, strata: { by: "depth" } })), []);
  assert.deepEqual(validateSpec(relief({ strata: { by: "angle", angle: 135 } })), []);
});

test("bad hints are each reported, in the house style", () => {
  const f = "figure.regions[0]";
  const errors = validateSpec(
    relief({
      bevel: 2,
      strata: { by: "spiral" },
      shape: { ops: [{ crease: "capsule", from: [0, 0], to: [1, 1] }, { add: "rect", at: [0, 0], size: [9, 9], face: "shiny" }, { cut: "rect", at: [0, 0], size: [2, 2], face: "lit" }, { add: "rect", crease: "rect", at: [0, 0], size: [1, 1] }] },
    }),
  );
  for (const want of [
    `${f}.bevel: 0 to 1, the share of the shape's depth that is rounded (1 a full dome, 0.2 a flat top with soft edges)`,
    `${f}.strata: { "by": "angle", "angle": degrees } (90 stacks the parts top to bottom, 0 left to right) or { "by": "depth" } (shells from the outline in)`,
    `${f}.shape.ops[0]: must be an add; a crease folds a surface the adds have drawn`,
    `${f}.shape.ops[1].face: one of lit, dim, round: a flat facet turned toward the light, away from it, or rounded (the default); only the relief style draws it`,
    `${f}.shape.ops[2].face: a rect takes at, size, round and rotate`,
    `${f}.shape.ops[3]: give exactly one of add, cut or crease (found add, crease)`,
  ]) assert.ok(errors.includes(want), `expected ${JSON.stringify(want)} in ${JSON.stringify(errors, null, 1)}`);
});

test("a crease never changes the silhouette, and the bands style ignores every hint", () => {
  const plain = shapeMask(plainJar);
  const creased = shapeMask({ ...plainJar, ops: [...plainJar.ops, { crease: "rect", at: [12, 58], size: [76, 42] }, { crease: "capsule", from: [16, 6], to: [84, 6] }] });
  assert.deepEqual(creased.runs, plain.runs);
  const bands = (over) => {
    const s = relief(over);
    s.figure.regions[0].style = "bands";
    return report(s).rows.map((r) => [r.text, Math.round(r.x), Math.round(r.y)]);
  };
  const faced = { ...plainJar, ops: plainJar.ops.map((o) => ({ ...o, face: "dim" })) };
  assert.deepEqual(bands({ shape: faced, bevel: 0.1, strata: { by: "depth" } }), bands({ shape: plainJar }));
});

test("strata hold each part's share of the area, and the glyphs follow it", () => {
  for (const strata of [{ by: "angle", angle: 90 }, { by: "angle", angle: 135 }, { by: "depth" }]) {
    const r = report(relief({ strata }));
    const glyphs = r.strata.reduce((s, x) => s + x.glyphs, 0);
    for (const s of r.strata) {
      assert.ok(Math.abs(s.area - s.lines) < 0.002, `${strata.by} ${strata.angle ?? ""}: ${s.part.name} has ${s.area} of the area for ${s.lines} of the lines`);
      const share = s.glyphs / glyphs;
      assert.ok(Math.abs(share - s.lines) <= Math.max(0.006, s.lines * RELIEF.share.part), `${s.part.name}: ${share} of the glyphs for ${s.lines} of the lines`);
    }
    assert.deepEqual(Object.values(findings(relief({ strata }))).flat(), [], `${strata.by} ${strata.angle ?? ""} has no findings`);
  }
});

test("every word is whole: a row holds only its part's whole name and tone marks", () => {
  for (const strata of [{ by: "angle", angle: 90 }, { by: "angle", angle: 135 }, { by: "depth" }]) {
    const r = report(relief({ strata }));
    for (const row of r.rows) {
      const name = r.parts.find((p) => p.id === row.part).name.toLowerCase();
      assert.match(row.text.split(name).join(""), /^[ ·:]*$/, `"${row.text}" holds a fragment of a name, not just "${name}"`);
    }
    for (const p of r.parts) assert.ok(r.rows.some((row) => row.part === p.id && row.text.includes(p.name.toLowerCase())), `${p.name} shows whole`);
  }
});

test("level strata split between glyph lines, never along one, so their seams do not step", () => {
  const r = report(relief({ strata: { by: "angle", angle: 90 } }));
  const byLine = new Map();
  for (const row of r.rows) byLine.set(row.y, new Set([...(byLine.get(row.y) ?? []), row.part]));
  const split = [...byLine].filter(([, parts]) => parts.size > 1);
  assert.deepEqual(split.map(([y]) => Math.round(y)), [], "lines that hold two parts");
});

test("a part too thin for its name borrows one line's cells, and only one", () => {
  const thin = relief({ strata: { by: "angle", angle: 135 }, shape: { ops: [{ add: "polygon", points: [[0, 400], [1000, 0], [430, 600]] }, { add: "polygon", points: [[430, 600], [1000, 0], [740, 1000]] }], fit: { h: 0.83, cx: 0.52, cy: 0.58 }, rotate: -14 } });
  const r = report(thin);
  for (const p of r.parts) assert.ok(r.rows.some((row) => row.part === p.id && row.text.includes(p.name.toLowerCase())), `${p.name} shows whole`);
  const plain = r.strata.filter((s) => s.whole === 1);
  assert.ok(plain.length >= 1, "at least one thin part is down to its one borrowed name");
});

test("with no hints the default is a rounded volume: lit top left, dim bottom right, a clear spread", () => {
  for (const theme of ["dark", "light"]) {
    const spec = noHints();
    spec.theme = theme;
    const r = report(spec);
    const tone = reliefTone(r, r.mask, r.tokens);
    assert.ok(tone.lit >= RELIEF.tone.lit && tone.spread >= RELIEF.tone.spread, `${theme}: lit ${tone.lit}, spread ${tone.spread}`);
    const { light, inside, w } = r.surface;
    const at = (fx, fy) => {
      const b = r.mask.box;
      const [x, y] = [b.left + fx * (b.right - b.left), b.top + fy * (b.bottom - b.top)];
      const i = Math.floor(y / RELIEF.cell) * w + Math.floor(x / RELIEF.cell);
      assert.ok(inside[i], `${fx},${fy} is inside`);
      return light[i];
    };
    assert.ok(at(0.15, 0.45) > at(0.5, 0.5) && at(0.5, 0.5) > at(0.85, 0.85), "light falls from the top left to the bottom right");
  }
});

test("the dark sheet sets ink letters over a haze and a glowing accent; paper gets a shade body with paper letters, a cast shadow and a solid accent with dark letters", () => {
  const dark = report(relief());
  assert.ok(dark.rows.every((r) => r.spans.every((s) => s.tone === (r.hot ? "hot" : "ink"))));
  assert.ok(dark.ground.filter((g) => !g.hot).every((g) => g.tone === "ink" && g.alpha <= 0.3));
  const light = report(relief({}, "light"));
  assert.ok(light.rows.every((r) => r.spans.every((s) => s.tone === (r.hot ? "on-hot" : "paper"))), "on paper the accent's letters are dark on its fill");
  const [shadow, body] = light.ground;
  assert.equal(shadow.tone, "shade");
  assert.ok(shadow.blur > 0, "the shadow is soft");
  assert.equal(body.tone, "shade");
  assert.deepEqual(body.rows.map(([, s]) => s), light.mask.runs.filter((s) => s.length), "the body's outer layer is the mask itself, not the grid's steps");
  const [glow, fill] = light.ground.filter((g) => g.hot);
  assert.ok(glow.blur > 0 && glow.blur <= 8 && glow.alpha <= 0.35, "a narrow glow");
  assert.ok(fill.tone === "hot" && (fill.alpha ?? 1) === 1 && !fill.blur, "over a solid accent stratum");
  assert.ok(light.ground.indexOf(fill) > light.ground.findLastIndex((g) => g.tone === "shade" && !g.hot && light.ground.indexOf(g) < light.ground.indexOf(glow)), "drawn over the body");
  const darkHot = dark.ground.filter((g) => g.hot);
  assert.ok(darkHot.length === 1 && darkHot[0].blur > 0 && darkHot[0].alpha > 0.3, "on the dark sheet the accent only glows");
});

test("the layout is deterministic", () => {
  const a = JSON.stringify(report(relief({ strata: { by: "depth" } })).rows);
  report(relief());
  const b = JSON.stringify(report(relief({ strata: { by: "depth" } })).rows);
  assert.equal(a, b);
});

test("planted relief flaws each warn or fail with a number and an instruction", () => {
  const strip = relief({ shape: { ops: [{ add: "rect", at: [0, 0], size: [100, 40] }], fit: { w: 0.95 } } });
  assert.match(findings(strip)["shape-accent"][0], /^the accent stratum "the plan" is \d+px thick at its thickest; it needs 40px to show in the thumbnail, so turn the strata \(strata\.angle\) to cut across the shape's narrow side, use strata by depth, scale the shape up, or put the accent on a bigger part$/);

  const dim = relief({ shape: { ...plainJar, ops: plainJar.ops.map((o) => ({ ...o, face: "dim" })) } });
  assert.match(findings(dim)["shape-tone"][0], /^at thumbnail size the relief's lit side reaches \d+\.\d% light \(90th percentile\); it needs 38\.0% to read as a bright object, so turn a dim face to lit or drop its face$/);
  assert.match(findings(dim)["shape-tone"].at(-1), /so every face is dim, which turns the whole form one way: give one add the other face, or drop the faces$/);

  const flat = relief({ bevel: 0 });
  assert.match(findings(flat)["shape-tone"].at(-1), /^at thumbnail size the relief's tones span \d+\.\d% \(10th to 90th percentile\); it needs 30\.0% to read as a volume, so raise bevel \(it is 0\) to 0\.7 or more, so the form rounds toward the light$/);
  // No message asks for a bevel the spec already has, and an accent over half the shape is shape-dominant's to fix.
  for (const over of [{ bevel: 1 }, { bevel: 0.7 }, { bevel: 1, shape: { ...plainJar, ops: plainJar.ops.map((o) => ({ ...o, face: "lit" })) } }]) {
    for (const m of findings(relief(over))["shape-tone"]) assert.doesNotMatch(m, new RegExp(`bevel \\(it is ${over.bevel}\\) to|toward 1`), m);
  }

  const rows = report(relief()).rows.map((r) => ({ part: r.part, text: r.part === "area:lib/plan" ? r.text.slice(0, 3) : r.text, width: r.width }));
  const lost = findings(relief(), rows);
  assert.match(lost["shape-share"][0], /^"the plan" has \d\.\d% of the relief's glyphs for 8\.4% of the lines; its stratum is cut off by the sheet edge or too thin across the glyph lines, so keep the shape on the sheet or turn the strata \(strata\.angle\)$/);
  assert.match(lost["shape-name"][0], /^part "the plan" never shows its whole name: its stratum's widest run of type is \d+px and the name needs 29px; widen the shape where the stratum falls, turn the strata \(strata\.angle\) so it crosses the shape's long side, or give the part a shorter name$/);
});

test("sketch of a relief: tone ASCII with the accent stratum, the strata, and a shaded PNG", () => {
  const out = sketch(relief(), recipe);
  assert.match(out, /^regions: A shape \(shape, 12 strata; @ marks the accent stratum, ·:-=\+\*# the light\)/m);
  assert.match(out, /@{20}/);
  assert.match(out, /#{6}/, "the lit side");
  assert.match(out, /^relief: bevel 0\.8 \(\d+px rounded\), strata at 90 degrees; thumbnail lit side \d+\.\d% \(needs 38\.0%\), spread \d+\.\d% \(needs 30\.0%\)$/m);
  assert.match(out, /^ {2}\* the plan {17}8\.4% of the area for 8\.4% of the lines, \d+ glyph cells, whole name \d+x, \d+px thick$/m);
  assert.doesNotMatch(out, /^! /m);
  const png = sketchImage(relief(), recipe);
  const idat = png.subarray(png.indexOf("IDAT") + 4, png.indexOf("IEND") - 8);
  const raw = zlib.inflateSync(idat);
  const lum = [];
  let hot = 0;
  for (let y = 0; y < 397; y++) {
    for (let x = 0; x < 280; x++) {
      const [r, g, b] = raw.subarray(y * 841 + 1 + x * 3, y * 841 + 4 + x * 3);
      if (r > 140 && r > g + 60) hot++;
      else if (Math.abs(r - g) < 30) lum.push(r);
    }
  }
  assert.ok(hot > 500, `the accent stratum shows (${hot} orange pixels)`);
  assert.ok(new Set(lum.map((v) => v >> 4)).size >= 6, "the shading shows as several greys");
});

test("a part far under one glyph line keeps its share in level strata: date-fns's hourglass, 0.2% beside 4.7%", () => {
  // date-fns's seven parts by lines, in tree order; the first is a sixth of one glyph line across the rim.
  const lines = [228, 4601, 38820, 2226, 44523, 4951, 2707];
  const names = ["upgrade helpers", "extra tools", "date tools", "chained style", "languages", "reading dates", "time zones"];
  const ids = lines.map((_, i) => `area:p${i}`);
  const facts = {
    hash: recipe.hash,
    facts: ids.map((id, i) => ({ id, kind: "area", name: names[i], meta: { leaf: true } })),
    files: Object.fromEntries(ids.map((id, i) => [`p${i}/a.js`, { area: id, loc: lines[i] }])),
  };
  const hourglass = { ops: [{ add: "rect", at: [6, 0], size: [88, 10], round: 3 }, { add: "polygon", points: [[14, 8], [86, 8], [57, 50], [43, 50]] }, { add: "polygon", points: [[43, 50], [57, 50], [86, 92], [14, 92]] }, { add: "rect", at: [6, 90], size: [88, 10], round: 3 }] };
  const s = relief({ shape: hourglass, accent: "area:p2", names: {} });
  delete s.figure.regions[0].strata;
  delete s.figure.regions[0].bevel;
  const r = shapeReport(s, s.figure.regions[0], facts);
  const found = shapeFindings(r);
  assert.deepEqual(found["shape-share"], [], "every part within shape-share's tolerance");
  assert.deepEqual(found["shape-name"], [], "every part shows its name whole");
  assert.ok(r.strata[0].glyphs < 80, `the 0.2% part draws ${r.strata[0].glyphs} glyph cells, not a whole line of about 200`);
});

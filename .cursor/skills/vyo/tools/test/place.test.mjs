// Text blocks placed around a drawn shape when the spec leaves out their x and y.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSpec } from "../lib/spec.mjs";
import { placeTexts, estimateText, PLACE } from "../lib/place.mjs";
import { shapeMask } from "../lib/mask.mjs";
import { onShape, shapeReport, shapeFindings } from "../lib/shape-report.mjs";
import { recordOf, buildPage } from "../lib/render.mjs";
import { recordRect } from "../lib/frame.mjs";
import { sketch } from "../lib/sketch.mjs";
import { scanRepo } from "../lib/scan/index.mjs";
import { SHEET } from "../lib/geometry.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const recipe = scanRepo(path.join(HERE, "fixtures", "recipe"));
const jar = () => ({ ...JSON.parse(fs.readFileSync(path.join(HERE, "..", "presets", "shape.json"), "utf8")), facts: recipe.hash });
const legendText = "Every band is a part of Pantry, its type as big as its share of the code. The orange band is the plan.";
const bare = (shape, style) => {
  const s = jar();
  Object.assign(s.figure.regions[0], { shape, ...(style ? { style } : {}) });
  s.figure.texts = [{ role: "label", id: "label" }, { role: "headline", id: "headline" }, { role: "legend", id: "legend", text: legendText }, { role: "paragraph", id: "how", text: "Pick recipes once and the week plans itself." }];
  return s;
};
// The cold runs' silhouettes with fit left out: a wide train, a tall flask, a bone turned 50 degrees, and the jar.
const SHAPES = {
  train: { ops: [{ add: "capsule", from: [20, 52], to: [72, 52], r: 22 }, { add: "rect", at: [66, 12], size: [32, 64] }, { add: "rect", at: [22, 6], size: [12, 26] }, { add: "rect", at: [8, 72], size: [94, 12] }, ...[28, 58, 84].map((x) => ({ add: "circle", at: [x, 92], r: 16 }))] },
  flask: { ops: [{ add: "circle", at: [50, 66], r: 34 }, { add: "rect", at: [39, 12], size: [22, 34] }, { add: "rect", at: [33, 4], size: [34, 10], round: 3 }] },
  bone: { ops: [{ add: "capsule", from: [22, 50], to: [78, 50], r: 19 }, ...[[13, 38], [13, 62], [87, 38], [87, 62]].map((at) => ({ add: "circle", at, r: 13 }))], rotate: -50 },
  jar: { ...jar().figure.regions[0].shape, fit: undefined },
};
const apart = (a, b) => a.right + 8 <= b.left || b.right + 8 <= a.left || a.bottom + 8 <= b.top || b.bottom + 8 <= a.top;

test("a shape poster's blocks may leave out x, y and w; x without y is refused", () => {
  assert.deepEqual(validateSpec(bare(SHAPES.flask)), []);
  const half = bare(SHAPES.flask);
  half.figure.texts[2].x = 40;
  assert.ok(validateSpec(half).includes("figure.texts[2]: give x and y together, or leave both out and the engine places the block"));
  const wave = JSON.parse(fs.readFileSync(path.join(HERE, "..", "presets", "wave.json"), "utf8"));
  delete wave.figure.texts[0].x;
  assert.ok(validateSpec(wave).some((e) => /^figure\.texts\[0\]: x must be 0 to 840/.test(e)), "a wave poster still needs coordinates");
});

for (const [name, shape] of Object.entries(SHAPES)) {
  test(`${name}: every block lands in the room the shape leaves, apart, in reading order, the same way twice`, () => {
    const spec = bare(shape);
    const placed = placeTexts(spec, recipe);
    assert.deepEqual(placeTexts(spec, recipe), placed, "deterministic");
    const mask = shapeMask(shape);
    const rec = recordRect(recordOf(placed, recipe));
    const rects = placed.figure.texts.map((t) => ({ t, r: estimateText(t, placed, recipe, PLACE.em) }));
    for (const { t, r } of rects) {
      assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y) && t.w >= 120, `${t.id} is placed (${JSON.stringify(t)})`);
      assert.ok(r.left >= 40 && r.top >= 40 && r.right <= SHEET.width - 40 && r.bottom <= SHEET.height - 40, `${t.id} keeps 40px off the edges (${JSON.stringify(r)})`);
      assert.ok(!onShape(mask, r), `${t.id} is 16px clear of the shape`);
      assert.ok(apart(r, rec), `${t.id} is clear of the record line`);
    }
    rects.forEach(({ t, r }, i) => rects.slice(i + 1).forEach(({ t: u, r: q }) => assert.ok(apart(r, q), `${t.id} and ${u.id} keep 8px apart`)));
    const at = Object.fromEntries(rects.map(({ t, r }) => [t.id, r]));
    assert.ok(at.label.bottom <= at.headline.top, "the label sits above the headline");
    assert.deepEqual(findingsOf(placed)["shape-room"], [], "shape-room agrees");
    assert.match(sketch(spec, recipe), new RegExp(`texts: label ${Math.round(at.label.left)},${Math.round(at.label.top)} to `), "the sketch prints the placed blocks");
    const html = buildPage(spec, recipe);
    for (const t of placed.figure.texts) assert.ok(html.includes(`data-block="${t.id}" data-role="${t.role}" data-owner="figure" style="left:${t.x}px;top:${t.y}px;width:${t.w}px;`), `the page puts ${t.id} where the sketch does`);
  });
}

const findingsOf = (spec) => shapeFindings(shapeReport(spec, spec.figure.regions[0], recipe), { blocks: spec.figure.texts.map((t) => estimateText(t, spec, recipe)) });

test("explicit coordinates win, and the other blocks keep clear of them", () => {
  const spec = bare(SHAPES.train);
  Object.assign(spec.figure.texts[2], { x: 500, y: 60, w: 300 });
  const placed = placeTexts(spec, recipe);
  assert.deepEqual(placed.figure.texts[2], spec.figure.texts[2]);
  const legend = estimateText(placed.figure.texts[2], placed, recipe);
  for (const t of placed.figure.texts.filter((x) => x.id !== "legend")) assert.ok(apart(estimateText(t, placed, recipe, PLACE.em), legend), `${t.id} keeps clear of the pinned legend`);
});

test("a shape that leaves no room gets shape-room, with how much to shrink it", () => {
  const spec = bare({ ...SHAPES.flask, fit: { w: 1.1, h: 1.1, cx: 0.5, cy: 0.5 } });
  const room = findingsOf(placeTexts(spec, recipe))["shape-room"];
  assert.ok(room.length, "some block lands on the shape");
  assert.match(room[0], /; no corner holds it \(the largest, [a-z-]+, is \d+ by \d+\), so shrink the shape \(fit\.h 1\.1 to 0\.9\d\) or move it with fit\.cx and fit\.cy$/);
});

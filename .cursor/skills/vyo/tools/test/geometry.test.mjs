import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePath, flattenPath, pointAlong, shapeRings, regionRings, spans, bbox, regionRows, fillRows, corners } from "../lib/geometry.mjs";

const near = (a, b, eps = 0.5) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const width = (s) => s.reduce((t, [l, r]) => t + r - l, 0);

test("a profile passes through its stops and does not overshoot between them", () => {
  const [ring] = shapeRings({ profile: [[100, 400, 50], [200, 420, 200], [300, 400, 50]] });
  near(width(spans([ring], 200)), 400, 1);
  near(width(spans([ring], 100.5)), 100, 2);
  for (let y = 101; y < 300; y += 7) assert.ok(width(spans([ring], y)) <= 400.5, `no overshoot at ${y}`);
  const [[l, r]] = spans([ring], 200);
  near((l + r) / 2, 420, 1);
});

test("an ellipse covers its width at the centre and nothing outside", () => {
  const rings = shapeRings({ ellipse: { cx: 420, cy: 600, rx: 300, ry: 100 } });
  near(width(spans(rings, 600)), 600, 0.5);
  assert.deepEqual(spans(rings, 701), []);
  const b = bbox(rings);
  near(b.left, 120, 0.1);
  near(b.bottom, 700, 0.1);
});

test("holes cut out with even-odd", () => {
  const rings = regionRings({ ellipse: { cx: 420, cy: 600, rx: 300, ry: 300 }, holes: [{ ellipse: { cx: 420, cy: 600, rx: 100, ry: 100 } }] });
  const s = spans(rings, 600);
  assert.equal(s.length, 2);
  near(s[0][1], 320);
  near(s[1][0], 520);
});

test("paths: absolute and relative lines, curves and arcs flatten to the right outline", () => {
  const square = parsePath("M100 100 H300 V300 H100 Z");
  assert.deepEqual(bbox(square.rings), { left: 100, top: 100, right: 300, bottom: 300 });
  const rel = parsePath("m100,100 l200,0 v200 h-200 z");
  assert.deepEqual(bbox(rel.rings), { left: 100, top: 100, right: 300, bottom: 300 });
  const curve = parsePath("M100 300 C100 100 300 100 300 300 Q200 400 100 300 Z");
  near(bbox(curve.rings).top, 150, 1);
  near(bbox(curve.rings).bottom, 350, 1);
  const circle = parsePath("M200 300 A100 100 0 1 0 400 300 A100 100 0 1 0 200 300 Z");
  near(width(spans(circle.rings, 300.5)), 200, 1);
  near(bbox(circle.rings).top, 200, 0.5);
  const relArc = parsePath("M200 300 a100 100 0 0 1 200 0 z");
  near(bbox(relArc.rings).top, 200, 0.5);
  near(bbox(relArc.rings).bottom, 300, 0.01);
});

test("paths that are not paths are refused with a reason", () => {
  assert.match(parsePath("hello").error, /cannot read|must start/);
  assert.match(parsePath("L 1 2 3").error, /must start with M/);
  assert.match(parsePath("M 1 2 L 3").error, /"L" needs 2 numbers/);
  assert.match(parsePath("M 0 0 S 1 2 3 4").error, /"S" is not supported|cannot read/);
  assert.match(parsePath("M 0 0 L 10 10").error, /no closed shape/);
  assert.match(parsePath("M0 0 A 5 5 0 2 0 10 10 Z").error, /arc flags/);
});

test("rows snap to the grid, need both probes inside, and clear text blocks by 12px", () => {
  const region = { polygon: [[100, 100], [740, 100], [740, 300], [100, 300]] };
  const rows = regionRows(region, []);
  assert.equal(rows[0].y, 96 + 16, "the row at 96 has its top probe at 99, outside");
  assert.ok(rows.every((r) => r.y % 16 === 0));
  assert.deepEqual(rows[0].runs, [[100, 740]]);
  const cut = regionRows(region, [{ left: 300, top: 150, right: 400, bottom: 170 }]);
  const row = cut.find((r) => r.y === 160);
  assert.deepEqual(row.runs, [[100, 288], [412, 740]]);
  assert.equal(regionRows({ ...region, size: 11 }, [])[0].y % 14, 0);
});

test("gaps narrower than 24px in the shape merge; runs narrower than 24px drop", () => {
  const region = { polygon: [[100, 100], [740, 100], [740, 300], [100, 300]], holes: [{ polygon: [[400, 90], [410, 90], [410, 310], [400, 310]] }, { polygon: [[100, 90], [120, 90], [120, 310], [100, 310]] }] };
  assert.deepEqual(regionRows(region, [])[0].runs, [[120, 740]]);
});

test("one word per row across all its runs, never skipped for more than one cycle", () => {
  const region = { words: ["a very long word indeed", "b", "c"], tone: ["soft", "ink"], band: 1 };
  const rows = Array.from({ length: 9 }, (_, i) => ({ y: i * 16, runs: [[0, 60], [100, 160]] }));
  const out = fillRows(region, rows, { measure: (t) => t.length * 7.2, isHot: (w) => w === "c" });
  const perRow = rows.map((r) => [...new Set(out.filter((o) => o.y === r.y).map((o) => o.word))]);
  assert.ok(perRow.every((w) => w.length === 1), "each row shows one word");
  assert.ok(perRow.flat().includes("a very long word indeed"), "the long word is drawn, centred at its natural width");
  const long = out.find((o) => o.word.startsWith("a very"));
  near(long.x + long.width / 2, long.run === 60 ? 30 : 130, 0.01);
  assert.ok(out.filter((o) => o.word === "c").every((o) => o.hot));
  assert.equal(out[0].tone, "soft");
  assert.equal(out[out.length - 1].tone, "ink");
});

test("a wide run repeats the word and letter-spaces it to the run", () => {
  const out = fillRows({ words: ["leftovers", "x"], tone: "ink" }, [{ y: 0, runs: [[0, 600]] }], { measure: (t) => t.length * 7.2, isHot: () => false });
  assert.equal(out.length, 1);
  assert.ok(out[0].text.split("   ").length >= 3);
  const visible = out[0].text.length * 7.2 + out[0].spacing * (out[0].text.length - 1);
  assert.ok(visible <= 600 && visible > 599, `visible width ${visible}`);
});

test("corners: the largest empty rect at each corner, wide enough for text, overlaps split along an edge", () => {
  const empty = corners([]);
  assert.deepEqual(empty["top-left"], { x: 0, y: 0, w: 420, h: 590 }, "an empty sheet splits evenly, to the 20px grid");
  assert.deepEqual(empty["bottom-right"], { x: 420, y: 600, w: 420, h: 590 });
  // A diagonal band from top left to bottom right, 200px wide.
  const band = Array.from({ length: 119 }, (_, i) => ({ left: i * 6 - 100, top: i * 10, right: i * 6 + 100, bottom: i * 10 + 10 }));
  const c = corners(band);
  assert.equal(c["top-left"].w, 0, "the band covers the top-left corner");
  const tr = c["top-right"];
  assert.ok(tr.x + tr.w === 840 && tr.y === 0 && tr.w >= 220, `top right is wide enough for text: ${JSON.stringify(tr)}`);
  for (const r of band) assert.ok(!(r.left < tr.x + tr.w && r.right > tr.x && r.top < tr.h && r.bottom > 0), "and empty");
  const bl = c["bottom-left"];
  assert.ok(bl.x === 0 && bl.y + bl.h === 1190 && bl.w >= 220, JSON.stringify(bl));
  // A full-width strip across the middle: both top corners would be the whole top band, so they split it.
  const strip = corners([{ left: 0, top: 500, right: 840, bottom: 700 }]);
  assert.deepEqual([strip["top-left"], strip["top-right"], strip["bottom-left"]], [{ x: 0, y: 0, w: 420, h: 500 }, { x: 420, y: 0, w: 420, h: 500 }, { x: 0, y: 700, w: 420, h: 490 }]);
});

test("flattenPath keeps an open hairline, and pointAlong walks it", () => {
  const open = flattenPath("M 0 0 L 100 0");
  assert.equal(open.error, undefined);
  assert.equal(open.paths.length, 1);
  assert.deepEqual(open.paths[0][0], [0, 0]);
  assert.deepEqual(open.paths[0].at(-1), [100, 0]);
  const mid = pointAlong(open.paths[0], 0.5);
  near(mid.x, 50, 0.5);
  near(mid.y, 0, 0.5);
  const closed = parsePath("M 0 0 L 100 0 L 100 40 Z");
  assert.ok(closed.rings && closed.rings[0].length >= 3);
  assert.ok(flattenPath("Q 1 2").error);
});

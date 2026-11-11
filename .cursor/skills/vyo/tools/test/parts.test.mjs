import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { partsFromFacts, unplainName, accentIds, segmentsOf, dominance } from "../lib/parts.mjs";
import { scanRepo } from "../lib/scan/index.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const recipe = scanRepo(path.join(HERE, "fixtures", "recipe"));
const hypher = JSON.parse(fs.readFileSync(path.join(HERE, "..", "..", "..", "..", "..", "explorations", "2026-11-07-abstract-fields", "hypher-facts.json"), "utf8"));
// Got: one leaf area, source, holds 95% of the code, so a field draws three parts.
const got = JSON.parse(fs.readFileSync(path.join(HERE, "fixtures", "got-facts.json"), "utf8"));
const lines = (facts) => Object.values(facts.files).reduce((s, f) => s + (f.gen ? 0 : f.loc), 0);
const counted = (facts) => Object.values(facts.files).filter((f) => !f.gen).length;
const sum = (parts, k) => parts.reduce((s, p) => s + p[k], 0);

test("the parts hold every line and every file exactly once", () => {
  for (const facts of [recipe, hypher]) {
    for (const o of [{}, { maxParts: 5 }, { minShare: 0.1 }, { minShare: 0 }]) {
      const parts = partsFromFacts(facts, o);
      assert.equal(sum(parts, "loc"), lines(facts), JSON.stringify(o));
      assert.equal(sum(parts, "files"), counted(facts), JSON.stringify(o));
      assert.equal(new Set(parts.map((p) => p.id)).size, parts.length);
    }
  }
});

test("small parts merge into their parents until each is 2% or sits at the top level", () => {
  const parts = partsFromFacts(hypher);
  for (const p of parts) assert.ok(p.loc >= 0.02 * lines(hypher) || segmentsOf(p.id).length <= 1, `${p.id} has ${p.loc} lines`);
  assert.deepEqual(
    parts.map((p) => [p.id, p.loc]),
    [
      ["area:Hypher", 1470], ["area:extensions", 1468], ["area:hypher-web", 713], ["area:hypher-web/convex", 7926], ["area:hypher-web/convex/lib", 2361],
      ["area:hypher-web/shared", 8637], ["area:hypher-web/src/app", 1791], ["area:hypher-web/src/app/api", 1513], ["area:hypher-web/src/components", 7033],
      ["area:hypher-web/src/lib", 6405], ["area:packages", 370], ["area:packages/hypher-cli/src", 4243], ["area:script", 3186],
    ],
    "the browser and editor add-ons gather under extensions, the signed-in pages under the web app's main folder",
  );
});

test("parts come in tree order, parents before children, numbered from 0", () => {
  const parts = partsFromFacts(recipe);
  assert.deepEqual(parts.map((p) => p.order), parts.map((_, i) => i));
  assert.deepEqual(parts.slice(0, 4).map((p) => p.id), ["area:.", "area:app", "area:app/(app)", "area:app/api"]);
});

test("maxParts merges the smallest parts up until the cap holds", () => {
  const parts = partsFromFacts(hypher, { maxParts: 6 });
  assert.equal(parts.length, 6);
  assert.ok(parts.some((p) => p.id === "area:hypher-web/shared"), "the biggest part survives the cap");
});

test("names override the scanned name by part id", () => {
  const parts = partsFromFacts(hypher, { names: { "area:hypher-web/convex": "server" } });
  assert.equal(parts.find((p) => p.id === "area:hypher-web/convex").name, "server");
  assert.equal(parts.find((p) => p.id === "area:hypher-web/shared").name, "Shared parts");
});

test("vendor, all-caps and numbered names are unplain; plain names are not", () => {
  for (const n of ["Convex", "Stripe", "STRIPE", "OpenAI", "Web2", "next-auth GitHub", "Oauth", "Mcp", "Webhook", "Cron"]) assert.ok(unplainName(n), n);
  for (const n of ["Shared parts", "Emails", "Screen pieces", "AI features", "Plan", "sign-in"]) assert.ok(!unplainName(n), n);
});

test("accent finds a part by id, the parts inside an area, a glob, or the part an area merged into", () => {
  const parts = partsFromFacts(hypher);
  const ids = (a) => [...accentIds(parts, a)].sort();
  assert.deepEqual(ids("area:hypher-web/shared"), ["area:hypher-web/shared"]);
  assert.deepEqual(ids("area:hypher-web/src/app/oauth"), ["area:hypher-web/src/app"], "oauth was merged into the app folder");
  assert.deepEqual(ids("area:hypher-web/src"), ["area:hypher-web/src/app", "area:hypher-web/src/app/api", "area:hypher-web/src/components", "area:hypher-web/src/lib"]);
  assert.deepEqual(ids("area:hypher-web/convex*"), ["area:hypher-web/convex"]);
  assert.deepEqual(ids("area:nowhere"), []);
  assert.deepEqual(ids(undefined), []);
});

test("split cuts a dominant leaf part into the folders inside it, every line still held once", () => {
  const shape = { maxParts: 12 };
  const whole = partsFromFacts(got, shape);
  assert.deepEqual(whole.map((p) => p.id), ["area:benchmark", "area:documentation", "area:source"]);
  const split = partsFromFacts(got, { ...shape, split: ["area:source"] });
  assert.equal(sum(split, "loc"), lines(got));
  assert.equal(sum(split, "files"), counted(got));
  assert.ok(split.length >= 6, `about six parts or more (${split.length})`);
  assert.ok(Math.max(...split.map((p) => p.loc)) / lines(got) < 0.7, "none of them is most of the code");
  assert.ok(split.some((p) => p.id === "area:source/core/utils") && split.some((p) => p.id === "area:source"), "the leaf keeps its own files and its folders become parts");
});

test("split cuts a part with no folders inside into its files, each named by its file, the small ones merged back", () => {
  const facts = {
    facts: [{ id: "area:.", kind: "area", name: "Root", meta: { leaf: false } }, { id: "area:src/net", kind: "area", name: "Net", meta: { leaf: true } }],
    files: { "setup.py": { area: "area:.", loc: 20 }, "src/net/sessions.py": { area: "area:src/net", loc: 500 }, "src/net/models.py": { area: "area:src/net", loc: 460 }, "src/net/tiny.py": { area: "area:src/net", loc: 10 }, "src/net/conf.py": { area: "area:src/net", loc: 10, gen: 1 } },
  };
  assert.deepEqual(partsFromFacts(facts).map((p) => p.id), ["area:.", "area:src/net"]);
  const split = partsFromFacts(facts, { split: ["area:src/net"] });
  assert.deepEqual(split.map((p) => [p.id, p.name, p.loc]), [["area:.", "Root", 30], ["area:src/net/models.py", "models", 460], ["area:src/net/sessions.py", "sessions", 500]], "tiny.py, under 2%, merges up as a small folder would");
  assert.equal(sum(split, "loc"), lines(facts));
  assert.equal(sum(split, "files"), counted(facts));
  assert.deepEqual([...accentIds(split, "area:src/net/sessions.py")], ["area:src/net/sessions.py"]);
  const d = dominance(facts);
  assert.deepEqual([d.part.id, d.split.id, d.split.count], ["area:src/net", "area:src/net", 3], "dominance offers the file split");
  const recipeSplit = partsFromFacts(recipe, { split: ["area:lib/plan"] });
  assert.ok(recipeSplit.length >= partsFromFacts(recipe).length && sum(recipeSplit, "loc") === lines(recipe), "the recipe's plan splits into its files, every line still held once");
});

test("dominance names the part that is most of the code and what splitting it gives", () => {
  const d = dominance(got, { maxParts: 12 });
  assert.equal(d.part.id, "area:source");
  assert.ok(d.share > 0.9);
  assert.deepEqual([d.count, d.split.id, d.split.count], [3, "area:source", 6]);
  assert.ok(d.split.largest < 0.7);
  assert.equal(dominance(got, { maxParts: 12, split: ["area:source"] }), null, "split, no part is three quarters of the code");
  const lone = { facts: [{ id: "area:app", kind: "area", name: "App", meta: { leaf: true } }, { id: "area:docs", kind: "area", name: "Docs", meta: { leaf: true } }], files: { "app/a.js": { area: "area:app", loc: 900 }, "docs/b.js": { area: "area:docs", loc: 100 } } };
  assert.deepEqual(dominance(lone), { part: partsFromFacts(lone)[0], share: 0.9, count: 2, split: null }, "a part with no folders inside has nothing to split");
  assert.equal(dominance(recipe), null, "the recipe fixture's parts are fine");
});

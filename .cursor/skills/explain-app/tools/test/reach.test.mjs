// Tests for tools/lib/reach.mjs (CONTRACTS.md §3.3). Run: node --test tools/test/reach.test.mjs
// The walk is also exercised through wire() in wire.test.mjs; these pin the pieces a second caller relies on.
import test from "node:test";
import assert from "node:assert/strict";
import { MAX_HOPS, buildLinkGraph, chainTo, makeView, walk } from "../lib/reach.mjs";

/* ───────────── builders ───────────── */

const kindOf = (id) => id.slice(0, id.indexOf(":"));
const fact = (id, files = []) => ({ id, kind: kindOf(id), name: id, files });

// files: { path: {kit, gen} }; any file named by an import, use or fact is added. imports: [from, to]; uses: [file, id, via].
function mk({ facts = [], files = {}, imports = [], uses = [] }) {
  const out = {};
  const ensure = (f) => (out[f] ??= { area: ".", loc: 10 });
  for (const [f, v] of Object.entries(files)) out[f] = { area: ".", loc: 10, ...v };
  for (const x of facts) x.files.forEach(ensure);
  for (const [a, b] of imports) (ensure(a), ensure(b));
  for (const [f] of uses) ensure(f);
  return { version: 1, facts, files: out, imports, uses };
}
const walkAll = (facts, start, opts = {}, viewOpts) => {
  const seen = [];
  const w = walk(makeView(buildLinkGraph(facts), viewOpts), start, { ...opts, onUses: (file, ids) => seen.push([file, ids]) });
  return { ...w, seen };
};

/* ───────────── graph ───────────── */

test("MAX_HOPS is 3 (CONTRACTS §3.3)", () => {
  assert.equal(MAX_HOPS, 3);
});

test("buildLinkGraph: sorted, unique, and only files that exist; input order does not matter", () => {
  const facts = mk({
    facts: [fact("endpoint:/api/b", ["api/b.ts"]), fact("endpoint:/api/a", ["api/a.ts"])],
    imports: [["x.ts", "z.ts"], ["x.ts", "y.ts"], ["x.ts", "y.ts"], ["x.ts", "missing.ts"], ["missing.ts", "x.ts"]],
    uses: [["x.ts", "endpoint:/api/b", "http"], ["x.ts", "endpoint:/api/a", "http"], ["x.ts", "orm:never", "orm"], ["x.ts", "endpoint:/api/a", "http"], ["gone.ts", "endpoint:/api/a", "http"]],
  });
  for (const f of ["missing.ts", "gone.ts"]) delete facts.files[f]; // edges that name a file the scan does not hold
  const g = buildLinkGraph(facts);
  assert.deepEqual(g.importsOut.get("x.ts"), ["y.ts", "z.ts"]);
  assert.equal(g.importsOut.has("missing.ts"), false);
  assert.deepEqual(g.usesOf.get("x.ts"), ["endpoint:/api/a", "endpoint:/api/b", "orm:never"], "any `via`, sorted, unique");
  assert.deepEqual(g.httpOf.get("x.ts"), ["endpoint:/api/a", "endpoint:/api/b"], "http only");
  assert.equal(g.usesOf.has("gone.ts"), false);
  assert.equal(g.factById.get("endpoint:/api/a").kind, "endpoint");
  assert.equal(g.files, facts.files);

  const shuffled = { ...facts, imports: [...facts.imports].reverse(), uses: [...facts.uses].reverse() };
  const h = buildLinkGraph(shuffled);
  for (const k of ["importsOut", "usesOf", "httpOf"]) assert.deepEqual([...h[k]].sort(), [...g[k]].sort(), k);
});

test("buildLinkGraph: a FactsFile with nothing in it still builds", () => {
  const g = buildLinkGraph({ version: 1 });
  assert.equal(g.importsOut.size + g.usesOf.size + g.httpOf.size + g.factById.size, 0);
  assert.deepEqual(g.files, {});
});

/* ───────────── view ───────────── */

test("neighbours: imports plus the files of endpoints called over http, sorted, with the endpoint as `via`", () => {
  const facts = mk({
    facts: [fact("endpoint:/api/x", ["api/x.ts", "api/x2.ts"])],
    imports: [["a.ts", "z.ts"], ["a.ts", "b.ts"]],
    uses: [["a.ts", "endpoint:/api/x", "http"], ["a.ts", "endpoint:/api/x", "orm"]],
  });
  const view = makeView(buildLinkGraph(facts));
  assert.deepEqual(view.neighbours("a.ts"), [["api/x.ts", "endpoint:/api/x"], ["api/x2.ts", "endpoint:/api/x"], ["b.ts", undefined], ["z.ts", undefined]]);
  assert.deepEqual(view.neighbours("b.ts"), []);
  assert.equal(view.neighbours("a.ts"), view.neighbours("a.ts"), "cached");
});

test("neighbours: an import of a file wins over an http hop to it; a use that is not an endpoint is no hop", () => {
  const facts = mk({
    facts: [fact("endpoint:/api/x", ["x.ts"]), fact("table:T", ["schema.prisma"])],
    imports: [["a.ts", "x.ts"]],
    uses: [["a.ts", "endpoint:/api/x", "http"], ["a.ts", "table:T", "http"], ["a.ts", "endpoint:/api/ghost", "http"]],
  });
  assert.deepEqual(makeView(buildLinkGraph(facts)).neighbours("a.ts"), [["x.ts", undefined]]);
});

test("skipEndpoint is applied before neighbours are de-duplicated", () => {
  // Two endpoints defined in one file (a router). The skipped one sorts first and must not claim the file.
  const facts = mk({
    facts: [fact("endpoint:/api/a", ["router.ts"]), fact("endpoint:/api/b", ["router.ts"])],
    uses: [["page.ts", "endpoint:/api/a", "http"], ["page.ts", "endpoint:/api/b", "http"]],
  });
  const g = buildLinkGraph(facts);
  assert.deepEqual(makeView(g).neighbours("page.ts"), [["router.ts", "endpoint:/api/a"]], "nothing skipped: the first id claims it");
  assert.deepEqual(makeView(g, { skipEndpoint: (id) => id === "endpoint:/api/a" }).neighbours("page.ts"), [["router.ts", "endpoint:/api/b"]]);
  assert.deepEqual(makeView(g, { skipEndpoint: () => true }).neighbours("page.ts"), []);
});

/* ───────────── walk ───────────── */

// page → fetch("/api/plan") → route → lib/plan.ts → table:Plan
const http = () =>
  mk({
    facts: [fact("screen:/plan", ["app/plan/page.tsx"]), fact("endpoint:/api/plan", ["app/api/plan/route.ts"]), fact("table:Plan", ["schema.prisma"])],
    imports: [["app/api/plan/route.ts", "lib/plan.ts"]],
    uses: [["app/plan/page.tsx", "endpoint:/api/plan", "http"], ["lib/plan.ts", "table:Plan", "orm"]],
  });

test("walk follows an http hop to the endpoint's file, and the chain names the endpoint", () => {
  const w = walkAll(http(), "app/plan/page.tsx");
  assert.deepEqual(w.visited, ["app/plan/page.tsx", "app/api/plan/route.ts", "lib/plan.ts"]);
  assert.deepEqual(w.seen, [
    ["app/plan/page.tsx", ["endpoint:/api/plan"]],
    ["lib/plan.ts", ["table:Plan"]],
  ]);
  assert.deepEqual(chainTo(w.parent, "lib/plan.ts"), ["app/plan/page.tsx", "endpoint:/api/plan", "app/api/plan/route.ts", "lib/plan.ts"]);
  assert.deepEqual(chainTo(w.parent, "app/plan/page.tsx"), ["app/plan/page.tsx"]);
  assert.deepEqual(w.endpoints, ["endpoint:/api/plan"]);
  assert.deepEqual(w.stopped, []);
});

test("walk does not follow an endpoint that skipEndpoint holds back (the use is still reported)", () => {
  const w = walkAll(http(), "app/plan/page.tsx", {}, { skipEndpoint: (id) => id === "endpoint:/api/plan" });
  assert.deepEqual(w.visited, ["app/plan/page.tsx"]);
  assert.deepEqual(w.seen, [["app/plan/page.tsx", ["endpoint:/api/plan"]]]);
  assert.deepEqual(w.endpoints, []);
});

test("walk never enters kit files, so nothing behind them is reached", () => {
  const facts = mk({
    files: { "ui/button.tsx": { kit: 1 } },
    imports: [["a.ts", "ui/button.tsx"], ["ui/button.tsx", "behind.ts"], ["a.ts", "b.ts"]],
    uses: [["ui/button.tsx", "service:x", "package"], ["behind.ts", "service:y", "package"]],
  });
  const w = walkAll(facts, "a.ts");
  assert.deepEqual(w.visited, ["a.ts", "b.ts"]);
  assert.deepEqual(w.seen, [], "a kit file's uses are not reported either");
  assert.equal(w.parent.has("ui/button.tsx"), false);
  assert.equal(w.parent.has("behind.ts"), false);
});

test("walk stops after MAX_HOPS hops, or after maxHops when given", () => {
  const chain = ["a", "b", "c", "d", "e"].map((n) => `${n}.ts`);
  const facts = mk({
    imports: chain.slice(1).map((to, i) => [chain[i], to]),
    uses: chain.map((f) => [f, `service:${f}`, "package"]),
  });
  const reached = (opts) => walkAll(facts, "a.ts", opts);
  assert.deepEqual(reached().visited, ["a.ts", "b.ts", "c.ts", "d.ts"], "d is 3 hops from a; e is the 4th");
  assert.deepEqual(reached().seen.map(([f]) => f), ["a.ts", "b.ts", "c.ts", "d.ts"], "uses of a file past the limit are not reported");
  assert.equal(reached().parent.has("e.ts"), false);
  assert.deepEqual(reached({ maxHops: 1 }).visited, ["a.ts", "b.ts"]);
  assert.deepEqual(reached({ maxHops: 0 }).visited, ["a.ts"]);
  assert.deepEqual(reached({ maxHops: 0 }).seen, [["a.ts", ["service:a.ts"]]], "the start file's own uses always count");
  assert.deepEqual(reached({ maxHops: 4 }).visited, chain);
});

test("walk: include keeps files out of the walk (gen files, for strong links only); the start is never filtered", () => {
  const facts = mk({
    files: { "api.gen.ts": { gen: 1 } },
    imports: [["a.ts", "api.gen.ts"], ["api.gen.ts", "b.ts"], ["a.ts", "c.ts"]],
  });
  const strong = (f) => !facts.files[f].gen;
  assert.deepEqual(walkAll(facts, "a.ts").visited, ["a.ts", "api.gen.ts", "c.ts", "b.ts"], "with gen files b is reachable");
  assert.deepEqual(walkAll(facts, "a.ts", { include: strong }).visited, ["a.ts", "c.ts"], "without them it is not");
  assert.deepEqual(walkAll(facts, "api.gen.ts", { include: strong }).visited, ["api.gen.ts", "b.ts"]);
});

test("walk: stopAt holds a file at the edge (entered, reported, not examined, not passed)", () => {
  const facts = mk({
    imports: [["a.ts", "owned.ts"], ["owned.ts", "behind.ts"], ["a.ts", "free.ts"], ["free.ts", "owned.ts"]],
    uses: [["owned.ts", "service:o", "package"], ["free.ts", "service:f", "package"], ["behind.ts", "service:b", "package"]],
  });
  const stops = [];
  const w = walkAll(facts, "a.ts", {
    stopAt: (f) => f === "owned.ts",
    onStop: (f, parent) => stops.push(chainTo(parent, f)),
  });
  assert.deepEqual(w.stopped, ["owned.ts"], "entered once, by the shortest way");
  assert.deepEqual(stops, [["a.ts", "owned.ts"]]);
  assert.deepEqual(w.visited, ["a.ts", "free.ts"]);
  assert.deepEqual(w.seen, [["free.ts", ["service:f"]]], "only the uses of files that were walked");
  assert.equal(w.parent.has("behind.ts"), false);
});

test("walk: onUses sees the chain so far; each file is entered once, cycles end", () => {
  const facts = mk({
    imports: [["a.ts", "b.ts"], ["b.ts", "a.ts"], ["b.ts", "c.ts"], ["c.ts", "b.ts"], ["a.ts", "c.ts"]],
    uses: [["c.ts", "service:c", "package"]],
  });
  const chains = [];
  walk(makeView(buildLinkGraph(facts)), "a.ts", { onUses: (file, ids, parent) => chains.push([...chainTo(parent, file), ...ids]) });
  assert.deepEqual(chains, [["a.ts", "c.ts", "service:c"]], "c is one hop from a, not two");
});

test("walk: a start file with no edges, or one the graph has never seen, walks alone", () => {
  const w = walkAll(mk({ imports: [["x.ts", "y.ts"]] }), "lonely.ts");
  assert.deepEqual(w.visited, ["lonely.ts"]);
  assert.deepEqual([...w.parent], [["lonely.ts", null]]);
  assert.deepEqual(w.endpoints, []);
});

test("walk: the same facts give the same walk however the input is ordered", () => {
  const a = http();
  const b = { ...a, uses: [...a.uses].reverse(), imports: [...a.imports].reverse(), facts: [...a.facts].reverse() };
  const run = (f) => {
    const w = walkAll(f, "app/plan/page.tsx");
    return JSON.stringify([w.visited, w.seen, [...w.parent], w.endpoints]);
  };
  assert.equal(run(a), run(b));
});

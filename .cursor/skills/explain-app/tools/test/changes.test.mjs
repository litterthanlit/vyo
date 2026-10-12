// Tests for tools/lib/changes.mjs and tools/lib/briefing.mjs (CONTRACTS.md §7).
// Run: node --test tools/test/changes.test.mjs
// Most cases run on small in-memory FactsFile objects; the last group scans real copies of the recipe fixture.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { THRESHOLDS, diffFacts } from "../lib/changes.mjs";
import { buildBriefing, describeCron, methodVerbs, plainName, renderText, vendorName } from "../lib/briefing.mjs";
import { factsHash } from "../lib/hash.mjs";
import { SERVICE_NAMES, SERVICE_VERBS, aiName, isJargon } from "../lib/scan/names.mjs";
import { scanRepo } from "../scan.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, "fixtures");

/* ───────────── builders (the mk() pattern of wire.test.mjs) ───────────── */

const kindOf = (id) => id.slice(0, id.indexOf(":"));
// The scanner's own friendly names for services and AI; the last path segment, capitalised, for the rest.
const nameOf = (id) => {
  const key = id.slice(id.indexOf(":") + 1);
  if (id.startsWith("service:") && SERVICE_NAMES[key]) return SERVICE_NAMES[key];
  if (id.startsWith("ai:")) return aiName(key);
  const seg = key.split("/").filter(Boolean).pop() ?? "Home";
  return seg[0].toUpperCase() + seg.slice(1);
};
const fact = (id, files = [], extra = {}) => ({ id, kind: kindOf(id), name: nameOf(id), files, ...extra });
const meta = (m) => ({ meta: m });
const area = (dir, { leaf = false, name } = {}) => fact(`area:${dir}`, [], { name: name ?? nameOf(`area:${dir}`), meta: { leaf } });
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// files: { path: loc | {loc, kit, gen, area} }. Any file a fact, import or use names is added with 10 LOC.
function mk({ facts = [], files = {}, imports = [], uses = [], name = "pantry" }) {
  const out = {};
  const ensure = (f) => {
    if (!(f in out)) out[f] = { area: "area:.", loc: 10 };
  };
  for (const [f, v] of Object.entries(files)) out[f] = { area: "area:.", ...(typeof v === "number" ? { loc: v } : v) };
  for (const x of facts) for (const f of x.files ?? []) ensure(f);
  for (const [a, b] of imports) (ensure(a), ensure(b));
  for (const [f] of uses) ensure(f);
  const file = {
    version: 1,
    hash: "",
    empty: !facts.some((f) => f.kind !== "area"),
    repo: { name, packages: ["."] },
    facts: [...facts].sort(byId),
    files: Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1))),
    imports: [...imports].sort(),
    uses: [...uses].sort(),
    unresolved: {},
  };
  file.hash = factsHash(file);
  return file;
}
const P = (name, role, from) => ({ name, role, line: "One sentence.", from });
const ids = (list) => list.map((i) => i.id);
const kinds = (list, kind) => list.filter((i) => i.kind === kind);

// The same scan with every list in another order. `hash` is kept: it names the scan, not the order.
const shuffled = (f) => ({
  ...f,
  facts: [...f.facts].reverse().map((x) => ({ ...x, files: [...x.files].reverse(), ...(x.meta ? { meta: Object.fromEntries(Object.entries(x.meta).reverse().map(([k, v]) => [k, Array.isArray(v) ? [...v].reverse() : v])) } : {}) })),
  files: Object.fromEntries(Object.entries(f.files).reverse()),
  imports: [...f.imports].reverse(),
  uses: [...f.uses].reverse(),
});

/* ───────────── the shape ───────────── */

const world = () => ({
  facts: [
    fact("screen:/home", ["app/home.tsx"]),
    fact("screen:/plan", ["app/plan.tsx"]),
    fact("endpoint:/api/e", ["api/e.ts"], meta({ methods: ["GET"] })),
    fact("table:User", ["prisma/schema.prisma"]),
    fact("service:email", ["lib/mail.ts"], meta({ vendor: ["resend"] })),
  ],
  files: { "app/home.tsx": 12, "app/plan.tsx": 20, "api/e.ts": 31, "lib/mail.ts": 14, "prisma/schema.prisma": 40 },
  imports: [["app/plan.tsx", "lib/mail.ts"]],
  uses: [["lib/mail.ts", "service:email", "package"]],
});

test("diffFacts: nothing changed gives an empty, same, non-structural Changes with a self-consistent hash", () => {
  const a = mk(world());
  const c = diffFacts(a, a);
  assert.equal(c.version, 1);
  assert.equal(c.kind, "changes");
  assert.equal(c.same, true);
  assert.equal(c.structural, false);
  for (const k of ["added", "removed", "moved", "changed", "notOnScreen", "worthALook", "notes"]) assert.deepEqual(c[k], [], k);
  assert.deepEqual(c.reach, { gained: [], lost: [], generated: false });
  assert.equal(c.counts.screen.before, 2);
  assert.deepEqual(c.counts.screen, { before: 2, after: 2, added: 0, removed: 0 });
  assert.deepEqual(c.before, { hash: a.hash, repo: "pantry", empty: false });
  assert.equal(c.hash, factsHash(c), "hash is factsHash over the Changes without its hash");
  assert.equal(c.posters, undefined, "no parts, no posters");
});

test("diffFacts: added and removed facts, with counts that match the lists", () => {
  const before = mk(world());
  const w = world();
  w.facts = w.facts.filter((f) => f.id !== "screen:/plan").concat([fact("screen:/billing", ["app/billing.tsx"]), fact("ai:openai", ["lib/ai.ts"], meta({ vendor: ["openai"], tools: 2 }))]);
  w.files = { ...w.files, "app/billing.tsx": 55, "lib/ai.ts": 17 };
  w.imports = [];
  const after = mk(w);
  const c = diffFacts(before, after);
  assert.deepEqual(ids(c.added), ["ai:openai", "screen:/billing"]);
  assert.deepEqual(ids(c.removed), ["screen:/plan"]);
  assert.deepEqual(c.counts.screen, { before: 2, after: 2, added: 1, removed: 1 });
  assert.deepEqual(c.counts.ai, { before: 0, after: 1, added: 1, removed: 0 });
  for (const kind of ["screen", "endpoint", "table", "service", "ai", "job"]) {
    const n = c.counts[kind];
    assert.equal(n.added, kinds(c.added, kind).length, `${kind} added`);
    assert.equal(n.removed, kinds(c.removed, kind).length, `${kind} removed`);
    assert.equal(n.after - n.before, n.added - n.removed, `${kind} arithmetic (no moves here)`);
  }
  const openai = c.added.find((i) => i.id === "ai:openai");
  assert.deepEqual(openai, { id: "ai:openai", kind: "ai", name: "OpenAI", files: ["lib/ai.ts"], meta: { tools: 2, vendor: ["openai"] } });
  assert.equal(c.structural, true);
  assert.equal(c.same, false);
  assert.deepEqual(c.worthALook.map((w) => [w.code, w.id]), [["screen-removed", "screen:/plan"], ["ai-added", "ai:openai"]]);
});

test("diffFacts: areas are never listed", () => {
  const a = mk({ ...world(), facts: [...world().facts, area("lib", { leaf: true })] });
  const b = mk({ ...world(), facts: [...world().facts, area("lib", { leaf: true }), area("other", { leaf: true })], files: { ...world().files, "other/x.ts": 10 } });
  const c = diffFacts(a, b);
  assert.deepEqual(c.added, []);
  assert.equal(Object.keys(c.counts).length, 6);
});

test("diffFacts: shuffled input gives the same bytes and the same hash", () => {
  const before = mk(world());
  const w = world();
  w.facts.push(fact("screen:/billing", ["app/billing.tsx"]), fact("job:/api/cron/x", ["api/cron/x.ts"], meta({ schedule: "0 8 * * 1" })), fact("service:text-messages", ["lib/sms.ts"], meta({ vendor: ["twilio"] })));
  w.facts = w.facts.filter((f) => f.id !== "table:User");
  w.files["app/billing.tsx"] = 99;
  w.imports.push(["app/billing.tsx", "lib/mail.ts"], ["api/cron/x.ts", "lib/sms.ts"], ["app/home.tsx", "lib/sms.ts"]);
  w.uses.push(["lib/sms.ts", "service:text-messages", "package"], ["app/home.tsx", "endpoint:/api/e", "http"]);
  const after = mk(w);
  const one = diffFacts(before, after);
  const two = diffFacts(shuffled(before), shuffled(after));
  assert.equal(JSON.stringify(two), JSON.stringify(one));
  assert.equal(two.hash, one.hash);
  assert.ok(one.added.length >= 3 && one.reach.gained.length >= 1, "the case has something in it");
  // order inside the result is by id
  assert.deepEqual(ids(one.added), [...ids(one.added)].sort());
});

test("diffFacts: version mismatch and non-facts throw", () => {
  const a = mk(world());
  assert.throws(() => diffFacts({ ...a, version: 2 }, a), /before is facts version 2/);
  assert.throws(() => diffFacts(a, { ...a, version: undefined }), /after is facts version undefined/);
  assert.throws(() => diffFacts(null, a), /before is not a facts\.json/);
  assert.throws(() => diffFacts(a, "nope"), /after is not a facts\.json/);
  assert.throws(() => diffFacts(a, { version: 1, facts: [] }), /after is not a facts\.json/);
  assert.throws(() => diffFacts(a, a, { parts: "nope" }), /parts must be an array/);
  assert.equal(diffFacts(a, a, null).same, true, "options are optional, even as null");
  assert.equal(diffFacts(a, a, { labels: null }).same, true);
});

test("diffFacts: labels land on the sides; THRESHOLDS is frozen and exported", () => {
  const a = mk(world());
  const c = diffFacts(a, a, { labels: { before: "your last saved version (a1b2c3d, 2026-10-07)", after: "your files right now" } });
  assert.equal(c.before.label, "your last saved version (a1b2c3d, 2026-10-07)");
  assert.equal(c.after.label, "your files right now");
  assert.equal(THRESHOLDS.reworkLines, 20);
  assert.equal(THRESHOLDS.reworkShare, 0.25);
  assert.equal(Object.isFrozen(THRESHOLDS), true);
  assert.equal(diffFacts(a, a).before.label, undefined);
});

/* ───────────── moves ───────────── */

test("move same-name: one removed and one added with the same kind and name", () => {
  const before = mk({ facts: [fact("screen:/old/plan", ["old/plan.tsx"]), fact("screen:/home", ["home.tsx"])], files: { "old/plan.tsx": 11, "home.tsx": 30 } });
  const after = mk({ facts: [fact("screen:/plan", ["plan.tsx"]), fact("screen:/home", ["home.tsx"])], files: { "plan.tsx": 25, "home.tsx": 30 } });
  const c = diffFacts(before, after);
  assert.equal(c.moved.length, 1);
  assert.equal(c.moved[0].how, "same-name");
  assert.equal(c.moved[0].from.id, "screen:/old/plan");
  assert.equal(c.moved[0].to.id, "screen:/plan");
  assert.deepEqual([c.added, c.removed], [[], []], "a move is neither added nor removed");
  assert.deepEqual(c.counts.screen, { before: 2, after: 2, added: 0, removed: 0 });
});

test("move same-name: not when the match is not unique", () => {
  const before = mk({ facts: [fact("screen:/a/plan", ["a.tsx"]), fact("screen:/b/plan", ["b.tsx"])], files: { "a.tsx": 11, "b.tsx": 12 } });
  const after = mk({ facts: [fact("screen:/plan", ["p.tsx"])], files: { "p.tsx": 33 } });
  const c = diffFacts(before, after);
  assert.deepEqual(c.moved, []);
  assert.equal(c.removed.length, 2);
  assert.equal(c.added.length, 1);
});

test("move same-shape: same sizes and same outgoing edges; a changed edge or a shared file breaks it", () => {
  const edges = { imports: [["a.tsx", "lib/auth.ts"], ["a.tsx", "lib/billing.ts"]], uses: [["a.tsx", "endpoint:/api/e", "http"]] };
  const e = fact("endpoint:/api/e", ["api/e.ts"]);
  const before = mk({ facts: [fact("screen:/settings", ["a.tsx"]), e], files: { "a.tsx": 15 }, ...edges });
  const sameShape = mk({ facts: [fact("screen:/preferences", ["b.tsx"]), e], files: { "b.tsx": 15 }, imports: [["b.tsx", "lib/auth.ts"], ["b.tsx", "lib/billing.ts"]], uses: [["b.tsx", "endpoint:/api/e", "http"]] });
  const c = diffFacts(before, sameShape);
  assert.equal(c.moved.length, 1);
  assert.equal(c.moved[0].how, "same-shape");
  assert.equal(c.moved[0].to.name, "Preferences");

  const otherSize = mk({ facts: [fact("screen:/preferences", ["b.tsx"]), e], files: { "b.tsx": 16 }, imports: [["b.tsx", "lib/auth.ts"], ["b.tsx", "lib/billing.ts"]], uses: [["b.tsx", "endpoint:/api/e", "http"]] });
  assert.deepEqual(diffFacts(before, otherSize).moved, [], "one more line");
  const otherEdge = mk({ facts: [fact("screen:/preferences", ["b.tsx"]), e], files: { "b.tsx": 15 }, imports: [["b.tsx", "lib/auth.ts"]], uses: [["b.tsx", "endpoint:/api/e", "http"]] });
  assert.deepEqual(diffFacts(before, otherEdge).moved, [], "one import fewer");

  // two screens defined in one file: the file is not exclusive to either, so its shape says nothing
  const shared = (id, name) => fact(id, ["pages.tsx"], { name });
  const b2 = mk({ facts: [shared("screen:/x", "X")], files: { "pages.tsx": 9 } });
  const a2 = mk({ facts: [shared("screen:/y", "Y"), shared("screen:/z", "Z")], files: { "pages.tsx": 9 } });
  assert.deepEqual(diffFacts(b2, a2).moved, []);

  // generated files have no shape either
  const g1 = mk({ facts: [fact("screen:/g", ["g.tsx"])], files: { "g.tsx": { loc: 9, gen: 1 } } });
  const g2 = mk({ facts: [fact("screen:/h", ["h.tsx"])], files: { "h.tsx": { loc: 9, gen: 1 } } });
  assert.deepEqual(diffFacts(g1, g2).moved, []);
});

test("move same-shape: a file that defines another fact too is not the screen's own", () => {
  const pages = ["pages.tsx"];
  const before = mk({ facts: [fact("screen:/x", pages), fact("screen:/w", pages)], files: { "pages.tsx": 9 } });
  const after = mk({ facts: [fact("screen:/w", pages), fact("screen:/y", ["other.tsx"])], files: { "pages.tsx": 9, "other.tsx": 9 } });
  const c = diffFacts(before, after);
  assert.deepEqual(c.moved, [], "x shared its file with w, so a same-sized screen elsewhere proves nothing");
  assert.deepEqual([ids(c.removed), ids(c.added)], [["screen:/x"], ["screen:/y"]]);
});

test("move same-shape: two identical candidates are not guessed between", () => {
  const before = mk({ facts: [fact("screen:/a1", ["a1.tsx"]), fact("screen:/a2", ["a2.tsx"])], files: { "a1.tsx": 7, "a2.tsx": 7 } });
  const after = mk({ facts: [fact("screen:/b", ["b.tsx"])], files: { "b.tsx": 7 } });
  assert.deepEqual(diffFacts(before, after).moved, []);
});

test("move same-slot: exactly one endpoint left and one arrived in a shared file", () => {
  const defs = (...routes) => routes.map((r) => fact(`endpoint:${r}`, ["api/routes.ts"]));
  const before = mk({ facts: defs("/api/users", "/api/keep"), files: { "api/routes.ts": 40 } });
  const after = mk({ facts: defs("/api/people", "/api/keep"), files: { "api/routes.ts": 40 } });
  const c = diffFacts(before, after);
  assert.equal(c.moved.length, 1);
  assert.equal(c.moved[0].how, "same-slot");
  assert.deepEqual([c.moved[0].from.id, c.moved[0].to.id], ["endpoint:/api/users", "endpoint:/api/people"]);

  // two left and two arrived in that file: which is which is a guess
  const b2 = mk({ facts: defs("/api/a", "/api/b"), files: { "api/routes.ts": 40 } });
  const a2 = mk({ facts: defs("/api/c", "/api/d"), files: { "api/routes.ts": 41 } });
  assert.deepEqual(diffFacts(b2, a2).moved, []);
});

test("move same-slot: a route that gained a cron entry is the same slot, endpoint to job", () => {
  const before = mk({ facts: [fact("endpoint:/api/cron/x", ["api/cron/x.ts"], meta({ methods: ["GET"] }))] });
  const after = mk({ facts: [fact("job:/api/cron/x", ["api/cron/x.ts"], meta({ schedule: "0 8 * * 1" }))] });
  const c = diffFacts(before, after);
  assert.equal(c.moved.length, 1);
  assert.equal(c.moved[0].how, "same-slot");
  assert.deepEqual([c.moved[0].from.kind, c.moved[0].to.kind], ["endpoint", "job"]);
  assert.deepEqual([c.added, c.removed], [[], []]);
});

test("move folded-name: a table renamed by case, underscores or plural; it still raises table-removed", () => {
  const user = fact("table:User", ["prisma/schema.prisma"]);
  const before = mk({ facts: [user, fact("table:Recipe", ["prisma/schema.prisma"]), fact("table:meal_plan", ["prisma/schema.prisma"])] });
  const after = mk({ facts: [user, fact("table:Recipes", ["prisma/schema.prisma"]), fact("table:MealPlans", ["prisma/schema.prisma"])] });
  const c = diffFacts(before, after);
  assert.deepEqual(c.moved.map((m) => [m.from.id, m.to.id, m.how]), [
    ["table:meal_plan", "table:MealPlans", "folded-name"],
    ["table:Recipe", "table:Recipes", "folded-name"],
  ]);
  assert.deepEqual(c.worthALook.map((w) => [w.code, w.id, w.renamedTo?.id]), [
    ["table-removed", "table:Recipe", "table:Recipes"],
    ["table-removed", "table:meal_plan", "table:MealPlans"],
  ]);
  assert.deepEqual([c.added, c.removed], [[], []]);
});

test("one table removed and another added in the same schema file are NOT paired", () => {
  const schema = "prisma/schema.prisma";
  const keep = fact("table:User", [schema]);
  const before = mk({ facts: [keep, fact("table:Ingredient", [schema])] });
  const after = mk({ facts: [keep, fact("table:Tag", [schema])] });
  const c = diffFacts(before, after);
  assert.deepEqual(c.moved, [], "a shared file proves nothing about tables");
  assert.deepEqual(ids(c.removed), ["table:Ingredient"]);
  assert.deepEqual(ids(c.added), ["table:Tag"]);
  assert.deepEqual(c.worthALook.map((w) => [w.code, w.id]), [["table-removed", "table:Ingredient"]], "the loss is flagged");
  // same name is not a tables rule either: the friendly name alone never pairs
  const b2 = mk({ facts: [fact("table:Ingredient", [schema], { name: "Item" })] });
  const a2 = mk({ facts: [fact("table:Tag", [schema], { name: "Item" })] });
  assert.deepEqual(diffFacts(b2, a2).moved, []);
});

test("reshuffled: many unpaired facts share one name, so pairing by name is hopeless", () => {
  const page = (n, i) => fact(`screen:/${n}${i}`, [`${n}${i}.tsx`], { name: "Page" });
  const list = (n, count, loc0) => ({ facts: Array.from({ length: count }, (_, i) => page(n, i)), files: Object.fromEntries(Array.from({ length: count }, (_, i) => [`${n}${i}.tsx`, loc0 + i])) });
  const c = diffFacts(mk(list("a", 3, 10)), mk(list("b", 3, 40)));
  assert.deepEqual(c.moved, []);
  assert.deepEqual(c.notes.filter((n) => n.code === "reshuffled"), [{ code: "reshuffled", kind: "screen", name: "Page", count: 6 }]);
  const few = diffFacts(mk(list("a", 2, 10)), mk(list("b", 2, 40)));
  assert.equal(few.notes.some((n) => n.code === "reshuffled"), false, "4 is below the threshold of 5");
});

/* ───────────── in-place changes ───────────── */

test("changed: methods, schedule, vendor and tools", () => {
  const b = mk({
    facts: [
      fact("endpoint:/api/e", ["api/e.ts"], meta({ methods: ["GET", "POST"] })),
      fact("job:/api/cron/x", ["api/cron/x.ts"], meta({ schedule: "0 8 * * 1" })),
      fact("service:payments", ["lib/pay.ts"], meta({ vendor: ["stripe"] })),
      fact("ai:openai", ["lib/ai.ts"], meta({ vendor: ["openai"], tools: 2 })),
    ],
  });
  const a = mk({
    facts: [
      fact("endpoint:/api/e", ["api/e.ts"], meta({ methods: ["DELETE", "GET"] })),
      fact("job:/api/cron/x", ["api/cron/x.ts"], meta({ schedule: "0 17 * * 5" })),
      fact("service:payments", ["lib/pay.ts"], meta({ vendor: ["lemonsqueezy"] })),
      fact("ai:openai", ["lib/ai.ts"], meta({ vendor: ["openai"], tools: 3 })),
    ],
  });
  const c = diffFacts(b, a);
  const by = (type) => c.changed.find((x) => x.type === type);
  assert.deepEqual([by("methods").before, by("methods").after], [["GET", "POST"], ["DELETE", "GET"]]);
  assert.deepEqual([by("schedule").before, by("schedule").after], ["0 8 * * 1", "0 17 * * 5"]);
  assert.deepEqual([by("vendor").before, by("vendor").after], [["stripe"], ["lemonsqueezy"]]);
  assert.deepEqual([by("tools").before, by("tools").after], [2, 3]);
  assert.equal(c.changed.length, 4);
  assert.deepEqual(c.worthALook.map((w) => w.code), ["request-lost", "vendor-switched"], "a lost method and a switched vendor");
  assert.deepEqual(c.worthALook[0].methods, ["POST"]);
  assert.deepEqual([c.worthALook[1].before, c.worthALook[1].after], [["stripe"], ["lemonsqueezy"]]);
  // a vendor that is only added is a change but not a switch
  const more = mk({ facts: [fact("service:payments", ["lib/pay.ts"], meta({ vendor: ["paddle", "stripe"] }))] });
  const one = mk({ facts: [fact("service:payments", ["lib/pay.ts"], meta({ vendor: ["stripe"] }))] });
  const added = diffFacts(one, more);
  assert.equal(added.changed[0].type, "vendor");
  assert.deepEqual(added.worthALook, []);
});

test("changed: a schedule that appears or goes away", () => {
  const withSchedule = mk({ facts: [fact("job:send", ["w.py"], meta({ schedule: "*/15 * * * *" }))] });
  const without = mk({ facts: [fact("job:send", ["w.py"])] });
  assert.deepEqual(diffFacts(without, withSchedule).changed.map((c) => [c.type, c.before, c.after]), [["schedule", null, "*/15 * * * *"]]);
  assert.deepEqual(diffFacts(withSchedule, without).changed.map((c) => [c.type, c.before, c.after]), [["schedule", "*/15 * * * *", null]]);
});

test("changed: reworked needs 20 lines and 25% of the old size, in a file of the fact's own", () => {
  const rework = (from, to, extra = {}) =>
    diffFacts(
      mk({ facts: [fact("screen:/r", ["r.tsx"])], files: { "r.tsx": { loc: from, ...extra } } }),
      mk({ facts: [fact("screen:/r", ["r.tsx"])], files: { "r.tsx": { loc: to, ...extra } } }),
    ).changed.filter((c) => c.type === "reworked");
  assert.equal(rework(40, 59).length, 0, "19 lines");
  assert.equal(rework(40, 60).length, 1, "20 lines and 50%");
  assert.equal(rework(200, 240).length, 0, "40 lines but only 20%");
  assert.equal(rework(100, 125).length, 1, "exactly 25 lines and 25%");
  assert.equal(rework(100, 124).length, 0, "24%");
  assert.equal(rework(60, 38).length, 1, "shrinking counts too");
  assert.deepEqual(rework(40, 60)[0], { id: "screen:/r", kind: "screen", name: "R", files: ["r.tsx"], type: "reworked", before: 40, after: 60 });
  assert.equal(rework(40, 90, { gen: 1 }).length, 0, "generated files are not hand-written work");
  // a file shared by two facts says nothing about either (every table lives in one schema.prisma)
  const shared = (loc) => mk({ facts: [fact("table:A", ["s.prisma"]), fact("table:B", ["s.prisma"])], files: { "s.prisma": loc } });
  assert.deepEqual(diffFacts(shared(40), shared(120)).changed, []);
});

/* ───────────── reach ───────────── */

test("reach: a screen reaches a table through an http call to an endpoint", () => {
  const base = {
    facts: [fact("screen:/home", ["s.tsx"]), fact("endpoint:/api/e", ["api/e.ts"], meta({ methods: ["GET"] })), fact("table:T", ["schema.prisma"])],
    imports: [["api/e.ts", "lib/q.ts"]],
    uses: [["lib/q.ts", "table:T", "orm"]],
  };
  const before = mk(base);
  const after = mk({ ...base, uses: [...base.uses, ["s.tsx", "endpoint:/api/e", "http"]] });
  const c = diffFacts(before, after);
  assert.deepEqual(c.reach.gained.map((g) => g.fact.id), ["endpoint:/api/e", "table:T"]);
  const table = c.reach.gained.find((g) => g.fact.id === "table:T");
  assert.deepEqual(table.screens, [{ id: "screen:/home", name: "Home" }]);
  assert.deepEqual(table.chain, ["s.tsx", "endpoint:/api/e", "api/e.ts", "lib/q.ts", "table:T"], "the http hop is in the witness");
  assert.deepEqual(c.reach.lost, []);
  assert.equal(c.structural, true);
  // and the reverse is a loss
  const back = diffFacts(after, before);
  assert.deepEqual(back.reach.lost.map((l) => l.fact.id), ["endpoint:/api/e", "table:T"]);
  assert.deepEqual(back.notOnScreen.map((n) => [n.fact.id, n.why]), [["endpoint:/api/e", "disconnected"], ["table:T", "disconnected"]]);
});

test("reach: a gain is listed once per fact with every screen that now reaches it", () => {
  const base = { facts: [fact("screen:/a", ["a.tsx"]), fact("screen:/b", ["b.tsx"]), fact("service:email", ["lib/m.ts"])], uses: [["lib/m.ts", "service:email", "package"]] };
  const c = diffFacts(mk(base), mk({ ...base, imports: [["a.tsx", "lib/m.ts"], ["b.tsx", "lib/m.ts"]] }));
  assert.equal(c.reach.gained.length, 1);
  assert.deepEqual(c.reach.gained[0].screens.map((s) => s.id), ["screen:/a", "screen:/b"]);
  assert.deepEqual(c.reach.gained[0].chain, ["a.tsx", "lib/m.ts", "service:email"], "the shortest witness, ties to the first screen");
});

test("reach: a service only a job uses is not on a screen, and says which job", () => {
  const before = mk({ facts: [fact("screen:/home", ["s.tsx"]), fact("job:/api/cron/weekly", ["cron.ts"])] });
  const after = mk({
    facts: [fact("screen:/home", ["s.tsx"]), fact("job:/api/cron/weekly", ["cron.ts"]), fact("service:email", ["lib/mail.ts"], meta({ vendor: ["resend"] }))],
    imports: [["cron.ts", "lib/mail.ts"]],
    uses: [["lib/mail.ts", "service:email", "package"]],
  });
  const c = diffFacts(before, after);
  assert.equal(c.notOnScreen.length, 1);
  assert.equal(c.notOnScreen[0].fact.id, "service:email");
  assert.deepEqual(c.notOnScreen[0].fact.vendor, ["resend"]);
  assert.equal(c.notOnScreen[0].why, "new");
  assert.deepEqual(c.notOnScreen[0].usedByJobs, [{ id: "job:/api/cron/weekly", name: "Weekly" }]);
  assert.deepEqual(c.reach.gained, [], "jobs are roots, but gained is about screens");
});

test("reach: three hops reach, a fourth does not", () => {
  const chain = (hops) => {
    const files = ["s.tsx", "a.ts", "b.ts", "c.ts", "d.ts"];
    const imports = files.slice(0, hops).map((f, i) => [f, files[i + 1]]);
    return mk({
      facts: [fact("screen:/home", ["s.tsx"]), fact("service:email", ["d.ts"])],
      files: Object.fromEntries(files.map((f) => [f, 10])),
      imports,
      uses: [[files[hops], "service:email", "package"]],
    });
  };
  const empty = mk({ facts: [fact("screen:/home", ["s.tsx"])] });
  const three = diffFacts(empty, chain(3));
  assert.deepEqual(three.reach.gained.map((g) => g.fact.id), ["service:email"], "the use sits three imports away");
  assert.deepEqual(three.notOnScreen, []);
  const four = diffFacts(empty, chain(4));
  assert.deepEqual(four.reach.gained, [], "four imports away is out of range");
  assert.deepEqual(four.notOnScreen.map((n) => [n.fact.id, n.why]), [["service:email", "new"]]);
});

test("reach: kit files are never walked through", () => {
  const empty = mk({ facts: [fact("screen:/home", ["s.tsx"])] });
  const withKit = (kit) =>
    mk({
      facts: [fact("screen:/home", ["s.tsx"]), fact("service:email", ["lib/m.ts"])],
      files: { "k.ts": kit ? { loc: 10, kit: 1 } : 10 },
      imports: [["s.tsx", "k.ts"], ["k.ts", "lib/m.ts"]],
      uses: [["lib/m.ts", "service:email", "package"]],
    });
  assert.equal(diffFacts(empty, withKit(false)).reach.gained.length, 1, "an ordinary file is walked");
  const c = diffFacts(empty, withKit(true));
  assert.deepEqual(c.reach.gained, []);
  assert.deepEqual(c.notOnScreen.map((n) => n.fact.id), ["service:email"]);
});

test("reach: a generated client makes everything weakly reachable, so no per-screen claims", () => {
  const gen = { loc: 80, gen: 1 };
  const base = (endpoints) => ({
    facts: [fact("screen:/home", ["s.tsx"]), ...endpoints.map((e) => fact(`endpoint:/api/${e}`, [`api/${e}.ts`]))],
    files: { "client/sdk.gen.ts": gen },
    imports: [["s.tsx", "client/sdk.gen.ts"]],
    uses: endpoints.map((e) => ["client/sdk.gen.ts", `endpoint:/api/${e}`, "http"]),
  });
  const c = diffFacts(mk(base(["e1"])), mk(base(["e1", "e2"])));
  assert.equal(c.reach.generated, true);
  assert.deepEqual(ids(c.added), ["endpoint:/api/e2"]);
  assert.deepEqual(c.reach.gained, [], "the screen was never shown to call e2");
  assert.deepEqual(c.notOnScreen, [], "but something does lead to it");
  // without a generated client the same new endpoint is a claim
  const plain = (extra) => ({ facts: [fact("screen:/home", ["s.tsx"]), fact("endpoint:/api/e2", ["api/e2.ts"])], uses: extra });
  const gained = diffFacts(mk(plain([])), mk(plain([["s.tsx", "endpoint:/api/e2", "http"]])));
  assert.equal(gained.reach.generated, false);
  assert.deepEqual(gained.reach.gained.map((g) => g.fact.id), ["endpoint:/api/e2"]);
});

test("reach: a generated client does not hide a hand-written gain of something else", () => {
  const files = { "client/sdk.gen.ts": { loc: 80, gen: 1 } };
  const base = {
    facts: [fact("screen:/home", ["s.tsx"]), fact("endpoint:/api/e1", ["api/e1.ts"]), fact("service:email", ["lib/m.ts"])],
    files,
    imports: [["s.tsx", "client/sdk.gen.ts"]],
    uses: [["client/sdk.gen.ts", "endpoint:/api/e1", "http"], ["lib/m.ts", "service:email", "package"]],
  };
  const c = diffFacts(mk(base), mk({ ...base, imports: [...base.imports, ["s.tsx", "lib/m.ts"]] }));
  assert.equal(c.reach.generated, true);
  assert.deepEqual(c.reach.gained.map((g) => g.fact.id), ["service:email"]);
});

test("reach: a fact a generated client still reaches is neither lost nor newly gained", () => {
  const gen = { "client/sdk.gen.ts": { loc: 80, gen: 1 } };
  const pay = fact("service:payments", ["lib/pay.ts"], meta({ vendor: ["stripe"] }));
  const useLib = [["lib/pay.ts", "service:payments", "package"]];
  const direct = mk({ facts: [fact("screen:/home", ["s.tsx"]), pay], files: gen, imports: [["s.tsx", "lib/pay.ts"], ["client/sdk.gen.ts", "lib/pay.ts"]], uses: useLib });
  const viaClient = mk({ facts: [fact("screen:/home", ["s.tsx"]), pay], files: gen, imports: [["s.tsx", "client/sdk.gen.ts"], ["client/sdk.gen.ts", "lib/pay.ts"]], uses: useLib });
  const lost = diffFacts(direct, viaClient);
  assert.equal(lost.reach.generated, true);
  assert.deepEqual(lost.reach.lost, [], "only the generated route to it is left, but it is still there");
  assert.deepEqual(lost.notOnScreen, []);
  const gained = diffFacts(viaClient, direct);
  assert.deepEqual(gained.reach.gained, [], "it could be reached before, just not provably");
});

test("reach: a moved screen is compared with its old self, not counted as lost and gained", () => {
  const svc = [fact("service:sign-in", ["lib/auth.ts"], meta({ vendor: ["clerk"] }))];
  const uses = [["lib/auth.ts", "service:sign-in", "package"]];
  const before = mk({ facts: [fact("screen:/settings", ["settings/page.tsx"]), ...svc], files: { "settings/page.tsx": 15 }, imports: [["settings/page.tsx", "lib/auth.ts"]], uses });
  const after = mk({ facts: [fact("screen:/preferences", ["preferences/page.tsx"]), ...svc], files: { "preferences/page.tsx": 15 }, imports: [["preferences/page.tsx", "lib/auth.ts"]], uses });
  const c = diffFacts(before, after);
  assert.equal(c.moved[0].how, "same-shape");
  assert.deepEqual(c.reach, { gained: [], lost: [], generated: false });
  assert.deepEqual(c.notOnScreen, []);
  // a moved screen that also picks up something new is a gain on the new id
  const b2 = mk({ facts: [fact("screen:/a/plan", ["a/plan.tsx"]), ...svc], files: { "a/plan.tsx": 11 }, uses });
  const a2 = mk({ facts: [fact("screen:/plan", ["plan.tsx"]), ...svc], files: { "plan.tsx": 12 }, imports: [["plan.tsx", "lib/auth.ts"]], uses });
  const c2 = diffFacts(b2, a2);
  assert.equal(c2.moved[0].how, "same-name");
  assert.deepEqual(c2.reach.gained.map((g) => [g.fact.id, g.screens.map((s) => s.id)]), [["service:sign-in", ["screen:/plan"]]]);
});

test("reach: a request that became a cron job is a move, not something a screen lost", () => {
  const before = mk({ facts: [fact("screen:/home", ["s.tsx"]), fact("endpoint:/api/cron/x", ["api/cron/x.ts"])], uses: [["s.tsx", "endpoint:/api/cron/x", "http"]] });
  const after = mk({ facts: [fact("screen:/home", ["s.tsx"]), fact("job:/api/cron/x", ["api/cron/x.ts"], meta({ schedule: "0 8 * * 1" }))] });
  const c = diffFacts(before, after);
  assert.equal(c.moved[0].how, "same-slot");
  assert.deepEqual(c.reach.lost, [], "a job is not something a screen uses");
  assert.deepEqual(c.reach.gained, []);
});

test("reach: a moved fact keeps its place; a screen that stops reaching a service loses it", () => {
  const e = (id, file) => fact(`endpoint:${id}`, [file], meta({ methods: ["GET"] }));
  const before = mk({ facts: [fact("screen:/home", ["s.tsx"]), e("/api/old/things", "api/old.ts")], uses: [["s.tsx", "endpoint:/api/old/things", "http"]], files: { "api/old.ts": 31 } });
  const after = mk({ facts: [fact("screen:/home", ["s.tsx"]), e("/api/things", "api/new.ts")], uses: [["s.tsx", "endpoint:/api/things", "http"]], files: { "api/new.ts": 44 } });
  const c = diffFacts(before, after);
  assert.equal(c.moved[0].how, "same-name");
  assert.deepEqual(c.reach.gained, [], "the endpoint moved, the screen still calls it");
  assert.deepEqual(c.reach.lost, []);

  const pay = { facts: [fact("screen:/home", ["s.tsx"]), fact("job:/api/cron/x", ["cron.ts"]), fact("service:payments", ["lib/pay.ts"])], uses: [["lib/pay.ts", "service:payments", "package"]] };
  const had = mk({ ...pay, imports: [["s.tsx", "lib/pay.ts"], ["cron.ts", "lib/pay.ts"]] });
  const none = mk({ ...pay, imports: [["cron.ts", "lib/pay.ts"]] });
  const lost = diffFacts(had, none);
  assert.deepEqual(lost.reach.lost.map((l) => [l.fact.id, l.screens.map((s) => s.id)]), [["service:payments", ["screen:/home"]]]);
  assert.deepEqual(lost.notOnScreen.map((n) => [n.fact.id, n.why, n.usedByJobs.map((j) => j.id)]), [["service:payments", "disconnected", ["job:/api/cron/x"]]]);
});

/* ───────────── size ───────────── */

test("size: files and lines exclude generated files", () => {
  const f = (gen) => mk({ facts: [fact("screen:/a", ["a.tsx"])], files: { "a.tsx": 30, "client.gen.ts": { loc: 500, gen: 1 }, "b.ts": gen }, uses: [] });
  const c = diffFacts(f(10), f(50));
  assert.deepEqual(c.size.files, { before: 2, after: 2 });
  assert.deepEqual(c.size.loc, { before: 40, after: 80 });
});

// Each directory d<i> is its own leaf area holding one file.
function areas(sizes, { namePrefix = "Area " } = {}) {
  const facts = Object.keys(sizes).flatMap((d) => [area(d, { leaf: true, name: namePrefix + d })]);
  const files = {};
  for (const [d, loc] of Object.entries(sizes)) if (loc > 0) files[`${d}/f.ts`] = { loc, area: `area:${d}` };
  return { facts, files };
}

test("size.areas: at least 20% and 50 lines; a new area needs only 50 lines", () => {
  const c = diffFacts(
    mk(areas({ a: 100, b: 1000, c: 100, d: 1000, e: 0, f: 0, g: 200 })),
    mk(areas({ a: 115, b: 1040, c: 160, d: 1055, e: 60, f: 40, g: 200 })),
  );
  assert.deepEqual(c.size.areas.map((a) => [a.name, a.before, a.after, a.delta]), [["Area c", 100, 160, 60], ["Area e", 0, 60, 60]]);
});

test("size.areas: the three that grew most and the two that shrank most", () => {
  const before = { g1: 100, g2: 100, g3: 100, g4: 100, g5: 100, s1: 400, s2: 400, s3: 400, s4: 400 };
  const after = { g1: 200, g2: 300, g3: 400, g4: 500, g5: 600, s1: 300, s2: 200, s3: 100, s4: 150 };
  const c = diffFacts(mk(areas(before)), mk(areas(after)));
  assert.deepEqual(c.size.areas.map((a) => [a.name, a.delta]), [["Area g5", 500], ["Area g4", 400], ["Area g3", 300], ["Area s4", -250], ["Area s3", -300]]);
});

test("size.areas: the leaf sets of the two scans differ, the buckets stay the same", () => {
  const side = (leaf, extra = {}) =>
    mk({
      facts: [
        area("app", { leaf: leaf === "coarse", name: "Main app" }),
        area("app/a", { leaf: leaf === "fine", name: "Alpha" }),
        area("app/b", { leaf: leaf === "fine", name: "Beta" }),
        area("lib", { leaf: true, name: "Inner workings" }),
      ],
      files: { "app/a/x.ts": { loc: 100, area: "area:app/a" }, "app/b/y.ts": { loc: 100, area: "area:app/b" }, "lib/z.ts": { loc: 100, area: "area:lib" }, ...extra },
    });
  const c = diffFacts(side("coarse"), side("fine", { "app/b/y.ts": { loc: 200, area: "area:app/b" }, "lib/w.ts": { loc: 100, area: "area:lib" } }));
  assert.deepEqual(c.size.areas.map((a) => [a.name, a.before, a.after]), [["Inner workings", 100, 200], ["Main app", 200, 300]], "app/a and app/b fold into app");
  // and the whole-app root is left out while any other leaf exists
  const rooted = mk({ facts: [area(".", { leaf: true, name: "Pantry" }), area("lib", { leaf: true, name: "Inner workings" })], files: { "top.ts": { loc: 10, area: "area:." }, "lib/a.ts": { loc: 10, area: "area:lib" } } });
  const grown = mk({ facts: [area(".", { leaf: true, name: "Pantry" }), area("lib", { leaf: true, name: "Inner workings" })], files: { "top.ts": { loc: 300, area: "area:." }, "lib/a.ts": { loc: 10, area: "area:lib" } } });
  assert.deepEqual(diffFacts(rooted, grown).size.areas.map((a) => a.name), ["Pantry"], "a file under no leaf falls back to its recorded area");
});

test("size.areas: names merge, and a big shrink is worth a look", () => {
  const side = (a, b) => mk({ facts: [area("app", { leaf: true, name: "Recipes" }), area("lib", { leaf: true, name: "Recipes" }), area("old", { leaf: true, name: "Old stuff" })], files: { "app/a.ts": { loc: a, area: "area:app" }, "lib/b.ts": { loc: a, area: "area:lib" }, "old/c.ts": { loc: b, area: "area:old" } } });
  const c = diffFacts(side(100, 200), side(150, 80));
  assert.deepEqual(c.size.areas.map((a) => [a.name, a.before, a.after]), [["Recipes", 200, 300], ["Old stuff", 200, 80]]);
  assert.deepEqual(c.worthALook.filter((w) => w.code === "big-shrink"), [{ code: "big-shrink", name: "Old stuff", before: 200, after: 80 }]);
  const mild = diffFacts(side(100, 200), side(100, 120));
  assert.deepEqual(mild.worthALook, [], "a 40% loss is not a big shrink");
});

test("capped: a scan that hit the file cap makes no size-by-area claims", () => {
  const many = {};
  for (let i = 0; i < 19000; i++) many[`gen/f${i}.ts`] = { loc: 1, area: "area:gen" };
  const mkBig = (extra) => mk({ facts: [area("gen", { leaf: true }), area("x", { leaf: true })], files: { ...many, ...extra } });
  const c = diffFacts(mkBig({}), mkBig({ "x/big.ts": { loc: 500, area: "area:x" } }));
  assert.deepEqual(c.size.areas, []);
  assert.deepEqual(c.notes.filter((n) => n.code === "capped"), [{ code: "capped", side: "both" }]);
  assert.equal(c.size.files.after, 19001, "the totals are still there");
  const small = diffFacts(mk({ facts: [area("x", { leaf: true })], files: { "x/a.ts": { loc: 10, area: "area:x" } } }), mk({ facts: [area("x", { leaf: true })], files: { "x/a.ts": { loc: 500, area: "area:x" } } }));
  assert.equal(small.notes.some((n) => n.code === "capped"), false);
  assert.equal(small.size.areas.length, 1);
});

/* ───────────── empty, notes ───────────── */

test("empty baseline: everything is new, and the note says why", () => {
  const empty = mk({ facts: [], files: { "README.md": 3 } });
  const c = diffFacts(empty, mk(world()));
  assert.equal(c.before.empty, true);
  assert.equal(c.after.empty, false);
  assert.equal(c.added.length, 5);
  assert.ok(c.notes.some((n) => n.code === "empty-baseline"));
  assert.equal(c.worthALook.some((w) => w.code === "went-empty"), false);
});

test("went empty: the other direction is worth a look", () => {
  const empty = mk({ facts: [], files: { "README.md": 3 } });
  const c = diffFacts(mk(world()), empty);
  assert.equal(c.after.empty, true);
  assert.equal(c.removed.length, 5);
  assert.equal(c.worthALook[0].code, "went-empty");
  assert.equal(c.notes.some((n) => n.code === "empty-baseline"), false);
});

test("notes: different repo names, and unrelated projects", () => {
  const a = mk({ ...world(), name: "pantry" });
  const b = mk({ ...world(), name: "pantry-copy" });
  assert.deepEqual(diffFacts(a, b).notes, [{ code: "repo-name-differs", before: "pantry", after: "pantry-copy" }]);
  assert.equal(diffFacts(a, b).same, false, "the hash covers the name");

  const other = mk({ facts: [fact("screen:/x", ["zzz/x.tsx"]), fact("screen:/y", ["zzz/y.tsx"])] });
  const u = diffFacts(a, other);
  assert.deepEqual(u.notes.find((n) => n.code === "unrelated"), { code: "unrelated", shared: 0 });
  assert.equal(diffFacts(a, mk({ ...world(), name: "pantry" })).notes.some((n) => n.code === "unrelated"), false);
  // growing from a small app is not "unrelated": the smaller scan's files are all still there
  const grown = mk({ ...world(), files: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`more/f${i}.ts`, 5])) });
  assert.equal(diffFacts(a, grown).notes.some((n) => n.code === "unrelated"), false);
});

test("notes: a caller's own note (first-save-after-date) is kept, in order", () => {
  const a = mk(world());
  const c = diffFacts(a, a, { notes: [{ code: "first-save-after-date", date: "2026-10-05" }, null, { nocode: 1 }] });
  assert.deepEqual(c.notes, [{ code: "first-save-after-date", date: "2026-10-05" }]);
});

test("scanner-drift: a fact came or went though every file that defines it reads as before", () => {
  const files = { "api/x.ts": 20, "app/a.tsx": 30 };
  const before = mk({ facts: [fact("screen:/a", ["app/a.tsx"])], files });
  const after = mk({ facts: [fact("screen:/a", ["app/a.tsx"]), fact("endpoint:/api/x", ["api/x.ts"])], files });
  const c = diffFacts(before, after);
  assert.deepEqual(c.notes.find((n) => n.code === "scanner-drift"), { code: "scanner-drift", ids: ["endpoint:/api/x"] });
  // a new file is a real change
  const real = mk({ facts: [fact("screen:/a", ["app/a.tsx"]), fact("endpoint:/api/x", ["api/x.ts"])], files: { ...files, "api/x.ts": 21 } });
  assert.equal(diffFacts(before, real).notes.some((n) => n.code === "scanner-drift"), false, "one line differs");
  const brand = mk({ facts: [fact("screen:/a", ["app/a.tsx"]), fact("endpoint:/api/y", ["api/y.ts"])], files });
  assert.equal(diffFacts(before, brand).notes.some((n) => n.code === "scanner-drift"), false, "a file that did not exist before");
});

/* ───────────── parts (posters) ───────────── */

const partsWorld = (extraFacts = [], extraFiles = {}, drop = []) =>
  mk({
    facts: [
      fact("screen:/home", ["app/home.tsx"]),
      fact("table:User", ["prisma/schema.prisma"]),
      fact("table:Recipe", ["prisma/schema.prisma"]),
      area("lib", { leaf: true, name: "Inner workings" }),
      ...extraFacts,
    ].filter((f) => !drop.includes(f.id)),
    files: { "lib/core.ts": 20, ...extraFiles },
  });
const PARTS = [P("What you see", "screens", ["screen:**"]), P("Saved recipes", "data", ["table:*"]), P("Plumbing", "feature", ["area:lib"])];

test("parts: items carry the part that cites them, else the part that owns their file", () => {
  const before = partsWorld();
  const after = partsWorld(
    [fact("screen:/billing", ["app/billing.tsx"]), fact("endpoint:/api/x", ["lib/x.ts"]), fact("service:payments", ["pay/pay.ts"])],
    {},
    ["table:Recipe"],
  );
  const c = diffFacts(before, after, { parts: PARTS });
  const added = Object.fromEntries(c.added.map((i) => [i.id, i.part]));
  assert.deepEqual(added, { "endpoint:/api/x": "Plumbing", "screen:/billing": "What you see", "service:payments": undefined }, "the endpoint's file sits under the cited area lib");
  assert.equal(c.removed[0].id, "table:Recipe");
  assert.equal(c.removed[0].part, "Saved recipes", "a removed item is tagged from the before side");
  assert.equal("part" in c.added.find((i) => i.id === "service:payments"), false);
  assert.deepEqual(c.posters.uncited, ["service:payments"]);
  assert.deepEqual(c.posters.unwired, []);
  assert.equal(c.posters.stale, true, "the screens part counts one more now");
});

test("parts: stale compares with the hash the poster was drawn from, when there is one", () => {
  const before = partsWorld();
  const after = partsWorld([fact("screen:/billing", ["app/billing.tsx"])]);
  assert.equal(diffFacts(before, after, { parts: PARTS, wiringFactsHash: after.hash }).posters.stale, false, "drawn from the after scan");
  assert.equal(diffFacts(before, after, { parts: PARTS, wiringFactsHash: before.hash }).posters.stale, true);
  assert.equal(diffFacts(before, after, { parts: PARTS, labels: { wiringFacts: before.hash } }).posters.stale, true, "also through labels");
  // no hash to go by: does the drawing differ between the scans?
  assert.equal(diffFacts(before, before, { parts: PARTS }).posters.stale, false);
  assert.equal(diffFacts(before, after, { parts: PARTS }).posters.stale, true);
});

test("parts: a part that cites something that is gone is unwired", () => {
  const before = partsWorld();
  const after = partsWorld([], {}, ["table:User", "table:Recipe"]);
  const c = diffFacts(before, after, { parts: PARTS });
  assert.equal(c.posters.unwired.length, 1);
  assert.match(c.posters.unwired[0], /"table:\*" matches nothing/);
  assert.equal(c.posters.stale, true);
  // without parts there is no posters field, and no part on any item
  const plain = diffFacts(before, after);
  assert.equal(plain.posters, undefined);
  assert.ok(plain.removed.every((i) => !("part" in i)));
});

/* ───────────── briefing: the voice ───────────── */

// Every string a person reads in a doc built without receipts.
function lines(doc) {
  return [doc.title, doc.lede, doc.short, doc.footer, ...doc.numbers.map((n) => n.text), ...doc.sections.flatMap((s) => [s.title, ...s.items.map((i) => i.text)])].filter(Boolean);
}
const noJargon = (doc) => {
  for (const l of lines(doc)) assert.ok(!isJargon(l), `jargon in: ${l}`);
};

test("describeCron: the common patterns, else 'on a schedule'", () => {
  const cases = [
    ["*/15 * * * *", "every 15 minutes"],
    ["* * * * *", "every minute"],
    ["*/1 * * * *", "every minute"],
    ["0 * * * *", "every hour"],
    ["30 * * * *", "every hour"],
    ["0 */6 * * *", "every 6 hours"],
    ["5 9 * * *", "every day at 09:05"],
    ["0 8 * * 1", "every Monday at 08:00"],
    ["0 17 * * 5", "every Friday at 17:00"],
    ["0 0 * * 0", "every Sunday at 00:00"],
    ["0 0 * * 7", "every Sunday at 00:00"],
    ["30 9 * * MON", "every Monday at 09:30"],
    ["30 9 * * 1-5", "every weekday at 09:30"],
    ["0 8 1 * *", "monthly on day 1 at 08:00"],
    ["0 8 1 6 *", "on a schedule"],
    ["0 8 * * 1,3", "on a schedule"],
    ["@daily", "on a schedule"],
    ["0 8 * *", "on a schedule"],
    ["61 8 * * 1", "on a schedule"],
    [undefined, "on a schedule"],
    ["", "on a schedule"],
  ];
  for (const [expr, want] of cases) assert.equal(describeCron(expr), want, String(expr));
});

test("SERVICE_VERBS has a phrase for every service the scanner can name", () => {
  assert.deepEqual(Object.keys(SERVICE_VERBS).sort(), Object.keys(SERVICE_NAMES).sort());
  for (const [key, verb] of Object.entries(SERVICE_VERBS)) assert.ok(verb && !isJargon(verb), key);
});

test("methodVerbs: look up, add, change, remove; once each, in that order", () => {
  assert.deepEqual(methodVerbs(["DELETE", "GET", "PATCH", "POST", "PUT"]), ["look up", "add", "change", "remove"]);
  assert.deepEqual(methodVerbs(["OPTIONS", "HEAD"]), []);
  assert.deepEqual(methodVerbs(undefined), []);
  assert.deepEqual(methodVerbs(["post", "get"]), ["look up", "add"]);
});

test("vendorName: known companies get their own spelling, the rest are sentence case", () => {
  assert.equal(vendorName("stripe"), "Stripe");
  assert.equal(vendorName("lemonsqueezy"), "Lemon Squeezy");
  assert.equal(vendorName("sendgrid"), "SendGrid");
  assert.equal(vendorName("openai"), "OpenAI");
  assert.equal(vendorName("twilio"), "Twilio");
  assert.equal(vendorName("some-new-vendor"), "Some new vendor");
});

test("plainName: a name with a banned word gets the plain one", () => {
  assert.equal(plainName("Recipes"), "Recipes");
  assert.equal(plainName("API keys"), "request keys");
  assert.equal(plainName("Table settings"), "list settings");
  assert.equal(plainName("Webhook handler"), "notice handler");
  assert.equal(plainName("Repo stats"), "project stats");
  for (const n of ["API keys", "Table settings", "Webhook handler", "Repo stats", "Schema", "Deployments"]) assert.ok(!isJargon(plainName(n)), n);
});

test("buildBriefing: the same scan says 'Nothing changed.'", () => {
  const a = mk(world());
  const doc = buildBriefing(diffFacts(a, a));
  assert.equal(doc.short, "Nothing changed.");
  assert.deepEqual(doc.sections, []);
  assert.equal(doc.title, "What changed");
  assert.equal(renderText(doc), "What changed\n\nComparing two scans of pantry.\n\nNothing changed.\n");
  noJargon(doc);
  assert.throws(() => buildBriefing({}), /expected a Changes/);
});

test("buildBriefing: a change that is not structural says so honestly, and gives the size", () => {
  const b = mk({ facts: [fact("screen:/a", ["a.tsx"])], files: { "a.tsx": 10 } });
  const a = mk({ facts: [fact("screen:/a", ["a.tsx"])], files: { "a.tsx": 14 } });
  const doc = buildBriefing(diffFacts(b, a, { labels: { before: "your last saved version (a1b2c3d, 2026-10-07)", after: "your files right now" } }));
  assert.equal(doc.short, "Nothing structural changed: same screens, saved records, outside services, AI and jobs. (I can't see wording, colour or settings changes.)");
  assert.equal(doc.lede, "Since your last saved version (a1b2c3d, 2026-10-07) · compared with your files right now.");
  assert.deepEqual(doc.sections.map((s) => s.id), ["size"]);
  assert.equal(doc.sections[0].items[0].text, "Your app is 4 lines bigger (+40%).");
  assert.ok(!/no changes|nothing (?:that|you)/i.test(renderText(doc)), "never claims no visible change");
  noJargon(doc);
});

test("buildBriefing: sizes in words", () => {
  const sized = (files, loc, areasList = []) => buildBriefing({ kind: "changes", version: 1, before: { empty: false, repo: "x" }, after: { empty: false, repo: "x" }, same: false, structural: false, counts: Object.fromEntries(["screen", "endpoint", "table", "service", "ai", "job"].map((k) => [k, { before: 0, after: 0, added: 0, removed: 0 }])), added: [], removed: [], moved: [], changed: [], reach: { gained: [], lost: [], generated: false }, notOnScreen: [], worthALook: [], notes: [], size: { files: { before: 10, after: 10 + files }, loc: { before: 1000, after: 1000 + loc }, areas: areasList } }).sections.find((s) => s.id === "size").items[0].text;
  assert.equal(sized(14, 1240, [{ name: "Billing", before: 0, after: 420, delta: 420 }]), "Your app is 14 files and 1,240 lines bigger (+124%). Grew most: Billing (+420).");
  assert.equal(sized(-3, -120, [{ name: "Old stuff", before: 200, after: 80, delta: -120 }]), "Your app is 3 files and 120 lines smaller (−12%). Shrank most: Old stuff (−120).");
  assert.equal(sized(1, 0), "Your app is 1 file bigger.");
  assert.equal(sized(2, -30), "Your app has 2 more files but 30 fewer lines (−3%).");
  assert.equal(sized(0, 0), "Your app is the same size.");
});

test("buildBriefing: a structural change, in the voice of the plan", () => {
  const before = mk({
    facts: [
      fact("screen:/home", ["app/home.tsx"]),
      fact("screen:/plan", ["app/plan.tsx"]),
      fact("table:User", ["prisma/schema.prisma"]),
      fact("table:Ingredient", ["prisma/schema.prisma"]),
      fact("service:email", ["lib/mail.ts"], meta({ vendor: ["resend"] })),
      fact("ai:openai", ["lib/ai.ts"], meta({ vendor: ["openai"], tools: 2 })),
      fact("job:/api/cron/weekly", ["api/cron/weekly.ts"], { name: "Weekly plan", ...meta({ schedule: "0 8 * * 1" }) }),
    ],
    files: { "app/home.tsx": 20, "app/plan.tsx": 30, "lib/ai.ts": 17, "prisma/schema.prisma": 40 },
    imports: [["api/cron/weekly.ts", "lib/mail.ts"]],
    uses: [["lib/mail.ts", "service:email", "package"], ["lib/ai.ts", "ai:openai", "package"]],
  });
  const after = mk({
    facts: [
      fact("screen:/home", ["app/home.tsx"]),
      fact("screen:/plan", ["app/plan.tsx"]),
      fact("screen:/billing", ["app/billing.tsx"]),
      fact("table:User", ["prisma/schema.prisma"]),
      fact("service:email", ["lib/mail.ts"], meta({ vendor: ["resend"] })),
      fact("service:text-messages", ["lib/sms.ts"], meta({ vendor: ["twilio"] })),
      fact("ai:openai", ["lib/ai.ts"], meta({ vendor: ["openai"], tools: 2 })),
      fact("job:/api/cron/weekly", ["api/cron/weekly.ts"], { name: "Weekly plan", ...meta({ schedule: "0 17 * * 5" }) }),
    ],
    files: { "app/home.tsx": 20, "app/plan.tsx": 31, "app/billing.tsx": 44, "lib/ai.ts": 17, "prisma/schema.prisma": 31 },
    imports: [["api/cron/weekly.ts", "lib/mail.ts"], ["app/plan.tsx", "lib/ai.ts"]],
    uses: [["lib/mail.ts", "service:email", "package"], ["lib/ai.ts", "ai:openai", "package"], ["lib/sms.ts", "service:text-messages", "package"]],
  });
  const c = diffFacts(before, after, { labels: { before: "your last saved version (a1b2c3d, 2026-10-07)", after: "your files right now" } });
  const doc = buildBriefing(c);
  const text = renderText(doc);
  const sec = (id) => doc.sections.find((s) => s.id === id)?.items.map((i) => i.text);

  assert.equal(doc.title, "What changed");
  assert.equal(doc.lede, "Since your last saved version (a1b2c3d, 2026-10-07) · compared with your files right now.");
  assert.equal(doc.short, "1 new screen, 1 new outside service, OpenAI is now used from the Plan screen, 1 saved record was removed, and 1 other change.".replace("OpenAI", "the AI"));
  assert.deepEqual(doc.numbers.map((n) => n.text), [
    "Screens 2 → 3 (+1)",
    "Saved records 2 → 1 (−1)",
    "Outside services 1 → 2 (+1)",
    "AI 1 (no change)",
    "Background jobs 1 (no change)",
    "Requests 0 (no change)",
  ]);
  assert.deepEqual(sec("new"), ["The Billing screen is new.", "Text messages (Twilio): your app can now send text messages."]);
  assert.deepEqual(sec("gone"), ["The saved record Ingredient is gone."]);
  assert.deepEqual(sec("changed"), ["The Weekly plan job now runs every Friday at 17:00 (it used to run every Monday at 08:00)."]);
  assert.deepEqual(sec("connected"), ["OpenAI is now used from the Plan screen."]);
  assert.deepEqual(sec("offscreen"), ["Text messages (Twilio) is in the code, but no screen seems to lead to it yet."]);
  assert.deepEqual(sec("look"), [
    "Ingredient (saved data) was removed. Anything stored in it may be lost if you publish this.",
    "Text messages (Twilio) is new. It needs an account and keys, and it may cost money.",
  ]);
  assert.match(sec("size")[0], /^Your app is 2 files and \d+ lines bigger/);
  assert.deepEqual(doc.sections.map((s) => s.id), ["new", "gone", "changed", "connected", "offscreen", "look", "size"]);
  assert.ok(doc.sections.filter((s) => s.id === "look")[0].items.every((i) => i.flag === true), "worth-a-look lines are flagged");
  assert.ok(!/doesn't work|does not work/i.test(text), "'no screen seems to lead to it', never 'doesn't work'");
  assert.ok(doc.sections.every((s) => s.items.every((i) => !("where" in i))), "no paths without receipts");
  assert.ok(!/\.tsx|\.ts\b|\.prisma|app\/|lib\//.test(text), "no file paths without receipts");
  noJargon(doc);
});

test("buildBriefing: counts in the short version and the numbers come from the Changes", () => {
  const w = world();
  const before = mk({ ...w, facts: w.facts.filter((f) => f.kind !== "table") });
  const after = mk({
    ...w,
    facts: [...w.facts, fact("screen:/a", ["a.tsx"]), fact("screen:/b", ["b.tsx"]), fact("screen:/c", ["c.tsx"]), fact("job:/api/cron/j", ["j.ts"], meta({ schedule: "*/5 * * * *" }))],
    files: { ...w.files, "a.tsx": 21, "b.tsx": 22, "c.tsx": 23, "j.ts": 24 },
  });
  const c = diffFacts(before, after);
  const doc = buildBriefing(c);
  const n = (re) => Number(re.exec(doc.short)?.[1]);
  assert.equal(n(/(\d+) new screens/), kinds(c.added, "screen").length);
  assert.equal(n(/(\d+) new background job/), kinds(c.added, "job").length);
  for (const row of doc.numbers) {
    const k = c.counts[row.kind];
    assert.equal(row.before, k.before);
    assert.equal(row.after, k.after);
    assert.equal(row.delta, k.after - k.before);
  }
  // "N other changes" = every counted change that no clause covered
  const total = c.added.length + c.removed.length + c.moved.length + c.changed.length + c.reach.gained.length + c.reach.lost.length;
  const covered = kinds(c.added, "screen").length + kinds(c.added, "job").length;
  const other = /(\d+) other change/.exec(doc.short);
  assert.equal(other ? Number(other[1]) : 0, total - covered);
  noJargon(doc);
});

test("buildBriefing: the short version has at most four clauses, in priority order; the rest is 'other changes'", () => {
  const pay = fact("service:payments", ["lib/pay.ts"], meta({ vendor: ["stripe"] }));
  const useLib = [["lib/pay.ts", "service:payments", "package"]];
  const before = mk({ facts: [fact("screen:/home", ["home.tsx"]), fact("screen:/old", ["old.tsx"]), fact("table:T", ["s.prisma"]), pay], files: { "old.tsx": 8 }, uses: useLib });
  const after = mk({
    facts: [fact("screen:/home", ["home.tsx"]), fact("screen:/new", ["new.tsx"]), pay, fact("ai:openai", ["lib/ai.ts"], meta({ vendor: ["openai"] })), fact("job:/api/cron/j", ["j.ts"])],
    files: { "new.tsx": 9 },
    imports: [["home.tsx", "lib/pay.ts"]],
    uses: [...useLib, ["lib/ai.ts", "ai:openai", "package"]],
  });
  const c = diffFacts(before, after);
  const doc = buildBriefing(c);
  // five kinds of news, room for four: the new job waits in "other"
  assert.equal(doc.short, "1 new screen, a new AI provider, Payments is now used from the Home screen, 1 screen and 1 saved record were removed, and 1 other change.");
  assert.deepEqual(kinds(c.added, "job").length, 1);
  assert.equal(doc.sections.find((s) => s.id === "new").items.length, 3, "the section lists everything the short version leaves out");
});

test("buildBriefing: many of one kind collapse into one line", () => {
  const empty = mk({ facts: [fact("screen:/home", ["h.tsx"])] });
  const many = Array.from({ length: 9 }, (_, i) => fact(`screen:/s${i}`, [`s${i}.tsx`], { name: `Screen ${i}` }));
  const doc = buildBriefing(diffFacts(empty, mk({ facts: [fact("screen:/home", ["h.tsx"]), ...many], files: Object.fromEntries(many.map((f, i) => [f.files[0], 10 + i])) })));
  const items = doc.sections.find((s) => s.id === "new").items;
  assert.equal(items.length, 1);
  assert.equal(items[0].text, "9 screens are new: Screen 0, Screen 1, Screen 2, Screen 3, Screen 4, Screen 5 and 3 more.");
  assert.match(doc.short, /^9 new screens\.$/);
});

test("buildBriefing: moved things read as moves", () => {
  const move = (b, a, extra = {}) => buildBriefing(diffFacts(mk(b), mk(a)), extra).sections.find((s) => s.id === "changed").items.map((i) => i.text);
  assert.deepEqual(
    move({ facts: [fact("screen:/a/plan", ["a.tsx"])], files: { "a.tsx": 11 } }, { facts: [fact("screen:/plan", ["p.tsx"])], files: { "p.tsx": 12 } }),
    ["The Plan screen moved from /a/plan to /plan."],
  );
  assert.deepEqual(
    move({ facts: [fact("screen:/settings", ["a.tsx"])], files: { "a.tsx": 11 } }, { facts: [fact("screen:/preferences", ["p.tsx"])], files: { "p.tsx": 11 } }),
    ["The Settings screen is now the Preferences screen (moved from /settings to /preferences)."],
  );
  assert.deepEqual(
    move({ facts: [fact("table:Recipe", ["s.prisma"]), fact("table:User", ["s.prisma"])] }, { facts: [fact("table:Recipes", ["s.prisma"]), fact("table:User", ["s.prisma"])] }),
    ["The saved record Recipe was renamed Recipes."],
  );
  assert.deepEqual(
    move({ facts: [fact("endpoint:/api/cron/x", ["x.ts"])] }, { facts: [fact("job:/api/cron/x", ["x.ts"], meta({ schedule: "0 8 * * 1" }))] }),
    ["The X request is now a background job: it runs every Monday at 08:00."],
  );
  // an endpoint's path never reaches the page (it says 'api'), a screen's path does
  const lines2 = move({ facts: [fact("endpoint:/api/old/things", ["o.ts"])], files: { "o.ts": 12 } }, { facts: [fact("endpoint:/api/things", ["n.ts"])], files: { "n.ts": 30 } });
  assert.deepEqual(lines2, ["The Things request moved to a new address."]);
});

test("buildBriefing: changed methods, vendors, tools and reworked code", () => {
  const b = mk({
    facts: [
      fact("endpoint:/api/e", ["api/e.ts"], { name: "Recipes", ...meta({ methods: ["GET", "POST"] }) }),
      fact("service:payments", ["lib/pay.ts"], meta({ vendor: ["stripe"] })),
      fact("ai:openai", ["lib/ai.ts"], meta({ vendor: ["openai"], tools: 2 })),
      fact("screen:/r", ["r.tsx"], { name: "Recipes" }),
    ],
    files: { "api/e.ts": 20, "r.tsx": 40 },
  });
  const a = mk({
    facts: [
      fact("endpoint:/api/e", ["api/e.ts"], { name: "Recipes", ...meta({ methods: ["DELETE", "GET", "PATCH"] }) }),
      fact("service:payments", ["lib/pay.ts"], meta({ vendor: ["lemonsqueezy"] })),
      fact("ai:openai", ["lib/ai.ts"], meta({ vendor: ["openai"], tools: 3 })),
      fact("screen:/r", ["r.tsx"], { name: "Recipes" }),
    ],
    files: { "api/e.ts": 20, "r.tsx": 95 },
  });
  const doc = buildBriefing(diffFacts(b, a));
  const changed = doc.sections.find((s) => s.id === "changed").items.map((i) => i.text);
  assert.deepEqual(changed, [
    "The Recipes screen was heavily reworked: its code went from 40 lines to 95 lines.",
    "Payments now goes through Lemon Squeezy instead of Stripe.",
    "OpenAI can now use 3 tools of yours (it used to use 2).",
    "The Recipes request can now change and remove things, but can no longer add things.",
  ]);
  assert.deepEqual(doc.sections.find((s) => s.id === "look").items.map((i) => i.text), [
    "The Recipes request can no longer add things. Anything that asks it to will stop working.",
    "Payments now goes through Lemon Squeezy instead of Stripe. You will need an account and keys for Lemon Squeezy.",
  ]);
  noJargon(doc);
});

test("buildBriefing: no screen seems to lead to it; jobs are named", () => {
  const before = mk({ facts: [fact("screen:/home", ["s.tsx"]), fact("job:/api/cron/weekly", ["cron.ts"], { name: "Weekly plan" })] });
  const after = mk({
    facts: [fact("screen:/home", ["s.tsx"]), fact("job:/api/cron/weekly", ["cron.ts"], { name: "Weekly plan" }), fact("service:email", ["lib/mail.ts"], meta({ vendor: ["resend"] })), fact("table:Invoice", ["s.prisma"]), fact("endpoint:/api/hook", ["hook.ts"], { name: "Hook" })],
    imports: [["cron.ts", "lib/mail.ts"]],
    uses: [["lib/mail.ts", "service:email", "package"]],
  });
  const off = buildBriefing(diffFacts(before, after)).sections.find((s) => s.id === "offscreen").items.map((i) => i.text);
  assert.deepEqual(off, [
    "The saved record Invoice is in the code, but no screen seems to lead to it yet.",
    "Email (Resend) is only used by the Weekly plan job; no screen seems to lead to it yet.",
    "The Hook request is in the code, but no screen seems to lead to it yet.",
  ]);
  // and when something that screens used is cut off
  const had = mk({ facts: [fact("screen:/home", ["s.tsx"]), fact("service:payments", ["lib/pay.ts"], meta({ vendor: ["stripe"] }))], imports: [["s.tsx", "lib/pay.ts"]], uses: [["lib/pay.ts", "service:payments", "package"]] });
  const cut = mk({ facts: [fact("screen:/home", ["s.tsx"]), fact("service:payments", ["lib/pay.ts"], meta({ vendor: ["stripe"] }))], uses: [["lib/pay.ts", "service:payments", "package"]] });
  const doc = buildBriefing(diffFacts(had, cut));
  assert.deepEqual(doc.sections.find((s) => s.id === "gone").items.map((i) => i.text), ["Payments (Stripe) is no longer used from the Home screen."]);
  assert.deepEqual(doc.sections.find((s) => s.id === "offscreen").items.map((i) => i.text), ["No screen seems to lead to Payments (Stripe) any more."]);
});

test("buildBriefing: a mass removal is warned about once, not once per fact", () => {
  const tables = ["A", "B", "C", "D"].map((n) => fact(`table:${n}`, ["s.prisma"]));
  const screens = ["a", "b", "c", "d"].map((n, i) => fact(`screen:/${n}`, [`${n}.tsx`]));
  const before = mk({ facts: [...tables, ...screens, fact("screen:/keep", ["keep.tsx"])], files: { "a.tsx": 11, "b.tsx": 12, "c.tsx": 13, "d.tsx": 14, "keep.tsx": 40 } });
  const after = mk({ facts: [fact("screen:/keep", ["keep.tsx"])], files: { "keep.tsx": 40 } });
  const doc = buildBriefing(diffFacts(before, after));
  const look = doc.sections.find((s) => s.id === "look").items.map((i) => i.text);
  assert.deepEqual(look.slice(0, 2), [
    "4 saved records (A, B, C and D) were removed. Anything stored in them may be lost if you publish this.",
    "4 screens (A, B, C and D) were removed. Anything that links to them will break.",
  ]);
  assert.equal(doc.sections.find((s) => s.id === "gone").items.length, 8, "the Gone section still names each one");
  // three or fewer are told one by one
  const fewer = mk({ facts: [...tables.slice(3), ...screens, fact("screen:/keep", ["keep.tsx"])], files: { "a.tsx": 11, "b.tsx": 12, "c.tsx": 13, "d.tsx": 14, "keep.tsx": 40, "s.prisma": 7 } });
  const few = buildBriefing(diffFacts(before, fewer));
  assert.equal(few.sections.find((s) => s.id === "look").items.length, 3);
});

test("buildBriefing: names with banned words are made plain", () => {
  const b = mk({ facts: [fact("screen:/home", ["h.tsx"])] });
  const a = mk({ facts: [fact("screen:/home", ["h.tsx"]), fact("screen:/keys", ["k.tsx"], { name: "API keys" }), fact("table:Hooks", ["s.prisma"], { name: "Webhook table" })], files: { "k.tsx": 31 } });
  const doc = buildBriefing(diffFacts(b, a));
  noJargon(doc);
  assert.ok(doc.sections.find((s) => s.id === "new").items.some((i) => i.text === "The request keys screen is new."));
});

test("buildBriefing: receipts add where, never change the text", () => {
  const before = mk({ facts: [fact("screen:/home", ["s.tsx"]), fact("service:payments", ["lib/pay.ts"])], uses: [["lib/pay.ts", "service:payments", "package"]] });
  const after = mk({
    facts: [fact("screen:/home", ["s.tsx"]), fact("service:payments", ["lib/pay.ts"]), fact("screen:/billing", ["app/billing.tsx"])],
    imports: [["s.tsx", "lib/pay.ts"]],
    uses: [["lib/pay.ts", "service:payments", "package"]],
  });
  const c = diffFacts(before, after);
  const plain = buildBriefing(c);
  const rec = buildBriefing(c, { receipts: true });
  assert.deepEqual(lines(rec), lines(plain), "same words");
  const where = Object.fromEntries(rec.sections.flatMap((s) => s.items.filter((i) => i.where).map((i) => [i.text, i.where])));
  assert.equal(where["The Billing screen is new."], "app/billing.tsx");
  assert.equal(where["Payments is now used from the Home screen."], "s.tsx → lib/pay.ts ─uses→ service:payments");
  assert.match(renderText(rec), /\n {4}↳ app\/billing\.tsx\n/);
  assert.ok(!/↳/.test(renderText(plain)));
});

test("buildBriefing: without labels it says what it compared", () => {
  const a = mk(world());
  const w = world();
  w.facts.push(fact("screen:/more", ["more.tsx"]));
  const doc = buildBriefing(diffFacts(a, mk(w)));
  assert.equal(doc.lede, "Comparing two scans of pantry.");
  assert.ok(!/\d{1,2}\/\d{1,2}\/\d{2,4}|ago|yesterday|last week/i.test(doc.lede), "absolute dates only");
});

test("buildBriefing: notes are said plainly", () => {
  const a = mk({ ...world(), name: "pantry" });
  const b = mk({ ...world(), name: "other-pantry", facts: [...world().facts, fact("screen:/more", ["more.tsx"])] });
  const doc = buildBriefing(diffFacts(a, b, { notes: [{ code: "first-save-after-date", date: "2026-10-05" }] }));
  const look = doc.sections.find((s) => s.id === "look").items.map((i) => i.text);
  assert.ok(look.includes("These two scans have different names (pantry and other-pantry). Check you compared the right ones."));
  assert.match(doc.lede, /Your first saved version is from 2026-10-05, after the date you asked about, so everything counts as new\.$/);
  noJargon(doc);
});

test("buildBriefing: a generated client is mentioned once, where requests came or went", () => {
  const gen = { loc: 80, gen: 1 };
  const base = (endpoints) => ({
    facts: [fact("screen:/home", ["s.tsx"]), ...endpoints.map((e) => fact(`endpoint:/api/${e}`, [`api/${e}.ts`]))],
    files: { "client/sdk.gen.ts": gen },
    imports: [["s.tsx", "client/sdk.gen.ts"]],
    uses: endpoints.map((e) => ["client/sdk.gen.ts", `endpoint:/api/${e}`, "http"]),
  });
  const doc = buildBriefing(diffFacts(mk(base(["e1"])), mk(base(["e1", "e2"]))));
  const look = doc.sections.find((s) => s.id === "look").items.map((i) => i.text);
  assert.deepEqual(look, ["Your screens reach your requests through code that was generated for you, so I can't tell which screen uses which request."]);
  assert.deepEqual(doc.sections.map((s) => s.id).filter((id) => id === "connected" || id === "offscreen"), [], "no claim either way");
  noJargon(doc);
});

test("buildBriefing: poster lines", () => {
  const before = partsWorld();
  const after = partsWorld([fact("screen:/billing", ["app/billing.tsx"]), fact("service:payments", ["pay/pay.ts"], meta({ vendor: ["stripe"] }))]);
  const doc = buildBriefing(diffFacts(before, after, { parts: PARTS }));
  const look = doc.sections.find((s) => s.id === "look").items.map((i) => i.text);
  assert.ok(look.includes("Your poster is out of date: it was drawn before these changes."));
  assert.ok(look.includes("1 new thing isn't on your poster yet: Payments (Stripe)."));
  noJargon(doc);
});

/* ───────────── the recipe fixture, scanned for real ───────────── */

// Scan copies of the recipe fixture (named "pantry", as the plan's examples are), mutate the "after" copy, and diff.
async function pantry(mutate, { labels } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "changes-test-"));
  try {
    const dirs = ["before", "after"].map((side) => {
      const dir = path.join(tmp, side, "pantry");
      fs.cpSync(path.join(FIX, "recipe"), dir, { recursive: true });
      return dir;
    });
    const api = {
      read: (rel) => fs.readFileSync(path.join(dirs[1], rel), "utf8"),
      write: (rel, text) => {
        fs.mkdirSync(path.dirname(path.join(dirs[1], rel)), { recursive: true });
        fs.writeFileSync(path.join(dirs[1], rel), text);
      },
      rename: (from, to) => fs.renameSync(path.join(dirs[1], from), path.join(dirs[1], to)),
    };
    mutate(api);
    const before = await scanRepo(dirs[0], { useGit: false });
    const after = await scanRepo(dirs[1], { useGit: false });
    return { before, after, changes: diffFacts(before, after, { labels }), tmp };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test("recipe fixture: nothing edited is the same scan", async () => {
  const { changes } = await pantry(() => {});
  assert.equal(changes.same, true);
  assert.equal(changes.structural, false);
  assert.deepEqual(changes.notes, []);
  assert.equal(buildBriefing(changes).short, "Nothing changed.");
});

test("recipe fixture: an added screen", async () => {
  const { changes } = await pantry((fs_) => fs_.write("app/(app)/billing/page.tsx", 'export default function Billing() {\n  return <section>Billing</section>;\n}\n'));
  assert.deepEqual(ids(changes.added), ["screen:/billing"]);
  assert.deepEqual(changes.removed, []);
  assert.deepEqual(changes.counts.screen, { before: 6, after: 7, added: 1, removed: 0 });
  assert.equal(changes.added[0].name, "Billing");
  assert.deepEqual(changes.added[0].files, ["app/(app)/billing/page.tsx"]);
  assert.deepEqual(changes.notes, []);
  assert.equal(JSON.stringify(changes).includes(os.tmpdir()), false, "no absolute paths");
  const doc = buildBriefing(changes);
  assert.equal(doc.short, "1 new screen.");
  assert.deepEqual(doc.sections.find((s) => s.id === "new").items.map((i) => i.text), ["The Billing screen is new."]);
  noJargon(doc);
});

test("recipe fixture: a removed Prisma model is a lost saved record, not a rename", async () => {
  const { changes } = await pantry((fs_) => fs_.write("prisma/schema.prisma", fs_.read("prisma/schema.prisma").replace(/model Ingredient \{[^}]*\}\n\n/, "")));
  assert.deepEqual(ids(changes.removed), ["table:Ingredient"]);
  assert.deepEqual(changes.added, []);
  assert.deepEqual(changes.moved, []);
  assert.deepEqual(changes.counts.table, { before: 4, after: 3, added: 0, removed: 1 });
  assert.deepEqual(changes.worthALook.map((w) => [w.code, w.id]), [["table-removed", "table:Ingredient"]]);
  const doc = buildBriefing(changes);
  assert.equal(doc.short, "1 saved record was removed.");
  assert.deepEqual(doc.sections.find((s) => s.id === "gone").items.map((i) => i.text), ["The saved record Ingredient is gone."]);
  noJargon(doc);
});

test("recipe fixture: a removed model and a new one in the same schema are not a rename", async () => {
  const { changes } = await pantry((fs_) => {
    const schema = fs_.read("prisma/schema.prisma").replace(/model Ingredient \{[^}]*\}\n\n/, "");
    fs_.write("prisma/schema.prisma", `${schema}\nmodel Tag {\n  id String @id\n  label String\n}\n`);
  });
  assert.deepEqual(ids(changes.removed), ["table:Ingredient"]);
  assert.deepEqual(ids(changes.added), ["table:Tag"]);
  assert.deepEqual(changes.moved, []);
  assert.equal(changes.worthALook[0].code, "table-removed");
});

test("recipe fixture: a renamed screen folder is the same shape", async () => {
  const { changes } = await pantry((fs_) => fs_.rename("app/(app)/settings", "app/(app)/preferences"));
  assert.deepEqual([changes.added, changes.removed], [[], []]);
  assert.equal(changes.moved.length, 1);
  assert.equal(changes.moved[0].how, "same-shape");
  assert.deepEqual([changes.moved[0].from.id, changes.moved[0].to.id], ["screen:/settings", "screen:/preferences"]);
  assert.deepEqual(changes.reach, { gained: [], lost: [], generated: false }, "it still reaches Stripe and Clerk");
  assert.deepEqual(changes.notOnScreen, []);
  assert.equal(changes.worthALook.length, 0, "a move is not a loss");
  const doc = buildBriefing(changes);
  assert.deepEqual(doc.sections.find((s) => s.id === "changed").items.map((i) => i.text), ["The Settings screen is now the Preferences screen (moved from /settings to /preferences)."]);
  noJargon(doc);
});

test("recipe fixture: an AI import in the plan page puts OpenAI behind the Plan screen", async () => {
  const { changes } = await pantry((fs_) => fs_.write("app/(app)/plan/page.tsx", `import { suggestRecipes } from "@/lib/ai/suggest";\n${fs_.read("app/(app)/plan/page.tsx")}`));
  assert.deepEqual([changes.added, changes.removed, changes.moved], [[], [], []]);
  assert.equal(changes.reach.gained.length, 1);
  const g = changes.reach.gained[0];
  assert.equal(g.fact.id, "ai:openai");
  assert.deepEqual(g.screens, [{ id: "screen:/plan", name: "Plan" }]);
  assert.deepEqual(g.chain, ["app/(app)/plan/page.tsx", "lib/ai/suggest.ts", "ai:openai"]);
  assert.equal(changes.structural, true);
  const doc = buildBriefing(changes);
  assert.equal(doc.short, "The AI is now used from the Plan screen.");
  assert.deepEqual(doc.sections.find((s) => s.id === "connected").items.map((i) => i.text), ["OpenAI is now used from the Plan screen."]);
  noJargon(doc);
});

test("recipe fixture: an orphan file that imports twilio is a new service no screen leads to", async () => {
  const { changes } = await pantry((fs_) => fs_.write("lib/notify.ts", 'import twilio from "twilio";\n\nexport const sms = twilio("sid", "token");\n'));
  assert.deepEqual(ids(changes.added), ["service:text-messages"]);
  assert.deepEqual(changes.notOnScreen.map((n) => [n.fact.id, n.why, n.usedByJobs]), [["service:text-messages", "new", []]]);
  assert.deepEqual(changes.worthALook.map((w) => w.code), ["service-added"]);
  const doc = buildBriefing(changes);
  assert.equal(doc.short, "1 new outside service.");
  assert.deepEqual(doc.sections.find((s) => s.id === "offscreen").items.map((i) => i.text), ["Text messages (Twilio) is in the code, but no screen seems to lead to it yet."]);
  noJargon(doc);
});

test("recipe fixture: a new cron time in vercel.json is a schedule change", async () => {
  const { changes } = await pantry((fs_) => fs_.write("vercel.json", JSON.stringify({ crons: [{ path: "/api/cron/weekly-plan", schedule: "0 17 * * 5" }] })));
  assert.deepEqual([changes.added, changes.removed, changes.moved], [[], [], []]);
  assert.deepEqual(changes.changed.map((c) => [c.type, c.id, c.before, c.after]), [["schedule", "job:/api/cron/weekly-plan", "0 8 * * 1", "0 17 * * 5"]]);
  const doc = buildBriefing(changes);
  assert.deepEqual(doc.sections.find((s) => s.id === "changed").items.map((i) => i.text), ["The Weekly plan job now runs every Friday at 17:00 (it used to run every Monday at 08:00)."]);
  assert.equal(doc.short, "1 thing changed.", "nothing from the usual list of news, so the line names the change itself");
  noJargon(doc);
});

test("recipe fixture: everything at once reads as the briefing in the plan", async () => {
  const labels = { before: "your last saved version (a1b2c3d, 2026-10-07)", after: "your files right now" };
  const { changes } = await pantry(
    (fs_) => {
      fs_.write("app/(app)/plan/page.tsx", `import { suggestRecipes } from "@/lib/ai/suggest";\n${fs_.read("app/(app)/plan/page.tsx")}`);
      fs_.write("app/(app)/billing/page.tsx", "export default function Billing() {\n  return <section>Billing</section>;\n}\n");
      fs_.write("lib/notify.ts", 'import twilio from "twilio";\n\nexport const sms = twilio("sid", "token");\n');
      fs_.rename("app/(app)/settings", "app/(app)/preferences");
      fs_.write("vercel.json", JSON.stringify({ crons: [{ path: "/api/cron/weekly-plan", schedule: "0 17 * * 5" }] }));
      fs_.write("prisma/schema.prisma", fs_.read("prisma/schema.prisma").replace(/model Ingredient \{[^}]*\}\n\n/, ""));
    },
    { labels },
  );
  const doc = buildBriefing(changes);
  assert.equal(doc.short, "1 new screen, 1 new outside service, the AI is now used from the Plan screen, 1 saved record was removed, and 2 other changes.");
  assert.deepEqual(
    doc.numbers.map((n) => n.text),
    ["Screens 6 → 7 (+1)", "Saved records 4 → 3 (−1)", "Outside services 3 → 4 (+1)", "AI 1 (no change)", "Background jobs 1 (no change)", "Requests 3 (no change)"],
  );
  assert.deepEqual(doc.sections.map((s) => s.id), ["new", "gone", "changed", "connected", "offscreen", "look", "size"]);
  noJargon(doc);
  // run twice: identical bytes
  const again = await pantry(() => {}, { labels });
  assert.equal(JSON.stringify(again.changes), JSON.stringify((await pantry(() => {}, { labels })).changes));
  // the receipts name real files
  const rec = buildBriefing(changes, { receipts: true });
  assert.ok(rec.sections.flatMap((s) => s.items).some((i) => i.where === "app/(app)/plan/page.tsx → lib/ai/suggest.ts ─uses→ ai:openai"));
});

test("recipe fixture: from an empty app, the briefing says where the app stands", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "changes-test-"));
  try {
    const emptyDir = path.join(tmp, "empty", "pantry");
    fs.cpSync(path.join(FIX, "empty"), emptyDir, { recursive: true });
    const fullDir = path.join(tmp, "full", "pantry");
    fs.cpSync(path.join(FIX, "recipe"), fullDir, { recursive: true });
    const empty = await scanRepo(emptyDir, { useGit: false });
    const full = await scanRepo(fullDir, { useGit: false });
    assert.equal(empty.empty, true);
    const c = diffFacts(empty, full, { labels: { after: "your files right now" } });
    assert.deepEqual(c.notes.map((n) => n.code), ["empty-baseline"]);
    const doc = buildBriefing(c);
    assert.equal(doc.title, "Where your app stands now");
    assert.equal(doc.lede, "This is everything the scan found in your files right now.");
    assert.equal(doc.short, "Your app has 6 screens, 4 saved records, 3 outside services, 1 AI provider, 1 background job, and 3 requests.");
    assert.deepEqual(doc.sections.map((s) => s.id), ["now", "offscreen", "size"], "no flood of 'new', 'worth a look' or 'connected'");
    const now = doc.sections.find((s) => s.id === "now").items.map((i) => i.text);
    assert.equal(now[0], "6 screens: Home, New recipe, Plan, Recipe detail, Recipes and Settings.");
    assert.ok(now.includes("1 background job: Weekly plan (every Monday at 08:00)."));
    assert.ok(now.includes("1 AI provider: OpenAI (2 tools)."));
    assert.deepEqual(doc.numbers.map((n) => n.value), ["6", "4", "3", "1", "1", "3"]);
    assert.ok(doc.sections.find((s) => s.id === "offscreen").items.some((i) => /^Email \(Resend\) is only used by the Weekly plan job/.test(i.text)));
    noJargon(doc);
    // and the other way round
    const gone = diffFacts(full, empty);
    assert.equal(gone.worthALook[0].code, "went-empty");
    const goneDoc = buildBriefing(gone);
    assert.equal(goneDoc.title, "What changed");
    assert.match(goneDoc.sections.find((s) => s.id === "look").items[0].text, /^The scan finds no screens/);
    noJargon(goneDoc);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("fastapi fixture: a generated client, scanned for real, makes no per-screen request claims", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "changes-test-"));
  try {
    const a = path.join(tmp, "a", "svc");
    const b = path.join(tmp, "b", "svc");
    fs.cpSync(path.join(FIX, "fastapi-svc"), a, { recursive: true });
    fs.cpSync(path.join(FIX, "fastapi-svc"), b, { recursive: true });
    const same = diffFacts(await scanRepo(a, { useGit: false }), await scanRepo(b, { useGit: false }));
    assert.equal(same.same, true);
    assert.equal(same.reach.generated, true, "the client in src/client is generated");
    assert.deepEqual(same.reach.gained, []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

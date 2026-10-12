// Tests for tools/lib/changes.mjs (CONTRACTS.md §7). Run: node --test tools/test/changes.test.mjs
// Everything runs on small in-memory FactsFile objects; no scanner is needed.
import test from "node:test";
import assert from "node:assert/strict";
import { THRESHOLDS, diffFacts } from "../lib/changes.mjs";
import { factsHash } from "../lib/hash.mjs";
import { SERVICE_NAMES, aiName } from "../lib/scan/names.mjs";

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

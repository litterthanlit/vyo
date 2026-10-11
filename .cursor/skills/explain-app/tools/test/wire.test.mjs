// Tests for tools/lib/wire.mjs (CONTRACTS.md §3). Run: node --test tools/test/wire.test.mjs
// Everything runs on small in-memory FactsFile objects; no scanner is needed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CAPS,
  matchGlob,
  normaliseWiring,
  readBlocks,
  resolvePatterns,
  whyMain,
  wire,
  wireMain,
  writeWiring,
} from "../lib/wire.mjs";
import { factsHash, partsHash, stableStringify } from "../lib/hash.mjs";

/* ───────────── builders ───────────── */

const kindOf = (id) => id.slice(0, id.indexOf(":"));
const nameOf = (id) => {
  const seg = id.slice(id.indexOf(":") + 1).split("/").filter(Boolean).pop() ?? "Home";
  return seg[0].toUpperCase() + seg.slice(1);
};
const fact = (id, files = [], extra = {}) => ({ id, kind: kindOf(id), name: nameOf(id), files, ...extra });
const area = (dir, loc = 10) => fact(`area:${dir}`, [], { loc, name: nameOf(`area:${dir}`) });
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// files: { path: loc | {loc, kit, gen, data} }. Any file mentioned by a fact, import or use is added with 10 LOC.
function mk({ facts = [], files = {}, imports = [], uses = [] }) {
  const out = {};
  const ensure = (f) => {
    if (!(f in out)) out[f] = { area: ".", loc: 10 };
  };
  for (const [f, v] of Object.entries(files)) out[f] = { area: ".", ...(typeof v === "number" ? { loc: v } : v) };
  for (const x of facts) for (const f of x.files ?? []) ensure(f);
  for (const [a, b] of imports) (ensure(a), ensure(b));
  for (const [f] of uses) ensure(f);
  const file = {
    version: 1,
    hash: "",
    empty: false,
    repo: { name: "t", packages: ["."] },
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

// Two feature parts Alpha (area:a) and Beta (area:b), with a/x.ts and b/y.ts, plus whatever the case adds.
function ab({ facts = [], files = {}, imports = [], uses = [], parts } = {}) {
  return {
    facts: mk({ facts: [area("a"), area("b"), ...facts], files: { "a/x.ts": 10, "b/y.ts": 10, ...files }, imports, uses }),
    parts: parts ?? [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"])],
  };
}
const linksOf = (r) => r.wiring.links;
const ok = (r) => {
  assert.deepEqual(r.errors, []);
  return r;
};

/* ───────────── globs ───────────── */

test("matchGlob: * stops at /, ** crosses it, the whole id must match", () => {
  assert.equal(matchGlob("ai:*", "ai:openai"), true);
  assert.equal(matchGlob("screen:*", "screen:/recipes"), false, "* never matches a slash");
  assert.equal(matchGlob("screen:/*", "screen:/recipes"), true);
  assert.equal(matchGlob("screen:/*", "screen:/recipes/[id]"), false);
  assert.equal(matchGlob("screen:**", "screen:/recipes/[id]"), true);
  assert.equal(matchGlob("screen:**", "screen:/"), true);
  assert.equal(matchGlob("screen:/recipes/**", "screen:/recipes/[id]"), true);
  assert.equal(matchGlob("screen:/recipes/*", "screen:/recipes/[id]"), true);
  assert.equal(matchGlob("screen:/rec", "screen:/recipes"), false, "no prefix matching");
  assert.equal(matchGlob("recipes", "screen:/recipes"), false, "no suffix matching");
  assert.equal(matchGlob("**/new", "screen:/recipes/new"), true);
  assert.equal(matchGlob("area:lib/*", "area:lib/ai"), true);
  assert.equal(matchGlob("area:lib/*", "area:lib/ai/deep"), false);
});

test("matchGlob: every other character is literal", () => {
  assert.equal(matchGlob("screen:/r/[id]", "screen:/r/[id]"), true);
  assert.equal(matchGlob("screen:/r/[id]", "screen:/r/i"), false, "[id] is not a character class");
  assert.equal(matchGlob("area:app/(app)", "area:app/(app)"), true);
  assert.equal(matchGlob("area:lib.x", "area:libZx"), false, ". is not a wildcard");
  assert.equal(matchGlob("area:a+b", "area:aab"), false);
  assert.equal(matchGlob("area:a?", "area:ab"), false);
  assert.equal(matchGlob("job:/api/cron/*", "job:/api/cron/weekly-plan"), true);
});

test("resolvePatterns: ordered, ! excludes, unmatched are positives that match nothing", () => {
  const facts = [fact("screen:/"), fact("screen:/plan"), fact("screen:/settings"), fact("table:User"), fact("ai:openai")];
  assert.deepEqual(resolvePatterns(["screen:**"], facts).ids, ["screen:/", "screen:/plan", "screen:/settings"]);
  assert.deepEqual(resolvePatterns(["screen:**", "!screen:/settings"], facts).ids, ["screen:/", "screen:/plan"]);
  assert.deepEqual(
    resolvePatterns(["!screen:/settings", "screen:**"], facts).ids,
    ["screen:/", "screen:/plan", "screen:/settings"],
    "an exclusion before the positive removes nothing",
  );
  assert.deepEqual(resolvePatterns(["screen:**", "!screen:**", "screen:/"], facts).ids, ["screen:/"], "later positives add back");
  const r = resolvePatterns(["table:*", "nope:*", "!ghost:*", "screen:/gone"], facts);
  assert.deepEqual(r.ids, ["table:User"]);
  assert.deepEqual(r.unmatched, ["nope:*", "screen:/gone"], "a ! pattern that matches nothing is not reported");
  assert.deepEqual(resolvePatterns(["screen:**", "!screen:**"], facts), { ids: [], unmatched: [] }, "matched then excluded is not unmatched");
  assert.deepEqual(resolvePatterns(["ai:*"], { facts }).ids, ["ai:openai"], "accepts a FactsFile too");
});

/* ───────────── errors ───────────── */

const base = () => mk({ facts: [area("a"), area("b"), area("c")], files: { "a/x.ts": 10, "b/y.ts": 10, "c/z.ts": 10 } });
const errs = (parts, facts = base()) => wire(facts, parts).errors;

test("error: part count", () => {
  assert.deepEqual(errs([P("Alpha", "feature", ["area:a"])]), ["1 parts — use 2 to 9"]);
  assert.deepEqual(errs([]), ["0 parts — use 2 to 9"]);
  const ten = Array.from({ length: 10 }, (_, i) => P(`Part ${i}`, "feature", [`area:d${i}`]));
  const facts = mk({ facts: Array.from({ length: 10 }, (_, i) => area(`d${i}`)), files: {} });
  assert.deepEqual(errs(ten, facts), ["10 parts — use 2 to 9"]);
  assert.equal(wire(facts, ten).wiring, null, "no wiring is produced with errors");
  const nine = ten.slice(0, 9);
  const r9 = wire(facts, nine);
  assert.deepEqual(r9.errors, []);
  assert.equal(r9.wiring.n.length, 9);
});

test("warning: exactly 2 parts", () => {
  const r = wire(base(), [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"])]);
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings[0], /^2 parts/);
  const r3 = wire(base(), [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"]), P("Gamma", "feature", ["area:c"])]);
  assert.ok(!r3.warnings.some((w) => /^2 parts/.test(w)));
});

test("error: name length", () => {
  const long = "A".repeat(19);
  assert.deepEqual(errs([P(long, "feature", ["area:a"]), P("Beta", "feature", ["area:b"])]), [`Part name "${long}" is 19 characters — 18 at most`]);
  assert.deepEqual(errs([P("A".repeat(18), "feature", ["area:a"]), P("Beta", "feature", ["area:b"])]), []);
  // characters, not UTF-16 units
  assert.deepEqual(errs([P("é".repeat(18), "feature", ["area:a"]), P("Beta", "feature", ["area:b"])]), []);
});

test("error: a pattern that matches nothing, with the nearest ids", () => {
  const facts = mk({
    facts: [fact("screen:/recipes"), fact("screen:/recipes/[id]"), fact("screen:/plan"), fact("screen:/settings"), fact("job:/api/cron/weekly-plan"), area("a")],
    files: { "a/x.ts": 1 },
  });
  const parts = [P("Screens", "screens", ["screen:/recipe"]), P("Beta", "feature", ["area:a"])];
  const [e] = wire(facts, parts).errors;
  assert.match(e, /^Part "Screens": "screen:\/recipe" matches nothing — did you mean screen:\/recipes(, [^,?]+){0,2}\?$/);
  assert.equal(e.split("did you mean ")[1].replace(/\?$/, "").split(", ").length, 3, "three suggestions");
  assert.equal(wire(facts, parts).errors.length, 1, "no extra 'counts nothing' on top of it");

  // the usual slip: * does not cross "/", so job:* finds nothing; the ** version is suggested first
  const [slip] = wire(facts, [P("Weekly email", "jobs", ["job:*"]), P("Beta", "feature", ["area:a"])]).errors;
  assert.equal(slip, 'Part "Weekly email": "job:*" matches nothing — did you mean job:/api/cron/weekly-plan, area:a, screen:/plan?');

  // an empty fact list gives no suggestions
  const empty = mk({ files: {} });
  assert.deepEqual(wire(empty, [P("One", "screens", ["screen:**"]), P("Two", "api", ["endpoint:**"])]).errors, [
    'Part "One": "screen:**" matches nothing',
    'Part "Two": "endpoint:**" matches nothing',
  ]);
});

test("error: a pattern that matches the wrong kind", () => {
  const facts = mk({ facts: [fact("screen:/"), fact("endpoint:/api/e"), fact("table:T"), area("a")], files: {} });
  assert.deepEqual(wire(facts, [P("Pages", "screens", ["endpoint:**"]), P("Beta", "feature", ["area:a"])]).errors, [
    'Part "Pages": "endpoint:**" matches endpoint facts — a screens part counts only screen (plus area: for ownership)',
  ]);
  assert.deepEqual(wire(facts, [P("Saved", "data", ["screen:**", "table:*"]), P("Beta", "feature", ["area:a"])]).errors, [
    'Part "Saved": "screen:**" matches screen facts — a data part counts only table (plus area: for ownership)',
  ]);
  // a feature part cites only area:
  assert.deepEqual(wire(facts, [P("Box", "feature", ["screen:**", "area:a"]), P("Pages", "screens", ["screen:/"])]).errors, [
    'Part "Box": "screen:**" matches screen facts — a feature part counts only area (plus area: for ownership)',
  ]);
  // a broad pattern reports once per kind, not once per fact
  const wide = wire(facts, [P("All", "screens", ["**"]), P("Beta", "feature", ["area:a"])]).errors;
  assert.equal(wide.filter((e) => /matches endpoint facts/.test(e)).length, 1);
  assert.equal(wide.filter((e) => /matches table facts/.test(e)).length, 1);
  // any role may cite area: for ownership
  assert.deepEqual(wire(facts, [P("Pages", "screens", ["screen:**", "area:a"]), P("Saved", "data", ["table:T"])]).errors, []);
});

test("error: a fact cited by two parts", () => {
  const facts = mk({ facts: [fact("screen:/"), fact("screen:/plan"), area("a"), area("a/deep")], files: { "a/deep/x.ts": 1 } });
  assert.deepEqual(wire(facts, [P("First", "screens", ["screen:**"]), P("Second", "screens", ["screen:/plan"])]).errors, [
    'screen:/plan is cited by both "First" and "Second"',
  ]);
  // the same area twice is an error too; a nested area is fine (the deepest wins)
  assert.deepEqual(wire(facts, [P("First", "feature", ["area:a"]), P("Second", "feature", ["area:a"])]).errors, [
    'area:a is cited by both "First" and "Second"',
  ]);
  const nested = wire(facts, [P("First", "feature", ["area:a"]), P("Second", "feature", ["area:a/deep"])]);
  assert.deepEqual(nested.errors, []);
  assert.equal(nested.owners.get("a/deep/x.ts"), 1);
});

test("error: a non-feature part that counts nothing", () => {
  const facts = mk({ facts: [fact("screen:/"), area("a"), area("b")], files: {} });
  assert.deepEqual(wire(facts, [P("Pages", "screens", ["area:a"]), P("Beta", "feature", ["area:b"])]).errors, ['screens part "Pages" counts nothing']);
  assert.deepEqual(wire(facts, [P("Pages", "screens", ["screen:**", "!screen:**"]), P("Beta", "feature", ["area:b"])]).errors, [
    'screens part "Pages" counts nothing',
  ]);
  // a feature part with no area at all cannot be drawn either
  assert.deepEqual(wire(facts, [P("Box", "feature", ["area:a", "!area:a"]), P("Beta", "feature", ["area:b"])]).errors, ['feature part "Box" counts nothing']);
});

test("error: malformed parts do not crash", () => {
  const r = wire(base(), [{ role: "feature", from: ["area:a"] }, { name: "Bad role", role: "walls", from: ["area:a"] }, { name: "No from", role: "feature", from: [] }, null]);
  assert.ok(r.errors.some((e) => e === 'Part 1 has no "name"'));
  assert.ok(r.errors.some((e) => /^Part "Bad role": role "walls" is not one of screens, api, feature/.test(e)));
  assert.ok(r.errors.some((e) => e === 'Part "No from": "from" must be a non-empty array of id patterns'));
  assert.ok(r.errors.some((e) => /^Part 4 must be an object/.test(e)));
  assert.equal(wire(base(), "nope").errors[0], "PARTS must be an array");
});

/* ───────────── ownership (§3.2) ───────────── */

test("ownership: a defining fact beats an area; the deepest area beats a shallower one", () => {
  const facts = mk({
    facts: [fact("screen:/plan", ["lib/plan/page.tsx"]), area("lib"), area("lib/plan"), area("lib/other")],
    files: { "lib/plan/page.tsx": 5, "lib/plan/q.ts": 5, "lib/other/o.ts": 5, "lib/top.ts": 5, "root.ts": 5 },
  });
  const parts = [P("Pages", "screens", ["screen:/plan"]), P("Lib", "feature", ["area:lib"]), P("Planner", "feature", ["area:lib/plan"])];
  const r = ok(wire(facts, parts));
  assert.equal(r.owners.get("lib/plan/page.tsx"), 0, "defines a cited screen");
  assert.equal(r.owners.get("lib/plan/q.ts"), 2, "deepest cited area");
  assert.equal(r.owners.get("lib/other/o.ts"), 1);
  assert.equal(r.owners.get("lib/top.ts"), 1);
  assert.equal(r.owners.has("root.ts"), false, "unowned");
});

test("ownership: area:. covers everything that no deeper part claims", () => {
  const facts = mk({ facts: [area("."), area("lib")], files: { "lib/a.ts": 1, "z.ts": 1, "deep/er/y.ts": 1 } });
  const r = ok(wire(facts, [P("Everything", "feature", ["area:."]), P("Lib", "feature", ["area:lib"])]));
  assert.equal(r.owners.get("z.ts"), 0);
  assert.equal(r.owners.get("deep/er/y.ts"), 0);
  assert.equal(r.owners.get("lib/a.ts"), 1);
});

test("ownership: several defining facts in one file go to the part with the most; ties go to the lower index", () => {
  const f = "app/page.tsx";
  const facts = mk({ facts: [fact("screen:/a", [f]), fact("endpoint:/e1", [f]), fact("endpoint:/e2", [f]), area("z")], files: { "z/q.ts": 1 } });
  const tie = ok(wire(facts, [P("Pages", "screens", ["screen:/a"]), P("Api", "api", ["endpoint:/e1"])]));
  assert.equal(tie.owners.get(f), 0, "1 vs 1 → lower index");
  const most = ok(wire(facts, [P("Pages", "screens", ["screen:/a"]), P("Api", "api", ["endpoint:/e1", "endpoint:/e2"])]));
  assert.equal(most.owners.get(f), 1, "2 vs 1 → the part with more");
  const reversed = ok(wire(facts, [P("Api", "api", ["endpoint:/e1"]), P("Pages", "screens", ["screen:/a"])]));
  assert.equal(reversed.owners.get(f), 0);
});

test("ownership: a data file goes to the only data part; two data parts leave it unowned", () => {
  const facts = mk({ facts: [fact("table:User", ["prisma/schema.prisma"]), fact("table:Post", ["prisma/schema.prisma"]), area("a")], files: { "lib/db.ts": { loc: 3, data: 1 }, "a/x.ts": 1 } });
  const one = ok(wire(facts, [P("Saved", "data", ["table:*"]), P("Box", "feature", ["area:a"])]));
  assert.equal(one.owners.get("lib/db.ts"), 0);
  const two = ok(wire(facts, [P("Users", "data", ["table:User"]), P("Posts", "data", ["table:Post"]), P("Box", "feature", ["area:a"])]));
  assert.equal(two.owners.has("lib/db.ts"), false);
  // an area wins over the data rule
  const inArea = mk({ facts: [fact("table:User", ["p/s.prisma"]), area("lib")], files: { "lib/db.ts": { loc: 3, data: 1 } } });
  const r = ok(wire(inArea, [P("Saved", "data", ["table:User"]), P("Lib", "feature", ["area:lib"])]));
  assert.equal(r.owners.get("lib/db.ts"), 1);
});

test("ownership: service and ai facts never confer ownership", () => {
  const facts = mk({
    facts: [fact("service:payments", ["lib/billing.ts"]), fact("ai:openai", ["lib/ai/suggest.ts"], { meta: { tools: 2 } }), area("a")],
    files: { "a/x.ts": 1 },
  });
  const r = ok(wire(facts, [P("Outside", "service", ["service:*"]), P("Ideas", "ai", ["ai:*"]), P("Box", "feature", ["area:a"])]));
  assert.equal(r.owners.has("lib/billing.ts"), false);
  assert.equal(r.owners.has("lib/ai/suggest.ts"), false);
  assert.equal(r.wiring.n[0].loc, 0);
  assert.equal(r.wiring.n[1].loc, 0);
});

/* ───────────── links (§3.3) ───────────── */

test("links: a direct import between two owned files", () => {
  const { facts, parts } = ab({ imports: [["a/x.ts", "b/y.ts"]] });
  const r = ok(wire(facts, parts));
  assert.deepEqual(linksOf(r), [[0, 1, 1]]);
  assert.deepEqual(r.witnesses.get("0-1"), [["a/x.ts", "b/y.ts"]]);
});

test("links: imports are followed forward only, through unowned files", () => {
  const { facts, parts } = ab({ imports: [["a/x.ts", "m/1.ts"], ["m/1.ts", "b/y.ts"]] });
  const r = ok(wire(facts, parts));
  assert.deepEqual(linksOf(r), [[0, 1, 1]]);
  assert.deepEqual(r.witnesses.get("0-1"), [["a/x.ts", "m/1.ts", "b/y.ts"]]);
  const none = ok(wire(...Object.values(ab({ imports: [["m/1.ts", "b/y.ts"]] }))));
  assert.deepEqual(linksOf(none), [], "a file nobody owned imports b; nothing starts from it");
});

test("links: the walk stops after 3 hops", () => {
  const three = ab({ imports: [["a/x.ts", "m/1.ts"], ["m/1.ts", "m/2.ts"], ["m/2.ts", "b/y.ts"]] });
  assert.deepEqual(linksOf(ok(wire(three.facts, three.parts))), [[0, 1, 1]], "3 hops links");
  const four = ab({ imports: [["a/x.ts", "m/1.ts"], ["m/1.ts", "m/2.ts"], ["m/2.ts", "m/3.ts"], ["m/3.ts", "b/y.ts"]] });
  const r = wire(four.facts, four.parts);
  assert.deepEqual(linksOf(r), [], "4 hops does not");
  assert.deepEqual(r.warnings.filter((w) => /no links/.test(w)), ['"Alpha" has no links', '"Beta" has no links']);
});

test("links: the walk stops at the first owned file on a branch", () => {
  const facts = mk({ facts: [area("a"), area("b"), area("c")], files: { "a/x.ts": 1, "b/y.ts": 1, "c/z.ts": 1 }, imports: [["a/x.ts", "c/z.ts"], ["c/z.ts", "b/y.ts"]] });
  const parts = [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"]), P("Gamma", "feature", ["area:c"])];
  assert.deepEqual(linksOf(ok(wire(facts, parts))), [[0, 2, 1], [1, 2, 1]], "A–C and C–B, but not A–B through C");
  // also stops at an owned file of the same part
  const same = mk({ facts: [area("a"), area("b")], files: { "a/x.ts": 1, "a/w.ts": 1, "b/y.ts": 1 }, imports: [["a/x.ts", "a/w.ts"], ["a/w.ts", "b/y.ts"]] });
  const r = ok(wire(same, [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"])]));
  assert.deepEqual(r.witnesses.get("0-1"), [["a/w.ts", "b/y.ts"]], "only a/w.ts is a source; a/x.ts stopped at a/w.ts");
});

test("links: kit files are never walked, never a target and never a source", () => {
  // control: the same shape without kit links
  const control = ab({ imports: [["a/x.ts", "m/k.ts"], ["m/k.ts", "b/y.ts"]] });
  assert.deepEqual(linksOf(ok(wire(control.facts, control.parts))), [[0, 1, 1]]);
  // never walked through
  const walked = ab({ files: { "m/k.ts": { loc: 5, kit: 1 } }, imports: [["a/x.ts", "m/k.ts"], ["m/k.ts", "b/y.ts"]] });
  assert.deepEqual(linksOf(ok(wire(walked.facts, walked.parts))), []);
  // never a target, even when owned
  const owned = ab({ files: { "b/ui.ts": { loc: 5, kit: 1 } }, imports: [["a/x.ts", "b/ui.ts"]] });
  const r = ok(wire(owned.facts, owned.parts));
  assert.equal(r.owners.get("b/ui.ts"), 1, "kit files can be owned");
  assert.deepEqual(linksOf(r), []);
  assert.equal(r.wiring.n[1].loc, 15, "…and they count towards size");
  // never a source
  const source = ab({ files: { "a/ui.ts": { loc: 5, kit: 1 } }, imports: [["a/ui.ts", "b/y.ts"]] });
  assert.deepEqual(linksOf(ok(wire(source.facts, source.parts))), []);
  // a kit file's uses are not examined either
  const sf = mk({ facts: [area("a"), fact("service:pay")], files: { "a/ui.ts": { loc: 5, kit: 1 }, "a/x.ts": 5 }, uses: [["a/ui.ts", "service:pay", "package"]] });
  assert.deepEqual(linksOf(ok(wire(sf, [P("Alpha", "feature", ["area:a"]), P("Pay", "service", ["service:pay"])]))), []);
});

test("links: an http call to an uncited endpoint is followed into the endpoint's files", () => {
  const ep = fact("endpoint:/api/e", ["srv/e.ts"]);
  const through = ab({ facts: [ep], uses: [["a/x.ts", "endpoint:/api/e", "http"]], imports: [["srv/e.ts", "b/y.ts"]] });
  const r = ok(wire(through.facts, through.parts));
  assert.deepEqual(linksOf(r), [[0, 1, 1]]);
  assert.deepEqual(r.witnesses.get("0-1"), [["a/x.ts", "endpoint:/api/e", "srv/e.ts", "b/y.ts"]]);
  // the endpoint file itself counts as one hop
  const direct = ab({ facts: [ep], files: { "srv/e.ts": 1 }, uses: [["a/x.ts", "endpoint:/api/e", "http"]], parts: [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"])] });
  assert.deepEqual(linksOf(ok(wire(direct.facts, direct.parts))), [], "endpoint file is unowned and imports nothing");
  const owned = ab({ facts: [fact("endpoint:/api/e", ["b/e.ts"])], uses: [["a/x.ts", "endpoint:/api/e", "http"]] });
  assert.deepEqual(linksOf(ok(wire(owned.facts, owned.parts))), [[0, 1, 1]], "endpoint defined in a file the other part owns");
  // hop limit counts the http hop: endpoint file (1) → m1 (2) → m2 (3) → b/y (4)
  const far = ab({ facts: [ep], uses: [["a/x.ts", "endpoint:/api/e", "http"]], imports: [["srv/e.ts", "m/1.ts"], ["m/1.ts", "m/2.ts"], ["m/2.ts", "b/y.ts"]] });
  assert.deepEqual(linksOf(ok(wire(far.facts, far.parts))), []);
  const near = ab({ facts: [ep], uses: [["a/x.ts", "endpoint:/api/e", "http"]], imports: [["srv/e.ts", "m/1.ts"], ["m/1.ts", "b/y.ts"]] });
  assert.deepEqual(linksOf(ok(wire(near.facts, near.parts))), [[0, 1, 1]]);
  // a non-http use of an uncited fact is not an edge
  const pkg = ab({ facts: [ep], uses: [["a/x.ts", "endpoint:/api/e", "orm"]], imports: [["srv/e.ts", "b/y.ts"]] });
  assert.deepEqual(linksOf(ok(wire(pkg.facts, pkg.parts))), []);
});

test("links: package, orm and http uses of cited facts link the parts", () => {
  const facts = mk({
    facts: [area("app"), fact("service:payments"), fact("table:Recipe", ["prisma/schema.prisma"]), fact("endpoint:/api/e", ["srv/e.ts"])],
    files: { "app/x.ts": 10 },
    uses: [["app/x.ts", "service:payments", "package"], ["app/x.ts", "table:Recipe", "orm"], ["app/x.ts", "endpoint:/api/e", "http"]],
  });
  const parts = [P("Alpha", "feature", ["area:app"]), P("Pay", "service", ["service:payments"]), P("Saved", "data", ["table:*"]), P("Door", "api", ["endpoint:**"])];
  const r = ok(wire(facts, parts));
  assert.deepEqual(linksOf(r), [[0, 1, 1], [0, 2, 1], [0, 3, 1]]);
  assert.deepEqual(r.witnesses.get("0-1"), [["app/x.ts", "service:payments"]]);
  assert.deepEqual(r.witnesses.get("0-2"), [["app/x.ts", "table:Recipe"]]);
  assert.deepEqual(r.witnesses.get("0-3"), [["app/x.ts", "endpoint:/api/e"]]);
  // the http use of a cited endpoint is a witness only; the walk does not also follow it
  assert.equal(linksOf(r).length, 3);
});

test("links: uses of unowned files that were reached count, uses of owned files do not carry over", () => {
  const facts = mk({
    facts: [area("a"), area("c"), fact("service:payments")],
    files: { "a/x.ts": 1, "c/z.ts": 1 },
    imports: [["a/x.ts", "m/1.ts"], ["a/x.ts", "c/z.ts"]],
    uses: [["m/1.ts", "service:payments", "package"], ["c/z.ts", "service:payments", "package"]],
  });
  const parts = [P("Alpha", "feature", ["area:a"]), P("Gamma", "feature", ["area:c"]), P("Pay", "service", ["service:payments"])];
  const r = ok(wire(facts, parts));
  assert.deepEqual(r.witnesses.get("0-2"), [["a/x.ts", "m/1.ts", "service:payments"]], "reached through the unowned m/1.ts");
  assert.deepEqual(linksOf(r), [[0, 1, 1], [0, 2, 1], [1, 2, 1]]);
  // a use at hop 3 counts, at hop 4 it does not
  const deep = (n) => {
    const imports = [["a/x.ts", "m/1.ts"], ["m/1.ts", "m/2.ts"], ["m/2.ts", "m/3.ts"]].slice(0, n);
    const last = `m/${n}.ts`;
    return wire(mk({ facts: [area("a"), fact("service:payments")], files: { "a/x.ts": 1 }, imports, uses: [[last, "service:payments", "package"]] }), [
      P("Alpha", "feature", ["area:a"]),
      P("Pay", "service", ["service:payments"]),
    ]);
  };
  assert.deepEqual(linksOf(deep(3)), [[0, 1, 1]], "m/3.ts is 3 hops away");
  const fourth = wire(mk({ facts: [area("a"), fact("service:payments")], files: { "a/x.ts": 1 }, imports: [["a/x.ts", "m/1.ts"], ["m/1.ts", "m/2.ts"], ["m/2.ts", "m/3.ts"], ["m/3.ts", "m/4.ts"]], uses: [["m/4.ts", "service:payments", "package"]] }), [
    P("Alpha", "feature", ["area:a"]),
    P("Pay", "service", ["service:payments"]),
  ]);
  assert.deepEqual(linksOf(fourth), []);
});

test("links: self-links are dropped", () => {
  const facts = mk({
    facts: [area("a"), area("b"), fact("table:T", ["db/t.ts"]), fact("service:pay")],
    files: { "a/x.ts": 1, "a/w.ts": 1, "b/y.ts": 1 },
    imports: [["a/x.ts", "a/w.ts"], ["db/t.ts", "db/more.ts"]],
    uses: [["db/t.ts", "table:T", "orm"], ["a/x.ts", "service:pay", "package"]],
  });
  const parts = [P("Alpha", "feature", ["area:a"]), P("Saved", "data", ["table:T"]), P("Pay", "service", ["service:pay"]), P("Beta", "feature", ["area:b"])];
  const r = ok(wire(facts, parts));
  assert.deepEqual(linksOf(r), [[0, 2, 1]], "only Alpha→Pay; Alpha→Alpha and Saved→Saved vanish");
  assert.deepEqual(r.warnings.filter((w) => /no links/.test(w)), ['"Saved" has no links', '"Beta" has no links']);
});

test("links: weight = distinct witnesses per unordered pair", () => {
  // two files in A import the same file in B → 2
  const two = ab({ files: { "a/x2.ts": 1 }, imports: [["a/x.ts", "b/y.ts"], ["a/x2.ts", "b/y.ts"]] });
  assert.deepEqual(linksOf(ok(wire(two.facts, two.parts))), [[0, 1, 2]]);
  // the same file pair imported both ways is one wire
  const both = ab({ imports: [["a/x.ts", "b/y.ts"], ["b/y.ts", "a/x.ts"]] });
  const rb = ok(wire(both.facts, both.parts));
  assert.deepEqual(linksOf(rb), [[0, 1, 1]]);
  assert.equal(rb.witnesses.get("0-1").length, 1);
  // two routes to the same file are one witness
  const routes = ab({ imports: [["a/x.ts", "m/1.ts"], ["a/x.ts", "m/2.ts"], ["m/1.ts", "b/y.ts"], ["m/2.ts", "b/y.ts"]] });
  assert.deepEqual(linksOf(ok(wire(routes.facts, routes.parts))), [[0, 1, 1]]);
  // file witnesses and uses witnesses add up on one pair; a fact used from two files is two witnesses
  const mixed = mk({
    facts: [area("a"), area("b"), fact("service:pay", ["b/pay.ts"])],
    files: { "a/x.ts": 1, "a/x2.ts": 1, "b/y.ts": 1 },
    imports: [["a/x.ts", "b/y.ts"]],
    uses: [["a/x.ts", "service:pay", "package"], ["a/x2.ts", "service:pay", "package"]],
  });
  const rm = ok(wire(mixed, [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"]), P("Pay", "service", ["service:pay"])]));
  assert.deepEqual(linksOf(rm), [[0, 1, 1], [0, 2, 2]]);
  // links are sorted by a then b with a < b, whatever the walk direction
  const rev = ab({ imports: [["b/y.ts", "a/x.ts"]] });
  assert.deepEqual(linksOf(ok(wire(rev.facts, rev.parts))), [[0, 1, 1]]);
});

/* ───────────── counts (§3.4) ───────────── */

test("counts: friendly names, item weights and the shape of PartWiring", () => {
  const facts = mk({
    facts: [fact("screen:/", [], { name: "Home" }), fact("screen:/plan", [], { name: "Plan" }), fact("table:Recipe", [], { name: "Recipe" }), area("a")],
    files: { "a/x.ts": 10 },
  });
  const r = ok(wire(facts, [P("Pages", "screens", ["screen:**"]), P("Saved", "data", ["table:*"]), P("Box", "feature", ["area:a"])]));
  assert.deepEqual(r.wiring.n[0], { count: 2, drawn: 2, items: [1, 1], size: 0, loc: 0, names: ["Home", "Plan"] });
  assert.deepEqual(r.wiring.n[1], { count: 1, drawn: 1, items: [1], size: 0, loc: 0, names: ["Recipe"] });
  assert.deepEqual(Object.keys(r.wiring), ["facts", "parts", "n", "links"]);
  assert.deepEqual(Object.keys(r.wiring.n[0]), ["count", "drawn", "items", "size", "loc", "names"]);
  assert.equal(r.wiring.facts, facts.hash);
  assert.equal(r.wiring.parts, partsHash([P("Pages", "screens", ["screen:**"]), P("Saved", "data", ["table:*"]), P("Box", "feature", ["area:a"])]));
  assert.equal("tools" in r.wiring.n[0], false, "tools is ai only");
});

test("counts: a feature with one area counts its direct child areas", () => {
  const facts = mk({
    facts: [area("lib", 100), area("lib/a", 60), area("lib/b", 30), area("lib/a/deep", 10), area("other", 5)],
    files: { "lib/a/x.ts": 1 },
  });
  const r = ok(wire(facts, [P("Lib", "feature", ["area:lib"]), P("Other", "feature", ["area:other"])]));
  const n = r.wiring.n[0];
  assert.equal(n.count, 2);
  assert.deepEqual(n.names, ["A", "B"], "grandchildren are not chips; biggest first");
  assert.deepEqual(n.items, [0.667, 0.333], "LOC share among the chips");
  // one area with no children → that area itself
  assert.deepEqual(r.wiring.n[1], { count: 1, drawn: 1, items: [1], size: 0, loc: 0, names: ["Other"] });
});

test("counts: a feature with several areas counts those areas, not their children", () => {
  const facts = mk({ facts: [area("lib/a", 60), area("lib/a/deep", 40), area("lib/b", 30), area("lib/c", 10)], files: {} });
  const r = ok(wire(facts, [P("Box", "feature", ["area:lib/a", "area:lib/b"]), P("Plan", "feature", ["area:lib/c"])]));
  assert.equal(r.wiring.n[0].count, 2);
  assert.deepEqual(r.wiring.n[0].names, ["A", "B"]);
  assert.deepEqual(r.wiring.n[0].items, [0.667, 0.333]);
});

test("counts: a child is a direct child of the nearest emitted ancestor, and area:. has top-level children", () => {
  const facts = mk({ facts: [area("."), area("lib", 50), area("lib/x/y", 30), area("app", 20)], files: {} }); // lib/x was merged away
  const lib = ok(wire(facts, [P("Lib", "feature", ["area:lib"]), P("Other", "feature", ["area:app"])]));
  assert.deepEqual(lib.wiring.n[0].names, ["Y"]);
  const rootCase = mk({ facts: [area(".", 100), area("lib", 60), area("app", 40), area("lib/x", 10)], files: {} });
  const r = wire(rootCase, [P("All", "feature", ["area:."]), P("Only", "service", ["area:lib/x"])]);
  assert.match(r.errors[0], /counts nothing/, "service part with only an area counts nothing");
  const r2 = wire(rootCase, [P("All", "feature", ["area:."]), P("Two", "feature", ["area:lib/x"])]);
  assert.deepEqual(r2.wiring.n[0].names, ["Lib", "App"]);
});

test("counts: caps, the bundle item and the 12-name limit", () => {
  const make = {
    screens: (i) => fact(`screen:/s${i}`),
    api: (i) => fact(`endpoint:/api/e${i}`),
    ai: (i) => fact(`ai:p${i}`),
    jobs: (i) => fact(`job:j${i}`),
    data: (i) => fact(`table:T${String(i).padStart(2, "0")}`),
    service: (i) => fact(`service:s${i}`),
  };
  const from = { screens: "screen:**", api: "endpoint:**", ai: "ai:*", jobs: "job:*", data: "table:*", service: "service:*" };
  for (const role of Object.keys(make)) {
    const cap = CAPS[role];
    for (const total of [cap, cap + 3]) {
      const facts = mk({ facts: [...Array.from({ length: total }, (_, i) => make[role](i)), area("f")], files: { "f/x.ts": 1 } });
      const r = ok(wire(facts, [P("Subject", role, [from[role]]), P("Filler", "feature", ["area:f"])]));
      const n = r.wiring.n[0];
      assert.equal(n.count, total, `${role} count`);
      assert.equal(n.drawn, cap, `${role} drawn`);
      assert.equal(n.items.length, cap, `${role} items`);
      assert.ok(n.items.every((w) => w === 1), `${role} weights are 1`);
      assert.equal(n.names.length, Math.min(total, 12), `${role} names`);
    }
  }
  assert.deepEqual(CAPS, { screens: 12, api: 16, feature: 6, ai: 4, jobs: 4, data: 10, service: 6 });
  // api: 20 endpoints → drawn 16, names 12 real ones
  const api = mk({ facts: [...Array.from({ length: 20 }, (_, i) => fact(`endpoint:/api/e${String(i).padStart(2, "0")}`)), area("f")], files: { "f/x.ts": 1 } });
  const n = ok(wire(api, [P("Door", "api", ["endpoint:**"]), P("Filler", "feature", ["area:f"])])).wiring.n[0];
  assert.equal(n.drawn, 16);
  assert.equal(n.names.length, 12);
  assert.equal(n.names[0], "E00");
});

test("counts: feature chips cap at 6 with the last one the bundle (weight 1)", () => {
  const areas = Array.from({ length: 8 }, (_, i) => area(`d${i}`, 10 * (i + 1)));
  const facts = mk({ facts: [...areas, area("f")], files: {} });
  const r = ok(wire(facts, [P("Box", "feature", areas.map((a) => a.id)), P("Filler", "feature", ["area:f"])]));
  const n = r.wiring.n[0];
  assert.equal(n.count, 8);
  assert.equal(n.drawn, 6);
  assert.equal(n.items.length, 6);
  assert.equal(n.items[5], 1, "the last one is the bundle");
  assert.ok(n.items.slice(0, 5).every((w) => w < 1));
  assert.deepEqual(n.names, ["D7", "D6", "D5", "D4", "D3", "D2", "D1", "D0"], "names list every real chip (≤ 12), biggest first");
  assert.equal(n.items[0], 0.222, "80 / 360 LOC");
});

test("counts: names are de-duplicated (first occurrence kept); counts are not affected", () => {
  // Recipe box cites lib/recipes and components/recipes, both named "Recipes"
  const facts = mk({ facts: [area("lib/recipes", 60), area("components/recipes", 40), area("lib/plan", 10)], files: {} });
  const r = ok(wire(facts, [P("Recipe box", "feature", ["area:lib/recipes", "area:components/recipes"]), P("Planner", "feature", ["area:lib/plan"])]));
  assert.equal(r.wiring.n[0].count, 2, "both chips still count");
  assert.equal(r.wiring.n[0].drawn, 2);
  assert.deepEqual(r.wiring.n[0].items, [0.6, 0.4]);
  assert.deepEqual(r.wiring.n[0].names, ["Recipes"]);
  // first occurrence wins and order is kept; the 12-name limit applies after de-duplication
  const tables = Array.from({ length: 14 }, (_, i) => fact(`table:T${String(i).padStart(2, "0")}`, [], { name: i % 2 ? "Odd" : `Even ${i}` }));
  const r2 = ok(wire(mk({ facts: [...tables, area("f")], files: { "f/x.ts": 1 } }), [P("Saved", "data", ["table:*"]), P("Filler", "feature", ["area:f"])]));
  assert.equal(r2.wiring.n[0].count, 14);
  assert.deepEqual(r2.wiring.n[0].names, ["Even 0", "Odd", "Even 2", "Even 4", "Even 6", "Even 8", "Even 10", "Even 12"]);
});

test("counts: ai tools are the sum over cited providers; other roles carry no tools key", () => {
  const facts = mk({
    facts: [fact("ai:openai", ["lib/ai.ts"], { meta: { tools: 2 }, name: "OpenAI" }), fact("ai:anthropic", [], { meta: { tools: 3 }, name: "Anthropic" }), fact("ai:groq", [], { name: "Groq" }), area("a")],
    files: { "a/x.ts": 1 },
  });
  const r = ok(wire(facts, [P("Ideas", "ai", ["ai:openai", "ai:anthropic"]), P("Other", "ai", ["ai:groq"]), P("Box", "feature", ["area:a"])]));
  assert.equal(r.wiring.n[0].tools, 5);
  assert.deepEqual(r.wiring.n[0].names, ["Anthropic", "OpenAI"]);
  assert.equal(r.wiring.n[1].tools, 0, "an ai part without tool counts has tools: 0");
  assert.equal("tools" in r.wiring.n[2], false);
  assert.deepEqual(Object.keys(r.wiring.n[0]), ["count", "drawn", "items", "size", "loc", "names", "tools"]);
});

test("counts: size and loc come from owned non-generated files", () => {
  const facts = mk({
    facts: [area("a"), area("b")],
    files: { "a/x.ts": 30, "a/gen.ts": { loc: 100, gen: 1 }, "b/y.ts": 60, "root.ts": 10 },
  });
  const r = ok(wire(facts, [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"])]));
  assert.equal(r.wiring.n[0].loc, 30, "generated files are not counted");
  assert.equal(r.wiring.n[0].size, 0.3, "30 of 100 non-generated LOC");
  assert.equal(r.wiring.n[1].loc, 60);
  assert.equal(r.wiring.n[1].size, 0.6);
  assert.equal(r.owners.get("a/gen.ts"), 0, "generated files are still walkable and owned");
  // rounding to 3 decimals
  const third = mk({ facts: [area("a"), area("b")], files: { "a/x.ts": 1, "b/y.ts": 2 } });
  assert.equal(ok(wire(third, [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"])])).wiring.n[0].size, 0.333);
  // no code at all: size 0, no division by zero
  const none = mk({ facts: [area("a"), area("b")], files: {} });
  assert.equal(ok(wire(none, [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"])])).wiring.n[0].size, 0);
});

/* ───────────── warnings ───────────── */

test("warning: Not drawn groups uncited services, AI, jobs, tables and screens", () => {
  const facts = mk({
    facts: [
      fact("service:payments", [], { name: "Payments" }),
      fact("ai:openai", [], { name: "OpenAI" }),
      fact("job:send", [], { name: "Send" }),
      fact("table:A"),
      fact("table:B"),
      fact("screen:/"),
      fact("screen:/x"),
      fact("screen:/y"),
      fact("endpoint:/api/e"),
      area("a"),
      area("b"),
    ],
    files: { "a/x.ts": 1, "b/y.ts": 1 },
    imports: [["a/x.ts", "b/y.ts"]],
  });
  const r = ok(wire(facts, [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"]), P("Cited", "screens", ["screen:/"])]));
  assert.ok(r.warnings.includes("Not drawn: Payments (service), OpenAI (AI), 1 job, 2 tables, 2 screens"), r.warnings.join("\n"));
  assert.ok(!r.warnings.some((w) => /endpoint/.test(w)), "uncited endpoints are not reported");
  // more than 3 services collapse to a count
  const many = mk({ facts: [...Array.from({ length: 4 }, (_, i) => fact(`service:s${i}`)), area("a"), area("b")], files: { "a/x.ts": 1, "b/y.ts": 1 } });
  assert.ok(ok(wire(many, [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"])])).warnings.includes("Not drawn: 4 services"));
  // everything drawn → no Not drawn line
  const all = ab({ imports: [["a/x.ts", "b/y.ts"]] });
  assert.deepEqual(ok(wire(all.facts, all.parts)).warnings.filter((w) => /Not drawn/.test(w)), []);
});

test("warning: order is parts count, no links, then Not drawn", () => {
  const facts = mk({ facts: [area("a"), area("b"), fact("table:A")], files: { "a/x.ts": 1, "b/y.ts": 1 } });
  const r = ok(wire(facts, [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"])]));
  assert.equal(r.warnings.length, 4);
  assert.match(r.warnings[0], /^2 parts/);
  assert.equal(r.warnings[1], '"Alpha" has no links');
  assert.equal(r.warnings[2], '"Beta" has no links');
  assert.equal(r.warnings[3], "Not drawn: 1 table");
});

/* ───────────── wiring output, determinism, speed ───────────── */

test("wire is deterministic and independent of the order of the input arrays", () => {
  const facts = mk({
    facts: [area("a"), area("b"), area("c"), fact("service:pay", [], { name: "Pay" }), fact("endpoint:/api/e", ["srv/e.ts"])],
    files: { "a/x.ts": 5, "b/y.ts": 6, "c/z.ts": 7, "m/1.ts": 1 },
    imports: [["a/x.ts", "m/1.ts"], ["m/1.ts", "b/y.ts"], ["b/y.ts", "c/z.ts"], ["srv/e.ts", "c/z.ts"], ["a/x.ts", "c/z.ts"]],
    uses: [["a/x.ts", "endpoint:/api/e", "http"], ["m/1.ts", "service:pay", "package"], ["c/z.ts", "service:pay", "package"]],
  });
  const parts = [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"]), P("Gamma", "feature", ["area:c"]), P("Pay", "service", ["service:pay"])];
  const one = ok(wire(facts, parts));
  const two = ok(wire(facts, parts));
  assert.equal(JSON.stringify(one.wiring), JSON.stringify(two.wiring));
  assert.deepEqual([...one.witnesses], [...two.witnesses]);
  const shuffled = structuredClone(facts);
  shuffled.facts.reverse();
  shuffled.imports.reverse();
  shuffled.uses.reverse();
  shuffled.files = Object.fromEntries(Object.entries(shuffled.files).reverse());
  const three = ok(wire(shuffled, parts));
  assert.equal(JSON.stringify(three.wiring), JSON.stringify(one.wiring).replace(facts.hash, shuffled.hash));
  assert.deepEqual([...three.witnesses], [...one.witnesses]);
  assert.equal(stableStringify(three.warnings), stableStringify(one.warnings));
  // inputs are not mutated
  const frozen = structuredClone(facts);
  wire(facts, parts);
  assert.deepEqual(facts, frozen);
});

test("wire handles ~5k files and ~20k imports well inside 2 seconds", () => {
  let seed = 12345;
  const rnd = (n) => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed % n;
  };
  const dirs = 60;
  const files = {};
  const names = [];
  for (let i = 0; i < 5000; i++) {
    const f = `d${i % dirs}/f${i}.ts`;
    files[f] = i % 97 === 0 ? { loc: 20, kit: 1 } : { loc: 10 + (i % 7) };
    names.push(f);
  }
  const imports = new Set();
  while (imports.size < 20000) {
    const a = names[rnd(names.length)];
    const b = names[rnd(names.length)];
    if (a !== b) imports.add(JSON.stringify([a, b]));
  }
  const facts = mk({
    facts: Array.from({ length: dirs }, (_, d) => area(`d${d}`, 800)),
    files,
    imports: [...imports].map((s) => JSON.parse(s)),
  });
  const parts = Array.from({ length: 8 }, (_, p) => P(`Part ${p}`, "feature", Array.from({ length: 5 }, (_, k) => `area:d${p * 5 + k}`)));
  const t0 = performance.now();
  const r = ok(wire(facts, parts));
  const ms = performance.now() - t0;
  assert.ok(ms < 2000, `took ${ms.toFixed(0)} ms`);
  assert.ok(r.wiring.links.length > 0);
});

/* ───────────── readBlocks / writeWiring ───────────── */

const BEGIN_P = "// PARTS:BEGIN — you write this (valid JSON). Then run: node tools/scan.mjs wire <facts.json> --into <this file>";
const BEGIN_W = "// WIRING:BEGIN — generated by `node tools/scan.mjs wire`; do not edit";
const OLD_WIRING = 'const WIRING: Wiring = {"facts":"old","parts":"old","n":[],"links":[]};';
const PARTS_JSON = '[\n  {"name": "A; B", "role": "screens", "line": "Semi; colon.", "from": ["screen:**"]}\n]';
const canvas = ({ wiring = OLD_WIRING, eol = "\n", tail = 'export default function X() { return null; }' } = {}) =>
  [
    'import x from "y";',
    "",
    BEGIN_P,
    `const PARTS: PartSpec[] = ${PARTS_JSON.replace(/\n/g, eol)};`,
    "// PARTS:END",
    ...(wiring === null ? [] : [BEGIN_W, wiring, "// WIRING:END"]),
    tail,
    "",
  ].join(eol);

const sampleWiring = () => ({
  facts: "abc123",
  parts: "0123abcd",
  n: [{ count: 2, drawn: 2, items: [0.33333, 1], size: 0.12345, loc: 40, names: ["x", "y"] }],
  links: [[0, 1, 2]],
});

test("readBlocks parses both blocks, ranges point at the markers", () => {
  const src = canvas();
  const b = readBlocks(src);
  assert.deepEqual(b.parts, [{ name: "A; B", role: "screens", line: "Semi; colon.", from: ["screen:**"] }]);
  assert.deepEqual(b.wiring, { facts: "old", parts: "old", n: [], links: [] });
  assert.ok(src.slice(b.partsRange.start).startsWith("// PARTS:BEGIN"));
  assert.ok(src.slice(b.partsRange.bodyStart).startsWith("const PARTS"));
  assert.ok(src.slice(b.partsRange.bodyEnd).startsWith("// PARTS:END"));
  assert.ok(src.slice(0, b.partsRange.end).endsWith("// PARTS:END"));
  assert.ok(src.slice(b.wiringRange.start).startsWith("// WIRING:BEGIN"));
});

test("readBlocks: absent blocks give null; missing WIRING is fine", () => {
  assert.deepEqual(readBlocks("const x = 1;\n"), { parts: null, wiring: null, partsRange: null, wiringRange: null });
  const b = readBlocks(canvas({ wiring: null }));
  assert.equal(b.wiring, null);
  assert.equal(b.wiringRange, null);
  assert.equal(b.parts.length, 1);
});

test("readBlocks: invalid JSON throws a clear error", () => {
  const trailing = canvas().replace('"from": ["screen:**"]}', '"from": ["screen:**"]},');
  assert.throws(() => readBlocks(trailing), /PARTS must be valid JSON: double quotes, no trailing commas/);
  const single = canvas().replace(/"screens"/, "'screens'");
  assert.throws(() => readBlocks(single), /PARTS must be valid JSON/);
  assert.throws(() => readBlocks(canvas().replace("const PARTS: PartSpec[] = ", "const PARTS = ")), /no "const PARTS: PartSpec\[\] = " line/);
  assert.throws(() => readBlocks(canvas().replace("// PARTS:END", "// nothing")), /PARTS:BEGIN has no matching/);
  assert.throws(() => readBlocks(canvas({ wiring: "const WIRING: Wiring = {oops};" })), /WIRING is not valid JSON/);
  assert.throws(() => readBlocks(canvas().replace(PARTS_JSON, '{"not": "an array"}')), /JSON array/);
});

test("readBlocks: a trailing comment with a ; after the JSON does not break parsing", () => {
  const src = canvas().replace(`${PARTS_JSON};`, `${PARTS_JSON}; // edited; thanks`);
  assert.equal(readBlocks(src).parts.length, 1);
  assert.equal(readBlocks(canvas().replace(`${PARTS_JSON};`, PARTS_JSON)).parts.length, 1, "no semicolon at all is fine");
});

test("writeWiring replaces only the WIRING const and keeps every other byte", () => {
  const src = canvas();
  const out = writeWiring(src, sampleWiring());
  const line = `const WIRING: Wiring = ${JSON.stringify(normaliseWiring(sampleWiring()))};`;
  assert.equal(out, src.replace(OLD_WIRING, line));
  assert.deepEqual(readBlocks(out).wiring, normaliseWiring(sampleWiring()));
  assert.ok(!line.includes("\n"), "one line");
  assert.deepEqual(readBlocks(out).parts, readBlocks(src).parts);
  assert.equal(writeWiring(out, sampleWiring()), out, "idempotent");
});

test("writeWiring: keys in contract order, numbers rounded to 3 decimals", () => {
  const messy = { links: [[0, 1, 2]], n: [{ names: ["x"], loc: 4, size: 0.12345, items: [0.33333, 1], drawn: 2, count: 2, tools: 3 }], parts: "p", facts: "f" };
  const out = writeWiring(canvas(), messy);
  assert.ok(out.includes('const WIRING: Wiring = {"facts":"f","parts":"p","n":[{"count":2,"drawn":2,"items":[0.333,1],"size":0.123,"loc":4,"names":["x"],"tools":3}],"links":[[0,1,2]]};'));
});

test("writeWiring replaces a multi-line WIRING const", () => {
  const multi = 'const WIRING: Wiring = {\n  "facts": "old",\n  "parts": "old",\n  "n": [],\n  "links": []\n};';
  const src = canvas({ wiring: multi });
  const out = writeWiring(src, sampleWiring());
  assert.ok(!out.includes('"facts": "old"'));
  assert.deepEqual(readBlocks(out).wiring, normaliseWiring(sampleWiring()));
  assert.equal(out.split("\n").length, src.split("\n").length - 5, "five lines collapsed to one");
  assert.ok(out.endsWith("export default function X() { return null; }\n"));
});

test("writeWiring inserts the whole block right after // PARTS:END when it is missing", () => {
  const src = canvas({ wiring: null });
  const out = writeWiring(src, sampleWiring());
  const line = `const WIRING: Wiring = ${JSON.stringify(normaliseWiring(sampleWiring()))};`;
  assert.equal(out, src.replace("// PARTS:END\n", `// PARTS:END\n${BEGIN_W}\n${line}\n// WIRING:END\n`));
  assert.deepEqual(readBlocks(out).wiring, normaliseWiring(sampleWiring()));
  // PARTS:END as the very last line without a newline
  const bare = `${BEGIN_P}\nconst PARTS: PartSpec[] = ${PARTS_JSON};\n// PARTS:END`;
  const out2 = writeWiring(bare, sampleWiring());
  assert.ok(out2.startsWith(bare) && out2.endsWith("// WIRING:END"));
  // CRLF files get CRLF
  const crlf = writeWiring(canvas({ wiring: null, eol: "\r\n" }), sampleWiring());
  assert.ok(!/[^\r]\n/.test(crlf), "no bare LF introduced");
  const crlfReplace = writeWiring(canvas({ eol: "\r\n" }), sampleWiring());
  assert.ok(!/[^\r]\n/.test(crlfReplace));
  assert.deepEqual(readBlocks(crlfReplace).wiring, normaliseWiring(sampleWiring()));
  // no PARTS block: nowhere to insert
  assert.throws(() => writeWiring("const x = 1;\n", sampleWiring()), /no \/\/ PARTS:END marker/);
});

test("writeWiring fills an empty WIRING block", () => {
  const src = canvas({ wiring: "" }).replace(`${BEGIN_W}\n\n`, `${BEGIN_W}\n`);
  const out = writeWiring(src, sampleWiring());
  assert.deepEqual(readBlocks(out).wiring, normaliseWiring(sampleWiring()));
});

/* ───────────── CLI ───────────── */

function sandbox(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wire-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const io = { out: [], err: [] };
  const hooks = { out: (s) => io.out.push(s), err: (s) => io.err.push(s) };
  const put = (name, text) => {
    const f = path.join(dir, name);
    fs.writeFileSync(f, text);
    return f;
  };
  return { dir, io, hooks, put };
}
function cliCase(t, { parts, facts } = {}) {
  const sb = sandbox(t);
  const scene = ab({
    facts: [fact("service:pay", [], { name: "Pay" })],
    imports: [["a/x.ts", "m/1.ts"], ["m/1.ts", "b/y.ts"]],
    uses: [["m/1.ts", "service:pay", "package"]],
  });
  const f = facts ?? scene.facts;
  const p = parts ?? [P("Alpha", "feature", ["area:a"]), P("Beta", "feature", ["area:b"]), P("Pay", "service", ["service:pay"])];
  const factsFile = sb.put("t-facts.json", JSON.stringify(f, null, 1));
  const src = `${BEGIN_P}\nconst PARTS: PartSpec[] = ${JSON.stringify(p)};\n// PARTS:END\nexport default 1;\n`;
  const canvasFile = sb.put("t.canvas.tsx", src);
  return { ...sb, factsFile, canvasFile, src, facts: f, parts: p };
}

test("wireMain writes the WIRING block, prints a one-line summary and is idempotent", async (t) => {
  const c = cliCase(t);
  const code = await wireMain(["wire", c.factsFile, "--into", c.canvasFile], c.hooks);
  assert.equal(code, 0, c.io.err.join("\n"));
  assert.deepEqual(c.io.out, ["wired 3 parts, 2 links, total weight 2"]);
  const written = fs.readFileSync(c.canvasFile, "utf8");
  assert.deepEqual(readBlocks(written).wiring, wire(c.facts, c.parts).wiring);
  assert.ok(written.startsWith(c.src.replace("export default 1;\n", "")), "everything before and after the block is untouched");
  assert.ok(written.endsWith("export default 1;\n"));
  assert.ok(c.io.err.every((l) => l.startsWith("! ")), "only warnings on stderr");
  // run again without the leading "wire": same bytes
  const code2 = await wireMain([c.factsFile, "--into", c.canvasFile], c.hooks);
  assert.equal(code2, 0);
  assert.equal(fs.readFileSync(c.canvasFile, "utf8"), written);
  // --into=value works
  assert.equal(await wireMain([c.factsFile, `--into=${c.canvasFile}`], c.hooks), 0);
});

test("wireMain: rule errors go to stderr as ✗ lines, exit 1, canvas untouched", async (t) => {
  const c = cliCase(t, { parts: [P("Alpha", "feature", ["area:a"]), P("Wrong", "screens", ["table:**"])] });
  const code = await wireMain(["wire", c.factsFile, "--into", c.canvasFile], c.hooks);
  assert.equal(code, 1);
  assert.ok(c.io.err.some((l) => l.startsWith('✗ Part "Wrong": "table:**" matches nothing')), c.io.err.join("\n"));
  assert.equal(fs.readFileSync(c.canvasFile, "utf8"), c.src);
  assert.deepEqual(c.io.out, []);
});

test("wireMain: a facts.json whose hash does not recompute is refused", async (t) => {
  const c = cliCase(t);
  const tampered = JSON.parse(fs.readFileSync(c.factsFile, "utf8"));
  tampered.files["a/x.ts"].loc += 1;
  fs.writeFileSync(c.factsFile, JSON.stringify(tampered));
  assert.equal(await wireMain(["wire", c.factsFile, "--into", c.canvasFile], c.hooks), 1);
  assert.deepEqual(c.io.err, ["✗ facts.json hash does not recompute — re-run scan"]);
  assert.equal(fs.readFileSync(c.canvasFile, "utf8"), c.src);
});

test("wireMain: usage and input errors", async (t) => {
  const c = cliCase(t);
  assert.equal(await wireMain(["wire", c.factsFile], c.hooks), 2, "--into is required");
  assert.ok(c.io.err.some((l) => l.startsWith("usage:")));
  assert.equal(await wireMain(["wire", "--into", c.canvasFile], c.hooks), 2, "facts file is required");
  assert.equal(await wireMain(["wire", c.factsFile, "--into", c.canvasFile, "--wat", "1"], c.hooks), 2);
  assert.equal(await wireMain(["wire", path.join(c.dir, "missing.json"), "--into", c.canvasFile], c.hooks), 1);
  const noBlock = c.put("bare.tsx", "export default 1;\n");
  assert.equal(await wireMain(["wire", c.factsFile, "--into", noBlock], c.hooks), 1);
  assert.ok(c.io.err.some((l) => /has no \/\/ PARTS:BEGIN/.test(l)));
  const broken = c.put("broken.tsx", c.src.replace('"from"', "from"));
  assert.equal(await wireMain(["wire", c.factsFile, "--into", broken], c.hooks), 1);
  assert.ok(c.io.err.some((l) => /^✗ PARTS must be valid JSON: double quotes, no trailing commas/.test(l)));
});

test("whyMain prints the shortest witness chain per direction", async (t) => {
  const c = cliCase(t);
  assert.equal(await wireMain(["wire", c.factsFile, "--into", c.canvasFile], c.hooks), 0);
  c.io.out.length = 0;
  c.io.err.length = 0;
  const why = (...rest) => whyMain(["why", c.factsFile, "--canvas", c.canvasFile, ...rest], c.hooks);
  assert.equal(await why("Alpha", "Beta"), 0);
  assert.deepEqual(c.io.out, ["Alpha ↔ Beta (weight 1)", "Alpha → Beta: a/x.ts → m/1.ts → b/y.ts"]);
  c.io.out.length = 0;
  assert.equal(await why("alpha", "pay"), 0, "names are case-insensitive");
  assert.deepEqual(c.io.out, ["Alpha ↔ Pay (weight 1)", "Alpha → Pay: a/x.ts → m/1.ts ─uses→ service:pay"]);
  c.io.out.length = 0;
  assert.equal(await why("2", "0"), 0, "indexes are 0-based, either order");
  assert.deepEqual(c.io.out, ["Pay ↔ Alpha (weight 1)", "Alpha → Pay: a/x.ts → m/1.ts ─uses→ service:pay"]);
  c.io.out.length = 0;
  assert.equal(await why("Beta", "Pay"), 0);
  assert.deepEqual(c.io.out, ["No wire between Beta and Pay"]);
  assert.equal(await why("Alpha", "Nobody"), 2);
  assert.equal(await why("Alpha", "Alpha"), 2);
  assert.equal(await why("Alpha"), 2);
});

test("whyMain shows both directions and an http hop through an uncited endpoint", async (t) => {
  const scene = ab({
    facts: [fact("endpoint:/api/e", ["srv/e.ts"])],
    uses: [["a/x.ts", "endpoint:/api/e", "http"]],
    imports: [["srv/e.ts", "b/y.ts"], ["b/y.ts", "m/1.ts"], ["m/1.ts", "m/2.ts"], ["m/2.ts", "a/x2.ts"]],
    files: { "a/x2.ts": 1 },
  });
  const c = cliCase(t, { facts: scene.facts, parts: scene.parts });
  const why = () => whyMain(["why", c.factsFile, "--canvas", c.canvasFile, "Beta", "Alpha"], c.hooks);
  fs.writeFileSync(c.canvasFile, c.src);
  assert.equal(await why(), 0, c.io.err.join("\n"));
  assert.deepEqual(c.io.out, [
    "Beta ↔ Alpha (weight 2)",
    "Beta → Alpha: b/y.ts → m/1.ts → m/2.ts → a/x2.ts",
    "Alpha → Beta: a/x.ts ─uses→ endpoint:/api/e → srv/e.ts → b/y.ts",
  ]);
});

test("whyMain reports rule errors from wire", async (t) => {
  const c = cliCase(t, { parts: [P("Alpha", "feature", ["area:nope"]), P("Beta", "feature", ["area:b"])] });
  assert.equal(await whyMain(["why", c.factsFile, "--canvas", c.canvasFile, "Alpha", "Beta"], c.hooks), 1);
  assert.ok(c.io.err.some((l) => l.startsWith("✗ Part \"Alpha\": \"area:nope\" matches nothing")));
});

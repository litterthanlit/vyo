// What changed between two scans (CONTRACTS.md §7, "Changes v1").
//
//   const changes = diffFacts(beforeFacts, afterFacts, { labels, parts, wiringFactsHash });
//
// `diffFacts` is pure: no I/O, no clock, no absolute paths. Every list in the result is sorted, so the same two
// scans give the same bytes (and the same `hash`) whatever order the inputs list their facts in.
// lib/briefing.mjs turns a Changes into plain English.
//
// The rules, in short (the reasons are in the comments next to each step):
//  - A fact is paired with another only when the pairing is unique, 1:1, and of a named kind (`moved[].how`).
//    Tables are never paired by the file they share: every Prisma model lives in one schema.prisma.
//  - "Reach" asks what each screen and each job can get to, walking imports and http calls to endpoint files
//    (lib/reach.mjs). A walk that avoids generated files is a *claim*; one that may use them only says
//    "something leads here".
//  - Words that depend on the scan being complete are hedged by `notes`.
import { factsHash } from "./hash.mjs";
import { buildLinkGraph, chainTo, makeView, walk } from "./reach.mjs";
import { wire } from "./wire.mjs";
import { selectIds } from "./scan/glob.mjs";
import { plainAreaName, singular } from "./scan/names.mjs";

/** Every number the diff decides with. */
export const THRESHOLDS = Object.freeze({
  reworkLines: 20, // a defining file changed by at least this many lines …
  reworkShare: 0.25, // … and by at least this share of its old size, is "reworked"
  areaLines: 50, // an area counts when it moved by at least this many lines …
  areaShare: 0.2, // … and by at least this share of its old size (a new area: areaLines alone)
  bigShrinkShare: 0.5, // an area that lost this share is worth a look
  areasGrew: 3, // size.areas keeps this many that grew …
  areasShrank: 2, // … and this many that shrank
  unrelatedShare: 0.2, // fewer shared file paths than this (of the smaller scan): probably two different projects
  reshuffled: 5, // this many unpaired facts with one name: pairing by name is hopeless
  capped: 19000, // a scan holding this many files hit the scanner's cap (20000): sizes are partial
});

const KINDS = ["screen", "endpoint", "table", "service", "ai", "job"];
const KIND_SET = new Set(KINDS);
const KIND_ORDER = Object.fromEntries(KINDS.map((k, i) => [k, i]));
const DEFINING = new Set(["screen", "endpoint", "table", "job"]); // facts whose `files` define them (CONTRACTS §2)
const REACHABLE = new Set(["service", "ai", "endpoint", "table"]); // what a screen or job can "get to"
const ROOTS = new Set(["screen", "job"]);
const DRAWN_KINDS = new Set(["screen", "table", "service", "ai", "job"]); // what a poster can leave out (as wire's "Not drawn" warning lists)

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byId = (a, b) => cmp(a.id, b.id);
const numeric = (a, b) => a - b;

function push(map, key, value) {
  const l = map.get(key);
  if (l) l.push(value);
  else map.set(key, [value]);
}

function groupBy(list, keyOf) {
  const m = new Map();
  for (const x of list) {
    const k = keyOf(x);
    if (k != null) push(m, k, x);
  }
  return m;
}

const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const sortedList = (l) => [...(l ?? [])].sort(cmp);
// A fact as other entries point at it. Services and AI carry their vendor keys: "Text messages (Twilio)" needs them.
const ref = (f) => {
  const r = { id: f.id, kind: f.kind, name: f.name ?? f.id };
  if (f.meta?.vendor?.length) r.vendor = sortedList(f.meta.vendor);
  return r;
};

/* ─────────────────────────── input ─────────────────────────── */

function assertFacts(f, which) {
  if (!f || typeof f !== "object") throw new TypeError(`diffFacts: ${which} is not a facts.json`);
  if (f.version !== 1) throw new Error(`diffFacts: ${which} is facts version ${f.version}; only version 1 is supported`);
  if (!Array.isArray(f.facts) || !f.files || typeof f.files !== "object") throw new TypeError(`diffFacts: ${which} is not a facts.json (it needs facts and files)`);
}

// One side, indexed once: its non-area facts, who defines each file, and each file's outgoing edges.
function indexFacts(facts) {
  const list = facts.facts.filter((f) => KIND_SET.has(f.kind)).sort(byId);
  const byId_ = new Map(list.map((f) => [f.id, f]));
  const definers = new Map();
  for (const f of list) if (DEFINING.has(f.kind)) for (const file of f.files ?? []) push(definers, file, f.id);
  const imp = new Map();
  const use = new Map();
  for (const [a, b] of facts.imports ?? []) push(imp, a, b);
  for (const [file, id, via] of facts.uses ?? []) push(use, file, `${id}\0${via}`);
  for (const m of [imp, use]) for (const [k, l] of m) m.set(k, [...new Set(l)].sort(cmp));
  return { facts, list, byId: byId_, files: facts.files, definers, imp, use, empty: list.length === 0 };
}

const exclusive = (ix, file) => (ix.definers.get(file) ?? []).length === 1;
const edgeSig = (ix, file) => JSON.stringify([ix.imp.get(file) ?? [], ix.use.get(file) ?? []]);

/* ─────────────────────────── items ─────────────────────────── */

// meta without `undefined`s, with list values sorted, so equal facts give equal bytes.
function cleanMeta(meta) {
  if (!meta) return undefined;
  const out = {};
  for (const k of Object.keys(meta).sort()) {
    const v = meta[k];
    if (v === undefined) continue;
    out[k] = Array.isArray(v) ? [...v].sort(cmp) : v;
  }
  return Object.keys(out).length ? out : undefined;
}

function toItem(f, partOf) {
  const item = { id: f.id, kind: f.kind, name: f.name ?? f.id, files: sortedList(f.files) };
  const meta = cleanMeta(f.meta);
  if (meta) item.meta = meta;
  const part = partOf?.(f);
  if (part) item.part = part;
  return item;
}

/* ─────────────────────────── moves ─────────────────────────── */

// Tables fold to the same word when they differ only in case, underscores or a plural: Recipe / recipes / meal_plans.
const foldTable = (id) => singular(id.slice(id.indexOf(":") + 1).toLowerCase().replace(/_/g, ""));

// What a screen, endpoint or job *looks like* on one side: the sizes of its own files and everything they point at.
// Null when it has no files of its own (a file shared with another fact says nothing about this one).
function shapeSig(f, ix) {
  if (!f.files?.length) return null;
  const locs = [];
  const imps = new Set();
  const uses = new Set();
  for (const file of f.files) {
    const info = ix.files[file];
    if (!info || info.gen || !exclusive(ix, file)) return null;
    locs.push(info.loc ?? 0);
    for (const t of ix.imp.get(file) ?? []) imps.add(t);
    for (const u of ix.use.get(file) ?? []) uses.add(u);
  }
  locs.sort(numeric);
  return JSON.stringify([locs, [...imps].sort(cmp), [...uses].sort(cmp)]);
}

/**
 * Pair removed facts with added ones that are really the same thing under a new name or address.
 * Each rule pairs only a *unique* 1:1 match, so a guess never hides a loss; rules run in order and only on
 * what the earlier ones left. Returns { moves: [{how, from, to}] (facts), removed, added } (what is left).
 */
function pairMoves(bx, ax, removed, added) {
  const rPool = new Map(removed.map((f) => [f.id, f]));
  const aPool = new Map(added.map((f) => [f.id, f]));
  const moves = [];
  const claim = (from, to, how) => {
    rPool.delete(from.id);
    aPool.delete(to.id);
    moves.push({ how, from, to });
  };
  const pass = (how, keyOf) => {
    const rg = groupBy([...rPool.values()], (f) => keyOf(f, bx));
    const ag = groupBy([...aPool.values()], (f) => keyOf(f, ax));
    for (const [key, rl] of rg) {
      const al = ag.get(key);
      if (al && rl.length === 1 && al.length === 1) claim(rl[0], al[0], how);
    }
  };

  // same-name: one removed and one added with the same kind and friendly name. Never for tables (below).
  pass("same-name", (f) => (f.kind === "table" ? null : `${f.kind}\0${f.name}`));
  // same-shape: screens, endpoints and jobs whose own files have the same sizes and point at the same things.
  pass("same-shape", (f, ix) => {
    if (f.kind !== "screen" && f.kind !== "endpoint" && f.kind !== "job") return null;
    const sig = shapeSig(f, ix);
    return sig === null ? null : `${f.kind}\0${sig}`;
  });
  // same-slot: in one file shared by both sides, exactly one endpoint/job went and exactly one arrived. This also
  // pairs an endpoint with a job: a route that gained a cron entry stops being an endpoint (CONTRACTS §2.1).
  const slotKinds = new Set(["endpoint", "job"]);
  const rBy = new Map();
  const aBy = new Map();
  for (const f of rPool.values()) if (slotKinds.has(f.kind)) for (const file of f.files ?? []) push(rBy, file, f);
  for (const f of aPool.values()) if (slotKinds.has(f.kind)) for (const file of f.files ?? []) push(aBy, file, f);
  const slot = [];
  for (const [file, rl] of [...rBy].sort((x, y) => cmp(x[0], y[0]))) {
    const al = aBy.get(file);
    if (al && rl.length === 1 && al.length === 1) slot.push([rl[0], al[0]]);
  }
  const seen = new Map();
  for (const [r, a] of slot) {
    seen.set(r.id, (seen.get(r.id) ?? 0) + 1);
    seen.set(a.id, (seen.get(a.id) ?? 0) + 1);
  }
  for (const [r, a] of slot) if (seen.get(r.id) === 1 && seen.get(a.id) === 1) claim(r, a, "same-slot");
  // folded-name: tables only, by name. Never by file: every table of an ORM schema lives in one file.
  pass("folded-name", (f) => (f.kind === "table" ? `table\0${foldTable(f.id)}` : null));

  return { moves, removed: [...rPool.values()].sort(byId), added: [...aPool.values()].sort(byId) };
}

/* ─────────────────────────── in-place changes ─────────────────────────── */

// The facts' own files, when they are all its alone and hand-written: { loc, files }. Else null.
function ownLoc(f, ix) {
  let loc = 0;
  const files = [];
  for (const file of f.files ?? []) {
    const info = ix.files[file];
    if (!info || info.gen || !exclusive(ix, file)) continue;
    loc += info.loc ?? 0;
    files.push(file);
  }
  return files.length ? { loc, files: files.sort(cmp) } : null;
}

// What differs inside one fact that exists on both sides (`bf` before, `af` after).
function changesOf(bf, af, bx, ax) {
  const out = [];
  const base = { id: af.id, kind: af.kind, name: af.name ?? af.id, files: sortedList(af.files) };
  const mb = bf.meta ?? {};
  const ma = af.meta ?? {};
  if (af.kind === "endpoint") {
    const b = sortedList(mb.methods);
    const a = sortedList(ma.methods);
    if (!sameList(a, b)) out.push({ ...base, type: "methods", before: b, after: a });
  }
  if (af.kind === "job" && (mb.schedule ?? null) !== (ma.schedule ?? null)) {
    out.push({ ...base, type: "schedule", before: mb.schedule ?? null, after: ma.schedule ?? null });
  }
  if (af.kind === "service" || af.kind === "ai") {
    const b = sortedList(mb.vendor);
    const a = sortedList(ma.vendor);
    if (!sameList(a, b)) out.push({ ...base, type: "vendor", before: b, after: a });
  }
  if (af.kind === "ai" && (mb.tools ?? 0) !== (ma.tools ?? 0)) {
    out.push({ ...base, type: "tools", before: mb.tools ?? 0, after: ma.tools ?? 0 });
  }
  if (DEFINING.has(af.kind)) {
    const b = ownLoc(bf, bx);
    const a = ownLoc(af, ax);
    if (b && a) {
      const d = Math.abs(a.loc - b.loc);
      if (d >= THRESHOLDS.reworkLines && d / Math.max(b.loc, 1) >= THRESHOLDS.reworkShare) {
        out.push({ ...base, type: "reworked", before: b.loc, after: a.loc, files: a.files });
      }
    }
  }
  return out;
}

/* ─────────────────────────── reach ─────────────────────────── */

// What every screen and job of one scan can get to. For each root: `strong` (fact id → shortest witness chain)
// walks hand-written files only; `weak` (a set, a superset of strong) may also pass through generated files.
function reachOf(facts) {
  const graph = buildLinkGraph(facts);
  const view = makeView(graph);
  const out = new Map();
  for (const root of facts.facts) {
    if (!ROOTS.has(root.kind)) continue;
    const strong = new Map();
    const weak = new Set();
    for (const start of root.files ?? []) {
      const info = graph.files[start];
      if (!info || info.kit) continue;
      for (const isStrong of [true, false]) {
        const note = (file, ids, parent) => {
          for (const id of ids) {
            if (!REACHABLE.has(graph.factById.get(id)?.kind)) continue;
            weak.add(id);
            if (!isStrong) continue;
            const chain = [...chainTo(parent, file), id];
            const had = strong.get(id);
            if (!had || chain.length < had.length) strong.set(id, chain);
          }
        };
        const w = walk(view, start, { include: isStrong ? (f) => !graph.files[f].gen : undefined, onUses: note });
        for (const id of w.endpoints) {
          weak.add(id);
          if (!isStrong || strong.has(id)) continue;
          const hop = [...w.parent].find(([, e]) => e?.via === id);
          if (hop) strong.set(id, chainTo(w.parent, hop[0]));
        }
      }
    }
    out.set(root.id, { kind: root.kind, strong, weak });
  }
  return out;
}

// Gains, losses, generated flag and the facts no screen leads to.
function reachDiff(bx, ax, bReach, aReach, idMap, movedTo) {
  const mapId = (id) => idMap.get(id) ?? id;
  const generated = [bReach, aReach].some((r) => [...r.values()].some((v) => [...v.weak].some((id) => !v.strong.has(id))));

  // Screens that exist on both sides: the same id, or the id a move gave them.
  const pairs = [];
  for (const [id, r] of [...bReach].sort((x, y) => cmp(x[0], y[0]))) {
    if (r.kind !== "screen") continue;
    const to = idMap.get(id) ?? id;
    if (aReach.get(to)?.kind === "screen") pairs.push([id, to]);
  }
  pairs.sort((x, y) => cmp(x[1], y[1]));

  const gained = new Map(); // fact id → { screens: Map(id → name), chain }
  const lost = new Map(); // fact id → { screens: Map }
  for (const [bId, aId] of pairs) {
    const br = bReach.get(bId);
    const ar = aReach.get(aId);
    const bStrong = new Set([...br.strong.keys()].map(mapId));
    const bWeak = new Set([...br.weak].map(mapId));
    const screenName = ax.byId.get(aId)?.name ?? aId;
    // A claim needs strong evidence and no weak evidence against it: a fact that was only reachable through a
    // generated client before is not "new", and one that still is reachable that way is not "lost".
    for (const [id, chain] of ar.strong) {
      if (bStrong.has(id) || bWeak.has(id)) continue;
      let g = gained.get(id);
      if (!g) gained.set(id, (g = { screens: new Map(), chain }));
      g.screens.set(aId, screenName);
      if (chain.length < g.chain.length) g.chain = chain;
    }
    for (const id of bStrong) {
      if (!ax.byId.has(id) || ar.strong.has(id) || ar.weak.has(id)) continue;
      let l = lost.get(id);
      if (!l) lost.set(id, (l = { screens: new Map() }));
      l.screens.set(aId, screenName);
    }
  }
  // Only things a screen can use are claimed (a request that became a job is not), and with a generated client in
  // play, which screen calls which request cannot be claimed.
  const claimable = (id) => {
    const kind = ax.byId.get(id)?.kind;
    return REACHABLE.has(kind) && !(generated && kind === "endpoint");
  };
  const screens = (m) => [...m].map(([id, name]) => ({ id, name })).sort(byId);
  const gainedList = [...gained]
    .filter(([id]) => claimable(id))
    .map(([id, g]) => ({ fact: ref(ax.byId.get(id)), screens: screens(g.screens), chain: g.chain }))
    .sort((x, y) => cmp(x.fact.id, y.fact.id));
  const lostList = [...lost]
    .filter(([id]) => claimable(id))
    .map(([id, l]) => ({ fact: ref(ax.byId.get(id)), screens: screens(l.screens) }))
    .sort((x, y) => cmp(x.fact.id, y.fact.id));

  // New (or cut off) things that no screen leads to, by any path, generated or not.
  const onScreen = (reach, ids) => {
    const s = new Set();
    for (const r of reach.values()) if (r.kind === "screen") for (const id of r.weak) s.add(ids(id));
    return s;
  };
  const aOn = onScreen(aReach, (id) => id);
  const bOn = onScreen(bReach, mapId);
  const jobs = [...aReach].filter(([, r]) => r.kind === "job").sort((x, y) => cmp(x[0], y[0]));
  const notOnScreen = [];
  for (const f of ax.list) {
    if (!REACHABLE.has(f.kind) || aOn.has(f.id)) continue;
    const isNew = !bx.byId.has(f.id) && !movedTo.has(f.id);
    const why = isNew ? "new" : bOn.has(f.id) ? "disconnected" : null;
    if (!why) continue;
    const usedByJobs = jobs.filter(([, r]) => r.strong.has(f.id)).map(([id]) => ({ id, name: ax.byId.get(id)?.name ?? id }));
    notOnScreen.push({ fact: ref(f), why, usedByJobs, files: sortedList(f.files) });
  }
  return { gained: gainedList, lost: lostList, generated, notOnScreen };
}

/* ─────────────────────────── size ─────────────────────────── */

const dirOfArea = (id) => id.slice(5);
const dirOfFile = (file) => (file.lastIndexOf("/") < 0 ? "." : file.slice(0, file.lastIndexOf("/")));

// Sizes by area. Both scans are cut with the same set of directories (the leaf areas of either), each file going
// to the *shallowest* such directory above it, so a folder that became two leaves is still one bucket.
function sizeOf(before, after) {
  const loc = (f) => Object.values(f.files).reduce((s, i) => s + (i.gen ? 0 : (i.loc ?? 0)), 0);
  const count = (f) => Object.values(f.files).filter((i) => !i.gen).length;
  const size = {
    files: { before: count(before), after: count(after) },
    loc: { before: loc(before), after: loc(after) },
    areas: [],
  };
  const leaves = new Set();
  const names = new Map();
  for (const side of [before, after]) {
    for (const f of side.facts) {
      if (f.kind !== "area") continue;
      names.set(dirOfArea(f.id), f.name);
      if (f.meta?.leaf) leaves.add(dirOfArea(f.id));
    }
  }
  if (leaves.size > 1) leaves.delete(".");
  const bucketOf = (side, file) => {
    const segs = file.split("/").slice(0, -1);
    for (let n = 1; n <= segs.length; n++) {
      const dir = segs.slice(0, n).join("/");
      if (leaves.has(dir)) return dir;
    }
    if (leaves.has(".")) return ".";
    const rec = side.files[file]?.area;
    return rec ? dirOfArea(rec) : dirOfFile(file);
  };
  const repoName = after.repo?.name ?? before.repo?.name ?? "";
  const totals = new Map(); // plain name → { before, after }
  const add = (side, key) => {
    for (const [file, info] of Object.entries(side.files)) {
      if (info.gen) continue;
      const dir = bucketOf(side, file);
      const name = names.get(dir) ?? plainAreaName(dir === "." ? "" : dir, repoName);
      let t = totals.get(name);
      if (!t) totals.set(name, (t = { before: 0, after: 0 }));
      t[key] += info.loc ?? 0;
    }
  };
  add(before, "before");
  add(after, "after");
  const areas = [];
  for (const [name, t] of totals) {
    const delta = t.after - t.before;
    const big = Math.abs(delta) >= THRESHOLDS.areaLines;
    const share = t.before === 0 ? 1 : Math.abs(delta) / t.before;
    if (delta !== 0 && big && (t.before === 0 || share >= THRESHOLDS.areaShare)) areas.push({ name, before: t.before, after: t.after, delta });
  }
  size.areas = areas.sort((x, y) => y.delta - x.delta || cmp(x.name, y.name));
  return size;
}

// Keep the biggest growers and shrinkers; `all` stays whole for the big-shrink check.
function topAreas(all) {
  const grew = all.filter((a) => a.delta > 0).slice(0, THRESHOLDS.areasGrew);
  const shrank = all.filter((a) => a.delta < 0).slice(-THRESHOLDS.areasShrank);
  return [...grew, ...shrank];
}

/* ─────────────────────────── posters (parts) ─────────────────────────── */

// Which part of the poster owns a fact: the part that cites it, else the part that owns its defining file.
function partTagger(facts, parts) {
  const ids = facts.facts.map((f) => f.id).sort(cmp);
  const cited = parts.map((p) => selectIds(Array.isArray(p?.from) ? p.from.filter((s) => typeof s === "string") : [], ids));
  const wired = wire(facts, parts); // its owners are empty when the parts do not wire against this side
  const owners = wired.owners;
  const nameAt = (i) => (typeof parts[i]?.name === "string" && parts[i].name ? parts[i].name : undefined);
  const partOf = (f) => {
    for (let i = 0; i < parts.length; i++) if (cited[i].has(f.id) && nameAt(i)) return nameAt(i);
    for (const file of sortedList(f.files)) if (owners.has(file) && nameAt(owners.get(file))) return nameAt(owners.get(file));
    return undefined;
  };
  return { partOf, wired, cites: (id) => cited.some((s) => s.has(id)) };
}

/* ─────────────────────────── the diff ─────────────────────────── */

const NOTE_ORDER = ["repo-name-differs", "unrelated", "capped", "empty-baseline", "first-save-after-date", "reshuffled", "scanner-drift"];
const LOOK_ORDER = ["went-empty", "table-removed", "screen-removed", "request-lost", "vendor-switched", "service-added", "ai-added", "job-added", "big-shrink"];

/**
 * @param before FactsFile (version 1): the older scan
 * @param after  FactsFile (version 1): the newer scan
 * @param opts.labels         { before?, after? }: plain-English names for the two sides, e.g.
 *                            "your last saved version (a1b2c3d, 2026-10-07)" / "your files right now"
 * @param opts.parts          an already-parsed PartSpec[] (a poster's PARTS): tags items with their part and adds `posters`
 * @param opts.wiringFactsHash  the facts hash the poster's WIRING block was drawn from (also `labels.wiringFacts`)
 * @param opts.notes          extra notes the caller knows about, e.g. { code: "first-save-after-date", date }
 * @returns Changes v1
 */
export function diffFacts(before, after, opts) {
  assertFacts(before, "before");
  assertFacts(after, "after");
  const { labels: given, parts, wiringFactsHash, notes: callerNotes } = opts ?? {};
  const labels = given ?? {};
  if (parts != null && !Array.isArray(parts)) throw new TypeError("diffFacts: parts must be an array of parts");

  const bx = indexFacts(before);
  const ax = indexFacts(after);
  const pb = parts ? partTagger(before, parts) : undefined;
  const pa = parts ? partTagger(after, parts) : undefined;
  const tagB = pb?.partOf;
  const tagA = pa?.partOf;

  /* 1. added, removed, moved */
  const removedAll = bx.list.filter((f) => !ax.byId.has(f.id));
  const addedAll = ax.list.filter((f) => !bx.byId.has(f.id));
  const paired = pairMoves(bx, ax, removedAll, addedAll);
  const moved = paired.moves
    .map((m) => ({ how: m.how, from: toItem(m.from, tagB), to: toItem(m.to, tagA) }))
    .sort((x, y) => cmp(x.to.id, y.to.id));
  const removed = paired.removed.map((f) => toItem(f, tagB));
  const added = paired.added.map((f) => toItem(f, tagA));
  const idMap = new Map(paired.moves.map((m) => [m.from.id, m.to.id]));
  const movedTo = new Set(idMap.values());

  const counts = {};
  for (const kind of KINDS) {
    counts[kind] = {
      before: bx.list.filter((f) => f.kind === kind).length,
      after: ax.list.filter((f) => f.kind === kind).length,
      added: added.filter((i) => i.kind === kind).length,
      removed: removed.filter((i) => i.kind === kind).length,
    };
  }

  /* 2. in-place changes: facts on both sides (same id) and the two ends of each move */
  const changed = [];
  for (const af of ax.list) {
    const bf = bx.byId.get(af.id);
    if (bf) changed.push(...changesOf(bf, af, bx, ax));
  }
  for (const m of paired.moves) if (m.from.kind === m.to.kind) changed.push(...changesOf(m.from, m.to, bx, ax));
  changed.sort((x, y) => cmp(x.id, y.id) || cmp(x.type, y.type));

  /* 3. reach */
  const reach = reachDiff(bx, ax, reachOf(before), reachOf(after), idMap, movedTo);
  const notOnScreen = reach.notOnScreen;

  /* 4. size */
  const capped = [bx, ax].map((x) => Object.keys(x.files).length >= THRESHOLDS.capped);
  const size = sizeOf(before, after);
  const allAreas = size.areas;
  size.areas = capped.some(Boolean) ? [] : topAreas(allAreas);

  /* 5. worth a look */
  const look = [];
  const lookItem = (code, i, extra) => look.push({ code, kind: i.kind, id: i.id, name: i.name, ...(i.meta?.vendor ? { vendor: i.meta.vendor } : {}), ...extra });
  if (ax.empty && !bx.empty) look.push({ code: "went-empty" });
  for (const i of removed) {
    if (i.kind === "table") lookItem("table-removed", i);
    if (i.kind === "screen") lookItem("screen-removed", i);
    if (i.kind === "endpoint") lookItem("request-lost", i);
  }
  for (const m of moved) if (m.how === "folded-name") lookItem("table-removed", m.from, { renamedTo: { id: m.to.id, name: m.to.name } });
  for (const c of changed) {
    if (c.type === "vendor" && c.kind === "service" && c.before.some((v) => !c.after.includes(v)) && c.after.some((v) => !c.before.includes(v))) {
      look.push({ code: "vendor-switched", kind: c.kind, id: c.id, name: c.name, before: c.before, after: c.after });
    }
    if (c.type === "methods" && c.before.some((m) => !c.after.includes(m))) {
      look.push({ code: "request-lost", kind: c.kind, id: c.id, name: c.name, methods: c.before.filter((m) => !c.after.includes(m)) });
    }
  }
  for (const i of added) {
    if (i.kind === "service") lookItem("service-added", i);
    if (i.kind === "ai") lookItem("ai-added", i);
    if (i.kind === "job") lookItem("job-added", i);
  }
  if (!capped.some(Boolean)) {
    for (const a of allAreas) {
      if (a.delta < 0 && -a.delta / a.before >= THRESHOLDS.bigShrinkShare) look.push({ code: "big-shrink", name: a.name, before: a.before, after: a.after });
    }
  }
  look.sort((x, y) => LOOK_ORDER.indexOf(x.code) - LOOK_ORDER.indexOf(y.code) || cmp(x.id ?? x.name ?? "", y.id ?? y.name ?? ""));

  /* 6. notes */
  const notes = [];
  if (before.repo?.name && after.repo?.name && before.repo.name !== after.repo.name) {
    notes.push({ code: "repo-name-differs", before: before.repo.name, after: after.repo.name });
  }
  const bPaths = Object.keys(before.files);
  const aPaths = Object.keys(after.files);
  if (bPaths.length && aPaths.length && !bx.empty && !ax.empty) {
    const aSet = new Set(aPaths);
    const shared = bPaths.filter((p) => aSet.has(p)).length / Math.min(bPaths.length, aPaths.length);
    if (shared < THRESHOLDS.unrelatedShare) notes.push({ code: "unrelated", shared: Math.round(shared * 100) });
  }
  if (capped.some(Boolean)) notes.push({ code: "capped", side: capped[0] && capped[1] ? "both" : capped[0] ? "before" : "after" });
  if (bx.empty && !ax.empty) notes.push({ code: "empty-baseline" });
  const shareName = groupBy([...paired.removed, ...paired.added], (f) => `${f.kind}\0${f.name}`);
  for (const [key, l] of [...shareName].sort((x, y) => cmp(x[0], y[0]))) {
    if (l.length >= THRESHOLDS.reshuffled) notes.push({ code: "reshuffled", kind: l[0].kind, name: l[0].name, count: l.length });
  }
  // A fact appeared or vanished though every file that defines it reads exactly as before: the scan changed, not the app.
  const untouched = (f) =>
    f.files?.length > 0 && f.files.every((file) => bx.files[file] && ax.files[file] && bx.files[file].loc === ax.files[file].loc && edgeSig(bx, file) === edgeSig(ax, file));
  const drift = [...paired.removed, ...paired.added].filter(untouched).map((f) => f.id);
  if (drift.length) notes.push({ code: "scanner-drift", ids: [...new Set(drift)].sort(cmp) });
  for (const n of callerNotes ?? []) if (n && typeof n.code === "string") notes.push(JSON.parse(JSON.stringify(n)));
  const noteRank = (n) => (NOTE_ORDER.includes(n.code) ? NOTE_ORDER.indexOf(n.code) : NOTE_ORDER.length);
  notes.sort((x, y) => noteRank(x) - noteRank(y) || cmp(x.code, y.code) || cmp(JSON.stringify(x), JSON.stringify(y)));

  /* 7. the poster */
  let posters;
  if (parts) {
    const wb = pb.wired;
    const wa = pa.wired;
    const drawn = (w) => (w.wiring ? JSON.stringify([w.wiring.n, w.wiring.links]) : null);
    const wiringHash = wiringFactsHash ?? labels.wiringFacts;
    const afterHash = after.hash || factsHash(after);
    posters = {
      // Drawn from other facts than the "after" scan; with no hash to go by, would the drawing differ between the two scans?
      stale: wiringHash != null ? wiringHash !== afterHash : drawn(wb) !== drawn(wa),
      unwired: [...wa.errors].sort(cmp),
      uncited: added.filter((i) => DRAWN_KINDS.has(i.kind) && !pa.cites(i.id)).map((i) => i.id).sort(cmp),
    };
  }

  const sideOf = (facts, ix, label) => {
    const s = { hash: facts.hash || factsHash(facts), repo: facts.repo?.name ?? "", empty: ix.empty };
    if (typeof label === "string" && label) s.label = label;
    return s;
  };
  const sideB = sideOf(before, bx, labels.before);
  const sideA = sideOf(after, ax, labels.after);
  const structural = [added, removed, moved, changed, reach.gained, reach.lost, notOnScreen].some((l) => l.length > 0);
  const out = {
    version: 1,
    kind: "changes",
    before: sideB,
    after: sideA,
    same: sideB.hash === sideA.hash,
    structural,
    counts,
    added,
    removed,
    moved,
    changed,
    reach: { gained: reach.gained, lost: reach.lost, generated: reach.generated },
    notOnScreen,
    worthALook: look,
    size,
    notes,
  };
  if (posters) out.posters = posters;
  out.hash = factsHash(out);
  return out;
}

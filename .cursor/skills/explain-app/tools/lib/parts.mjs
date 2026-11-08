// The parts a field draws: the scan's areas cut down to a handful, sized by lines and files. Pure.
import { VENDORS } from "./scan/detect-services.mjs";
import { matchGlob } from "./scan/glob.mjs";
import { FIELDS } from "./fields/index.mjs";

export const PART_DEFAULTS = { minShare: 0.02, maxParts: 14 };
const ROOT = "area:.";

/** "area:lib/ai" -> ["lib", "ai"]; the root has no segments. */
export const segmentsOf = (id) => (id === ROOT ? [] : id.slice(5).split("/"));
const idOf = (segs) => (segs.length ? `area:${segs.join("/")}` : ROOT);

// Parents before children, siblings by name: the order a file tree lists folders.
function treeOrder(a, b) {
  const x = segmentsOf(a);
  const y = segmentsOf(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return x.length - y.length;
}

/** All caps, a company name, or one word ending in a digit: a name that says who or which, not what. */
export function unplainName(name) {
  const words = name.toLowerCase().split(/\s+/).filter(Boolean);
  if (/[A-Z]{2}/.test(name) && name === name.toUpperCase()) return true;
  if (VENDORS.has(words.join("-")) || words.some((w) => VENDORS.has(w))) return true;
  return words.length === 1 && /\d$/.test(words[0]);
}

/**
 * Every non-generated line of the repo in at most `maxParts` parts, each an area of the scan, in tree order.
 * A file starts in its nearest leaf area (or its own area when no leaf holds it); a part under `minShare`
 * of the lines merges into its parent area, deepest first, until it is big enough or sits at the top level;
 * then the smallest parts merge up until there are at most `maxParts`.
 * @param {{ facts: { id: string, kind: string, name: string, meta?: { leaf?: boolean } }[], files: Record<string, { area: string, loc: number, gen?: number }> }} facts
 * @param {{ minShare?: number, maxParts?: number, names?: Record<string, string> }} [o]
 * @returns {{ id: string, name: string, loc: number, files: number, order: number }[]}
 */
export function partsFromFacts(facts, { minShare = PART_DEFAULTS.minShare, maxParts = PART_DEFAULTS.maxParts, names = {} } = {}) {
  const areas = new Map(facts.facts.filter((f) => f.kind === "area").map((a) => [a.id, a]));
  const parentOf = (id) => {
    const segs = segmentsOf(id);
    while (segs.length) {
      segs.pop();
      if (areas.has(idOf(segs)) || !segs.length) return idOf(segs);
    }
    return null;
  };
  const leafOf = (id) => {
    for (let a = id; a; a = parentOf(a)) if (areas.get(a)?.meta?.leaf) return a;
    return id;
  };

  const parts = new Map();
  for (const f of Object.values(facts.files)) {
    if (f.gen) continue;
    const id = leafOf(f.area);
    const p = parts.get(id) ?? { loc: 0, files: 0 };
    parts.set(id, { loc: p.loc + f.loc, files: p.files + 1 });
  }
  const total = [...parts.values()].reduce((s, p) => s + p.loc, 0);
  const mergeUp = (id) => {
    const into = parentOf(id);
    const p = parts.get(id);
    const q = parts.get(into) ?? { loc: 0, files: 0 };
    parts.set(into, { loc: q.loc + p.loc, files: q.files + p.files });
    parts.delete(id);
  };
  const depth = (id) => segmentsOf(id).length;
  const first = (ok, order) => [...parts].filter(([id]) => ok(id)).sort(order)[0]?.[0];
  const bySize = ([a, p], [b, q]) => p.loc - q.loc || treeOrder(b, a);
  // Deepest first, so a folder has gathered its small children before its own size is judged.
  const deepestSmall = (x, y) => depth(y[0]) - depth(x[0]) || bySize(x, y);

  for (let id; (id = first((x) => depth(x) > 1 && parts.get(x).loc < minShare * total, deepestSmall)); ) mergeUp(id);
  for (let id; parts.size > maxParts && (id = first((x) => x !== ROOT, bySize)); ) mergeUp(id);

  return [...parts]
    .sort(([a], [b]) => treeOrder(a, b))
    .map(([id, p], order) => ({ id, name: names[id] ?? areas.get(id)?.name ?? id.slice(5), loc: p.loc, files: p.files, order }));
}

/** Groups of two or more parts whose names read the same, ignoring case: a reader cannot tell them apart. */
export function sameNames(parts) {
  const by = new Map();
  for (const p of parts) by.set(p.name.toLowerCase(), [...(by.get(p.name.toLowerCase()) ?? []), p]);
  return [...by.values()].filter((g) => g.length > 1);
}

/**
 * The ids of the parts `accent` names: a glob over part ids, a part's own id, the parts inside an area,
 * or else the part an area was merged into.
 */
export function accentIds(parts, accent) {
  if (!accent) return new Set();
  const ids = parts.map((p) => p.id);
  if (accent.includes("*")) return new Set(ids.filter((id) => matchGlob(accent, id)));
  if (ids.includes(accent)) return new Set([accent]);
  const inside = ids.filter((id) => accent === ROOT || id.startsWith(`${accent}/`));
  if (inside.length) return new Set(inside);
  const segs = segmentsOf(accent);
  for (let n = segs.length - 1; n >= 1; n--) if (ids.includes(idOf(segs.slice(0, n)))) return new Set([idOf(segs.slice(0, n))]);
  return new Set();
}

/** A region's part options: its field's defaults, then its own. */
export const partOptions = (region) => ({ ...FIELDS[region.field]?.parts, ...region });

/** The part that holds `area`: the deepest part that is the area itself or one of its ancestors. */
function partOfArea(ids, area) {
  for (let segs = segmentsOf(area); ; segs = segs.slice(0, -1)) {
    if (ids.has(idOf(segs))) return idOf(segs);
    if (!segs.length) return null;
  }
}

/**
 * How many imports join each pair of parts, as [i, j, count] with i < j, indexes into `parts`.
 * @param {{ id: string }[]} parts
 * @param {{ files: Record<string, { area: string, gen?: number }>, imports?: [string, string][] }} facts
 */
export function partTies(parts, facts) {
  const ids = new Set(parts.map((p) => p.id));
  const index = new Map(parts.map((p, i) => [p.id, i]));
  const of = (file) => (facts.files[file] && !facts.files[file].gen ? index.get(partOfArea(ids, facts.files[file].area)) : undefined);
  const ties = new Map();
  for (const [a, b] of facts.imports ?? []) {
    const [i, j] = [of(a), of(b)].sort((x, y) => x - y);
    if (i === undefined || j === undefined || i === j) continue;
    ties.set(`${i} ${j}`, (ties.get(`${i} ${j}`) ?? 0) + 1);
  }
  return [...ties].map(([k, n]) => [...k.split(" ").map(Number), n]);
}

/** The parts of one field region, each marked hot when the region's accent names it. */
export function regionParts(region, facts) {
  const parts = partsFromFacts(facts, partOptions(region));
  const hot = accentIds(parts, region.accent);
  return parts.map((p) => ({ ...p, hot: hot.has(p.id) }));
}

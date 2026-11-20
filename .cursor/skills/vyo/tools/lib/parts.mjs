// The parts a field draws: the scan's areas cut down to a handful, sized by lines and files. Pure.
import { VENDORS } from "./scan/detect-services.mjs";
import { matchGlob } from "./scan/glob.mjs";
import { FIELDS } from "./fields/index.mjs";
import { DEFAULT_STYLE } from "./fields/shape.mjs";

export const PART_DEFAULTS = { minShare: 0.02, maxParts: 14 };
const ROOT = "area:.";

/** "area:lib/ai" -> ["lib", "ai"]; the root has no segments. */
export const segmentsOf = (id) => (id === ROOT ? [] : id.slice(5).split("/"));
/** A file part's scanned name: its file name without the extension, like "sessions". */
const fileName = (id) => id.slice(id.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "") || id.slice(5);
const idOf = (segs) => (segs.length ? `area:${segs.join("/")}` : ROOT);

// Parents before children, siblings by name: the order a file tree lists folders.
function treeOrder(a, b) {
  const x = segmentsOf(a);
  const y = segmentsOf(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return x.length - y.length;
}

const CODE_WORDS = new Set(["oauth", "mcp", "api", "sdk", "cli", "jwt", "sso", "webhook", "cron", "auth"]);

/** All caps, a company name, or one word ending in a digit: a name that says who or which, not what. */
export function unplainName(name) {
  const words = name.toLowerCase().split(/\s+/).filter(Boolean);
  if (/[A-Z]{2}/.test(name) && name === name.toUpperCase()) return true;
  if (CODE_WORDS.has(words.join("")) || VENDORS.has(words.join("")) || VENDORS.has(words.join("-")) || words.some((w) => VENDORS.has(w))) return true;
  return words.length === 1 && /\d$/.test(words[0]);
}

/**
 * Every non-generated line of the repo in at most `maxParts` parts, each an area of the scan, in tree order.
 * A file starts in its nearest leaf area (or its own area when no leaf holds it), except under a leaf named in
 * `split`, where it starts in its own area; a part under `minShare` of the lines merges into its parent area,
 * deepest first, until it is big enough or sits at the top level; then the smallest parts merge up until there
 * are at most `maxParts`.
 * @param {{ facts: { id: string, kind: string, name: string, meta?: { leaf?: boolean } }[], files: Record<string, { area: string, loc: number, gen?: number }> }} facts
 * @param {{ minShare?: number, maxParts?: number, split?: string[], names?: Record<string, string> }} [o]
 * @returns {{ id: string, name: string, loc: number, files: number, order: number }[]}
 */
export function partsFromFacts(facts, { minShare = PART_DEFAULTS.minShare, maxParts = PART_DEFAULTS.maxParts, split = [], names = {} } = {}) {
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
    for (let a = id; a; a = parentOf(a)) if (areas.get(a)?.meta?.leaf) return split.includes(a) ? id : a;
    return id;
  };

  // A split part with no folders holding code inside it splits into its files instead, each a part whose id is
  // the file's path, so its parent is the part it came from.
  const code = Object.entries(facts.files).filter(([, f]) => !f.gen);
  const byFile = new Set(split.filter((s) => !code.some(([, f]) => f.area !== s && f.area.startsWith(s === ROOT ? "area:" : `${s}/`))));
  const files = new Set();
  const parts = new Map();
  for (const [file, f] of code) {
    let id = leafOf(f.area);
    if (byFile.has(id) && f.area === id) files.add((id = `area:${file}`));
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
    .map(([id, p], order) => ({ id, name: names[id] ?? areas.get(id)?.name ?? (files.has(id) ? fileName(id) : id.slice(5)), loc: p.loc, files: p.files, order, ...(files.has(id) ? { file: true } : {}) }));
}

// A part over `share` of the lines, or fewer than `parts` parts, draws a shape as one slab. The cold runs' flask
// (62% accent, in rings) and train (58%) read well; Got's bone (95%) was one orange haze.
export const DOMINANT = { share: 0.75, parts: 4 };

/**
 * When one part is most of the code, or there are too few parts, which part to split and what splitting it gives:
 * `{ part, share, count, split: { id, count, largest } | null }`, or null when the parts are fine. `split` is null
 * when the part has no folders inside it to split into.
 */
export function dominance(facts, options = {}) {
  const parts = partsFromFacts(facts, options);
  const total = parts.reduce((s, p) => s + p.loc, 0) || 1;
  const big = parts.reduce((a, b) => (b.loc > a.loc ? b : a), parts[0]);
  if (!big || (big.loc / total <= DOMINANT.share && parts.length >= DOMINANT.parts)) return null;
  const finer = partsFromFacts(facts, { ...options, split: [...(options.split ?? []), big.id] });
  const largest = Math.max(...finer.map((p) => p.loc)) / total;
  return { part: big, share: big.loc / total, count: parts.length, split: finer.length > parts.length ? { id: big.id, count: finer.length, largest, into: finer.some((p) => p.file) ? "files" : "folders" } : null };
}

// Folders that hold code around the product, never the product itself, by the plain word for what they hold.
const AROUND = [
  [/^(examples?|samples?|demos?|playground|sandbox)$/i, "sample code"],
  [/^(tests?|__tests__|specs?|e2e|fixtures?|bench(marks?)?)$/i, "tests"],
  [/^(docs?|documentation|website|guides?)$/i, "docs"],
  [/^(scripts?|ci|\.github)$/i, "scripts"],
];

/**
 * What a part holds when it is code around the product rather than the product: "sample code", "tests", "docs",
 * "scripts", or "setup" for the files at the root. Null for a part the product could be about.
 */
export function aroundProduct(id) {
  if (id === ROOT) return "setup";
  for (const seg of segmentsOf(id)) for (const [re, word] of AROUND) if (re.test(seg)) return word;
  return null;
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

/** A region's part options: its field's defaults, its style's, then its own. */
export const partOptions = (region) => ({ ...FIELDS[region.field]?.parts, ...FIELDS[region.field]?.styleParts?.[region.style ?? (region.field === "shape" ? DEFAULT_STYLE : undefined)], ...region });

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

// Pure 32-bit FNV-1a hash as 8 lowercase hex digits (browser-safe, no node:crypto).
function sliceFnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function sliceUnit(str) {
  return parseInt(sliceFnv1a(str), 16) / 4294967296;
}

/**
 * Hamilton (largest-remainder) integer allocation of `total` units across `weights`, guaranteeing >= 1 per slot.
 * @param {number[]} weights
 * @param {number} total
 */
function hamiltonMinOne(weights, total) {
  const n = weights.length;
  const alloc = new Array(n).fill(1);
  let rem = total - n;
  if (rem <= 0) return alloc;
  const wSum = weights.reduce((s, w) => s + Math.max(0, w), 0);
  const quotas = weights.map((w) => (wSum > 0 ? (rem * Math.max(0, w)) / wSum : rem / n));
  const rems = [];
  let assigned = 0;
  for (let i = 0; i < n; i++) {
    const f = Math.floor(quotas[i]);
    alloc[i] += f;
    assigned += f;
    rems.push({ i, r: quotas[i] - f, w: weights[i] });
  }
  rems.sort((a, b) => b.r - a.r || b.w - a.w || a.i - b.i);
  for (let k = 0; k < rem - assigned; k++) alloc[rems[k].i]++;
  return alloc;
}

/** Split a non-negative numeric total across `weights` while conserving the exact sum. */
function splitConserving(total, weights, integerize = false) {
  const m = weights.length;
  if (m <= 1) return [total];
  const wSum = weights.reduce((s, w) => s + w, 0) || m;
  if (integerize && Number.isInteger(total) && total >= m) {
    return hamiltonMinOne(weights, total);
  }
  if (integerize && Number.isInteger(total) && total >= 0) {
    const raw = weights.map((w) => (total * w) / wSum);
    const out = raw.map((v) => Math.floor(v));
    let left = total - out.reduce((s, v) => s + v, 0);
    const order = raw.map((v, i) => ({ i, r: v - out[i], w: weights[i] })).sort((a, b) => b.r - a.r || b.w - a.w || a.i - b.i);
    for (let k = 0; k < left; k++) out[order[k].i]++;
    return out;
  }
  const out = weights.map((w) => (total * w) / wSum);
  const diff = total - out.reduce((s, v) => s + v, 0);
  out[0] += diff;
  return out;
}

/** Merge `items` (sorted by path) down to `targetCount` contiguous buckets by combining smallest adjacent pairs. */
function mergeFilesToBuckets(items, targetCount) {
  if (items.length <= targetCount) {
    return items.map((f) => ({
      files: [f.path],
      loc: f.loc,
      inDegree: f.inDegree,
      outDegree: f.outDegree,
      degree: f.degree,
      coupling: f.coupling,
    }));
  }
  // Fast contiguous LOC-balanced pre-chunking if a single part has very many files.
  if (items.length > 1500) {
    const totalLoc = items.reduce((s, f) => s + f.loc, 0);
    const buckets = [];
    let idx = 0;
    let remLoc = totalLoc;
    for (let b = 0; b < targetCount; b++) {
      const remBuckets = targetCount - b;
      const maxEnd = items.length - (remBuckets - 1);
      const goal = remBuckets > 1 ? remLoc / remBuckets : Infinity;
      const cur = { files: [], loc: 0, inDegree: 0, outDegree: 0, degree: 0, coupling: 0 };
      while (idx < maxEnd) {
        const f = items[idx];
        if (cur.files.length > 0 && cur.loc + f.loc * 0.5 > goal) break;
        cur.files.push(f.path);
        cur.loc += f.loc;
        cur.inDegree += f.inDegree;
        cur.outDegree += f.outDegree;
        cur.degree += f.degree;
        cur.coupling += f.coupling;
        remLoc -= f.loc;
        idx++;
      }
      buckets.push(cur);
    }
    return buckets;
  }
  const buckets = items.map((f) => ({
    files: [f.path],
    loc: f.loc,
    inDegree: f.inDegree,
    outDegree: f.outDegree,
    degree: f.degree,
    coupling: f.coupling,
  }));
  while (buckets.length > targetCount) {
    let bestIdx = 0;
    let bestLoc = Infinity;
    for (let i = 0; i < buckets.length - 1; i++) {
      const pairLoc = buckets[i].loc + buckets[i + 1].loc;
      if (pairLoc < bestLoc) {
        bestLoc = pairLoc;
        bestIdx = i;
      }
    }
    const a = buckets[bestIdx];
    const b = buckets[bestIdx + 1];
    a.files.push(...b.files);
    a.loc += b.loc;
    a.inDegree += b.inDegree;
    a.outDegree += b.outDegree;
    a.degree += b.degree;
    a.coupling += b.coupling;
    buckets.splice(bestIdx + 1, 1);
  }
  return buckets;
}

/** Subdivide `items` (fewer than `targetCount`) proportionally by LOC into deterministic sub-slices. */
function subdivideFilesToSlices(items, targetCount) {
  const counts = hamiltonMinOne(items.map((f) => Math.max(1, f.loc)), targetCount);
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const f = items[i];
    const m = counts[i];
    if (m <= 1) {
      out.push({
        files: [f.path],
        loc: f.loc,
        inDegree: f.inDegree,
        outDegree: f.outDegree,
        degree: f.degree,
        coupling: f.coupling,
      });
      continue;
    }
    const weights = Array.from({ length: m }, (_, s) => 0.72 + 0.56 * sliceUnit(`${f.path}#loc#${s}`));
    const degWeights = Array.from({ length: m }, (_, s) => 0.65 + 0.7 * sliceUnit(`${f.path}#deg#${s}`));
    const locs = splitConserving(f.loc, weights, Number.isInteger(f.loc) && f.loc >= m);
    const ins = splitConserving(f.inDegree, degWeights, false);
    const outs = splitConserving(f.outDegree, degWeights, false);
    const coups = splitConserving(f.coupling, degWeights, false);
    for (let s = 0; s < m; s++) {
      const inD = ins[s];
      const outD = outs[s];
      out.push({
        files: [f.path],
        loc: locs[s],
        inDegree: inD,
        outDegree: outD,
        degree: inD + outD,
        coupling: coups[s],
      });
    }
  }
  return out;
}

/**
 * Ordered file-level slices across the repo's parts (count in [40, 72] whenever code files exist).
 * Every part is represented in at least one slice and total non-generated LOC is conserved.
 * @param {{ facts: any[], files: Record<string, { area: string, loc: number, gen?: number }>, imports?: [string, string][] }} facts
 * @param {{ target?: number, accent?: string, field?: string, minShare?: number, maxParts?: number, split?: string[], names?: Record<string, string> }} [partOpts]
 */
export function fileSlices(facts, partOpts = {}) {
  const codeEntries = Object.entries(facts?.files ?? {}).filter(([, f]) => f && !f.gen);
  if (!codeEntries.length) return [];

  const useRegion = partOpts.accent !== undefined || partOpts.field !== undefined;
  const baseParts = useRegion ? regionParts(partOpts, facts) : partsFromFacts(facts, partOpts);
  if (!baseParts.length) return [];
  const hotSet = accentIds(baseParts, partOpts.accent);
  const parts = baseParts.map((p) => ({ ...p, hot: p.hot ?? hotSet.has(p.id) }));

  const partIds = new Set(parts.map((p) => p.id));
  const partIndexById = new Map(parts.map((p, i) => [p.id, i]));
  const fallbackPartId = partIds.has(ROOT) ? ROOT : parts[0].id;

  const ownerOfFile = (filePath, fileInfo) => {
    const filePartId = `area:${filePath}`;
    if (partIds.has(filePartId)) return partIndexById.get(filePartId);
    const areaPartId = fileInfo.area ? partOfArea(partIds, fileInfo.area) : null;
    if (areaPartId && partIndexById.has(areaPartId)) return partIndexById.get(areaPartId);
    return partIndexById.get(fallbackPartId);
  };

  // Map every non-generated file to its owning part and initialize import degree stats.
  const fileMap = new Map();
  const grouped = Array.from({ length: parts.length }, () => []);
  for (const [filePath, info] of codeEntries) {
    const pIdx = ownerOfFile(filePath, info);
    const rec = {
      path: filePath,
      partIndex: pIdx,
      loc: Number(info.loc) || 0,
      inDegree: 0,
      outDegree: 0,
      degree: 0,
      coupling: 0,
    };
    fileMap.set(filePath, rec);
    grouped[pIdx].push(rec);
  }

  // Accumulate per-file inDegree, outDegree, degree, and cross-part coupling from facts.imports.
  for (const [a, b] of facts.imports ?? []) {
    if (a === b) continue;
    const fa = fileMap.get(a);
    const fb = fileMap.get(b);
    if (!fa || !fb) continue;
    fa.outDegree += 1;
    fb.inDegree += 1;
    if (fa.partIndex !== fb.partIndex) {
      fa.coupling += 1;
      fb.coupling += 1;
    }
  }
  for (const rec of fileMap.values()) {
    rec.degree = rec.inDegree + rec.outDegree;
  }

  // Deterministic path sort within each part (parts are already in tree order).
  for (const grp of grouped) {
    grp.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  const totalFiles = codeEntries.length;
  const rawTarget = partOpts.target != null
    ? Math.round(partOpts.target)
    : totalFiles >= 40 && totalFiles <= 72
      ? totalFiles
      : totalFiles < 40
        ? 48
        : 64;
  const desiredTotal = Math.max(parts.length, Math.min(72, Math.max(40, rawTarget)));

  const partLocs = grouped.map((grp, i) => grp.reduce((s, f) => s + f.loc, 0) || parts[i].loc || 0);
  const partSliceCounts = hamiltonMinOne(partLocs, desiredTotal);

  const rawSlices = [];
  for (let pIdx = 0; pIdx < parts.length; pIdx++) {
    const part = parts[pIdx];
    const grp = grouped[pIdx];
    const targetK = partSliceCounts[pIdx];
    let items;
    if (!grp.length) {
      items = [{ files: [], loc: 0, inDegree: 0, outDegree: 0, degree: 0, coupling: 0 }];
    } else if (grp.length > targetK) {
      items = mergeFilesToBuckets(grp, targetK);
    } else if (grp.length < targetK) {
      items = subdivideFilesToSlices(grp, targetK);
    } else {
      items = grp.map((f) => ({
        files: [f.path],
        loc: f.loc,
        inDegree: f.inDegree,
        outDegree: f.outDegree,
        degree: f.degree,
        coupling: f.coupling,
      }));
    }
    for (const item of items) {
      const index = rawSlices.length;
      rawSlices.push({
        index,
        partId: part.id,
        partIndex: pIdx,
        partName: part.name,
        hot: !!part.hot,
        files: item.files,
        loc: item.loc,
        locNorm: 0,
        inDegree: item.inDegree,
        outDegree: item.outDegree,
        degree: item.degree,
        degreeNorm: 0,
        coupling: item.coupling,
        hash: sliceFnv1a(`${part.id}|${index}|${item.files.join(",")}`),
      });
    }
  }

  const maxLoc = Math.max(...rawSlices.map((s) => s.loc), 0);
  const maxDegree = Math.max(...rawSlices.map((s) => s.degree), 0);
  for (const s of rawSlices) {
    s.locNorm = maxLoc > 0 ? s.loc / maxLoc : 0;
    s.degreeNorm = maxDegree > 0 ? s.degree / maxDegree : 0;
  }

  return rawSlices;
}


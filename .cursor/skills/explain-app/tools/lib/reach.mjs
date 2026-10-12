// Link walking over a FactsFile (CONTRACTS.md §3.3): from one file, breadth-first along `imports`
// and `http` calls to endpoint files, never through kit files, at most MAX_HOPS hops.
// `wire` uses it to link parts; `diffFacts` uses it to ask what a screen or job reaches.
//
// Everything here is pure: no I/O, and every list it hands back is sorted.
//
//   const graph = buildLinkGraph(facts);                       // once per FactsFile
//   const view = makeView(graph, { skipEndpoint });            // once per question
//   const w = walk(view, "app/page.tsx", { onUses, stopAt });  // once per start file

export const MAX_HOPS = 3;

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function push(map, key, value) {
  const l = map.get(key);
  if (l) l.push(value);
  else map.set(key, [value]);
}

// Sort each list and drop repeats, so the maps are deterministic whatever order `facts` arrives in.
function settle(map) {
  for (const [k, l] of map) {
    l.sort(cmp);
    map.set(k, l.filter((x, i) => i === 0 || x !== l[i - 1]));
  }
}

/**
 * FactsFile → the maps the walk needs. Pure, deterministic; entries that name a file outside `files` are dropped.
 *  - importsOut: file → files it imports (sorted, unique)
 *  - usesOf:     file → fact ids it uses, any `via` (sorted, unique)
 *  - httpOf:     file → endpoint ids it calls over http (sorted, unique)
 *  - factById:   id → Fact
 *  - files:      the FactsFile's `files` (FileInfo records; carries `kit` and `gen`)
 */
export function buildLinkGraph(facts) {
  const files = facts?.files ?? {};
  const factList = Array.isArray(facts?.facts) ? facts.facts : [];
  const factById = new Map(factList.map((f) => [f.id, f]));
  const importsOut = new Map();
  for (const [a, b] of facts?.imports ?? []) if (files[a] && files[b]) push(importsOut, a, b);
  const usesOf = new Map();
  const httpOf = new Map();
  for (const [file, id, via] of facts?.uses ?? []) {
    if (!files[file]) continue;
    push(usesOf, file, id);
    if (via === "http") push(httpOf, file, id);
  }
  settle(importsOut);
  settle(usesOf);
  settle(httpOf);
  return { importsOut, usesOf, httpOf, factById, files };
}

/**
 * A graph seen through one question. `skipEndpoint(id)` is true for endpoints that must not be followed
 * (`wire` skips those a part cites: the part is the target there, so the walk reports it as a use instead).
 *
 * `neighbours(file)` → sorted [toFile, viaEndpointId | undefined] pairs: the files `file` imports, plus the
 * defining files of each endpoint it calls over http that `skipEndpoint` lets through. The skip is applied
 * before the pairs are de-duplicated, and an import of a file wins over an http hop to it.
 */
export function makeView(graph, { skipEndpoint = () => false } = {}) {
  const { importsOut, httpOf, factById, files } = graph;
  const cache = new Map();
  const neighbours = (file) => {
    let c = cache.get(file);
    if (c) return c;
    const m = new Map();
    for (const to of importsOut.get(file) ?? []) if (!m.has(to)) m.set(to, undefined);
    for (const id of httpOf.get(file) ?? []) {
      const ep = factById.get(id);
      if (!ep || ep.kind !== "endpoint" || skipEndpoint(id)) continue;
      for (const to of ep.files ?? []) if (files[to] && !m.has(to)) m.set(to, id);
    }
    c = [...m].sort((x, y) => cmp(x[0], y[0]));
    cache.set(file, c);
    return c;
  };
  return { graph, neighbours };
}

/**
 * The chain of nodes from the start file to `node`: [file, …, file], with the id of the endpoint an http hop
 * went through just before the file it led to: [file, endpointId, endpointFile]. `parent` comes from `walk`.
 */
export function chainTo(parent, node) {
  const out = [];
  for (let cur = node; ; ) {
    out.push(cur);
    const e = parent.get(cur);
    if (!e) break;
    if (e.via) out.push(e.via);
    cur = e.prev;
  }
  return out.reverse();
}

/**
 * Breadth-first from `start`, at most `maxHops` hops. A file is entered at most once, by the first shortest
 * way found (neighbours are visited in sorted order). Kit files and files outside `files` are never
 * entered. The start file itself is never filtered.
 *
 * Options:
 *  - include(file) → boolean: false keeps the file out of the walk, e.g. `f => !files[f].gen` for strong links only.
 *  - stopAt(file) → boolean: true enters the file but looks no further at it: its uses are not reported and
 *    nothing is followed past it (`wire` stops at the first file a part owns).
 *  - onUses(file, ids, parent): the start file and every entered, non-stopped file that uses facts, with those
 *    fact ids (sorted, any `via`). Reached in walk order, after `file` is in `parent`, so
 *    `chainTo(parent, file)` already works.
 *  - onStop(file, parent): every file `stopAt` held, in walk order.
 *
 * Returns { parent, visited, stopped, endpoints }:
 *  - parent: Map file → { prev, via? } for each entered file (start → null). `via` is the endpoint id of an
 *    http hop. Hand it to `chainTo`.
 *  - visited: start plus every entered file that was not stopped, in walk order.
 *  - stopped: files `stopAt` held, in walk order.
 *  - endpoints: sorted, unique ids of the endpoints the walk followed over http.
 */
export function walk(view, start, { maxHops = MAX_HOPS, include, stopAt, onUses, onStop } = {}) {
  const { usesOf, files } = view.graph;
  const parent = new Map([[start, null]]);
  const visited = [start];
  const stopped = [];
  const examine = (file) => {
    const ids = usesOf.get(file);
    if (ids && onUses) onUses(file, ids, parent);
  };
  examine(start);
  let frontier = [start];
  for (let hop = 1; hop <= maxHops && frontier.length; hop++) {
    const next = [];
    for (const cur of frontier) {
      for (const [to, via] of view.neighbours(cur)) {
        if (parent.has(to)) continue;
        const info = files[to];
        if (!info || info.kit || (include && !include(to))) continue;
        parent.set(to, { prev: cur, via });
        if (stopAt && stopAt(to)) {
          stopped.push(to);
          if (onStop) onStop(to, parent);
          continue;
        }
        visited.push(to);
        examine(to);
        if (hop < maxHops) next.push(to);
      }
    }
    frontier = next;
  }
  const endpoints = new Set();
  for (const e of parent.values()) if (e?.via) endpoints.add(e.via);
  return { parent, visited, stopped, endpoints: [...endpoints].sort(cmp) };
}

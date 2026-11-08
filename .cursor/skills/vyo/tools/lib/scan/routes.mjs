// Route path helpers shared by the screen / endpoint detectors and the http matcher.

// One path segment -> canonical form. :id {id} <id> $id [id] -> [id]; catch-alls -> [...name].
export function normSegment(seg) {
  if (seg === "") return "";
  let m;
  if ((m = /^\[\[\.\.\.([\w$-]+)\]\]$/.exec(seg))) return `[...${m[1]}]`;
  if ((m = /^\[\.\.\.([\w$-]+)\]$/.exec(seg))) return `[...${m[1]}]`;
  if ((m = /^\[\[([\w$-]+)(?:=[^\]]*)?\]\]$/.exec(seg))) return `[${m[1]}]`;
  if ((m = /^\[([\w$-]+)(?:=[^\]]*)?\]$/.exec(seg))) return `[${m[1]}]`;
  if (seg === "*" || seg === "**" || seg === "(.*)" || seg === ":path*" || seg === "$") return "[...splat]";
  if ((m = /^:([\w$-]+)\*$/.exec(seg))) return `[...${m[1]}]`;
  if ((m = /^:([\w$-]+)(?:\([^)]*\))?[?+*]?$/.exec(seg))) return `[${m[1]}]`;
  if ((m = /^\{(?:[\w$]+:)?([\w$-]+)(?::[^}]*)?\??\}$/.exec(seg))) return `[${m[1]}]`;
  if ((m = /^<(?:[\w]+:)?([\w$-]+)>$/.exec(seg))) return `[${m[1]}]`;
  if ((m = /^\$([\w$-]+)$/.exec(seg))) return `[${m[1]}]`;
  return seg
    .replace(/\{(?:[\w$]+:)?([\w$-]+)(?::[^}]*)?\??\}/g, "[$1]")
    .replace(/<(?:[\w]+:)?([\w$-]+)>/g, "[$1]");
}

// "/a/:id/" -> "/a/[id]"; "" -> "/"
export function normRoutePath(p) {
  const q = p.search(/[?#]/);
  if (q >= 0) p = p.slice(0, q);
  const segs = p.split("/").filter((s) => s !== "").map(normSegment).filter((s) => s !== "");
  return "/" + segs.join("/");
}

export const isDynSeg = (s) => /^\[.*\]$/.test(s);

// Segments for matching: params become "*".
export function matchSegs(p) {
  return normRoutePath(p)
    .split("/")
    .filter(Boolean)
    .map((s) => (isDynSeg(s) ? "*" : s));
}

// Join route fragments ("/api", "/v1/", "items") -> "/api/v1/items"
export function joinRoute(...parts) {
  const segs = [];
  for (const p of parts) {
    if (!p) continue;
    for (const s of String(p).split("/")) if (s !== "") segs.push(s);
  }
  return normRoutePath("/" + segs.join("/"));
}

// http literal vs endpoint path: one must be a segment-suffix of the other; the shorter needs a static segment
// that lines up with a static segment on the other side (a lone "/login" must not match a trailing "[id]").
// Returns null for no match, else how many static segments a wildcard had to swallow (0 = the tightest fit).
export function segSuffixMatch(a, b) {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length === 0 || !short.some((s) => s !== "*")) return null;
  const off = long.length - short.length;
  let anchored = false;
  let swallowed = 0;
  for (let i = 0; i < short.length; i++) {
    const x = short[i];
    const y = long[off + i];
    if (x === "*" && y === "*") continue;
    if (x === "*" || y === "*") {
      swallowed++;
      continue;
    }
    if (x !== y) return null;
    anchored = true;
  }
  return anchored ? swallowed : null;
}

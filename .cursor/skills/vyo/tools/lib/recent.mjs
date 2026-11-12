// The shapes compose has used lately, so the next poster does not repeat them. Node I/O, not inlined.
import fs from "node:fs";
import path from "node:path";

export const RECENT_KEEP = 8;

/** `{ shapes }` newest last. A missing file is an empty log. */
export function readRecent(file) {
  if (!file || !fs.existsSync(file)) return { shapes: [] };
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const shapes = Array.isArray(data?.shapes) ? data.shapes.filter((s) => typeof s === "string") : [];
    return { shapes };
  } catch {
    return { shapes: [] };
  }
}

/** Append `name` and keep the last 8. Creates the directory. */
export function recordShape(file, name) {
  const shapes = [...readRecent(file).shapes, name].slice(-RECENT_KEEP);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ shapes }, null, 2) + "\n");
  return shapes;
}

/**
 * A field that is not wave. Prefer a candidate absent from the log, chosen by `key` so two repos
 * with empty logs start on different shapes; if every non-wave field is in it, take the least
 * recently used. Never returns wave.
 * @param {string[]} names registry order
 * @param {string[]} recent newest last
 * @param {number} key a whole number from the facts, such as its hash
 */
export function pickField(names, recent, key = 0) {
  const candidates = names.filter((n) => n !== "wave");
  const used = new Set(recent);
  const fresh = candidates.filter((n) => !used.has(n));
  if (fresh.length) return fresh[Math.abs(Math.trunc(key)) % fresh.length];
  let best = candidates[0];
  let bestAt = Infinity;
  for (const n of candidates) {
    const at = recent.lastIndexOf(n);
    if (at >= 0 && at < bestAt) {
      bestAt = at;
      best = n;
    }
  }
  return best;
}

/**
 * The ready silhouette a cover starts from: of those not in the log, the one whose `words` start the most words of
 * `text` (the README), each word counted once; ties and a README that names none go by `key`. When every
 * silhouette is in the log, the least recently used. Returns the name and the words that matched.
 * @param {Record<string, { words: string[] }>} silhouettes
 * @param {string} text
 * @param {string[]} recent newest last
 * @param {number} key
 */
export function pickSilhouette(silhouettes, text, recent, key = 0) {
  const names = Object.keys(silhouettes);
  const used = new Set(recent);
  const fresh = names.filter((n) => !used.has(n));
  if (!fresh.length) return { name: pickField(names, recent.filter((n) => names.includes(n)), key), matched: [] };
  const starts = new Set(String(text).toLowerCase().match(/[a-z][a-z-]*/g) ?? []);
  const matched = (n) => silhouettes[n].words.filter((w) => [...starts].some((s) => s.startsWith(w)));
  const rotated = fresh.map((_, i) => fresh[(i + Math.abs(Math.trunc(key))) % fresh.length]);
  const name = rotated.reduce((best, n) => (matched(n).length > matched(best).length ? n : best), rotated[0]);
  return { name, matched: matched(name) };
}

/** How many shapes have been picked since `name`, or null when it has never been used. */
export function usedAgo(shapes, name) {
  const at = shapes.lastIndexOf(name);
  return at < 0 ? null : shapes.length - 1 - at;
}

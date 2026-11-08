// Small shared helpers for the scanner. Paths are repo-relative POSIX strings;
// the repo root directory is "" internally and "." in anything that is published.

export const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function sortedUnique(iter) {
  return [...new Set(iter)].sort(cmp);
}

export function dirname(p) {
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}

export function basename(p) {
  return p.slice(p.lastIndexOf("/") + 1);
}

export function extname(p) {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i <= 0 ? "" : b.slice(i).toLowerCase();
}

export function stripExt(p) {
  const e = extname(p);
  return e ? p.slice(0, -e.length) : p;
}

// Join and normalise POSIX segments. Returns null when the path climbs above the repo root.
export function joinPath(...parts) {
  const out = [];
  for (const part of parts) {
    if (part == null || part === "") continue;
    for (const seg of String(part).split("/")) {
      if (seg === "" || seg === ".") continue;
      if (seg === "..") {
        if (out.length === 0) return null;
        out.pop();
      } else out.push(seg);
    }
  }
  return out.join("/");
}

export function isUnder(path, dir) {
  return dir === "" || path === dir || path.startsWith(dir + "/");
}

// "" -> "."
export const pub = (dir) => (dir === "" ? "." : dir);

export function bump(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}

export function addTo(map, key, value) {
  let s = map.get(key);
  if (!s) map.set(key, (s = new Set()));
  s.add(value);
  return s;
}

// Count non-blank lines.
export function countLoc(text) {
  let loc = 0;
  let seen = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 10) {
      if (seen) loc++;
      seen = false;
    } else if (c > 32) seen = true;
  }
  if (seen) loc++;
  return loc;
}

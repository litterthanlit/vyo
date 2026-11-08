// Shared hashing for page 3 (see ../CONTRACTS.md). The canvas carries its own
// copy of fnv1a — keep the two byte-for-byte identical.
import { createHash } from "node:crypto";

// Recursively sort object keys so the same data always serialises the same way.
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]));
  }
  return value;
}

// Deterministic JSON: sorted keys, optional indent. Same input → same bytes.
export function stableStringify(value, indent) {
  return JSON.stringify(sortKeys(value), null, indent);
}

// facts.json hash: first 12 hex of sha256 over the canonical JSON of the file without its "hash" key.
export function factsHash(facts) {
  const { hash: _ignored, ...rest } = facts;
  return createHash("sha256").update(stableStringify(rest)).digest("hex").slice(0, 12);
}

// 32-bit FNV-1a over UTF-16 code units, as 8 lowercase hex digits.
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// The PARTS fingerprint stored in WIRING.parts. Names and lines are excluded on purpose:
// rewording a part never needs a re-wire; changing what it cites does.
export function partsHash(parts) {
  return fnv1a(JSON.stringify(parts.map((p) => [p.role, p.from])));
}

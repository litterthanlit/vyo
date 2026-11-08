// The footer's facts: counts from facts.json and the provenance line. Render owns both; the agent never types them.

const baseId = (id) => id.replace(/#.*$/, "");
const distinct = (facts, kind, keep = () => true) => new Set(facts.filter((f) => f.kind === kind && keep(f)).map((f) => baseId(f.id)));

/** @param {{facts: {id: string, kind: string, name: string}[]}} facts */
export function bandCounts(facts) {
  const list = facts.facts;
  const capabilities = [...new Set(list.filter((f) => f.kind === "service").map((f) => (f.name || f.id.slice(8)).toLowerCase()))];
  return {
    screens: distinct(list, "screen").size,
    requests: distinct(list, "endpoint").size,
    records: distinct(list, "table").size,
    services: capabilities.length,
    capabilities,
    ai: distinct(list, "ai", (f) => f.id !== "ai:gateway").size,
    jobs: distinct(list, "job").size,
  };
}

const PHRASES = [
  ["screens", (n) => `${n} ${n === 1 ? "screen" : "screens"}`],
  ["requests", (n) => `${n} ${n === 1 ? "kind" : "kinds"} of request`],
  ["records", (n) => `${n} ${n === 1 ? "kind" : "kinds"} of saved record`],
  ["services", (n, c) => `${n} outside ${n === 1 ? "service" : "services"}${c.capabilities.length <= 3 ? ` (${c.capabilities.join(", ")})` : ""}`],
  ["ai", (n) => `${n} AI ${n === 1 ? "model" : "models"}`],
  ["jobs", (n) => `runs ${n} ${n === 1 ? "job" : "jobs"} on its own`],
];

/** "6 screens, 3 kinds of request, …": only the non-zero counts, in a fixed order. */
export function bandLine(counts) {
  return PHRASES.filter(([k]) => counts[k] > 0).map(([k, say]) => say(counts[k], counts)).join(", ");
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Pantry at 04186f4, 28 October 2026", or "Pantry, 28 October 2026" without a commit. */
export function provenance(product) {
  return `${product.name}${product.commit ? ` at ${product.commit}` : ""}, ${longDate(product.date)}`;
}

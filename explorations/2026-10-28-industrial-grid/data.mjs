// Builds data.json for the mockups from the explain-app scan of Hypher.
import fs from "node:fs";
const f = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const GROUPS = [
  ["SCREENS", "what you open and click", p => p.startsWith("hypher-web/src/")],
  ["MEMORY", "where every note is kept", p => p.startsWith("hypher-web/convex/")],
  ["NOTE ENGINE", "writes and checks the note", p => p.startsWith("hypher-web/shared/")],
  ["COMMAND LINE", "save and resume from any agent", p => p.startsWith("packages/hypher-cli/")],
  ["SCRIPTS", "proof runs and helpers", p => p.startsWith("script/")],
  ["MAC APP", "capture from the desktop", p => p.startsWith("Hypher/")],
  ["BROWSER", "capture from any tab", p => p.startsWith("extensions/chrome/")],
  ["OTHER", "Cursor kit, git reader, tools", () => true],
];
const groupOf = p => GROUPS.findIndex(g => g[2](p));
const lines = GROUPS.map(() => 0);
for (const [p, { loc }] of Object.entries(f.files)) lines[groupOf(p)] += loc;
const total = lines.reduce((a, b) => a + b, 0);
const endpointFiles = Object.fromEntries(f.facts.filter(x => x.kind === "endpoint").map(x => [x.id, x.files]));
const link = {};
const add = (a, b) => { const ga = groupOf(a), gb = groupOf(b); if (ga === gb) return; const k = [ga, gb].sort().join("-"); link[k] = (link[k] || 0) + 1; };
for (const [a, b] of f.imports) add(a, b);
for (const [a, id] of f.uses) for (const b of endpointFiles[id] || []) add(a, b);
const parts = GROUPS.map(([name, role], i) => ({ name, role, lines: lines[i], share: lines[i] / total }));
const links = Object.entries(link).map(([k, n]) => ({ a: +k.split("-")[0], b: +k.split("-")[1], n }));
fs.writeFileSync("data.json", JSON.stringify({ parts, links, total, files: Object.keys(f.files).length }));
console.log(parts.map(p => `${p.name} ${p.lines} ${(100 * p.share).toFixed(1)}%`).join("\n"), "\n", links);

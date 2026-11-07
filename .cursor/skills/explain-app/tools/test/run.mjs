// npm test: the pure tests, then every golden poster rendered and checked, then the planted bugs.
// Posters land in test/.out/<shape>/ for a human to look at.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SHAPES } from "../lib/shapes/index.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.join(HERE, "..");
const OUT = path.join(HERE, ".out");
const VYO = path.join(TOOLS, "vyo.mjs");

const pure = spawnSync(process.execPath, ["--test", ...["scan", "spec", "band", "shapes"].map((t) => path.join(HERE, `${t}.test.mjs`))], { stdio: "inherit" });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const factsFile = path.join(OUT, "recipe-facts.json");
const vyo = (...args) => spawnSync(process.execPath, [VYO, ...args], { encoding: "utf8" });
const scan = vyo("scan", path.join(HERE, "fixtures", "recipe"), "--out", factsFile);
if (scan.status !== 0) {
  console.error(scan.stderr);
  process.exit(1);
}
const hash = JSON.parse(fs.readFileSync(factsFile, "utf8")).hash;
const golden = (id) => ({ ...JSON.parse(fs.readFileSync(path.join(HERE, "golden", `${id}.json`), "utf8")), facts: hash });

let failed = 0;
const result = (ok, name, detail) => {
  console.log(`${ok ? "ok" : "not ok"} - ${name}`);
  if (!ok) {
    failed++;
    console.log(detail.replace(/^/gm, "    "));
  }
};

for (const id of Object.keys(SHAPES)) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const specFile = path.join(dir, "recipe-poster.json");
  fs.writeFileSync(specFile, JSON.stringify(golden(id), null, 2));
  const r = vyo("render", specFile, "--facts", factsFile);
  result(r.status === 0 && /^PASS$/m.test(r.stdout) && !/^✗/m.test(r.stderr), `golden ${id} renders and passes every check`, r.stdout + r.stderr);
}

const PLANTED = [
  ["a file path", "hourglass", (s) => (s.notes[0].text = "Saved by lib/plan/save.ts each week."), /^✗ spec: notes\[0\]\.text: a file path/m],
  ["jargon", "hourglass", (s) => (s.headline = "Your recipes behind one API."), /^✗ spec: headline: jargon: "api"/m],
  ["a hot word not in the slots", "ribbon", (s) => (s.hot = "breakfast"), /^✗ spec: hot: "breakfast" must be/m],
  ["a fourth note", "hourglass", (s) => s.notes.push({ title: "More", text: "One more note." }), /^✗ spec: notes: 4 notes; hourglass takes exactly 3/m],
  [
    "words too long for the waist",
    "hourglass",
    (s) => (s.slots.top = ["weeknight dinner", "saved favourites", "pantry leftovers", "seasonal produce", "kitchen cupboard", "allergies listed"]),
    /^✗ rows-fit: the row "[^"]+" needs \d+px but has \d+px; use shorter words/m,
  ],
  ["a note that runs into the bottom line", "hourglass", (s) => (s.notes[1].text = "Plain words that keep going. ".repeat(8).slice(0, 220).replace(/ /g, "")), /^✗ blocks-(apart|inside): /m],
  ["a stale facts hash", "hourglass", (s) => (s.facts = "000000000000"), /^✗ facts-hash: spec\.facts is 000000000000 but facts\.json is /m],
];

for (const [name, id, mutate, expect] of PLANTED) {
  const spec = golden(id);
  mutate(spec);
  const file = path.join(OUT, "planted.json");
  fs.writeFileSync(file, JSON.stringify(spec, null, 2));
  const r = vyo("check", file, "--facts", factsFile);
  result(r.status === 1 && expect.test(r.stderr), `planted bug (${name}) fails with ${expect}`, `exit ${r.status}\n${r.stderr}`);
}

if (pure.status !== 0) console.log("✗ the pure tests failed (see above)");
console.log(failed ? `✗ ${failed} browser test(s) failed` : `browser: ${Object.keys(SHAPES).length} golden posters in ${OUT}, ${PLANTED.length} planted bugs caught`);
process.exit(failed || pure.status !== 0 ? 1 : 0);

// Self-test: the starters must pass `check`, and each planted bug must fail
// with the expected message. Also exports the starters to HTML, type-checks them,
// and runs the scanner, wire and install unit tests.
//
//   npm test
//
// Page 3 cases travel in pairs: <name>-exploded-view.canvas.tsx and the sibling
// <name>-facts.json the checker wires against (a scan of fixtures/recipe).
import { execFileSync, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { check, parseState } from "../poster.mjs";
import { stableStringify } from "../lib/hash.mjs";
import { readBlocks, wire, writeWiring } from "../lib/wire.mjs";
import { scanRepo } from "../scan.mjs";

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.resolve(TOOLS, "..");
const OUT = path.join(TOOLS, "test", ".out");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const code = (md) => fs.readFileSync(path.join(SKILL, md), "utf8").match(/```tsx\n([\s\S]*?)```/)[1];
const app = code("poster-starter.md");
// Page 2 reuses page 1's constants and helpers ("copy from poster-starter.md").
const shared = app.split("export default function AppPoster")[0];
const story = shared + code("sell-sheet-starter.md").replace(/^import .*\n/, "");
const exploded = shared + code("exploded-view-starter.md").replace(/^import .*\n/, "");

const write = (name, src) => {
  const f = path.join(OUT, `${name}.canvas.tsx`);
  fs.writeFileSync(f, src);
  return f;
};
const plant = (src, from, to) => {
  if (!src.includes(from)) throw new Error(`Fixture anchor not found in starter: ${from}`);
  return src.replace(from, to);
};

// ── Page 3 fixtures ──
// The starter's WIRING was made from a scan of fixtures/recipe, so that scan is the facts file every page 3 case gets.
const recipeFacts = await scanRepo(path.join(TOOLS, "test", "fixtures", "recipe"));
const factsText = stableStringify(recipeFacts, 1); // what `scan --out` writes
const write3 = (name, src, { facts = factsText } = {}) => {
  const f = write(`${name}-exploded-view`, src);
  if (facts !== null) fs.writeFileSync(path.join(OUT, `${name}-facts.json`), facts);
  return f;
};
// The starter with its PARTS rewritten; `rewire` also regenerates WIRING, so only the PARTS rule under test is broken.
const withParts = (src, edit, { rewire = false } = {}) => {
  const { parts, partsRange } = readBlocks(src);
  const next = edit(structuredClone(parts));
  const body = `const PARTS: PartSpec[] = [\n${next.map((p) => `  ${JSON.stringify(p)}`).join(",\n")}\n];\n`;
  const out = src.slice(0, partsRange.bodyStart) + body + src.slice(partsRange.bodyEnd);
  if (!rewire) return out;
  const { wiring, errors } = wire(recipeFacts, next);
  if (errors.length) throw new Error(`Fixture does not wire: ${errors.join("; ")}`);
  return writeWiring(out, wiring);
};
const cut = (src, re) => {
  if (!re.test(src)) throw new Error(`Fixture anchor not found in starter: ${re}`);
  return src.replace(re, "");
};
const guard = exploded.split("\n").find((l) => l.includes("if (t.length > 4) throw")); // the canvas's own 4-per-tier guard
if (!guard) throw new Error("Fixture anchor not found in starter: the 4-per-tier guard");
const tables = ["User", "Recipe", "Ingredient", "MealPlan"];
const fiveInATier = (src) =>
  withParts(src, (parts) => [
    parts[0],
    parts[1],
    ...tables.map((t) => ({ name: `${t} records`, role: "data", line: `Where ${t} is kept.`, from: [`table:${t}`] })),
    parts[6],
  ], { rewire: true });

const cases = [
  { file: write("starter-app-poster", app), expect: null },
  { file: write("starter-project-story", story), expect: null },
  { file: write3("starter", exploded), expect: null, clean: true },
  {
    file: write("bug-five-stations-app-poster", plant(app, '{ label: "Back out", sub: "what you receive" },', '{ label: "Back out", sub: "what you receive" },\n    { label: "Fifth", sub: "x" },')),
    expect: /5 won't land on the 12-column grid/,
  },
  {
    file: write("bug-line-gap-app-poster", plant(app, "right: -(GUTTER + DOT / 2)", "right: -DOT / 2")),
    expect: /does not join two stations/,
  },
  {
    file: write("bug-off-baseline-app-poster", plant(app, "marginTop: BL - 2", "marginTop: BL")),
    expect: /Off the 8px baseline/,
  },
  {
    file: write("bug-fifth-size-app-poster", plant(app, '<p style={{ ...body, maxWidth: "28em" }}>', '<p style={{ ...body, fontSize: 13, maxWidth: "28em" }}>')),
    expect: /5 font sizes/,
  },
  {
    file: write("bug-small-masthead-app-poster", plant(app, 'fontSize: 112, lineHeight: "112px"', 'fontSize: 96, lineHeight: "96px"')),
    expect: /Masthead is 96px/,
  },
  {
    file: write("bug-red-rule-app-poster", plant(app, "borderTop: `1px solid ${INK}`", "borderTop: `1px solid ${ACCENT}`")),
    expect: /Border colour/,
  },
  {
    file: write("bug-import-app-poster", `import { format } from "date-fns";\n${app}`),
    expect: /Imports "date-fns"/,
  },
  {
    file: write("bug-file-path-app-poster", plant(app, "One-sentence purpose, set in ink.", "Pages live in src/app/page.tsx.")),
    expect: /File paths on the poster/,
  },
  {
    file: write("bug-negative-margin-app-poster", plant(app, '<div style={{ gridColumn: "1 / 8" }}>', '<div style={{ gridColumn: "1 / 8", marginLeft: -16 }}>')),
    expect: /Off the column lines/,
  },
  {
    file: write("bug-overlay-drift-app-poster", plant(app, "inset: MARGIN, ...subgrid", "inset: 0, ...subgrid")),
    expect: /overlay columns do not match/,
  },
  // ── Page 3: the starter, then one planted bug per rule ──
  { file: write3("facts-override", exploded, { facts: null }), facts: path.join(OUT, "starter-facts.json"), expect: null }, // --facts
  { file: write3("dark-state", exploded), state: { themeExploded: "dark" }, expect: /Stroke colour rgb\(242, 242, 242\)/ }, // --state reaches the canvas
  // facts and wiring
  { file: write3("bug-no-facts", exploded, { facts: null }), expect: /No .*-facts\.json beside the canvas/ },
  { file: write3("bug-facts-edited", exploded, { facts: plant(factsText, '"loc": ', '"loc": 1') }), expect: /facts\.json hash does not recompute/ },
  { file: write3("bug-no-wiring", cut(exploded, /\/\/ WIRING:BEGIN[^\n]*\n[^\n]*\n\/\/ WIRING:END\n/)), expect: /No \/\/ WIRING:BEGIN/ },
  { file: write3("bug-missing-fact", plant(exploded, '"from": ["table:*"]', '"from": ["table:*", "table:Nope"]')), expect: /wire: Part "Saved recipes": "table:Nope" matches nothing/ },
  { file: write3("bug-hand-edited-wiring", plant(exploded, '{"count":6,"drawn":6,"items":[1,1,1,1,1,1]', '{"count":7,"drawn":6,"items":[1,1,1,1,1,1]')), expect: /WIRING does not match a fresh wire/ },
  { file: write3("bug-stale-parts", plant(exploded, '"from": ["screen:**"]', '"from": ["screen:/recipes/**"]')), expect: [/PARTS changed/, /WIRING does not match a fresh wire/] },
  { file: write3("bug-ten-parts", withParts(exploded, (parts) => [...parts, { ...parts[1], name: "Extra one" }, { ...parts[2], name: "Extra two" }, { ...parts[3], name: "Extra three" }])), expect: /wire: 10 parts — use 2 to 9/ },
  { file: write3("bug-five-in-a-tier", fiveInATier(exploded)), expect: /Tier with 5 parts — merge parts/ },
  { file: write3("bug-five-in-a-tier-unguarded", plant(fiveInATier(exploded), guard, "")), expect: /5 parts in one tier — merge parts/ },
  // the drawing against the wiring
  { file: write3("bug-disks", plant(exploded, "const n = Math.max(1, w.drawn);", "const n = 5;")), expect: /Part 6 draws 5 items but counts 4/ },
  { file: write3("bug-no-hashes", plant(exploded, "data-facts-hash={WIRING.facts} data-parts-hash={WIRING.parts} ", "")), expect: /data-facts-hash/ },
  { file: write3("bug-link-ends", plant(exploded, '"data-from-part": p, "data-to-part": q', '"data-from-part": p, "data-to-part": q + 20')), expect: /Link \d+ has bad ends/ },
  { file: write3("bug-tall-figure", plant(exploded, "const PAD = 32;", "const PAD = 400;")), expect: /Drawing is \d+px tall/ },
  // palette and copy
  { file: write3("bug-blue-stroke", plant(exploded, "? { line: T.ink, detail: T.ink,", '? { line: "#0057FF", detail: T.ink,')), expect: /Stroke colour/ },
  { file: write3("bug-blue-fill", plant(exploded, "<circle key={m} cx={x} cy={y} r={2.5} fill={T.paper}", '<circle key={m} cx={x} cy={y} r={2.5} fill="#0057FF"')), expect: /Fill colour/ },
  { file: write3("bug-file-path", plant(exploded, "the parts that save your recipes, plan your week and suggest what to cook.", "see src/app/page.tsx for the parts.")), expect: /File paths on the poster/ },
  // labels and leaders
  { file: write3("bug-labels-overlap", plant(exploded, "Math.max(routes[i].hint, k ? ys[k - 1] + LABEL_STEP : PAD)", "k ? ys[k - 1] : PAD")), expect: /labels overlap/ },
  // Labels fit 18 ordinary characters, so the wrap and overrun cases need a deliberately wide name.
  { file: write3("bug-label-wraps", plant(plant(exploded, 'whiteSpace: "nowrap",', ""), '"name": "Outside services"', '"name": "Wwwwwwwwww Wwwwwww"')), expect: /Label \d wraps/ },
  { file: write3("bug-leader-drift", plant(exploded, 'return at(i, x + (side[i] === "left" ? 0.1 : -0.1) * 2 * hw, y);', 'return at(i, x + 80 + (side[i] === "left" ? 0.1 : -0.1) * 2 * hw, y);')), expect: /Leader line \d does not start on its part/ },
  { file: write3("bug-gutter", plant(exploded, '"name": "Outside services"', '"name": "WWWWWWWWWWWWWWWWWW"')), expect: /Label 7 leaves its gutter/ },
  // warnings: these pass, and say what to look at
  { file: write3("warn-long-name", plant(exploded, '"name": "Outside services"', '"name": "Wwwwwwwwww Wwwwwww"')), expect: null, warns: /Label 7 runs \d+px past its gutter/ },
  { file: write3("warn-not-drawn", withParts(exploded, (parts) => parts.slice(0, 6), { rewire: true })), expect: null, warns: /Not drawn: Email \(service\)/ },
  { file: write3("warn-one-tier", withParts(exploded, (parts) => [parts[1], parts[2], { ...parts[5], role: "feature", from: ["area:lib/ai"] }], { rewire: true })), expect: null, warns: [/has no links/, /slider has nothing to open/] },
  { file: write3("warn-leader-crosses", plant(exploded, "if (!hit.length) return direct;", "return direct;")), expect: null, warns: /Leader line \d runs across part/ },
  // interaction
  { file: write3("bug-no-slider", plant(exploded, 'type="range"', 'type="number"')), expect: /No "Open layers" slider/ },
  { file: write3("bug-dead-slider", plant(exploded, "const gap = 8 + ((gOpen - 8) * o) / 100;", "const gap = 8;")), expect: /Slider does not open the layers/ },
  { file: write3("bug-dead-arrows", plant(exploded, "ArrowDown: sel + 1", "ArrowDown: sel")), expect: /ArrowDown in the part list does not move the selection/ },
  { file: write3("bug-no-hover", plant(exploded, 'onPointerEnter={() => setPicked(i)}\n                      onClick={() => setPicked(i)}\n                      className="xv-ease"', 'onClick={() => setPicked(i)}\n                      className="xv-ease"')), expect: /Pointing at a part does not highlight it/ },
  { file: write3("bug-no-ink", plant(exploded, "const c = w.hot ? T.ink : T.soft;", "const c = T.soft;")), expect: /Selecting a part does not ink its links/ },
];

let failed = 0;
// check() takes one state and one facts override per call, so cases that set them run in their own call.
const groups = new Map();
for (const c of cases) {
  const key = JSON.stringify([c.state ?? null, c.facts ?? null]);
  if (!groups.has(key)) groups.set(key, { state: c.state, facts: c.facts, cases: [] });
  groups.get(key).cases.push(c);
}
const matches = (expect, errors) => (Array.isArray(expect) ? expect : [expect]).every((re) => errors.some((e) => re.test(e)));
for (const g of groups.values()) {
  const results = await check(g.cases.map((c) => c.file), { quiet: true, state: g.state, facts: g.facts });
  for (const [i, r] of results.entries()) {
    const { expect, clean, warns } = g.cases[i];
    const name = path.basename(r.file);
    const ok = expect ? matches(expect, r.errors) : r.errors.length === 0 && (!clean || r.warnings.length === 0) && (!warns || matches(warns, r.warnings));
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${name}${expect ? `  expects ${[].concat(expect).join(" + ")}` : `  expects PASS${warns ? ` and ! ${[].concat(warns).join(" + ")}` : ""}`}`);
    if (!ok) for (const e of [...r.errors.map((m) => `✗ ${m}`), ...r.warnings.map((m) => `! ${m}`)].concat(r.errors.length || r.warnings.length ? [] : ["(no errors reported)"])) console.log(`       ${e}`);
  }
}

// --state values: JSON when it parses, else text.
try {
  assert.deepEqual(parseState(["openExploded=0", "themeExploded=dark", 'themeExploded2="dark"', "partExploded=3", "showGridExploded=true", "note=a=b"]), {
    openExploded: 0, themeExploded: "dark", themeExploded2: "dark", partExploded: 3, showGridExploded: true, note: "a=b",
  });
  assert.throws(() => parseState(["nokey"]), /key=value/);
  console.log("ok   --state values parse");
} catch (e) {
  failed++;
  console.log(`FAIL --state values parse\n       ${e.message}`);
}

// export: --html needs no browser, and each file it writes opens offline and renders the poster.
const exportCli = (args, env = {}) => spawnSync(process.execPath, [path.join(TOOLS, "poster.mjs"), "export", ...args], { encoding: "utf8", env: { ...process.env, ...env } });
const listing = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);
const starters = cases.slice(0, 3).map((c) => c.file);
const [appStem, storyStem, explodedStem] = starters.map((f) => path.basename(f, ".canvas.tsx"));
try {
  // HTML only: a Chromium that cannot start proves no browser is launched.
  const htmlDir = path.join(OUT, "export-html");
  const r = exportCli([...starters, "--html", "--no-png", "--no-pdf", "--out", htmlDir], { POSTER_CHROMIUM: path.join(OUT, "no-such-chromium") });
  assert.equal(r.status, 0, r.stderr);
  const expected = [`${appStem}.html`, `${explodedStem}.html`, `${storyStem}.html`, "starter-poster-set.html"].sort();
  assert.deepEqual(listing(htmlDir), expected);

  const browser = await chromium.launch({ executablePath: process.env.POSTER_CHROMIUM || undefined });
  try {
    for (const name of expected) {
      const external = [];
      const page = await browser.newPage({ viewport: { width: 1028, height: 900 } });
      await page.route("**/*", (route) => {
        if (/^(file|data|about):/.test(route.request().url())) return route.continue();
        external.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(htmlDir, name)).href);
      await page.waitForFunction(() => {
        const posters = [...document.querySelectorAll("section[id^=poster-]")];
        return posters.length > 0 && posters.every((e) => e.childElementCount);
      });
      await page.evaluate(() => document.fonts.ready);
      const got = await page.evaluate(() => ({
        posters: document.querySelectorAll("section[id^=poster-]").length,
        errors: [...document.querySelectorAll("[data-poster-error]")].map((e) => e.textContent),
        viewport: document.querySelector('meta[name="viewport"]')?.content,
      }));
      assert.deepEqual(external, [], `${name} requests ${external.join(", ")}`);
      assert.deepEqual(got.errors, [], `${name} renders an error`);
      assert.equal(got.posters, name.endsWith("-set.html") ? 3 : 1, `${name} poster count`);
      assert.equal(got.viewport, "width=device-width,initial-scale=1", `${name} viewport meta`);
      assert.ok(await page.getByRole("button", { name: /show grid/i }).first().isVisible(), `${name} keeps its grid toggle`);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  // The same poster state reaches the HTML as it does the PNG.
  const dark = exportCli([starters[2], "--html", "--no-png", "--no-pdf", "--out", path.join(OUT, "export-dark"), "--state", "themeExploded=dark"], { POSTER_CHROMIUM: path.join(OUT, "no-such-chromium") });
  assert.equal(dark.status, 0, dark.stderr);
  assert.match(fs.readFileSync(path.join(OUT, "export-dark", `${explodedStem}.html`), "utf8"), /window\.__POSTER_STATE__=\{"themeExploded":"dark"\}/);

  // Without --html nothing changes (PNG + PDF only); with it, HTML joins whatever else was asked for.
  const plain = exportCli([starters[0], "--out", path.join(OUT, "export-plain")]);
  assert.equal(plain.status, 0, plain.stderr);
  assert.deepEqual(listing(path.join(OUT, "export-plain")), [`${appStem}.pdf`, `${appStem}.png`]);
  const mixed = exportCli([starters[0], starters[1], "--no-pdf", "--html", "--out", path.join(OUT, "export-mixed")]);
  assert.equal(mixed.status, 0, mixed.stderr);
  assert.deepEqual(listing(path.join(OUT, "export-mixed")), [`${appStem}.html`, `${appStem}.png`, `${storyStem}.html`, `${storyStem}.png`, "starter-poster-set.html"].sort());
  console.log("ok   export --html (offline, no browser needed, renders, state seeded)");
} catch (e) {
  failed++;
  console.log(`FAIL export --html\n       ${String(e.message).split("\n").join("\n       ")}`);
}

// The scanner, the wire tool, the link walker, the change briefing and the installer have their own unit tests.
const unit = spawnSync(process.execPath, ["--test", ...["scan", "wire", "reach", "changes", "install"].map((t) => path.join(TOOLS, "test", `${t}.test.mjs`))], { cwd: TOOLS, encoding: "utf8" });
if (unit.status === 0) console.log(`ok   scan + wire + reach + changes + install unit tests (${/^# pass (\d+)/m.exec(unit.stdout)?.[1] ?? "?"} pass)`);
else {
  failed++;
  console.log(`FAIL scan + wire + reach + changes + install unit tests\n${unit.stdout.split("\n").filter((l) => /^\s*not ok|^# (fail|tests)/.test(l)).map((l) => `       ${l.trim()}`).join("\n") || unit.stderr}`);
}

// Type-check the three starters against the cursor/canvas shim.
fs.writeFileSync(path.join(OUT, "tsconfig.json"), JSON.stringify({
  compilerOptions: {
    jsx: "react-jsx", strict: true, noEmit: true, target: "es2020", module: "esnext", moduleResolution: "bundler", skipLibCheck: true,
    typeRoots: [path.join(TOOLS, "node_modules", "@types")],
    paths: { "cursor/canvas": [path.join(TOOLS, "shim", "canvas.tsx")], "react": [path.join(TOOLS, "node_modules", "@types", "react")], "react/jsx-runtime": [path.join(TOOLS, "node_modules", "@types", "react", "jsx-runtime")] },
  },
  files: [cases[0].file, cases[1].file, cases[2].file],
}));
try {
  execFileSync(process.execPath, [path.join(TOOLS, "node_modules", "typescript", "bin", "tsc"), "-p", OUT], { stdio: "pipe" });
  console.log("ok   starters type-check");
} catch (e) {
  failed++;
  console.log(`FAIL starters type-check\n${e.stdout}`);
}

console.log(failed ? `\n${failed} failure(s)` : "\nAll checks behave as expected");
process.exit(failed ? 1 : 0);

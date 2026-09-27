// Self-test: the starters must pass `check`, and each planted bug must fail
// with the expected message. Also type-checks the starters.
//
//   npm test
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "../poster.mjs";

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.resolve(TOOLS, "..");
const OUT = path.join(TOOLS, "test", ".out");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const code = (md) => fs.readFileSync(path.join(SKILL, md), "utf8").match(/```tsx\n([\s\S]*?)```/)[1];
const app = code("poster-starter.md");
// Page 2 reuses page 1's constants and helpers ("copy from poster-starter.md").
const story = app.split("export default function AppPoster")[0] + code("sell-sheet-starter.md").replace(/^import .*\n/, "");

const write = (name, src) => {
  const f = path.join(OUT, `${name}.canvas.tsx`);
  fs.writeFileSync(f, src);
  return f;
};
const plant = (src, from, to) => {
  if (!src.includes(from)) throw new Error(`Fixture anchor not found in starter: ${from}`);
  return src.replace(from, to);
};

const cases = [
  { file: write("starter-app-poster", app), expect: null },
  { file: write("starter-project-story", story), expect: null },
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
];

let failed = 0;
const results = await check(cases.map((c) => c.file), { quiet: true });
for (const [i, r] of results.entries()) {
  const { expect } = cases[i];
  const name = path.basename(r.file);
  const ok = expect ? r.errors.some((e) => expect.test(e)) : r.errors.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${expect ? `  expects ${expect}` : "  expects PASS"}`);
  if (!ok) for (const e of r.errors.length ? r.errors : ["(no errors reported)"]) console.log(`       ${e}`);
}

// Type-check both starters against the cursor/canvas shim.
fs.writeFileSync(path.join(OUT, "tsconfig.json"), JSON.stringify({
  compilerOptions: {
    jsx: "react-jsx", strict: true, noEmit: true, target: "es2020", module: "esnext", moduleResolution: "bundler", skipLibCheck: true,
    typeRoots: [path.join(TOOLS, "node_modules", "@types")],
    paths: { "cursor/canvas": [path.join(TOOLS, "shim", "canvas.tsx")], "react": [path.join(TOOLS, "node_modules", "@types", "react")], "react/jsx-runtime": [path.join(TOOLS, "node_modules", "@types", "react", "jsx-runtime")] },
  },
  files: [cases[0].file, cases[1].file],
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

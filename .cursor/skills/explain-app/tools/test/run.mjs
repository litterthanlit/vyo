// Self-test: the starters and the Hypher showcase must pass `check`, each
// planted bug must fail with the expected message, the kit and pages must
// type-check, and the SVG export must match the PNG export.
//
//   npm test
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { check, exportPosters, launch } from "../poster.mjs";

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.resolve(TOOLS, "..");
const OUT = path.join(TOOLS, "test", ".out");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// A canvas file is the kit pasted first, then the page component.
const code = (md) => fs.readFileSync(path.join(SKILL, md), "utf8").match(/```tsx\n([\s\S]*?)```/)[1];
const kit = code("poster-kit.md");
const fixture = (name) => fs.readFileSync(path.join(TOOLS, "test", "fixtures", name), "utf8");
const pages = {
  app: code("poster-starter.md"),
  story: code("sell-sheet-starter.md"),
  hypherApp: fixture("hypher-app-poster.page.tsx"),
  hypherStory: fixture("hypher-project-story.page.tsx"),
};

const write = (name, src) => {
  const f = path.join(OUT, `${name}.canvas.tsx`);
  fs.writeFileSync(f, src);
  return f;
};
const plant = (src, from, to) => {
  if (!src.includes(from)) throw new Error(`Fixture anchor not found: ${from}`);
  return src.replace(from, to);
};
// Plant a bug in the kit or the page-1 starter.
const bugKit = (from, to) => plant(kit, from, to) + pages.app;
const bugPage = (from, to) => kit + plant(pages.app, from, to);
const HERO_CORE = "<circle cx={ax} cy={ay} r={STROKE} fill={RED} />";

const cases = [
  { file: write("starter-app-poster", kit + pages.app), expect: null },
  { file: write("starter-project-story", kit + pages.story), expect: null },
  { file: write("hypher-app-poster", kit + pages.hypherApp), expect: null, showcase: true },
  { file: write("hypher-project-story", kit + pages.hypherStory), expect: null, showcase: true },

  // Layout and type
  { file: write("bug-five-stations-app-poster", bugPage('{ label: "Back out", sub: "what you receive", role: "output" },', '{ label: "Back out", sub: "what you receive", role: "output" },\n    { label: "Fifth", sub: "x" },')), expect: /Transit stations: 5 won't land/ },
  { file: write("bug-five-screens-app-poster", bugPage('{ name: "Landing", preset: "landing" },', '{ name: "Landing", preset: "landing" },\n    { name: "Extra", preset: "list" },')), expect: /Screens: 5 won't land/ },
  { file: write("bug-off-baseline-app-poster", bugPage("marginTop: BL - 2", "marginTop: BL")), expect: /Off the 8px baseline/ },
  { file: write("bug-fifth-size-app-poster", bugPage("<p style={body}>One-sentence purpose", "<p style={{ ...body, fontSize: 13 }}>One-sentence purpose")), expect: /5 font sizes/ },
  { file: write("bug-small-masthead-app-poster", bugPage('fontSize: 112, lineHeight: "112px"', 'fontSize: 96, lineHeight: "96px"')), expect: /Masthead is 96px/ },
  { file: write("bug-negative-margin-app-poster", bugPage('<div style={{ gridColumn: "1 / 6" }}>', '<div style={{ gridColumn: "1 / 6", marginLeft: -16 }}>')), expect: /Off the column lines/ },
  { file: write("bug-overlay-drift-app-poster", bugKit("inset: MARGIN, ...subgrid", "inset: 0, ...subgrid")), expect: /overlay columns do not match/ },

  // Colour
  { file: write("bug-red-rule-app-poster", bugKit("borderTop: `1px solid ${INK}`", "borderTop: `1px solid ${ACCENT}`")), expect: /Border colour/ },
  { file: write("bug-blue-text-app-poster", bugPage('<div style={{ gridColumn: "1 / 5", ...folio }}>App Guide', '<div style={{ gridColumn: "1 / 5", ...folio, color: BLUE }}>App Guide')), expect: /Text colour/ },
  { file: write("bug-two-reds-app-poster", bugKit(HERO_CORE, `${HERO_CORE}<circle cx={8} cy={8} r={4} fill={RED} />`)), expect: /2 red shapes/ },
  { file: write("bug-thin-yellow-app-poster", bugKit('stroke={s.role ? INK : "none"}', 'stroke={s.role === "output" ? YELLOW : s.role ? INK : "none"}')), expect: /yellow stroke/ },

  // SVG
  { file: write("bug-line-gap-app-poster", bugKit("x2={cx(i + 1)}", "x2={cx(i + 1) - 18}")), expect: /does not join two stations/ },
  { file: write("bug-scaled-svg-app-poster", bugKit("<svg viewBox={`0 0 ${W} ${H}`} style={svgBox} role=\"img\" aria-label={`${seed} emblem", "<svg viewBox={`0 0 ${W / 2} ${H / 2}`} style={svgBox} role=\"img\" aria-label={`${seed} emblem")), expect: /draw SVG 1:1/ },
  { file: write("bug-svg-text-app-poster", bugKit(HERO_CORE, `${HERO_CORE}<text x={8} y={16}>{seed}</text>`)), expect: /labels are HTML/ },
  { file: write("bug-svg-gradient-app-poster", bugKit(HERO_CORE, `${HERO_CORE}<defs><linearGradient id="g" /></defs>`)), expect: /no gradients/ },
  { file: write("bug-no-label-app-poster", bugKit("role=\"img\" aria-label={`Wireframe of the ${name} screen`}", "")), expect: /aria-label/ },

  // Source rules and copy
  { file: write("bug-import-app-poster", `import { format } from "date-fns";\n${kit}${pages.app}`), expect: /Imports "date-fns"/ },
  { file: write("bug-file-path-app-poster", bugPage("One-sentence purpose, set in ink.", "Pages live in src/app/page.tsx.")), expect: /File paths on the poster/ },
];

// Render SVG markup at the PNG's size (the PNG export is 2× device pixels).
async function renderSvg(browser, svg, png) {
  const page = await browser.newPage({ viewport: { width: png.width / 2, height: png.height / 2 }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const shot = PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 0, width: png.width / 2, height: png.height / 2 } }));
  await page.close();
  return shot;
}
function diffPct(a, b, save) {
  const diff = new PNG({ width: a.width, height: a.height });
  const bad = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.2 });
  if (save) fs.writeFileSync(save, PNG.sync.write(diff));
  return (100 * bad) / (a.width * a.height);
}

let failed = 0;
const fail = (msg, detail = []) => {
  failed++;
  console.log(`FAIL ${msg}`);
  for (const d of detail) console.log(`       ${d}`);
};

const results = await check(cases.map((c) => c.file), { quiet: true });
for (const [i, r] of results.entries()) {
  const { expect } = cases[i];
  const name = path.basename(r.file);
  const ok = expect ? r.errors.some((e) => expect.test(e)) : r.errors.length === 0 && (!cases[i].showcase || r.warnings.length === 0);
  const label = `${name}${expect ? `  expects ${expect}` : "  expects PASS"}`;
  if (ok) console.log(`ok   ${label}`);
  else fail(label, [...r.errors, ...(expect ? [] : r.warnings.map((w) => `(warning) ${w}`))].concat(r.errors.length || expect ? [] : ["(no errors)"]));
}

// Type-check every clean poster against the cursor/canvas shim.
fs.writeFileSync(path.join(OUT, "tsconfig.json"), JSON.stringify({
  compilerOptions: {
    jsx: "react-jsx", strict: true, noEmit: true, target: "es2020", module: "esnext", moduleResolution: "bundler", skipLibCheck: true,
    typeRoots: [path.join(TOOLS, "node_modules", "@types")],
    paths: { "cursor/canvas": [path.join(TOOLS, "shim", "canvas.tsx")], "react": [path.join(TOOLS, "node_modules", "@types", "react")], "react/jsx-runtime": [path.join(TOOLS, "node_modules", "@types", "react", "jsx-runtime")] },
  },
  files: cases.filter((c) => !c.expect).map((c) => c.file),
}));
try {
  execFileSync(process.execPath, [path.join(TOOLS, "node_modules", "typescript", "bin", "tsc"), "-p", OUT], { stdio: "pipe" });
  console.log("ok   kit + pages type-check");
} catch (e) {
  fail("kit + pages type-check", [String(e.stdout)]);
}

// SVG export fidelity: render the exported SVG and compare it to the PNG export.
const showcase = cases.filter((c) => c.showcase).map((c) => c.file);
const exportDir = path.join(OUT, "exports");
const written = await exportPosters(showcase, { out: exportDir });
const browser = await launch();
try {
  for (const file of showcase) {
    const stem = path.basename(file).replace(/\.canvas\.tsx$/, "");
    const svgPath = path.join(exportDir, `${stem}.svg`);
    const pngPath = path.join(exportDir, `${stem}.png`);
    if (!written.includes(svgPath)) {
      fail(`${stem}.svg was not written`);
      continue;
    }
    const svg = fs.readFileSync(svgPath, "utf8");
    const png = PNG.sync.read(fs.readFileSync(pngPath));
    const problems = [];
    if (!/<text[\s>]/.test(svg)) problems.push("no live <text> — type would not be editable");
    if (/<foreignObject/i.test(svg)) problems.push("contains <foreignObject> — Figma and Illustrator drop it");
    const shot = await renderSvg(browser, svg, png);
    const pct = diffPct(png, shot, path.join(exportDir, `${stem}.svg-diff.png`));
    if (pct > 1) problems.push(`${pct.toFixed(2)}% of pixels differ from the PNG (limit 1%) — see ${stem}.svg-diff.png`);
    if (problems.length) fail(`${stem}.svg fidelity`, problems);
    else console.log(`ok   ${stem}.svg matches the PNG (${pct.toFixed(2)}% of pixels differ), live text, no foreignObject`);

    // The metric must still catch real breakage: drop every circle and it has to fail.
    if (stem === "hypher-app-poster") {
      const broken = await renderSvg(browser, svg.replace(/<circle[^>]*\/>/g, ""), png);
      const miss = diffPct(png, broken);
      if (miss > 1) console.log(`ok   fidelity metric catches missing artwork (${miss.toFixed(2)}% differs with circles removed)`);
      else fail("fidelity metric is too loose", [`Removing every circle only changed ${miss.toFixed(2)}%`]);
    }
  }
} finally {
  await browser.close();
}

console.log(failed ? `\n${failed} failure(s)` : "\nAll checks behave as expected");
process.exit(failed ? 1 : 0);

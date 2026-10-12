#!/usr/bin/env node
// explain-app poster tools.
//
//   node poster.mjs check  <file.canvas.tsx>... [options]  Enforce the Swiss poster rules
//   node poster.mjs export <file.canvas.tsx>... [options]  Write PNG + PDF (and HTML) for sharing
//
// Options:
//   --state key=value    Seed a useCanvasState key before the poster renders (repeatable; the value is
//                        read as JSON when it parses, else as text): --state openExploded=0 --state themeExploded=dark
//   --facts <file>       check, page 3: the facts.json to wire against (default: <dir>/<repo>-facts.json)
// Export options:
//   --out <dir>          Output directory (default: <first file's dir>/exports)
//   --paper fit|a4|letter  PDF page size (default: fit — one page sized to the poster)
//   --no-png / --no-pdf  Skip a format
//   --html               Also write <stem>.html per poster (+ <set>.html for several): one self-contained file that
//                        opens offline in any browser, interactive controls kept. With --no-png --no-pdf no browser
//                        is launched, so HTML export needs only `npm install` (esbuild, react), not Chromium.
//
// Page rules are inferred from the filename (*project-story* = page 2, *exploded-view* = page 3).
// Set POSTER_CHROMIUM to a Chromium binary to skip `npx playwright install chromium`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPage, lintSource } from "./lib/build.mjs";
import { factsHash, partsHash } from "./lib/hash.mjs";
import { inspectOverlay, inspectPoster } from "./lib/inspect.js";
import { CAPS, readBlocks, serializeWiring, wire } from "./lib/wire.mjs";

const PALETTE = { PAPER: "#FFFFFF", INK: "#0A0A0A", INK_SOFT: "#5B6066", ACCENT: "#E4002B", HAIRLINE: "rgba(10, 10, 10, 0.2)", TINT: "#FCE1E6" };
const POSTER_WIDTH = 1028; // MAXW 900 + 2 × MARGIN 64
const CHECK_WIDTHS = [1440, POSTER_WIDTH];
const NARROW_WIDTH = 720; // a canvas panel beside the chat
const MAX_HEIGHT = 1300;
const PAPER_PX = { a4: [794, 1123], letter: [816, 1056] };

const pageOf = (file) => (/project-story/i.test(path.basename(file)) ? 2 : /exploded-view/i.test(path.basename(file)) ? 3 : 1);
const stem = (file) => path.basename(file).replace(/\.canvas\.tsx$|\.tsx$/, "");

// Playwright loads only when a browser is needed (check, PNG, PDF); HTML export and the unit tests never import it.
async function launch() {
  const toolsDir = path.dirname(fileURLToPath(import.meta.url));
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (e) {
    if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
    throw new Error(`Playwright is not installed. Run \`npm install\` in ${toolsDir}.\n${String(e.message).split("\n")[0]}`);
  }
  try {
    return await chromium.launch({ executablePath: process.env.POSTER_CHROMIUM || undefined });
  } catch (e) {
    throw new Error(`Could not start Chromium. Run \`npx playwright install chromium\` in ${toolsDir}, or set POSTER_CHROMIUM to a Chromium binary.\n${e.message.split("\n")[0]}`);
  }
}

// `--state key=value` pairs → { key: value }. A value is read as JSON when it parses (0, true, "dark"), else kept as text (dark).
export function parseState(pairs) {
  const state = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq < 1) throw new Error(`--state needs key=value, got "${pair}"`);
    const raw = pair.slice(eq + 1);
    let value = raw;
    try {
      value = JSON.parse(raw);
    } catch {}
    state[pair.slice(0, eq)] = value;
  }
  return state;
}

// shim/canvas.tsx reads window.__POSTER_STATE__ in useCanvasState; the seed must exist before the bundle runs.
const seedState = (html, state) => {
  if (!state || !Object.keys(state).length) return html;
  const script = `<script>window.__POSTER_STATE__=${JSON.stringify(state).replace(/</g, "\\u003c")};</script>`;
  return html.includes("<head>") ? html.replace("<head>", `<head>${script}`) : script + html;
};

async function open(browser, files, width, scale = 1, state) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: scale });
  await page.setContent(seedState(await buildPage(files), state));
  await page.waitForFunction((n) => [...Array(n).keys()].every((i) => document.getElementById(`poster-${i}`)?.childElementCount), files.length);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

// Page 3 draws the repo's real parts, so before anything renders: the facts file must be intact, PARTS must wire,
// and the WIRING block must be exactly what a fresh wire produces. Returns the errors and warnings, plus `expect`
// (what the drawing must show) when the wire succeeded.
function checkWiring(file, source, factsOverride) {
  const errors = [];
  const warnings = [];
  const shown = (f) => {
    const rel = path.relative(process.cwd(), f);
    return rel && !rel.startsWith("..") ? rel : f;
  };
  const base = path.basename(file);
  const repo = base.replace(/-exploded-view(\.canvas)?\.tsx$/, "").replace(/\.canvas\.tsx$|\.tsx$/, "");
  const factsFile = factsOverride ? path.resolve(factsOverride) : path.join(path.dirname(path.resolve(file)), `${repo}-facts.json`);
  const factsName = path.basename(factsFile);
  const wireHint = `node tools/scan.mjs wire ${shown(factsFile)} --into ${shown(path.resolve(file))}`;

  let facts = null;
  if (!fs.existsSync(factsFile)) {
    errors.push(
      factsOverride
        ? `No ${factsName} at ${shown(factsFile)} — run: node tools/scan.mjs scan <repo> --out ${shown(factsFile)}`
        : `No ${factsName} beside the canvas — run: node tools/scan.mjs scan <repo> --out ${shown(factsFile)}`,
    );
  } else {
    try {
      facts = JSON.parse(fs.readFileSync(factsFile, "utf8"));
    } catch (e) {
      errors.push(`${factsName} is not valid JSON (${e.message}) — re-run scan`);
    }
    if (facts && (typeof facts !== "object" || facts.version !== 1 || !Array.isArray(facts.facts))) {
      errors.push(`${factsName} is not a facts.json (version 1) — re-run scan`);
      facts = null;
    } else if (facts && factsHash(facts) !== facts.hash) {
      errors.push("facts.json hash does not recompute — re-run scan");
      facts = null;
    }
  }

  let blocks = { parts: null, wiring: null };
  try {
    blocks = readBlocks(source);
  } catch (e) {
    errors.push(e.message);
  }
  if (!blocks.parts) errors.push("No // PARTS:BEGIN … // PARTS:END block — page 3 draws the parts written there (see exploded-view-starter.md)");
  if (!blocks.wiring) errors.push(`No // WIRING:BEGIN … // WIRING:END block — run: ${wireHint}`);
  if (!facts || !blocks.parts) return { errors, warnings, expect: null };

  let fresh;
  try {
    fresh = wire(facts, blocks.parts);
  } catch (e) {
    errors.push(`wire: ${e.message}`);
    return { errors, warnings, expect: null };
  }
  for (const e of fresh.errors) errors.push(`wire: ${e}`);
  if (fresh.errors.length) return { errors, warnings, expect: null };
  warnings.push(...fresh.warnings);

  if (blocks.wiring) {
    let same = false;
    try {
      same = serializeWiring(fresh.wiring) === serializeWiring(blocks.wiring);
    } catch {}
    if (!same) errors.push(`WIRING does not match a fresh wire — re-run: ${wireHint}`);
  }
  return {
    errors,
    warnings,
    expect: {
      facts: facts.hash,
      parts: partsHash(blocks.parts),
      roles: blocks.parts.map((p) => p.role),
      n: fresh.wiring.n.map(({ count, drawn }) => ({ count, drawn })),
      links: fresh.wiring.links,
    },
  };
}

export async function check(files, { browser, quiet = false, state, facts } = {}) {
  const own = !browser;
  browser ??= await launch();
  const results = [];
  try {
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const errors = lintSource(source);
      const warnings = [];
      const page = pageOf(file);
      let expect = null;
      if (page === 3) {
        const wired = checkWiring(file, source, facts);
        errors.push(...wired.errors);
        warnings.push(...wired.warnings);
        expect = wired.expect;
      }
      try {
        for (const width of CHECK_WIDTHS) {
          const p = await open(browser, [file], width, 1, state);
          const r = await p.evaluate(inspectPoster, { index: 0, page, palette: PALETTE, caps: CAPS, expect });
          errors.push(...r.errors);
          warnings.push(...r.warnings);
          if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
            errors.push(`Scrolls sideways at ${width}px`);
          }
          if (width === POSTER_WIDTH && !r.errors.some((e) => e.startsWith("Render error"))) {
            if (r.height > MAX_HEIGHT) warnings.push(`Poster is ${r.height}px tall — aim for one screen (≤ ${MAX_HEIGHT}px); trim copy`);
            const toggle = p.getByRole("button", { name: /show grid/i });
            if (!(await toggle.count())) errors.push('No "Show grid" toggle');
            else {
              await toggle.first().click();
              errors.push(...(await p.evaluate(inspectOverlay, { index: 0 })));
            }
            if (page === 3) {
              const i = await interact(p);
              errors.push(...i.errors);
              warnings.push(...i.warnings);
            }
          }
          await p.close();
          if (errors.some((e) => e.startsWith("Render error"))) break;
        }
        const narrow = await open(browser, [file], NARROW_WIDTH, 1, state);
        if (await narrow.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
          warnings.push(`Scrolls sideways in a ${NARROW_WIDTH}px panel — shorten the masthead or stack it`);
        }
        await narrow.close();
      } catch (e) {
        errors.push(e.message);
      }
      const result = { file, page, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
      results.push(result);
      if (!quiet) report(result);
    }
  } finally {
    if (own) await browser.close();
  }
  return results;
}

// How many tiers a set of roles stacks into (CONTRACTS.md §4): top = screens/api, features, ai/jobs, data/service;
// empty tiers drop out, and ai/jobs merge into the feature tier when that stays at four or fewer.
const TIER = { screens: 0, api: 0, feature: 1, ai: 2, jobs: 2, data: 3, service: 3 };
function tierCount(roles) {
  const t = [0, 0, 0, 0];
  for (const r of roles) t[TIER[r] ?? 3]++;
  if (t[1] + t[2] <= 4) (t[1] += t[2]), (t[2] = 0);
  return t.filter(Boolean).length;
}

// Page 3 is interactive: the slider must open the tiers, the part list must answer the arrow keys, selecting
// a part must ink its cables, pointing at a part must tint it, and the theme button must flip the paper.
// Runs on a page that has already passed inspectPoster.
async function interact(p) {
  const errors = [];
  const warnings = [];
  const slider = p.getByRole("slider", { name: /open layers/i });
  if (!(await slider.count())) return { errors: ['No "Open layers" slider — page 3 needs a range input labelled "Open layers"'], warnings };

  const read = () => p.evaluate(() => {
    const parts = [...document.querySelectorAll("#poster-0 g[data-part]")];
    const tops = parts.map((g) => g.getBoundingClientRect().top);
    return {
      roles: parts.map((g) => g.dataset.role),
      spread: Math.max(...tops) - Math.min(...tops),
      height: document.querySelector("#poster-0 figure").getBoundingClientRect().height,
    };
  });
  await slider.focus();
  await p.keyboard.press("Home");
  const closed = await read();
  await p.keyboard.press("End");
  const opened = await read();
  if (tierCount(closed.roles) < 2) {
    warnings.push("All parts sit in one tier, so the slider has nothing to open — add parts of another kind (screens, features, data…)");
  } else if (!(opened.spread > closed.spread + 40)) {
    errors.push(`Slider does not open the layers (spread ${closed.spread.toFixed(0)}px closed → ${opened.spread.toFixed(0)}px open)`);
  }
  if (Math.abs(opened.height - closed.height) > 1) {
    errors.push(`The drawing changes height with the slider (${closed.height.toFixed(0)}px closed → ${opened.height.toFixed(0)}px open) — fit it once at full open so the page never jumps`);
  }

  const list = p.getByRole("listbox");
  const active = () => list.first().getAttribute("aria-activedescendant");
  if (!(await list.count())) errors.push("No part listbox — labels must be role=listbox options so the arrow keys can pick a part");
  else {
    await list.first().focus();
    await p.keyboard.press("Home");
    const before = await active();
    await p.keyboard.press("ArrowDown");
    const after = await active();
    if (!before || before === after) errors.push("ArrowDown in the part list does not move the selection");

    // Selecting a part inks its cables and leaves the others soft.
    const cables = await p.evaluate(() => [...document.querySelectorAll("#poster-0 path[data-link]")].map((e) => [Number(e.dataset.fromPart), Number(e.dataset.toPart)]));
    const touches = (i) => cables.filter(([a, b]) => a === i || b === i).length;
    const n = await p.evaluate(() => document.querySelectorAll("#poster-0 g[data-part]").length);
    const pick = [...Array(n).keys()].find((i) => touches(i) > 0 && touches(i) < cables.length) ?? [...Array(n).keys()].find((i) => touches(i) > 0);
    if (pick !== undefined) {
      await p.keyboard.press("Home");
      for (let k = 0; k < pick; k++) await p.keyboard.press("ArrowDown");
      const strokes = () => p.evaluate((i) => {
        const all = [...document.querySelectorAll("#poster-0 path[data-link]")].map((e) => ({
          mine: Number(e.dataset.fromPart) === i || Number(e.dataset.toPart) === i,
          ink: getComputedStyle(e).stroke === "rgb(10, 10, 10)",
        }));
        return { mine: all.filter((c) => c.mine), others: all.filter((c) => !c.mine) };
      }, pick);
      const inked = (c) => c.mine.length > 0 && c.mine.every((x) => x.ink) && (c.others.length === 0 || c.others.some((x) => !x.ink));
      let c = await strokes();
      for (let tries = 0; tries < 15 && !inked(c); tries++) {
        await p.waitForTimeout(100);
        c = await strokes();
      }
      if (!inked(c)) {
        errors.push(`Selecting a part does not ink its links (part ${pick + 1}: ${c.mine.filter((x) => x.ink).length} of ${c.mine.length} of its cables are ink, ${c.others.filter((x) => x.ink).length} of ${c.others.length} others are too)`);
      }
    }
  }

  // Point at a part that is not the selected one: its top face must take the tint. Aim at a spot where that
  // part is the topmost thing under the pointer, found with elementsFromPoint rather than assumed.
  const tint = "rgb(252, 225, 230)";
  const selected = Number((await p.evaluate(() => document.querySelector('#poster-0 [role="listbox"]')?.getAttribute("aria-activedescendant")))?.replace(/\D+/g, "")) || 0;
  const target = selected === 1 ? 0 : 1;
  const aim = await p.evaluate((idx) => {
    const g = document.querySelector(`#poster-0 g[data-part="${idx}"]`);
    const face = g?.querySelector('[data-face="top"]');
    if (!face) return null;
    const inv = face.getScreenCTM().inverse();
    const b = face.getBoundingClientRect();
    let best = null;
    for (let fy = 0.1; fy < 0.95; fy += 0.1) {
      for (let fx = 0.1; fx < 0.95; fx += 0.1) {
        const x = b.left + fx * b.width;
        const y = b.top + fy * b.height;
        if (!face.isPointInFill(new DOMPoint(x, y).matrixTransform(inv))) continue;
        const hit = document.elementsFromPoint(x, y).find((e) => e.closest("g[data-part], [data-label]"));
        if (hit?.closest("g[data-part]") !== g) continue;
        const d = Math.hypot(fx - 0.5, fy - 0.5);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    return best;
  }, target);
  if (!aim) errors.push(`Part ${target + 1}'s top face is never visible — nothing can point at it`);
  else {
    await p.mouse.move(aim.x, aim.y);
    const lit = await p.waitForFunction(({ idx, tint }) => {
      const face = document.querySelector(`#poster-0 g[data-part="${idx}"] [data-face="top"]`);
      return face && getComputedStyle(face).fill === tint;
    }, { idx: target, tint }, { timeout: 1500 }).then(() => true, () => false);
    if (!lit) errors.push("Pointing at a part does not highlight it with the tint");
  }

  const theme = p.getByRole("button", { name: /theme/i });
  if (!(await theme.count())) errors.push("No theme button");
  else {
    const bg = () => p.evaluate(() => getComputedStyle(document.querySelector("#poster-0 > div")).backgroundColor);
    await theme.first().click();
    const darkBg = await bg();
    await theme.first().click();
    const lightBg = await bg();
    if (darkBg !== "rgb(10, 10, 10)" || lightBg !== "rgb(255, 255, 255)") errors.push(`Theme button does not flip paper to ink and back (${darkBg} → ${lightBg})`);
  }
  return { errors, warnings };
}

function report({ file, page, errors, warnings }) {
  const status = errors.length ? "FAIL" : "PASS";
  console.log(`\n${status}  ${path.basename(file)}  (page ${page})`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  for (const w of warnings) console.log(`  ! ${w}`);
}

async function exportPosters(files, { out, paper = "fit", png = true, pdf = true, html = false, state }) {
  if (paper !== "fit" && !PAPER_PX[paper]) throw new Error(`Unknown --paper "${paper}" — use fit, a4, or letter`);
  out ??= path.join(path.dirname(path.resolve(files[0])), "exports");
  fs.mkdirSync(out, { recursive: true });
  const written = [];
  // The page as the checker renders it (chrome kept, so the grid toggle and page 3's controls still work), plus a
  // viewport meta so a phone does not draw it zoomed out. Only esbuild bundles it; no browser is involved.
  const writeHtml = async () => {
    const page = async (list) => seedState(await buildPage(list), state).replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">');
    const pages = [...files.map((f) => [`${stem(f)}.html`, [f]]), ...(files.length > 1 ? [[`${setName(files)}.html`, files]] : [])];
    for (const [name, list] of pages) {
      const dest = path.join(out, name);
      fs.writeFileSync(dest, await page(list));
      written.push(dest);
    }
  };
  if (!png && !pdf) {
    if (html) await writeHtml();
    return written;
  }
  const browser = await launch();
  try {
    const p = await open(browser, files, POSTER_WIDTH, 2, state);
    const errs = await p.evaluate(() => [...document.querySelectorAll("[data-poster-error]")].map((e) => e.textContent));
    if (errs.length) throw new Error(`Render error: ${errs.join("; ")} — run check first`);
    // Interactive chrome (grid toggle, page 3 controls) has no place on a shared file; keep its space.
    await p.addStyleTag({ content: "button,[data-chrome]{visibility:hidden}" });
    const heights = await p.evaluate((n) => [...Array(n).keys()].map((i) => Math.ceil(document.getElementById(`poster-${i}`).getBoundingClientRect().height)), files.length);

    if (png) {
      for (const [i, file] of files.entries()) {
        const dest = path.join(out, `${stem(file)}.png`);
        await p.locator(`#poster-${i}`).screenshot({ path: dest });
        written.push(dest);
      }
    }

    if (pdf) {
      // Every poster gets its own page, sized to the poster or scaled onto paper.
      const pageCss = (only) => files.map((_, i) => {
        const h = heights[i];
        if (only !== undefined && i !== only) return `#poster-${i}{display:none}`;
        if (paper === "fit") return `@page p${i}{size:${POSTER_WIDTH}px ${h}px;margin:0} #poster-${i}{page:p${i};break-after:page}`;
        const [pw, ph] = PAPER_PX[paper];
        const zoom = Math.min(pw / POSTER_WIDTH, ph / h).toFixed(4);
        return `@page{size:${paper};margin:0} #poster-${i}{zoom:${zoom};margin:0 auto;break-after:page}`;
      }).join("\n");
      const print = async (dest, only) => {
        const style = await p.addStyleTag({ content: pageCss(only) });
        await p.pdf({ path: dest, printBackground: true, preferCSSPageSize: true });
        await style.evaluate((s) => s.remove());
        written.push(dest);
      };
      for (const [i, file] of files.entries()) await print(path.join(out, `${stem(file)}.pdf`), i);
      if (files.length > 1) await print(path.join(out, `${setName(files)}.pdf`));
    }
    await p.close();
  } finally {
    await browser.close();
  }
  if (html) await writeHtml();
  return written;
}

// "hypher-app-poster" + "hypher-project-story" → "hypher-poster-set"
function setName(files) {
  const parts = files.map((f) => stem(f).split("-"));
  const common = [];
  for (let i = 0; parts.every((p) => p[i] !== undefined && p[i] === parts[0][i]); i++) common.push(parts[0][i]);
  return `${common.join("-") || "explain-app"}-poster-set`;
}

const USAGE = `Usage:
  node poster.mjs check  <file.canvas.tsx>... [--facts <facts.json>] [--state key=value]...
  node poster.mjs export <file.canvas.tsx>... [--out dir] [--paper fit|a4|letter] [--no-png] [--no-pdf] [--html] [--state key=value]...

export writes PNG + PDF per poster (plus a set PDF for several). --html adds a self-contained <stem>.html per poster
(plus a set .html for several) that opens offline in any browser; with --no-png --no-pdf it needs no browser.`;
const VALUE_OPTIONS = ["--out", "--paper", "--facts", "--state"];
const FLAG_OPTIONS = ["--no-png", "--no-pdf", "--html"];

// Positional files plus --name value / --name=value options (--state may repeat).
function parseArgs(args) {
  const files = [];
  const opt = { state: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) {
      files.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    const name = eq < 0 ? a : a.slice(0, eq);
    if (FLAG_OPTIONS.includes(name)) opt[name] = true;
    else if (VALUE_OPTIONS.includes(name)) {
      const value = eq < 0 ? args[++i] : a.slice(eq + 1);
      if (value === undefined) throw new Error(`${name} needs a value`);
      if (name === "--state") opt.state.push(value);
      else opt[name] = value;
    } else throw new Error(`Unknown option ${name}`);
  }
  return { files, opt };
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  let parsed;
  try {
    parsed = parseArgs(rest);
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`);
    return 2;
  }
  const { files, opt } = parsed;
  if (!["check", "export"].includes(cmd) || !files.length) {
    console.log(USAGE);
    return 2;
  }
  const missing = files.filter((f) => !fs.existsSync(f));
  if (missing.length) {
    console.error(`Not found: ${missing.join(", ")}`);
    return 2;
  }
  const state = parseState(opt.state);
  if (cmd === "check") {
    const results = await check(files, { state, facts: opt["--facts"] });
    const failed = results.filter((r) => r.errors.length).length;
    console.log(`\n${failed ? `${failed} of ${results.length} poster(s) failed` : `All ${results.length} poster(s) pass`}`);
    return failed ? 1 : 0;
  }
  const written = await exportPosters(files, {
    out: opt["--out"],
    paper: opt["--paper"] ?? "fit",
    png: !opt["--no-png"],
    pdf: !opt["--no-pdf"],
    html: !!opt["--html"],
    state,
  });
  console.log(written.map((w) => `wrote ${w}`).join("\n"));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => {
    console.error(e.message);
    process.exit(1);
  });
}

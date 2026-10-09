#!/usr/bin/env node
// explain-app poster tools.
//
//   node poster.mjs check  <file.canvas.tsx>...            Enforce the Swiss poster rules
//   node poster.mjs export <file.canvas.tsx>... [options]  Write PNG + PDF for sharing
//
// Export options:
//   --out <dir>          Output directory (default: <first file's dir>/exports)
//   --paper fit|a4|letter  PDF page size (default: fit — one page sized to the poster)
//   --no-png / --no-pdf  Skip a format
//
// Page rules are inferred from the filename (*project-story* = page 2, *exploded-view* = page 3).
// Set POSTER_CHROMIUM to a Chromium binary to skip `npx playwright install chromium`.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { buildPage, lintSource } from "./lib/build.mjs";
import { inspectOverlay, inspectPoster } from "./lib/inspect.js";

const PALETTE = { PAPER: "#FFFFFF", INK: "#0A0A0A", INK_SOFT: "#5B6066", ACCENT: "#E4002B", HAIRLINE: "rgba(10, 10, 10, 0.2)", TINT: "#FCE1E6" };
const POSTER_WIDTH = 1028; // MAXW 900 + 2 × MARGIN 64
const CHECK_WIDTHS = [1440, POSTER_WIDTH];
const NARROW_WIDTH = 720; // a canvas panel beside the chat
const MAX_HEIGHT = 1300;
const PAPER_PX = { a4: [794, 1123], letter: [816, 1056] };

const pageOf = (file) => (/project-story/i.test(path.basename(file)) ? 2 : /exploded-view/i.test(path.basename(file)) ? 3 : 1);
const stem = (file) => path.basename(file).replace(/\.canvas\.tsx$|\.tsx$/, "");

async function launch() {
  try {
    return await chromium.launch({ executablePath: process.env.POSTER_CHROMIUM || undefined });
  } catch (e) {
    throw new Error(`Could not start Chromium. Run \`npx playwright install chromium\` in ${path.dirname(new URL(import.meta.url).pathname)}, or set POSTER_CHROMIUM to a Chromium binary.\n${e.message.split("\n")[0]}`);
  }
}

async function open(browser, files, width, scale = 1) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: scale });
  await page.setContent(await buildPage(files));
  await page.waitForFunction((n) => [...Array(n).keys()].every((i) => document.getElementById(`poster-${i}`)?.childElementCount), files.length);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

export async function check(files, { browser, quiet = false } = {}) {
  const own = !browser;
  browser ??= await launch();
  const results = [];
  try {
    for (const file of files) {
      const errors = lintSource(fs.readFileSync(file, "utf8"));
      const warnings = [];
      const page = pageOf(file);
      try {
        for (const width of CHECK_WIDTHS) {
          const p = await open(browser, [file], width);
          const r = await p.evaluate(inspectPoster, { index: 0, page, palette: PALETTE });
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
            if (page === 3) errors.push(...(await interact(p)));
          }
          await p.close();
          if (errors.some((e) => e.startsWith("Render error"))) break;
        }
        const narrow = await open(browser, [file], NARROW_WIDTH);
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

// Page 3 is interactive: the slider must open the layers, the layer list must
// answer the arrow keys, pointing at a layer must highlight it, and the theme
// button must flip the paper. Runs on a page that has already passed inspectPoster.
async function interact(p) {
  const errors = [];
  const slider = p.getByRole("slider", { name: /open layers/i });
  if (!(await slider.count())) return ['No "Open layers" slider — page 3 needs a range input labelled "Open layers"'];
  const spread = () => p.evaluate(() => {
    const tops = [...document.querySelectorAll("#poster-0 [data-layer]")].map((g) => g.getBoundingClientRect().top);
    return Math.max(...tops) - Math.min(...tops);
  });
  await slider.focus();
  await p.keyboard.press("Home");
  const closed = await spread();
  await p.keyboard.press("End");
  const opened = await spread();
  if (!(opened > closed + 40)) errors.push(`Slider does not open the layers (spread ${closed.toFixed(0)}px closed → ${opened.toFixed(0)}px open)`);

  const list = p.getByRole("listbox");
  if (!(await list.count())) errors.push("No layer listbox — labels must be role=listbox options so the arrow keys can pick a layer");
  else {
    await list.first().focus();
    await p.keyboard.press("Home");
    const before = await list.first().getAttribute("aria-activedescendant");
    await p.keyboard.press("ArrowDown");
    const after = await list.first().getAttribute("aria-activedescendant");
    if (!before || before === after) errors.push("ArrowDown in the layer list does not move the selection");
  }

  // Point at layer 2's leader anchor — on its top face and clear of the layer above at full open.
  const target = await p.evaluate(() => {
    const el = document.querySelector('#poster-0 [data-leader="1"]');
    if (!el) return null;
    const pt = new DOMPoint(el.points[0].x, el.points[0].y).matrixTransform(el.getScreenCTM());
    return { x: pt.x - 2, y: pt.y + 2 };
  });
  if (target) {
    await p.mouse.move(target.x, target.y);
    const lit = await p.waitForFunction((tint) => {
      const face = document.querySelector('#poster-0 [data-layer="1"] [data-face="top"]');
      return face && getComputedStyle(face).fill === tint;
    }, "rgb(252, 225, 230)", { timeout: 1500 }).then(() => true, () => false);
    if (!lit) errors.push("Pointing at a layer does not highlight it with the tint");
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
  return errors;
}

function report({ file, page, errors, warnings }) {
  const status = errors.length ? "FAIL" : "PASS";
  console.log(`\n${status}  ${path.basename(file)}  (page ${page})`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  for (const w of warnings) console.log(`  ! ${w}`);
}

async function exportPosters(files, { out, paper = "fit", png = true, pdf = true }) {
  if (paper !== "fit" && !PAPER_PX[paper]) throw new Error(`Unknown --paper "${paper}" — use fit, a4, or letter`);
  out ??= path.join(path.dirname(path.resolve(files[0])), "exports");
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  const written = [];
  try {
    const p = await open(browser, files, POSTER_WIDTH, 2);
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
  return written;
}

// "hypher-app-poster" + "hypher-project-story" → "hypher-poster-set"
function setName(files) {
  const parts = files.map((f) => stem(f).split("-"));
  const common = [];
  for (let i = 0; parts.every((p) => p[i] !== undefined && p[i] === parts[0][i]); i++) common.push(parts[0][i]);
  return `${common.join("-") || "explain-app"}-poster-set`;
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  const files = rest.filter((a, i) => !a.startsWith("--") && !["--out", "--paper"].includes(rest[i - 1]));
  const opt = (name) => rest[rest.indexOf(name) + 1];
  if (!["check", "export"].includes(cmd) || !files.length) {
    console.log("Usage:\n  node poster.mjs check <file.canvas.tsx>...\n  node poster.mjs export <file.canvas.tsx>... [--out dir] [--paper fit|a4|letter] [--no-png] [--no-pdf]");
    return 2;
  }
  const missing = files.filter((f) => !fs.existsSync(f));
  if (missing.length) {
    console.error(`Not found: ${missing.join(", ")}`);
    return 2;
  }
  if (cmd === "check") {
    const results = await check(files);
    const failed = results.filter((r) => r.errors.length).length;
    console.log(`\n${failed ? `${failed} of ${results.length} poster(s) failed` : `All ${results.length} poster(s) pass`}`);
    return failed ? 1 : 0;
  }
  const written = await exportPosters(files, {
    out: rest.includes("--out") ? opt("--out") : undefined,
    paper: rest.includes("--paper") ? opt("--paper") : "fit",
    png: !rest.includes("--no-png"),
    pdf: !rest.includes("--no-pdf"),
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

#!/usr/bin/env node
// explain-app poster tools.
//
//   node poster.mjs check  <file.canvas.tsx>...            Enforce the Swiss poster rules
//   node poster.mjs export <file.canvas.tsx>... [options]  Write PNG, PDF and SVG for sharing
//
// Export options:
//   --out <dir>          Output directory (default: <first file's dir>/exports)
//   --paper fit|a4|letter  PDF page size (default: fit — one page sized to the poster)
//   --no-png / --no-pdf / --no-svg  Skip a format
//
// Page 1 vs page 2 rules are inferred from the filename (*project-story* = page 2).
// Set POSTER_CHROMIUM to a Chromium binary to skip `npx playwright install chromium`.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { buildPage, lintSource } from "./lib/build.mjs";
import { inspectOverlay, inspectPoster } from "./lib/inspect.js";
import { svgScript } from "./lib/to-svg.mjs";

const PALETTE = {
  PAPER: "#FFFFFF", INK: "#0A0A0A", INK_SOFT: "#5B6066", HAIRLINE: "rgba(10, 10, 10, 0.2)",
  ACCENT: "#E4002B", RED: "#E4002B", BLUE: "#0039A6", YELLOW: "#FFCC00", SILVER: "#CFCFCF",
};
const POSTER_WIDTH = 1028; // MAXW 900 + 2 × MARGIN 64
const CHECK_WIDTHS = [1440, POSTER_WIDTH];
const NARROW_WIDTH = 720; // a canvas panel beside the chat
const MAX_HEIGHT = 1454; // A-series portrait (1:√2) at the 1028px poster width
const PAPER_PX = { a4: [794, 1123], letter: [816, 1056] };

const pageOf = (file) => (/project-story/i.test(path.basename(file)) ? 2 : 1);
const stem = (file) => path.basename(file).replace(/\.canvas\.tsx$|\.tsx$/, "");

export async function launch() {
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
            if (r.height > MAX_HEIGHT) warnings.push(`Poster is ${r.height}px tall — taller than an A-series sheet (${MAX_HEIGHT}px); trim copy`);
            const toggle = p.getByRole("button", { name: /show grid/i });
            if (!(await toggle.count())) errors.push('No "Show grid" toggle');
            else {
              await toggle.first().click();
              errors.push(...(await p.evaluate(inspectOverlay, { index: 0 })));
            }
          }
          await p.close();
          if (errors.some((e) => e.startsWith("Render error"))) break;
        }
        const narrow = await open(browser, [file], NARROW_WIDTH);
        // Block posters are fixed A-series sheets; only the fluid Swiss layout must fit a narrow panel.
        const fixedSheet = await narrow.evaluate(() => !!document.querySelector('[data-poster-style="block"]'));
        if (!fixedSheet && (await narrow.evaluate(() => document.documentElement.scrollWidth > innerWidth))) {
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

function report({ file, page, errors, warnings }) {
  const status = errors.length ? "FAIL" : "PASS";
  console.log(`\n${status}  ${path.basename(file)}  (page ${page})`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  for (const w of warnings) console.log(`  ! ${w}`);
}

export async function exportPosters(files, { out, paper = "fit", png = true, pdf = true, svg = true }) {
  if (paper !== "fit" && !PAPER_PX[paper]) throw new Error(`Unknown --paper "${paper}" — use fit, a4, or letter`);
  out ??= path.join(path.dirname(path.resolve(files[0])), "exports");
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  const written = [];
  try {
    const p = await open(browser, files, POSTER_WIDTH, 2);
    const errs = await p.evaluate(() => [...document.querySelectorAll("[data-poster-error]")].map((e) => e.textContent));
    if (errs.length) throw new Error(`Render error: ${errs.join("; ")} — run check first`);
    // Interactive chrome (the grid toggle) has no place on a shared file; keep its space.
    await p.addStyleTag({ content: "button{visibility:hidden}" });
    const heights = await p.evaluate((n) => [...Array(n).keys()].map((i) => Math.ceil(document.getElementById(`poster-${i}`).getBoundingClientRect().height)), files.length);

    if (png) {
      for (const [i, file] of files.entries()) {
        const dest = path.join(out, `${stem(file)}.png`);
        await p.locator(`#poster-${i}`).screenshot({ path: dest });
        written.push(dest);
      }
    }

    if (svg) {
      await p.addScriptTag({ content: await svgScript() });
      for (const [i, file] of files.entries()) {
        const dest = path.join(out, `${stem(file)}.svg`);
        const markup = await p.evaluate((i) => {
          // Interactive chrome stays out of the vector file entirely.
          const root = document.getElementById(`poster-${i}`);
          const hidden = [...root.querySelectorAll("button, [data-grid-overlay]")];
          hidden.forEach((el) => (el.style.display = "none"));
          const out = window.__posterToSVG(root);
          hidden.forEach((el) => (el.style.display = ""));
          return out;
        }, i);
        fs.writeFileSync(dest, markup);
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
    console.log("Usage:\n  node poster.mjs check <file.canvas.tsx>...\n  node poster.mjs export <file.canvas.tsx>... [--out dir] [--paper fit|a4|letter] [--no-png] [--no-pdf] [--no-svg]");
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
    svg: !rest.includes("--no-svg"),
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

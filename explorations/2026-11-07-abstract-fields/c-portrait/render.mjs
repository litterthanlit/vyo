// Builds the band texts from the Hypher source named in hypher-facts.json, injects them, writes out.png.
// Usage: node render.mjs            (optional: node render.mjs zoom  -> also writes zoom crops for the readability test)
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const SRC = "/home/user/hypher/", FONTS = "/home/user/vyo/.cursor/skills/explain-app/tools/fonts/";
const facts = JSON.parse(fs.readFileSync("../hypher-facts.json", "utf8"));
// Major parts of the app, top of the sheet first. The first one holds the handoff note.
const PARTS = [
  ["the note", p => p.startsWith("hypher-web/shared/")],
  ["server", p => p.startsWith("hypher-web/convex/")],
  ["inner workings", p => p.startsWith("hypher-web/src/lib/") || p.startsWith("hypher-web/src/types/")],
  ["screens", p => p.startsWith("hypher-web/src/") && !p.startsWith("hypher-web/src/components/marketing/")],
  ["marketing", p => p.startsWith("hypher-web/src/components/marketing/")],
  ["cli", p => p.startsWith("packages/")],
  ["mac app", p => p.startsWith("Hypher/")],
  ["extensions", p => p.startsWith("extensions/")],
  ["scripts", p => true],
];
const bands = PARTS.map(([name]) => ({ name, loc: 0, text: "", files: [] }));
for (const [p, { loc }] of Object.entries(facts.files).sort()) {
  const i = PARTS.findIndex(([, f]) => f(p)), b = bands[i];
  b.loc += loc; b.files.push(p);
  let t = ""; try { t = fs.readFileSync(SRC + p, "utf8"); } catch {}
  // readability test failed on raw source lines, so the texture is identifiers and file names only:
  // comments and string literals are dropped, then every identifier token is kept in order
  const code = t.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*/g, " ").replace(/`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, " ");
  const flat = p.split("/").pop() + "  " + (code.match(/[A-Za-z_$][A-Za-z0-9_$]{2,}/g) || []).join(" ");
  if (p.endsWith("shared/handoffNote.ts")) b.hot = flat;
  b.text += flat + "  ";
}
for (const b of bands) console.log(b.name.padEnd(16), b.loc, b.files.length);
const b64 = f => fs.readFileSync(FONTS + f).toString("base64");
const fonts = `
@font-face{font-family:"Commit";font-weight:400;src:url(data:font/otf;base64,${b64("commit-400.otf")})}
@font-face{font-family:"Commit";font-weight:700;src:url(data:font/otf;base64,${b64("commit-700.otf")})}`;
const html = fs.readFileSync("index.html", "utf8").replace("/*FONTS*/", () => fonts)
  .replace("/*DATA*/null", () => JSON.stringify(bands.map(({ name, loc, text, hot, files }) => ({ name, loc, files: files.length, text: text.slice(0, 260000), hot }))).replace(/</g, "\\u003c"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 840, height: 1190 }, deviceScaleFactor: 2 });
page.on("pageerror", e => console.error("pageerror", e.message));
page.on("console", m => console.log("page:", m.text()));
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.fonts].map(x => x.load())); window.draw(); });
await page.waitForTimeout(300);
await page.locator(".sheet").screenshot({ path: "out.png" });
await browser.close();
console.log("wrote out.png");

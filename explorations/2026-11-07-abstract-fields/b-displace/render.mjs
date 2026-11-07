// Renders index.html to out.png. Reads the Hypher scan, groups files into parts,
// and hands the parts (lines of code) and the import counts between them to the page.
// Usage: node render.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const F = "/home/user/vyo/.cursor/skills/explain-app/tools/fonts/", b64 = f => fs.readFileSync(F + f).toString("base64");
const fonts = `
@font-face{font-family:"Commit";font-weight:400;src:url(data:font/otf;base64,${b64("commit-400.otf")})}
@font-face{font-family:"Commit";font-weight:700;src:url(data:font/otf;base64,${b64("commit-700.otf")})}
@font-face{font-family:"Newsreader";font-weight:400;src:url(data:font/ttf;base64,${b64("newsreader-400.ttf")})}`;

const facts = JSON.parse(fs.readFileSync("../hypher-facts.json", "utf8"));
// A part is a top-level folder, or the second level inside the monorepo packages.
const part = p => { const s = p.split("/"); return ["hypher-web", "packages", "extensions"].includes(s[0]) && s.length > 2 ? s.slice(0, 2).join("/") : s[0]; };
const loc = {}; let total = 0;
for (const [p, v] of Object.entries(facts.files)) { loc[part(p)] = (loc[part(p)] || 0) + v.loc; total += v.loc; }
// Major parts: at least 3% of all lines.
const parts = Object.entries(loc).filter(([, l]) => l / total >= 0.03).sort((a, b) => b[1] - a[1]).map(([id, l]) => ({ id, loc: l }));
const ids = new Set(parts.map(p => p.id)), links = {};
for (const [a, b] of facts.imports) {
  const pa = part(a), pb = part(b); if (pa === pb || !ids.has(pa) || !ids.has(pb)) continue;
  const k = [pa, pb].sort().join("|"); links[k] = (links[k] || 0) + 1;
}
const scan = { total, parts, links: Object.entries(links).map(([k, n]) => [...k.split("|"), n]) };
console.log(JSON.stringify(scan));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 840, height: 1190 }, deviceScaleFactor: 2 });
page.on("console", m => console.log("page:", m.text())); page.on("pageerror", e => console.error("pageerror", e.message));
const html = fs.readFileSync("index.html", "utf8").replace("/*FONTS*/", fonts).replace("/*SCAN*/null", JSON.stringify(scan));
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.fonts].map(x => x.load())); window.draw && window.draw(); });
await page.waitForTimeout(300);
await page.locator(".sheet").screenshot({ path: process.argv[2] || "out.png" });
await browser.close();
console.log("wrote", process.argv[2] || "out.png");

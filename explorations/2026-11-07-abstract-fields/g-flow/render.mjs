// Usage: node render.mjs -> out.png (840x1190 @2x). Reads ../hypher-facts.json.
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const F = "/home/user/vyo/.cursor/skills/explain-app/tools/fonts/", b64 = f => fs.readFileSync(F + f).toString("base64");
const fonts = `
@font-face{font-family:"Commit";font-weight:400;src:url(data:font/otf;base64,${b64("commit-400.otf")})}
@font-face{font-family:"Commit";font-weight:500 700;src:url(data:font/otf;base64,${b64("commit-700.otf")})}
@font-face{font-family:"Newsreader";font-weight:400;src:url(data:font/ttf;base64,${b64("newsreader-400.ttf")})}`;
const facts = JSON.parse(fs.readFileSync("../hypher-facts.json", "utf8"));
const loc = {};
for (const f of Object.values(facts.files)) loc[f.area] = (loc[f.area] || 0) + f.loc;
const fileArea = Object.fromEntries(Object.entries(facts.files).map(([p, f]) => [p, f.area]));
const parts = Object.keys(loc).sort().map(id => ({ id, loc: loc[id] }));
const edges = facts.imports.map(([a, b]) => [fileArea[a], fileArea[b]]).filter(([a, b]) => a && b && a !== b);
const cfg = JSON.parse(fs.readFileSync("cfg.json", "utf8"));
const data = JSON.stringify({ parts, edges, ...cfg });
const html = fs.readFileSync("index.html", "utf8").replace("/*FONTS*/", fonts).replace("/*DATA*/", data);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 840, height: 1190 }, deviceScaleFactor: 2 });
page.on("pageerror", e => console.error("pageerror", e.message));
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.fonts].map(x => x.load())); window.draw(); });
console.log(await page.evaluate(() => JSON.stringify(window.__dbg)), parts.length, "parts");
await page.locator(".sheet").screenshot({ path: "out.png" });
await browser.close();

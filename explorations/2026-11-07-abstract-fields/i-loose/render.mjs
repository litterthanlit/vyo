// Renders the four loose-frame posters. Usage: node render.mjs [name ...]  -> out-<name>.png (full, 2x) and small-<name>.png (1/6 of the PNG)
// Each <name>.html carries /*FONTS*/ and /*DATA*/; the data file is bands.json for the wave and parts.json for the terrain.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const F = "/home/user/vyo/.cursor/skills/explain-app/tools/fonts/", b64 = f => fs.readFileSync(F + f).toString("base64");
const fonts = `
@font-face{font-family:"Commit";font-weight:400;src:url(data:font/otf;base64,${b64("commit-400.otf")})}
@font-face{font-family:"Commit";font-weight:700;src:url(data:font/otf;base64,${b64("commit-700.otf")})}
@font-face{font-family:"Newsreader";font-weight:400;src:url(data:font/ttf;base64,${b64("newsreader-400.ttf")})}`;
const names = process.argv.slice(2).length ? process.argv.slice(2) : ["wave-paper", "wave-dark", "terrain-paper", "terrain-dark"];
const browser = await chromium.launch(process.env.VYO_CHROMIUM ? { executablePath: process.env.VYO_CHROMIUM } : {});
for (const n of names) {
  const data = fs.readFileSync(n.startsWith("wave") ? "bands.json" : "parts.json", "utf8");
  const html = fs.readFileSync(`${n}.html`, "utf8").replace("/*FONTS*/", fonts).replace("/*DATA*/", data);
  const page = await browser.newPage({ viewport: { width: 840, height: 1190 }, deviceScaleFactor: 2 });
  page.on("pageerror", e => console.error(n, "pageerror", e.message));
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.fonts].map(x => x.load())); window.draw(); });
  await page.waitForTimeout(300);
  await page.locator(".sheet").screenshot({ path: `out-${n}.png` }); await page.close();
  execFileSync("python3", ["-I", "-c", "import sys;from PIL import Image;i=Image.open(sys.argv[1]);i.resize((i.width//6,i.height//6),Image.LANCZOS).save(sys.argv[2])", `out-${n}.png`, `small-${n}.png`]);
  console.log("wrote", n);
}
await browser.close();

// Renders the poster mockups to png/ with the fonts from ./fetch-fonts.sh embedded.
// Usage: node render.mjs hourglass.html hourglass-dark.html ...
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const F = "fonts/", b64 = f => fs.readFileSync(F + f).toString("base64");
const fonts = `
@font-face{font-family:"Commit";font-weight:400;src:url(data:font/otf;base64,${b64("commit-400.otf")})}
@font-face{font-family:"Commit";font-weight:700;src:url(data:font/otf;base64,${b64("commit-700.otf")})}
@font-face{font-family:"Newsreader";font-weight:400;src:url(data:font/ttf;base64,${b64("newsreader-400.ttf")})}`;
const browser = await chromium.launch();
for (const f of process.argv.slice(2)) {
  const page = await browser.newPage({ viewport: { width: 840, height: 1190 }, deviceScaleFactor: 2 });
  page.on("pageerror", e => console.error(f, "pageerror", e.message));
  await page.setContent(fs.readFileSync(f, "utf8").replace("/*FONTS*/", fonts), { waitUntil: "load" });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.fonts].map(x => x.load())); window.draw && window.draw(); });
  await page.waitForTimeout(300);
  await page.locator(".sheet").screenshot({ path: `png/${f.replace(".html", ".png")}` }); await page.close(); console.log("wrote", f);
}
await browser.close();

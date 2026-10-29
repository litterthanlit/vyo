import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const data = fs.readFileSync("data.json", "utf8"), common = fs.readFileSync("common.js", "utf8"), css = fs.readFileSync("base.css", "utf8");
const browser = await chromium.launch();
fs.mkdirSync("out", { recursive: true });
for (const f of process.argv.slice(2)) {
  const page = await browser.newPage({ viewport: { width: 840, height: 1190 }, deviceScaleFactor: 2 });
  page.on("pageerror", e => console.error("pageerror", e.message));
  const html = fs.readFileSync(f, "utf8").replace("/*CSS*/", css).replace("/*COMMON*/", common).replace("/*DATA*/", data.replace(/<\//g, "<\\/"));
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.locator(".sheet").screenshot({ path: `out/${f.replace(".html", ".png")}` });
  console.log("wrote", f);
  await page.close();
}
await browser.close();

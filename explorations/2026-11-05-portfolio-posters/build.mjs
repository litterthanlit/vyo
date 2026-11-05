// Inlines the Commit Mono files from ./fonts into posters.src.html → dist/posters.html, then renders one PNG per poster.
// Usage: ./fetch-fonts.sh && node build.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const b64 = (f) => fs.readFileSync("fonts/" + f).toString("base64");
const fonts = [400, 700].map((w) => `@font-face{font-family:"Commit";font-weight:${w};font-display:block;src:url(data:font/otf;base64,${b64(`commit-${w}.otf`)}) format("opentype")}`).join("\n");
fs.mkdirSync("dist", { recursive: true });
fs.mkdirSync("png", { recursive: true });
fs.writeFileSync("dist/posters.html", fs.readFileSync("posters.src.html", "utf8").replace("/*FONTS*/", fonts));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1632, height: 1100 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.error("pageerror", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console", m.text()));
await page.goto("file://" + process.cwd() + "/dist/posters.html", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.evaluate(() => window.__still());
await page.waitForTimeout(300);
const frames = page.locator(".frame");
const names = ["01-hypher", "02-wavr", "03-studio-os", "04-vyo", "05-litt-md"];
for (let i = 0; i < (await frames.count()); i++) {
  await frames.nth(i).scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await frames.nth(i).screenshot({ path: `png/${names[i]}.png` });
  console.log("wrote", names[i]);
}
await browser.close();

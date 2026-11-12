// Two posters side by side: node pair.mjs <left.png> <right.png> <out-prefix>  ->  <out-prefix>-full.png (both at
// 840px wide) and <out-prefix>-thumbs.png (a 560px-wide pair of 280px thumbnails), each screenshotted from one page.
import fs from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("../../../.cursor/skills/vyo/node_modules/playwright");
const [left, right, out] = process.argv.slice(2);
const img = (f, w) => `<img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}" width="${w}" style="display:block">`;
const browser = await chromium.launch(process.env.VYO_CHROMIUM ? { executablePath: process.env.VYO_CHROMIUM } : {});
for (const [name, w, gap, scale] of [["full", 840, 16, 2], ["thumbs", 280, 0, 1]]) {
  const page = await browser.newPage({ viewport: { width: 2 * w + gap, height: Math.ceil((w * 2380) / 1680) }, deviceScaleFactor: scale });
  await page.setContent(`<body style="margin:0;background:#888;display:flex;gap:${gap}px">${img(left, w)}${img(right, w)}</body>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: `${out}-${name}.png` });
  await page.close();
}
await browser.close();

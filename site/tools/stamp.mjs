// Rewrites the ?v= query on assets/site.css and assets/site.js in index.html
// to the first 8 hex chars of each file's sha256. No deps.
// Usage: node site/tools/stamp.mjs [--check]   (--check exits 1 on drift, writes nothing)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const site = fileURLToPath(new URL("..", import.meta.url));
const indexPath = site + "index.html";
const check = process.argv.includes("--check");
const files = ["assets/site.css", "assets/site.js"];

let html = readFileSync(indexPath, "utf8");
const stale = [];
for (const f of files) {
  const hash = createHash("sha256").update(readFileSync(site + f)).digest("hex").slice(0, 8);
  const re = new RegExp(`(${f.replace(/[.]/g, "\\.")}\\?v=)[0-9a-zA-Z]*`);
  const m = html.match(re);
  if (!m) {
    console.error(`stamp: no "${f}?v=" reference found in site/index.html`);
    process.exit(1);
  }
  if (m[0] !== m[1] + hash) stale.push(`${f}: index.html has ${m[0].slice(m[1].length)}, content hash is ${hash}`);
  html = html.replace(re, `$1${hash}`);
}

if (check) {
  if (stale.length) {
    console.error("Stale asset hashes in site/index.html:\n  " + stale.join("\n  ") + "\nRun: node site/tools/stamp.mjs");
    process.exit(1);
  }
  console.log("asset hashes up to date");
} else {
  writeFileSync(indexPath, html);
  console.log(stale.length ? "stamped:\n  " + stale.join("\n  ") : "already up to date");
}

// Tests for tools/lib/changes-cli.mjs (the `diff` and `changes` commands) and tools/lib/gitrev.mjs.
// Run: node --test tools/test/changes-cli.test.mjs
// `diff` runs on facts scanned from copies of the recipe fixture; `changes` runs on throwaway git repos.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { changesMain, diffMain } from "../lib/changes-cli.mjs";
import { buildBriefing } from "../lib/briefing.mjs";
import { renderHtml } from "../lib/briefing-html.mjs";
import { diffFacts } from "../lib/changes.mjs";
import { factsHash, stableStringify } from "../lib/hash.mjs";
import { TEMP_PREFIX, materialiseRev, resolveSince } from "../lib/gitrev.mjs";
import { scanRepo } from "../scan.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, "..");
const FIX = path.join(HERE, "fixtures");
const CLI = path.join(TOOLS, "scan.mjs");

// Run a command in-process with its io captured.
async function run(main, args) {
  const err = [];
  let stdout = "";
  const io = { out: (s) => (stdout += `${s}\n`), write: (s) => (stdout += s), err: (s) => err.push(s) };
  const code = await main(args, io);
  return { code, stdout, err, errText: err.join("\n") };
}

const read = (file) => fs.readFileSync(file, "utf8");

/* ───────────── diff ───────────── */

// Two facts files from copies of the recipe fixture (named "pantry"): the "after" copy has a new screen, an orphan
// Twilio file, an AI import in the Plan screen and one saved record fewer.
async function pantryFacts(tmp) {
  const dirs = ["before", "after"].map((side) => {
    const dir = path.join(tmp, side, "pantry");
    fs.cpSync(path.join(FIX, "recipe"), dir, { recursive: true });
    return dir;
  });
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dirs[1], rel)), { recursive: true });
    fs.writeFileSync(path.join(dirs[1], rel), text);
  };
  put("app/(app)/billing/page.tsx", "export default function Billing() {\n  return <section>Billing</section>;\n}\n");
  put("lib/notify.ts", 'import twilio from "twilio";\n\nexport const sms = twilio("sid", "token");\n');
  put("app/(app)/plan/page.tsx", `import { suggestRecipes } from "@/lib/ai/suggest";\n${read(path.join(dirs[1], "app/(app)/plan/page.tsx"))}`);
  put("prisma/schema.prisma", read(path.join(dirs[1], "prisma/schema.prisma")).replace(/model Ingredient \{[^}]*\}\n\n/, ""));
  const beforeFile = path.join(tmp, "before.json");
  const afterFile = path.join(tmp, "after.json");
  fs.writeFileSync(beforeFile, stableStringify(await scanRepo(dirs[0], { useGit: false }), 1));
  fs.writeFileSync(afterFile, stableStringify(await scanRepo(dirs[1], { useGit: false }), 1));
  return { beforeFile, afterFile };
}

describe("diff", () => {
  let tmp;
  let beforeFile;
  let afterFile;

  before(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "changes-cli-"));
    ({ beforeFile, afterFile } = await pantryFacts(tmp));
  });
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("prints the briefing in plain English and exits 0", async () => {
    const r = await run(diffMain, [beforeFile, afterFile]);
    assert.equal(r.code, 0, r.errText);
    assert.match(r.stdout, /^What changed\n\nComparing two scans of pantry\./);
    assert.match(r.stdout, /1 new screen/);
    assert.match(r.stdout, /Screens {11}6 → 7 \(\+1\)/);
    assert.match(r.stdout, /The saved record Ingredient is gone\./);
    assert.doesNotMatch(r.stdout, /↳/, "no receipts unless asked");
    assert.deepEqual(r.err, []);
  });

  test("--receipts adds the files behind each line", async () => {
    const r = await run(diffMain, [beforeFile, afterFile, "--receipts"]);
    assert.equal(r.code, 0, r.errText);
    assert.match(r.stdout, /↳ app\/\(app\)\/billing\/page\.tsx/);
    assert.match(r.stdout, /↳ app\/\(app\)\/plan\/page\.tsx → lib\/ai\/suggest\.ts ─uses→ ai:openai/);
  });

  test("--json prints the Changes JSON instead", async () => {
    const r = await run(diffMain, [beforeFile, afterFile, "--json"]);
    assert.equal(r.code, 0, r.errText);
    const changes = JSON.parse(r.stdout);
    assert.equal(changes.kind, "changes");
    assert.equal(changes.version, 1);
    assert.equal(changes.same, false);
    assert.deepEqual(changes.added.map((i) => i.id), ["screen:/billing", "service:text-messages"]);
    assert.equal(r.stdout, `${stableStringify(changes, 1)}\n`, "stableStringify with an indent of 1");
    assert.doesNotMatch(r.stdout, /What changed\n/);
  });

  test("--out writes the Changes JSON, byte-identical on a re-run; stdout is still the briefing", async () => {
    const outA = path.join(tmp, "out", "a", "changes.json");
    const outB = path.join(tmp, "out", "b", "changes.json");
    const first = await run(diffMain, [beforeFile, afterFile, "--out", outA]);
    assert.equal(first.code, 0, first.errText);
    assert.match(first.stdout, /^What changed/);
    assert.deepEqual(first.err, [`→ ${outA}`], "the folder is created; progress goes to stderr");
    const second = await run(diffMain, [beforeFile, afterFile, "--out", outB]);
    assert.equal(second.code, 0);
    assert.equal(read(outA), read(outB));
    const json = await run(diffMain, [beforeFile, afterFile, "--json"]);
    assert.equal(`${read(outA)}\n`, json.stdout, "--out and --json carry the same bytes");
    assert.equal(JSON.parse(read(outA)).hash, JSON.parse(json.stdout).hash);
  });

  test("the same scan twice says nothing changed", async () => {
    const r = await run(diffMain, [beforeFile, beforeFile]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /Nothing changed\./);
  });

  test("exit 1 for input it cannot use, with a ✗ line", async () => {
    const missing = await run(diffMain, [path.join(tmp, "nope.json"), afterFile]);
    assert.equal(missing.code, 1);
    assert.match(missing.err[0], /^✗ Cannot read .*nope\.json/);
    assert.equal(missing.stdout, "");

    const bad = path.join(tmp, "bad.json");
    fs.writeFileSync(bad, "{ not json");
    const notJson = await run(diffMain, [beforeFile, bad]);
    assert.equal(notJson.code, 1);
    assert.match(notJson.err[0], /^✗ .*bad\.json is not valid JSON/);

    const v2 = path.join(tmp, "v2.json");
    fs.writeFileSync(v2, JSON.stringify({ ...JSON.parse(read(afterFile)), version: 2 }));
    const wrongVersion = await run(diffMain, [beforeFile, v2]);
    assert.equal(wrongVersion.code, 1);
    assert.match(wrongVersion.err[0], /^✗ .*v2\.json is not a facts\.json \(expected version 1/);
  });

  test("a facts file whose hash does not recompute is used, with a warning", async () => {
    const edited = path.join(tmp, "edited.json");
    const f = JSON.parse(read(afterFile));
    f.files["lib/utils.ts"].loc += 1;
    fs.writeFileSync(edited, JSON.stringify(f));
    const r = await run(diffMain, [beforeFile, edited]);
    assert.equal(r.code, 0);
    assert.match(r.err[0], /^! .*edited\.json: hash does not match its content/);
  });

  test("exit 2 for usage mistakes", async () => {
    for (const args of [[], [beforeFile], [beforeFile, afterFile, "extra.json"], [beforeFile, afterFile, "--wat"], [beforeFile, afterFile, "--out"], [beforeFile, afterFile, "--json=yes"]]) {
      const r = await run(diffMain, args);
      assert.equal(r.code, 2, JSON.stringify(args));
      assert.match(r.errText, /usage: node tools\/scan\.mjs diff <before\.json> <after\.json>/);
      assert.equal(r.stdout, "");
    }
    const help = await run(diffMain, ["--help"]);
    assert.equal(help.code, 0);
    assert.match(help.stdout, /^usage: node tools\/scan\.mjs diff/);
  });

  test("--canvas reads PARTS and the WIRING facts hash: the poster is out of date, and new things are not on it", async () => {
    const parts = [
      { name: "What you see", role: "screens", line: "Every screen.", from: ["screen:**"] },
      { name: "Saved recipes", role: "data", line: "What is kept.", from: ["table:*"] },
    ];
    const canvas = (facts) =>
      ["// PARTS:BEGIN — you write this (valid JSON). Then run: node tools/scan.mjs wire <facts.json> --into <this file>", `const PARTS: PartSpec[] = ${JSON.stringify(parts)};`, "// PARTS:END",
        "// WIRING:BEGIN — generated by `node tools/scan.mjs wire`; do not edit", `const WIRING: Wiring = ${JSON.stringify({ facts, parts: "00000000", n: [], links: [] })};`, "// WIRING:END", ""].join("\n");
    const fresh = path.join(tmp, "fresh.canvas.tsx");
    const stale = path.join(tmp, "stale.canvas.tsx");
    fs.writeFileSync(fresh, canvas(JSON.parse(read(afterFile)).hash));
    fs.writeFileSync(stale, canvas(JSON.parse(read(beforeFile)).hash));

    const a = await run(diffMain, [beforeFile, afterFile, "--canvas", stale]);
    assert.equal(a.code, 0, a.errText);
    assert.match(a.stdout, /Your poster is out of date: it was drawn before these changes\./);
    assert.match(a.stdout, /isn't on your poster yet|aren't on your poster yet/);

    const b = await run(diffMain, [beforeFile, afterFile, "--canvas", fresh]);
    assert.equal(b.code, 0, b.errText);
    assert.doesNotMatch(b.stdout, /out of date/);
    const posters = JSON.parse((await run(diffMain, [beforeFile, afterFile, "--canvas", fresh, "--json"])).stdout).posters;
    assert.equal(posters.stale, false);
    assert.ok(posters.uncited.includes("service:text-messages"));

    // no canvas at all, or one without PARTS, is an input error
    assert.equal((await run(diffMain, [beforeFile, afterFile, "--canvas", path.join(tmp, "nope.tsx")])).code, 1);
    const bare = path.join(tmp, "bare.tsx");
    fs.writeFileSync(bare, "export default 1;\n");
    const noParts = await run(diffMain, [beforeFile, afterFile, "--canvas", bare]);
    assert.equal(noParts.code, 1);
    assert.match(noParts.errText, /has no \/\/ PARTS:BEGIN/);
  });

  test("a scan close to the scanner's file cap draws a warning", async () => {
    const big = JSON.parse(read(afterFile));
    for (let i = 0; i < 19000; i++) big.files[`gen/f${i}.ts`] = { area: "area:gen", loc: 1 };
    big.hash = factsHash(big);
    const bigFile = path.join(tmp, "big.json");
    fs.writeFileSync(bigFile, JSON.stringify(big));
    const r = await run(diffMain, [beforeFile, bigFile]);
    assert.equal(r.code, 0, r.errText);
    assert.match(r.err[0], /^! .*big\.json has 19,\d{3} files, close to the scanner's 20,000-file limit/);
    assert.equal(r.err.length, 1);
  });

  test("scan.mjs forwards diff to the module and its exit code is the module's", () => {
    const r = spawnSync("node", [CLI, "diff", beforeFile, afterFile], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^What changed/);
    assert.equal(spawnSync("node", [CLI, "diff", beforeFile], { encoding: "utf8" }).status, 2);
    assert.equal(spawnSync("node", [CLI, "diff", beforeFile, path.join(tmp, "nope.json")], { encoding: "utf8" }).status, 1);
    assert.match(spawnSync("node", [CLI, "help"], { encoding: "utf8" }).stdout, /diff {4}<before\.json> <after\.json>/);
  });
});

/* ───────────── --html ───────────── */

describe("html", () => {
  let tmp;
  let beforeFile;
  let afterFile;
  let oldFacts;
  let newFacts;
  before(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "changes-html-"));
    ({ beforeFile, afterFile } = await pantryFacts(tmp));
    oldFacts = JSON.parse(read(beforeFile));
    newFacts = JSON.parse(read(afterFile));
  });
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const page = (b, a, { receipts = false, ...opts } = {}) =>
    renderHtml(buildBriefing(diffFacts(b, a), { receipts }), { receipts, app: "Pantry", hashes: { before: b.hash, after: a.hash }, ...opts });
  // Nothing may reach out: no scripts, links, imports, url()s or absolute addresses.
  const SELF_CONTAINED = [/https?:\/\//i, /<script/i, /<link/i, /url\(/i, /@import/i, /<iframe/i, /<img/i, /\bsrc=/i, /\bhref=/i];

  test("a complete page: language, viewport, colour schemes, landmarks, a short title", () => {
    const html = page(oldFacts, newFacts);
    assert.match(html, /^<!doctype html>\n<html lang="en">/);
    assert.match(html, /<meta charset="utf-8">/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(html, /<meta name="color-scheme" content="light dark">/);
    assert.match(html, /<title>What changed in Pantry<\/title>/);
    assert.match(html, /@media \(prefers-color-scheme:dark\)/);
    assert.match(html, /:root\[data-theme="dark"\]/);
    assert.match(html, /:root\[data-theme="light"\]/);
    assert.match(html, /@media \(prefers-reduced-motion:reduce\)/);
    assert.match(html, /@media print/);
    assert.match(html, /:focus-visible/);
    for (const tag of ["<header>", "<main>", "<footer", "<dl", "<ul", "<h1>What changed<span class=\"stop\">.</span></h1>"]) assert.ok(html.includes(tag), tag);
    // the poster tokens
    for (const token of ["--paper:#FFFFFF", "--ink:#0A0A0A", "--ink-soft:#5B6066", "--hairline:rgba(10,10,10,.12)", "--accent:#E4002B", "--paper:#0A0A0A", "--ink:#F2F2F2", "--ink-soft:#9AA0A6"]) assert.ok(html.includes(token), token);
    assert.match(html, /body\{margin:0;background:var\(--paper\)/, "body has an explicit background");
    // the red is for the full stop and the flag, nothing else
    assert.equal(html.split("var(--accent)").length - 1, 2);
    assert.equal(html.split("#E4002B").length - 1, 1);
    // the title is two to four words, on a first look too
    const first = renderHtml(buildBriefing(diffFacts(JSON.parse(read(beforeFile)).facts && emptyLike(oldFacts), newFacts)), { app: "Pantry" });
    assert.match(first, /<title>Where Pantry stands<\/title>/);
    assert.match(first, /<h1 class="long">Where your app stands now<span class="stop">\.<\/span><\/h1>/);
  });

  test("self-contained: no script, link, url(), @import or address", () => {
    for (const receipts of [false, true]) {
      const html = page(oldFacts, newFacts, { receipts });
      for (const re of SELF_CONTAINED) assert.doesNotMatch(html, re, `${re} (receipts: ${receipts})`);
    }
  });

  test("every section is labelled by a heading that exists; numbers are a <dl>, lines a <ul>", () => {
    const html = page(oldFacts, newFacts);
    const labelled = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(labelled.length >= 6);
    for (const id of labelled) assert.ok(html.includes(`<h2 id="${id}">`), id);
    assert.equal(new Set(labelled).size, labelled.length, "ids are unique");
    assert.equal((html.match(/<dt>/g) ?? []).length, 6);
    // the figure is the "after" value; the small line is the change
    assert.match(html, /<dt>Screens<\/dt><dd><span class="big">7<\/span><span class="delta">6 → 7 \(\+1\)<\/span><\/dd>/);
    assert.match(html, /<dt>AI<\/dt><dd><span class="big">1<\/span><span class="delta">no change<\/span><\/dd>/);
    assert.match(html, /<section class="row" aria-labelledby="h-look"><h2 id="h-look">Worth a look<\/h2>/);
    assert.equal((html.match(/class="flag"/g) ?? []).length, 2, "a flag on each Worth a look line, nowhere else");
    // it says what the text says
    for (const line of ["The Billing screen is new.", "The saved record Ingredient is gone.", "OpenAI is now used from the Plan screen."]) assert.ok(html.includes(line), line);
  });

  test("receipts are in <details> only when asked for", () => {
    const plain = page(oldFacts, newFacts);
    assert.doesNotMatch(plain, /<details/);
    assert.doesNotMatch(plain, /Show me where/);
    assert.doesNotMatch(plain, /app\/\(app\)\/billing\/page\.tsx/);
    const rec = page(oldFacts, newFacts, { receipts: true });
    assert.match(rec, /<details><summary>Show me where<\/summary><p class="where">app\/\(app\)\/billing\/page\.tsx<\/p><\/details>/);
    assert.match(rec, /app\/\(app\)\/plan\/page\.tsx → lib\/ai\/suggest\.ts ─uses→ ai:openai/);
    // a doc built with receipts but rendered without them shows none
    const doc = buildBriefing(diffFacts(oldFacts, newFacts), { receipts: true });
    assert.doesNotMatch(renderHtml(doc, { receipts: false }), /<details/);
  });

  test("size bars are CSS widths with a text alternative", () => {
    const grown = JSON.parse(JSON.stringify(newFacts));
    grown.files["lib/payments/charge.ts"] = { area: "area:lib/payments", loc: 120 };
    grown.files["lib/recipes/query.ts"].loc += 90;
    grown.facts.push({ id: "area:lib/payments", kind: "area", name: "Payments", files: [], meta: { leaf: true } });
    grown.hash = factsHash(grown);
    const html = page(oldFacts, grown);
    assert.match(html, /<p class="caption">Lines of code, by part\. Grey was there before, solid is new, outlined is gone\.<\/p>/);
    const bars = [...html.matchAll(/<li class="bar">.*?<\/li>/g)].map((m) => m[0]);
    assert.ok(bars.length >= 1, "at least one part moved enough to show");
    for (const b of bars) {
      assert.match(b, /<span class="track" role="img" aria-label="[^"]+: [\d,]+ lines, (up|down) [\d,]+ from [\d,]+">/);
      for (const w of b.matchAll(/style="width:([\d.]+)%"/g)) assert.ok(Number(w[1]) > 0 && Number(w[1]) <= 100, w[0]);
    }
    // a first look has nothing to compare with: no legend, no "+N"
    const first = renderHtml(buildBriefing(diffFacts(emptyLike(oldFacts), newFacts)));
    assert.match(first, /<p class="caption">Lines of code, by part\.<\/p>/);
    assert.doesNotMatch(first, /<span class="bar-delta">/);
    assert.match(first, /aria-label="[^"]+: [\d,]+ lines"/);
  });

  test("everything that comes from a scan is escaped", () => {
    const evilName = "<img src=x onerror=alert(1)>";
    const evilFile = 'app/evil/"><svg onload=alert(1)>/page.tsx';
    const evil = JSON.parse(JSON.stringify(newFacts));
    evil.facts.push({ id: "screen:/evil", kind: "screen", name: evilName, files: [evilFile] });
    evil.files[evilFile] = { area: "area:app", loc: 3, defines: ["screen:/evil"] };
    evil.hash = factsHash(evil);
    const doc = buildBriefing(diffFacts(oldFacts, evil), { receipts: true });
    assert.ok(doc.sections.flatMap((x) => x.items).some((i) => i.text.includes(evilName)), "premise: the name reaches the doc");
    const html = renderHtml(doc, { receipts: true, app: '<b onclick="x">Pantry & \'Co\'</b>', hashes: { before: "<s>", after: '"x"' } });
    assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), "escaped");
    assert.doesNotMatch(html, /<img/i);
    assert.doesNotMatch(html, /<svg onload/i);
    assert.ok(html.includes("&quot;&gt;&lt;svg onload=alert(1)&gt;"), "the receipt path is escaped too");
    assert.ok(html.includes("<title>What changed in &lt;b onclick=&quot;x&quot;&gt;Pantry &amp; &#39;Co&#39;&lt;/b&gt;</title>"));
    assert.ok(html.includes("<code>&lt;s&gt;</code>") && html.includes("<code>&quot;x&quot;</code>"));
    // and hostile text anywhere in a hand-made doc
    const hand = renderHtml({ title: "<i>T</i>", lede: "<b>l</b>", short: "&amp;", numbers: [{ label: "<n>", kind: "screen", before: 1, after: 2, delta: 1, value: "<v>", text: "" }], sections: [{ id: 'x" onload="y', title: "<script>", items: [{ text: "'; alert(1)//", flag: true }], bars: [{ label: '"><u>', before: 1, after: 5, delta: 4 }] }], footer: "<f>" });
    for (const re of [/<i>/, /<b>/, /<n>/, /<v>/, /<script/, /<u>/, /<f>/, /onload=/]) assert.doesNotMatch(hand, re, String(re));
    assert.match(hand, /&amp;amp;/);
  });

  test("nothing changed, a change that is not structural, and a first look all read well", () => {
    const same = renderHtml(buildBriefing(diffFacts(oldFacts, oldFacts)), { app: "Pantry" });
    assert.match(same, /<p class="lead">Nothing changed\.<\/p>/);
    assert.doesNotMatch(same, /<dl|<ul/);
    for (const re of SELF_CONTAINED) assert.doesNotMatch(same, re);
    const quiet = JSON.parse(JSON.stringify(oldFacts));
    quiet.files["lib/utils.ts"].loc += 3;
    quiet.hash = factsHash(quiet);
    const notStructural = page(oldFacts, quiet);
    assert.match(notStructural, /Nothing structural changed/);
    assert.doesNotMatch(notStructural, /What I can’t see/, "that line already carries the caveat");
    const first = renderHtml(buildBriefing(diffFacts(emptyLike(oldFacts), newFacts)), { app: "Pantry" });
    assert.match(first, /<dt>Screens<\/dt><dd><span class="big">7<\/span><\/dd>/, "no arrow on a first look");
  });

  test("deterministic: the same input gives the same bytes", () => {
    assert.equal(page(oldFacts, newFacts, { receipts: true }), page(oldFacts, newFacts, { receipts: true }));
  });

  test("--html writes the page; stdout is still the briefing; the folder is created; a re-run is byte-identical", async () => {
    const a = path.join(tmp, "html", "a", "briefing.html");
    const b = path.join(tmp, "html", "b", "briefing.html");
    const r = await run(diffMain, [beforeFile, afterFile, "--html", a]);
    assert.equal(r.code, 0, r.errText);
    assert.match(r.stdout, /^What changed\n/);
    assert.deepEqual(r.err, [`→ ${a}`]);
    assert.equal((await run(diffMain, [beforeFile, afterFile, "--html", b])).code, 0);
    assert.equal(read(a), read(b));
    const html = read(a);
    assert.match(html, /<title>What changed in Pantry<\/title>/, "the app's name comes from the scan");
    assert.ok(html.includes(`<code>${oldFacts.hash}</code> → <code>${newFacts.hash}</code>`), "the compared hashes are at the foot");
    assert.doesNotMatch(html, /<details/);
    const rec = path.join(tmp, "html", "receipts.html");
    assert.equal((await run(diffMain, [beforeFile, afterFile, "--html", rec, "--receipts"])).code, 0);
    assert.match(read(rec), /<details><summary>Show me where<\/summary>/);
    // --html together with --json: the file is the page, stdout the JSON
    const both = await run(diffMain, [beforeFile, afterFile, "--html", a, "--json"]);
    assert.equal(JSON.parse(both.stdout).kind, "changes");
    assert.equal((await run(diffMain, [beforeFile, afterFile, "--html", path.join(tmp, "html")])).code, 1, "a folder is not a file");
    assert.equal((await run(diffMain, [beforeFile, afterFile, "--html"])).code, 2);
  });
});

// A facts file for the same app with nothing in it (what `--since empty` compares with).
function emptyLike(facts) {
  const empty = { version: 1, hash: "", empty: true, repo: facts.repo, facts: [], files: {}, imports: [], uses: [], unresolved: {} };
  empty.hash = factsHash(empty);
  return empty;
}

/* ───────────── git helpers ───────────── */

const hasGit = (() => {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
const SKIP = hasGit ? false : "git is not available";

const DAY1 = "2026-10-01T12:00:00+0000";
const DAY5 = "2026-10-05T12:00:00+0000";
const DAY9 = "2026-10-09T12:00:00+0000";

const gitEnv = (date = DAY1, extra = {}) => ({ ...process.env, TZ: "UTC", GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1", ...extra });
function git(cwd, args, date = DAY1) {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", ...args], {
    cwd,
    encoding: "utf8",
    env: gitEnv(date),
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd(); // not trim(): the first column of `status --porcelain` can be a space
}
function commitAll(repo, message, date) {
  git(repo, ["add", "-A"], date);
  git(repo, ["commit", "-q", "-m", message], date);
  return git(repo, ["rev-parse", "HEAD"]);
}
const write = (repo, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
  fs.writeFileSync(path.join(repo, rel), text);
};
const SCREEN = (name) => `export default function ${name}() {\n  return <section>${name}</section>;\n}\n`;

// A repo named "pantry" holding the recipe fixture, committed on 2026-10-01.
function makeRepo(root, name = "pantry") {
  const repo = path.join(root, name);
  fs.cpSync(path.join(FIX, "recipe"), repo, { recursive: true });
  git(repo, ["init", "-q", "-b", "main"]);
  commitAll(repo, "first", DAY1);
  return repo;
}

// Every file under .git with its size and mtime: reading must not change any of it.
function snapshot(dir) {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => {
      const p = path.join(e.parentPath ?? e.path, e.name);
      const st = fs.statSync(p);
      return `${path.relative(dir, p)} ${st.size} ${st.mtimeMs}`;
    })
    .sort()
    .join("\n");
}

/* ───────────── changes ───────────── */

describe("changes (git)", { skip: SKIP }, () => {
  let root;
  let priv; // the child's TMPDIR: the only place a temporary folder of ours can appear
  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "changes-git-"));
    priv = path.join(root, "tmp");
    fs.mkdirSync(priv);
  });
  after(() => fs.rmSync(root, { recursive: true, force: true }));

  const cli = (args, extra = {}) => spawnSync("node", [CLI, "changes", ...args], { encoding: "utf8", env: gitEnv(DAY1, { TMPDIR: priv, ...extra }) });
  const json = (r) => {
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  const leftovers = () => fs.readdirSync(priv).filter((n) => n.startsWith(TEMP_PREFIX));

  test("--since HEAD on a clean commit is the same scan, and nothing in the repo is touched", () => {
    const repo = makeRepo(fs.mkdtempSync(path.join(root, "clean-")));
    const gitDir = path.join(repo, ".git");
    const status = git(repo, ["status", "--porcelain"]);
    const before = snapshot(gitDir);
    const r = cli([repo, "--since", "HEAD", "--json"]);
    const changes = json(r);
    assert.equal(changes.same, true);
    assert.equal(changes.before.hash, changes.after.hash);
    assert.equal(changes.structural, false);
    assert.deepEqual(changes.notes, []);
    assert.equal(changes.before.repo, "pantry");
    assert.match(changes.before.label, /^your last saved version \([0-9a-f]{7}, 2026-10-01\)$/);
    assert.equal(changes.after.label, "your files right now");
    assert.doesNotMatch(r.stderr, /^[✗!]/m, "no warnings");
    assert.match(r.stderr, /Reading your last saved version/);
    assert.equal(snapshot(gitDir), before, "nothing was written into .git");
    assert.equal(git(repo, ["status", "--porcelain"]), status, "git status is unchanged");
    assert.deepEqual(leftovers(), [], "the temporary folder is gone");

    const text = cli([repo, "--since", "HEAD"]);
    assert.equal(text.status, 0, text.stderr);
    assert.match(text.stdout, /^What changed\n\nSince your last saved version \([0-9a-f]{7}, 2026-10-01\) · compared with your files right now\.\n\nNothing changed\.\n$/);
  });

  test("export-ignore in .gitattributes does not hide files from the saved version", () => {
    const repo = makeRepo(fs.mkdtempSync(path.join(root, "attrs-")));
    write(repo, ".gitattributes", "* export-ignore\n");
    commitAll(repo, "ignore everything on export", DAY5);
    const archive = execFileSync("git", ["archive", "--format=tar", "HEAD"], { cwd: repo, env: gitEnv(), maxBuffer: 1 << 28 });
    assert.ok(!archive.includes("package.json"), "premise: git archive leaves everything out");
    const changes = json(cli([repo, "--since", "HEAD", "--json"]));
    assert.equal(changes.same, true);
    assert.equal(changes.before.hash, changes.after.hash);
    assert.deepEqual(leftovers(), []);
  });

  test("an untracked new screen and an unstaged deleted file are both found, with no ghost noise", () => {
    const repo = makeRepo(fs.mkdtempSync(path.join(root, "dirty-")));
    write(repo, "app/(app)/billing/page.tsx", SCREEN("Billing")); // untracked
    fs.rmSync(path.join(repo, "app/(app)/settings/page.tsx")); // tracked, deleted, not staged
    const status = git(repo, ["status", "--porcelain"]);
    assert.match(status, /\?\? app\/\(app\)\/billing\//);
    assert.match(status, / D app\/\(app\)\/settings\/page\.tsx/);
    const r = cli([repo, "--since", "HEAD", "--json"]);
    const changes = json(r);
    assert.deepEqual(changes.added.map((i) => i.id), ["screen:/billing"]);
    assert.deepEqual(changes.removed.map((i) => i.id), ["screen:/settings"]);
    assert.deepEqual(changes.moved, [], "a different shape: not a rename");
    assert.deepEqual(changes.counts.screen, { before: 6, after: 6, added: 1, removed: 1 });
    assert.doesNotMatch(r.stderr, /^[✗!]/m);
    assert.doesNotMatch(r.stderr, /could not be read|unreadable/i);
    const text = cli([repo, "--since", "HEAD"]).stdout;
    assert.match(text, /The Billing screen is new\./);
    assert.match(text, /The Settings screen is gone\./);
    assert.equal(git(repo, ["status", "--porcelain"]), status, "git status is unchanged");
    assert.deepEqual(leftovers(), []);
  });

  test("a date picks the last saved version before it; a date before the first one starts from nothing", () => {
    const repo = makeRepo(fs.mkdtempSync(path.join(root, "dates-")));
    const first = git(repo, ["rev-parse", "HEAD"]);
    write(repo, "app/(app)/two/page.tsx", SCREEN("Two"));
    const second = commitAll(repo, "second", DAY5);
    write(repo, "app/(app)/three/page.tsx", SCREEN("Three"));
    const third = commitAll(repo, "third", DAY9);
    const short = (sha) => sha.slice(0, 7);
    const since = (value) => json(cli([repo, "--since", value, "--json"]));

    const a = since("2026-10-06");
    assert.equal(a.before.label, `your saved version (${short(second)}, 2026-10-05)`);
    assert.deepEqual(a.added.map((i) => i.id), ["screen:/three"]);
    // a bare day means its first second: the commit made at noon that day is not yet there
    assert.equal(since("2026-10-05").before.label, `your saved version (${short(first)}, 2026-10-01)`);
    assert.equal(since("2026-10-05 12:00:00").before.label, `your saved version (${short(second)}, 2026-10-05)`);
    assert.equal(since("2026-10-05T12:00:00Z").before.label, `your saved version (${short(second)}, 2026-10-05)`);
    // the latest version before a late date is the last one: HEAD itself
    const late = since("2026-12-01");
    assert.equal(late.same, true);
    assert.equal(late.before.label, `your last saved version (${short(third)}, 2026-10-09)`);
    // a rev works the same way: HEAD~1, a branch, a short id
    assert.equal(since("HEAD~1").before.label, `your saved version (${short(second)}, 2026-10-05)`);
    assert.equal(since("main").before.label, `your last saved version (${short(third)}, 2026-10-09)`);
    assert.equal(since(short(first)).before.label, `your saved version (${short(first)}, 2026-10-01)`);

    // before the history begins: an empty baseline, and a note that says when the history does begin
    const early = since("2026-09-01");
    assert.equal(early.before.empty, true);
    assert.equal(early.before.label, "an empty project");
    assert.deepEqual(early.notes.filter((n) => n.code === "first-save-after-date"), [{ code: "first-save-after-date", date: "2026-10-01" }]);
    assert.ok(early.added.length > 0, "everything is new");
    const text = cli([repo, "--since", "2026-09-01"]).stdout;
    assert.match(text, /^Where your app stands now\n/);
    assert.match(text, /Your first saved version is from 2026-10-01, after the date you asked about, so everything counts as new\./);
    assert.deepEqual(leftovers(), []);
  });

  test("values that are neither a version, a date nor a file are refused", () => {
    const repo = makeRepo(fs.mkdtempSync(path.join(root, "bad-")));
    const nope = cli([repo, "--since", "no-such-branch"]);
    assert.equal(nope.status, 1);
    assert.match(nope.stderr, /^✗ --since no-such-branch: I can't find that saved version, and it doesn't look like a date/m);
    assert.equal(nope.stdout, "");
    const typo = cli([repo, "--since", "HEAD~50"]);
    assert.equal(typo.status, 1, "a too-deep HEAD~N must not be read as 'now'");
    assert.match(typo.stderr, /can't find that saved version/);
    assert.equal(cli([repo, "--since", "2026-02-31"]).status, 1, "not a day");
    for (const value of ["-1", "--output=/tmp/x", "-n"]) {
      const r = cli([repo, `--since=${value}`]);
      assert.equal(r.status, 2, value);
      assert.match(r.stderr, /is not a version, a date or a file/);
      assert.match(r.stderr, /usage: node tools\/scan\.mjs changes/);
    }
    assert.deepEqual(leftovers(), []);
  });

  test("a folder inside the repo is refused, with the top folder to use instead", () => {
    const repo = makeRepo(fs.mkdtempSync(path.join(root, "sub-")));
    const sub = path.join(repo, "app");
    const r = cli([sub, "--since", "HEAD"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /^✗ .*app is inside a git project but is not its top folder\. Run this on the top folder instead: .*pantry$/m);
    assert.ok(fs.realpathSync(r.stderr.match(/instead: (.*)$/m)[1]) === fs.realpathSync(repo));
    // "empty" and a facts file need no git at all
    assert.equal(cli([sub, "--since", "empty"]).status, 0);
  });

  test("a folder that is not under git needs an earlier facts file", () => {
    const dir = path.join(fs.mkdtempSync(path.join(root, "plain-")), "pantry");
    fs.cpSync(path.join(FIX, "recipe"), dir, { recursive: true });
    const r = cli([dir, "--since", "HEAD"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /^✗ --since HEAD needs git history or an earlier facts file, and .*pantry is not inside a git project\./m);
    assert.equal(cli([dir, "--since", "2026-10-01"]).status, 1);

    // from nothing: the whole app is new
    const empty = cli([dir, "--since", "empty"]);
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /^Where your app stands now\n\nThis is everything the scan found in your files right now\./);
    assert.match(cli([dir, "--since", "none"]).stdout, /^Where your app stands now/);

    // a bookmark is a facts file: --save-facts now, --since <file> later
    const bookmark = path.join(root, "bookmarks", "pantry.json");
    const saved = cli([dir, "--since", "empty", "--save-facts", bookmark]);
    assert.equal(saved.status, 0, saved.stderr);
    assert.match(saved.stderr, /→ .*pantry\.json \(a bookmark of your files right now/);
    const facts = JSON.parse(fs.readFileSync(bookmark, "utf8"));
    assert.equal(facts.version, 1);
    assert.equal(facts.repo.name, "pantry");
    assert.equal(fs.readFileSync(bookmark, "utf8"), stableStringify(facts, 1));
    const same = cli([dir, "--since", bookmark]);
    assert.equal(same.status, 0, same.stderr);
    assert.match(same.stdout, /^What changed\n\nSince your earlier scan \(pantry\.json\) · compared with your files right now\.\n\nNothing changed\.\n$/);
    write(dir, "app/(app)/billing/page.tsx", SCREEN("Billing"));
    const moved = cli([dir, "--since", bookmark]);
    assert.match(moved.stdout, /The Billing screen is new\./);
    // a bookmark that is not facts is an input error
    fs.writeFileSync(path.join(root, "bookmarks", "bad.json"), "[]");
    const bad = cli([dir, "--since", path.join(root, "bookmarks", "bad.json")]);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /^✗ .*bad\.json is not a facts\.json/m);
    // moving the bookmark forward in one go: compare with it, then replace it
    const forward = cli([dir, "--since", bookmark, "--save-facts", bookmark]);
    assert.equal(forward.status, 0, forward.stderr);
    assert.match(forward.stdout, /The Billing screen is new\./);
    assert.match(cli([dir, "--since", bookmark]).stdout, /Nothing changed\./);
    assert.deepEqual(leftovers(), []);
  });

  test("a shallow clone can still be read from HEAD, but not by date", () => {
    const repo = makeRepo(fs.mkdtempSync(path.join(root, "deep-")));
    write(repo, "app/(app)/two/page.tsx", SCREEN("Two"));
    commitAll(repo, "second", DAY5);
    const shallow = path.join(fs.mkdtempSync(path.join(root, "shallow-")), "pantry");
    execFileSync("git", ["clone", "-q", "--depth", "1", `file://${repo}`, shallow], { env: gitEnv(), stdio: "ignore" });
    assert.equal(git(shallow, ["rev-parse", "--is-shallow-repository"]), "true");
    const head = cli([shallow, "--since", "HEAD", "--json"]);
    assert.equal(json(head).same, true);
    const byDate = cli([shallow, "--since", "2026-10-03"]);
    assert.equal(byDate.status, 1);
    assert.match(byDate.stderr, /^✗ .*pantry is a shallow clone: only recent history was downloaded/m);
    assert.match(byDate.stderr, /git fetch --unshallow/);
    const rev = cli([shallow, "--since", "HEAD~1"]);
    assert.equal(rev.status, 1);
    assert.match(rev.stderr, /This is a shallow clone/);
  });

  test("a repo with no saved versions yet says so", () => {
    const repo = path.join(fs.mkdtempSync(path.join(root, "unborn-")), "pantry");
    fs.cpSync(path.join(FIX, "recipe"), repo, { recursive: true });
    git(repo, ["init", "-q", "-b", "main"]);
    const r = cli([repo, "--since", "HEAD"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /has no saved versions \(git commits\) yet/);
    assert.equal(cli([repo, "--since", "empty"]).status, 0);
  });

  test("--out is byte-identical on a re-run, and nothing is written inside the repo", () => {
    const repo = makeRepo(fs.mkdtempSync(path.join(root, "out-")));
    write(repo, "app/(app)/billing/page.tsx", SCREEN("Billing"));
    const a = path.join(root, "outputs", "a", "changes.json");
    const b = path.join(root, "outputs", "b", "changes.json");
    assert.equal(cli([repo, "--since", "HEAD", "--out", a]).status, 0);
    assert.equal(cli([repo, "--since", "HEAD", "--out", b]).status, 0);
    assert.equal(fs.readFileSync(a, "utf8"), fs.readFileSync(b, "utf8"));
    assert.deepEqual(JSON.parse(fs.readFileSync(a, "utf8")).added.map((i) => i.id), ["screen:/billing"]);

    // output inside the repo: refused before anything is read or written
    const before = git(repo, ["status", "--porcelain"]);
    for (const flag of ["--out", "--html", "--save-facts"]) {
      const inside = path.join(repo, "docs", "x.json");
      const r = cli([repo, "--since", "HEAD", flag, inside]);
      assert.equal(r.status, 1, flag);
      assert.match(r.stderr, new RegExp(`^✗ ${flag} .*x\\.json is inside the scanned repo; the scanner never writes there`, "m"));
      assert.equal(r.stdout, "");
      assert.ok(!fs.existsSync(path.dirname(inside)));
    }
    // ... also through "." and a path that climbs out and back in
    const dotted = spawnSync("node", [CLI, "changes", ".", "--since", "HEAD", "--out", `../${path.basename(repo)}/y.json`], { cwd: repo, encoding: "utf8", env: gitEnv(DAY1, { TMPDIR: priv }) });
    assert.equal(dotted.status, 1);
    assert.match(dotted.stderr, /is inside the scanned repo/);
    assert.equal(git(repo, ["status", "--porcelain"]), before);
  });

  test("usage mistakes exit 2; a missing folder exits 1", () => {
    const repo = makeRepo(fs.mkdtempSync(path.join(root, "usage-")));
    for (const args of [[], [repo], ["--since", "HEAD"], [repo, "extra", "--since", "HEAD"], [repo, "--since"], [repo, "--since", "HEAD", "--wat"]]) {
      const r = cli(args);
      assert.equal(r.status, 2, JSON.stringify(args));
      assert.match(r.stderr, /usage: node tools\/scan\.mjs changes <repo> --since/);
      assert.equal(r.stdout, "");
    }
    const gone = cli([path.join(root, "no-such-folder"), "--since", "HEAD"]);
    assert.equal(gone.status, 1);
    assert.match(gone.stderr, /^✗ .*no-such-folder does not exist/m);
    const file = cli([path.join(repo, "package.json"), "--since", "HEAD"]);
    assert.equal(file.status, 1);
    assert.match(file.stderr, /is not a directory/);
  });

  test("--canvas and --receipts work on a live comparison too", () => {
    const repo = makeRepo(fs.mkdtempSync(path.join(root, "receipts-")));
    write(repo, "app/(app)/billing/page.tsx", SCREEN("Billing"));
    const r = cli([repo, "--since", "HEAD", "--receipts"]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /↳ app\/\(app\)\/billing\/page\.tsx/);
    const canvas = path.join(root, "x.canvas.tsx");
    fs.writeFileSync(canvas, '// PARTS:BEGIN — you write this (valid JSON)\nconst PARTS: PartSpec[] = [{"name":"What you see","role":"screens","line":"Every screen.","from":["screen:**"]}];\n// PARTS:END\n');
    const c = cli([repo, "--since", "HEAD", "--canvas", canvas, "--json"]);
    assert.ok(json(c).posters, "posters section present with --canvas");
    assert.equal(cli([repo, "--since", "HEAD", "--canvas", path.join(root, "missing.tsx")]).status, 1);
  });

  test("changesMain can be called in-process with its own io", async () => {
    const repo = makeRepo(fs.mkdtempSync(path.join(root, "inproc-")));
    const r = await run(changesMain, [repo, "--since", "HEAD"]);
    assert.equal(r.code, 0, r.errText);
    assert.match(r.stdout, /Nothing changed\./);
    assert.equal((await run(changesMain, [repo])).code, 2);
  });
});

/* ───────────── gitrev ───────────── */

describe("gitrev", { skip: SKIP }, () => {
  let root;
  let priv;
  let savedTmp;
  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "gitrev-"));
    priv = path.join(root, "tmp");
    fs.mkdirSync(priv);
    savedTmp = process.env.TMPDIR;
    process.env.TMPDIR = priv; // os.tmpdir() reads it on every call
  });
  after(() => {
    if (savedTmp === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = savedTmp;
    fs.rmSync(root, { recursive: true, force: true });
  });
  const leftovers = () => fs.readdirSync(priv).filter((n) => n.startsWith(TEMP_PREFIX));

  function bytesRepo() {
    const repo = path.join(fs.mkdtempSync(path.join(root, "bytes-")), "bytes-repo");
    fs.mkdirSync(repo);
    git(repo, ["init", "-q", "-b", "main"]);
    return repo;
  }
  const head = (repo) => git(repo, ["rev-parse", "HEAD"]);

  test("every byte comes out as it went in, across many files and chunk boundaries", async () => {
    const repo = bytesRepo();
    const all = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
    const noisy = Buffer.alloc(1_500_000);
    for (let i = 0; i < noisy.length; i++) noisy[i] = (i * 2654435761) >>> 24;
    const files = new Map([
      ["bytes.bin", all],
      ["crlf.txt", Buffer.from("a\r\nb\r\n\r\n")],
      ["empty.txt", Buffer.alloc(0)],
      ["looks-like-a-header.txt", Buffer.from("0123456789abcdef0123456789abcdef01234567 blob 5\nhello\n")],
      ["noisy.bin", noisy],
      ["dir with space/né ü.ts", Buffer.from("export const x = 1;\n")],
    ]);
    for (let i = 0; i < 300; i++) files.set(`many/f${String(i).padStart(3, "0")}.txt`, Buffer.from(`file ${i}\n`));
    for (const [rel, buf] of files) {
      fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
      fs.writeFileSync(path.join(repo, rel), buf);
    }
    commitAll(repo, "bytes", DAY1);
    const tree = await materialiseRev(repo, head(repo));
    try {
      assert.equal(path.basename(tree.dir), "bytes-repo", "named like the repo");
      assert.deepEqual(tree.notes, []);
      assert.equal(tree.stats.files, files.size);
      assert.equal(tree.stats.failed, 0);
      for (const [rel, buf] of files) assert.ok(fs.readFileSync(path.join(tree.dir, rel)).equals(buf), rel);
    } finally {
      tree.cleanup();
    }
    assert.deepEqual(leftovers(), []);
    tree.cleanup(); // twice is fine
  });

  test("symlinks, submodules and never-walked folders are left out; a big blob is a sparse file of its true size", async () => {
    const repo = bytesRepo();
    write(repo, "src/app.ts", "export const a = 1;\n");
    write(repo, "node_modules/dep/index.js", "module.exports = 1;\n");
    write(repo, "vendor/keep.ts", "export const v = 1;\n"); // vendor is not "never walked": it still exists
    fs.writeFileSync(path.join(repo, "video.bin"), Buffer.alloc(3 * 1024 * 1024, 7));
    fs.writeFileSync(path.join(repo, "small.bin"), Buffer.alloc(1024, 9));
    fs.symlinkSync("src/app.ts", path.join(repo, "link.ts"));
    git(repo, ["add", "-A", "-f"]);
    git(repo, ["update-index", "--add", "--cacheinfo", `160000,${"1".repeat(40)},sub`]);
    git(repo, ["commit", "-q", "-m", "x"]);
    const tree = await materialiseRev(repo, head(repo));
    try {
      const has = (rel) => fs.existsSync(path.join(tree.dir, rel));
      assert.ok(has("src/app.ts") && has("vendor/keep.ts") && has("small.bin"));
      assert.ok(!has("node_modules"), "never-walked folders are skipped");
      assert.ok(!has("link.ts"), "symlinks are skipped");
      assert.ok(!has("sub"), "submodules are skipped");
      assert.equal(fs.statSync(path.join(tree.dir, "video.bin")).size, 3 * 1024 * 1024, "the true size");
      assert.equal(fs.lstatSync(path.join(tree.dir, "small.bin")).size, 1024);
      assert.deepEqual({ ...tree.stats }, { files: 4, sparse: 1, symlinks: 1, submodules: 1, skipped: 1, failed: 0 });
    } finally {
      tree.cleanup();
    }
    assert.deepEqual(leftovers(), []);
  });

  test("a path that climbs out of the folder is never written", async () => {
    const repo = bytesRepo();
    write(repo, "ok.ts", "export {};\n");
    const oid = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: repo, input: "pwned\n", encoding: "utf8", env: gitEnv() }).trim();
    git(repo, ["add", "-A"]);
    const okTree = git(repo, ["write-tree"]);
    // a hand-made tree holding "..", ".git" and "ok.ts": git porcelain refuses these, git plumbing may not
    let evil;
    try {
      evil = execFileSync("git", ["mktree", "--missing"], {
        cwd: repo,
        input: `100644 blob ${oid}\t..\n100644 blob ${oid}\t.git\n040000 tree ${okTree}\tsub\n`,
        encoding: "utf8",
        env: gitEnv(),
      }).trim();
    } catch {
      return; // this git will not even build such a tree: nothing to guard against
    }
    const sha = execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit-tree", evil, "-m", "evil"], { cwd: repo, encoding: "utf8", env: gitEnv() }).trim();
    const tree = await materialiseRev(repo, sha);
    try {
      assert.ok(fs.existsSync(path.join(tree.dir, "sub", "ok.ts")));
      assert.ok(!fs.existsSync(path.join(path.dirname(tree.dir), "pwned")));
      assert.ok(!fs.existsSync(path.join(tree.dir, ".git")));
      assert.deepEqual(fs.readdirSync(path.dirname(tree.dir)), [path.basename(tree.dir)]);
      assert.equal(tree.stats.skipped, 2);
    } finally {
      tree.cleanup();
    }
  });

  test("a commit id that is not a full hash is refused, and a failed run leaves no folder behind", async () => {
    const repo = bytesRepo();
    write(repo, "a.ts", "export {};\n");
    commitAll(repo, "a", DAY1);
    await assert.rejects(() => materialiseRev(repo, "HEAD"), /full commit id/);
    await assert.rejects(() => materialiseRev(repo, "--output=x"), /full commit id/);
    await assert.rejects(() => materialiseRev(repo, "0".repeat(40)), /./);
    assert.deepEqual(leftovers(), []);
  });

  test("resolveSince: the keywords, files, revs and dates; errors say what to do", () => {
    const repo = bytesRepo();
    write(repo, "a.ts", "export {};\n");
    const sha = commitAll(repo, "a", DAY5);
    const file = path.join(root, "bookmark.json");
    fs.writeFileSync(file, "{}");
    assert.deepEqual(resolveSince(repo, "empty"), { kind: "empty" });
    assert.deepEqual(resolveSince(repo, "NONE"), { kind: "empty" });
    assert.deepEqual(resolveSince(repo, file), { kind: "file", file });
    const head_ = resolveSince(repo, "HEAD");
    assert.equal(head_.kind, "commit");
    assert.equal(head_.sha, sha);
    assert.equal(head_.short, sha.slice(0, 7));
    assert.equal(head_.date, "2026-10-05");
    assert.equal(head_.isHead, true);
    assert.equal(resolveSince(repo, sha.slice(0, 10)).sha, sha);
    assert.deepEqual(resolveSince(repo, "2026-12-01").byDate, "2026-12-01");
    assert.ok(resolveSince(repo, "").usage && resolveSince(repo, "-x").usage && resolveSince(repo, "a\0b").usage);
    assert.match(resolveSince(repo, "nope").error, /can't find that saved version/);
    assert.match(resolveSince(path.join(root, "nowhere"), "HEAD").error, /needs git history or an earlier facts file/);
  });

  test("a SIGINT while the old version is unpacked removes the temporary folder", { skip: process.platform === "win32" && "no POSIX signals" }, async () => {
    const repo = bytesRepo();
    write(repo, "a.ts", "export {};\n");
    commitAll(repo, "a", DAY1);
    const script = `
      import { materialiseRev } from ${JSON.stringify(new URL("../lib/gitrev.mjs", import.meta.url).href)};
      const tree = await materialiseRev(${JSON.stringify(repo)}, ${JSON.stringify(head(repo))});
      console.log(tree.dir);
      setInterval(() => {}, 1000);
    `;
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], { env: { ...process.env, TMPDIR: priv }, stdio: ["ignore", "pipe", "pipe"] });
    const dir = await new Promise((resolve, reject) => {
      let out = "";
      child.stdout.on("data", (d) => {
        out += d;
        if (out.includes("\n")) resolve(out.trim());
      });
      child.on("error", reject);
      child.on("exit", () => reject(new Error("the child ended early")));
    });
    assert.ok(fs.existsSync(path.join(dir, "a.ts")), "the folder exists while the child is running");
    child.removeAllListeners("exit");
    const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
    child.kill("SIGINT");
    const { code } = await exited;
    assert.equal(code, 130);
    assert.ok(!fs.existsSync(dir), "the folder is gone");
    assert.deepEqual(leftovers(), []);
  });
});

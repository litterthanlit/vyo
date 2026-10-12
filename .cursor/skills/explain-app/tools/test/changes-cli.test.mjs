// Tests for tools/lib/changes-cli.mjs (the `diff` and `changes` commands) and tools/lib/gitrev.mjs.
// Run: node --test tools/test/changes-cli.test.mjs
// `diff` runs on facts scanned from copies of the recipe fixture; `changes` runs on throwaway git repos.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { diffMain } from "../lib/changes-cli.mjs";
import { factsHash, stableStringify } from "../lib/hash.mjs";
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

describe("diff", () => {
  let tmp;
  let beforeFile;
  let afterFile;

  before(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "changes-cli-"));
    const dirs = ["before", "after"].map((side) => {
      const dir = path.join(tmp, side, "pantry");
      fs.cpSync(path.join(FIX, "recipe"), dir, { recursive: true });
      return dir;
    });
    // the "after" copy: a new screen, an orphan Twilio file, an AI import in the Plan screen, one saved record gone
    const put = (rel, text) => {
      fs.mkdirSync(path.dirname(path.join(dirs[1], rel)), { recursive: true });
      fs.writeFileSync(path.join(dirs[1], rel), text);
    };
    put("app/(app)/billing/page.tsx", "export default function Billing() {\n  return <section>Billing</section>;\n}\n");
    put("lib/notify.ts", 'import twilio from "twilio";\n\nexport const sms = twilio("sid", "token");\n');
    put("app/(app)/plan/page.tsx", `import { suggestRecipes } from "@/lib/ai/suggest";\n${read(path.join(dirs[1], "app/(app)/plan/page.tsx"))}`);
    put("prisma/schema.prisma", read(path.join(dirs[1], "prisma/schema.prisma")).replace(/model Ingredient \{[^}]*\}\n\n/, ""));
    beforeFile = path.join(tmp, "before.json");
    afterFile = path.join(tmp, "after.json");
    fs.writeFileSync(beforeFile, stableStringify(await scanRepo(dirs[0], { useGit: false }), 1));
    fs.writeFileSync(afterFile, stableStringify(await scanRepo(dirs[1], { useGit: false }), 1));
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

#!/usr/bin/env node
// Vyo: repo -> facts.json -> poster spec -> poster (HTML, PNG, PDF), checked.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { stableStringify, factsHash } from "./lib/hash.mjs";
import { scanRepoDetailed } from "./lib/scan/index.mjs";
import { showFacts } from "./lib/scan/show.mjs";
import { SHAPES } from "./lib/shapes/index.mjs";
import { scaffoldSpec, LIMITS } from "./lib/spec.mjs";
import { buildPage, renderPage, PAPERS } from "./lib/render.mjs";
import { runChecks } from "./lib/check.mjs";

const USAGE = `Usage:
  vyo scan    <repo-dir> --out <dir>/<repo>-facts.json
  vyo show    <facts.json>
  vyo shapes
  vyo compose <facts.json> --shape <id> [--theme light|dark] [--repo <repo-dir>] [--out <spec.json>] [--force]
  vyo render  <spec.json> [--facts <facts.json>] [--out <dir>] [--no-png] [--no-pdf] [--paper ${PAPERS.join("|")}]
  vyo check   <spec.json> [--facts <facts.json>]

Exit codes: 0 ok (warnings start with "! "), 1 a rule failed (lines start with "✗ "), 2 usage.`;

const err = (s) => process.stderr.write(s + "\n");
const warn = (s) => err("! " + s);
const fail = (s) => err("✗ " + s);

class Usage extends Error {}
class Failure extends Error {}

function args(argv, options, count) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options, allowPositionals: true });
  } catch (e) {
    throw new Usage(e.message);
  }
  if (parsed.positionals.length !== count) throw new Usage(`expected ${count} argument${count === 1 ? "" : "s"}, got ${parsed.positionals.length}`);
  return { pos: parsed.positionals, opt: parsed.values };
}

function readJson(file, what) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new Failure(`cannot read ${file}: ${e.code || e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Failure(`${file} is not valid JSON (${what}): ${e.message}`);
  }
}

function readFacts(file) {
  const facts = readJson(file, "facts.json");
  if (!facts || facts.version !== 1 || !Array.isArray(facts.facts) || typeof facts.files !== "object") {
    throw new Failure(`${file} is not a facts.json (expected version 1 with facts and files); run vyo scan`);
  }
  if (facts.hash !== factsHash(facts)) warn(`${file}: hash does not match its content; was it edited by hand?`);
  return facts;
}

const isInside = (child, parent) => {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};
const realOrResolved = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
};

function cmdScan(argv) {
  const { pos, opt } = args(argv, { out: { type: "string" } }, 1);
  if (!opt.out) throw new Usage("scan needs --out <facts.json>");
  const dir = path.resolve(pos[0]);
  if (!fs.existsSync(dir)) throw new Failure(`${pos[0]} does not exist`);
  if (!fs.statSync(dir).isDirectory()) throw new Failure(`${pos[0]} is not a directory`);
  const out = opt.out;
  if (out !== "-") {
    const outAbs = path.resolve(out);
    const outReal = path.join(realOrResolved(path.dirname(outAbs)), path.basename(outAbs));
    const inVyo = path.dirname(outAbs) === path.join(dir, "vyo") || path.dirname(outReal) === path.join(realOrResolved(dir), "vyo");
    if (!inVyo && (isInside(outAbs, dir) || isInside(outReal, realOrResolved(dir)))) {
      throw new Failure(`--out ${out} is inside the scanned repo; the scanner never writes there, except ${pos[0]}/vyo/. Pick a path outside ${pos[0]}`);
    }
  }
  const { facts, diag } = scanRepoDetailed(dir);
  const text = stableStringify(facts, 1);
  if (out === "-") process.stdout.write(text);
  else {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, text);
  }
  const n = (k) => facts.facts.filter((f) => f.kind === k).length;
  const pl = (k, one, many) => `${n(k)} ${n(k) === 1 ? one : many}`;
  const loc = Object.values(facts.files).reduce((s, f) => s + (f.gen ? 0 : f.loc), 0);
  const summary =
    `Scanned ${facts.repo.name}: ${pl("screen", "screen", "screens")}, ${pl("endpoint", "endpoint", "endpoints")}, ${pl("table", "table", "tables")}, ` +
    `${pl("service", "service", "services")}, ${n("ai")} AI, ${pl("job", "job", "jobs")}, ${pl("area", "area", "areas")}, ` +
    `${Object.keys(facts.files).length} files, ${loc} lines${out === "-" ? "" : ` → ${out}`} (hash ${facts.hash})`;
  (out === "-" ? process.stderr : process.stdout).write(summary + "\n");
  if (facts.empty) warn("No screens, endpoints, tables, services, AI or jobs found: nothing to count.");
  const s = diag.skipped;
  if (s.big || s.binary || s.unreadable || s.capped) warn(`Skipped files: ${s.big} over 512 KB, ${s.binary} binary, ${s.unreadable} unreadable, ${s.capped} past the 20000-file cap`);
  if (diag.parseFailures.length) warn(`Could not parse ${diag.parseFailures.length} config file(s): ${diag.parseFailures.slice(0, 3).join(", ")}`);
  if (diag.errors.length) warn(`${diag.errors.length} detector problem(s), results may be partial: ${diag.errors.slice(0, 3).join(" | ")}`);
  return 0;
}

function cmdShow(argv) {
  const { pos } = args(argv, {}, 1);
  process.stdout.write(showFacts(readFacts(pos[0])));
  return 0;
}

function describeSlot(s) {
  if (s.kind === "words") return `words, ${s.min} to ${s.max}, each at most ${s.each ?? LIMITS.word} characters${s.letters ? ", letters only" : ""}`;
  return `${s.kind}, at most ${s.max} characters`;
}

function cmdShapes(argv) {
  args(argv, {}, 0);
  const out = [];
  for (const shape of Object.values(SHAPES)) {
    out.push(`${shape.id}`, `  fits: ${shape.fits}`, `  themes: ${Object.keys(shape.themes).join(", ")}`, `  notes: ${shape.notes}`, `  hot: ${shape.hotRule}`, "  slots:");
    for (const [k, s] of Object.entries(shape.slots)) out.push(`    ${k.padEnd(12)} ${describeSlot(s)}`, `    ${"".padEnd(12)} ${s.prompt}`);
    out.push("");
  }
  out.push(`Every shape also takes headline (at most ${LIMITS.headline} characters), hot, notes (title at most ${LIMITS.noteTitle}, text at most ${LIMITS.noteText}) and notBuilt (0 to ${LIMITS.notBuilt} items).`);
  process.stdout.write(out.join("\n") + "\n");
  return 0;
}

function git(dir, format) {
  try {
    return execFileSync("git", ["-C", dir, "log", "-1", `--format=${format}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
  } catch {
    return undefined;
  }
}

function cmdCompose(argv) {
  const { pos, opt } = args(argv, { shape: { type: "string" }, theme: { type: "string" }, repo: { type: "string" }, out: { type: "string" }, force: { type: "boolean" } }, 1);
  const shape = SHAPES[opt.shape];
  if (!opt.shape) throw new Usage(`compose needs --shape <id>; one of ${Object.keys(SHAPES).join(", ")}`);
  if (!shape) throw new Usage(`--shape ${opt.shape} is not a shape; one of ${Object.keys(SHAPES).join(", ")}`);
  const themes = Object.keys(shape.themes);
  const theme = opt.theme ?? themes[0];
  if (!themes.includes(theme)) throw new Usage(`--theme ${theme} is not a theme of ${shape.id}; use ${themes.join(" or ")}`);
  const facts = readFacts(pos[0]);
  let commit;
  let date;
  if (opt.repo) {
    commit = git(opt.repo, "%h");
    date = git(opt.repo, "%cs");
    if (!commit) warn(`${opt.repo} has no git history; the footer will show no commit`);
  }
  date ??= new Date().toISOString().slice(0, 10);
  const out = opt.out ?? path.join(path.dirname(pos[0]), `${facts.repo.name}-poster.json`);
  if (fs.existsSync(out) && !opt.force) throw new Failure(`${out} exists; it may hold your words. Pass --force to replace it with a fresh scaffold`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(scaffoldSpec(facts, shape, { theme, commit, date }), null, 2) + "\n");
  process.stdout.write(`Wrote ${out}: the scaffold for the ${shape.id} shape. Replace every "…" value, then run vyo render ${out}\n`);
  return 0;
}

function report(found) {
  for (const f of found) (f.level === "fail" ? fail : warn)(`${f.id}: ${f.message}`);
  return found.some((f) => f.level === "fail");
}

async function poster(specFile, opt, outDir, files) {
  const spec = readJson(specFile, "poster spec");
  const repo = spec && spec.product && typeof spec.product.repo === "string" ? spec.product.repo : null;
  const factsFile = opt.facts ?? (repo ? path.join(path.dirname(specFile), `${repo}-facts.json`) : null);
  if (!factsFile) throw new Failure("product.repo is missing, so the facts file cannot be found; pass --facts");
  const facts = readFacts(factsFile);
  const input = { spec, facts, shapes: SHAPES, shape: SHAPES[spec.shape] };
  if (report(runChecks("spec", input))) return 1;
  const base = path.join(outDir, `${repo}-poster`);
  let html;
  try {
    html = buildPage(spec, facts, input.shape);
  } catch (e) {
    throw new Failure(e.message);
  }
  const page = await renderPage({ html, base, ...files });
  const failed = report(runChecks("page", { ...input, page }));
  return failed ? 1 : 0;
}

async function cmdRender(argv) {
  const { pos, opt } = args(
    argv,
    { facts: { type: "string" }, out: { type: "string" }, "no-png": { type: "boolean" }, "no-pdf": { type: "boolean" }, paper: { type: "string", default: "fit" } },
    1,
  );
  if (!PAPERS.includes(opt.paper)) throw new Usage(`--paper must be ${PAPERS.join(", ")}`);
  const outDir = opt.out ?? path.dirname(pos[0]);
  const code = await poster(pos[0], opt, outDir, { png: !opt["no-png"], pdf: !opt["no-pdf"], paper: opt.paper });
  const repo = readJson(pos[0], "poster spec").product.repo;
  const made = ["html", ...(opt["no-png"] ? [] : ["png"]), ...(opt["no-pdf"] ? [] : ["pdf"])].map((x) => path.join(outDir, `${repo}-poster.${x}`)).filter(fs.existsSync);
  if (made.length) process.stdout.write(`${code ? "Wrote, with failures" : "Wrote"}: ${made.join(", ")}\n`);
  if (!code) process.stdout.write("PASS\n");
  return code;
}

async function cmdCheck(argv) {
  const { pos, opt } = args(argv, { facts: { type: "string" } }, 1);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vyo-check-"));
  try {
    const code = await poster(pos[0], opt, tmp, { png: false, pdf: false });
    if (!code) process.stdout.write("PASS\n");
    return code;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const COMMANDS = { scan: cmdScan, show: cmdShow, shapes: cmdShapes, compose: cmdCompose, render: cmdRender, check: cmdCheck };

export async function main(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === "help" || cmd === "-h" || cmd === "--help") {
    process.stdout.write(USAGE + "\n");
    return 0;
  }
  const run = COMMANDS[cmd];
  try {
    if (!run) throw new Usage(cmd ? `unknown command: ${cmd}` : "");
    return await run(rest);
  } catch (e) {
    if (e instanceof Usage) {
      if (e.message) err(e.message);
      err(USAGE);
      return 2;
    }
    if (e instanceof Failure) {
      fail(e.message);
      return 1;
    }
    throw e;
  }
}

const isMain = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      fail(e && e.stack ? e.stack : String(e));
      process.exit(1);
    },
  );
}

#!/usr/bin/env node
// explain-app page 3 scanner: repo -> facts.json (see CONTRACTS.md §1–§2).
//
//   node tools/scan.mjs scan  <repo-dir> --out <facts.json>
//   node tools/scan.mjs show  <facts.json>
//   node tools/scan.mjs draft <facts.json>
//   node tools/scan.mjs wire  <facts.json> --into <canvas.tsx>      (lib/wire.mjs)
//   node tools/scan.mjs why   <facts.json> --canvas <canvas.tsx> "<part A>" "<part B>"
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stableStringify, factsHash } from "./lib/hash.mjs";
import { scanRepoDetailed } from "./lib/scan/index.mjs";
import { draftParts } from "./lib/scan/draft.mjs";
import { showFacts } from "./lib/scan/show.mjs";
import { matchGlob, selectIds, globToRegExp } from "./lib/scan/glob.mjs";

export { draftParts, showFacts, matchGlob, selectIds, globToRegExp };

/** Scan a repo directory into a FactsFile. Never writes anything. */
export async function scanRepo(dir) {
  return scanRepoDetailed(dir).facts;
}

const USAGE = `Usage:
  node tools/scan.mjs scan  <repo-dir> --out <facts.json>   scan a repo, write facts.json (use --out - for stdout)
  node tools/scan.mjs show  <facts.json>                    summary with fact ids, for writing PARTS
  node tools/scan.mjs draft <facts.json>                    suggested PARTS array (JSON)
  node tools/scan.mjs wire  <facts.json> --into <canvas.tsx>  rewrite the WIRING block
  node tools/scan.mjs why   <facts.json> --canvas <canvas.tsx> "<part A>" "<part B>"

Exit codes: 0 ok, 1 rule error, 2 usage.`;

const err = (s) => process.stderr.write(s + "\n");
const warn = (s) => err("! " + s);
const fail = (s) => err("✗ " + s);

function usage(msg) {
  if (msg) err(msg);
  err(USAGE);
  return 2;
}

function readFacts(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    fail(`Cannot read ${file}: ${e.code || e.message}`);
    return null;
  }
  let facts;
  try {
    facts = JSON.parse(text);
  } catch (e) {
    fail(`${file} is not valid JSON: ${e.message}`);
    return null;
  }
  if (!facts || facts.version !== 1 || !Array.isArray(facts.facts) || typeof facts.files !== "object") {
    fail(`${file} is not a facts.json (expected version 1 with facts and files)`);
    return null;
  }
  if (facts.hash !== factsHash(facts)) warn(`${file}: hash does not match its content; was it edited by hand?`);
  return facts;
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function realOrResolved(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function parseOut(args) {
  const rest = [];
  let out = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--out") {
      out = args[++i];
      if (out == null) return { error: "--out needs a path" };
    } else if (a.startsWith("--out=")) out = a.slice(6);
    else if (a.startsWith("--") && a !== "-") return { error: `Unknown option ${a}` };
    else rest.push(a);
  }
  return { rest, out };
}

function cmdScan(args) {
  const { rest, out, error } = parseOut(args);
  if (error) return usage(error);
  if (rest.length !== 1) return usage("scan needs exactly one <repo-dir>");
  if (!out) return usage("scan needs --out <facts.json>");
  const dir = path.resolve(rest[0]);
  let st;
  try {
    st = fs.statSync(dir);
  } catch {
    fail(`${rest[0]} does not exist`);
    return 1;
  }
  if (!st.isDirectory()) {
    fail(`${rest[0]} is not a directory`);
    return 1;
  }
  if (out !== "-") {
    const outAbs = path.resolve(out);
    const outDirReal = realOrResolved(path.dirname(outAbs));
    if (isInside(outAbs, dir) || isInside(path.join(outDirReal, path.basename(outAbs)), realOrResolved(dir))) {
      fail(`--out ${out} is inside the scanned repo; the scanner never writes there. Pick a path outside ${rest[0]}`);
      return 1;
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
  const loc = Object.values(facts.files).reduce((s, f) => s + (f.gen ? 0 : f.loc), 0);
  const pl = (k, one, many) => `${n(k)} ${n(k) === 1 ? one : many}`;
  const summary =
    `Scanned ${facts.repo.name}: ${pl("screen", "screen", "screens")}, ${pl("endpoint", "endpoint", "endpoints")}, ${pl("table", "table", "tables")}, ` +
    `${pl("service", "service", "services")}, ${n("ai")} AI, ${pl("job", "job", "jobs")}, ${pl("area", "area", "areas")} · ` +
    `${Object.keys(facts.files).length} files, ${loc} lines` +
    (out === "-" ? "" : ` → ${out}`) +
    ` (hash ${facts.hash})`;
  (out === "-" ? process.stderr : process.stdout).write(summary + "\n");
  if (facts.empty) warn("No screens, endpoints, tables, services, AI or jobs found: nothing to draw.");
  const s = diag.skipped;
  if (s.big || s.binary || s.unreadable || s.capped) {
    warn(`Skipped files: ${s.big} over 512 KB, ${s.binary} binary, ${s.unreadable} unreadable, ${s.capped} past the 20000-file cap`);
  }
  if (diag.parseFailures.length) warn(`Could not parse ${diag.parseFailures.length} config file(s): ${diag.parseFailures.slice(0, 3).join(", ")}`);
  const edges = facts.imports.length;
  if (diag.unresolvedTotal >= 20 && diag.unresolvedTotal > 0.1 * (edges + diag.unresolvedTotal)) {
    warn(`${diag.unresolvedTotal} imports did not resolve (links may be missing). Most common: ${diag.unresolvedTop.slice(0, 3).map(([k, n]) => `${k} x${n}`).join(", ")}`);
  }
  if (diag.errors.length) warn(`${diag.errors.length} detector problem(s), results may be partial: ${diag.errors.slice(0, 3).join(" | ")}`);
  return 0;
}

function cmdShow(args) {
  if (args.length !== 1) return usage("show needs exactly one <facts.json>");
  const facts = readFacts(args[0]);
  if (!facts) return 1;
  process.stdout.write(showFacts(facts));
  return 0;
}

function cmdDraft(args) {
  if (args.length !== 1) return usage("draft needs exactly one <facts.json>");
  const facts = readFacts(args[0]);
  if (!facts) return 1;
  const parts = draftParts(facts);
  if (parts.length < 2) warn(`Only ${parts.length} part(s) could be drafted: use 2 to 9. Add parts by hand from the \`show\` output.`);
  const body = parts.map((p) => "  " + JSON.stringify(p)).join(",\n");
  process.stdout.write(parts.length ? `[\n${body}\n]\n` : "[]\n");
  return 0;
}

async function forward(name, args) {
  let mod;
  try {
    mod = await import(new URL("./lib/wire.mjs", import.meta.url).href);
  } catch (e) {
    if (e && e.code === "ERR_MODULE_NOT_FOUND" && /wire\.mjs/.test(String(e.message))) {
      fail(`tools/lib/wire.mjs is not installed, so \`${name}\` is unavailable.`);
    } else {
      fail(`Could not load tools/lib/wire.mjs: ${e && e.message ? e.message : e}`);
    }
    return 2;
  }
  const fn = name === "wire" ? mod.wireMain : mod.whyMain;
  if (typeof fn !== "function") {
    fail(`tools/lib/wire.mjs does not export ${name === "wire" ? "wireMain" : "whyMain"}`);
    return 2;
  }
  const code = await fn(args);
  return Number.isInteger(code) ? code : 0;
}

export async function main(argv) {
  const [cmd, ...args] = argv;
  switch (cmd) {
    case "scan":
      return cmdScan(args);
    case "show":
      return cmdShow(args);
    case "draft":
      return cmdDraft(args);
    case "wire":
    case "why":
      return forward(cmd, args);
    case undefined:
    case "-h":
    case "--help":
    case "help":
      process.stdout.write(USAGE + "\n");
      return cmd === undefined ? 2 : 0;
    default:
      return usage(`Unknown command: ${cmd}`);
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

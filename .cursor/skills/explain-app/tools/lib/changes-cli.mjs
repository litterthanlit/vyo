// The `diff` and `changes` commands (CONTRACTS.md §1 and §7): two scans in, a plain-English briefing out.
//
//   node tools/scan.mjs diff    <before.json> <after.json> [--out changes.json] [--json] [--canvas <canvas.tsx>] [--receipts]
//
// Both return an exit code: 0 ok (whether or not anything changed), 1 an error with the input, 2 usage.
// Progress and warnings go to stderr ("! " and "✗ " lines, as scan and wire print them); stdout holds only the
// briefing (or the Changes JSON with --json), so it can be relayed as it is.
import fs from "node:fs";
import path from "node:path";
import { stableStringify } from "./hash.mjs";
import { THRESHOLDS, diffFacts } from "./changes.mjs";
import { buildBriefing, renderText } from "./briefing.mjs";
import { readBlocks } from "./wire.mjs";
import { readFacts } from "./scan/io.mjs";

const DIFF_USAGE =
  "usage: node tools/scan.mjs diff <before.json> <after.json> [--out changes.json] [--json] [--canvas <canvas.tsx>] [--receipts]";

const defaultIo = () => ({
  out: (s) => process.stdout.write(`${s}\n`),
  write: (s) => process.stdout.write(s),
  err: (s) => process.stderr.write(`${s}\n`),
});

// Tiny flag parser: `--name value` or `--name=value` for value flags, `--name` for switches; the rest is positional.
function parseArgs(args, valueFlags, switches) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") return { help: true, positional, flags };
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    const name = eq < 0 ? a.slice(2) : a.slice(2, eq);
    if (switches.includes(name)) {
      if (eq >= 0) return { error: `--${name} takes no value` };
      flags[name] = true;
    } else if (valueFlags.includes(name)) {
      const value = eq < 0 ? args[++i] : a.slice(eq + 1);
      if (value === undefined || value === "") return { error: `--${name} needs a value` };
      flags[name] = value;
    } else return { error: `unknown option --${name}` };
  }
  return { positional, flags };
}

/** A canvas's PARTS (and the facts hash its WIRING was drawn from), so the briefing can say if the poster is stale. */
function loadCanvas(file, io) {
  let source;
  try {
    source = fs.readFileSync(path.resolve(file), "utf8");
  } catch (e) {
    io.err(`✗ cannot read ${file}: ${e.code ?? e.message}`);
    return null;
  }
  let blocks;
  try {
    blocks = readBlocks(source);
  } catch (e) {
    io.err(`✗ ${e.message}`);
    return null;
  }
  if (!blocks.parts) {
    io.err(`✗ ${file} has no // PARTS:BEGIN … // PARTS:END block`);
    return null;
  }
  return { parts: blocks.parts, wiringFactsHash: typeof blocks.wiring?.facts === "string" ? blocks.wiring.facts : undefined };
}

function writeFile(file, text, io) {
  try {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(file, text);
    return true;
  } catch (e) {
    io.err(`✗ cannot write ${file}: ${e.code ?? e.message}`);
    return false;
  }
}

// A scan this large hit the scanner's file cap: its sizes are partial (Changes then makes no size claims).
function warnCapped(io, which, facts) {
  const n = Object.keys(facts.files).length;
  if (n >= THRESHOLDS.capped) io.err(`! ${which} has ${n.toLocaleString("en-US")} files, close to the scanner's 20,000-file limit, so some of your project was not read and sizes may be too low`);
}

/**
 * Two facts files in, one briefing out: Changes → text (or JSON) on stdout, plus the files `flags` ask for.
 * `labels`/`notes` are what the caller knows about the two sides (see diffFacts).
 */
function deliver(before, after, { flags, io, labels, notes, canvas }) {
  let changes;
  try {
    changes = diffFacts(before, after, { labels, notes, parts: canvas?.parts, wiringFactsHash: canvas?.wiringFactsHash });
  } catch (e) {
    io.err(`✗ ${e.message}`);
    return 1;
  }
  const json = stableStringify(changes, 1);
  if (flags.out) {
    if (!writeFile(flags.out, json, io)) return 1;
    io.err(`→ ${flags.out}`);
  }
  io.write(flags.json ? `${json}\n` : renderText(buildBriefing(changes, { receipts: Boolean(flags.receipts) })));
  return 0;
}

const VALUE_FLAGS = ["out", "canvas"];
const SWITCHES = ["json", "receipts"];

/** `diff <before.json> <after.json> [flags]`: what changed between two scans. Exit 0 ok, 1 error, 2 usage. */
export async function diffMain(argv, io = defaultIo()) {
  const parsed = parseArgs(argv, VALUE_FLAGS, SWITCHES);
  if (parsed.help) {
    io.out(DIFF_USAGE);
    return 0;
  }
  if (parsed.error || parsed.positional.length !== 2) {
    if (parsed.error) io.err(`✗ ${parsed.error}`);
    io.err(DIFF_USAGE);
    return 2;
  }
  const { flags } = parsed;
  const [beforeFile, afterFile] = parsed.positional;
  const before = readFacts(beforeFile, io);
  if (!before) return 1;
  const after = readFacts(afterFile, io);
  if (!after) return 1;
  warnCapped(io, beforeFile, before);
  warnCapped(io, afterFile, after);
  let canvas;
  if (flags.canvas) {
    canvas = loadCanvas(flags.canvas, io);
    if (!canvas) return 1;
  }
  return deliver(before, after, { flags, io, canvas });
}

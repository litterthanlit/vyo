// The `diff` and `changes` commands (CONTRACTS.md §1 and §7): two scans in, a plain-English briefing out.
//
//   node tools/scan.mjs diff    <before.json> <after.json> [--out changes.json] [--json] [--canvas <canvas.tsx>] [--html <file>] [--receipts]
//   node tools/scan.mjs changes <repo> --since <empty|facts.json|rev|date> [same flags] [--save-facts <file>]
//
// `changes` scans the repo as it is on disk now (uncommitted and untracked work included) and compares it with
// "since": nothing, an earlier facts file, a saved version (git commit) or the last version before a date.
// Both return an exit code: 0 ok (whether or not anything changed), 1 an error with the input, 2 usage.
// Progress and warnings go to stderr ("! " and "✗ " lines, as scan and wire print them); stdout holds only the
// briefing (or the Changes JSON with --json), so it can be relayed as it is.
import fs from "node:fs";
import path from "node:path";
import { stableStringify } from "./hash.mjs";
import { THRESHOLDS, diffFacts } from "./changes.mjs";
import { buildBriefing, plainName, renderText } from "./briefing.mjs";
import { readBlocks } from "./wire.mjs";
import { outputInsideRepo, readFacts } from "./scan/io.mjs";
import { scanRepoDetailed } from "./scan/index.mjs";
import { sentenceCase } from "./scan/names.mjs";
import { emptyTree, materialiseRev, resolveSince } from "./gitrev.mjs";

const DIFF_USAGE =
  "usage: node tools/scan.mjs diff <before.json> <after.json> [--out changes.json] [--json] [--canvas <canvas.tsx>] [--html <file>] [--receipts]";

const CHANGES_USAGE =
  "usage: node tools/scan.mjs changes <repo> --since <empty|facts.json|rev|date> [--out changes.json] [--json] [--canvas <canvas.tsx>] [--html <file>] [--receipts] [--save-facts <file>]";

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
async function deliver(before, after, { flags, io, labels, notes, canvas }) {
  let changes;
  try {
    changes = diffFacts(before, after, { labels, notes, parts: canvas?.parts, wiringFactsHash: canvas?.wiringFactsHash });
  } catch (e) {
    io.err(`✗ ${e.message}`);
    return 1;
  }
  const json = stableStringify(changes, 1);
  const receipts = Boolean(flags.receipts);
  const doc = buildBriefing(changes, { receipts });
  if (flags.out) {
    if (!writeFile(flags.out, json, io)) return 1;
    io.err(`→ ${flags.out}`);
  }
  if (flags.html) {
    // Loaded on demand: the text and JSON outputs need nothing from the page renderer.
    const { renderHtml } = await import("./briefing-html.mjs");
    const app = changes.after.repo ? plainName(sentenceCase(changes.after.repo)) : undefined;
    const page = renderHtml(doc, { receipts, app, hashes: { before: changes.before.hash, after: changes.after.hash } });
    if (!writeFile(flags.html, page, io)) return 1;
    io.err(`→ ${flags.html}`);
  }
  io.write(flags.json ? `${json}\n` : renderText(doc));
  return 0;
}

const VALUE_FLAGS = ["out", "canvas", "html"];
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

/* ─────────────────────────── changes ─────────────────────────── */

const NOW = "your files right now";

// How the lede names the older side: "Since your last saved version (a1b2c3d, 2026-10-07) · compared with your files right now."
const versionLabel = (c) => `${c.isHead ? "your last saved version" : "your saved version"} (${c.short}${c.date ? `, ${c.date}` : ""})`;

// Problems reading one side that a person should hear about (stderr only; the briefing has its own notes).
function warnScan(io, which, diag) {
  const n = diag.skipped.unreadable;
  if (n) io.err(`! ${n} file${n === 1 ? "" : "s"} in ${which} could not be read, so they are left out`);
  if (diag.errors.length) io.err(`! ${diag.errors.length} problem${diag.errors.length === 1 ? "" : "s"} reading ${which}, so the result may be partial: ${diag.errors.slice(0, 2).join(" | ")}`);
}

/** The older side as facts: { facts, label, notes } or null after a ✗ line. Its temporary folder is gone when this returns. */
async function readBaseline(since, dir, io) {
  if (since.kind === "file") {
    const facts = readFacts(since.file, io);
    return facts ? { facts, label: `your earlier scan (${path.basename(since.file)})`, notes: [] } : null;
  }
  const notes = since.note ? [since.note] : [];
  if (since.kind === "empty") {
    io.err("Starting from an empty project…");
    const tree = emptyTree(dir);
    try {
      return { facts: scanRepoDetailed(tree.dir, { useGit: false }).facts, label: "an empty project", notes };
    } finally {
      tree.cleanup();
    }
  }
  const label = versionLabel(since);
  io.err(`Reading ${label}…`);
  let tree;
  try {
    tree = await materialiseRev(dir, since.sha);
  } catch (e) {
    io.err(`✗ Could not read ${label} from git: ${e.message}`);
    return null;
  }
  try {
    for (const n of tree.notes) io.err(`! ${n}`);
    const { facts, diag } = scanRepoDetailed(tree.dir, { useGit: false });
    warnScan(io, label, diag);
    return { facts, label, notes };
  } finally {
    tree.cleanup();
  }
}

/** `changes <repo> --since <X> [flags]`: what changed in a repo since a saved version, a date or an earlier scan. Exit 0 ok, 1 error, 2 usage. */
export async function changesMain(argv, io = defaultIo()) {
  const parsed = parseArgs(argv, [...VALUE_FLAGS, "since", "save-facts"], SWITCHES);
  if (parsed.help) {
    io.out(CHANGES_USAGE);
    return 0;
  }
  if (parsed.error || parsed.positional.length !== 1 || !parsed.flags.since) {
    io.err(`✗ ${parsed.error ?? (parsed.positional.length === 1 ? "changes needs --since <empty|facts.json|rev|date>" : "changes needs exactly one <repo>")}`);
    io.err(CHANGES_USAGE);
    return 2;
  }
  const { flags } = parsed;
  const shown = parsed.positional[0];
  const dir = path.resolve(shown);
  let st;
  try {
    st = fs.statSync(dir);
  } catch {
    io.err(`✗ ${shown} does not exist`);
    return 1;
  }
  if (!st.isDirectory()) {
    io.err(`✗ ${shown} is not a directory`);
    return 1;
  }
  // Nothing is written inside the repo being read.
  for (const [flag, file] of [["--out", flags.out], ["--html", flags.html], ["--save-facts", flags["save-facts"]]]) {
    const inside = file && outputInsideRepo(file, dir, { flag, shown });
    if (inside) {
      io.err(`✗ ${inside}`);
      return 1;
    }
  }

  const since = resolveSince(dir, flags.since, { shown });
  if (since.error) {
    io.err(`✗ ${since.error}`);
    if (since.usage) io.err(CHANGES_USAGE);
    return since.usage ? 2 : 1;
  }
  let canvas;
  if (flags.canvas) {
    canvas = loadCanvas(flags.canvas, io);
    if (!canvas) return 1;
  }

  const baseline = await readBaseline(since, dir, io);
  if (!baseline) return 1;
  io.err(`Reading ${NOW}…`);
  const live = scanRepoDetailed(dir);
  warnScan(io, NOW, live.diag);
  warnCapped(io, baseline.label, baseline.facts);
  warnCapped(io, NOW, live.facts);

  const bookmark = flags["save-facts"];
  if (bookmark) {
    if (!writeFile(bookmark, stableStringify(live.facts, 1), io)) return 1;
    io.err(`→ ${bookmark} (a bookmark of ${NOW}: compare with it later using --since ${bookmark})`);
  }
  return deliver(baseline.facts, live.facts, { flags, io, canvas, labels: { before: baseline.label, after: NOW }, notes: baseline.notes });
}

// File-system edges of the CLI that must travel with scan.mjs (CONTRACTS §1–§2): reading a facts.json, and the
// rule that output is never written inside the scanned repo. Kept under lib/scan/ because the scan tests copy
// only scan.mjs, lib/hash.mjs and lib/scan/* to run the scanner on its own.
import fs from "node:fs";
import path from "node:path";
import { factsHash } from "../hash.mjs";

const defaultIo = () => ({ err: (s) => process.stderr.write(s + "\n") });

/**
 * Read and check a facts.json. Returns the parsed FactsFile (version 1), or null after printing a "✗ " line.
 * A hash that does not recompute is only a "! " warning here. `io.err(line)` receives each line.
 */
export function readFacts(file, io = defaultIo()) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    io.err(`✗ Cannot read ${file}: ${e.code || e.message}`);
    return null;
  }
  let facts;
  try {
    facts = JSON.parse(text);
  } catch (e) {
    io.err(`✗ ${file} is not valid JSON: ${e.message}`);
    return null;
  }
  if (!facts || facts.version !== 1 || !Array.isArray(facts.facts) || typeof facts.files !== "object") {
    io.err(`✗ ${file} is not a facts.json (expected version 1 with facts and files)`);
    return null;
  }
  if (facts.hash !== factsHash(facts)) io.err(`! ${file}: hash does not match its content; was it edited by hand?`);
  return facts;
}

/** True when `child` is `parent` or lies below it. Pure path arithmetic: both must be absolute. */
export function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** The real path when the path exists, else its resolved absolute form. */
export function realOrResolved(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

/**
 * The guard: nothing is written inside the scanned repo. `out` is a file the CLI is about to create.
 * Returns the message for a "✗ " line when it is inside `repoDir` (compared both as given and through
 * symlinks in its parent folder), else null. `flag` names the option in the message; `shown` is how the
 * repo was written on the command line (default: `repoDir`).
 */
export function outputInsideRepo(out, repoDir, { flag = "--out", shown = repoDir } = {}) {
  const dir = path.resolve(repoDir);
  const outAbs = path.resolve(out);
  const outDirReal = realOrResolved(path.dirname(outAbs));
  if (isInside(outAbs, dir) || isInside(path.join(outDirReal, path.basename(outAbs)), realOrResolved(dir))) {
    return `${flag} ${out} is inside the scanned repo; the scanner never writes there. Pick a path outside ${shown}`;
  }
  return null;
}

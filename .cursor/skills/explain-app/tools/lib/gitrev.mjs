// Reading an older version of a project out of git, for `changes --since <rev|date>` (CONTRACTS.md §1, §7).
//
//   resolveSince(repoDir, "HEAD~3")      → { kind: "commit", sha, short, date, isHead, byDate? }
//   resolveSince(repoDir, "2026-10-07")  → the last commit before that day, or { kind: "empty", note } when there is none
//   const tree = await materialiseRev(repoDir, sha);   // { dir, cleanup, notes, stats }
//   try { scanRepoDetailed(tree.dir, { useGit: false }) } finally { tree.cleanup() }
//
// Node built-ins and git only. Every git call is `execFileSync`/`spawn` with an argument list (no shell) and the
// flags and environment the scanner reads with (lib/scan/files.mjs: GIT_FLAGS, gitEnv), so nothing here writes
// into the repo or its .git: no worktree, no checkout, no index.
//
// The old tree is built with `git ls-tree` + one `git cat-file --batch`, not `git archive | tar`: archive honours
// `export-ignore` in .gitattributes (it would drop files that exist), and tar is not a given on Windows.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { GIT_FLAGS, gitEnv, gitOutput, inNeverWalkDir } from "./scan/files.mjs";

export const TEMP_PREFIX = "explain-app-";
export const SPARSE_OVER = 2 * 1024 * 1024; // a blob bigger than this becomes a sparse file of its true size

const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];

/* ─────────────────────────── --since <value> ─────────────────────────── */

const pad = (n) => String(n).padStart(2, "0");
const isoDay = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` === v; // 2026-02-31 is not a day
};
const ISO_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(:\d{2})?(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?$/;
const RELATIVE = /^(\d+) (second|minute|hour|day|week|month|year)s? ago$/i;
const WORDS = /^(now|today|yesterday|midnight|noon)$/i;

// git's date parser accepts nearly any text (a typo'd branch name becomes "now"), so only forms we mean are dates.
function dateArg(v) {
  if (isoDay(v)) return `${v} 00:00:00`; // a bare day means the start of that day, not "this time of day"
  const t = ISO_TIME.exec(v);
  if (t && isoDay(t[1]) && +t[2] < 24 && +t[3] < 60) return v;
  if (RELATIVE.test(v) || WORDS.test(v)) return v;
  return null;
}

const gitOrNull = (dir, args) => {
  try {
    return gitOutput(dir, args).trim();
  } catch {
    return null;
  }
};

const shortSha = (sha) => sha.slice(0, 7);
// The commit's own calendar day: "2026-10-07".
const commitDay = (repoDir, sha) => (gitOrNull(repoDir, ["log", "-1", "--format=%cI", sha]) ?? "").slice(0, 10);

/**
 * What `--since <value>` points at, in this order:
 *   "empty" | "none"            → { kind: "empty" }
 *   an existing file            → { kind: "file", file }            (read it as facts)
 *   a git rev (HEAD~3, a branch, a sha) → { kind: "commit", sha, short, date, isHead }
 *   a date (2026-10-07, "3 days ago")   → the last commit before it (+ byDate), or
 *                                         { kind: "empty", note: { code: "first-save-after-date", date? } } when the history starts later
 * or `{ error, usage? }`: `usage` marks a value that can never be right (a leading "-", a NUL); the rest are
 * problems with the repo (not git, not its top folder, no history).
 * `shown` is how the repo was written on the command line.
 */
export function resolveSince(repoDir, value, { shown = repoDir } = {}) {
  const v = String(value ?? "").trim();
  if (!v) return { error: "--since needs a value", usage: true };
  if (v.includes("\0") || v.startsWith("-")) return { error: `--since ${JSON.stringify(v)} is not a version, a date or a file`, usage: true };
  if (/^(empty|none)$/i.test(v)) return { kind: "empty" };
  try {
    if (fs.statSync(v).isFile()) return { kind: "file", file: path.resolve(v) };
  } catch {
    // not a file: a rev or a date
  }

  const top = gitOrNull(repoDir, ["rev-parse", "--show-toplevel"]);
  if (top === null || top === "") {
    return { error: `--since ${v} needs git history or an earlier facts file, and ${shown} is not inside a git project. Give --since a facts.json saved earlier with --save-facts, or --since empty.` };
  }
  let sameFolder = false;
  try {
    sameFolder = fs.realpathSync(top) === fs.realpathSync(repoDir);
  } catch {
    // fall through: not the same
  }
  if (!sameFolder) return { error: `${shown} is inside a git project but is not its top folder. Run this on the top folder instead: ${top}` };
  const shallow = gitOrNull(repoDir, ["rev-parse", "--is-shallow-repository"]) === "true";
  const head = gitOrNull(repoDir, ["rev-parse", "--verify", "--quiet", "HEAD^{commit}"]);
  if (!head) return { error: `${shown} has no saved versions (git commits) yet, so there is nothing to compare with. Use --since empty to see where your app stands.` };

  const commit = (sha, extra) => ({ kind: "commit", sha, short: shortSha(sha), date: commitDay(repoDir, sha), isHead: sha === head, ...extra });
  const rev = gitOrNull(repoDir, ["rev-parse", "--verify", "--quiet", `${v}^{commit}`]);
  if (rev) return commit(rev);

  const when = dateArg(v);
  if (when === null) {
    return {
      error:
        `--since ${v}: I can't find that saved version, and it doesn't look like a date. Use a git version (HEAD, HEAD~3, a branch name), a date like 2026-10-07, ` +
        `a facts.json saved with --save-facts, or empty.` +
        (shallow ? " This is a shallow clone (only recent history was downloaded), so older versions may not be here; `git fetch --unshallow` fetches them." : ""),
    };
  }
  if (shallow) {
    return { error: `${shown} is a shallow clone: only recent history was downloaded, so I can't tell which saved version a date falls after. Run \`git fetch --unshallow\` first, or use --since HEAD or a facts.json.` };
  }
  const found = gitOrNull(repoDir, ["rev-list", "-1", `--before=${when}`, "HEAD"]);
  if (found === null) return { error: `--since ${v}: git could not read the history of ${shown}` };
  if (found) return commit(found, { byDate: v });
  // The history starts after that date: everything counts as new. Say when it does start.
  const firstDays = (gitOrNull(repoDir, ["log", "--max-parents=0", "--format=%cI", "HEAD"]) ?? "")
    .split("\n")
    .map((l) => l.slice(0, 10))
    .filter(Boolean)
    .sort();
  return { kind: "empty", note: { code: "first-save-after-date", ...(firstDays[0] ? { date: firstDays[0] } : {}) }, byDate: v };
}

/* ─────────────────────────── the temporary tree ─────────────────────────── */

/**
 * A fresh `<tmp>/explain-app-XXXX/<repo name>` folder. The folder is named like the repo so the scan reports the
 * same `repo.name` as the live scan of it. `cleanup()` removes it (safe to call twice); it also runs on exit and on
 * SIGINT/SIGTERM/SIGHUP, which then end the process with the usual 128+signal code.
 * (A signal is handled once the current synchronous scan returns: JavaScript cannot be interrupted before.)
 */
export function tempTree(repoDir) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  const dir = path.join(root, path.basename(path.resolve(repoDir)) || "project");
  let done = false;
  const onSignal = (sig) => {
    cleanup();
    process.exit(128 + (os.constants.signals[sig] ?? 2));
  };
  const onExit = () => cleanup();
  function cleanup() {
    if (done) return;
    done = true;
    for (const s of SIGNALS) process.removeListener(s, onSignal);
    process.removeListener("exit", onExit);
    try {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // nothing more to do; the OS clears its temp folder
    }
  }
  try {
    fs.mkdirSync(dir);
  } catch (e) {
    cleanup();
    throw e;
  }
  for (const s of SIGNALS) process.on(s, onSignal);
  process.on("exit", onExit);
  return { dir, cleanup };
}

/** An empty project folder named like the repo: the baseline of `--since empty`. */
export function emptyTree(repoDir) {
  return { ...tempTree(repoDir), notes: [], stats: { files: 0, sparse: 0, symlinks: 0, submodules: 0, skipped: 0, failed: 0 } };
}

/* ─────────────────────────── materialiseRev ─────────────────────────── */

// A path from a tree object, made safe to join under the temp folder. git itself refuses these on checkout.
function safeSegments(rel) {
  const segs = rel.split("/");
  const win = process.platform === "win32";
  for (const s of segs) {
    if (s === "" || s === "." || s === ".." || s.toLowerCase() === ".git") return null;
    if (win && /[\\:]/.test(s)) return null;
  }
  return segs;
}

// `git ls-tree -r -z -l`: "<mode> <type> <oid> <size>\t<path>" per entry. Size is "-" for a submodule.
function listTree(repoDir, sha) {
  const out = gitOutput(repoDir, ["ls-tree", "-r", "-z", "-l", sha]);
  const entries = [];
  for (const rec of out.split("\0")) {
    if (!rec) continue;
    const m = /^(\d{6}) (\w+) ([0-9a-f]+) +(-|\d+)\t([\s\S]+)$/.exec(rec);
    if (m) entries.push({ mode: m[1], type: m[2], oid: m[3], size: m[4] === "-" ? 0 : Number(m[4]), path: m[5] });
  }
  return entries;
}

/**
 * Pipe every wanted blob through one `git cat-file --batch` (requests: "<oid>\n"; responses: "<oid> blob <size>\n<bytes>\n").
 * `onBlob(index, bytes | null)` is called in order; null for an object git does not have.
 */
function streamBlobs(repoDir, oids, onBlob) {
  return new Promise((resolve, reject) => {
    if (oids.length === 0) return resolve();
    const child = spawn("git", [...GIT_FLAGS, "-C", repoDir, "cat-file", "--batch"], {
      env: { ...gitEnv(), GIT_NO_LAZY_FETCH: "1" }, // a partial clone reports a missing blob instead of fetching it one by one
      stdio: ["pipe", "pipe", "pipe"],
    });
    let index = 0;
    let header = Buffer.alloc(0);
    let chunks = [];
    let have = 0;
    let need = -1; // body bytes + the LF after them; -1 while waiting for a header line
    let size = 0;
    let isBlob = true;
    let stderr = "";
    let failure = null;
    const fail = (e) => {
      if (failure) return;
      failure = e;
      child.kill();
    };
    child.stderr.on("data", (d) => {
      if (stderr.length < 4096) stderr += d.toString("utf8");
    });
    child.stdin.on("error", () => {}); // the process died: 'close' says why
    child.stdout.on("data", (chunk) => {
      try {
        let buf = chunk;
        while (buf.length && !failure) {
          if (need < 0) {
            header = header.length ? Buffer.concat([header, buf]) : buf;
            const nl = header.indexOf(10);
            if (nl < 0) return;
            const line = header.subarray(0, nl).toString("latin1");
            buf = header.subarray(nl + 1);
            header = Buffer.alloc(0);
            const head = /^[0-9a-f]+ (\w+) (\d+)$/.exec(line);
            if (head) {
              // Whatever the type, the body follows and must be read to stay in step; only blobs are kept.
              isBlob = head[1] === "blob";
              size = Number(head[2]);
              need = size + 1;
              have = 0;
              chunks = [];
            } else if (/^[0-9a-f]+ missing$/.test(line)) onBlob(index++, null);
            else throw new Error(`unexpected answer from git cat-file: ${line.slice(0, 80)}`);
          } else {
            const take = Math.min(need - have, buf.length);
            if (isBlob) chunks.push(buf.subarray(0, take));
            have += take;
            buf = buf.subarray(take);
            if (have === need) {
              const body = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
              onBlob(index++, isBlob ? body.subarray(0, size) : null);
              need = -1;
              chunks = [];
            }
          }
        }
      } catch (e) {
        fail(e);
      }
    });
    child.on("error", (e) => reject(e));
    child.on("close", (code, signal) => {
      if (failure) return reject(failure);
      if (code !== 0 || index !== oids.length) {
        return reject(new Error(`git cat-file stopped early (${signal ?? `exit ${code}`}, ${index} of ${oids.length} files)${stderr ? `: ${stderr.trim().split("\n")[0]}` : ""}`));
      }
      resolve();
    });
    child.stdin.end(oids.map((o) => `${o}\n`).join(""));
  });
}

/**
 * Unpack the project as it was at commit `sha` into a temporary folder, ready for `scanRepoDetailed(dir, { useGit: false })`.
 * Skips symlinks, submodules and anything under a folder the scanner never walks (node_modules, .git, …); a blob over
 * 2 MiB becomes a sparse file of its true size (the scanner only needs to know it is there and how big).
 * Returns { dir, cleanup, notes, stats }: `notes` are plain-English warnings for stderr (files that could not be
 * unpacked), `stats` counts what was written and skipped. On failure the folder is removed and the error thrown.
 */
export async function materialiseRev(repoDir, sha) {
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(sha)) throw new TypeError("materialiseRev: expected a full commit id");
  const repo = path.resolve(repoDir);
  const tree = tempTree(repo);
  try {
    const stats = { files: 0, sparse: 0, symlinks: 0, submodules: 0, skipped: 0, failed: 0 };
    const wanted = [];
    const sparse = [];
    for (const e of listTree(repo, sha)) {
      if (e.type === "commit" || e.mode === "160000") {
        stats.submodules++;
        continue;
      }
      if (e.mode === "120000") {
        stats.symlinks++;
        continue;
      }
      if (e.type !== "blob") continue;
      const segs = safeSegments(e.path);
      if (!segs || inNeverWalkDir(e.path)) {
        stats.skipped++;
        continue;
      }
      const target = { abs: path.join(tree.dir, ...segs), size: e.size, oid: e.oid };
      (e.size > SPARSE_OVER ? sparse : wanted).push(target);
    }

    const place = (abs, write) => {
      try {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        write();
        return true;
      } catch {
        stats.failed++;
        return false;
      }
    };
    for (const t of sparse) {
      const ok = place(t.abs, () => {
        const fd = fs.openSync(t.abs, "w");
        try {
          fs.ftruncateSync(fd, t.size);
        } finally {
          fs.closeSync(fd);
        }
      });
      if (ok) {
        stats.files++;
        stats.sparse++;
      }
    }
    await streamBlobs(
      repo,
      wanted.map((t) => t.oid),
      (i, bytes) => {
        if (bytes === null) return void stats.failed++;
        if (place(wanted[i].abs, () => fs.writeFileSync(wanted[i].abs, bytes))) stats.files++;
      },
    );

    const notes = [];
    if (stats.failed) notes.push(`${stats.failed} file${stats.failed === 1 ? "" : "s"} from the saved version could not be unpacked, so some changes below may not be real`);
    return { dir: tree.dir, cleanup: tree.cleanup, notes, stats };
  } catch (e) {
    tree.cleanup();
    throw e;
  }
}

#!/usr/bin/env node
// explain-app installer: copy this skill folder into a skills folder that Claude Code and Cursor load.
//
//   node tools/install.mjs [--cursor] [--claude] [--project <dir>] [--dry-run]
//
//   (no host flag)    ~/.claude/skills/explain-app — Cursor also loads ~/.claude/skills, so one copy serves both
//   --claude          the same, spelled out
//   --cursor          ~/.cursor/skills/explain-app instead (both flags install to both)
//   --project <dir>   <dir>/.claude/skills/explain-app (or <dir>/.cursor/skills/explain-app with --cursor)
//   --dry-run         print what would change and write nothing
//
// The source is the skill folder this script lives in. It is an overlay: files are copied over what is there,
// the destination folder is never deleted, and files that were not installed by this script (a project-context.md
// you keep there) are left alone. .explain-app-install.json lists what was copied, so a file removed from the
// source is removed from the destination on the next install, and nothing else is.
// Excluded: tools/node_modules, tools/test/.out, .git, the manifest, and the source's own project-context.md.
// Node built-ins only. Exit codes: 0 ok, 1 error, 2 usage.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const SKILL = path.resolve(path.dirname(SELF), "..");
const NAME = "explain-app";
const MANIFEST = ".explain-app-install.json";
const SKIP = new Set(["tools/node_modules", "tools/test/.out"]);
const USER_OWNED = new Set(["project-context.md"]); // per-project overrides live next to the skill; never copied over or deleted
const HOSTS = { claude: ".claude", cursor: ".cursor" };
const DOC_URL = "https://cursor.com/docs/skills";

const USAGE = `Usage: node tools/install.mjs [--cursor] [--claude] [--project <dir>] [--dry-run]

  (no host flag)   install to ~/.claude/skills/${NAME} (Cursor loads this folder too)
  --claude         same as the default
  --cursor         install to ~/.cursor/skills/${NAME} instead; with --claude too, to both
  --project <dir>  install into <dir>/.claude/skills/${NAME} (or <dir>/.cursor/skills/${NAME} with --cursor)
  --dry-run        show what would change; write nothing

Copies over what is there and never deletes the destination folder. Re-running is safe.
Exit codes: 0 ok, 1 error, 2 usage.`;

const err = (s) => process.stderr.write(`${s}\n`);
const warn = (s) => err(`! ${s}`);

class UsageError extends Error {}

function parseArgs(args) {
  const opt = { hosts: new Set(), project: null, dryRun: false, help: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--cursor") opt.hosts.add("cursor");
    else if (a === "--claude") opt.hosts.add("claude");
    else if (a === "--dry-run") opt.dryRun = true;
    else if (a === "--help" || a === "-h") opt.help = true;
    else if (a === "--project" || a.startsWith("--project=")) {
      const value = a === "--project" ? args[++i] : a.slice("--project=".length);
      if (!value || value.startsWith("--")) throw new UsageError("--project needs a folder");
      opt.project = value;
    } else throw new UsageError(a.startsWith("-") ? `Unknown option ${a}` : `Unexpected argument ${a}`);
  }
  if (!opt.hosts.size) opt.hosts.add("claude");
  return opt;
}

// Every file the skill ships, as sorted "/"-separated paths relative to the skill folder.
function listSource(root) {
  const files = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.name === ".git" || SKIP.has(r) || r === MANIFEST || USER_OWNED.has(r)) continue;
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) files.push(r);
    }
  };
  walk("");
  return files.sort();
}

// realpath that also works for a path that does not exist yet: resolve the nearest existing ancestor.
function realish(p) {
  let cur = path.resolve(p);
  const tail = [];
  while (!fs.existsSync(cur) && path.dirname(cur) !== cur) {
    tail.unshift(path.basename(cur));
    cur = path.dirname(cur);
  }
  return path.join(fs.realpathSync(cur), ...tail);
}
const inside = (child, parent) => child.startsWith(parent.endsWith(path.sep) ? parent : parent + path.sep);

// Only plain relative paths that stay inside the destination count; a hand-edited manifest cannot reach outside it.
const safeRel = (f) =>
  typeof f === "string" && f !== "" && f !== MANIFEST && !USER_OWNED.has(f) && !path.isAbsolute(f) && !f.includes("\\") && !f.split("/").some((s) => s === "" || s === "." || s === "..");

function readManifest(dest) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dest, MANIFEST), "utf8"));
    return Array.isArray(m?.files) ? m.files.filter(safeRel) : [];
  } catch {
    return [];
  }
}

const at = (dest, rel) => path.join(dest, ...rel.split("/"));

// What installing would do: which files are new, changed, unchanged, and which the last install left that the source dropped.
function plan(files, dest) {
  const add = [];
  const update = [];
  const same = [];
  for (const f of files) {
    const to = at(dest, f);
    if (!fs.existsSync(to)) add.push(f);
    else if (fs.statSync(to).isFile() && fs.readFileSync(to).equals(fs.readFileSync(at(SKILL, f)))) same.push(f);
    else update.push(f);
  }
  const keep = new Set(files);
  const remove = readManifest(dest).filter((f) => !keep.has(f) && fs.existsSync(at(dest, f)));
  return { add, update, same, remove };
}

function apply(files, dest, { add, update, remove }) {
  for (const f of [...add, ...update]) {
    fs.mkdirSync(path.dirname(at(dest, f)), { recursive: true });
    fs.copyFileSync(at(SKILL, f), at(dest, f));
  }
  for (const f of remove) {
    fs.rmSync(at(dest, f), { force: true });
    // Folders this install emptied go too; rmdir refuses a folder that still holds anything else.
    for (let d = path.dirname(at(dest, f)); inside(d, dest); d = path.dirname(d)) {
      try {
        fs.rmdirSync(d);
      } catch {
        break;
      }
    }
  }
  fs.mkdirSync(dest, { recursive: true });
  const manifest = `${JSON.stringify({ version: 1, files }, null, 2)}\n`;
  const file = path.join(dest, MANIFEST);
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== manifest) fs.writeFileSync(file, manifest);
}

const quote = (p) => (/[\s"'$`\\]/.test(p) ? JSON.stringify(p) : p);

function nextSteps(dest) {
  const tools = quote(path.join(dest, "tools"));
  return [
    "Next steps",
    "  Scanner and briefing: nothing to install (Node 18+ and git are enough).",
    "  Posters (check, export): npm install --prefix " + tools,
    "    then a browser for PNG/PDF and `check`: npx --prefix " + tools + " playwright install chromium   (or set POSTER_CHROMIUM)",
    "    `export --html` needs only the npm install, no browser.",
  ];
}

function installTo(dest, files, { dryRun, others }) {
  const real = realish(dest);
  if (real === realish(SKILL)) {
    console.log(`${dest} is this folder; nothing to do`);
    return;
  }
  if (inside(real, realish(SKILL))) throw new Error(`${dest} is inside the skill folder being copied — choose another place`);
  const p = plan(files, dest);
  const parts = [`${p.add.length} new`, `${p.update.length} updated`, `${p.same.length} unchanged`, `${p.remove.length} removed`];
  console.log(`${dryRun ? "Would install" : "Installed"} ${NAME} → ${dest}\n  ${files.length} files: ${parts.join(", ")}`);
  if (dryRun) {
    const lines = [...p.add.map((f) => `+ ${f}`), ...p.update.map((f) => `~ ${f}`), ...p.remove.map((f) => `- ${f}`)];
    for (const l of lines.slice(0, 40)) console.log(`    ${l}`);
    if (lines.length > 40) console.log(`    … and ${lines.length - 40} more`);
    console.log("  (dry run — nothing written)");
  } else apply(files, dest, p);
  for (const other of others) {
    if (fs.existsSync(path.join(other, "SKILL.md")) && realish(other) !== real) {
      warn(`A second copy exists at ${other}. Cursor loads both .claude/skills and .cursor/skills, so it would list ${NAME} twice — delete one (this installer never deletes folders it did not make).`);
    }
  }
}

export async function main(argv) {
  let opt;
  try {
    opt = parseArgs(argv);
    if (opt.project && !fs.statSync(opt.project, { throwIfNoEntry: false })?.isDirectory()) throw new UsageError(`Not a folder: ${opt.project}`);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    err(`${e.message}\n${USAGE}`);
    return 2;
  }
  if (opt.help) {
    console.log(USAGE);
    return 0;
  }
  if (!fs.existsSync(path.join(SKILL, "SKILL.md"))) {
    err(`SKILL.md not found in ${SKILL} — run install.mjs from the ${NAME} skill folder`);
    return 1;
  }
  const root = opt.project ? path.resolve(opt.project) : process.env.HOME || process.env.USERPROFILE || os.homedir();
  const files = listSource(SKILL);
  if (opt.hosts.size > 1) warn(`Installing to both hosts: Cursor loads ~/.claude/skills and ~/.cursor/skills (${DOC_URL}), so it will list ${NAME} twice. One copy is enough.`);
  let failed = 0;
  const done = [];
  for (const host of opt.hosts) {
    const dest = path.join(root, HOSTS[host], "skills", NAME);
    // The other host's folder in the same place: Cursor reads both, so a copy there shows up as a duplicate.
    const others = Object.keys(HOSTS).filter((h) => !opt.hosts.has(h)).map((h) => path.join(root, HOSTS[h], "skills", NAME));
    try {
      installTo(dest, files, { dryRun: opt.dryRun, others });
      done.push(dest);
    } catch (e) {
      failed++;
      err(`✗ ${dest}: ${e.message}`);
    }
  }
  if (!opt.dryRun && done.length) console.log(`\n${nextSteps(done[0]).join("\n")}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => {
    err(e.message);
    process.exit(1);
  });
}

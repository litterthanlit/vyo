// Tests for tools/install.mjs. Run: node --test tools/test/install.test.mjs
// Each case installs from a temp copy of the skill (the script finds its source from its own location)
// into a temp HOME or --project folder; the real ~/.claude and ~/.cursor are never touched.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST = ".explain-app-install.json";
const NAME = "explain-app";

const made = [];
const tmp = (label) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `explain-app-install-${label}-`));
  made.push(dir);
  return fs.realpathSync(dir);
};
after(() => made.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const put = (file, text = "x\n") => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

// Every file under `dir` → its content (base64), keyed by "/"-separated relative path.
function snapshot(dir) {
  const out = {};
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else out[r] = fs.readFileSync(path.join(dir, r)).toString("base64");
    }
  };
  walk("");
  return out;
}

// A copy of the skill folder as it is in a checkout: no installed deps, no test output.
// It gets the things the installer must leave out, so each case can check they stay out.
function makeSource(label) {
  const dest = path.join(tmp(label), NAME);
  const skip = new Set(["tools/node_modules", "tools/test/.out", ".git"]);
  const copy = (rel) => {
    for (const e of fs.readdirSync(path.join(SKILL, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (skip.has(r)) continue;
      if (e.isDirectory()) copy(r);
      else if (e.isFile()) put(path.join(dest, r), fs.readFileSync(path.join(SKILL, r)));
    }
  };
  copy("");
  put(path.join(dest, "tools", "node_modules", "left-pad", "index.js"), "module.exports = 1;\n");
  put(path.join(dest, "tools", "test", ".out", "starter.canvas.tsx"), "export default 1;\n");
  put(path.join(dest, ".git", "HEAD"), "ref: refs/heads/main\n");
  return dest;
}

// Run <source>/tools/install.mjs with HOME pointed at a temp folder.
function install(source, args = [], { home } = {}) {
  const r = spawnSync(process.execPath, [path.join(source, "tools", "install.mjs"), ...args], {
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const pristine = makeSource("pristine");
const dest = (home, host = ".claude") => path.join(home, host, "skills", NAME);
const readManifest = (d) => JSON.parse(fs.readFileSync(path.join(d, MANIFEST), "utf8"));

test("installs to ~/.claude/skills/explain-app and leaves out node_modules, test/.out, .git and the manifest", () => {
  const home = tmp("home");
  const r = install(pristine, [], { home });
  assert.equal(r.code, 0, r.err);
  const d = dest(home);
  for (const f of ["SKILL.md", "tools/poster.mjs", "tools/install.mjs", "tools/lib/build.mjs"]) assert.ok(fs.existsSync(path.join(d, f)), `${f} is installed`);
  assert.ok(!fs.existsSync(path.join(d, "tools", "node_modules")), "no node_modules");
  assert.ok(!fs.existsSync(path.join(d, "tools", "test", ".out")), "no test/.out");
  assert.ok(!fs.existsSync(path.join(d, ".git")), "no .git");
  assert.ok(!fs.existsSync(path.join(home, ".cursor")), "Cursor's folder is not written by default");

  const { version, files } = readManifest(d);
  assert.equal(version, 1);
  assert.deepEqual(files, [...files].sort(), "manifest lists files sorted");
  assert.ok(files.includes("SKILL.md") && !files.includes(MANIFEST));
  assert.ok(!files.some((f) => /^tools\/node_modules|^tools\/test\/\.out|^\.git(\/|$)/.test(f)));
  assert.deepEqual(Object.keys(snapshot(d)).filter((f) => f !== MANIFEST).sort(), files, "the manifest lists exactly what was copied");
  assert.match(r.out, /npm install --prefix .*tools/);
});

test("a second run changes nothing", () => {
  const home = tmp("home");
  assert.equal(install(pristine, [], { home }).code, 0);
  const d = dest(home);
  const before = snapshot(d);
  const mtimes = Object.keys(before).map((f) => fs.statSync(path.join(d, f)).mtimeMs);
  const r = install(pristine, [], { home });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(snapshot(d), before);
  assert.deepEqual(Object.keys(before).map((f) => fs.statSync(path.join(d, f)).mtimeMs), mtimes, "unchanged files are not rewritten");
  assert.match(r.out, /0 new, 0 updated, \d+ unchanged, 0 removed/);
});

test("keeps a project-context.md that is already in the destination, with or without one in the source", () => {
  const home = tmp("home");
  const d = dest(home);
  put(path.join(d, "project-context.md"), "# mine\n");
  put(path.join(d, "notes", "todo.txt"), "keep me\n");
  assert.equal(install(pristine, [], { home }).code, 0);
  assert.equal(fs.readFileSync(path.join(d, "project-context.md"), "utf8"), "# mine\n");
  assert.equal(fs.readFileSync(path.join(d, "notes", "todo.txt"), "utf8"), "keep me\n");
  assert.ok(!readManifest(d).files.some((f) => f === "project-context.md" || f.startsWith("notes/")), "files it did not copy are not in the manifest");

  const source = makeSource("with-context");
  put(path.join(source, "project-context.md"), "# from the source\n");
  assert.equal(install(source, [], { home }).code, 0);
  assert.equal(fs.readFileSync(path.join(d, "project-context.md"), "utf8"), "# mine\n", "the source's own override is not copied over it");
  assert.ok(fs.existsSync(path.join(d, "notes", "todo.txt")));
});

test("a file removed from the source is removed on re-install; files the installer did not make stay", () => {
  const source = makeSource("shrinking");
  put(path.join(source, "old-top.md"));
  put(path.join(source, "gone", "deep", "old.md"));
  const home = tmp("home");
  const d = dest(home);
  assert.equal(install(source, [], { home }).code, 0);
  assert.ok(fs.existsSync(path.join(d, "old-top.md")) && fs.existsSync(path.join(d, "gone", "deep", "old.md")));
  put(path.join(d, "project-context.md"), "# mine\n");
  put(path.join(d, "gone", "mine.txt"), "mine\n");

  fs.rmSync(path.join(source, "old-top.md"));
  fs.rmSync(path.join(source, "gone", "deep"), { recursive: true });
  const r = install(source, [], { home });
  assert.equal(r.code, 0, r.err);
  assert.ok(!fs.existsSync(path.join(d, "old-top.md")), "removed top-level file is gone");
  assert.ok(!fs.existsSync(path.join(d, "gone", "deep")), "the folder it emptied is gone too");
  assert.ok(fs.existsSync(path.join(d, "gone", "mine.txt")), "a folder that still holds your file is kept");
  assert.ok(fs.existsSync(path.join(d, "project-context.md")));
  assert.ok(fs.existsSync(path.join(d, "SKILL.md")));
  assert.ok(!readManifest(d).files.some((f) => f.startsWith("gone/") || f === "old-top.md"));
  assert.match(r.out, /2 removed/);
});

test("a hand-edited manifest cannot delete outside the destination", () => {
  const home = tmp("home");
  const d = dest(home);
  assert.equal(install(pristine, [], { home }).code, 0);
  const victim = path.join(home, ".claude", "victim.txt");
  put(victim, "precious\n");
  put(path.join(d, "project-context.md"), "# mine\n");
  const m = readManifest(d);
  m.files.push("../victim.txt", "../../.claude/victim.txt", path.join(d, "..", "victim.txt"), "project-context.md");
  fs.writeFileSync(path.join(d, MANIFEST), JSON.stringify(m));
  assert.equal(install(pristine, [], { home }).code, 0);
  assert.equal(fs.readFileSync(victim, "utf8"), "precious\n");
  assert.equal(fs.readFileSync(path.join(d, "project-context.md"), "utf8"), "# mine\n");
});

test("--dry-run writes nothing", () => {
  const home = tmp("home");
  const r = install(pristine, ["--dry-run"], { home });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(fs.readdirSync(home), [], "a fresh HOME stays empty");
  assert.match(r.out, /Would install/);
  assert.match(r.out, /\+ SKILL\.md/);

  // Over an existing install, with one file changed and one dropped in the source.
  const source = makeSource("dry");
  put(path.join(source, "old.md"));
  assert.equal(install(source, [], { home }).code, 0);
  const d = dest(home);
  const before = snapshot(d);
  put(path.join(source, "SKILL.md"), "# changed\n");
  fs.rmSync(path.join(source, "old.md"));
  const again = install(source, ["--dry-run"], { home });
  assert.equal(again.code, 0, again.err);
  assert.deepEqual(snapshot(d), before, "the existing install is untouched");
  assert.match(again.out, /~ SKILL\.md/);
  assert.match(again.out, /- old\.md/);
});

test("--cursor, --claude and --project choose the destination", () => {
  const home = tmp("home");
  assert.equal(install(pristine, ["--cursor"], { home }).code, 0);
  assert.ok(fs.existsSync(path.join(dest(home, ".cursor"), "SKILL.md")));
  assert.ok(!fs.existsSync(path.join(home, ".claude")), "--cursor alone does not write .claude");

  const both = install(pristine, ["--claude", "--cursor"], { home: tmp("home") });
  assert.equal(both.code, 0, both.err);
  assert.match(both.err, /list explain-app twice/);

  const project = tmp("project");
  const emptyHome = tmp("home");
  assert.equal(install(pristine, ["--project", project], { home: emptyHome }).code, 0);
  assert.ok(fs.existsSync(path.join(dest(project), "SKILL.md")));
  assert.equal(install(pristine, [`--project=${project}`, "--cursor"], { home: emptyHome }).code, 0);
  assert.ok(fs.existsSync(path.join(dest(project, ".cursor"), "SKILL.md")));
  assert.deepEqual(fs.readdirSync(emptyHome), [], "--project leaves HOME alone");
});

test("warns when the other host's folder already holds a copy", () => {
  const home = tmp("home");
  put(path.join(dest(home, ".cursor"), "SKILL.md"), "# old copy\n");
  const r = install(pristine, [], { home });
  assert.equal(r.code, 0, r.err);
  assert.match(r.err, /second copy exists at .*\.cursor.*list explain-app twice/);
  assert.equal(fs.readFileSync(path.join(dest(home, ".cursor"), "SKILL.md"), "utf8"), "# old copy\n", "the other copy is not touched");

  const clean = install(pristine, [], { home: tmp("home") });
  assert.doesNotMatch(clean.err, /second copy/);
});

test("does nothing when the source is the destination", () => {
  const home = tmp("home");
  const source = dest(home);
  for (const [f, text] of Object.entries(snapshot(pristine))) put(path.join(source, f), Buffer.from(text, "base64"));
  const before = snapshot(source);
  const r = install(source, [], { home });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /this folder; nothing to do/);
  assert.deepEqual(snapshot(source), before, "not even a manifest is written");
});

test("usage errors exit 2 and write nothing", () => {
  const home = tmp("home");
  for (const args of [["--bogus"], ["--project"], ["--project", "--cursor"], ["--project", path.join(home, "nope")], ["extra"]]) {
    const r = install(pristine, args, { home });
    assert.equal(r.code, 2, `${args.join(" ")} → ${r.code}`);
    assert.match(r.err, /Usage: node tools\/install\.mjs/);
  }
  assert.deepEqual(fs.readdirSync(home), []);
  assert.equal(install(pristine, ["--help"], { home }).code, 0);
});

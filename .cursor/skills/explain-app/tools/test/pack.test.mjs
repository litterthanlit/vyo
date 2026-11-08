// The package as a user gets it: pack, install the tarball into a fresh project, init the skill, make a poster.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE = path.join(HERE, "..", "..");
// npm test's own npm_* variables would point the nested npm at this package.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_/i.test(k)));

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8" });
  assert.equal(r.status, 0, `${cmd} ${args.join(" ")} exited ${r.status}\n${r.stdout}\n${r.stderr}`);
  return r;
}

/** The scaffold with every "…" value replaced by the preset's value at the same place; array items match by id. */
function fillFrom(scaffold, preset) {
  if (typeof scaffold === "string") {
    if (!scaffold.startsWith("…")) return scaffold;
    assert.equal(typeof preset, "string", `the preset has no words for ${scaffold}`);
    return preset;
  }
  if (Array.isArray(scaffold)) return scaffold.map((item, i) => fillFrom(item, preset?.find?.((p) => p.id !== undefined && p.id === item?.id) ?? preset?.[i]));
  if (scaffold && typeof scaffold === "object") return Object.fromEntries(Object.entries(scaffold).map(([k, v]) => [k, fillFrom(v, preset?.[k])]));
  return scaffold;
}

test("a packed, installed vyo inits the skill and renders a passing wave poster", { timeout: 300_000 }, (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vyo-pack-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const tarball = path.join(tmp, run("npm", ["pack", "--pack-destination", tmp, "--silent"], PACKAGE).stdout.trim().split("\n").pop());
  const app = path.join(tmp, "app");
  fs.mkdirSync(app);
  fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ name: "app", private: true }));
  run("npm", ["install", "--no-audit", "--no-fund", tarball], app);
  const vyo = (...args) => run("npx", ["--no-install", "vyo", ...args], app);

  const init = vyo("init", "--cursor", "--dir", app);
  for (const f of ["SKILL.md", "examples.md", "plain-language-rules.md", "project-context.example.md"]) {
    const file = path.join(app, ".cursor", "skills", "explain-app", f);
    assert.ok(fs.existsSync(file), `init wrote ${file}`);
    assert.ok(init.stdout.includes(file), `init printed ${file}`);
  }
  assert.ok(!fs.existsSync(path.join(app, ".claude")), "--cursor alone writes no .claude folder");

  const repo = path.join(tmp, "recipe");
  fs.cpSync(path.join(HERE, "fixtures", "recipe"), repo, { recursive: true });
  const git = ["-c", "user.name=vyo", "-c", "user.email=vyo@example.com"];
  run("git", ["init", "-q"], repo);
  run("git", [...git, "add", "-A"], repo);
  run("git", [...git, "commit", "-qm", "recipe"], repo);

  const facts = path.join(repo, "vyo", "recipe-facts.json");
  const spec = path.join(repo, "vyo", "recipe-poster.json");
  const wave = JSON.parse(fs.readFileSync(path.join(app, "node_modules", "@litterthanlit", "vyo", "tools", "presets", "wave.json"), "utf8"));
  const accent = wave.figure.regions[0].accent;
  vyo("scan", repo, "--out", facts);
  assert.match(vyo("parts", facts).stdout, new RegExp(`^${accent.replace(/[.()]/g, "\\$&")} `, "m"), `parts lists the wave preset's accent ${accent}`);
  vyo("compose", facts, "--field", "wave", "--accent", accent, "--repo", repo, "--out", spec);

  const scaffold = JSON.parse(fs.readFileSync(spec, "utf8"));
  const filled = fillFrom(scaffold, wave);
  filled.product.name = wave.product.name;
  filled.figure.regions[0].names = wave.figure.regions[0].names;
  assert.ok(!JSON.stringify(filled).includes("…"), "every placeholder is filled");
  fs.writeFileSync(spec, JSON.stringify(filled, null, 2));

  const render = vyo("render", spec);
  assert.match(render.stdout, /^PASS$/m);
  assert.doesNotMatch(render.stderr, /^✗/m);
  for (const f of ["recipe-poster.png", "recipe-poster-thumb.png"]) assert.ok(fs.statSync(path.join(repo, "vyo", f)).size > 0, `render wrote ${f}`);
  t.diagnostic(`${path.basename(tarball)} installed; ${render.stdout.trim().split("\n").join(" | ")}`);
});

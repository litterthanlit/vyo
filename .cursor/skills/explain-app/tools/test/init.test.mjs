// vyo init: which editors get the skill, and a rerun that converges.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { init, chooseEditors, SKILL_FILES } from "../lib/init.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "vyo-init-"));

test("init installs for the editor folder the repo has, else for both", () => {
  const claudeOnly = tmp();
  fs.mkdirSync(path.join(claudeOnly, ".claude"));
  assert.deepEqual(chooseEditors(claudeOnly, []), ["claude"]);
  assert.deepEqual(chooseEditors(tmp(), []), ["cursor", "claude"]);
  assert.deepEqual(chooseEditors(claudeOnly, ["cursor"]), ["cursor"]);
});

test("a rerun overwrites the skill files and keeps one AGENTS.md block after the owner's text", () => {
  const repo = tmp();
  fs.writeFileSync(path.join(repo, "AGENTS.md"), "# Agents\n\nBe kind.\n");
  init(repo, { editors: ["cursor"], codex: true });
  fs.writeFileSync(path.join(repo, ".cursor/skills/explain-app/SKILL.md"), "stale");
  const written = init(repo, { editors: ["cursor"], codex: true });
  assert.deepEqual(written, [...SKILL_FILES.map((f) => path.join(".cursor/skills/explain-app", f)), "AGENTS.md"]);
  assert.match(fs.readFileSync(path.join(repo, ".cursor/skills/explain-app/SKILL.md"), "utf8"), /^---\nname: explain-app/);
  const agents = fs.readFileSync(path.join(repo, "AGENTS.md"), "utf8");
  assert.equal(agents.match(/vyo:begin/g).length, 1);
  assert.ok(agents.startsWith("# Agents\n\nBe kind.\n\n<!-- vyo:begin"));
  assert.match(agents, /`\.cursor\/skills\/explain-app\/SKILL\.md`/);
});

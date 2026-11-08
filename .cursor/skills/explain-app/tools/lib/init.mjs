// vyo init: copy the skill into a repo for Cursor and/or Claude Code, and point Codex at it from AGENTS.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SKILL_FILES = ["SKILL.md", "examples.md", "plain-language-rules.md", "project-context.example.md"];
export const EDITORS = { cursor: ".cursor", claude: ".claude" };

const BEGIN = "<!-- vyo:begin · added by `vyo init` -->";
const END = "<!-- vyo:end -->";
const BLOCK = /<!-- vyo:begin[^\n]*-->[\s\S]*?<!-- vyo:end -->\n?/;

/** The editors named on the command line, else the ones whose folder the repo already has, else both. */
export function chooseEditors(repo, named) {
  if (named.length) return named;
  const present = Object.keys(EDITORS).filter((e) => fs.existsSync(path.join(repo, EDITORS[e])));
  return present.length ? present : Object.keys(EDITORS);
}

function agentsBlock(skillPath) {
  return [
    BEGIN,
    "## Explain the app (vyo)",
    "",
    `When asked to explain this app to someone who does not code, or to draw the codebase as a poster, read \`${skillPath}\` and follow it. It runs \`npx -y @litterthanlit/vyo\`.`,
    END,
    "",
  ].join("\n");
}

/** Add the block at the end, or replace the one already there. */
function withBlock(text, block) {
  if (BLOCK.test(text)) return text.replace(BLOCK, block);
  return text ? `${text.replace(/\n*$/, "\n")}\n${block}` : block;
}

/** Writes the skill files and, with codex, the AGENTS.md block. Returns the paths written, relative to repo. */
export function init(repo, { editors, codex }) {
  const written = [];
  for (const editor of editors) {
    const dir = path.join(EDITORS[editor], "skills", "explain-app");
    fs.mkdirSync(path.join(repo, dir), { recursive: true });
    for (const f of SKILL_FILES) {
      fs.copyFileSync(path.join(PACKAGE, f), path.join(repo, dir, f));
      written.push(path.join(dir, f));
    }
  }
  if (codex) {
    const file = path.join(repo, "AGENTS.md");
    const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    fs.writeFileSync(file, withBlock(text, agentsBlock(path.join(EDITORS[editors[0]], "skills", "explain-app", "SKILL.md"))));
    written.push("AGENTS.md");
  }
  return written;
}

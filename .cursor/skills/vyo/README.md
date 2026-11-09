# vyo

vyo explains an app to someone who does not code. It scans a repository and draws the codebase as one poster: every part of the code as a row, peak, stream, triangle or globe sized by its code, the part the product is about in an accent colour, a legend that says what the picture shows, and a few plain sentences. You get a PNG and a PDF to send to a client, a PM or a stakeholder. A signal-frame poster is high-contrast charcoal or paper; `vyo render --gif` writes a short GIF when the spec has motion.

vyo has two halves. The skill tells your coding agent (Cursor, Claude Code or Codex) how to read the repo, choose the picture and write the words. The `vyo` command does the drawing and checks the result: it rejects jargon, file paths, placeholder text and text that collides with the picture.

## Install

Run these three commands in the repository you want to explain:

```bash
npm install --save-dev @litterthanlit/vyo
npx vyo init
npx playwright install chromium
```

1. The first command adds the tools. The fonts are bundled.
2. `npx vyo init` copies the skill into `.cursor/skills/vyo/` and `.claude/skills/vyo/`. When the repository already has one of those folders, it writes only that one. Pass `--cursor` or `--claude` to choose, `--codex` to also add a short block to `AGENTS.md` that points Codex at the skill, and `--dir <repo>` to install into another folder. Running it again overwrites the same files.
3. The last command downloads the Chromium that renders the poster. If you already have Chromium or Chrome, set `VYO_CHROMIUM` to its path instead.

To try vyo without adding it to the project, use `npx -y @litterthanlit/vyo init` and let the agent run `npx -y @litterthanlit/vyo`.

## Make a poster

Ask your agent: "Explain this app as a poster." It follows the skill, runs `vyo scan`, `vyo compose`, `vyo sketch` and `vyo render`, and replies with the paths of the PNG and the PDF in `vyo/` at the repository root.

To steer the result, copy `project-context.example.md` from the skill folder to `project-context.md` beside it, and fill in the product's name, its audience and the story you want told.

## Requirements

Node.js 20 or later (Playwright needs it), and Chromium for `render` and `check`. The other commands need no browser.

## Licence

The fonts, Commit Mono and Newsreader, are under the SIL Open Font License 1.1. See `fonts/LICENSE.md`.

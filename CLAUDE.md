# Working in this repo

The owner's instruction for every session here: the lead agent thinks, plans and oversees. It does not write code or prose files itself. It delegates building to subagents (opus for design and hard code, sonnet for well-specified work, haiku for mechanical edits), each with a written brief, its own worktree when it writes files, and a report back. The lead reviews the diff and the rendered result, merges, runs the tests, and pushes.

The skill lives in `.cursor/skills/explain-app/`. Its tools are in `tools/` there; run `npm install --prefix tools` and `bash tools/fetch-fonts.sh` once, and set `VYO_CHROMIUM` to a Chromium binary when Playwright's is not installed. `npm test` in `tools/` must stay green.

`explorations/` holds dated throwaway mockups from brainstorms. They are not the skill and are not checked by it.

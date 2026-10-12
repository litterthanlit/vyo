# explain-app poster tools

Commands that read a repo, say what changed in it, turn the Swiss rules from prose into something measured, and get the posters out of Cursor.

| Command | What it does | Needs |
|---------|--------------|-------|
| `scan.mjs scan` / `show` / `draft` | Repo → `<repo>-facts.json`, a summary with fact ids, a suggested `PARTS` array | Node |
| `scan.mjs wire` / `why` | `facts.json` + `PARTS` → the `WIRING` block of the page 3 canvas; show why two parts are linked | Node |
| `scan.mjs diff` | Two `facts.json` files → what changed, in plain English (text, `--html`, or the raw Changes with `--json`) | Node |
| `scan.mjs changes` | A repo and a point in its history → the same briefing, comparing the repo as it is now with then | Node; git for a commit or date |
| `install.mjs` | Copies the skill to where Claude Code and Cursor load it | Node |
| `poster.mjs check` | Renders each poster in headless Chromium and fails on rule breaks. Page 3 is also checked against its `facts.json` | `npm install`, Chromium |
| `poster.mjs export` | Writes a PNG (2×) and a PDF per poster, plus one combined set PDF | `npm install`, Chromium |
| `poster.mjs export --html` | Writes each poster as one offline web page that keeps its controls | `npm install` |

## Setup (once)

The scanner and the briefing (`scan`, `show`, `draft`, `wire`, `why`, `diff`, `changes`) and `install.mjs` use only Node 18+ and git. **Nothing to install.**

The poster commands need packages. `export --html` needs only the first step:

```bash
cd <skill folder>/tools          # e.g. ~/.claude/skills/explain-app/tools
npm install
npx playwright install chromium   # PNG, PDF and check only; or set POSTER_CHROMIUM=/path/to/chromium
```

## Usage

```bash
node poster.mjs check  <canvases>/acme-app-poster.canvas.tsx <canvases>/acme-project-story.canvas.tsx <canvases>/acme-exploded-view.canvas.tsx
node poster.mjs export <canvases>/acme-app-poster.canvas.tsx <canvases>/acme-project-story.canvas.tsx <canvases>/acme-exploded-view.canvas.tsx
```

`export` options: `--out <dir>` (default: an `exports` folder beside the first poster), `--paper fit|a4|letter` (default `fit`: one page sized to the poster), `--no-png`, `--no-pdf`, `--html`. The grid toggle and page 3's controls (`[data-chrome]`) are hidden in the PNG and PDF.

### `export --html`

```bash
node poster.mjs export <canvases>/acme-app-poster.canvas.tsx <canvases>/acme-exploded-view.canvas.tsx --html
node poster.mjs export <canvases>/acme-app-poster.canvas.tsx --html --no-png --no-pdf   # no browser at all
```

Writes `<stem>.html` per poster, plus `<repo>-poster-set.html` when there are two or more, into `--out` (default `<first file's folder>/exports`). Each is one file with its script and styles inline. It opens offline in any browser and has a viewport tag for phones. The interactive controls stay: the grid toggle, and page 3's slider, theme button and part list. `--state` seeds the starting state, as for PNG and PDF.

With `--no-png --no-pdf` no browser starts, so this works with just `npm install` (esbuild and react). It is how a Claude Code user, who has no canvas panel, looks at a poster. Without `--html`, `export` behaves as before.

Page 2 rules apply when the filename contains `project-story`, and page 3 rules when it contains `exploded-view`. Everything else is checked as page 1.

### `--facts` and `--state`

- **`--facts <facts.json>`** (check, page 3): the facts file to wire against. The default is the sibling `<canvases>/<repo>-facts.json`, where `<repo>` is the filename minus `-exploded-view.canvas.tsx`.
- **`--state key=value`** (check and export; repeat it for several keys): seeds a `useCanvasState` key before the poster renders. The value is read as JSON when it parses, otherwise as text. Without it every key keeps the canvas's own default.

  | Page 3 key | Default | Meaning |
  |---|---|---|
  | `openExploded` | `80` | How far the tiers are pulled apart, 0 to 100 |
  | `partExploded` | `0` | Index of the selected part |
  | `themeExploded` | `"light"` | `"light"` or `"dark"` |
  | `showGridExploded` | `false` | The 12-column grid overlay |

  ```bash
  # the drawing closed up, on the dark blueprint, with part 4 selected
  node poster.mjs export <canvases>/acme-exploded-view.canvas.tsx --state openExploded=0 --state themeExploded=dark --state partExploded=3
  ```

  `check` judges the light theme, so `--state themeExploded=dark` makes its palette rule fail by design: use it to look, not to pass.

## What changed: diff and changes

These answer "what changed in my app?" in plain English. The workflow for an agent is [../briefing.md](../briefing.md); the output shape is [CONTRACTS.md](CONTRACTS.md) §7. Run them from the skill directory. Nothing is installed and nothing is written inside the repo.

```bash
node tools/scan.mjs diff    <before-facts.json> <after-facts.json> [--out changes.json] [--json] [--canvas <canvas.tsx>] [--html <file>] [--receipts]
node tools/scan.mjs changes <repo> --since <empty|facts.json|rev|date> [same flags] [--save-facts <file>]
```

`diff` compares two `facts.json` files. `changes` scans `<repo>` as it is now (uncommitted and untracked work included, so `--since HEAD` means "what did the agent just change?") and compares it with `--since`:

| `--since` | The older side is | Its label in the briefing |
|---|---|---|
| `empty` (or `none`) | Nothing: the briefing says where the app stands now | an empty project |
| a file that exists | That `facts.json`, e.g. a bookmark saved earlier. No git needed | your earlier scan (`name.json`) |
| a commit, tag, branch or other git version (`HEAD`, `HEAD~3`) | That commit, read out of git into a temp folder | your last saved version (`a1b2c3d`, 2026-10-07) when it is the commit `HEAD` points at, else your saved version (…) |
| a date | The last commit before it. If there is none, the empty baseline and a note | as for a commit |

A date is an ISO date (`2026-10-11`, taken as 00:00 that day), an ISO date and time (`2026-10-11T09:30`), `3 days ago` (a number, then second, minute, hour, day, week, month or year, then `ago`), or one of `now`, `today`, `yesterday` (24 hours ago), `midnight` (the start of today) and `noon`. Any other text is refused with exit 1: git would read it as "now". The newer side is always "your files right now". The file is looked up as given, so a bare name is relative to where you run the command.

Reading a commit never writes in the repo or its `.git`. `empty` and a facts file work on any folder. A commit or a date needs git history, and stops with a message (exit 1) when:

- the folder is not in a git project;
- the folder is inside a git project but is not its top level (the message prints the folder to use);
- the project has no commits yet (use `--since empty`);
- the text is neither a version git knows nor a date, such as `HEAD~50` past the first commit or `last week`;
- the clone is shallow and the value is a date (run `git fetch --unshallow`, or use `HEAD` or a facts file). In a shallow clone `HEAD` and any commit it holds still work.

| Flag | What it does |
|---|---|
| `--receipts` | Adds the files behind each line (the default text has no paths). In `--html`, each line gets a "Show me where" fold |
| `--html <file>` | Also writes the briefing as one offline web page. The text still prints |
| `--json` | Prints the raw Changes instead of text |
| `--out <file>` | Also saves the raw Changes |
| `--canvas <canvas.tsx>` | Reads its `PARTS` and adds poster lines: out of date, can't be redrawn, new things not on it |
| `--save-facts <file>` | (`changes` only) Saves the scan of the repo as it is now, as the next `--since <file>`. With `--since <file>` on the same path it compares with the old file, then replaces it |

Flags take `--name value` or `--name=value`. Progress (`Reading …`), warnings (`! …`) and `→ <file>` lines go to stderr; stdout holds only the briefing (or the Changes, with `--json`). Exit codes: 0 ok (changes or not), 1 an error with the input (`✗ …` on stderr), 2 usage (a missing `<repo>` or `--since`, an unknown flag, a flag without its value, a `--since` that starts with `-`); `-h` prints the usage and exits 0.

`changes` refuses an `--out`, `--html` or `--save-facts` path inside `<repo>` (exit 1, nothing written). `diff` has no repo, so it has no such guard and writes where it is told; keep its outputs in `<canvases>`. `diff` takes the same output flags, but not `--since` or `--save-facts`.

The wording comes from `lib/briefing.mjs` and the comparison from `lib/changes.mjs`; `lib/briefing-html.mjs` draws the page from the same document, so text and page cannot drift apart.

## Install the skill

```bash
node tools/install.mjs [--cursor] [--claude] [--project <dir>] [--dry-run]
```

| Flags | Installs to |
|---|---|
| none, or `--claude` | `~/.claude/skills/explain-app`. Claude Code reads it, and so does Cursor ([Cursor's skills docs](https://cursor.com/docs/skills): it also loads `.claude/skills/` and `~/.claude/skills/`). One copy serves both |
| `--cursor` | `~/.cursor/skills/explain-app` |
| `--cursor --claude` | Both. Cursor then lists the skill twice, and the installer warns |
| `--project <dir>` | `<dir>/.claude/skills/explain-app`; with `--cursor`, `<dir>/.cursor/skills/explain-app` |
| `--dry-run` | Prints what would change and writes nothing |

It copies over what is there and never deletes the destination folder. A `project-context.md` you keep there stays. It leaves out `tools/node_modules`, `tools/test/.out`, `.git` and the source's own `project-context.md`. `.explain-app-install.json` in the destination lists what was copied, so a file removed from the skill is removed on the next install and nothing else is. It warns if a second copy exists in the other host's folder. Exit codes: 0 ok, 1 error, 2 usage. It ends by printing the next steps: nothing for the scanner and briefing; `npm install --prefix <dest>/tools` for posters, plus Chromium (`npx --prefix <dest>/tools playwright install chromium`, or `POSTER_CHROMIUM`) for PNG, PDF and `check`; `export --html` needs only the npm install.

## Page 3: scan, wire, why

Page 3 draws the repo's real parts and wiring. The contract between the four pieces (scanner, `PARTS`/`WIRING` blocks, the drawing, this checker) is [CONTRACTS.md](CONTRACTS.md); the commands below are specified in its §1. Run them from the skill directory.

```bash
node tools/scan.mjs scan  <repo-dir> --out <canvases>/<repo>-facts.json      # repo → facts.json (never writes inside the repo)
node tools/scan.mjs show  <facts.json>                                        # summary with fact ids, for writing PARTS
node tools/scan.mjs draft <facts.json>                                        # a suggested PARTS array
node tools/scan.mjs wire  <facts.json> --into <canvas.tsx>                    # PARTS → WIRING block (rule errors exit 1)
node tools/scan.mjs why   <facts.json> --canvas <canvas.tsx> "<part A>" "<part B>"   # one real wire between two parts
```

`check` needs the `facts.json` that `wire` used, beside the canvas. Re-run `scan` and `wire` after the repo changes.

## What `check` enforces

Errors (✗) fail the run. Warnings (!) are copy edits to consider.

| Rule | Level |
|------|-------|
| Imports only `cursor/canvas`; no `fetch` | ✗ |
| Renders without throwing (e.g. 5 transit stations, `PARTS changed`, a tier of more than 4 parts) | ✗ |
| One outer 12-column grid; nested grids re-expose the same lines | ✗ |
| Every grid item starts and ends on a column line (no negative margins) | ✗ |
| Every band's top and height are multiples of 8px; all line heights multiples of 8 | ✗ |
| ≤ 4 font sizes; masthead 104–128px (page 1) / tagline 64–80px (page 2), multiples of 8; display : body ≥ 7:1; nothing under 10px | ✗ |
| Text is ink, ink-soft, or the single red full stop (+ toggle); rules are ink; no gradients or shadows | ✗ |
| Flush-left (no centred or justified text); grotesque sans | ✗ |
| Transit line segments join two station dots; branches join their ring | ✗ |
| Grid overlay columns match the content columns; a "Show grid" toggle exists | ✗ |
| No file paths in visible copy | ✗ |
| No sideways scroll at 1440px and 1028px | ✗ |
| **Page 3, before rendering** | |
| `<repo>-facts.json` sits beside the canvas (or `--facts`), and its `hash` recomputes | ✗ |
| The canvas has `PARTS` and `WIRING` blocks; `wire(facts, PARTS)` passes (2 to 9 parts, names, citations, counts); errors are shown as `wire: …` | ✗ |
| `WIRING` equals a fresh wire of `PARTS` against the facts (hand edits, stale parts, a re-scan without re-wiring) | ✗ |
| Wire warnings: `Not drawn: …` (facts no part cites), a part with no links, 2 parts | ! |
| **Page 3, in the drawing** (the DOM contract, CONTRACTS.md §5) | |
| One `<figure data-facts-hash data-parts-hash>` with the SVG; its hashes, each part's role and count, and the cables (`path[data-link]`) are exactly what the fresh wire says | ✗ |
| 2 to 9 `g[data-part]`; at most 4 in one tier (tiers by role, with the AI/jobs → features merge) | ✗ |
| Each part has one `[data-face="top"]`, and its `[data-item]` count equals `data-drawn` equals `min(count, cap)` ("Part 6 draws 5 items but counts 4") | ✗ |
| Every `path[data-link]` joins two different drawn parts | ✗ |
| Every SVG stroke and fill is paper, ink, ink-soft, hairline or the selected-part tint | ✗ |
| Figure at most 704px tall, and the same height at every slider position | ✗ |
| One label per part; labels don't overlap; each is exactly two lines (no wrapping) | ✗ |
| Labels sit inside their gutter (cols 1–2 left, cols 11–12 right) with 12px of slack; 12–48px over is a warning, more is an error | ! / ✗ |
| Each leader line starts on its part's top face and ends at the near edge of its label, on the same side | ✗ |
| A leader line does not run across another part | ! |
| **Page 3, interaction** | |
| An "Open layers" slider opens the stack (Home → End spreads the parts > 40px; with a single tier there is nothing to open: warning) | ✗ |
| ↓ in the part list moves the selection | ✗ |
| Selecting a part inks its cables (`rgb(10, 10, 10)`) and leaves at least one other cable soft | ✗ |
| Pointing at a part that is not selected tints its top face | ✗ |
| The theme button flips paper ↔ ink | ✗ |
| Jargon from plain-language-rules.md (page 2 adds marketing words; SVG title/desc text included) | ! |
| Taller than 1300px; sideways scroll in a 720px panel | ! |

It does not judge copy quality, empty zones, status honesty, or whether a non-engineer would understand the poster. Those stay on the checklist in `swiss-design-principles.md`. It does not judge whether `PARTS` was a good choice of parts either, only that the drawing shows what the code wires.

## How it works

`lib/build.mjs` bundles the canvas with esbuild, swapping `cursor/canvas` for `shim/canvas.tsx` (a `useState`-backed `useCanvasState`, seeded from `--state`). `lib/inspect.js` runs inside the page and measures computed layout and the page 3 DOM. `poster.mjs` drives Playwright (loaded only when a browser is needed) and, for page 3, runs the facts/wiring checks in Node first with `lib/wire.mjs` and `lib/hash.mjs`. `lib/reach.mjs` is the link walker that `wire` and `lib/changes.mjs` share.

## Self-test

```bash
npm test
```

This builds fixtures from `poster-starter.md`, `sell-sheet-starter.md` and `exploded-view-starter.md`. The starters must pass, and each fixture with a planted bug must fail with its expected message:

- Pages 1 and 2: line gap, fifth font size, off-baseline rule, drifting overlay, stray import…
- Page 3, each with its own copy of the facts file (`test/.out/bug-*-facts.json`, a scan of `test/fixtures/recipe`): a missing or edited `facts.json`, a missing or hand-edited `WIRING`, `PARTS` changed without re-wiring, a `from` that cites nothing, 10 parts, 5 parts in one tier, a part drawing the wrong number of items, bad cables, an off-palette stroke or fill, overlapping or wrapping labels, a drifting leader, a dead slider / arrow keys / hover, and a selection that doesn't ink its cables.

It also type-checks the three starters, and runs the unit tests for the scanner, wire, reach, changes (with the briefing) and install (`node --test test/scan.test.mjs test/wire.test.mjs test/reach.test.mjs test/changes.test.mjs test/install.test.mjs`). Run it after editing the starters, the scanner, the wire tool, the changes code or the checker.

`node --test test/examples.test.mjs` checks that the sample briefing in `examples.md`, and the excerpt in `briefing.md`, are what the tool prints for the Pantry fixture. After you change the briefing's wording, rewrite the sample with `UPDATE_EXAMPLES=1 node --test test/examples.test.mjs` and re-read it.

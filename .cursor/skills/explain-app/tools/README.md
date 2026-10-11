# explain-app poster tools

Commands that turn the Swiss rules from prose into something measured, get the posters out of Cursor, and read a repo for page 3.

| Command | What it does |
|---------|--------------|
| `poster.mjs check` | Renders each poster in headless Chromium and fails on rule breaks. Page 3 is also checked against its `facts.json` |
| `poster.mjs export` | Writes a PNG (2×) and a PDF per poster, plus one combined set PDF |
| `scan.mjs scan` / `show` / `draft` | Repo → `<repo>-facts.json`, a summary with fact ids, a suggested `PARTS` array |
| `scan.mjs wire` / `why` | `facts.json` + `PARTS` → the `WIRING` block of the page 3 canvas; show why two parts are linked |

## Setup (once)

```bash
cd ~/.cursor/skills/explain-app/tools
npm install
npx playwright install chromium   # or set POSTER_CHROMIUM=/path/to/chromium
```

## Usage

```bash
node poster.mjs check  <canvases>/acme-app-poster.canvas.tsx <canvases>/acme-project-story.canvas.tsx <canvases>/acme-exploded-view.canvas.tsx
node poster.mjs export <canvases>/acme-app-poster.canvas.tsx <canvases>/acme-project-story.canvas.tsx <canvases>/acme-exploded-view.canvas.tsx
```

`export` options: `--out <dir>` (default `<canvases>/exports`), `--paper fit|a4|letter` (default `fit`: one page sized to the poster), `--no-png`, `--no-pdf`. The grid toggle and page 3's controls (`[data-chrome]`) are hidden in exports.

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

`lib/build.mjs` bundles the canvas with esbuild, swapping `cursor/canvas` for `shim/canvas.tsx` (a `useState`-backed `useCanvasState`, seeded from `--state`). `lib/inspect.js` runs inside the page and measures computed layout and the page 3 DOM. `poster.mjs` drives Playwright and, for page 3, runs the facts/wiring checks in Node first with `lib/wire.mjs` and `lib/hash.mjs`.

## Self-test

```bash
npm test
```

This builds fixtures from `poster-starter.md`, `sell-sheet-starter.md` and `exploded-view-starter.md`. The starters must pass, and each fixture with a planted bug must fail with its expected message:

- Pages 1 and 2: line gap, fifth font size, off-baseline rule, drifting overlay, stray import…
- Page 3, each with its own copy of the facts file (`test/.out/bug-*-facts.json`, a scan of `test/fixtures/recipe`): a missing or edited `facts.json`, a missing or hand-edited `WIRING`, `PARTS` changed without re-wiring, a `from` that cites nothing, 10 parts, 5 parts in one tier, a part drawing the wrong number of items, bad cables, an off-palette stroke or fill, overlapping or wrapping labels, a drifting leader, a dead slider / arrow keys / hover, and a selection that doesn't ink its cables.

It also type-checks the three starters, and runs the scanner and wire unit tests (`node --test test/scan.test.mjs test/wire.test.mjs`). Run it after editing the starters, the scanner, the wire tool or the checker.

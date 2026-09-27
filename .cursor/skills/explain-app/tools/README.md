# explain-app poster tools

Two commands that turn the Swiss rules from prose into something measured, and get the posters out of Cursor.

| Command | What it does |
|---------|--------------|
| `check` | Renders each poster in headless Chromium and fails on rule breaks |
| `export` | Writes a PNG (2×) and a PDF per poster, plus one combined set PDF |

## Setup (once)

```bash
cd ~/.cursor/skills/explain-app/tools
npm install
npx playwright install chromium   # or set POSTER_CHROMIUM=/path/to/chromium
```

## Usage

```bash
node poster.mjs check  <canvases>/acme-app-poster.canvas.tsx <canvases>/acme-project-story.canvas.tsx
node poster.mjs export <canvases>/acme-app-poster.canvas.tsx <canvases>/acme-project-story.canvas.tsx
```

`export` options: `--out <dir>` (default `<canvases>/exports`), `--paper fit|a4|letter` (default `fit`: one page sized to the poster), `--no-png`, `--no-pdf`. The grid toggle is hidden in exports.

Page 2 rules apply when the filename contains `project-story`; everything else is checked as page 1.

## What `check` enforces

Errors (✗) fail the run. Warnings (!) are copy edits to consider.

| Rule | Level |
|------|-------|
| Imports only `cursor/canvas`; no `fetch` | ✗ |
| Renders without throwing (e.g. 5 transit stations) | ✗ |
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
| Jargon from plain-language-rules.md (page 2 adds marketing words) | ! |
| Taller than 1300px; sideways scroll in a 720px panel | ! |

It does not judge copy quality, empty zones, status honesty, or whether a non-engineer would understand the poster. Those stay on the checklist in `swiss-design-principles.md`.

## How it works

`lib/build.mjs` bundles the canvas with esbuild, swapping `cursor/canvas` for `shim/canvas.tsx` (a `useState`-backed `useCanvasState`). `lib/inspect.js` runs inside the page and measures computed layout. `poster.mjs` drives Playwright.

## Self-test

```bash
npm test
```

This builds fixtures from `poster-starter.md` and `sell-sheet-starter.md`. The starters must pass, and each fixture with a planted bug (line gap, fifth font size, off-baseline rule, drifting overlay, stray import…) must fail with its expected message. It also type-checks both starters. Run it after editing the starters or the checker.

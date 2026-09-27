# explain-app poster tools

Two commands that turn the Swiss rules from prose into something measured, and get the posters out of Cursor.

| Command | What it does |
|---------|--------------|
| `check` | Renders each poster in headless Chromium and fails on rule breaks |
| `export` | Writes a PNG (2×), a PDF and an editable SVG per poster, plus one combined set PDF |

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

`export` options: `--out <dir>` (default `<canvases>/exports`), `--paper fit|a4|letter` (default `fit`: one page sized to the poster), `--no-png`, `--no-pdf`, `--no-svg`. The grid toggle is left out of every export.

**Formats:** the PDF and SVG are vector (sharp at any size); the PNG is for chat and slides. The SVG has live text and plain shapes — no `<foreignObject>` — so it opens as editable layers in Figma or Illustrator. Text keeps its font name (Helvetica Neue); install it, or swap it, where you edit.

Page 2 rules apply when the filename contains `project-story`; everything else is checked as page 1. A poster rendered inside `[data-poster-style="block"]` (the Block style's `BlockSheet`) is checked with the Block ruleset.

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
| Text is ink, ink-soft, or the single red full stop (+ toggle); rules are ink; CSS backgrounds paper or ink; no gradients or shadows | ✗ |
| SVG figures: drawn 1:1 (viewBox = rendered size), on column lines, heights multiples of 8; no text, gradients, filters or images inside; colours from the palette; one red shape at most; no yellow stroke under 8px; `role="img"` + `aria-label` | ✗ |
| Flush-left (no centred or justified text); grotesque sans | ✗ |
| Transit segments join station dots centre to centre; branches join their ring (`data-transit` markers) | ✗ |
| Grid overlay columns match the content columns; a "Show grid" toggle exists | ✗ |
| Text contrast ≥ 4.5:1 against its nearest opaque background (3:1 at 24px+) | ✗ |
| **Block style:** sheet exactly 1028×1454; no text on the colour field; backgrounds paper/ink/status colours; blocks connected (each sits on the one above, 2+ columns of overlap) and clear of the legend; field is one hue with `feGaussianBlur` only; title 64/72/80px | ✗ |
| No file paths in visible copy | ✗ |
| No sideways scroll at 1440px and 1028px | ✗ |
| Jargon from plain-language-rules.md (page 2 adds marketing words) | ! |
| Taller than an A-series sheet (1454px); sideways scroll in a 720px panel (Swiss only — Block is a fixed sheet) | ! |

It does not judge copy quality, empty zones, status honesty, or whether a non-engineer would understand the poster. Those stay on the checklist in `swiss-design-principles.md`.

## How it works

`lib/build.mjs` bundles the canvas with esbuild, swapping `cursor/canvas` for `shim/canvas.tsx` (a `useState`-backed `useCanvasState`). `lib/inspect.js` runs inside the page and measures computed layout. `lib/to-svg.mjs` wraps [dom-to-svg](https://github.com/felixfbecker/dom-to-svg) and fixes three things for exact, editable output: it drops forced `textLength` stretching, puts text on alphabetic baselines, and paints borders inside the box as CSS does. The Block style's colour field is copied in verbatim as the bottom layer, since dom-to-svg misorders it against the z-indexed content. `poster.mjs` drives Playwright.

## Self-test

```bash
npm test
```

This composes fixtures from `poster-kit.md` (plus `block-kit.md` for Block) and each page: the four starters and the filled Hypher showcases in both styles, in `test/fixtures/`. Those must pass with no warnings. About 30 fixtures with a planted bug (line gap, scaled SVG, blue body text, thin yellow stroke, text inside SVG, fifth font size, drifting overlay, stray import, and for Block: white on yellow, text on the field, a detached block, a second hue, a colour-matrix filter, a short sheet…) must each fail with their expected message. It type-checks every clean poster, and it exports the showcase and requires the SVG to render within 1% of the PNG, with live text — and proves that metric fails when artwork is missing. Run it after editing the kit, the starters, or the checker.

# Poster Layout (Page 1 — App Guide)

Section spec for explain-app deliverables. Read [swiss-design-principles.md](swiss-design-principles.md) first — always.

The output is a **two-page Swiss Style poster set** on light paper. Not a dark UI mockup. Not a scrolling document.

| Page | File | Job |
|------|------|-----|
| 1 — App Guide | `<repo-name>-app-poster.canvas.tsx` | How the app **and the code behind it** work, in plain English |
| 2 — Project Story | `<repo-name>-project-story.canvas.tsx` | The summary / marketing sheet — tagline, talking points, what's real |

Page 2 layout: [sell-sheet-layout.md](sell-sheet-layout.md)

## File Location

```
~/.cursor/projects/<workspace>/canvases/<repo-name>-app-poster.canvas.tsx
~/.cursor/projects/<workspace>/canvases/<repo-name>-project-story.canvas.tsx
```

- Default-export one React component
- Import only from `cursor/canvas`
- Inline all copy — no `fetch`, no helper files
- Portrait, no taller than an A-series sheet at poster width (1028 × 1454px)

## Palette (fixed — see swiss-design-principles.md)

Paper, ink, ink-soft and the three primaries — red (the product), blue (data), yellow (output). Constants live in [poster-kit.md](poster-kit.md). Type and rules are ink; colour appears only in the SVG figures, plus the red full stop and the grid toggle.

## Grid constants

```tsx
const COLS = 12;
const BL = 8;        // baseline unit
const LH = 24;       // leading = 3 × BL
const GUTTER = 24;
const MARGIN = 64;   // wide margins = serenity
const MAXW = 900;
```

## Structure

One `.wrap` container — **content and grid overlay both inside it**:

```tsx
<div style={{ maxWidth: MAXW, margin: "0 auto", padding: MARGIN, background: PAPER, color: INK, position: "relative" }}>
  {showGrid && <GridOverlay />}
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, columnGap: GUTTER, rowGap: LH }}>
    {/* bands */}
  </div>
</div>
```

Each row is a band spanning `gridColumn: "1 / -1"` with the same 12-column subgrid.

## Row-by-row spec

### Row 1 — Folio + major rule (all 12 cols)

| cols 1–4 | cols 5–9 | cols 10–12 |
|----------|----------|------------|
| APP GUIDE — 01 (10px, uppercase, letter-spacing 0.08em) | One-line promise, ink-soft, sentence case | Platform · audience (ink-soft, right-aligned) |

Directly below: **2px ink rule**, full width. Type hangs from the ruler (Vignelli).

### Row 2 — Masthead (cols 1–12)

Product name at **104–128px** in a multiple of 8 (112 default — keeps the baseline lock), weight 700, letter-spacing −0.03em, lineHeight = fontSize in px, on **one line** when it fits (stack only names that overflow at 104px). Close with a **red full stop** — the poster set's single accent mark.

Optical nudge: `marginLeft: "-0.05em"` so ink, not the box, hits column line 1.

### Row 3 — Purpose (cols 1–5) + hero figure (cols 7–12)

Purpose: one sentence, 14px/24px, **INK** (not gray). The white space below it, down to the hero's baseline, is the poster's deliberate empty zone — do not fill it.

Hero: `<HeroFigure seed={product} span={6} height={232} rings={…} dataRing={…} outputRing={…} />`. `rings` = journeys + stations, capped at 6. Point `dataRing` and `outputRing` at the rings that stand for the data station and the output station.

### Row 4 — Journeys band ("What you do")

Section label (10px uppercase) across cols 1–12, then one column per journey:

- **Giant numeral** — 40–48px, weight 700, ink, lineHeight 48px
- Below it: one short body line (14px/24px, ink), max two lines

Three journeys → 4-col spans (cols 1–4, 5–8, 9–12). Two journeys → 6-col spans. Four journeys → 3-col spans. Any other count is not allowed — the starter's `spanFor` throws. Never render step numbers at body size. Do not leave the 3-journey case on 3-col spans.

### Row 4b — What it looks like (screen schematics)

Section label across cols 1–12, then **3 or 4** `ScreenSchematic`s on 4-col or 3-col spans — the app's real, most-used screens, in the order a user meets them. Pick each `preset` from the screen's actual layout (`landing`, `dashboard`, `list`, `canvas`, `form`, `detail`, `settings`, `chat`). A folio label with the screen's customer-facing name sits under each.

Highlight at most one block per schematic, and only with its role colour: blue where the user's data goes in or is kept, yellow where a result comes back. Most schematics have no highlight.

### Row 5 — Under the hood (cols 1–12) — the code story

This band answers "how does the code work?" for a non-technical reader. Two parts:

**5a. Transit-line diagram** — `TransitLine` from the kit, drawn in SVG: one horizontal 2px ink line with **3, 4, or 6** solid ink dots (never 5). Place each station on the **12-column grid**: 3 stations → 4-col span, 4 stations → 3-col span, 6 stations → 2-col span. Do not use `repeat(stations.length, 1fr)` or `COLS / n` (5 stations gives a fractional span the browser silently drops). The line segment runs from each dot's centre **across the gutter** to the next dot's centre. Under each dot, flush-left: a 10px uppercase station label + one plain-verb line in ink-soft ("saved instantly", "a summary is written"). Stations narrate the pipeline: what you do → where it's stored → what processes it → what comes back out. Branch steps (optional paths) leave the line at 90° with a hollow ring. Keep branch labels short enough to wrap — no `whiteSpace: "nowrap"` that collides with the next station. Give the station where data is saved `role: "data"` (blue) and the one where something comes back `role: "output"` (yellow); the rest stay ink.

**5b. "When you…" lines** — below the diagram, 2–3 columns (4 cols each): each a bold lead-in ("When you save a note,") followed by the plain consequence ("it's stored in your database and synced to every open tab."). Name **services**, not SDKs.

No boxes, no dashed borders, no centered labels, no arrowheads on the main line.

### Row 6 — Two-column body — 6 + 6

| cols 1–6 | cols 7–12 |
|----------|-----------|
| **The problem** — 2–3 sentences, ink | **Connected** — only services the user can use **today**, one line each. A backend with no UI (e.g. Stripe with no checkout screen) goes in the footer, not here. |

The screens now have their own band (4b), so there is no text list of screens.

Column labels: 10px uppercase, letter-spacing 0.06em, weight 600, with a 1px ink hairline above each label (type hangs from the rule).

### Row 7 — Footer (all 12 cols)

1px hairline above (taken out of the top padding so the footer stays on the baseline). Three zones, 10px/16px, ink-soft, all flush-left except the last:

- cols 1–5: Not built / server-only items (comma-separated). **Same list as page 2 footer.**
- cols 6–9: "For [handoff audience]" — who is **reading** the poster (client, PM, operator), not who the product is for. Product audience lives in the folio right cell.
- cols 10–12: grid toggle button, right-aligned (text link, ACCENT allowed)

## Typography rules

- Font: `"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`
- Display: 104–128px in multiples of 8, lineHeight = fontSize in px; numerals 40–48px/48px
- Body: 14px, lineHeight 24px, **ink**
- Folio/meta: 10px/16px.
- That is four sizes total (display · numeral · body · folio) — never a fifth, e.g. a 13px caption beside 14px body.
- Folio **label** is ink; folio **meta** is ink-soft
- Flush-left, with two exceptions: folio right cell and grid toggle may be right-aligned. No centered text.

## Optical alignment

Apply `marginLeft: "-0.05em"` to the masthead and `-0.03em` to giant numerals so **ink** aligns to the column line, not the layout box.

## Grid overlay

When `showGrid`:

- Position absolute on an outer `inset: 0` layer, then column fields at `inset: MARGIN` (aligns with wrap padding)
- 12 column fields with `GRID_FIELD` background, same `columnGap` as content
- Horizontal lines every 8px (minor) and 24px (major, slightly darker)
- Left/right margin lines at padding edge

## Components to avoid

No `Stack`, `Card`, `Callout`, `Stat`, `Table`, `CollapsibleSection`, `Pill` as primary layout.

Allowed from `cursor/canvas`: `useCanvasState`, `useHostTheme` (for grid toggle focus state only — not poster colors). All figures come from [poster-kit.md](poster-kit.md).

## Empty state

No app detected → no poster. Report honestly.

## Legacy variants removed

Do not use Modular / Editorial / Redacted variant names. There is one Swiss poster system. Color blocks, dark "redacted" layouts, and boxed flowchart diagrams are explicitly forbidden — see anti-patterns in swiss-design-principles.md.

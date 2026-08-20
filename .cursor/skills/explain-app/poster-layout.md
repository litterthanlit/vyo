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
- Single viewport, ~900×1150px portrait, minimal scroll

## Palette (fixed — see swiss-design-principles.md)

```tsx
const PAPER = "#FFFFFF";
const INK = "#0A0A0A";
const INK_SOFT = "#5B6066";
const ACCENT = "#E4002B";
const GRID_FIELD = "rgba(228, 0, 43, 0.08)";
```

Accent appears **once** as an editorial mark — the red full stop after the masthead. Rules, dots, and numerals are ink. The grid toggle may use accent (functional chrome).

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

Product name at **96–128px**, weight 700, letter-spacing −0.03em, lineHeight = fontSize in px, on **one line** when it fits (stack only names that overflow at 96px). Close with a **red full stop** — the poster set's single accent mark.

Optical nudge: `marginLeft: "-0.05em"` so ink, not the box, hits column line 1.

### Row 3 — Purpose (cols 1–7; cols 8–12 empty)

One sentence, 13–14px/24px, **INK** (not gray), max-width ~28em. The empty right zone is deliberate — do not fill it.

### Row 4 — Journeys band ("What you do")

Section label (10px uppercase) across cols 1–12, then one column per journey:

- **Giant numeral** — 40–48px, weight 700, ink, lineHeight 48px
- Below it: one short body line (13px/24px, ink), max two lines

Three journeys → 4-col spans (cols 1–4, 5–8, 9–12). Two journeys → 6-col spans. Four journeys → 3-col spans. Never render step numbers at body size. Do not leave the 3-journey case on 3-col spans.

### Row 5 — Under the hood (cols 1–12) — the code story

This band answers "how does the code work?" for a non-technical reader. Two parts:

**5a. Transit-line diagram** — one horizontal 2px ink line with **3, 4, or 6** solid ink dots (never 5). Place each station on the **12-column grid**: 3 stations → 4-col span, 4 stations → 3-col span, 6 stations → 2-col span. Do not use `repeat(stations.length, 1fr)`. Under each dot, flush-left: a 10px uppercase station label + one plain-verb line in ink-soft ("saved instantly", "a summary is written"). Stations narrate the pipeline: what you do → where it's stored → what processes it → what comes back out. Branch steps (optional paths) leave the line at 90° with a hollow ring. Keep branch labels short enough to wrap — no `whiteSpace: "nowrap"` that collides with the next station.

**5b. "When you…" lines** — below the diagram, 2–3 columns (4 cols each): each a bold lead-in ("When you save a note,") followed by the plain consequence ("it's stored in your database and synced to every open tab."). Name **services**, not SDKs.

No boxes, no dashed borders, no centered labels, no arrowheads on the main line.

### Row 6 — Three-column body — 4 + 4 + 4

| cols 1–4 | cols 5–8 | cols 9–12 |
|----------|----------|-----------|
| **The problem** — 2–3 sentences, ink | **The screens** — main app areas as short lines, no paths | **Connected** — only services the user can use **today**, one line each. A backend with no UI (e.g. Stripe with no checkout screen) goes in the footer, not here. |

Column labels: 10px uppercase, letter-spacing 0.06em, weight 600, with a 1px ink hairline above each label (type hangs from the rule).

### Row 7 — Footer (all 12 cols)

1px hairline above. Three zones, 10px/16px, ink-soft, all flush-left except the last:

- cols 1–5: Not built / server-only items (comma-separated). **Same list as page 2 footer.**
- cols 6–9: "For [handoff audience]" — who is **reading** the poster (client, PM, operator), not who the product is for. Product audience lives in the folio right cell.
- cols 10–12: grid toggle button, right-aligned (text link, ACCENT allowed)

## Typography rules

- Font: `"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`
- Display: 96–128px, lineHeight = fontSize in px; numerals 40–48px/48px
- Body: 13–14px, lineHeight 24px, **ink**
- Folio/meta: 10–11px/16px. Folio **label** is ink; folio **meta** is ink-soft
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

Allowed from `cursor/canvas`: `useCanvasState`, `useHostTheme` (for grid toggle focus state only — not poster colors).

## Empty state

No app detected → no poster. Report honestly.

## Legacy variants removed

Do not use Modular / Editorial / Redacted variant names. There is one Swiss poster system. Color blocks, dark "redacted" layouts, and boxed flowchart diagrams are explicitly forbidden — see anti-patterns in swiss-design-principles.md.

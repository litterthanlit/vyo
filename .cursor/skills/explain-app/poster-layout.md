# Poster Layout

Section spec for explain-app deliverables. Read [swiss-design-principles.md](swiss-design-principles.md) first — always.

The output is a **single-page Swiss Style poster** on light paper. Not a dark UI mockup. Not a scrolling document.

## File Location

```
~/.cursor/projects/<workspace>/canvases/<repo-name>-app-poster.canvas.tsx
```

- Default-export one React component
- Import only from `cursor/canvas`
- Inline all copy — no `fetch`, no helper files
- Single viewport, ~900×1100px portrait, minimal scroll

## Palette (fixed — see swiss-design-principles.md)

```tsx
const PAPER = "#FFFFFF";
const INK = "#0A0A0A";
const INK_SOFT = "#5B6066";
const ACCENT = "#E4002B";
const GRID_FIELD = "rgba(228, 0, 43, 0.08)";
```

Use Vignelli canon values only. Do not use `theme.category.*` rainbow colors.

## Grid constants

```tsx
const COLS = 12;
const BL = 8;        // baseline unit
const LH = 24;       // leading = 3 × BL
const GUTTER = 24;
const MARGIN = 48;
const MAXW = 900;
```

## Structure

One `.wrap` container — **content and grid overlay both inside it**:

```tsx
<div style={{ maxWidth: MAXW, margin: "0 auto", padding: MARGIN, background: PAPER, color: INK, position: "relative" }}>
  {showGrid && <GridOverlay />}
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, columnGap: GUTTER, rowGap: BL * 2 }}>
    {/* bands */}
  </div>
</div>
```

Each row is a band spanning `gridColumn: "1 / -1"` with the same 12-column subgrid.

## Row-by-row spec

### Row 1 — Folio (all 12 cols)

| cols 1–4 | cols 5–8 | cols 9–12 |
|----------|----------|-----------|
| APP GUIDE (11px, uppercase, letter-spacing 0.08em) | Audience (ink-soft) | Platform (ink-soft, right-aligned) |

### Row 2–5 — Masthead band

| cols 1–7 | cols 8–12 |
|----------|-----------|
| Product name stacked, 56–64px, weight 700, lineHeight in px, marginLeft optical nudge | Numbered journeys (1–4), 12px, flush-left, one line each |

Below masthead (cols 1–7): purpose sentence, 14px/24px.

### Row 6 — Accent rule

Full width. `height: 2px`, `background: ACCENT`, sits on a baseline band (padding/margin = BL multiple).

### Row 6b — Flow diagrams (recommended when repo has 3+ screens or journeys)

Two diagrams, stacked. Use inline SVG — **90° and 45° angles only** (Vignelli transit rule). Stroke 2px ink; primary path may use ACCENT.

| Diagram | cols | Purpose |
|---------|------|---------|
| **User journey** | 1–6 | Capture → Canvas → Digest → Share with elbow arrows |
| **App map** | 7–12 | Screen/route nodes: Landing → App → Project canvas → Settings |

Node style: 10px uppercase label inside a 1px ink border box, min-height = 2× baseline (32px). Arrows: SVG `<path>` with `marker-end` triangle, no curves.

Between body columns, optional `→` SVG connectors at column-header level to show reading order: Problem → How it works → Connected.

### Row 7–10 — Three-column body

| cols 1–4 | cols 5–8 | cols 9–12 |
|----------|----------|-----------|
| **The problem** — label 11px uppercase, body 12px/24px, 2–3 sentences | **How it works** — main app areas as short lines, no paths | **Connected** — services + one "when you X" line each |

Column labels: uppercase, letter-spacing 0.06em, weight 600.

### Row 11 — Footer (all 12 cols)

Three zones, 10px, ink-soft:

- Left: SERVER / not-built items (comma-separated)
- Center: "For [audience]"
- Right: grid toggle button (no border, text link style in ACCENT)

## Typography rules

- Font: `"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`
- Display: one size (56–64px), lineHeight equals fontSize in px
- Body: 12–14px, lineHeight 24px
- **Two sizes on the poster** (+ folio at body scale)
- Flush-left only. No centered body text.

## Optical alignment

After render, apply left margin to display type equal to first glyph side-bearing. In canvas, approximate with `marginLeft: -0.04em` on masthead or measure with canvas API if feasible. Goal: **ink** aligns to column 1 line.

## Grid overlay

When `showGrid`:

- Position absolute, `inset: 0`, same padding as content
- 12 column fields with `GRID_FIELD` background
- Horizontal lines every 8px (minor) and 24px (major, slightly darker)
- Left/right margin lines at padding edge

## Components to avoid

No `Stack`, `Card`, `Callout`, `Stat`, `Table`, `CollapsibleSection`, `Pill` as primary layout.

Allowed from `cursor/canvas`: `useCanvasState`, `useHostTheme` (for grid toggle focus state only — not poster colors).

## Empty state

No app detected → no poster. Report honestly.

## Legacy variants removed

Do not use Modular / Editorial / Redacted variant names. There is one Swiss poster system. Color blocks and dark "redacted" layouts are explicitly forbidden — see anti-patterns in swiss-design-principles.md.

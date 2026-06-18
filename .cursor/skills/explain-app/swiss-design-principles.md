# Swiss Design Principles

Canonical rules for explain-app poster canvases. Synthesized from:

- [hyperagent-public-skills](https://github.com/alexmcdonnell-airtable/hyperagent-public-skills) — `skill-muller-brockmann-grid-systems`, `skill-vignelli-canon-design-system`
- International Typographic Style (Swiss Style) reference posters

Read this **before** [poster-layout.md](poster-layout.md). Design discipline comes first; layout second.

---

## Creed

> A grid you can't toggle on and measure is a mood board, not a system.

> Design without semantics is shallow. — Vignelli

> The grid system is an aid, not a guarantee. — Müller-Brockmann

Posters explain **what the app means** (semantics) using **objective typography and a real grid** (syntactics). If the layout is visible as decoration, it's probably wrong.

---

## Intangibles (decide before drawing)

1. **Semantics** — What is this app, for whom, and why does it exist? One sentence distilled from recon.
2. **Appropriateness** — Poster for a client handoff, not a marketing splash. Restraint over spectacle.
3. **Discipline** — Self-imposed rules: one grid, one accent, two type sizes, flush-left only.
4. **Timelessness** — Primary shapes, primary palette, grotesque sans. No trends, no gradients, no emoji.

---

## Tangibles

### Grid (Müller-Brockmann)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Columns | **12** | Place every element by column **line**, not eyeballed spans |
| Baseline unit | **8px** | All spacing and leading are multiples of 8 |
| Leading | **24px** (3× baseline) | Body text line-height in **px**, not unitless |
| Gutter | **24px** | Must be baseline multiple |
| Margin | **48px** or **64px** | Generous; tight margins = tension, wide = serenity |
| Max width | **900px** | Content box; grid overlay lives **inside this same box** |

**Critical:** The grid overlay and content share one container. Never draw overlay as a full-width sibling of a centered max-width box — columns will drift.

**Subgrid bands:** Each horizontal row spans all 12 columns and re-exposes them. Children use `grid-column: start / end` (e.g. `1 / 7`, `7 / 13`).

### Typography (Vignelli + Müller-Brockmann)

| Role | Size | Leading | Weight |
|------|------|---------|--------|
| Display (product name) | 48–72px | 48–72px (px values) | 700 |
| Body | 12–14px | 24px | 400 |
| Folio / meta / footer | 10–11px | 16px | 400–500 |

Rules:

- **Grotesque sans only:** `"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`
- **Flush-left, ragged-right.** Never center body copy. Never justify.
- **Two sizes maximum** on the poster surface (display + body). Folio counts as body scale.
- Hierarchy through **scale, weight, and white space** — not color, not novelty faces.
- **Optical alignment:** Large display type has left side-bearing inset. Nudge display elements so **ink** aligns to the column line, not just the layout box.

### Palette (Vignelli canon — always light paper)

Posters always render on **light paper**, regardless of IDE dark/light host theme.

| Role | Hex | Usage |
|------|-----|-------|
| Paper | `#FFFFFF` | Field background |
| Ink | `#0A0A0A` | Primary text |
| Ink soft | `#5B6066` | Secondary text, meta |
| Accent | `#E4002B` | **One element only** — rule, label, or single highlight |
| Grid guide | `rgba(228, 0, 43, 0.08)` | Column fields when overlay is on |

**Forbidden:**

- Dark-mode poster fields
- Rainbow accent tabs (yellow/blue/pink blocks)
- Gradients, box-shadows, emojis
- Blue/purple AI-slop palettes
- Warm cream "Claude look" backgrounds
- More than one accent color

This is the **only** explain-app exception to the canvas skill's `useHostTheme()` color rule — Swiss posters require fixed paper/ink/accent for objective legibility.

### White space

White space is the protagonist. Don't fill the page. Asymmetric compositions held by the grid, not by decorative blocks.

If you can't justify an element with information hierarchy, delete it.

---

## Content hierarchy (semantics → layout)

Map recon to these zones in order:

| Zone | Grid | Content |
|------|------|---------|
| Folio row | 12 cols | Left: "App Guide" · Right: audience, platform, date |
| Masthead | cols 1–7 | Stacked product name (display size) |
| Purpose | cols 1–7 | One sentence, body size, below masthead |
| Meta column | cols 8–12 | 3–4 numbered user journeys (short, one line each) |
| Rule | cols 1–12 | 2px accent hairline on baseline band |
| Body | 3× cols 4 each | Problem · How it works · Connected services |
| Footer | cols 1–12 | Status honesty (SERVER items), audience note, grid toggle |

No "journey tabs" as colored rectangles. Use **numbers + flush-left lines** (Swiss objectivity).

### Flow diagrams (wayfinding)

When the app has multiple screens or journeys, add **one or two inline SVG diagrams**:

- **User journey** — primary path the human takes (Capture → Canvas → Digest → Share)
- **App map** — screens/routes as labeled nodes connected by 90° arrows
- **Service ingress** (optional) — external services (Clerk, Convex, Claude) with arrows into the app core

Rules (from Vignelli transit canon):

- Angles: **90° and 45° only** — no bezier curves
- Stroke: 2px ink; primary flow path may use accent red
- Nodes: rectangular, 1px border, uppercase 10px labels
- Arrows: geometric triangle markers, not emoji or icon fonts
- Purpose: clarify sequence and repo structure — if a diagram doesn't teach, omit it

---

## Grid toggle

- `useCanvasState("showGrid", false)`
- Toggle draws column fields + baseline lines **inside the same `.wrap` as content**
- Button label: "Show grid" / "Hide grid" — folio size, ink-soft color
- Column fields: translucent accent tint; baseline: major every 24px, minor every 8px

---

## Pre-delivery checklist

Swiss quality gate — all must pass:

- [ ] Light paper field — not dark, not host-theme tinted
- [ ] 12-column grid; elements placed by column line
- [ ] 8px baseline; body leading = 24px in px
- [ ] Two type sizes only (display + body/folio)
- [ ] Flush-left throughout; no centered paragraphs
- [ ] One accent color, one usage
- [ ] Grid overlay shares content box with content
- [ ] No rainbow blocks, no Card/Callout document components
- [ ] Display type optically aligned to column line
- [ ] Non-engineer understands the app from the poster alone
- [ ] Backend-only features marked in footer, not as user journeys

---

## Anti-patterns (what went wrong before)

| Bad | Why | Fix |
|-----|-----|-----|
| Dark field + black blocks | Not Swiss; reads as "redacted/censored" UI | White paper, ink type |
| Colored journey tabs | Rainbow decoration; not objective | Numbered list, typographic hierarchy |
| 4-column grid with no baseline | Grid as decoration | 12-col + 8px baseline lock |
| Host dark theme colors | Breaks paper/ink discipline | Vignelli canon palette |
| Stack of canvas components | Document, not poster | Raw grid + inline styles |

---

## Source attribution

Integrated from [hyperagent-public-skills](https://github.com/alexmcdonnell-airtable/hyperagent-public-skills):

- **Müller-Brockmann Grid Systems** — modular grid, baseline lock, overlay engineering, optical alignment
- **Vignelli Canon** — semantics first, two type sizes, Helvetica, primary palette, white space

Full skill bodies: [references/hyperagent/](references/hyperagent/)

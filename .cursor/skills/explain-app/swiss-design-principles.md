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
3. **Discipline** — Self-imposed rules: one grid, one accent, two type **roles** (display + body), flush-left with two allowed exceptions.
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
| Display (product name / page-2 tagline) | **96–128px** page 1 · **64–80px** page 2 | = fontSize (px values) | 700 |
| Display numerals (journeys, talking points) | 40–48px | 48px | 700 |
| Body | 13–14px | 24px | 400 |
| Folio / meta / footer | 10–11px | 16px | 400–500 |

Rules:

- **Grotesque sans only:** `"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`
- **Flush-left, ragged-right.** Never center body copy. Never justify. Never center labels inside diagram nodes. **Two exceptions:** folio right cell (platform · audience) and the grid-toggle link may be `textAlign: "right"`.
- **Two type roles maximum** on the poster surface: display and body. Giant numerals belong to the display role; folio belongs to the body role. That is four sizes, two roles — do not invent a fifth.
- Hierarchy through **scale, weight, and white space** — not color, not novelty faces.
- **Optical alignment:** Large display type has left side-bearing inset. Nudge display elements so **ink** aligns to the column line, not just the layout box.

### Scale contrast (the #1 reason posters feel un-designed)

A 48–64px masthead on a 900px canvas reads as a *document header*. Real Swiss posters live on violent scale contrast:

- **Display : body ratio ≥ 7:1** on page 1 (e.g. 112px display over 13px body). Page 2 tagline may sit at 64–80px because it runs multiple lines.
- **Set the numbers big.** Journey steps and talking points get display-scale numerals (40–48px) with body copy beside or beneath them — Müller-Brockmann's signature move. Never render step numbers at body size.
- **Ink first.** Primary copy — purpose sentence, body columns, journey text — is set in INK. INK_SOFT is reserved for folio, captions, and status lines only. A page of gray body copy is mush; black makes the white sing.
- **Rules carry structure:** one 2px ink rule under the folio (type hangs from the ruler — Vignelli), 1px hairlines elsewhere. Rules are **ink**, not accent.

### Palette (Vignelli canon — always light paper)

Posters always render on **light paper**, regardless of IDE dark/light host theme.

| Role | Hex | Usage |
|------|-----|-------|
| Paper | `#FFFFFF` | Field background |
| Ink | `#0A0A0A` | Primary text, rules, diagram lines |
| Ink soft | `#5B6066` | Folio **meta**, captions, status lines only. The folio **label** ("App Guide — 01") is ink. |
| Accent | `#E4002B` | **One editorial mark only** — canonical: the red full stop after the masthead |
| Grid guide | `rgba(228, 0, 43, 0.08)` | Column fields when overlay is on |

**The single accent mark.** The canonical accent usage is a **red full stop closing the masthead** ("Hypher<span style=red>.</span>" / "…one place<span style=red>.</span>"). It brands both pages as a set and forces restraint everywhere else. Rules, arrows, dots, numerals, and node borders are all ink. The grid-toggle link may also use accent — it is functional chrome, not part of the composition.

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

Concrete obligations, not vibes:

- **At least one deliberately empty zone per poster** — e.g. the purpose sentence occupies cols 1–7 and cols 8–12 stay blank. Emptiness beside the masthead is what makes it feel like a poster.
- Never widen copy to fill a span. Cap the purpose sentence at ~28em and let the rag breathe.
- If two adjacent bands have equal visual weight, cut or shrink one. Symmetric fullness is the document look.

If you can't justify an element with information hierarchy, delete it.

---

## Content hierarchy (semantics → layout)

Map recon to these zones in order (full row spec: [poster-layout.md](poster-layout.md)):

| Zone | Grid | Content |
|------|------|---------|
| Folio row + 2px ink rule | 12 cols | Left: "App Guide — 01" · Center: one-line promise · Right: platform, audience |
| Masthead | cols 1–12 | Product name, 96–128px, one line if it fits, **red full stop** |
| Purpose | cols 1–7 | One sentence, body size, INK — cols 8–12 stay empty |
| Journeys band | 4× cols 3 | Giant numeral (40–48px) + one short body line each |
| Under the hood | cols 1–12 | Transit-line diagram + "when you X, the app Y" lines — the plain-English code story |
| Body | 3× cols 4 each | Problem · The screens · Connected services |
| Footer | cols 1–12 | Status honesty (not-built items), audience note, grid toggle |

No "journey tabs" as colored rectangles. Use **giant numerals + flush-left lines** (Swiss objectivity).

### Diagrams: transit lines, not flowcharts

Boxed flowcharts — little bordered rectangles with centered uppercase labels and stubby arrows — read as engineering whiteboard clip-art. **Do not draw them.** Use the Vignelli transit vocabulary instead:

- **One horizontal 2px ink line** spanning the band, with **solid ink dots** (10–12px) as stations
- Station labels **below the dots, flush-left**, body or folio size; a one-word plain verb line under each label if needed
- Stations are **3, 4, or 6** — those counts land on the 12-column grid (4-col, 3-col, or 2-col spans). **Never 5.** Use the same `subgrid` as the rest of the poster, not `repeat(stations.length, 1fr)`.
- Branches (e.g. an optional share step) leave the line at **90°** with a short vertical stroke and a hollow ring (sometimes-stops)
- No boxes unless a node truly is a *screen* the user visits; then a 1px ink border with a **flush-left** 10px uppercase label
- No dashed borders, no bezier curves, no arrowheads on the main line — dots imply sequence left to right
- Purpose: teach sequence. If a diagram doesn't teach, omit it

---

## Grid toggle

- Page 1: `useCanvasState("showGridApp", false)` · Page 2: `useCanvasState("showGridStory", false)` — separate keys per poster
- Toggle draws column fields + baseline lines **inside the same `.wrap` as content**
- Button label: "Show grid" / "Hide grid" — folio size, ink-soft color
- Column fields: translucent accent tint; baseline: major every 24px, minor every 8px

---

## Pre-delivery checklist

Swiss quality gate — all must pass:

- [ ] Light paper field — not dark, not host-theme tinted
- [ ] **One outer 12-column grid** — all rows share the same column lines
- [ ] Diagrams use CSS grid inside their span — not fixed-width SVG viewBoxes
- [ ] No negative margins or off-column header decorations
- [ ] 8px baseline; body leading = 24px in px
- [ ] Two type roles only (display incl. numerals + body incl. folio)
- [ ] **Display ≥ 96px on page 1**; display : body ratio ≥ 7:1
- [ ] **Journey/talking-point numerals at display scale**, not body size
- [ ] Primary copy in INK; INK_SOFT limited to folio **meta**, captions, status. Folio **label** is ink.
- [ ] Flush-left throughout except folio right + grid toggle
- [ ] One accent mark (red full stop); rules and diagrams in ink
- [ ] **At least one deliberately empty grid zone**
- [ ] **Transit stations are 3, 4, or 6** on the 12-column grid — never 5, never `repeat(n, 1fr)`
- [ ] Grid overlay shares content box with content
- [ ] No rainbow blocks, no Card/Callout document components
- [ ] Display type optically aligned to column line
- [ ] Non-engineer understands the app from the poster alone
- [ ] "Under the hood" band explains what the code does in plain verbs
- [ ] Backend-only features marked in footer, not as user journeys

---

## Anti-patterns (what went wrong before)

| Bad | Why | Fix |
|-----|-----|-----|
| Dark field + black blocks | Not Swiss; reads as "redacted/censored" UI | White paper, ink type |
| Colored journey tabs | Rainbow decoration; not objective | Giant numerals, typographic hierarchy |
| **64px masthead** | Document header, not a poster | 96–128px display, one line, red full stop |
| **Gray body copy everywhere** | Nothing sings; hierarchy is mush | Ink for primary copy; gray for meta only |
| **Boxed flowchart diagrams** | Whiteboard clip-art; centered labels | Transit line with solid dots, flush-left labels |
| **Accent on rule + boxes + arrows + toggle** | Red everywhere = red nowhere | One red full stop; everything else ink |
| Every zone filled | Symmetric fullness = document look | Leave one empty zone; cap line lengths |
| 4-column grid with no baseline | Grid as decoration | 12-col + 8px baseline lock |
| Host dark theme colors | Breaks paper/ink discipline | Vignelli canon palette |
| Stack of canvas components | Document, not poster | Raw grid + inline styles |
| Nested grid with a **different** column count | Columns drift between bands | Nested 12-col subgrids that re-expose the same 12 lines are fine. Do not nest a 4-col or `repeat(n, 1fr)` inside the 12. |
| Fixed SVG viewBox diagrams | Diagram floats off column lines | CSS grid nodes inside col span |
| **Five transit stations** | Cannot land on 12 columns | Use 3, 4, or 6 only |

---

## Source attribution

Integrated from [hyperagent-public-skills](https://github.com/alexmcdonnell-airtable/hyperagent-public-skills):

- **Müller-Brockmann Grid Systems** — modular grid, baseline lock, overlay engineering, optical alignment
- **Vignelli Canon** — semantics first, two type sizes, Helvetica, primary palette, white space

Full skill bodies: [references/hyperagent/](references/hyperagent/)

# Sell Sheet Layout (Page 2)

Second-page spec for explain-app deliverables. Read [swiss-design-principles.md](swiss-design-principles.md) first — same canon as page 1.

Page 1 explains **how the app works**. Page 2 helps the project owner **feel connected to what they built** and **talk about it confidently** — for sales calls, investor coffees, partner intros, or explaining the project to friends.

Not marketing fluff. Not a pitch deck. Plain language they can actually say out loud.

## File Location

```
~/.cursor/projects/<workspace>/canvases/<repo-name>-project-story.canvas.tsx
```

- Default-export one React component
- Import only from `cursor/canvas`
- Inline all copy — no `fetch`, no helper files
- Single viewport, ~900×1100px portrait, minimal scroll
- Same palette and grid constants as [poster-layout.md](poster-layout.md)

## Purpose vs Page 1

| Page 1 — App Guide | Page 2 — Project Story |
|--------------------|------------------------|
| How the app and its code work | Why the product matters |
| Journeys, screens, under the hood | Who it's for and what pain it solves |
| Connected services | Talking points and one-liners |
| Operator / client handoff | Owner selling, marketing summary |
| Product name as hero | **Tagline as hero** |
| "How it works" | "What to say about it" |

## Structure

Reuse the same `.wrap` container, `Band`, `GridOverlay`, and grid constants from page 1. Do not invent a new visual system.

## Row-by-row spec

### Row 1 — Folio + major rule (all 12 cols)

| cols 1–4 | cols 5–9 | cols 10–12 |
|----------|----------|------------|
| PROJECT STORY — 02 (10px, uppercase) | Owner audience (ink-soft) | Product name (ink-soft, right-aligned) |

Directly below: **2px ink rule**, full width — same treatment as page 1 so the pair reads as a set.

Owner audience examples: "For founders", "For solo builders", "For operators" — whoever owns or sells the product.

### Row 2 — Masthead: the tagline IS the hero

Page 2 is the marketing sheet, so the message leads, not the logo. The product name already owned page 1.

- **Tagline set at display size** — 64–80px, weight 700, letter-spacing −0.03em, lineHeight = fontSize, cols 1–11, breaking over 2–3 lines
- Close with the **red full stop** — the set's single accent mark, same as page 1
- Emotional outcome, not a feature list: "Your ideas, finally in one place." Not: "AI-powered spatial canvas with Convex backend."

### Row 3 — In one breath (cols 1–7; cols 8–12 for Who it's for)

| cols 1–7 | cols 8–12 |
|----------|-----------|
| **In one breath** label + 2–3 sentence script the owner can read aloud at a dinner party or intro call, body size, **ink** | **Who it's for** — ideal person, their situation, the moment they need this (2–4 short lines) |

### Row 4 — Talking points band — 3 × 4 cols

Section label WHAT TO SAY across the band, then three columns, each:

- **Giant numeral** (40–48px, ink, display role — same treatment as page 1 journeys)
- One quoted, speakable sentence below it (13px/24px, ink)

```
1  "Most builders lose ideas across ten tabs — this keeps everything in one workspace."
2  "You capture a thought in seconds; the app organizes it for you."
3  "Share a link when you want someone to see your thinking, not your repo."
```

Use quotation marks — these are lines to say out loud, not bullet fragments.

### Row 5 — Full-width band: What's real today

Span cols 1–12. Label: **WHAT'S REAL TODAY** (10px uppercase, 1px ink hairline above — type hangs from the rule).

3–5 short lines set in **two columns of 6** (not one long list). Honest capability statements — only what users can do or what clearly exists. Same status honesty as page 1. One honest limitation belongs here; it buys trust for everything else.

Example:
- Sign in and land on a personal dashboard
- Capture notes and attach them to a project
- View work on a spatial canvas
- Daily AI digest summarizes recent activity
- Billing is not in the app yet — coming next

### Row 6 — Two-column band: Differentiation

| cols 1–6 | cols 7–12 |
|----------|-----------|
| **How you're different** — 2–3 contrasts vs alternatives (spreadsheet, generic notes app, doing nothing, incumbent competitor) | **The vision** — 2–3 sentences connecting the owner to why they started this; ownership language ("you set out to…", "what you've built…") |

Vision copy should make the owner feel like the product is *theirs*, not a black box an agency handed over.

### Row 7 — Footer (all 12 cols)

1px hairline above. Three zones, 10px/16px, ink-soft:

- cols 1–5: Honest gaps or "coming soon" (comma-separated) — same items as page 1 footer if applicable
- cols 6–9: "Pair with the App Guide — page 01"
- cols 10–12: grid toggle button, right-aligned (same as page 1)

## Copy voice (page 2 only)

Apply [plain-language-rules.md](plain-language-rules.md) plus these additions:

- Address the **owner** directly: "you", "your product", "what you've built"
- Write **speakable** lines — if they wouldn't say it on a call, rewrite it
- Lead with **stakes and outcomes**, not screens
- One honest limitation in the footer or "what's real" band is better than hype that breaks trust
- No investor jargon (TAM, moat, ARR) unless `project-context.md` says exec/investor audience
- No file paths, stack names, or architecture on this page

## When to omit zones

Same rule as page 1: if a zone has no real content after recon, omit it — never placeholder blocks.

If differentiation is unclear from the repo, write contrasts vs **generic alternatives** (spreadsheets, scattered notes, manual process) rather than inventing named competitors.

## Components to avoid

Same as poster-layout.md — no document-style canvas components as primary layout.

## Empty state

If page 1 cannot be produced (no app detected), do not produce page 2 either.

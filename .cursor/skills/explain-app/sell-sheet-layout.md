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
| What the product does | Why the product matters |
| User journeys and screens | Who it's for and what pain it solves |
| Connected services | Talking points and one-liners |
| Operator / client handoff | Owner selling and storytelling |
| "How it works" | "What to say about it" |

## Structure

Reuse the same `.wrap` container, `Band`, `GridOverlay`, and grid constants from page 1. Do not invent a new visual system.

## Row-by-row spec

### Row 1 — Folio (all 12 cols)

| cols 1–4 | cols 5–8 | cols 9–12 |
|----------|----------|-----------|
| PROJECT STORY (11px, uppercase) | Owner audience (ink-soft) | "Page 2" (ink-soft, right-aligned) |

Owner audience examples: "For founders", "For solo builders", "For operators" — whoever owns or sells the product.

### Row 2–4 — Masthead band

| cols 1–8 | cols 9–12 |
|----------|-----------|
| Product name (display size) + **tagline** — emotional outcome, not feature list (14px/24px, ink-soft) | **In one breath** label + 2–3 sentence script they can read aloud at a dinner party or intro call |

Tagline example: "Your ideas, finally in one place." Not: "AI-powered spatial canvas with Convex backend."

### Row 5 — Accent rule

Full width. Same as page 1.

### Row 6–9 — Three-column body

| cols 1–4 | cols 5–8 | cols 9–12 |
|----------|----------|-----------|
| **Who it's for** — ideal person, their situation, the moment they need this (2–4 short lines) | **Why they'll care** — outcomes in the customer's language; feelings and results, not features (2–4 short lines) | **What to say** — 3 numbered talking points, each one sentence, ready to use verbatim |

Talking points format:

```
1. "Most builders lose ideas across ten tabs — this keeps everything in one workspace."
2. "You capture a thought in seconds; the app organizes it for you."
3. "Share a link when you want someone to see your thinking, not your repo."
```

Use quotation marks on talking points when they are speakable lines.

### Row 10 — Full-width band: What's real today

Span cols 1–12. Label: **WHAT'S REAL TODAY** (uppercase).

3–5 bullet lines. Honest capability statements — only what users can do or what clearly exists. Use the same status honesty as page 1. This builds selling confidence without overselling.

Example:
- Sign in and land on a personal dashboard
- Capture notes and attach them to a project
- View work on a spatial canvas
- Daily AI digest summarizes recent activity
- Billing is not in the app yet — coming next

### Row 11 — Two-column band: Differentiation

| cols 1–6 | cols 7–12 |
|----------|-----------|
| **How you're different** — 2–3 contrasts vs alternatives (spreadsheet, generic notes app, doing nothing, incumbent competitor) | **The vision** — 2–3 sentences connecting the owner to why they started this; ownership language ("you set out to…", "what you've built…") |

Vision copy should make the owner feel like the product is *theirs*, not a black box an agency handed over.

### Row 12 — Footer (all 12 cols)

Three zones, 10px, ink-soft:

- Left: Honest gaps or "coming soon" (comma-separated) — same items as page 1 footer if applicable
- Center: "Pair with the App Guide (page 1)"
- Right: grid toggle button (same as page 1)

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

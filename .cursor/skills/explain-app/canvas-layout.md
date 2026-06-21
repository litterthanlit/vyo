# Canvas Layout (Legacy Document Style)

> **Prefer [poster-layout.md](poster-layout.md)** for all new explain-app deliverables.
> This file describes the older scrolling document-style canvas. Use it only when the user explicitly asks for a traditional guide layout instead of a Swiss Style poster.

Section spec for explain-app deliverables. Read the canvas skill at `~/.cursor/skills-cursor/canvas/SKILL.md` and `~/.cursor/skills-cursor/canvas/sdk/index.d.ts` before authoring.

## File Location

```
~/.cursor/projects/<workspace>/canvases/<repo-name>-app-guide.canvas.tsx
```

- Default-export one React component
- Import only from `cursor/canvas`
- Inline all copy and data — no `fetch`, no helper files
- Colors via `useHostTheme()` only

## Section Order

Render top to bottom. **Omit** any section with no real content.

### 1. At a glance

**Components:** `H1`, `Text`, `Grid`, `Stat`

| Element | Content |
|---------|---------|
| `H1` | Product name (customer-facing) |
| `Text` | One-sentence purpose |
| `Grid` (2–3 cols) | `Stat` cards: who it's for, main capability, optional third fact |

Example stats: "For small teams", "3 core workflows", "Works on web"

### 2. The problem it solves

**Components:** `H2`, `Callout` (tone: `info` or `neutral`)

2–4 sentences: why this app exists, what pain it removes. No stack mentions.

### 3. How you use it

**Components:** `H2`, `Stack`, `Text`, `CollapsibleSection` (one per journey)

- 2–4 primary user journeys
- Each journey: title + numbered steps (user actions only)
- Use `CollapsibleSection` when more than 2 journeys to reduce scroll
- Optional `Pill` per journey: `Available now` / `Coming soon` / `Behind the scenes`

### 4. Main parts of the app

**Components:** `H2`, `Grid`, `Card`, `CardHeader`, `CardBody`, `Text`

Map code areas to friendly names. 3–6 cards max.

| Card title | Card body |
|------------|-----------|
| Dashboard | What the user sees and does here |
| Settings | Account and preferences |
| … | … |

Do not list file paths in card bodies.

### 5. What happens behind the scenes

**Components:** `H2`, `CollapsibleSection`, `Stack`, `Text`

Plain "when you X, the app Y" bullets. One sentence each. Collapsed by default if section 3 already covers flows.

### 6. Connected services

**Components:** `H2`, `Table` or `Row` + `Pill`

| Service | What it does for users |
|---------|------------------------|
| Stripe | Handles payments |
| Supabase | Stores accounts and data |

Omit if no third-party integrations detected.

### 7. Glossary

**Components:** `CollapsibleSection`, `Table`

Columns: Term | Plain meaning

Only if section 3–5 still required defined terms. Collapsed by default.

### 8. Technical appendix

**Components:** `CollapsibleSection` (default collapsed), `Text`, `Code` (sparingly)

- Stack one-liner
- Key paths for engineers (`app/`, `src/`, etc.)
- Repo note if UI lives elsewhere (monorepo, API-only)

Label: "For your technical contact"

## Layout Patterns

```
Stack (gap: 24)
├── H1 + intro Text
├── Grid → Stat × 3
├── H2 + Callout
├── H2 + CollapsibleSection × journeys
├── H2 + Grid → Card × n
├── CollapsibleSection → behind the scenes
├── H2 + Table → services
├── CollapsibleSection → glossary
└── CollapsibleSection → technical appendix
```

Mix open sections with cards — do not wrap every block in `Card`.

## Visual Rules

From the canvas skill:

- Flat, minimal; no gradients, box-shadows, or emojis
- Accent color sparingly via theme tokens
- Hierarchy: `H1` for product name, `H2` for sections, `Text` for body
- Pre-delivery: squint test — one thing should stand out (usually the purpose + stats row)

## Empty State Policy

If a section has no grounded content after recon, **omit the section entirely**. Do not render "No integrations found" or placeholder rows.

If the entire app cannot be explained (empty repo, no README, no routes), do not produce a Canvas. Tell the user what's missing and what to point you at.

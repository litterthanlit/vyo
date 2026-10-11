---
name: explain-app
description: >-
  Inspects a repository and explains what the app does and how it works in
  plain English for non-technical stakeholders. Produces three Swiss Style poster
  Canvases: page 1 (how the app and the code behind it work), page 2
  (project story — the marketing/summary sheet for selling and sharing) and
  page 3 (the app's real parts and wiring, drawn as an isometric exploded
  view, built from a scan of the code). Use
  when the user asks to explain the app, walk through how it works for a
  client/PM/stakeholder, create a non-technical overview, demystify the
  codebase for someone who does not code, help someone sell or talk about their
  product, visualize the repo as a poster, or draw the codebase as an
  exploded / isometric diagram.
---

# Explain App

Turn a codebase into a plain-English app guide for people who will never read code. The deliverable is **three Swiss Style poster Canvases** (`.canvas.tsx`) on light paper — objective typography, real 12-column grid, one accent color. Not a dark UI mockup, not a scrolling doc.

**Canvas skill override (read this before the canvas skill).** Swiss posters **must** use the fixed paper/ink/accent hex, display type at **104–128px** (page 1) / **64–80px** (page 2 tagline), and raw CSS grid. Ignore the canvas skill where it forbids hardcoded hex, type above 24px, or requires `useHostTheme()` for color. Those rules are for document canvases. This skill wins on poster files. Still follow the canvas skill for file location (`…/canvases/*.canvas.tsx`), `import` only from `cursor/canvas`, and no `fetch`.

| Page | File | Purpose |
|------|------|---------|
| **1 — App Guide** | `<repo>-app-poster.canvas.tsx` | How the app **and the code behind it** work, for a non-technical reader — journeys, an "Under the hood" band, screens, connected services |
| **2 — Project Story** | `<repo>-project-story.canvas.tsx` | The summary / marketing sheet — tagline as hero, talking points, who it's for, what's real, the vision |
| **3 — Exploded View** | `<repo>-exploded-view.canvas.tsx` | The app's real parts and wiring as an isometric exploded view, built from a scan of the code — a shape per part, cables for real connections, a slider that opens it, one plain sentence per part |

## When to Use

- User asks to explain the app to a client, PM, stakeholder, or non-engineer
- User wants a walkthrough of how the product works without code
- User asks "what does this app do?" or "demystify this codebase"
- User needs a visual overview for handoff, sales, or investor context
- User wants to feel connected to their project or talk about it confidently without technical detail
- User asks for an exploded view, isometric drawing, or "show me what it's made of"

## When NOT to Use

- Engineer onboarding, CLAUDE.md generation, or convention detection → use `codebase-onboarding`
- README/API documentation for contributors → use `codebase-documenter`
- Debugging, PR review, or implementation work
- User explicitly wants markdown-only output with no Canvas

## Before You Start

1. Read the canvas skill at `~/.cursor/skills-cursor/canvas/SKILL.md` — required for every Canvas deliverable.
2. Read [swiss-design-principles.md](swiss-design-principles.md) — **mandatory** design discipline (Müller-Brockmann + Vignelli, from [hyperagent-public-skills](https://github.com/alexmcdonnell-airtable/hyperagent-public-skills)).
3. Read [plain-language-rules.md](plain-language-rules.md) before writing copy.
4. Read [poster-layout.md](poster-layout.md) for page 1 grid rows and content zones.
5. Read [sell-sheet-layout.md](sell-sheet-layout.md) for page 2 and [exploded-view-layout.md](exploded-view-layout.md) for page 3 — **always produce all three pages** when an app is detected.
6. Use [poster-starter.md](poster-starter.md), [sell-sheet-starter.md](sell-sheet-starter.md) and [exploded-view-starter.md](exploded-view-starter.md) as structural starting points.
7. Skim [canvas-layout.md](canvas-layout.md) only if the user explicitly wants the legacy document-style fallback.

### Canonical copy

This repo's `.cursor/skills/explain-app/` is the source of truth. After any edit, **sync it to** `~/.cursor/skills/explain-app` so other workspaces load the same rules. If both copies exist and disagree, follow **this repo's files**, not the personal copy.

### Project overrides (check in order)

1. `.cursor/skills/explain-app/project-context.md` in the **target app repo** — product name, audience, tone, backend-only features
2. Any `*playbook*` or audit doc in that repo — use for feature status honesty (UI vs backend-only vs planned)

## Workflow

Copy this checklist and track progress:

```
Explain App Progress:
- [ ] Phase 1: Recon (scan first)
- [ ] Phase 2: User feature map
- [ ] Phase 3: Plain English synthesis (page 1)
- [ ] Phase 4: App Guide poster (page 1)
- [ ] Phase 5: Connection & sales synthesis (page 2)
- [ ] Phase 6: Project Story poster (page 2)
- [ ] Phase 6b: Exploded View (page 3: PARTS → wire)
- [ ] Phase 7: Check + export (PNG/PDF)
- [ ] Chat summary with the three canvas links and the shareable PDF
```

### Phase 1 — Recon (read-only, parallel)

**Scan first.** From this skill's directory (Node only, no install):

```bash
node tools/scan.mjs scan <repo> --out <canvases>/<repo>-facts.json
node tools/scan.mjs show <canvases>/<repo>-facts.json
```

`facts.json` is a deterministic reading of the code: screens, endpoints, saved-data tables, outside services, AI use, background jobs, and how much code each folder holds. It is the input to page 3 and the ground truth for pages 1 and 2:

| Fact | Use |
|------|-----|
| Screens | Page 1 journeys and "The screens" must match them. Never invent a screen |
| Services | Page 1 **Connected**. A service fact proves the code talks to it, not that a user can use it: list it only if a screen exposes it today, else footer |
| Tables, jobs, AI | Page 1 "Under the hood" stations (what's saved, what runs on its own, what comes back out) and page 2 "what's real today" |
| Endpoints, jobs or services with no screen | Status **Behind the scenes**, never **Available now** |

A fact shows that code exists, not that it is finished. Skim for stubs before calling anything live. Then add what a scan cannot read, in parallel:

1. **Product context** — `README*`, `docs/`, marketing copy, playbooks
2. **Stack fingerprint** — `package.json`, `pyproject.toml`, `go.mod`, etc. (internal mapping only)
3. **User-facing surface** — confirm the scan's screens are reachable, not stubs:
   - Next.js: `app/`, `pages/`, `src/app/`
   - React SPA: router config, `routes/`
   - API-only: note "no UI in this repo" and what a frontend would call
4. **Data & accounts** — auth and database patterns → translate to "sign in", "your data is stored"
5. **Integrations** — Stripe, email, analytics — name the **service**, not the SDK
6. **Directory snapshot** — top 2 levels; map folders to friendly names ("Billing" not `lib/stripe/`)

**Skip:** lint configs, test structure, branch conventions, dependency injection patterns.

### Phase 2 — User feature map (internal)

Build this map before writing copy. Do not dump it raw into the Canvas.

| Element | What to capture |
|---------|-----------------|
| Actors | Who uses the app (end user, admin, guest) |
| Jobs | What they come to do (sign up, book, pay, manage settings) |
| Journeys | 2–4 primary flows as UI steps a human would take |
| Under the hood | The data pipeline as **3, 4, or 6** stations (never 5 — it cannot land on a 12-column grid): what you do → where it's saved → what processes it → what comes back out |
| Behind the scenes | One "When you X, the app Y" sentence per journey ("When you pay, the app talks to Stripe") |
| Parts (page 3) | 2–9 named parts grouped from the scan's facts, each with a role and a "When you…" line — rules in [exploded-view-layout.md](exploded-view-layout.md#from-codebase-to-parts) |
| Status honesty | Works in UI / backend only / planned — never call backend-only "complete" |

If the user named an audience (client, PM, exec), note it. If not, default to general non-technical.

### Phase 3 — Plain English synthesis

Apply [plain-language-rules.md](plain-language-rules.md):

- Lead with outcomes, not architecture
- Ban technical terms. Posters have **no glossary and no appendix** — rewrite until the banned list is empty
- No file paths anywhere on the poster
- Adapt depth to audience (see rules file)

### Phase 4 — App Guide poster (page 1)

1. Determine workspace canvases path: `~/.cursor/projects/<workspace>/canvases/`
2. Filename: `<repo-name>-app-poster.canvas.tsx` (kebab-case, from git root basename)
3. Follow [swiss-design-principles.md](swiss-design-principles.md) and [poster-layout.md](poster-layout.md):
   - Light paper (`#FFFFFF`), ink (`#0A0A0A`), one accent mark — the **red full stop** after the masthead
   - Masthead at **104–128px on one line**, in a multiple of 8 (112 default); display : body ratio ≥ 7:1 over 14px body
   - 12-column grid, 8px baseline, 24px leading, 64px margins
   - Two type roles, four sizes (display + 44px numerals · 14px body + 10px folio); flush-left only
   - Primary copy in ink; gray reserved for folio, captions, status
   - Journeys as **giant numerals**; "Under the hood" as a **transit-line diagram** with **3, 4, or 6** stations on the 12-column grid — no boxed flowcharts, colored tabs, or dark blocks
   - Grid overlay inside the same content box as the poster
4. Import only from `cursor/canvas`; inline all content; no `fetch`
5. Omit empty zones — never render placeholder blocks
6. `useCanvasState("showGridApp", false)` on page 1; `useCanvasState("showGridStory", false)` on page 2 — **never** a shared `"showGrid"` key (it leaks across posters)
7. If an older `<repo>-app-guide.canvas.tsx` (document-style) exists for the same product, **delete it** so the sidebar is only the three posters
8. Run Swiss pre-delivery checklist in swiss-design-principles.md. Open both canvases. If the masthead is under 104px or there is no red full stop, the canvas skill override was ignored — fix before finishing.

### Phase 5 — Connection & sales synthesis (page 2)

Build this map from the same recon — do not re-read the entire repo. Pull from README, marketing copy, playbooks, and the page 1 feature map.

| Element | What to capture |
|---------|-----------------|
| Tagline | Emotional outcome in one line — not a feature list |
| In one breath | 20-second script the owner can say aloud |
| Who it's for | Ideal person, their situation, the moment they need this — 2–4 short lines, not a paragraph |
| Talking points | 3 verbatim lines in quotation marks. **Do not restate the tagline.** |
| What's real today | Honest capabilities only — same status labels as page 1 |
| Differentiation | 2–3 contrasts vs generic alternatives or named competitors if obvious from docs |
| The vision | 2–3 sentences in ownership language — why *they* built this |

Default audience for page 2: **project owner who wants to sell or share the product** — even if page 1 targets a client or PM.

Apply page 2 voice rules in [plain-language-rules.md](plain-language-rules.md#page-2--project-story-voice).

### Phase 6 — Project Story poster (page 2)

1. Same canvases path as page 1
2. Filename: `<repo-name>-project-story.canvas.tsx`
3. Follow [sell-sheet-layout.md](sell-sheet-layout.md) and [sell-sheet-starter.md](sell-sheet-starter.md) — same Swiss canon as page 1
4. Footer center: "Pair with the App Guide — page 01"
5. Same quality gates as page 1 — no jargon, no file paths, no hype

### Phase 6b — Exploded View (page 3)

1. Same canvases path. Filename: `<repo-name>-exploded-view.canvas.tsx`
2. Copy [exploded-view-starter.md](exploded-view-starter.md). Edit only its data (`product`, `purpose`, `notBuilt`, `audience`) and the `PARTS` block. The starter derives every coordinate; never hand-place SVG
3. `node tools/scan.mjs draft <canvases>/<repo>-facts.json` prints a starting `PARTS` array. Paste it between `PARTS:BEGIN` and `PARTS:END`
4. Rename and merge it into **2–9 plain-English parts** ([choosing parts](exploded-view-layout.md#choosing-parts), [naming](plain-language-rules.md#naming-parts)):
   - `name` ≤ 18 characters; one "When you…" `line` each
   - optional `detail`: a noun phrase that replaces the caption's "Made of" list when scanned names (routes, folders) mean nothing to a reader
   - `from` lists fact ids or globs, and every pattern must match real facts
   - no fact is cited by two parts; at most 4 parts per tier
5. `node tools/scan.mjs wire <canvases>/<repo>-facts.json --into <canvas>` writes the `WIRING` block (counts, sizes, links)
   - Fix every `✗`. These are honesty errors (a pattern that cites nothing, a fact claimed twice), not style
   - Weigh every `!`. "Not drawn: …" means the drawing hides a service, table, job or screen: cite it, or leave it out on purpose and name it in the footer
6. To confirm a surprising cable: `node tools/scan.mjs why <facts.json> --canvas <canvas> "A" "B"` prints the real file path behind it. If you can't defend a link in one sentence, change `from`
7. **Never hand-edit `WIRING`; never type a count.** Changing `name` or `line` needs no re-wire. Changing `from` or `role` does (the canvas throws `PARTS changed — re-run wire`). After a re-scan, re-run `wire`
8. Footer: the same not-built list as pages 1 and 2, plus any important fact you left undrawn on purpose

### Phase 7 — Check and export

The rules above are enforced by a checker in [tools/](tools/README.md). Run it from this skill's directory (first time only: `npm install --prefix tools && npx --prefix tools playwright install chromium`):

```bash
node tools/poster.mjs check  <canvases>/<repo>-app-poster.canvas.tsx <canvases>/<repo>-project-story.canvas.tsx <canvases>/<repo>-exploded-view.canvas.tsx
node tools/poster.mjs export <canvases>/<repo>-app-poster.canvas.tsx <canvases>/<repo>-project-story.canvas.tsx <canvases>/<repo>-exploded-view.canvas.tsx
```

1. `check` must print **PASS** for all three posters. Page 3 needs `<repo>-facts.json` beside the canvas: `check` re-runs `wire` against it and fails if `WIRING` or the hashes are stale, then drives the drawing (the slider, arrow keys, pointing at a part, the theme button). Every ✗ is a rule break — fix the canvas and re-run. Treat ! warnings (jargon, height, narrow panel) as copy edits unless there's a reason to keep them.
2. `export` writes `<canvases>/exports/`: a PNG and a PDF per poster, plus `<repo>-poster-set.pdf` with all pages. Page 3 exports in its default state (light, 80% open); the controls are hidden. Add `--paper a4` or `--paper letter` when the user wants to print.
3. If the tools can't install (no network), say so in chat and deliver the canvases only — never skip `check` silently.

### Chat response

Keep chat short. The three poster canvases are the deliverable; the set PDF is what the user sends to people without Cursor.

1. One sentence: what the app does
2. Link to **page 1** (App Guide) with full absolute path (markdown link)
3. One sentence on **page 2**: who it's for and that it has talking points + what's real today
4. Link to **page 2** (Project Story) with full absolute path
5. One sentence on **page 3**: "the app taken apart into its real parts — drag to open; lines are real connections in the code", with a link to `<repo>-exploded-view.canvas.tsx`
6. Link to the **poster-set PDF** (`exports/<repo>-poster-set.pdf`) — "send this to your client"
7. If first canvas in workspace: one sentence on opening them beside the chat
8. Note any gaps honestly ("billing UI is not built yet; backend exists only")

## Edge Cases

### Empty or scaffold-only repo

If the scan reports `empty: true` and there are no product docs (README, playbook, `project-context.md`):

- Do **not** produce any Canvas with placeholder content
- Tell the user honestly: no application detected in this repository
- Suggest what would help: README, filled `project-context.md`, or a different repo path

If the scan is empty but docs describe a product, write pages 1 and 2 from the docs and skip page 3 (nothing to draw), saying so in chat.

### Monorepo (UI in a subfolder)

When the git root contains multiple packages:

1. Scan the git root; `show` lists the packages. Find the one with user-facing pages (`*/src/app/`, `*/pages/`)
2. Explain the **product** from that package. Do not mention "monorepo" on the poster.
3. Example: `hypher-web/` holds the screens; other folders are supporting packages

### API-only repo

If there are no pages or screens:

- Say clearly: "There is no user interface in this repository"
- Describe what the service **does** in plain terms (e.g. "stores and sends messages")
- Note where the UI likely lives if mentioned in docs, or that a separate frontend would be needed
- Page 3 still works: with no screens, its top tier is an `api` part (the requests the service answers)

### Backend-only features

When a playbook or audit distinguishes UI from server work:

- Use status labels: **Available now**, **Behind the scenes**, **Coming soon**
- Never describe backend-only work as something users can do today

## Output Quality Gates

Before finishing, verify **all three pages**:

**Page 1 — App Guide**
- [ ] A non-engineer can describe what the app does from the poster alone
- [ ] "Under the hood" band explains what the code does in plain verbs — no SDK names, no paths
- [ ] Journeys match real routes/screens when UI exists
- [ ] Backend-only features in footer only, not as live journeys
- [ ] **Connected** lists only services the user can use today. A Stripe webhook with no checkout UI belongs in the footer, not Connected. Both footers list the same not-built items.

**Page 2 — Project Story**
- [ ] Owner can read "in one breath" and talking points aloud without stumbling
- [ ] "What's real today" matches page 1 status honesty — no overselling
- [ ] Vision copy uses ownership language ("you", "your product")
- [ ] Differentiation is concrete, not generic hype

**Page 3 — Exploded View**
- [ ] Every part traces to facts: each `from` pattern matches real facts and `wire` ran with no ✗
- [ ] 2–9 real parts, none added to fill space; each is a thing a non-engineer would recognise
- [ ] Every link is real: `WIRING` came from `wire`, and one surprising cable was confirmed with `why`
- [ ] Counts and sizes match the scan (`show`). None was typed by hand, and no `line` repeats one
- [ ] Plain names: no role words (API, table, service) and no library names
- [ ] Every `!` "Not drawn" fact is either drawn or deliberately left out and named in the footer. Everything drawn works today
- [ ] A non-engineer can say what each part does from its caption sentence
- [ ] Only `PARTS` and the data constants were edited. `WIRING` untouched, no hand-placed coordinates, no SVG text, no extra colours

**All pages**
- [ ] `node tools/poster.mjs check` passes on every file (it enforces most of the list below)
- [ ] Light paper, ink type, one red accent mark (the full stop) — Swiss canon palette
- [ ] Display type at poster scale (104–128px page 1 / 64–80px tagline page 2, multiples of 8); numerals at 40–48px
- [ ] Primary copy in ink; gray only for folio, captions, status
- [ ] 12-column grid with baseline lock; overlay shares content box
- [ ] Two type roles; flush-left throughout; at least one deliberately empty zone
- [ ] Page 1 diagrams are transit lines with **3, 4, or 6** dots on the 12-column grid — no boxed flowchart clip-art. Page 3's drawing is the one SVG exception
- [ ] No dark fields, rainbow tabs, or document-style canvas components
- [ ] No unexplained jargon in visible poster copy
- [ ] No file paths on either poster surface

## Examples

See [examples.md](examples.md) for sample prompts and filled section copy.

## Related Skills

| Skill | Use instead when |
|-------|------------------|
| `codebase-onboarding` (if installed) | Developer joining the repo |
| `codebase-documenter` (if installed) | Contributor docs, README, API reference |
| `canvas` | Any Canvas authoring rules and SDK reference |
| `project-handoff` (if installed) | Build status and next-step handoff for agents |

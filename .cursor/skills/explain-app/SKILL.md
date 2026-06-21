---
name: explain-app
description: >-
  Inspects a repository and explains what the app does and how it works in
  plain English for non-technical stakeholders. Produces two Swiss Style poster
  Canvases: page 1 (how it works) and page 2 (project story — connection and
  selling). Use when the user asks to explain the app, walk through how it works
  for a client/PM/stakeholder, create a non-technical overview, demystify the
  codebase for someone who does not code, help someone sell or talk about their
  product, or visualize the repo as a poster.
---

# Explain App

Turn a codebase into a plain-English app guide for people who will never read code. The deliverable is **two Swiss Style poster Canvases** (`.canvas.tsx`) on light paper — objective typography, real 12-column grid, one accent color. Not a dark UI mockup, not a scrolling doc.

| Page | File | Purpose |
|------|------|---------|
| **1 — App Guide** | `<repo>-app-poster.canvas.tsx` | How the product works — journeys, screens, connected services |
| **2 — Project Story** | `<repo>-project-story.canvas.tsx` | Connection and selling — who it's for, talking points, what's real, the vision |

## When to Use

- User asks to explain the app to a client, PM, stakeholder, or non-engineer
- User wants a walkthrough of how the product works without code
- User asks "what does this app do?" or "demystify this codebase"
- User needs a visual overview for handoff, sales, or investor context
- User wants to feel connected to their project or talk about it confidently without technical detail

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
5. Read [sell-sheet-layout.md](sell-sheet-layout.md) for page 2 — **always produce both pages** when an app is detected.
6. Use [poster-starter.md](poster-starter.md) and [sell-sheet-starter.md](sell-sheet-starter.md) as structural starting points.
7. Skim [canvas-layout.md](canvas-layout.md) only if the user explicitly wants the legacy document-style fallback.

### Project overrides (check in order)

1. `.cursor/skills/explain-app/project-context.md` in the repo — product name, audience, tone, backend-only features
2. `.cursor/skills/explain-app/SKILL.md` in the repo — extends this skill; does not replace it
3. Any `*playbook*` or audit doc in the repo — use for feature status honesty (UI vs backend-only vs planned)

## Workflow

Copy this checklist and track progress:

```
Explain App Progress:
- [ ] Phase 1: Recon
- [ ] Phase 2: User feature map
- [ ] Phase 3: Plain English synthesis (page 1)
- [ ] Phase 4: App Guide poster (page 1)
- [ ] Phase 5: Connection & sales synthesis (page 2)
- [ ] Phase 6: Project Story poster (page 2)
- [ ] Chat summary with both canvas links
```

### Phase 1 — Recon (read-only, parallel)

Gather signals without reading every file:

1. **Product context** — `README*`, `docs/`, marketing copy, playbooks
2. **Stack fingerprint** — `package.json`, `pyproject.toml`, `go.mod`, etc. (internal mapping only)
3. **User-facing surface** — pages, routes, screens:
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
| Behind the scenes | One plain sentence per journey ("When you pay, the app talks to Stripe") |
| Status honesty | Works in UI / backend only / planned — never call backend-only "complete" |

If the user named an audience (client, PM, exec), note it. If not, default to general non-technical.

### Phase 3 — Plain English synthesis

Apply [plain-language-rules.md](plain-language-rules.md):

- Lead with outcomes, not architecture
- Ban or glossary technical terms in primary sections
- No file paths in primary copy — reserve for collapsed technical appendix
- Adapt depth to audience (see rules file)

### Phase 4 — App Guide poster (page 1)

1. Determine workspace canvases path: `~/.cursor/projects/<workspace>/canvases/`
2. Filename: `<repo-name>-app-poster.canvas.tsx` (kebab-case, from git root basename)
3. Follow [swiss-design-principles.md](swiss-design-principles.md) and [poster-layout.md](poster-layout.md):
   - Light paper (`#FFFFFF`), ink (`#0A0A0A`), one accent (`#E4002B`)
   - 12-column grid, 8px baseline, 24px leading, 48px margins
   - Two type sizes (display + body); flush-left only
   - Grid overlay inside the same content box as the poster
   - Numbered journeys in the meta column — no colored tabs or dark blocks
4. Import only from `cursor/canvas`; inline all content; no `fetch`
5. Omit empty zones — never render placeholder blocks
6. `useCanvasState("showGridApp", false)` on page 1; `useCanvasState("showGridStory", false)` on page 2 — separate keys so toggles do not leak across posters
7. Run Swiss pre-delivery checklist in swiss-design-principles.md

### Phase 5 — Connection & sales synthesis (page 2)

Build this map from the same recon — do not re-read the entire repo. Pull from README, marketing copy, playbooks, and the page 1 feature map.

| Element | What to capture |
|---------|-----------------|
| Tagline | Emotional outcome in one line — not a feature list |
| In one breath | 20-second script the owner can say aloud |
| Who it's for | Ideal person, their situation, the moment they need this |
| Why they'll care | Customer outcomes and feelings — not screens |
| Talking points | 3 verbatim lines in quotation marks |
| What's real today | Honest capabilities only — same status labels as page 1 |
| Differentiation | 2–3 contrasts vs generic alternatives or named competitors if obvious from docs |
| The vision | 2–3 sentences in ownership language — why *they* built this |

Default audience for page 2: **project owner who wants to sell or share the product** — even if page 1 targets a client or PM.

Apply page 2 voice rules in [plain-language-rules.md](plain-language-rules.md#page-2--project-story-voice).

### Phase 6 — Project Story poster (page 2)

1. Same canvases path as page 1
2. Filename: `<repo-name>-project-story.canvas.tsx`
3. Follow [sell-sheet-layout.md](sell-sheet-layout.md) and [sell-sheet-starter.md](sell-sheet-starter.md) — same Swiss canon as page 1
4. Footer center: "Pair with the App Guide (page 1)"
5. Same quality gates as page 1 — no jargon, no file paths, no hype

### Chat response

Keep chat short. Both poster canvases are the deliverable.

1. One sentence: what the app does
2. Link to **page 1** (App Guide) with full absolute path (markdown link)
3. One sentence on **page 2**: who it's for and that it has talking points + what's real today
4. Link to **page 2** (Project Story) with full absolute path
5. If first canvas in workspace: one sentence on opening them beside the chat
6. Note any gaps honestly ("billing UI is not built yet; backend exists only")

## Edge Cases

### Empty or scaffold-only repo

If there is no `package.json`, no routes, and no product docs:

- Do **not** produce either Canvas with placeholder content
- Tell the user honestly: no application detected in this repository
- Suggest what would help: README, filled `project-context.md`, or a different repo path

### Monorepo (UI in a subfolder)

When the git root contains multiple packages:

1. Find the package with user-facing pages (`*/src/app/`, `*/pages/`)
2. Explain the **product** from that package; mention the repo is a monorepo only in the technical appendix
3. Example: `hypher-web/` holds the screens; other folders are supporting packages

### API-only repo

If there are no pages or screens:

- Say clearly: "There is no user interface in this repository"
- Describe what the service **does** in plain terms (e.g. "stores and sends messages")
- Note where the UI likely lives if mentioned in docs, or that a separate frontend would be needed

### Backend-only features

When a playbook or audit distinguishes UI from server work:

- Use status labels: **Available now**, **Behind the scenes**, **Coming soon**
- Never describe backend-only work as something users can do today

## Output Quality Gates

Before finishing, verify **both pages**:

**Page 1 — App Guide**
- [ ] A non-engineer can describe what the app does from the poster alone
- [ ] Journeys match real routes/screens when UI exists
- [ ] Backend-only features in footer only, not as live journeys

**Page 2 — Project Story**
- [ ] Owner can read "in one breath" and talking points aloud without stumbling
- [ ] "What's real today" matches page 1 status honesty — no overselling
- [ ] Vision copy uses ownership language ("you", "your product")
- [ ] Differentiation is concrete, not generic hype

**Both pages**
- [ ] Light paper, ink type, one red accent — Swiss canon palette
- [ ] 12-column grid with baseline lock; overlay shares content box
- [ ] Two type sizes; flush-left throughout
- [ ] No dark fields, rainbow tabs, or document-style canvas components
- [ ] No unexplained jargon in visible poster copy
- [ ] No file paths on either poster surface

## Examples

See [examples.md](examples.md) for sample prompts and filled section copy.

## Related Skills

| Skill | Use instead when |
|-------|------------------|
| `codebase-onboarding` | Developer joining the repo |
| `codebase-documenter` | Contributor docs, README, API reference |
| `canvas` | Any Canvas authoring rules and SDK reference |
| `project-handoff` | Build status and next-step handoff for agents |

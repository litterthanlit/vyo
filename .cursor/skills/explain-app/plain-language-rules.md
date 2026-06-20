# Plain Language Rules

Writing rules for explain-app. Primary Canvas sections must pass these checks.

## Core Principles

1. **Outcomes first** — "You can invite your team" before "Next.js monorepo"
2. **UI language** — describe what people see and click, not what files run
3. **Honest status** — distinguish works in the app / not built yet / behind the scenes only
4. **One idea per sentence** — short sentences; avoid nested clauses
5. **Define or ban** — every technical term is either removed or defined in the glossary

## Banned Terms (primary sections)

Replace or move to glossary / technical appendix:

| Instead of | Say |
|------------|-----|
| API / endpoint | "the app sends a request" or name the action ("saves your profile") |
| middleware | "a check that runs before the page loads" |
| ORM / query | "looks up your data" / "saves to the database" |
| webhook | "a notification from [Service] when something happens" |
| deploy / deployment | "goes live" / "published to the internet" |
| env var / environment | omit or "server configuration" in appendix only |
| frontend / backend | "what you see" / "what runs behind the scenes" |
| monorepo | omit unless appendix; say "multiple apps in one project" if needed |
| SDK | name the service (Stripe, not "Stripe SDK") |
| REST / GraphQL | omit; describe the action |
| component / module | "screen", "section", "part of the app" |
| repository / repo | "project" or product name |
| commit / branch / PR | omit in primary sections |

## Analogy Budget

- At most **one** simple analogy per major section
- Prefer concrete UI language over metaphors
- Good: "Like a filing cabinet — each project has its own folder"
- Bad: extended metaphor chains, kitchen/sports clichés, "think of it as a Swiss Army knife"

## Audience Adaptation

| Audience | Emphasize | De-emphasize | Length |
|----------|-----------|--------------|--------|
| **Client** | What was built, what they can do today, why it matters | Stack, file structure | Medium |
| **PM / operator** | Flows, dependencies between features, what's not live | Implementation detail | Medium–long |
| **Exec / investor** | Problem, outcome, traction signals, connected services | Step-by-step UI | Short |
| **General** (default) | Balanced: purpose, 2–3 journeys, main areas | Technical appendix only | Medium |

If audience is unclear, use **general** for page 1 and **project owner / seller** for page 2.

## Page 2 — Project Story voice

Page 2 is for people who **own or sell** the product — not engineers, not agency handoff recipients. They want to feel connected to what they built and talk about it without reading code.

### Principles

1. **Speakable copy** — every talking point and the "in one breath" script should sound natural out loud
2. **Ownership** — "your app", "what you've built", "you set out to" — not "the system" or "the platform"
3. **Customer language** — describe outcomes for *their* customer, not UI areas
4. **Honest confidence** — "what's real today" builds trust; one limitation beats overselling
5. **No architecture** — page 2 never mentions stack, services, or how it's built (that's page 1's "Connected" column)

### Banned on page 2

Everything in the primary-sections ban list, plus:

| Instead of | Say |
|------------|-----|
| MVP / beta / v1 | "what's live now" or omit |
| leverage / utilize | "use" |
| solution / platform / ecosystem | name the product or say "app" |
| disruptive / revolutionary | omit — show the contrast instead |
| TAM / moat / ARR / runway | omit unless exec audience in project-context |
| synergy / holistic | omit |

### Talking points format

Write as quoted lines the owner can memorize or read:

```
1. "Most solo builders lose ideas across ten tabs — this keeps everything in one place."
```

Not bullet fragments: ~~"idea capture, spatial canvas, AI digest"~~

### Vision band

Connect the owner to the *why* behind the build. Pull from README mission, playbook positioning, or product name etymology if docs are thin. Example tone:

> You started this because scattered notes were costing you momentum. What you've built is a single place to think, organize, and share — without becoming a project manager.

## Section Voice

### At a glance
- One sentence purpose
- Who it's for (role, not job title jargon)
- 2–3 stats: user-facing facts only ("3 main workflows", not "47 API routes")

### Journeys
Numbered steps. Each step = one user action + what they see.

```
1. Open the app and tap Sign in
2. Enter your email — you receive a link in your inbox
3. You land on your dashboard with your recent activity
```

### Behind the scenes
"When you [action], the app [plain result]." No code, no paths.

### Status honesty labels
Use plain labels when feature status matters:

| Label | Meaning |
|-------|---------|
| **Available now** | User can do this in the app today |
| **Coming soon** | Planned; not in the UI |
| **Behind the scenes** | Works server-side; no user-facing screen yet |

## Glossary Rules

- Only include terms that appeared unavoidable after rewriting
- Format: Term → one-sentence plain definition
- Max 8 entries; if more are needed, the copy is still too technical — rewrite primary sections

## Technical Appendix (collapsed)

Allowed here only:

- Stack summary (framework, database, hosting) in one short paragraph
- Key file paths for the technical contact
- Repo structure at one level deep with friendly labels

Never put the appendix content in primary sections "just in case."

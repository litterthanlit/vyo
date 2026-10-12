# Plain Language Rules

Writing rules for explain-app. Primary Canvas sections must pass these checks. The What-changed briefing speaks to the builder, not to a stakeholder: see [Briefing voice](#briefing-voice-what-changed).

**Swiss posters (the default deliverable) have no glossary and no technical appendix.** If a banned term is still on the poster, rewrite. Do not park jargon in a collapsed section that does not exist.

The glossary / appendix / "At a glance" sections below apply **only** to the legacy document canvas (`canvas-layout.md`) when the user explicitly asks for that fallback.

## Core Principles

1. **Outcomes first** — "You can invite your team" before "Next.js monorepo"
2. **UI language** — describe what people see and click, not what files run
3. **Honest status** — distinguish works in the app / not built yet / behind the scenes only
4. **One idea per sentence** — short sentences; avoid nested clauses
5. **Define or ban** — every technical term is either removed or defined in the glossary

## Banned Terms (poster surface)

Do not move these to a glossary — **replace them**:

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
| SDK / Clerk / Convex / Stripe as if the user clicks them | name the action ("sign in", "saved instantly") unless the user can actually do that in the app today |
| REST / GraphQL | omit; describe the action |
| component / module | "screen", "section", "part of the app" |
| repository / repo | "project" or product name |
| commit / branch / PR | omit in primary sections |

## Naming parts

Page 3 draws the app's real parts. You name each part and write its one-sentence `line`; the drawing writes everything else (item names, counts) from the scan. Name each part after what a person gets from it, never after the folder or library that provides it.

| In the code (fact kind, typical folder) | Part (role) | Part name | What the drawing lists under it |
|-----------------------------------------|-------------|-----------|---------------------------------|
| `screen:` facts; `app/(dashboard)`, `pages/`, routes | screens | "What you see" | Screen names as a user says them: "Dashboard", "Recipe detail", "Billing" |
| `area:lib/billing`, `area:components/billing` | feature | The feature: "Billing", "Recipe box", "Pricing rules" | Its sub-folders by plain name, plus its share of the code |
| `area:` for a whole product area (`app/(chat)`) | feature | What it is for: "Chat", "Planner" | Sub-folders |
| `ai:` facts; `lib/ai` | ai | What it does for the user: "Recipe ideas", "Smart replies" | The model provider; AI tool count |
| `job:` facts; `jobs/`, cron, queues, workers | jobs | What it does: "Weekly email", "Daily digest", "Reminders" | Job names |
| `table:` facts; `prisma/`, `db/`, Supabase, Convex | data | What is kept: "Saved recipes", "Your data" | Kinds of saved record: "Recipe", "Meal plan" |
| `service:payments`, `service:email`, `service:sign-in` | service | "Outside services" for all, or one by capability: "Payments", "Sign-in" | Capability names: "Payments", "Email", "Sign-in" |
| `endpoint:` facts, when the API is the product | api | What callers get: "Message intake", "Partner access" | Kinds of request |

Rules:

- **Part names are noun phrases, 18 characters at most**, first letter capital, in a user's words. A name that wraps in the label is too long.
- **Role words never appear on the poster as jargon**: API, endpoint, table, component, module, schema, backend. "Outside services" and "kinds of saved record" are plain English and fine.
- **Library and vendor names are not part names** ("Prisma", "Next.js", "tRPC", "Supabase"). A vendor may appear in a `line` only if the user would recognise it and can use it today.
- **Folder names become what people get**: `lib/billing` → "Billing", `lib/ai` → "Recipe ideas".
- **The drawing phrases the counts**: "12 screens", "8 kinds of request", "40% of the code", "1 AI model · 2 tools", "Runs 1 job on its own", "5 kinds of saved record", "3 outside services". Never type one, and don't repeat a count in a `line`.
- **Each `line` is one sentence**: "When you X, the app Y". For automatic work, "When [trigger], …" or "Every week, …".
- **Page 3 has no analogy.** The drawing already is the app's real parts. Don't add "the kitchen" or "the engine room" on top.

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

## Briefing voice (What changed)

The briefing ([briefing.md](briefing.md)) is for the **builder**: the person who made the app with AI and does not read the code. Its lines come from `tools/lib/briefing.mjs`. The same rules apply to any sentence you add around them.

| Rule | Example |
|---|---|
| **"You" and "your app".** Speak to the builder about their own work | "Your app is 14 files bigger", not "the codebase grew" |
| **Vendor names are fine.** The builder chose them, and they need to know which account to check. (Posters still avoid them unless a user can use the thing today) | "Payments (Stripe): your app can now take payments" |
| **Name things by what they are.** Say the kind, then the name | "the Recipes screen", "the saved record Ingredient", "the Weekly plan job" |
| **Still no code jargon.** The banned terms above apply. A table is a "saved record", an endpoint or API call is a "request", a commit is a "saved version", a deploy is "publish" | "Anything stored in it may be lost if you publish this" |
| **No file paths** unless they ask where. Then add `--receipts` | "The Billing screen is new", with `app/(app)/billing/page.tsx` only on request |
| **Absolute dates**, never "yesterday" or "3 days ago" in the briefing itself. It may be read days later | "Since your last saved version (a1b2c3d, 2026-10-07)" |
| **"No screen seems to lead to it"**, never "does not work", "unused" or "dead code". The scan cannot see wiring done higher up | "Text messages (Twilio) is in the code, but no screen seems to lead to it yet" |
| **Never "no changes users would notice".** The scan cannot see wording, colour or settings | "Nothing structural changed … (I can't see wording, colour or settings changes.)" |
| **Numbers come from the tool.** Never retype or tally them | Paste "Screens           6 → 7 (+1)" as printed; do not write "about seven screens now" |

Every line the tool prints already passes the poster checker's jargon list (`isJargon` in `tools/lib/scan/names.mjs`). Run any sentence you write yourself through the same list.

## Section Voice

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

## Glossary & appendix (legacy document canvas only)

Posters: skip this entire section. If the user asked for the document-style fallback, then:

- Only include terms that appeared unavoidable after rewriting
- Format: Term → one-sentence plain definition
- Max 8 entries; if more are needed, the copy is still too technical — rewrite primary sections

## Technical Appendix (legacy document canvas only)

Allowed here only:

- Stack summary (framework, database, hosting) in one short paragraph
- Key file paths for the technical contact
- Repo structure at one level deep with friendly labels

Never put the appendix content in primary sections "just in case."

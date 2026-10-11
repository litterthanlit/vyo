# Examples

## Sample Prompts

**Client handoff**
> Explain this app to my client as a Swiss Style poster — they need to understand what we built without any code.

**PM overview**
> Walk me through how this product works for a PM. Poster format, focus on flows and what's actually live.

**General**
> Explain what this app does. Visualize the repo as a poster.

**Exploded view (page 3 emphasis)**
> Draw my app as an exploded isometric diagram, so my investors can see what it's made of and how the parts connect.

**Selling / connection (page 2 emphasis)**
> Explain this codebase so I can talk about my product confidently — I need the second page with talking points.

## Sample Chat Response

```markdown
This app is a team task board where members sign in, create projects, and track work on a shared dashboard.

**Page 1 — how it works:** [taskflow-app-poster](/Users/<you>/.cursor/projects/<workspace>/canvases/taskflow-app-poster.canvas.tsx)

**Page 2 — your story:** talking points, who it's for, and what's real today — [taskflow-project-story](/Users/<you>/.cursor/projects/<workspace>/canvases/taskflow-project-story.canvas.tsx)

**Page 3 — taken apart:** the app taken apart into its real parts — drag to open; lines are real connections in the code — [taskflow-exploded-view](/Users/<you>/.cursor/projects/<workspace>/canvases/taskflow-exploded-view.canvas.tsx)

**Share it:** [taskflow-poster-set.pdf](/Users/<you>/.cursor/projects/<workspace>/canvases/exports/taskflow-poster-set.pdf) — all three pages, opens anywhere.

Note: billing is not in the app yet — marked in all three footers. Do not list Stripe under Connected or draw it on page 3.
```

## Sample Poster Copy (Hypher)

### Folio
- APP GUIDE — 01 · How Hypher works, in plain English · Web app · Solo builders

### Masthead (one line, red full stop)
```
Hypher.
```
Purpose (cols 1–7, ink; right columns empty): A spatial project brain for solo builders — capture thoughts anywhere, watch them cluster on a canvas, and get an AI-written daily digest.

### Journeys (giant numerals, 4 × 3 cols)
1. Capture a note or file — pick a project
2. Organize it on the spatial canvas
3. Read the daily AI digest
4. Share a read-only canvas link

### Under the hood (transit line)

Stations (4, on the 12-col grid): You capture → Saved live (stored in your database) → On the canvas (organize, connect) → Digest out (daily email). Branch off "On the canvas": Share (read-only link).

"When you…" lines: *When you save a note,* it is written to your database and appears in every open tab within a second. *When the day ends,* a short digest of what changed is written and sent to your inbox. *When you share,* the app publishes a read-only copy at a link.

### Body columns

**The problem** — Builders split ideas across notes, tabs, and repos…

**The screens** — Landing · Capture home · Spatial canvas · Dashboard · Settings

**Connected** — Sign-in · live database · daily digest · GitHub activity

### Footer
Not built: in-app billing, GitHub OAuth, voice capture, npm package

## Sample Page 2 Copy (Hypher)

### Folio
- PROJECT STORY — 02 · For the owner — say it out loud · Hypher

### Masthead (tagline as hero, 72px, red full stop)
```
Your ideas,
finally in
one place.
```

**In one breath:** "Hypher is a workspace for solo builders who are tired of losing ideas across tabs. You capture a thought in seconds, see it organized on a canvas, and get a daily digest that keeps you moving — without becoming a project manager."

### Body columns

**Who it's for**
- Solo builders, indie hackers, consultants
- Juggling several projects at once
- The moment: a great idea in the shower, gone by afternoon

**What to say**
1. "Most builders lose ideas across ten tabs — you get them back before they vanish."
2. "You capture a thought in seconds; the app organizes it on a canvas."
3. "Share a read-only link when you want feedback, not repo access."

### What's real today
- Sign in and land on a personal dashboard
- Capture notes and files into projects
- Organize work on a canvas
- Daily digest of recent activity
- Share a read-only canvas link
- Billing is not in the app yet

### Differentiation + vision

**How you're different** — Not another notes app with folders. Not a team project manager. A spatial brain for one person who ships alone.

**The vision** — You built this because scattered thinking was costing you momentum. What you have now is a single place to capture, see patterns, and share — on your terms.

## Sample Page 3 PARTS (Pantry)

Pantry is the recipe test fixture (`tools/test/fixtures/recipe`). `scan` finds 6 screens, 3 endpoints, 1 weekly cron job, 4 tables, 3 outside services (payments, email, sign-in) and 1 AI provider with 2 tools. Group those facts into parts. Only the `PARTS` array is written by hand; `wire` and the starter do the rest.

```json
[
  {"name": "What you see", "role": "screens", "line": "When you open Pantry, you move between your recipes, the weekly plan and your settings.", "from": ["screen:**"]},
  {"name": "Recipe box", "role": "feature", "line": "When you save a recipe, Pantry keeps it in your box so you can find it, change it and cook it again.", "from": ["area:lib/recipes", "area:components/recipes"]},
  {"name": "Meal planner", "role": "feature", "line": "When you plan your week, Pantry puts your recipes on the days you choose.", "from": ["area:lib/plan", "area:components/plan"]},
  {"name": "Recipe ideas", "role": "ai", "line": "When you ask for ideas, an AI model suggests recipes for you to try.", "from": ["ai:*", "area:lib/ai"]},
  {"name": "Weekly email", "role": "jobs", "line": "Once a week, on its own, Pantry prepares your meal plan and emails it to you.", "from": ["job:**"]},
  {"name": "Saved recipes", "role": "data", "line": "When you save a recipe, a plan or your details, it is kept here, so it is waiting next time you come back.", "from": ["table:*"]},
  {"name": "Outside services", "role": "service", "line": "When Pantry takes payment, sends mail or checks who you are, it hands that job to an outside company.", "from": ["service:*"]}
]
```

The drawing then reads: "6 screens", "1 AI model · 2 tools", "Runs 1 job on its own", "4 kinds of saved record", "3 outside services", and a share of the code for each feature. None of those numbers is in the `PARTS`. The three endpoints are not cited, so the screens' calls to them are followed into the code behind them and drawn as cables to the parts that own that code. Billing, email and sign-in are folded into one part because each is a small plug.

### Sample `wire` output

Illustrative; the wording follows `tools/CONTRACTS.md` §3 and the ids depend on the repo. A first attempt that fails (exit 1):

```
$ node tools/scan.mjs wire <canvases>/pantry-facts.json --into <canvases>/pantry-exploded-view.canvas.tsx
✗ Part "Saved recipes": "table:Recipes" matches nothing — did you mean table:Recipe, table:User, table:MealPlan?
✗ service:sign-in is cited by both "Outside services" and "Sign-in"
```

A later attempt that passes (exit 0) but warns:

```
! "Weekly email" has no links
! Not drawn: Payments (service), 2 tables
```

| Line | What it means | What to do |
|------|---------------|------------|
| `✗ … matches nothing` | The pattern is a typo or the fact is gone. Citing it would draw something that isn't there | Use a suggested id, or `table:*`. Look it up with `show` |
| `✗ … cited by both` | One fact claimed by two parts, so counts would double | Remove it from one part, or exclude it: `["service:*", "!service:sign-in"]` |
| `✗ … counts nothing` | A part with no facts to count | Fix `from`, or remove the part |
| `Tier with <n> parts — merge parts` | Thrown when the canvas opens: more than four parts in one tier | Merge parts |
| `! … has no links` | Nothing in the code connects it to another part within three hops, or it reaches code you left uncited | Check `from`. If it really stands alone, leave it: the caption says "Not wired to the other parts". Never invent a link |
| `! Not drawn: Payments (service)` | The drawing hides a fact | Deliberate when billing isn't in the app yet: keep `"!service:payments"` and add "in-app billing" to the footer. Otherwise cite it |
| `! Not drawn: … 2 tables` | The data part cites only some tables, so "kinds of saved record" understates the app | Cite them all (`table:*`) |

Then confirm anything surprising: `node tools/scan.mjs why <canvases>/pantry-facts.json --canvas <canvases>/pantry-exploded-view.canvas.tsx "What you see" "Recipe ideas"` prints the real chain of files behind that cable.

## Anti-patterns

**Bad — dark redacted layout with rainbow tabs**
> Black blocks, yellow/blue/pink journey tabs, dark IDE-colored field.

**Good — Swiss canon**
> White paper, ink type, one red full stop, giant numerals, 12-column grid.

**Bad — document canvas**
> Stack of H1, Stat, Card, CollapsibleSection components.

**Good — typographic poster**
> Raw CSS grid bands, two type roles, flush-left, generous margins.

**Bad — timid document header**
> 64px stacked masthead, gray body copy everywhere, red on rule + boxes + arrows.

**Good — poster scale**
> 112px masthead on one line with a red full stop, ink body copy, one empty zone beside the purpose.

**Bad — boxed flowchart**
> Dashed/solid bordered rectangles with centered uppercase labels and stubby arrows.

**Good — transit line**
> One 2px ink line, solid dots, flush-left station labels, a 90° branch with a hollow ring.

**Bad — architecture diagram dressed as an exploded view**
> Parts named "Next.js", "tRPC", "Prisma"; "12 endpoints" typed by hand when the scan finds 8; a decorative "Infrastructure" part nothing connects to; arrows drawn because they look right; a blue database, a green frontend; SVG text labels inside the drawing.

**Good — the app's real parts and wiring**
> "What you see", "Recipe box", "Saved recipes"; a shape per role; counts and sizes from the scan; a cable only where the code really connects two parts (one checked with `why`); one tinted part; HTML labels in the two gutters; a caption that says what the part does for you.

## Verification Notes

**pantry** (`tools/test/fixtures/recipe`) — 7 parts on 3 tiers: screens on top, then features, AI and the weekly job (the AI/jobs tier folds in because 2 + 2 ≤ 4), then data and outside services. No `api` part, so the endpoints are cables, not a box. The page 3 starter ships these `PARTS`, and its `WIRING` equals a fresh `wire` of them.

**hypher** — All three pages at `hypher-app-poster.canvas.tsx`, `hypher-project-story.canvas.tsx` and `hypher-exploded-view.canvas.tsx`. Monorepo; UI in hypher-web. Playbook items marked in footer only (same list on all three pages). Reference build for the poster-scale masthead, giant numerals, 4-station transit line on the 12-col grid, and tagline-led page 2. Page 3 must be rebuilt from a scan (`scan` → `draft` → `wire`); the earlier hand-written page 3 data no longer applies. Delete any leftover `hypher-app-guide.canvas.tsx`.

**learnr** — Single Next.js app, landing → intake → workspace.

**vyo (empty scaffold)** — `scan` reports `empty: true`. No poster. Report no application detected.

# Examples

## Sample Prompts

**Client handoff**
> Explain this app to my client as a Swiss Style poster — they need to understand what we built without any code.

**PM overview**
> Walk me through how this product works for a PM. Poster format, focus on flows and what's actually live.

**General**
> Explain what this app does. Visualize the repo as a poster.

**Selling / connection (page 2 emphasis)**
> Explain this codebase so I can talk about my product confidently — I need the second page with talking points.

## Sample Chat Response

```markdown
This app is a team task board where members sign in, create projects, and track work on a shared dashboard.

**Page 1 — how it works:** [taskflow-app-poster](/Users/niki_g/.cursor/projects/.../canvases/taskflow-app-poster.canvas.tsx)

**Page 2 — your story:** talking points, who it's for, and what's real today — [taskflow-project-story](/Users/niki_g/.cursor/projects/.../canvases/taskflow-project-story.canvas.tsx)

Note: billing is wired on the server but there is no payment screen yet — marked on both pages.
```

## Sample Poster Copy (Hypher)

### Folio
- APP GUIDE · Solo builders · Web app

### Masthead
```
Hy
pher
```
A spatial project brain for solo builders — capture thoughts anywhere, see them cluster on a canvas, and get an AI-written daily digest.

### Meta column (numbered)
1. Capture a note or file — pick a project
2. Organize on the spatial canvas
3. Read the daily AI digest
4. Share a read-only canvas link

### Body columns

**The problem** — Builders split ideas across notes, tabs, and repos…

**How it works** — Landing · Capture home · Spatial canvas · Dashboard · Settings

**Connected** — Clerk · Convex · Claude · Stripe · GitHub (PAT)

### Footer
Not built: npm package, GitHub OAuth, voice capture

## Sample Page 2 Copy (Hypher)

### Folio
- PROJECT STORY · For solo builders · Page 2

### Masthead
```
Hy
pher
```
Your ideas, finally in one place.

**In one breath:** "Hypher is a workspace for solo builders who are tired of losing ideas across tabs. You capture a thought in seconds, see it organized on a canvas, and get a daily digest that keeps you moving — without becoming a project manager."

### Body columns

**Who it's for** — Solo builders, indie hackers, and consultants juggling multiple projects. The moment: you had a great idea in the shower and can't find it by afternoon.

**Why they'll care** — One place for thinking, not ten apps. Less mental overhead. Share a link when you want someone to see your work, not your file system.

**What to say**
1. "Most builders lose ideas across ten tabs — Hypher keeps everything in one workspace."
2. "You capture a thought in seconds; the app organizes it on a spatial canvas."
3. "Share a read-only link when you want feedback, not repo access."

### What's real today
- Sign in and land on a personal dashboard
- Capture notes and files into projects
- Organize work on a spatial canvas
- Daily AI digest of recent activity
- Billing is not in the app yet

### Differentiation + vision

**How you're different** — Not another notes app with folders. Not a team project manager. A spatial brain for one person who ships alone.

**The vision** — You built this because scattered thinking was costing you momentum. What you have now is a single place to capture, see patterns, and share — on your terms.

## Anti-patterns

**Bad — dark redacted layout with rainbow tabs**
> Black blocks, yellow/blue/pink journey tabs, dark IDE-colored field.

**Good — Swiss canon**
> White paper, ink type, one red accent rule, numbered journeys, 12-column grid.

**Bad — document canvas**
> Stack of H1, Stat, Card, CollapsibleSection components.

**Good — typographic poster**
> Raw CSS grid bands, two type sizes, flush-left, generous margins.

## Verification Notes

**hypher** — Poster at `hypher-app-poster.canvas.tsx`. Monorepo; UI in hypher-web. Playbook items marked in footer only.

**learnr** — Single Next.js app, landing → intake → workspace.

**vyo (empty scaffold)** — No poster. Report no application detected.

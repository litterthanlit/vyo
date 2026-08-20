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

Note: billing is not in the app yet — marked in both footers. Do not list Stripe under Connected.
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
> 116px masthead on one line with a red full stop, ink body copy, one empty zone beside the purpose.

**Bad — boxed flowchart**
> Dashed/solid bordered rectangles with centered uppercase labels and stubby arrows.

**Good — transit line**
> One 2px ink line, solid dots, flush-left station labels, a 90° branch with a hollow ring.

## Verification Notes

**hypher** — Both pages at `hypher-app-poster.canvas.tsx` and `hypher-project-story.canvas.tsx`. Monorepo; UI in hypher-web. Playbook items marked in footer only (same list on both pages). Reference build for the poster-scale masthead, giant numerals, 4-station transit line on the 12-col grid, and tagline-led page 2. Delete any leftover `hypher-app-guide.canvas.tsx`.

**learnr** — Single Next.js app, landing → intake → workspace.

**vyo (empty scaffold)** — No poster. Report no application detected.

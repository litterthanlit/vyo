# Examples

## Sample Prompts

**Client handoff**
> Explain this app to my client as a Swiss Style poster — they need to understand what we built without any code.

**PM overview**
> Walk me through how this product works for a PM. Poster format, focus on flows and what's actually live.

**General**
> Explain what this app does. Visualize the repo as a poster.

## Sample Chat Response

```markdown
This app is a team task board where members sign in, create projects, and track work on a shared dashboard.

Open the poster beside this chat: [taskflow-app-poster](/Users/niki_g/.cursor/projects/.../canvases/taskflow-app-poster.canvas.tsx)

Note: billing is wired on the server but there is no payment screen yet — marked in the footer.
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

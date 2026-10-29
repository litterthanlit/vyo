# Brief — vyo-launch

- **Product / subject:** Vyo, an agent skill that reads a code repository and draws a poster
  explaining what the product does. It scans the code (screens, requests, saved data, outside
  services, AI calls, background jobs), turns it into plain words, and sets those words in a
  shape that fits the product.
- **Audience:** designers and design engineers on X who build with coding agents and have seen
  plenty of generic AI output.
- **The one thing they should remember:** Vyo turns a repo into a poster that says, in plain
  words, what the product is for.
- **Call to action:** the name, and the line "Point it at a repo. Get the poster." No URL yet.
- **Format:** 16:9 · 1920×1080 · 30fps · ~20s · silent-first.
- **Tone & references:** calm, precise, Linear/Vercel launch lineage, in litt. The product's own
  artifacts carry the film: real file paths from the recipe planner Vyo tests itself on, the
  real scan results, and two real posters (Hypher, the recipe planner).
- **Brand constraints:** litt-dark, type kit litt. Vyo's orange is the accent (theme.ts), used as
  light and as the wordmark's dot only. File paths are code, so they sit in Geist Mono in the
  grey; plain words are Geist in fg. Emphasis by ink.
- **Must-say ideas:**
  1. Code says how an app works, not what it's for.
  2. Vyo reads every file first.
  3. It turns code into plain words.
  4. Then it draws a poster in a shape that fits the product.
  5. Vyo. Point it at a repo. Get the poster.

## Assumptions

- The scan numbers are real (`scan.mjs` on the recipe-planner fixture: 6 screens, 3 requests,
  4 tables, sign-in/payments/email, 1 AI provider, 1 job, 41 files).
- The prompt typed in the terminal is how a user would ask an agent for the poster; there is no
  public install command yet, so the end card makes no install claim.
- The posters are shown as images (Media) because they are the product's output, not the film's
  type. They keep their own colours.

---
name: explain-app
description: >-
  Use when the user asks to explain the app, walk through how it works for a
  client, PM or stakeholder, create a non-technical overview, demystify the
  codebase for someone who does not code, help someone sell or talk about their
  product, visualize the repo as a poster, or draw the codebase. Produces one
  type-led poster (PNG and PDF) in which the product's own words build a shape
  that acts out what the product does.
---

# Explain App

The deliverable is one poster. A shape acts out the product's main moment, and the product's own words fill it. One accent colour marks the one word that matters, and the footer carries counts the tools read from the code.

```
repo → scan → facts.json → compose (agent fills a spec) → render → png + pdf
```

You write one small JSON spec. The tools measure, draw and check everything else. Run every command from this skill's directory.

## Set up once

```bash
cd tools && npm install && bash fetch-fonts.sh
```

If Playwright's Chromium is not installed, run `npx playwright install chromium` or set `VYO_CHROMIUM` to a Chromium binary.

## Make the poster

In the commands, `<repo>` is the app's directory and `<name>` is its folder name.

1. Scan the code.
   ```bash
   node tools/vyo.mjs scan <repo> --out <repo>/vyo/<name>-facts.json
   ```
2. Read the summary: `node tools/vyo.mjs show <repo>/vyo/<name>-facts.json`.
3. Read the product's own docs: `README*`, `docs/`, and `.cursor/skills/explain-app/project-context.md` in the target repo. Write down the customer-facing name, the audience, and the main moment. The main moment is one sentence about the thing the product does that the poster acts out. If no README or `project-context.md` names the product, keep the folder name in `product.name`, expect the `! product name equals the folder name` warning, and ask the user for the real name in your reply. Never invent a product name. You may read the code to confirm a claim. Every claim on the poster must point at something in the scan, the docs or the code. Never write what you cannot point at.
4. List the shapes with `node tools/vyo.mjs shapes`. Pick the shape whose "fits when" matches the main moment. If none fits well, use `hourglass` for an app where a person puts things in and gets one thing back, and `eye` for an app that reads or monitors. Say in chat that the fit is loose. Never invent a shape.
5. Write the scaffold spec. `--repo` reads the latest commit and its date for the footer.
   ```bash
   node tools/vyo.mjs compose <repo>/vyo/<name>-facts.json --shape <id> --repo <repo> --out <repo>/vyo/<name>-poster.json
   ```
6. Fill every slot in the spec in the user's words. See the next section.
7. Render: `node tools/vyo.mjs render <repo>/vyo/<name>-poster.json`.
8. Fix every `✗` line. Render exits 1 until none is left. Weigh every `!` line, and fix it unless you have a reason to keep it.
9. Open the PNG and look at it. The shape must read as the main moment, the hot word must stand out, and no word may read as code.
10. Reply in chat in the format below.

## Write the spec

`compose` fills `version`, `facts`, `product`, `theme` and `shape`. You fill the rest.

| Field | What it is |
|---|---|
| `product.name` | The customer-facing name. `compose` copies the folder name, and render warns `! product name equals the folder name` until you change it |
| `theme` | `light` or `dark`, from the themes `vyo shapes` lists for the shape |
| `headline` | One plain sentence about the outcome, at most 72 characters, such as "Switch agents without starting over." Never a feature list |
| `hot` | The one word, or two-word phrase, that matters. It must be one of the words in the slots. It is the only text in the accent colour |
| `slots` | The words that build the shape. `vyo shapes` prints each slot's prompt and limits. Fill word slots toward the top of their range with nouns the user would say, because a short list repeats on every row and words like "edits, removals" read as filler |
| `notes` | The footer columns: 3 for most shapes, 2 for `warm-start`. Each has a `title` of at most 24 characters and a `text` of at most 220. The jobs below are suggestions, not required |
| `notBuilt` | 0 to 6 plain items the code has but the user cannot use yet. Render prints them as "Not built yet: …" |
| `audience` | Optional. Who the poster is for |

The notes say what the shape cannot. Pick each column's job from these: how it works, what you get, what stays private, what runs on its own, and proof (only when a doc records a dated real run). Never write a note that says something is missing. Pick a different job for that column.

`notBuilt` keeps the poster honest. A payments library with no checkout screen goes here, never in a slot or a note.

Never type a count, a commit or a date. Render writes the counts line and the provenance line from the scan.

Follow [plain-language-rules.md](plain-language-rules.md) for voice, naming and the banned terms. Render rejects banned terms, file paths, and "01/02/03" markers. [examples.md](examples.md) has a full sample spec for every shape.

## Where output goes

Render writes `<name>-poster.html`, `<name>-poster.png` and `<name>-poster.pdf` beside the spec, or into `--out <dir>`. Keep every file in `<repo>/vyo/`. Tell the user to add `vyo/` to `.gitignore` unless they want to commit the poster. Never write anywhere else inside the scanned repo.

## Reply in chat

Four parts, in this order:

1. One sentence on what the app does.
2. The shape you chose and why, in one sentence.
3. The absolute paths of the PNG and the PDF.
4. Honest gaps: what is not built yet, a loose shape fit if you had one, and a request for the real product name if no doc gave it.

## Edge cases

- **Empty scan.** `show` reports no facts and render prints `! no application facts`. If the docs describe a product, make the poster from the docs and say in chat that the footer has no counts. If there are no docs either, make no poster. Tell the user no app was found, and suggest a README or a filled `project-context.md`.
- **No screens.** The code answers requests but has no screens. Say "there is no user interface in this repository" in chat, and write the slots about what the service does for the people who call it.
- **Several apps in one repo.** Scan the root. `show` lists the packages. Name the product, not a folder, and never mention how the code is split.
- **`project-context.md` exists.** Its name, audience, main moment, hot word and shape preference win over what you inferred. Its not-built list goes into `notBuilt`.

## Related skills

| Skill | Use instead when |
|---|---|
| `codebase-onboarding` (if installed) | A developer is joining the repo |
| `codebase-documenter` (if installed) | Contributor docs, README, API reference |
| `project-handoff` (if installed) | Build status and next steps for agents |

---
name: explain-app
description: >-
  Use when the user asks to explain the app, walk through how it works for a
  client, PM or stakeholder, create a non-technical overview, demystify the
  codebase for someone who does not code, help someone sell or talk about their
  product, visualize the repo as a poster, or draw the codebase. Produces one
  type-led poster (PNG and PDF) drawn from the codebase itself, with the part
  the product is about in the accent and a few plain words around it.
---

# Explain App

The poster is a field: the codebase drawn as rows of its own parts, one row or peak per share of the code. The tools compute the field from a scan, so you make four choices: which field, which part gets the accent, plain names for the parts that need them, and the words. The tools add a footer of counts and check the result.

Run commands from this skill's directory. `<repo>` is the app's directory, `<name>` its folder name.

## Set up once

```bash
npm install --prefix tools
bash tools/fetch-fonts.sh
```

For Chromium, run `npx --prefix tools playwright install chromium` or set `VYO_CHROMIUM`.

## Make the poster

1. Scan: `node tools/vyo.mjs scan <repo> --out <repo>/vyo/<name>-facts.json`.
2. Summarise: `node tools/vyo.mjs show <repo>/vyo/<name>-facts.json`.
3. List the parts: `node tools/vyo.mjs parts <repo>/vyo/<name>-facts.json`. Each line has an id like `area:lib/plan`, its share of the lines, its files and its scanned name. A name followed by `! looks like a vendor or code name` needs a plain name.
4. Read `README*`, `docs/` and `.cursor/skills/explain-app/project-context.md` in the target repo if the owner wrote one. Write the product's name and its story in one sentence: what it does for a person. Every claim must point at the scan, the docs or the code.
5. Choose the field, wave or terrain (see below), and the accent part: the part the story is about.
6. Write the scaffold:
   ```bash
   node tools/vyo.mjs compose <repo>/vyo/<name>-facts.json --field wave --accent area:lib/plan --repo <repo> --out <repo>/vyo/<name>-poster.json
   ```
   `--repo` puts the latest commit in the footer. `--accent` refuses an id that `vyo parts` did not list. `compose` places the masthead, headline and aside, adds a placeholder name for each flagged part, and prints `floor: <y>` and the line heights.
7. Replace every `…` value: the product name, `fits`, the headline, the names, the sentence (wave), the aside, the notes and `notBuilt`. Render rejects any placeholder left.
8. Sketch: `node tools/vyo.mjs sketch <repo>/vyo/<name>-poster.json`. Act on every `!` line. A part that is never drawn sits under a text block, so move the block.
9. Render: `node tools/vyo.mjs render <repo>/vyo/<name>-poster.json`.
10. Fix every `✗` line. Render exits 1 until none is left. Weigh every `!` line. `part-name` means a part still shows a vendor or code name. `accent-part` means the field has no accent.
11. Open the PNG at full size and shrunk to a thumbnail. The accent part must stand out at thumbnail size, and no row may read as code. If not, change the accent, a name or a text block, and go back to step 8.
12. Reply in chat in the format below.

## Choose the field

- **wave** bends one band of the codebase across the page, one row per share of the code, top to bottom in tree order. Choose it when the story is flow or a hand-off: something goes in, moves through, and comes out.
- **terrain** draws the codebase as a range, one peak per part, height by code and width by files. Choose it when the story is what is big and what matters: a few parts carry the product.

If you cannot decide, take wave. `project-context.md` may name a field preference. It wins.

## The words

- **Headline.** One plain sentence about the outcome for the user, at most 72 characters.
- **Sentence.** Wave only, optional. At most 40 characters, set in every 5th row. Use the product's promise in a few words, like "dinner, decided". Remove the key if nothing fits.
- **Aside.** One or two sentences that say how to read the field and what the accent rows are.
- **Notes.** Two or three footer columns, each doing a job the picture cannot: how it works, what you get, what stays private, what runs on its own, or proof.
- **`notBuilt`.** Plain items the code has but a user cannot use yet.
- **Plain names.** Name every flagged part by what it does for a person: "server", "sign-in", "payments", "the plan". Never the vendor, the folder or the code name. Rename parts that share a scanned name, so each row reads differently. A row prints its name in lower case.
- **Vendor names.** A product or tool name the user uses today, like Claude Code or Cursor, may appear. A vendor the user never touches, like a database or a payment library, may not.
- **Counts and dates.** Render writes the counts line, the commit and the date in the footer. Never type them there. A proof note may name the date of the run it cites.

Follow [plain-language-rules.md](plain-language-rules.md).

## Spec fields for a field poster

`compose` fills `version`, `facts`, `product` and `theme` (`light` or `dark`).

| Field | What it is |
|---|---|
| `product.name` | The customer-facing name. `product-name` warns while it is the folder name |
| `headline` | At most 72 characters |
| `accent` | Optional hot colour for the whole poster, a hex. Not the region's `accent` |
| `figure.fits` | What the picture is and why, at most 160 characters. Never drawn |
| region `field` | `wave` or `terrain`. At most one field per figure |
| region `accent` | The accent part's id from `vyo parts`, like `area:lib/plan` |
| region `names` | Part id to plain name, at most 24 characters each |
| region `sentence` | Wave only, at most 40 characters |
| `figure.texts` | Masthead, headline and aside. Move a block and the field makes room |
| `notes` | 2 or 3. `title` at most 24 characters, `text` at most 220 |
| `notBuilt` | 0 to 6 items, at most 32 characters each |

Leave out `hot`. The accent part carries the colour. [examples.md](examples.md) has a full wave spec and a full terrain spec. [tools/README.md](tools/README.md) lists every check.

## Where output goes

Render writes `<name>-poster.html`, `.png` and `.pdf` beside the spec or into `--out <dir>`. Keep every file in `<repo>/vyo/`, and suggest adding it to `.gitignore`.

## Reply in chat

1. One sentence on what the app does.
2. The field, the accent part and why they tell the product's story.
3. The absolute paths of the PNG and the PDF.
4. Gaps: what is not built, any part name you could not make plain, and a request for the real name if no doc gave one.

## Edge cases

- **Empty scan.** `vyo parts` lists nothing and there is no field to draw. Draw your own silhouette from the docs (below) and say the footer has no counts. With no docs either, make no poster.
- **No docs.** Keep the folder name, accept the `product-name` warning, and ask for the real name. Never invent one.
- **No screens.** Say "there is no user interface in this repository" and describe what the service does for its callers.
- **Several apps.** Scan the root. Name the product, not a folder. Put the accent on the part the product is about.
- **`project-context.md`.** Its name, audience, story, field preference, accent part, picture and not-built list win over what you inferred.

## Draw your own silhouette

Use this path only when the owner asks for a picture, like "draw it as an hourglass", or the scan is empty. Write the figure as fill regions: outlines the tool fills with the product's words. Start with `compose --from <preset>` (`node tools/vyo.mjs presets` lists them), then reshape the geometry until `preset-copy` is gone. [examples.md](examples.md), under "Drawing your own silhouette", has the method, four presets as full specs and three invented figures.

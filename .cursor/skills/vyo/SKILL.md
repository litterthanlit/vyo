---
name: vyo
description: >-
  Use when the user asks to explain the app, walk through how it works for a
  client, PM or stakeholder, create a non-technical overview, demystify the
  codebase for someone who does not code, help someone sell or talk about their
  product, visualize the repo as a poster, or draw the codebase. Produces one
  poster (PNG and PDF) that draws the codebase as a field of its own parts,
  with the part the product is about in the accent, a legend that says what
  the picture encodes, and a few plain words around it.
---

# vyo

The poster is a field: the codebase drawn from a scan, one row, peak, stream or band per part, sized by its code. The field fills the sheet, and a few plain words sit in the corners it leaves empty. You choose the field, the accent part, the plain names and the words, and for a shape field you draw the silhouette. The tools draw, place and check the rest.

Run commands from the target repo. `<repo>` is the app's directory, `<name>` its folder name, and `<facts>` is `<repo>/vyo/<name>-facts.json`.

## Set up once

The tools are the npm package `@litterthanlit/vyo`, with the fonts bundled. Add it to the target repo so `npx vyo` finds it:

```bash
npm install --save-dev @litterthanlit/vyo
```

Without installing it, write `npx -y @litterthanlit/vyo` wherever this file says `npx vyo`. Render needs Chromium: run `npx playwright install chromium` or set `VYO_CHROMIUM` to a Chromium binary. When none starts, render prints the exact command.

## Make the poster

1. Scan: `npx vyo scan <repo> --out <facts>`.
2. Summarise: `npx vyo show <facts>`.
3. List the parts: `npx vyo parts <facts>`. Each line has an id like `area:lib/plan`, its share of the lines, its files and its scanned name. A name followed by `!` needs a plain name.
4. Read `README*`, `docs/` and `project-context.md` beside this file if the owner wrote one. Write the product's name and its story in one sentence: what it does for a person. Every claim must point at the scan, the docs or the code.
5. Choose the field by the story (see below) and the accent part: the part the story is about. For a river or a shape, run `parts <facts> --field <field>` again: a river splits the code into finer parts, and a shape into at most 12.
6. Write the scaffold:
   ```bash
   npx vyo compose <facts> --field wave --accent area:lib/plan --repo <repo> --out <repo>/vyo/<name>-poster.json
   ```
   `--accent` refuses an id that `parts` did not list. Compose refuses to overwrite an existing spec, which may hold your words, unless you pass `--force`. `--repo` gives the record line its commit. Compose finds the corners the field leaves empty, puts the label, headline, legend, a paragraph and the parts list into them, and prints the corners and each text role's size.
7. Replace every `…` value: the product name, the field's `fits`, the headline, the legend, the paragraph, the names, for a wave the `sentence`, and for a shape the `shape` (see "Draw the shape"). Render rejects any placeholder left.
8. Sketch: `npx vyo sketch <repo>/vyo/<name>-poster.json`. It prints the sheet, the text boxes and the corners. Act on every `!` line. If a corner is cramped, or two text boxes touch, move a block into a corner with room or delete the paragraph. Sketch does not flag two text boxes that overlap, so look at the boxes yourself.
9. Render: `npx vyo render <repo>/vyo/<name>-poster.json`.
10. Fix every `✗` line. Render exits 1 until none is left. Weigh every `!` line.
11. Open the PNG at full size and `<repo>-poster-thumb.png`, the poster at 1/6 scale that `render` writes beside it. The accent part must stand out at thumbnail size, the legend must match what you see, and no name may read as code. If not, change the accent, a name or a block, and go back to step 8.
12. Reply in chat in the format below.

## Choose the field

Pick the field whose shape is the story. The `fits` check wants a word that starts with one of the keywords.

- **wave** bends one band of rows down the page, one row per share of the code. Choose it when the story is flow or a hand-off. Keywords "travel", "flow", "hand", "move".
- **terrain** stands each part up as a peak, as tall as its code and as wide as its files. Choose it when the story is what is big and what matters. Keywords "big", "weight", "matters", "most".
- **river** runs one stream of digits per part in from the left and merges them into one channel. Choose it when the story is many things merging into one. Keywords "merge", "join", "many", "one".
- **shape** cuts a silhouette you draw into one band per part, as much area as its code, the type as big as its share. Choose it when one object stands for the product, or the owner asks for a picture. Keywords "object", "thing", "picture", "shape", "looks".

If you cannot decide, take wave. A field preference in `project-context.md` wins.

## Draw the shape

1. Pick one object a stranger would name in a second, tied to the story: a jar for a pantry, a paper plane for a hand-off. Never a heart, a plain circle or a box.
2. Name the one feature that makes it that object, like the jar's lid and shoulders. Draw the object in 3 to 6 ops in a 100-unit box, y down, with that feature large. `compose --field shape` prints the format.
3. Leave one top corner clear for the headline and legend: start from `"fit": { "h": 0.85, "cy": 0.62 }`, and rotate it a few degrees if it fills the width.
4. Pick the look with `style`. `bands` (the default) cuts the shape top to bottom and suits any outline, thin parts included. `rings` sets the names along the outline, ring inside ring, with the core in level lines; add `"echo": 6` for faded outlines around it. Choose rings for a fat, round object (a jar, a stone, a bulb) and cut a hole in it where the legend should sit. A thin or spiky shape (a plane, a key, a ladder) starves the rings; take bands, or fatten it until `shape-rings` is quiet.
5. Sketch, then open `<name>-sketch.png`. Say in one word what you see. If that word is not the object, redraw it. Fix every `!` line: each gives the number to change.
6. Render and look at the thumbnail again.

## The words

- **Headline.** One plain sentence about the outcome for the user, at most 72 characters. It is the only large type.
- **Legend.** Required. One or two sentences, at most 180 characters, that say what the picture encodes. Name the accent part by its plain name and the measure: "code" or "lines" for a wave or terrain, plus "files" or "wide" for a terrain, "merge", "join" or "flow" for a river, and "code" plus "type" or "bigger" for a shape ("area" for rings). Example: "Every peak is a part of Pantry, as tall as its code and as wide as its files. The orange peak is the plan."
- **Fits.** On the field region, at most 160 characters, never drawn. Say why this field matches the product's story, with the field's keyword. Example: "Pantry merges many saved recipes into one week, so every part of its code joins one river."
- **Paragraphs.** 0 to 2, each at most 2 sentences and 220 characters. Each does a job the picture cannot: how it works, what stays private, what runs on its own, or proof.
- **Parts list.** `parts: true` prints the parts' plain names in tree order. Keep it when the field prints no names, as a river does.
- **Plain names.** Name every part in `names`, not only the flagged ones, in lowercase, and never with the product's own name; say what each does for a person: "server", "sign-in", "the plan". Never the vendor, the folder or the code name. Give parts that share a scanned name a name each. A product or tool the user uses today, like Claude Code or Cursor, may appear. A vendor the user never touches, like a database, may not.
- **The record line is the engine's.** Render writes the name, commit and date at the bottom or up the left edge. Never type a commit, a date or a count.

Follow [plain-language-rules.md](plain-language-rules.md).

## Spec fields for a field poster

`compose` fills `version`, `facts`, `product` and `theme` (`light` or `dark`). The frame is `loose` unless the spec says `swiss`.

| Field | What it is |
|---|---|
| `product.name` | The customer-facing name. `product-name` warns while it is the folder name |
| `product.commit` | The short hash. `compose --repo` fills it, and the record line needs it |
| `headline` | At most 72 characters |
| region `field` | `wave`, `terrain`, `river` or `shape`. One field per figure |
| region `fits` | Why this field matches the story, with its keyword, at most 160 characters |
| region `accent` | The accent part's id from `vyo parts` |
| region `names` | Part id to plain name, at most 24 characters each |
| region `sentence` | Wave only, at most 40 characters, set in every 5th row |
| region `shape` | Shape only: `{ ops, rotate?, fit? }`, the silhouette you draw (see "Draw the shape") |
| region `style`, `echo` | Shape only: `bands` (default) or `rings`; `echo` 0 to 12 faded outlines, rings only |
| `figure.texts` | Exactly one `label` and one `headline` (they print the name and the headline), exactly one `legend`, 0 to 2 `paragraph`, 0 or 1 `list`, 0 or 1 `rule`. Each has `x`, `y`, `w` and optional `size` and `align` |
| `record` | Optional, `bottom` or `left`, to force the record line's side |

A loose spec has no `notes`, `notBuilt`, `hot` or `figure.fits`. [examples.md](examples.md) has the wave, terrain, river and shape specs in full. The package's `tools/README.md` lists every check.

## Where output goes

Render writes `<name>-poster.html`, `.png` and `.pdf` beside the spec or into `--out <dir>`. Keep every file in `<repo>/vyo/`, and suggest adding it to `.gitignore`.

## Reply in chat

1. One sentence on what the app does.
2. The field and the accent part, quoting the `fits` sentence.
3. The legend, quoted.
4. The absolute paths of the PNG and the PDF.
5. Gaps: what the code has but a user cannot use yet, any part name you could not make plain, and a request for the real name if no doc gave one.

## Edge cases

- **Empty scan.** `compose --field` refuses with `no parts to draw`. Draw your own silhouette (below) and say the poster has no counts. With no docs either, make no poster.
- **No git history.** The record line has no commit and `record` fails. Use the swiss frame, whose footer works without one.
- **No docs.** Keep the folder name, accept the `product-name` warning, and ask for the real name. Never invent one.
- **No screens.** Say "there is no user interface in this repository" and describe what the service does for its callers.
- **Not built yet.** The loose frame has no place for it. List it in the reply, or use the swiss frame's `notBuilt` if the owner wants it on the poster.
- **Several apps.** Scan the root. Name the product, not a folder. Put the accent on the part the product is about.
- **`project-context.md`.** Its name, audience, story, frame preference, field preference, accent part, picture and not-built list win over what you inferred.

## Swiss frame

Use it when the owner asks for a masthead and footer, or the repo has no git history. `compose --field <f> --frame swiss` writes a masthead, headline and aside over the field, and a footer with the counts, 2 or 3 `notes` and `notBuilt`. The field still takes `fits`. The aside does the legend's job, unchecked. [examples.md](examples.md) has `wave-swiss`.

## Draw your own silhouette

Use this only when the scan is empty, so there are no parts to cut a shape field into. A picture the owner asks for, like "draw it as a jar", is a shape field. This path is swiss only. Start with `compose --from <preset>` (`npx vyo presets` lists them), then reshape the geometry until `preset-copy` is gone. [examples.md](examples.md), under "Drawing your own silhouette", has the method, four presets and three invented figures.

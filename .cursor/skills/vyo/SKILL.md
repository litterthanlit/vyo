---
name: vyo
description: >-
  Use when the user asks to explain the app, walk through how it works for a
  client, PM or stakeholder, create a non-technical overview, demystify the
  codebase for someone who does not code, help someone sell or talk about their
  product, visualize the repo as a poster, or draw the codebase. Produces one
  poster (PNG and PDF) that draws the codebase as a field of its own parts,
  with the part the product is about in the accent, a legend that says what
  the picture encodes, and a few plain words around it. High-contrast signal
  posters and short GIFs use the same pipeline.
---

# vyo

The poster is a field: the codebase drawn from a scan, one row, peak, stream, triangle or globe per part, sized by its code. The field fills the sheet, and a few plain words sit in the corners it leaves empty. You choose the field, the accent part, the plain names and the words, and the tools draw, place and check the rest.

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
5. Choose the field by the story (see below) and the accent part: the part the story is about. For a river, run `parts <facts> --field river` again, because a river splits the code into finer parts with other ids.
6. Write the scaffold. Leave `--field` off unless the story clearly matches one primitive; compose then picks a field that is not wave and not one of the last few, and prints what it picked:
   ```bash
   npx vyo compose <facts> --accent area:lib/plan --repo <repo> --out <repo>/vyo/<name>-poster.json
   ```
   Pass `--field scatter` (or any other kind) when you already know the silhouette. `--accent` refuses an id that `parts` did not list. `--repo` gives the record line its commit. Compose finds the corners the field leaves empty, puts the label, headline, legend, a paragraph and the parts list into them, and prints the corners and each text role's size.
7. Replace every `…` value: the product name, the field's `fits`, the headline, the legend, the paragraph, the names and, for a wave, the `sentence`. Render rejects any placeholder left.
8. Sketch: `npx vyo sketch <repo>/vyo/<name>-poster.json`. It prints the sheet, the text boxes and the corners. Act on every `!` line. If a corner is cramped, or two text boxes touch, move a block into a corner with room or delete the paragraph. Sketch does not flag two text boxes that overlap, so look at the boxes yourself.
9. Render: `npx vyo render <repo>/vyo/<name>-poster.json`. For a GIF, add `motion` to the spec and pass `--gif`.
10. Fix every `✗` line. Render exits 1 until none is left. Weigh every `!` line.
11. Open the PNG at full size and `<repo>-poster-thumb.png`, the poster at 1/6 scale that `render` writes beside it. The accent part must stand out at thumbnail size, the legend must match what you see, and no name may read as code. If not, change the accent, a name or a block, and go back to step 8.
12. Reply in chat in the format below.

## Choose the field

Pick the field whose shape is the story. The `fits` check wants a word that starts with one of the keywords. A new silhouette beats a familiar one.

- **wave** bends one band of rows down the page, one row per share of the code. Choose it when the story is flow or a hand-off. Keywords "travel", "flow", "hand", "move".
- **terrain** stands each part up as a peak, as tall as its code and as wide as its files. Choose it when the story is what is big and what matters. Keywords "big", "weight", "matters", "most".
- **river** runs one stream of digits per part in from the left and merges them into one channel. Choose it when the story is many things merging into one. Keywords "merge", "join", "many", "one".
- **radial** is a triangle of type from an apex. Choose it when the story spreads out from a centre. Keywords "spread", "out", "from", "centre", "center".
- **sphere** is a grid of type-built globes that flatten down the page. Choose it when the story is a round that matters, or a fold. Keywords "curve", "round", "fold", "flat".
- **scatter** is separate clouds of type. Choose it when the parts sit apart, like dust. Keywords "scatter", "speck", "cloud", "dust".
- **shatter** is a grid that breaks along a fault. Choose it when something splits or comes apart. Keywords "break", "grid", "split", "apart".
- **glyph** is one giant letter. Choose it when the story is a mark, a sign or a name. Keywords "letter", "mark", "sign", "name". Set `letter` to one A–Z or 0–9.
- **bleed** is a form whose centre is off the sheet. Choose it when the story runs off an edge or is cropped. Keywords "crop", "bleed", "edge", "off".
- **bands** are stacked bars with gaps between them. Choose it when the story is layers. Keywords "stack", "band", "bar", "layer".
- **spiral** is a coil. Choose it when the story turns. Keywords "spin", "coil", "spiral", "turn".
- **contour** is nested rings around a few hills, like a map. Choose it when the story is levels or a ridge. Keywords "contour", "level", "map", "ridge".
- **trace** fills a shape traced from a PNG (`mask`: `"wings"`, `"trace"`, or a path). Choose it when the silhouette comes from an image. Keywords "trace", "mask", "image", "from".

Any field from scatter to trace takes `symbols: true`: the shape is drawn in sparse clusters of `=`, `+` and `#`, shaded by depth, the way ASCII art draws a form. On charcoal with one signal colour it is the strongest still the tool makes; `npx vyo presets wings` shows it.

### Do not repeat the last shape

Never default to wave. Run `npx vyo shapes` from the repo, which reads `vyo/recent-shapes.json` beside the spec,, and pick a primitive that is not in the last few. Match keywords only among those. `compose` without `--field` already does this: it will not pick wave, it picks a field absent from the log (which one depends on the repo), and it prints the pick. Still pass `--field` when the story clearly matches. A field preference in `project-context.md` wins, and wave is not the fallback when that line is blank. For a high-contrast poster (charcoal or paper, one signal colour, grotesque headline), set `frame: "signal"`; `compose --frame signal`. `seed` moves the composition; `0` is the identity.

## The words

- **Headline.** One plain sentence about the outcome for the user, at most 72 characters. It is the only large type.
- **Legend.** Required. One or two sentences, at most 180 characters, that say what the picture encodes. Name the accent part by its plain name and the measure: "code" or "lines" for a wave or terrain, plus "files" or "wide" for a terrain, and "merge", "join" or "flow" for a river. Example: "Every peak is a part of Pantry, as tall as its code and as wide as its files. The orange peak is the plan."
- **Fits.** On the field region, at most 160 characters, never drawn. Say why this field matches the product's story, with the field's keyword. Example: "Pantry merges many saved recipes into one week, so every part of its code joins one river."
- **Paragraphs.** 0 to 2, each at most 2 sentences and 220 characters. Each does a job the picture cannot: how it works, what stays private, what runs on its own, or proof.
- **Parts list.** `parts: true` prints the parts' plain names in tree order. Keep it when the field prints no names, as a river does.
- **Plain names.** Name every part in `names`, not only the flagged ones, in lowercase, and never with the product's own name; say what each does for a person: "server", "sign-in", "the plan". Never the vendor, the folder or the code name. Give parts that share a scanned name a name each. A product or tool the user uses today, like Claude Code or Cursor, may appear. A vendor the user never touches, like a database, may not.
- **The record line is the engine's.** Render writes the name, commit and date at the bottom or up the left edge. Never type a commit, a date or a count.

Follow [plain-language-rules.md](plain-language-rules.md).

## Spec fields for a field poster

`compose` fills `version`, `facts`, `product` and `theme` (`light` or `dark`). The frame is `loose` unless the spec says `swiss` or `signal`.

| Field | What it is |
|---|---|
| `product.name` | The customer-facing name. `product-name` warns while it is the folder name |
| `product.commit` | The short hash. `compose --repo` fills it, and the record line needs it |
| `headline` | At most 72 characters |
| region `field` | `wave`, `terrain`, `river`, `radial`, `sphere`, `scatter`, `shatter`, `glyph`, `bleed`, `bands`, `spiral`, `contour` or `trace`. One field per figure |
| region `fits` | Why this field matches the story, with its keyword, at most 160 characters |
| region `accent` | The accent part's id from `vyo parts` |
| region `names` | Part id to plain name, at most 24 characters each |
| region `sentence` | Wave only, at most 40 characters, set in every 5th row |
| region `seed` | Whole number 0 to 2147483647. Omitted or 0 keeps the field's own silhouette. Compose writes a non-zero seed |
| region `letter` | Glyph only: one character, A–Z or 0–9. Compose uses the first character of the repo name |
| region `mask` | Trace only: `"wings"` or `"trace"` for a bundled mask, or a path to a PNG, absolute or relative to the working directory. Omitted uses the keyhole |
| region `symbols` | Mask fields (scatter to trace): `true` draws the shape in shaded `- : = + #` with gaps, like ASCII art, instead of part names |
| `figure.texts` | Exactly one `label` and one `headline` (they print the name and the headline), exactly one `legend`, 0 to 2 `paragraph`, 0 or 1 `list`, 0 or 1 `rule`. Each has `x`, `y`, `w` and optional `size` and `align` |
| `record` | Optional, `bottom` or `left`, to force the record line's side |

A loose spec has no `notes`, `notBuilt`, `hot` or `figure.fits`. [examples.md](examples.md) has the wave, terrain and river specs in full. The package's `tools/README.md` lists every check.

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

## Signal frame

Use it when the owner wants a high-contrast poster: charcoal or cream, one signal colour (lime `#C8FF00` unless `accent` says otherwise), a grotesque headline, an archival `meta` line, optional highlighter `mark`s. `compose --field <f> --frame signal`. The field still takes `fits`. Its `list` is a stepped list of bold capitals; set `size` up to 44 for the brutalist sheet. Extra roles: `meta` (one archival line, at most 80 characters, no sequential "01/02/03" markers), `display` (a huge word, at most 8 characters), `mark` (a block of the signal colour laid over type like a highlighter; no text, needs `h`). On cream the accent part's rows are highlighted the same way, so the legend says "highlighted". Type may sit on the field.

Hairline `routes` are a region of open SVG paths with optional nodes. `motion` on the spec is `{ kind: "nodes" | "resolve" | "wipe", frames: 8 to 36, fps: 6 to 24 }`. Then `npx vyo render <spec> --gif` writes a GIF and an MP4. `nodes` travels the dots along the hairlines, `resolve` fades rows in from the top, `wipe` grows the marks.

Worked posters and GIFs: `examples/posters/` in the package (also listed at the end of [examples.md](examples.md)).

## Draw your own silhouette

Use this only when the owner asks for a picture, like "draw it as an hourglass", or the scan is empty. It is swiss only. Start with `compose --from <preset>` (`npx vyo presets` lists them), then reshape the geometry until `preset-copy` is gone. [examples.md](examples.md), under "Drawing your own silhouette", has the method, four presets and three invented figures.

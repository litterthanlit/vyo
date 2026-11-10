---
name: vyo
description: >-
  Use when the user asks to explain the app, walk through how it works for a
  client, PM or stakeholder, create a non-technical overview, demystify the
  codebase for someone who does not code, help someone sell or talk about their
  product, visualize the repo as a poster, or draw the codebase. Produces one
  poster (PNG and PDF, and a GIF on request) that draws the codebase as a field
  of its own parts, with the part the product is about in the accent, a legend
  that says what the picture encodes, and a few plain words around it.
---

# vyo

The poster is a field: the codebase drawn from a scan, each part sized by its code. Either you draw one object that stands for the product and the engine cuts it into the parts (a `shape`), or the engine generates a form (a wave, a coil, clouds, a letter). The field fills the sheet, and a few plain words sit in the room it leaves. You choose the field, the look, the frame, the accent part, the plain names and the words, and for a shape you draw the silhouette. The tools draw, place and check the rest.

Run commands from the target repo. `<repo>` is the app's directory, `<name>` its folder name, and `<facts>` is `<repo>/vyo/<name>-facts.json`.

## Set up once

The tools are the npm package `@litterthanlit/vyo`, with the fonts bundled. Add it to the target repo so `npx vyo` finds it:

```bash
npm install --save-dev @litterthanlit/vyo
```

Without installing it, write `npx -y @litterthanlit/vyo` wherever this file says `npx vyo`. Render needs Chromium: run `npx playwright install chromium` or set `VYO_CHROMIUM` to a Chromium binary. When none starts, render prints the exact command. A GIF also needs `ffmpeg` on the path.

## Make the poster

1. Scan: `npx vyo scan <repo> --out <facts>`.
2. Summarise: `npx vyo show <facts>`.
3. List the parts: `npx vyo parts <facts>`. Each line has an id like `area:lib/plan`, its share of the lines, its files and its scanned name. A name followed by `!` needs a plain name.
4. Read `README*`, `docs/` and `project-context.md` beside this file if the owner wrote one. Write the product's name and its story in one sentence: what it does for a person. Every claim must point at the scan, the docs or the code.
5. Choose the look (see "Choose the look"): a drawn shape or a generated field, the frame and the theme. Choose the accent part: the part the story is about. Run `parts <facts> --field <field>` again for the field you chose: a river splits the code into finer parts, a shape into at most 12 (a relief 14).
6. Write the scaffold:
   ```bash
   npx vyo compose <facts> --field shape --style relief --accent area:lib/plan --repo <repo> --out <repo>/vyo/<name>-poster.json
   ```
   Add `--frame signal` for the high-contrast frame and `--theme dark` for a dark sheet. `--style` alone means `--field shape`. With neither `--field` nor `--style`, compose picks a generated field you have not used lately and prints the pick. `--accent` refuses an id that `parts` did not list. `--repo` gives the record line its commit. Compose refuses to overwrite an existing spec, which may hold your words, unless you pass `--force`. For a generated field compose puts the label, headline, legend, a paragraph and the parts list into the corners the field leaves empty and prints them; for a shape it writes the texts with no coordinates, and the engine places them around the shape.
7. Replace every `…` value: the product name, the field's `fits`, the headline, the legend, the paragraph, the names, for a wave the `sentence`, and for a shape the `shape` (see "Draw the shape"). Render rejects any placeholder left.
8. Sketch: `npx vyo sketch <repo>/vyo/<name>-poster.json`. It prints the sheet, the text boxes and the corners, then runs every check that needs no browser, each line at the level render gives it. Fix every `✗` line and act on every `!` line. If a corner is cramped, or two text boxes touch, move a block into a corner with room or delete the paragraph.
9. Render: `npx vyo render <repo>/vyo/<name>-poster.json`. For a GIF, add `motion` to the spec and pass `--gif`.
10. Fix every `✗` line. Render exits 1 until none is left. Weigh every `!` line.
11. Open the PNG at full size and `<repo>-poster-thumb.png`, the poster at 1/6 scale that `render` writes beside it. The accent part must stand out at thumbnail size, the legend must match what you see, and no name may read as code. If not, change the accent, a name or a block, and go back to step 8.
12. Reply in chat in the format below.

## Choose the look

A look is three choices: what draws the form, the frame around it, and the sheet.

**Draw a shape or generate a field.** Draw a `shape` when one object a stranger would name in a second stands for the product (a jar for a pantry, a paper plane for a hand-off), or the owner asks for a picture. It is the strongest poster the tool makes. Draw it from `ops`, or trace it from a PNG with `"mask"` (see "Draw the shape"). Its `style` sets the look over the silhouette:

- `relief`: a lit volume in fine 6px type, each part a layer of its own name, the accent glowing. The object is the poster's pull, with quiet space around it.
- `symbols`: the silhouette in shaded clusters of `- : = + #`, like ASCII art, lit from the top left, the accent's rows in the accent colour. On charcoal in the signal frame with one orange accent it is the Vorflux look. The parts' names do not print, so add the parts list.
- `bands`: the default. The shape cut top to bottom, one band per part, the type as big as its share. Choose it when the part names must read from across a room, and for the brutalist paper sheet.
- `rings`: the names along the outline, ring inside ring. Only for a fat, round object.

Generate a field when no single object fits. Pick the one whose form is the story; the `fits` check wants a word that starts with one of its keywords. `npx vyo shapes` lists them with when each was last used; take one you have not used lately, and never default to wave.

- **wave**: one band of rows bent down the page. Flow or a hand-off. "travel", "flow", "hand", "move".
- **terrain**: a peak per part, as tall as its code and as wide as its files. What is big. "big", "weight", "matters", "most".
- **river**: streams of digits merging into one channel. Many into one. "merge", "join", "many", "one".
- **radial**: a triangle of type from an apex. "spread", "out", "from", "centre", "center".
- **sphere**: type-built globes that flatten down the page. "curve", "round", "fold", "flat".
- **scatter**: separate clouds of type. "scatter", "speck", "cloud", "dust".
- **shatter**: a grid broken along a fault. "break", "grid", "split", "apart".
- **glyph**: one giant letter; set `letter`. "letter", "mark", "sign", "name".
- **bleed**: a form whose centre is off the sheet. "crop", "bleed", "edge", "off".
- **slabs**: stacked slabs with staggered ends. Layers. "stack", "slab", "bar", "layer".
- **spiral**: a coil. "spin", "coil", "spiral", "turn".
- **contour**: nested rings around a few hills. "contour", "level", "map", "ridge".

Every field from scatter to contour takes `symbols: true`: the form drawn in sparse clusters of `- : = + #`, shaded by depth, like ASCII art. `seed` moves a generated field's composition; compose writes one, and `0` is the field's own form. A field preference in `project-context.md` wins.

**The frame.** `loose` (the default) is serif words in the room the field leaves, and a record line. `signal` is the high-contrast frame: a charcoal or paper ground, one signal colour, a grotesque headline, an archival `meta` line and highlighter `mark`s (see "Signal frame"). `swiss` is a masthead over a footer of notes, for a repo with no git history. A shape draws in loose or signal.

**The sheet.** `--theme light` (paper) or `dark` (navy, charcoal in the signal frame). One accent colour; a second colour has to justify itself.

## Draw the shape

1. Pick one object a stranger would name in a second, tied to the story. Never a heart, a plain circle or a box. Simple reads: a 3-op flask was legible at once, an 11-op locomotive half legible.
2. Name the one feature that makes it that object, like the jar's lid and shoulders. Draw it in 3 to 6 ops in a 100-unit box, y down, with that feature large, about as tall as it is wide or taller. Leave out small repeated details such as wheels or windows: they merge at thumbnail size. Keep a post or stem short: a long thin limb takes the object's height and reads as a pole with a small head. `compose --field shape` prints the format.
3. To trace an image instead, write `"shape": { "mask": "wings" }` (a bundled mask, `wings` or `trace`) or a path to a PNG, absolute or relative to where you run vyo. Its pixels darker than mid grey are the silhouette, and every style and check works on it as on ops. A traced shape takes `fit` but no `ops` or `rotate`.
4. Leave `fit` out: the engine fits the shape inside the sheet and centres it in the room the words leave. Set `fit` only to bleed it off an edge on purpose. Leave `x` and `y` out of the text blocks too: the engine places them in the room the shape leaves. Pin a block with `x` and `y` only for a reason, like a hole cut for the legend or a `mark` laid over it.
5. If `shape-dominant` says to split a part, add the `"split"` it gives to the region and run `parts --field shape --split <its id>`. Its folders become parts; if it was the accent, put the accent on the one the story is about.
6. Set the `style` (see "Choose the look"). Rings want a fat, round object with a hole cut where the legend should sit, and `"echo": 6` adds faded outlines; a thin or spiky shape starves them, so take bands or relief, or fatten it until `shape-rings` is quiet.
7. Sketch, then open `<name>-sketch.png`; big lines of type show as bars, symbols as their shading. Say in one word what you see. If that word is not the object, redraw it simpler. Fix every `✗` and `!` line: each gives the number to change.
8. Render and look at the thumbnail again.

A relief needs no hints: the default is a rounded volume lit from the top left. Add one only for a feature the outline cannot show, and sketch again after each:

- `"face": "lit"` or `"dim"` on an add makes it a flat facet toward or away from the light, like a paper plane's wing and keel.
- `{ "crease": kind, ... }` folds the surface along that kind's outline, or along a capsule's or arc's centre line, like a lid's ridges. It never changes the silhouette.
- Region `bevel` (0 to 1, default 0.7) is how much of the form is rounded: 0.2 for a flat top, 1 for a dome.
- Region `strata` turns the layers: `{ "by": "angle", "angle": 135 }` across a diagonal form, `{ "by": "depth" }` for shells from the outline in.

## The words

- **Headline.** One plain sentence about the outcome for the user, at most 72 characters. It is the only large type.
- **Legend.** Required. One or two sentences, at most 180 characters, that say what the picture encodes. Name the accent part by its plain name and the measure: "code" or "lines" for most fields, plus "files" or "wide" for a terrain, "merge", "join" or "flow" for a river, and "code" plus "type", "size" or "bigger" for a shape ("area" for rings; a relief or symbols: "as big as its code"). Example: "Every peak is a part of Pantry, as tall as its code and as wide as its files. The orange peak is the plan."
- **Fits.** On the field region, at most 160 characters, never drawn. Say why this field matches the product's story, with the field's keyword. Example: "Pantry merges many saved recipes into one week, so every part of its code joins one river."
- **Paragraphs.** 0 to 2, each at most 2 sentences and 220 characters. Each does a job the picture cannot: how it works, what stays private, what runs on its own, or proof.
- **Parts list.** `parts: true` prints the parts' plain names in tree order. Keep it when the field prints no names, as a river or a symbols fill does.
- **Plain names.** Name every part in `names`, not only the flagged ones, in lowercase, and never with the product's own name; say what each does for a person: "server", "sign-in", "the plan". Never the vendor, the folder or the code name. Give parts that share a scanned name a name each. A product or tool the user uses today, like Claude Code or Cursor, may appear. A vendor the user never touches, like a database, may not.
- **The record line is the engine's.** Render writes the name, commit and date at the bottom or up the left edge. Never type a commit, a date or a count.

Follow [plain-language-rules.md](plain-language-rules.md).

## Spec fields for a field poster

`compose` fills `version`, `facts`, `product`, `frame` and `theme` (`light` or `dark`).

| Field | What it is |
|---|---|
| `product.name` | The customer-facing name, capitalised as the product's docs write it. `product-name` warns while it is the folder name; keep it if the docs write it that way |
| `product.commit` | The short hash. `compose --repo` fills it, and the record line needs it |
| `headline` | At most 72 characters |
| region `field` | `shape`, `wave`, `terrain`, `river`, `radial`, `sphere`, `scatter`, `shatter`, `glyph`, `bleed`, `slabs`, `spiral` or `contour`. One field per figure |
| region `fits` | Why this field matches the story, with its keyword, at most 160 characters |
| region `accent` | The accent part's id from `vyo parts` |
| region `names` | Part id to plain name, at most 24 characters each |
| region `sentence` | Wave only, at most 40 characters, set in every 5th row |
| region `shape` | Shape only: `{ ops, rotate?, fit? }`, the silhouette you draw, or `{ mask, fit? }`, one traced from a PNG (see "Draw the shape") |
| region `style`, `echo` | Shape only: `bands` (default), `rings`, `relief` or `symbols`; `echo` 0 to 12 faded outlines, rings only |
| region `bevel`, `strata` | Relief only, optional: how rounded the form is, and which way its layers run |
| region `split` | Shape only, optional: part ids whose folders become parts, for a part that is most of the code |
| region `seed` | Generated fields: whole number 0 to 2147483647. 0 keeps the field's own form. Compose writes a non-zero seed |
| region `letter` | Glyph only: one character, A–Z or 0–9. Compose uses the first character of the repo name |
| region `symbols` | Scatter to contour: `true` draws the form in shaded `- : = + #` with gaps, instead of part names |
| `figure.texts` | Exactly one `label` and one `headline` (they print the name and the headline), exactly one `legend`, 0 to 2 `paragraph`, 0 or 1 `list`, 0 or 1 `rule`; the signal frame adds `meta`, `display` and `mark`. Each has `x`, `y`, `w` and optional `size` and `align`; a shape poster leaves `x`, `y` and `w` out and the engine places it, except a `mark` |
| `motion` | Optional, for `--gif`: `{ kind: "nodes" \| "resolve" \| "wipe", frames: 8 to 36, fps: 6 to 24 }` |
| `record` | Optional, `bottom` or `left`, to force the record line's side |

A loose or signal spec has no `notes`, `notBuilt`, `hot` or `figure.fits`. [examples.md](examples.md) has specs in full. The package's `tools/README.md` lists every check.

## Signal frame

Charcoal or cream, one signal colour (lime `#C8FF00` unless the spec's `accent` says otherwise), a grotesque headline, metadata as drawing material. `compose --frame signal`, with a drawn shape (`--style`) or a generated field. Two looks it was made for: charcoal with `"accent": "#FF5A1F"` and a `symbols` shape; and the brutalist sheet, paper with lime, a `bands` shape, a `meta` line, the stepped list and marks. Its `list` is a stepped list of bold capitals; set `size` up to 44 for the brutalist sheet. Extra roles: `meta` (one archival line, at most 80 characters, no sequential "01/02/03" markers), `display` (a huge word, at most 8 characters), and `mark` (a block of the signal colour laid over type like a highlighter: no text, needs `x`, `y`, `w` and `h`, at most 3). Around a shape the engine places the words, so sketch first, read where it put each block on the `texts:` line, and lay the marks over those boxes; a mark never moves a block. On cream the accent part's rows are highlighted the same way, so the legend says "highlighted". Keep a quiet zone: not every area should hold type.

## Motion

`motion` on the spec, then `npx vyo render <spec> --gif`, writes a 560px GIF and an 840px MP4 beside the PNG. `nodes` travels dots along hairline `routes` (a region of open SVG paths with optional nodes), `resolve` fades the rows in from the top, `wipe` grows the marks. Motion reveals the structure; the still must work on its own, and the `still` check holds it to that.

Worked posters and GIFs are in `examples/posters/` in the vyo repository, not in the npm package (listed at the end of [examples.md](examples.md)).

## Where output goes

Render writes `<name>-poster.html`, `.png` and `.pdf` beside the spec or into `--out <dir>`. Keep every file in `<repo>/vyo/`, and suggest adding it to `.gitignore`.

## Reply in chat

1. One sentence on what the app does.
2. The field (and style) and the accent part, quoting the `fits` sentence.
3. The legend, quoted.
4. The absolute paths of the PNG and the PDF (and the GIF).
5. Gaps: what the code has but a user cannot use yet, any part name you could not make plain, and a request for the real name if no doc gave one.

## Edge cases

- **Empty scan.** `compose --field` refuses with `no parts to draw`. Draw your own silhouette (below) and say the poster has no counts. With no docs either, make no poster.
- **No git history.** The record line has no commit and `record` fails. Use the swiss frame, whose footer works without one.
- **No docs.** Keep the folder name, accept the `product-name` warning, and ask for the real name. Never invent one.
- **No screens.** Say "there is no user interface in this repository" and describe what the service does for its callers.
- **Not built yet.** The loose and signal frames have no place for it. List it in the reply, or use the swiss frame's `notBuilt` if the owner wants it on the poster.
- **Several apps.** Scan the root. Name the product, not a folder. Put the accent on the part the product is about.
- **`project-context.md`.** Its name, audience, story, frame preference, field preference, accent part, picture and not-built list win over what you inferred.

## Swiss frame

Use it when the owner asks for a masthead and footer, or the repo has no git history. `compose --field <f> --frame swiss` writes a masthead, headline and aside over the field, and a footer with the counts, 2 or 3 `notes` and `notBuilt`. The field still takes `fits`. The aside does the legend's job, unchecked. A shape does not draw here. [examples.md](examples.md) has `wave-swiss`.

## Draw your own silhouette

Use this only when the scan is empty, so there are no parts to cut a shape field into. A picture the owner asks for, like "draw it as a jar", is a shape field. This path is swiss only. Start with `compose --from <preset>` (`npx vyo presets` lists them), then reshape the geometry until `preset-copy` is gone. [examples.md](examples.md), under "Drawing your own silhouette", has the method, four presets and three invented figures.

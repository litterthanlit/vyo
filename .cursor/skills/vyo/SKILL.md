---
name: vyo
description: >-
  Use when the user asks to explain the app, walk through how it works for a
  client, PM or stakeholder, create a non-technical overview, demystify the
  codebase for someone who does not code, help someone sell or talk about their
  product, visualize the repo as a poster or cover, or draw the codebase. Produces
  one poster (PNG and PDF, and a GIF on request) that draws the codebase as a field
  of its own parts, with the part the product is about in the accent, a legend
  that says what the picture encodes, and a few plain words around it.
---

# vyo

vyo turns a real codebase scan into gallery-grade data art or a sculpted 3D cover that someone who does not code can read. Every geometry is driven by the repo's real line counts, file structure, and cross-area imports. You choose the art direction, the accent part, the plain names, and the words. The tools draw, place, and check the rest.

Run commands from the target repo. `<repo>` is the app's directory, `<name>` its folder name, and `<facts>` is `<repo>/vyo/<name>-facts.json`.

## Set up once

The tools are the npm package `@litterthanlit/vyo`, with the fonts bundled. Add it to the target repo so `npx vyo` finds it:

```bash
npm install --save-dev @litterthanlit/vyo
```

Without installing it, write `npx -y @litterthanlit/vyo` wherever this file says `npx vyo`. Render needs Chromium: run `npx playwright install chromium` or set `VYO_CHROMIUM` to a Chromium binary. When none starts, render prints the exact command. A GIF also needs `ffmpeg` on the path.

**Findings.** Sketch and render print findings. A `✗` line fails the poster and a `!` line weakens it; each names the one change to make, so make it, then run the same command again.

## Pick an art direction

Start from vyo v2's two flagship directions — pick the one that best fits the product's voice:

| Art direction | Command | Best for |
|---|---|---|
| **Data-as-Art Vector Plate** *(flagship)* | `compose --frame plate --plate topo\|blueprint --layout editorial\|blueprint\|macro\|classic --ground obsidian\|carbon\|abyss\|graphite\|bone` | Album-cover / gallery print driven straight from the codebase: marching-squares topographic elevation maps (`topo`) or octilinear PCB circuit schematics wired from real imports (`blueprint`), with `pulse`/`signal` looping GIFs |
| **Studio-Lit 3D Cover** *(flagship)* | `compose --frame cover --finish studio\|halftone\|wireframe\|type --layout editorial\|classic\|blueprint\|macro --ground obsidian\|carbon\|abyss\|graphite\|bone` | Sculpted 3D product object cut by real line shares: continuous-tone studio lighting (`studio`: softbox key + Fresnel rim + distance-field AO + film grain), precision 22.5° `halftone` dot-matrix, smoked-glass `wireframe` contours, or classic 6px Commit Mono `type` relief, on an object you draw for the product or a traced PNG mask |
| **Zine / Turntable Cover** *(opt-in looks)* | `compose --frame cover --look xerox\|spin --ground bone\|obsidian\|carbon\|<legacy>` | Expressive `xerox` 2-plate photocopy treatment (`copier` loop) or 360° kinetic `spin` turntable in `type` finish |
| **Editorial Shape Poster** | `compose --field shape --style relief\|rings\|symbols [--frame signal]` | An object you draw for the product (`ops`), or the owner's traced PNG logo (`mask`), with serif (`loose`) or brutalist (`signal`) typography |
| **Architectural Field** | `compose --field seismic\|orbit\|slabs\|river\|... [--frame loose\|signal]` | Full-sheet typographic fields driven by LOC, files, and imports across 15 field engines |

**Primary recommended palettes (`--ground`):** Start from the 5 refined studio & archival gallery palettes — **`obsidian`** (near-black `#09090B` + cyan), **`carbon`** (warm charcoal `#111113` + copper), **`abyss`** (deep midnight `#070D1A` + blue), **`graphite`** (slate dark `#14171C` + violet), and **`bone`** (archival warm paper `#EFECE6` + ultramarine). Legacy grounds (`navy`, `charcoal`, `forest`, `paper`, `cobalt`, `xerox`, `riso`, `blood`, `acid`) remain available as opt-in grounds for backward compatibility.

All plates and covers support 4 gallery `--layout`s (`classic`, `editorial`, `blueprint`, `macro`) and 3 `--format`s (`poster` `840×1190` default, `square` `960×960` album cover, `og` `1280×640` landscape Open Graph card). To showcase 2–4 plates or covers side by side in one gallery contact sheet (and optional synchronized GIF), run `npx vyo series <spec1> <spec2> [...] --out <base> [--gif]`.

## Make a plate (Data-as-Art)

A plate turns the codebase's real file slices, line counts, and import graph into pure high-resolution vector art on a gallery layout. Follow these steps in order; you need nothing else in this file except "Reply in chat".

1. `npx vyo scan <repo> --out <facts>`
2. Choose a plate kind and compose the scaffold:
   ```bash
   npx vyo compose <facts> --frame plate --plate <topo|blueprint> --layout <editorial|blueprint|macro|classic> --ground <obsidian|carbon|abyss|graphite|bone> [--format poster|square|og] --repo <repo> --out <repo>/vyo/<name>-poster.json
   ```
   - `topo`: marching-squares topographic elevation map rising around each area's lines and import passes (`motion: { kind: "pulse" }`).
   - `blueprint`: octilinear PCB / circuit schematic with proportional part chambers and chamfered import traces (`motion: { kind: "signal" }`). Pairs especially well with `--layout blueprint`.
   Compose auto-splits any part over 40% of the code, sets the matching `motion`, writes the legend pattern, and prints every part (`*` good accent candidate, `-` surrounding code).
3. Read the repo's README. Open the spec compose wrote and replace every value that starts with `…`:
   - `product.name`: the name customers see, as the README writes it.
   - `headline`: one plain sentence, at most 72 characters, on what the product does for a person.
   - `accent`: the id of the part the product is about (never a part marked `-`).
   - `names`: every part, lowercase, at most 24 characters, saying what it does for a person ("sign-in", "the plan"). Never a folder, file, or company name.
   - The legend's `text`: delete the leading `…`, put the product's name for `<product>` and the accent's plain name for `<the accent's plain name>`, keeping the colour word for your `ground` (`cyan`, `copper`, `blue`, `violet`, `ultramarine`, etc.) and the plate's measure words.
4. `npx vyo sketch <repo>/vyo/<name>-poster.json`. Act on every finding, open `<name>-sketch.png`, and re-run sketch until clean.
5. `npx vyo render <repo>/vyo/<name>-poster.json --gif`. It writes the PNG, thumbnail, PDF, looping GIF, and MP4, and runs `plate-parts` and every page check. Act on any finding and render again.
6. Reply as "Reply in chat" says, with the PNG, PDF, and GIF.

## Make a cover (Sculptural 3D)

A cover builds one bold 3D object, cut into layers by the codebase's real line counts, with the part the product is about in the accent colour.

1. `npx vyo scan <repo> --out <facts>`
2. Compose the scaffold (defaulting to a refined gallery palette and choosing your finish and layout):
   ```bash
   npx vyo compose <facts> --frame cover --finish <studio|halftone|wireframe|type> --layout <editorial|classic|blueprint|macro> --ground <obsidian|carbon|abyss|graphite|bone> [--look living|xerox|spin] [--format poster|square|og] [--crop center|bleed-right|macro] --repo <repo> --out <repo>/vyo/<name>-poster.json
   ```
   - **Finishes (`--finish`):** `studio` (continuous-tone studio lighting with softbox key, Fresnel rim, distance-field AO, accent bloom, film grain & subtle 5px micro-type shimmer), `halftone` (precision 22.5° dot-matrix with accent bloom), `wireframe` (smoked-glass Fresnel body with 3D latitude/longitude/elevation hairlines), or `type` (default; classic 6px Commit Mono typographic relief, also used by `--look xerox` and `--look spin`).
   - **Layouts (`--layout`):** `editorial` (Swiss gallery grid with top-left title, archival record & part breakdown), `classic` (top metadata columns + bottom display name), `blueprint` (drafting perimeter frame + bottom-right title block), or `macro` (full-bleed monumental crop with translucent corner plaques).
   Compose splits any part over 40% of the code into its folders or files, leaves the object for you to draw (it prints three ready silhouettes with their ops as references, not the answer), sets the strata and motion (`turn` for `living`/`spin`, `copier` for `xerox`), and writes the legend pattern. It prints every part with its share of the code (`*` strong accent, measured on the first reference until the sketch measures your drawing; `-` surrounding code).
3. Read the repo's README. Open the spec compose wrote and edit it in place: replace each value that starts with `…`, and change nothing else. Never write the spec from scratch; it holds the commit, the date and the splits.
   - `product.name`: the name customers see, as the README writes it.
   - `headline`: one plain sentence, at most 72 characters, on what the product does for a person.
   - `accent`: the id of the part the product is about, the code that does the product's main job. Never a part marked `-`. A `*` only says the part will look good; if the part the product is about has none, choose it anyway, and the sketch says how to make it show.
   - `names`: every part, lowercase, at most 24 characters, saying what it does for a person ("sign-in", "the plan"). Never a folder, file or company name.
   - The legend's `text`: delete the leading `…`, and put the object you draw for `<object>`, the product's name for `<product>` and the accent's plain name for `<the accent's plain name>`. Match the accent colour word (`cyan`, `copper`, `blue`, `violet`, `ultramarine`, or legacy `orange`/`pink`/`yellow`) that compose wrote for your chosen `ground`.
   - `shape`: draw it, as "Draw the shape" says: `why` from the README first, then `object`, then the `ops`. Leave `reads` for step 5. Trace the owner's own logo with `{ "mask": "path/to/silhouette.png" }` only when they have one.
   - Optional 3D solid override (`region.solid.kind`): `"dome"` (sculpted organic volume, default), `"extrude"` (crisp architectural slab with side walls, for a flat object such as a gear, a key, a bolt or a cursor, and for `spin`), or `"revolve"` (axisymmetric lathe, for a round object such as a flask, a jar, a bell or a cup).
4. Pick a curated `ground` palette (free hex colours are refused so contrast always hits):
   - **Primary studio & archival palettes (recommended defaults):** `obsidian` (`#09090B` + cyan), `carbon` (`#111113` + copper), `abyss` (`#070D1A` + blue), `graphite` (`#14171C` + violet), `bone` (`#EFECE6` + ultramarine).
   - **Legacy & opt-in palettes (backward compatibility):** `navy`, `charcoal`, `forest`, `paper`, `cobalt`, `xerox`, `riso`, `blood`, `acid`.
   Leave out `series` for a single cover; set it, like `"02/04"`, only for a numbered set (or let `vyo series` render a numbered grid of 2–4 covers/plates).
5. `npx vyo sketch <repo>/vyo/<name>-poster.json`. It draws while `reads` is blank. Open the sketch PNG and write in `reads` the one word you honestly see. If it is not the object, redraw it simpler and sketch again: `shape-reads` fails until it is. Act on every finding, then sketch again until none is left.
6. `npx vyo render <repo>/vyo/<name>-poster.json --gif`. It writes the PNG, thumbnail, PDF, looping GIF and MP4. Act on any finding and render again.
7. Reply as "Reply in chat" says, with the PNG and the GIF.

## Make the poster

1. Scan: `npx vyo scan <repo> --out <facts>`.
2. Summarise: `npx vyo show <facts>`.
3. List the parts: `npx vyo parts <facts>`. Each line has an id like `area:lib/plan`, its share of the lines, its files and its scanned name. A name followed by `!` needs a plain name.
4. Read `README*`, `docs/` and `project-context.md` beside this file if the owner wrote one. Write the product's name and its story in one sentence: what it does for a person. Every claim must point at the scan, the docs or the code.
5. Choose the look (see "Choose the look"): a drawn/traced shape or a generated/architectural field (`seismic`, `orbit`, `river`, `slabs`, etc.), the frame (`loose` or `signal`) and the theme. Choose the accent part: the part the story is about. Run `parts <facts> --field <field>` again for the field you chose: a river splits the code into finer parts, a shape into at most 12 (a relief 14).
6. Write the scaffold:
   ```bash
   npx vyo compose <facts> --field shape --style relief --accent area:lib/plan --repo <repo> --out <repo>/vyo/<name>-poster.json
   ```
   Add `--frame signal` for the high-contrast grotesque frame and `--theme dark` for a dark sheet. `--style` alone means `--field shape`. With neither `--field` nor `--style`, compose picks a generated field you have not used lately and prints the pick. `--accent` refuses an id that `parts` did not list. `--repo` gives the record line its commit. Compose refuses to overwrite an existing spec, which may hold your words, unless you pass `--force`. For a generated field compose puts the label, headline, legend, a paragraph and the parts list into the corners the field leaves empty and prints them; for a shape it writes the texts with no coordinates, and the engine places them around the shape.
7. Replace every `…` value: the product name, the field's `fits`, the headline, the legend, the paragraph, the names, for a wave the `sentence`, and for a shape the `shape` (see "Draw the shape"). Render rejects any placeholder left.
8. Sketch: `npx vyo sketch <repo>/vyo/<name>-poster.json`. It prints the sheet, the text boxes and the corners, then runs every check that needs no browser, each line at the level render gives it. Act on every finding. If a corner is cramped, or two text boxes touch, move a block into a corner with room or delete the paragraph.
9. Render: `npx vyo render <repo>/vyo/<name>-poster.json`. For a GIF, add `motion` to the spec and pass `--gif`.
10. Act on every finding. Render exits 1 while a `✗` line is left.
11. Open the PNG at full size and `<repo>-poster-thumb.png`, the poster at 1/6 scale that `render` writes beside it. The accent part must stand out at thumbnail size, the legend must match what you see, and no name may read as code. If not, change the accent, a name or a block, and go back to step 8.
12. Reply in chat in the format below.

## Choose the look

A look is three choices: what draws the form, the frame around it, and the sheet.

**Draw a shape or generate a field.** Draw a `shape` when one object a stranger would name in a second stands for what the product does (a jar for a pantry, a gear for a tool that builds from precise parts, a cursor for interface skills), or the owner asks for a picture. You draw it from `ops` (see "Draw the shape"); trace the owner's own logo with `{ "mask": "<path>" }`. Its `style` sets the look over the silhouette:

- `relief`: the default. A lit volume in fine 6px type, each part a layer of its own name, the accent glowing. The object is the poster's pull, with quiet space around it.
- `symbols`: the silhouette in shaded clusters of `- : = + #`, like ASCII art, lit from the top left, the accent's rows in the accent colour. On charcoal in the signal frame with one orange accent it reads as fine grey marks with one hot band. The parts' names do not print, so add the parts list.
- `rings`: the names along the outline, ring inside ring. Only for a fat, round object.

Generate a field when no single object fits, or when the codebase's own architecture is the story. Pick the one whose form is the story; the `fits` check wants a word that starts with one of its keywords. `npx vyo shapes` lists all 15 fields with when each was last used; take one you have not used lately, and never default to wave.

- **seismic**: Joy Division–style stacked codebase ridgelines — each part's peak height encodes its lines, peak count its files, and peak sharpness its cross-area imports, with foreground ridges cleanly occluding background ridges. "pulse", "ridge", "wave", "signal", "peak".
- **orbit**: architectural dependency constellation — discs sized by lines, ranked into core/inner/outer orbits by real import centrality, connected by dotted cross-area import chords. "orbit", "centre", "center", "core", "link", "tie".
- **wave**: one band of rows bent down the page. Flow or a hand-off. "travel", "flow", "hand", "move".
- **terrain**: a peak per part, as tall as its code and as wide as its files. What is big. "big", "weight", "matters", "most".
- **river**: streams of digits merging into one channel from real cross-area imports. Many into one. "merge", "join", "many", "one".
- **radial**: a triangle of type from an apex. "spread", "out", "from", "centre", "center".
- **sphere**: type-built globes that flatten down the page. "curve", "round", "fold", "flat".
- **scatter**: separate clouds of type. "scatter", "speck", "cloud", "dust".
- **shatter**: a grid broken along a fault. "break", "grid", "split", "apart".
- **glyph**: one giant letter; set `letter`. "letter", "mark", "sign", "name".
- **bleed**: a form whose centre is off the sheet. "crop", "bleed", "edge", "off".
- **slabs**: stacked slabs with staggered ends. Layers. "stack", "slab", "bar", "layer".
- **spiral**: a coil. "spin", "coil", "spiral", "turn".
- **contour**: nested rings around a few hills. "contour", "level", "map", "ridge".

Every field from `scatter` to `contour`, plus `seismic` and `orbit`, takes `symbols: true`: the form drawn in sparse clusters of `- : = + #`, shaded by depth, like ASCII art. `seed` moves a generated field's composition; compose writes one, and `0` is the field's own form. A field preference in `project-context.md` wins.

**The frame.** `plate` renders pure high-resolution vector data art (`topo`, `blueprint`) on 4 gallery layouts (see "Make a plate"). `cover` builds a sculpted 3D object with selectable finishes (`studio`, `halftone`, `wireframe`, `type`) and 4 gallery layouts across `poster`/`square`/`og` (see "Make a cover"). `loose` (the default for fields) puts serif words in the room the field leaves, with a record line. `signal` is the high-contrast grotesque frame with archival `meta` and highlighter `mark`s (see "Signal frame"). `swiss` is a masthead over a footer of notes, for a repo with no git history. A shape draws in `loose`, `signal` or `cover`.

**The sheet.** `--theme light` (paper) or `dark` (navy, charcoal in the signal frame) for poster frames; `--ground` (preferring `obsidian`, `carbon`, `abyss`, `graphite`, `bone`) for plates and covers. One accent colour; a second colour has to justify itself.

## Draw the shape

You draw the object. It stands for what this product does, in the skill's design language; it is never a stock picture. Compose leaves `"shape": { "object", "why", "reads", "ops" }`, each a `…` placeholder that render refuses. Fill them in this order:

1. **Why, first.** Read the README and docs. Write `why`: one sentence, at most 160 characters, on what the product does for a person and why your object stands for that. Not its name: "Anatomy, so a bone" is a pun, and `shape-stock` warns when `why` says nothing but the name.
2. **The object.** Write `object`: one plain noun a stranger names in a second, for what the product does. Not a pun on the name, not a stock metaphor like a bulb for "ideas", never a heart, a plain circle or a box.
3. **Draw it** in 3 to 6 ops in a 100-unit box, y down, the first an add. Name the one feature that makes it that object, like a jar's lid and shoulders or a gear's teeth, and draw that large, about as tall as the object is wide or taller. Leave out small repeated details such as wheels or windows: they merge at thumbnail size. Keep a post or stem short: a long thin limb takes the object's height and reads as a pole with a small head. A 3-op flask was legible at once, an 11-op locomotive half legible. `compose --field shape` and `npx vyo shapes` print the format.
4. **Sketch** (`npx vyo sketch <spec>`; it draws while `reads` is blank) and open `<name>-sketch.png`. Write `reads`: the one word you honestly see at that size, not the word you hoped for.
5. **Redraw until it matches.** `shape-reads` fails while `reads` is not the object. Redraw it simpler, with its one feature larger, sketch again and write the new word. Act on every other finding.
6. **Name it in the legend**: "Every layer of the gear is a part of …", never "This shape is …". `shape-legend` warns on a poster whose legend leaves the object out; a cover's `legend` check fails.
7. Set the `style` (see "Choose the look"). Rings want a fat, round object with a hole cut where the legend should sit, and `"echo": 6` adds faded outlines; a thin or spiky shape starves them, so take relief, or fatten it until `shape-rings` is quiet.
8. If `shape-dominant` says to split a part, add the `"split"` it gives to the region and run `parts --field shape --split <its id>`. Its folders become parts, or its files when it has no folders; if it was the accent, put the accent on the one the story is about.
9. Leave `fit` out: the engine fits the shape inside the sheet and centres it in the room the words leave. Set `fit` only to bleed it off an edge on purpose (a cover takes no `fit`). Leave `x` and `y` out of the text blocks too: the engine places them in the room the shape leaves. Pin a block with `x` and `y` only for a reason, like a hole cut for the legend or a `mark` laid over it.
10. Render and look at the thumbnail again.

**Drawn shapes that worked.** Each was drawn for its product, sketched, and read as its object in one word at thumbnail size:

- **A gear** for Anatomy, which builds working objects from precise parts. A round body, four crossing bars that make eight teeth, and a hole:
  ```json
  { "object": "gear", "why": "Anatomy builds working objects from precise parts, the way a gear's teeth mesh to make a machine run.", "reads": "gear", "ops": [
    { "add": "circle", "at": [50, 50], "r": 38 },
    { "add": "rect", "at": [39, 2], "size": [22, 96] },
    { "add": "rect", "at": [39, 2], "size": [22, 96], "rotate": 45 },
    { "add": "rect", "at": [39, 2], "size": [22, 96], "rotate": 90 },
    { "add": "rect", "at": [39, 2], "size": [22, 96], "rotate": 135 },
    { "cut": "circle", "at": [50, 50], "r": 13 }
  ] }
  ```
- **A mouse cursor** for UI Skills, which teaches agents to build interfaces people point at and click. The arrow, its tail, and a crease down its edge:
  ```json
  { "object": "cursor", "why": "UI Skills teaches agents to build interfaces people point at and click, and the cursor is where that happens.", "reads": "cursor", "ops": [
    { "add": "polygon", "points": [[18, 0], [18, 88], [40, 68], [56, 64], [84, 62]] },
    { "add": "polygon", "points": [[34, 66], [52, 100], [70, 92], [58, 62]] },
    { "crease": "capsule", "from": [20, 6], "to": [20, 80] }
  ] }
  ```
- **A shield with a bolt** for Superpowers, which gives agents skills that guard their work and make them stronger. A shield outline with a lightning bolt cut through it:
  ```json
  { "object": "shield", "why": "Superpowers gives agents skills that guard their work and make them stronger, a shield charged with a bolt.", "reads": "shield", "ops": [
    { "add": "path", "d": "M50 0 L100 14 L100 52 C100 78 76 94 50 106 C24 94 0 78 0 52 L0 14 Z" },
    { "cut": "polygon", "points": [[58, 12], [24, 56], [44, 56], [36, 92], [76, 42], [54, 42], [66, 12]] }
  ] }
  ```

**Drawn shapes that review rejected.** A bone for Anatomy: a pun on the name, not what the repo does; the gear says what it does. A cape for Superpowers: the sketch read "leaf", so `reads` would have failed it; the shield with a bolt read at once.

A relief needs no hints: the default is a rounded volume lit from the top left. Add one only for a feature the outline cannot show, and sketch again after each:

- `"face": "lit"` or `"dim"` on an add makes it a flat facet toward or away from the light, like a paper plane's wing and keel.
- `{ "crease": kind, ... }` folds the surface along that kind's outline, or along a capsule's or arc's centre line, like a lid's ridges. It never changes the silhouette.
- Region `bevel` (0 to 1, default 0.7) is how much of the form is rounded: 0.2 for a flat top, 1 for a dome.
- Region `strata` turns the layers: `{ "by": "angle", "angle": 135 }` across a diagonal form, `{ "by": "depth" }` for shells from the outline in.

### Reference shapes

The 22 ready silhouettes are vocabulary, not answers: classic `stopwatch`, `flask`, `plane`, `pear`, `key`, `bell`, `cup`, `bolt`, `lighthouse`, `kite`, `bulb`, `lantern`; industrial `prism`, `plug`, `anvil`, `turbine`, `radar`, `disc`, `monolith`, `tuning-fork`, `fast-forward`, `compass`. `npx vyo shapes` describes each, and compose prints the three closest to the README with their ops, labelled "references, not the answer". Read their ops to learn how a few adds, cuts and creases make an object. Write `"shape": { "like": "<name>" }` only when the owner asks for that object; `shape-stock` warns on it otherwise.

### Trace a PNG

When the owner has a mark of their own, a logo, mascot or hardware outline, trace it: `"shape": { "mask": "path/to/icon.png" }`, a high-contrast dark-on-white (or transparent) PNG up to 4096px. Its dark pixels are the silhouette. It takes `fit` (except on a cover) and no `ops` or `rotate`, and every finish, look, style and solid draws it as it draws ops. The bundled `wings` and `trace` masks are demos; `shape-stock` warns on them.

## The words

- **Headline.** One plain sentence about the outcome for the user, at most 72 characters. It is the only large type.
- **Legend.** Required. One or two sentences, at most 180 characters, that say what the picture encodes. Name the accent part by its plain name and the measure: "code" or "lines" for most fields, plus "files" or "wide" for a terrain, "merge", "join" or "flow" for a river, "link", "orbit", "tie", "connect", "wire" or "import" for an orbit, and "code" plus "type", "size" or "bigger" for a shape ("area" for rings; a relief or symbols: "as big as its code"). Example: "Every peak is a part of Pantry, as tall as its code and as wide as its files. The orange peak is the plan."
- **Fits.** On the field region, at most 160 characters, never drawn. Say why this field matches the product's story, with the field's keyword. Example: "Pantry merges many saved recipes into one week, so every part of its code joins one river."
- **Paragraphs.** 0 to 2, each at most 2 sentences and 220 characters. Each does a job the picture cannot: how it works, what stays private, what runs on its own, or proof.
- **Parts list.** `parts: true` prints the parts' plain names in tree order. Keep it when the field prints no names, as a river or a symbols fill does.
- **Plain names.** Name every part in `names`, not only the flagged ones, in lowercase, and never with the product's own name; say what each does for a person: "server", "sign-in", "the plan". Never the vendor, the folder or the code name. Give parts that share a scanned name a name each. A product or tool the user uses today, like Claude Code or Cursor, may appear. A vendor the user never touches, like a database, may not.
- **The record line is the engine's.** Render writes the name, commit and date at the bottom or up the left edge. Never type a commit, a date or a count.

Follow [plain-language-rules.md](plain-language-rules.md).

## Spec fields

`compose` fills `version`, `facts`, `product`, `frame`, and `theme` (`light` or `dark`), or `ground` on a cover or plate.

| Field | What it is |
|---|---|
| `product.name` | The customer-facing name, capitalised as the product's docs write it. `product-name` warns while it is the folder name; keep it if the docs write it that way |
| `product.commit` | The short hash. `compose --repo` fills it, and the record line needs it |
| `headline` | At most 72 characters |
| region `plate` | Plate frame only (`kind: "plate"`): `topo` or `blueprint`. Exactly one per figure; takes optional `accent`, `names`, `split`, `minShare`, `maxParts`, `seed` |
| region `field` | `shape`, `seismic`, `orbit`, `wave`, `terrain`, `river`, `radial`, `sphere`, `scatter`, `shatter`, `glyph`, `bleed`, `slabs`, `spiral` or `contour`. One field per figure |
| region `fits` | Field posters only: why this field matches the story, with its keyword, at most 160 characters (refused on plates) |
| region `accent` | The accent part's id from `vyo parts` |
| region `names` | Part id to plain name, at most 24 characters each |
| region `sentence` | Wave only, at most 40 characters, set in every 5th row |
| region `shape` | Shape only: `{ object, why, reads, ops, rotate?, fit? }`, the object you draw: `object` the plain noun (at most 32 characters), `why` one sentence on why it stands for what the product does (at most 160), `reads` the one word the sketch reads as; or `{ mask, fit? }`, the owner's PNG traced; or `{ like }`, a reference shape, only when the owner asks for that object (see "Draw the shape") |
| region `style`, `echo` | Shape only: `relief` (default), `rings` or `symbols`; `echo` 0 to 12 faded outlines, rings only |
| region `bevel`, `strata` | Relief only, optional: how rounded the form is, and which way its layers run. A cover's `strata` is `"outline"` (the default), `"down"` or `"diagonal"` |
| `ground`, `layout`, `format`, `series` | Cover and plate: `ground` prefers the 5 primary gallery palettes (`obsidian`, `carbon`, `abyss`, `graphite`, `bone`) and also supports 9 legacy grounds (`navy`, `charcoal`, `forest`, `paper`, `cobalt`, `xerox`, `riso`, `blood`, `acid`); `layout` is `classic`, `editorial`, `blueprint` or `macro`; `format` is `poster` (default, 840×1190), `square` (960×960) or `og` (1280×640); `series` like `"02/04"` prints in the header tag for a numbered set |
| `finish`, `look`, `crop` | Cover only: `finish` is `type` (default), `studio`, `halftone`, or `wireframe`; `look` is `living` (default), `xerox` or `spin`; `crop` is `center` (default), `bleed-right` or `macro` |
| region `solid`, `turn` | Cover only, optional: `solid` `{ kind?: "dome" \| "extrude" \| "revolve", bevel?, depth?, tilt?, groove? }`, `turn` `{ yaw?, pitch?, lean? }` |
| region `split` | Shape and plate, optional: 1 to 4 part ids whose folders (or files when they have no folders) become parts, for a part that is most of the code |
| region `seed` | Generated fields and plates: whole number 0 to 2147483647. 0 keeps a field's own form. Compose writes a non-zero seed |
| region `letter` | Glyph only: one character, A–Z or 0–9. Compose uses the first character of the repo name |
| region `symbols` | `scatter` to `contour`, plus `seismic` and `orbit`: `true` draws the form in shaded `- : = + #` with gaps, instead of part names |
| `figure.texts` | Loose/signal: exactly one `label` and `headline`, one `legend`, 0 to 2 `paragraph`, 0 or 1 `list`, 0 or 1 `rule` (signal adds `meta`, `display`, `mark`). Cover and plate: exactly one `legend` with no coordinates |
| `motion` | Optional, for `--gif`: `{ kind: "nodes" \| "resolve" \| "wipe", frames: 8 to 36, fps: 6 to 24 }` on posters; `{ kind: "turn" }` (living/spin) or `{ kind: "copier" }` (xerox) on covers; `{ kind: "pulse" }` (topo) or `{ kind: "signal" }` (blueprint) on plates |
| `record` | Loose/signal only, optional: `bottom` or `left`, to force the record line's side |

A loose, signal, cover, or plate spec has no `notes`, `notBuilt`, `hot` or `figure.fits`. [examples.md](examples.md) has specs in full. The package's `tools/README.md` lists every check.

## Signal frame

Charcoal or cream, one signal colour (lime `#C8FF00` unless the spec's `accent` says otherwise), a bundled Inter Display Black (`900`) grotesque headline with wide halo knockout, metadata as drawing material. `compose --frame signal`, with a drawn shape (`--style`) or a generated/architectural field (`seismic`, `orbit`, `slabs`, etc.). Two looks it was made for: charcoal with `"accent": "#FF5A1F"` and a `symbols` shape; and the brutalist sheet, paper with lime, a `slabs` or `seismic` field posed with a `seed`, a `meta` line, the stepped list and marks. Its `list` is a stepped list of bold capitals; set `size` up to 44 for the brutalist sheet. Extra roles: `meta` (one archival line, at most 80 characters, no sequential "01/02/03" markers), `display` (a huge word, at most 8 characters), and `mark` (a block of the signal colour laid over type like a highlighter: no text, needs `x`, `y`, `w` and `h`, at most 3). Around a shape the engine places the words, so sketch first, read where it put each block on the `texts:` line, and lay the marks over those boxes; a mark never moves a block. On cream the accent part's rows are highlighted the same way, so the legend says "highlighted". Keep a quiet zone: not every area should hold type.

## Motion & series

`motion` on the spec, then `npx vyo render <spec> --gif`, writes a GIF and an MP4 beside the PNG.
- **Plates:** `pulse` (breathing wave on `topo`) and `signal` (travelling signal pulses along import traces on `blueprint`) run 48-frame loops at 24 fps.
- **Covers:** `turn` swings `living` for 7 seconds (168 frames @ 24fps -> 12fps GIF) or rotates `spin` a full 360° (96 frames @ 12fps); `copier` pulses a `xerox` cover through photocopier generation grain and micro-jitter (32 frames @ 10fps).
- **Posters:** `nodes` travels dots along hairline `routes`, `resolve` fades rows in from the top, `wipe` grows `mark`s.

Motion reveals the structure; the still must work on its own, and the `still` check holds it to that.

To build a side-by-side contact sheet of 2–4 plates or covers (e.g., multiple repos, or four art directions of one repo):

```bash
npx vyo series spec1.json spec2.json spec3.json spec4.json --out vyo/series [--gif]
```

Worked posters and GIFs are in `examples/posters/` in the vyo repository, not in the npm package (listed at the end of [examples.md](examples.md)).

## Where output goes

Render writes `<name>-poster.html`, `.png`, `-thumb.png` and `.pdf` beside the spec or into `--out <dir>`. Keep every file in `<repo>/vyo/`, and suggest adding it to `.gitignore`. `recent-shapes.json` there is compose's log of the generated fields it picked, so the next pick differs.

## Reply in chat

1. One sentence on what the app does.
2. The art direction (plate kind / cover finish & look / field & style, layout, and ground) and the accent part, quoting the `fits` sentence (if present). For a shape, the object and its `why`.
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

# vyo poster tools

`vyo` reads a repo, writes a scaffold spec for a poster, sketches the agent's figure as text, and renders the filled spec to HTML, PNG and PDF. The contract between the pieces is [CONTRACTS.md](CONTRACTS.md). The package README for users is [../README.md](../README.md).

## Commands

Run them from the target repo as `npx vyo …` once `@litterthanlit/vyo` is a dev dependency, or as `npx -y @litterthanlit/vyo …` without installing it. Paths are relative to the working directory.

| Command | What it does |
|---|---|
| `vyo init [--cursor] [--claude] [--codex] [--dir <repo-dir>]` | Copies `SKILL.md` and its three docs into `.cursor/skills/vyo/` and/or `.claude/skills/vyo/` of the repo (default `.`; the editor folders it has, or both if it has neither). `--codex` adds one marked block to `AGENTS.md` that points at the skill. A rerun overwrites the same files and replaces the block. Prints each path it wrote |
| `vyo scan <repo-dir> --out <dir>/<repo>-facts.json` | Reads the repo and writes `facts.json`. Never writes inside the repo except to `--out`. Tests, hidden folders, and `dist`, `build`, `out`, `vendor`, `public`, `static` and `assets` at a repo or package root are left out, and `scan` prints how many files and lines. When all the code is in a hidden folder such as `.cursor/`, `scan` and `show` name it; run `scan` on that folder |
| `vyo show <facts.json>` | Prints a plain summary of the facts |
| `vyo parts <facts.json> [--field wave\|terrain\|river\|shape]` | Prints the parts a field draws, with that field's part defaults: id, share of lines, lines, files and scanned name, with `! looks like a vendor or code name` after each unplain name and `! same name as <id>` after each name another part shares |
| `vyo presets [<id>]` | Lists the presets with id, `fits`, and a summary of regions and texts. With an id, prints that preset's figure as JSON |
| `vyo compose <facts.json> [--frame loose\|swiss] [--field wave\|terrain\|river\|shape] [--accent <part id>] [--from <preset>] [--repo <dir>] [--theme light\|dark] [--out <spec.json>] [--force]` | Writes a scaffold spec. Without `--from`, the figure is a field, in the loose frame unless `--frame swiss`; loose prints the corners the field leaves. `--field shape` (loose only) writes a placeholder `shape` that render rejects, places the texts around the box a default fit fills, and prints the shape format in a few lines. Refuses to overwrite an existing spec unless `--force` is given |
| `vyo sketch <spec.json> [--facts <facts.json>]` | Prints the sheet as ASCII, with coverage, each fill region's width spread and mean width, and the floor; a loose spec also gets the field's four empty corners. A figure with a field reads the facts. A shape field adds its bands, its share of the sheet and its `shape-*` warnings, and writes `<repo>-sketch.png` beside the spec. Needs no browser |
| `vyo render <spec.json> [--out <dir>] [--facts <facts.json>] [--no-png] [--no-pdf] [--paper fit\|a4\|letter]` | Validates the spec, writes HTML, a 2× PNG and a PDF, then runs every check |
| `vyo check <spec.json> [--facts <facts.json>]` | Runs the same validation and checks in a temporary directory. Writes nothing to `--out` |

Exit codes: 0 when everything passes (warnings go to stderr as `! ` lines), 1 on any rule error (`✗ ` lines on stderr), 2 on a usage error.

`compose` fills `product`, `facts`, `theme` and `frame`. In the loose frame (the default for a field), compose lays the field out, finds its empty corners, and places `label`, `headline`, `legend`, a `paragraph` and a `list` of the parts into them by the rule in [Frames](#frames); it writes no notes, prints the corners and one line per text role, and warns when there is no `--repo`, since the record line needs the commit. The rest of this paragraph is the swiss frame. Without `--from`, the figure is one field region (`--field`, default `wave`) with `accent` set from `--accent`, a placeholder in `names` for every part, a placeholder `sentence` for a wave, and a masthead, headline and aside placed where that field leaves room. The spec has no `hot`. A scan with no code has no parts, so `compose` refuses a field there with `✗ no parts to draw; the scan found no code` and points at `--from`. With `--from <preset>`, the figure is a fill preset's, with its geometry kept and its words replaced by placeholders; `--from` refuses a field preset and names the `--field` to use instead, and refuses `--field` or `--accent` beside it. `--accent` must name a part. Render rejects every placeholder. `compose` prints `floor: <y>` for the spec's notes count, assuming a one-line not-built list, then the `masthead`, `headline` and `aside` lines: line heights and characters per line. A field scaffold adds a line pointing at `vyo parts` and a `field:` line; a preset scaffold adds the `rows` line. Each extra not-built line raises the floor by 16px.

`compose --repo <dir>` reads the latest commit's short hash and commit date with git, so reruns give the same footer or record line. Without `--repo` the spec has no commit and `date` is today.

`sketch`, `render` and `check` read the facts from `--facts`, or by default from `<repo>-facts.json` beside the spec, where `<repo>` is the spec's `product.repo`. Output goes to `--out`, by default the spec's directory: `<repo>-poster.html`, `<repo>-poster.png` and `<repo>-poster.pdf`. The HTML embeds its fonts, so it opens anywhere.

## Setup

To work on the tools, run these from the package root, the skill directory.

```bash
npm install
npx playwright install chromium   # or set VYO_CHROMIUM=/path/to/chromium
```

The fonts, Commit Mono and Newsreader, are bundled in `fonts/` at the package root under the SIL Open Font License (`fonts/LICENSE.md`). The masthead uses Inter Display if it is installed, then Inter, then Helvetica or Arial. The tools never download Helvetica.

## The spec

The spec, `<repo>-poster.json`, is the only file the agent edits. `compose` fills `version`, `facts`, `product` and `theme`. The agent writes `figure`, `headline`, `hot` (optional when the figure has a field), `notes` and `notBuilt`, may set `accent` and `audience`, and replaces `product.name` with the customer-facing name. The full type and validation rules are in [CONTRACTS.md §3](CONTRACTS.md#3-the-spec). Every preset as a full spec, and three invented figures, are in [examples.md](../examples.md).

A spec has a `frame`, `loose` (the default) or `swiss`; see [Frames](#frames). A figure has 1 to 6 regions and 1 to 7 texts, and a `fits` sentence (at most 160 characters, printed by `presets`, never drawn): on the field region when the figure has a field, else on the figure.

- A **field region** draws the repo itself: its rows come from the parts of `facts.json` at render time, and the agent picks only the field, the accent part and plain names. At most one per figure. See [Fields](#fields).
- A **fill region** is an outline that the tool fills with rows of the region's `words`, 2 to 14 of them, each at most 24 characters.
- A **dots region** spells 2 to 4 words of at most 5 letters each in squares, at `x`, `y` with a `cell` size in px.
- A **text** in the swiss frame is a `masthead` (exactly one, the product name), a `headline` (at most one, the spec's headline), a `display` (a bold sans line, at most 40 characters, size 32 to 64, default 56), an `aside` (size 10 to 14) or a `label` (size 10 to 32, default 12, and 26 when `hot`), placed at `x`, `y` with a wrap width `w`. `align` is `left`, `right` or `center`.

- A **text** in the loose frame is a `label`, `headline`, `paragraph`, `legend`, `list` or `rule`; see [Frames](#frames).

Region and text ids are lowercase and unique. `note`, `counts`, `notBuilt`, `provenance`, `credit` and `record` are render's block names, so a region or text cannot take them.

## Frames

`frame: "swiss"` is the v4 poster, unchanged: masthead, serif headline, hairline, counts, note columns, not-built list, provenance and credit. It takes fill, dots and field figures, and requires `notes` and `notBuilt`.

`frame: "loose"` (the default) is the i-loose frame. It needs a field region, has no masthead, hairline, counts, notes or footer, and lets the field bleed off every edge it reaches: its floor is the sheet's bottom edge. No text may sit on the field. Its text roles, from `ROLES.loose` in `lib/frame.mjs`:

| Role | Count | Size | What it prints |
|---|---|---|---|
| `label` | exactly 1 | 13px mono caps (11 to 16) | the product name |
| `headline` | exactly 1 | 42px Newsreader (32 to 48), the only large type | `spec.headline` |
| `paragraph` | 0 to 2 | 15px Newsreader (13 to 17) | `text`, at most 220 characters and 2 sentences |
| `legend` | exactly 1 | 15px Newsreader (13 to 17) | `text`, at most 180 characters and 2 sentences, saying what the picture encodes |
| `list` | 0 or 1 | 13px mono (11 to 14), one per line | `parts: true` for the field's parts' plain names, or `items` (1 to 16, at most 24 characters each) |
| `rule` | 0 or 1 | 13px mono (11 to 14) | `text`, one character repeated across `w` |

**Legend.** It names the accent part's plain name and the field's measure: a word starting with "code" or "lines" for a wave or terrain, plus "files" or "wide" for a terrain, "merge", "join" or "flow" for a river, and for a shape "code" or "lines" plus "type", "size", "bigger" or "larger". Otherwise `✗ legend: must say what the picture encodes; name the accent part ("<name>") and the measure (<words>)`.

**Fits.** A field region's `fits` (required, at most 160 characters, never drawn) says why this field matches the product's story, with a word that starts with one of the field's keywords: wave "travel", "flow", "hand", "move"; terrain "big", "weight", "matters", "most"; river "merge", "join", "many", "one"; shape "object", "thing", "picture", "shape", "looks". The agent quotes it in the chat reply.

**Record.** Render writes `<name> at <commit>, <date>. Drawn by Vyo.` in 10px mono with the accent full stop, along the bottom edge, or rotated up the left edge when the field covers the bottom. `record: "bottom"` or `"left"` chooses. It needs `product.commit`; `compose --repo` fills it.

**Corners.** `corners()` in `lib/geometry.mjs` returns the largest empty rectangle the field leaves at each sheet corner (on a 20px grid, at least 220px wide when possible, height counted up to 400px, overlaps on an edge split). Compose places the headline in the largest corner, the label in the smallest, the list in the tallest and the legend in the one nearest the accent part, with a paragraph where room is left, 40px from the sheet's edges and 16px from the field. `sketch` prints `corners: top-left at <x>,<y> is <w> by <h>; top-right at …; bottom-left at …; bottom-right at …`. The full rules are in [CONTRACTS.md §3b](CONTRACTS.md#3b-frames-legend-fits-record-and-corners).

## Fields

A field region is `{ kind: "field", id, field, fits, accent?, names?, sentence?, every?, shape?, style?, echo?, minShare?, maxParts? }`. Four fields ship, one entry each in the registry `FIELDS` in `lib/fields/index.mjs`:

| `field` | What it draws | Takes |
|---|---|---|
| `wave` | One row of a part's name per share of lines, at least one row per part, in tree order, bent into one band that enters at the top behind the masthead, swings right, back left and leaves through the floor. 6.9px letters on 7.9px rows, about 110 above the floor; the band runs on behind the text blocks, which carry a 6px paper outline. On light the accent part is `ink`, parts near the top of the tree violet (`wave`) and deeper ones a lighter violet (`wave-soft`); on dark the accent is `hot`, the others `mid` and `soft` | `sentence` (at most 40 characters, set in every `every`th row, default 5) |
| `terrain` | One peak per part, height by lines and width by files, left to right in tree order, 6.9px letters on 7.6px rows. Each row reads the name of the part whose slope it crosses, whole words only at a border, letters spread on steep slopes and tight on flats; the rim is `ink`, the rest `mid`, brighter on slopes that face left. A part narrower than 40px gets 40px, and shows as a pointed foothill under a bigger neighbour | nothing more |
| `river` | One stream of `0`s and `1`s per part entering the left edge, as thick as its share of lines, merging pair by pair by how many imports tie them into one channel that leaves the right edge, after g-flow. 5px digits in 3.1px cells on 5px rows; no part name is printed. The accent part's stream and a short run at the last merge are `hot`; other streams alternate `ink` and `mid`. Parts default to `minShare` 0.002 and `maxParts` 24 | nothing more |

| `shape` | A silhouette the agent draws for the product (`shape`), cut top to bottom into one band per part in tree order, each band's area its share of lines. The biggest part's name is one line as tall as its band; every other part's type is that size times (its lines / the biggest's)^2.4, never under 5px, and shrinks until its whole name fits. Bands are at least 8px tall and 3px apart. Paper type on `ink` bands, the accent band filled with `hot` and set in `on-hot`; on light the bands alternate `ink` and `cool` over a `cold` shadow cast 14px down and right. Loose frame only. Parts default to `maxParts` 12 | `shape` (required), `style` (`bands`, the default, or `rings`), `echo` (rings only) |

**The rings style.** `style: "rings"` sets the parts' names along inward offsets of the outline instead: the mask's signed distance field (an exact Euclidean distance transform of its pixels) gives one iso-line every 7px from 3.5px inside the outline, rounded over up to 14px, and the parts take runs of rings from the outline in, in tree order. Each part covers its share of the shape's area: a ring's area is spread evenly round it, so a part may end part way round a ring, and the next part takes the rest; the boundary steps in by one ring there, at the bottom of the loop (the seam). Every part spans room for two copies of its name and the accent at least two rings. A loop that runs more than 30% of its length within 4px of the shape's skeleton, and the innermost 10% of the shape's area, become a core: a fill of its own (`cold` on dark, `cool` on light) set in level lines 7px apart, run top to bottom by the parts that are left. Names are set glyph by glyph in 6.6px Commit Mono, whole names only, with a middle dot between two names; a name that would bend more than 24 degrees between two letters, touch the skeleton or land within 4.75px of a name already set is left out, outer rings first, so no two glyphs overlap. A name runs left to right whichever way its ring turns, so the bottom of a ring reads upright too. The accent part's rings and core lines are filled with `hot` and set in bold `on-hot`. A hairline marks each boundary between parts and the core's edge. On dark the rings are `ink` on paper; on light the whole shape is `ink` with the type and hairlines in `paper`, because ink type on paper read as a grey outline at thumbnail size. `echo` (0 to 12) draws that many hairline copies of the outline outside it, 9.8px apart, in `soft`, fading outward, broken 16px clear of every text block. A rings shape suits a fat, round object, with a cut in it for the legend if wanted; a thin one starves the rings, and `shape-rings` says so.

On paper the terrain's letters take 0.14 more alpha and its accent 0.5 more (0.3 on dark), as in i-loose.

- `accent` is a part id, an area id or a glob over part ids (`area:lib/*`). An area that merged into a bigger part names that part; an area that holds parts names all of them. The accent parts are drawn in `hot` and carry `data-hot`. Without it, `check` warns `accent-part`.
- `names` maps part ids to plain names of at most 24 characters, checked for jargon like any copy. A part's row text is its name in lower case.
- Rows skip the text blocks with 12px to spare, so moving a text block makes room; a part whose every row is covered fails `field-parts`.

**The shape format.** `shape` is `{ ops, rotate?, fit? }`. `ops` (1 to 24) are painted in order into one mask: each has exactly one verb key, `add` or `cut`, whose value is the kind, and the first must be an `add`. Coordinates are free units with y down; the engine measures what was painted, cuts and rotations counted, and fits it.

| Kind | Keys |
|---|---|
| `circle` | `at: [x, y]`, `r` |
| `ellipse` | `at`, `r: [rx, ry]` |
| `rect` | `at` (top-left), `size: [w, h]`, `round?` (corner radius) |
| `capsule` | `from`, `to`, `r` (a thick line with round ends) |
| `arc` | `at`, `r`, `from`, `to` (degrees clockwise from twelve o'clock), `width` |
| `polygon` | `points` (3 to 40), `round?` |
| `path` | `d`, an SVG path filled nonzero |

Any op takes `rotate`, degrees clockwise about its own centre; the shape's `rotate` turns the whole. `fit.w` and `fit.h` are the shape's width and height as shares of the sheet's (over 1 bleeds off; with both, the smaller scale wins) and `fit.cx`, `fit.cy` place its centre; without them it fills 0.9 of the width or 0.74 of the height, centred at 0.5, 0.61. `lib/mask.mjs` paints the ops into rows of spans at sheet resolution, and the bands, the corners, the record line, the sketch and the `shape-*` checks all read that mask.

**Parts.** `vyo parts <facts.json>` prints them. Every non-generated file starts in its nearest leaf area, or in its own area when no leaf holds it. A part under `minShare` of the lines (default 0.02) merges into its parent area, deepest first, until it is big enough or sits at the top level. Then the smallest parts merge up until there are at most `maxParts` (default 14). The parts hold every line exactly once. A name is flagged as unplain when it is all caps, holds a company name the scan knows, or is one word ending in a digit.

## Geometry

A fill region has exactly one of these four, listed in the order to prefer them. All numbers are sheet px on the 840×1190 sheet.

| Field | Shape | Limits |
|---|---|---|
| `profile` | `[[y, cx, halfWidth], ...]`. A smooth outline through the stops, from the first y to the last | 3 to 24 stops, y strictly increasing |
| `ellipse` | `{ cx, cy, rx, ry }` | |
| `polygon` | `[[x, y], ...]`, closed | 3 to 40 points |
| `path` | An SVG path string with M, L, C, Q, A, H, V and Z, absolute or relative | Must parse |

`holes` is an optional list of the same four shapes, cut out of the region with the even-odd rule. Region options: `band` (1 to 4 rows per word, default 1), `size` (11 or 12, default 12), `caps` (default true) and `hot` (every row in the accent).

Rows sit on a sheet-wide grid of 16px, or 14px at size 11. The tool skips any part of a row within 12px of a text block and drops runs narrower than 24px. [CONTRACTS.md §4](CONTRACTS.md#4-geometry) has the sampler rules.

## Tones

A fill region's `tone` is one token, or a list of 2 or 3 tokens that step down the region. Each row takes the nearest stop, so a pair gives the top half the first token and the bottom half the second. Three tokens give the eye's lids their soft, mid, soft bands. A dots region's `tones` has one entry per line, and a line may be `hot`.

| Token | Use |
|---|---|
| `soft` | Far, past, background |
| `mid` | Between |
| `ink` | Near, now, the plain foreground |
| `cold` | A blue-grey for a state that has not started |
| `cool` | A darker blue-grey, one step warmer |

Both themes define all five, plus `paper` and `hot`. `accent` in the spec replaces the theme's `hot`. Anything in the hot colour is the hot word: rows whose word matches `hot`, rows of a region with `hot: true`, a dots line with tone `hot` or a word matching `hot`, and a label with `hot: true`.

## What `check` enforces

`render` and `check` run the same checks. They are one table, `CHECKS` in `lib/check.mjs`, and [CONTRACTS.md §6](CONTRACTS.md#6-checks) lists them too. `✗` fails the run and `!` is a warning for the agent to weigh.

| id | Level | What it measures |
|---|---|---|
| `spec` | ✗ | The spec passes every rule in §3. When it fails, no other check runs |
| `facts-hash` | ✗ | `spec.facts` equals the facts file's `hash` |
| `facts-empty` | ! | `facts.empty` is true: the scan found nothing to count, so the footer shows provenance only |
| `product-name` | ! | `product.name` equals `facts.repo.name`, the folder name |
| `preset-copy` | ! | Every region's geometry equals a preset region's geometry, numbers compared exactly |
| `part-name` | ! | A part a field draws has the product's name in its name, has no entry in `names`, or shares its name with another part, ignoring case: `parts <id> and <id> are all called "<name>"; give each a plain name of its own in names`. Also a key in `names` that is not a part |
| `part-unplain` | ✗ | A part a field draws still has an unplain name: all caps, a company name the scan knows, or one word ending in a digit. A scanned name left in place trips it, since `names` replaces the scanned name. Message: `part "<name>" (<id>) looks like a vendor or code name; add a plain name in names` |
| `accent-part` | ! | A field region has no `accent`. Message: `no accent part in region <id>; set accent to the id of the part the poster is about (vyo parts lists them)` |
| `legend` | ✗ | Loose only. The legend names the accent part's plain name (case-folded, anywhere in the text) and the field's measure: a word that starts with "code" or "lines"; a terrain also "files" or "wide"; a river "merge", "join" or "flow". Message: `must say what the picture encodes; name the accent part ("<name>") and the measure (<words>)` |
| `fits` | ✗ | A field region's `fits` has a word that starts with one of the field's keywords: wave "travel", "flow", "hand", "move"; terrain "big", "weight", "matters", "most"; river "merge", "join", "many", "one". Message: `region <id>: fits must say why a <field> matches the product's story; use "<k>" or …` |
| `one-region` | ! | The figure is a single fill region with no hot rows and no hot label. A figure with dots, or with more than one region, never trips it |
| `shape-thin` | ! | A shape field: no feature of the mask, and no cut inside its box, is under 18px across (3px at thumbnail size). Message: `the shape is <n>px thick near <x>,<y>; under 18px it is a hairline at thumbnail size, so make that feature at least 18px thick or remove it`, or for a cut `a cut in the shape is <n>px wide near <x>,<y>; …widen the cut to at least 18px or remove it` |
| `shape-cover` | ! | A shape covers at least 35% of the sheet. Message: `the shape covers <n>% of the sheet; it needs 35% to read as the picture, so scale it up <k>x (set fit.h to <v>, it is <v0>) or draw it fatter` |
| `shape-accent` | ! | A shape's accent band is at least 40px tall. Message: `the accent band "<name>" is <h>px tall (y <a> to <b>); it needs 40px to show in the thumbnail, so scale the shape up <k>x, narrow it where the band falls, or put the accent on a bigger part` |
| `shape-split` | ! | No band of a shape falls on two separate pieces of it, each with a tenth of the band's area. Message: `the band of "<name>" (y <a> to <b>) falls on 2 separate pieces of the shape, at x … and x …; join them there, or move one piece up or down by <h>px so they do not share those rows` |
| `shape-rings` | ! | A shape in rings fits a ring and a half per part. Message: `the shape is <w>px across at its thickest, room for <n> rings of 7px; its <p> parts need about <m>, so draw it fatter (about <x>px across at its thickest), raise fit.h, or use style bands` |
| `shape-upright` | ! | Every part of a shape in rings shows its name at least once leaning under 30 degrees, so no one turns the poster to find it. Message: `part "<name>" never reads upright: none of its <n> names leans under 30 degrees; turn the shape (shape.rotate) so more of its outline runs level, or draw it rounder` |
| `shape-name` | ✗ | Every band of a shape shows its part's whole name at least once. Message: `part "<name>" never shows its whole name: its band (y <a> to <b>) holds <w>px of <s>px type and the name needs <n>px; widen the shape there to at least <n>px or give the part a shorter name` In rings: `part "<name>" never shows its whole name: its <r> rings[ and its core lines] hold no whole copy of "<name>" (<n>px with its dot), where they run short or fold; make the shape fatter there or give the part a shorter name`, or, past the last ring, `… the shape ran out of rings before it (<n> rings of 7px fit); draw it fatter or use style bands` |
| `shape-room` | ✗ | Every figure text keeps 16px off a shape. Message: `the <id> (<w> by <h> at <x>,<y>) sits on the shape or within 16px of it; move it into the <corner> corner, <w> by <h> at <x>,<y>`, or when no corner holds it `…; no corner holds it (the largest, <corner>, is <w> by <h>), so shrink the shape (fit.h <v> to <v>) or move it with fit.cx and fit.cy` |
| `drawn` | ✗ | The fill script ran to the end: the page raised no error and set `window.drawn` |
| `fonts` | ✗ | `document.fonts` holds a `FontFace` with status `loaded` for Commit Mono 400, Commit Mono 700 and Newsreader 400 |
| `masthead-font` | ! | Inter Display or Inter is installed for the product name. Swiss only |
| `path` | ✗ | Every outline parses and has a non-empty bounding box inside the sheet and above the footer. The message says `region <id> reaches <n>px below the footer; move it up by <n>` |
| `rows-fit` | ✗ | Every `.row` has `scrollWidth ≤ clientWidth` and sits inside the 840×1190 sheet |
| `region-size` | ✗ | Every fill region has at least 4 rows, and every dots region fits. The message names the region. Fields are exempt |
| `regions-apart` | ✗ | No row of one region comes within 4px, horizontally, of a row of another region at the same y |
| `words-drawn` | ✗ | Every word of every fill region is drawn at least once, and the hot word, when the spec has one, is drawn in the accent. The message says `region <id>: "<word>" never drawn; shorten the list or enlarge the path` |
| `silhouette` | ✗ | Rows and dots lines cover at least 15% of the area above the footer, and the figure spans at least 55% of that area's height and 60% of its width |
| `field-parts` | ✗ | A field's parts hold every non-generated line of `facts.json`, every part has at least one row (wave) or one run of letters (terrain), and `accent` names a part. Message: `region <id>: part "<name>" (<id>) is never drawn; move the text blocks that cover it` |
| `row-variety` | ✗ | In every fill region, the standard deviation of its line widths divided by their mean is at least 0.25. A line is all the region's runs at one y, merged into their outer span, so a hole does not count as variety. Fields are exempt, and the check is skipped when the figure has no fill region. The message says `region <id> is a box; a silhouette changes width along its whole height` |
| `thin-region` | ! | Every fill region's lines are at least 160px wide on average. Fields are exempt. The message says `region <id> reads as a column; widen it or make it part of the main silhouette` |
| `blocks-apart` | ✗ | No text block comes within 8px of another block or of a row. Two rows of one fill region at the same y keep 8px horizontally; a field's rows are not compared with each other, and a wave's rows may pass behind the figure's texts (the blocks with a `data-role`) |
| `blocks-inside` | ✗ | Every `[data-block]` text block sits inside the sheet |
| `palette` | ✗ | Every text colour, square background and visible box background is one of the theme's tokens, `cold` and `cool` included; a field's rows may also take the field's own tokens |
| `hot-tagged` | ✗ | Anything in the hot colour carries `data-hot` |
| `copy` | ✗ | The visible words hold no banned term, file path, "01/02/03" marker or middle dot. The masthead and the render-owned footer lines are exempt |
| `notes` | ✗ | Swiss: the footer shows exactly the notes in `spec.notes`. Loose: 0 to 2 paragraphs and exactly one legend. Message: `the poster shows <n> paragraphs and <n> legends; use 0 to 2 paragraphs and exactly one legend` |
| `band` | ✗ | The footer counts line equals the line built from `bandCounts(facts)`. Swiss only |
| `record` | ✗ | Loose only. The record line is drawn once and reads `<name> at <commit>, <date>. Drawn by Vyo.`. Without `product.commit`: `the record line has no commit; set product.commit to the short hash (vyo compose --repo fills it)` |
| `headline-lines` | ! | The headline wraps to more than 2 lines. Swiss only |

## Sketch output

`vyo sketch` draws the sheet at 20px per character, 42 columns by about 60 lines, without a browser. It runs the same row sampler as the page on a polygon version of each outline. Profiles and ellipses become exact polygons, and paths are flattened. Text widths are a Node estimate from per-character advances, not the browser's measurements, so a text box or a word near a run's edge can land a few pixels off.

| Mark | Meaning |
|---|---|
| `A` to `F` | Rows of the first to the sixth fill or field region, in spec order |
| `#` | Squares of a dots region |
| A box | A text block labelled with its id, with its height estimated: 88px for a masthead line at size 84, 28px per headline line in a 224px column, 7.2px per character of mono text, one line of the size's height for a display |
| `=` | The footer's top line (swiss only) |
| `·` | A hot row |

A field's rows come from the same layout module the page runs, given the estimated text blocks and Commit Mono's 0.6em advance; with the page's own text blocks the two place every row within 2px. Its legend entry reads `A wave (wave, 13 parts, 85 rows)`.

A shape field draws its mask instead of rows: its letter where the shape is, `@` in the accent band (in rings, where the accent's fill is). Under `regions:` it prints a `shape:` line (the share of the sheet covered, the fitted size, `fit.w` and `fit.h`, and which edges it bleeds off) and one line per band, top to bottom: the part, its y, its height, and its lines and type size. In rings it prints instead how many rings fit, how thick the shape is and how many rings the parts want, the core's level lines, and one line per part from the outline in: its rings, its core lines, and its share of the area beside its share of the lines; the PNG shows the fills with each glyph as a mark in its tone. It writes `<repo>-sketch.png` beside the spec, the silhouette at a third of its size with each band in its fill, the accent band in the accent and the text blocks outlined, encoded with Node's zlib, no browser. Its `! ` lines are the `shape-*` messages, measured on Node's own layout and the estimated text blocks.

Under the sheet it prints `regions:`, `texts:` and `floor:` lines (in the loose frame `texts:` includes `record`, `floor:` reads `the sheet's bottom edge (loose frame)` and a `corners:` line follows), then the coverage, height and width, each marked ok or too low, and one line per fill region with its spread of line widths (standard deviation over mean) and mean width, so the agent sees `silhouette`, `row-variety` and `thin-region` before it renders. Lines that start with `! ` flag a field part that is never drawn (`region <id>: part "<name>" (<id>) is never drawn`) or an accent that names no part, a region under 4 rows, a word that may never be drawn, anything below the floor, and the `row-variety` and `thin-region` messages.

## Tests

```bash
npm test
```

`npm test`, from the package root, runs `node tools/test/run.mjs`; its last step packs the package, installs the tarball into a fresh project and makes a poster from there. Browser tests need Chromium: set `VYO_CHROMIUM` (in this environment, `/opt/pw-browsers/chromium`). The rendered PNGs go to `tools/test/.out/`, which git ignores, so a person can look at them.

- **Pure tests.** The scanner, the counts line for the `recipe` fixture, the banned-term table in `plain-language-rules.md` against `lib/jargon.mjs`, and spec validation. The parts of the recipe fixture and of `explorations/2026-11-07-abstract-fields/hypher-facts.json` hold every line, merge as the rules say and resolve accents; the wave and terrain layouts give every part a row and keep their shape, and terrain clears the text blocks. `test/shape.test.mjs` covers the shape field: every kind of op and every shape error, reported at once by index; the mask's fit, cuts and rotations; band areas within 15% of line shares; every line inside the mask over its whole glyph height and every name drawn whole; the light and dark fills; each `shape-*` finding on a planted shape; the sketch's band lines and its PNG. `test/rings.test.mjs` covers the rings style on the jar preset and on Hypher's twelve parts in a paper plane: each part's area, measured pixel by pixel from its ring and the nearest point round it, within one point of its share of lines; no two glyphs of different names within 0.6 em; every name whole, every part named and upright once, and at least a fifth of the names upright; the core's level lines and fills in both themes; `allotRings` on its own; a thin shape's `shape-rings` and a turned bar's `shape-upright`, in the sketch too; `echo` validation; the same layout twice. Validation accepts the ten presets, checks the frames' roles and counts, checks field keys, and rejects an unknown region kind, a path that does not parse, a polygon with two points, two mastheads, a `hot` found in no region, words with jargon, and 7 regions.
- **Browser tests.** Every preset (the four fill presets and `wave-swiss` in the swiss frame; `wave`, `terrain`, `river`, `shape` and `shape-rings` in the loose frame) renders against a fresh scan of `test/fixtures/recipe` and passes. For each field preset, the sketch's rows and the page's rows match within 2px. Planted bugs fail with their check: a text block over a terrain's foothill and an accent that names no part (`field-parts`), a loose poster with no legend (`spec`), a legend without the accent part's name (`legend`), a record line with no commit (`record`), a fits without the field's keyword (`fits`), two overlapping outlines (`regions-apart`), a 30px outline (`region-size`), one tiny region (`silhouette`), a box with a slanted top (`row-variety`), a 90px column (`thin-region`, a warning), 14 long words in a small outline (`words-drawn`), an aside placed on a row (`blocks-apart`), an outline below the footer (`path`), a shape whose first band falls in a stem too narrow for its name (`shape-name`), a legend placed on the shape (`shape-room`), a shape that paints nothing (`spec`), and the warnings for a hairline handle (`shape-thin`), a tiny jar (`shape-cover`), a jar cut in two (`shape-split`), a thin bar in rings (`shape-rings`) and a ring of names that never runs level (`shape-upright`), and the v2 bugs that still apply: jargon, a file path, an untagged hot word, four notes, and a long not-built list that passes.
- **Docs tests.** `test/docs.test.mjs` fails when the check ids in this file or in CONTRACTS.md drift from `CHECKS`.

## How it works

`scan` turns the repo into `facts.json` with no network and no model, so two scans of the same tree are byte-identical. `compose` turns the facts into a field poster, or a preset into a spec whose figure the agent writes in plain words and sheet coordinates. `render` computes each field's parts from the facts, then builds one HTML page in which `lib/fill.js` lays out each field with its module from `lib/fields/`, samples each outline into rows, fills them with the region's words, and places the texts, then Playwright waits for `window.drawn`, takes a 2× screenshot and prints a PDF. The checks run in the same page and measure what was drawn, so a rule break shows up as a `✗` line instead of a bad poster.

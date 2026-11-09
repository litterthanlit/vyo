# vyo poster tools

`vyo` reads a repo, writes a scaffold spec for a poster, sketches the agent's figure as text, and renders the filled spec to HTML, PNG and PDF. The contract between the pieces is [CONTRACTS.md](CONTRACTS.md). The package README for users is [../README.md](../README.md).

## Commands

Run them from the target repo as `npx vyo …` once `@litterthanlit/vyo` is a dev dependency, or as `npx -y @litterthanlit/vyo …` without installing it. Paths are relative to the working directory.

| Command | What it does |
|---|---|
| `vyo init [--cursor] [--claude] [--codex] [--dir <repo-dir>]` | Copies `SKILL.md` and its three docs into `.cursor/skills/vyo/` and/or `.claude/skills/vyo/` of the repo (default `.`; the editor folders it has, or both if it has neither). `--codex` adds one marked block to `AGENTS.md` that points at the skill. A rerun overwrites the same files and replaces the block. Prints each path it wrote |
| `vyo scan <repo-dir> --out <dir>/<repo>-facts.json` | Reads the repo and writes `facts.json`. Never writes inside the repo except to `--out` |
| `vyo show <facts.json>` | Prints a plain summary of the facts |
| `vyo parts <facts.json> [--field wave\|terrain\|river]` | Prints the parts a field draws, with that field's part defaults: id, share of lines, lines, files and scanned name, with `! looks like a vendor or code name` after each unplain name and `! same name as <id>` after each name another part shares |
| `vyo presets [<id>]` | Lists the presets with id, `fits`, and a summary of regions and texts. With an id, prints that preset's figure as JSON |
| `vyo compose <facts.json> [--frame loose\|swiss] [--sheet poster\|4:5] [--field wave\|terrain\|river] [--accent <part id>] [--from <preset>] [--repo <dir>] [--theme light\|dark] [--out <spec.json>] [--force]` | Writes a scaffold spec. Without `--from`, the figure is a field, in the loose frame unless `--frame swiss`; loose prints the corners the field leaves. `--sheet 4:5` writes `sheet` and places the texts in the corners of the 840 by 1050 sheet; it is refused beside `--from` and with `--frame swiss`. Refuses to overwrite an existing spec unless `--force` is given |
| `vyo sketch <spec.json> [--facts <facts.json>]` | Prints the sheet as ASCII, with coverage, each fill region's width spread and mean width, and the floor; a loose spec also gets the field's four empty corners. A figure with a field reads the facts. Needs no browser |
| `vyo render <spec.json> [--out <dir>] [--facts <facts.json>] [--no-png] [--no-pdf] [--paper fit\|a4\|letter]` | Validates the spec, writes HTML, a 2× PNG and a PDF, then runs every check |
| `vyo check <spec.json> [--facts <facts.json>]` | Runs the same validation and checks in a temporary directory. Writes nothing to `--out` |

Exit codes: 0 when everything passes (warnings go to stderr as `! ` lines), 1 on any rule error (`✗ ` lines on stderr), 2 on a usage error.

`compose` fills `product`, `facts`, `theme` and `frame`. In the loose frame (the default for a field), compose lays the field out, finds its empty corners, and places `label`, `headline`, `legend`, a `paragraph` and a `list` of the parts into them by the rule in [Frames](#frames); it writes no notes, prints the corners and one line per text role, and warns when there is no `--repo`, since the record line needs the commit. The rest of this paragraph is the swiss frame. Without `--from`, the figure is one field region (`--field`, default `wave`) with `accent` set from `--accent`, a placeholder in `names` for each part whose scanned name looks like a vendor or code name or is shared with another part, a placeholder `sentence` for a wave, and a masthead, headline and aside placed where that field leaves room. The spec has no `hot`. A scan with no code has no parts, so `compose` refuses a field there with `✗ no parts to draw; the scan found no code` and points at `--from`. With `--from <preset>`, the figure is a fill preset's, with its geometry kept and its words replaced by placeholders; `--from` refuses a field preset and names the `--field` to use instead, and refuses `--field` or `--accent` beside it. `--accent` must name a part. Render rejects every placeholder. `compose` prints `floor: <y>` for the spec's notes count, assuming a one-line not-built list, then the `masthead`, `headline` and `aside` lines: line heights and characters per line. A field scaffold adds a line pointing at `vyo parts` and a `field:` line; a preset scaffold adds the `rows` line. Each extra not-built line raises the floor by 16px.

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

A spec has a `frame`, `loose` (the default) or `swiss`; see [Frames](#frames). A loose spec may set `sheet` to `4:5`, the portrait ratio feeds like X show without cropping: the sheet is 840 by 1050 instead of the default `poster`, 840 by 1190. Every coordinate must be on the spec's sheet, the field's floor is its bottom edge, and the PNG, the thumbnail (1/6 scale, 140 by 175 for 4:5) and `--paper` follow its size. The swiss frame and the fill presets are drawn for `poster` only. A figure has 1 to 6 regions and 1 to 7 texts, and a `fits` sentence (at most 160 characters, printed by `presets`, never drawn): on the field region when the figure has a field, else on the figure.

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

**Legend.** It names the accent part's plain name and the field's measure: a word starting with "code" or "lines" for a wave or terrain, plus "files" or "wide" for a terrain, and "merge", "join" or "flow" for a river. Otherwise `✗ legend: must say what the picture encodes; name the accent part ("<name>") and the measure (<words>)`.

**Fits.** A field region's `fits` (required, at most 160 characters, never drawn) says why this field matches the product's story, with a word that starts with one of the field's keywords: wave "travel", "flow", "hand", "move"; terrain "big", "weight", "matters", "most"; river "merge", "join", "many", "one". The agent quotes it in the chat reply.

**Record.** Render writes `<name> at <commit>, <date>. Drawn by Vyo.` in 10px mono with the accent full stop, along the bottom edge, or rotated up the left edge when the field covers the bottom. `record: "bottom"` or `"left"` chooses. It needs `product.commit`; `compose --repo` fills it.

**Corners.** `corners()` in `lib/geometry.mjs` returns the largest empty rectangle the field leaves at each sheet corner (on a 20px grid, at least 220px wide when possible, height counted up to 400px, overlaps on an edge split). Compose places the headline in the largest corner, the label in the smallest, the list in the tallest and the legend in the one nearest the accent part, with a paragraph where room is left, 40px from the sheet's edges and 16px from the field. `sketch` prints `corners: top-left at <x>,<y> is <w> by <h>; top-right at …; bottom-left at …; bottom-right at …`. The full rules are in [CONTRACTS.md §3b](CONTRACTS.md#3b-frames-legend-fits-record-and-corners).

## Fields

A field region is `{ kind: "field", id, field, fits, accent?, names?, sentence?, every?, minShare?, maxParts? }`. Three fields ship, one entry each in the registry `FIELDS` in `lib/fields/index.mjs`:

| `field` | What it draws | Takes |
|---|---|---|
| `wave` | One row of a part's name per share of lines, at least one row per part, in tree order, bent into one band that enters at the top behind the masthead, swings right, back left and leaves through the floor. 6.9px letters on 7.9px rows, about 110 above the floor; the band runs on behind the text blocks, which carry a 6px paper outline. On light the accent part is `ink`, parts near the top of the tree violet (`wave`) and deeper ones a lighter violet (`wave-soft`); on dark the accent is `hot`, the others `mid` and `soft` | `sentence` (at most 40 characters, set in every `every`th row, default 5) |
| `terrain` | One peak per part, height by lines and width by files, left to right in tree order, 6.9px letters on 7.6px rows. Each row reads the name of the part whose slope it crosses, whole words only at a border, letters spread on steep slopes and tight on flats; the rim is `ink`, the rest `mid`, brighter on slopes that face left. A part narrower than 40px gets 40px, and shows as a pointed foothill under a bigger neighbour | nothing more |
| `river` | One stream of `0`s and `1`s per part entering the left edge, as thick as its share of lines, merging pair by pair by how many imports tie them into one channel that leaves the right edge, after g-flow. 5px digits in 3.1px cells on 5px rows; no part name is printed. The accent part's stream and a short run at the last merge are `hot`; other streams alternate `ink` and `mid`. Parts default to `minShare` 0.002 and `maxParts` 24 | nothing more |

On paper the terrain's letters take 0.14 more alpha and its accent 0.5 more (0.3 on dark), as in i-loose.

- `accent` is a part id, an area id or a glob over part ids (`area:lib/*`). An area that merged into a bigger part names that part; an area that holds parts names all of them. The accent parts are drawn in `hot` and carry `data-hot`. Without it, `check` warns `accent-part`.
- `names` maps part ids to plain names of at most 24 characters, checked for jargon like any copy. A part's row text is its name in lower case.
- Rows skip the text blocks with 12px to spare, so moving a text block makes room; a part whose every row is covered fails `field-parts`.

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
| `part-name` | ! | A part a field draws has an unplain name: all caps, a company name the scan knows, or one word ending in a digit. Also a key in `names` that is not a part, and two or more parts with one name, ignoring case: `parts <id> and <id> are all called "<name>"; give each a plain name of its own in names`. Message: `part "<name>" (<id>) looks like a vendor or code name; add a plain name in names` |
| `accent-part` | ! | A field region has no `accent`. Message: `no accent part in region <id>; set accent to the id of the part the poster is about (vyo parts lists them)` |
| `legend` | ✗ | Loose only. The legend names the accent part's plain name (case-folded, anywhere in the text) and the field's measure: a word that starts with "code" or "lines"; a terrain also "files" or "wide"; a river "merge", "join" or "flow". Message: `must say what the picture encodes; name the accent part ("<name>") and the measure (<words>)` |
| `fits` | ✗ | A field region's `fits` has a word that starts with one of the field's keywords: wave "travel", "flow", "hand", "move"; terrain "big", "weight", "matters", "most"; river "merge", "join", "many", "one". Message: `region <id>: fits must say why a <field> matches the product's story; use "<k>" or …` |
| `one-region` | ! | The figure is a single fill region with no hot rows and no hot label. A figure with dots, or with more than one region, never trips it |
| `drawn` | ✗ | The fill script ran to the end: the page raised no error and set `window.drawn` |
| `fonts` | ✗ | `document.fonts` holds a `FontFace` with status `loaded` for Commit Mono 400, Commit Mono 700 and Newsreader 400 |
| `masthead-font` | ! | Inter Display or Inter is installed for the product name. Swiss only |
| `path` | ✗ | Every outline parses and has a non-empty bounding box inside the sheet and above the footer. The message says `region <id> reaches <n>px below the footer; move it up by <n>` |
| `rows-fit` | ✗ | Every `.row` has `scrollWidth ≤ clientWidth` and sits inside the spec's sheet |
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

Under the sheet it prints `regions:`, `texts:` and `floor:` lines (in the loose frame `texts:` includes `record`, `floor:` reads `the sheet's bottom edge (loose frame)` and a `corners:` line follows), then the coverage, height and width, each marked ok or too low, and one line per fill region with its spread of line widths (standard deviation over mean) and mean width, so the agent sees `silhouette`, `row-variety` and `thin-region` before it renders. Lines that start with `! ` flag a field part that is never drawn (`region <id>: part "<name>" (<id>) is never drawn`) or an accent that names no part, a region under 4 rows, a word that may never be drawn, anything below the floor, and the `row-variety` and `thin-region` messages.

## Tests

```bash
npm test
```

`npm test`, from the package root, runs `node tools/test/run.mjs`; its last step packs the package, installs the tarball into a fresh project and makes a poster from there. Browser tests need Chromium: set `VYO_CHROMIUM` (in this environment, `/opt/pw-browsers/chromium`). The rendered PNGs go to `tools/test/.out/`, which git ignores, so a person can look at them.

- **Pure tests.** The scanner, the counts line for the `recipe` fixture, the banned-term table in `plain-language-rules.md` against `lib/jargon.mjs`, and spec validation. The parts of the recipe fixture and of `explorations/2026-11-07-abstract-fields/hypher-facts.json` hold every line, merge as the rules say and resolve accents; the wave and terrain layouts give every part a row and keep their shape, and terrain clears the text blocks. Validation accepts the eight presets, checks the frames' roles and counts, checks field keys, and rejects an unknown region kind, a path that does not parse, a polygon with two points, two mastheads, a `hot` found in no region, words with jargon, and 7 regions.
- **Browser tests.** Every preset (the four fill presets and `wave-swiss` in the swiss frame; `wave`, `terrain` and `river` in the loose frame) renders against a fresh scan of `test/fixtures/recipe` and passes. For each field preset, the sketch's rows and the page's rows match within 2px. Planted bugs fail with their check: a text block over a terrain's foothill and an accent that names no part (`field-parts`), a loose poster with no legend (`spec`), a legend without the accent part's name (`legend`), a record line with no commit (`record`), a fits without the field's keyword (`fits`), two overlapping outlines (`regions-apart`), a 30px outline (`region-size`), one tiny region (`silhouette`), a box with a slanted top (`row-variety`), a 90px column (`thin-region`, a warning), 14 long words in a small outline (`words-drawn`), an aside placed on a row (`blocks-apart`), an outline below the footer (`path`), and the v2 bugs that still apply: jargon, a file path, an untagged hot word, four notes, and a long not-built list that passes.
- **Docs tests.** `test/docs.test.mjs` fails when the check ids in this file or in CONTRACTS.md drift from `CHECKS`.

## How it works

`scan` turns the repo into `facts.json` with no network and no model, so two scans of the same tree are byte-identical. `compose` turns the facts into a field poster, or a preset into a spec whose figure the agent writes in plain words and sheet coordinates. `render` computes each field's parts from the facts, then builds one HTML page in which `lib/fill.js` lays out each field with its module from `lib/fields/`, samples each outline into rows, fills them with the region's words, and places the texts, then Playwright waits for `window.drawn`, takes a 2× screenshot and prints a PDF. The checks run in the same page and measure what was drawn, so a rule break shows up as a `✗` line instead of a bad poster.

# explain-app poster tools

`vyo` reads a repo, writes a scaffold spec for a poster, sketches the agent's figure as text, and renders the filled spec to HTML, PNG and PDF. The contract between the pieces is [CONTRACTS.md](CONTRACTS.md).

## Commands

Run them from the skill directory.

| Command | What it does |
|---|---|
| `node tools/vyo.mjs scan <repo-dir> --out <dir>/<repo>-facts.json` | Reads the repo and writes `facts.json`. Never writes inside the repo except to `--out` |
| `node tools/vyo.mjs show <facts.json>` | Prints a plain summary of the facts |
| `node tools/vyo.mjs presets [<id>]` | Lists the presets with id, `fits`, and a summary of regions and texts. With an id, prints that preset's figure as JSON |
| `node tools/vyo.mjs compose <facts.json> [--from <preset>] [--repo <dir>] [--theme light\|dark] [--out <spec.json>] [--force]` | Writes a scaffold spec and prints the figure's floor. Refuses to overwrite an existing spec unless `--force` is given |
| `node tools/vyo.mjs sketch <spec.json>` | Prints the sheet as ASCII, with coverage, width spread and the floor. Needs no browser |
| `node tools/vyo.mjs render <spec.json> [--out <dir>] [--facts <facts.json>] [--no-png] [--no-pdf] [--paper fit\|a4\|letter]` | Validates the spec, writes HTML, a 2× PNG and a PDF, then runs every check |
| `node tools/vyo.mjs check <spec.json> [--facts <facts.json>]` | Runs the same validation and checks in a temporary directory. Writes nothing to `--out` |

Exit codes: 0 when everything passes (warnings go to stderr as `! ` lines), 1 on any rule error (`✗ ` lines on stderr), 2 on a usage error.

`compose` fills `product`, `facts` and `theme`. Without `--from`, the figure is one box-shaped fill region (a three-stop profile of constant width) with placeholder words, one masthead, one headline and one aside. The box fails `row-variety` on purpose, so reshape it. With `--from <preset>`, the figure is the preset's, with its geometry kept and its words replaced by placeholders. Render rejects every placeholder. `compose` prints `floor: <y>` for the spec's notes count, assuming a one-line not-built list, then the `masthead`, `headline`, `aside` and `rows` lines: line heights, characters per line and the row grid. Each extra not-built line raises the floor by 16px.

`compose --repo <dir>` reads the latest commit's short hash and commit date with git, so reruns give the same footer. Without `--repo` the spec has no commit and `date` is today.

`render` and `check` read the facts from `--facts`, or by default from `<repo>-facts.json` beside the spec, where `<repo>` is the spec's `product.repo`. Output goes to `--out`, by default the spec's directory: `<repo>-poster.html`, `<repo>-poster.png` and `<repo>-poster.pdf`. The HTML embeds its fonts, so it opens anywhere.

## Setup

Run these from the skill directory.

```bash
npm install --prefix tools
bash tools/fetch-fonts.sh               # Commit Mono and Newsreader into tools/fonts/ (not committed)
npx --prefix tools playwright install chromium   # or set VYO_CHROMIUM=/path/to/chromium
```

Render fails with `run tools/fetch-fonts.sh` when `tools/fonts/` is missing. The masthead uses Inter Display if it is installed, then Inter, then Helvetica or Arial. The tools never download Helvetica.

## The spec

The spec, `<repo>-poster.json`, is the only file the agent edits. `compose` fills `version`, `facts`, `product` and `theme`. The agent writes `figure`, `headline`, `hot`, `notes` and `notBuilt`, may set `accent` and `audience`, and replaces `product.name` with the customer-facing name. The full type and validation rules are in [CONTRACTS.md §3](CONTRACTS.md#3-the-spec). Every preset as a full spec, and three invented figures, are in [examples.md](../examples.md).

A figure has a `fits` sentence (at most 160 characters, printed by `presets`, never drawn), 1 to 6 regions and 1 to 6 texts.

- A **fill region** is an outline that the tool fills with rows of the region's `words`, 2 to 14 of them, each at most 24 characters.
- A **dots region** spells 2 to 4 words of at most 5 letters each in squares, at `x`, `y` with a `cell` size in px.
- A **text** is a `masthead` (exactly one, the product name), a `headline` (at most one, the spec's headline), a `display` (a bold sans line, at most 40 characters, size 32 to 64, default 56), an `aside` (size 10 to 14) or a `label` (size 10 to 32, default 12, and 26 when `hot`), placed at `x`, `y` with a wrap width `w`. `align` is `left`, `right` or `center`.

Region and text ids are lowercase and unique. `note`, `counts`, `notBuilt`, `provenance` and `credit` are footer block names, so a region or text cannot take them.

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
| `one-region` | ! | The figure is a single fill region with no hot rows and no hot label. A figure with dots, or with more than one region, never trips it |
| `drawn` | ✗ | The fill script ran to the end: the page raised no error and set `window.drawn` |
| `fonts` | ✗ | `document.fonts` holds a `FontFace` with status `loaded` for Commit Mono 400, Commit Mono 700 and Newsreader 400 |
| `masthead-font` | ! | Inter Display or Inter is installed for the product name |
| `path` | ✗ | Every outline parses and has a non-empty bounding box inside the sheet and above the footer. The message says `region <id> reaches <n>px below the footer; move it up by <n>` |
| `rows-fit` | ✗ | Every `.row` has `scrollWidth ≤ clientWidth` and sits inside the 840×1190 sheet |
| `region-size` | ✗ | Every fill region has at least 4 rows, and every dots region fits. The message names the region |
| `regions-apart` | ✗ | No row of one region comes within 4px, horizontally, of a row of another region at the same y |
| `words-drawn` | ✗ | Every word of every region is drawn at least once. The message says `region <id>: "<word>" never drawn; shorten the list or enlarge the path` |
| `silhouette` | ✗ | Rows and dots lines cover at least 15% of the area above the footer, and the figure spans at least 55% of that area's height and 60% of its width |
| `row-variety` | ✗ | Across all fill rows, the standard deviation of run widths divided by their mean is at least 0.15. Skipped when the figure has no fill region. The message says `the figure is a box; a silhouette changes width` |
| `blocks-apart` | ✗ | No text block comes within 8px of another block or of a row. Two rows at the same y keep 8px horizontally |
| `blocks-inside` | ✗ | Every `[data-block]` text block sits inside the sheet |
| `palette` | ✗ | Every text colour, square background and visible box background is one of the theme's tokens, `cold` and `cool` included |
| `hot-tagged` | ✗ | Anything in the hot colour carries `data-hot` |
| `copy` | ✗ | The visible words hold no banned term, file path, "01/02/03" marker or middle dot. The masthead and the render-owned footer lines are exempt |
| `notes` | ✗ | The footer shows every note in `spec.notes` |
| `band` | ✗ | The footer counts line equals the line built from `bandCounts(facts)` |
| `headline-lines` | ! | The headline wraps to more than 2 lines |

## Sketch output

`vyo sketch` draws the sheet at 20px per character, 42 columns by about 60 lines, without a browser. It runs the same sampler as the page on a polygon version of each outline. Profiles and ellipses become exact polygons, and paths are flattened.

| Mark | Meaning |
|---|---|
| `A` to `F` | Fill rows of the first to the sixth region, in spec order |
| `#` | Squares of a dots region |
| A box | A text block labelled with its id, with its height estimated: 88px for a masthead line at size 84, 28px per headline line in a 224px column, 7.2px per character of mono text, one line of the size's height for a display |
| `=` | The footer's top line |
| `·` | A hot row |

Under the sheet it prints `regions:`, `texts:` and `floor:` lines, then the coverage, height and width and the spread of row widths (standard deviation over mean), each marked ok or too low, so the agent sees `silhouette` and `row-variety` before it renders. Lines that start with `! ` flag a region under 4 rows, a word that may never be drawn, and anything below the floor.

## Tests

```bash
cd tools && npm test
```

`npm test` runs `node test/run.mjs`. Browser tests need Chromium: set `VYO_CHROMIUM` (in this environment, `/opt/pw-browsers/chromium`). The rendered PNGs go to `test/.out/`, which git ignores, so a person can look at them.

- **Pure tests.** The scanner, the counts line for the `recipe` fixture, the banned-term table in `plain-language-rules.md` against `lib/jargon.mjs`, and spec validation. Validation accepts the four presets and rejects an unknown region kind, a path that does not parse, a polygon with two points, two mastheads, a `hot` found in no region, words with jargon, and 7 regions.
- **Browser tests.** Every preset renders against a fresh scan of `test/fixtures/recipe` and passes. Planted bugs fail with their check: two overlapping outlines (`regions-apart`), a 30px outline (`region-size`), one tiny region (`silhouette`), 14 long words in a small outline (`words-drawn`), an aside placed on a row (`blocks-apart`), an outline below the footer (`path`), and the v2 bugs that still apply: jargon, a file path, an untagged hot word, four notes, and a long not-built list that passes.
- **Docs tests.** `test/docs.test.mjs` fails when the check ids in this file or in CONTRACTS.md drift from `CHECKS`.

## How it works

`scan` turns the repo into `facts.json` with no network and no model, so two scans of the same tree are byte-identical. `compose` turns the facts, and optionally a preset, into a spec whose figure the agent writes in plain words and sheet coordinates. `render` builds one HTML page in which `lib/fill.js` samples each outline into rows, fills them with the region's words, and places the texts, then Playwright waits for `window.drawn`, takes a 2× screenshot and prints a PDF. The checks run in the same page and measure what was drawn, so a rule break shows up as a `✗` line instead of a bad poster.

# explain-app poster tools

`vyo` reads a repo, writes a scaffold spec for a poster, and renders the filled spec to HTML, PNG and PDF. The contract between the pieces is [CONTRACTS.md](CONTRACTS.md).

## Commands

Run them from the skill directory.

| Command | What it does |
|---|---|
| `node tools/vyo.mjs scan <repo-dir> --out <dir>/<repo>-facts.json` | Reads the repo and writes `facts.json`. Never writes inside the repo except to `--out` |
| `node tools/vyo.mjs show <facts.json>` | Prints a plain summary of the facts |
| `node tools/vyo.mjs shapes` | Lists the shape library: id, "fits when", themes, notes count, and each slot's prompt and limits |
| `node tools/vyo.mjs compose <facts.json> --shape <id> [--repo <dir>] [--theme light\|dark] [--out <spec.json>] [--force]` | Writes a scaffold spec with every slot holding a placeholder. Refuses to overwrite an existing spec unless `--force` is given |
| `node tools/vyo.mjs render <spec.json> [--out <dir>] [--facts <facts.json>] [--no-png] [--no-pdf] [--paper fit\|a4\|letter]` | Validates the spec, writes HTML, a 2× PNG and a PDF, then runs every check |
| `node tools/vyo.mjs check <spec.json> [--facts <facts.json>]` | Runs the same validation and checks in a temporary directory. Writes nothing to `--out` |

Exit codes: 0 when everything passes (warnings go to stderr as `! ` lines), 1 on any rule error (`✗ ` lines on stderr), 2 on a usage error.

`compose --repo <dir>` reads the latest commit's short hash and commit date with git, so reruns give the same footer. Without `--repo` the spec has no commit and `date` is today. `--theme` defaults to the shape's first theme, and `compose` rejects a theme the shape does not declare. `compose` refuses to overwrite an existing spec, which may hold the agent's words, unless you pass `--force`.

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

The spec, `<repo>-poster.json`, is the only file the agent edits. `compose` fills `version`, `facts`, `product`, `theme` and `shape`. The agent fills `headline`, `hot`, `slots`, `notes` and `notBuilt`, and replaces `product.name` with the customer-facing name. The full type and validation rules are in [CONTRACTS.md §3](CONTRACTS.md#3-the-spec). Sample specs for every shape are in [examples.md](../examples.md).

## Shape library

Slot kinds: `words` is a list of short nouns, `phrase` is a short string set in caps, and `line` is one sentence that may start with a `**bold phrase**`. Every shape also takes a `headline` of at most 72 characters.

| id | Fits when | Themes | Notes | Slots | `hot` comes from |
|---|---|---|---|---|---|
| `hourglass` | Many messy inputs are squeezed into one thing, then handed on | light, dark | 3 | `top` words 6–12, `waist` phrase ≤ 16, `bottom` words 3–8, `asideLeft` line ≤ 90, `asideRight` line ≤ 110, `asideBottom` line ≤ 90 | `top` or `waist` |
| `ribbon` | Something travels between two places or tools. The ribbon is made of what travels | dark | 3 | `leftLine` phrase ≤ 24, `rightLine` phrase ≤ 24, `travels` words 4–10, `aside` line ≤ 110 | `travels` |
| `warm-start` | A state changes over a sequence, warming from cold grey to the accent | light | 2 | `lines` words 2–4, each at most 5 letters and letters only, `aside` line ≤ 110 | The last of `lines` |
| `eye` | Something reads or watches everything and focuses on one thing | light | 3 | `lids` words 6–12, `iris` words 3–6, `blurb` line ≤ 140 | `iris` |

## What `check` enforces

`render` and `check` run the same checks. They are one table, `CHECKS` in `lib/check.mjs`, and [CONTRACTS.md §6](CONTRACTS.md#6-checks) lists them too. `✗` fails the run and `!` is a warning for the agent to weigh.

| id | Level | What it measures |
|---|---|---|
| `spec` | ✗ | The spec passes every rule in §3. When it fails, no other check runs |
| `facts-hash` | ✗ | `spec.facts` equals the facts file's `hash` |
| `facts-empty` | ! | `facts.empty` is true: the scan found nothing to count, so the footer shows provenance only |
| `product-name` | ! | `product.name` equals `facts.repo.name`, the folder name |
| `slot-at-max` | ! | A slot is filled to its limit, which risks crowding |
| `drawn` | ✗ | The shape's script ran to the end: the page raised no error and set `window.drawn` |
| `fonts` | ✗ | `document.fonts` holds a `FontFace` with status `loaded` for Commit Mono 400, Commit Mono 700 and Newsreader 400 |
| `masthead-font` | ! | Inter Display or Inter is installed for the product name |
| `rows-fit` | ✗ | Every `.row` has `scrollWidth ≤ clientWidth` and sits inside the 840×1190 sheet |
| `words-drawn` | ✗ | Every slot word appears in a rendered `.row`, and `hot` appears in the accent colour in the figure |
| `blocks-apart` | ✗ | No two `[data-block]` text blocks overlap |
| `blocks-inside` | ✗ | Every `[data-block]` text block sits inside the sheet |
| `palette` | ✗ | Every text colour, square background and visible box background is one of the theme's tokens |
| `hot-tagged` | ✗ | Anything in the `hot` colour carries `data-hot` |
| `copy` | ✗ | The visible words hold no banned term, file path, "01/02/03" marker or middle dot. The masthead and the render-owned footer lines are exempt |
| `notes` | ✗ | The footer shows the shape's `notes` count of notes |
| `band` | ✗ | The footer counts line equals the line built from `bandCounts(facts)` |
| `headline-lines` | ! | The headline wraps to more than 2 lines |

## Tests

```bash
cd tools && npm test
```

`npm test` runs `node test/run.mjs`. The pure tests cover the scanner, spec validation, every shape's slots through compose and validate, the banned-term table in `plain-language-rules.md` against `lib/jargon.mjs`, and the counts line for the `recipe` fixture. The browser tests render the golden specs in `test/golden/<shape>.json`, expect every check to pass, then render planted bugs and expect each to fail with its message. They need Chromium: set `VYO_CHROMIUM` (in this environment, `/opt/pw-browsers/chromium`). The rendered PNGs go to `test/.out/`, which git ignores, so a person can look at them.

## How it works

`scan` turns the repo into `facts.json` with no network and no model, so two scans of the same tree are byte-identical. `compose` turns the facts and a chosen shape into a spec whose slots the agent fills in plain words. `render` builds one HTML page in which the shape lays out its word rows in the browser, then Playwright waits for `window.drawn`, takes a 2× screenshot and prints a PDF. The checks run in the same page and measure what was drawn, so a rule break shows up as a `✗` line instead of a bad poster.

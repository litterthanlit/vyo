---
name: explain-app
description: >-
  Use when the user asks to explain the app, walk through how it works for a
  client, PM or stakeholder, create a non-technical overview, demystify the
  codebase for someone who does not code, help someone sell or talk about their
  product, visualize the repo as a poster, or draw the codebase. Produces one
  type-led poster (PNG and PDF): a silhouette invented for the product, built
  from its own words, that acts out what it does.
---

# Explain App

You invent one picture that acts out the product's main moment and describe it in a JSON spec as a few regions and texts. The tools fill the regions with its words, add a footer of counts, and check it.

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
3. Read `README*`, `docs/` and `.cursor/skills/explain-app/project-context.md` in the target repo if the owner wrote one (most repos have none). Write down the product's name, audience and main moment: one sentence about what it does for a person. Every claim must point at the scan, the docs or the code.
4. Invent the picture. Write its `fits` sentence before any numbers.
5. Write the scaffold:
   ```bash
   node tools/vyo.mjs compose <repo>/vyo/<name>-facts.json --repo <repo> --out <repo>/vyo/<name>-poster.json
   ```
   `--repo` puts the latest commit in the footer. `--from <preset>` starts from a preset's geometry (`node tools/vyo.mjs presets` lists them). `compose` prints `floor: <y>`, the lowest y the figure may reach, and the line heights and row grid. Without `--from` the figure is a box that fails `row-variety` on purpose.
6. Write the figure and fields (see "Describe it" and "Fill the spec").
7. Sketch: `node tools/vyo.mjs sketch <repo>/vyo/<name>-poster.json`. It prints the sheet in letters (A to F regions, `#` dots, `·` hot rows, `=` the floor), the coverage, and each region's width spread and mean width. Act on every `!` line, including width and coverage, before you render. Sketch again until a stranger would name the silhouette.
8. Render: `node tools/vyo.mjs render <repo>/vyo/<name>-poster.json`.
9. Fix every `✗` line. Render exits 1 until none is left. Weigh every `!` line. `preset-copy` means you kept a preset's geometry. Change it, or say in chat why it fits.
10. Open the PNG, full size and as a thumbnail. The silhouette must read as the main moment, the hot word must stand out, and no word may read as code. If not, go back to step 7.
11. Reply in chat in the format below.

## Invent the picture

Start from the verb in the main moment, not the category.

| When the product... | Try |
|---|---|
| squeezes many things into one | hourglass |
| carries something from one place to another | ribbon |
| reads everything, then focuses on one thing | eye |
| warms up, or turns unknown into known | dot letters, cold to hot |
| grows, or takes you up in stages | tree or stair |
| joins two sides | bridge or knot |
| guards or keeps safe | shield or wall |
| repeats on a cycle | ring |

Bend it to the product. A ring can break open where today's item leaves.

Make one strong silhouette:

- Draw one dominant silhouette, not separate blocks. Two blocks side by side read as two columns, whatever their tops do.
- Its outline is a continuous curve across the whole band. The profile's half-widths change at most stops, not only at the ends.
- Negative space goes inside the shape as holes, not as gaps between blocks, like the eye's empty pupil.
- Aim for about a third of the band covered.
- A region narrower than about 160px reads as a column. `thin-region` warns under 160px on average. `row-variety` fails a region whose line widths spread less than 0.25 of their mean.
- A hot region cycles its words down every row, so give it two or three short phrases, not a list.
- The thumbnail test: shrink it in your head to a stamp and name it in one word. That word must describe what the product does.

None of these acts out a moment. Never use:

- a heart, for anything about people or care
- a plain circle, which passes every check, or a box filled edge to edge
- a blob with no edge a person could name
- "01, 02, 03" step markers

The words:

- Every word is a noun the product's user would say: "leftovers", "busy nights", "the shopping list". Never a feature name, a role word or a code name. Product and tool names the user actually uses today (Claude Code, Codex, Cursor) are allowed; they are not jargon.
- Each region has one job and its own words: what goes in, what comes out, what travels.
- One hot word on the whole poster, where the moment happens: the waist, the iris, the last line.
- Tones give depth. `soft` is far or past, `ink` is near or now. Two or three tones step down a region, each row taking the nearest stop. `cold` and `cool` are blue-greys for a state not yet warm.

## Describe it

The sheet is 840 by 1190 px and y grows downward. A figure has `fits` (at most 160 characters), 1 to 6 `regions` and 1 to 6 `texts`.

A fill region has `kind: "fill"`, `id`, one geometry, `words` (2 to 14, at most 24 characters each) and `tone`. Options: `holes` (shapes to cut out), `band` (1 to 4 rows per word), `size` (11 or 12), `caps`, and `hot` (every row in the accent). Geometry, by preference: `profile`, 3 to 24 stops `[y, cx, halfWidth]` with y increasing; `ellipse` `{ cx, cy, rx, ry }`; `polygon`, 3 to 40 `[x, y]` points for hard corners; `path`, an SVG path.

A dots region spells 2 to 4 words of at most 5 letters in squares: `kind: "dots"`, `id`, `lines`, `x`, `y`, `cell` (px per square), and `tones`, one per line, which may include `hot`. A dots line is 29 squares wide and 7 tall, with lines 9 squares apart.

A text has `role` (`masthead`, `headline`, `display`, `aside` or `label`), `id`, `x`, `y`, `w`, and optional `size`, `align` (`left`, `right` or `center`) and `hot`. Asides, displays and labels need `text`. One masthead prints the product name, shrunk to fit `w`. At most one headline prints `spec.headline`. A `display` is a bold sans line of at most 40 characters A label with `hot: true` is set in the accent, uppercase and tracked. Default sizes: masthead 84 (48 to 120), headline 22 (18 to 40), display 56 (32 to 64), aside 12 (10 to 14), label 12 (10 to 32), hot label 26. No region or text may use the ids `note`, `counts`, `notBuilt`, `provenance` or `credit`.

Rows are 16px tall, 14px at size 11, on a sheet-wide grid. The tool skips any part of a row within 12px of a text and drops runs under 24px. A fill region needs 4 rows or more.

Six worked profiles for a band from y 180 to 860. Each passed `silhouette` and `row-variety` as one region. Move or stretch them, and keep holes inside the outline.

| Shape | `profile` | Hole |
|---|---|---|
| flame | `[[180,450,4],[300,400,80],[440,450,180],[620,410,270],[770,420,260],[860,420,130]]` | |
| bottle | `[[180,420,50],[300,420,50],[380,420,110],[460,420,260],[800,420,270],[860,420,230]]` | |
| bridge arch | `[[200,420,40],[300,420,200],[460,420,340],[640,420,390],[860,420,400]]` | profile `[[500,420,30],[580,420,180],[700,420,260],[860,420,290]]` |
| leaf | `[[180,560,4],[300,500,160],[480,440,260],[660,380,230],[800,330,110],[860,310,6]]` | |
| key | `[[180,420,150],[240,420,260],[340,420,260],[420,420,140],[470,420,60],[700,420,60],[740,480,120],[860,480,120]]` | ellipse `cx 420, cy 300, rx 110, ry 60` |
| wave | `[[180,330,90],[260,270,190],[340,330,230],[460,430,250],[640,430,330],[860,420,390]]` | ellipse `cx 230, cy 380, rx 70, ry 60` |

A figure with no fill region (dots only) skips `row-variety`, `thin-region` and `one-region`.

## Fill the spec

`compose` fills `version`, `facts`, `product`, `theme` (`light` or `dark`) and a placeholder `figure`, which render rejects.

| Field | What it is |
|---|---|
| `product.name` | The customer-facing name. `product-name` warns while it is the folder name |
| `accent` | Optional hot colour, a hex |
| `headline` | One plain sentence about the outcome, at most 72 characters |
| `hot` | The one word or two-word phrase that matters, drawn in the figure |
| `notes` | 2 or 3 footer columns. `title` at most 24 characters, `text` at most 220 |
| `notBuilt` | 0 to 6 plain items (at most 32 characters each) the code has but a user cannot use yet |

Each note does a job the picture cannot: how it works, what you get, what stays private, what runs on its own, or proof. Never type a count, a commit or a date into the footer; render writes those. Follow [plain-language-rules.md](plain-language-rules.md). [examples.md](examples.md) has each preset as a full spec and three invented figures.

## Where output goes

Render writes `<name>-poster.html`, `.png` and `.pdf` beside the spec or into `--out <dir>`. Keep every file in `<repo>/vyo/`, and suggest adding it to `.gitignore`.

## Reply in chat

1. One sentence on what the app does.
2. The picture and why it acts out the main moment.
3. The absolute paths of the PNG and the PDF.
4. Gaps: what is not built, a preset kept unchanged, and a request for the real name if no doc gave one.

## Edge cases

- **Empty scan.** Render warns `facts-empty`. Work from the docs and say the footer has no counts. With no docs either, make no poster.
- **No docs.** Keep the folder name, accept the `product-name` warning, and ask for the real name. Never invent one.
- **Several apps.** Scan the root. Name the product, not a folder.
- **No screens.** Say "there is no user interface in this repository" and describe what the service does for its callers.
- **`project-context.md`.** Its name, audience, main moment, hot word, picture and not-built list win over what you inferred.

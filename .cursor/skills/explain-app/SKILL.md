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

You invent one picture that acts out the product's main moment and describe it in a JSON spec as a few regions and texts. The tools fill each region with the product's words, add a footer of counts from the code, and check the result.

```
repo → scan → facts.json → compose → you write the figure → sketch loop → render → png + pdf
```

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
3. Read `README*`, `docs/` and `.cursor/skills/explain-app/project-context.md` in the target repo. Write down the product's name, audience and main moment: one sentence about what it does for a person. Every claim on the poster must point at the scan, the docs or the code.
4. Invent the picture. Write its `fits` sentence before any numbers.
5. Write the scaffold:
   ```bash
   node tools/vyo.mjs compose <repo>/vyo/<name>-facts.json --repo <repo> --out <repo>/vyo/<name>-poster.json
   ```
   `--repo` puts the latest commit in the footer. `--from <preset>` starts from a preset's geometry (`node tools/vyo.mjs presets` lists them). `compose` prints `floor: <y>`, the lowest y the figure may reach. `--force` overwrites.
6. Write the figure and fields (see "Describe it" and "Fill the spec").
7. Sketch: `node tools/vyo.mjs sketch <repo>/vyo/<name>-poster.json`. It prints the sheet in letters, with coverage, width spread and the floor. Adjust and sketch again until a stranger would name the silhouette.
8. Render: `node tools/vyo.mjs render <repo>/vyo/<name>-poster.json`.
9. Fix every `✗` line. Render exits 1 until none is left. Weigh every `!` line. `preset-copy` means you kept a preset's geometry. Change it, or say in chat why it fits.
10. Open the PNG, full size and as a thumbnail. The silhouette must read as the main moment, the hot word must stand out, and no word may read as code. If not, go back to step 7.
11. Reply in chat in the format below.

## Invent the picture

Start from the verb in the main moment, not the product's category.

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

Bend it to the product. A ring can break open where today's item leaves. A stair can end in the hot word. Test it: shrunk to a thumbnail, would a person name the shape in one word, and does that word describe what the product does?

A model that has not thought about the product draws these. Never use them:

- a heart, for anything about people or care
- a plain circle, which passes every check, or a box filled edge to edge
- a blob with no edge a person could name
- "01, 02, 03" step markers

The words:

- Every word is a noun the product's user would say: "leftovers", "busy nights", "the shopping list". Never a feature name, a role word or a code name.
- Each region has one job and its own words: what goes in, what comes out, what travels.
- One hot word on the whole poster, where the moment happens: the waist, the iris, the last line.
- Tones give depth. `soft` is far or past, `ink` is near or now, and two or three tones fade down a region. `cold` and `cool` are blue-greys for a state not yet warm.
- Leave paper. The eye's empty pupil and the hourglass's narrow waist are what make them read.

## Describe it

The sheet is 840 by 1190 px, y grows downward, and the figure usually sits between y 170 and the floor. A figure has `fits` (at most 160 characters), 1 to 6 `regions` and 1 to 6 `texts`.

A fill region has `kind: "fill"`, `id`, one geometry, `words` (2 to 14, at most 24 characters each) and `tone`. Options: `holes`, `band` (1 to 4 rows per word), `size` (11 or 12), `caps`, and `hot` (every row in the accent). Geometry, by preference:

- `profile`: 3 to 24 stops `[y, cx, halfWidth]`, y increasing. The tool draws a smooth outline through them.
- `ellipse`: `{ cx, cy, rx, ry }`.
- `polygon`: 3 to 40 `[x, y]` points, for hard corners such as steps.
- `path`: an SVG path, when nothing else draws it.

`holes` lists shapes of the same kinds to cut out. A dots region spells 2 to 4 words of at most 5 letters in squares: `kind: "dots"`, `id`, `lines`, `x`, `y`, `cell` (px per square), and `tones`, one per line.

A text has `role` (`masthead`, `headline`, `aside` or `label`), `id`, `x`, `y`, `w`, and optional `size`, `align` and `hot`. Asides and labels need `text`. Exactly one masthead prints the product name and shrinks to fit `w`. At most one headline prints `spec.headline`. A label with `hot: true` is set in the accent, uppercase and tracked.

| Text | Size (range) | Height |
|---|---|---|
| `masthead` | 84 (48 to 120) | 88px per line at 84 |
| `headline` | 22 (18 to 40) | 28px per line in a 224px column |
| `aside`, `label` | 12 (10 to 14) | 18px per line, 7.2px per character |

Rows are 16px tall, 14px at size 11, on a sheet-wide grid. The tool skips any part of a row within 12px of a text, so a masthead can sit inside a region. It drops runs under 24px. A fill region needs 4 rows or more.

An hourglass as one region with six stops, centred on x 420:

```json
{ "kind": "fill", "id": "glass", "tone": ["soft", "ink"],
  "words": ["recipes", "leftovers", "busy nights", "cravings", "shopping list", "the plan"],
  "profile": [[176, 420, 365], [320, 420, 200], [500, 420, 48], [560, 420, 48], [740, 420, 200], [864, 420, 365]] }
```

The outer stops set the rims. The two at 48 hold the waist for four rows. One region mixes what goes in with what comes out, so the `hourglass` preset splits it at the waist into two regions and puts a hot label between them.

## Fill the spec

`compose` fills `version`, `facts`, `product`, `theme` and a placeholder `figure`, which render rejects.

| Field | What it is |
|---|---|
| `product.name` | The customer-facing name. `product-name` warns while it is the folder name |
| `theme` | `light` or `dark` |
| `accent` | Optional hot colour, a hex |
| `headline` | One plain sentence about the outcome, at most 72 characters |
| `hot` | The one word or two-word phrase that matters. It must be a word in a fill region, a dots line, or a hot label's text, unless a region has `hot: true` |
| `notes` | 2 or 3 footer columns. `title` at most 24 characters, `text` at most 220 |
| `notBuilt` | 0 to 6 plain items the code has but a user cannot use yet |

Each note does a job the picture cannot: how it works, what you get, what stays private, what runs on its own, or dated proof from the docs. Never type a count, a commit or a date. Follow [plain-language-rules.md](plain-language-rules.md). [examples.md](examples.md) has each preset as a full spec and three invented figures.

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

## Related skills

If installed, use `codebase-onboarding` for a developer joining the repo, `codebase-documenter` for contributor docs and API reference, and `project-handoff` for build status and next steps.

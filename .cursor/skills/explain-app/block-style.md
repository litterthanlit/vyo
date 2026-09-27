# Block Style

The second poster style: a Block poster is the app's features, stacked into one figure over a soft field of colour. The reference is Farrow's poster for Deconstruction Records: out-of-focus photographic colour, a body of black blocks on a grid, each tagged with a small coloured tab.

Build files as [poster-kit.md](poster-kit.md) + [block-kit.md](block-kit.md) + the page from [block-starter.md](block-starter.md) or [block-story-starter.md](block-story-starter.md). The grid, baseline, type sizes, plain-language rules and checker from the Swiss style all still apply. This file covers what changes.

## When to choose Block

| Choose **Swiss** (default) when… | Choose **Block** when… |
|---|---|
| The reader needs the step-by-step: journeys, screens, what happens under the hood | The poster must land in one glance: a cover, a deck opener, a social post, a wall |
| It's a client or PM handoff | The owner wants to show off the product, or a pitch needs a strong image |
| — | `project-context.md` says `Poster style: block`, or the user asks for something bold, cover-like, record-sleeve or Farrow-like |

Block page 1 trades journeys, schematics and the transit line for impact. Say so in chat if the user picked Block for a handoff.

## The sheet

- A **fixed A-series portrait sheet**, 1028 × 1454px, full bleed. It is a fixed object: in a narrow panel it scrolls rather than reflows.
- The same 12-column grid, 8px baseline and 64px margins as Swiss.
- Layers, back to front:
  1. colour field
  2. black figure
  3. tabs
  4. white text inside blocks
  5. legend bar and colophon

## The colour field

- **One hue**, lighter and darker pools of it, heavily blurred: it reads as an object photographed out of focus.
- The hue comes from `project-context.md` ("Brand hue"), or from a seeded pick of orange, rose, cyan or lime. Never blue or purple.
- Placement is seeded by the product name, so page 1 and page 2 share the same field when given the same `seed` and `hue`.
- Vector only: ellipses and one `feGaussianBlur`. No photos, noise, gradients-as-decoration, or second hues.
- **Nothing is ever set directly on the field.** Every word sits on a block, a tab or a paper strip. The field is atmosphere, not a surface to write on.

## The figure

- **One block per feature (page 1) or story section (page 2)**, top to bottom in the order a user meets them. 3–8 blocks.
- **Weight** (1–3) is how central the feature is: judge from how many routes and screens touch it, how much code it owns, and how much the docs talk about it.
  - Weight sets the width: 4 / 6 / 8 columns.
  - Weight also claims a share of the spare height, so central features stand taller.
- **Connected.** Every block sits directly on the one above and overlaps it by at least 2 columns, so the stack reads as one body. The left/right drift is seeded by the product name.
- **Text** inside a block is white, 14/24, flush-left, starting at the top. The bottom 40px stays clear, because the next block's tab lands there.

## Tabs = status

Tabs sit on each block's top edge, 3 columns wide at most, left or right (seeded). They hold the name in 10px bold caps and one status word.

| Tab | Means |
|---|---|
| Yellow | **Live** — users can do this today |
| Blue, white type | **Behind the scenes** — works, but there's no screen for it yet |
| Silver | **Coming soon** — planned, not built |
| Paper | A plain label (the title, page 2 sections) |

These line up with the Swiss colours: yellow is what you get, blue is behind the scenes. Status honesty is the same as Swiss: never mark backend-only work live. The legend bar at the bottom explains the three colours.

## Type

Four sizes, as in Swiss:
- **72px:** the product name (page 1) or tagline (page 2), white, in the title block, with the red full stop. 64 and 80 are also allowed.
- **44px:** talking-point numerals (page 2).
- **14px:** block text.
- **10px:** tabs, legend and colophon.

The colophon is set vertically at the bottom of the left margin, on a paper chip.

## Checklist (⚙ = `node tools/poster.mjs check` measures it)

- [ ] ⚙ Sheet is exactly 1028 × 1454; no block runs off it or into the legend bar
- [ ] ⚙ Every block sits on the one above and overlaps it by 2+ columns
- [ ] ⚙ No text on the field; every text passes WCAG contrast (4.5:1, 3:1 at 24px+)
- [ ] ⚙ Field is one hue, blurred with `feGaussianBlur` only
- [ ] ⚙ Backgrounds are paper, ink or a status colour; text is ink or paper; one red full stop
- [ ] ⚙ Four type sizes; title at 64 / 72 / 80px; grid and baseline as Swiss
- [ ] Blocks are the app's **real** features, in the order a user meets them; weights reflect how central each one is
- [ ] Statuses are honest and match the Swiss page's footer if both styles are delivered
- [ ] Page 1 and page 2 share `seed` and `hue`

## Anti-patterns

| Bad | Fix |
|---|---|
| A caption or label floating on the colour field | Put it on a block, tab or the paper legend bar |
| A second hue in the field, or blue/purple | One hue from the brand, lighter and darker |
| Blocks spread out like cards in a grid | One connected body; each block rests on the one above |
| Every block the same size | Weight by how central the feature is |
| Tabs coloured for decoration | Tab colour is status, and nothing else |
| A photo or texture behind the blocks | The generated field only; canvases can't carry photos |

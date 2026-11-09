# Contour (shape field, direction C)

The agent invents a silhouette for the product. The engine fits it to the sheet and fills it with rings: offset curves of the outline, moving inward like growth rings or a topographic map. Each ring carries one part's plain name, repeated along the curve. The accent part is a solid band of rings in the accent colour with its name reversed out, and it sits one band inside the outline, so it traces the silhouette in orange.

| Poster | Shape |
|---|---|
| `pantry-light.png`, `pantry-dark.png` | A storage jar with a lid and a label. The legend sits in the label |
| `hypher-light.png`, `hypher-dark.png` | A paper plane (a "send" dart with a fold slit), with hairline echoes behind it |

Each PNG is 840x1190 at 2x. Each `-thumb.png` is 280px wide.

Regenerate with `node render.mjs pantry-light.json pantry-dark.json hypher-light.json hypher-dark.json`. Playwright must resolve, and `VYO_CHROMIUM` can point at a Chromium binary. The script prints the ring count per part, the checks (`✗` lines fail the run with exit 1), and an ASCII sketch of the sheet. It also writes a `.html` beside each PNG for debugging, which git ignores. `pantry-facts.json` is a scan of the skill's `tools/test/fixtures/recipe`. The Hypher configs read `../../2026-11-07-abstract-fields/hypher-facts.json`.

## The shape format

A shape is a list of drawing operations in a free coordinate space, painted in order. An `add` paints the shape in and a `cut` erases it. The engine measures what was painted, then scales it to the largest size that fits below the headline, centred. Only proportions matter, so `view` is the authoring canvas and nothing more. Coordinates may leave the `view`.

```json
"shape": {
  "view": [w, h],
  "echo": 0,
  "ops": [
    { "add": "circle",  "at": [x, y], "r": r },
    { "add": "ellipse", "at": [x, y], "r": [rx, ry] },
    { "add": "rect",    "at": [x, y], "size": [w, h], "round": r },
    { "add": "capsule", "from": [x, y], "to": [x, y], "r": r },
    { "add": "arc",     "at": [x, y], "r": r, "from": deg, "to": deg, "width": w },
    { "add": "polygon", "points": [[x, y], [x, y], [x, y]], "round": r },
    { "add": "path",    "d": "M0 0 L10 0 ..." },
    { "cut": "circle", "...": "any kind, same keys" }
  ]
}
```

- **y points down**, as in SVG. `rect.at` is the top-left corner. `circle`, `ellipse` and `arc` take `at` as the centre.
- `round` rounds a rect's or a polygon's corners. Use it. Sharp corners make sharp ring corners, where glyphs crowd.
- `capsule` is a thick line with round ends, of radius `r`. It is the easiest way to draw a handle, a stem, a slit or a gap.
- `arc` is a thick arc band. Its angles are in degrees clockwise from twelve o'clock, like a clock face.
- `path` is an SVG path, filled with the nonzero rule (`"rule": "evenodd"` switches it).
- `cut` makes holes and gaps. A cut fully inside the shape makes a hole, and the rings run around it (the jar's label). A cut that crosses the shape splits it into islands, and each island gets its own rings (the jar's lid).
- `echo` (optional, default 0) draws that many hairline copies of the outline radiating outward, faded and kept clear of the text.
- The first op must be an `add`. Unknown kinds and missing or mistyped keys are refused before render, with every error listed by op index.

### Example: Pantry's jar

```json
"view": [100, 130],
"ops": [
  { "add": "rect", "at": [22, 0], "size": [56, 13], "round": 4 },
  { "add": "rect", "at": [28, 16], "size": [44, 10] },
  { "add": "rect", "at": [6, 22], "size": [88, 108], "round": 26 },
  { "cut": "rect", "at": [20, 60], "size": [60, 36], "round": 4 }
]
```

The lid floats 3 units above the neck, so it becomes its own island of rings. The body's 26-unit corners make the shoulders. The cut label is a hole, and the legend finds it and centres in it like a printed label.

### Example: Hypher's paper plane

```json
"view": [100, 100],
"echo": 9,
"ops": [
  { "add": "polygon", "points": [[0, 50], [86, 0], [66, 100], [49, 58]], "round": 4 },
  { "cut": "capsule", "from": [78, 13], "to": [62, 38], "r": 0.8 }
]
```

The dart is four points: tail, nose, lower tip and the notch between them. The capsule cut is the fold. It stops short of both edges, so it is a slit-shaped hole and the rings wrap around it like a crease pressed into paper. The echoes read as the plane's wake.

## The rule

The silhouette is rasterised at sheet size and turned into a signed distance field (an exact Euclidean distance transform). Rings are its iso-lines every 7px inward, starting 3.5px inside the outline, traced with marching squares and rounded where they fold over the shape's medial axis. The parts, in tree order with the accent moved to the second band, get rings in proportion to their lines of code by largest remainder, with at least one ring each. Every ring is set with its part's plain name and a middle dot, repeated, in Commit Mono 6.6px on an SVG `textPath`. Letter-spacing is adjusted per ring so the repeats close the loop with no seam. A hairline in ink marks each boundary between parts. The accent band is filled with the accent colour, and its names are set in bold in the paper colour. Where a ring folds back on itself (the field's slope drops below 0.55 within a third of a glyph of the letter's centre), the whole name is blanked, so the folds show as clean seams and no name is ever cut into fragments. The legend goes in the free spot nearest a sheet corner, at least 22px from the outline. When that spot is enclosed by the shape, the legend centres in it. The record line goes on the bottom edge, or up the left edge when the bottom is not clear.

### Config

| Key | What it is |
|---|---|
| `facts` | The scan, relative to the config |
| `product`, `commit`, `date` | The label and the record line |
| `theme` | `light` or `dark`, the skill's tokens unchanged |
| `headline`, `legend` | As in the loose frame |
| `accent`, `names` | A part id from `vyo parts`, and a plain name for every part |
| `maxParts` | Default 10. A contour field wants about one part per two rings (see below) |
| `rings` | Optional `gap` (7), `size` (6.6), `round` (12), and `order`: `tree`, `accent-out`, `accent-in`, `size-out`, or a number that puts the accent band at that position from the outside. All four posters use `1` |
| `shape` | The format above |

No new colour token. The echoes use `soft`, at half opacity on paper.

## What failed along the way

1. **First render: pale, and the accent lost.** At 9px gap and 7px type the jar was a light grey tone, and the plan's two rings sat near the core as a small orange squiggle. Tighter rings (7px) helped the tone, and moving the accent to the second band helped the placement, but two orange text rings still only tinted the thumbnail. The fix that worked was a solid accent band with reversed-out names. It is the single change that made the posters strong at thumbnail size.
2. **Engraved hairlines.** Alternating ink and mid tones between parts was too subtle to read. One ink hairline per part boundary, with every ring in ink, gives the banknote look and keeps the bands countable.
3. **Medial-axis pile-ups.** Inner rings fold over the shape's skeleton (the jar's shoulders, the plane's arms), and glyphs from both sides land on each other. Rounding the rings (a moving average over about 12px) fixed the jar. For the plane, glyphs on a fold had to be blanked. Blanking single glyphs left fragments such as "s rver", so the rule blanks whole names, and then the separators too, to leave no orphan dots. The check that every part shows its name at least once caught both regressions.
4. **RDP on a closed loop.** Simplifying a loop whose ends coincide measured every point's distance as zero, and each ring collapsed to two points. The fix splits the loop at its farthest point first.
5. **The first plane was two shards.** Two triangles split by a full-length fold cut read as two shards, not a plane. They were also thin, so they gave only 17 rings for 13 parts, and the one-ring floor flattened the proportions: `handoff note`, at 18% of the code, got the same two rings as parts a third its size. The fix had four parts: a fat four-point dart, a fold that is a slit and not a split, a steeper heading so the shape is taller than wide and fills more of the sheet, and `maxParts: 8`.
6. **Bottom-aligned fit** left a dead band under the headline for any wide shape. The shape now centres vertically in its room.
7. **Echoes on paper** weighed as much as the rings, so they are at half opacity on the light theme. On the jar they were not tried in the final set: the jar is a still object and the plane is the one that moves.

## Authoring a silhouette blind

Getting the jar right took one try, because it is made of rounded rectangles and an LLM can place rectangles on a 100-unit grid reliably. Getting the plane right took four. The first attempt was geometrically valid and looked wrong: right outline, wrong object. Every failure there was something no amount of care in the JSON would have shown. Thin parts starve the ring count. A full cut splits a shape into unrelated pieces. A wide shape wastes the sheet. Medial creases make glyph pile-ups. I could judge each of these only from the render. Blind authoring of the outline is easy. Blind authoring of a good contour shape is not, because the quality depends on the shape's thickness everywhere, and that does not show in coordinates.

What an agent needs, in order of value:

1. **The ASCII sketch.** `render.mjs` already prints it: `#` for the shape, `*` for the accent band, and letters for the text blocks, on a 70x50 grid. It showed the dead band and the shards before I opened the PNG. It needs no browser if the mask is rasterised in Node.
2. **Depth numbers.** The deepest point and the ring count, with a warning when the rings are fewer than twice the parts. That is the "too thin" signal, and it is exact.
3. **Per-part ring counts beside the share of lines.** These make the one-ring floor visible.
4. **The name check.** It flags any part with no whole name left on any ring.
5. **A thumbnail look.** No number replaces it for "does it read as a jar", but a cheap proxy is a filled-silhouette PNG at 140px.

## What the real engine would need

- **A `shape` field module** beside `wave`, `terrain` and `river`, with a `layout` that returns rings (polylines plus text) instead of rows. The text-on-path rendering needs the page (SVG `textPath`), but everything up to the rings can run in Node.
- **Browserless rasterising for `sketch`.** The ops are simple enough to rasterise in pure JS with scanline fill (circle, rect, capsule and polygon are each a few lines, and `path` needs a small flattening step). The distance transform and marching squares already run in pure JS (`page.js` uses no DOM until the SVG). `sketch` could then print the ASCII sheet, the ring counts, the depth and the crease share without Chromium.
- **Spec checks** in `check.mjs`: `shape-thin` (rings fewer than 2x parts), `shape-name` (a part with no whole name), `shape-fit` (the shape fills under about 45% of its room, so it should be redrawn taller or wider), and `legend-room` (no free spot, so cut a hole or change the proportions). The in-page checks here cover `shape-name`, the legend placement, and a weaker `shape-thin` that fails only when there are fewer rings than parts.
- **Part count per field**: `FIELDS.shape.parts = { maxParts: 8 }`, or better, derived from the measured ring count.
- **Corner finding from the distance field.** The `free()` test here is the field's sign plus a margin, which is simpler and more exact than the occupancy grid in `geometry.mjs`.
- **The accent band as the legend's anchor.** The legend can always say "the orange band", because the band's position is fixed by `order`.

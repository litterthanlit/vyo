# A. Relief (throwaway)

The `shape` field drawn as a lit volume made of 6px type. The agent writes a silhouette as a short list of primitives. The page fits it to the sheet and splits its area among the scanned parts by lines of code. It then lights the form from the top left and sets every glyph cell with the plain name of the part that owns it.

```bash
node render.mjs                       # every config in configs/
node render.mjs configs/pantry-dark.json
```

Each config writes `out/<name>.png` (1680x2380, 2x) and `out/<name>-thumb.png` (280px wide). It also prints one line per config, `ok` or a list of `✗` problems, followed by notes. The script exits 1 while any problem is left. It needs Playwright, `require('playwright')`, and reads the fonts from `.cursor/skills/vyo/fonts/` and the parts from `tools/lib/parts.mjs`. Set `VYO_CHROMIUM` to use another Chromium.

| Poster | Shape | Accent |
|---|---|---|
| `out/pantry-light.png`, `out/pantry-dark.png` | A jar, `shapes/jar.json` | the plan (8.4% of lines) |
| `out/hypher-light.png`, `out/hypher-dark.png` | A paper plane, `shapes/plane.json` | the handoff note (18.3%) |
| `out/x-depth-donut.png` | A tilted ring with a tail, inline in its config | the plan, as a shell |

The donut is a format test, not one of the four posters. It exercises `tilt`, `cut`, a `capsule` and `strata.by: "depth"`.

## The config

| Key | What it is |
|---|---|
| `facts` | Path to the scan's facts file, relative to the config |
| `product`, `commit`, `date` | The label and the record line. The engine would fill commit and date itself |
| `theme` | `light` or `dark`, the skill's theme tokens unchanged |
| `headline`, `legend` | The words. The legend names the accent part by its plain name |
| `accent`, `names` | Part id of the accent, and a plain name for every part id from `vyo parts` |
| `shape` | A shape object, or a path to a shape JSON file |
| `type` | Optional, `{ "size": 6, "leading": 1.04 }` |

## The shape format

A shape is a list of primitives in any coordinates you like, with y pointing down. The engine measures what you drew and scales it, so a viewBox never has to be declared.

```json
{
  "parts": [ { "<kind>": <geometry>, "op": "add|cut|crease", "face": "round|lit|dim", "rotate": 0, ...kind options } ],
  "fit": { "box": [x, y, w, h], "align": "center|left|right|top|bottom|top left|..." },
  "tilt": 0,
  "bevel": 0.25,
  "strata": { "by": "angle", "angle": 90 } | { "by": "depth" },
  "bleed": false
}
```

The primitives:

| Kind | Geometry | Options |
|---|---|---|
| `circle` | `[cx, cy, r]` | |
| `ellipse` | `[cx, cy, rx, ry]` | |
| `rect` | `[x, y, w, h]` | `r` corner radius |
| `capsule` | `[x1, y1, x2, y2]` | `r` half thickness (round ends) |
| `line` | `[x1, y1, x2, y2]` | `width` when used as add or cut; a crease needs none |
| `polygon` | `[[x, y], ...]` | |
| `arc` | `[cx, cy, r]` | `from`, `to` in degrees (0 is 3 o'clock, clockwise), `width` |
| `path` | an SVG path string | |

These rules apply to every primitive:

- Primitives draw in order. `add` (the default) fills, `cut` erases what is under it, and `crease` draws the primitive's edge as a fold line in the relief (a `line` or `capsule` creases along its centre line). A crease never changes the silhouette.
- `rotate` turns one primitive about its own centre, and `tilt` turns the whole shape.
- `face: "lit"` or `"dim"` makes an added primitive a flat facet turned toward or away from the light. The default, `round`, bevels it off the outline. Later adds win where they overlap.
- `fit.box` is in sheet pixels (840x1190), and the shape is scaled uniformly into it. The default is the whole sheet less 40px margins. The engine fits the bounds of what survives the cuts, not the bounds you typed.
- `bevel` is the fraction of the shape's half short side that is rounded. 1 is a full cylinder or dome, and 0.2 is a flat top with soft edges.
- `strata` decides how the area is split. `angle` stacks the parts along a direction (90 is top to bottom, 0 is left to right, 135 is from the top right toward the bottom left). `depth` makes the parts shells, from the outline in. Parts always go in the scan's tree order.

### Example: Pantry, a jar

The parts stack from lid to base like layers of preserves. Two creases ridge the lid, a 10px cut separates the lid from the neck, and a creased rounded rectangle is the label.

```json
{
  "parts": [
    { "rect": [120, 0, 360, 110], "r": 22 },
    { "rect": [160, 100, 280, 70], "r": 8 },
    { "rect": [20, 150, 560, 650], "r": 150 },
    { "line": [100, 114, 500, 114], "width": 10, "op": "cut" },
    { "line": [140, 37, 460, 37], "op": "crease" },
    { "line": [140, 73, 460, 73], "op": "crease" },
    { "rect": [100, 380, 400, 230], "r": 24, "op": "crease" }
  ],
  "fit": { "box": [40, 290, 760, 860], "align": "bottom" },
  "bevel": 0.9,
  "strata": { "by": "angle", "angle": 90 }
}
```

### Example: Hypher, a paper plane

Hypher passes a handoff note from one coding agent to the next. The plane is that note folded and thrown. It is two triangles that share the fold from the nose to the centre: the top wing is a lit facet, and the keel is a dim one. The parts run in bands across the plane, perpendicular to its flight.

```json
{
  "parts": [
    { "polygon": [[0, 350], [1000, 0], [450, 550]], "face": "lit" },
    { "polygon": [[450, 550], [1000, 0], [650, 1000]], "face": "dim" }
  ],
  "fit": { "box": [40, 330, 760, 820], "align": "right" },
  "bevel": 0.2,
  "strata": { "by": "angle", "angle": 135 }
}
```

## The rendering rule

The page rasterises the shape at 2px and takes exact Euclidean distance fields: inside to the outline, to every seam between strata, and to every crease. Height is a quarter-circle profile off the outline (radius set by `bevel`), plus a 12px pillow off each stratum seam, minus a valley along each crease. On a facet it is a plane tilted toward or away from the light. Each cell is lit by Lambert shading plus a small specular term, with the light from the upper left. The light is mapped so a flat top sits at mid-tone, then contrast-stretched 1.5x. A 6px Commit Mono glyph grid samples it. Ink density sets each glyph's opacity (0.3 to 1) and weight (700 above 0.42). The gaps between repeated names take `·` or `:` in the darker tones, and a 5px rim along the outline never falls below 0.6, so the silhouette holds where the light washes it out. Rows are set word by word. A word always runs to its end, and it goes to whichever part under it is owed the most cells so far (error diffusion), so names stay whole and each part's share of glyphs stays within 20% of its share of lines. The accent part is set in `hot`, bold, over a blurred halo of the same colour. Outside the shape, a faint dot grid carries a cast shadow down and to the right: darker dots on paper, missing dots on the dark sheet. The label, headline and legend are placed as one stack by searching every position. The largest headline size that fits wins, then the position nearest a sheet corner, at least 26px from the form. The record line goes at the bottom left or right, or rotated up the left edge.

The page reports these as problems: a part that never shows its whole name, a part whose glyph share is off by more than 20% (at least 0.6 points), a shape touching the sheet edge without `bleed`, and no room for the words or the record line.

## What failed along the way

1. **Round 1, a 60px bevel and alpha down to 0.07.** The lit side vanished into the paper. The jar lost its lid and the plane its lower half. A relief needs a tone floor and an outline that never fades.
2. **A cast shadow drawn with `:` glyphs.** It read as a hairy fringe, not a shadow. Dots only, offset further, look like a shadow. On the dark sheet the shadow first brightened the paper, because the dots are ink-coloured. It now removes dots instead.
3. **A pillow radius that scaled with the bevel.** A full-cylinder jar gave every stratum a 60px dome, and the poster became horizontal stripes with no volume. Capping the pillow at 12px brought the cylinder back.
4. **Paper plane as one rounded mass.** A distance-field bevel cannot draw a fold. The plane read as a bird. `face: lit|dim` facets made it a paper plane at once, and that was the biggest single gain in recognisability.
5. **Diagonal strata.** Bands at 135° cut words mid-name ("helpenpieces"). Snapping each word to the part under its first letter fixed legibility, but it skewed areas by up to 50% for small parts. The new glyph-share check caught it. Error diffusion fixed it. The same check also catches the bias in `depth` shells, which first gave the accent 5.1% of glyphs for 8.4% of lines.
6. **Name-internal spaces took the tone ramp**, so "recipe book" printed as "recipe:book". Only the gap between repetitions takes a ramp glyph now.
7. **Growing the plane into the empty top right** moved the words to the bottom left and left the top bare, because the plane is limited by width, not height. The placer scores all four corners alike. It needs a reading-order preference for the top left.

## How hard it was to author blind

The jar took three tries, and only because its parts were near-rectangles with numbers I could reason about. The first version had a lid barely wider than the neck. That was invisible once lit, and nothing in the JSON told me so. The plane geometry looked right as numbers. As a rounded mass it read as a bird or a wedge, and no amount of moving points would have fixed it, because the problem was the rendering of the form, not its outline. The most useful lesson is that the silhouette is not the hard part. The hard part is whether the details that make it recognisable (a lid step, a fold, a label) survive the lighting, the type texture and 1/6 scale.

An agent authoring blind would need these:

- **A silhouette preview at thumbnail size, before any type.** That means the mask as ASCII at about 40 columns, with creases and facets marked, plus the fitted box in sheet pixels. Most of my failed rounds would have shown up there.
- **Feature-size checks.** A cut or step narrower than about 3% of the shape's short side disappears at 280px, so warn on it. Warn too when a crease falls within the bevel where it cannot read.
- **The checks this prototype has.** A whole name per part, glyph share within 20% of line share, shape off the sheet edge, room for the words. Each carries the number that failed.
- **A tone histogram of the thumbnail.** It catches "the lit side vanishes" (too much of the form within 10% of paper) without anyone looking.
- **A small library of worked shapes.** Jar, plane, key, bowl, house, speech bubble, as patterns to adapt rather than invent from zero.

## What the real engine would need

- A `shape` field module in `tools/lib/fields/` that takes the shape object. Its `layout` returns glyph cells (x, y, char, part, tone, weight), not rows, so `sketch` and the page share one geometry. The shading here is pure arithmetic on a grid, so it can run in Node. Rasterising the primitives is the only browser dependency, and it would need a small scanline rasteriser for circles, round rects, capsules, polygons, arcs and flattened SVG paths.
- `vyo sketch` for a shape. It prints the mask at 1/6 scale with tone characters (`·:-=+*#`), the strata boundaries, the accent cells as `@`, and the text stack. That is the browserless preview the agent needs before the first render.
- Spec validation at the boundary: one kind per primitive, `op` and `face` enums, finite numbers, polygons with at least 3 points, a non-empty mask after cuts, `fit.box` inside the sheet unless `bleed`.
- The two strata checks above, as `✗` lines in `check.mjs`. Add a `!` line when the accent's glyph share is under about 5%, since the accent must be the first thing seen.
- Corner search shared with `compose`. The stack placer here is a brute-force search over an integral image. It should prefer the top left and keep a gap from the form that scales with the headline size.
- One new theme token would help the light theme: `shade`, a deep cool ink (around `#2A3446`) for the shadow side. On paper the form's dark half is pure ink and the light half is grey, which reads flatter than the dark theme. The dark posters are clearly the stronger pair.

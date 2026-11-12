# Shape field, direction B: scale (throwaway)

One silhouette the agent invents for the product, set huge and cut into one horizontal band per part. The type size in each band encodes the part's lines of code, so the form is built from a few enormous words down to 5px texture. The accent part is a solid band of the accent colour. The loose frame (label, headline, legend, record line) sits in the room the shape leaves.

| Poster | Shape | Light | Dark |
|---|---|---|---|
| Pantry (recipe planner) | a jar, tilted 9 degrees, bleeding off the bottom | `pantry-light.png` | `pantry-dark.png` |
| Hypher (handoff note for coding agents) | two arrows passing each other, bleeding off both sides | `hypher-light.png` | `hypher-dark.png` |

Each PNG is 1680x2380 (the 840x1190 sheet at 2x). Each has a `-thumb.png` beside it, 280px wide.

Regenerate one poster:

```bash
node render.mjs pantry.json --theme dark
```

The script needs Playwright (`VYO_CHROMIUM` picks a Chromium binary) and reads the fonts and `tools/lib/parts.mjs` from `.cursor/skills/vyo/`. It prints an ASCII preview of the fitted shape, where each band falls and its type size, and the checks. A line starting `✗` fails the run and a line starting `!` is a warning. `recipe-facts.json` is a scan of `.cursor/skills/vyo/tools/test/fixtures/recipe`, copied here so the poster can be rebuilt.

## The shape format

The shape is a list of filled primitives in a free viewBox. They are painted in order: a primitive adds to the shape, and a primitive with `"cut": true` removes from what is painted so far. The engine measures the real extent of the result, so primitives may stick out of the viewBox, and then fits that extent to the sheet.

```jsonc
"shape": {
  "viewBox": [0, 0, 100, 130],        // any units; only proportions matter
  "rotate": 9,                        // optional: turn the whole shape (degrees, clockwise) about the viewBox centre
  "fit": { "h": 0.9, "cx": 0.52, "cy": 0.64 },
  "parts": [
    { "rect": [x, y, w, h], "r": 3 },          // r rounds the corners
    { "circle": [cx, cy, r] },
    { "ellipse": [cx, cy, rx, ry] },
    { "capsule": [x1, y1, x2, y2, r] },        // a stadium from one point to another, r wide on each side
    { "polygon": [[x, y], [x, y], ...] },
    { "arc": [cx, cy, r, from, to], "width": 8 },  // a thick arc; angles in degrees, 0 is up, clockwise
    { "path": "M0 0 L10 0 ..." },              // SVG path data, for anything else
    { "circle": [50, 50, 10], "cut": true }    // any primitive with cut removes area
  ]
}
```

- `fit.w` and `fit.h` are the shape's width and height as a share of the sheet's. Over 1 bleeds off the sheet. With both, the smaller scale wins. With neither, the shape fills 90% of the sheet.
- `fit.cx` and `fit.cy` place the centre of the shape's extent, as a share of the sheet's width and height. They default to 0.5.
- Any primitive takes `"rotate": deg` about its own centre. A `path` turns about `"origin": [x, y]`, or the viewBox centre without one.

### The two shapes

Pantry's jar is a lid, a neck and a body with round corners, turned 9 degrees so that the top-left corner holds the headline and the room beside the lid holds the legend:

```json
"shape": {
  "viewBox": [0, 0, 100, 130],
  "rotate": 9,
  "fit": { "h": 0.9, "cx": 0.52, "cy": 0.64 },
  "parts": [
    { "rect": [16, 0, 68, 16], "r": 3 },
    { "rect": [22, 15, 56, 9] },
    { "rect": [4, 22, 92, 108], "r": 24 }
  ]
}
```

Hypher's two arrows pass each other ("switch agents"). Their shafts run off the sheet, so `fit.w` is set wide enough that the viewBox's 0 to 100 lands just inside the sheet's edges:

```json
"shape": {
  "viewBox": [0, 0, 100, 100],
  "fit": { "w": 1.52, "cx": 0.5, "cy": 0.6 },
  "parts": [
    { "rect": [-30, 9, 94, 28] },
    { "polygon": [[58, -4], [100, 23], [58, 50]] },
    { "rect": [36, 59, 94, 28] },
    { "polygon": [[42, 46], [0, 73], [42, 100]] }
  ]
}
```

The rest of the config is the loose frame's words: `product`, `commit`, `facts`, `headline`, `legend`, `accent` (a part id from `vyo parts`) and `names` (part id to plain name). An optional `scale` object overrides `gamma` (default 2.4), `min` (default 5px) and `gap` (default 3px between bands).

## The rendering rule

The shape is rasterised at sheet size and cut top to bottom into one band per part, in tree order, where each band's covered area is the part's share of the lines. No band is less than 8px tall. The biggest part sets its name in one line as tall as its band. Every other part's type size is that size times (its lines / the biggest part's lines) to the power 2.4, never under 5px, and its band takes as many lines of that size as fit. A band with one line shrinks its type until one whole name fits across the shape, so the largest word stays readable. Each band is filled with the ink token and its name repeated in the paper token, with odd lines shifted by half a word. The accent band is filled with the accent and set in a new token, `onHot` (the light theme's ink, `#161616`, on both themes, because paper type on orange looked washed out on light and navy on orange read the same as ink). On dark, the shape is a near-white silhouette with navy type. The label and headline take the largest headline size that still leaves room for the record line and then the legend, each clear of the shape by 26px.

## What failed along the way

1. **An upright jar.** It filled the width, so the legend had nowhere to go. The only clear corners were beside the lid, 80px wide. Turning the jar 9 degrees freed the top-left and top-right corners and made the poster less static.
2. **Type that barely varied in size (gamma 1.6).** Pantry's parts are between 4% and 19% of the code, so nearly every band got one line at 70 to 115px and the poster read as a stack of equal stripes. At 2.4, the biggest parts stay huge and the middle ones drop to two or three lines, which gives the scale contrast.
3. **"scree".** Set to fill its band, "screens" was 237px and only five letters showed. At thumbnail size it read as a typo. One-line bands now shrink until one whole name fits.
4. **Rounded line counts.** Rounding the line count gave 4.7px and 3.5px type in some bands. The count now rounds down, and a minimum band height of 8px stops a 0.8% part from disappearing.
5. **The minimum band height broke the encoding.** An 8px band for "core" (370 lines) got 9px type, bigger than "mac app" (1,470 lines) at 5px. A small part stretched to the minimum height now keeps its small type.
6. **The arrows, first pass.** The shafts were thin, the gap between the two arrows was wide, and the shape covered 32% of the sheet. At `fit.w` 1.72 the arrow tips ran off the sheet, which made them read as bars. Thicker shafts, interlocking heads and `fit.w` 1.52 fixed both.
7. **Greedy text layout.** The headline took the largest size that fit anywhere, which left no room for the legend (Pantry), or pushed the record line up the right edge of the sheet (Hypher). The headline, record line and legend are now placed together, and the headline shrinks until all three fit.

## How hard it was to author a silhouette blind

Writing the primitives was easy. Writing a jar or an arrow as rectangles and polygons in a 100-unit box worked on the first try, and the ASCII preview confirmed the outline before any PNG was opened. The hard part was everything the coordinates do not show:

- **Where the text goes.** The first jar was a good jar and a bad poster, because the shape decides where the headline and legend can sit. I could not predict that from the numbers. It took a render and a look.
- **How the bands fall.** Bands are cut by area, so a thin part of the silhouette (an arrow tip, a jar neck) becomes a tall band for a small part. In Hypher, "web pages" fills both arrowheads' tips with 5px texture, which works, but I did not plan it. One part can also be split across two pieces of the shape.
- **Bleed.** Primitives that run off the sheet change what "fit" means. The arrows needed a `fit.w` worked out by hand so that the tips landed just inside the edges.
- **Recognition at thumbnail size.** The jar reads as a jar only because of the lid and the shoulders. A body alone would read as a box. Nothing in the format warns about this.

An agent authoring blind needs these things, in order of value:

1. **An ASCII preview, before any render,** with the accent band marked (render.mjs prints one, 42x60). It catches an empty shape, a shape off the sheet, and a shape with no room for text.
2. **Numbers on the fit:** the share of the sheet covered, which edges it bleeds off, and each band's height and type size. "Covers 32%" told me the arrows were too thin before I looked at them.
3. **Layout checks that fail loudly:** no room for the headline, record line and legend together; a band under the minimum type size; an accent band under 40px, which vanishes at thumbnail size.
4. **The 280px thumbnail, looked at.** Whether a silhouette reads as a jar cannot be checked in code. The agent has to open the thumbnail and say what it sees, and the skill should require that.

## What the real engine would need

- **A `shape` field module** beside wave, terrain and river, with this format parsed in Node at the spec boundary. The parser should reject a part with no primitive or two primitives, a polygon with fewer than 3 points, and a fit that leaves the shape off the sheet.
- **A browserless rasteriser for `vyo sketch`.** Everything here uses canvas `Path2D`. Sketch would need a small scanline fill of the same primitives (polygons, plus arcs flattened to segments) so the ASCII preview, band cut and corners are the same in Node and in the page. Arcs and SVG paths are the costly part. A first version could flatten `path` to polygons with a tiny parser or leave `path` out.
- **Band cutting and type sizes as a pure function** (`rows: number[]` of covered pixels per row, parts in, bands with `y0`, `y1`, `lines` and `size` out), shared by sketch and the page like `fields/*.mjs` today.
- **Corners from the raster.** The loose frame's corner finder works on field rectangles. Here it would run on the shape's occupancy grid, dilated by the clearance, and place the headline, record line and legend together, as `render.mjs` does.
- **In-page checks:** text clear of the shape, every band at least 5px type, the accent band at least 40px tall, the record line on a clear edge, and the share of the sheet covered (warn under 35%: the direction is "huge").
- **One new token, `onHot`,** for type on the accent fill.
- **Skill text for the agent:** pick an object the story is about, draw it in 3 to 6 primitives, keep one distinctive feature that makes it recognisable (the jar's lid and shoulders, the arrowheads), leave one corner clear for the headline, then sketch, render and look at the thumbnail.

# Spin: punk covers that turn in space

A throwaway prototype. The codebase's silhouette becomes a solid, the solid turns, and the cover around it stays fixed.

```bash
node render.mjs                      # every config in configs/, then the series
node render.mjs configs/1-pantry.json
```

Each cover writes `out/<id>.png` (840 by 1190 at 2x, the best frame), `out/<id>-thumb.png` (280px), `out/<id>.mp4` (840px) and `out/<id>.gif` (560px), plus `out/<id>-report.json` with every frame's checks. Two or more configs also write `out/series.png`, `out/series.mp4` and `out/series.gif`: the covers in a row, moving together. A cover takes 11 to 19 seconds.

## The rule

The agent draws one object in vyo's `shape` ops, or traces it from a PNG. The engine extrudes it into a slab, or revolves it about its centre line, and samples the surface every 1.5px. It spins the solid one full turn about its vertical axis, tilted toward the viewer and leaning 8 degrees, in 96 frames at 12 fps, so the loop closes on itself. Each frame keeps, per 6.3 by 10.5px cell, the nearest surface point. The visible cells are then cut top to bottom, in tree order, into the parts by their share of the lines. The claim "each part as big as its share of the code" therefore holds in every frame, glitched frames included, to within 0.1 points. Faces carry the parts' plain names and walls carry marks (`# + :`), and nearness sets the weight: near cells are bold and large, middle cells regular, far cells small. Every glyph is one of three flat colours: ground, ink and signal. Signal marks the accent part and is always bold. Every 24 frames a beat lasts three frames. Slices slip sideways, one slice burns into an ink bar, the next frame drops back to an old pose, then the form tears in two and snaps back. The giant name slips with it.

## The template

All four covers share it:

- Top left, three lines the engine counts: lines, files, parts.
- Top centre, the headline as a small stamped column.
- Top right, a reversed `VYO 01/04` stamp.
- Above the name, the legend in mono and a reversed record label.
- At the foot, the product name in Inter Display Black at -4.5% tracking, sized to run 34px off the right edge with its foot cut by the bottom edge.

Each stamp sits at its own small crooked angle and jitters on the beat.

## Config

```jsonc
{
  "facts": "../facts/pantry-facts.json",   // a vyo scan, relative to the config
  "product": "Pantry",                    // record label; "name" overrides the giant word
  "number": "01/04",
  "commit": "04186f4", "date": "2026-11-11",
  "headline": "A week of dinners, planned in one go from the recipes you already cook.",
  "legend": "Every band of the fork is a part of Pantry, as big as its share of the code. The white band is the plan.",
  "accent": "area:lib/plan",              // one part id from `vyo parts --field shape`
  "names": { "area:lib/plan": "the plan", "...": "every part, plain" },
  "ground": "#FF5B14", "ink": "#0E0E0E", "signal": "#F4F1E8",
  "shape": { "ops": [ /* vyo shape ops in a 100-unit box */ ] },   // or { "mask": "path.png" }
  "solid": { "kind": "extrude", "depth": 0.12, "tilt": -16, "lean": -8 },   // or "revolve"
  "seed": 1                               // moves the glitch slices and the stamps' angles
}
```

The parts come from `regionParts` with the shape field's options. The mask comes from `shapeMask` and `maskGrid`, with `png-mask.mjs` loaded for traced shapes. Before it draws, the renderer refuses a part with no plain name, an accent that names zero parts or more than one, and a legend that does not name the accent part or the measure (code or lines).

## The series

| Cover | Object | Solid | Ground, ink, signal | Accent |
|---|---|---|---|---|
| Pantry (recipe fixture) | fork, 3 tines | extrude 0.12 | safety orange, black, paper | the plan, 8% |
| Hypher | plug | extrude 0.22 | xerox black, paper, hot pink | handoff note, 18% |
| Flask (pallets/flask) | lab flask | revolve | acid yellow, black, blood red | request core, 25% |
| Express (expressjs/express) | lightning bolt | extrude 0.16 | hot pink, black, paper | the router, 58% |

## What failed, in the order I hit it

1. **Picking the still by readable names alone.** It chose near edge-on frames, where the walls fill the view, so the fork and the plug read as strips. The still now comes from frames within 35 degrees of face-on or back-on, ranked by readable names and then by letter cells.
2. **Giving each part a fixed band of the solid's surface.** That is honest about the solid but not about the picture. Edge-on, the walls dominate, and a wall's size follows the outline's length, not the area. The fork's tines took 9.4 points more than their share. Cutting the visible cells per frame fixed it everywhere.
3. **Letters on walls.** Seen at 20 degrees, a tine gap's side wall faces the viewer enough to print letters, so the gaps filled with scrambled text and the tines merged into a heart. Walls now print marks only, so a gap stays a gap.
4. **Text anchored to the surface coordinate.** The surface is sampled at 1.5 to 3px but a glyph is 6.3px wide, so neighbouring cells rounded to the same letter ("sevvrrsserver"), and turned faces dropped letters. Each row of text is now anchored at the screen column of its surface's origin line. The names slide with the face as it turns but never squeeze, and readable names went from 3/6 to 6/6 on the flask.
5. **Horizontal marks on walls.** Edge-on, the `=` walls drew the form as a stack of horizontal bars, too close to the rejected slab look. Walls now use `# + :`.
6. **A mark on every face cell of a cone.** The revolve's slope term was missing its division by the cell size, and a 1.5px step in the profile counted as a ledge. Both left `#` chunks inside the flask's body.
7. **Tight tracking at -6%.** Neighbouring letters of the giant name touched and left hairline seams. Now -4.5%.

## What an agent supplies, and the feedback it needs

The agent supplies the object, as ops or a mask. It also supplies extrude or revolve, the depth, the three colours, the accent, the plain names, the headline and the legend. The feedback that mattered, all of which the page already measures:

- **Readable names per part in the chosen still.** Some names never read whole. A part too small to hold its name gives a reason, as Express's 9-line `entry` (0.2%) does. A form too narrow for the name gives another, as Hypher's prongs did at 9 units wide: they fit at 14. The agent fixes those by widening a limb or shortening a name.
- **The worst share gap over all frames, and the smallest accent cell count.** These prove the legend in motion.
- **The seam step against its neighbours.** The cells that change from the last frame to the first, compared with the steps on either side.
- **A contact strip of frames.** The agent must see edge-on frames too, since that is where a weak silhouette dies.

## What the real engine needs to ship this

The engine already has the mask, the part cutting, the signal frame, checks that run in the page, and a GIF path that screenshots frames. It still needs these:

- **A `spin` look on the shape field.** The solid builder (extrude, revolve) and the per-frame projection with a depth buffer and an anchor per row live in the first half of `page.js`, about 200 of its 420 lines. The cutting of visible cells per frame belongs next to `regionParts`, as a pure function over a grid of cells.
- **A cover frame.** Stamped metadata, a reversed label, and a giant name that bleeds off the edge, sized by measuring. Inter Display has to be bundled; it is a system font here.
- **Frames from the canvas, not screenshots.** `toDataURL` per frame keeps a cover under 20 seconds. The GIF palette is fixed at 12 colours with no dither, since everything is flat.
- **Checks per frame instead of once.** The share gap, the accent's presence, readable names in the still, and the seam. The report JSON here is the shape that output could take.
- **A series command** that renders N covers on one template and tiles them, with a number per cover.

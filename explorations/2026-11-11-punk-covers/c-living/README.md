# Living (punk covers, direction C)

A throwaway prototype. It is the series of the tjcages reference (four covers on one template, a form in the middle that never stops moving), made from the relief look the owner already likes. Each cover has a flat ground, a fixed template, and the codebase's silhouette as a lit volume in 6px type that turns slowly under one fixed lamp.

```bash
node render.mjs                        # every config in configs/, then the series
node render.mjs configs/2-hypher.json  # one cover
KEEP_FRAMES=1 node render.mjs          # keep the PNG frames and print their folders
```

Each cover writes these files to `out/`:

- `<id>.png`: the still, 840x1190 at 2x, the best frame of the loop.
- `<id>-thumb.png`: the still at 280px wide.
- `<id>.gif`: the loop at 560px wide, 12 fps.
- `<id>.mp4`: the loop at 560px wide, 24 fps. MP4 files are not committed (see `../.gitignore`).
- `<id>-report.json`: every frame's checks.

With two or more configs, the run also writes `out/series.png`, `out/series.gif` and `out/series.mp4`: the covers in a row, moving together. The loop is 7 seconds, 168 frames. A cover renders in 20 to 56 seconds. Playwright must resolve (`VYO_CHROMIUM` can name a Chromium binary), `ffmpeg` must be on the path, and the Inter fonts are read from `/usr/share/fonts/opentype/inter`.

## The rule

The agent draws one object in vyo's `shape` ops (or traces a PNG). The engine inflates the silhouette into a solid: a dome off the outline's distance field, faces as plates tilted toward or away from the lamp about their fold, and creases as grooves. The solid swings on a slow ellipse, yawing up to about 34 degrees while it pitches a quarter turn behind. So it always turns but never goes edge-on, and the loop closes exactly. The lamp stays fixed at the relief's top left, so the shading travels across the form. Lit faces give their letters up to bold marks (`+ = : ·`) and the brightest cells thin out. Middle faces carry the part names. Faces turning away fade toward the ground, down to a floor that keeps the silhouette. In every frame, the visible cells are cut into the parts along the strata by their share of the lines. Each row is then set word by word from an anchor that turns with the form, so the names ride the surface and never squeeze. The accent part prints in the one accent colour over a tight glow. The staggered edges come only from the type grid meeting the turning surface.

## The template

The template is the same on every cover, in CSS px on the 840x1190 sheet with a 44px margin:

- Top left, in 11.5px Inter Medium, are two small columns. The first is the record, which the engine writes: the day, the commit, and the line and file counts. The second is the headline.
- Top right is the series number and the word Vyo, split by a hairline.
- The form fills the room between the top columns and the legend, sized to fit every pose of the loop.
- At the foot sit the legend, then the product name. The name is Inter Display SemiBold at 168px with -4.5% tracking, the same size on every cover, so "Flask" is short and "Express" nearly fills the width, as the reference's names do.
- Behind everything, a faint dot on every other glyph cell carries the form's cast shadow, which moves as the form turns.

## The config

```jsonc
{
  "facts": "../facts/pantry-facts.json",   // a vyo scan, relative to the config
  "product": "Pantry",                    // the name at the foot and in the record
  "number": "01/04",                      // series number, top right
  "commit": "04186f4", "date": "2026-11-07",
  "headline": "A week of dinners, planned in one go from the recipes you already cook.",
  "legend": "Every band of the pear is a part of Pantry, as big as its share of the code. The orange band is the plan.",
  "accent": "area:lib/plan",              // one part id from `vyo parts --field shape`
  "names": { "area:lib/plan": "the plan", "...": "every part, plainly, at most 24 characters" },
  "split": [],                            // optional, passed to partsFromFacts
  "palette": { "ground": "#EAE8E2", "ink": "#161616", "accent": "#FF4F12" },
  "shape": { "ops": [ /* vyo shape ops in a 100-unit box; "face": "lit"|"dim" and "crease" work */ ] },  // or { "mask": "thing.png" }
  "strata": { "by": "angle", "angle": 90 },   // or { "by": "depth" }: shells from the outline in
  "solid": { "bevel": 1, "depth": 0.9, "tilt": 0.45, "groove": 12 },
  "turn": { "yaw": 34, "pitch": 12, "lean": 0 }
}
```

`solid.bevel` is the relief's bevel, the share of the deepest point that is rounded. `depth` scales the dome's thickness: 1 is round, 0.5 is a lozenge. `tilt` is how steeply face plates rise from their fold, and `groove` is a crease's width in px. A dark ground switches the relief's dark tones on (letters ink the light, the accent glows), and a light ground switches on the paper tones.

The renderer refuses to draw when a part has no plain name or a name is over 24 characters, when the accent names zero parts or more than one, or when the legend does not name the accent part and the measure. It imports `shapeMask`, `maskGrid`, `edt`, `opRings`, `opKind` and `paintRows` from `tools/lib/mask.mjs`, `regionParts` from `tools/lib/parts.mjs`, and `RELIEF` and `RELIEF_TONES` (type size, leading, lamp, contrast, glow and dot tones) from `tools/lib/fields/shape-relief.mjs`. The page's dome, word setting and glyph tones follow `reliefSurface` and `reliefStyle` but run per frame on a turned solid, so they are re-written in `page.js`, not imported.

## The palette

These are four grounds. Three are the engine's own; one is added. Each has one ink and the engine's orange.

| Cover | Ground | Ink | Accent | Why |
|---|---|---|---|---|
| Pantry | paper `#EAE8E2` | `#161616` | `#FF4F12` | The engine's light theme as is. It gives the series its one light cover, as the reference's cream cover does. |
| Hypher | navy `#0E1424` | `#ECEEF2` | `#FF5A1F` | The engine's dark theme as is: the ground of the loved plane poster. |
| Flask | charcoal `#121212` | `#F4F0E6` | `#FF5A1F` | The signal frame's charcoal, a step off black, with its warm paper ink. The lime is replaced by the orange. |
| Express | forest `#14281F` | `#E8ECE4` | `#FF5A1F` | Added. A deep, grey-green ground at the same depth as the navy. It answers the reference's green cover without its saturation. The ink is cooled to sit on it, and the orange reads clearly against green. |

In a row, the series reads as one light ground and three darks of different hue but equal weight: black, blue and green. That is the reference's arrangement in quieter colours. A second added ground (an oxblood or an ink blue) was not needed; ink blue sits too close to the navy, and the orange accent goes muddy on oxblood.

## The series

| Cover | Object | Solid | Strata | Accent |
|---|---|---|---|---|
| Pantry (recipe fixture, rescanned) | a pear with a stem and leaf | round, `depth` 0.9 | top to bottom | the plan, 8.4% |
| Hypher (`hypher-facts.json`) | the paper plane of `docs/posters/relief-hypher-dark.png`: a lit wing and a dim keel | plates folded about the crease, `tilt` 0.45 | 135 degrees, as the poster's | the handoff note, 18.3% |
| Flask (pallets/flask) | a round-bellied flask with a cap and a debossed label | round, `depth` 1, label groove | top to bottom, so the request core settles at the base | the request core, 25.4% |
| Express (expressjs/express) | a stopwatch with its crown, side button and one hand as a groove | a disc, `depth` 0.65 | by depth: rings from the case in | the example apps, 27.4% |

## What the run checks

Every check prints, and a line starting with `✗` fails the run.

- **The share gap in every frame.** The gap is each part's share of the printed glyphs against its share of the lines. The worst over the loop is 0.1 to 0.6 points across the four covers, and the run fails above 1 point.
- **Whole names in the still.** Every part of 2% or more must print its whole name at least once in the still. All four covers print all of them: 12/12, 11/11, 4/4 and 6/6. The table also gives the fewest whole names in any frame of the loop.
- **The accent.** The accent part must be the one the legend names, which is checked before drawing. Its glyph count must stay above zero in every frame. The fewest is 874 on Pantry.
- **The seam.** This compares glyph changes from the last frame to the first with the steps inside the loop. On every cover the seam step falls within the range of the inner steps; on Flask it is 17,212 against an inner largest of 16,926, inside the run's 5% tolerance. The step size follows the turn's speed, and frame 0 is the fastest point. The pose is periodic in time, so frame 168 is frame 0 exactly. Looking at frames 166, 167, 0 and 1 shows the same one-column slide at each step.
- **Part flips per step.** This counts cells drawn in two consecutive frames whose part changed. It measures flicker apart from the intended crawl of the names. The median is 136 to 1,220 per step, out of about 7,600 (Hypher) to 17,000 (Flask) drawn cells.
- **GIF size.** Each GIF must be under 8 MB. They are 2.3 to 6.6 MB, and the series GIF is 5.5 MB.

## What failed, in the order I hit it

1. **Cutting the strata cell by cell.** It was honest to 0.0 points, but thin strata such as web pages (3.8%) and requests (3.2%) on a 135 degree diagonal only ever got runs of one to three cells. Their names never printed whole, and the seams read as letter soup ("heerver").
2. **The relief's own word setting, error diffusion over the whole frame.** It printed every name whole and held shares to 0.2 points. But it flipped about a tenth of the cells to another part every frame (1,430 against 390 for a local choice), because one changed cell changes every word after it. A decayed debt (0.8, 0.95) did not help. Resetting the debt per row was calm, but long names overran their strata, and the accent drifted 3.5 points over its share.
3. **Moving the seams until the shares came out right.** Choosing a word by majority responds in jumps: a stratum narrower than half a word never wins, and once wider it wins whole words. So the correction oscillated, and damping only brought it to 1.6 points. What works is local majority words plus a final trade of whole words at the seams. A word moves from a part over its share to a neighbour under its share that owns some of its cells, best owned first. The seam iteration added nothing on top of that trade and was deleted.
4. **Thinning every lit face to marks.** On a dark ground a wide sparse patch reads as a hole or damage, not light, and the shading looked backwards. On paper the `·` marks were the sheet's own dot glyph, so the lit side dissolved into the sheet. Now lit faces give letters up to bold marks, only the brightest few percent thin out, and paper uses `:` for the brightest.
5. **Letting the far side drop out.** The plane's keel tip broke into garbled fragments. Since the turn never goes edge-on, the visible surface keeps a floor of 0.45.
6. **The relief's glow at full width on a 25% accent.** It read as an orange haze over the form. The glow is now 0.7 of the relief's width and alpha, and it falls further for an accent over 15% of the code. It also sits only under letters, not marks.
7. **A flat flask.** With a low dome, most of the body faced the viewer at one tone, and the names stacked into columns. That came close to the rejected bands of repeated words. A rounder dome (`depth` 1) gives every row a gradient.
8. **The still at the far end of the turn.** That pose shows the most volume but the least of the silhouette (the pear's lit side read as missing). The still is now the frame closest to 55% of the turn among those that print every big name.
9. **A thin accent ring on Express.** The pages example (6%) under depth strata is too narrow for whole words except at its top and bottom. The trade scattered its words across the dial, and without the orange case the stopwatch lost its outline. The accent went back to the example apps.
10. **24 fps GIFs.** The crawling names took Flask past 9 MB. The GIFs now take every other frame, and the MP4s keep all of them.

## Ranking, frankly

1. **Hypher.** This is the strongest cover. Beside `docs/posters/relief-hypher-dark.png` it holds up as a still: the same clean plane and staggered strata, a tighter glow and a fuller wing. It is a little smaller, because the template takes room. In motion the fold is real: the lamp crosses from the wing to the keel, and the accent dissolves into marks when the wing faces the lamp. Its weakness is a few broken words near the keel's tip.
2. **Flask.** It has the best sense of volume: a round body with a falling edge, a label panel that catches the lamp, and the request core settled at the base like a liquid. Its weaknesses: the object reads as a round bottle more than a hip flask, the body is dense enough to read heavy, and it is the slowest render (56 s).
3. **Express.** The stopwatch reads at once, and the dial's gradient turns convincingly. But the accent is the whole case (27%), which is more orange than one band should be, and the glint on the dial still shows as a dark speckled patch. Depth strata also flip the most cells per step (median 1,220), so its edges shimmer more than the others.
4. **Pantry.** The pear reads, and the plan sits at its base. Paper is the hardest ground for this look: the lit side stays pale, and the glint is a column of colons. At thumbnail size the accent's glow turns the orange toward salmon.

## What an agent supplies, and the feedback it needs

The agent supplies the config: the object in 3 to 6 ops, faces and creases where the outline cannot show the form, the strata direction, the solid's bevel and depth, the accent, a plain name for every part, the headline, the legend, and a palette row from the table above. The feedback that mattered, all of which the run prints or writes:

- **The part table.** Each part's lines, its share of the glyphs in the still, its whole names in the still, and the fewest whole names in any frame. A zero means a stratum too thin for its name: turn the strata, fatten the limb, or shorten the name.
- **The share gap and part flips.** A high flip count means words cross many seams (depth strata, thin parts), so the form shimmers.
- **A contact sheet of six poses.** The most turned poses show whether the silhouette survives and whether the lit side reads as light or as a hole. The script is `ffmpeg` over the kept frames, as in `KEEP_FRAMES=1`.
- **The still beside the thumbnail.** It answers the usual vyo question: what one word names the silhouette at 280px?

## What the real engine needs to ship this

- **A turning solid for the shape field.** That means the dome, plates and grooves (`buildSolid` in `render.mjs`, about 100 lines over `mask.mjs`), the surface sampling with a filled rim, and the projection with a depth buffer per glyph cell (the first half of `page.js`). `reliefSurface` already computes the dome and the faces. It would return heights instead of light, and the light would move into the per-frame step.
- **Word setting that is honest per frame and calm over frames.** Local majority words plus the trade at the seams replace the error diffusion in `reliefStyle` for motion. The still could keep the error diffusion.
- **A cover frame.** Two small columns, the series mark, the legend over the name, the name at one size across a series. This needs a bundled grotesque: Inter Display SemiBold and Inter Medium are system fonts here.
- **Frames from the canvas.** This prototype uses `toDataURL` per frame and ffmpeg for the MP4 and the 12 fps, 32-colour GIF. A series command would render N covers on one template and tile them, as `series()` does.
- **The checks per frame, in the page.** These are the share gap, the accent's presence, whole names in the still, part flips, and the seam. The report JSON is the shape that output could take.

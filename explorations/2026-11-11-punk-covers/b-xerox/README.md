# Xerox (punk covers, direction B)

A series of covers on one template, after the tjcages reference (four small covers, one flat ground each, the same metadata and huge name, a form in the middle that never stops moving), made in the material of the photocopied gig flyer.

| Cover | Ground, ink, spot | Silhouette | Accent part |
|---|---|---|---|
| `out/pantry.*` | raw paper, black, safety orange | an apple with a leaf | the plan (8.4%) |
| `out/hypher.*` | blood red, black, acid yellow | a lightning bolt | the handoff note (18.3%) |
| `out/flask.*` | xerox black, paper, royal blue | a lab flask | the request core (25.4%) |
| `out/express.*` | acid yellow, black, hot pink | a fast-forward sign | the framework (57.7%) |

Each cover is a still `<id>.png` (840x1190 at 2x), `<id>-thumb.png` (280 wide), and a 3.2 second loop as `<id>.mp4` (840 wide) and `<id>.gif` (560 wide, about 2 MB). `out/series.png`, `series.mp4` and `series.gif` put the four in a row on paper, on the same frame.

Regenerate with `node render.mjs configs/pantry.json configs/hypher.json configs/flask.json configs/express.json --series`. It takes about 17 seconds a cover. Playwright must resolve, `VYO_CHROMIUM` can point at a Chromium binary, and `ffmpeg` must be on the path. `--keep-frames` keeps every frame in `out/.frames-<id>/`.

## The rule

The silhouette is cut into the codebase's parts, each as many cells as its share of the lines, and every cell prints by how its face turns to a lamp: lit faces drop out to dots and `: - + =`, flat faces spell the part's name, faces turned away go bold and then solid toner. Nothing outlines the shape; it is all density. The master has two plates, ink and one spot colour, and the spot plate is the accent part as a pixel block under its own name. Every frame photocopies the master: hard threshold to three colours, toner grain and dropout, the sheet cut into strips and pasted back off, the spot plate out of register, and over the loop the copy goes one generation worse at a time (softer, heavier, a touch larger and more crooked) until it snaps back to a clean master. Stop motion: 10 frames a second, the plates and strips held on twos, the grain new every frame, the lamp swinging and back by the end of the loop.

## The template

The same on every cover, measured in CSS px on the 840x1190 sheet:

- Top left, two columns of 9.5px mono: the record (name and commit, date, lines and files, part count) and the legend. A marker block in the spot colour sits over the commit and over the accent's name in the legend, so the words point at the colour.
- Top right, a rubber stamp in the spot plate: `VYO ARCHIVE`, the series number and the archive number.
- The form, fitted into the room between the metadata and the name.
- The headline as a one-line label, then the product name in Inter Display Black at -0.058em tracking, as wide as the sheet with a bite off the right edge and its foot cut off by the bottom edge. Its cap height is capped at 270px, so a short name does not swallow the form.

## The config

```json
{
  "id": "pantry",                       // output file names
  "facts": "../facts/pantry-facts.json", // a vyo scan, relative to the config
  "product": "Pantry",                  // the huge name
  "commit": "04186f4", "date": "2026-11-07",
  "archive": "014", "series": "01/04",  // the stamp
  "headline": "A week of dinners, planned in one go.",
  "legend": "Every patch of type is a part of Pantry, as big as its share of the code. The orange block is the plan.",
  "accent": "area:lib/plan",            // a part id from `vyo parts --field shape`
  "names": { "area:lib/plan": "the plan", "...": "every part, plainly" },
  "split": [], "maxParts": 12,          // optional, passed to partsFromFacts
  "ground": "#ECE8DC", "ink": "#141414", "spot": "#FF5A1F",
  "seed": 14,                           // strips, grain, slips, dust; same seed, same loop
  "strata": 278,                        // degrees: the direction the parts are dealt across the shape
  "swing": 70,                          // optional: how far the lamp swings, in degrees
  "bevel": 46,                          // optional: how wide the rounded rim is, in px
  "shape": { "ops": [ /* vyo shape ops */ ] }   // or { "mask": "wings" } or { "mask": "./thing.png" }
}
```

The shape is the vyo `shape` format, read by `tools/lib/mask.mjs` (`shapeMask`), so ops, `rotate` and a PNG `mask` all work; parts come from `tools/lib/parts.mjs` (`partsFromFacts`, `accentIds`), and the relief's distance field from `mask.mjs`'s `edt`. When the ink is lighter than the ground (Flask), the shading turns over: light ink prints the lit side, so the volume still reads lit from the top left.

## What the run checks

Every check prints; a line starting with `✗` fails the run.

- The legend names the accent part, and every part has a plain name of at most 24 characters that does not repeat the product's name.
- Each part's share of the cells against its share of the lines (they match to one cell, by largest remainder).
- Every part of 2% or more prints its whole name, in letters, at least once in every frame's master. A part under 2% that cannot is a `!` warning (Express's entry point, 0.2%). When the lamp hides a part everywhere, as on Pantry's leaf, the renderer prints its name in the slot nearest the part's middle, so the legend's promise holds.
- In every frame, after the copier, the spot colour still covers 75% to 130% of the accent's clean area, and the form's ink 70% to 140% of the clean copy.
- The loop seam: the step from the last frame back to the first changes no more pixels than the largest clean step inside the loop. On these four it changes 2.9% to 6.9% of pixels, inside the 2.2% to 8.6% of an ordinary step.
- Each GIF is under 8 MB.

## What failed

- **A frying pan for Pantry.** It read as a ladle, and its thin handle took the first parts in tree order, which had no room to print their names. An apple reads at thumbnail size, and its blush happened to be where the plan landed.
- **Diagonal strata.** Dealing the parts across the shape at 115 to 125 degrees gave thin diagonal bands, so most rows held only a few cells of each part and five of twelve names never printed whole. Strata within about 10 degrees of horizontal keep the runs long; the tilt and the shading keep them from reading as slabs.
- **Random name offsets in short runs.** A run that started mid-name needed the name's length plus the offset to print it whole. Short runs now start on the first letter.
- **Heavy toner fill.** Lowering the threshold 12 levels a generation clogged the type: the fourth copy had 150% of the clean ink. Five levels a generation with more grain keeps it between 82% and 111% across the four covers.
- **The copier on the metadata.** The 9.5px record and legend fell apart by the third generation. The metadata is now pasted fresh on every copy, as on a real paste-up, and only the form and the name lose generations.
- **The shading on a black ground.** With paper-coloured ink the solid rim printed on the shadow side and the flask looked lit from below. The classes now turn over when the ink is lighter than the ground.
- **The bundled wings mask** works as a shape, but its thin feathers fail the name check for seven of twelve Hypher parts. The check is right: that silhouette needs fewer, larger parts.

## What an agent supplies, and the feedback it needs

The agent writes the config: the silhouette (3 to 6 ops, fat rather than spindly), the strata direction, the accent part, a plain name for every part, the headline, the legend, and the ground, ink and spot from the palette. It needs four kinds of feedback, all of which the run prints or writes:

1. The part table, with each part's share and the fewest times its name prints in any frame. A zero means a limb too thin for the part dealt to it: turn the strata so a bigger part lands there, or fatten the limb.
2. The still and the thumbnail. The question is the same as for any vyo shape: what one word names the silhouette at 280px?
3. Three frames of the loop: a clean one, the worst copy, and the snap. A contact sheet (`ffmpeg -i out/.frames-<id>/f%03d.png -vf scale=220:-1,tile=8x4`) shows the whole loop at once.
4. The seam line, and the spot and ink ranges.

## What the real engine would need

The engine already has most of this. The mask, the parts and the distance field are imported unchanged. What it would need:

- **A `cover` frame** beside `loose`, `signal` and `swiss`: the two metadata columns, the stamp, the label and the cropped name. The signal frame's marks become the marker blocks, placed by the engine over the commit and the accent's name instead of by hand.
- **A `xerox` shape style** beside `relief`, `symbols`, `bands` and `rings`: the shading classes, strata and name slots, with the hidden-part labelling. The relief style already shades by a lit volume, so this is a different glyph table over the same height field.
- **Plates.** The renderer paints colour per element. The copier needs the sheet painted as two alpha plates (ink, spot) and composited at the end, which also gives overprint and misregistration for free.
- **The copier as a frame filter.** The GIF path screenshots frames; this needs each frame's plates as pixels, then the threshold, grain, strips and offset. Here that runs in the page on a canvas, under half a second a frame at 2x.
- **A `motion` kind `copier`**, with the timeline as data (generation, slip and misregistration per key, the snap, the still), instead of `nodes`, `resolve` or `wipe`.
- **Three checks in the page**: names printed whole per frame, spot and ink coverage against the clean copy per frame, and the loop seam. They are short and are in `render.mjs`.
- **The grotesque.** The package bundles Commit Mono and Newsreader. This prototype copies Inter Display Black (SIL Open Font License 1.1, The Inter Project Authors) into `fonts/`; the package would need to bundle it, or another grotesque that is just as tight, with its licence.

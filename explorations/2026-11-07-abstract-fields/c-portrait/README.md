# c-portrait: the project painted in its own code

After the owner's Portrait idea and the Vorflux moth. `node render.mjs` reads `../hypher-facts.json` and the source at /home/user/hypher, builds the band texts, injects them into `index.html` and writes `out.png` (840×1190 at 2x).

**Rule:** the sheet is cut into nine horizontal bands, one per major part of Hypher, each as tall as that part's share of lines and filled with that part's own identifiers, and one diagonal sweep drawn only by how many of those characters survive carries the mess (scripts, extensions, Mac app at the bottom left) up into the note (`hypher-web/shared`, at full ink, top right).

Bands, top to bottom: the note (shared), server (convex), inner workings, screens, marketing, CLI, Mac app, extensions, scripts. Each band is shifted sideways by how far its average file length sits from the mean, so the sweep's edge steps at every band boundary and the bands read as a bar chart. The last row of each band is left empty. The one hot row is a line of `shared/handoffNote.ts`, placed where the sweep crosses the note band. Grey tone falls from full ink (the note) to soft (scripts).

## Readability test

- Raw source lines at 3px (6 device px) **failed**: zoomed 4x, comments and strings read clearly ("pass as a user or system message"). Dropped.
- Now the texture is the file name followed by every identifier token, with comments and string literals stripped first. Zoomed, identifiers can be made out (`loadCredentials`, `timeoutMs`), no prose or literal survives.

## Tried and dropped

- A thin pencil-line sweep (pass 1): read as a scratch, not a field.
- Uniform gaussian edge: replaced by a sharp crest above and a long tail below, strands that fray the loose end, and a flare where the sweep becomes the note.
- Weight 400: too little ink at 1/6 scale; 700 at 3px holds.

## What the engine would need

A region kind `density-field` with: `bands` (list of {area globs, weight = loc}), `text` (`identifiers` | `binary` | `source`, with the comment/string strip), `glyph` (font, size, line height), `figure` (a centre curve, a width curve, crest/tail asymmetry, fray amount, flare), `band_shift` (a per-band data value mapped to x offset), `tone` (per-band ink, with the highlighted band at 1), `hot_row` (file whose line is drawn in the accent), `floor` (background density), and `seed`. Text blocks sit outside it as corner blocks.

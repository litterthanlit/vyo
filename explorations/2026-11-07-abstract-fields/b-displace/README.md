# b-displace: the constellation of parts

**Rule:** every row is "SWITCH AGENTS WITHOUT STARTING OVER", and the letters spread apart (up to 35 times their normal gap) inside one disc per major part of the code, each disc's area proportional to that part's lines and pulled closer to the parts it imports from.

Data: `../hypher-facts.json`. `render.mjs` groups `files` into parts (top folder, or second level under `hypher-web/`, `packages/`, `extensions/`), keeps parts with at least 3% of lines (six: main app, Convex, shared parts, CLI, scripts, the Swift app), and counts `imports` between them. The page runs a small force layout (discs never overlap; linked parts sit nearer, the more imports the nearer; the CLI and the Swift app import nothing across parts so they drift free), puts the lines-weighted centre right of middle so the biggest part bleeds off the right edge, then lays each row out by inverting a density integral: letters keep a constant phase, only their spacing changes. Letters inside an opening are orange.

Regenerate: `node render.mjs` (writes `out.png`).

## Tried and dropped

- Fitting the constellation to the sheet: the discs grew until they covered everything and the field became one wave with no centres.
- Small gaps between linked discs (34px): the openings merged into one blob. 64px plus fixed scale keeps each part a separate hole.
- A knockout clearing for "Hypher" inside the field: read as a box. The field now starts below the name.
- Looser base tracking (1.18 advance): too pale at 1/6 scale; 1.04 makes the dense rows dark enough for the holes to show.

## What the engine would need

A region kind `displace-field` with: `text` (the repeated row sentence), `font`/`size`/`leading`, `tracking`, `rowShift` (letters the sentence steps per row), `centres` (list of `{x, y, r}` or a `from: parts` binding that derives them from the scan: `minShare`, `scale` px per sqrt(line), `gap`, `linkPull`), `spread` (max gap multiplier inside a centre), `edge` (falloff exponent), `accent` (colour for letters where openness > threshold), and `bleed` (left/right/top/bottom). Plus a `rule` region kind that repeats one character across the width.

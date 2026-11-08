# The loose frame (wave and terrain, paper and dark)

The fields are the engine's current output, copied from `f-wave-paper/` and `e-terrain/` unchanged except colours read from the theme. Only the frame changed. `node render.mjs` writes `out-<name>.png` for all four; `node render.mjs wave-dark` renders one.

## The rules, in five lines
1. The field owns the sheet and bleeds off every edge it reaches; nothing is knocked out of it, and no type sits on it.
2. The only large type is the headline (Newsreader 42 to 44px), set in the biggest empty corner, ragged on the side that faces the field.
3. The product name is 13px mono caps alone in a corner; the parts list (plain names, one per line, mono 11px) hangs under it or in another empty corner.
4. Two short serif paragraphs (14px, two sentences each) float in two other empty areas, at different heights, never aligned with each other.
5. One record line, 10px mono, "Hypher at 7e1ff3a, 7 November 2026. Drawn by Vyo.", along the bottom edge or rotated up the left edge where the field leaves it clear.

The paper wave alone has the rule of Ls between its paragraph and its list, to compare with the dark wave without it.

## What the engine would need
- Text blocks: `brand` (product name), `headline` (the sentence), `about` (what the product does, two sentences), `legend` (how to read the field, two sentences), `parts` (list of plain names; the wave lists parts with at least three rows, the terrain all fourteen), `record` (one line: product at commit, date, "Drawn by Vyo."), optional `rule` (a character repeated to a width).
- Corners: rasterise the field to a coarse occupancy grid (say 20px cells), then find the largest empty rectangles touching each corner or edge. The headline takes the largest, `brand` + `parts` the next corner, `about` and `legend` the remaining empty rectangles at least 200 x 90px, placed so no two blocks share a top or left edge. Ragged side = the side nearer the field.
- Record line: try the bottom edge left of the field's footprint; if the field covers the bottom edge there, rotate it up the left edge at the lowest clear run of 300px. Fails loudly if neither is clear.
- Wave: no footer knockout any more. Terrain: theme tokens for ink, grey and accent as RGB, plus `lift` (alpha added on paper, .14) and `hotLift` (.5 on paper, .3 on dark), because the dark alphas wash out on paper.

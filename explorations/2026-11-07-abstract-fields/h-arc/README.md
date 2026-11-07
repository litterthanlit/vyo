# h-arc: one crescent

**Rule:** every row is "Switch agents without starting over", and the letters spread apart 16 times inside a single crescent whose outer radius is 1.95 times the square root of total lines (47,675) and whose thickest part is that radius times the square root of the handoff files' share (3,324 lines, 7%).

Letters on the crescent's inner edge are orange. The field sits in the upper two thirds, starts at x=138 and bleeds right and top. Below: a rule of repeated L, the serif line, then the app's parts in plain words (web app screens, server and database, shared rules, handoffs, command line tool, release scripts, Mac app, editor and browser add-ons).

Regenerate: `node render.mjs` (writes `out.png`).

## Tried and dropped
- 10px regular weight, 1.7 radius: the field was too pale and the crescent read as a diagonal band. 11px bold, tighter leading, larger radius made one arc at 1/6.
- Spread 8: leftover letters filled the arc. 16 empties it.

## What the engine would need
Region kind `displace-arc`: `text`, `font`, `size`, `leading`, `rowShift`, `outerRadius` (bind: k * sqrt(total lines)), `thickness` (bind: outerRadius * sqrt(share of a named part)), `centre`, `direction` (where the inner disc is pushed), `spread`, `softEdge`, `accentBand` (px from inner edge), `bleed`. Plus a `rule` region (repeat one character across the width) and a plain-name map for parts.

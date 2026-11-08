# The wave (after Durations)

**Rule:** each part of Hypher (a leaf `area` from the scan, by its plain name) gets one row of its name per 420 lines of code (at least one), in repo tree order, and the rows are bent into one band that enters off the right edge, swings deep left and leaves off the bottom; the part that holds the handoff note (`hypher-web/shared`, "Shared parts": handoffNote, ledgerFold, structuredHandoff) is the accent colour.

Kept: `out.png` = `out-dark.png` (deep navy, orange accent). `out-light.png` (paper #EAE8E2, violet) is kept for comparison. On paper the deep grey rows fade to nothing at 1/6 scale; on navy the band reads as one shape and the orange carries across the room.

Regenerate: `node render.mjs` (reads `bands.json`, which sums `files[].loc` by `files[].area` from `../hypher-facts.json`; 40 parts, 47,675 lines).

## Tried and dropped

1. Rows running from a curved left edge to the right edge (a filled region). It read as a V or hourglass, not a wave, and the field ran into "Drawn by Vyo." at the bottom right.
2. Per-row phase offsets on the repeated word. They made jagged stair-steps on the left of the Convex band and looked like a rendering bug. Every row now starts its word at the left end of its segment.
3. Paragraph bottom-left. The swing of the wave comes too close there, so the paragraph moved top-right.
4. A ribbon width that grew where the curve turned, without limit. At the bottom it hit both footers, so the extra width now fades toward the bottom.

## What the engine would need

A region kind `wave-rows` with these parameters:

- `bands`: a list of {label, weight, tone}, where tone is accent, depth-1 or depth-2.
- `unitPerRow` and `minRows`.
- `top` and `rowHeight`.
- `centre(t)`: a path, given as control points, that may leave the sheet.
- `halfWidth(t)`: given as a base width plus a gain on the curve's slope.
- `tracking(halfWidth)`: how far the letters spread as the band widens.
- `exclusions`: rectangles for the text blocks, so the path is checked to stay clear of the corners.

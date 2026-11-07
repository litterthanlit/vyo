# Terrain

**Rule:** each of 14 parts of Hypher (plain names, grouped by hand from the scan's files) is a peak whose height is its share of lines and whose width is its share of files, placed left to right in tree order; every row is filled with the name of the part under it wherever the smooth ridge is above that row, with letters spread on steep slopes and tight on flats, and the handoff note part is the orange peak.

Regenerate: `python3 gen.py` (writes `parts.json`), then `node render.mjs`. Dark sheet, `out.png`.

## Tried and dropped
1. Letter spread of 3.2 per unit slope: steep slopes dissolved into single columns and the ridge was lost. Now 1.5, capped.
2. Narrow peaks: the range read as spikes. Peaks now overlap and merge through a p-norm ridge.
3. Names running into each other at part borders ("servehandoff"): a two-letter gap now opens at every border.
4. Footers over dense text: glyphs are knocked out behind the two footer lines.

## Not solved
The small parts (mac app, browser add-on, cursor helpers, core) sit under the server's shoulder and are not visible. The valley right of the handoff peak is deeper than the data justifies because screens and marketing are narrow.

## Engine needs
Region kind `ridge-rows`: `peaks` [{label, height, width, tone}], `heightPerUnit`, `ridgeNorm` (p of the p-norm), `rowHeight`, `spreadPerSlope` and `spreadCap`, `lightDirection` (slope shading), `gapAtBorders`, `knockouts` (rectangles), `base` (may lie off the sheet).

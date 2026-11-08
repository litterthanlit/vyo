# Flow in binary (after Vorflux)

**Rule:** each part of Hypher (a leaf area of the scan) is one stream of 0s and 1s entering the left edge, its thickness its share of lines (loc/215 px, at least 3.6px); streams merge by how many imports join them (average-linkage on the import graph, so tightly linked parts join first), and the sum leaves the right edge as one channel with a short run of orange digits at the final merge.

Regenerate: `node render.mjs` (reads `../hypher-facts.json` and `cfg.json`). 40 parts. Text is only 0 and 1, so nothing private can leak.

## Tried and dropped
1. Contiguous stack on the left with big min thickness: the streams read as grey stripes, not tributaries. Gaps between entry points (11px) fixed it.
2. Merge x by creation order: chained merges close together made near-vertical connectors. Merge x by tree height spreads them.
3. One orange block three rows tall and wide: too much; now 3 rows by 17 digits.
4. Stray low-density digits around the flow: pushed down with a density gamma.

## Engine needs
Region kind `flow-tree`: `leaves` {label, weight}; `affinity` pairs (imports) for clustering; `entryRange` (y span at the left edge), `gap`, `unitPerPx`, `minThickness`; `mergeX(height)` curve; edge `core` feather; glyph set (`01`), cell size; `accent` {at: root merge, rows, length}; `exclusions` for the text corners. Exit edge and entry edge may bleed.

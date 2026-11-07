# Letters (the Portrait idea)

**Rule:** HYP over HER is set in Inter Display Bold, and inside the letters each part of the app (11 groups from the scan, plain names) gets a horizontal band as tall as its share of the 47,675 lines, filled with its own name repeated at 8px; the part holding the handoff note ("handoff note", hypher-web/shared) is orange, the rest grey, largest at the top.

Regenerate: `node render.mjs` (reads `bands.json`, grouped by hand from `../hypher-facts.json` file areas; dark navy sheet kept as out.png).

## Tried and dropped
- 10px names with wide gaps: the letterforms broke up and the Y was unreadable. 8px, one space, tight tracking makes the letters solid.
- Identifiers at unreadable size: not tried in the end; the plain names already carry the meaning and cannot leak code.
- Font 565 and 540: the P (and later R) lost its bowl off the right edge. 495 keeps all six letters recognisable with HYP bleeding left and HER shifted right.

## What the engine would need
Region kind `glyph-bands`: `text` per line with `offsetX` and bleed, `font`, `size`, `lineGap`; `bands`: list of {label, weight, tone} stacked top to bottom across both lines (height = weight share of the cap-height span); `texture`: repeat label, size, line height, row stagger; clip = letter mask. Exclusions for the text blocks.

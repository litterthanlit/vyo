# The wave on paper (second pass of a-wave)

**Rule:** each part of Hypher gets one row of its plain name per 300 lines of code (at least one), in repo tree order, bent into one band that enters off the top-left behind the name and leaves off the bottom-right; every fifth row of the whole band reads "switch agents without starting over" instead. The part holding the handoff note is black, the rest violet in two tints by depth.

Regenerate: `node render.mjs` (bands.json = a-wave's sums with names replaced by hand: server, payments, sign-in, agent connection, front page...).

Tried and dropped: a steep near-vertical band (right half of sheet empty); a straight diagonal (no wave, ran through "Drawn by Vyo."); the light tint #a99bea (vanished at 1/6, now #7a64dc). Characters under the right footer are skipped so the footer stays clear.

Engine: `wave-rows` as in a-wave, plus `interleave: {every: 5, text}` and `centre(y)` given as a smoothstep diagonal plus damped sine, with `knockout` rectangles for footers.

// The field registry: each kind of field, the region keys only it takes, its part defaults, its layout, the
// words its legend and fits must use, and where `compose` places the swiss frame's texts so the field has room.
// Render inlines this file after the field modules, so the page and `vyo sketch` look fields up in the same table.
import { waveRows, toneSet } from "./wave.mjs";
import { terrainRows } from "./terrain.mjs";
import { riverRows } from "./river.mjs";
import { radialRows } from "./radial.mjs";
import { sphereRows } from "./sphere.mjs";

export const FIELDS = {
  wave: {
    about: "rows of part names bent into one band from the top edge to the floor, one row per share of lines",
    options: ["sentence", "every"],
    // What a legend must name: one word from each group. Why a wave fits: one of these in the field's fits.
    measure: [["code", "lines"]],
    fits: ["travel", "flow", "hand", "move"],
    layout: waveRows,
    // Colour tokens of the field's own, on top of the theme's, for its rows only.
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    // The band passes behind the figure's texts, which render outlines in paper, instead of around them.
    behindTexts: true,
    // The band enters top right and swings deep left mid-sheet, so the words sit under the masthead and bottom left.
    texts: (floor) => ({ headline: { x: 56, y: 150, w: 420 }, aside: { x: 56, y: floor - 120, w: 240 } }),
  },
  terrain: {
    about: "one peak per part, height by lines and width by files, in rows of the names of the slopes",
    options: [],
    measure: [["code", "lines"], ["files", "wide"]],
    fits: ["big", "weight", "matters", "most"],
    layout: terrainRows,
    tokens: () => ({}),
    behindTexts: false,
    // The range fills the lower two thirds; the sky above holds the words.
    texts: () => ({ headline: { x: 56, y: 150, w: 490 }, aside: { x: 594, y: 64, w: 190 } }),
  },
  river: {
    about: "one stream of 0s and 1s per part from the left edge, as thick as its share of lines, merging by imports into one channel off the right edge",
    options: [],
    // More, smaller parts than the other fields: a river reads as many streams.
    parts: { minShare: 0.002, maxParts: 24 },
    measure: [["merge", "join", "flow"]],
    fits: ["merge", "join", "many", "one"],
    layout: riverRows,
    tokens: () => ({}),
    behindTexts: true,
    // The streams fill the middle band; the words sit above and below it.
    texts: (floor) => ({ headline: { x: 56, y: 150, w: 490 }, aside: { x: 56, y: floor - 120, w: 270 } }),
  },
  radial: {
    about: "rows of part names in a triangle of type that spreads from an apex, sized by lines",
    options: [],
    measure: [["code", "lines"]],
    fits: ["spread", "out", "from", "centre", "center"],
    layout: radialRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: (floor) => ({ headline: { x: 56, y: 150, w: 360 }, aside: { x: 56, y: floor - 120, w: 240 } }),
  },
  sphere: {
    about: "a grid of type-built ellipses that flatten down the page, one cell per share of lines",
    options: [],
    measure: [["code", "lines"]],
    fits: ["curve", "round", "fold", "flat"],
    layout: sphereRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: () => ({ headline: { x: 56, y: 40, w: 360 }, aside: { x: 590, y: 40, w: 190 } }),
  },
};

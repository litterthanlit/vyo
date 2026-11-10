// The field registry: each kind of field, the region keys only it takes, its part defaults, its layout, the
// words its legend and fits must use, and where `compose` places the swiss frame's texts so the field has room.
// Render inlines this file after the field modules, so the page and `vyo sketch` look fields up in the same table.
import { waveRows, WAVE_TONES } from "./wave.mjs";
import { terrainRows } from "./terrain.mjs";
import { riverRows } from "./river.mjs";
import { shapeRows, shapeGround, SHAPE_TONES } from "./shape.mjs";

export const FIELDS = {
  wave: {
    about: "rows of part names bent into one band from the top edge to the floor, one row per share of lines",
    options: ["sentence", "every"],
    // What a legend must name: one word from each group. Why a wave fits: one of these in the field's fits.
    measure: [["code", "lines"]],
    fits: ["travel", "flow", "hand", "move"],
    layout: waveRows,
    // Colour tokens of the field's own, on top of the theme's, for its rows only.
    tokens: (theme) => WAVE_TONES[theme].tokens,
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
  shape: {
    about: "a silhouette you draw as ops, cut top to bottom into one band per part, as much area as its lines, the type as big as its share",
    options: ["shape", "style", "echo"],
    // Every band must hold its whole name in readable type, so fewer, bigger parts than a wave.
    parts: { maxParts: 12 },
    measure: [["code", "lines"], ["type", "size", "bigger", "larger", "area"]],
    fits: ["object", "thing", "picture", "shape", "looks"],
    layout: shapeRows,
    // The silhouette under the rows: one fill per band, as rows of spans.
    ground: shapeGround,
    tokens: (theme) => SHAPE_TONES[theme].tokens,
    behindTexts: false,
    // The words sit in the room the silhouette leaves, so only the loose frame draws one.
    frames: ["loose"],
  },
};

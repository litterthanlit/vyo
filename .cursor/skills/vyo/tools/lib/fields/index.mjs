// The field registry: each kind of field, the region keys only it takes, its part defaults, its layout, the
// words its legend and fits must use, and where `compose` places the swiss frame's texts so the field has room.
// Render inlines this file after the field modules, so the page and `vyo sketch` look fields up in the same table.
import { waveRows, toneSet } from "./wave.mjs";
import { terrainRows } from "./terrain.mjs";
import { riverRows } from "./river.mjs";
import { shapeRows, shapeGround, shapeSheet, SHAPE_TONES } from "./shape.mjs";
import { RELIEF_TONES } from "./shape-relief.mjs";
import { radialRows } from "./radial.mjs";
import { sphereRows } from "./sphere.mjs";
import { scatterRows } from "./scatter.mjs";
import { shatterRows } from "./shatter.mjs";
import { glyphRows } from "./glyph.mjs";
import { bleedRows } from "./bleed.mjs";
import { slabsRows } from "./slabs.mjs";
import { spiralRows } from "./spiral.mjs";
import { contourRows } from "./contour.mjs";
import { traceRows } from "./trace.mjs";

const cornerTexts = (floor) => ({ headline: { x: 56, y: 150, w: 360 }, aside: { x: 56, y: floor - 120, w: 240 } });

export const FIELDS = {
  wave: {
    about: "rows of part names bent into one band from the top edge to the floor, one row per share of lines",
    options: ["sentence", "every", "seed"],
    measure: [["code", "lines"]],
    fits: ["travel", "flow", "hand", "move"],
    layout: waveRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: (floor) => ({ headline: { x: 56, y: 150, w: 420 }, aside: { x: 56, y: floor - 120, w: 240 } }),
  },
  terrain: {
    about: "one peak per part, height by lines and width by files, in rows of the names of the slopes",
    options: ["seed"],
    measure: [["code", "lines"], ["files", "wide"]],
    fits: ["big", "weight", "matters", "most"],
    layout: terrainRows,
    tokens: () => ({}),
    behindTexts: false,
    texts: () => ({ headline: { x: 56, y: 150, w: 490 }, aside: { x: 594, y: 64, w: 190 } }),
  },
  river: {
    about: "one stream of 0s and 1s per part from the left edge, as thick as its share of lines, merging by imports into one channel off the right edge",
    options: ["seed"],
    parts: { minShare: 0.002, maxParts: 24 },
    measure: [["merge", "join", "flow"]],
    fits: ["merge", "join", "many", "one"],
    layout: riverRows,
    tokens: () => ({}),
    behindTexts: true,
    texts: (floor) => ({ headline: { x: 56, y: 150, w: 490 }, aside: { x: 56, y: floor - 120, w: 270 } }),
  },
  shape: {
    about: "a silhouette you draw as ops, cut top to bottom into one band per part, as much area as its lines, the type as big as its share",
    options: ["shape", "style", "echo", "bevel", "strata", "split"],
    // Every band must hold its whole name in readable type, so fewer, bigger parts than a wave.
    parts: { maxParts: 12 },
    // A relief's 6px type holds any name, so it takes as many parts as a wave.
    styleParts: { relief: { maxParts: 14 } },
    measure: [["code", "lines"], ["type", "size", "big", "bigger", "larger", "area"]],
    fits: ["object", "thing", "picture", "shape", "looks"],
    layout: shapeRows,
    // The silhouette under the rows: one fill per band, as rows of spans.
    ground: shapeGround,
    // Marks on the sheet itself, outside the shape: never figure, so no check reads them.
    sheet: shapeSheet,
    tokens: (theme) => ({ ...SHAPE_TONES[theme].tokens, ...RELIEF_TONES[theme].tokens }),
    behindTexts: false,
    // The words sit in the room the silhouette leaves, so only the frames with a record line draw one.
    frames: ["loose", "signal"],
  },
  radial: {
    about: "rows of part names in a triangle of type that spreads from an apex, sized by lines",
    options: ["seed"],
    measure: [["code", "lines"]],
    fits: ["spread", "out", "from", "centre", "center"],
    layout: radialRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: (floor) => cornerTexts(floor),
  },
  sphere: {
    about: "a grid of type-built ellipses that flatten down the page, one cell per share of lines",
    options: ["seed"],
    measure: [["code", "lines"]],
    fits: ["curve", "round", "fold", "flat"],
    layout: sphereRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: () => ({ headline: { x: 56, y: 40, w: 360 }, aside: { x: 590, y: 40, w: 190 } }),
  },
  scatter: {
    about: "separate clouds of part names, ellipses scattered across the sheet with gaps between them",
    options: ["seed", "symbols"],
    measure: [["code", "lines"]],
    fits: ["scatter", "speck", "cloud", "dust"],
    layout: scatterRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: (floor) => cornerTexts(floor),
  },
  shatter: {
    about: "a grid of type cells broken along a fault, some cells dropped and the rest shifted apart",
    options: ["seed", "symbols"],
    measure: [["code", "lines"]],
    fits: ["break", "grid", "split", "apart"],
    layout: shatterRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: (floor) => cornerTexts(floor),
  },
  glyph: {
    about: "one giant letter filled with part names, a mark that can crop and bleed off the sheet",
    options: ["letter", "seed", "symbols"],
    measure: [["code", "lines"]],
    fits: ["letter", "mark", "sign", "name"],
    layout: glyphRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: (floor) => cornerTexts(floor),
  },
  bleed: {
    about: "one large form whose centre sits off the sheet, so the type runs off an edge",
    options: ["seed", "symbols"],
    measure: [["code", "lines"]],
    fits: ["crop", "bleed", "edge", "off"],
    layout: bleedRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: (floor) => ({ headline: { x: 56, y: 150, w: 300 }, aside: { x: 56, y: floor - 120, w: 220 } }),
  },
  slabs: {
    about: "stacked slabs of type with gaps of paper between them, left and right edges staggered",
    options: ["seed", "symbols"],
    measure: [["code", "lines"]],
    fits: ["stack", "slab", "bar", "layer"],
    layout: slabsRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: () => ({ headline: { x: 56, y: 40, w: 480 }, aside: { x: 560, y: 48, w: 220 } }),
  },
  spiral: {
    about: "a thick coil of part names, an Archimedean spiral rather than a wave",
    options: ["seed", "symbols"],
    measure: [["code", "lines"]],
    fits: ["spin", "coil", "spiral", "turn"],
    layout: spiralRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: (floor) => cornerTexts(floor),
  },
  contour: {
    about: "nested rings of type around a few hills, like contour lines on a map",
    options: ["seed", "symbols"],
    measure: [["code", "lines"]],
    fits: ["contour", "level", "map", "ridge"],
    layout: contourRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: (floor) => cornerTexts(floor),
  },
  trace: {
    about: "part names filling a shape traced from a PNG mask",
    options: ["mask", "seed", "symbols"],
    measure: [["code", "lines"]],
    fits: ["trace", "mask", "image", "from"],
    layout: traceRows,
    tokens: (theme, frame) => toneSet(theme, frame).tokens,
    behindTexts: true,
    texts: (floor) => cornerTexts(floor),
  },
};

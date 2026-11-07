// The field registry: each kind of field, the region keys only it takes, its layout, and where `compose`
// places the texts so the field has room. Render inlines this file after wave.mjs and terrain.mjs, so the
// page and `vyo sketch` look fields up in the same table.
import { waveRows } from "./wave.mjs";
import { terrainRows } from "./terrain.mjs";

export const FIELDS = {
  wave: {
    about: "rows of part names bent into one band from the top edge to the floor, one row per share of lines",
    options: ["sentence", "every"],
    layout: waveRows,
    // The band enters top right and swings deep left mid-sheet, so the words sit under the masthead and bottom left.
    texts: (floor) => ({ headline: { x: 56, y: 150, w: 420 }, aside: { x: 56, y: floor - 120, w: 240 } }),
  },
  terrain: {
    about: "one peak per part, height by lines and width by files, in rows of the names of the slopes",
    options: [],
    layout: terrainRows,
    // The range fills the lower two thirds; the sky above holds the words.
    texts: () => ({ headline: { x: 56, y: 150, w: 490 }, aside: { x: 594, y: 64, w: 190 } }),
  },
};

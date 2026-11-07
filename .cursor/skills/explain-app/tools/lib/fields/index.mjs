// The field registry: each kind of field, the region keys only it takes, and its layout. Render inlines
// this file after wave.mjs and terrain.mjs, so the page and `vyo sketch` look fields up in the same table.
import { waveRows } from "./wave.mjs";
import { terrainRows } from "./terrain.mjs";

export const FIELDS = {
  wave: { about: "rows of part names bent into one band from the top edge to the floor, one row per share of lines", options: ["sentence", "every"], layout: waveRows },
  terrain: { about: "one peak per part, height by lines and width by files, in rows of the names of the slopes", options: [], layout: terrainRows },
};

// The shape field: a silhouette the agent draws, filled from its mask. A style reads the mask and the parts and
// returns the rows of type and the ground under them (SHAPE_STYLES). Pure, like wave.mjs.
import { shapeMask } from "../mask.mjs";
import { ringsStyle } from "./shape-rings.mjs";
import { reliefStyle } from "./shape-relief.mjs";
import { symbolsStyle } from "./shape-symbols.mjs";

// Per theme: the token for type on the accent fill (paper type on orange washed out on paper, and navy on orange
// read as ink).
export const SHAPE_TOKENS = {
  light: { "on-hot": "#161616" },
  dark: { "on-hot": "#0E1424" },
};

// The looks a shape can take over the same mask, by the region's `style`; a region without one is drawn as relief.
export const DEFAULT_STYLE = "relief";
export const SHAPE_STYLES = { rings: ringsStyle, relief: reliefStyle, symbols: symbolsStyle };

/** A shape region drawn: its mask, its rows of type and the ground under them. */
export function shapeLayout(region, parts, frame) {
  const mask = shapeMask(region.shape);
  return { mask, ...SHAPE_STYLES[region.style ?? DEFAULT_STYLE](mask, parts, { ...frame, region }) };
}

export const shapeRows = (region, parts, frame) => shapeLayout(region, parts, frame).rows;
export const shapeGround = (region, parts, frame) => shapeLayout(region, parts, frame).ground;
export const shapeSheet = (region, parts, frame) => shapeLayout(region, parts, frame).sheet ?? [];

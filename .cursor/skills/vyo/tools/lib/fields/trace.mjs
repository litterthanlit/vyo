// Image-traced mask. The chords are computed in Node (the page cannot read a file) and filled here.
import { rowsFromChords, SYMBOLS } from "./chords.mjs";

export const TRACE = { size: 6.2, pitch: 7.2 };

/** Rows for chords already traced from a PNG. `region.pitch` matches the chord spacing. */
export function traceRows(region, parts, opts) {
  const own = region.symbols ? SYMBOLS : TRACE;
  return rowsFromChords(region.chords || [], parts, {
    size: own.size,
    pitch: region.pitch || own.pitch,
    symbols: !!region.symbols,
    measure: opts.measure,
    theme: opts.theme,
    frame: opts.frame,
    blocks: opts.blocks,
    behindTexts: true,
  });
}

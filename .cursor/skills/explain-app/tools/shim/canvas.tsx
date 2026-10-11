// Stand-in for the `cursor/canvas` SDK so posters can render outside Cursor.
// Posters may only use useCanvasState (grid toggle, page 3's slider, selection
// and theme) and useHostTheme (focus state). Importing anything else fails the
// build with a clear message.
import { useState, type Dispatch, type SetStateAction } from "react";

// `poster.mjs ... --state key=value` seeds these before the bundle runs (see README).
// A key that is not seeded keeps the canvas's own default.
export function useCanvasState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const seeded = (globalThis as { __POSTER_STATE__?: Record<string, unknown> }).__POSTER_STATE__?.[key];
  return useState<T>((seeded ?? initial) as T);
}

// Theme tokens are not used for poster colors, so any token resolves to ink.
const INK = "#0A0A0A";
function token(): any {
  return new Proxy(() => INK, {
    get: (_t, key) => (key === Symbol.toPrimitive || key === "toString" || key === "valueOf" ? () => INK : token()),
  });
}

export function useHostTheme(): any {
  return token();
}

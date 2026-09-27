// Stand-in for the `cursor/canvas` SDK so posters can render outside Cursor.
// Posters may only use useCanvasState (grid toggle) and useHostTheme (focus
// state). Importing anything else fails the build with a clear message.
import { useState, type Dispatch, type SetStateAction } from "react";

export function useCanvasState<T>(_key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  return useState<T>(initial);
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

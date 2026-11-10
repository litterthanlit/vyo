// The symbols style: the shape drawn the way ASCII art draws a form, in clusters of `- : = + #`. It is the signal
// fields' symbol rule (chords.mjs) over the drawn mask: depth picks the symbol, hashed noise leaves gaps, more of
// them near the edges, and the parts share the rows top to bottom by lines, the accent's rows in the accent colour.
// Pure, like shape.mjs.
import { SHEET } from "../geometry.mjs";
import { maskGrid, edt } from "../mask.mjs";
import { rowsFromChords, SYMBOLS } from "./chords.mjs";

// Type `size` px on `pitch` px rows, finer than the generated fields' symbols, so a large drawn form reads as
// texture and not as a slab of `#`. Depth, which picks the symbol, is a dome from the outline in that reaches 1 at
// `dome` of the deepest point (`cell` px grid), lit from the top left by `lit`, so the form shades as a volume the
// way the relief does. The accent's rows need `accent` px of height to show at thumbnail size. In the sketch a
// symbol lays `cover` of its cell in ink, from `-` to `#`.
export const SYMBOL_STYLE = { size: 7, pitch: 8.4, cell: 4, dome: 0.22, lit: 0.4, accent: 40, cover: [0.12, 0.16, 0.22, 0.26, 0.34] };

/**
 * One chord per symbol row down the whole sheet, each the mask's spans at the row's middle, so the rule's
 * neighbours above and below are the rows above and below.
 * @param {import("../mask.mjs").Mask} mask
 */
function symbolChords(mask) {
  const chords = [];
  for (let i = 0; (i + 1) * SYMBOL_STYLE.pitch <= SHEET.height; i++) {
    const y = Math.round(i * SYMBOL_STYLE.pitch * 10) / 10;
    chords.push({ y, runs: mask.runs[Math.min(SHEET.height - 1, Math.floor(y + SYMBOL_STYLE.pitch / 2))].map(([l, r]) => [l, r]) });
  }
  return chords;
}

/** Depth 0 to 1 at a sheet point: how far in from the outline, on a dome, times the light from the top left. */
function litDepth(mask) {
  const C = SYMBOL_STYLE.cell;
  const { w, h, bits } = maskGrid(mask, C);
  const dist = edt(Float64Array.from(bits, (b) => (b ? 1e12 : 0)), w, h).map(Math.sqrt);
  const deepest = Math.max(1, ...dist);
  const b = mask.box;
  const [bw, bh] = [Math.max(1, b.right - b.left), Math.max(1, b.bottom - b.top)];
  return (x, y) => {
    const [gx, gy] = [Math.floor(x / C), Math.floor((y + SYMBOL_STYLE.pitch / 2) / C)];
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return 0;
    const dome = Math.min(1, dist[gy * w + gx] / (SYMBOL_STYLE.dome * deepest));
    const light = 1 - ((x - b.left) / bw + (y - b.top) / bh) / 2;
    return Math.sqrt(dome) * (1 - SYMBOL_STYLE.lit + SYMBOL_STYLE.lit * Math.max(0, Math.min(1, light)));
  };
}

/**
 * @param {import("../mask.mjs").Mask} mask
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts  in tree order
 * @param {{ measure: (text: string, size: number) => number, theme?: "light" | "dark", frame?: string }} frame
 */
export function symbolsStyle(mask, parts, { measure, theme = "light", frame }) {
  const rows = rowsFromChords(symbolChords(mask), parts, { size: SYMBOL_STYLE.size, pitch: SYMBOL_STYLE.pitch, measure, theme, frame, symbols: true, depthAt: litDepth(mask) });
  const span = (id) => {
    const mine = rows.filter((r) => r.part === id);
    return mine.length ? [Math.min(...mine.map((r) => r.y)), Math.max(...mine.map((r) => r.y + r.height))] : null;
  };
  const summary = ["symbol rows, top to bottom (* the accent):", ...parts.map((p) => {
    const s = span(p.id);
    return `  ${p.hot ? "*" : " "} ${p.name.toLowerCase().padEnd(24)} ${s ? `y ${Math.round(s[0])} to ${Math.round(s[1])}, ${rows.filter((r) => r.part === p.id).length} runs` : "no rows"}`;
  })];
  const findings = { "shape-accent": [] };
  const hot = parts.filter((p) => p.hot).map((p) => span(p.id)).filter(Boolean);
  const tall = hot.reduce((a, [t, b]) => a + b - t, 0);
  if (hot.length && tall < SYMBOL_STYLE.accent) {
    findings["shape-accent"].push(`the accent's symbol rows are ${Math.round(tall)}px tall; they need ${SYMBOL_STYLE.accent}px to show in the thumbnail, so scale the shape up ${Math.round((SYMBOL_STYLE.accent / Math.max(1, tall)) * 100) / 100}x, widen it where the accent falls, or put the accent on a bigger part`);
  }
  /** The sketch's thumbnail: each symbol a patch of its tone, as much ink as the symbol lays on its cell. */
  const picture = (tokens) => {
    const S = 3;
    const [w, h] = [Math.ceil(SHEET.width / S), Math.ceil(SHEET.height / S)];
    const hex = (t) => [1, 3, 5].map((i) => parseInt((tokens[t] ?? tokens.ink).slice(i, i + 2), 16));
    const paper = hex("paper");
    const ink = Array.from({ length: w * h }, () => [0, 0, 0, 0]);
    for (const r of rows) {
      const c = hex(r.tone);
      const adv = (r.width + r.spacing) / r.text.length;
      [...r.text].forEach((ch, k) => {
        const a = SYMBOL_STYLE.cover[SYMBOLS.ramp.indexOf(ch)];
        if (a === undefined) return;
        const [px, py] = [Math.floor((r.x + (k + 0.5) * adv) / S), Math.floor((r.y + r.height / 2) / S)];
        if (px < 0 || px >= w || py < 0 || py >= h) return;
        // A cell is about 7 by 10.5 px, so a third of it covers one thumbnail pixel across and three down.
        for (const dy of [-1, 0, 1]) {
          const q = ink[(Math.min(h - 1, Math.max(0, py + dy))) * w + px];
          for (let j = 0; j < 3; j++) q[j] += c[j] * a;
          q[3] += a;
        }
      });
    }
    const rgb = new Uint8Array(w * h * 3);
    ink.forEach(([r, g, b, a], i) => {
      const k = Math.min(1, a);
      const tone = a ? [r / a, g / a, b / a] : paper;
      for (let j = 0; j < 3; j++) rgb[i * 3 + j] = Math.round(paper[j] * (1 - k) + tone[j] * k);
    });
    return rgb;
  };
  return { bands: [], rows, ground: [], findings, summary, picture };
}

import { scene, Stage, Body, El } from "continuity";
import { codeRow } from "../lib/code.js";
import { CELL_W, LINE_H, WORD_W, BASELINE, MASK } from "../lib/portrait.js";

// End card, the portrait: the recipe planner's code types out across the frame and leaves
// the name as holes; then the holes fill with plain words, the full stop (the film's one
// accent fill) is placed, and the promise follows. Every letter is the product's own words.
const COLS = MASK[0].length;
const GRID_W = COLS * CELL_W;
const LEFT = Math.round((1920 - GRID_W) / 2);
const TOP = 72;
const WORDS = "Point it at a repo. Get the poster. Every word comes from the repo. ";
const DOT = 104;

// The full stop's cells, with a one-cell margin: the code leaves them blank too.
const DOT_C0 = Math.floor((WORD_W + 24) / CELL_W) - 1;
const DOT_C1 = Math.ceil((WORD_W + 24 + DOT) / CELL_W);
const DOT_R0 = Math.floor((BASELINE - DOT) / LINE_H);
const DOT_R1 = Math.ceil(BASELINE / LINE_H) - 1;
const inDot = (r: number, k: number) => r >= DOT_R0 && r <= DOT_R1 && k >= DOT_C0 && k <= DOT_C1;

// Each row twice on one grid: the code with the letters left blank, and the words only in the letters.
const rowsA = MASK.map((m, r) => {
  const code = codeRow(r, COLS);
  return [...m].map((c, k) => (c === "#" || inDot(r, k) ? " " : code[k])).join("");
});
let w = 0;
// Spaces inside a letter become a middle dot, so the strokes read solid.
const rowsB = MASK.map((m) => [...m].map((c) => (c === "#" ? WORDS[w++ % WORDS.length].replace(" ", "·") : " ")).join(""));
const LIT = rowsB.map((s, r) => (s.trim() ? r : -1)).filter((r) => r >= 0);

export default scene({
  view: ({ text }) => (
    <Stage bg="lit">
      <div data-ct-ui data-layout-allow-overlap class="absolute font-mono text-[26px]" style={{ left: `${LEFT}px`, top: `${TOP}px`, width: `${GRID_W}px`, lineHeight: `${LINE_H}px` }}>
        {/* The code is the ground the name is cut from: decor once the name is written. */}
        <El ct="code" data-layout-ignore class="absolute inset-0">
          {rowsA.map((s, r) => (
            <El ct={`a${r}`} data-layout-allow-overlap class="absolute left-0 whitespace-pre text-fg-subtle" style={{ top: `${r * LINE_H}px` }}>
              {s}
            </El>
          ))}
        </El>
        {LIT.map((r) => (
          <El ct={`b${r}`} data-layout-allow-overlap class="absolute left-0 whitespace-pre text-fg" style={{ top: `${r * LINE_H}px` }}>
            {rowsB[r]}
          </El>
        ))}
        <El
          ct="dot"
          class="absolute rounded-full bg-accent"
          style={{ left: `${WORD_W + 24}px`, top: `${BASELINE - DOT}px`, width: `${DOT}px`, height: `${DOT}px` }}
        />
      </div>
      <Body ct="tagline" class="absolute" style={{ left: `${LEFT}px`, top: `${TOP + MASK.length * LINE_H + 40}px` }}>
        {text.tagline}
      </Body>
    </Stage>
  ),
  motion: (m) => {
    // b1: the code types out, row by row, leaving the name as holes.
    m.enter(MASK.map((_, r) => `a${r}`), "wipeRight", { at: "b1", duration: "slow", ease: "linear", stagger: 0.03 });
    // b2: the holes fill with plain words: the name is written.
    m.enter(LIT.map((r) => `b${r}`), "wipeRight", { at: "b2", duration: "slow", ease: "linear", stagger: 0.04 });
    // As the name is written, the code steps back so the letters read.
    m.tween("code", { opacity: [1, 0.12] }, { at: "b2", duration: "slow", ease: "out" });
    // b3: the full stop is placed (the scene's one moment); b4 the promise.
    m.enter("dot", "settle", { at: "b3" });
    m.enter("tagline", "rise", { at: "b4" });
    m.camera({ scale: [1, 1.03] }, { origin: { x: 960, y: 400 } });
  },
});

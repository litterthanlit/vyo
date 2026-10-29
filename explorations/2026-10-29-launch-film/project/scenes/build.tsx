import { scene, Stage, Safe, Window, El } from "continuity";
import { codeRow } from "../lib/code.js";

// The poster building itself. Vyo's steps type on the left, one line at a time, and each
// line visibly changes the poster on the right: the code fills it, the spotlight is carved
// out of the code, the plain words land in the cone, and the point keeps its ink.
const WIN_W = 576;
const CANVAS_X = WIN_W + 64;
const CANVAS_W = 1728 - CANVAS_X;
const PAD = 48;
const ROWS = 14;
const ROW = 56;
const CANVAS_H = 2 * PAD + ROWS * ROW;
const CX = CANVAS_W / 2;
const MONO = 15.6; // Geist Mono at 26px, advance
const fit = (w: number) => Math.max(0, Math.floor(w / MONO)); // characters that fit a width exactly
const INNER = CANVAS_W - 2 * PAD;
const CHAR = 19; // Geist 500 at 36px, average advance
const PLAIN = ["Save a recipe", "Get a shopping list", "Plan your week", "Open any recipe", "Ideas from what you have", "Plan your week", "Save a recipe"];
const KEY = "Plan your week";
const half = (r: number) => 64 + (r / (ROWS - 1)) * (CX - PAD - 64);
const phraseAt = (r: number) => {
  const want = r < 3 ? KEY : PLAIN[(r * 3) % PLAIN.length];
  return want.length * CHAR <= 2 * half(r) - 16 ? want : "Plan";
};
const ALL = Array.from({ length: ROWS }, (_, r) => r);
const OTHER = ALL.filter((r) => phraseAt(r) !== KEY);
const LINES = ["l0", "l1", "l2", "l3", "l4"];

export default scene({
  view: ({ text }) => (
    <Stage bg="lit">
      <Safe>
        <div class="absolute inset-y-0 left-0 flex items-center">
          <Window ct="plan" title={text.title} width={WIN_W} height={416}>
            <div class="flex flex-col gap-[16px] p-[48px] font-mono text-[28px] leading-[40px] text-fg">
              {LINES.map((id) => (
                <El ct={id} class="whitespace-pre">
                  <span class="text-fg-subtle">{text[`${id}k`]}</span>
                  {text[`${id}v`]}
                </El>
              ))}
            </div>
          </Window>
        </div>
        <El
          ct="canvas"
          data-ct-ui
          data-layout-allow-overlap
          class="absolute overflow-hidden rounded-surface bg-surface-1 shadow-raised"
          style={{ left: `${CANVAS_X}px`, top: `${(972 - CANVAS_H) / 2}px`, width: `${CANVAS_W}px`, height: `${CANVAS_H}px` }}
        >
          {ALL.map((r) => {
            const h = half(r);
            const top = PAD + r * ROW;
            const wl = CX - PAD - h - 24;
            const wm = 2 * h + 48;
            const wr = INNER - wl - wm;
            return (
              <>
                {/* The code row: its left, middle and right parts fill together; the middle is carved later. */}
                <El ct={`k${r}`} class="absolute h-[56px] font-mono text-[26px] leading-[56px] text-fg-subtle" style={{ left: `${PAD}px`, right: `${PAD}px`, top: `${top}px` }}>
                  <div class="absolute left-0 flex justify-end whitespace-pre" style={{ width: `${wl}px` }}>
                    {codeRow(r, fit(wl)).trimEnd()}
                  </div>
                  <El ct={`m${r}`} class="absolute flex justify-center whitespace-pre" style={{ left: `${wl}px`, width: `${wm}px` }}>
                    {codeRow(r + 3, fit(wm)).trim()}
                  </El>
                  <div class="absolute whitespace-pre" style={{ left: `${wl + wm}px`, width: `${wr}px` }}>
                    {codeRow(r + 7, fit(wr)).trimStart()}
                  </div>
                </El>
                <div class="absolute h-[56px] overflow-hidden" style={{ left: `${CX - h}px`, width: `${2 * h}px`, top: `${top}px` }}>
                  <El ct={`w${r}`} class="flex h-full items-center justify-between font-title text-[36px] text-fg">
                    {Array.from({ length: Math.max(1, Math.floor((2 * h + 40) / (phraseAt(r).length * CHAR + 40))) }, () => (
                      <span class="whitespace-pre">{phraseAt(r)}</span>
                    ))}
                  </El>
                </div>
              </>
            );
          })}
        </El>
      </Safe>
    </Stage>
  ),
  motion: (m) => {
    // b1: the product is placed (the scene's one moment); the empty poster appears with it.
    m.enter("plan", "settle", { at: "b1" });
    m.enter("canvas", "fade", { at: "b1" });
    // read: the poster fills with the repo's code, row by row, like a machine writing.
    m.type("l0", { at: "b2", cps: 30 });
    m.enter(ALL.map((r) => `k${r}`), "wipeRight", { at: "b3", duration: "slow", ease: "linear", stagger: 0.04 });
    // shape: the spotlight is carved out of the code, from the apex down.
    m.type("l1", { at: "b4", cps: 30 });
    m.exit(ALL.map((r) => `m${r}`), "fadeOut", { at: "b5", stagger: 0.05 });
    // words: the plain words land in the cone.
    m.type("l2", { at: "b6", cps: 30 });
    m.enter(ALL.map((r) => `w${r}`), "rise", { at: "b7", stagger: 0.06 });
    // key: everything but the point steps back.
    m.type("l3", { at: "b8", cps: 30 });
    m.emphasize(OTHER.map((r) => `w${r}`), "dim", { at: "b9", stagger: 0 });
    m.type("l4", { at: "b10", cps: 30 });
    m.camera({ scale: [1, 1.03] }, { origin: { x: 96, y: 540 } });
  },
});

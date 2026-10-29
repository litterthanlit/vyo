import { scene, Stage, Safe, Label, El } from "continuity";

// The poster drawing itself, in litt: the recipe planner's code fills the frame in the grey,
// and inside a cone from the top the same app lands in plain words, row by row, like light
// falling. The cone is layout, not light: nothing material moves; only the words arrive.
const TOP = 96;
const ROW = 56;
const ROWS = 15;
const CX = 960;
const CODE = [
  "app/api/recipes/route.ts", "export async function POST", "prisma.recipe.create", "app/(app)/plan/page.tsx",
  "components/plan/shopping-list.tsx", "app/api/suggest/route.ts", "suggestRecipes(have)", "lib/ai/prompts.ts",
  "app/api/cron/weekly-plan/route.ts", "prisma/schema.prisma", "app/(app)/recipes/[id]/page.tsx", "app/(app)/settings/page.tsx",
];
const PLAIN = ["Save a recipe", "Get a shopping list", "Plan your week", "Open any recipe", "Ideas from what you have", "Plan your week", "Save a recipe"];
const KEY = "Plan your week";
const SIDE = 144; // the code layer's inset: title-safe with room for the camera's push
const CHAR = 19; // Geist 500 at 36px, average advance
const codeLine = (r: number) => Array.from({ length: 6 }, (_, k) => CODE[(r * 5 + k) % CODE.length]).join("   ");
// The cone's half width at a row, growing from the apex.
const half = (r: number) => 70 + (r / (ROWS - 1)) * 540;
// The row's phrase: the planned one if it fits the cone there, else the point's first word.
const phraseAt = (r: number) => {
  const want = r < 3 ? KEY : PLAIN[(r * 3) % PLAIN.length];
  return want.length * CHAR <= 2 * half(r) - 16 ? want : "Plan";
};
export const KEY_ROWS = Array.from({ length: ROWS }, (_, r) => r).filter((r) => phraseAt(r) === KEY);
export const OTHER_ROWS = Array.from({ length: ROWS }, (_, r) => r).filter((r) => phraseAt(r) !== KEY);

export default scene({
  view: ({ text }) => (
    <Stage>
      <El
        ct="code"
        data-ct-ui
        class="absolute font-mono text-[26px] leading-[56px] text-fg-subtle"
        style={{ left: `${SIDE}px`, right: `${SIDE}px`, top: `${TOP}px`, height: `${ROWS * ROW}px` }}
      >
        {Array.from({ length: ROWS }, (_, r) => {
          const h = half(r);
          return (
            <div class="absolute left-0 right-0 h-[56px]" style={{ top: `${r * ROW}px` }}>
              <div class="absolute left-0 flex justify-end overflow-hidden whitespace-pre" style={{ width: `${CX - SIDE - h - 32}px` }}>
                {codeLine(r)}
              </div>
              <div class="absolute right-0 overflow-hidden whitespace-pre" style={{ left: `${CX - SIDE + h + 32}px` }}>
                {codeLine(r + 7)}
              </div>
            </div>
          );
        })}
      </El>
      <div data-ct-ui class="absolute inset-0">
        {Array.from({ length: ROWS }, (_, r) => {
          const h = half(r);
          const p = phraseAt(r);
          const n = Math.max(1, Math.floor((2 * h + 40) / (p.length * CHAR + 40)));
          return (
            <div class="absolute h-[56px] overflow-hidden" style={{ left: `${CX - h}px`, width: `${2 * h}px`, top: `${TOP + r * ROW}px` }}>
              <El ct={`w${r}`} class="flex h-full items-center justify-between font-title text-[36px] text-fg">
                {Array.from({ length: n }, () => (
                  <span class="whitespace-pre">{p}</span>
                ))}
              </El>
            </div>
          );
        })}
      </div>
      <Safe>
        <Label ct="label" class="absolute bottom-0 left-0">
          {text.label}
        </Label>
      </Safe>
    </Stage>
  ),
  motion: (m) => {
    m.enter("code", "fade", { at: "b1" });
    m.enter("label", "fade", { at: "b1" });
    // b2: the moment. Rows land from the apex down, 60ms apart, as one expressive group.
    m.enter(Array.from({ length: ROWS }, (_, r) => `w${r}`), "rise", { at: "b2", stagger: 0.06, ease: "expressive" });
    // b3: the point keeps its ink; every other line steps back.
    m.emphasize(OTHER_ROWS.map((r) => `w${r}`), "dim", { at: "b3", stagger: 0 });
    m.camera({ scale: [1, 1.03] }, { origin: { x: 960, y: 96 } });
  },
});

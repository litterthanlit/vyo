import { scene, Stage, Safe, Headline, Emph, El } from "continuity";

// Real files from the recipe planner Vyo tests itself on: what code looks like to anyone
// who didn't write it. Quiet, in the grey, on the right; the statement owns the left edge.
const FILES = [
  "app/api/recipes/route.ts",
  "app/(app)/plan/page.tsx",
  "components/plan/shopping-list.tsx",
  "app/api/suggest/route.ts",
  "lib/ai/prompts.ts",
  "app/api/cron/weekly-plan/route.ts",
  "prisma/schema.prisma",
  "app/(app)/settings/page.tsx",
];

export default scene({
  view: ({ text }) => (
    <Stage>
      <Safe>
        <div class="absolute inset-y-0 left-0 flex items-center">
          <Headline as="h1">
            <El as="span" ct="l1" class="block">
              {text.l1}
            </El>
            <El as="span" ct="l2" class="block">
              <Emph text={text.l2} word="what it's for">
                {(w) => (
                  <El as="span" ct="what" class="text-fg">
                    {w}
                  </El>
                )}
              </Emph>
            </El>
          </Headline>
        </div>
        <div class="absolute inset-y-0 right-[64px] flex items-center">
          <El ct="files" data-ct-ui class="font-mono text-small text-fg-subtle">
            {FILES.map((f, i) => (
              <El ct={`f${i}`} class="whitespace-pre">
                {f}
              </El>
            ))}
          </El>
        </div>
      </Safe>
    </Stage>
  ),
  motion: (m) => {
    m.enter("l1", "maskUp", { at: "b1", split: "words" });
    m.enter(FILES.map((_, i) => `f${i}`), "rise", { at: "b1+0.1", stagger: "list" });
    // b2: the turn, the scene's one moment. Line 1 steps back to the grey.
    m.emphasize("l1", "dim", { at: "b2" });
    m.enter("l2", "maskUp", { at: "b2", split: "words", ease: "expressive" });
    // b3: only "what it's for" keeps its ink.
    m.emphasize("l2", "dim", { at: "b3" });
    m.camera({ scale: [1, 1.03] }, { origin: { x: 96, y: 540 } });
  },
});

import { scene, Stage, Safe, Stack, Headline, Title, El } from "continuity";

// The idea of the film: each file, and what it lets a person do, on the same row. Code is
// data (Geist Mono, the grey); the plain sentence is Geist 500 in fg. At the end every sentence
// but one steps back, so "Plan your week" is the point.
const ROWS = [0, 1, 2, 3];

export default scene({
  view: ({ text }) => (
    <Stage>
      <Safe>
        <div class="absolute inset-0 flex items-center">
          <Stack gap={96} class="w-full">
            <Headline ct="headline">{text.headline}</Headline>
            <div>
              {ROWS.map((i) => (
                <div class="relative h-[112px]">
                  {/* The row: its hairline and its file path arrive together. */}
                  <El ct={`r${i}`} class="absolute inset-0 border-t-[2px] border-line pt-[32px]">
                    <El ct={`c${i}`} class="w-[768px] font-mono text-small text-fg-subtle">
                      {text[`c${i}`]}
                    </El>
                  </El>
                  <Title ct={`p${i}`} class="absolute left-[832px] top-[32px]">
                    {text[`p${i}`]}
                  </Title>
                </div>
              ))}
            </div>
          </Stack>
        </div>
      </Safe>
    </Stage>
  ),
  motion: (m) => {
    m.enter("headline", "maskUp", { at: "b1", split: "words", ease: "expressive" });
    m.enter(ROWS.map((i) => `r${i}`), "rise", { at: "b2", stagger: "list" });
    m.enter(ROWS.map((i) => `p${i}`), "rise", { at: "b3", stagger: 0.28 });
    m.emphasize(["p0", "p2", "p3"], "dim", { at: "b4", stagger: 0 });
    m.camera({ scale: [1, 1.03] }, { origin: { x: 96, y: 540 } });
  },
});

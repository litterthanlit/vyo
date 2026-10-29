import { scene, Stage, Safe, Stack, Label, Headline, Window, Terminal } from "continuity";

// The reveal, under the light: the name, the claim on the left edge, and the scan itself in a
// terminal on the right. The results are the real scan of the recipe planner.
const LINES = [
  "$ make a poster of this repo",
  "✔ 6 screens",
  "✔ 3 requests",
  "✔ 4 kinds of saved data",
  "✔ sign-in, payments, email",
  "✔ 1 AI model, 1 weekly job",
];

export default scene({
  view: ({ text }) => (
    <Stage bg="lit">
      <Safe>
        <div class="absolute inset-y-0 left-0 flex items-center">
          <Stack gap={8} class="max-w-[720px]">
            <Label ct="label">{text.label}</Label>
            <Headline ct="title">{text.title}</Headline>
          </Stack>
        </div>
        <div class="absolute inset-y-0 right-[64px] flex items-center">
          <Window ct="term" title="recipe-planner" width={832} height={448}>
            <Terminal ct="sh" class="p-[48px]" lines={LINES} />
          </Window>
        </div>
      </Safe>
    </Stage>
  ),
  motion: (m) => {
    m.enter("label", "fade", { at: "b1" });
    m.enter("title", "maskUp", { at: "b1+0.08", split: "lines" });
    // b2: the product is placed: the scene's one moment.
    m.enter("term", "settle", { at: "b2" });
    m.type("sh-l0", { at: "b3", cps: 24 });
    m.enter(["sh-l1", "sh-l2", "sh-l3", "sh-l4", "sh-l5"], "rise", { at: "b4", stagger: 0.12 });
    m.camera({ scale: [1, 1.03] }, { origin: { x: 96, y: 540 } });
  },
});

import { scene, Stage, Safe, Stack, Headline, Body, Caption, Media } from "continuity";

// The output: two real posters Vyo drew, each in a shape that fits its product. They keep
// their own colours (treat none): they are the product's artifacts, not the film's type.
const W = 416;
const H = 588;

export default scene({
  view: ({ text }) => (
    <Stage>
      <Safe>
        <div class="absolute inset-y-0 left-0 flex items-center">
          <Stack gap={32} class="max-w-[720px]">
            <Headline ct="headline">{text.headline}</Headline>
            <Body ct="body">{text.body}</Body>
          </Stack>
        </div>
        <div class="absolute inset-y-0 right-0 flex items-center">
          <div class="flex gap-[32px]">
            <Stack gap={16}>
              <Media ct="poster0" src="assets/poster-recipe.png" treat="none" width={W} height={H} />
              <Caption ct="cap0">{text.cap0}</Caption>
            </Stack>
            <Stack gap={16}>
              <Media ct="poster1" src="assets/poster-hypher.png" treat="none" width={W} height={H} />
              <Caption ct="cap1">{text.cap1}</Caption>
            </Stack>
          </div>
        </div>
      </Safe>
    </Stage>
  ),
  motion: (m) => {
    m.enter("headline", "maskUp", { at: "b1", split: "lines" });
    m.enter("body", "rise", { at: "after:headline-0.2" });
    // b2: the first poster is placed: the scene's one moment.
    m.enter("poster0", "settle", { at: "b2" });
    m.enter("poster1", "rise", { at: "b3" });
    m.enter(["cap0", "cap1"], "fade", { at: "b4" });
    m.camera({ scale: [1, 1.03] }, { origin: { x: 96, y: 540 } });
  },
});

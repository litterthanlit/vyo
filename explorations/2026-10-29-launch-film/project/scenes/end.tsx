import { scene, Stage, Safe, Center, Headline, Body, El } from "continuity";

// End card: the film's one centred frame, in the light again. The wordmark's full stop is a
// filled accent circle: the film's one accent fill, Vyo's orange.
export default scene({
  view: ({ text }) => (
    <Stage bg="lit">
      <Safe>
        <Center>
          <div class="flex items-baseline">
            <Headline ct="wordmark">{text.wordmark}</Headline>
            <El ct="dot" class="ml-[10px] h-[26px] w-[26px] rounded-full bg-accent" />
          </div>
          <Body ct="tagline" class="mt-[32px]">
            {text.tagline}
          </Body>
        </Center>
      </Safe>
    </Stage>
  ),
  motion: (m) => {
    m.enter("wordmark", "settle", { at: "b1" });
    m.enter("dot", "fade", { at: "b1+0.12" });
    m.enter("tagline", "rise", { at: "b2" });
    m.camera({ scale: [1, 1.03] }, { ease: { type: "bezier", p: [0.33, 0, 0.67, 0.67] } });
  },
});

// Showcase: Block-style page 2 for Hypher (examples.md). The test prepends poster-kit.md + block-kit.md.
export default function ProjectStory() {
  const [showGrid, setShowGrid] = useCanvasState("showGridStory", false);
  const product = "Hypher";

  const sections: BlockItem[] = [
    { name: "In one breath", status: "label", weight: 3, lines: ["“Hypher is a workspace for solo builders who are tired of losing ideas across tabs. You capture a thought in seconds, see it on a canvas, and get a daily digest that keeps you moving.”"] },
    { name: "What to say", status: "label", weight: 2, numeral: 1, lines: ["“Most builders lose ideas across ten tabs — you get them back before they vanish.”"] },
    { name: "What to say", status: "label", weight: 2, numeral: 2, lines: ["“You capture a thought in seconds; the app lays it out on a canvas.”"] },
    { name: "What to say", status: "label", weight: 2, numeral: 3, lines: ["“Share a read-only link when you want feedback, not the keys to your code.”"] },
    { name: "What's real today", status: "live", weight: 2, lines: ["Capture, canvas, daily digest and share links all work today."] },
    { name: "Not yet", status: "soon", weight: 1, lines: ["Billing is not in the app yet."] },
    { name: "The vision", status: "label", weight: 2, lines: ["You built this because scattered thinking was costing you momentum. Now it has one place to live."] },
  ];

  return (
    <BlockSheet seed={product} colophon={`Project Story — 02 · ${product}`} audience="Pair with the App Guide — page 01" showGrid={showGrid} setShowGrid={setShowGrid}>
      <BlockFigure seed={product} title={{ tab: "Project Story — 02", tabSub: "For the owner — say it out loud", display: ["Your ideas,", "one place"] }} blocks={sections} />
    </BlockSheet>
  );
}

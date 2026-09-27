// Showcase: Block-style page 1 for Hypher (examples.md). The test prepends poster-kit.md + block-kit.md.
export default function AppPoster() {
  const [showGrid, setShowGrid] = useCanvasState("showGridApp", false);
  const product = "Hypher";

  const features: BlockItem[] = [
    { name: "Capture", status: "live", weight: 3, lines: ["Save a thought or a file in seconds and drop it into a project."] },
    { name: "Spatial canvas", status: "live", weight: 3, lines: ["Arrange notes on a canvas and draw the links between them."] },
    { name: "Daily digest", status: "live", weight: 2, lines: ["Each evening, an email of what changed across your projects."] },
    { name: "Share link", status: "live", weight: 1, lines: ["A read-only link to your canvas."] },
    { name: "Live sync", status: "behind", weight: 2, lines: ["Every open tab updates within a second."] },
    { name: "Billing", status: "soon", weight: 1, lines: ["Paid plans, planned next."] },
  ];

  return (
    <BlockSheet seed={product} colophon={`App Guide — 01 · ${product}`} audience="For the client handoff" showGrid={showGrid} setShowGrid={setShowGrid}>
      <BlockFigure
        seed={product}
        title={{ tab: "App Guide — 01", tabSub: "Web app · Solo builders", display: [product], sub: "A spatial project brain for solo builders — capture anywhere, see it on a canvas, get a daily digest." }}
        blocks={features}
      />
    </BlockSheet>
  );
}

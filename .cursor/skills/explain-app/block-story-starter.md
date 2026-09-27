# Block Story Starter (Page 2 — project story)

Structural reference for `<repo>-project-story.canvas.tsx` in the **Block** style. The file is **[poster-kit.md](poster-kit.md), then [block-kit.md](block-kit.md), then this page component**. Read [block-style.md](block-style.md) first.

- **Same `seed` (and `hue`) as page 1** — the same colour field brands the pair
- The tagline is the title block's display type, 72px over 2–3 short lines
- Blocks are the story's sections; paper tabs (`label`) name them, status tabs only where status is the point
- Talking points get numerals, mirroring the Swiss page's giant numbers

```tsx
export default function ProjectStory() {
  const [showGrid, setShowGrid] = useCanvasState("showGridStory", false);
  const product = "Product";

  const sections: BlockItem[] = [
    { name: "In one breath", status: "label", weight: 3, lines: ["“20-second script the owner can read aloud.”"] },
    { name: "What to say", status: "label", weight: 2, numeral: 1, lines: ["“First talking point.”"] },
    { name: "What to say", status: "label", weight: 2, numeral: 2, lines: ["“Second talking point.”"] },
    { name: "What to say", status: "label", weight: 2, numeral: 3, lines: ["“Third talking point.”"] },
    { name: "What's real today", status: "live", weight: 2, lines: ["Capability one", "Capability two"] },
    { name: "Not yet", status: "soon", weight: 1, lines: ["One honest limitation"] },
    { name: "The vision", status: "label", weight: 2, lines: ["Ownership language — why you built this."] },
  ];

  return (
    <BlockSheet seed={product} colophon={`Project Story — 02 · ${product}`} audience="Pair with the App Guide — page 01" showGrid={showGrid} setShowGrid={setShowGrid}>
      <BlockFigure seed={product} title={{ tab: "Project Story — 02", display: ["Emotional", "outcome"] }} blocks={sections} />
    </BlockSheet>
  );
}
```

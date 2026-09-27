# Block Poster Starter (Page 1 — feature map)

Structural reference for `<repo>-app-poster.canvas.tsx` in the **Block** style. The file is **[poster-kit.md](poster-kit.md), then [block-kit.md](block-kit.md), then this page component**. Read [block-style.md](block-style.md) first.

- The figure **is** the app: one black block per feature, in the order a user meets them
- `weight` 1–3 = how central the feature is (4 / 6 / 8 columns wide)
- `status` colours the tab: `live` yellow, `behind` blue, `soon` silver — the legend bar explains them
- One plain sentence per block, in white. No text ever sits directly on the colour field
- 3–8 feature blocks; more or fewer throws

```tsx
export default function AppPoster() {
  const [showGrid, setShowGrid] = useCanvasState("showGridApp", false);
  const product = "Product";

  const features: BlockItem[] = [
    { name: "Feature one", status: "live", weight: 3, lines: ["What the user can do here, in one sentence."] },
    { name: "Feature two", status: "live", weight: 2, lines: ["What the user can do here."] },
    { name: "Feature three", status: "live", weight: 2, lines: ["What the user can do here."] },
    { name: "Feature four", status: "behind", weight: 1, lines: ["Works, no screen yet."] },
    { name: "Feature five", status: "soon", weight: 1, lines: ["Planned next."] },
  ];

  return (
    <BlockSheet seed={product} colophon={`App Guide — 01 · ${product}`} audience="For [who is reading]" showGrid={showGrid} setShowGrid={setShowGrid}>
      <BlockFigure
        seed={product}
        title={{ tab: "App Guide — 01", tabSub: "[Platform · audience]", display: [product], sub: "One-sentence purpose, in plain English." }}
        blocks={features}
      />
    </BlockSheet>
  );
}
```

See [block-style.md](block-style.md) for how to choose weights and statuses.

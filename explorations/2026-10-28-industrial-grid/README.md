# Industrial grid mockups (throwaway)

Two rough takes on an "industrial grid" poster style for explain-app: monospace caps, a square 70px grid, tonal pixel cells, and an ASCII drawing at the centre. Both are drawn from a real scan of the Hypher repo (lines of code per part, which parts call each other).

| File | Idea |
|------|------|
| `a-panorama.png` | The code as a mountain range. One peak per part; taller peak, more code. Labelled like an alpine panorama board. |
| `b-plan.png` | The code as a floor plan. Rooms are parts, sized by code. A door means two rooms call each other. |

These came out of a brainstorm. They are not the skill and are not checked by `tools/poster.mjs`.

## Regenerate

```bash
node data.mjs <repo>-facts.json      # writes data.json (not committed)
node render.mjs a-panorama.html b-plan.html   # writes out/*.png
```

`data.mjs` takes a `facts.json` from `tools/scan.mjs scan`; its part groups are hard-coded for Hypher. `render.mjs` needs Playwright and the JetBrains Mono font installed.

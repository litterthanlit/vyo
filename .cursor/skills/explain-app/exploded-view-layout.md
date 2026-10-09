# Exploded View Layout (Page 3)

Section spec for `<repo-name>-exploded-view.canvas.tsx`. Read [swiss-design-principles.md](swiss-design-principles.md) first, including its [page 3 drawing exception](swiss-design-principles.md#page-3-drawing-exception).

Page 3 draws the app as a **small device taken apart**: an isometric stack of layers, from what you see on top to where your data lives at the bottom. A reader drags a slider to pull the layers apart and points at a layer to read what it does. It answers the question pages 1 and 2 can't answer visually: *what is this thing made of?*

| Page | File | Job |
|------|------|-----|
| 3 — Exploded View | `<repo-name>-exploded-view.canvas.tsx` | The parts of the app as a physical object, one plain sentence per part |

## From codebase to layers

Build the layers from the Phase 2 feature map. **Do not re-read the repo.** Pick **3 to 5** layers. The top layer is always `screens` and the bottom is always `data`. Order the middle ones to tell the story.

| `kind` | Default name | What it stands for in the code | `parts` = | Drawn as |
|--------|--------------|--------------------------------|-----------|----------|
| `screens` | What you see | Pages and routes a person visits | one per screen (≤ 24) | Lid with an inset panel and a dot per screen |
| `engine` | What runs on its own | Scheduled jobs, queues, automatic emails, anything that runs without a click | the automatic jobs (≤ 4) | Cooling fan |
| `brains` | The brains | Core features and the rules behind them | one chip per feature (≤ 4). Use `size: "l"` for the main one | Board with chips |
| `plate` | (your words) | A cross-cutting part worth its own layer, e.g. "Accounts", "Payments" | what it covers (≤ 4) | Plain plate with corner screws |
| `data` | Where your data lives | Database, file storage, and the outside services the app is plugged into | one port per **connected service** (≤ 4) | Thick base with vents and ports |

Rules:
- **Skip a layer that doesn't exist.** A site with no background work has no `engine`, so three layers is fine. Never draw a layer to fill space.
- **Each part is honest.** Only list what works today. Backend-only and planned work goes in the footer, using the same list as pages 1 and 2.
- **Name parts the way a user would**: "Daily digest", not "cron job". See [plain-language-rules.md](plain-language-rules.md#naming-layers-and-parts).
- **One `line` per layer**, written as "When you X, the app Y" (or "When [trigger], …" for the engine). It appears in the caption when the layer is selected.

## Grid rows

Same outer 12-column grid, 8px baseline and 64px margins as pages 1 and 2.

| Row | Columns | Content |
|-----|---------|---------|
| Folio + 2px rule | 12 | "Exploded View — 03" · "The app, taken apart" · product name |
| Masthead | 1–12 | Product name, 112px, red full stop — same as page 1 |
| Purpose | 1–7 | One sentence on what the drawing shows. Cols 8–12 stay empty |
| Section label | 1–12 | "Taken apart — drag to open, point at a layer to read it" |
| Drawing | 1–12 | `<figure>` with the SVG drawing in cols 1–8 and the labels on the **col 9 line** |
| Caption | 1–8 | Selected layer: folio "02 / 04 — The brains", then its "When you…" line (`aria-live`) |
| Controls | 1–12 | "Open layers" slider · percent · theme button (hidden in exports) |
| Footer | 12 | Not built yet · audience · Show grid |

The drawing is at most **704px** tall, so the poster stays under the 1300px warning. The starter shrinks the open gap automatically when there are 5 layers.

## Interaction

| Input | Result |
|-------|--------|
| Drag the slider, or ←/→/Home/End on it | Opens and closes the layers |
| Point at or click a layer or its label | Selects it: tint fill, ink outline, ink label, caption updates |
| Tab to the layer list, then ↑/↓ (Home/End) | Moves the selection through the layers |
| Theme button | Light paper ↔ dark blueprint |
| Show grid | The usual grid overlay |

State lives in `useCanvasState` under page 3 keys: `openExploded`, `layerExploded`, `themeExploded` and `showGridExploded`. Never reuse page 1 or page 2 keys. Exports use the defaults: light, 80% open, layer 01 selected.

## What not to do

- Don't add a sixth layer or a fifth chip. The starter throws an error; merge two parts instead.
- Don't hand-edit coordinates, sizes or label positions. Change the data and let the starter lay it out.
- Don't put SVG `<text>` in the drawing. Labels are HTML, so they stay on the type scale and inside the checker.
- Don't colour layers by meaning (blue for data, green for screens). The only colour is the tint on the selected layer.
- Don't use the drawing as a technical architecture diagram. If a label needs a file path or a library name to make sense, rewrite it.

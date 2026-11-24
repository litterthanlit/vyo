# Exploration E (`e-vyo-own`) — Vyo's Own Original Signature Grammar

> *"Make it look like our own thing! Make sure the agent draws whatever the repo is, as if they're explaining it in a poster."*

## What Makes This Unmistakably Vyo's Own Identity

Rather than mimicking Bloomsbury's book-cover lockup or Ashmera's top-right red tag, `e-vyo-own` establishes one cohesive, original **Vyo Refracted Print-Matrix Drafting Sheet** grammar across both light and dark grounds:

1. **Agent-Drawn 3-Layer SVG Scene (`scenes.mjs`)**:
   - The agent authors a bespoke `840×1190` 3-layer visual explanation specifically for the scanned repository:
     - `atmosphere` (Layer 1): pale context streams, surrounding aura, secondary structure.
     - `structure` (Layer 2): primary architectural forms, conduits, planes, pillars, waves.
     - `core` (Layer 3): focal hero subject representing the codebase's accent core.
   - Paired with **anchored plain-language micro-callouts** (`role: "core" | "part" | "whisper"`) positioned directly on the parts of the drawing they explain, with clean dot knockouts (`●` for core, `—` architectural micro-tick for part, quiet text for whisper).

2. **Codebase-Driven 7px Refracted Print-Matrix Engine (`engine.js`, `strata-data.mjs`)**:
   - Rasterizes all 3 SVG layers natively in Chromium (`840×1190`), then refracts them through real file/import horizontal strata slices snapped strictly to the `7px` lattice (`120×170` cells):
     - Slice height ∝ file LOC (`facts.json`).
     - Horizontal shear, 1D kinetic echo trails, and chromatic/tonal edge dispersion ∝ real cross-area import coupling.
     - Crisp 1-row architectural fault-line breaks at major module/layer boundaries.
   - Quantizes the refracted field into 3 distinct tactile print morphologies:
     - `atmosphere` → delicate fine squares (`2.6–4.0px`).
     - `structure` → sharp architectural squares (`4.3–5.6px`).
     - `core` → vivid circular beads/gems (`5.1–6.0px`, `rx = 0.46 * size`) with bright specular knots on dark grounds.

3. **Vyo Drafting-Sheet Editorial Chrome**:
   - Clean `40px` side margins, razor-thin `1px` top (`y = 58`) and bottom (`y = 1138`) structural hairlines with crisp `+` print registration crosshairs at all four endpoints.
   - Quiet `Commit Mono` top micro-index bar (`<PRODUCT> / <N> FILES · <LOC> LINES` left, `VYO SHEET · 01..04` right) and bottom colophon (`<repo> · <imports> cross-file links` left, `drawn from the codebase · no network` right).
   - Signature Vyo editorial type pairing: warm human `Newsreader` (50px regular) 2-line story paired with a single `●` `Commit Mono` legend line in the quiet upper-left breathing zone.

## Series Gallery (`840×1190` @ 2× DPR = `1680×2380px` + `280px` thumbs)

| Sheet | Repo | Real Facts | Palette | Bespoke Visual Explanation | Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | `vyo` | 71 files · 12,559 LOC · 228 imports | `sumi` (Obsidian + Glacier Slate + Vermilion) | Branching source streams → tilted vermilion refraction lens → cantilevered framed poster sheet | `out/vyo-own.png` |
| **02** | `Flask` | 36 files · 8,068 LOC · 94 imports | `washi` (Warm Archival Paper + Mineral Indigo + Vermilion) | Single incoming request conduit → vermilion aperture junction → 6 curved routing lanes inside concentric extension rings | `out/flask-own.png` |
| **03** | `Pantry` | 41 files · 593 LOC · 60 imports | `cobalt` (Archival Chalk + Charcoal Ink + Electric Klein Cobalt) | Drifting recipe arcs → 7 calm vertical day-pillars (`mon`–`sun`) unified by a sweeping Klein cobalt weekly wave | `out/pantry-own.png` |
| **04** | `Hypher` | 308 files · 47,675 LOC · 618 imports | `pine` (Deep Night-Forest + Celadon Silver + Molten Amber) | Two separated opposing agent crescent waves across a dark diagonal chasm bridged by a glowing folded amber handoff baton | `out/hypher-own.png` |

## Render

```bash
node render.mjs          # render all 4 sheets + 280px thumbs
node render.mjs flask    # render a single target
```

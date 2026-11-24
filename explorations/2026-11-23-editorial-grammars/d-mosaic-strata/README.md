# Exploration D — Mosaic × Strata (`d-mosaic-strata`)

Fuses **Exploration A (`a-mosaic`)** (crisp uniform 7px dot/square mosaic lattice, shape/size modulation, and sparse grid-locked plain-language micro-type) with **Exploration C (`c-strata`)** (real codebase LOC-driven horizontal slices, import-driven horizontal shear & chromatic RGB refraction, and Bloomsbury editorial poise).

## Posters Rendered

All four posters are rendered at **840×1190 logical @ 2× DPR (1680×2380px PNG)** plus crisp 2-step downscaled **280×397px** thumbnails (`-thumb.png`):

| Poster | Output | Codebase Facts | Mode & Visual Grammar |
| --- | --- | --- | --- |
| **1. Obsidian Signal Mosaic (vyo)** | `out/vyo-signal-mosaic.png` | `../facts/vyo-facts.json` (71 files, 12,559 LOC, 228 imports) | Deep obsidian (`#090A0D`), grid-aligned horizontal strata slices (84 slices), crimson circular beads (`tools/lib/fields`), glacier-cyan & amethyst squares, tight icy-white specular knots, 32 carved-slot plain-language micro-type readouts, Bloomsbury left-column typography. |
| **2. Obsidian Signal Mosaic (flask)** | `out/flask-signal-mosaic.png` | `flask-facts.json` (36 files, 8,068 LOC, 94 imports) | Same obsidian lattice grammar driven by Flask's leaner 50-slice architecture: taller stepped lower panes, concentrated request-core crimson spine, 31 plain-language micro-type readouts (zero code jargon). |
| **3. Obsidian Refracted Bloom (vyo)** | `out/vyo-bloom-strata.png` | `../facts/vyo-facts.json` (71 files, 12,559 LOC, 228 imports) | Organic multi-petal nocturnal botanical/branching form growing across the right two-thirds, passed through coupling-adaptive horizontal codebase slice displacement & cyan-paired chromatic refraction, quantized onto the 7px lattice with 30 plain-language readouts. |
| **4. Daylight Strata Mosaic (vyo)** | `out/vyo-daylight-strata.png` | `../facts/vyo-facts.json` (71 files, 12,559 LOC, 228 imports) | Cool alabaster gallery paper (`#F2F4F7`), `a-mosaic`'s 3-tier daylight palette (ice-mist `#D5DFE7`/`#C2D0DC`, deep slate `#345E7A`/`#4B7996`, electric crimson `#CB222B` circular beads), sculptural stepped horizontal strata with real layer fault crevices, clean plain-text `vyo` crimson tag (no icon), and 31 charcoal plain-language micro-type readouts. |

## Files

- `strata-data.mjs` — Real codebase facts JSON -> ordered horizontal strata model (band heights from LOC, horizontal shear & chromatic dispersion from cross-area import coupling, accent core classification).
- `bloom-data.mjs` — Real `vyo` codebase facts -> nocturnal right-column botanical/branching geometry for `vyo-bloom-strata`.
- `engine.js` — Browser-side HTML5 Canvas compositor implementing the uniform 7px mosaic lattice (`120×170` grid), grid-snapped horizontal slice refraction, carved-crevice sparse micro-type weaver, and editorial typography across all three render modes.
- `render.mjs` — Playwright renderer using bundled fonts from `.cursor/skills/vyo/fonts/` and Chrome/Chromium.

## Usage

```bash
node render.mjs                        # render all 4 posters + thumbnails
node render.mjs vyo-bloom-strata       # render a single poster by substring
```

## Iteration & Tuning Notes

- **Pass 1 -> Pass 2 refinements** (after full-resolution visual inspection):
  1. **Sanctuary breathing room**: Widened the obsidian left sanctuary around `THE DRAWING ENGINE · 12,559 LINES` so crimson flank dots never crowd the accent line.
  2. **Specular restraint**: Raised the pure-white specular threshold (`lum > 0.87`, `minRGB > 0.70`) so bright zones preserve cool glacier-cyan facet structure while reserving pure white for tight jewel-like peaks.
  3. **Cyan-paired chromatic dispersion on `vyo-bloom-strata`**: Paired green dispersion with blue (`dispG = -0.48 * disp`, `dispB = -0.88 * disp`) opposite warm crimson (`dispR = +0.92 * disp`), eliminating isolated stray green dots on thin botanical twigs and producing pure crimson ↔ glacier-cyan ↔ twilight-amethyst refraction.
  4. **Coupling-adaptive bloom shear**: Scaled horizontal displacement by real file cross-area coupling so petals and leaves remain unmistakably sculpted while high-coupling strata cut cleanly across the silhouette.
  5. **Micro-type legibility**: Added adjacent-glare avoidance on obsidian, cleared `tone >= 3` dots cleanly behind daylight charcoal phrases, adjusted baseline to `0.78 * PITCH` so descenders never graze neighboring rows, and added 1-row alabaster architectural fault cuts at codebase layer boundaries on `vyo-daylight-strata`.

# Exploration C — `c-strata` (Atmospheric Chromatic Strata)

An editorial book-cover grammar inspired by *Unstable Aesthetics: Game Engines and the Strangeness of Modding* (Bloomsbury): deep matte obsidian negative space on the left carrying razor-sharp architectural typography, balanced against sculptural, optically refracted horizontal strata cascading off the right and bottom edges.

## Posters

| Target | Real Codebase Facts | Slices | Output |
| :--- | :--- | ---: | :--- |
| **`vyo-strata`** | 71 files · 12,559 lines · 228 import edges · accent core: `tools/lib/fields` (19 files, 2,882 lines) | 93 | [`out/vyo-strata.png`](out/vyo-strata.png) / [`out/vyo-strata-thumb.png`](out/vyo-strata-thumb.png) |
| **`flask-strata`** | 36 files · 8,068 lines · 94 import edges · accent core: `src/flask/sansio` + request core (9 files, 4,194 lines) | 52 | [`out/flask-strata.png`](out/flask-strata.png) / [`out/flask-strata-thumb.png`](out/flask-strata-thumb.png) |

## Real Data → Visual Grammar Mapping

Implemented in [`strata-data.mjs`](strata-data.mjs) (zero hardcoded/fake statistics):

- **Top-to-bottom architectural ordering**: files sort cleanly from entry (`layer 0`) → highlighted focal core (`layer 1`) → core runtime/pipeline (`layer 2`) → secondary/scanner/examples (`layer 3`).
- **Stratum heights**: proportional to real file `loc^0.78`, producing dense, intricate crystal fractures for `vyo` (71 files) and broader, monumental geological slabs for `flask` (36 files dominated by `app.py` 1,371 LOC, `cli.py` 898 LOC, `sansio/app.py` 833 LOC, `scaffold.py` 647 LOC).
- **Horizontal shear & chromatic dispersion**: driven deterministically by real cross-area import degree (`crossDeg`) and net import direction (`outDeg - inDeg`). High cross-area hubs trigger larger horizontal step offsets, tighter micro-sub-slices, and wider RGB optical channel separation.
- **Focal accent ignition**: the highlighted core area (`tools/lib/fields` for `vyo`; `src/flask/sansio` + request core for `flask`) anchors the blazing icy-cyan/white specular knots and warm ember-crimson upper-left cloud in the upper-right focal mass.

## Optical Synthesis Pipeline

Implemented in [`synth.js`](synth.js) and rendered via Playwright + Chromium HTML5 Canvas at `840×1190 @ 2× DPR` (`1680×2380px`):

1. **Continuous HDR Sculptural Light-Field (`840×1190` float32 RGB)**: domain-warped 4-octave fBm + ridged-multifractal noise carving dark chiaroscuro cavities in the upper diagonal prism (`y = 8%–52%`), feeding seamlessly into four undulating nocturnal reflection rivers (`y = 44%–100%`) bleeding past the right and bottom edges.
2. **Native-2× Strata Slicing & Optical RGB Refraction (`1680×2380`)**: crisp horizontal fault cuts with per-stratum horizontal shear, rectangular crystal facets & irregular non-periodic vertical glass grain in the upper zone, and asymmetric RGB channel sampling (`R` left, `G` centered, `B` right) for authentic prismatic edge fringes.
3. **Strictly 1D Per-Scanline Horizontal Pixel-Sort Trails**: bidirectional exponential IIR smear per 2px scanline pair with jittered streak lengths — dissolving vertical color edges into silky horizontal light hairlines while preserving razor-sharp horizontal fault cuts between strata.
4. **Restrained Specular Bloom + Nocturnal Filmic Tone-Mapping + Matte Film Grain**: soft Gaussian halo only from peaks (`lum > 0.92`), velvety obsidian ground (`#0A0A0D`), left-column dark sanctuary protecting typographic legibility, and subtle photographic print grain.
5. **Vector Editorial Typography**: bundled fonts from `.cursor/skills/vyo/fonts/` (`Inter Display` 600 `#FFFFFF`, `Commit Mono` 400 `#8C9BB8`, `Commit Mono` 700 `#D24C5E`, `Newsreader` 400 `#C8C8CE` tracked at `0.54em`).

## Iteration & Tuning Notes

- **v1 → v2**: Fixed overexposure/white blowout (tightened specular radii, shifted to shadow-biased filmic S-curve, carved deeper obsidian cavities in upper mass & dark valley between ice-cyan spine and violet river, tightened title/accent sizing and left quiet sanctuary so `THE DRAWING ENGINE · 12,559 LINES` stays 100% legible over dark obsidian).
- **v2 → v3**: Calibrated palette from primary neon red/blue toward art-book dusty ember-vermilion, cool glacial powder-cyan, and twilight slate-amethyst; replaced periodic vertical sine striping with irregular multi-scale noise columns; widened upper-to-lower overlap (`y = 41%–56%`) to remove the mid-sheet brightness cliff.
- **v3 → v3.1**: Removed smooth 1D vertical wave displacement (`dy += med * 5.2`) from upper vertical grain after full-res visual inspection caught a faint wavy seam inside the brightest white crystal facet.

## Usage

```bash
node explorations/2026-11-23-editorial-grammars/c-strata/render.mjs
# or render a single target:
node explorations/2026-11-23-editorial-grammars/c-strata/render.mjs vyo
node explorations/2026-11-23-editorial-grammars/c-strata/render.mjs flask
```

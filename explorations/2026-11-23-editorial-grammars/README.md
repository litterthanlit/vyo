# Editorial Grammars Exploration (`2026-11-23-editorial-grammars`)

> *"Make sure the agent draws whatever the repo is, as if they're explaning it in a poster"*

This exploration charts the path from reference-inspired print studies to **`f-luminous`**, the winning visual grammar for Vyo: a **continuous HDR optical light-field → codebase-driven strata refraction → 7px luminous mosaic** paired with Vyo's own frameless editorial typography and bespoke, agent-drawn visual explanations.

---

## Progression Across Explorations

| Folder | Direction | What Worked | What Fell Short / Why We Moved On |
| :--- | :--- | :--- | :--- |
| [`a-mosaic/`](a-mosaic/) | **Botanical Pixel Mosaic** (`vyo`, `flask`) | Tactile `7px` screenprint dot/square lattice (`120×170`), 3-tier daylight palette (ice-mist / deep slate / crimson circular beads), sparse grid-locked plain-language micro-type. | Locked to botanical silhouettes and a top-right red pill borrowed from an Ashmera reference rather than explaining arbitrary repos. |
| [`b-cascade/`](b-cascade/) | **Translucent Vertical Cascade** (`vyo`, `pantry`) | True `multiply` risograph pigment grain, clean lower-third negative space, real LOC + import-driven color weaving across zones. | Abstract rain curtain; doesn't visually depict *what* a specific repo is in 0.5 seconds. |
| [`c-strata/`](c-strata/) | **Atmospheric Chromatic Strata** (`vyo`, `flask`) | Real file LOC → horizontal strata slice heights, real cross-area imports → horizontal shear & RGB chromatic dispersion, velvety obsidian chiaroscuro. | Purely abstract geological ribbons framed inside a Bloomsbury ALL-CAPS book-cover lockup. |
| [`d-mosaic-strata/`](d-mosaic-strata/) | **Mosaic × Strata Fusion** (`vyo`, `flask`) | Breakthrough material language: snapping real-codebase horizontal strata refraction + chromatic dispersion onto `a-mosaic`'s `7px` lattice with carved 1-row micro-type pockets (both obsidian and daylight alabaster). | Still mostly abstract strata (or a one-off bloom) using Bloomsbury/Ashmera editorial chrome instead of Vyo's own voice. |
| [`e-vyo-own/`](e-vyo-own/) | **Flat 3-Layer SVG Drafting Sheets** (`vyo`, `flask`, `pantry`, `hypher`) | Proved one repo = one bespoke visual explanation across 4 completely different products, with anchored plain-language callouts. | **Visual regression:** rasterizing flat solid-fill SVG diagrams (arrows, crisp geometric icons, uniform blocks) through a `7px` mosaic flattened them into retro clip-art, and the `+`-crosshair hairline drafting frame felt heavy and templated. |
| **[`f-luminous/`](f-luminous/)** | **Luminous Optical Mosaic — Winning Direction** (`vyo`, `hypher`, `flask`, `pantry`) | **Solved both problems at once:** bespoke 3D-lit optical subjects (soft directional rim highlights, carved dark shadow valleys, atmospheric falloff) refracted through real codebase LOC/import strata via a spatial `refractMask`, quantized onto the `7px` luminous mosaic, and paired with **Vyo's own frameless typography** (`▪ repo / files · lines` + one calm sentence-case `Inter Display` headline + 1-line color legend). | Ready to productize into `.cursor/skills/vyo/`. |

### Why Flat SVG Diagrams Regressed in `e-vyo-own` (and How `f-luminous` Fixed It)

Quantizing a flat 3-color vector diagram onto a `7px` lattice destroys smooth curves while offering no tonal gradient for dot size, shape morphology, or specular highlights to grab onto—turning architecture explanations into blocky clip-art. `f-luminous` keeps bespoke per-repo storytelling, but moves the input from flat fills to a **soft-lit continuous light-field** (rim light, shadow cavities, translucent glow, multi-stop color depth) plus a **spatial `refractMask`** that keeps the primary recognizable form crisp in 0.5 seconds while unleashing full codebase-driven strata refraction across wakes, waterfalls, ripples, and horizons.

---

## How to Run Any Exploration

### Prerequisites

- Node.js 22+
- Playwright installed in `.cursor/skills/vyo` (`npm --prefix .cursor/skills/vyo install`)
- Chromium or Google Chrome available via `VYO_CHROMIUM` (defaults to `/usr/bin/google-chrome` when unset)

All `vyo` facts are committed locally at [`facts/vyo-facts.json`](facts/vyo-facts.json), and the companion repo scans (`flask`, `pantry`, `hypher`) resolve automatically from `explorations/2026-11-11-punk-covers/c-living/facts/`. No `/tmp/` files or network calls are required.

### Commands

Run from the repository root (or inside any exploration subfolder):

```bash
# Winning direction — renders vyo, hypher, flask, pantry (1680×2380 + 280px thumbs)
VYO_CHROMIUM=/usr/bin/google-chrome node explorations/2026-11-23-editorial-grammars/f-luminous/render.mjs

# Render a single target (supported by c-strata, d-mosaic-strata, e-vyo-own, f-luminous)
VYO_CHROMIUM=/usr/bin/google-chrome node explorations/2026-11-23-editorial-grammars/f-luminous/render.mjs hypher

# Earlier explorations in progression order
VYO_CHROMIUM=/usr/bin/google-chrome node explorations/2026-11-23-editorial-grammars/a-mosaic/render.mjs
VYO_CHROMIUM=/usr/bin/google-chrome node explorations/2026-11-23-editorial-grammars/b-cascade/render.mjs
VYO_CHROMIUM=/usr/bin/google-chrome node explorations/2026-11-23-editorial-grammars/c-strata/render.mjs
VYO_CHROMIUM=/usr/bin/google-chrome node explorations/2026-11-23-editorial-grammars/d-mosaic-strata/render.mjs
VYO_CHROMIUM=/usr/bin/google-chrome node explorations/2026-11-23-editorial-grammars/e-vyo-own/render.mjs
```

Outputs are written to `<exploration>/out/*.(png|-thumb.png)`.

---

## Handoff Notes: Wiring `f-luminous` into `.cursor/skills/vyo/`

The core architectural goal when promoting `f-luminous` into the production skill is a clean separation between a **universal optical rendering engine** and an **agent-authored soft-lit subject spec**, so agents draw *whatever the repo is* instead of falling back to the 22 pre-made silhouettes in `.cursor/skills/vyo/tools/lib/silhouettes.mjs`.

### 1. Split the Engine from the Subject

| Layer | Responsibility | Source Reference in `f-luminous` |
| :--- | :--- | :--- |
| **Codebase Strata Model** (universal) | Converts `facts.json` into row-snapped horizontal strata (`y0..y1` from file `LOC^p`, horizontal shear & chromatic dispersion from real cross-area imports, accent core tagging, architectural layer fault lines). | [`f-luminous/strata-data.mjs`](f-luminous/strata-data.mjs) |
| **Optical Mosaic & Typography Engine** (universal) | Takes a soft-lit subject light-field + `refractMask` + codebase strata model, applies spatially-masked horizontal slice refraction and cyan-paired RGB edge dispersion, ACES tone-mapping (`obsidian` `#090A0D` or `alabaster` `#F2F3F6`), `7px` lattice quantization (squares for structure/atmosphere, circular beads for focal accent, tight icy-white specular peaks), carved 1-row plain-language micro-type pockets, and Vyo's frameless typography (`▪ repo / files · lines`, 2-line sentence-case `Inter Display 600` headline, 1-line color legend). | [`f-luminous/engine.js`](f-luminous/engine.js) |
| **Agent-Authored Soft-Lit Subject** (bespoke per repo) | Supplied by the agent in the poster spec to visually explain the target repo in 0.5 seconds. **Must not be a flat silhouette or one of 22 canned shapes.** | [`f-luminous/subjects.js`](f-luminous/subjects.js) (4 hand-sculpted exemplars) |

### 2. Recommended Agent-Authored Subject Format

Agents shouldn't need to write 200 lines of raw pixel-loop JavaScript (`subjects.js`) on every run, nor should they draw flat hard-edged SVGs (`e-vyo-own`). Support a **soft-lit subject spec** that rasterizes cleanly in Chromium into the engine's continuous optical channels:

- **Primary path — Soft-Lit SVG Scene (with `<feGaussianBlur>`, radial/linear `<gradient>`s, translucent layers, and dark carved shadow shapes):**
  - The agent authors a self-contained `840×1190` SVG (or split `baseLight`, `accentGlow`, `refractMask` SVG layers) using soft directional gradients, Gaussian-blurred glow halos, dark obsidian shadow cavities, and feathered atmospheric falloff—no flat solid-color strokes, no diagram arrows, no thin 1px clip-art outlines.
  - Chromium rasterizes the soft-lit SVG directly into offscreen canvas `Float32` channels that feed the exact same strata-refraction + `7px` mosaic pipeline in `engine.js`.
- **Optional structured alternative — Heightfield / Sculptural Primitives:**
  - Composable soft-lit volumetric forms (beveled wedges/prisms, folded planes with lit/dim faces & crease glow, glowing cores with concentric caustic rings, layered ridge/hill silhouettes) with explicit light direction, rim-light width, shadow-valley carving, and `refractMask` falloff.

### 3. Concrete Integration Touchpoints in `.cursor/skills/vyo/`

1. **Engine & field module (`tools/lib/fields/` + `tools/lib/render.mjs`):**
   - Port `strata-data.mjs` and `engine.js` into `.cursor/skills/vyo/tools/lib/` as the new `luminous` field/frame pipeline (supporting `theme: "obsidian" | "alabaster"` and deterministic seed).
   - Keep font loading (`Inter Display 600`, `Commit Mono 400/700`) via the existing bundled `.cursor/skills/vyo/fonts/` directory.
2. **Poster spec & validation (`tools/lib/spec.mjs`, `tools/lib/check.mjs`):**
   - Add fields for the soft-lit subject (`subject.svg` or channel SVGs + `sanctuary` typography box + zone-anchored `microType` phrases with `{ text, u, v, style }`).
   - Enforce automated checks: zero code jargon in `microType` and headline (reuse `tools/lib/jargon.mjs`), typography sanctuary clearance (zero bright mosaic dots colliding with headline/header/legend), and non-flat tonal richness check (reject subjects whose rasterized luminance histogram is mostly 1–2 flat buckets—catching `e-vyo-own`-style clip-art regressions automatically).
3. **Skill instructions (`SKILL.md`):**
   - Make `f-luminous` the primary poster path and **deprecate/demote the 22 pre-made shapes in `tools/lib/silhouettes.mjs`** (at most keep them as legacy cover fallbacks, never the default).
   - Guide the agent to: (1) scan the repo (`vyo scan`), (2) invent one unmistakable visual metaphor for what the product *does*, (3) author a soft-lit SVG/light-field with rim highlights, carved shadow valleys, and a single crimson/accent focal heart, (4) place 20–28 zone-anchored plain-language micro-phrases, and (5) inspect both the full-res PNG and `280px` thumbnail for 0.5-second recognizability and clean left-column breathing room.

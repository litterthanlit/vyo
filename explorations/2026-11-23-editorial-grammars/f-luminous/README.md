# Exploration F — `f-luminous`

**Optical Light-Field → Codebase Strata Refraction → 7px Luminous Mosaic**

Exploration F pairs the lush chiaroscuro optical materiality of `d-mosaic-strata` with **bespoke 3D-lit sculptural subjects** that genuinely explain what each repository *is* in 0.5 seconds, plus **Vyo's own original frameless Swiss-Japanese typographic voice**.

## What Changed vs. Earlier Explorations

- **No flat clip-art quantization (`e-vyo-own` lesson):** Every subject is painted into a continuous HDR multi-channel optical light-field (`subjects.js`) using soft directional rim highlights, carved dark obsidian shadow valleys, domain-warped FBM/ridge atmospheric falloff, and multi-stop chromatic transitions (`ember-crimson ↔ icy-white specular ↔ glacier-cyan ↔ sapphire-cobalt ↔ twilight-amethyst` on obsidian `#090A0D`; `ice-mist ↔ sculpted slate-indigo ↔ vermilion-crimson` on gallery alabaster `#F2F3F6`).
- **Spatially-aware codebase strata refraction (`engine.js`, `strata-data.mjs`):** Real file LOC drives 7px-row-snapped horizontal slice heights and real cross-area imports drive horizontal shear and cyan-paired RGB edge dispersion. A continuous spatial `refractMask` preserves razor-clear 0.5-second sculptural recognition on each primary focal form while unleashing full kinetic horizontal strata refraction across trailing wakes, waterfalls, outer ripples, and lower hills.
- **Vyo's original frameless typographic voice:** Zero `+` drafting frames, zero border rules, zero top-right pill, zero ALL-CAPS book-cover stack. Just a quiet `Commit Mono` header tag anchored by a single focal-crimson mosaic cell (`▪ repo / files · lines`), ONE calm sentence-case `Inter Display 600` headline (`-0.03em` tracking, `1.08` line-height), and a muted 1-line color legend floating in negative space.
- **Zone-aware grid-snapped micro-type:** 24–27 plain-language phrases and single-word whispers per poster (zero code jargon), anchored to their true semantic region in each visual metaphor and set inside carved 1-row obsidian or alabaster pockets on the 7px lattice.

## Four Bespoke Renders (`840×1190 @ 2× DPR = 1680×2380px`)

| Repo | Output | Theme | Optical Subject | Stats (from real `facts.json`) |
| --- | --- | --- | --- | --- |
| **vyo** | `out/vyo-luminous.png` | Obsidian `#090A0D` | Translucent 3D optical prism catching an upper-left mist beam and splitting it into a refracted crimson/cyan/amethyst spectrum waterfall | 71 files · 12,559 lines · 228 imports |
| **hypher** | `out/hypher-luminous.png` | Obsidian `#090A0D` | Monumental folded origami glider soaring upward-right with a blazing ember-crimson crease (handoff note), carved deep keel shadow valley, and kinetic slipstream wake | 308 files · 47,675 lines · 618 imports |
| **flask** | `out/flask-luminous.png` | Obsidian `#090A0D` | Compact incandescent ember-crimson & white-pearl core seed cradled by a dark obsidian moat, blossoming outward into concentric glowing caustic ripples | 36 files · 8,068 lines · 94 imports |
| **pantry** | `out/pantry-luminous.png` | Alabaster `#F2F3F6` | Seven overlapping East Asian ink-wash terraced harvest hills (`mon`–`sun`) unified by one continuous sweeping vermilion-crimson weekly dinner tide | 41 files · 593 lines · 60 imports |

## Render Usage

```bash
node render.mjs          # renders all 4 posters + 280px -thumb.png thumbnails
node render.mjs flask    # renders a single target by substring
```

## Visual Iteration Notes (Pass 1 → Pass 2 → Final)

1. **`vyo-luminous`:** Pass 1 had a slight collision between `"anyone"` and the left waterfall edge, and an overly bright incoming mist beam that merged with the prism's left facet. Pass 2 cooled the incoming mist beam to twilight slate-cobalt, carved darker translucent obsidian-indigo crystal facets so the prism triangle + internal crimson caustic read unmistakably in 0.5s, and widened the left sanctuary (`uMax: 0.515`) for generous velvety breathing room.
2. **`hypher-luminous`:** Pass 2 deepened the dark carved shadow valley right underneath the molten-crimson crease (`dKeelCavity`) and toned the upper-left sunlit wing from blown white into rich luminous glacier-cyan (keeping icy-white specular strictly on the nose & razor leading edge).
3. **`flask-luminous`:** Pass 1's red core spread too widely across the upper-right quadrant; Pass 2 tightened the ember seed into a compact jewel-like crimson/white-pearl core surrounded by a deep dark obsidian moat and four crisp concentric optical ripples, then widened the left typography sanctuary (`uSoft: 0.425, uMax: 0.505`) so zero faint whisper dots touch `"grown only as far"`.
4. **`pantry-luminous`:** Pass 1 had a fragmented mid crimson band plus a competing upper-right crimson echo; Pass 2 unified the vermilion-crimson weekly plan into ONE continuous, softly feathered horizontal tide gliding through the seven terraced hills, and improved alabaster micro-type carving for crisp charcoal legibility.

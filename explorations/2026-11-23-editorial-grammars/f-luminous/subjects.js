// Exploration F (f-luminous): Bespoke Continuous HDR Optical Light-Field Sculptors (Pass 2 — Museum Polish)
// Every subject is sculpted in continuous 3D-lit light, directional rim highlights,
// carved dark shadow canyons, feathered atmospheric mist, and multi-stop chromatic depth.
// ZERO flat solid-color fills, ZERO diagram arrows, ZERO clip-art primitives.

(function () {
  "use strict";

  const W = 840;
  const H = 1190;
  const PITCH = 7;
  const COLS = Math.floor(W / PITCH); // 120
  const ROWS = Math.floor(H / PITCH); // 170
  const AR = W / H; // 0.70588 — aspect-corrected Euclidean distances

  function segDist(u, v, ax, ay, bx, by) {
    const pax = (u - ax) * AR;
    const pay = v - ay;
    const bax = (bx - ax) * AR;
    const bay = by - ay;
    const denom = bax * bax + bay * bay || 1e-9;
    const t = Math.max(0, Math.min(1, (pax * bax + pay * bay) / denom));
    const dx = pax - bax * t;
    const dy = pay - bay * t;
    const len = Math.sqrt(denom);
    const cross = (pax * bay - pay * bax) / len;
    return { dist: Math.hypot(dx, dy), t, signed: cross };
  }

  function triSDF(u, v, a, b, c) {
    const area2 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const p0 = a;
    const p1 = area2 >= 0 ? b : c;
    const p2 = area2 >= 0 ? c : b;

    const e0 = segDist(u, v, p0[0], p0[1], p1[0], p1[1]);
    const e1 = segDist(u, v, p1[0], p1[1], p2[0], p2[1]);
    const e2 = segDist(u, v, p2[0], p2[1], p0[0], p0[1]);

    const inside = e0.signed <= 0 && e1.signed <= 0 && e2.signed <= 0;
    const d = Math.min(e0.dist, e1.dist, e2.dist);
    return inside ? -d : d;
  }

  function buildRowProfiles(model) {
    const rowEnergy = new Float32Array(H);
    const rowAccent = new Float32Array(H);
    const rowCross = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      let e = 0.35,
        ac = 0,
        cr = 0;
      for (let i = 0; i < model.strata.length; i++) {
        const s = model.strata[i];
        if (v >= s.y0 && v <= s.y1) {
          e = s.energy;
          ac = s.isAccent ? 1 : 0;
          cr = s.crossNorm;
          break;
        }
      }
      rowEnergy[y] = e;
      rowAccent[y] = ac;
      rowCross[y] = cr;
    }

    const smooth1D = (arr, rad) => {
      const out = new Float32Array(arr.length);
      for (let i = 0; i < arr.length; i++) {
        let sum = 0,
          cnt = 0;
        for (let k = -rad; k <= rad; k++) {
          const j = i + k < 0 ? 0 : i + k >= arr.length ? arr.length - 1 : i + k;
          sum += arr[j];
          cnt++;
        }
        out[i] = sum / cnt;
      }
      return out;
    };

    return {
      eSmooth: smooth1D(rowEnergy, 14),
      aSmooth: smooth1D(rowAccent, 20),
      cSmooth: smooth1D(rowCross, 14),
    };
  }

  // =========================================================================
  // SUBJECT 1: VYO — LUMINOUS OPTICAL PRISM & REFRACTED SPECTRUM WATERFALL
  // =========================================================================
  function sculptVyoPrism(model, M) {
    const { makeNoise, mulberry32, smoothstep, clamp, gauss } = M;
    const hdr = new Float32Array(W * H * 3);
    const refractMask = new Float32Array(COLS * ROWS);

    const nA = makeNoise(model.seed ^ 0x9e3779b9);
    const nB = makeNoise(model.seed ^ 0x517cc1b7);
    const nC = makeNoise(model.seed ^ 0xc2b2ae35);
    const rng = mulberry32(model.seed ^ 0x13579bdf);
    const { eSmooth, aSmooth } = buildRowProfiles(model);

    // Sculpted 3D optical glass prism wedge hovering cleanly upper-center-right
    // Shifted slightly right so the left sanctuary holds wide velvety breathing room past "anyone"!
    const A = [0.645, 0.125]; // crisp upper crystal apex
    const B = [0.445, 0.348]; // lower-left entry corner
    const C = [0.855, 0.378]; // lower-right exit corner
    const P = [0.635, 0.285]; // internal 3D faceted ridge vertex

    const p1 = rng() * 6.28;
    const p2 = rng() * 6.28;
    const p3 = rng() * 6.28;

    // Refraction envelope: razor-clear crystal prism facets above (0.24),
    // ramping smoothly into lush kinetic signal-mosaic spectrum waterfall below (1.06)!
    for (let row = 0; row < ROWS; row++) {
      const v = (row + 0.5) / ROWS;
      for (let col = 0; col < COLS; col++) {
        const u = (col + 0.5) / COLS;
        const dPrism = triSDF(u, v, A, B, C);
        const nearPrism = 1 - smoothstep(-0.01, 0.075, dPrism);
        const waterfall = smoothstep(0.37, 0.53, v);
        refractMask[row * COLS + col] = clamp(0.38 + 0.72 * waterfall - 0.16 * nearPrism, 0.22, 1.12);
      }
    }

    for (let y = 0; y < H; y++) {
      const v = y / H;
      const re = eSmooth[y];
      const ra = aSmooth[y];

      // Lower refracted spectrum waterfall river centers (shifted slightly right for generous typography margin!)
      const fallT = smoothstep(0.36, 0.96, v);
      const r1X = 0.558 + Math.sin(v * 5.8 + p1) * 0.020 - 0.020 * fallT; // Molten ember crimson river
      const r2X = 0.672 + Math.sin(v * 5.1 + p2) * 0.019 + 0.008 * fallT; // Glacier cyan specular spine
      const r3X = 0.832 + Math.sin(v * 4.5 + p3) * 0.020 + 0.016 * fallT; // Cobalt & twilight amethyst
      const r4X = 0.972 + Math.sin(v * 3.8 + p1) * 0.016; // Right-edge plum bleed

      const fallEnv = smoothstep(0.33, 0.45, v);
      const topFade = smoothstep(0.032, 0.09, v);

      for (let x = 0; x < W; x++) {
        const u = x / W;
        const wx = nA.fbm(u * 4.2 + 1.2, v * 3.8 + 0.7, 3) - 0.5;
        const wy = nB.fbm(u * 4.2 + 3.9, v * 3.8 + 2.5, 3) - 0.5;
        const wu = u + wx * 0.080;
        const wv = v + wy * 0.072;

        const cloud = nA.fbm(wu * 5.4, wv * 5.0, 4);
        const ridge = nB.ridge(wu * 6.8 + 2.0, wv * 6.2 + 1.2, 4);
        const fine = nC.fbm(u * 6.2 + wx * 0.04, v * 2.1 + 3.2, 4);
        const swell = nB.fbm(u * 2.8 + 1.1, v * 3.4 + 5.8, 3);

        let r = 0,
          g = 0,
          b = 0;

        const dPrism = triSDF(u, v, A, B, C);
        const dLeft = segDist(u, v, A[0], A[1], B[0], B[1]); // lit entry face
        const dRight = segDist(u, v, A[0], A[1], C[0], C[1]); // right crystal bevel
        const dBase = segDist(u, v, B[0], B[1], C[0], C[1]); // lower dispersion base
        const dRidgeA = segDist(u, v, A[0], A[1], P[0], P[1]);
        const dRidgeB = segDist(u, v, B[0], B[1], P[0], P[1]);
        const dRidgeC = segDist(u, v, C[0], C[1], P[0], P[1]);

        // ---- 1. SLEEK INCOMING ATMOSPHERIC CODE MIST BEAM (upper-left -> left prism face) ----
        // Moody cool lavender-cobalt mist (NO white blowout!) narrowing gracefully into the prism's entry point!
        const entryPt = [0.545, 0.236];
        const beamSeg = segDist(u, v, 0.05, 0.168, entryPt[0], entryPt[1]);
        const beamWidth = 0.044 * (1 - 0.58 * beamSeg.t) + 0.010 * cloud;
        const outsideLeft = smoothstep(0.002, 0.022, dPrism);
        const beamMask = smoothstep(0.05, 0.24, u) * (1 - smoothstep(0.51, 0.565, u)) * outsideLeft;
        const beamCore = gauss(beamSeg.dist, beamWidth) * beamMask;
        const beamWisps = 0.36 + 0.72 * smoothstep(0.24, 0.78, cloud * 0.65 + ridge * 0.45);
        const beam = beamCore * beamWisps * (0.58 + 0.55 * beamSeg.t);

        // Cool slate-cobalt & twilight-lavender mist (kept well below specular white!)
        r += beam * 0.28;
        g += beam * 0.44;
        b += beam * 0.86;

        // Crisp narrow glacier-cyan light ray focusing right onto the left prism facet
        const rayCore = gauss(beamSeg.dist + (cloud - 0.5) * 0.008, 0.009) * beamMask * (0.65 + 0.55 * beamSeg.t);
        r += rayCore * 0.42;
        g += rayCore * 0.78;
        b += rayCore * 1.12;

        // ---- 2. SCULPTED 3D TRANSLUCENT OPTICAL PRISM WEDGE ----
        const inPrism = 1 - smoothstep(-0.008, 0.012, dPrism);
        const prismHalo = Math.exp(-Math.max(0, dPrism) * 32.0) * (0.32 + 0.55 * cloud);
        r += prismHalo * 0.10;
        g += prismHalo * 0.18;
        b += prismHalo * 0.38;

        if (inPrism > 0.001) {
          const leftFacet = 1 - smoothstep(-0.008, 0.020, triSDF(u, v, A, B, P));
          const rightFacet = 1 - smoothstep(-0.008, 0.020, triSDF(u, v, A, P, C));
          const baseFacet = 1 - smoothstep(-0.008, 0.020, triSDF(u, v, B, C, P));

          // Intentionally translucent dark obsidian-indigo glass interior so edges & internal crimson caustic POP!
          // Left facet: soft glacier-cyan glass shimmer strongest near entry edge
          const leftGlass = leftFacet * (0.20 + 0.56 * Math.exp(-dLeft.dist * 16.0)) * (0.68 + 0.42 * ridge);
          r += inPrism * leftGlass * 0.30;
          g += inPrism * leftGlass * 0.74;
          b += inPrism * leftGlass * 1.06;

          // Right facet: deep shadowed cobalt-amethyst crystal face (true 3D chiaroscuro!)
          const rightGlass = rightFacet * (0.14 + 0.36 * Math.exp(-dRight.dist * 15.0)) * (0.60 + 0.48 * cloud);
          r += inPrism * rightGlass * 0.24;
          g += inPrism * rightGlass * 0.22;
          b += inPrism * rightGlass * 0.72;

          // Base facet: subtle internal dispersion sheen pouring toward the waterfall
          const baseGlass = baseFacet * (0.24 + 0.44 * Math.exp(-dBase.dist * 14.0)) * (0.65 + 0.45 * ridge);
          r += inPrism * baseGlass * 0.36;
          g += inPrism * baseGlass * 0.48;
          b += inPrism * baseGlass * 0.86;

          // Deep carved 3D dark crystal crease along the vertical & right internal bevels
          const bevelShadow = 1 - 0.76 * gauss(dRidgeA.dist, 0.014) - 0.58 * gauss(dRidgeC.dist, 0.014);
          const sClamp = Math.max(0.18, bevelShadow);
          r *= sClamp;
          g *= sClamp;
          b *= sClamp;

          // MOLTEN EMBER-CRIMSON INTERNAL REFRACTION CAUSTIC cutting diagonally through the prism heart!
          const dCaustic = segDist(u, v, entryPt[0], entryPt[1], 0.695, 0.362);
          const causticWidth = 0.016 + 0.032 * dCaustic.t; // fans wider as it disperses inside the crystal!
          const causticCore = gauss(dCaustic.dist + (cloud - 0.5) * 0.010, causticWidth) * inPrism;
          const crimInternal = causticCore * (0.95 + 0.55 * ridge);
          r += crimInternal * 1.45;
          g += crimInternal * 0.14;
          b += crimInternal * 0.18;

          // Secondary cyan-indigo spectral ray fanning beside the crimson caustic inside the prism
          const dCyanRay = segDist(u, v, entryPt[0], entryPt[1], 0.775, 0.368);
          const cyanInternal = gauss(dCyanRay.dist, 0.014 + 0.026 * dCyanRay.t) * inPrism * (0.70 + 0.45 * ridge);
          r += cyanInternal * 0.34;
          g += cyanInternal * 0.88;
          b += cyanInternal * 1.18;
        }

        // Razor-crisp optical glass prism rim-lighting (makes the triangular crystal unmistakable in 0.5s!)
        const leftRim = gauss(dLeft.dist, 0.0085) * (0.78 + 0.42 * ridge);
        const rightRim = gauss(dRight.dist, 0.0080) * (0.62 + 0.38 * cloud);
        const baseRim = gauss(dBase.dist, 0.0085) * (0.52 + 0.40 * ridge);
        const innerGlint = gauss(dRidgeB.dist, 0.0065) * 0.38 * inPrism;
        // Tight icy-white specular knots ONLY at the entry strike point and apex tip!
        const entryKnot = Math.exp(-Math.pow((u - entryPt[0]) / 0.026, 2) - Math.pow((v - entryPt[1]) / 0.022, 2));
        const apexKnot = Math.exp(-Math.pow((u - A[0]) / 0.022, 2) - Math.pow((v - A[1]) / 0.020, 2));

        r += leftRim * 0.72 + rightRim * 0.46 + baseRim * 0.42 + innerGlint * 0.48 + entryKnot * 1.48 + apexKnot * 1.24;
        g += leftRim * 1.26 + rightRim * 0.64 + baseRim * 0.68 + innerGlint * 0.82 + entryKnot * 1.82 + apexKnot * 1.54;
        b += leftRim * 1.54 + rightRim * 1.12 + baseRim * 0.98 + innerGlint * 1.08 + entryKnot * 2.02 + apexKnot * 1.82;

        // ---- 3. SWEEPING REFRACTED SPECTRUM WATERFALL (bleeding off right & bottom!) ----
        if (fallEnv > 0.001) {
          const swellM = 0.58 + 0.54 * swell;
          const fineM = 0.58 + 0.54 * fine;
          const dataBoost = 0.88 + 0.32 * re;

          // Emerging spectral exit flare at right-lower prism base
          const exitFlare =
            Math.exp(-Math.pow((u - 0.745) / 0.085, 2) - Math.pow((v - 0.405) / 0.055, 2)) *
            (0.62 + 0.48 * ridge) *
            smoothstep(0.34, 0.41, v);
          r += exitFlare * 0.88;
          g += exitFlare * 1.24;
          b += exitFlare * 1.52;

          // River 1: Vivid molten ember-crimson left dispersion cascade
          const g1 = gauss(u - r1X, 0.052 + 0.011 * swell);
          const g1Tail = gauss(u - (r1X - 0.054), 0.056) * 0.30;
          const crimPulse = 0.70 + 0.40 * Math.sin(v * 10.8 + p1);
          const crimRiv = (g1 * 1.10 + g1Tail) * swellM * crimPulse * fallEnv * dataBoost * (0.90 + 0.25 * ra);
          r += crimRiv * 1.18;
          g += crimRiv * 0.14;
          b += crimRiv * 0.17;

          // River 2: Luminous glacier-cyan & icy-white specular dispersion spine
          const g2Core = gauss(u - r2X, 0.031 + 0.006 * fine);
          const g2Halo = gauss(u - (r2X + 0.018), 0.060) * 0.52;
          const cyanPulse = 0.68 + 0.38 * Math.sin(v * 13.0 + p2) * 0.5 + 0.34 * fine;
          const cyanRiv = (g2Core * 1.22 + g2Halo * 0.56) * cyanPulse * fallEnv * dataBoost;
          r += cyanRiv * 0.52;
          g += cyanRiv * 0.96;
          b += cyanRiv * 1.26;

          // Rose-mauve transition where crimson kisses glacier-cyan
          const kiss = gauss(u - 0.5 * (r1X + r2X), 0.024) * 0.40 * fineM * fallEnv;
          r += kiss * 0.78;
          g += kiss * 0.22;
          b += kiss * 0.52;

          // Deep carved obsidian shadow canyon between River 2 & River 3
          const canyon = 1 - 0.78 * gauss(u - (0.752 + Math.sin(v * 4.4) * 0.014), 0.032) * smoothstep(0.43, 0.56, v);

          // River 3: Rich cobalt & twilight-amethyst refracted cascade
          const g3 = gauss(u - r3X, 0.070 + 0.014 * fine);
          const vioRiv = g3 * (0.62 + 0.48 * fineM) * fallEnv * dataBoost;
          r += vioRiv * 0.42;
          g += vioRiv * 0.38;
          b += vioRiv * 0.84;

          const lavGlint = gauss(u - (r3X - 0.020), 0.030) * smoothstep(0.48, 0.84, fine) * fallEnv;
          r += lavGlint * 0.46;
          g += lavGlint * 0.54;
          b += lavGlint * 0.88;

          // River 4: Velvety slate-plum right-edge bleed
          const g4 = gauss(u - r4X, 0.092) + smoothstep(0.87, 1.02, u) * 0.32;
          const edgeRiv = g4 * (0.40 + 0.46 * swell) * fallEnv;
          r += edgeRiv * 0.30;
          g += edgeRiv * 0.28;
          b += edgeRiv * 0.58;

          const rightShadow = 1 - 0.36 * gauss(u - 0.912, 0.025) * smoothstep(0.46, 0.60, v);
          r *= canyon * rightShadow;
          g *= canyon * rightShadow;
          b *= canyon * rightShadow;
        }

        const idx = (y * W + x) * 3;
        hdr[idx] = r * topFade;
        hdr[idx + 1] = g * topFade;
        hdr[idx + 2] = b * topFade;
      }
    }

    return {
      hdr,
      refractMask,
      refractOpts: {
        shearScale: 0.96,
        dispScale: 1.14,
        streakScale: 1.02,
        streakMix: 0.45,
        upperStreakMix: 0.14,
        cyanPairedDisp: true,
        couplingAdaptive: true,
      },
      // Generous quiet left-middle obsidian sanctuary — ZERO collision with "one sheet anyone"!
      sanctuary: {
        uMax: 0.515,
        uSoft: 0.435,
        vMin: 0.325,
        vMax: 0.615,
        strictLeftCut: 0.32,
        strictVStart: 0.36,
        blockCols: [0, 62],
        blockRows: [52, 104],
      },
    };
  }

  // =========================================================================
  // SUBJECT 2: HYPHER — MONUMENTAL SCULPTED FOLDED ORIGAMI WING / GLIDER
  // =========================================================================
  function sculptHypherWing(model, M) {
    const { makeNoise, mulberry32, smoothstep, clamp, gauss } = M;
    const hdr = new Float32Array(W * H * 3);
    const refractMask = new Float32Array(COLS * ROWS);

    const nA = makeNoise(model.seed ^ 0x9e3779b9);
    const nB = makeNoise(model.seed ^ 0x517cc1b7);
    const nC = makeNoise(model.seed ^ 0xc2b2ae35);
    const rng = mulberry32(model.seed ^ 0x2468ace0);
    const { eSmooth, aSmooth } = buildRowProfiles(model);

    // Monumental soaring origami glider vertices (soaring diagonally upward-right!)
    const NOSE = [0.895, 0.115];
    const L_TIP = [0.150, 0.325];
    const CREASE_TAIL = [0.468, 0.452];
    const KEEL_TIP = [0.575, 0.642]; // slightly wider keel cavity so the carved 3D shadow valley reads dramatically!
    const R_TIP = [0.975, 0.562];

    const p1 = rng() * 6.28;
    const p2 = rng() * 6.28;

    for (let row = 0; row < ROWS; row++) {
      const v = (row + 0.5) / ROWS;
      for (let col = 0; col < COLS; col++) {
        const u = (col + 0.5) / COLS;
        const dTop = triSDF(u, v, NOSE, L_TIP, CREASE_TAIL);
        const dBot = triSDF(u, v, NOSE, KEEL_TIP, R_TIP);
        const dKeel = triSDF(u, v, NOSE, CREASE_TAIL, KEEL_TIP);
        const inGlider = 1 - smoothstep(-0.01, 0.05, Math.min(dTop, dBot, dKeel));
        const wakeZone = smoothstep(0.51, 0.69, v);
        refractMask[row * COLS + col] = clamp(0.30 + 0.80 * wakeZone - 0.12 * inGlider, 0.22, 1.12);
      }
    }

    for (let y = 0; y < H; y++) {
      const v = y / H;
      const re = eSmooth[y];
      const ra = aSmooth[y];
      const topFade = smoothstep(0.03, 0.08, v);

      const wakeEnv = smoothstep(0.45, 0.60, v);
      const wCrimX = 0.535 + (v - 0.50) * 0.10 + Math.sin(v * 6.4 + p1) * 0.022;
      const wCyanX = 0.680 + (v - 0.50) * 0.08 + Math.sin(v * 5.2 + p2) * 0.024;
      const wAmethX = 0.850 + Math.sin(v * 4.5 + p1) * 0.024;

      for (let x = 0; x < W; x++) {
        const u = x / W;
        const wx = nA.fbm(u * 4.0 + 1.5, v * 3.8 + 0.8, 3) - 0.5;
        const wy = nB.fbm(u * 4.0 + 4.1, v * 3.8 + 2.6, 3) - 0.5;
        const wu = u + wx * 0.075;
        const wv = v + wy * 0.068;

        const cloud = nA.fbm(wu * 5.2, wv * 4.8, 4);
        const ridge = nB.ridge(wu * 6.4 + 1.7, wv * 5.9 + 1.1, 4);
        const fine = nC.fbm(u * 5.8 + wx * 0.04, v * 2.2 + 2.7, 4);

        let r = 0,
          g = 0,
          b = 0;

        const dUpperWing = triSDF(u, v, NOSE, L_TIP, CREASE_TAIL);
        const dKeelCavity = triSDF(u, v, NOSE, CREASE_TAIL, KEEL_TIP);
        const dLowerWing = triSDF(u, v, NOSE, KEEL_TIP, R_TIP);

        const segLeadL = segDist(u, v, NOSE[0], NOSE[1], L_TIP[0], L_TIP[1]);
        const segCrease = segDist(u, v, NOSE[0], NOSE[1], CREASE_TAIL[0], CREASE_TAIL[1]);
        const segKeelEdge = segDist(u, v, NOSE[0], NOSE[1], KEEL_TIP[0], KEEL_TIP[1]);
        const segLeadR = segDist(u, v, NOSE[0], NOSE[1], R_TIP[0], R_TIP[1]);
        const segTrailL = segDist(u, v, L_TIP[0], L_TIP[1], CREASE_TAIL[0], CREASE_TAIL[1]);

        const minD = Math.min(dUpperWing, dKeelCavity, dLowerWing);
        const aura = Math.exp(-Math.max(0, minD) * 22.0) * (0.32 + 0.65 * cloud);
        r += aura * 0.12;
        g += aura * 0.20;
        b += aura * 0.42;

        // ---- FACET 1: UPPER-LEFT SUNLIT GLACIER-CYAN WING (rich sculpted cyan, NO blown white slab!) ----
        const inUpper = 1 - smoothstep(-0.008, 0.013, dUpperWing);
        if (inUpper > 0.001) {
          const leadLight = Math.exp(-segLeadL.dist * 9.5);
          const noseProx = 1 - smoothstep(0.0, 0.92, segLeadL.t);
          const trailSoft = smoothstep(0.0, 0.055, segTrailL.dist);
          const surfaceTex = 0.60 + 0.44 * ridge * 0.6 + 0.28 * cloud;
          const upperLum = (0.28 + 0.72 * leadLight * (0.55 + 0.50 * noseProx)) * surfaceTex * (0.45 + 0.55 * trailSoft);

          // Rich icy glacier-cyan & sapphire shading (keeps white specular strictly on the razor leading edge!)
          r += inUpper * upperLum * 0.36;
          g += inUpper * upperLum * 0.92;
          b += inUpper * upperLum * 1.28;

          const ribWave = Math.pow(Math.max(0, Math.sin(segLeadL.dist * 36 - segLeadL.t * 4.5 + cloud * 2.2)), 3.2);
          r += inUpper * ribWave * 0.18;
          g += inUpper * ribWave * 0.38;
          b += inUpper * ribWave * 0.56;

          const creaseBounce = gauss(segCrease.dist, 0.032) * smoothstep(0.06, 0.85, segCrease.t) * inUpper;
          r += creaseBounce * 0.64;
          g += creaseBounce * 0.09;
          b += creaseBounce * 0.16;
        }

        // ---- FACET 2: DEEP CARVED OBSIDIAN SHADOW VALLEY (UNDER-FOLD KEEL!) ----
        // Deep velvety dark trough right beneath the crimson fold -> breathtaking 3D folded origami depth!
        const inKeel = 1 - smoothstep(-0.007, 0.010, dKeelCavity);
        if (inKeel > 0.001) {
          const keelRimGlow = Math.exp(-segKeelEdge.dist * 24.0) * (0.42 + 0.45 * cloud);
          const deepValleyMask = smoothstep(0.016, 0.055, segCrease.dist);
          const valleyLum = (0.04 + 0.26 * keelRimGlow) * deepValleyMask * (0.55 + 0.45 * cloud);
          r += inKeel * valleyLum * 0.16;
          g += inKeel * valleyLum * 0.18;
          b += inKeel * valleyLum * 0.56;
        }

        // ---- FACET 3: LOWER-RIGHT TWILIGHT-AMETHYST WING ----
        const inLower = 1 - smoothstep(-0.008, 0.014, dLowerWing);
        if (inLower > 0.001) {
          const rightLight = Math.exp(-segLeadR.dist * 7.5);
          const keelRim = Math.exp(-segKeelEdge.dist * 14.0) * 0.44;
          const surfaceTex = 0.56 + 0.52 * (cloud * 0.55 + ridge * 0.45);
          const lowerLum = (0.28 + 0.68 * rightLight + keelRim) * surfaceTex;

          const amethMix = smoothstep(0.18, 0.82, segLeadR.t);
          r += inLower * lowerLum * (0.40 + 0.24 * amethMix);
          g += inLower * lowerLum * (0.42 - 0.10 * amethMix + 0.18 * rightLight);
          b += inLower * lowerLum * (0.98 + 0.12 * rightLight);

          const wingFoldShadow = 1 - 0.56 * gauss(segLeadR.dist - 0.082, 0.028);
          r *= wingFoldShadow;
          g *= wingFoldShadow;
          b *= wingFoldShadow;
        }

        // ---- RAZOR-SHARP LEADING-EDGE SPECULAR CRESTS & NOSE KNOT ----
        const leadLRim = gauss(segLeadL.dist, 0.0075) * (0.78 + 0.42 * ridge) * (1 - 0.30 * segLeadL.t);
        const leadRRim = gauss(segLeadR.dist, 0.0080) * (0.60 + 0.40 * cloud) * (1 - 0.25 * segLeadR.t);
        const keelRimLine = gauss(segKeelEdge.dist, 0.0065) * 0.48 * smoothstep(0.08, 0.92, segKeelEdge.t);
        const noseKnot = Math.exp(-Math.pow((u - NOSE[0]) / 0.032, 2) - Math.pow((v - NOSE[1]) / 0.026, 2));
        const wingtipGlint = Math.exp(-Math.pow((u - L_TIP[0]) / 0.028, 2) - Math.pow((v - L_TIP[1]) / 0.024, 2)) * 0.55;

        r += leadLRim * 0.88 + leadRRim * 0.46 + keelRimLine * 0.32 + noseKnot * 1.48 + wingtipGlint * 0.48;
        g += leadLRim * 1.38 + leadRRim * 0.64 + keelRimLine * 0.56 + noseKnot * 1.82 + wingtipGlint * 0.88;
        b += leadLRim * 1.62 + leadRRim * 1.12 + keelRimLine * 0.96 + noseKnot * 2.02 + wingtipGlint * 1.15;

        // ---- MOLTEN EMBER-CRIMSON GLOWING CREASE / SPINE (THE HANDOFF NOTE!) ----
        const creaseTaper = smoothstep(0.02, 0.16, segCrease.t) * (1 - 0.14 * smoothstep(0.84, 1.0, segCrease.t));
        const creaseCore = gauss(segCrease.dist + (cloud - 0.5) * 0.007, 0.019 + 0.010 * segCrease.t) * creaseTaper;
        const creaseHalo = gauss(segCrease.dist, 0.044) * creaseTaper * (0.40 + 0.52 * cloud) * (1 - 0.72 * inKeel);
        const tailEmber =
          Math.exp(-Math.pow((u - CREASE_TAIL[0]) / 0.056, 2) - Math.pow((v - CREASE_TAIL[1]) / 0.048, 2)) *
          (0.65 + 0.45 * ridge);
        const crimsonSpine = (creaseCore * 1.58 + creaseHalo * 0.46 + tailEmber * 1.10) * (0.78 + 0.36 * ridge);

        if (crimsonSpine > 0.01) {
          const damp = 1 - clamp(creaseCore * 0.78, 0, 0.82);
          r = r * damp + crimsonSpine * 1.44;
          g = g * damp + crimsonSpine * 0.15;
          b = b * damp + crimsonSpine * 0.18;
        }

        // Carve crisp dark obsidian shadow lip immediately on the lower-right side of the crimson crease!
        if (inKeel > 0.05) {
          const shadowLip = 1 - 0.82 * gauss(segCrease.dist - 0.032, 0.018) * smoothstep(0.08, 0.95, segCrease.t);
          r *= shadowLip;
          g *= shadowLip;
          b *= shadowLip;
        }

        // ---- TRAILING KINETIC SLIPSTREAM STRATA WAKE (bleeding off bottom & right!) ----
        if (wakeEnv > 0.001) {
          const dataBoost = 0.88 + 0.30 * re;
          const swellM = 0.55 + 0.56 * cloud;
          const fineM = 0.58 + 0.54 * fine;

          const gCrim = gauss(u - wCrimX, 0.052 + 0.012 * cloud);
          const crimWake = gCrim * swellM * (0.68 + 0.38 * Math.sin(v * 11.2 + p1)) * wakeEnv * dataBoost * (0.90 + 0.25 * ra);
          r += crimWake * 1.08;
          g += crimWake * 0.14;
          b += crimWake * 0.16;

          const gCyan = gauss(u - wCyanX, 0.044 + 0.010 * fine);
          const gCyanHalo = gauss(u - (wCyanX + 0.022), 0.072) * 0.45;
          const cyanWake = (gCyan * 1.05 + gCyanHalo) * fineM * wakeEnv * dataBoost;
          r += cyanWake * 0.48;
          g += cyanWake * 0.92;
          b += cyanWake * 1.24;

          const wakeCanyon = 1 - 0.76 * gauss(u - (wCyanX + 0.092), 0.032) * smoothstep(0.58, 0.72, v);

          const gAmeth = gauss(u - wAmethX, 0.088) + smoothstep(0.86, 1.02, u) * 0.34;
          const amethWake = gAmeth * (0.52 + 0.52 * fine) * wakeEnv * dataBoost;
          r += amethWake * 0.40;
          g += amethWake * 0.36;
          b += amethWake * 0.82;

          r *= wakeCanyon;
          g *= wakeCanyon;
          b *= wakeCanyon;
        }

        const idx = (y * W + x) * 3;
        hdr[idx] = r * topFade;
        hdr[idx + 1] = g * topFade;
        hdr[idx + 2] = b * topFade;
      }
    }

    return {
      hdr,
      refractMask,
      refractOpts: {
        shearScale: 0.92,
        dispScale: 1.12,
        streakScale: 1.00,
        streakMix: 0.44,
        upperStreakMix: 0.13,
        cyanPairedDisp: true,
        couplingAdaptive: true,
      },
      sanctuary: {
        uMax: 0.46,
        uSoft: 0.36,
        vMin: 0.50,
        vMax: 0.84,
        strictLeftCut: 0.30,
        strictVStart: 0.52,
        blockCols: [0, 56],
        blockRows: [86, 138],
      },
    };
  }

  // =========================================================================
  // SUBJECT 3: FLASK — COMPACT GLOWING EMBER SEED BLOSSOMING INTO RIPPLES
  // =========================================================================
  function sculptFlaskSeed(model, M) {
    const { makeNoise, mulberry32, smoothstep, clamp, gauss } = M;
    const hdr = new Float32Array(W * H * 3);
    const refractMask = new Float32Array(COLS * ROWS);

    const nA = makeNoise(model.seed ^ 0x9e3779b9);
    const nB = makeNoise(model.seed ^ 0x517cc1b7);
    const nC = makeNoise(model.seed ^ 0xc2b2ae35);
    const rng = mulberry32(model.seed ^ 0x98765432);
    const { eSmooth, aSmooth } = buildRowProfiles(model);

    // Compact suspended luminous core seed in upper-right-center!
    const CX = 0.665;
    const CY = 0.275;
    const p1 = rng() * 6.28;
    const p2 = rng() * 6.28;

    // Keep seed + inner 2 concentric ripple rings crystal clear (0.26..0.38),
    // ramping smoothly into lush kinetic strata refraction across the outer blossoming waves!
    for (let row = 0; row < ROWS; row++) {
      const v = (row + 0.5) / ROWS;
      for (let col = 0; col < COLS; col++) {
        const u = (col + 0.5) / COLS;
        const rad = Math.hypot((u - CX) * AR, (v - CY) * 0.90);
        const outer = smoothstep(0.16, 0.46, rad);
        refractMask[row * COLS + col] = clamp(0.26 + 0.78 * outer, 0.24, 1.08);
      }
    }

    for (let y = 0; y < H; y++) {
      const v = y / H;
      const re = eSmooth[y];
      const ra = aSmooth[y];
      const topFade = smoothstep(0.028, 0.088, v);

      for (let x = 0; x < W; x++) {
        const u = x / W;

        const wx = nA.fbm(u * 3.8 + 1.4, v * 3.6 + 0.8, 3) - 0.5;
        const wy = nB.fbm(u * 3.8 + 4.3, v * 3.6 + 2.7, 3) - 0.5;
        const wu = u + wx * 0.082;
        const wv = v + wy * 0.076;

        const cloud = nA.fbm(wu * 5.0, wv * 4.8, 4);
        const ridge = nB.ridge(wu * 6.4 + 2.1, wv * 6.0 + 1.3, 4);
        const fine = nC.fbm(u * 5.6 + wx * 0.05, v * 2.4 + 3.1, 4);

        // Aspect-corrected polar coordinates from seed, gently elongated down-right so ripples cascade!
        const du = (u - CX) * AR;
        const dv = v - CY;
        const downStretch = dv > 0 ? 0.80 : 1.06;
        const rightStretch = du > 0 ? 0.88 : 1.06;
        const ang = Math.atan2(dv, du);

        // Subtle organic petal-like optical undulation (never mechanical compass rings!)
        const lobeWarp =
          0.012 * Math.sin(ang * 3.0 + 0.6) +
          0.007 * Math.cos(ang * 5.0 - 0.4) +
          (cloud - 0.5) * 0.032;
        const rad = Math.hypot(du * rightStretch, dv * downStretch) + lobeWarp;
        const rawRad = Math.hypot(du, dv);

        const dirLight = 0.62 + 0.38 * Math.cos(ang + 2.15);
        const lowerCascadeBias = 0.74 + 0.48 * smoothstep(-0.10, 0.36, dv) * smoothstep(-0.18, 0.12, du);

        let r = 0,
          g = 0,
          b = 0;

        // ---- 1. FOUR SCULPTED CONCENTRIC OPTICAL RIPPLE WAVES WITH DEEP CARVED SHADOW CANYONS ----
        // Clearly separated from the compact crimson seed by a dark obsidian moat at rad ~ 0.095!
        const rings = [
          { r0: 0.145, w: 0.025, crim: 0.42, cyan: 1.05, ameth: 0.32, gain: 1.15 }, // Inner rose-cyan optical ripple!
          { r0: 0.252, w: 0.032, crim: 0.06, cyan: 1.18, ameth: 0.46, gain: 1.14 }, // Luminous glacier-cyan wave
          { r0: 0.372, w: 0.042, crim: 0.05, cyan: 0.64, ameth: 0.98, gain: 1.06 }, // Cobalt & periwinkle plume
          { r0: 0.506, w: 0.054, crim: 0.14, cyan: 0.36, ameth: 0.96, gain: 0.96 }, // Broad twilight-amethyst swell
          { r0: 0.652, w: 0.068, crim: 0.22, cyan: 0.44, ameth: 0.88, gain: 0.88 }, // Deep lower bleed wave
        ];

        const dataBoost = 0.86 + 0.32 * re;

        for (let k = 0; k < rings.length; k++) {
          const rg = rings[k];
          const dr = rad - rg.r0;
          const sigma = dr < 0 ? rg.w * 0.68 : rg.w * 1.15;
          const wave = Math.exp(-0.5 * (dr / sigma) * (dr / sigma));
          const plumeTex = smoothstep(0.16, 0.82, cloud * 0.52 + ridge * 0.52);
          const angBreak = 0.68 + 0.36 * Math.sin(ang * (2 + k) + p1 + k * 1.4) * 0.5 + 0.22 * dirLight;
          const sweepGate = k <= 1 ? 1.0 : smoothstep(-0.34, -0.06, du + 0.18 * smoothstep(0.36, 0.76, v));
          const energy = wave * (0.48 + 0.72 * plumeTex) * angBreak * lowerCascadeBias * sweepGate * rg.gain * dataBoost;

          const crestGlint =
            gauss(dr + 0.006, rg.w * 0.26) * smoothstep(0.38, 0.86, ridge) * dirLight * sweepGate * (k < 3 ? 0.62 : 0.34);

          r += energy * (rg.crim * 1.08 + rg.cyan * 0.40 + rg.ameth * 0.38) + crestGlint * (0.64 + rg.crim * 0.38);
          g += energy * (rg.crim * 0.15 + rg.cyan * 0.96 + rg.ameth * 0.36) + crestGlint * (1.12 - rg.crim * 0.22);
          b += energy * (rg.crim * 0.22 + rg.cyan * 1.24 + rg.ameth * 0.88) + crestGlint * 1.38;
        }

        // DEEP CARVED OBSIDIAN SHADOW MOAT & CANYONS between the seed and every concentric ripple!
        const moat = 1 - 0.90 * gauss(rad - 0.095, 0.017);
        const canyon1 = 1 - 0.86 * gauss(rad - 0.198, 0.019);
        const canyon2 = 1 - 0.84 * gauss(rad - 0.310, 0.022);
        const canyon3 = 1 - 0.78 * gauss(rad - 0.438, 0.025);
        const canyon4 = 1 - 0.70 * gauss(rad - 0.578, 0.028);
        const canyons = moat * canyon1 * canyon2 * canyon3 * canyon4;
        r *= canyons;
        g *= canyons;
        b *= canyons;

        // ---- 2. LOWER-RIGHT ATMOSPHERIC CASCADE PLUMES (bleeding off bottom & right edges) ----
        const lowEnv = smoothstep(0.54, 0.76, v) * smoothstep(0.42, 0.66, u);
        if (lowEnv > 0.001) {
          const r1X = 0.55 + Math.sin(v * 5.4 + p1) * 0.024;
          const r2X = 0.71 + Math.sin(v * 4.7 + p2) * 0.026;
          const r3X = 0.90 + Math.sin(v * 4.1 + p1) * 0.022;

          const crimEcho = gauss(u - r1X, 0.048) * smoothstep(0.36, 0.82, fine) * lowEnv * (0.72 + 0.35 * ra);
          r += crimEcho * 0.86;
          g += crimEcho * 0.13;
          b += crimEcho * 0.18;

          const cyanEcho = gauss(u - r2X, 0.056) * (0.52 + 0.56 * ridge) * lowEnv;
          r += cyanEcho * 0.38;
          g += cyanEcho * 0.78;
          b += cyanEcho * 1.08;

          const amethEcho = (gauss(u - r3X, 0.094) + smoothstep(0.86, 1.02, u) * 0.30) * (0.48 + 0.52 * cloud) * lowEnv;
          r += amethEcho * 0.38;
          g += amethEcho * 0.32;
          b += amethEcho * 0.78;
        }

        // ---- 3. COMPACT, JEWEL-LIKE INCANDESCENT EMBER-CRIMSON CORE SEED ----
        // Small, unmistakable glowing seed suspended cleanly inside its dark obsidian moat!
        const seedR = Math.hypot((u - CX) * AR * 1.15, (v - CY) * 0.98) + (cloud - 0.5) * 0.012;
        const seedBody = Math.exp(-Math.pow(seedR / 0.046, 2.3)) * (0.82 + 0.38 * ridge);
        const seedHalo = Math.exp(-Math.pow(seedR / 0.072, 2.0)) * (0.48 + 0.48 * cloud);
        // Sculpted 3D inner crescent shadow giving pearl-like volumetric roundness
        const dCres = Math.hypot((u - (CX + 0.016)) * AR, v - (CY + 0.014));
        const seedCavity = 1 - 0.52 * Math.exp(-Math.pow(dCres / 0.022, 2));
        // Tight white-hot incandescent specular heart shifted gently upper-left
        const dPearl = Math.hypot((u - (CX - 0.011)) * AR, v - (CY - 0.011));
        const pearlCore = Math.exp(-Math.pow(dPearl / 0.019, 2.1)) * (0.84 + 0.30 * ridge);

        const seedCrimson = (seedBody * 1.62 + seedHalo * 0.52) * seedCavity;
        if (rawRad < 0.115) {
          const coreMask = clamp(seedBody * 0.92, 0, 0.96);
          r = r * (1 - coreMask) + seedCrimson * 1.48 + pearlCore * 1.56;
          g = g * (1 - coreMask) + seedCrimson * 0.15 + pearlCore * 1.72;
          b = b * (1 - coreMask) + seedCrimson * 0.18 + pearlCore * 1.92;
        }

        const idx = (y * W + x) * 3;
        hdr[idx] = r * topFade;
        hdr[idx + 1] = g * topFade;
        hdr[idx + 2] = b * topFade;
      }
    }

    return {
      hdr,
      refractMask,
      refractOpts: {
        shearScale: 0.86,
        dispScale: 1.12,
        streakScale: 0.94,
        streakMix: 0.42,
        upperStreakMix: 0.12,
        cyanPairedDisp: true,
        couplingAdaptive: true,
      },
      sanctuary: {
        uMax: 0.505,
        uSoft: 0.425,
        vMin: 0.32,
        vMax: 0.62,
        strictLeftCut: 0.30,
        strictVStart: 0.36,
        blockCols: [0, 60],
        blockRows: [52, 106],
      },
    };
  }

  // =========================================================================
  // SUBJECT 4: PANTRY — DAYLIGHT ALABASTER TERRACED HARVEST HILLS & WEEKLY TIDE
  // =========================================================================
  function sculptPantryTerraces(model, M) {
    const { makeNoise, mulberry32, smoothstep, clamp, gauss } = M;
    const dayField = new Float32Array(W * H * 3);
    const refractMask = new Float32Array(COLS * ROWS);

    const nA = makeNoise(model.seed ^ 0x9e3779b9);
    const nB = makeNoise(model.seed ^ 0x517cc1b7);
    const nC = makeNoise(model.seed ^ 0xc2b2ae35);
    const rng = mulberry32(model.seed ^ 0x55aa55aa);
    const { eSmooth, aSmooth } = buildRowProfiles(model);

    // 7 overlapping sculpted shan-shui terraced waves (subtle rhythm of Mon -> Sun!)
    const hills = [
      { baseV: 0.252, peakU: 0.80, amp: 0.068, tilt: -0.14, width: 0.26, slateW: 0.82, mistW: 0.94 }, // mon
      { baseV: 0.358, peakU: 0.66, amp: 0.074, tilt: -0.11, width: 0.32, slateW: 0.98, mistW: 0.92 }, // tue
      { baseV: 0.466, peakU: 0.84, amp: 0.072, tilt: -0.09, width: 0.34, slateW: 1.06, mistW: 0.90 }, // wed
      { baseV: 0.576, peakU: 0.55, amp: 0.078, tilt: -0.08, width: 0.36, slateW: 1.08, mistW: 0.92 }, // thu (weekly tide!)
      { baseV: 0.688, peakU: 0.76, amp: 0.080, tilt: -0.07, width: 0.38, slateW: 1.12, mistW: 0.90 }, // fri
      { baseV: 0.800, peakU: 0.44, amp: 0.076, tilt: -0.06, width: 0.40, slateW: 1.06, mistW: 0.94 }, // sat
      { baseV: 0.910, peakU: 0.68, amp: 0.074, tilt: -0.05, width: 0.44, slateW: 1.08, mistW: 0.92 }, // sun
    ];

    const p1 = rng() * 6.28;
    const p2 = rng() * 6.28;

    for (let row = 0; row < ROWS; row++) {
      const v = (row + 0.5) / ROWS;
      for (let col = 0; col < COLS; col++) {
        refractMask[row * COLS + col] = clamp(0.54 + 0.52 * smoothstep(0.32, 0.82, v), 0.50, 1.06);
      }
    }

    for (let y = 0; y < H; y++) {
      const v = y / H;
      const re = eSmooth[y];
      const ra = aSmooth[y];

      for (let x = 0; x < W; x++) {
        const u = x / W;
        const wx = nA.fbm(u * 3.8 + 1.1, v * 3.6 + 0.9, 3) - 0.5;
        const wy = nB.fbm(u * 3.8 + 3.7, v * 3.6 + 2.4, 3) - 0.5;
        const wu = u + wx * 0.072;
        const wv = v + wy * 0.062;

        const cloud = nA.fbm(wu * 4.8, wv * 4.5, 4);
        const ridge = nB.ridge(wu * 6.2 + 1.8, wv * 5.6 + 1.1, 4);
        const inkTex = nC.fbm(wu * 3.6 + 5.2, wv * 4.0 + 2.1, 3);

        const leftEdge = 0.60 - smoothstep(0.18, 0.84, v) * 0.52 + (cloud - 0.5) * 0.072;
        const leftGate = smoothstep(leftEdge - 0.05, leftEdge + 0.16, u);
        const topGate = smoothstep(0.145, 0.235, v);
        const env = leftGate * topGate;

        if (env < 0.002) continue;

        let slate = 0;
        let mist = 0;
        let crim = 0;

        for (let k = 0; k < hills.length; k++) {
          const h = hills[k];
          const swellPeak =
            Math.exp(-Math.pow((u - h.peakU) / h.width, 2)) * h.amp +
            Math.exp(-Math.pow((u - (h.peakU + 0.34)) / (h.width * 0.9), 2)) * h.amp * 0.45;
          const ripple = Math.sin(u * 7.5 + k * 1.9 + p1) * 0.011 + (cloud - 0.5) * 0.025;
          const ridgeV = h.baseV - swellPeak + (u - 0.65) * h.tilt + ripple;

          const dv = v - ridgeV;

          if (dv > -0.026 && dv < 0.006) {
            const slit = gauss(dv + 0.010, 0.009);
            slate *= 1 - 0.86 * slit;
            mist *= 1 - 0.62 * slit;
          }

          if (dv > -0.010 && dv < 0.175) {
            const crestRise = smoothstep(-0.008, 0.014, dv);
            const crestBand = Math.exp(-Math.pow(Math.max(0, dv - 0.010) / 0.044, 1.5)) * crestRise;
            const slopeMist = Math.exp(-Math.pow(Math.max(0, dv - 0.024) / 0.105, 1.4)) * crestRise;

            const shade = 0.62 + 0.48 * (ridge * 0.55 + inkTex * 0.45);
            const dataLift = 0.86 + 0.28 * re;

            const addSlate = crestBand * h.slateW * shade * dataLift;
            const addMist = slopeMist * h.mistW * (0.58 + 0.52 * cloud);

            const occlude = clamp(crestRise * Math.exp(-Math.max(0, dv) * 14.0) * 0.78, 0, 0.82);
            slate = slate * (1 - occlude) + addSlate;
            mist = Math.max(mist * (1 - occlude * 0.45), addMist);
          }
        }

        // ---- ONE CONTINUOUS LUMINOUS VERMILION-CRIMSON WEEKLY TIDE / HEARTH ----
        // Flowing smoothly & unmistakably across the heart of the seven swells (NO fragmented blotches,
        // NO competing second red blob!) so ONE glowing crimson thread unifies the week of dinners!
        const tideCenterV =
          0.585 -
          0.032 * Math.exp(-Math.pow((u - 0.58) / 0.28, 2)) +
          Math.sin(u * 6.8 + p2) * 0.014 +
          (cloud - 0.5) * 0.018;
        const dTide = Math.abs(v - tideCenterV);
        const tideReach = smoothstep(0.24, 0.44, u);
        // Continuous flowing ink-wash crimson river (feathered organic edges, strong core continuity!)
        const tideWidth = 0.038 + 0.020 * smoothstep(0.55, 0.98, u);
        const tideCore =
          Math.exp(-Math.pow(dTide / tideWidth, 2)) *
          tideReach *
          (0.64 + 0.52 * smoothstep(0.18, 0.78, cloud * 0.55 + ridge * 0.45)) *
          (0.95 + 0.28 * ra);

        crim = tideCore * 1.28;

        const idx = (y * W + x) * 3;
        dayField[idx] = crim * env;
        dayField[idx + 1] = slate * env;
        dayField[idx + 2] = mist * env;
      }
    }

    return {
      dayField,
      refractMask,
      refractOpts: {
        shearScale: 0.94,
        dispScale: 0.86,
        streakScale: 0.96,
        streakMix: 0.42,
        upperStreakMix: 0.20,
      },
      sanctuary: {
        xMax: 560,
        yMax: 235,
        softX: 380,
        softY: 285,
        blockCols: [0, 82],
        blockRows: [0, 38],
      },
    };
  }

  window.VyoSubjects = {
    vyo: sculptVyoPrism,
    hypher: sculptHypherWing,
    flask: sculptFlaskSeed,
    pantry: sculptPantryTerraces,
  };
})();

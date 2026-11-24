// Optical chromatic strata synthesizer & editorial typographic compositor (v3 — gallery-print palette & organic transition).
// Runs inside Chromium HTML5 Canvas at native 2x DPR (1680 x 2380 for an 840 x 1190 sheet).

(function () {
  "use strict";

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(seed) {
    const rng = mulberry32(seed);
    const SIZE = 256;
    const perm = new Uint8Array(SIZE * 2);
    const val = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
      perm[i] = i;
      val[i] = rng();
    }
    for (let i = SIZE - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      const tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }
    for (let i = 0; i < SIZE; i++) perm[i + SIZE] = perm[i];

    function noise2(x, y) {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const u = xf * xf * (3 - 2 * xf);
      const v = yf * yf * (3 - 2 * yf);
      const X = xi & 255;
      const Y = yi & 255;
      const aa = val[perm[perm[X] + Y]];
      const ba = val[perm[perm[X + 1] + Y]];
      const ab = val[perm[perm[X] + Y + 1]];
      const bb = val[perm[perm[X + 1] + Y + 1]];
      const x1 = aa + (ba - aa) * u;
      const x2 = ab + (bb - ab) * u;
      return x1 + (x2 - x1) * v;
    }

    function fbm(x, y, octaves) {
      let sum = 0;
      let amp = 0.5;
      let freq = 1;
      let norm = 0;
      for (let i = 0; i < octaves; i++) {
        sum += amp * noise2(x * freq, y * freq);
        norm += amp;
        amp *= 0.5;
        freq *= 2.03;
      }
      return sum / norm;
    }

    function ridge(x, y, octaves) {
      let sum = 0;
      let amp = 0.55;
      let freq = 1;
      let norm = 0;
      for (let i = 0; i < octaves; i++) {
        const n = 1 - Math.abs(noise2(x * freq, y * freq) * 2 - 1);
        sum += amp * n * n;
        norm += amp;
        amp *= 0.5;
        freq *= 2.07;
      }
      return sum / norm;
    }

    return { noise2, fbm, ridge };
  }

  function smoothstep(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function gauss(d, sigma) {
    const q = d / sigma;
    return Math.exp(-0.5 * q * q);
  }

  function boxBlurRGB(buf, w, h, radius, passes) {
    const tmp = new Float32Array(buf.length);
    const inv = 1 / (2 * radius + 1);
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        let sr = 0, sg = 0, sb = 0;
        for (let k = -radius; k <= radius; k++) {
          const xk = clamp(k, 0, w - 1);
          const idx = (row + xk) * 3;
          sr += buf[idx];
          sg += buf[idx + 1];
          sb += buf[idx + 2];
        }
        for (let x = 0; x < w; x++) {
          const out = (row + x) * 3;
          tmp[out] = sr * inv;
          tmp[out + 1] = sg * inv;
          tmp[out + 2] = sb * inv;
          const xAdd = clamp(x + radius + 1, 0, w - 1);
          const xSub = clamp(x - radius, 0, w - 1);
          const iAdd = (row + xAdd) * 3;
          const iSub = (row + xSub) * 3;
          sr += buf[iAdd] - buf[iSub];
          sg += buf[iAdd + 1] - buf[iSub + 1];
          sb += buf[iAdd + 2] - buf[iSub + 2];
        }
      }
      for (let x = 0; x < w; x++) {
        let sr = 0, sg = 0, sb = 0;
        for (let k = -radius; k <= radius; k++) {
          const yk = clamp(k, 0, h - 1);
          const idx = (yk * w + x) * 3;
          sr += tmp[idx];
          sg += tmp[idx + 1];
          sb += tmp[idx + 2];
        }
        for (let y = 0; y < h; y++) {
          const out = (y * w + x) * 3;
          buf[out] = sr * inv;
          buf[out + 1] = sg * inv;
          buf[out + 2] = sb * inv;
          const yAdd = clamp(y + radius + 1, 0, h - 1);
          const ySub = clamp(y - radius, 0, h - 1);
          const iAdd = (yAdd * w + x) * 3;
          const iSub = (ySub * w + x) * 3;
          sr += tmp[iAdd] - tmp[iSub];
          sg += tmp[iAdd + 1] - tmp[iSub + 1];
          sb += tmp[iAdd + 2] - tmp[iSub + 2];
        }
      }
    }
  }

  // --- Synthesize continuous painterly nocturnal HDR light-field at 1x (840 x 1190) ---
  // Art-book palette calibrated against the Bloomsbury reference:
  //   - Smoky ember-vermilion / dusty crimson (NOT neon primary red)
  //   - Glacial powder-cyan / silvery ice-blue specular spine
  //   - Moody dusty twilight-violet / slate-amethyst right rivers (NOT electric neon blue)
  //   - Jewel-like coral-magenta & tiny optical chartreuse-lime prism glints in the upper focal cluster
  function synthesizeHDRField(W, H, model) {
    const field = new Float32Array(W * H * 3);
    const nA = makeNoise(model.seed ^ 0x9e3779b9);
    const nB = makeNoise(model.seed ^ 0x517cc1b7);
    const nC = makeNoise(model.seed ^ 0xc2b2ae35);
    const rng = mulberry32(model.seed ^ 0xa5a5a5a5);

    const density = clamp(model.stats.files / 71, 0.45, 1.25);
    const accentRatio = clamp(model.stats.accentLoc / Math.max(1, model.stats.totalLoc), 0.15, 0.55);

    const rowEnergy = new Float32Array(H);
    const rowAccent = new Float32Array(H);
    const rowCross = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      let e = 0.25, ac = 0, cr = 0;
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
        let s = 0, c = 0;
        for (let k = -rad; k <= rad; k++) {
          s += arr[clamp(i + k, 0, arr.length - 1)];
          c++;
        }
        out[i] = s / c;
      }
      return out;
    };
    const eSmooth = smooth1D(rowEnergy, 18);
    const aSmooth = smooth1D(rowAccent, 24);
    const cSmooth = smooth1D(rowCross, 16);

    const accMid = clamp(model.accentSpan.midY, 0.23, 0.35);
    const accMax = clamp(model.accentSpan.maxY, 0.39, 0.47);
    const hj0 = ((model.hubs[0]?.seed || 11) % 100) / 100 - 0.5;
    const hj1 = ((model.hubs[1]?.seed || 29) % 100) / 100 - 0.5;
    const hj2 = ((model.hubs[2]?.seed || 47) % 100) / 100 - 0.5;

    // Diagonal sculptural focal axis pouring organically into the lower rivers
    const apexX = 0.445 + hj0 * 0.038;
    const apexY = 0.145 + (density - 0.8) * 0.012;
    const midX = 0.565 + hj1 * 0.045;
    const midY = clamp(accMid + 0.035, 0.27, 0.35);
    const flareX = 0.675 + hj2 * 0.032; // Aligns cleanly over River 2 (x ~ 0.635) so light pours downward!
    const flareY = clamp(accMax + 0.012, 0.41, 0.465);
    const crimCloudX = apexX - 0.15;
    const crimCloudY = apexY + 0.028;

    const p1 = rng() * 6.28;
    const p2 = rng() * 6.28;
    const p3 = rng() * 6.28;
    const p4 = rng() * 6.28;

    for (let y = 0; y < H; y++) {
      const v = y / H;
      const topEnv = smoothstep(0.055, 0.135, v);
      // Wide, seamless overlap between upper sculptural prism & lower cascading rivers (no abrupt horizon!)
      const lowerMix = smoothstep(0.41, 0.56, v);
      const upperMix = 1 - smoothstep(0.44, 0.58, v);

      const re = eSmooth[y];
      const ra = aSmooth[y];
      const rc = cSmooth[y];

      const diagT = clamp((v - apexY) / Math.max(0.05, flareY - apexY), -0.25, 1.3);
      const spineX = apexX + (flareX - apexX) * smoothstep(-0.08, 1.12, diagT);

      // Lower 4 vertical reflection rivers — organic undulations continuing down off y = 1.0
      const r1X = 0.525 + Math.sin(v * 6.4 + p1) * 0.020 + (accentRatio - 0.28) * 0.038;
      const r2X = 0.638 + Math.sin(v * 5.7 + p2) * 0.022 + hj1 * 0.018;
      const r3X = 0.810 + Math.sin(v * 4.9 + p3) * 0.024;
      const r4X = 0.960 + Math.sin(v * 4.3 + p4) * 0.024;

      for (let x = 0; x < W; x++) {
        const u = x / W;

        const wx = nA.fbm(u * 4.1 + 1.3, v * 3.9 + 0.7, 3) - 0.5;
        const wy = nB.fbm(u * 4.1 + 4.1, v * 3.9 + 2.9, 3) - 0.5;
        const wu = u + wx * 0.11;
        const wv = v + wy * 0.095;

        const cloud = nA.fbm(wu * 5.6, wv * 5.2, 4);
        const ridge = nB.ridge(wu * 7.0 + 2.1, wv * 6.4 + 1.4, 4);
        const cavityNoise = nC.fbm(wu * 4.5 + 8.3, wv * 4.7 + 2.7, 3);

        const rivN = nA.fbm(u * 6.0 + wx * 0.045, v * 1.85 + 3.4, 4);
        const rivSwell = nB.fbm(u * 2.6 + 1.1, v * 3.2 + 6.2, 3);

        let r = 0;
        let g = 0;
        let b = 0;

        // ============================================================
        // ZONE 1: UPPER SCULPTURAL BROKEN-CRYSTAL MASS (v ~ 0.06..0.56)
        // ============================================================
        if (upperMix > 0.001) {
          // Keeps top-right quadrant pitch dark while sweeping down-right across mid-upper sheet
          const rightCut = 1 - smoothstep(spineX + 0.10 + 0.17 * smoothstep(0.18, 0.36, v), spineX + 0.25 + 0.30 * smoothstep(0.24, 0.42, v), u);

          // 1A. Smoky Ember-Vermilion Cloud on upper-left flank (painterly terracotta/crimson warmth)
          const dCrim = Math.hypot((u - crimCloudX) * 1.18, (v - crimCloudY) * 1.42);
          const crimPuff = Math.exp(-dCrim * dCrim * 22.0) * smoothstep(0.30, 0.74, cloud);
          // Warm crimson fold pouring down the left flank into River 1
          const dFlank = (u - (spineX - 0.095)) / 0.072;
          const flankV = smoothstep(0.13, 0.22, v) * (1 - smoothstep(0.47, 0.59, v));
          const crimFlank = Math.exp(-0.5 * dFlank * dFlank) * flankV * smoothstep(0.28, 0.74, cloud) * (0.78 + 0.38 * ra);
          const crim = (crimPuff * 1.25 + crimFlank * 0.94) * upperMix;

          // Rich warm terracotta-crimson (subtle warm orange/rose lift so it reads as photographic ember, not neon #FF0000!)
          r += crim * 1.05;
          g += crim * 0.145;
          b += crim * 0.125;

          // 1B. Sculpted Volumetric Diagonal Core (with deep pitch-black carved chiaroscuro cavities)
          const duSpine = u - (spineX + (cloud - 0.5) * 0.11);
          const torsoW = 0.068 + 0.11 * smoothstep(0.15, 0.40, v);
          const torsoEnv =
            Math.exp(-0.5 * (duSpine / torsoW) * (duSpine / torsoW)) *
            smoothstep(0.09, 0.16, v) *
            (1 - smoothstep(0.46, 0.58, v)) *
            rightCut;

          const cavity = smoothstep(0.36, 0.75, cavityNoise * 0.55 + ridge * 0.55);
          const torso = torsoEnv * cavity * (0.65 + 0.42 * re) * upperMix;

          // Rose-magenta & dusty slate-violet volumetric folds
          const magW = smoothstep(0.46, 0.78, ridge) * (0.62 + 0.45 * ra);
          const vioW = smoothstep(-0.02, 0.14, u - spineX) * (0.55 + 0.55 * cloud);
          r += torso * (0.68 * magW + 0.26 * vioW);
          g += torso * (0.14 * magW + 0.21 * vioW + 0.18 * ridge);
          b += torso * (0.42 * magW + 0.68 * vioW + 0.25 * ridge);

          // 1C. Diagonal Glacial-Cyan Light Crests sweeping across upper-mid fold
          const diagCrest = Math.sin((u * 12.2 - v * 13.5) + cloud * 3.9);
          const crest = Math.pow(Math.max(0, diagCrest), 4.2) * torsoEnv * smoothstep(0.21, 0.47, v) * upperMix;
          r += crest * 0.34;
          g += crest * 0.88;
          b += crest * 1.12;

          // 1D. Tight Upper Crown Specular Crystal (icy powder-blue/white jewel)
          const dApex = Math.hypot((u - apexX) * 2.15, (v - apexY) * 3.3);
          const apexCore = Math.exp(-dApex * dApex * 36.0) * (0.55 + 0.62 * ridge) * upperMix;
          const apexHalo = Math.exp(-dApex * dApex * 12.5) * smoothstep(0.40, 0.76, cloud) * upperMix;
          r += apexCore * 1.05 + apexHalo * 0.18;
          g += apexCore * 1.52 + apexHalo * 0.36;
          b += apexCore * 1.75 + apexHalo * 0.64;

          // 1E. Main Dramatic Upper-Right Blazing Specular Knot (feeds directly into River 2 below!)
          const dFlare = Math.hypot((u - flareX) * 2.1, (v - flareY) * 2.85);
          const flareCore = Math.exp(-dFlare * dFlare * 30.0) * (0.65 + 0.52 * ridge) * (0.88 + 0.28 * ra) * upperMix;
          const flareRose = Math.exp(-Math.pow((u - (flareX - 0.088)) / 0.068, 2) - Math.pow((v - (flareY - 0.015)) / 0.06, 2)) * (0.52 + 0.55 * cloud) * upperMix;
          r += flareCore * 1.38 + flareRose * 0.82;
          g += flareCore * 1.75 + flareRose * 0.18;
          b += flareCore * 1.98 + flareRose * 0.44;

          // 1F. Subtle Mid-Body Luminous Facet
          const dMid = Math.hypot((u - midX) * 2.25, (v - midY) * 3.0);
          const midCore = Math.exp(-dMid * dMid * 38.0) * (0.5 + 0.62 * ridge) * (0.7 + 0.4 * rc) * upperMix;
          r += midCore * 0.64;
          g += midCore * 0.78;
          b += midCore * 1.08;

          // 1G. Jewel-like Optical Prism Chartreuse-Lime Refraction Sparks (tiny refractive rims!)
          const sparkA = Math.exp(-Math.pow((dApex - 0.062) / 0.019, 2)) * smoothstep(0.54, 0.84, ridge);
          const sparkF = Math.exp(-Math.pow((dFlare - 0.068) / 0.021, 2)) * smoothstep(0.52, 0.82, ridge);
          const sparkM = Math.exp(-Math.pow((dMid - 0.056) / 0.018, 2)) * smoothstep(0.56, 0.86, ridge);
          const prism = (sparkA * 1.05 + sparkF * 1.2 + sparkM * 0.85) * (0.55 + 0.65 * rc) * upperMix;
          r += prism * 0.74;
          g += prism * 1.04;
          b += prism * 0.08;

          // 1H. Moody Dusty Slate-Indigo Shelf extending rightward around v = 0.30..0.54
          const rightShelf =
            smoothstep(0.58, 0.84, u) *
            smoothstep(0.28, 0.37, v) *
            (1 - smoothstep(0.49, 0.58, v)) *
            smoothstep(0.26, 0.72, cloud) *
            upperMix;
          r += rightShelf * 0.22;
          g += rightShelf * 0.22;
          b += rightShelf * 0.56;
        }

        // ============================================================
        // ZONE 2: LOWER CASCADING LUMINOUS RIVERS (v ~ 0.42 to 1.00)
        // Gallery-print dusty crimson, cool silvery glacier-cyan ribbon,
        // deep obsidian-indigo valley, and moody dusty amethyst/slate-violet!
        // ============================================================
        if (lowerMix > 0.001) {
          const swell = 0.54 + 0.58 * rivSwell;
          const fine = 0.56 + 0.56 * rivN;
          const dataBoost = 0.84 + 0.30 * re;

          // River 1: Smoky Dusty Ember-Crimson Left Flank (warm terracotta-rose, NOT neon red!)
          const g1 = gauss(u - r1X, 0.055 + 0.010 * rivSwell);
          const g1Tail = gauss(u - (r1X - 0.068), 0.068) * 0.34;
          const crimPulse = 0.66 + 0.42 * Math.sin(v * 11.8 + p1);
          const crimRiv = (g1 * 0.94 + g1Tail) * swell * crimPulse * lowerMix * dataBoost;
          r += crimRiv * 0.90;
          g += crimRiv * 0.165;
          b += crimRiv * 0.175;

          // River 2: Cool Silvery Ice-Cyan Specular Spine (luminous powder-blue / pale glacier)
          const g2Core = gauss(u - r2X, 0.028 + 0.006 * rivN);
          const g2Halo = gauss(u - (r2X + 0.020), 0.060) * 0.48;
          const cyanPulse = 0.66 + 0.44 * Math.sin(v * 14.5 + p2 * 1.4) * 0.5 + 0.32 * rivN;
          const cyanRiv = (g2Core * 1.12 + g2Halo * 0.52) * cyanPulse * lowerMix * dataBoost;
          r += cyanRiv * 0.52;
          g += cyanRiv * 0.88;
          b += cyanRiv * 1.14;

          // Soft rose-mauve transition where crimson kisses ice-cyan
          const kiss = gauss(u - 0.5 * (r1X + r2X), 0.024) * 0.36 * fine * lowerMix;
          r += kiss * 0.68;
          g += kiss * 0.22;
          b += kiss * 0.44;

          // Deep atmospheric dark-indigo valley between River 2 & River 3 (gives rich 3D depth!)
          const valley = 1 - 0.72 * gauss(u - 0.725, 0.036);

          // River 3: Moody Dusty Amethyst / Twilight Slate-Violet (cinematic art-book purple, NOT neon blue!)
          const g3 = gauss(u - r3X, 0.068 + 0.015 * rivN);
          const vioPulse = 0.58 + 0.50 * fine;
          const vioRiv = g3 * vioPulse * lowerMix * dataBoost;
          r += vioRiv * 0.36;
          g += vioRiv * 0.29;
          b += vioRiv * 0.66;

          // Soft periwinkle-silver highlight inside River 3 on selected swells
          const lavGlint = gauss(u - (r3X - 0.022), 0.030) * smoothstep(0.52, 0.86, rivN) * lowerMix;
          r += lavGlint * 0.38;
          g += lavGlint * 0.42;
          b += lavGlint * 0.70;

          // River 4: Moody Slate-Plum Right-Edge Bleed (drifting smoothly off u = 1.0!)
          const g4 = gauss(u - r4X, 0.090) + smoothstep(0.87, 1.02, u) * 0.28;
          const edgeRiv = g4 * (0.36 + 0.44 * rivSwell) * lowerMix;
          r += edgeRiv * 0.25;
          g += edgeRiv * 0.22;
          b += edgeRiv * 0.46;

          // Subtle dark vertical trough near right margin
          const rightShadow = 1 - 0.36 * gauss(u - 0.905, 0.028);

          r *= valley * rightShadow;
          g *= valley * rightShadow;
          b *= valley * rightShadow;
        }

        const leftMask = smoothstep(0.13, 0.26, u + (cloud - 0.5) * 0.065);
        const env = topEnv * leftMask;

        const idx = (y * W + x) * 3;
        field[idx] = r * env;
        field[idx + 1] = g * env;
        field[idx + 2] = b * env;
      }
    }

    return field;
  }

  function sampleHDR(field, W, H, fx, fy, ch) {
    if (fx < -2) return 0;
    if (fx < 0 || fx >= W - 1 || fy < 0 || fy >= H - 1) {
      const cx = clamp(Math.round(fx), 0, W - 1);
      const cy = clamp(Math.round(fy), 0, H - 1);
      return field[(cy * W + cx) * 3 + ch];
    }
    const x0 = fx | 0;
    const y0 = fy | 0;
    const dx = fx - x0;
    const dy = fy - y0;
    const i00 = (y0 * W + x0) * 3 + ch;
    const i10 = i00 + 3;
    const i01 = i00 + W * 3;
    const i11 = i01 + 3;
    const top = field[i00] + (field[i10] - field[i00]) * dx;
    const bot = field[i01] + (field[i11] - field[i01]) * dx;
    return top + (bot - top) * dy;
  }

  // --- Build crisp horizontal strata slice schedule from real codebase strata ---
  function buildSliceSchedule(H2, model) {
    const slices = [];
    const rng = mulberry32(model.seed ^ 0x3c6ef372);

    const upper = [];
    const lower = [];
    for (const s of model.strata) {
      if (s.midV < 0.50) upper.push(s);
      else lower.push(s);
    }

    // 1. Upper sculptural slices: crisp stepped glitch cuts + rectangular crystal sub-blocks
    for (let i = 0; i < upper.length; i++) {
      const s = upper[i];
      const yStart = Math.floor(s.y0 * H2);
      const yEnd = Math.floor(s.y1 * H2);
      const totalH = Math.max(2, yEnd - yStart);
      const sub = s.subSlices || 1;
      let curY = yStart;

      for (let k = 0; k < sub; k++) {
        const frac = k === sub - 1 ? 1 : (0.55 + rng() * 0.9) / sub;
        const nextY = k === sub - 1 ? yEnd : Math.min(yEnd, curY + Math.max(8, Math.round(totalH * frac)));
        if (nextY <= curY) continue;

        const sliceMidV = 0.5 * (curY + nextY) / H2;
        const transT = smoothstep(0.41, 0.51, sliceMidV);

        const subSign = k % 2 === 0 ? 1 : -1;
        const shearPx = (s.shearX * 840 * (0.72 + 0.52 * rng()) + subSign * (7 + s.crossNorm * 24)) * 2;
        const dispPx = (s.disp * 1.2) * 2 * (0.85 + 0.45 * rng());
        const dySample = (rng() - 0.5) * 14 * (0.45 + s.crossNorm);

        const blockCount = s.isAccent || s.crossNorm > 0.25 ? 3 + ((s.seed + k) % 4) : 2;
        const blocks = [];
        let bx = 0.24 + rng() * 0.12; // Keep far-left crimson cloud organic & smoky!
        for (let b = 0; b < blockCount; b++) {
          const bw = 0.06 + rng() * 0.17;
          blocks.push({
            u0: bx,
            u1: Math.min(0.98, bx + bw),
            dx: (rng() - 0.5) * (18 + s.crossNorm * 52) * 2 * (1 - 0.35 * transT),
            dy: (rng() - 0.5) * (11 + s.crossNorm * 22) * (1 - 0.45 * transT),
            boost: 0.78 + rng() * 0.46,
          });
          bx += bw * (0.72 + rng() * 0.52);
        }

        slices.push({
          y0: curY,
          y1: nextY,
          isUpper: true,
          transT,
          isAccent: s.isAccent,
          shearPx,
          dispPx,
          dySample,
          energyBoost: 0.88 + (s.isAccent ? 0.16 : 0) + (rng() - 0.5) * 0.22,
          // Organic vertical crystal grain (gentle, never comb-like!)
          ribStrength: (0.12 + s.crossNorm * 0.14 + (s.isAccent ? 0.06 : 0)) * (1 - 0.45 * transT),
          streakBase: (4.5 + rng() * 10.5) * (1 - transT) + (20 + rng() * 14) * transT,
          streakBias: (rng() - 0.5) * 0.5,
          blocks,
          seed: (s.seed ^ (k * 2654435761)) >>> 0,
        });
        curY = nextY;
      }
    }

    // 2. Lower cascading panoramic reflection panes: 7-9 bold stepped glass panes
    const totalLowerLoc = lower.reduce((acc, s) => acc + s.loc, 0);
    const targetPanes = clamp(Math.round(6 + lower.length * 0.08), 7, 9);
    const locThreshold = totalLowerLoc / targetPanes;

    let paneIdx = 0;
    let paneLoc = 0;
    let paneDir = -1;
    let paneShear = -0.024 * 840 * 2;
    let paneDisp = 6.0 * 2;
    let paneTone = 1.06;
    let prevArea = lower[0]?.area;

    for (let i = 0; i < lower.length; i++) {
      const s = lower[i];
      const areaChanged = s.area !== prevArea && paneLoc > locThreshold * 0.42;
      if (paneLoc >= locThreshold || areaChanged) {
        paneIdx++;
        paneLoc = 0;
        paneDir = paneIdx % 2 === 0 ? 1 : -1;
        const mag = 0.020 + s.crossNorm * 0.058 + 0.034 * rng();
        paneShear = paneDir * mag * 840 * 2;
        paneDisp = (4.2 + s.crossNorm * 9.5 + rng() * 4.8) * 2;
        paneTone = paneIdx % 3 === 1 ? 0.72 + rng() * 0.18 : 0.94 + rng() * 0.26;
        prevArea = s.area;
      }
      paneLoc += s.loc;

      const yStart = Math.floor(s.y0 * H2);
      const yEnd = i === lower.length - 1 ? H2 : Math.floor(s.y1 * H2);
      if (yEnd <= yStart) continue;

      const microShear = s.shearX * 840 * 0.15 * 2;
      slices.push({
        y0: yStart,
        y1: yEnd,
        isUpper: false,
        transT: 1,
        isAccent: s.isAccent,
        paneIdx,
        shearPx: paneShear + microShear,
        dispPx: paneDisp + s.disp * 0.35,
        dySample: ((paneIdx % 3) - 1) * 6,
        energyBoost: paneTone * (0.94 + s.locNorm * 0.12),
        ribStrength: 0.035 + s.crossNorm * 0.03,
        streakBase: 22 + rng() * 34 + (s.y0 - 0.5) * 26,
        streakBias: paneDir * 0.34,
        blocks: null,
        seed: s.seed,
      });
    }

    return slices;
  }

  // --- Rich Nocturnal Filmic Tone-Mapping ---
  function toneMap(v) {
    const x = Math.max(0, v);
    const contrasted = (x * x) / (x + 0.20);
    const a = 2.51;
    const b = 0.025;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;
    const aces = (contrasted * (a * contrasted + b)) / (contrasted * (c * contrasted + d) + e);
    return Math.pow(clamp(aces, 0, 1), 1 / 1.44);
  }

  function drawTrackedText(ctx, text, x, y, trackingPx, spaceScale = 0.45) {
    let cx = x;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      ctx.fillText(ch, cx, y);
      const adv = ctx.measureText(ch).width;
      const tr = ch === " " ? trackingPx * spaceScale : trackingPx;
      cx += adv + tr;
    }
    return cx - x;
  }

  window.renderStrataPoster = function renderStrataPoster(canvas, model) {
    const W1 = 840;
    const H1 = 1190;
    const DPR = 2;
    const W2 = W1 * DPR;
    const H2 = H1 * DPR;

    canvas.width = W2;
    canvas.height = H2;
    const ctx = canvas.getContext("2d");

    // 1. Synthesize continuous HDR sculptural light-field at 1x
    const hdrBase = synthesizeHDRField(W1, H1, model);

    // 2. Build horizontal strata slice schedule at native 2x
    const slices = buildSliceSchedule(H2, model);
    const rowSlice = new Array(H2);
    for (let i = 0; i < slices.length; i++) {
      const sl = slices[i];
      const a = clamp(sl.y0, 0, H2);
      const b = clamp(sl.y1, 0, H2);
      for (let y = a; y < b; y++) rowSlice[y] = sl;
    }

    // 3. Slice, shear, upper micro-blocks, irregular vertical crystal columns, and RGB chromatic dispersion
    const hdr2 = new Float32Array(W2 * H2 * 3);
    const rowRng = mulberry32(model.seed ^ 0x7f4a7c15);
    const colNoise = makeNoise(model.seed ^ 0x243f6a88);

    // Precompute non-periodic irregular multi-scale vertical column table (eliminates synthetic sine comb!)
    const colModFine = new Float32Array(W2);
    const colModMed = new Float32Array(W2);
    for (let x = 0; x < W2; x++) {
      // Irregular micro-column strips (widths 2px to 11px) via multi-scale value noise
      colModFine[x] = colNoise.noise2(x * 0.23, 1.7) * 0.65 + colNoise.noise2(x * 0.51, 9.3) * 0.35 - 0.5;
      colModMed[x] = colNoise.noise2(x * 0.065, 4.2) - 0.5;
    }

    for (let y = 0; y < H2; y++) {
      const sl = rowSlice[y];
      const fyBase = y / DPR;

      if (!sl) {
        for (let x = 0; x < W2; x++) {
          const fx = x / DPR;
          const idx = (y * W2 + x) * 3;
          hdr2[idx] = sampleHDR(hdrBase, W1, H1, fx, fyBase, 0) * 0.55;
          hdr2[idx + 1] = sampleHDR(hdrBase, W1, H1, fx, fyBase, 1) * 0.55;
          hdr2[idx + 2] = sampleHDR(hdrBase, W1, H1, fx, fyBase, 2) * 0.55;
        }
        continue;
      }

      const bandT = (y - sl.y0) / Math.max(1, sl.y1 - sl.y0);
      const edgeSheen = 1.03 + (bandT < 0.06 ? 0.11 * (1 - bandT / 0.06) : 0) - bandT * 0.12;

      const scanJitter = (rowRng() - 0.5) * (sl.isUpper ? 3.2 : 1.5);
      const baseShear = sl.shearPx + scanJitter;
      const dispR = sl.dispPx * 0.72;
      const dispG = -sl.dispPx * 0.06;
      const dispB = -sl.dispPx * 0.68;
      const boost = sl.energyBoost * edgeSheen;
      const ribAmp = sl.ribStrength;
      const blocks = sl.blocks;
      const colOff = (sl.seed % 511);

      for (let x = 0; x < W2; x++) {
        const u = x / W2;
        let dx = baseShear;
        let dy = sl.dySample;
        let bBoost = boost;

        if (blocks) {
          for (let b = 0; b < blocks.length; b++) {
            const bl = blocks[b];
            if (u >= bl.u0 && u <= bl.u1) {
              dx += bl.dx;
              dy += bl.dy;
              bBoost *= bl.boost;
              break;
            }
          }
        }

        // Irregular non-periodic vertical glass/phosphor grain (kept off the far-left smoky crimson cloud!)
        let rib = 1.0;
        if (ribAmp > 0.01 && u > 0.34) {
          const ribMask = smoothstep(0.34, 0.46, u);
          const cx = (x + colOff) % W2;
          const fine = colModFine[cx];
          const med = colModMed[cx];
          rib = 1.0 + ribAmp * ribMask * (fine * 1.15 + med * 0.75);
        }

        const fx = (x - dx) / DPR;
        const fy = fyBase + dy;

        const r = sampleHDR(hdrBase, W1, H1, fx - dispR / DPR, fy, 0) * bBoost * rib;
        const g = sampleHDR(hdrBase, W1, H1, fx - dispG / DPR, fy, 1) * bBoost * rib;
        const b = sampleHDR(hdrBase, W1, H1, fx - dispB / DPR, fy, 2) * bBoost * rib;

        const idx = (y * W2 + x) * 3;
        hdr2[idx] = r;
        hdr2[idx + 1] = g;
        hdr2[idx + 2] = b;
      }
    }

    // 4. Silky Per-Scanline Horizontal Pixel-Sort / Motion-Streak Pass (STRICTLY 1D horizontal)
    const streakRng = mulberry32(model.seed ^ 0x6a09e667);
    const rowTmp = new Float32Array(W2 * 3);
    let smoothRowL = 12;

    for (let y = 0; y < H2; y++) {
      const sl = rowSlice[y];
      const v = y / H2;
      const isUpper = sl ? sl.isUpper : true;
      const transT = sl ? sl.transT : 0;

      if ((y & 1) === 0) {
        const baseL = sl ? sl.streakBase : 10;
        const spike = streakRng() < (isUpper ? 0.13 : 0.26) ? 1.7 + streakRng() * 2.1 : 0.44 + streakRng() * 1.08;
        smoothRowL = smoothRowL * 0.28 + baseL * spike * 0.72;
      }

      const bias = sl ? sl.streakBias : 0;
      const Lfwd = Math.max(1.8, smoothRowL * (1.0 + bias));
      const Lbwd = Math.max(1.8, smoothRowL * (1.0 - bias));
      const af = 1 - Math.exp(-1 / Lfwd);
      const ab = 1 - Math.exp(-1 / Lbwd);

      // Smooth ramp from sharp upper crystal (0.30) through transition (0.48) to silky lower rivers (0.66)
      const mixStreak = isUpper ? 0.28 + 0.34 * transT : 0.65;
      const mixSharp = 1 - mixStreak;

      const rowOff = y * W2 * 3;
      let ar = hdr2[rowOff];
      let ag = hdr2[rowOff + 1];
      let ab_c = hdr2[rowOff + 2];
      for (let x = 0; x < W2; x++) {
        const i = rowOff + x * 3;
        ar += (hdr2[i] - ar) * af;
        ag += (hdr2[i + 1] - ag) * af;
        ab_c += (hdr2[i + 2] - ab_c) * af;
        const j = x * 3;
        rowTmp[j] = ar;
        rowTmp[j + 1] = ag;
        rowTmp[j + 2] = ab_c;
      }

      ar = hdr2[rowOff + (W2 - 1) * 3];
      ag = hdr2[rowOff + (W2 - 1) * 3 + 1];
      ab_c = hdr2[rowOff + (W2 - 1) * 3 + 2];
      for (let x = W2 - 1; x >= 0; x--) {
        const i = rowOff + x * 3;
        ar += (hdr2[i] - ar) * ab;
        ag += (hdr2[i + 1] - ag) * ab;
        ab_c += (hdr2[i + 2] - ab_c) * ab;
        const j = x * 3;
        const sr = 0.5 * (rowTmp[j] + ar);
        const sg = 0.5 * (rowTmp[j + 1] + ag);
        const sb = 0.5 * (rowTmp[j + 2] + ab_c);

        hdr2[i] = hdr2[i] * mixSharp + sr * mixStreak;
        hdr2[i + 1] = hdr2[i + 1] * mixSharp + sg * mixStreak;
        hdr2[i + 2] = hdr2[i + 2] * mixSharp + sb * mixStreak;
      }
    }

    // 5. Restrained Specular Halo Bloom (ONLY from genuine hottest peaks lum > 0.95)
    const BW = 210;
    const BH = 298;
    const bloom = new Float32Array(BW * BH * 3);
    const sx = W2 / BW;
    const sy = H2 / BH;
    for (let by = 0; by < BH; by++) {
      const y = Math.min(H2 - 1, Math.floor((by + 0.5) * sy));
      for (let bx = 0; bx < BW; bx++) {
        const x = Math.min(W2 - 1, Math.floor((bx + 0.5) * sx));
        const src = (y * W2 + x) * 3;
        const r = hdr2[src];
        const g = hdr2[src + 1];
        const b = hdr2[src + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const knee = smoothstep(0.92, 1.80, lum);
        const dst = (by * BW + bx) * 3;
        bloom[dst] = r * knee;
        bloom[dst + 1] = g * knee;
        bloom[dst + 2] = b * knee;
      }
    }
    boxBlurRGB(bloom, BW, BH, 6, 3);

    // 6. Left Quiet Darkness Sanctuary + Nocturnal Filmic Tone-Mapping + Matte Print Film Grain
    const imgData = ctx.createImageData(W2, H2);
    const px = imgData.data;
    const grainRng = mulberry32(model.seed ^ 0xbb67ae85);

    const BASE_R = 10;
    const BASE_G = 10;
    const BASE_B = 13;

    for (let y = 0; y < H2; y++) {
      const v = y / H2;
      const byF = clamp((y / H2) * (BH - 1), 0, BH - 1.001);
      const by0 = byF | 0;
      const bdy = byF - by0;

      const typoBandV = smoothstep(0.27, 0.36, v) * (1 - smoothstep(0.61, 0.72, v));
      const colophonV = smoothstep(0.86, 0.93, v);
      const leftSanctuaryV = Math.max(typoBandV, colophonV);

      for (let x = 0; x < W2; x++) {
        const u = x / W2;

        const bxF = clamp((x / W2) * (BW - 1), 0, BW - 1.001);
        const bx0 = bxF | 0;
        const bdx = bxF - bx0;
        const b00 = (by0 * BW + bx0) * 3;
        const b10 = b00 + 3;
        const b01 = b00 + BW * 3;
        const b11 = b01 + 3;

        const blR =
          (bloom[b00] + (bloom[b10] - bloom[b00]) * bdx) * (1 - bdy) +
          (bloom[b01] + (bloom[b11] - bloom[b01]) * bdx) * bdy;
        const blG =
          (bloom[b00 + 1] + (bloom[b10 + 1] - bloom[b00 + 1]) * bdx) * (1 - bdy) +
          (bloom[b01 + 1] + (bloom[b11 + 1] - bloom[b01 + 1]) * bdx) * bdy;
        const blB =
          (bloom[b00 + 2] + (bloom[b10 + 2] - bloom[b00 + 2]) * bdx) * (1 - bdy) +
          (bloom[b01 + 2] + (bloom[b11 + 2] - bloom[b01 + 2]) * bdx) * bdy;

        const src = (y * W2 + x) * 3;
        let r = hdr2[src] + blR * 0.25;
        let g = hdr2[src + 1] + blG * 0.25;
        let b = hdr2[src + 2] + blB * 0.25;

        if (leftSanctuaryV > 0.001 && u < 0.54) {
          const protect = 1 - smoothstep(0.35, 0.53, u);
          const atten = 1 - protect * leftSanctuaryV * 0.94;
          r *= atten;
          g *= atten;
          b *= atten;
        }
        if (v > 0.48 && u < 0.44) {
          const lowerLeftKeep = smoothstep(0.24, 0.44, u);
          const atten = 0.08 + 0.92 * lowerLeftKeep;
          r *= atten;
          g *= atten;
          b *= atten;
        }

        const mr = toneMap(r);
        const mg = toneMap(g);
        const mb = toneMap(b);

        const lum = 0.299 * mr + 0.587 * mg + 0.114 * mb;
        const gAmp = 5.4 + lum * 4.8;
        const nL = (grainRng() + grainRng() - 1) * gAmp;
        const nC = (grainRng() - 0.5) * 1.6;

        const outR = BASE_R + mr * (255 - BASE_R) + nL + nC;
        const outG = BASE_G + mg * (255 - BASE_G) + nL;
        const outB = BASE_B + mb * (255 - BASE_B) + nL - nC;

        const o = (y * W2 + x) * 4;
        px[o] = clamp(Math.round(outR), 0, 255);
        px[o + 1] = clamp(Math.round(outG), 0, 255);
        px[o + 2] = clamp(Math.round(outB), 0, 255);
        px[o + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // 7. Razor-Sharp Editorial Typography (Vector-rendered in CSS 1x scaled by 2x DPR)
    ctx.save();
    ctx.scale(DPR, DPR);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    const leftX = 66;

    const titleSize = 37;
    const titleLeading = 41;
    let curY = 464;

    ctx.font = `600 ${titleSize}px "Inter Display", "Inter", sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    for (let i = 0; i < model.copy.title.length; i++) {
      drawTrackedText(ctx, model.copy.title[i].toUpperCase(), leftX, curY, 0.85, 0.75);
      curY += titleLeading;
    }

    curY += 16;
    const subSize = 18;
    const subLeading = 25;
    ctx.font = `400 ${subSize}px "Commit Mono", monospace`;
    ctx.fillStyle = "#8C9BB8";
    for (let i = 0; i < model.copy.subtitle.length; i++) {
      drawTrackedText(ctx, model.copy.subtitle[i].toUpperCase(), leftX, curY, 0.65, 0.85);
      curY += subLeading;
    }

    curY += 20;
    const accSize = 13.5;
    ctx.font = `700 ${accSize}px "Commit Mono", monospace`;
    ctx.fillStyle = "#D24C5E";
    drawTrackedText(ctx, model.copy.accentLine.toUpperCase(), leftX, curY, 0.55, 0.85);

    const colSize = 11.5;
    ctx.font = `400 ${colSize}px "Newsreader", Georgia, serif`;
    ctx.fillStyle = "#C8C8CE";
    drawTrackedText(ctx, model.copy.colophon.toUpperCase(), leftX, 1146, colSize * 0.54, 0.55);

    ctx.restore();

    return {
      width: W2,
      height: H2,
      slices: slices.length,
    };
  };
})();

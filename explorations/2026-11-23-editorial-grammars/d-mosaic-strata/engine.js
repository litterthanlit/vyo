// Exploration D (d-mosaic-strata): Unified Browser-Side Canvas Compositor
// Fuses Exploration A (crisp 7px dot/square mosaic lattice + sparse plain-language micro-type)
// with Exploration C (real codebase stepped horizontal strata + chromatic RGB refraction).
// Renders 840x1190 logical canvas at 2x DPR (1680x2380px).

(function () {
  "use strict";

  const W = 840;
  const H = 1190;
  const DPR = 2;
  const PITCH = 7;
  const COLS = Math.floor(W / PITCH); // 120
  const ROWS = Math.floor(H / PITCH); // 170

  const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

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

  function cellHash(cx, cy, seed, salt = 0) {
    let h =
      Math.imul(cx, 374761393) ^
      Math.imul(cy, 668265263) ^
      Math.imul((salt + seed) | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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

  function drawRoundedRect(ctx, x, y, w, h, rx) {
    const r = Math.min(rx, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawTrackedText(ctx, text, x, y, trackingPx, spaceScale = 0.55) {
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

  function toneMap(v) {
    const x = Math.max(0, v);
    const contrasted = (x * x) / (x + 0.18);
    const a = 2.51;
    const b = 0.025;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;
    const aces = (contrasted * (a * contrasted + b)) / (contrasted * (c * contrasted + d) + e);
    return Math.pow(clamp(aces, 0, 1), 1 / 1.42);
  }

  function rgbHex(r, g, b) {
    const cr = clamp(Math.round(r * 255), 0, 255);
    const cg = clamp(Math.round(g * 255), 0, 255);
    const cb = clamp(Math.round(b * 255), 0, 255);
    return `rgb(${cr},${cg},${cb})`;
  }

  function sampleField(field, fw, fh, fx, fy, ch) {
    if (fx < -2 || fy < -2) return 0;
    const cx = clamp(fx, 0, fw - 1.001);
    const cy = clamp(fy, 0, fh - 1.001);
    const x0 = cx | 0;
    const y0 = cy | 0;
    const dx = cx - x0;
    const dy = cy - y0;
    const i00 = (y0 * fw + x0) * 3 + ch;
    const i10 = i00 + 3;
    const i01 = i00 + fw * 3;
    const i11 = i01 + 3;
    const top = field[i00] + (field[i10] - field[i00]) * dx;
    const bot = field[i01] + (field[i11] - field[i01]) * dx;
    return top + (bot - top) * dy;
  }

  // =========================================================================
  // SHARED: GRID-ALIGNED HORIZONTAL STRATA SLICE SCHEDULE (7px ROW SNAPPED!)
  // =========================================================================
  function buildGridSlices(model, opts = {}) {
    const shearScale = opts.shearScale ?? 1.0;
    const dispScale = opts.dispScale ?? 1.0;
    const streakScale = opts.streakScale ?? 1.0;
    const slices = [];
    const rng = mulberry32(model.seed ^ 0x3c6ef372);

    const upper = [];
    const lower = [];
    for (const s of model.strata) {
      if (s.midV < 0.52) upper.push(s);
      else lower.push(s);
    }

    // 1. Upper sculptural slices snapped to exact 7px rows
    for (let i = 0; i < upper.length; i++) {
      const s = upper[i];
      const rStart = Math.floor(s.y0 * ROWS);
      const rEnd = Math.max(rStart + 1, Math.floor(s.y1 * ROWS));
      const totalR = rEnd - rStart;
      const sub = Math.min(totalR, s.subSlices || 1);
      let curR = rStart;

      for (let k = 0; k < sub; k++) {
        const nextR =
          k === sub - 1
            ? rEnd
            : Math.min(rEnd, curR + Math.max(1, Math.round((totalR / sub) * (0.6 + rng() * 0.8))));
        if (nextR <= curR) continue;

        const sliceMidV = (0.5 * (curR + nextR)) / ROWS;
        const transT = smoothstep(0.42, 0.54, sliceMidV);
        const subSign = k % 2 === 0 ? 1 : -1;

        const shearCols =
          (s.shearX * COLS * (0.78 + 0.5 * rng()) + subSign * (1.2 + s.crossNorm * 4.2)) *
          shearScale;
        const dispCols = (0.55 + (s.disp / PITCH) * 0.72) * (0.85 + 0.45 * rng()) * dispScale;
        const dyRows = (rng() - 0.5) * 2.1 * (0.45 + s.crossNorm) * shearScale;

        const blockCount = s.isAccent || s.crossNorm > 0.25 ? 2 + ((s.seed + k) % 3) : 1;
        const blocks = [];
        let bx = 0.28 + rng() * 0.14;
        for (let b = 0; b < blockCount; b++) {
          const bw = 0.08 + rng() * 0.18;
          blocks.push({
            u0: bx,
            u1: Math.min(0.98, bx + bw),
            dxCols: (rng() - 0.5) * (3.2 + s.crossNorm * 8.5) * shearScale * (1 - 0.3 * transT),
            dyRows: (rng() - 0.5) * (1.6 + s.crossNorm * 2.6) * shearScale,
            boost: 0.80 + rng() * 0.45,
          });
          bx += bw * (0.75 + rng() * 0.5);
        }

        slices.push({
          r0: curR,
          r1: nextR,
          isUpper: true,
          transT,
          isAccent: s.isAccent,
          crossNorm: s.crossNorm,
          locNorm: s.locNorm,
          shearCols,
          dispCols,
          dyRows,
          energyBoost: 0.90 + (s.isAccent ? 0.18 : 0) + (rng() - 0.5) * 0.24,
          streakCols: ((1.2 + rng() * 2.6) * (1 - transT) + (3.2 + rng() * 2.8) * transT) * streakScale,
          streakBias: (rng() - 0.5) * 0.55,
          blocks,
          seed: (s.seed ^ (k * 2654435761)) >>> 0,
        });
        curR = nextR;
      }
    }

    // 2. Lower sweeping stepped panes (7-9 bold sculptural stepped bands)
    const totalLowerLoc = lower.reduce((acc, s) => acc + s.loc, 0);
    const targetPanes = clamp(Math.round(6 + lower.length * 0.08), 7, 9);
    const locThreshold = totalLowerLoc / Math.max(1, targetPanes);

    let paneIdx = 0;
    let paneLoc = 0;
    let paneDir = -1;
    let paneShear = -3.4 * shearScale;
    let paneDisp = 1.35 * dispScale;
    let paneTone = 1.08;
    let prevArea = lower[0]?.area;

    for (let i = 0; i < lower.length; i++) {
      const s = lower[i];
      const areaChanged = s.area !== prevArea && paneLoc > locThreshold * 0.42;
      if (paneLoc >= locThreshold || areaChanged) {
        paneIdx++;
        paneLoc = 0;
        paneDir = paneIdx % 2 === 0 ? 1 : -1;
        const mag = 0.025 + s.crossNorm * 0.068 + 0.036 * rng();
        paneShear = paneDir * mag * COLS * shearScale;
        paneDisp = (0.75 + s.crossNorm * 1.45 + rng() * 0.75) * dispScale;
        paneTone = paneIdx % 3 === 1 ? 0.74 + rng() * 0.16 : 0.96 + rng() * 0.28;
        prevArea = s.area;
      }
      paneLoc += s.loc;

      const rStart = Math.floor(s.y0 * ROWS);
      const rEnd = i === lower.length - 1 ? ROWS : Math.floor(s.y1 * ROWS);
      if (rEnd <= rStart) continue;

      slices.push({
        r0: rStart,
        r1: rEnd,
        isUpper: false,
        transT: 1,
        isAccent: s.isAccent,
        crossNorm: s.crossNorm,
        locNorm: s.locNorm,
        paneIdx,
        shearCols: paneShear + s.shearX * COLS * 0.16 * shearScale,
        dispCols: paneDisp + (s.disp / PITCH) * 0.22 * dispScale,
        dyRows: ((paneIdx % 3) - 1) * 0.9 * shearScale,
        energyBoost: paneTone * (0.94 + s.locNorm * 0.14),
        streakCols: (3.2 + rng() * 4.5 + (s.y0 - 0.5) * 3.5) * streakScale,
        streakBias: paneDir * 0.36,
        blocks: null,
        seed: s.seed,
      });
    }

    const rowSlice = new Array(ROWS);
    for (const sl of slices) {
      const a = clamp(sl.r0, 0, ROWS);
      const b = clamp(sl.r1, 0, ROWS);
      for (let r = a; r < b; r++) rowSlice[r] = sl;
    }
    return { slices, rowSlice };
  }

  // =========================================================================
  // SHARED: APPLY HORIZONTAL STRATA REFRACTION + RGB DISPERSION + 1D STREAK
  // ONTO THE 120 x 170 MOSAIC CELL GRID
  // =========================================================================
  function refractFieldToGrid(hdrField, fw, fh, model, opts = {}) {
    const { slices, rowSlice } = buildGridSlices(model, opts);
    const gridRGB = new Float32Array(COLS * ROWS * 3);
    const rowRng = mulberry32(model.seed ^ 0x7f4a7c15);
    const streakMixBase = opts.streakMix ?? 0.52;
    const upperStreakMix = opts.upperStreakMix ?? 0.24;

    for (let row = 0; row < ROWS; row++) {
      const sl = rowSlice[row];
      const fyBase = (row + 0.5) * (fh / ROWS);

      if (!sl) {
        for (let col = 0; col < COLS; col++) {
          const fx = (col + 0.5) * (fw / COLS);
          const idx = (row * COLS + col) * 3;
          gridRGB[idx] = sampleField(hdrField, fw, fh, fx, fyBase, 0) * 0.72;
          gridRGB[idx + 1] = sampleField(hdrField, fw, fh, fx, fyBase, 1) * 0.72;
          gridRGB[idx + 2] = sampleField(hdrField, fw, fh, fx, fyBase, 2) * 0.72;
        }
        continue;
      }

      const bandT = (row - sl.r0) / Math.max(1, sl.r1 - sl.r0);
      const edgeSheen = 1.04 + (bandT < 0.14 ? 0.14 * (1 - bandT / 0.14) : 0) - bandT * 0.10;
      const couplingBoost = opts.couplingAdaptive
        ? 0.58 + 0.92 * smoothstep(0.18, 0.72, sl.crossNorm + (sl.isAccent ? 0.2 : 0))
        : 1.0;
      const scanJitter = (rowRng() - 0.5) * (sl.isUpper ? 0.65 : 0.35) * (opts.shearScale ?? 1) * couplingBoost;
      const baseShear = sl.shearCols * couplingBoost + scanJitter;
      // Pair G closely with B so chromatic dispersion splits cleanly into warm crimson <-> cool glacier-cyan/amethyst
      // without leaving stray isolated neon-green dots on thin botanical stems/twigs!
      const dispR = sl.dispCols * 0.92;
      const dispG = opts.cyanPairedDisp ? -sl.dispCols * 0.48 : -sl.dispCols * 0.14;
      const dispB = -sl.dispCols * 0.88;
      const boost = sl.energyBoost * edgeSheen;
      const blocks = sl.blocks;

      for (let col = 0; col < COLS; col++) {
        const u = (col + 0.5) / COLS;
        let dxC = baseShear;
        let dyR = sl.dyRows * couplingBoost;
        let bBoost = boost;

        if (blocks) {
          for (let b = 0; b < blocks.length; b++) {
            const bl = blocks[b];
            if (u >= bl.u0 && u <= bl.u1) {
              dxC += bl.dxCols * couplingBoost;
              dyR += bl.dyRows * couplingBoost;
              bBoost *= bl.boost;
              break;
            }
          }
        }

        const fx = (col + 0.5 - dxC) * (fw / COLS);
        const fy = (row + 0.5 + dyR) * (fh / ROWS);
        const stepX = fw / COLS;

        // 3-tap micro-super-sample vertically inside each 7px row for clean non-aliased signal
        let r = 0,
          g = 0,
          b = 0;
        for (const oy of [-0.26, 0, 0.26]) {
          const sy = fy + oy * (fh / ROWS);
          r += sampleField(hdrField, fw, fh, fx - dispR * stepX, sy, 0);
          g += sampleField(hdrField, fw, fh, fx - dispG * stepX, sy, 1);
          b += sampleField(hdrField, fw, fh, fx - dispB * stepX, sy, 2);
        }
        const inv3 = bBoost / 3;
        const idx = (row * COLS + col) * 3;
        gridRGB[idx] = r * inv3;
        gridRGB[idx + 1] = g * inv3;
        gridRGB[idx + 2] = b * inv3;
      }
    }

    // 1D Horizontal Cell-Row Motion-Streak Pass (preserves crisp vertical slice cuts!)
    const streakRng = mulberry32(model.seed ^ 0x6a09e667);
    const rowTmp = new Float32Array(COLS * 3);
    for (let row = 0; row < ROWS; row++) {
      const sl = rowSlice[row];
      if (!sl) continue;
      const baseL = sl.streakCols;
      const spike = streakRng() < (sl.isUpper ? 0.20 : 0.30) ? 1.5 + streakRng() * 1.5 : 0.55 + streakRng() * 0.9;
      const rowL = Math.max(0.6, baseL * spike);
      const bias = sl.streakBias || 0;
      const Lfwd = Math.max(0.5, rowL * (1 + bias));
      const Lbwd = Math.max(0.5, rowL * (1 - bias));
      const af = 1 - Math.exp(-1 / Lfwd);
      const ab = 1 - Math.exp(-1 / Lbwd);

      const mixS = sl.isUpper
        ? upperStreakMix + (streakMixBase - upperStreakMix) * sl.transT
        : streakMixBase;
      const mixO = 1 - mixS;

      const off = row * COLS * 3;
      let ar = gridRGB[off],
        ag = gridRGB[off + 1],
        abC = gridRGB[off + 2];
      for (let c = 0; c < COLS; c++) {
        const i = off + c * 3;
        ar += (gridRGB[i] - ar) * af;
        ag += (gridRGB[i + 1] - ag) * af;
        abC += (gridRGB[i + 2] - abC) * af;
        rowTmp[c * 3] = ar;
        rowTmp[c * 3 + 1] = ag;
        rowTmp[c * 3 + 2] = abC;
      }

      ar = gridRGB[off + (COLS - 1) * 3];
      ag = gridRGB[off + (COLS - 1) * 3 + 1];
      abC = gridRGB[off + (COLS - 1) * 3 + 2];
      for (let c = COLS - 1; c >= 0; c--) {
        const i = off + c * 3;
        ar += (gridRGB[i] - ar) * ab;
        ag += (gridRGB[i + 1] - ag) * ab;
        abC += (gridRGB[i + 2] - abC) * ab;
        const sr = 0.5 * (rowTmp[c * 3] + ar);
        const sg = 0.5 * (rowTmp[c * 3 + 1] + ag);
        const sb = 0.5 * (rowTmp[c * 3 + 2] + abC);
        gridRGB[i] = gridRGB[i] * mixO + sr * mixS;
        gridRGB[i + 1] = gridRGB[i + 1] * mixO + sg * mixS;
        gridRGB[i + 2] = gridRGB[i + 2] * mixO + sb * mixS;
      }
    }

    return { gridRGB, slices, rowSlice };
  }

  // =========================================================================
  // SHARED: BLOOMSBURY EDITORIAL TYPOGRAPHY (DARK LEFT SANCTUARY)
  // =========================================================================
  function drawBloomsburyTypography(ctx, model) {
    ctx.save();
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
    ctx.fillStyle = "#DC4C5E";
    drawTrackedText(ctx, model.copy.accentLine.toUpperCase(), leftX, curY, 0.55, 0.85);

    const colSize = 11.5;
    ctx.font = `400 ${colSize}px "Newsreader", Georgia, serif`;
    ctx.fillStyle = "#C8C8CE";
    drawTrackedText(ctx, model.copy.colophon.toUpperCase(), leftX, 1146, colSize * 0.54, 0.55);

    ctx.restore();
  }

  // =========================================================================
  // SHARED: OBSIDIAN 7px MOSAIC CELL RENDERER + SPARSE MICRO-TYPE WEAVER
  // =========================================================================
  function renderObsidianMosaicFromGrid(ctx, gridRGB, model, opts = {}) {
    const GROUND = "#090A0D";
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, W, H);

    // Pre-classify every cell on the 120 x 170 lattice
    // cellKind: 0=empty, 1=dimTwilight, 2=midStrata, 3=crimsonBead, 4=specularWhite
    const cellKind = new Uint8Array(COLS * ROWS);
    const cellLum = new Float32Array(COLS * ROWS);
    const cellSize = new Float32Array(COLS * ROWS);
    const cellRx = new Float32Array(COLS * ROWS);
    const cellColor = new Array(COLS * ROWS);

    const sanctuaryRight = opts.sanctuaryRight ?? 0.50;
    const sanctuarySoft = opts.sanctuarySoft ?? 0.39;
    const strictLeftCut = opts.strictLeftCut ?? 0.26;
    const specLumThresh = opts.specLumThresh ?? 0.85;
    const specMinThresh = opts.specMinThresh ?? 0.68;

    for (let row = 0; row < ROWS; row++) {
      const v = (row + 0.5) / ROWS;
      const typoBandV = smoothstep(0.29, 0.36, v) * (1 - smoothstep(0.60, 0.68, v));
      // Extra breathing sanctuary around the crimson accent line (v ~ 0.51..0.58)
      const accentLineV = smoothstep(0.49, 0.525, v) * (1 - smoothstep(0.575, 0.62, v));
      const colophonV = smoothstep(0.88, 0.93, v);
      const leftSanctuaryV = Math.max(typoBandV, colophonV);

      for (let col = 0; col < COLS; col++) {
        const u = (col + 0.5) / COLS;
        const idx = (row * COLS + col) * 3;
        let r = gridRGB[idx];
        let g = gridRGB[idx + 1];
        let b = gridRGB[idx + 2];

        // Protect calm obsidian left sanctuary for Bloomsbury editorial typography
        if (leftSanctuaryV > 0.001 && u < sanctuaryRight + 0.07) {
          const protect = 1 - smoothstep(sanctuarySoft, sanctuaryRight + 0.04, u);
          const atten = 1 - protect * leftSanctuaryV * 0.99;
          r *= atten;
          g *= atten;
          b *= atten;
        }
        if (accentLineV > 0.001 && u < 0.54) {
          const protectAcc = 1 - smoothstep(0.43, 0.53, u);
          const attenAcc = 1 - protectAcc * accentLineV * 0.98;
          r *= attenAcc;
          g *= attenAcc;
          b *= attenAcc;
        }
        if (v > 0.48 && u < 0.44) {
          const lowerKeep = smoothstep(strictLeftCut, 0.44, u);
          const atten = 0.03 + 0.97 * lowerKeep;
          r *= atten;
          g *= atten;
          b *= atten;
        }

        const mr = toneMap(r);
        const mg = toneMap(g);
        const mb = toneMap(b);
        const lum = 0.26 * mr + 0.58 * mg + 0.16 * mb;
        const cIdx = row * COLS + col;
        cellLum[cIdx] = lum;

        const bayer = BAYER4[row & 3][col & 3] / 16 - 0.5;
        const jitter = (cellHash(col, row, model.seed, 19) - 0.5) * 0.05 + bayer * 0.045;
        const thresh = 0.074 + jitter;

        if (lum < thresh && Math.max(mr, mg, mb) < 0.13 + jitter) {
          cellKind[cIdx] = 0;
          continue;
        }

        const crimDom = mr - Math.max(mg, mb) * 1.06;
        const specMin = Math.min(mr, mg, mb);

        if (lum > specLumThresh && specMin > specMinThresh) {
          // Tight icy-white specular jewel knot (restrained so cool glacier-cyan facets stay rich!)
          cellKind[cIdx] = 4;
          const t = clamp((lum - specLumThresh) / (1 - specLumThresh), 0, 1);
          const cr = 0.86 + t * 0.13;
          const cg = 0.93 + t * 0.06;
          const cb = 0.98 + t * 0.02;
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 5.2 + t * 0.6;
          cellRx[cIdx] = cellSize[cIdx] * 0.35;
        } else if (crimDom > 0.17 && mr > 0.28) {
          // Vivid glowing ember-crimson rounded bead/gem!
          cellKind[cIdx] = 3;
          const heat = clamp((mr - 0.26) / 0.66, 0, 1);
          const cr = 0.72 + heat * 0.24;
          const cg = 0.11 + heat * 0.17 + Math.max(0, mg - 0.22) * 0.35;
          const cb = 0.16 + heat * 0.13 + Math.max(0, mb - 0.22) * 0.4;
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 4.35 + heat * 1.35;
          cellRx[cIdx] = cellSize[cIdx] * 0.45; // jewel-like circular crimson bead!
        } else if (lum < 0.26 && Math.max(mr, mg, mb) < 0.38) {
          // Dim outer twilight/mist cells fading delicately into obsidian
          cellKind[cIdx] = 1;
          const t = clamp((Math.max(lum, Math.max(mr, mg, mb) * 0.65) - 0.06) / 0.24, 0, 1);
          const cr = clamp(0.14 + mr * 0.70, 0.14, 0.54);
          const cg = clamp(0.17 + mg * 0.70, 0.17, 0.56);
          const cb = clamp(0.28 + mb * 0.74, 0.26, 0.68);
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 2.75 + t * 1.55;
          cellRx[cIdx] = 0.6;
        } else {
          // Mid-tone refracted slate-blue / glacier-cyan / amethyst strata
          // Compress upper highlights gently toward icy glacier-cyan so facets never blow out flat white!
          cellKind[cIdx] = 2;
          const t = clamp((lum - 0.22) / 0.64, 0, 1);
          // Dampen stray pure-green imbalance gently toward glacier-cyan
          const safeG = mg > Math.max(mr, mb) * 1.12 ? Math.max(mr, mb) * 1.04 + (mg - Math.max(mr, mb)) * 0.25 : mg;
          const hiLift = smoothstep(0.62, 0.88, lum);
          const cr = clamp(mr * (0.90 - 0.14 * hiLift) + 0.06 + hiLift * 0.10, 0.18, 0.84);
          const cg = clamp(safeG * (0.92 - 0.06 * hiLift) + 0.06 + hiLift * 0.12, 0.22, 0.90);
          const cb = clamp(mb * 1.0 + 0.09 + hiLift * 0.08, 0.34, 0.97);
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 4.45 + t * 1.2;
          cellRx[cIdx] = 0.95;
        }
      }
    }

    // ---- PLAN SPARSE, CRISP MICRO-TYPE PLACEMENTS FIRST (SO WE CAN CARVE CLEAN 1-ROW OBSIDIAN SLOTS!) ----
    const textBlocked = new Uint8Array(COLS * ROWS);
    const carvedCell = new Uint8Array(COLS * ROWS);
    const phraseUsed = new Set();
    const placedTexts = [];

    function markBlocked(c0, r0, c1, r1) {
      const xA = Math.max(0, Math.floor(c0));
      const xB = Math.min(COLS - 1, Math.ceil(c1));
      const yA = Math.max(0, Math.floor(r0));
      const yB = Math.min(ROWS - 1, Math.ceil(r1));
      for (let r = yA; r <= yB; r++) {
        for (let c = xA; c <= xB; c++) textBlocked[r * COLS + c] = 1;
      }
    }

    // Sacred left sanctuary (title, subtitle, accent, colophon + generous margin)
    markBlocked(0, 48, 58, 114);
    markBlocked(0, 148, 48, 169);
    markBlocked(0, 0, 18, 169);

    function isAreaFree(c0, r0, c1, r1) {
      if (c0 < 20 || c1 >= COLS - 2 || r0 < 5 || r1 >= ROWS - 4) return false;
      for (let r = Math.floor(r0); r <= Math.ceil(r1); r++) {
        for (let c = Math.floor(c0); c <= Math.ceil(c1); c++) {
          if (textBlocked[r * COLS + c]) return false;
        }
      }
      return true;
    }

    function countLitAround(c, r, rad) {
      let n = 0;
      for (let dr = -rad; dr <= rad; dr++) {
        const rr = r + dr;
        if (rr < 0 || rr >= ROWS) continue;
        for (let dc = -rad; dc <= rad; dc++) {
          const cc = c + dc;
          if (cc < 0 || cc >= COLS) continue;
          if (cellKind[rr * COLS + cc] > 0) n++;
        }
      }
      return n;
    }

    // Check how many blazing specular white cells sit immediately above or below the candidate text row
    function countAdjacentGlare(col, row, span) {
      let glare = 0;
      for (const dr of [-1, 1]) {
        const rr = row + dr;
        if (rr < 0 || rr >= ROWS) continue;
        for (let dc = 0; dc < span; dc++) {
          const cc = col + dc;
          if (cc >= 0 && cc < COLS && cellKind[rr * COLS + cc] === 4) glare++;
        }
      }
      return glare;
    }

    const FONT_DEW = '400 8.8px "Commit Mono", monospace';
    const FONT_PHRASE = '400 8.8px "Commit Mono", monospace';
    const FONT_CORE = '700 8.5px "Commit Mono", monospace';

    function spanCols(str, font) {
      ctx.font = font;
      return Math.ceil(ctx.measureText(str).width / PITCH);
    }

    function commitText(str, col, row, padX, padY, font, fill, carveSlot) {
      if (phraseUsed.has(str)) return false;
      const span = spanCols(str, font);
      if (!isAreaFree(col - padX, row - padY, col + span + padX, row + padY)) return false;
      markBlocked(col - padX, row - padY, col + span + padX, row + padY);
      phraseUsed.add(str);

      if (carveSlot) {
        for (let c = Math.max(0, col - 1); c <= Math.min(COLS - 1, col + span); c++) {
          carvedCell[row * COLS + c] = 1;
        }
      }
      placedTexts.push({ str, col, row, font, fill });
      return true;
    }

    // PASS 1: Luminous silver-cyan "dew" words perched in quiet obsidian edges right beside bright strata!
    const dewCands = [];
    for (let r = 8; r < ROWS - 6; r += 2) {
      for (let c = 22; c < COLS - 8; c += 2) {
        const k = cellKind[r * COLS + c];
        if (k === 0 || k === 1) {
          const near3 = countLitAround(c, r, 3);
          const near6 = countLitAround(c, r, 6);
          if (near3 >= 2 && near3 <= 24 && near6 >= 8 && near6 <= 80) {
            dewCands.push({ c, r, score: cellHash(c, r, model.seed, 91) + (k === 0 ? 0.28 : 0) });
          }
        }
      }
    }
    dewCands.sort((a, b) => b.score - a.score);

    const dewPool = model.microType.dewWords || [];
    let dewPlaced = 0;
    for (const cand of dewCands) {
      if (dewPlaced >= 12 || dewPlaced >= dewPool.length) break;
      const word = dewPool[dewPlaced];
      const span = spanCols(word, FONT_DEW);
      const startC = clamp(cand.c - Math.floor(span * 0.3), 22, COLS - span - 3);
      let brightCount = 0;
      for (let dc = 0; dc < span; dc++) {
        if (cellKind[cand.r * COLS + startC + dc] >= 2) brightCount++;
      }
      if (brightCount <= 1) {
        if (commitText(word, startC, cand.r, 4, 4, FONT_DEW, "#D3E0F2", true)) {
          dewPlaced++;
        }
      }
    }

    // PASS 2: Plain-language phrases nestled in carved 1-row obsidian slots along twilight & mid-tone strata!
    const phraseCands = [];
    for (let r = 14; r < ROWS - 6; r += 2) {
      for (let c = 24; c < COLS - 16; c += 3) {
        const k = cellKind[r * COLS + c];
        if (k === 1 || k === 2) {
          const lit = countLitAround(c, r, 2);
          if (lit >= 9) {
            const aboveK = r > 0 ? cellKind[(r - 1) * COLS + c] : 0;
            const edgeBonus = aboveK !== k ? 0.25 : 0;
            phraseCands.push({ c, r, score: cellHash(c, r, model.seed, 149) + edgeBonus });
          }
        }
      }
    }
    phraseCands.sort((a, b) => b.score - a.score);

    const phrasePool = model.microType.phrases || [];
    let phrasePlaced = 0;
    let phraseIdx = 0;
    for (const cand of phraseCands) {
      if (phrasePlaced >= 16 || phraseIdx >= phrasePool.length) break;
      const str = phrasePool[phraseIdx];
      const span = spanCols(str, FONT_PHRASE);
      if (cand.c + span >= COLS - 3) continue;
      if (countAdjacentGlare(cand.c, cand.r, span) > 2) continue;
      let litCols = 0;
      let specCols = 0;
      for (let dc = 0; dc < span; dc++) {
        const k = cellKind[cand.r * COLS + cand.c + dc];
        if (k >= 1) litCols++;
        if (k === 4) specCols++;
      }
      if (litCols / Math.max(1, span) >= 0.52 && specCols === 0) {
        if (commitText(str, cand.c, cand.r, 4, 4, FONT_PHRASE, "#E6EFFA", true)) {
          phrasePlaced++;
          phraseIdx++;
        }
      }
    }

    // PASS 3: 5-7 crisp bold phrases tucked right into the crimson / focal core edges!
    const coreCands = [];
    for (let r = 14; r < ROWS - 8; r += 2) {
      for (let c = 26; c < COLS - 14; c += 2) {
        const k = cellKind[r * COLS + c];
        if (k === 3 || k === 2) {
          let crimNear = 0;
          for (let dc = -2; dc <= 10; dc++) {
            const cc = c + dc;
            if (cc >= 0 && cc < COLS && cellKind[r * COLS + cc] === 3) crimNear++;
          }
          if (crimNear >= 3) {
            coreCands.push({ c, r, score: cellHash(c, r, model.seed, 233) + crimNear * 0.04 });
          }
        }
      }
    }
    coreCands.sort((a, b) => b.score - a.score);

    let corePlaced = 0;
    for (const cand of coreCands) {
      if (corePlaced >= 6 || phraseIdx >= phrasePool.length) break;
      const str = phrasePool[phraseIdx];
      const span = spanCols(str, FONT_CORE);
      if (cand.c + span >= COLS - 3) continue;
      if (countAdjacentGlare(cand.c, cand.r, span) > 2) continue;
      if (commitText(str, cand.c, cand.r, 4, 4, FONT_CORE, "#F6DCE0", true)) {
        corePlaced++;
        phraseIdx++;
      }
    }

    // ---- DRAW ALL NON-CARVED 7px MOSAIC CELLS ----
    for (let row = 0; row < ROWS; row++) {
      const y0 = row * PITCH;
      for (let col = 0; col < COLS; col++) {
        const cIdx = row * COLS + col;
        if (cellKind[cIdx] === 0 || carvedCell[cIdx]) continue;
        const x0 = col * PITCH;
        const sz = cellSize[cIdx];
        const pad = (PITCH - sz) * 0.5;
        ctx.fillStyle = cellColor[cIdx];
        drawRoundedRect(ctx, x0 + pad, y0 + pad, sz, sz, cellRx[cIdx]);
      }
    }

    // ---- DRAW ALL PLACED GRID-LOCKED MICRO-TYPE ----
    ctx.save();
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    for (const t of placedTexts) {
      ctx.font = t.font;
      ctx.fillStyle = t.fill;
      ctx.fillText(t.str, t.col * PITCH, (t.row + 0.78) * PITCH);
    }
    ctx.restore();

    return {
      placedCount: placedTexts.length,
      dewPlaced,
      phrasePlaced,
      corePlaced,
    };
  }

  // =========================================================================
  // MODE 1 & 2: OBSIDIAN SIGNAL MOSAIC (VYO & FLASK)
  // =========================================================================
  function synthesizeStrataField(model) {
    const field = new Float32Array(W * H * 3);
    const nA = makeNoise(model.seed ^ 0x9e3779b9);
    const nB = makeNoise(model.seed ^ 0x517cc1b7);
    const nC = makeNoise(model.seed ^ 0xc2b2ae35);
    const rng = mulberry32(model.seed ^ 0xa5a5a5a5);

    const isFlask = model.id.includes("flask");
    const density = clamp(model.stats.files / 71, 0.45, 1.25);
    const accentRatio = clamp(model.stats.accentLoc / Math.max(1, model.stats.totalLoc), 0.15, 0.55);

    const rowEnergy = new Float32Array(H);
    const rowAccent = new Float32Array(H);
    const rowCross = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      let e = 0.25,
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
        let s = 0,
          c = 0;
        for (let k = -rad; k <= rad; k++) {
          s += arr[clamp(i + k, 0, arr.length - 1)];
          c++;
        }
        out[i] = s / c;
      }
      return out;
    };
    const eSmooth = smooth1D(rowEnergy, 16);
    const aSmooth = smooth1D(rowAccent, 22);
    const cSmooth = smooth1D(rowCross, 16);

    const accMid = clamp(model.accentSpan.midY, 0.22, 0.36);
    const accMax = clamp(model.accentSpan.maxY, 0.39, 0.48);
    const hj0 = ((model.hubs[0]?.seed || 11) % 100) / 100 - 0.5;
    const hj1 = ((model.hubs[1]?.seed || 29) % 100) / 100 - 0.5;
    const hj2 = ((model.hubs[2]?.seed || 47) % 100) / 100 - 0.5;

    // Distinct focal silhouettes for vyo vs flask driven by real codebase ratios
    const apexX = (isFlask ? 0.52 : 0.46) + hj0 * 0.036;
    const apexY = (isFlask ? 0.13 : 0.145) + (density - 0.8) * 0.014;
    const midX = (isFlask ? 0.61 : 0.58) + hj1 * 0.04;
    const midY = clamp(accMid + 0.03, 0.27, 0.36);
    const flareX = (isFlask ? 0.72 : 0.68) + hj2 * 0.03;
    const flareY = clamp(accMax + 0.015, 0.41, 0.47);
    const crimCloudX = isFlask ? apexX - 0.10 : apexX - 0.15;
    const crimCloudY = isFlask ? apexY + 0.055 : apexY + 0.028;

    const p1 = rng() * 6.28;
    const p2 = rng() * 6.28;
    const p3 = rng() * 6.28;
    const p4 = rng() * 6.28;

    for (let y = 0; y < H; y++) {
      const v = y / H;
      const topEnv = smoothstep(0.045, 0.125, v);
      const lowerMix = smoothstep(0.41, 0.56, v);
      const upperMix = 1 - smoothstep(0.44, 0.58, v);

      const re = eSmooth[y];
      const ra = aSmooth[y];
      const rc = cSmooth[y];

      const diagT = clamp((v - apexY) / Math.max(0.05, flareY - apexY), -0.25, 1.3);
      const spineX = apexX + (flareX - apexX) * smoothstep(-0.08, 1.12, diagT);

      // Lower undulating vertical reflection rivers
      const r1X = (isFlask ? 0.555 : 0.525) + Math.sin(v * 6.2 + p1) * 0.024 + (accentRatio - 0.28) * 0.036;
      const r2X = (isFlask ? 0.675 : 0.642) + Math.sin(v * 5.5 + p2) * 0.022 + hj1 * 0.018;
      const r3X = (isFlask ? 0.835 : 0.808) + Math.sin(v * 4.8 + p3) * 0.024;
      const r4X = 0.965 + Math.sin(v * 4.1 + p4) * 0.022;

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

        let r = 0,
          g = 0,
          b = 0;

        if (upperMix > 0.001) {
          const rightCut =
            1 -
            smoothstep(
              spineX + 0.11 + 0.18 * smoothstep(0.18, 0.36, v),
              spineX + 0.26 + 0.30 * smoothstep(0.24, 0.42, v),
              u
            );

          // Vivid ember-crimson focal core cloud + flank
          const dCrim = Math.hypot((u - crimCloudX) * 1.15, (v - crimCloudY) * 1.40);
          const crimPuff = Math.exp(-dCrim * dCrim * (isFlask ? 19.0 : 21.0)) * smoothstep(0.28, 0.74, cloud);
          const dFlank = (u - (spineX - 0.092)) / 0.074;
          const flankV = smoothstep(0.13, 0.22, v) * (1 - smoothstep(0.47, 0.59, v));
          const crimFlank =
            Math.exp(-0.5 * dFlank * dFlank) * flankV * smoothstep(0.26, 0.74, cloud) * (0.82 + 0.40 * ra);
          const crim = (crimPuff * 1.38 + crimFlank * 1.04) * upperMix;

          r += crim * 1.18;
          g += crim * 0.14;
          b += crim * 0.15;

          // Sculpted volumetric diagonal core with carved dark obsidian cavities
          const duSpine = u - (spineX + (cloud - 0.5) * 0.11);
          const torsoW = (isFlask ? 0.072 : 0.078) + 0.11 * smoothstep(0.15, 0.40, v);
          const torsoEnv =
            Math.exp(-0.5 * (duSpine / torsoW) * (duSpine / torsoW)) *
            smoothstep(0.08, 0.16, v) *
            (1 - smoothstep(0.46, 0.58, v)) *
            rightCut;

          const cavity = smoothstep(0.35, 0.76, cavityNoise * 0.55 + ridge * 0.55);
          const torso = torsoEnv * cavity * (0.68 + 0.44 * re) * upperMix;

          const magW = smoothstep(0.46, 0.78, ridge) * (0.58 + 0.44 * ra);
          const vioW = smoothstep(-0.02, 0.14, u - spineX) * (0.55 + 0.55 * cloud);
          r += torso * (0.62 * magW + 0.28 * vioW);
          g += torso * (0.16 * magW + 0.28 * vioW + 0.22 * ridge);
          b += torso * (0.44 * magW + 0.78 * vioW + 0.34 * ridge);

          // Diagonal glacier-cyan crests
          const diagCrest = Math.sin(u * 12.0 - v * 13.2 + cloud * 3.8);
          const crest = Math.pow(Math.max(0, diagCrest), 3.8) * torsoEnv * smoothstep(0.20, 0.47, v) * upperMix;
          r += crest * 0.36;
          g += crest * 0.94;
          b += crest * 1.20;

          // Tight upper specular crystal knot
          const dApex = Math.hypot((u - apexX) * 2.1, (v - apexY) * 3.1);
          const apexCore = Math.exp(-dApex * dApex * 34.0) * (0.58 + 0.62 * ridge) * upperMix;
          const apexHalo = Math.exp(-dApex * dApex * 12.0) * smoothstep(0.38, 0.76, cloud) * upperMix;
          r += apexCore * 1.15 + apexHalo * 0.20;
          g += apexCore * 1.58 + apexHalo * 0.42;
          b += apexCore * 1.82 + apexHalo * 0.72;

          // Upper-right blazing specular knot pouring into River 2
          const dFlare = Math.hypot((u - flareX) * 2.0, (v - flareY) * 2.75);
          const flareCore = Math.exp(-dFlare * dFlare * 28.0) * (0.68 + 0.52 * ridge) * (0.9 + 0.28 * ra) * upperMix;
          const flareRose =
            Math.exp(-Math.pow((u - (flareX - 0.088)) / 0.07, 2) - Math.pow((v - (flareY - 0.015)) / 0.06, 2)) *
            (0.55 + 0.55 * cloud) *
            upperMix;
          r += flareCore * 1.45 + flareRose * 0.86;
          g += flareCore * 1.80 + flareRose * 0.18;
          b += flareCore * 2.02 + flareRose * 0.46;

          // Mid facet
          const dMid = Math.hypot((u - midX) * 2.2, (v - midY) * 2.9);
          const midCore = Math.exp(-dMid * dMid * 36.0) * (0.52 + 0.60 * ridge) * (0.72 + 0.4 * rc) * upperMix;
          r += midCore * 0.68;
          g += midCore * 0.84;
          b += midCore * 1.14;

          // Moody dusty slate-indigo shelf extending rightward
          const rightShelf =
            smoothstep(0.56, 0.84, u) *
            smoothstep(0.28, 0.37, v) *
            (1 - smoothstep(0.49, 0.58, v)) *
            smoothstep(0.25, 0.72, cloud) *
            upperMix;
          r += rightShelf * 0.24;
          g += rightShelf * 0.26;
          b += rightShelf * 0.64;
        }

        if (lowerMix > 0.001) {
          const swell = 0.56 + 0.56 * rivSwell;
          const fine = 0.58 + 0.54 * rivN;
          const dataBoost = 0.88 + 0.30 * re;

          // River 1: Vivid ember-crimson left flank
          const g1 = gauss(u - r1X, (isFlask ? 0.058 : 0.056) + 0.010 * rivSwell);
          const g1Tail = gauss(u - (r1X - 0.066), 0.068) * 0.35;
          const crimPulse = 0.68 + 0.42 * Math.sin(v * 11.4 + p1);
          const crimRiv = (g1 * 1.02 + g1Tail) * swell * crimPulse * lowerMix * dataBoost;
          r += crimRiv * 1.04;
          g += crimRiv * 0.15;
          b += crimRiv * 0.17;

          // River 2: Cool silvery glacier-cyan specular spine
          const g2Core = gauss(u - r2X, 0.030 + 0.006 * rivN);
          const g2Halo = gauss(u - (r2X + 0.020), 0.062) * 0.52;
          const cyanPulse = 0.68 + 0.42 * Math.sin(v * 14.0 + p2 * 1.3) * 0.5 + 0.34 * rivN;
          const cyanRiv = (g2Core * 1.18 + g2Halo * 0.56) * cyanPulse * lowerMix * dataBoost;
          r += cyanRiv * 0.52;
          g += cyanRiv * 0.94;
          b += cyanRiv * 1.22;

          // Rose-mauve transition where crimson kisses glacier-cyan
          const kiss = gauss(u - 0.5 * (r1X + r2X), 0.024) * 0.38 * fine * lowerMix;
          r += kiss * 0.72;
          g += kiss * 0.22;
          b += kiss * 0.48;

          // Deep obsidian-indigo valley between River 2 & River 3
          const valley = 1 - 0.78 * gauss(u - (isFlask ? 0.755 : 0.725), 0.036);

          // River 3: Moody dusty amethyst / slate-violet
          const g3 = gauss(u - r3X, 0.070 + 0.015 * rivN);
          const vioRiv = g3 * (0.60 + 0.48 * fine) * lowerMix * dataBoost;
          r += vioRiv * 0.42;
          g += vioRiv * 0.36;
          b += vioRiv * 0.78;

          // Soft periwinkle highlight
          const lavGlint = gauss(u - (r3X - 0.020), 0.032) * smoothstep(0.50, 0.86, rivN) * lowerMix;
          r += lavGlint * 0.44;
          g += lavGlint * 0.50;
          b += lavGlint * 0.82;

          // River 4: Slate-plum right-edge bleed
          const g4 = gauss(u - r4X, 0.090) + smoothstep(0.87, 1.02, u) * 0.30;
          const edgeRiv = g4 * (0.38 + 0.46 * rivSwell) * lowerMix;
          r += edgeRiv * 0.28;
          g += edgeRiv * 0.26;
          b += edgeRiv * 0.54;

          const rightShadow = 1 - 0.38 * gauss(u - 0.905, 0.028);
          r *= valley * rightShadow;
          g *= valley * rightShadow;
          b *= valley * rightShadow;
        }

        const leftMask = smoothstep(0.14, 0.28, u + (cloud - 0.5) * 0.065);
        const env = topEnv * leftMask;
        const idx = (y * W + x) * 3;
        field[idx] = r * env;
        field[idx + 1] = g * env;
        field[idx + 2] = b * env;
      }
    }
    return field;
  }

  window.renderSignalMosaic = function renderSignalMosaic(canvas, model) {
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const hdrField = synthesizeStrataField(model);
    const { gridRGB, slices } = refractFieldToGrid(hdrField, W, H, model, {
      shearScale: 1.0,
      dispScale: 1.15,
      streakScale: 1.05,
      streakMix: 0.48,
      upperStreakMix: 0.20,
    });

    const microStats = renderObsidianMosaicFromGrid(ctx, gridRGB, model, {
      sanctuaryRight: 0.51,
      sanctuarySoft: 0.40,
      strictLeftCut: 0.27,
      specLumThresh: 0.87,
      specMinThresh: 0.70,
    });

    drawBloomsburyTypography(ctx, model);
    return { slices: slices.length, ...microStats };
  };

  // =========================================================================
  // MODE 3: OBSIDIAN REFRACTED BLOOM (VYO BOTANICAL FORM + CHROMATIC STRATA)
  // =========================================================================
  function makeLayer() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return { canvas: c, ctx: c.getContext("2d") };
  }

  function evalCubic(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const x = mt2 * mt * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t2 * t * p3[0];
    const y = mt2 * mt * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t2 * t * p3[1];
    const dx =
      3 * mt2 * (p1[0] - p0[0]) +
      6 * mt * t * (p2[0] - p1[0]) +
      3 * t2 * (p3[0] - p2[0]);
    const dy =
      3 * mt2 * (p1[1] - p0[1]) +
      6 * mt * t * (p2[1] - p1[1]) +
      3 * t2 * (p3[1] - p2[1]);
    const len = Math.hypot(dx, dy) || 1;
    return { x, y, tx: dx / len, ty: dy / len };
  }

  function drawTaperedStem(ctx, pts, w0, w1, alpha = 1) {
    const steps = 40;
    const left = [];
    const right = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = evalCubic(pts[0], pts[1], pts[2], pts[3], t);
      const r = (w0 + (w1 - w0) * t) * 0.5;
      left.push([p.x - p.ty * r, p.y + p.tx * r]);
      right.push([p.x + p.ty * r, p.y - p.tx * r]);
    }
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function traceSculptedPetal(ctx, p, scale = 1.0) {
    const L = p.len * scale;
    const Wp = p.wid * scale;
    const asym = p.asym || 0;
    const ruffle = p.ruffle || 0.09;
    const freq = p.ruffleFreq || 2;
    const phase = p.rufflePhase || 0;
    const notch = p.notch || 0.06;

    const steps = 36;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const side = u < 0.5 ? 1 : -1;
      const along = u < 0.5 ? u * 2 : (1 - u) * 2;
      const bell = Math.pow(Math.sin(along * Math.PI * 0.88), 0.72);
      const shoulder = 1 + 0.16 * Math.sin(along * Math.PI * 1.4);
      const sideBias = 1 + side * asym;
      const rimWeight = Math.max(0, (along - 0.42) / 0.58);
      const wave =
        Math.sin(u * Math.PI * 2 * freq + phase) * ruffle * rimWeight +
        Math.cos(u * Math.PI * 2 * (freq + 1) + phase * 1.3) * ruffle * 0.48 * rimWeight;
      const tipDip = Math.exp(-Math.pow((u - 0.5) / 0.09, 2)) * notch;
      const x = L * (0.04 + 0.96 * Math.pow(along, 0.78)) * (1 + wave - tipDip);
      const y = side * Wp * 0.52 * bell * shoulder * sideBias * (1 + wave * 0.8);
      pts.push([x, y]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      ctx.quadraticCurveTo(prev[0], prev[1], (prev[0] + cur[0]) * 0.5, (prev[1] + cur[1]) * 0.5);
    }
    ctx.closePath();
  }

  function traceBotanicalLeaf(ctx, len, wid, curve, serration = 0.06, halfOnly = 0) {
    const steps = 26;
    const upper = [];
    const lower = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const sx = t * len;
      const sy = Math.sin(t * Math.PI) * len * curve * 0.28;
      const env = Math.pow(Math.sin(t * Math.PI), 0.75) * (1 - 0.2 * t);
      const tooth =
        t > 0.14 && t < 0.92
          ? 1 + Math.sin(t * Math.PI * 10) * serration * Math.sin(t * Math.PI)
          : 1;
      const hw = wid * 0.52 * env * tooth;
      upper.push([sx, sy - hw]);
      lower.push([sx, sy + hw]);
    }
    ctx.beginPath();
    if (halfOnly === -1) {
      ctx.moveTo(0, 0);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        ctx.lineTo(t * len, Math.sin(t * Math.PI) * len * curve * 0.28);
      }
      for (let i = steps; i >= 0; i--) ctx.lineTo(lower[i][0], lower[i][1]);
    } else {
      ctx.moveTo(upper[0][0], upper[0][1]);
      for (let i = 1; i <= steps; i++) ctx.lineTo(upper[i][0], upper[i][1]);
      for (let i = steps; i >= 0; i--) ctx.lineTo(lower[i][0], lower[i][1]);
    }
    ctx.closePath();
  }

  function synthesizeBotanicalHDR(bloomScene, model) {
    const mistBuf = makeLayer();
    const slateBuf = makeLayer();
    const slateDeepBuf = makeLayer();
    const crimsonBuf = makeLayer();
    const specBuf = makeLayer();

    for (const t of bloomScene.bgTendrils) {
      drawTaperedStem(mistBuf.ctx, t.pts, t.w0, t.w1, 0.72);
    }
    for (const s of bloomScene.stems) {
      if (s.tone === "mist") {
        drawTaperedStem(mistBuf.ctx, s.pts, s.w0, s.w1, 0.90);
      } else {
        drawTaperedStem(mistBuf.ctx, s.pts, s.w0 + 3.0, s.w1 + 1.8, 0.45);
        drawTaperedStem(slateBuf.ctx, s.pts, s.w0, s.w1, 0.95);
        drawTaperedStem(slateDeepBuf.ctx, s.pts, s.w0 * 0.55, s.w1 * 0.45, 0.72);
      }
    }

    for (const tw of bloomScene.twigs) {
      drawTaperedStem(mistBuf.ctx, [tw.p0, tw.p1, tw.p2, tw.p3], tw.width, Math.max(2.4, tw.width * 0.7), 0.92);
      for (const lf of tw.leaflets) {
        mistBuf.ctx.save();
        mistBuf.ctx.translate(lf.x, lf.y);
        mistBuf.ctx.rotate(lf.angle);
        traceBotanicalLeaf(mistBuf.ctx, lf.len, lf.wid, 0.14, 0.04, 0);
        mistBuf.ctx.fillStyle = "rgba(255,255,255,0.88)";
        mistBuf.ctx.fill();
        mistBuf.ctx.restore();
      }
      for (const b of tw.berries) {
        specBuf.ctx.save();
        specBuf.ctx.fillStyle = "rgba(255,255,255,0.95)";
        specBuf.ctx.beginPath();
        specBuf.ctx.arc(b.x, b.y, b.r * 1.08, 0, Math.PI * 2);
        specBuf.ctx.fill();
        specBuf.ctx.restore();
      }
    }

    const sortedLeaves = [...bloomScene.leaves].sort((a, b) => a.depth - b.depth);
    for (const lf of sortedLeaves) {
      if (lf.tone === "mist") {
        mistBuf.ctx.save();
        mistBuf.ctx.translate(lf.x, lf.y);
        mistBuf.ctx.rotate(lf.angle);
        traceBotanicalLeaf(mistBuf.ctx, lf.length, lf.width, lf.curve, lf.serration, 0);
        mistBuf.ctx.fillStyle = "rgba(255,255,255,0.86)";
        mistBuf.ctx.fill();
        mistBuf.ctx.restore();
      } else {
        mistBuf.ctx.save();
        mistBuf.ctx.translate(lf.x, lf.y);
        mistBuf.ctx.rotate(lf.angle);
        traceBotanicalLeaf(mistBuf.ctx, lf.length * 1.05, lf.width * 1.08, lf.curve, lf.serration, 0);
        mistBuf.ctx.fillStyle = "rgba(255,255,255,0.45)";
        mistBuf.ctx.fill();
        mistBuf.ctx.restore();

        slateBuf.ctx.save();
        slateBuf.ctx.translate(lf.x, lf.y);
        slateBuf.ctx.rotate(lf.angle);
        traceBotanicalLeaf(slateBuf.ctx, lf.length, lf.width, lf.curve, lf.serration, 0);
        slateBuf.ctx.fillStyle = "rgba(255,255,255,0.94)";
        slateBuf.ctx.fill();
        slateBuf.ctx.restore();

        // Luminous midrib glint along leaf spine
        specBuf.ctx.save();
        specBuf.ctx.translate(lf.x, lf.y);
        specBuf.ctx.rotate(lf.angle);
        specBuf.ctx.strokeStyle = "rgba(255,255,255,0.52)";
        specBuf.ctx.lineWidth = 3.5;
        specBuf.ctx.beginPath();
        specBuf.ctx.moveTo(lf.length * 0.10, 0);
        specBuf.ctx.quadraticCurveTo(lf.length * 0.5, lf.length * lf.curve * 0.25, lf.length * 0.86, 0);
        specBuf.ctx.stroke();
        specBuf.ctx.restore();

        slateDeepBuf.ctx.save();
        slateDeepBuf.ctx.translate(lf.x, lf.y);
        slateDeepBuf.ctx.rotate(lf.angle);
        traceBotanicalLeaf(slateDeepBuf.ctx, lf.length * 0.92, lf.width * 0.9, lf.curve, lf.serration, -1);
        slateDeepBuf.ctx.fillStyle = "rgba(255,255,255,0.78)";
        slateDeepBuf.ctx.fill();
        slateDeepBuf.ctx.restore();
      }
    }

    for (const b of bloomScene.buds) {
      if (b.stemFrom) {
        const mx = (b.stemFrom[0] + b.x) * 0.5 - 12;
        const my = (b.stemFrom[1] + b.y) * 0.5 + 12;
        drawTaperedStem(slateBuf.ctx, [b.stemFrom, [mx, my], [b.x, b.y + 20], [b.x, b.y]], 5.5, 3.5, 0.9);
      }
      for (const ang of [-0.45, 0, 0.45]) {
        mistBuf.ctx.save();
        mistBuf.ctx.translate(b.x, b.y);
        mistBuf.ctx.rotate(b.angle + ang);
        traceBotanicalLeaf(mistBuf.ctx, b.size * 1.18, b.size * 0.72, ang * 0.4, 0.03, 0);
        mistBuf.ctx.fillStyle = "rgba(255,255,255,0.88)";
        mistBuf.ctx.fill();
        mistBuf.ctx.restore();
      }
      slateBuf.ctx.save();
      slateBuf.ctx.translate(b.x, b.y);
      slateBuf.ctx.rotate(b.angle);
      traceBotanicalLeaf(slateBuf.ctx, b.size * 0.94, b.size * 0.68, 0.05, 0.02, 0);
      slateBuf.ctx.fillStyle = "rgba(255,255,255,0.95)";
      slateBuf.ctx.fill();
      slateBuf.ctx.restore();

      if (b.hasCrimsonPeek) {
        crimsonBuf.ctx.save();
        crimsonBuf.ctx.translate(
          b.x + Math.cos(b.angle) * b.size * 0.55,
          b.y + Math.sin(b.angle) * b.size * 0.55
        );
        crimsonBuf.ctx.fillStyle = "rgba(255,255,255,0.98)";
        crimsonBuf.ctx.beginPath();
        crimsonBuf.ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
        crimsonBuf.ctx.fill();
        crimsonBuf.ctx.restore();
      }
    }

    for (const bloom of bloomScene.blooms) {
      if (bloom.kind === "mist-blossom") {
        mistBuf.ctx.save();
        mistBuf.ctx.translate(bloom.x, bloom.y);
        mistBuf.ctx.rotate(bloom.tilt);
        mistBuf.ctx.scale(1, bloom.squashY);
        for (const p of bloom.outerPetals) {
          mistBuf.ctx.save();
          mistBuf.ctx.rotate(p.angle);
          traceSculptedPetal(mistBuf.ctx, p, 1.0);
          mistBuf.ctx.fillStyle = "rgba(255,255,255,0.88)";
          mistBuf.ctx.fill();
          mistBuf.ctx.restore();
        }
        for (const p of bloom.innerPetals) {
          mistBuf.ctx.save();
          mistBuf.ctx.rotate(p.angle);
          traceSculptedPetal(mistBuf.ctx, p, 1.0);
          mistBuf.ctx.fillStyle = "rgba(255,255,255,0.98)";
          mistBuf.ctx.fill();
          mistBuf.ctx.restore();
        }
        mistBuf.ctx.restore();

        // Luminous glacier-white stamen crown inside mist blossoms
        specBuf.ctx.save();
        specBuf.ctx.translate(bloom.x, bloom.y);
        specBuf.ctx.fillStyle = "rgba(255,255,255,0.96)";
        specBuf.ctx.beginPath();
        specBuf.ctx.arc(0, 0, bloom.radius * 0.22, 0, Math.PI * 2);
        specBuf.ctx.fill();
        specBuf.ctx.restore();

        const cx = bloom.x + Math.cos(bloom.calyxAngle) * bloom.radius * 0.42;
        const cy = bloom.y + Math.sin(bloom.calyxAngle) * bloom.radius * 0.42;
        for (const ang of [-0.55, 0, 0.55]) {
          slateBuf.ctx.save();
          slateBuf.ctx.translate(cx, cy);
          slateBuf.ctx.rotate(bloom.calyxAngle - Math.PI + ang);
          traceBotanicalLeaf(slateBuf.ctx, bloom.calyxSize * 1.15, bloom.calyxSize * 0.72, ang * 0.35, 0.04, 0);
          slateBuf.ctx.fillStyle = "rgba(255,255,255,0.95)";
          slateBuf.ctx.fill();
          slateBuf.ctx.restore();
        }
      } else if (bloom.kind === "crimson-hero") {
        // Outer luminous glacier-cyan & amethyst halo petals
        mistBuf.ctx.save();
        mistBuf.ctx.translate(bloom.x, bloom.y);
        mistBuf.ctx.rotate(bloom.tilt);
        mistBuf.ctx.scale(1, bloom.squashY);
        for (const p of bloom.mistPetals) {
          mistBuf.ctx.save();
          mistBuf.ctx.rotate(p.angle);
          traceSculptedPetal(mistBuf.ctx, p, 1.0);
          mistBuf.ctx.fillStyle = "rgba(255,255,255,0.92)";
          mistBuf.ctx.fill();
          mistBuf.ctx.restore();
        }
        mistBuf.ctx.restore();

        // Deep violet-slate cupping calyx
        for (const sc of bloom.slateCups) {
          slateBuf.ctx.save();
          slateBuf.ctx.translate(bloom.x, bloom.y);
          slateBuf.ctx.rotate(bloom.tilt);
          slateBuf.ctx.scale(1, bloom.squashY);
          slateBuf.ctx.rotate(sc.angle);
          traceSculptedPetal(slateBuf.ctx, sc, 1.0);
          slateBuf.ctx.fillStyle = "rgba(255,255,255,0.94)";
          slateBuf.ctx.fill();
          slateBuf.ctx.restore();
        }

        // Sculpted asymmetric crimson wing petals
        const hx = bloom.x + bloom.heartOffset[0];
        const hy = bloom.y + bloom.heartOffset[1];
        crimsonBuf.ctx.save();
        crimsonBuf.ctx.translate(hx, hy);
        crimsonBuf.ctx.rotate(bloom.tilt);
        crimsonBuf.ctx.scale(1, bloom.squashY);

        for (let i = 0; i < bloom.crimsonOuter.length; i++) {
          const p = bloom.crimsonOuter[i];
          crimsonBuf.ctx.save();
          crimsonBuf.ctx.rotate(p.angle);
          if (i > 0) {
            crimsonBuf.ctx.globalCompositeOperation = "destination-out";
            traceSculptedPetal(crimsonBuf.ctx, p, 1.03);
            crimsonBuf.ctx.lineWidth = p.gapWidth || 10.5;
            crimsonBuf.ctx.strokeStyle = "rgba(255,255,255,0.95)";
            crimsonBuf.ctx.stroke();
          }
          crimsonBuf.ctx.globalCompositeOperation = "source-over";
          traceSculptedPetal(crimsonBuf.ctx, p, 1.0);
          crimsonBuf.ctx.fillStyle = "rgba(255,255,255,0.98)";
          crimsonBuf.ctx.fill();
          crimsonBuf.ctx.restore();
        }

        // Curved crevices revealing icy cyan & amethyst behind crimson wings
        crimsonBuf.ctx.globalCompositeOperation = "destination-out";
        for (let i = 0; i < bloom.crimsonOuter.length; i++) {
          const pA = bloom.crimsonOuter[i];
          const pB = bloom.crimsonOuter[(i + 1) % bloom.crimsonOuter.length];
          const midA = pA.angle + 0.5 * (((pB.angle - pA.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const reach = Math.min(pA.len, pB.len) * 1.12;
          crimsonBuf.ctx.beginPath();
          crimsonBuf.ctx.moveTo(Math.cos(midA) * bloom.radius * 0.14, Math.sin(midA) * bloom.radius * 0.14);
          crimsonBuf.ctx.quadraticCurveTo(
            Math.cos(midA + 0.15) * reach * 0.55,
            Math.sin(midA + 0.15) * reach * 0.55,
            Math.cos(midA) * reach,
            Math.sin(midA) * reach
          );
          crimsonBuf.ctx.lineWidth = i % 2 === 0 ? 15.0 : 11.0;
          crimsonBuf.ctx.lineCap = "round";
          crimsonBuf.ctx.strokeStyle = "rgba(255,255,255,0.95)";
          crimsonBuf.ctx.stroke();
        }

        for (const p of bloom.crimsonInner) {
          crimsonBuf.ctx.save();
          crimsonBuf.ctx.rotate(p.angle);
          crimsonBuf.ctx.globalCompositeOperation = "destination-out";
          traceSculptedPetal(crimsonBuf.ctx, p, 1.05);
          crimsonBuf.ctx.lineWidth = 6.5;
          crimsonBuf.ctx.strokeStyle = "rgba(255,255,255,0.88)";
          crimsonBuf.ctx.stroke();
          crimsonBuf.ctx.globalCompositeOperation = "source-over";
          traceSculptedPetal(crimsonBuf.ctx, p, 1.0);
          crimsonBuf.ctx.fillStyle = "rgba(255,255,255,0.99)";
          crimsonBuf.ctx.fill();
          crimsonBuf.ctx.restore();
        }

        // Open luminous icy-white specular heart center
        crimsonBuf.ctx.globalCompositeOperation = "destination-out";
        crimsonBuf.ctx.beginPath();
        crimsonBuf.ctx.ellipse(0, 0, bloom.radius * 0.14, bloom.radius * 0.095, 0.35, 0, Math.PI * 2);
        crimsonBuf.ctx.fillStyle = "rgba(255,255,255,0.95)";
        crimsonBuf.ctx.fill();
        crimsonBuf.ctx.restore();

        // Blazing icy-white specular heart jewel inside the crimson hero bloom!
        specBuf.ctx.save();
        specBuf.ctx.translate(hx, hy);
        specBuf.ctx.rotate(bloom.tilt);
        specBuf.ctx.fillStyle = "rgba(255,255,255,0.98)";
        specBuf.ctx.beginPath();
        specBuf.ctx.ellipse(0, 0, bloom.radius * 0.15, bloom.radius * 0.11, 0.35, 0, Math.PI * 2);
        specBuf.ctx.fill();
        specBuf.ctx.restore();
      }
    }

    // Convert rasterized botanical layers into a rich HDR nocturnal RGB light-field
    const mistData = mistBuf.ctx.getImageData(0, 0, W, H).data;
    const slateData = slateBuf.ctx.getImageData(0, 0, W, H).data;
    const slateDeepData = slateDeepBuf.ctx.getImageData(0, 0, W, H).data;
    const crimData = crimsonBuf.ctx.getImageData(0, 0, W, H).data;
    const specData = specBuf.ctx.getImageData(0, 0, W, H).data;

    const noise = makeNoise(model.seed ^ 0x85ebca6b);
    const hdr = new Float32Array(W * H * 3);

    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const p4 = (y * W + x) * 4 + 3;
        const vMist = mistData[p4] / 255;
        const vSlate = slateData[p4] / 255;
        const vSlateD = slateDeepData[p4] / 255;
        const vCrim = crimData[p4] / 255;
        const vSpec = specData[p4] / 255;

        if (vMist + vSlate + vCrim + vSpec < 0.01) continue;

        const shade = 0.72 + 0.44 * noise.fbm(u * 6.5, v * 6.5, 3);
        // Upper botanical canopy shifts icy glacier-cyan; mid/lower blooms shift twilight amethyst!
        const cyanTint = 1 - smoothstep(0.18, 0.78, v);
        const amethTint = smoothstep(0.32, 0.85, v);

        let r = 0,
          g = 0,
          b = 0;

        // Layer 1: Luminous glacier-cyan & twilight-amethyst outer mist petals / twigs
        if (vMist > 0.01) {
          r += vMist * (0.36 * cyanTint + 0.58 * amethTint) * shade;
          g += vMist * (0.76 * cyanTint + 0.44 * amethTint) * shade;
          b += vMist * (1.08 * cyanTint + 0.94 * amethTint) * shade;
        }

        // Layer 2: Deep twilight slate-cobalt & amethyst foliage/stems
        if (vSlate > 0.01) {
          const depthDark = 1 - vSlateD * 0.38;
          const slR = (0.28 + 0.16 * amethTint) * depthDark * shade;
          const slG = (0.44 + 0.14 * cyanTint) * depthDark * shade;
          const slB = (0.86 + 0.12 * amethTint) * depthDark * shade;
          r = r * (1 - vSlate * 0.75) + slR * vSlate;
          g = g * (1 - vSlate * 0.75) + slG * vSlate;
          b = b * (1 - vSlate * 0.75) + slB * vSlate;
        }

        // Layer 3: Glowing ember-crimson hero petals
        if (vCrim > 0.01) {
          const crR = 1.32 * shade;
          const crG = 0.16 * shade;
          const crB = 0.21 * shade;
          r = r * (1 - vCrim * 0.88) + crR * vCrim;
          g = g * (1 - vCrim * 0.88) + crG * vCrim;
          b = b * (1 - vCrim * 0.88) + crB * vCrim;
        }

        // Layer 4: Tight icy-white specular heart & berry glints
        if (vSpec > 0.01) {
          r += vSpec * 1.45;
          g += vSpec * 1.72;
          b += vSpec * 1.95;
        }

        const idx = (y * W + x) * 3;
        hdr[idx] = r;
        hdr[idx + 1] = g;
        hdr[idx + 2] = b;
      }
    }

    return hdr;
  }

  window.renderBloomStrata = function renderBloomStrata(canvas, model, bloomScene) {
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const botHDR = synthesizeBotanicalHDR(bloomScene, model);

    // Refract the botanical form through vyo's real horizontal codebase strata!
    // Calibrated shear & smear so petals/stems stay unmistakably recognizable while
    // dramatic horizontal glitch cuts & RGB prism trails slice across the botanical silhouette!
    const { gridRGB, slices } = refractFieldToGrid(botHDR, W, H, model, {
      shearScale: 0.40,
      dispScale: 1.22,
      streakScale: 0.78,
      streakMix: 0.30,
      upperStreakMix: 0.18,
      cyanPairedDisp: true,
      couplingAdaptive: true,
    });

    const microStats = renderObsidianMosaicFromGrid(ctx, gridRGB, model, {
      sanctuaryRight: 0.47,
      sanctuarySoft: 0.36,
      strictLeftCut: 0.28,
      specLumThresh: 0.86,
      specMinThresh: 0.70,
    });

    drawBloomsburyTypography(ctx, model);
    return { slices: slices.length, ...microStats };
  };

  // =========================================================================
  // MODE 4: DAYLIGHT STRATA MOSAIC (ALABASTER GALLERY PAPER, NO FLOWERS!)
  // =========================================================================
  function synthesizeDaylightStrataField(model) {
    // 3-channel sculptural signal density field:
    // ch0 = crimson focal energy (tools/lib/fields)
    // ch1 = deep slate structural strata energy
    // ch2 = pale ice-mist atmospheric whisper trails
    const field = new Float32Array(W * H * 3);
    const nA = makeNoise(model.seed ^ 0x9e3779b9);
    const nB = makeNoise(model.seed ^ 0x517cc1b7);
    const nC = makeNoise(model.seed ^ 0xc2b2ae35);
    const rng = mulberry32(model.seed ^ 0x243f6a88);

    const rowEnergy = new Float32Array(H);
    const rowAccent = new Float32Array(H);
    const rowCross = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      let e = 0.28,
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

    const p1 = rng() * 6.28;
    const p2 = rng() * 6.28;
    const p3 = rng() * 6.28;

    for (let y = 0; y < H; y++) {
      const v = y / H;
      // Starts gracefully in upper-center-right below the top-right vyo tag, cascading off bottom & right
      const topEnv = smoothstep(0.125, 0.22, v);
      const upperMix = 1 - smoothstep(0.46, 0.62, v);
      const lowerMix = smoothstep(0.42, 0.58, v);

      const re = rowEnergy[y];
      const ra = rowAccent[y];
      const rc = rowCross[y];

      // Sculptural diagonal spine sweeping from upper-right-center (u ~ 0.68) gently across mid-sheet
      // and expanding broadly down-right and down-center!
      const spineX = 0.64 + Math.sin(v * 4.2 + p1) * 0.08 - smoothstep(0.25, 0.85, v) * 0.08;

      // Cascading lower architectural columns / rivers (bleeding off bottom & right edges)
      const col1X = 0.34 + Math.sin(v * 5.2 + p1) * 0.045;
      const col2X = 0.56 + Math.sin(v * 4.6 + p2) * 0.038;
      const col3X = 0.78 + Math.sin(v * 3.9 + p3) * 0.035;
      const col4X = 0.96 + Math.sin(v * 3.4 + p1) * 0.025;

      for (let x = 0; x < W; x++) {
        const u = x / W;
        const wx = nA.fbm(u * 4.2 + 1.1, v * 3.8 + 0.9, 3) - 0.5;
        const wy = nB.fbm(u * 4.2 + 3.7, v * 3.8 + 2.4, 3) - 0.5;
        const wu = u + wx * 0.09;
        const wv = v + wy * 0.08;

        const cloud = nA.fbm(wu * 5.2, wv * 4.8, 4);
        const ridge = nB.ridge(wu * 6.5 + 1.8, wv * 5.8 + 1.1, 4);
        const cav = nC.fbm(wu * 4.2 + 6.4, wv * 4.4 + 2.2, 3);

        let crim = 0;
        let slate = 0;
        let mist = 0;

        // Upper-right airy atmospheric mist shelves + focal drawing-engine burst
        if (upperMix > 0.001) {
          // Keep top-left headline sanctuary completely pristine!
          const leftGate = smoothstep(0.32 + (1 - smoothstep(0.16, 0.34, v)) * 0.24, 0.54 + (1 - smoothstep(0.16, 0.34, v)) * 0.16, u);
          const coreEnv =
            Math.exp(-Math.pow((u - spineX) / (0.18 + 0.12 * smoothstep(0.20, 0.48, v)), 2)) *
            upperMix *
            leftGate;

          // Wide delicate mist strata reaching toward right edge
          const rightReach = smoothstep(0.48, 0.72, u) * upperMix * smoothstep(0.15, 0.28, v);
          mist += (coreEnv * 0.92 + rightReach * 0.56) * smoothstep(0.22, 0.72, cloud);

          // Sculptural slate-blue architectural strata core with carved light alabaster valleys
          const slateCore = coreEnv * smoothstep(0.34, 0.76, ridge * 0.6 + cav * 0.45) * (0.72 + 0.38 * re);
          slate += slateCore * 1.15;

          // Vivid crimson focal core bursts (tools/lib/fields!) concentrated in upper-mid focal mass
          const dCrim1 = Math.hypot((u - 0.60) * 1.65, (v - 0.37) * 2.55);
          const crimBurst1 =
            Math.exp(-dCrim1 * dCrim1 * 16.5) *
            smoothstep(0.28, 0.72, cloud * 0.55 + ridge * 0.55) *
            (0.75 + 0.55 * ra);
          const dCrim2 = Math.hypot((u - 0.78) * 1.8, (v - 0.46) * 2.8);
          const crimBurst2 =
            Math.exp(-dCrim2 * dCrim2 * 22.0) * smoothstep(0.35, 0.76, ridge) * (0.65 + 0.45 * rc);
          crim += (crimBurst1 * 1.35 + crimBurst2 * 0.92) * upperMix * leftGate;
        }

        // Lower sculptural cascading stepped signal panes bleeding off bottom & right edges
        if (lowerMix > 0.001) {
          const swell = 0.55 + 0.58 * cloud;
          const valley1 = 1 - 0.82 * gauss(u - 0.455, 0.032);
          const valley2 = 1 - 0.78 * gauss(u - 0.685, 0.036);
          const valleys = valley1 * valley2;

          // Leftmost lower mist/slate whisper tail (keeps lower-left airy & gallery-balanced)
          const g1 = gauss(u - col1X, 0.088);
          mist += g1 * 0.82 * swell * lowerMix * smoothstep(0.50, 0.72, v);
          slate += gauss(u - (col1X + 0.025), 0.048) * 0.78 * smoothstep(0.36, 0.78, ridge) * lowerMix * smoothstep(0.56, 0.78, v);

          // Central sculptural slate & crimson signal spine
          const g2 = gauss(u - col2X, 0.072);
          mist += gauss(u - col2X, 0.12) * 0.78 * swell * lowerMix;
          slate += g2 * 1.08 * (0.62 + 0.48 * ridge) * lowerMix * (0.85 + 0.30 * re);

          // Secondary lower-right crimson focal echo bleeding toward right edge!
          const dCrimLow = Math.hypot((u - 0.82) * 1.45, (v - 0.78) * 2.15);
          const crimLow =
            Math.exp(-dCrimLow * dCrimLow * 14.0) *
            smoothstep(0.30, 0.76, cloud * 0.5 + ridge * 0.55) *
            lowerMix;
          // Plus subtle crimson horizontal vein along central spine
          const crimSpine =
            gauss(u - (col2X - 0.015), 0.038) *
            smoothstep(0.45, 0.75, Math.sin(v * 14.0 + p2) * 0.5 + 0.5) *
            smoothstep(0.44, 0.82, ridge) *
            0.78 *
            lowerMix;
          crim += crimLow * 1.25 + crimSpine;

          // Right-hand bold deep slate & mist bleed off u = 1.0
          const g3 = gauss(u - col3X, 0.085);
          const g4 = gauss(u - col4X, 0.095) + smoothstep(0.86, 1.02, u) * 0.45;
          mist += (g3 * 0.85 + g4 * 0.72) * swell * lowerMix;
          slate += (g3 * 0.96 + g4 * 0.78) * (0.52 + 0.55 * cav) * lowerMix;

          slate *= valleys;
          crim *= 0.35 + 0.65 * valleys;
        }

        const env = topEnv * smoothstep(0.08, 0.22, u + (cloud - 0.5) * 0.08);
        const idx = (y * W + x) * 3;
        field[idx] = crim * env;
        field[idx + 1] = slate * env;
        field[idx + 2] = mist * env;
      }
    }
    return field;
  }

  window.renderDaylightStrata = function renderDaylightStrata(canvas, model) {
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const GROUND = "#F2F4F7";
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, W, H);

    const dayField = synthesizeDaylightStrataField(model);
    const { gridRGB, slices } = refractFieldToGrid(dayField, W, H, model, {
      shearScale: 1.18,
      dispScale: 0.95, // separates crimson/slate/mist slightly along stepped horizontal edges!
      streakScale: 1.08,
      streakMix: 0.46,
      upperStreakMix: 0.24,
    });

    // Identify 3 crisp 1-row architectural fault crevices at real codebase layer transitions
    const faultRows = new Set();
    let prevLayer = model.strata[0]?.layer ?? 0;
    for (const s of model.strata) {
      if (s.layer !== prevLayer) {
        const fr = Math.round(s.y0 * ROWS);
        if (fr > 36 && fr < ROWS - 12) faultRows.add(fr);
        prevLayer = s.layer;
      }
    }

    // 3-tier daylight palette matching a-mosaic's crisp gallery print aesthetic
    const PALETTE = {
      1: "#D5DFE7", // mistLight
      2: "#C2D0DC", // mistMid
      3: "#7DA0B7", // slateLight
      4: "#4B7996", // slateMid
      5: "#345E7A", // slateDeep
      6: "#CB222B", // crimsonBright
      7: "#B21B23", // crimsonDeep
    };

    const gridTone = new Uint8Array(COLS * ROWS);
    const gridSize = new Float32Array(COLS * ROWS);
    const gridRx = new Float32Array(COLS * ROWS);

    for (let row = 0; row < ROWS; row++) {
      const y0 = row * PITCH;
      const isFaultRow = faultRows.has(row);
      for (let col = 0; col < COLS; col++) {
        const x0 = col * PITCH;
        // Sacred serene top-left headline sanctuary + top-right tag breathing room
        if (y0 < 236 && x0 < 548) continue;
        if (y0 < 285 && x0 < 360) continue;
        if (y0 < 88 && x0 > 685) continue;
        // Crisp 1-row alabaster architectural fault-line cut across major layer transitions
        if (isFaultRow && col < COLS - 16) continue;

        const idx = (row * COLS + col) * 3;
        const vCrim = gridRGB[idx];
        const vSlate = gridRGB[idx + 1];
        const vMist = gridRGB[idx + 2];

        const bayer = BAYER4[row & 3][col & 3] / 16 - 0.5;
        const micro = (cellHash(col, row, model.seed, 23) - 0.5) * 0.10 + bayer * 0.09;

        let tone = 0;
        let size = 5.3;
        let rx = 0.7;

        if (vCrim + micro * 0.75 > 0.44) {
          tone = vCrim + micro * 0.45 > 0.74 ? 7 : 6;
          size = vCrim > 0.62 ? 5.65 : 4.85;
          rx = size * 0.43; // crisp jewel-like crimson bead!
        } else if (vSlate + micro * 0.7 > 0.36) {
          if (vSlate + micro * 0.45 > 0.72) tone = 5;
          else if (vSlate + micro * 0.45 > 0.52) tone = 4;
          else tone = 3;
          size = vSlate > 0.58 ? 5.55 : 4.75;
          rx = size * 0.24; // softly-rounded slate square
        } else if (vMist + micro * 0.6 > 0.22) {
          tone = vMist + micro * 0.4 > 0.46 ? 2 : 1;
          size = vMist > 0.48 ? 5.4 : 4.4;
          rx = 0.65; // crisp delicate mist square
        }

        if (tone > 0) {
          const cIdx = row * COLS + col;
          gridTone[cIdx] = tone;
          gridSize[cIdx] = size;
          gridRx[cIdx] = rx;
        }
      }
    }

    // ---- PLAN SPARSE DARK CHARCOAL WOVEN MICRO-TYPE (SNAPPED TO 7px GRID) ----
    const textBlocked = new Uint8Array(COLS * ROWS);
    const carvedCell = new Uint8Array(COLS * ROWS);
    const phraseUsed = new Set();
    const placedTexts = [];

    function markBlocked(c0, r0, c1, r1) {
      const xA = Math.max(0, Math.floor(c0));
      const xB = Math.min(COLS - 1, Math.ceil(c1));
      const yA = Math.max(0, Math.floor(r0));
      const yB = Math.min(ROWS - 1, Math.ceil(r1));
      for (let r = yA; r <= yB; r++) {
        for (let c = xA; c <= xB; c++) textBlocked[r * COLS + c] = 1;
      }
    }

    // Protect headline + colophon + top-right tag
    markBlocked(0, 0, 82, 36);
    markBlocked(92, 0, 119, 16);

    function isAreaFree(c0, r0, c1, r1) {
      if (c0 < 4 || c1 >= COLS - 2 || r0 < 16 || r1 >= ROWS - 3) return false;
      for (let r = Math.floor(r0); r <= Math.ceil(r1); r++) {
        for (let c = Math.floor(c0); c <= Math.ceil(c1); c++) {
          if (textBlocked[r * COLS + c]) return false;
        }
      }
      return true;
    }

    function countInkAround(c, r, rad) {
      let n = 0;
      for (let dr = -rad; dr <= rad; dr++) {
        const rr = r + dr;
        if (rr < 0 || rr >= ROWS) continue;
        for (let dc = -rad; dc <= rad; dc++) {
          const cc = c + dc;
          if (cc < 0 || cc >= COLS) continue;
          if (gridTone[rr * COLS + cc] > 0) n++;
        }
      }
      return n;
    }

    const FONT_MIST = '400 9.0px "Commit Mono", monospace';
    const FONT_CORE = '700 8.7px "Commit Mono", monospace';

    function spanCols(str, font) {
      ctx.font = font;
      return Math.ceil(ctx.measureText(str).width / PITCH);
    }

    function commitText(str, col, row, padX, padY, font, fill, carveMediumAndDark) {
      if (phraseUsed.has(str)) return false;
      const span = spanCols(str, font);
      if (!isAreaFree(col - padX, row - padY, col + span + padX, row + padY)) return false;
      markBlocked(col - padX, row - padY, col + span + padX, row + padY);
      phraseUsed.add(str);

      if (carveMediumAndDark) {
        // Clear any slate/crimson dot (tone >= 3) directly behind the text row so charcoal ink reads razor-sharp!
        for (let c = Math.max(0, col - 1); c <= Math.min(COLS - 1, col + span); c++) {
          if (gridTone[row * COLS + c] >= 3) {
            carvedCell[row * COLS + c] = 1;
          }
        }
      }
      placedTexts.push({ str, col, row, font, fill });
      return true;
    }

    // PASS 1: Single dew words perched delicately on airy mist edges & alabaster crevices
    const dewCands = [];
    for (let r = 20; r < ROWS - 8; r += 2) {
      for (let c = 14; c < COLS - 6; c += 2) {
        const t = gridTone[r * COLS + c];
        if (t === 0 || t === 1 || t === 2) {
          const near3 = countInkAround(c, r, 3);
          const near6 = countInkAround(c, r, 6);
          if (near3 >= 2 && near3 <= 22 && near6 >= 10 && near6 <= 74) {
            dewCands.push({ c, r, score: cellHash(c, r, model.seed, 91) + (r < 75 ? 0.3 : 0) });
          }
        }
      }
    }
    dewCands.sort((a, b) => b.score - a.score);

    const dewPool = model.microType.dewWords || [];
    let dewPlaced = 0;
    for (const cand of dewCands) {
      if (dewPlaced >= 11 || dewPlaced >= dewPool.length) break;
      const word = dewPool[dewPlaced];
      const span = spanCols(word, FONT_MIST);
      const startC = clamp(cand.c - Math.floor(span * 0.35), 10, COLS - span - 3);
      let darkCount = 0;
      for (let dc = 0; dc < span; dc++) {
        if (gridTone[cand.r * COLS + startC + dc] >= 3) darkCount++;
      }
      if (darkCount === 0) {
        if (commitText(word, startC, cand.r, 5, 5, FONT_MIST, "#171B22", true)) {
          dewPlaced++;
        }
      }
    }

    // PASS 2: Crisp plain-language phrases nestled directly across pale-mist strata shelves!
    const mistCands = [];
    for (let r = 26; r < ROWS - 6; r += 2) {
      for (let c = 10; c < COLS - 16; c += 3) {
        const t = gridTone[r * COLS + c];
        if (t === 1 || t === 2 || t === 3) {
          const lit = countInkAround(c, r, 2);
          if (lit >= 10) {
            mistCands.push({ c, r, score: cellHash(c, r, model.seed, 137) + (t <= 2 ? 0.35 : 0) });
          }
        }
      }
    }
    mistCands.sort((a, b) => b.score - a.score);

    const phrasePool = model.microType.phrases || [];
    let phrasePlaced = 0;
    let phraseIdx = 0;
    for (const cand of mistCands) {
      if (phrasePlaced >= 15 || phraseIdx >= phrasePool.length) break;
      const str = phrasePool[phraseIdx];
      const span = spanCols(str, FONT_MIST);
      if (cand.c + span >= COLS - 3) continue;
      let mistCols = 0;
      let darkCols = 0;
      for (let dc = 0; dc < span; dc++) {
        const gt = gridTone[cand.r * COLS + cand.c + dc];
        if (gt === 1 || gt === 2) mistCols++;
        if (gt >= 4) darkCols++;
      }
      if (mistCols / Math.max(1, span) >= 0.55 && darkCols === 0) {
        if (commitText(str, cand.c, cand.r, 4, 4, FONT_MIST, "#151920", true)) {
          phrasePlaced++;
          phraseIdx++;
        }
      }
    }

    // PASS 3: 6 bold phrases woven cleanly into carved alabaster crevices inside slate/crimson strata!
    const coreCands = [];
    for (let r = 46; r < ROWS - 8; r += 3) {
      for (let c = 20; c < COLS - 15; c += 3) {
        const t = gridTone[r * COLS + c];
        if (t >= 4) {
          const lit = countInkAround(c, r, 2);
          if (lit >= 16) {
            coreCands.push({ c, r, score: cellHash(c, r, model.seed, 211) + (t >= 6 ? 0.25 : 0) });
          }
        }
      }
    }
    coreCands.sort((a, b) => b.score - a.score);

    let corePlaced = 0;
    for (const cand of coreCands) {
      if (corePlaced >= 6 || phraseIdx >= phrasePool.length) break;
      const str = phrasePool[phraseIdx];
      const span = spanCols(str, FONT_CORE);
      if (cand.c + span >= COLS - 3) continue;
      if (commitText(str, cand.c, cand.r, 5, 5, FONT_CORE, "#0E1218", true)) {
        corePlaced++;
        phraseIdx++;
      }
    }

    // ---- DRAW ALL 7px DAYLIGHT MOSAIC CELLS ----
    for (let row = 0; row < ROWS; row++) {
      const y0 = row * PITCH;
      for (let col = 0; col < COLS; col++) {
        const cIdx = row * COLS + col;
        const tone = gridTone[cIdx];
        if (tone === 0 || carvedCell[cIdx]) continue;
        const x0 = col * PITCH;
        const sz = gridSize[cIdx];
        const pad = (PITCH - sz) * 0.5;
        ctx.fillStyle = PALETTE[tone];
        drawRoundedRect(ctx, x0 + pad, y0 + pad, sz, sz, gridRx[cIdx]);
      }
    }

    // ---- DRAW ALL PLACED DARK CHARCOAL MICRO-TYPE ----
    ctx.save();
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    for (const t of placedTexts) {
      ctx.font = t.font;
      ctx.fillStyle = t.fill;
      ctx.fillText(t.str, t.col * PITCH, (t.row + 0.78) * PITCH);
    }
    ctx.restore();

    // ---- DAYLIGHT EDITORIAL FRAMING ----
    // 1. Clean Neo-Grotesque Inter Headline
    ctx.save();
    ctx.fillStyle = "#111418";
    ctx.font = '500 47px "Inter", sans-serif';
    ctx.textBaseline = "top";
    const headX = 50;
    const headY = 66;
    const lineStep = 58;
    model.copy.headline.forEach((line, idx) => {
      drawTrackedText(ctx, line, headX, headY + idx * lineStep, -1.15, 1.0);
    });
    ctx.restore();

    // 2. Ultra-restrained 1-line colophon whisper below headline
    ctx.save();
    const coloY = headY + model.copy.headline.length * lineStep + 18;
    ctx.fillStyle = "#CB222B";
    drawRoundedRect(ctx, headX + 1, coloY + 2.5, 5.5, 5.5, 2.2);
    ctx.fillStyle = "#798998";
    ctx.font = '400 9.5px "Commit Mono", monospace';
    ctx.textBaseline = "top";
    ctx.fillText(model.copy.daylightColophon, headX + 13, coloY);
    ctx.restore();

    // 3. Crisp PLAIN Crimson "vyo" Tag (top-right — STRICTLY PLAIN TEXT, NO ICON!)
    ctx.save();
    ctx.font = '600 17.5px "Inter Display", "Inter", sans-serif';
    const brandLabel = model.copy.brand;
    const labelW = ctx.measureText(brandLabel).width;
    const pillH = 33;
    const pillW = Math.max(72, Math.ceil(labelW + 34));
    const pillX = W - 40 - pillW;
    const pillY = 26;

    ctx.fillStyle = "#BF1E26";
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 1.5);

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brandLabel, pillX + pillW * 0.5, pillY + pillH * 0.5 + 0.5);
    ctx.restore();

    return {
      slices: slices.length,
      placedCount: placedTexts.length,
      dewPlaced,
      phrasePlaced,
      corePlaced,
    };
  };
})();

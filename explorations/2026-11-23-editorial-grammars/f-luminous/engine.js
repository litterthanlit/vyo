// Exploration F (f-luminous): Optical Light-Field -> Codebase Strata Refraction -> 7px Luminous Mosaic
// Inherits 100% of d-mosaic-strata's optical richness, ACES tone-mapping, chromatic RGB dispersion,
// chiaroscuro depth, and 7px dot/square mosaic materiality — paired with Vyo's original frameless
// Swiss-Japanese typography and zone-aware plain-language micro-type weaving.
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

  function drawTrackedText(ctx, text, x, y, trackingPx, spaceScale = 0.85) {
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

  const MATH = { mulberry32, cellHash, makeNoise, smoothstep, clamp, gauss };

  // =========================================================================
  // 1. REAL CODEBASE HORIZONTAL STRATA SLICE SCHEDULE (7px ROW-SNAPPED)
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

    // Upper sculptural slices snapped to exact 7px rows
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
          (s.shearX * COLS * (0.76 + 0.48 * rng()) + subSign * (1.1 + s.crossNorm * 3.8)) *
          shearScale;
        const dispCols = (0.55 + (s.disp / PITCH) * 0.72) * (0.85 + 0.42 * rng()) * dispScale;
        const dyRows = (rng() - 0.5) * 1.8 * (0.45 + s.crossNorm) * shearScale;

        const blockCount = s.isAccent || s.crossNorm > 0.25 ? 2 + ((s.seed + k) % 3) : 1;
        const blocks = [];
        let bx = 0.26 + rng() * 0.14;
        for (let b = 0; b < blockCount; b++) {
          const bw = 0.08 + rng() * 0.18;
          blocks.push({
            u0: bx,
            u1: Math.min(0.98, bx + bw),
            dxCols: (rng() - 0.5) * (2.8 + s.crossNorm * 7.5) * shearScale * (1 - 0.3 * transT),
            dyRows: (rng() - 0.5) * (1.4 + s.crossNorm * 2.2) * shearScale,
            boost: 0.82 + rng() * 0.42,
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
          energyBoost: 0.92 + (s.isAccent ? 0.16 : 0) + (rng() - 0.5) * 0.20,
          streakCols: ((1.2 + rng() * 2.4) * (1 - transT) + (3.0 + rng() * 2.6) * transT) * streakScale,
          streakBias: (rng() - 0.5) * 0.52,
          blocks,
          seed: (s.seed ^ (k * 2654435761)) >>> 0,
        });
        curR = nextR;
      }
    }

    // Lower sweeping stepped panes (7-9 bold sculptural stepped bands)
    const totalLowerLoc = lower.reduce((acc, s) => acc + s.loc, 0);
    const targetPanes = clamp(Math.round(6 + lower.length * 0.08), 7, 9);
    const locThreshold = totalLowerLoc / Math.max(1, targetPanes);

    let paneIdx = 0;
    let paneLoc = 0;
    let paneDir = -1;
    let paneShear = -3.2 * shearScale;
    let paneDisp = 1.30 * dispScale;
    let paneTone = 1.06;
    let prevArea = lower[0]?.area;

    for (let i = 0; i < lower.length; i++) {
      const s = lower[i];
      const areaChanged = s.area !== prevArea && paneLoc > locThreshold * 0.42;
      if (paneLoc >= locThreshold || areaChanged) {
        paneIdx++;
        paneLoc = 0;
        paneDir = paneIdx % 2 === 0 ? 1 : -1;
        const mag = 0.024 + s.crossNorm * 0.065 + 0.034 * rng();
        paneShear = paneDir * mag * COLS * shearScale;
        paneDisp = (0.72 + s.crossNorm * 1.40 + rng() * 0.72) * dispScale;
        paneTone = paneIdx % 3 === 1 ? 0.76 + rng() * 0.16 : 0.96 + rng() * 0.26;
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
        dyRows: ((paneIdx % 3) - 1) * 0.85 * shearScale,
        energyBoost: paneTone * (0.94 + s.locNorm * 0.14),
        streakCols: (3.0 + rng() * 4.2 + (s.y0 - 0.5) * 3.2) * streakScale,
        streakBias: paneDir * 0.34,
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
  // 2. SPATIALLY-AWARE HORIZONTAL STRATA REFRACTION + RGB DISPERSION + STREAK
  // =========================================================================
  function refractFieldToGrid(hdrField, fw, fh, model, refractMask, opts = {}) {
    const { slices, rowSlice } = buildGridSlices(model, opts);
    const gridRGB = new Float32Array(COLS * ROWS * 3);
    const rowRng = mulberry32(model.seed ^ 0x7f4a7c15);
    const streakMixBase = opts.streakMix ?? 0.46;
    const upperStreakMix = opts.upperStreakMix ?? 0.16;

    for (let row = 0; row < ROWS; row++) {
      const sl = rowSlice[row];
      const fyBase = (row + 0.5) * (fh / ROWS);

      if (!sl) {
        for (let col = 0; col < COLS; col++) {
          const fx = (col + 0.5) * (fw / COLS);
          const idx = (row * COLS + col) * 3;
          gridRGB[idx] = sampleField(hdrField, fw, fh, fx, fyBase, 0) * 0.85;
          gridRGB[idx + 1] = sampleField(hdrField, fw, fh, fx, fyBase, 1) * 0.85;
          gridRGB[idx + 2] = sampleField(hdrField, fw, fh, fx, fyBase, 2) * 0.85;
        }
        continue;
      }

      const bandT = (row - sl.r0) / Math.max(1, sl.r1 - sl.r0);
      const edgeSheen = 1.03 + (bandT < 0.14 ? 0.12 * (1 - bandT / 0.14) : 0) - bandT * 0.08;
      const couplingBoost = opts.couplingAdaptive
        ? 0.62 + 0.85 * smoothstep(0.18, 0.72, sl.crossNorm + (sl.isAccent ? 0.18 : 0))
        : 1.0;
      const scanJitter = (rowRng() - 0.5) * (sl.isUpper ? 0.58 : 0.34) * (opts.shearScale ?? 1) * couplingBoost;
      const baseShear = sl.shearCols * couplingBoost + scanJitter;
      const dispBase = sl.dispCols;
      const boost = sl.energyBoost * edgeSheen;
      const blocks = sl.blocks;

      for (let col = 0; col < COLS; col++) {
        const u = (col + 0.5) / COLS;
        const rMask = refractMask ? refractMask[row * COLS + col] : 1.0;

        let dxC = baseShear * rMask;
        let dyR = sl.dyRows * couplingBoost * rMask;
        let bBoost = 1 + (boost - 1) * clamp(rMask * 0.9, 0.35, 1.15);

        if (blocks) {
          for (let b = 0; b < blocks.length; b++) {
            const bl = blocks[b];
            if (u >= bl.u0 && u <= bl.u1) {
              dxC += bl.dxCols * couplingBoost * rMask;
              dyR += bl.dyRows * couplingBoost * rMask;
              bBoost *= 1 + (bl.boost - 1) * clamp(rMask, 0.35, 1.0);
              break;
            }
          }
        }

        // Keep chromatic dispersion subtle & jewel-like even where shear is restrained!
        const dispLocal = dispBase * clamp(0.52 + 0.55 * rMask, 0.45, 1.25);
        const dispR = dispLocal * 0.90;
        const dispG = opts.cyanPairedDisp ? -dispLocal * 0.46 : -dispLocal * 0.14;
        const dispB = -dispLocal * 0.86;

        const fx = (col + 0.5 - dxC) * (fw / COLS);
        const fy = (row + 0.5 + dyR) * (fh / ROWS);
        const stepX = fw / COLS;

        // 3-tap vertical micro-supersample inside each 7px row for crisp anti-aliased signal
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

    // 1D Horizontal Cell-Row Motion-Streak Pass (modulated gently by refractMask so focal subjects stay razor-clean!)
    const streakRng = mulberry32(model.seed ^ 0x6a09e667);
    const rowTmp = new Float32Array(COLS * 3);
    for (let row = 0; row < ROWS; row++) {
      const sl = rowSlice[row];
      if (!sl) continue;
      const baseL = sl.streakCols;
      const spike = streakRng() < (sl.isUpper ? 0.18 : 0.28) ? 1.45 + streakRng() * 1.4 : 0.55 + streakRng() * 0.85;
      const rowL = Math.max(0.6, baseL * spike);
      const bias = sl.streakBias || 0;
      const Lfwd = Math.max(0.5, rowL * (1 + bias));
      const Lbwd = Math.max(0.5, rowL * (1 - bias));
      const af = 1 - Math.exp(-1 / Lfwd);
      const ab = 1 - Math.exp(-1 / Lbwd);

      const mixRowBase = sl.isUpper
        ? upperStreakMix + (streakMixBase - upperStreakMix) * sl.transT
        : streakMixBase;

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
        const rMask = refractMask ? refractMask[row * COLS + c] : 1.0;
        const mixS = clamp(mixRowBase * clamp(rMask, 0.25, 1.15), 0.04, 0.65);
        const mixO = 1 - mixS;
        gridRGB[i] = gridRGB[i] * mixO + sr * mixS;
        gridRGB[i + 1] = gridRGB[i + 1] * mixO + sg * mixS;
        gridRGB[i + 2] = gridRGB[i + 2] * mixO + sb * mixS;
      }
    }

    return { gridRGB, slices, rowSlice };
  }

  // =========================================================================
  // 3. VYO'S OWN ORIGINAL FRAMELESS SWISS-JAPANESE TYPOGRAPHIC VOICE
  //    NO '+' frame, NO border rules, NO Ashmera pill, NO Bloomsbury stack!
  // =========================================================================
  function drawVyoFramelessTypography(ctx, model, isDaylight) {
    ctx.save();
    ctx.textAlign = "left";

    const pos = model.copy.typoPos || { x: 58, y: 440, headlineSize: 42 };
    const x = pos.x;
    const tagY = pos.y;
    const headlineSize = pos.headlineSize || 42;
    const lineHeight = Math.round(headlineSize * 1.08);
    const tracking = -headlineSize * 0.03; // -0.03em tight Swiss display poise

    // 1. Quiet header tag in Commit Mono 10px with single mosaic focal accent cell
    const accentDotColor = isDaylight ? "#CC262F" : "#E23848";
    ctx.fillStyle = accentDotColor;
    drawRoundedRect(ctx, x, tagY + 1.5, 5.5, 5.5, 1.35);

    ctx.textBaseline = "top";
    ctx.font = '700 10px "Commit Mono", monospace';
    ctx.fillStyle = isDaylight ? "#191E26" : "#DCE4F0";
    const repoStr = model.copy.repoName;
    const repoX = x + 11.5;
    ctx.fillText(repoStr, repoX, tagY);
    const repoW = ctx.measureText(repoStr).width;

    ctx.font = '400 10px "Commit Mono", monospace';
    ctx.fillStyle = isDaylight ? "#707F90" : "#7B8BA4";
    ctx.fillText(`  /  ${model.copy.metaStats}`, repoX + repoW, tagY);

    // 2. ONE confident, calm sentence-case headline in Inter Display 600 (tight 14-16px gap)
    const headY = tagY + 24;
    ctx.font = `600 ${headlineSize}px "Inter Display", "Inter", sans-serif`;
    ctx.fillStyle = isDaylight ? "#111316" : "#FFFFFF";
    const lines = model.copy.headline || [];
    for (let i = 0; i < lines.length; i++) {
      drawTrackedText(ctx, lines[i], x, headY + i * lineHeight, tracking, 0.72);
    }

    // 3. Quiet 1-line subtitle / legend beneath (Commit Mono 11px, muted slate)
    const legendY = headY + lines.length * lineHeight + 18;
    ctx.font = '400 11px "Commit Mono", monospace';
    ctx.fillStyle = isDaylight ? "#637486" : "#7F90AA";
    ctx.fillText(model.copy.legend, x, legendY);

    ctx.restore();
  }

  // =========================================================================
  // 4. OBSIDIAN 7px LUMINOUS MOSAIC RENDERER + ZONE-AWARE MICRO-TYPE WEAVER
  // =========================================================================
  function renderObsidianMosaic(ctx, gridRGB, model, sanctuary) {
    const GROUND = "#090A0D";
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, W, H);

    // cellKind: 0=empty, 1=dimTwilight, 2=midStrata, 3=crimsonBead, 4=specularWhite
    const cellKind = new Uint8Array(COLS * ROWS);
    const cellLum = new Float32Array(COLS * ROWS);
    const cellSize = new Float32Array(COLS * ROWS);
    const cellRx = new Float32Array(COLS * ROWS);
    const cellColor = new Array(COLS * ROWS);

    const sUMax = sanctuary.uMax ?? 0.46;
    const sUSoft = sanctuary.uSoft ?? 0.36;
    const sVMin = sanctuary.vMin ?? 0.32;
    const sVMax = sanctuary.vMax ?? 0.62;
    const strictLeftCut = sanctuary.strictLeftCut ?? 0.27;
    const strictVStart = sanctuary.strictVStart ?? 0.36;

    const specLumThresh = 0.86;
    const specMinThresh = 0.69;

    for (let row = 0; row < ROWS; row++) {
      const v = (row + 0.5) / ROWS;
      const typoBandV = smoothstep(sVMin - 0.05, sVMin + 0.02, v) * (1 - smoothstep(sVMax - 0.03, sVMax + 0.06, v));

      for (let col = 0; col < COLS; col++) {
        const u = (col + 0.5) / COLS;
        const idx = (row * COLS + col) * 3;
        let r = gridRGB[idx];
        let g = gridRGB[idx + 1];
        let b = gridRGB[idx + 2];

        // Soft feathered atmospheric protection around the frameless typography sanctuary
        if (typoBandV > 0.001 && u < sUMax + 0.08) {
          const protect = 1 - smoothstep(sUSoft, sUMax + 0.05, u);
          const atten = 1 - protect * typoBandV * 0.99;
          r *= atten;
          g *= atten;
          b *= atten;
        }
        if (v > strictVStart && u < 0.44) {
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
        const jitter = (cellHash(col, row, model.seed, 19) - 0.5) * 0.048 + bayer * 0.042;
        const thresh = 0.072 + jitter;

        if (lum < thresh && Math.max(mr, mg, mb) < 0.128 + jitter) {
          cellKind[cIdx] = 0;
          continue;
        }

        const crimDom = mr - Math.max(mg, mb) * 1.05;
        const specMin = Math.min(mr, mg, mb);

        if (lum > specLumThresh && specMin > specMinThresh) {
          // Tight icy-white specular jewel knot ONLY at the brightest focal crests!
          cellKind[cIdx] = 4;
          const t = clamp((lum - specLumThresh) / (1 - specLumThresh), 0, 1);
          const cr = 0.87 + t * 0.12;
          const cg = 0.93 + t * 0.06;
          const cb = 0.98 + t * 0.02;
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 5.2 + t * 0.6;
          cellRx[cIdx] = cellSize[cIdx] * 0.36;
        } else if (crimDom > 0.16 && mr > 0.27) {
          // Vivid glowing ember-crimson rounded bead/gem!
          cellKind[cIdx] = 3;
          const heat = clamp((mr - 0.25) / 0.66, 0, 1);
          const cr = 0.74 + heat * 0.23;
          const cg = 0.11 + heat * 0.16 + Math.max(0, mg - 0.22) * 0.34;
          const cb = 0.16 + heat * 0.13 + Math.max(0, mb - 0.22) * 0.38;
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 4.35 + heat * 1.40;
          cellRx[cIdx] = cellSize[cIdx] * 0.46; // circular glowing crimson bead!
        } else if (lum < 0.26 && Math.max(mr, mg, mb) < 0.38) {
          // Dim atmospheric twilight/mist dots whispering softly into obsidian
          cellKind[cIdx] = 1;
          const t = clamp((Math.max(lum, Math.max(mr, mg, mb) * 0.65) - 0.06) / 0.24, 0, 1);
          const cr = clamp(0.14 + mr * 0.70, 0.14, 0.54);
          const cg = clamp(0.17 + mg * 0.70, 0.17, 0.56);
          const cb = clamp(0.28 + mb * 0.74, 0.26, 0.70);
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 2.55 + t * 1.65;
          cellRx[cIdx] = 0.6;
        } else {
          // Mid-tone refracted glacier-cyan / sapphire / twilight-amethyst inset squares
          cellKind[cIdx] = 2;
          const t = clamp((lum - 0.22) / 0.64, 0, 1);
          const safeG = mg > Math.max(mr, mb) * 1.12 ? Math.max(mr, mb) * 1.04 + (mg - Math.max(mr, mb)) * 0.25 : mg;
          const hiLift = smoothstep(0.62, 0.88, lum);
          const cr = clamp(mr * (0.90 - 0.14 * hiLift) + 0.06 + hiLift * 0.10, 0.18, 0.84);
          const cg = clamp(safeG * (0.92 - 0.06 * hiLift) + 0.06 + hiLift * 0.12, 0.22, 0.90);
          const cb = clamp(mb * 1.0 + 0.09 + hiLift * 0.08, 0.34, 0.97);
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 4.4 + t * 1.25;
          cellRx[cIdx] = 0.95;
        }
      }
    }

    // ---- ZONE-AWARE GRID-SNAPPED MICRO-TYPE WEAVER (OBSIDIAN) ----
    const textBlocked = new Uint8Array(COLS * ROWS);
    const carvedCell = new Uint8Array(COLS * ROWS);
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

    // Block frameless typography sanctuary + safe poster edges
    const [bc0, bc1] = sanctuary.blockCols;
    const [br0, br1] = sanctuary.blockRows;
    markBlocked(bc0, br0, bc1, br1);
    markBlocked(0, 0, 5, ROWS - 1);
    markBlocked(COLS - 3, 0, COLS - 1, ROWS - 1);

    function isAreaFree(c0, r0, c1, r1) {
      if (c0 < 6 || c1 >= COLS - 3 || r0 < 5 || r1 >= ROWS - 4) return false;
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

    const FONTS = {
      dew: { font: '400 8.6px "Commit Mono", monospace', fill: "#C9D8EC" },
      phrase: { font: '400 8.7px "Commit Mono", monospace', fill: "#E4EEF9" },
      core: { font: '700 8.6px "Commit Mono", monospace', fill: "#F9DCE2" },
    };

    function spanCols(str, font) {
      ctx.font = font;
      return Math.ceil(ctx.measureText(str).width / PITCH);
    }

    let dewPlaced = 0,
      phrasePlaced = 0,
      corePlaced = 0;

    // Place each semantic micro-type label organically near its true visual metaphor zone!
    for (let i = 0; i < model.microType.length; i++) {
      const item = model.microType[i];
      const st = FONTS[item.style] || FONTS.phrase;
      const span = spanCols(item.text, st.font);
      const targetC = Math.round(item.u * COLS - span * 0.45);
      const targetR = Math.round(item.v * ROWS);
      const radC = Math.round((item.rad || 0.11) * COLS);
      const radR = Math.round((item.rad || 0.11) * ROWS);

      let best = null;
      let bestScore = -1e9;

      const rMin = Math.max(6, targetR - radR);
      const rMax = Math.min(ROWS - 5, targetR + radR);
      const cMin = Math.max(7, targetC - radC);
      const cMax = Math.min(COLS - span - 4, targetC + radC);

      for (let r = rMin; r <= rMax; r++) {
        for (let c = cMin; c <= cMax; c++) {
          const padX = item.style === "dew" ? 3 : 3;
          const padY = item.style === "dew" ? 3 : 3;
          if (!isAreaFree(c - padX, r - padY, c + span + padX, r + padY)) continue;

          const glare = countAdjacentGlare(c, r, span);
          if (glare > 2) continue;

          let litCols = 0,
            crimCols = 0,
            specCols = 0,
            brightCols = 0;
          for (let dc = 0; dc < span; dc++) {
            const k = cellKind[r * COLS + c + dc];
            if (k >= 1) litCols++;
            if (k >= 2) brightCols++;
            if (k === 3) crimCols++;
            if (k === 4) specCols++;
          }
          if (specCols > 0) continue;

          const distNorm = Math.hypot((c - targetC) / Math.max(1, radC), (r - targetR) / Math.max(1, radR));
          if (distNorm > 1.25) continue;

          const nearLit = countLitAround(c + Math.floor(span * 0.5), r, 3);
          let score = -distNorm * 1.4 + (cellHash(c, r, model.seed, 31 + i) - 0.5) * 0.22;

          if (item.style === "dew") {
            // Whisper perched in quiet obsidian pocket right beside lit strata
            if (brightCols > 2 || nearLit < 2 || nearLit > 42) continue;
            score += (litCols === 0 ? 0.60 : 0.22) - brightCols * 0.25 - glare * 0.4;
          } else if (item.style === "core") {
            // Core label tucked right beside or inside ember-crimson focal zone
            let crimNear = crimCols;
            for (let dr = -2; dr <= 2; dr++) {
              const rr = r + dr;
              if (rr < 0 || rr >= ROWS) continue;
              for (let dc = -2; dc <= span + 2; dc++) {
                const cc = c + dc;
                if (cc >= 0 && cc < COLS && cellKind[rr * COLS + cc] === 3) crimNear++;
              }
            }
            if (crimNear < 2 && nearLit < 6) continue;
            score += Math.min(1.2, crimNear * 0.08) - glare * 0.35;
          } else {
            // Phrase nestled cleanly in a carved 1-row obsidian slot within or along strata
            if (nearLit < 5) continue;
            score += (litCols / Math.max(1, span)) * 0.45 - glare * 0.35;
          }

          if (score > bestScore) {
            bestScore = score;
            best = { c, r, padX, padY };
          }
        }
      }

      if (best) {
        markBlocked(best.c - best.padX, best.r - best.padY, best.c + span + best.padX, best.r + best.padY);
        // Carve crisp 1-row obsidian slot behind text (with 1-cell breathing margin on left/right)
        for (let c = Math.max(0, best.c - 1); c <= Math.min(COLS - 1, best.c + span); c++) {
          carvedCell[best.r * COLS + c] = 1;
        }
        placedTexts.push({ str: item.text, col: best.c, row: best.r, font: st.font, fill: st.fill });
        if (item.style === "dew") dewPlaced++;
        else if (item.style === "core") corePlaced++;
        else phrasePlaced++;
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

    // ---- DRAW VYO'S ORIGINAL FRAMELESS TYPOGRAPHY ----
    drawVyoFramelessTypography(ctx, model, false);

    return {
      placedCount: placedTexts.length,
      dewPlaced,
      phrasePlaced,
      corePlaced,
    };
  }

  // =========================================================================
  // 5. DAYLIGHT ALABASTER 7px MOSAIC RENDERER + ZONE-AWARE MICRO-TYPE WEAVER
  // =========================================================================
  function renderDaylightMosaic(ctx, gridRGB, model, sanctuary) {
    const GROUND = "#F2F3F6";
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, W, H);

    // Identify crisp 1-row alabaster architectural fault-line cuts at real codebase layer transitions
    const faultRows = new Set();
    let prevLayer = model.strata[0]?.layer ?? 0;
    for (const s of model.strata) {
      if (s.layer !== prevLayer) {
        const fr = Math.round(s.y0 * ROWS);
        if (fr > 38 && fr < ROWS - 10) faultRows.add(fr);
        prevLayer = s.layer;
      }
    }

    const PALETTE = {
      1: "#D4DFE8", // mistLight
      2: "#C2D0DD", // mistMid
      3: "#7CA0B8", // slateLight
      4: "#4B7997", // slateMid
      5: "#325C78", // slateDeep
      6: "#CC262F", // vermilionBright
      7: "#B21B24", // vermilionDeep
    };

    const gridTone = new Uint8Array(COLS * ROWS);
    const gridSize = new Float32Array(COLS * ROWS);
    const gridRx = new Float32Array(COLS * ROWS);

    for (let row = 0; row < ROWS; row++) {
      const y0 = row * PITCH;
      const isFaultRow = faultRows.has(row);
      for (let col = 0; col < COLS; col++) {
        const x0 = col * PITCH;
        // Sacred wide-open top-left alabaster sanctuary for frameless headline
        if (y0 < sanctuary.yMax && x0 < sanctuary.xMax) continue;
        if (y0 < sanctuary.softY && x0 < sanctuary.softX) continue;
        // Crisp 1-row alabaster architectural fault cut
        if (isFaultRow && col < COLS - 14) continue;

        const idx = (row * COLS + col) * 3;
        const vCrim = gridRGB[idx];
        const vSlate = gridRGB[idx + 1];
        const vMist = gridRGB[idx + 2];

        const bayer = BAYER4[row & 3][col & 3] / 16 - 0.5;
        const micro = (cellHash(col, row, model.seed, 23) - 0.5) * 0.095 + bayer * 0.085;

        let tone = 0;
        let size = 5.2;
        let rx = 0.7;

        if (vCrim + micro * 0.72 > 0.42) {
          tone = vCrim + micro * 0.42 > 0.72 ? 7 : 6;
          size = vCrim > 0.60 ? 5.65 : 4.85;
          rx = size * 0.44; // circular glowing vermilion-crimson bead!
        } else if (vSlate + micro * 0.68 > 0.35) {
          if (vSlate + micro * 0.44 > 0.70) tone = 5;
          else if (vSlate + micro * 0.44 > 0.50) tone = 4;
          else tone = 3;
          size = vSlate > 0.56 ? 5.55 : 4.75;
          rx = size * 0.24; // softly-rounded slate square
        } else if (vMist + micro * 0.58 > 0.21) {
          tone = vMist + micro * 0.40 > 0.45 ? 2 : 1;
          size = vMist > 0.46 ? 5.35 : 4.35;
          rx = 0.65; // delicate mist inset square
        }

        if (tone > 0) {
          const cIdx = row * COLS + col;
          gridTone[cIdx] = tone;
          gridSize[cIdx] = size;
          gridRx[cIdx] = rx;
        }
      }
    }

    // ---- ZONE-AWARE DARK CHARCOAL MICRO-TYPE WEAVER (DAYLIGHT ALABASTER) ----
    const textBlocked = new Uint8Array(COLS * ROWS);
    const carvedCell = new Uint8Array(COLS * ROWS);
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

    const [bc0, bc1] = sanctuary.blockCols;
    const [br0, br1] = sanctuary.blockRows;
    markBlocked(bc0, br0, bc1, br1);
    markBlocked(0, 0, 4, ROWS - 1);
    markBlocked(COLS - 3, 0, COLS - 1, ROWS - 1);

    function isAreaFree(c0, r0, c1, r1) {
      if (c0 < 5 || c1 >= COLS - 3 || r0 < 20 || r1 >= ROWS - 3) return false;
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

    const FONTS = {
      dew: { font: '400 8.8px "Commit Mono", monospace', fill: "#222933" },
      phrase: { font: '400 8.9px "Commit Mono", monospace', fill: "#181E26" },
      core: { font: '700 8.8px "Commit Mono", monospace', fill: "#14181F" },
    };

    function spanCols(str, font) {
      ctx.font = font;
      return Math.ceil(ctx.measureText(str).width / PITCH);
    }

    let dewPlaced = 0,
      phrasePlaced = 0,
      corePlaced = 0;

    for (let i = 0; i < model.microType.length; i++) {
      const item = model.microType[i];
      const st = FONTS[item.style] || FONTS.phrase;
      const span = spanCols(item.text, st.font);
      const targetC = Math.round(item.u * COLS - span * 0.45);
      const targetR = Math.round(item.v * ROWS);
      const radC = Math.round((item.rad || 0.11) * COLS);
      const radR = Math.round((item.rad || 0.11) * ROWS);

      let best = null;
      let bestScore = -1e9;

      const rMin = Math.max(22, targetR - radR);
      const rMax = Math.min(ROWS - 4, targetR + radR);
      const cMin = Math.max(6, targetC - radC);
      const cMax = Math.min(COLS - span - 4, targetC + radC);

      for (let r = rMin; r <= rMax; r++) {
        for (let c = cMin; c <= cMax; c++) {
          const padX = 3;
          const padY = 3;
          if (!isAreaFree(c - padX, r - padY, c + span + padX, r + padY)) continue;

          const distNorm = Math.hypot((c - targetC) / Math.max(1, radC), (r - targetR) / Math.max(1, radR));
          if (distNorm > 1.25) continue;

          let mistCols = 0,
            darkCols = 0,
            crimCols = 0;
          for (let dc = 0; dc < span; dc++) {
            const gt = gridTone[r * COLS + c + dc];
            if (gt === 1 || gt === 2) mistCols++;
            if (gt >= 4) darkCols++;
            if (gt >= 6) crimCols++;
          }
          let adjDark = 0;
          for (const dr of [-1, 1]) {
            const rr = r + dr;
            if (rr < 0 || rr >= ROWS) continue;
            for (let dc = 0; dc < span; dc++) {
              if (gridTone[rr * COLS + c + dc] >= 4) adjDark++;
            }
          }
          const adjDarkRatio = adjDark / Math.max(1, span * 2);

          const nearInk = countInkAround(c + Math.floor(span * 0.5), r, 3);
          let score = -distNorm * 1.45 - adjDarkRatio * 0.45 + (cellHash(c, r, model.seed, 57 + i) - 0.5) * 0.22;

          if (item.style === "dew") {
            // Crisp weekday / dew word sitting cleanly in pale mist or alabaster ridge slit!
            if (darkCols > 1 || nearInk < 3) continue;
            score += (darkCols === 0 ? 0.65 : 0.10) + (mistCols / Math.max(1, span)) * 0.35;
          } else if (item.style === "core") {
            // Weekly plan label tucked right into carved alabaster slit along crimson tide
            let crimNear = crimCols;
            for (let dr = -2; dr <= 2; dr++) {
              const rr = r + dr;
              if (rr < 0 || rr >= ROWS) continue;
              for (let dc = -2; dc <= span + 2; dc++) {
                const cc = c + dc;
                if (cc >= 0 && cc < COLS && gridTone[rr * COLS + cc] >= 6) crimNear++;
              }
            }
            if (crimNear < 2 && nearInk < 6) continue;
            score += Math.min(1.2, crimNear * 0.08);
          } else {
            if (nearInk < 4) continue;
            score += (mistCols / Math.max(1, span)) * 0.48 - (darkCols / Math.max(1, span)) * 0.25;
          }

          if (score > bestScore) {
            bestScore = score;
            best = { c, r, padX, padY };
          }
        }
      }

      if (best) {
        markBlocked(best.c - best.padX, best.r - best.padY, best.c + span + best.padX, best.r + best.padY);
        // Carve any slate/crimson dot (tone >= 3) directly behind the text row so charcoal ink reads razor-sharp!
        for (let c = Math.max(0, best.c - 1); c <= Math.min(COLS - 1, best.c + span); c++) {
          if (gridTone[best.r * COLS + c] >= 3 || item.style === "core") {
            carvedCell[best.r * COLS + c] = 1;
          }
        }
        placedTexts.push({ str: item.text, col: best.c, row: best.r, font: st.font, fill: st.fill });
        if (item.style === "dew") dewPlaced++;
        else if (item.style === "core") corePlaced++;
        else phrasePlaced++;
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

    // ---- DRAW VYO'S ORIGINAL FRAMELESS TYPOGRAPHY ----
    drawVyoFramelessTypography(ctx, model, true);

    return {
      placedCount: placedTexts.length,
      dewPlaced,
      phrasePlaced,
      corePlaced,
    };
  }

  // =========================================================================
  // PUBLIC ENTRYPOINT
  // =========================================================================
  window.renderLuminousPoster = function renderLuminousPoster(canvas, model) {
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const sculptor = window.VyoSubjects && window.VyoSubjects[model.subject];
    if (!sculptor) {
      throw new Error(`Unknown subject sculptor: ${model.subject}`);
    }

    const sculpted = sculptor(model, MATH);

    if (model.theme === "daylight") {
      const { gridRGB, slices } = refractFieldToGrid(
        sculpted.dayField,
        W,
        H,
        model,
        sculpted.refractMask,
        sculpted.refractOpts
      );
      const microStats = renderDaylightMosaic(ctx, gridRGB, model, sculpted.sanctuary);
      return { slices: slices.length, ...microStats };
    } else {
      const { gridRGB, slices } = refractFieldToGrid(
        sculpted.hdr,
        W,
        H,
        model,
        sculpted.refractMask,
        sculpted.refractOpts
      );
      const microStats = renderObsidianMosaic(ctx, gridRGB, model, sculpted.sanctuary);
      return { slices: slices.length, ...microStats };
    }
  };
})();

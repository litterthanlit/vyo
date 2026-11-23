// Luminous Frame Browser Canvas Engine:
// Soft-lit agent-authored SVG -> Continuous Optical Light-Field -> Real Codebase Strata Refraction
// -> 7px Uniform Mosaic Lattice (120x170) -> Zone-Aware Micro-Type & Frameless Vyo Typography.
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

  function smoothstep(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6)));
    return t * t * (3 - 2 * t);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
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

  function measureTrackedWidth(ctx, text, trackingPx, spaceScale = 0.72) {
    let w = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      w += ctx.measureText(ch).width;
      if (i < text.length - 1) w += ch === " " ? trackingPx * spaceScale : trackingPx;
    }
    return w;
  }

  function drawTrackedText(ctx, text, x, y, trackingPx, spaceScale = 0.72) {
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

  function wrapTrackedLines(ctx, text, maxWidth, trackingPx, spaceScale = 0.72) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = [];
    for (const word of words) {
      const last = lines.length - 1;
      if (last >= 0 && measureTrackedWidth(ctx, `${lines[last]} ${word}`, trackingPx, spaceScale) <= maxWidth) {
        lines[last] += ` ${word}`;
      } else {
        lines.push(word);
      }
    }
    return lines;
  }

  function wrapMonoLines(ctx, text, maxWidth) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = [];
    for (const word of words) {
      const last = lines.length - 1;
      if (last >= 0 && ctx.measureText(`${lines[last]} ${word}`).width <= maxWidth) {
        lines[last] += ` ${word}`;
      } else {
        lines.push(word);
      }
    }
    return lines;
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
  // 1. NATIVE CHROMIUM SVG RASTERIZATION (840x1190)
  // =========================================================================
  function prepareSvg(svgText) {
    let s = String(svgText || "").trim();
    if (!/\bxmlns\s*=/.test(s)) {
      s = s.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!/\bwidth\s*=/.test(s.slice(0, 300))) {
      s = s.replace(/<svg\b/i, `<svg width="${W}" height="${H}"`);
    }
    return s;
  }

  async function rasterizeSvg(svgText, bgHex) {
    const prepared = prepareSvg(svgText);
    const img = new Image();
    img.decoding = "sync";
    const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(prepared)}`;

    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("failed to decode luminous subject SVG"));
      img.src = uri;
    });
    if (typeof img.decode === "function") {
      await img.decode().catch(() => {});
    }

    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const octx = off.getContext("2d", { willReadFrequently: true });
    octx.fillStyle = bgHex;
    octx.fillRect(0, 0, W, H);
    octx.drawImage(img, 0, 0, W, H);
    return octx.getImageData(0, 0, W, H).data;
  }

  // =========================================================================
  // 2. TONAL RICHNESS + AUTO-DERIVED SPATIAL REFRACT MASK
  // =========================================================================
  function measureTonalRichness(rgba, isAlabaster) {
    const bins = new Int32Array(10);
    let litPixels = 0;
    let midTonePixels = 0;

    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const p = (y * W + x) * 4;
        const r = rgba[p] / 255;
        const g = rgba[p + 1] / 255;
        const b = rgba[p + 2] / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const val = isAlabaster ? 1 - lum : lum;
        if (val < 0.06) continue;
        litPixels++;
        if (val >= 0.15 && val <= 0.75) midTonePixels++;
        if (val <= 0.94) {
          const bin = clamp(Math.floor((val - 0.06) / 0.088), 0, 9);
          bins[bin]++;
        }
      }
    }

    const minBinCount = Math.max(30, litPixels * 0.008);
    let activeBins = 0;
    for (let i = 0; i < 10; i++) {
      if (bins[i] >= minBinCount) activeBins++;
    }
    const midToneRatio = litPixels > 0 ? midTonePixels / litPixels : 0;
    return { activeBins, midToneRatio: Number(midToneRatio.toFixed(4)), litPixels };
  }

  function boxBlurGrid(src, w, h, rad) {
    const tmp = new Float32Array(w * h);
    const dst = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let cnt = 0;
        for (let k = -rad; k <= rad; k++) {
          const xx = clamp(x + k, 0, w - 1);
          sum += src[y * w + xx];
          cnt++;
        }
        tmp[y * w + x] = sum / cnt;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let cnt = 0;
        for (let k = -rad; k <= rad; k++) {
          const yy = clamp(y + k, 0, h - 1);
          sum += tmp[yy * w + x];
          cnt++;
        }
        dst[y * w + x] = sum / cnt;
      }
    }
    return dst;
  }

  function buildRefractMask(subjectRgba, maskRgba, isAlabaster, strength) {
    const shearMask = new Float32Array(COLS * ROWS);
    const s = clamp(Number.isFinite(strength) ? strength : 1.0, 0, 2.0);

    if (maskRgba) {
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          let sum = 0;
          for (let dy = 0; dy < PITCH; dy++) {
            const y = row * PITCH + dy;
            for (let dx = 0; dx < PITCH; dx++) {
              const x = col * PITCH + dx;
              const p = (y * W + x) * 4;
              sum += (0.2126 * maskRgba[p] + 0.7152 * maskRgba[p + 1] + 0.0722 * maskRgba[p + 2]) / 255;
            }
          }
          const preserve = sum / (PITCH * PITCH);
          shearMask[row * COLS + col] = clamp((1 - preserve) * s, 0, 1.4);
        }
      }
      return shearMask;
    }

    // Auto-derive smooth spatial preserveMask from subject gradient magnitude + peak brightness/accent prominence.
    const cellSig = new Float32Array(COLS * ROWS);
    const cellWarm = new Float32Array(COLS * ROWS);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        let sigSum = 0;
        let warmSum = 0;
        for (let dy = 0; dy < PITCH; dy++) {
          const y = row * PITCH + dy;
          for (let dx = 0; dx < PITCH; dx++) {
            const x = col * PITCH + dx;
            const p = (y * W + x) * 4;
            const r = subjectRgba[p] / 255;
            const g = subjectRgba[p + 1] / 255;
            const b = subjectRgba[p + 2] / 255;
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            sigSum += isAlabaster ? 1 - Math.min(r, g, b) : lum;
            warmSum += clamp((r - Math.max(g, b) * 0.85) * 1.45, 0, 1);
          }
        }
        const inv = 1 / (PITCH * PITCH);
        cellSig[row * COLS + col] = sigSum * inv;
        cellWarm[row * COLS + col] = warmSum * inv;
      }
    }

    const coreRaw = new Float32Array(COLS * ROWS);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cL = Math.max(0, col - 1);
        const cR = Math.min(COLS - 1, col + 1);
        const rU = Math.max(0, row - 1);
        const rD = Math.min(ROWS - 1, row + 1);
        const gx = cellSig[row * COLS + cR] - cellSig[row * COLS + cL];
        const gy = cellSig[rD * COLS + col] - cellSig[rU * COLS + col];
        const grad = Math.hypot(gx, gy);
        const sig = cellSig[row * COLS + col];
        const warm = cellWarm[row * COLS + col];
        // Sculpted rim gradients, bright cores, and crimson accents preserve crisp form;
        // quiet wakes and ambient halos drop toward 0 so strata shear ripples across them.
        coreRaw[row * COLS + col] = clamp(grad * 2.3 + smoothstep(0.36, 0.84, sig) * 0.62 + warm * 0.56, 0, 1);
      }
    }

    const smooth1 = boxBlurGrid(coreRaw, COLS, ROWS, 3);
    const smooth2 = boxBlurGrid(smooth1, COLS, ROWS, 2);

    for (let row = 0; row < ROWS; row++) {
      const v = (row + 0.5) / ROWS;
      const lowerCascade = smoothstep(0.50, 0.88, v);
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col;
        // Preserve stays 0.55..0.85 on focal sculpted cores, dropping to 0.0..0.25 across wakes & lower cascades.
        const preserve = clamp(smooth2[idx] * (1 - 0.58 * lowerCascade), 0, 0.85);
        shearMask[idx] = clamp((1 - preserve) * s, 0.14 * s, 1.15 * s);
      }
    }
    return shearMask;
  }

  // =========================================================================
  // 3. CONTINUOUS OPTICAL LIGHT-FIELD EXTRACTION
  // =========================================================================
  function buildRowEnergy(strata) {
    const rowEnergy = new Float32Array(H);
    const slices = strata?.slices || [];
    for (let y = 0; y < H; y++) {
      const v = y / H;
      let e = 0.55;
      for (let i = 0; i < slices.length; i++) {
        const sl = slices[i];
        if (v >= sl.y0 && v <= sl.y1) {
          e = sl.energy;
          break;
        }
      }
      rowEnergy[y] = e;
    }
    const smooth = new Float32Array(H);
    for (let i = 0; i < H; i++) {
      let sum = 0;
      let cnt = 0;
      for (let k = -14; k <= 14; k++) {
        const j = clamp(i + k, 0, H - 1);
        sum += rowEnergy[j];
        cnt++;
      }
      smooth[i] = sum / cnt;
    }
    return smooth;
  }

  function extractObsidianField(rgba, strata) {
    const hdr = new Float32Array(W * H * 3);
    const eSmooth = buildRowEnergy(strata);

    for (let y = 0; y < H; y++) {
      const rowGain = 0.90 + 0.18 * clamp(eSmooth[y], 0.3, 1.4);
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 4;
        const r = rgba[p] / 255;
        const g = rgba[p + 1] / 255;
        const b = rgba[p + 2] / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const maxC = Math.max(r, g, b);
        if (lum < 0.004 && maxC < 0.012) continue;

        const warm = clamp((r - Math.max(g, b) * 0.85) * 1.45, 0, 1);
        const minC = Math.min(r, g, b);
        const gain = (0.94 + 0.88 * Math.pow(lum, 1.32)) * rowGain;

        // Suppress stray neon green while preserving rich cyan, cobalt, amethyst, and ember-crimson.
        const coolG = g > Math.max(r, b) * 1.15 ? Math.max(r, b) * 1.04 + (g - Math.max(r, b)) * 0.30 : g;
        let hr = r * gain;
        let hg = coolG * gain;
        let hb = b * gain;

        if (warm > 0.22) {
          const wBoost = smoothstep(0.22, 0.85, warm);
          hr += wBoost * (0.34 + 0.42 * lum) * rowGain;
          hg *= 1 - 0.16 * wBoost;
          hb *= 1 - 0.14 * wBoost;
        } else {
          // Subtle deep sapphire/twilight enrichment in cool mid-shadows
          const coolMid = smoothstep(0.04, 0.45, lum) * (1 - smoothstep(0.65, 0.95, lum));
          hb += coolMid * 0.08 * rowGain;
        }

        // Specular icy-white crest lift only at very bright neutral peaks
        if (lum > 0.78 && minC > 0.66) {
          const spec = 1 + 0.46 * smoothstep(0.66, 0.96, minC);
          hr *= spec;
          hg *= spec;
          hb *= spec;
        }

        const outIdx = (y * W + x) * 3;
        hdr[outIdx] = hr;
        hdr[outIdx + 1] = hg;
        hdr[outIdx + 2] = hb;
      }
    }
    return hdr;
  }

  function extractAlabasterField(rgba, strata) {
    const dayField = new Float32Array(W * H * 3);
    const eSmooth = buildRowEnergy(strata);

    for (let y = 0; y < H; y++) {
      const rowGain = 0.90 + 0.18 * clamp(eSmooth[y], 0.3, 1.4);
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 4;
        const r = rgba[p] / 255;
        const g = rgba[p + 1] / 255;
        const b = rgba[p + 2] / 255;
        const ink = 1 - Math.min(r, g, b);
        const lumInk = 1 - (0.2126 * r + 0.7152 * g + 0.0722 * b);
        if (ink < 0.01 && lumInk < 0.01) continue;

        const crim = clamp((r - Math.max(g, b)) * 1.65, 0, 1);
        const vCrim = clamp(crim * (0.55 + 0.78 * ink) * rowGain, 0, 1.35);
        const vSlate = clamp((lumInk * 1.18 - crim * 0.62) * rowGain, 0, 1.30);
        const vMist = clamp(Math.pow(Math.max(lumInk, ink * 0.85), 0.78) * 1.15, 0, 1.25);

        const outIdx = (y * W + x) * 3;
        dayField[outIdx] = vCrim;
        dayField[outIdx + 1] = vSlate;
        dayField[outIdx + 2] = vMist;
      }
    }
    return dayField;
  }

  // =========================================================================
  // 4. REAL CODEBASE HORIZONTAL STRATA SLICE SCHEDULE (7px ROW-SNAPPED)
  // =========================================================================
  function buildGridSlices(strata, seed, opts = {}) {
    const shearScale = opts.shearScale ?? 1.0;
    const dispScale = opts.dispScale ?? 1.0;
    const streakScale = opts.streakScale ?? 1.0;
    const slices = [];
    const rng = mulberry32((seed ^ 0x3c6ef372) >>> 0);

    const upper = [];
    const lower = [];
    for (const s of strata.slices || []) {
      if (s.midV < 0.52) upper.push(s);
      else lower.push(s);
    }

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
          (s.shearX * COLS * (0.76 + 0.48 * rng()) + subSign * (1.1 + s.crossNorm * 3.8)) * shearScale;
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

  function refractFieldToGrid(field, strata, seed, shearMask, opts = {}) {
    const { slices, rowSlice } = buildGridSlices(strata, seed, opts);
    const gridRGB = new Float32Array(COLS * ROWS * 3);
    const rowRng = mulberry32((seed ^ 0x7f4a7c15) >>> 0);
    const streakMixBase = opts.streakMix ?? 0.44;
    const upperStreakMix = opts.upperStreakMix ?? 0.16;

    for (let row = 0; row < ROWS; row++) {
      const sl = rowSlice[row];
      const fyBase = (row + 0.5) * (H / ROWS);

      if (!sl) {
        for (let col = 0; col < COLS; col++) {
          const fx = (col + 0.5) * (W / COLS);
          const idx = (row * COLS + col) * 3;
          gridRGB[idx] = sampleField(field, W, H, fx, fyBase, 0) * 0.88;
          gridRGB[idx + 1] = sampleField(field, W, H, fx, fyBase, 1) * 0.88;
          gridRGB[idx + 2] = sampleField(field, W, H, fx, fyBase, 2) * 0.88;
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
        const rMask = shearMask ? shearMask[row * COLS + col] : 1.0;

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

        const dispLocal = dispBase * clamp(0.52 + 0.55 * rMask, 0.45, 1.25);
        const dispR = dispLocal * 0.90;
        const dispG = opts.cyanPairedDisp ? -dispLocal * 0.46 : -dispLocal * 0.14;
        const dispB = -dispLocal * 0.86;

        const fx = (col + 0.5 - dxC) * (W / COLS);
        const fy = (row + 0.5 + dyR) * (H / ROWS);
        const stepX = W / COLS;

        let r = 0,
          g = 0,
          b = 0;
        for (const oy of [-0.26, 0, 0.26]) {
          const sy = fy + oy * (H / ROWS);
          r += sampleField(field, W, H, fx - dispR * stepX, sy, 0);
          g += sampleField(field, W, H, fx - dispG * stepX, sy, 1);
          b += sampleField(field, W, H, fx - dispB * stepX, sy, 2);
        }
        const inv3 = bBoost / 3;
        const idx = (row * COLS + col) * 3;
        gridRGB[idx] = r * inv3;
        gridRGB[idx + 1] = g * inv3;
        gridRGB[idx + 2] = b * inv3;
      }
    }

    // 1D Horizontal Cell-Row Motion-Streak Pass
    const streakRng = mulberry32((seed ^ 0x6a09e667) >>> 0);
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
        const rMask = shearMask ? shearMask[row * COLS + c] : 1.0;
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
  // 5. TYPOGRAPHY SANCTUARY RESOLUTION & FRAMELESS VYO TYPOGRAPHY
  // =========================================================================
  function resolveSanctuary(cfg, isAlabaster) {
    const custom = cfg.subject && cfg.subject.sanctuary;
    if (custom && Number.isFinite(custom.x) && Number.isFinite(custom.y) && Number.isFinite(custom.w) && Number.isFinite(custom.h)) {
      return {
        custom: true,
        x: custom.x,
        y: custom.y,
        w: custom.w,
        h: custom.h,
        typoX: custom.x + 12,
        typoY: custom.y + 12,
        maxWidth: Math.max(200, custom.w - 24),
        headlineSize: custom.headlineSize || (isAlabaster ? 42 : 41),
        blockCols: [Math.max(0, Math.floor((custom.x - 14) / PITCH)), Math.min(COLS - 1, Math.ceil((custom.x + custom.w + 14) / PITCH))],
        blockRows: [Math.max(0, Math.floor((custom.y - 14) / PITCH)), Math.min(ROWS - 1, Math.ceil((custom.y + custom.h + 14) / PITCH))],
      };
    }

    if (isAlabaster) {
      return {
        custom: false,
        x: 0,
        y: 0,
        w: 540,
        h: 252,
        typoX: 58,
        typoY: 54,
        maxWidth: 460,
        headlineSize: 42,
        xMax: 520,
        yMax: 230,
        softX: 560,
        softY: 265,
        blockCols: [0, 78],
        blockRows: [0, 38],
      };
    }

    return {
      custom: false,
      x: 0,
      y: 392,
      w: 396,
      h: 350,
      typoX: 56,
      typoY: 432,
      maxWidth: 326,
      headlineSize: 41,
      uMax: 0.46,
      uSoft: 0.36,
      vMin: 0.33,
      vMax: 0.63,
      strictLeftCut: 0.26,
      strictVStart: 0.36,
      blockCols: [0, 56],
      blockRows: [46, 108],
    };
  }

  function layoutFramelessTypography(ctx, cfg, sanctuary) {
    const x = sanctuary.typoX;
    const tagY = sanctuary.typoY;
    let headlineSize = sanctuary.headlineSize || 41;

    const repoName = String(cfg.product?.name || cfg.product?.repo || "repo").toLowerCase();
    const files = Number(cfg.strata?.totalFiles || 0).toLocaleString("en-US");
    const linesCount = Number(cfg.strata?.totalLoc || 0).toLocaleString("en-US");
    const metaStats = `${files} files · ${linesCount} lines`;

    ctx.save();
    ctx.font = '700 10px "Commit Mono", monospace';
    const repoW = ctx.measureText(repoName).width;
    ctx.font = '400 10px "Commit Mono", monospace';
    const metaW = ctx.measureText(`  /  ${metaStats}`).width;
    const headerW = 11.5 + repoW + metaW;

    let tracking = -headlineSize * 0.03;
    ctx.font = `600 ${headlineSize}px "Inter Display", "Inter", sans-serif`;
    let headLines = wrapTrackedLines(ctx, cfg.headline || "", sanctuary.maxWidth, tracking, 0.72);
    while (headLines.length > 3 && headlineSize > 30) {
      headlineSize -= 2;
      tracking = -headlineSize * 0.03;
      ctx.font = `600 ${headlineSize}px "Inter Display", "Inter", sans-serif`;
      headLines = wrapTrackedLines(ctx, cfg.headline || "", sanctuary.maxWidth, tracking, 0.72);
    }
    const lineHeight = Math.round(headlineSize * 1.08);
    let maxHeadW = 0;
    for (const l of headLines) {
      maxHeadW = Math.max(maxHeadW, measureTrackedWidth(ctx, l, tracking, 0.72));
    }

    ctx.font = '400 11px "Commit Mono", monospace';
    const legendLines = wrapMonoLines(ctx, cfg.legend || "", Math.max(sanctuary.maxWidth, 340)).slice(0, 2);
    let maxLegW = 0;
    for (const l of legendLines) {
      maxLegW = Math.max(maxLegW, ctx.measureText(l).width);
    }
    ctx.restore();

    const headY = tagY + 24;
    const legendY = headY + Math.max(1, headLines.length) * lineHeight + 18;
    const legendLH = 15;
    const bottom = legendY + Math.max(1, legendLines.length) * legendLH;
    const right = x + Math.max(headerW, maxHeadW, maxLegW);

    return {
      x,
      tagY,
      headY,
      legendY,
      legendLH,
      headlineSize,
      lineHeight,
      tracking,
      repoName,
      repoW,
      metaStats,
      headLines,
      legendLines,
      box: { left: x - 4, top: tagY - 4, right: right + 4, bottom: bottom + 4 },
    };
  }

  function drawVyoFramelessTypography(ctx, typo, isAlabaster) {
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // 1. Quiet Commit Mono 10px header with single focal accent square
    ctx.fillStyle = isAlabaster ? "#CC262F" : "#E23848";
    drawRoundedRect(ctx, typo.x, typo.tagY + 1.5, 5.5, 5.5, 1.35);

    ctx.font = '700 10px "Commit Mono", monospace';
    ctx.fillStyle = isAlabaster ? "#191E26" : "#DCE4F0";
    const repoX = typo.x + 11.5;
    ctx.fillText(typo.repoName, repoX, typo.tagY);

    ctx.font = '400 10px "Commit Mono", monospace';
    ctx.fillStyle = isAlabaster ? "#707F90" : "#7B8BA4";
    ctx.fillText(`  /  ${typo.metaStats}`, repoX + typo.repoW, typo.tagY);

    // 2. Calm sentence-case Inter Display 600 headline
    ctx.font = `600 ${typo.headlineSize}px "Inter Display", "Inter", sans-serif`;
    ctx.fillStyle = isAlabaster ? "#111316" : "#FFFFFF";
    for (let i = 0; i < typo.headLines.length; i++) {
      drawTrackedText(ctx, typo.headLines[i], typo.x, typo.headY + i * typo.lineHeight, typo.tracking, 0.72);
    }

    // 3. Quiet Commit Mono 11px legend beneath
    ctx.font = '400 11px "Commit Mono", monospace';
    ctx.fillStyle = isAlabaster ? "#637486" : "#7F90AA";
    for (let i = 0; i < typo.legendLines.length; i++) {
      ctx.fillText(typo.legendLines[i], typo.x, typo.legendY + i * typo.legendLH);
    }

    ctx.restore();
  }

  function normalizeMicroStyle(style) {
    if (style === "core") return "core";
    if (style === "whisper" || style === "dew") return "whisper";
    return "part";
  }

  // =========================================================================
  // 6. OBSIDIAN 7px LUMINOUS MOSAIC RENDERER + MICRO-TYPE WEAVER
  // =========================================================================
  function renderObsidianMosaic(ctx, gridRGB, cfg, sanctuary, typo) {
    const GROUND = "#090A0D";
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, W, H);

    const cellKind = new Uint8Array(COLS * ROWS);
    const cellLum = new Float32Array(COLS * ROWS);
    const cellSize = new Float32Array(COLS * ROWS);
    const cellRx = new Float32Array(COLS * ROWS);
    const cellColor = new Array(COLS * ROWS);

    const sUMin = sanctuary.custom ? sanctuary.x / W : 0;
    const sUMax = sanctuary.custom ? (sanctuary.x + sanctuary.w) / W : Math.max(sanctuary.uMax ?? 0.46, (typo.box.right + 18) / W);
    const sVMin = sanctuary.custom ? sanctuary.y / H : Math.min(sanctuary.vMin ?? 0.33, (typo.box.top - 18) / H);
    const sVMax = sanctuary.custom ? (sanctuary.y + sanctuary.h) / H : Math.max(sanctuary.vMax ?? 0.63, (typo.box.bottom + 18) / H);
    const featherU = 0.065;
    const featherV = 0.05;
    const strictLeftCut = sanctuary.strictLeftCut ?? 0.26;
    const strictVStart = sanctuary.strictVStart ?? 0.36;

    const specLumThresh = 0.86;
    const specMinThresh = 0.69;

    for (let row = 0; row < ROWS; row++) {
      const v = (row + 0.5) / ROWS;
      const typoBandV = smoothstep(sVMin - featherV, sVMin, v) * (1 - smoothstep(sVMax, sVMax + featherV, v));

      for (let col = 0; col < COLS; col++) {
        const u = (col + 0.5) / COLS;
        const idx = (row * COLS + col) * 3;
        let r = gridRGB[idx];
        let g = gridRGB[idx + 1];
        let b = gridRGB[idx + 2];

        // Full calm obsidian inside the sanctuary box, with velvety feathering outside its perimeter
        if (typoBandV > 0.001 && u >= sUMin - featherU && u < sUMax + featherU) {
          const leftIn = sanctuary.custom ? smoothstep(sUMin - featherU, sUMin, u) : 1;
          const rightIn = 1 - smoothstep(sUMax, sUMax + featherU, u);
          const protect = leftIn * rightIn;
          const atten = 1 - protect * typoBandV * 0.995;
          r *= atten;
          g *= atten;
          b *= atten;
        }
        if (!sanctuary.custom && v > strictVStart && u < 0.44) {
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
        const jitter = (cellHash(col, row, cfg.seed, 19) - 0.5) * 0.048 + bayer * 0.042;
        const thresh = 0.072 + jitter;

        if (lum < thresh && Math.max(mr, mg, mb) < 0.128 + jitter) {
          cellKind[cIdx] = 0;
          continue;
        }

        const crimDom = mr - Math.max(mg, mb) * 1.05;
        const specMin = Math.min(mr, mg, mb);

        if (lum > specLumThresh && specMin > specMinThresh) {
          cellKind[cIdx] = 4;
          const t = clamp((lum - specLumThresh) / (1 - specLumThresh), 0, 1);
          const cr = 0.87 + t * 0.12;
          const cg = 0.93 + t * 0.06;
          const cb = 0.98 + t * 0.02;
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 5.2 + t * 0.6;
          cellRx[cIdx] = cellSize[cIdx] * 0.36;
        } else if (crimDom > 0.16 && mr > 0.27) {
          cellKind[cIdx] = 3;
          const heat = clamp((mr - 0.25) / 0.66, 0, 1);
          const cr = 0.74 + heat * 0.23;
          const cg = 0.11 + heat * 0.16 + Math.max(0, mg - 0.22) * 0.34;
          const cb = 0.16 + heat * 0.13 + Math.max(0, mb - 0.22) * 0.38;
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 4.35 + heat * 1.40;
          cellRx[cIdx] = cellSize[cIdx] * 0.46;
        } else if (lum < 0.26 && Math.max(mr, mg, mb) < 0.38) {
          cellKind[cIdx] = 1;
          const t = clamp((Math.max(lum, Math.max(mr, mg, mb) * 0.65) - 0.06) / 0.24, 0, 1);
          const cr = clamp(0.14 + mr * 0.70, 0.14, 0.54);
          const cg = clamp(0.17 + mg * 0.70, 0.17, 0.56);
          const cb = clamp(0.28 + mb * 0.74, 0.26, 0.70);
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 2.55 + t * 1.65;
          cellRx[cIdx] = 0.6;
        } else {
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

    const [bc0, bc1] = sanctuary.blockCols;
    const [br0, br1] = sanctuary.blockRows;
    markBlocked(bc0, br0, bc1, br1);
    markBlocked(
      Math.floor((typo.box.left - 14) / PITCH),
      Math.floor((typo.box.top - 14) / PITCH),
      Math.ceil((typo.box.right + 14) / PITCH),
      Math.ceil((typo.box.bottom + 14) / PITCH)
    );
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
      whisper: { font: '400 8.6px "Commit Mono", monospace', fill: "#C9D8EC" },
      part: { font: '400 8.7px "Commit Mono", monospace', fill: "#E4EEF9" },
      core: { font: '700 8.6px "Commit Mono", monospace', fill: "#F9DCE2" },
    };

    function spanCols(str, font) {
      ctx.font = font;
      return Math.ceil(ctx.measureText(str).width / PITCH);
    }

    const microList = cfg.microType || [];
    for (let i = 0; i < microList.length; i++) {
      const item = microList[i];
      const style = normalizeMicroStyle(item.style);
      const st = FONTS[style];
      const span = spanCols(item.text, st.font);
      const targetC = Math.round(item.u * COLS - span * 0.45);
      const targetR = Math.round(item.v * ROWS);

      let best = null;
      for (const pass of [0, 1]) {
        const radScale = pass === 0 ? (item.rad || 0.11) : Math.max(0.16, (item.rad || 0.11) * 1.45);
        const radC = Math.round(radScale * COLS);
        const radR = Math.round(radScale * ROWS);
        let bestScore = -1e9;

        const rMin = Math.max(6, targetR - radR);
        const rMax = Math.min(ROWS - 5, targetR + radR);
        const cMin = Math.max(7, targetC - radC);
        const cMax = Math.min(COLS - span - 4, targetC + radC);

        for (let r = rMin; r <= rMax; r++) {
          for (let c = cMin; c <= cMax; c++) {
            const padX = pass === 0 ? 3 : 2;
            const padY = pass === 0 ? 3 : 2;
            if (!isAreaFree(c - padX, r - padY, c + span + padX, r + padY)) continue;

            const glare = countAdjacentGlare(c, r, span);
            if (glare > (pass === 0 ? 2 : 5)) continue;

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
            if (pass === 0 && specCols > 0) continue;

            const distNorm = Math.hypot((c - targetC) / Math.max(1, radC), (r - targetR) / Math.max(1, radR));
            if (distNorm > 1.25) continue;

            const nearLit = countLitAround(c + Math.floor(span * 0.5), r, 3);
            let score = -distNorm * 1.4 + (cellHash(c, r, cfg.seed, 31 + i) - 0.5) * 0.22;

            if (style === "whisper") {
              if (pass === 0 && (brightCols > 2 || nearLit < 2 || nearLit > 42)) continue;
              score += (litCols === 0 ? 0.60 : 0.22) - brightCols * 0.25 - glare * 0.4;
            } else if (style === "core") {
              let crimNear = crimCols;
              for (let dr = -2; dr <= 2; dr++) {
                const rr = r + dr;
                if (rr < 0 || rr >= ROWS) continue;
                for (let dc = -2; dc <= span + 2; dc++) {
                  const cc = c + dc;
                  if (cc >= 0 && cc < COLS && cellKind[rr * COLS + cc] === 3) crimNear++;
                }
              }
              if (pass === 0 && crimNear < 2 && nearLit < 6) continue;
              score += Math.min(1.2, crimNear * 0.08) - glare * 0.35;
            } else {
              if (pass === 0 && nearLit < 4) continue;
              score += (litCols / Math.max(1, span)) * 0.45 - glare * 0.35;
            }

            if (score > bestScore) {
              bestScore = score;
              best = { c, r, padX, padY };
            }
          }
        }
        if (best) break;
      }

      if (best) {
        markBlocked(best.c - best.padX, best.r - best.padY, best.c + span + best.padX, best.r + best.padY);
        for (let c = Math.max(0, best.c - 1); c <= Math.min(COLS - 1, best.c + span); c++) {
          carvedCell[best.r * COLS + c] = 1;
        }
        placedTexts.push({ str: item.text, col: best.c, row: best.r, font: st.font, fill: st.fill });
      }
    }

    // ---- DRAW ALL NON-CARVED 7px MOSAIC CELLS & COMPUTE METRICS ----
    let litCells = 0;
    let accentCells = 0;
    let sanctuaryCollisions = 0;

    for (let row = 0; row < ROWS; row++) {
      const y0 = row * PITCH;
      const y1 = y0 + PITCH;
      for (let col = 0; col < COLS; col++) {
        const cIdx = row * COLS + col;
        if (cellKind[cIdx] === 0 || carvedCell[cIdx]) continue;
        litCells++;
        if (cellKind[cIdx] === 3) accentCells++;

        const x0 = col * PITCH;
        const x1 = x0 + PITCH;
        if (
          cellLum[cIdx] > 0.25 &&
          x0 < typo.box.right &&
          x1 > typo.box.left &&
          y0 < typo.box.bottom &&
          y1 > typo.box.top
        ) {
          sanctuaryCollisions++;
        }

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

    drawVyoFramelessTypography(ctx, typo, false);

    return {
      litShare: Number((litCells / (COLS * ROWS)).toFixed(4)),
      accentShare: Number((accentCells / Math.max(1, litCells)).toFixed(4)),
      sanctuaryCollisions,
      microPlaced: placedTexts.length,
      microRequested: microList.length,
    };
  }

  // =========================================================================
  // 7. DAYLIGHT ALABASTER 7px MOSAIC RENDERER + MICRO-TYPE WEAVER
  // =========================================================================
  function renderAlabasterMosaic(ctx, gridRGB, cfg, sanctuary, typo) {
    const GROUND = "#F2F3F6";
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, W, H);

    const faultRows = new Set(cfg.strata?.faultRows || []);
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
        if (sanctuary.custom) {
          if (x0 >= sanctuary.x && x0 < sanctuary.x + sanctuary.w && y0 >= sanctuary.y && y0 < sanctuary.y + sanctuary.h) continue;
        } else {
          if (y0 < sanctuary.yMax && x0 < sanctuary.xMax) continue;
          if (y0 < sanctuary.softY && x0 < sanctuary.softX) continue;
        }
        if (isFaultRow && col < COLS - 14) continue;

        const idx = (row * COLS + col) * 3;
        const vCrim = gridRGB[idx];
        const vSlate = gridRGB[idx + 1];
        const vMist = gridRGB[idx + 2];

        const bayer = BAYER4[row & 3][col & 3] / 16 - 0.5;
        const micro = (cellHash(col, row, cfg.seed, 23) - 0.5) * 0.095 + bayer * 0.085;

        let tone = 0;
        let size = 5.2;
        let rx = 0.7;

        if (vCrim + micro * 0.72 > 0.42) {
          tone = vCrim + micro * 0.42 > 0.72 ? 7 : 6;
          size = vCrim > 0.60 ? 5.65 : 4.85;
          rx = size * 0.44;
        } else if (vSlate + micro * 0.68 > 0.35) {
          if (vSlate + micro * 0.44 > 0.70) tone = 5;
          else if (vSlate + micro * 0.44 > 0.50) tone = 4;
          else tone = 3;
          size = vSlate > 0.56 ? 5.55 : 4.75;
          rx = size * 0.24;
        } else if (vMist + micro * 0.58 > 0.21) {
          tone = vMist + micro * 0.40 > 0.45 ? 2 : 1;
          size = vMist > 0.46 ? 5.35 : 4.35;
          rx = 0.65;
        }

        if (tone > 0) {
          const cIdx = row * COLS + col;
          gridTone[cIdx] = tone;
          gridSize[cIdx] = size;
          gridRx[cIdx] = rx;
        }
      }
    }

    // ---- ZONE-AWARE DARK CHARCOAL MICRO-TYPE WEAVER (ALABASTER) ----
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
    markBlocked(
      Math.floor((typo.box.left - 14) / PITCH),
      Math.floor((typo.box.top - 14) / PITCH),
      Math.ceil((typo.box.right + 14) / PITCH),
      Math.ceil((typo.box.bottom + 14) / PITCH)
    );
    markBlocked(0, 0, 4, ROWS - 1);
    markBlocked(COLS - 3, 0, COLS - 1, ROWS - 1);

    function isAreaFree(c0, r0, c1, r1) {
      if (c0 < 5 || c1 >= COLS - 3 || r0 < 6 || r1 >= ROWS - 3) return false;
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
      whisper: { font: '400 8.8px "Commit Mono", monospace', fill: "#222933" },
      part: { font: '400 8.9px "Commit Mono", monospace', fill: "#181E26" },
      core: { font: '700 8.8px "Commit Mono", monospace', fill: "#14181F" },
    };

    function spanCols(str, font) {
      ctx.font = font;
      return Math.ceil(ctx.measureText(str).width / PITCH);
    }

    const microList = cfg.microType || [];
    for (let i = 0; i < microList.length; i++) {
      const item = microList[i];
      const style = normalizeMicroStyle(item.style);
      const st = FONTS[style];
      const span = spanCols(item.text, st.font);
      const targetC = Math.round(item.u * COLS - span * 0.45);
      const targetR = Math.round(item.v * ROWS);

      let best = null;
      for (const pass of [0, 1]) {
        const radScale = pass === 0 ? (item.rad || 0.11) : Math.max(0.16, (item.rad || 0.11) * 1.45);
        const radC = Math.round(radScale * COLS);
        const radR = Math.round(radScale * ROWS);
        let bestScore = -1e9;

        const rMin = Math.max(8, targetR - radR);
        const rMax = Math.min(ROWS - 4, targetR + radR);
        const cMin = Math.max(6, targetC - radC);
        const cMax = Math.min(COLS - span - 4, targetC + radC);

        for (let r = rMin; r <= rMax; r++) {
          for (let c = cMin; c <= cMax; c++) {
            const padX = pass === 0 ? 3 : 2;
            const padY = pass === 0 ? 3 : 2;
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
            let score = -distNorm * 1.45 - adjDarkRatio * 0.45 + (cellHash(c, r, cfg.seed, 57 + i) - 0.5) * 0.22;

            if (style === "whisper") {
              if (pass === 0 && (darkCols > 1 || nearInk < 3)) continue;
              score += (darkCols === 0 ? 0.65 : 0.10) + (mistCols / Math.max(1, span)) * 0.35;
            } else if (style === "core") {
              let crimNear = crimCols;
              for (let dr = -2; dr <= 2; dr++) {
                const rr = r + dr;
                if (rr < 0 || rr >= ROWS) continue;
                for (let dc = -2; dc <= span + 2; dc++) {
                  const cc = c + dc;
                  if (cc >= 0 && cc < COLS && gridTone[rr * COLS + cc] >= 6) crimNear++;
                }
              }
              if (pass === 0 && crimNear < 2 && nearInk < 6) continue;
              score += Math.min(1.2, crimNear * 0.08);
            } else {
              if (pass === 0 && nearInk < 4) continue;
              score += (mistCols / Math.max(1, span)) * 0.48 - (darkCols / Math.max(1, span)) * 0.25;
            }

            if (score > bestScore) {
              bestScore = score;
              best = { c, r, padX, padY };
            }
          }
        }
        if (best) break;
      }

      if (best) {
        markBlocked(best.c - best.padX, best.r - best.padY, best.c + span + best.padX, best.r + best.padY);
        for (let c = Math.max(0, best.c - 1); c <= Math.min(COLS - 1, best.c + span); c++) {
          if (gridTone[best.r * COLS + c] >= 3 || style === "core") {
            carvedCell[best.r * COLS + c] = 1;
          }
        }
        placedTexts.push({ str: item.text, col: best.c, row: best.r, font: st.font, fill: st.fill });
      }
    }

    // ---- DRAW ALL 7px ALABASTER MOSAIC CELLS & COMPUTE METRICS ----
    let litCells = 0;
    let accentCells = 0;
    let sanctuaryCollisions = 0;

    for (let row = 0; row < ROWS; row++) {
      const y0 = row * PITCH;
      const y1 = y0 + PITCH;
      for (let col = 0; col < COLS; col++) {
        const cIdx = row * COLS + col;
        const tone = gridTone[cIdx];
        if (tone === 0 || carvedCell[cIdx]) continue;
        litCells++;
        if (tone >= 6) accentCells++;

        const x0 = col * PITCH;
        const x1 = x0 + PITCH;
        if (
          tone >= 3 &&
          x0 < typo.box.right &&
          x1 > typo.box.left &&
          y0 < typo.box.bottom &&
          y1 > typo.box.top
        ) {
          sanctuaryCollisions++;
        }

        const sz = gridSize[cIdx];
        const pad = (PITCH - sz) * 0.5;
        ctx.fillStyle = PALETTE[tone];
        drawRoundedRect(ctx, x0 + pad, y0 + pad, sz, sz, gridRx[cIdx]);
      }
    }

    ctx.save();
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    for (const t of placedTexts) {
      ctx.font = t.font;
      ctx.fillStyle = t.fill;
      ctx.fillText(t.str, t.col * PITCH, (t.row + 0.78) * PITCH);
    }
    ctx.restore();

    drawVyoFramelessTypography(ctx, typo, true);

    return {
      litShare: Number((litCells / (COLS * ROWS)).toFixed(4)),
      accentShare: Number((accentCells / Math.max(1, litCells)).toFixed(4)),
      sanctuaryCollisions,
      microPlaced: placedTexts.length,
      microRequested: microList.length,
    };
  }

  // =========================================================================
  // 8. ASYNC BOOTSTRAP ENTRYPOINT
  // =========================================================================
  async function boot() {
    try {
      if (window.fontsReady) await window.fontsReady;
      const cfg = window.__VYO_LUMINOUS__;
      if (!cfg) throw new Error("missing window.__VYO_LUMINOUS__ payload");

      const canvas = document.getElementById("luminous");
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      const isAlabaster = cfg.theme === "alabaster";
      const bgHex = isAlabaster ? "#FFFFFF" : "#000000";

      const subjectRgba = await rasterizeSvg(cfg.subject.svg, bgHex);
      const maskRgba = cfg.subject.refractMaskSvg
        ? await rasterizeSvg(cfg.subject.refractMaskSvg, "#000000")
        : null;

      const tonalRichness = measureTonalRichness(subjectRgba, isAlabaster);
      const shearMask = buildRefractMask(subjectRgba, maskRgba, isAlabaster, cfg.subject.refractStrength);

      const sanctuary = resolveSanctuary(cfg, isAlabaster);
      const typo = layoutFramelessTypography(ctx, cfg, sanctuary);

      let stats;
      let sliceCount = 0;

      if (isAlabaster) {
        const dayField = extractAlabasterField(subjectRgba, cfg.strata);
        const { gridRGB, slices } = refractFieldToGrid(dayField, cfg.strata, cfg.seed, shearMask, {
          shearScale: 0.85,
          dispScale: 0.70,
          streakScale: 0.78,
          streakMix: 0.32,
          upperStreakMix: 0.14,
          couplingAdaptive: true,
          cyanPairedDisp: false,
        });
        sliceCount = slices.length;
        stats = renderAlabasterMosaic(ctx, gridRGB, cfg, sanctuary, typo);
      } else {
        const hdrField = extractObsidianField(subjectRgba, cfg.strata);
        const { gridRGB, slices } = refractFieldToGrid(hdrField, cfg.strata, cfg.seed, shearMask, {
          shearScale: 1.0,
          dispScale: 1.0,
          streakScale: 1.0,
          streakMix: 0.44,
          upperStreakMix: 0.16,
          couplingAdaptive: true,
          cyanPairedDisp: true,
        });
        sliceCount = slices.length;
        stats = renderObsidianMosaic(ctx, gridRGB, cfg, sanctuary, typo);
      }

      window.__vyoLuminousMetrics = {
        tonalRichness,
        litShare: stats.litShare,
        accentShare: stats.accentShare,
        sanctuaryCollisions: stats.sanctuaryCollisions,
        microPlaced: stats.microPlaced,
        microRequested: stats.microRequested,
        slices: sliceCount,
        theme: cfg.theme,
      };
      window.__vyoLuminousDone = true;
      window.drawn = true;
    } catch (e) {
      window.__vyoLuminousError = e && e.message ? e.message : String(e);
      window.__vyoLuminousDone = true;
      throw e;
    }
  }

  boot();
})();

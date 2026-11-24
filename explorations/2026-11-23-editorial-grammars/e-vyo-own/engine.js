// Exploration E (e-vyo-own): Vyo's Own Original Refracted Print-Matrix Engine
// Pipeline:
//   1. Rasterize bespoke 3-layer agent-drawn SVG scene (atmosphere, structure, core) at 840x1190
//   2. Refract the 3-layer field through real codebase horizontal strata slices (7px row-snapped)
//      with coupling-driven horizontal shear, 1D kinetic echo streaks, chromatic/tonal edge
//      dispersion, and crisp 1-row architectural fault-line breaks at major layer boundaries
//   3. Quantize onto the crisp 7px modular cell lattice (120x170):
//        - atmosphere -> delicate fine squares/dots (2.6-4.0px)
//        - structure  -> sharp architectural mid-full squares (4.3-5.6px)
//        - core       -> vivid luminous circular beads/gems (5.1-6.0px, rx = 0.46 * size)
//                        + tight bright specular highlight knots on dark grounds
//   4. Place intentional, anchored plain-language micro-callouts snapped strictly to 7px rows
//      with clean cell knockouts and Swiss/Japanese diagram ticks (● for core, — for part)
//   5. Frame with Vyo's original drafting-sheet chrome: 40px margins, top/bottom 1px hairlines
//      with + registration crosshairs, Newsreader editorial headline + ● Commit Mono legend.

(function () {
  "use strict";

  const W = 840;
  const H = 1190;
  const DPR = 2;
  const PITCH = 7;
  const COLS = Math.floor(W / PITCH); // 120
  const ROWS = Math.floor(H / PITCH); // 170

  // Print field stays strictly inside the top hairline (y=58) and bottom hairline (y=1138)
  const FIELD_ROW_MIN = 9;   // y = 63 (5px breathing below y=58 hairline)
  const FIELD_ROW_MAX = 161; // y = 1127..1134 (4px breathing above y=1138 hairline)

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

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function smoothstep(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const n = parseInt(clean, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mixHex(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const k = clamp(t, 0, 1);
    const r = Math.round(a[0] + (b[0] - a[0]) * k);
    const g = Math.round(a[1] + (b[1] - a[1]) * k);
    const bl = Math.round(a[2] + (b[2] - a[2]) * k);
    return `rgb(${r},${g},${bl})`;
  }

  function rgba(hex, alpha) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
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

  function measureTrackedText(ctx, text, trackingPx) {
    if (!text.length) return 0;
    let w = 0;
    for (let i = 0; i < text.length; i++) {
      w += ctx.measureText(text[i]).width;
      if (i < text.length - 1) w += trackingPx;
    }
    return w;
  }

  function drawTrackedText(ctx, text, x, y, trackingPx, align = "left") {
    let cx = x;
    if (align === "right") {
      cx = x - measureTrackedText(ctx, text, trackingPx);
    } else if (align === "center") {
      cx = x - measureTrackedText(ctx, text, trackingPx) * 0.5;
    }
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + trackingPx;
    }
    return cx - x;
  }

  // =========================================================================
  // 1. NATIVE BROWSER SVG LAYER RASTERIZATION (840x1190 -> 3-channel Float32)
  // =========================================================================
  function loadSvgToImage(svgInner) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svgInner}</svg>`;
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error("SVG layer rasterization failed: " + err));
      img.src = url;
    });
  }

  async function rasterizeThreeLayers(scene) {
    const [imgAtmo, imgStruct, imgCore] = await Promise.all([
      loadSvgToImage(scene.atmosphereSvg || ""),
      loadSvgToImage(scene.structureSvg || ""),
      loadSvgToImage(scene.coreSvg || ""),
    ]);

    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const octx = off.getContext("2d", { willReadFrequently: true });

    const field = new Float32Array(W * H * 3);
    const layers = [imgAtmo, imgStruct, imgCore];

    for (let ch = 0; ch < 3; ch++) {
      octx.clearRect(0, 0, W, H);
      octx.drawImage(layers[ch], 0, 0, W, H);
      const data = octx.getImageData(0, 0, W, H).data;
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const a = data[i + 3] / 255;
        if (a <= 0.002) continue;
        // White/grayscale luminance * alpha encodes smooth tonal weight 0..1
        const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        field[p * 3 + ch] = lum * a;
      }
    }

    return field;
  }

  function sampleField(field, fx, fy, ch) {
    if (fx < -1 || fx > W || fy < -1 || fy > H) return 0;
    const cx = clamp(fx, 0, W - 1.001);
    const cy = clamp(fy, 0, H - 1.001);
    const x0 = cx | 0;
    const y0 = cy | 0;
    const dx = cx - x0;
    const dy = cy - y0;
    const i00 = (y0 * W + x0) * 3 + ch;
    const i10 = i00 + 3;
    const i01 = i00 + W * 3;
    const i11 = i01 + 3;
    const top = field[i00] + (field[i10] - field[i00]) * dx;
    const bot = field[i01] + (field[i11] - field[i01]) * dx;
    return top + (bot - top) * dy;
  }

  // =========================================================================
  // 2. CODEBASE-DRIVEN 7px ROW-SNAPPED HORIZONTAL STRATA SLICE SCHEDULE
  // =========================================================================
  function buildVyoGridSlices(model, opts = {}) {
    const shearScale = opts.shearScale ?? 1.0;
    const dispScale = opts.dispScale ?? 1.0;
    const streakScale = opts.streakScale ?? 1.0;
    const rng = mulberry32(model.seed ^ 0x3c6ef372);
    const slices = [];

    for (let i = 0; i < model.strata.length; i++) {
      const s = model.strata[i];
      const rStart = clamp(Math.floor(s.y0 * ROWS), FIELD_ROW_MIN, FIELD_ROW_MAX);
      const rEnd = clamp(
        i === model.strata.length - 1 ? FIELD_ROW_MAX + 1 : Math.floor(s.y1 * ROWS),
        rStart + 1,
        FIELD_ROW_MAX + 1
      );
      const totalR = rEnd - rStart;
      const sub = Math.min(totalR, s.subSlices || 1);
      let curR = rStart;

      for (let k = 0; k < sub; k++) {
        const nextR =
          k === sub - 1
            ? rEnd
            : Math.min(rEnd, curR + Math.max(1, Math.round((totalR / sub) * (0.65 + rng() * 0.7))));
        if (nextR <= curR) continue;

        const subSign = k % 2 === 0 ? 1 : -1;
        // Restrained, architectural shear so the agent's drawing stays 100% iconic & legible
        // while real file/import strata slices visibly step and pulse across the sheet!
        const couplingFactor = 0.45 + 0.95 * smoothstep(0.12, 0.75, s.crossNorm + (s.isAccent ? 0.16 : 0));
        const rawShear =
          (s.shearX * COLS * (0.55 + 0.35 * rng()) + subSign * (0.35 + s.crossNorm * 1.45)) *
          shearScale *
          couplingFactor;
        const shearCols = clamp(rawShear, -2.75 * shearScale, 2.75 * shearScale);
        const dispCols = clamp((0.45 + (s.disp / PITCH) * 0.65) * dispScale * couplingFactor, 0.35, 2.1);
        const energyMod = 0.90 + (s.isAccent ? 0.11 : 0) + (rng() - 0.5) * 0.16;
        const streakCols = (1.1 + s.crossNorm * 2.2 + rng() * 1.3) * streakScale;

        slices.push({
          r0: curR,
          r1: nextR,
          layer: s.layer,
          isAccent: s.isAccent,
          crossNorm: s.crossNorm,
          locNorm: s.locNorm,
          shearCols,
          dispCols,
          energyMod,
          streakCols,
          streakBias: Math.sign(shearCols || subSign) * 0.48,
          seed: (s.seed ^ (k * 2654435761)) >>> 0,
        });
        curR = nextR;
      }
    }

    const rowSlice = new Array(ROWS);
    for (const sl of slices) {
      for (let r = sl.r0; r < sl.r1 && r < ROWS; r++) {
        rowSlice[r] = sl;
      }
    }

    // Identify crisp 1-row architectural fault-line cuts at major codebase layer boundaries
    const faultRows = new Set();
    let prevLayer = model.strata[0]?.layer ?? 0;
    for (const s of model.strata) {
      if (s.layer !== prevLayer) {
        const fr = Math.round(s.y0 * ROWS);
        if (fr >= 40 && fr <= FIELD_ROW_MAX - 10) {
          faultRows.add(fr);
        }
        prevLayer = s.layer;
      }
    }

    return { slices, rowSlice, faultRows };
  }

  // =========================================================================
  // 3. REFRACT 3-LAYER SVG FIELD ONTO 120x170 MODULAR CELL GRID
  // =========================================================================
  function refractLayersToGrid(field, model, opts = {}) {
    const { slices, rowSlice, faultRows } = buildVyoGridSlices(model, opts);

    const gridAtmo = new Float32Array(COLS * ROWS);
    const gridStruct = new Float32Array(COLS * ROWS);
    const gridCore = new Float32Array(COLS * ROWS);
    const gridDispWarm = new Float32Array(COLS * ROWS);
    const gridDispCool = new Float32Array(COLS * ROWS);

    const rowRng = mulberry32(model.seed ^ 0x7f4a7c15);
    const coreShearRatio = opts.coreShearRatio ?? 0.62;
    const atmoShearRatio = opts.atmoShearRatio ?? 1.15;

    for (let row = FIELD_ROW_MIN; row <= FIELD_ROW_MAX; row++) {
      const sl = rowSlice[row];
      const baseShear = sl ? sl.shearCols : 0;
      const dispCols = sl ? sl.dispCols : 0.6;
      const eMod = sl ? sl.energyMod : 1.0;
      const microJitter = (rowRng() - 0.5) * 0.28 * (opts.shearScale ?? 1);
      const dxStruct = baseShear + microJitter;
      const dxCore = baseShear * coreShearRatio + microJitter * 0.5;
      const dxAtmo = baseShear * atmoShearRatio + microJitter * 1.1;

      const bandT = sl ? (row - sl.r0) / Math.max(1, sl.r1 - sl.r0) : 0.5;
      const topSheen = bandT < 0.18 ? 1.07 : 1.0 - bandT * 0.05;

      for (let col = 0; col < COLS; col++) {
        const cx = (col + 0.5) * PITCH;
        const cy = (row + 0.5) * PITCH;

        // 3x2 super-sample inside each 7x7 cell for silky-clean geometry edges
        let a = 0,
          s = 0,
          c = 0,
          sPos = 0,
          sNeg = 0;
        for (const oy of [-2.1, 0, 2.1]) {
          for (const ox of [-1.6, 1.6]) {
            const sy = cy + oy;
            a += sampleField(field, cx + ox - dxAtmo * PITCH, sy, 0);
            s += sampleField(field, cx + ox - dxStruct * PITCH, sy, 1);
            c += sampleField(field, cx + ox - dxCore * PITCH, sy, 2);
            // Chromatic / tonal edge dispersion taps along the horizontal strata axis
            sPos += sampleField(field, cx + ox - (dxStruct + dispCols) * PITCH, sy, 1);
            sNeg += sampleField(field, cx + ox - (dxStruct - dispCols) * PITCH, sy, 1);
          }
        }
        const inv6 = 1 / 6;
        const idx = row * COLS + col;
        const atmoV = a * inv6 * (0.94 + (eMod - 1) * 0.5);
        const structV = s * inv6 * eMod * topSheen;
        const coreV = c * inv6 * (0.96 + (eMod - 1) * 0.45);

        gridAtmo[idx] = clamp(atmoV, 0, 1.15);
        gridStruct[idx] = clamp(structV, 0, 1.15);
        gridCore[idx] = clamp(coreV, 0, 1.15);

        // Edge dispersion activates cleanly right along trailing/leading strata boundaries
        const edgeWarm = Math.max(0, sPos * inv6 - structV * 0.62);
        const edgeCool = Math.max(0, sNeg * inv6 - structV * 0.62);
        gridDispWarm[idx] = clamp(edgeWarm, 0, 1);
        gridDispCool[idx] = clamp(edgeCool, 0, 1);
      }
    }

    // 1D Horizontal Kinetic Echo Streak Pass (gives crisp tactile horizontal print-motion trails
    // while strictly preserving crisp horizontal strata cuts!)
    const streakMixStruct = opts.streakMixStruct ?? 0.24;
    const streakMixAtmo = opts.streakMixAtmo ?? 0.30;
    const streakMixCore = opts.streakMixCore ?? 0.16;
    const streakRng = mulberry32(model.seed ^ 0x6a09e667);
    const tmpA = new Float32Array(COLS);
    const tmpS = new Float32Array(COLS);
    const tmpC = new Float32Array(COLS);

    function applyRowStreak(arr, row, mixS, Lfwd, Lbwd, tmp) {
      const af = 1 - Math.exp(-1 / Math.max(0.45, Lfwd));
      const ab = 1 - Math.exp(-1 / Math.max(0.45, Lbwd));
      const off = row * COLS;
      let acc = arr[off];
      for (let c = 0; c < COLS; c++) {
        acc += (arr[off + c] - acc) * af;
        tmp[c] = acc;
      }
      acc = arr[off + COLS - 1];
      for (let c = COLS - 1; c >= 0; c--) {
        acc += (arr[off + c] - acc) * ab;
        const avg = 0.5 * (tmp[c] + acc);
        arr[off + c] = arr[off + c] * (1 - mixS) + avg * mixS;
      }
    }

    for (let row = FIELD_ROW_MIN; row <= FIELD_ROW_MAX; row++) {
      const sl = rowSlice[row];
      if (!sl) continue;
      const spike = streakRng() < 0.22 ? 1.45 + streakRng() * 0.85 : 0.7 + streakRng() * 0.55;
      const baseL = sl.streakCols * spike;
      const bias = sl.streakBias || 0;
      const Lfwd = baseL * (1 + bias);
      const Lbwd = baseL * (1 - bias);

      applyRowStreak(gridAtmo, row, streakMixAtmo, Lfwd * 1.15, Lbwd * 1.15, tmpA);
      applyRowStreak(gridStruct, row, streakMixStruct, Lfwd, Lbwd, tmpS);
      applyRowStreak(gridCore, row, streakMixCore, Lfwd * 0.72, Lbwd * 0.72, tmpC);
    }

    return { gridAtmo, gridStruct, gridCore, gridDispWarm, gridDispCool, slices, rowSlice, faultRows };
  }

  // =========================================================================
  // 4. ANCHORED VISUAL-EXPLANATION MICRO-CALLOUTS (GRID-SNAPPED + CLEAN KNOCKOUT)
  // =========================================================================
  function planAnchoredCallouts(ctx, callouts, palette, headlineSanctuary, faultRows) {
    const carvedCell = new Uint8Array(COLS * ROWS);
    const occupied = new Uint8Array(COLS * ROWS);
    const placed = [];

    const FONT_CORE = '700 9.0px "Commit Mono", monospace';
    const FONT_PART = '400 9.0px "Commit Mono", monospace';
    const FONT_WHISPER = '400 8.4px "Commit Mono", monospace';

    function isBoxFree(c0, r0, c1, r1) {
      if (c0 < 5 || c1 > COLS - 6 || r0 < FIELD_ROW_MIN + 1 || r1 > FIELD_ROW_MAX - 1) return false;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (occupied[r * COLS + c]) return false;
        }
      }
      return true;
    }

    function markOccupied(c0, r0, c1, r1) {
      for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) {
        for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++) {
          occupied[r * COLS + c] = 1;
        }
      }
    }

    // Reserve headline sanctuary so no callout ever touches the Newsreader headline or legend
    markOccupied(0, 0, headlineSanctuary.maxCol, headlineSanctuary.maxRow);

    for (const item of callouts || []) {
      const role = item.role || "part";
      const align = item.align || "left";
      const font = role === "core" ? FONT_CORE : role === "part" ? FONT_PART : FONT_WHISPER;
      ctx.font = font;

      const textW = ctx.measureText(item.text).width;
      const textSpan = Math.ceil(textW / PITCH);
      const hasMarker = role === "core" || role === "part";
      const markerCols = hasMarker ? 2 : 0; // 1 cell marker + crisp gap
      const totalSpan = textSpan + markerCols;

      let targetRow = clamp(Math.round(item.y / PITCH), FIELD_ROW_MIN + 2, FIELD_ROW_MAX - 2);
      // Step 1 row off a fault-line crease if it lands directly on one
      if (faultRows.has(targetRow)) {
        targetRow = targetRow + 1 <= FIELD_ROW_MAX - 2 ? targetRow + 1 : targetRow - 1;
      }

      let startCol = Math.round(item.x / PITCH);
      if (align === "right") {
        startCol = startCol - totalSpan;
      } else if (align === "center") {
        startCol = startCol - Math.floor(totalSpan * 0.5);
      }
      startCol = clamp(startCol, 6, COLS - totalSpan - 6);

      // Gentle vertical nudge search if a nearby label already claimed that row
      let chosenRow = -1;
      for (const dr of [0, -2, 2, -3, 3, -4, 4]) {
        const rr = targetRow + dr;
        if (isBoxFree(startCol - 2, rr - 1, startCol + totalSpan + 1, rr + 1)) {
          chosenRow = rr;
          break;
        }
      }
      if (chosenRow < 0) continue;

      markOccupied(startCol - 2, chosenRow - 1, startCol + totalSpan + 1, chosenRow + 1);

      // Carve clean knockout slot behind the callout (1-row normally; 3-row breathing window when inlaid inside a dense solid band)
      const carveA = Math.max(0, startCol - 1);
      const carveB = Math.min(COLS - 1, startCol + totalSpan);
      const rPad = item.inlaid ? 1 : 0;
      for (let rr = Math.max(FIELD_ROW_MIN, chosenRow - rPad); rr <= Math.min(FIELD_ROW_MAX, chosenRow + rPad); rr++) {
        for (let c = carveA; c <= carveB; c++) {
          carvedCell[rr * COLS + c] = 1;
        }
      }

      placed.push({
        text: item.text,
        role,
        align,
        font,
        col: startCol,
        row: chosenRow,
        textSpan,
        totalSpan,
        hasMarker,
      });
    }

    return { carvedCell, placed };
  }

  // =========================================================================
  // 5. VYO'S ORIGINAL DRAFTING-SHEET / PRINT-STUDIO EDITORIAL CHROME
  // =========================================================================
  function drawRegistrationPlus(ctx, x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.9;
    const arm = 4.2;
    ctx.beginPath();
    ctx.moveTo(x - arm, y);
    ctx.lineTo(x + arm, y);
    ctx.moveTo(x, y - arm);
    ctx.lineTo(x, y + arm);
    ctx.stroke();
    ctx.restore();
  }

  function drawVyoSheetChrome(ctx, model, palette) {
    const MARGIN = 40;
    const TOP_RULE_Y = 58;
    const BOT_RULE_Y = 1138;
    const sheet = model.sheet;

    // 1. Subtle 1px structural top & bottom hairline rules + crisp + registration ticks
    ctx.save();
    ctx.strokeStyle = rgba(palette.ink, palette.isDark ? 0.16 : 0.14);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN + 8, TOP_RULE_Y + 0.5);
    ctx.lineTo(W - MARGIN - 8, TOP_RULE_Y + 0.5);
    ctx.moveTo(MARGIN + 8, BOT_RULE_Y + 0.5);
    ctx.lineTo(W - MARGIN - 8, BOT_RULE_Y + 0.5);
    ctx.stroke();
    ctx.restore();

    const tickColor = rgba(palette.ink, palette.isDark ? 0.34 : 0.28);
    drawRegistrationPlus(ctx, MARGIN, TOP_RULE_Y + 0.5, tickColor);
    drawRegistrationPlus(ctx, W - MARGIN, TOP_RULE_Y + 0.5, tickColor);
    drawRegistrationPlus(ctx, MARGIN, BOT_RULE_Y + 0.5, tickColor);
    drawRegistrationPlus(ctx, W - MARGIN, BOT_RULE_Y + 0.5, tickColor);

    // 2. Top Micro-Index Bar (y = 33, Commit Mono 9.5px, wide tracking 0.08em)
    ctx.save();
    ctx.font = '400 9.5px "Commit Mono", monospace';
    ctx.fillStyle = palette.mutedInk;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    drawTrackedText(ctx, sheet.topLeft, MARGIN, 33, 0.72, "left");
    drawTrackedText(ctx, sheet.topRight, W - MARGIN, 33, 0.72, "right");
    ctx.restore();

    // 3. Signature Vyo Headline Block (Newsreader 50px regular + ● Commit Mono legend)
    ctx.save();
    const headX = MARGIN;
    const headY = 82;
    const headSize = 50;
    const lineH = 53;
    ctx.font = `400 ${headSize}px "Newsreader", Georgia, serif`;
    ctx.fillStyle = palette.ink;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    sheet.headline.forEach((line, i) => {
      drawTrackedText(ctx, line, headX, headY + i * lineH, -1.0, "left");
    });

    // Quiet Commit Mono legend line prefixed by crisp solid accent circle ●
    const legendY = headY + sheet.headline.length * lineH + 17;
    ctx.fillStyle = palette.coreBright;
    ctx.beginPath();
    ctx.arc(headX + 3.5, legendY + 5.2, 3.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '400 10.5px "Commit Mono", monospace';
    ctx.fillStyle = palette.mutedInk;
    ctx.textBaseline = "top";
    ctx.fillText(sheet.legendText, headX + 14, legendY);
    ctx.restore();

    // 4. Bottom Micro-Colophon (y = 1162, Commit Mono 9px, muted ink)
    ctx.save();
    ctx.font = '400 9.0px "Commit Mono", monospace';
    ctx.fillStyle = palette.mutedInk;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    drawTrackedText(ctx, sheet.bottomLeft, MARGIN, 1162, 0.50, "left");
    drawTrackedText(ctx, sheet.bottomRight, W - MARGIN, 1162, 0.50, "right");
    ctx.restore();
  }

  // =========================================================================
  // 6. MAIN ENTRYPOINT: RENDER VYO POSTER
  // =========================================================================
  window.renderVyoPoster = async function renderVyoPoster(canvas, model, scene, palette) {
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // Paint clean archival / sumi ground
    ctx.fillStyle = palette.ground;
    ctx.fillRect(0, 0, W, H);

    // 1. Rasterize the bespoke 3-layer agent SVG scene
    const field = await rasterizeThreeLayers(scene);

    // 2. Refract through real codebase horizontal strata slices
    const refractOpts = Object.assign(
      {
        shearScale: 0.92,
        dispScale: 0.95,
        streakScale: 0.88,
        streakMixStruct: 0.22,
        streakMixAtmo: 0.28,
        streakMixCore: 0.15,
        coreShearRatio: 0.58,
        atmoShearRatio: 1.15,
      },
      scene.refractOpts || {}
    );

    const { gridAtmo, gridStruct, gridCore, gridDispWarm, gridDispCool, slices, faultRows } =
      refractLayersToGrid(field, model, refractOpts);

    // Compute exact headline sanctuary rectangle so artwork never collides with Newsreader headline
    const sanctuary = scene.headlineSanctuary || {
      maxX: 615,
      maxY: 238,
      softX: 545,
      softY: 205,
    };
    const headlineSanctuaryCells = {
      maxCol: Math.ceil(sanctuary.maxX / PITCH),
      maxRow: Math.ceil(sanctuary.maxY / PITCH),
    };

    // 3. Plan anchored plain-language micro-callouts first so their 1-row slots carve cleanly!
    const { carvedCell, placed } = planAnchoredCallouts(
      ctx,
      scene.callouts,
      palette,
      headlineSanctuaryCells,
      faultRows
    );

    // 4. Quantize & draw the crisp 7px modular cell lattice (120 x 170)
    const isDark = Boolean(palette.isDark);
    let cellsDrawn = 0;

    for (let row = FIELD_ROW_MIN; row <= FIELD_ROW_MAX; row++) {
      const y0 = row * PITCH;
      const isFaultRow = faultRows.has(row);

      for (let col = 0; col < COLS; col++) {
        const cIdx = row * COLS + col;
        if (carvedCell[cIdx]) continue;

        const x0 = col * PITCH;
        const cx = x0 + PITCH * 0.5;
        const cy = y0 + PITCH * 0.5;

        // Crisp 1-row architectural fault-line cut across real codebase layer transitions
        // (leaves a subtle rhythmic break on ~84% of the row so tectonic layers read cleanly!)
        if (isFaultRow && col >= 4 && col <= COLS - 8) {
          continue;
        }

        // Smooth sanctuary protection around the top-left Newsreader headline & legend
        let gate = 1.0;
        if (cx < sanctuary.maxX + 28 && cy < sanctuary.maxY + 24) {
          const gx = smoothstep(sanctuary.softX, sanctuary.maxX + 24, cx);
          const gy = smoothstep(sanctuary.softY, sanctuary.maxY + 20, cy);
          gate = Math.max(gx, gy);
          if (cx < sanctuary.maxX && cy < sanctuary.maxY) gate = 0;
        }
        if (gate <= 0.01) continue;

        let vAtmo = gridAtmo[cIdx] * gate;
        let vStruct = gridStruct[cIdx] * gate;
        let vCore = gridCore[cIdx] * gate;
        const vWarm = gridDispWarm[cIdx] * gate;
        const vCool = gridDispCool[cIdx] * gate;

        const bayer = BAYER4[row & 3][col & 3] / 16 - 0.5;
        const jitter = (cellHash(col, row, model.seed, 31) - 0.5) * 0.08 + bayer * 0.095;

        let color = null;
        let size = 0;
        let rx = 0;

        // Priority: Core (vivid circular beads + specular knots) -> Structure (sharp squares) ->
        // Chromatic/tonal dispersion fringe -> Atmosphere (delicate small squares/dots)
        if (vCore + jitter * 0.55 > 0.24) {
          const t = clamp((vCore - 0.22) / 0.72, 0, 1);
          if (isDark && palette.specular && vCore + jitter * 0.35 > 0.84) {
            // Tight luminous specular highlight knot inside the glowing focal core!
            const st = clamp((vCore - 0.82) / 0.18, 0, 1);
            color = mixHex(palette.coreBright, palette.specular, 0.58 + st * 0.42);
            size = 5.45 + st * 0.55;
            rx = size * 0.45;
          } else {
            color = mixHex(palette.coreDeep, palette.coreBright, Math.pow(t, 0.78));
            size = 5.05 + t * 0.92;
            rx = size * 0.46; // unmistakable jewel-like circular bead!
          }
        } else if (vStruct + jitter * 0.65 > 0.22) {
          const t = clamp((vStruct - 0.20) / 0.76, 0, 1);
          if (t > 0.62) {
            color = mixHex(palette.structMid, palette.structHigh, (t - 0.62) / 0.38);
          } else {
            color = mixHex(palette.structLow, palette.structMid, t / 0.62);
          }
          size = 4.35 + t * 1.22;
          rx = 0.85; // crisp architectural square with subtle print-ink corner softening
        } else if (isDark && vWarm + jitter * 0.45 > 0.28) {
          // Subtle warm chromatic edge dispersion on dark grounds
          const t = clamp((vWarm - 0.24) / 0.55, 0, 1);
          color = mixHex(palette.atmoHigh, palette.coreDeep, 0.48 + t * 0.38);
          size = 3.2 + t * 1.3;
          rx = size * 0.36;
        } else if (isDark && vCool + jitter * 0.45 > 0.28) {
          // Subtle cool chromatic edge dispersion on dark grounds
          const t = clamp((vCool - 0.24) / 0.55, 0, 1);
          color = mixHex(palette.atmoHigh, palette.structHigh, 0.45 + t * 0.35);
          size = 3.1 + t * 1.3;
          rx = 0.75;
        } else if (vAtmo + jitter * 0.70 > 0.16) {
          const t = clamp((vAtmo - 0.14) / 0.72, 0, 1);
          color = mixHex(palette.atmoLow, palette.atmoHigh, t);
          size = 2.65 + t * 1.35; // delicate breathing atmosphere dots/squares (2.6-4.0px)
          rx = 0.55;
        }

        if (color && size > 0.5) {
          const pad = (PITCH - size) * 0.5;
          ctx.fillStyle = color;
          drawRoundedRect(ctx, x0 + pad, y0 + pad, size, size, rx);
          cellsDrawn++;
        }
      }
    }

    // 5. Draw Anchored Visual-Explanation Micro-Callouts (crisp Swiss/Japanese diagram notation)
    ctx.save();
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    for (const item of placed) {
      const baseY = (item.row + 0.78) * PITCH;
      const midY = (item.row + 0.50) * PITCH;
      let textX = item.col * PITCH;

      if (item.hasMarker) {
        const markerCenterX = (item.col + 0.5) * PITCH;
        if (item.role === "core") {
          // Crisp tiny solid accent bead ● immediately beside core explanation
          ctx.fillStyle = palette.coreBright;
          ctx.beginPath();
          ctx.arc(markerCenterX, midY, 2.25, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.role === "part") {
          // Crisp architectural horizontal micro-tick — beside part explanation
          ctx.fillStyle = palette.calloutTick;
          ctx.fillRect(markerCenterX - 3.0, midY - 0.55, 6.2, 1.15);
        }
        textX = (item.col + 1.55) * PITCH;
      }

      ctx.font = item.font;
      ctx.fillStyle =
        item.role === "core"
          ? palette.calloutCore
          : item.role === "part"
            ? palette.calloutPart
            : palette.calloutWhisper;
      ctx.fillText(item.text, textX, baseY);
    }
    ctx.restore();

    // 6. Draw Vyo's Own Original Drafting-Sheet Editorial Chrome
    drawVyoSheetChrome(ctx, model, palette);

    return {
      slices: slices.length,
      faultRows: faultRows.size,
      cellsDrawn,
      calloutsPlaced: placed.length,
      calloutsRequested: (scene.callouts || []).length,
    };
  };
})();

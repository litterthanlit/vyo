// Luminous Frame Browser Canvas Engine (vyo v3):
// Soft-lit agent-authored SVG -> Auto Dark/Light Normalization -> Real Codebase Strata Refraction
// -> 5 Signature Print Styles (obsidian, alabaster, optics, riso, contour) x 5 Curated Palettes
// -> Zone-Aware Micro-Type & Frameless Vyo Typography.
// Renders 840x1190 logical canvas at 2x DPR (1680x2380px).

(function () {
  "use strict";

  const W = 840;
  const H = 1190;
  const DPR = 2;
  const W2 = W * DPR;
  const H2 = H * DPR;
  const PITCH = 7;
  const COLS = Math.floor(W / PITCH); // 120
  const ROWS = Math.floor(H / PITCH); // 170

  const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  // =========================================================================
  // 0. CURATED GALLERY PALETTES (5 HARMONIOUS RESTRAINED PALETTES)
  // =========================================================================
  const PALETTES = {
    crimson: {
      mode: "dark",
      ground: "#090A0D",
      groundRgb: [9, 10, 13],
      contourGround: "#0C0D11",
      mist: [0x28 / 255, 0x33 / 255, 0x4e / 255],
      coolLo: [0x78 / 255, 0xae / 255, 0xe0 / 255],
      coolHi: [0xb8 / 255, 0xdd / 255, 0xf6 / 255],
      twilight: [0x7e / 255, 0x6c / 255, 0xc4 / 255],
      accent: [0xe5 / 255, 0x2d / 255, 0x38 / 255],
      accentHex: "#E52D38",
      accentHotHex: "#FF4D58",
      specular: [0xf4 / 255, 0xfa / 255, 0xff / 255],
      typoInk: "#FFFFFF",
      typoRepo: "#DCE4F0",
      typoMeta: "#7B8BA4",
      typoLegend: "#7F90AA",
      typoDot: "#E23848",
      microWhisper: "#C9D8EC",
      microPart: "#E4EEF9",
      microCore: "#F9DCE2",
    },
    pine: {
      mode: "dark",
      ground: "#0A1311",
      groundRgb: [10, 19, 17],
      contourGround: "#0B1412",
      mist: [0x20 / 255, 0x3e / 255, 0x38 / 255],
      coolLo: [0x68 / 255, 0xa8 / 255, 0x9a / 255],
      coolHi: [0xb8 / 255, 0xe3 / 255, 0xd8 / 255],
      twilight: [0x4d / 255, 0x7c / 255, 0x72 / 255],
      accent: [0xf2 / 255, 0x54 / 255, 0x2d / 255],
      accentHex: "#F2542D",
      accentHotHex: "#FF7852",
      specular: [0xff / 255, 0xf6 / 255, 0xee / 255],
      typoInk: "#F7FBF9",
      typoRepo: "#D4E8E2",
      typoMeta: "#73948B",
      typoLegend: "#7E9E95",
      typoDot: "#F2542D",
      microWhisper: "#B8D6CE",
      microPart: "#DCF0EA",
      microCore: "#FFE0D4",
    },
    abyss: {
      mode: "dark",
      ground: "#070C18",
      groundRgb: [7, 12, 24],
      contourGround: "#090E1B",
      mist: [0x1b / 255, 0x2a / 255, 0x4a / 255],
      coolLo: [0x7d / 255, 0x93 / 255, 0xb8 / 255],
      coolHi: [0xb8 / 255, 0xd6 / 255, 0xff / 255],
      twilight: [0x4d / 255, 0x5e / 255, 0x96 / 255],
      accent: [0x00 / 255, 0xc8 / 255, 0xff / 255],
      accentHex: "#00C8FF",
      accentHotHex: "#62E4FF",
      specular: [0xf0 / 255, 0xf8 / 255, 0xff / 255],
      typoInk: "#F6FAFF",
      typoRepo: "#D5E2F5",
      typoMeta: "#6F83A6",
      typoLegend: "#7B90B5",
      typoDot: "#00C8FF",
      microWhisper: "#BACCE8",
      microPart: "#DFEBFB",
      microCore: "#CEF4FF",
    },
    vermilion: {
      mode: "light",
      ground: "#F2F3F6",
      groundRgb: [242, 243, 246],
      risoGround: "#F6F3EB",
      risoGroundRgb: [246, 243, 235],
      contourGround: "#EFECE6",
      mist: [0xc8 / 255, 0xd4 / 255, 0xe0 / 255],
      mistHex: "#D4DFE8",
      mistMidHex: "#C2D0DD",
      structLightHex: "#7CA0B8",
      structMidHex: "#4B7996",
      structDeepHex: "#264761",
      risoMist: [134, 186, 206],
      risoStruct: [26, 66, 116],
      risoAccent: [238, 50, 38],
      accentHex: "#CC262F",
      accentDeepHex: "#B21B24",
      inkHex: "#111316",
      typoInk: "#111316",
      typoRepo: "#191E26",
      typoMeta: "#707F90",
      typoLegend: "#637486",
      typoDot: "#CC262F",
      microWhisper: "#222933",
      microPart: "#181E26",
      microCore: "#14181F",
    },
    cobalt: {
      mode: "light",
      ground: "#EFECE6",
      groundRgb: [239, 236, 230],
      risoGround: "#F4F1EA",
      risoGroundRgb: [244, 241, 234],
      contourGround: "#EFECE6",
      mist: [0xc7 / 255, 0xd0 / 255, 0xdc / 255],
      mistHex: "#D5DCE4",
      mistMidHex: "#C2CCD9",
      structLightHex: "#74859E",
      structMidHex: "#46566E",
      structDeepHex: "#1E2736",
      risoMist: [158, 178, 204],
      risoStruct: [32, 42, 62],
      risoAccent: [24, 78, 255],
      accentHex: "#1B4DFF",
      accentDeepHex: "#1438CC",
      inkHex: "#111316",
      typoInk: "#111316",
      typoRepo: "#181C24",
      typoMeta: "#6A7585",
      typoLegend: "#5D697A",
      typoDot: "#1B4DFF",
      microWhisper: "#242A33",
      microPart: "#181D25",
      microCore: "#11151C",
    },
  };

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

  function hash2Fast(x, y, seed = 0) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function makeValueNoise(seed) {
    const s = seed >>> 0;
    return function noise2(x, y) {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const u = xf * xf * (3 - 2 * xf);
      const v = yf * yf * (3 - 2 * yf);
      const a = hash2Fast(xi, yi, s);
      const b = hash2Fast(xi + 1, yi, s);
      const c = hash2Fast(xi, yi + 1, s);
      const d = hash2Fast(xi + 1, yi + 1, s);
      return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
    };
  }

  function smoothstep(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6)));
    return t * t * (3 - 2 * t);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
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

  function hexToRgb01(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function sampleField(field, fw, fh, fx, fy, ch) {
    if (fx < -2 || fy < -2 || fx > fw + 1 || fy > fh + 1) return 0;
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

  function sampleScalar(grid, gw, gh, fx, fy) {
    if (fx < -2 || fy < -2 || fx > gw + 1 || fy > gh + 1) return 0;
    const cx = clamp(fx, 0, gw - 1.001);
    const cy = clamp(fy, 0, gh - 1.001);
    const x0 = cx | 0;
    const y0 = cy | 0;
    const dx = cx - x0;
    const dy = cy - y0;
    const i00 = y0 * gw + x0;
    const i10 = i00 + 1;
    const i01 = i00 + gw;
    const i11 = i01 + 1;
    const top = grid[i00] + (grid[i10] - grid[i00]) * dx;
    const bot = grid[i01] + (grid[i11] - grid[i01]) * dx;
    return top + (bot - top) * dy;
  }

  function boxBlurGrid(src, w, h, rad) {
    const tmp = new Float32Array(w * h);
    const dst = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      let cnt = 0;
      const rowOff = y * w;
      for (let k = -rad; k <= rad; k++) {
        sum += src[rowOff + clamp(k, 0, w - 1)];
        cnt++;
      }
      tmp[rowOff] = sum / cnt;
      for (let x = 1; x < w; x++) {
        sum += src[rowOff + Math.min(w - 1, x + rad)] - src[rowOff + Math.max(0, x - rad - 1)];
        tmp[rowOff + x] = sum / cnt;
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let cnt = 0;
      for (let k = -rad; k <= rad; k++) {
        sum += tmp[clamp(k, 0, h - 1) * w + x];
        cnt++;
      }
      dst[x] = sum / cnt;
      for (let y = 1; y < h; y++) {
        sum += tmp[Math.min(h - 1, y + rad) * w + x] - tmp[Math.max(0, y - rad - 1) * w + x];
        dst[y * w + x] = sum / cnt;
      }
    }
    return dst;
  }

  function boxBlurRGB(buf, w, h, rad, passes) {
    const tmp = new Float32Array(buf.length);
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < h; y++) {
        for (let ch = 0; ch < 3; ch++) {
          let sum = 0;
          const cnt = rad * 2 + 1;
          for (let k = -rad; k <= rad; k++) sum += buf[(y * w + clamp(k, 0, w - 1)) * 3 + ch];
          tmp[(y * w) * 3 + ch] = sum / cnt;
          for (let x = 1; x < w; x++) {
            sum += buf[(y * w + Math.min(w - 1, x + rad)) * 3 + ch] - buf[(y * w + Math.max(0, x - rad - 1)) * 3 + ch];
            tmp[(y * w + x) * 3 + ch] = sum / cnt;
          }
        }
      }
      for (let x = 0; x < w; x++) {
        for (let ch = 0; ch < 3; ch++) {
          let sum = 0;
          const cnt = rad * 2 + 1;
          for (let k = -rad; k <= rad; k++) sum += tmp[(clamp(k, 0, h - 1) * w + x) * 3 + ch];
          buf[x * 3 + ch] = sum / cnt;
          for (let y = 1; y < h; y++) {
            sum += tmp[(Math.min(h - 1, y + rad) * w + x) * 3 + ch] - tmp[(Math.max(0, y - rad - 1) * w + x) * 3 + ch];
            buf[(y * w + x) * 3 + ch] = sum / cnt;
          }
        }
      }
    }
  }

  // =========================================================================
  // 1. NATIVE CHROMIUM SVG RASTERIZATION + AUTO DARK/LIGHT NORMALIZATION
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

  async function loadSvgImage(svgText) {
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
    return img;
  }

  async function rasterizeSvg(svgText, bgHex) {
    const img = await loadSvgImage(svgText);
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const octx = off.getContext("2d", { willReadFrequently: true });
    octx.fillStyle = bgHex;
    octx.fillRect(0, 0, W, H);
    octx.drawImage(img, 0, 0, W, H);
    return octx.getImageData(0, 0, W, H).data;
  }

  /**
   * Rasterize subject.svg transparently first to auto-detect dark-ground vs light-ground
   * authorship, then composite onto the matching native ground and extract normalized continuous
   * channels (intensity, accent, coolness, lum) so ONE SVG renders cleanly across all 5 styles.
   */
  async function rasterizeAndNormalizeSubject(svgText, fallbackDark) {
    const img = await loadSvgImage(svgText);
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const octx = off.getContext("2d", { willReadFrequently: true });
    octx.clearRect(0, 0, W, H);
    octx.drawImage(img, 0, 0, W, H);
    const raw = octx.getImageData(0, 0, W, H).data;

    // 1. Sample 4 outer corners + border frame for opaque background detection
    let borderOpaque = 0;
    let borderTotal = 0;
    let borderLumSum = 0;
    for (let y = 0; y < H; y += 6) {
      for (let x = 0; x < W; x += 6) {
        const isEdge = x < 18 || x >= W - 18 || y < 18 || y >= H - 18;
        if (!isEdge) continue;
        borderTotal++;
        const p = (y * W + x) * 4;
        if (raw[p + 3] > 128) {
          borderOpaque++;
          borderLumSum += (0.2126 * raw[p] + 0.7152 * raw[p + 1] + 0.0722 * raw[p + 2]) / 255;
        }
      }
    }

    let sourceIsDark = fallbackDark;
    if (borderOpaque >= Math.max(12, borderTotal * 0.18)) {
      sourceIsDark = borderLumSum / borderOpaque < 0.35;
    } else {
      // Transparent background SVG (no <rect> ground): inspect outer translucent fade stops & bright highlights
      let fringeCount = 0;
      let fringeLumSum = 0;
      let opqCount = 0;
      let opqLumSum = 0;
      let brightSpec = 0;
      for (let y = 0; y < H; y += 4) {
        for (let x = 0; x < W; x += 4) {
          const p = (y * W + x) * 4;
          const a = raw[p + 3];
          if (a < 10) continue;
          const lum = (0.2126 * raw[p] + 0.7152 * raw[p + 1] + 0.0722 * raw[p + 2]) / 255;
          if (a < 110) {
            fringeCount++;
            fringeLumSum += lum;
          } else {
            opqCount++;
            opqLumSum += lum;
            if (lum > 0.88) brightSpec++;
          }
        }
      }
      if (fringeCount >= 40) {
        sourceIsDark = fringeLumSum / fringeCount < 0.48;
      } else if (opqCount > 0) {
        sourceIsDark = brightSpec / opqCount > 0.12 || opqLumSum / opqCount > 0.52;
      }
    }

    // 2. Composite cleanly onto native ground (#000000 for dark-ground SVG, #FFFFFF for light-ground SVG)
    octx.clearRect(0, 0, W, H);
    octx.fillStyle = sourceIsDark ? "#000000" : "#FFFFFF";
    octx.fillRect(0, 0, W, H);
    octx.drawImage(img, 0, 0, W, H);
    const rgba = octx.getImageData(0, 0, W, H).data;

    // 3. Extract continuous normalized channels (0..1)
    const intensity = new Float32Array(W * H);
    const accent = new Float32Array(W * H);
    const coolness = new Float32Array(W * H);
    const lumArr = new Float32Array(W * H);

    for (let i = 0; i < W * H; i++) {
      const p = i * 4;
      const r = rgba[p] / 255;
      const g = rgba[p + 1] / 255;
      const b = rgba[p + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lumArr[i] = lum;

      if (sourceIsDark) {
        const maxC = Math.max(r, g, b);
        intensity[i] = clamp(Math.max(lum, maxC * 0.74), 0, 1);
        accent[i] = clamp((r - Math.max(g, b) * 0.82) * 1.5, 0, 1);
        coolness[i] = clamp((b + 0.5 * g - r) * 0.9, 0, 1);
      } else {
        const minC = Math.min(r, g, b);
        intensity[i] = clamp(1 - minC, 0, 1);
        accent[i] = clamp((r - Math.max(g, b)) * 1.65, 0, 1);
        coolness[i] = clamp((b - r) * 1.2, 0, 1);
      }
    }

    return { sourceIsDark, rgba, intensity, accent, coolness, lum: lumArr };
  }

  // =========================================================================
  // 2. TONAL RICHNESS + AUTO-DERIVED SPATIAL REFRACT MASK
  // =========================================================================
  function measureTonalRichness(norm) {
    const bins = new Int32Array(10);
    let litPixels = 0;
    let midTonePixels = 0;
    const { rgba, sourceIsDark } = norm;

    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const p = (y * W + x) * 4;
        const r = rgba[p] / 255;
        const g = rgba[p + 1] / 255;
        const b = rgba[p + 2] / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const val = sourceIsDark ? lum : 1 - lum;
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

  function buildRefractMask(norm, maskRgba, strength) {
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

    // Auto-derive smooth spatial preserveMask from normalized intensity gradient + peak brightness/accent prominence.
    const cellSig = new Float32Array(COLS * ROWS);
    const cellWarm = new Float32Array(COLS * ROWS);
    const { intensity, accent } = norm;
    const inv = 1 / (PITCH * PITCH);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        let sigSum = 0;
        let warmSum = 0;
        for (let dy = 0; dy < PITCH; dy++) {
          const y = row * PITCH + dy;
          const rowOff = y * W;
          for (let dx = 0; dx < PITCH; dx++) {
            const i = rowOff + col * PITCH + dx;
            sigSum += intensity[i];
            warmSum += accent[i];
          }
        }
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
        const preserve = clamp(smooth2[idx] * (1 - 0.58 * lowerCascade), 0, 0.85);
        shearMask[idx] = clamp((1 - preserve) * s, 0.14 * s, 1.15 * s);
      }
    }
    return shearMask;
  }

  // =========================================================================
  // 3. CONTINUOUS OPTICAL FIELD EXTRACTION (DARK + LIGHT + PALETTE-MAPPED)
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

  function extractDarkField(norm, strata, palName) {
    const hdr = new Float32Array(W * H * 3);
    const eSmooth = buildRowEnergy(strata);
    const pal = PALETTES[palName] || PALETTES.crimson;
    const preserveNativeDark = norm.sourceIsDark && palName === "crimson";

    if (preserveNativeDark) {
      const { rgba } = norm;
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
            const coolMid = smoothstep(0.04, 0.45, lum) * (1 - smoothstep(0.65, 0.95, lum));
            hb += coolMid * 0.08 * rowGain;
          }

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

    // Palette-mapped HDR light-field (works for pine/abyss on ANY SVG, or crimson on light-ground SVGs)
    const { intensity, accent, coolness } = norm;
    const [mR, mG, mB] = pal.mist;
    const [cLoR, cLoG, cLoB] = pal.coolLo;
    const [cHiR, cHiG, cHiB] = pal.coolHi;
    const [twR, twG, twB] = pal.twilight;
    const [aR, aG, aB] = pal.accent;
    const [spR, spG, spB] = pal.specular;

    for (let y = 0; y < H; y++) {
      const v = y / H;
      const rowGain = 0.90 + 0.18 * clamp(eSmooth[y], 0.3, 1.4);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const inten = intensity[i];
        const acc = accent[i];
        if (inten < 0.008 && acc < 0.015) continue;

        const cool = coolness[i];
        const twMix = clamp(smoothstep(0.42, 0.88, v) * 0.46 + (1 - cool) * 0.25, 0, 0.62);
        const hiT = smoothstep(0.32, 0.86, inten);

        let cr = lerp(lerp(mR, cLoR, smoothstep(0.05, 0.55, inten)), cHiR, hiT);
        let cg = lerp(lerp(mG, cLoG, smoothstep(0.05, 0.55, inten)), cHiG, hiT);
        let cb = lerp(lerp(mB, cLoB, smoothstep(0.05, 0.55, inten)), cHiB, hiT);

        cr = lerp(cr, twR, twMix * (1 - hiT * 0.55));
        cg = lerp(cg, twG, twMix * (1 - hiT * 0.55));
        cb = lerp(cb, twB, twMix * (1 - hiT * 0.55));

        const accW = smoothstep(0.16, 0.78, acc);
        if (accW > 0.001) {
          cr = lerp(cr, aR * 1.25, accW);
          cg = lerp(cg, aG * 1.15, accW);
          cb = lerp(cb, aB * 1.15, accW);
        }

        const specW = smoothstep(0.76, 0.97, inten) * (1 - accW * 0.85);
        if (specW > 0.001) {
          cr = lerp(cr, spR * 1.45, specW);
          cg = lerp(cg, spG * 1.45, specW);
          cb = lerp(cb, spB * 1.45, specW);
        }

        const amp = (0.35 + 1.42 * Math.pow(inten, 1.08)) * rowGain;
        const outIdx = i * 3;
        hdr[outIdx] = cr * amp;
        hdr[outIdx + 1] = cg * amp;
        hdr[outIdx + 2] = cb * amp;
      }
    }
    return hdr;
  }

  function extractLightField(norm, strata) {
    const dayField = new Float32Array(W * H * 3);
    const eSmooth = buildRowEnergy(strata);
    const { sourceIsDark, rgba, intensity, accent } = norm;

    for (let y = 0; y < H; y++) {
      const rowGain = 0.90 + 0.18 * clamp(eSmooth[y], 0.3, 1.4);
      const rowOff = y * W;
      for (let x = 0; x < W; x++) {
        const i = rowOff + x;
        const inten = intensity[i];
        const acc = accent[i];
        if (inten < 0.01 && acc < 0.01) continue;

        let vAccent, vStruct, vMist;
        if (!sourceIsDark) {
          const p = i * 4;
          const r = rgba[p] / 255;
          const g = rgba[p + 1] / 255;
          const b = rgba[p + 2] / 255;
          const lumInk = 1 - (0.2126 * r + 0.7152 * g + 0.0722 * b);
          vAccent = clamp(acc * (0.55 + 0.78 * inten) * rowGain, 0, 1.35);
          vStruct = clamp((lumInk * 1.18 - acc * 0.62) * rowGain, 0, 1.30);
          vMist = clamp(Math.pow(Math.max(lumInk, inten * 0.85), 0.78) * 1.15, 0, 1.25);
        } else {
          // Dark-ground luminous SVG cleanly translated into daylight ink channels:
          // glowing highlights -> deep mineral structure ink; crimson glow -> crisp vermilion/cobalt;
          // pitch black background & carved shadow valleys -> clean open paper!
          vAccent = clamp(acc * (0.52 + 0.84 * inten) * rowGain, 0, 1.38);
          vStruct = clamp((Math.pow(inten, 0.86) * 1.14 - acc * 0.82) * rowGain, 0, 1.30);
          vMist = clamp(Math.pow(inten, 0.68) * 1.14, 0, 1.25);
        }

        const outIdx = i * 3;
        dayField[outIdx] = vAccent;
        dayField[outIdx + 1] = vStruct;
        dayField[outIdx + 2] = vMist;
      }
    }
    return dayField;
  }

  // =========================================================================
  // 4. REAL CODEBASE HORIZONTAL STRATA SLICE SCHEDULES (GRID & FULL PIXEL)
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

  function buildPixelSlices(strata, seed, opts = {}) {
    const shearScale = opts.shearScale ?? 1.0;
    const dispScale = opts.dispScale ?? 1.0;
    const streakScale = opts.streakScale ?? 1.0;
    const slices = [];
    const rng = mulberry32((seed ^ 0x3c6ef372) >>> 0);

    const upper = [];
    const lower = [];
    for (const s of strata.slices || []) {
      if (s.midV < 0.50) upper.push(s);
      else lower.push(s);
    }

    for (let i = 0; i < upper.length; i++) {
      const s = upper[i];
      const yStart = Math.floor(s.y0 * H);
      const yEnd = Math.max(yStart + 2, Math.floor(s.y1 * H));
      const totalH = Math.max(2, yEnd - yStart);
      const sub = s.subSlices || 1;
      let curY = yStart;

      for (let k = 0; k < sub; k++) {
        const frac = k === sub - 1 ? 1 : (0.55 + rng() * 0.9) / sub;
        const nextY = k === sub - 1 ? yEnd : Math.min(yEnd, curY + Math.max(5, Math.round(totalH * frac)));
        if (nextY <= curY) continue;

        const sliceMidV = (0.5 * (curY + nextY)) / H;
        const transT = smoothstep(0.41, 0.52, sliceMidV);
        const subSign = k % 2 === 0 ? 1 : -1;

        const shearPx = (s.shearX * W * (0.72 + 0.52 * rng()) + subSign * (6 + s.crossNorm * 22)) * shearScale;
        const dispPx = (2.2 + s.disp * 0.92) * (0.85 + 0.45 * rng()) * dispScale;
        const dySample = (rng() - 0.5) * 9.5 * (0.45 + s.crossNorm) * shearScale;

        const blockCount = s.isAccent || s.crossNorm > 0.25 ? 2 + ((s.seed + k) % 3) : 1;
        const blocks = [];
        let bx = 0.25 + rng() * 0.14;
        for (let b = 0; b < blockCount; b++) {
          const bw = 0.07 + rng() * 0.17;
          blocks.push({
            u0: bx,
            u1: Math.min(0.98, bx + bw),
            dx: (rng() - 0.5) * (16 + s.crossNorm * 46) * shearScale * (1 - 0.35 * transT),
            dy: (rng() - 0.5) * (8 + s.crossNorm * 16) * shearScale * (1 - 0.4 * transT),
            boost: 0.84 + rng() * 0.36,
          });
          bx += bw * (0.72 + rng() * 0.52);
        }

        slices.push({
          y0: curY,
          y1: nextY,
          isUpper: true,
          transT,
          isAccent: s.isAccent,
          crossNorm: s.crossNorm,
          locNorm: s.locNorm,
          shearPx,
          dispPx,
          dySample,
          energyBoost: 0.92 + (s.isAccent ? 0.14 : 0) + (rng() - 0.5) * 0.18,
          ribStrength: (0.09 + s.crossNorm * 0.12 + (s.isAccent ? 0.05 : 0)) * (1 - 0.4 * transT),
          streakPx: ((3.8 + rng() * 8.0) * (1 - transT) + (16 + rng() * 14) * transT) * streakScale,
          streakBias: (rng() - 0.5) * 0.5,
          blocks,
          seed: (s.seed ^ (k * 2654435761)) >>> 0,
        });
        curY = nextY;
      }
    }

    const totalLowerLoc = lower.reduce((acc, s) => acc + s.loc, 0);
    const targetPanes = clamp(Math.round(6 + lower.length * 0.08), 7, 9);
    const locThreshold = totalLowerLoc / Math.max(1, targetPanes);

    let paneIdx = 0;
    let paneLoc = 0;
    let paneDir = -1;
    let paneShear = -0.026 * W * shearScale;
    let paneDisp = 6.5 * dispScale;
    let paneTone = 1.06;
    let prevArea = lower[0]?.area;

    for (let i = 0; i < lower.length; i++) {
      const s = lower[i];
      const areaChanged = s.area !== prevArea && paneLoc > locThreshold * 0.42;
      if (paneLoc >= locThreshold || areaChanged) {
        paneIdx++;
        paneLoc = 0;
        paneDir = paneIdx % 2 === 0 ? 1 : -1;
        const mag = 0.022 + s.crossNorm * 0.062 + 0.032 * rng();
        paneShear = paneDir * mag * W * shearScale;
        paneDisp = (4.8 + s.crossNorm * 9.5 + rng() * 4.5) * dispScale;
        paneTone = paneIdx % 3 === 1 ? 0.78 + rng() * 0.16 : 0.96 + rng() * 0.24;
        prevArea = s.area;
      }
      paneLoc += s.loc;

      const yStart = Math.floor(s.y0 * H);
      const yEnd = i === lower.length - 1 ? H : Math.floor(s.y1 * H);
      if (yEnd <= yStart) continue;

      slices.push({
        y0: yStart,
        y1: yEnd,
        isUpper: false,
        transT: 1,
        isAccent: s.isAccent,
        crossNorm: s.crossNorm,
        locNorm: s.locNorm,
        paneIdx,
        shearPx: paneShear + s.shearX * W * 0.16 * shearScale,
        dispPx: paneDisp + s.disp * 0.28 * dispScale,
        dySample: ((paneIdx % 3) - 1) * 4.5 * shearScale,
        energyBoost: paneTone * (0.94 + s.locNorm * 0.12),
        ribStrength: 0.04 + s.crossNorm * 0.04,
        streakPx: (18 + rng() * 28 + (s.y0 - 0.5) * 20) * streakScale,
        streakBias: paneDir * 0.34,
        blocks: null,
        seed: s.seed,
      });
    }

    const rowSlice = new Array(H);
    for (const sl of slices) {
      const a = clamp(sl.y0, 0, H);
      const b = clamp(sl.y1, 0, H);
      for (let y = a; y < b; y++) rowSlice[y] = sl;
    }
    return { slices, rowSlice };
  }

  function refractFieldToGrid(field, accentField, strata, seed, shearMask, opts = {}) {
    const { slices, rowSlice } = buildGridSlices(strata, seed, opts);
    const gridRGB = new Float32Array(COLS * ROWS * 3);
    const gridAcc = new Float32Array(COLS * ROWS);
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
          gridAcc[row * COLS + col] = sampleScalar(accentField, W, H, fx, fyBase);
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

        let r = 0, g = 0, b = 0, aSum = 0;
        for (const oy of [-0.26, 0, 0.26]) {
          const sy = fy + oy * (H / ROWS);
          r += sampleField(field, W, H, fx - dispR * stepX, sy, 0);
          g += sampleField(field, W, H, fx - dispG * stepX, sy, 1);
          b += sampleField(field, W, H, fx - dispB * stepX, sy, 2);
          aSum += sampleScalar(accentField, W, H, fx, sy);
        }
        const inv3 = bBoost / 3;
        const idx = (row * COLS + col) * 3;
        gridRGB[idx] = r * inv3;
        gridRGB[idx + 1] = g * inv3;
        gridRGB[idx + 2] = b * inv3;
        gridAcc[row * COLS + col] = aSum / 3;
      }
    }

    // 1D Horizontal Cell-Row Motion-Streak Pass
    const streakRng = mulberry32((seed ^ 0x6a09e667) >>> 0);
    const rowTmp = new Float32Array(COLS * 3);
    const accTmp = new Float32Array(COLS);
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
      const aOff = row * COLS;
      let ar = gridRGB[off], ag = gridRGB[off + 1], abC = gridRGB[off + 2], aa = gridAcc[aOff];
      for (let c = 0; c < COLS; c++) {
        const i = off + c * 3;
        ar += (gridRGB[i] - ar) * af;
        ag += (gridRGB[i + 1] - ag) * af;
        abC += (gridRGB[i + 2] - abC) * af;
        aa += (gridAcc[aOff + c] - aa) * af;
        rowTmp[c * 3] = ar;
        rowTmp[c * 3 + 1] = ag;
        rowTmp[c * 3 + 2] = abC;
        accTmp[c] = aa;
      }

      ar = gridRGB[off + (COLS - 1) * 3];
      ag = gridRGB[off + (COLS - 1) * 3 + 1];
      abC = gridRGB[off + (COLS - 1) * 3 + 2];
      aa = gridAcc[aOff + COLS - 1];
      for (let c = COLS - 1; c >= 0; c--) {
        const i = off + c * 3;
        ar += (gridRGB[i] - ar) * ab;
        ag += (gridRGB[i + 1] - ag) * ab;
        abC += (gridRGB[i + 2] - abC) * ab;
        aa += (gridAcc[aOff + c] - aa) * ab;
        const sr = 0.5 * (rowTmp[c * 3] + ar);
        const sg = 0.5 * (rowTmp[c * 3 + 1] + ag);
        const sb = 0.5 * (rowTmp[c * 3 + 2] + abC);
        const sa = 0.5 * (accTmp[c] + aa);
        const rMask = shearMask ? shearMask[row * COLS + c] : 1.0;
        const mixS = clamp(mixRowBase * clamp(rMask, 0.25, 1.15), 0.04, 0.65);
        const mixO = 1 - mixS;
        gridRGB[i] = gridRGB[i] * mixO + sr * mixS;
        gridRGB[i + 1] = gridRGB[i + 1] * mixO + sg * mixS;
        gridRGB[i + 2] = gridRGB[i + 2] * mixO + sb * mixS;
        gridAcc[aOff + c] = gridAcc[aOff + c] * mixO + sa * mixS;
      }
    }

    return { gridRGB, gridAcc, slices, rowSlice };
  }

  // =========================================================================
  // 5. TYPOGRAPHY SANCTUARY RESOLUTION & FRAMELESS VYO TYPOGRAPHY
  // =========================================================================
  function resolveSanctuary(cfg, sourceIsDark) {
    const custom = cfg.subject && cfg.subject.sanctuary;
    if (custom && Number.isFinite(custom.x) && Number.isFinite(custom.y) && Number.isFinite(custom.w) && Number.isFinite(custom.h)) {
      return {
        mode: "custom",
        custom: true,
        x: custom.x,
        y: custom.y,
        w: custom.w,
        h: custom.h,
        typoX: custom.x + 12,
        typoY: custom.y + 12,
        maxWidth: Math.max(200, custom.w - 24),
        headlineSize: custom.headlineSize || (!sourceIsDark ? 42 : 41),
        blockCols: [Math.max(0, Math.floor((custom.x - 14) / PITCH)), Math.min(COLS - 1, Math.ceil((custom.x + custom.w + 14) / PITCH))],
        blockRows: [Math.max(0, Math.floor((custom.y - 14) / PITCH)), Math.min(ROWS - 1, Math.ceil((custom.y + custom.h + 14) / PITCH))],
      };
    }

    // Match the SVG's authored sanctuary pocket so one SVG renders cleanly in all 5 styles!
    if (!sourceIsDark) {
      return {
        mode: "top-left",
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
      mode: "left-mid",
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

  /** Smooth attenuation multiplier in [0, 1] (0 inside sanctuary, 1 outside). */
  function sanctuaryKeepAt(u, v, sanctuary, typo, featherScale = 1.0) {
    if (sanctuary.mode === "top-left") {
      const sUMax = Math.max((sanctuary.xMax ?? 520) / W, (typo.box.right + 16) / W);
      const sVMax = Math.max((sanctuary.yMax ?? 230) / H, (typo.box.bottom + 16) / H);
      const fU = 0.055 * featherScale;
      const fV = 0.042 * featherScale;
      const inX = 1 - smoothstep(sUMax, sUMax + fU, u);
      const inY = 1 - smoothstep(sVMax, sVMax + fV, v);
      return 1 - inX * inY * 0.998;
    }

    const sUMin = sanctuary.custom ? sanctuary.x / W : 0;
    const sUMax = sanctuary.custom
      ? (sanctuary.x + sanctuary.w) / W
      : Math.max(sanctuary.uMax ?? 0.46, (typo.box.right + 18) / W);
    const sVMin = sanctuary.custom
      ? sanctuary.y / H
      : Math.min(sanctuary.vMin ?? 0.33, (typo.box.top - 18) / H);
    const sVMax = sanctuary.custom
      ? (sanctuary.y + sanctuary.h) / H
      : Math.max(sanctuary.vMax ?? 0.63, (typo.box.bottom + 18) / H);
    const fU = 0.065 * featherScale;
    const fV = 0.05 * featherScale;

    let keep = 1.0;
    const bandV = smoothstep(sVMin - fV, sVMin, v) * (1 - smoothstep(sVMax, sVMax + fV, v));
    if (bandV > 0.001 && u >= sUMin - fU && u < sUMax + fU) {
      const leftIn = sanctuary.custom ? smoothstep(sUMin - fU, sUMin, u) : 1;
      const rightIn = 1 - smoothstep(sUMax, sUMax + fU, u);
      keep *= 1 - leftIn * rightIn * bandV * 0.998;
    }
    if (!sanctuary.custom && v > (sanctuary.strictVStart ?? 0.36) && u < 0.44) {
      const lowerKeep = smoothstep(sanctuary.strictLeftCut ?? 0.26, 0.44, u);
      keep *= 0.03 + 0.97 * lowerKeep;
    }
    return keep;
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

  function drawVyoFramelessTypography(ctx, typo, pal) {
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // 1. Quiet Commit Mono 10px header with single focal accent square
    ctx.fillStyle = pal.typoDot;
    drawRoundedRect(ctx, typo.x, typo.tagY + 1.5, 5.5, 5.5, 1.35);

    ctx.font = '700 10px "Commit Mono", monospace';
    ctx.fillStyle = pal.typoRepo;
    const repoX = typo.x + 11.5;
    ctx.fillText(typo.repoName, repoX, typo.tagY);

    ctx.font = '400 10px "Commit Mono", monospace';
    ctx.fillStyle = pal.typoMeta;
    ctx.fillText(`  /  ${typo.metaStats}`, repoX + typo.repoW, typo.tagY);

    // 2. Calm sentence-case Inter Display 600 headline
    ctx.font = `600 ${typo.headlineSize}px "Inter Display", "Inter", sans-serif`;
    ctx.fillStyle = pal.typoInk;
    for (let i = 0; i < typo.headLines.length; i++) {
      drawTrackedText(ctx, typo.headLines[i], typo.x, typo.headY + i * typo.lineHeight, typo.tracking, 0.72);
    }

    // 3. Quiet Commit Mono 11px legend beneath
    ctx.font = '400 11px "Commit Mono", monospace';
    ctx.fillStyle = pal.typoLegend;
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

  /**
   * Shared zone-aware micro-type placement solver on the 120x170 cell lattice for continuous/vector
   * styles (`optics`, `riso`, `contour`). Returns placed phrases `{ str, col, row, span, style, font, fill }`.
   */
  function placeMicroTypeOnField(ctx, cfg, sanctuary, typo, pal, activeGrid, accentGrid, glareGrid) {
    const textBlocked = new Uint8Array(COLS * ROWS);
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
      Math.floor((typo.box.left - 16) / PITCH),
      Math.floor((typo.box.top - 16) / PITCH),
      Math.ceil((typo.box.right + 16) / PITCH),
      Math.ceil((typo.box.bottom + 16) / PITCH)
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

    function countActiveAround(c, r, rad) {
      let n = 0;
      for (let dr = -rad; dr <= rad; dr++) {
        const rr = r + dr;
        if (rr < 0 || rr >= ROWS) continue;
        for (let dc = -rad; dc <= rad; dc++) {
          const cc = c + dc;
          if (cc < 0 || cc >= COLS) continue;
          if (activeGrid[rr * COLS + cc] > 0.14) n++;
        }
      }
      return n;
    }

    const FONTS = {
      whisper: { font: '400 8.6px "Commit Mono", monospace', fill: pal.microWhisper },
      part: { font: '400 8.7px "Commit Mono", monospace', fill: pal.microPart },
      core: { font: '700 8.6px "Commit Mono", monospace', fill: pal.microCore },
    };

    const microList = cfg.microType || [];
    for (let i = 0; i < microList.length; i++) {
      const item = microList[i];
      const style = normalizeMicroStyle(item.style);
      const st = FONTS[style];
      ctx.font = st.font;
      const span = Math.ceil(ctx.measureText(item.text).width / PITCH);
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

            const distNorm = Math.hypot((c - targetC) / Math.max(1, radC), (r - targetR) / Math.max(1, radR));
            if (distNorm > 1.25) continue;

            let actSum = 0, accSum = 0, glareSum = 0;
            for (let dc = 0; dc < span; dc++) {
              const ci = r * COLS + c + dc;
              actSum += activeGrid[ci];
              accSum += accentGrid[ci];
              glareSum += glareGrid[ci];
            }
            const avgAct = actSum / Math.max(1, span);
            const avgAcc = accSum / Math.max(1, span);
            const avgGlare = glareSum / Math.max(1, span);

            if (pass === 0 && avgGlare > 0.42) continue;

            const nearAct = countActiveAround(c + Math.floor(span * 0.5), r, 3);
            let score = -distNorm * 1.45 - avgGlare * 1.35 + (cellHash(c, r, cfg.seed, 41 + i) - 0.5) * 0.20;

            if (style === "whisper") {
              if (pass === 0 && (avgAct > 0.36 || nearAct < 2)) continue;
              score += (1 - avgAct) * 0.65;
            } else if (style === "core") {
              if (pass === 0 && nearAct < 5) continue;
              score += Math.min(1.1, avgAcc * 1.6) + (0.45 - Math.abs(avgAct - 0.32));
            } else {
              if (pass === 0 && nearAct < 4) continue;
              score += (0.42 - Math.abs(avgAct - 0.28)) * 0.85;
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
        placedTexts.push({ str: item.text, col: best.c, row: best.r, span, style, font: st.font, fill: st.fill });
      }
    }
    return placedTexts;
  }

  // =========================================================================
  // 6. STYLE 1: OBSIDIAN 7px LUMINOUS MOSAIC RENDERER
  // =========================================================================
  function renderObsidianMosaic(ctx, gridRGB, gridAcc, cfg, sanctuary, typo, palName) {
    const pal = PALETTES[palName] || PALETTES.crimson;
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, 0, W, H);

    const cellKind = new Uint8Array(COLS * ROWS);
    const cellLum = new Float32Array(COLS * ROWS);
    const cellSize = new Float32Array(COLS * ROWS);
    const cellRx = new Float32Array(COLS * ROWS);
    const cellColor = new Array(COLS * ROWS);

    const isCrimsonNative = palName === "crimson";
    const [aR, aG, aB] = pal.accent;
    const specLumThresh = 0.86;
    const specMinThresh = 0.69;

    for (let row = 0; row < ROWS; row++) {
      const v = (row + 0.5) / ROWS;
      for (let col = 0; col < COLS; col++) {
        const u = (col + 0.5) / COLS;
        const cIdx = row * COLS + col;
        const idx = cIdx * 3;
        const keep = sanctuaryKeepAt(u, v, sanctuary, typo, 1.0);
        const r = gridRGB[idx] * keep;
        const g = gridRGB[idx + 1] * keep;
        const b = gridRGB[idx + 2] * keep;

        const mr = toneMap(r);
        const mg = toneMap(g);
        const mb = toneMap(b);
        const lum = 0.26 * mr + 0.58 * mg + 0.16 * mb;
        cellLum[cIdx] = lum;

        const bayer = BAYER4[row & 3][col & 3] / 16 - 0.5;
        const jitter = (cellHash(col, row, cfg.seed, 19) - 0.5) * 0.048 + bayer * 0.042;
        const thresh = 0.072 + jitter;

        if (lum < thresh && Math.max(mr, mg, mb) < 0.128 + jitter) {
          cellKind[cIdx] = 0;
          continue;
        }

        const crimDom = mr - Math.max(mg, mb) * 1.05;
        const accSig = gridAcc[cIdx] * keep;
        const specMin = Math.min(mr, mg, mb);
        const isAccentCell = isCrimsonNative ? (crimDom > 0.16 && mr > 0.27) : (accSig > 0.30 && Math.max(mr, mg, mb) > 0.24);

        if (lum > specLumThresh && specMin > specMinThresh && !isAccentCell) {
          cellKind[cIdx] = 4;
          const t = clamp((lum - specLumThresh) / (1 - specLumThresh), 0, 1);
          const cr = lerp(pal.specular[0] * 0.90, 1.0, t);
          const cg = lerp(pal.specular[1] * 0.93, 1.0, t);
          const cb = lerp(pal.specular[2] * 0.96, 1.0, t);
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 5.2 + t * 0.6;
          cellRx[cIdx] = cellSize[cIdx] * 0.36;
        } else if (isAccentCell) {
          cellKind[cIdx] = 3;
          if (isCrimsonNative) {
            const heat = clamp((mr - 0.25) / 0.66, 0, 1);
            const cr = 0.74 + heat * 0.23;
            const cg = 0.11 + heat * 0.16 + Math.max(0, mg - 0.22) * 0.34;
            const cb = 0.16 + heat * 0.13 + Math.max(0, mb - 0.22) * 0.38;
            cellColor[cIdx] = rgbHex(cr, cg, cb);
            cellSize[cIdx] = 4.35 + heat * 1.40;
          } else {
            const heat = clamp((Math.max(mr, mg, mb) - 0.22) / 0.68, 0, 1);
            const cr = clamp(aR * (0.76 + heat * 0.32) + heat * 0.08, 0, 1);
            const cg = clamp(aG * (0.76 + heat * 0.32) + heat * 0.08, 0, 1);
            const cb = clamp(aB * (0.76 + heat * 0.32) + heat * 0.08, 0, 1);
            cellColor[cIdx] = rgbHex(cr, cg, cb);
            cellSize[cIdx] = 4.35 + heat * 1.40;
          }
          cellRx[cIdx] = cellSize[cIdx] * 0.46;
        } else if (lum < 0.26 && Math.max(mr, mg, mb) < 0.38) {
          cellKind[cIdx] = 1;
          const t = clamp((Math.max(lum, Math.max(mr, mg, mb) * 0.65) - 0.06) / 0.24, 0, 1);
          const cr = clamp(pal.mist[0] * 0.85 + mr * 0.70, 0.12, 0.56);
          const cg = clamp(pal.mist[1] * 0.85 + mg * 0.70, 0.15, 0.58);
          const cb = clamp(pal.mist[2] * 0.90 + mb * 0.74, 0.22, 0.72);
          cellColor[cIdx] = rgbHex(cr, cg, cb);
          cellSize[cIdx] = 2.55 + t * 1.65;
          cellRx[cIdx] = 0.6;
        } else {
          cellKind[cIdx] = 2;
          const t = clamp((lum - 0.22) / 0.64, 0, 1);
          const safeG = isCrimsonNative && mg > Math.max(mr, mb) * 1.12
            ? Math.max(mr, mb) * 1.04 + (mg - Math.max(mr, mb)) * 0.25
            : mg;
          const hiLift = smoothstep(0.62, 0.88, lum);
          const cr = clamp(mr * (0.90 - 0.14 * hiLift) + 0.06 + hiLift * 0.10, 0.16, 0.86);
          const cg = clamp(safeG * (0.92 - 0.06 * hiLift) + 0.06 + hiLift * 0.12, 0.20, 0.92);
          const cb = clamp(mb * 1.0 + 0.09 + hiLift * 0.08, 0.28, 0.97);
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
      whisper: { font: '400 8.6px "Commit Mono", monospace', fill: pal.microWhisper },
      part: { font: '400 8.7px "Commit Mono", monospace', fill: pal.microPart },
      core: { font: '700 8.6px "Commit Mono", monospace', fill: pal.microCore },
    };

    const microList = cfg.microType || [];
    for (let i = 0; i < microList.length; i++) {
      const item = microList[i];
      const style = normalizeMicroStyle(item.style);
      const st = FONTS[style];
      ctx.font = st.font;
      const span = Math.ceil(ctx.measureText(item.text).width / PITCH);
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

            let litCols = 0, crimCols = 0, specCols = 0, brightCols = 0;
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
        if (cellLum[cIdx] > 0.25 && x0 < typo.box.right && x1 > typo.box.left && y0 < typo.box.bottom && y1 > typo.box.top) {
          sanctuaryCollisions++;
        }

        const sz = cellSize[cIdx];
        const pad = (PITCH - sz) * 0.5;
        ctx.fillStyle = cellColor[cIdx];
        drawRoundedRect(ctx, x0 + pad, y0 + pad, sz, sz, cellRx[cIdx]);
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

    drawVyoFramelessTypography(ctx, typo, pal);

    return {
      litShare: Number((litCells / (COLS * ROWS)).toFixed(4)),
      accentShare: Number((accentCells / Math.max(1, litCells)).toFixed(4)),
      sanctuaryCollisions,
      microPlaced: placedTexts.length,
      microRequested: microList.length,
    };
  }

  // =========================================================================
  // 7. STYLE 2: DAYLIGHT ALABASTER 7px MOSAIC RENDERER
  // =========================================================================
  function renderAlabasterMosaic(ctx, gridRGB, cfg, sanctuary, typo, palName) {
    const pal = PALETTES[palName] && PALETTES[palName].mode === "light" ? PALETTES[palName] : PALETTES.vermilion;
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, 0, W, H);

    const faultRows = new Set(cfg.strata?.faultRows || []);
    const TONE_HEX = {
      1: pal.mistHex,
      2: pal.mistMidHex,
      3: pal.structLightHex,
      4: pal.structMidHex,
      5: pal.structDeepHex,
      6: pal.accentHex,
      7: pal.accentDeepHex,
    };

    const gridTone = new Uint8Array(COLS * ROWS);
    const gridSize = new Float32Array(COLS * ROWS);
    const gridRx = new Float32Array(COLS * ROWS);

    for (let row = 0; row < ROWS; row++) {
      const y0 = row * PITCH;
      const v = (row + 0.5) / ROWS;
      const isFaultRow = faultRows.has(row);
      for (let col = 0; col < COLS; col++) {
        const x0 = col * PITCH;
        const u = (col + 0.5) / COLS;

        if (sanctuary.mode === "top-left") {
          if (y0 < sanctuary.yMax && x0 < sanctuary.xMax) continue;
          if (y0 < sanctuary.softY && x0 < sanctuary.softX) continue;
        } else if (sanctuary.custom) {
          if (x0 >= sanctuary.x && x0 < sanctuary.x + sanctuary.w && y0 >= sanctuary.y && y0 < sanctuary.y + sanctuary.h) continue;
        }
        if (isFaultRow && col < COLS - 14 && v > 0.45) continue;

        const keep = sanctuary.mode === "top-left" ? 1.0 : sanctuaryKeepAt(u, v, sanctuary, typo, 0.9);
        const idx = (row * COLS + col) * 3;
        const vCrim = gridRGB[idx] * keep;
        const vSlate = gridRGB[idx + 1] * keep;
        const vMist = gridRGB[idx + 2] * keep;

        const bayer = BAYER4[row & 3][col & 3] / 16 - 0.5;
        const micro = (cellHash(col, row, cfg.seed, 23) - 0.5) * 0.095 + bayer * 0.085;

        let tone = 0;
        let size = 5.2;
        let rx = 0.7;

        if (vCrim + micro * 0.72 > 0.40) {
          tone = vCrim + micro * 0.42 > 0.72 ? 7 : 6;
          size = vCrim > 0.60 ? 5.65 : 4.85;
          rx = size * 0.44;
        } else if (vSlate + micro * 0.68 > 0.34) {
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
      whisper: { font: '400 8.8px "Commit Mono", monospace', fill: pal.microWhisper },
      part: { font: '400 8.9px "Commit Mono", monospace', fill: pal.microPart },
      core: { font: '700 8.8px "Commit Mono", monospace', fill: pal.microCore },
    };

    const microList = cfg.microType || [];
    for (let i = 0; i < microList.length; i++) {
      const item = microList[i];
      const style = normalizeMicroStyle(item.style);
      const st = FONTS[style];
      ctx.font = st.font;
      const span = Math.ceil(ctx.measureText(item.text).width / PITCH);
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

            let mistCols = 0, darkCols = 0, crimCols = 0;
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
        if (tone >= 3 && x0 < typo.box.right && x1 > typo.box.left && y0 < typo.box.bottom && y1 > typo.box.top) {
          sanctuaryCollisions++;
        }

        const sz = gridSize[cIdx];
        const pad = (PITCH - sz) * 0.5;
        ctx.fillStyle = TONE_HEX[tone];
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

    drawVyoFramelessTypography(ctx, typo, pal);

    return {
      litShare: Number((litCells / (COLS * ROWS)).toFixed(4)),
      accentShare: Number((accentCells / Math.max(1, litCells)).toFixed(4)),
      sanctuaryCollisions,
      microPlaced: placedTexts.length,
      microRequested: microList.length,
    };
  }

  // =========================================================================
  // 8. STYLE 3: OPTICS (CONTINUOUS DARKROOM REFRACTION + 35mm FILM GRAIN)
  // =========================================================================
  function renderOptics(ctx, norm, shearMask, cfg, sanctuary, typo, palName) {
    const pal = PALETTES[palName] && PALETTES[palName].mode === "dark" ? PALETTES[palName] : PALETTES.crimson;
    const hdrBase = extractDarkField(norm, cfg.strata, palName);
    const { slices, rowSlice } = buildPixelSlices(cfg.strata, cfg.seed, {
      shearScale: 1.0,
      dispScale: 1.0,
      streakScale: 1.0,
    });

    const hdr1 = new Float32Array(W * H * 3);
    const acc1 = new Float32Array(W * H);
    const rowRng = mulberry32((cfg.seed ^ 0x7f4a7c15) >>> 0);
    const colNoise = makeValueNoise((cfg.seed ^ 0x243f6a88) >>> 0);

    // Non-periodic vertical crystal/phosphor micro-column modulation (applied subtly in wake)
    const colModFine = new Float32Array(W);
    const colModMed = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      colModFine[x] = colNoise(x * 0.42, 1.7) * 0.65 + colNoise(x * 0.88, 9.3) * 0.35 - 0.5;
      colModMed[x] = colNoise(x * 0.13, 4.2) - 0.5;
    }

    // 1. Slice, shear, subtle crystal blocks, and cyan-paired RGB chromatic dispersion (modulated by refractMask!)
    for (let y = 0; y < H; y++) {
      const sl = rowSlice[y];
      const v = (y + 0.5) / H;
      const gRow = v * ROWS - 0.5;

      if (!sl) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          hdr1[i * 3] = hdrBase[i * 3] * 0.85;
          hdr1[i * 3 + 1] = hdrBase[i * 3 + 1] * 0.85;
          hdr1[i * 3 + 2] = hdrBase[i * 3 + 2] * 0.85;
          acc1[i] = norm.accent[i];
        }
        continue;
      }

      const bandT = (y - sl.y0) / Math.max(1, sl.y1 - sl.y0);
      const edgeSheen = 1.03 + (bandT < 0.08 ? 0.12 * (1 - bandT / 0.08) : 0) - bandT * 0.10;
      const couplingBoost = 0.62 + 0.82 * smoothstep(0.18, 0.72, sl.crossNorm + (sl.isAccent ? 0.16 : 0));
      const scanJitter = (rowRng() - 0.5) * (sl.isUpper ? 2.2 : 1.1) * couplingBoost;
      const baseShear = sl.shearPx * couplingBoost + scanJitter;
      const dispBase = sl.dispPx;
      const boost = sl.energyBoost * edgeSheen;
      const ribAmp = sl.ribStrength;
      const blocks = sl.blocks;
      const colOff = sl.seed % 499;

      for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / W;
        const rMask = sampleScalar(shearMask, COLS, ROWS, u * COLS - 0.5, gRow);

        let dx = baseShear * rMask;
        let dy = sl.dySample * couplingBoost * rMask;
        let bBoost = 1 + (boost - 1) * clamp(rMask * 0.92, 0.18, 1.15);

        if (blocks) {
          for (let b = 0; b < blocks.length; b++) {
            const bl = blocks[b];
            if (u >= bl.u0 && u <= bl.u1) {
              dx += bl.dx * couplingBoost * rMask;
              dy += bl.dy * couplingBoost * rMask;
              bBoost *= 1 + (bl.boost - 1) * clamp(rMask, 0.25, 1.0);
              break;
            }
          }
        }

        // Subtle organic vertical glass/phosphor grain only in refracted wake regions
        let rib = 1.0;
        if (ribAmp > 0.01 && rMask > 0.22) {
          const cx = (x + colOff) % W;
          rib = 1.0 + ribAmp * smoothstep(0.22, 0.75, rMask) * (colModFine[cx] * 1.15 + colModMed[cx] * 0.7);
        }

        // Cyan-paired optical chromatic edge dispersion (crisp prism fringe on wings, bold in wake)
        const dispLocal = dispBase * clamp(0.28 + 0.85 * rMask, 0.26, 1.28);
        const dispR = dispLocal * 0.88;
        const dispG = -dispLocal * 0.40;
        const dispB = -dispLocal * 0.86;

        const fx = x - dx;
        const fy = y + dy;
        const r = sampleField(hdrBase, W, H, fx - dispR, fy, 0) * bBoost * rib;
        const g = sampleField(hdrBase, W, H, fx - dispG, fy, 1) * bBoost * rib;
        const b = sampleField(hdrBase, W, H, fx - dispB, fy, 2) * bBoost * rib;

        const i = y * W + x;
        hdr1[i * 3] = r;
        hdr1[i * 3 + 1] = g;
        hdr1[i * 3 + 2] = b;
        acc1[i] = sampleScalar(norm.accent, W, H, fx, fy);
      }
    }

    // 2. Silky 1D Per-Scanline Horizontal Motion-Streak Pass (modulated by refractMask!)
    const streakRng = mulberry32((cfg.seed ^ 0x6a09e667) >>> 0);
    const rowTmp = new Float32Array(W * 3);
    const accTmp = new Float32Array(W);
    let smoothRowL = 8;

    for (let y = 0; y < H; y++) {
      const sl = rowSlice[y];
      if (!sl) continue;
      const v = (y + 0.5) / H;
      const gRow = v * ROWS - 0.5;
      const isUpper = sl.isUpper;
      const transT = sl.transT;

      if ((y & 1) === 0) {
        const spike = streakRng() < (isUpper ? 0.14 : 0.26) ? 1.55 + streakRng() * 1.8 : 0.48 + streakRng() * 0.95;
        smoothRowL = smoothRowL * 0.30 + sl.streakPx * spike * 0.70;
      }

      const bias = sl.streakBias || 0;
      const Lfwd = Math.max(1.4, smoothRowL * (1 + bias));
      const Lbwd = Math.max(1.4, smoothRowL * (1 - bias));
      const af = 1 - Math.exp(-1 / Lfwd);
      const ab = 1 - Math.exp(-1 / Lbwd);
      const mixRowBase = isUpper ? 0.16 + 0.38 * transT : 0.60;

      const rowOff = y * W * 3;
      const aOff = y * W;
      let ar = hdr1[rowOff], ag = hdr1[rowOff + 1], abC = hdr1[rowOff + 2], aa = acc1[aOff];
      for (let x = 0; x < W; x++) {
        const i = rowOff + x * 3;
        ar += (hdr1[i] - ar) * af;
        ag += (hdr1[i + 1] - ag) * af;
        abC += (hdr1[i + 2] - abC) * af;
        aa += (acc1[aOff + x] - aa) * af;
        rowTmp[x * 3] = ar;
        rowTmp[x * 3 + 1] = ag;
        rowTmp[x * 3 + 2] = abC;
        accTmp[x] = aa;
      }

      ar = hdr1[rowOff + (W - 1) * 3];
      ag = hdr1[rowOff + (W - 1) * 3 + 1];
      abC = hdr1[rowOff + (W - 1) * 3 + 2];
      aa = acc1[aOff + W - 1];
      for (let x = W - 1; x >= 0; x--) {
        const i = rowOff + x * 3;
        ar += (hdr1[i] - ar) * ab;
        ag += (hdr1[i + 1] - ag) * ab;
        abC += (hdr1[i + 2] - abC) * ab;
        aa += (acc1[aOff + x] - aa) * ab;
        const sr = 0.5 * (rowTmp[x * 3] + ar);
        const sg = 0.5 * (rowTmp[x * 3 + 1] + ag);
        const sb = 0.5 * (rowTmp[x * 3 + 2] + abC);
        const sa = 0.5 * (accTmp[x] + aa);

        const rMask = sampleScalar(shearMask, COLS, ROWS, ((x + 0.5) / W) * COLS - 0.5, gRow);
        const mixS = clamp(mixRowBase * smoothstep(0.06, 0.92, rMask), 0.03, 0.66);
        const mixO = 1 - mixS;
        hdr1[i] = hdr1[i] * mixO + sr * mixS;
        hdr1[i + 1] = hdr1[i + 1] * mixO + sg * mixS;
        hdr1[i + 2] = hdr1[i + 2] * mixO + sb * mixS;
        acc1[aOff + x] = acc1[aOff + x] * mixO + sa * mixS;
      }
    }

    // 3. Restrained Specular Halo Bloom ONLY from brightest focal crests (lum > 0.90)
    const BW = 210;
    const BH = 298;
    const bloom = new Float32Array(BW * BH * 3);
    for (let by = 0; by < BH; by++) {
      const y = Math.min(H - 1, Math.floor(((by + 0.5) / BH) * H));
      for (let bx = 0; bx < BW; bx++) {
        const x = Math.min(W - 1, Math.floor(((bx + 0.5) / BW) * W));
        const src = (y * W + x) * 3;
        const r = hdr1[src], g = hdr1[src + 1], b = hdr1[src + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const knee = smoothstep(0.88, 1.75, lum);
        const dst = (by * BW + bx) * 3;
        bloom[dst] = r * knee;
        bloom[dst + 1] = g * knee;
        bloom[dst + 2] = b * knee;
      }
    }
    boxBlurRGB(bloom, BW, BH, 6, 3);

    // 4. Write directly to 2x DPR (1680x2380) canvas with ACES filmic tone-mapping + fine 35mm monochrome grain
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const imgData = ctx.createImageData(W2, H2);
    const px = imgData.data;
    const [baseR, baseG, baseB] = pal.groundRgb;
    const grainRng = mulberry32((cfg.seed ^ 0xbb67ae85) >>> 0);

    const activeGrid = new Float32Array(COLS * ROWS);
    const accentGrid = new Float32Array(COLS * ROWS);
    const glareGrid = new Float32Array(COLS * ROWS);

    for (let y2 = 0; y2 < H2; y2++) {
      const v = (y2 + 0.5) / H2;
      const y1 = Math.min(H - 1, y2 >> 1);
      const byF = clamp(v * (BH - 1), 0, BH - 1.001);
      const by0 = byF | 0;
      const bdy = byF - by0;

      for (let x2 = 0; x2 < W2; x2++) {
        const u = (x2 + 0.5) / W2;
        const fx1 = clamp((x2 + 0.5) / DPR - 0.5, 0, W - 1.001);
        const x1a = fx1 | 0;
        const x1b = Math.min(W - 1, x1a + 1);
        const tX = fx1 - x1a;

        const ia = (y1 * W + x1a) * 3;
        const ib = (y1 * W + x1b) * 3;
        let r = hdr1[ia] + (hdr1[ib] - hdr1[ia]) * tX;
        let g = hdr1[ia + 1] + (hdr1[ib + 1] - hdr1[ia + 1]) * tX;
        let b = hdr1[ia + 2] + (hdr1[ib + 2] - hdr1[ia + 2]) * tX;

        const bxF = clamp(u * (BW - 1), 0, BW - 1.001);
        const bx0 = bxF | 0;
        const bdx = bxF - bx0;
        const b00 = (by0 * BW + bx0) * 3;
        const b10 = b00 + 3;
        const b01 = b00 + BW * 3;
        const b11 = b01 + 3;
        const blR = (bloom[b00] + (bloom[b10] - bloom[b00]) * bdx) * (1 - bdy) + (bloom[b01] + (bloom[b11] - bloom[b01]) * bdx) * bdy;
        const blG = (bloom[b00 + 1] + (bloom[b10 + 1] - bloom[b00 + 1]) * bdx) * (1 - bdy) + (bloom[b01 + 1] + (bloom[b11 + 1] - bloom[b01 + 1]) * bdx) * bdy;
        const blB = (bloom[b00 + 2] + (bloom[b10 + 2] - bloom[b00 + 2]) * bdx) * (1 - bdy) + (bloom[b01 + 2] + (bloom[b11 + 2] - bloom[b01 + 2]) * bdx) * bdy;

        const keep = sanctuaryKeepAt(u, v, sanctuary, typo, 1.05);
        r = (r + blR * 0.24) * keep;
        g = (g + blG * 0.24) * keep;
        b = (b + blB * 0.24) * keep;

        const mr = toneMap(r);
        const mg = toneMap(g);
        const mb = toneMap(b);
        const lum = 0.26 * mr + 0.58 * mg + 0.16 * mb;

        // Tactile 35mm monochrome darkroom film grain: velvety quiet in black shadows, crisp in midtones
        const midEnv = smoothstep(0.018, 0.20, lum);
        const gAmp = 1.1 + midEnv * (5.2 + lum * 4.6);
        const nL = (grainRng() + grainRng() - 1) * gAmp;

        const o = (y2 * W2 + x2) * 4;
        px[o] = clamp(Math.round(baseR + mr * (255 - baseR) + nL), 0, 255);
        px[o + 1] = clamp(Math.round(baseG + mg * (255 - baseG) + nL), 0, 255);
        px[o + 2] = clamp(Math.round(baseB + mb * (255 - baseB) + nL), 0, 255);
        px[o + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    ctx.restore();

    // 5. Measure cell-level metrics and place sparse plain-language micro-type in quiet dark crevices
    let litCells = 0;
    let accentCells = 0;
    let sanctuaryCollisions = 0;
    for (let row = 0; row < ROWS; row++) {
      const y = Math.min(H - 1, Math.round((row + 0.5) * PITCH));
      const v = (row + 0.5) / ROWS;
      const y0 = row * PITCH;
      const y1 = y0 + PITCH;
      for (let col = 0; col < COLS; col++) {
        const x = Math.min(W - 1, Math.round((col + 0.5) * PITCH));
        const u = (col + 0.5) / COLS;
        const keep = sanctuaryKeepAt(u, v, sanctuary, typo, 1.05);
        const i = y * W + x;
        const mr = toneMap(hdr1[i * 3] * keep);
        const mg = toneMap(hdr1[i * 3 + 1] * keep);
        const mb = toneMap(hdr1[i * 3 + 2] * keep);
        const lum = 0.26 * mr + 0.58 * mg + 0.16 * mb;
        const cIdx = row * COLS + col;
        activeGrid[cIdx] = lum;
        accentGrid[cIdx] = acc1[i] * keep;
        glareGrid[cIdx] = smoothstep(0.56, 0.84, lum);

        if (lum > 0.085 || Math.max(mr, mg, mb) > 0.14) {
          litCells++;
          const isAcc = palName === "crimson" ? (mr - Math.max(mg, mb) * 1.05 > 0.15 && mr > 0.25) : accentGrid[cIdx] > 0.30;
          if (isAcc) accentCells++;
        }
        const x0 = col * PITCH;
        const x1 = x0 + PITCH;
        if (lum > 0.24 && x0 < typo.box.right && x1 > typo.box.left && y0 < typo.box.bottom && y1 > typo.box.top) {
          sanctuaryCollisions++;
        }
      }
    }

    const placedTexts = placeMicroTypeOnField(ctx, cfg, sanctuary, typo, pal, activeGrid, accentGrid, glareGrid);
    ctx.save();
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.shadowColor = `rgba(${baseR},${baseG},${baseB},0.96)`;
    ctx.shadowBlur = 7.0;
    for (const t of placedTexts) {
      ctx.font = t.font;
      ctx.fillStyle = t.fill;
      // Soft invisible-looking shadow cradle keeps labels razor-clear even crossing bright optical bands
      ctx.fillText(t.str, t.col * PITCH, (t.row + 0.78) * PITCH);
      ctx.shadowBlur = 3.0;
      ctx.fillText(t.str, t.col * PITCH, (t.row + 0.78) * PITCH);
      ctx.shadowBlur = 7.0;
    }
    ctx.restore();

    drawVyoFramelessTypography(ctx, typo, pal);

    return {
      slices: slices.length,
      litShare: Number((litCells / (COLS * ROWS)).toFixed(4)),
      accentShare: Number((accentCells / Math.max(1, litCells)).toFixed(4)),
      sanctuaryCollisions,
      microPlaced: placedTexts.length,
      microRequested: (cfg.microType || []).length,
    };
  }

  // =========================================================================
  // 9. STYLE 4: RISO (MULTI-PLATE TACTILE RISOGRAPH ON ARCHIVAL WASHI PAPER)
  // =========================================================================
  function renderRiso(ctx, norm, shearMask, cfg, sanctuary, typo, palName) {
    const pal = PALETTES[palName] && PALETTES[palName].mode === "light" ? PALETTES[palName] : PALETTES.vermilion;
    const dayField = extractLightField(norm, cfg.strata);
    const { slices, rowSlice } = buildPixelSlices(cfg.strata, cfg.seed, {
      shearScale: 0.86,
      dispScale: 0.72,
      streakScale: 0.78,
    });

    // 3 physical risograph ink plates at W x H (0..1 ink coverage)
    const pMist = new Float32Array(W * H);
    const pStruct = new Float32Array(W * H);
    const pAccent = new Float32Array(W * H);

    const rowRng = mulberry32((cfg.seed ^ 0x517cc1b7) >>> 0);

    // 1. Separate & misregister the 3 physical ink drums:
    //    - Consistent physical press registration offsets on the sculpted subject (NO sawtooth!),
    //    - Codebase-driven horizontal strata shear & wider drum slip in the refracted wake!
    for (let y = 0; y < H; y++) {
      const sl = rowSlice[y];
      const v = (y + 0.5) / H;
      const gRow = v * ROWS - 0.5;

      const couplingBoost = sl
        ? 0.65 + 0.80 * smoothstep(0.18, 0.72, sl.crossNorm + (sl.isAccent ? 0.18 : 0))
        : 0.5;
      const sliceShear = sl ? sl.shearPx * couplingBoost + (rowRng() - 0.5) * 1.1 : 0;
      const sliceDy = sl ? sl.dySample * 0.55 * couplingBoost : 0;
      const bandT = sl ? (y - sl.y0) / Math.max(1, sl.y1 - sl.y0) : 0.5;
      const passTone = sl ? clamp(0.94 + (sl.energyBoost - 1) * 0.45 - bandT * 0.05, 0.82, 1.14) : 0.96;
      const wakeSign = sl ? ((sl.seed & 1) ? 1 : -1) : 1;

      for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / W;
        const rMask = sampleScalar(shearMask, COLS, ROWS, u * COLS - 0.5, gRow);
        const keep = sanctuaryKeepAt(u, v, sanctuary, typo, 0.95);
        if (keep < 0.01) continue;

        const wakeT = smoothstep(0.24, 0.92, rMask);
        // Plate 1 (Aqua/Mist drum): physical global shift (-6px, -3.5px) so crisp pale aqua peeks along edges!
        const dx1 = sliceShear * 0.52 * wakeT - 6.0;
        const dy1 = sliceDy * 0.42 * wakeT - 3.5;
        const rawMist = sampleField(dayField, W, H, x - dx1, y + dy1, 2);

        // Plate 2 (Federal Blue / Deep Structure drum): anchored crisp on form, stepped cleanly in wake!
        const dx2 = sliceShear * 0.85 * wakeT;
        const dy2 = sliceDy * 0.68 * wakeT;
        const rawStruct = sampleField(dayField, W, H, x - dx2, y + dy2, 1);

        // Plate 3 (Fluorescent Vermilion / Klein Cobalt drum): consistent +4.5px/+2.5px press registration
        // on the sculpted subject -> crisp aubergine-plum multiply overprint overlap! Plus strata slip in wake!
        const wakeMisreg = wakeT * wakeSign * (5.0 + (sl ? sl.crossNorm * 6.5 : 2.0));
        const dx3 = dx2 + 4.5 + wakeMisreg;
        const dy3 = dy2 + 2.5;
        const rawAcc = sampleField(dayField, W, H, x - dx3, y + dy3, 0);

        const i = y * W + x;
        // Crisper tonal shoulder so forms read like real riso ink plates instead of misty airbrush
        pMist[i] = clamp(smoothstep(0.12, 0.84, rawMist) * 0.58 * passTone * keep, 0, 0.68);
        pStruct[i] = clamp(smoothstep(0.16, 0.88, rawStruct) * 0.90 * passTone * keep, 0, 0.94);
        pAccent[i] = clamp(smoothstep(0.16, 0.84, rawAcc) * 0.96 * (0.95 + (passTone - 1) * 0.30) * keep, 0, 0.98);
      }
    }

    // 2. Subtle Horizontal Risograph Squeegee Drag strictly in refracted wake slices
    const sqTmp1 = new Float32Array(W);
    const sqTmp2 = new Float32Array(W);
    const sqTmp3 = new Float32Array(W);
    for (let y = 0; y < H; y++) {
      const sl = rowSlice[y];
      if (!sl) continue;
      const v = (y + 0.5) / H;
      const gRow = v * ROWS - 0.5;
      const L = sl.isUpper ? 2.8 + sl.transT * 7.0 : 9.0 + sl.crossNorm * 11.0;
      const alpha = 1 - Math.exp(-1 / L);
      const mixBase = sl.isUpper ? 0.08 + sl.transT * 0.22 : 0.34;

      const off = y * W;
      let a1 = pMist[off], a2 = pStruct[off], a3 = pAccent[off];
      for (let x = 0; x < W; x++) {
        a1 += (pMist[off + x] - a1) * alpha;
        a2 += (pStruct[off + x] - a2) * alpha;
        a3 += (pAccent[off + x] - a3) * alpha;
        sqTmp1[x] = a1;
        sqTmp2[x] = a2;
        sqTmp3[x] = a3;
      }
      a1 = pMist[off + W - 1];
      a2 = pStruct[off + W - 1];
      a3 = pAccent[off + W - 1];
      for (let x = W - 1; x >= 0; x--) {
        a1 += (pMist[off + x] - a1) * alpha;
        a2 += (pStruct[off + x] - a2) * alpha;
        a3 += (pAccent[off + x] - a3) * alpha;
        const rMask = sampleScalar(shearMask, COLS, ROWS, ((x + 0.5) / W) * COLS - 0.5, gRow);
        const mixS = clamp(mixBase * smoothstep(0.24, 0.90, rMask), 0.0, 0.38);
        const mixO = 1 - mixS;
        pMist[off + x] = pMist[off + x] * mixO + 0.5 * (sqTmp1[x] + a1) * mixS;
        pStruct[off + x] = pStruct[off + x] * mixO + 0.5 * (sqTmp2[x] + a2) * mixS;
        pAccent[off + x] = pAccent[off + x] * mixO + 0.5 * (sqTmp3[x] + a3) * mixS;
      }
    }

    // 3. Composite all 3 ink plates with TRUE optical MULTIPLY overprint + tactile riso halftone/stipple screen + cotton-fiber grain at 2x DPR!
    const [grR, grG, grB] = pal.risoGroundRgb || [246, 243, 235];
    const [mR, mG, mB] = pal.risoMist.map((c) => c / 255);
    const [sR, sG, sB] = pal.risoStruct.map((c) => c / 255);
    const [aR, aG, aB] = pal.risoAccent.map((c) => c / 255);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const imgData = ctx.createImageData(W2, H2);
    const px = imgData.data;
    const gSeed = (cfg.seed ^ 0x9e3779b9) >>> 0;

    // Precompute rotated halftone screen trig (15 deg for structure drum, 45 deg for accent drum, 75 deg for mist drum)
    const cos15 = Math.cos(0.2618), sin15 = Math.sin(0.2618);
    const cos45 = Math.cos(0.7854), sin45 = Math.sin(0.7854);
    const screenFreq = (Math.PI * 2) / 5.2; // fine tactile 2.6 CSS-px riso grain-screen pitch!

    for (let y2 = 0; y2 < H2; y2++) {
      const y1 = Math.min(H - 1, y2 >> 1);
      const cy = y2 >> 1;
      const rowOff1 = y1 * W;
      const rowOff2 = y2 * W2 * 4;

      for (let x2 = 0; x2 < W2; x2++) {
        const x1 = Math.min(W - 1, x2 >> 1);
        const i1 = rowOff1 + x1;

        let c1 = pMist[i1];
        let c2 = pStruct[i1];
        let c3 = pAccent[i1];

        const o = rowOff2 + (x2 << 2);
        if (c1 < 0.015 && c2 < 0.015 && c3 < 0.015) {
          // Pristine archival warm washi paper
          const pw = (hash2Fast(x2 >> 1, cy, gSeed + 7) - 0.5) * 2.0;
          px[o] = clamp(Math.round(grR + pw), 0, 255);
          px[o + 1] = clamp(Math.round(grG + pw), 0, 255);
          px[o + 2] = clamp(Math.round(grB + pw * 0.9), 0, 255);
          px[o + 3] = 255;
          continue;
        }

        // Authentic risograph master-screen grain: organic 2-octave stochastic stipple + delicate rotated dot screen!
        const st1 = hash2Fast(x2, y2, gSeed + 101);
        const st2 = hash2Fast(x2 >> 1, cy, gSeed + 211);
        const st3 = hash2Fast(x2 + 4129, y2 + 1933, gSeed + 307);
        const stochA = (st1 * 0.58 + st2 * 0.42);
        const stochB = (st3 * 0.58 + st2 * 0.42);

        // Subtle rotated halftone screen dot value in [0..1]
        const u15 = (x2 * cos15 - y2 * sin15) * screenFreq;
        const v15 = (x2 * sin15 + y2 * cos15) * screenFreq;
        const screenStruct = 0.5 + 0.25 * (Math.cos(u15) + Math.cos(v15));

        const u45 = (x2 * cos45 - y2 * sin45) * screenFreq;
        const v45 = (x2 * sin45 + y2 * cos45) * screenFreq;
        const screenAcc = 0.5 + 0.25 * (Math.cos(u45) + Math.cos(v45));

        // Hybrid stochastic + screenprint master transfer (turns smooth fades into tactile risograph stipple!)
        const mask1 = smoothstep(0.0, 0.38, c1 - (stochA - 0.5) * 0.34);
        c1 = clamp(c1 * (0.55 + 0.65 * mask1) + (stochA - 0.5) * 0.14 * c1, 0, 0.72);

        const thresh2 = stochA * 0.68 + screenStruct * 0.32;
        const screen2 = smoothstep(thresh2 - 0.24, thresh2 + 0.24, c2 * 1.06);
        c2 = clamp(c2 * 0.44 + screen2 * 0.56 * Math.pow(c2, 0.35), 0, 0.94);

        const thresh3 = stochB * 0.68 + screenAcc * 0.32;
        const screen3 = smoothstep(thresh3 - 0.22, thresh3 + 0.22, c3 * 1.08);
        c3 = clamp(c3 * 0.42 + screen3 * 0.58 * Math.pow(c3, 0.32), 0, 0.96);

        // True subtractive optical MULTIPLY overprint: Paper * Plate1 * Plate2 * Plate3
        let rr = (grR / 255) * (1 - c1 * (1 - mR)) * (1 - c2 * (1 - sR)) * (1 - c3 * (1 - aR));
        let gg = (grG / 255) * (1 - c1 * (1 - mG)) * (1 - c2 * (1 - sG)) * (1 - c3 * (1 - aG));
        let bb = (grB / 255) * (1 - c1 * (1 - mB)) * (1 - c2 * (1 - sB)) * (1 - c3 * (1 - aB));

        let r255 = rr * 255;
        let g255 = gg * 255;
        let b255 = bb * 255;

        // 2-octave cotton-fiber ink-only grain + microscopic paper-tooth flecks (pantry-cascade craft!)
        const inkDiff = Math.max(Math.abs(grR - r255), Math.abs(grG - g255), Math.abs(grB - b255));
        if (inkDiff >= 3) {
          const ink = Math.min(1, inkDiff / 200);
          const toothEnv = Math.pow(ink, 0.52) * (1 - 0.20 * ink * ink);
          const grain = (st1 * 0.65 + st2 * 0.55 - 0.60) * 38 * toothEnv;
          const fleck = hash2Fast(x2 + 9173, y2 + 3119, gSeed) > 0.948 ? 16 * toothEnv : 0;
          const delta = grain + fleck;
          r255 += delta;
          g255 += delta;
          b255 += delta;
        }

        px[o] = clamp(Math.round(r255), 0, 255);
        px[o + 1] = clamp(Math.round(g255), 0, 255);
        px[o + 2] = clamp(Math.round(b255), 0, 255);
        px[o + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    ctx.restore();

    // 4. Cell metrics & micro-type placement
    const activeGrid = new Float32Array(COLS * ROWS);
    const accentGrid = new Float32Array(COLS * ROWS);
    const glareGrid = new Float32Array(COLS * ROWS);
    let litCells = 0;
    let accentCells = 0;
    let sanctuaryCollisions = 0;

    for (let row = 0; row < ROWS; row++) {
      const y = Math.min(H - 1, Math.round((row + 0.5) * PITCH));
      const y0 = row * PITCH;
      const y1 = y0 + PITCH;
      for (let col = 0; col < COLS; col++) {
        const x = Math.min(W - 1, Math.round((col + 0.5) * PITCH));
        const i = y * W + x;
        const c1 = pMist[i], c2 = pStruct[i], c3 = pAccent[i];
        const totalInk = Math.max(c1 * 0.75, c2, c3);
        const cIdx = row * COLS + col;
        activeGrid[cIdx] = totalInk;
        accentGrid[cIdx] = c3;
        glareGrid[cIdx] = smoothstep(0.55, 0.85, Math.max(c2, c3));

        if (totalInk > 0.12) {
          litCells++;
          if (c3 > 0.34) accentCells++;
        }
        const x0 = col * PITCH;
        const x1 = x0 + PITCH;
        if (totalInk > 0.24 && x0 < typo.box.right && x1 > typo.box.left && y0 < typo.box.bottom && y1 > typo.box.top) {
          sanctuaryCollisions++;
        }
      }
    }

    const placedTexts = placeMicroTypeOnField(ctx, cfg, sanctuary, typo, pal, activeGrid, accentGrid, glareGrid);
    ctx.save();
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    for (const t of placedTexts) {
      ctx.font = t.font;
      const tx = t.col * PITCH;
      const ty = (t.row + 0.78) * PITCH;
      // Soft washi-paper knockout halo behind crisp sumi charcoal text
      ctx.strokeStyle = `rgba(${grR},${grG},${grB},0.88)`;
      ctx.lineWidth = 3.2;
      ctx.lineJoin = "round";
      ctx.strokeText(t.str, tx, ty);
      ctx.fillStyle = t.fill;
      ctx.fillText(t.str, tx, ty);
    }
    ctx.restore();

    drawVyoFramelessTypography(ctx, typo, pal);

    return {
      slices: slices.length,
      litShare: Number((litCells / (COLS * ROWS)).toFixed(4)),
      accentShare: Number((accentCells / Math.max(1, litCells)).toFixed(4)),
      sanctuaryCollisions,
      microPlaced: placedTexts.length,
      microRequested: (cfg.microType || []).length,
    };
  }

  // =========================================================================
  // 10. STYLE 5: CONTOUR (SCULPTED TOPOGRAPHIC ELEVATION ISO-LINES)
  // =========================================================================
  function renderContour(ctx, norm, shearMask, cfg, sanctuary, typo, palName) {
    const pal = PALETTES[palName] || PALETTES.crimson;
    const isLight = pal.mode === "light";
    const bgHex = pal.contourGround || pal.ground;
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, W, H);

    const STEP = 3.5;
    const GW = Math.floor(W / STEP) + 1; // 241
    const GH = Math.floor(H / STEP) + 1; // 341

    const { slices, rowSlice } = buildPixelSlices(cfg.strata, cfg.seed, {
      shearScale: 0.90,
      dispScale: 0.70,
      streakScale: 0.75,
    });

    // 1. Sample normalized intensity & accent onto fine topographic grid with codebase horizontal strata perturbation
    const elevRaw = new Float32Array(GW * GH);
    const accRaw = new Float32Array(GW * GH);

    for (let gy = 0; gy < GH; gy++) {
      const py = clamp(gy * STEP, 0, H - 1);
      const v = py / H;
      const gRow = v * ROWS - 0.5;
      const sl = rowSlice[Math.min(H - 1, Math.round(py))];
      const couplingBoost = sl ? 0.62 + 0.78 * smoothstep(0.18, 0.72, sl.crossNorm + (sl.isAccent ? 0.16 : 0)) : 0.4;
      const sliceShear = sl ? sl.shearPx * couplingBoost : 0;
      const sliceDy = sl ? sl.dySample * 0.55 * couplingBoost : 0;
      const bandT = sl ? (py - sl.y0) / Math.max(1, sl.y1 - sl.y0) : 0.5;
      const sliceTerrace = sl ? 0.90 + (sl.energyBoost - 1) * 0.55 + Math.sin(bandT * Math.PI) * 0.08 : 0.95;

      for (let gx = 0; gx < GW; gx++) {
        const px = clamp(gx * STEP, 0, W - 1);
        const u = px / W;
        const rMask = sampleScalar(shearMask, COLS, ROWS, u * COLS - 0.5, gRow);
        const keep = sanctuaryKeepAt(u, v, sanctuary, typo, 1.05);

        const dx = sliceShear * 0.85 * rMask;
        const dy = sliceDy * 0.70 * rMask;
        const eVal = sampleScalar(norm.intensity, W, H, px - dx, py + dy);
        const aVal = sampleScalar(norm.accent, W, H, px - dx, py + dy);

        const wakeBoost = 1 + (sliceTerrace - 1) * smoothstep(0.24, 0.88, rMask);
        const gi = gy * GW + gx;
        elevRaw[gi] = clamp(eVal * wakeBoost * keep, 0, 1);
        accRaw[gi] = clamp(aVal * keep, 0, 1);
      }
    }

    // 2. Smooth elevation & accent fields (2-pass separable box blur ≈ Gaussian r=2.5 grid)
    const elev1 = boxBlurGrid(elevRaw, GW, GH, 2);
    const elev = boxBlurGrid(elev1, GW, GH, 1);
    const accField = boxBlurGrid(accRaw, GW, GH, 2);

    // Re-apply strict sanctuary calm mask after blur so zero contour lines enter typo.box
    for (let gy = 0; gy < GH; gy++) {
      const v = clamp(gy * STEP, 0, H - 1) / H;
      for (let gx = 0; gx < GW; gx++) {
        const u = clamp(gx * STEP, 0, W - 1) / W;
        const keep = sanctuaryKeepAt(u, v, sanctuary, typo, 0.92);
        const gi = gy * GW + gx;
        elev[gi] *= keep;
        accField[gi] *= keep;
      }
    }

    // 3. Delicate horizontal codebase fault-line ticks at strata.faultRows (behind contours)
    const faultRows = cfg.strata?.faultRows || [];
    ctx.save();
    ctx.setLineDash([3.5, 5.5]);
    ctx.lineWidth = 0.65;
    ctx.strokeStyle = isLight ? "rgba(38, 71, 97, 0.22)" : "rgba(148, 176, 212, 0.20)";
    for (const fr of faultRows) {
      const fy = fr * PITCH;
      const gy = clamp(Math.round(fy / STEP), 0, GH - 1);
      let xMin = W, xMax = 0;
      for (let gx = 0; gx < GW; gx++) {
        if (elev[gy * GW + gx] > 0.055) {
          const px = gx * STEP;
          if (px < xMin) xMin = px;
          if (px > xMax) xMax = px;
        }
      }
      if (xMax - xMin > 60) {
        ctx.beginPath();
        ctx.moveTo(Math.max(24, xMin - 18), fy);
        ctx.lineTo(Math.min(W - 18, xMax + 24), fy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(Math.min(W - 8, xMax + 28), fy);
        ctx.lineTo(Math.min(W - 2, xMax + 34), fy);
        ctx.stroke();
        ctx.setLineDash([3.5, 5.5]);
      }
    }
    ctx.restore();

    // 4. Marching Squares Vector Iso-Contour Extraction (24 elevation thresholds from 0.055 to 0.93)
    const NUM_LEVELS = 24;
    const levels = [];
    for (let i = 0; i < NUM_LEVELS; i++) {
      const t = i / (NUM_LEVELS - 1);
      levels.push(0.055 + Math.pow(t, 1.08) * 0.875);
    }

    const structLowRgb = isLight ? hexToRgb01(pal.mistMidHex) : pal.mist;
    const structMidRgb = isLight ? hexToRgb01(pal.structMidHex) : pal.coolLo;
    const structHiRgb = isLight ? hexToRgb01(pal.structDeepHex) : pal.coolHi;
    const crestRgb = isLight ? hexToRgb01(pal.inkHex) : pal.specular;
    const accentRgb = isLight ? hexToRgb01(pal.accentHex) : pal.accent;
    const accentHotRgb = isLight ? hexToRgb01(pal.accentDeepHex) : hexToRgb01(pal.accentHotHex || pal.accentHex);

    function interpEdge(a, b, lv) {
      const d = b - a;
      if (Math.abs(d) < 1e-6) return 0.5;
      return clamp((lv - a) / d, 0, 1);
    }

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let li = 0; li < NUM_LEVELS; li++) {
      const lv = levels[li];
      const normLv = li / (NUM_LEVELS - 1);
      const isMajor = li % 4 === 0 || li === NUM_LEVELS - 1;
      const lw = isMajor ? (isLight ? 1.50 : 1.52) : (isLight ? 0.82 : 0.84);

      const coolSegs = [];
      const accSegs = [];

      for (let gy = 0; gy < GH - 1; gy++) {
        const y0 = gy * STEP;
        const row0 = gy * GW;
        const row1 = row0 + GW;
        for (let gx = 0; gx < GW - 1; gx++) {
          const v0 = elev[row0 + gx];
          const v1 = elev[row0 + gx + 1];
          const v2 = elev[row1 + gx + 1];
          const v3 = elev[row1 + gx];

          let code = 0;
          if (v0 >= lv) code |= 8;
          if (v1 >= lv) code |= 4;
          if (v2 >= lv) code |= 2;
          if (v3 >= lv) code |= 1;
          if (code === 0 || code === 15) continue;

          const x0 = gx * STEP;
          const tx = x0 + interpEdge(v0, v1, lv) * STEP;
          const ty = y0;
          const rx = x0 + STEP;
          const ry = y0 + interpEdge(v1, v2, lv) * STEP;
          const bx = x0 + interpEdge(v3, v2, lv) * STEP;
          const by = y0 + STEP;
          const lx = x0;
          const ly = y0 + interpEdge(v0, v3, lv) * STEP;

          const aAvg = 0.25 * (accField[row0 + gx] + accField[row0 + gx + 1] + accField[row1 + gx + 1] + accField[row1 + gx]);
          const bucket = aAvg > 0.32 ? accSegs : coolSegs;

          const pushSeg = (ax, ay, px2, py2) => {
            bucket.push(ax, ay, px2, py2);
          };

          switch (code) {
            case 1: case 14: pushSeg(lx, ly, bx, by); break;
            case 2: case 13: pushSeg(bx, by, rx, ry); break;
            case 3: case 12: pushSeg(lx, ly, rx, ry); break;
            case 4: case 11: pushSeg(tx, ty, rx, ry); break;
            case 5: {
              const avg = 0.25 * (v0 + v1 + v2 + v3);
              if (avg >= lv) { pushSeg(lx, ly, tx, ty); pushSeg(bx, by, rx, ry); }
              else { pushSeg(lx, ly, bx, by); pushSeg(tx, ty, rx, ry); }
              break;
            }
            case 6: case 9: pushSeg(tx, ty, bx, by); break;
            case 7: case 8: pushSeg(lx, ly, tx, ty); break;
            case 10: {
              const avg = 0.25 * (v0 + v1 + v2 + v3);
              if (avg >= lv) { pushSeg(lx, ly, bx, by); pushSeg(tx, ty, rx, ry); }
              else { pushSeg(lx, ly, tx, ty); pushSeg(bx, by, rx, ry); }
              break;
            }
          }
        }
      }

      if (coolSegs.length) {
        let cr, cg, cb;
        if (normLv < 0.30) {
          const t = normLv / 0.30;
          cr = lerp(structLowRgb[0], structMidRgb[0], t);
          cg = lerp(structLowRgb[1], structMidRgb[1], t);
          cb = lerp(structLowRgb[2], structMidRgb[2], t);
        } else if (normLv < 0.78) {
          const t = (normLv - 0.30) / 0.48;
          cr = lerp(structMidRgb[0], structHiRgb[0], t);
          cg = lerp(structMidRgb[1], structHiRgb[1], t);
          cb = lerp(structMidRgb[2], structHiRgb[2], t);
        } else {
          const t = (normLv - 0.78) / 0.22;
          cr = lerp(structHiRgb[0], crestRgb[0], t);
          cg = lerp(structHiRgb[1], crestRgb[1], t);
          cb = lerp(structHiRgb[2], crestRgb[2], t);
        }
        const alpha = isLight
          ? clamp(0.36 + normLv * 0.58 + (isMajor ? 0.12 : 0), 0.34, 0.96)
          : clamp(0.40 + normLv * 0.56 + (isMajor ? 0.10 : 0), 0.38, 0.98);

        ctx.strokeStyle = `rgba(${Math.round(cr * 255)},${Math.round(cg * 255)},${Math.round(cb * 255)},${alpha.toFixed(3)})`;
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (let s = 0; s < coolSegs.length; s += 4) {
          ctx.moveTo(coolSegs[s], coolSegs[s + 1]);
          ctx.lineTo(coolSegs[s + 2], coolSegs[s + 3]);
        }
        ctx.stroke();
      }

      if (accSegs.length) {
        const hotT = smoothstep(0.35, 0.85, normLv);
        const ar = lerp(accentRgb[0], accentHotRgb[0], hotT);
        const ag = lerp(accentRgb[1], accentHotRgb[1], hotT);
        const ab = lerp(accentRgb[2], accentHotRgb[2], hotT);
        const r255 = Math.round(ar * 255);
        const g255 = Math.round(ag * 255);
        const b255 = Math.round(ab * 255);

        ctx.beginPath();
        for (let s = 0; s < accSegs.length; s += 4) {
          ctx.moveTo(accSegs[s], accSegs[s + 1]);
          ctx.lineTo(accSegs[s + 2], accSegs[s + 3]);
        }

        if (!isLight) {
          // Restrained crisp inner glow so tightly packed accent iso-lines stay razor-distinct!
          ctx.strokeStyle = `rgba(${r255},${g255},${b255},${isMajor ? 0.15 : 0.08})`;
          ctx.lineWidth = lw * 2.25;
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(${r255},${g255},${b255},${clamp(0.78 + normLv * 0.22, 0.78, 1.0).toFixed(3)})`;
        ctx.lineWidth = lw * 1.06;
        ctx.stroke();
      }
    }
    ctx.restore();

    // 5. Cell metrics + cartographic micro-type (with neat contour-break ground capsules!)
    const activeGrid = new Float32Array(COLS * ROWS);
    const accentGrid = new Float32Array(COLS * ROWS);
    const glareGrid = new Float32Array(COLS * ROWS);
    let litCells = 0;
    let accentCells = 0;
    let sanctuaryCollisions = 0;

    for (let row = 0; row < ROWS; row++) {
      const y = (row + 0.5) * PITCH;
      const gy = clamp(Math.round(y / STEP), 0, GH - 1);
      const y0 = row * PITCH;
      const y1 = y0 + PITCH;
      for (let col = 0; col < COLS; col++) {
        const x = (col + 0.5) * PITCH;
        const gx = clamp(Math.round(x / STEP), 0, GW - 1);
        const e = elev[gy * GW + gx];
        const a = accField[gy * GW + gx];
        const cIdx = row * COLS + col;
        activeGrid[cIdx] = e;
        accentGrid[cIdx] = a;
        glareGrid[cIdx] = smoothstep(0.74, 0.92, e);

        if (e > 0.055) {
          litCells++;
          if (a > 0.32) accentCells++;
        }
        const x0 = col * PITCH;
        const x1 = x0 + PITCH;
        if (e > 0.10 && x0 < typo.box.right && x1 > typo.box.left && y0 < typo.box.bottom && y1 > typo.box.top) {
          sanctuaryCollisions++;
        }
      }
    }

    const placedTexts = placeMicroTypeOnField(ctx, cfg, sanctuary, typo, pal, activeGrid, accentGrid, glareGrid);
    ctx.save();
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    for (const t of placedTexts) {
      ctx.font = t.font;
      const tw = ctx.measureText(t.str).width;
      const tx = t.col * PITCH;
      const ty = (t.row + 0.78) * PITCH;
      ctx.fillStyle = bgHex;
      drawRoundedRect(ctx, tx - 3.8, ty - 8.6, tw + 7.6, 11.2, 3.0);
      ctx.fillStyle = t.fill;
      ctx.fillText(t.str, tx, ty);
    }
    ctx.restore();

    drawVyoFramelessTypography(ctx, typo, pal);

    return {
      slices: slices.length,
      litShare: Number((litCells / (COLS * ROWS)).toFixed(4)),
      accentShare: Number((accentCells / Math.max(1, litCells)).toFixed(4)),
      sanctuaryCollisions,
      microPlaced: placedTexts.length,
      microRequested: (cfg.microType || []).length,
    };
  }

  // =========================================================================
  // 11. ASYNC BOOTSTRAP ENTRYPOINT
  // =========================================================================
  async function boot() {
    try {
      if (window.fontsReady) await window.fontsReady;
      const cfg = window.__VYO_LUMINOUS__;
      if (!cfg) throw new Error("missing window.__VYO_LUMINOUS__ payload");

      const canvas = document.getElementById("luminous");
      canvas.width = W2;
      canvas.height = H2;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      const style = cfg.style || (cfg.theme === "alabaster" ? "alabaster" : "obsidian");
      const defaultLight = style === "alabaster" || style === "riso" || (style === "contour" && cfg.theme === "alabaster");
      const palName = cfg.palette && PALETTES[cfg.palette] ? cfg.palette : defaultLight ? "vermilion" : "crimson";
      const fallbackDark = cfg.theme !== "alabaster";

      const norm = await rasterizeAndNormalizeSubject(cfg.subject.svg, fallbackDark);
      const maskRgba = cfg.subject.refractMaskSvg
        ? await rasterizeSvg(cfg.subject.refractMaskSvg, "#000000")
        : null;

      const tonalRichness = measureTonalRichness(norm);
      const shearMask = buildRefractMask(norm, maskRgba, cfg.subject.refractStrength);

      const sanctuary = resolveSanctuary(cfg, norm.sourceIsDark);
      const typo = layoutFramelessTypography(ctx, cfg, sanctuary);

      let stats;
      let sliceCount = 0;

      if (style === "optics") {
        stats = renderOptics(ctx, norm, shearMask, cfg, sanctuary, typo, palName);
        sliceCount = stats.slices;
      } else if (style === "riso") {
        stats = renderRiso(ctx, norm, shearMask, cfg, sanctuary, typo, palName);
        sliceCount = stats.slices;
      } else if (style === "contour") {
        stats = renderContour(ctx, norm, shearMask, cfg, sanctuary, typo, palName);
        sliceCount = stats.slices;
      } else if (style === "alabaster") {
        const dayField = extractLightField(norm, cfg.strata);
        const { gridRGB, slices } = refractFieldToGrid(dayField, norm.accent, cfg.strata, cfg.seed, shearMask, {
          shearScale: 0.85,
          dispScale: 0.70,
          streakScale: 0.78,
          streakMix: 0.32,
          upperStreakMix: 0.14,
          couplingAdaptive: true,
          cyanPairedDisp: false,
        });
        sliceCount = slices.length;
        stats = renderAlabasterMosaic(ctx, gridRGB, cfg, sanctuary, typo, palName);
      } else {
        const hdrField = extractDarkField(norm, cfg.strata, palName);
        const { gridRGB, gridAcc, slices } = refractFieldToGrid(hdrField, norm.accent, cfg.strata, cfg.seed, shearMask, {
          shearScale: 1.0,
          dispScale: 1.0,
          streakScale: 1.0,
          streakMix: 0.44,
          upperStreakMix: 0.16,
          couplingAdaptive: true,
          cyanPairedDisp: true,
        });
        sliceCount = slices.length;
        stats = renderObsidianMosaic(ctx, gridRGB, gridAcc, cfg, sanctuary, typo, palName);
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
        style,
        palette: palName,
        sourceIsDark: norm.sourceIsDark,
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

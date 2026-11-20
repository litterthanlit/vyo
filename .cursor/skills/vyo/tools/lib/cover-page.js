// Runs in a cover's page after geometry.mjs, silhouettes.mjs, mask.mjs, shape-relief.mjs and cover.mjs (render
// concatenates them): builds the same model `vyo sketch` builds in Node, draws the still into the canvas in the
// chosen look (living, xerox or spin) and 3D finish (type, studio, halftone, wireframe), and gives render one
// frame at a time for the loop.
(async () => {
  const F = JSON.parse(document.getElementById("figure").textContent);
  setMaskImages((name) => F.images[name]);
  await window.fontsReady;
  const m = coverModel(F.region, F.parts, {
    ground: F.ground,
    texts: F.texts,
    look: F.look,
    format: F.format,
    crop: F.crop,
    layout: F.layout ?? "classic",
    finish: F.finish ?? "type",
  });
  const { cols: COLS, rows: ROWS, cw: CW, lh: LH, x0: X0, width: W, height: H } = m.grid;
  const R = RELIEF;
  const TONES = m.tones;
  const cv = document.getElementById("cover");
  const ctx = cv.getContext("2d");
  const glow = document.createElement("canvas");
  const gctx = glow.getContext("2d");
  const MONO = '"Commit Mono", monospace';
  const GROT = '"Inter Display", Inter, sans-serif';
  const hexRgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  const rgba = (hex, a) => {
    const [r, g, b] = hexRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };
  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
  const pxHash = (x, y, s) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const seed = [...(F.texts.name + (F.commit || "vyo"))].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261) % 997 + 1;

  /** Torn-edge highlighter block painted onto an alpha plate. */
  function paintMarker(pctx, x, y, w, h, s) {
    pctx.save();
    pctx.translate(x + w / 2, y + h / 2);
    pctx.rotate(((pxHash(s, 1, 3) - 0.5) * 2.2 * Math.PI) / 180);
    pctx.fillRect(-w / 2, -h / 2, w, h);
    for (let i = 0; i < 20; i++) {
      const yy = -h / 2 + pxHash(s, i, 5) * h;
      pctx.fillRect(w / 2, yy, pxHash(s, i, 6) * 6, 1 + pxHash(s, i, 7) * 1.8);
      pctx.fillRect(-w / 2 - pxHash(s, i, 8) * 5, yy, pxHash(s, i, 8) * 5, 1 + pxHash(s, i, 9) * 1.8);
    }
    pctx.restore();
  }

  /** Lazily allocated high-resolution studio buffers shared across studio, halftone, and wireframe finishes. */
  let studioState = null;
  function getStudioState() {
    if (studioState) return studioState;
    const rw = W;
    const rh = H;
    const tot = rw * rh;
    const sw = Math.ceil(rw / 4);
    const sh = Math.ceil(rh / 4);
    const sCanvas = document.createElement("canvas");
    sCanvas.width = rw;
    sCanvas.height = rh;
    const sCtx = sCanvas.getContext("2d");
    const sImg = sCtx.createImageData(rw, rh);
    const gBufCanvas = document.createElement("canvas");
    gBufCanvas.width = rw;
    gBufCanvas.height = rh;
    const gBufCtx = gBufCanvas.getContext("2d");
    const gImg = gBufCtx.createImageData(rw, rh);
    studioState = {
      rw, rh, tot, sw, sh,
      zbuf: new Float32Array(tot),
      whoBuf: new Int32Array(tot),
      partBuf: new Int16Array(tot),
      nxBuf: new Float32Array(tot),
      nyBuf: new Float32Array(tot),
      nzBuf: new Float32Array(tot),
      aoBuf: new Float32Array(tot),
      nxTmp: new Float32Array(tot),
      nyTmp: new Float32Array(tot),
      nzTmp: new Float32Array(tot),
      covBuf: new Float32Array(tot),
      aaSrcBuf: new Int32Array(tot),
      shBuf: new Float32Array(sw * sh),
      shSrc: new Float32Array(sw * sh),
      hist: new Int32Array(4096),
      sCanvas, sCtx, sImg,
      gBufCanvas, gBufCtx, gImg,
      wireCache: null,
    };
    return studioState;
  }

  /** Find exact quantile threshold over `hist` (4096 bins) covering `targetCount` items in [vMin, vMax]. */
  function histQuantile(hist, targetCount, vMin, vMax) {
    const span = vMax - vMin || 1;
    let acc = 0;
    for (let b = 0; b < 4096; b++) {
      const next = acc + hist[b];
      if (next >= targetCount) {
        const frac = hist[b] ? (targetCount - acc) / hist[b] : 0;
        return vMin + ((b + frac) / 4096) * span;
      }
      acc = next;
    }
    return vMax;
  }

  /**
   * High-resolution 3D studio buffer rasterizer: projects m.S onto a CSS-px grid with splat + 1-pass hole fill,
   * edge-preserving normal smoothing, O(N) histogram strata part assignment matching coverCells, and a smooth
   * softbox cast shadow.
   */
  function rasterizeStudio(f) {
    const st = getStudioState();
    const { rw, rh, tot, sw, sh, zbuf, whoBuf, partBuf, nxBuf, nyBuf, nzBuf, aoBuf, nxTmp, nyTmp, nzTmp, covBuf, aaSrcBuf, shBuf, shSrc, hist } = st;
    const N = m.frames;
    f = ((f % N) + N) % N;
    const { S, fit: FIT, focal: FOCAL, parts: PARTS, look: LOOK } = m;
    const t = f / N;
    const yaw = LOOK === "spin" ? 2 * Math.PI * t : m.turn.yaw * Math.sin(2 * Math.PI * t) * COVER_RAD;
    const pitch = (LOOK === "spin" ? (m.turn.pitch ?? 14) : m.turn.pitch * Math.cos(2 * Math.PI * t)) * COVER_RAD;
    const lean = m.turn.lean * COVER_RAD;
    const [cy, sy, cp, sp, cl, sl] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch), Math.cos(lean), Math.sin(lean)];

    zbuf.fill(-Infinity);
    whoBuf.fill(-1);
    partBuf.fill(-1);

    const [SX, SY, SZ, SNX, SNY, SNZ, SAO, SKEY, SN] = [S.x, S.y, S.z, S.nx, S.ny, S.nz, S.ao, S.key, S.n];
    const [FS, FOX, FOY] = [FIT.s, FIT.ox, FIT.oy];
    const rad = Math.max(1, Math.min(3, Math.ceil(COVER.cell * FS * 0.78)));
    const rad2 = rad * rad + 1;

    for (let j = 0; j < SN; j++) {
      const px = SX[j];
      const py = SY[j];
      const pz = SZ[j];
      const x1 = px * cy + pz * sy;
      const z1 = -px * sy + pz * cy;
      const y2 = py * cp - z1 * sp;
      const z = py * sp + z1 * cp;
      const x = x1 * cl - y2 * sl;
      const y = x1 * sl + y2 * cl;
      const k = (FOCAL / (FOCAL - z)) * FS;
      const cxp = Math.round(FOX + x * k);
      const cyp = Math.round(FOY + y * k);
      if (cxp + rad < 0 || cyp + rad < 0 || cxp - rad >= rw || cyp - rad >= rh) continue;
      for (let dy = -rad; dy <= rad; dy++) {
        const yy = cyp + dy;
        if (yy < 0 || yy >= rh) continue;
        const rowOff = yy * rw;
        const dy2 = dy * dy;
        for (let dx = -rad; dx <= rad; dx++) {
          if (rad >= 2 && dx * dx + dy2 > rad2) continue;
          const xx = cxp + dx;
          if (xx < 0 || xx >= rw) continue;
          const idx = rowOff + xx;
          const zb = z - 0.025 * (dx * dx + dy2);
          if (zb > zbuf[idx]) {
            zbuf[idx] = zb;
            whoBuf[idx] = j;
          }
        }
      }
    }

    // 1-pass hole fill so the 3D surface is 100% solid with zero pinholes on steep slopes.
    for (let py = 1; py < rh - 1; py++) {
      const rowOff = py * rw;
      for (let px = 1; px < rw - 1; px++) {
        const idx = rowOff + px;
        if (whoBuf[idx] >= 0) continue;
        const l = whoBuf[idx - 1];
        const r = whoBuf[idx + 1];
        const u = whoBuf[idx - rw];
        const d = whoBuf[idx + rw];
        const cnt = (l >= 0 ? 1 : 0) + (r >= 0 ? 1 : 0) + (u >= 0 ? 1 : 0) + (d >= 0 ? 1 : 0);
        if (cnt >= 3 || (l >= 0 && r >= 0 && Math.abs(zbuf[idx - 1] - zbuf[idx + 1]) < 18) || (u >= 0 && d >= 0 && Math.abs(zbuf[idx - rw] - zbuf[idx + rw]) < 18)) {
          let bestJ = -1;
          let bestZ = -Infinity;
          if (l >= 0 && zbuf[idx - 1] > bestZ) [bestJ, bestZ] = [l, zbuf[idx - 1]];
          if (r >= 0 && zbuf[idx + 1] > bestZ) [bestJ, bestZ] = [r, zbuf[idx + 1]];
          if (u >= 0 && zbuf[idx - rw] > bestZ) [bestJ, bestZ] = [u, zbuf[idx - rw]];
          if (d >= 0 && zbuf[idx + rw] > bestZ) [bestJ, bestZ] = [d, zbuf[idx + rw]];
          whoBuf[idx] = bestJ;
          zbuf[idx] = bestZ;
        }
      }
    }

    // Rotate normals, gather AO, build 1/4-res shadow occupancy, and compute key bounds.
    shSrc.fill(0);
    let visCount = 0;
    let kMin = Infinity;
    let kMax = -Infinity;
    for (let py = 0; py < rh; py++) {
      const rowOff = py * rw;
      const sRow = (py >> 2) * sw;
      for (let px = 0; px < rw; px++) {
        const idx = rowOff + px;
        const j = whoBuf[idx];
        if (j < 0) continue;
        const onx = SNX[j];
        const ony = SNY[j];
        const onz = SNZ[j];
        const x1 = onx * cy + onz * sy;
        const z1 = -onx * sy + onz * cy;
        const y2 = ony * cp - z1 * sp;
        nxTmp[idx] = x1 * cl - y2 * sl;
        nyTmp[idx] = x1 * sl + y2 * cl;
        nzTmp[idx] = ony * sp + z1 * cp;
        aoBuf[idx] = SAO ? SAO[j] : 1;
        shSrc[sRow + (px >> 2)] = 1;
        const kv = SKEY[j];
        if (kv < kMin) kMin = kv;
        if (kv > kMax) kMax = kv;
        visCount++;
      }
    }

    // Edge-preserving 3x3 normal smoothing: silky studio highlights without bleeding across depth jumps.
    for (let py = 1; py < rh - 1; py++) {
      const rowOff = py * rw;
      for (let px = 1; px < rw - 1; px++) {
        const idx = rowOff + px;
        if (whoBuf[idx] < 0) continue;
        const z0 = zbuf[idx];
        let ax = nxTmp[idx] * 2;
        let ay = nyTmp[idx] * 2;
        let az = nzTmp[idx] * 2;
        for (let dy = -1; dy <= 1; dy++) {
          const nRow = idx + dy * rw;
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const ni = nRow + dx;
            if (whoBuf[ni] >= 0 && Math.abs(zbuf[ni] - z0) < 18) {
              ax += nxTmp[ni];
              ay += nyTmp[ni];
              az += nzTmp[ni];
            }
          }
        }
        const inv = 1 / (Math.hypot(ax, ay, az) || 1);
        nxBuf[idx] = ax * inv;
        nyBuf[idx] = ay * inv;
        nzBuf[idx] = az * inv;
      }
    }

    // Exact per-pixel partIndex assignment matching strata order and part shares via 4096-bin histogram.
    const P = PARTS.length;
    if (visCount > 0 && P > 0) {
      const kSpan = kMax - kMin || 1;
      if (m.strata.outline && m.hot >= 0 && P > 1) {
        hist.fill(0);
        for (let idx = 0; idx < tot; idx++) {
          const j = whoBuf[idx];
          if (j < 0) continue;
          const b = Math.min(4095, Math.max(0, ((SKEY[j] - kMin) / kSpan * 4095) | 0));
          hist[b]++;
        }
        const hotTarget = Math.round(PARTS[m.hot].share * visCount);
        const kShell = histQuantile(hist, hotTarget, kMin, kMax);
        let yMin = Infinity;
        let yMax = -Infinity;
        let innerCount = 0;
        for (let idx = 0; idx < tot; idx++) {
          const j = whoBuf[idx];
          if (j < 0) continue;
          if (SKEY[j] <= kShell) partBuf[idx] = m.hot;
          else {
            const yv = SY[j];
            if (yv < yMin) yMin = yv;
            if (yv > yMax) yMax = yv;
            innerCount++;
          }
        }
        const innerOrder = m.order.slice(1);
        const innerShareSum = innerOrder.reduce((s, pi) => s + PARTS[pi].share, 0) || 1;
        const ySpan = yMax - yMin || 1;
        hist.fill(0);
        for (let idx = 0; idx < tot; idx++) {
          const j = whoBuf[idx];
          if (j < 0 || partBuf[idx] === m.hot) continue;
          const b = Math.min(4095, Math.max(0, ((SY[j] - yMin) / ySpan * 4095) | 0));
          hist[b]++;
        }
        const cuts = [];
        let acc = 0;
        for (let k = 0; k < innerOrder.length - 1; k++) {
          acc += PARTS[innerOrder[k]].share / innerShareSum;
          cuts.push(histQuantile(hist, Math.round(acc * innerCount), yMin, yMax));
        }
        for (let idx = 0; idx < tot; idx++) {
          const j = whoBuf[idx];
          if (j < 0 || partBuf[idx] === m.hot) continue;
          const yv = SY[j];
          let slot = 0;
          while (slot < cuts.length && yv > cuts[slot]) slot++;
          partBuf[idx] = innerOrder[slot];
        }
      } else {
        hist.fill(0);
        for (let idx = 0; idx < tot; idx++) {
          const j = whoBuf[idx];
          if (j < 0) continue;
          const b = Math.min(4095, Math.max(0, ((SKEY[j] - kMin) / kSpan * 4095) | 0));
          hist[b]++;
        }
        const cuts = [];
        let acc = 0;
        for (let k = 0; k < P - 1; k++) {
          acc += PARTS[m.order[k]].share;
          cuts.push(histQuantile(hist, Math.round(acc * visCount), kMin, kMax));
        }
        for (let idx = 0; idx < tot; idx++) {
          const j = whoBuf[idx];
          if (j < 0) continue;
          const kv = SKEY[j];
          let slot = 0;
          while (slot < cuts.length && kv > cuts[slot]) slot++;
          partBuf[idx] = m.order[slot];
        }
      }
    }

    // Silhouette & aperture edge antialiasing: 3x3 tent kernel [1,2,1; 2,4,2; 1,2,1]/16 on occupancy,
    // refined once on boundary pixels, with nearest filled neighbor propagated to 1px fringe pixels.
    nxTmp.fill(0);
    covBuf.fill(0);
    aaSrcBuf.fill(-1);
    for (let py = 0; py < rh; py++) {
      const rowOff = py * rw;
      if (py === 0 || py === rh - 1) {
        for (let px = 0; px < rw; px++) {
          const idx = rowOff + px;
          if (whoBuf[idx] >= 0) {
            nxTmp[idx] = 1;
            covBuf[idx] = 1;
            aaSrcBuf[idx] = idx;
          }
        }
        continue;
      }
      for (let px = 0; px < rw; px++) {
        const idx = rowOff + px;
        if (px === 0 || px === rw - 1) {
          if (whoBuf[idx] >= 0) {
            nxTmp[idx] = 1;
            covBuf[idx] = 1;
            aaSrcBuf[idx] = idx;
          }
          continue;
        }
        const c = whoBuf[idx] >= 0 ? 1 : 0;
        const l = whoBuf[idx - 1] >= 0 ? 1 : 0;
        const r = whoBuf[idx + 1] >= 0 ? 1 : 0;
        const u = whoBuf[idx - rw] >= 0 ? 1 : 0;
        const d = whoBuf[idx + rw] >= 0 ? 1 : 0;
        const ul = whoBuf[idx - rw - 1] >= 0 ? 1 : 0;
        const ur = whoBuf[idx - rw + 1] >= 0 ? 1 : 0;
        const dl = whoBuf[idx + rw - 1] >= 0 ? 1 : 0;
        const dr = whoBuf[idx + rw + 1] >= 0 ? 1 : 0;
        const sum = (c << 2) + ((l + r + u + d) << 1) + ul + ur + dl + dr;
        if (sum === 16) nxTmp[idx] = 1;
        else if (sum > 0) nxTmp[idx] = sum * 0.0625;
      }
    }
    const AA_OFFS = [-1, 1, -rw, rw, -rw - 1, -rw + 1, rw - 1, rw + 1];
    for (let py = 1; py < rh - 1; py++) {
      const rowOff = py * rw;
      for (let px = 1; px < rw - 1; px++) {
        const idx = rowOff + px;
        const t = nxTmp[idx];
        if (t === 1) {
          covBuf[idx] = 1;
          aaSrcBuf[idx] = idx;
          continue;
        }
        if (t === 0) continue;
        // Boundary pixel (inner edge or 1px outer/aperture fringe): smooth coverage via tight 3x3 tent.
        const cov =
          (t * 6 +
            (nxTmp[idx - 1] + nxTmp[idx + 1] + nxTmp[idx - rw] + nxTmp[idx + rw]) * 2 +
            nxTmp[idx - rw - 1] + nxTmp[idx - rw + 1] + nxTmp[idx + rw - 1] + nxTmp[idx + rw + 1]) /
          18;
        if (cov <= 0.08) continue;
        if (whoBuf[idx] >= 0) {
          covBuf[idx] = cov;
          aaSrcBuf[idx] = idx;
        } else {
          let bestNi = -1;
          let bestZ = -Infinity;
          for (let k = 0; k < 8; k++) {
            const ni = idx + AA_OFFS[k];
            if (whoBuf[ni] < 0) continue;
            // Prefer cardinal neighbors (k < 4) over diagonals, breaking ties by highest z.
            const score = zbuf[ni] + (k < 4 ? 1000 : 0);
            if (score > bestZ) {
              bestZ = score;
              bestNi = ni;
            }
          }
          if (bestNi >= 0) {
            covBuf[idx] = cov;
            aaSrcBuf[idx] = bestNi;
          }
        }
      }
    }

    // Softbox cast shadow shifted away from upper-left key light and blurred cleanly at 1/4 res.
    const sdx = Math.round((0.052 * FIT.short) / 4);
    const sdy = Math.round((0.074 * FIT.short) / 4);
    shBuf.fill(0);
    for (let syi = 0; syi < sh; syi++) {
      const sr = syi - sdy;
      if (sr < 0 || sr >= sh) continue;
      for (let sxi = 0; sxi < sw; sxi++) {
        const sc = sxi - sdx;
        if (sc >= 0 && sc < sw) shBuf[syi * sw + sxi] = shSrc[sr * sw + sc];
      }
    }
    const sBlur = Math.max(2, Math.round((0.048 * FIT.short) / 4));
    coverBoxBlur(shBuf, sw, sh, sBlur, sBlur);

    return { st, f, rot: [cy, sy, cp, sp, cl, sl], visCount };
  }

  /** Finish: studio — silky studio-lit matte obsidian/metallic/ceramic 3D surface with Fresnel rim, bloom, grain & 5px micro-type shimmer. */
  function drawStudio(f, scale) {
    const { st } = rasterizeStudio(f);
    const { rw, rh, sw, whoBuf, partBuf, nxBuf, nyBuf, nzBuf, aoBuf, covBuf, aaSrcBuf, shBuf, sCanvas, sCtx, sImg, gBufCanvas, gBufCtx, gImg } = st;
    const pxData = sImg.data;
    const glData = gImg.data;
    glData.fill(0);
    const gRgb = hexRgb(m.colors.ground);
    const iRgb = hexRgb(m.colors.ink);
    const aRgb = hexRgb(m.colors.accent);
    const dark = m.dark;
    const hot = m.hot;
    const [fox, foy] = [m.fit.ox, m.fit.oy];
    const invW = 1 / (W * 0.68);
    const invH = 1 / (H * 0.56);
    const frameSeed = seed * 31 + f;
    const rimRgb = [iRgb[0] * 0.8 + aRgb[0] * 0.2, iRgb[1] * 0.8 + aRgb[1] * 0.2, iRgb[2] * 0.8 + aRgb[2] * 0.2];

    for (let py = 0; py < rh; py++) {
      const rowOff = py * rw;
      const dyv = (py - foy) * invH;
      const dyv2 = dyv * dyv;
      const sRow = (py >> 2) * sw;
      for (let px = 0; px < rw; px++) {
        const idx = rowOff + px;
        const p4 = idx * 4;
        const dxv = (px - fox) * invW;
        const vig = Math.exp(-(dxv * dxv + dyv2) * 1.35);
        const sh = shBuf[sRow + (px >> 2)];
        const grain = (pxHash(px, py, frameSeed) - 0.5) * (dark ? 7.2 : 8.0);

        let bgR, bgG, bgB;
        if (dark) {
          const lift = 0.032 * vig;
          const drop = 1 - 0.45 * sh;
          bgR = (gRgb[0] + (iRgb[0] - gRgb[0]) * lift) * drop;
          bgG = (gRgb[1] + (iRgb[1] - gRgb[1]) * lift) * drop;
          bgB = (gRgb[2] + (iRgb[2] - gRgb[2]) * lift) * drop;
        } else {
          const lift = 0.025 * vig;
          const drop = 0.14 * sh;
          bgR = gRgb[0] + (255 - gRgb[0]) * lift - (gRgb[0] - iRgb[0]) * drop;
          bgG = gRgb[1] + (255 - gRgb[1]) * lift - (gRgb[1] - iRgb[1]) * drop;
          bgB = gRgb[2] + (255 - gRgb[2]) * lift - (gRgb[2] - iRgb[2]) * drop;
        }

        const cov = covBuf[idx];
        const src = aaSrcBuf[idx];
        if (cov <= 0.08 || src < 0) {
          pxData[p4] = clamp255(bgR + grain);
          pxData[p4 + 1] = clamp255(bgG + grain);
          pxData[p4 + 2] = clamp255(bgB + grain);
          pxData[p4 + 3] = 255;
          continue;
        }

        const shd = coverStudioShade(nxBuf[src], nyBuf[src], nzBuf[src], aoBuf[src], dark);
        const isHot = partBuf[src] === hot;
        let sr, sg, sb;

        if (isHot) {
          if (dark) {
            const base = shd.ao * (0.44 + 0.58 * shd.diffuse + 0.24 * shd.fill);
            const sp = 0.58 * shd.spec;
            const rm = 0.44 * shd.rim;
            sr = aRgb[0] * base + (iRgb[0] - aRgb[0] * base) * sp + (aRgb[0] * 0.55 + iRgb[0] * 0.45) * rm;
            sg = aRgb[1] * base + (iRgb[1] - aRgb[1] * base) * sp + (aRgb[1] * 0.55 + iRgb[1] * 0.45) * rm;
            sb = aRgb[2] * base + (iRgb[2] - aRgb[2] * base) * sp + (aRgb[2] * 0.55 + iRgb[2] * 0.45) * rm;
            glData[p4] = aRgb[0];
            glData[p4 + 1] = aRgb[1];
            glData[p4 + 2] = aRgb[2];
            glData[p4 + 3] = clamp255((135 + 120 * shd.lum) * cov);
          } else {
            const base = shd.ao * (0.64 + 0.36 * shd.diffuse + 0.16 * shd.fill);
            const sp = 0.28 * shd.spec;
            const rimD = 0.14 * shd.rim;
            sr = aRgb[0] * base * (1 - rimD) + iRgb[0] * rimD + (255 - aRgb[0] * base) * sp;
            sg = aRgb[1] * base * (1 - rimD) + iRgb[1] * rimD + (255 - aRgb[1] * base) * sp;
            sb = aRgb[2] * base * (1 - rimD) + iRgb[2] * rimD + (255 - aRgb[2] * base) * sp;
          }
        } else if (dark) {
          const bodyT = 0.068 + (0.29 * shd.diffuse + 0.18 * shd.fill) * shd.ao;
          const specT = 0.56 * shd.spec;
          const rimT = 0.64 * shd.rim;
          sr = gRgb[0] + (iRgb[0] - gRgb[0]) * (bodyT + specT) + rimRgb[0] * rimT;
          sg = gRgb[1] + (iRgb[1] - gRgb[1]) * (bodyT + specT) + rimRgb[1] * rimT;
          sb = gRgb[2] + (iRgb[2] - gRgb[2]) * (bodyT + specT) + rimRgb[2] * rimT;
        } else {
          const lit = Math.min(1, (0.28 + 0.64 * shd.diffuse + 0.72 * shd.fill) * shd.ao);
          const shadowT = Math.min(0.72, (1 - lit) * 0.76 + 0.22 * shd.rim);
          const hiT = 0.42 * shd.spec + 0.16 * Math.max(0, shd.diffuse - 0.52) * shd.ao;
          sr = gRgb[0] * (1 - shadowT) + iRgb[0] * shadowT + (254 - gRgb[0]) * hiT;
          sg = gRgb[1] * (1 - shadowT) + iRgb[1] * shadowT + (254 - gRgb[1]) * hiT;
          sb = gRgb[2] * (1 - shadowT) + iRgb[2] * shadowT + (254 - gRgb[2]) * hiT;
        }

        const rOut = bgR * (1 - cov) + sr * cov + grain * 0.85;
        const gOut = bgG * (1 - cov) + sg * cov + grain * 0.85;
        const bOut = bgB * (1 - cov) + sb * cov + grain * 0.85;
        pxData[p4] = clamp255(rOut);
        pxData[p4 + 1] = clamp255(gOut);
        pxData[p4 + 2] = clamp255(bOut);
        pxData[p4 + 3] = 255;
      }
    }

    sCtx.putImageData(sImg, 0, 0);
    cv.width = W * scale;
    cv.height = H * scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sCanvas, 0, 0, cv.width, cv.height);

    // Tight studio bloom from emissive accent band onto surrounding sculpted surfaces.
    if (dark && hot >= 0 && m.colors.glow) {
      gBufCtx.putImageData(gImg, 0, 0);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.34 * m.colors.glow;
      ctx.filter = `blur(${14 * scale}px)`;
      ctx.drawImage(gBufCanvas, 0, 0, cv.width, cv.height);
      ctx.globalAlpha = 0.24 * m.colors.glow;
      ctx.filter = `blur(${4 * scale}px)`;
      ctx.drawImage(gBufCanvas, 0, 0, cv.width, cv.height);
      ctx.restore();
    }

    // Ultra-fine 5px micro-typography from coverCells riding specular + Fresnel highlights across the 3D surface.
    const cells = coverCells(m, f);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.textBaseline = "alphabetic";
    const groups = new Map();
    for (const c of cells) {
      if (!c.letter) continue;
      const gx = X0 + (c.i % COLS) * CW;
      const gy = Math.floor(c.i / COLS) * LH;
      const sx = Math.min(rw - 1, Math.max(0, Math.round(gx + CW * 0.5)));
      const sy = Math.min(rh - 1, Math.max(0, Math.round(gy + LH * 0.5)));
      const idx = sy * rw + sx;
      if (whoBuf[idx] < 0) continue;
      const shd = coverStudioShade(nxBuf[idx], nyBuf[idx], nzBuf[idx], aoBuf[idx], dark);
      const isHot = c.part === hot;
      const rawA = isHot
        ? 0.16 + 0.18 * shd.diffuse + 0.22 * shd.spec + 0.18 * shd.rim
        : 0.06 + 0.14 * shd.diffuse + 0.28 * shd.spec + 0.28 * shd.rim;
      const alpha = Math.round(Math.min(0.46, Math.max(0.06, rawA)) * 25) / 25;
      const weight = isHot || shd.spec > 0.22 || shd.rim > 0.34 ? 700 : 400;
      const col = isHot ? (dark ? m.colors.ink : m.colors.ground) : m.colors.ink;
      const key = `${col}|${weight}|${alpha}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ ch: c.ch, x: gx + 0.3, y: gy + LH * 0.82 });
    }
    for (const [key, list] of groups) {
      const [col, weight, alpha] = key.split("|");
      ctx.font = `${weight} 5px ${MONO}`;
      ctx.fillStyle = rgba(col, +alpha);
      for (const item of list) ctx.fillText(item.ch, item.x, item.y);
    }
  }

  /** Finish: halftone — precision 22.5-deg rotated dot-matrix sampled from the studio buffer with accent bloom. */
  function drawHalftone(f, scale) {
    const { st } = rasterizeStudio(f);
    const { rw, rh, sw, whoBuf, partBuf, nxBuf, nyBuf, nzBuf, aoBuf, shBuf, sCanvas, sCtx, sImg } = st;
    const gRgb = hexRgb(m.colors.ground);
    const dark = m.dark;
    const hot = m.hot;
    const frameSeed = seed * 37 + f;

    // Subtle grained background canvas.
    const pxData = sImg.data;
    for (let py = 0; py < rh; py++) {
      const rowOff = py * rw;
      for (let px = 0; px < rw; px++) {
        const p4 = (rowOff + px) * 4;
        const grain = (pxHash(px, py, frameSeed) - 0.5) * (dark ? 6.5 : 7.5);
        pxData[p4] = clamp255(gRgb[0] + grain);
        pxData[p4 + 1] = clamp255(gRgb[1] + grain);
        pxData[p4 + 2] = clamp255(gRgb[2] + grain);
        pxData[p4 + 3] = 255;
      }
    }
    sCtx.putImageData(sImg, 0, 0);
    cv.width = W * scale;
    cv.height = H * scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(sCanvas, 0, 0, cv.width, cv.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Rotated 22.5-degree dot-matrix lattice (pitch 5.2px).
    const angle = (22.5 * Math.PI) / 180;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const pitch = 5.2;
    const hcx = W / 2;
    const hcy = H / 2;
    const rMax = Math.hypot(W, H) * 0.54;
    const inkDots = [];
    const hotDots = [];
    const shadowDots = [];

    for (let v = -rMax; v <= rMax; v += pitch) {
      for (let u = -rMax; u <= rMax; u += pitch) {
        const x = hcx + u * ca - v * sa;
        const y = hcy + u * sa + v * ca;
        if (x < 0 || x >= rw || y < 0 || y >= rh) continue;
        const px = x | 0;
        const py = y | 0;
        const idx = py * rw + px;
        if (whoBuf[idx] < 0) {
          const sh = shBuf[(py >> 2) * sw + (px >> 2)];
          if (sh > 0.14) shadowDots.push(x, y, 0.38 + 0.72 * sh);
          continue;
        }
        const shd = coverStudioShade(nxBuf[idx], nyBuf[idx], nzBuf[idx], aoBuf[idx], dark);
        const intensity = dark
          ? Math.min(1, Math.max(0, shd.lum * 0.94 + 0.16 * shd.spec + 0.16 * shd.rim))
          : Math.min(1, Math.max(0, 1 - shd.lum * 0.86 + 0.22 * shd.rim));
        const r = 0.4 + 1.95 * Math.pow(intensity, dark ? 0.85 : 0.9);
        if (partBuf[idx] === hot) hotDots.push(x, y, r);
        else inkDots.push(x, y, r);
      }
    }

    const fillDotList = (targetCtx, list, style) => {
      if (!list.length) return;
      targetCtx.fillStyle = style;
      targetCtx.beginPath();
      for (let i = 0; i < list.length; i += 3) {
        const x = list[i];
        const y = list[i + 1];
        const r = list[i + 2];
        targetCtx.moveTo(x + r, y);
        targetCtx.arc(x, y, r, 0, Math.PI * 2);
      }
      targetCtx.fill();
    };

    fillDotList(ctx, shadowDots, rgba(m.colors.ink, dark ? 0.09 : 0.11));

    if (dark && hotDots.length && m.colors.glow) {
      glow.width = cv.width;
      glow.height = cv.height;
      gctx.setTransform(scale, 0, 0, scale, 0, 0);
      gctx.clearRect(0, 0, W, H);
      fillDotList(gctx, hotDots, m.colors.accent);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.42 * m.colors.glow;
      ctx.filter = `blur(${9 * scale}px)`;
      ctx.drawImage(glow, 0, 0);
      ctx.restore();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }

    fillDotList(ctx, inkDots, m.colors.ink);
    fillDotList(ctx, hotDots, m.colors.accent);
  }

  /** Build cached 3D solid-space wireframe segments (latitude, longitude, elevation iso-contours) from m.solid. */
  function getWireframeSegments(st) {
    if (st.wireCache) return st.wireCache;
    const { solid, S } = m;
    const { w, h, cell, inside, half, mid, kind } = solid;
    const cx = S.cx ?? (w * cell) / 2;
    const cy = S.cy ?? (h * cell) / 2;
    const extHalf = S.extHalf ?? Math.max(8, Math.min(w, h) * cell * 0.14 * (solid.depth ?? 1));
    const segs = []; // flat [x0, y0, z0, x1, y1, z1, ...]
    const pushSeg = (x0, y0, z0, x1, y1, z1) => segs.push(x0, y0, z0, x1, y1, z1);

    if (kind === "revolve") {
      const rads = new Float32Array(h);
      for (let gy = 0; gy < h; gy++) {
        let rm = 0;
        for (let gx = 0; gx < w; gx++) {
          if (inside[gy * w + gx]) rm = Math.max(rm, Math.abs((gx + 0.5) * cell - cx));
        }
        rads[gy] = rm;
      }
      const step = Math.max(4, Math.round(14 / cell));
      // Latitude rings every ~14px.
      for (let gy = 2; gy < h - 2; gy += step) {
        const rad = rads[gy];
        if (rad < 2) continue;
        const y = (gy + 0.5) * cell - cy;
        const N = 40;
        for (let s = 0; s < N; s++) {
          const a0 = (2 * Math.PI * s) / N;
          const a1 = (2 * Math.PI * (s + 1)) / N;
          pushSeg(rad * Math.sin(a0), y, rad * Math.cos(a0), rad * Math.sin(a1), y, rad * Math.cos(a1));
        }
      }
      // 16 longitude meridians.
      const M = 16;
      for (let k = 0; k < M; k++) {
        const a = (2 * Math.PI * k) / M;
        const sa = Math.sin(a);
        const ca = Math.cos(a);
        let prev = null;
        for (let gy = 1; gy < h - 1; gy += 2) {
          const rad = rads[gy];
          if (rad < 1) {
            prev = null;
            continue;
          }
          const pt = [rad * sa, (gy + 0.5) * cell - cy, rad * ca];
          if (prev) pushSeg(prev[0], prev[1], prev[2], pt[0], pt[1], pt[2]);
          prev = pt;
        }
      }
      st.wireCache = new Float32Array(segs);
      return st.wireCache;
    }

    const frontZ = (i) => (kind === "extrude" ? Math.min(extHalf, extHalf * 0.86 + Math.min(extHalf * 0.14, half[i] * 0.12)) : mid[i] + half[i]);
    const backZ = (i) => (kind === "extrude" ? -frontZ(i) : mid[i] - half[i]);
    const step = Math.max(4, Math.round(14 / cell));

    // Latitude iso-lines (constant y every ~14px, front and back).
    for (let gy = Math.floor(step / 2); gy < h - 1; gy += step) {
      const y = (gy + 0.5) * cell - cy;
      let prevF = null;
      let prevB = null;
      for (let gx = 1; gx < w - 1; gx += 2) {
        const i = gy * w + gx;
        if (!inside[i]) {
          prevF = null;
          prevB = null;
          continue;
        }
        const x = (gx + 0.5) * cell - cx;
        const zf = frontZ(i);
        const zb = backZ(i);
        if (prevF) pushSeg(prevF[0], y, prevF[1], x, y, zf);
        if (prevB) pushSeg(prevB[0], y, prevB[1], x, y, zb);
        prevF = [x, zf];
        prevB = [x, zb];
      }
    }

    // Longitude iso-lines (constant x every ~14px, front and back).
    for (let gx = Math.floor(step / 2); gx < w - 1; gx += step) {
      const x = (gx + 0.5) * cell - cx;
      let prevF = null;
      let prevB = null;
      for (let gy = 1; gy < h - 1; gy += 2) {
        const i = gy * w + gx;
        if (!inside[i]) {
          prevF = null;
          prevB = null;
          continue;
        }
        const y = (gy + 0.5) * cell - cy;
        const zf = frontZ(i);
        const zb = backZ(i);
        if (prevF) pushSeg(x, prevF[0], prevF[1], x, y, zf);
        if (prevB) pushSeg(x, prevB[0], prevB[1], x, y, zb);
        prevF = [y, zf];
        prevB = [y, zb];
      }
    }

    // Elevation contour rings via marching squares (iso-z every 14px in solid space).
    let maxZ = 0;
    let minZ = 0;
    for (let i = 0; i < inside.length; i++) {
      if (!inside[i]) continue;
      maxZ = Math.max(maxZ, frontZ(i));
      minZ = Math.min(minZ, backZ(i));
    }
    const marchField = (zAt, levels, invert = false) => {
      const stride = 2;
      for (const lv of levels) {
        for (let gy = 1; gy < h - stride - 1; gy += stride) {
          for (let gx = 1; gx < w - stride - 1; gx += stride) {
            const i00 = gy * w + gx;
            const i10 = gy * w + (gx + stride);
            const i11 = (gy + stride) * w + (gx + stride);
            const i01 = (gy + stride) * w + gx;
            const v00 = inside[i00] ? (invert ? lv - zAt(i00) : zAt(i00) - lv) : -999;
            const v10 = inside[i10] ? (invert ? lv - zAt(i10) : zAt(i10) - lv) : -999;
            const v11 = inside[i11] ? (invert ? lv - zAt(i11) : zAt(i11) - lv) : -999;
            const v01 = inside[i01] ? (invert ? lv - zAt(i01) : zAt(i01) - lv) : -999;
            const mask = (v00 > 0 ? 1 : 0) | (v10 > 0 ? 2 : 0) | (v11 > 0 ? 4 : 0) | (v01 > 0 ? 8 : 0);
            if (mask === 0 || mask === 15) continue;
            const x0 = (gx + 0.5) * cell - cx;
            const y0 = (gy + 0.5) * cell - cy;
            const d = stride * cell;
            const pts = [];
            const interp = (a, b) => Math.min(1, Math.max(0, a / (a - b)));
            if ((mask & 1) !== ((mask >> 1) & 1)) pts.push([x0 + interp(v00, v10) * d, y0]);
            if (((mask >> 1) & 1) !== ((mask >> 2) & 1)) pts.push([x0 + d, y0 + interp(v10, v11) * d]);
            if (((mask >> 2) & 1) !== ((mask >> 3) & 1)) pts.push([x0 + (1 - interp(v11, v01)) * d, y0 + d]);
            if (((mask >> 3) & 1) !== (mask & 1)) pts.push([x0, y0 + (1 - interp(v01, v00)) * d]);
            if (pts.length >= 2) pushSeg(pts[0][0], pts[0][1], lv, pts[1][0], pts[1][1], lv);
            if (pts.length === 4) pushSeg(pts[2][0], pts[2][1], lv, pts[3][0], pts[3][1], lv);
          }
        }
      }
    };
    const posLevels = [];
    for (let lv = 7; lv < maxZ - 2; lv += 14) posLevels.push(lv);
    const negLevels = [];
    for (let lv = -7; lv > minZ + 2; lv -= 14) negLevels.push(lv);
    if (kind === "extrude") {
      marchField(frontZ, [extHalf * 0.5], false);
      marchField(backZ, [-extHalf * 0.5], true);
    } else {
      marchField(frontZ, posLevels, false);
      marchField(backZ, negLevels, true);
    }
    st.wireCache = new Float32Array(segs);
    return st.wireCache;
  }

  /** Finish: wireframe — smoked-glass Fresnel body with depth-tested 3D latitude, longitude & elevation contour hairlines. */
  function drawWireframe(f, scale) {
    const { st, rot } = rasterizeStudio(f);
    const { rw, rh, sw, zbuf, whoBuf, partBuf, nxBuf, nyBuf, nzBuf, aoBuf, covBuf, aaSrcBuf, shBuf, sCanvas, sCtx, sImg } = st;
    const [cy, sy, cp, sp, cl, sl] = rot;
    const pxData = sImg.data;
    const gRgb = hexRgb(m.colors.ground);
    const iRgb = hexRgb(m.colors.ink);
    const aRgb = hexRgb(m.colors.accent);
    const dark = m.dark;
    const hot = m.hot;
    const [fox, foy] = [m.fit.ox, m.fit.oy];
    const invW = 1 / (W * 0.68);
    const invH = 1 / (H * 0.56);
    const frameSeed = seed * 41 + f;

    // Pass 1: Translucent sculpted smoked-glass body + radiant Fresnel rim silhouette glow with smooth edge AA.
    for (let py = 0; py < rh; py++) {
      const rowOff = py * rw;
      const dyv = (py - foy) * invH;
      const dyv2 = dyv * dyv;
      const sRow = (py >> 2) * sw;
      for (let px = 0; px < rw; px++) {
        const idx = rowOff + px;
        const p4 = idx * 4;
        const dxv = (px - fox) * invW;
        const vig = Math.exp(-(dxv * dxv + dyv2) * 1.4);
        const sh = shBuf[sRow + (px >> 2)];
        const grain = (pxHash(px, py, frameSeed) - 0.5) * (dark ? 6.5 : 7.2);

        const bgR = dark ? (gRgb[0] + (iRgb[0] - gRgb[0]) * 0.025 * vig) * (1 - 0.35 * sh) : gRgb[0] - (gRgb[0] - iRgb[0]) * 0.08 * sh;
        const bgG = dark ? (gRgb[1] + (iRgb[1] - gRgb[1]) * 0.025 * vig) * (1 - 0.35 * sh) : gRgb[1] - (gRgb[1] - iRgb[1]) * 0.08 * sh;
        const bgB = dark ? (gRgb[2] + (iRgb[2] - gRgb[2]) * 0.025 * vig) * (1 - 0.35 * sh) : gRgb[2] - (gRgb[2] - iRgb[2]) * 0.08 * sh;

        const cov = covBuf[idx];
        const src = aaSrcBuf[idx];
        if (cov <= 0.08 || src < 0) {
          pxData[p4] = clamp255(bgR + grain);
          pxData[p4 + 1] = clamp255(bgG + grain);
          pxData[p4 + 2] = clamp255(bgB + grain);
          pxData[p4 + 3] = 255;
          continue;
        }

        const shd = coverStudioShade(nxBuf[src], nyBuf[src], nzBuf[src], aoBuf[src], dark);
        const isHot = partBuf[src] === hot;
        let sr, sg, sb;
        if (dark) {
          const glass = 0.04 + (0.14 * shd.diffuse + 0.08 * shd.fill) * shd.ao;
          const spec = 0.36 * shd.spec;
          const rim = 0.72 * shd.rim;
          const hotTint = isHot ? 0.24 : 0;
          const rimR = isHot ? aRgb[0] * 0.85 + iRgb[0] * 0.15 : iRgb[0] * 0.82 + aRgb[0] * 0.18;
          const rimG = isHot ? aRgb[1] * 0.85 + iRgb[1] * 0.15 : iRgb[1] * 0.82 + aRgb[1] * 0.18;
          const rimB = isHot ? aRgb[2] * 0.85 + iRgb[2] * 0.15 : iRgb[2] * 0.82 + aRgb[2] * 0.18;
          sr = bgR + (iRgb[0] - bgR) * (glass + spec) + (aRgb[0] - bgR) * hotTint * (0.45 + 0.55 * shd.diffuse) + rimR * rim;
          sg = bgG + (iRgb[1] - bgG) * (glass + spec) + (aRgb[1] - bgG) * hotTint * (0.45 + 0.55 * shd.diffuse) + rimG * rim;
          sb = bgB + (iRgb[2] - bgB) * (glass + spec) + (aRgb[2] - bgB) * hotTint * (0.45 + 0.55 * shd.diffuse) + rimB * rim;
        } else {
          const veil = 0.07 + 0.16 * (1 - shd.lum) * shd.ao + 0.34 * shd.rim;
          const tint = isHot ? aRgb : iRgb;
          sr = bgR * (1 - veil) + tint[0] * veil;
          sg = bgG * (1 - veil) + tint[1] * veil;
          sb = bgB * (1 - veil) + tint[2] * veil;
        }
        const rOut = bgR * (1 - cov) + sr * cov + grain * 0.8;
        const gOut = bgG * (1 - cov) + sg * cov + grain * 0.8;
        const bOut = bgB * (1 - cov) + sb * cov + grain * 0.8;
        pxData[p4] = clamp255(rOut);
        pxData[p4 + 1] = clamp255(gOut);
        pxData[p4 + 2] = clamp255(bOut);
        pxData[p4 + 3] = 255;
      }
    }

    sCtx.putImageData(sImg, 0, 0);
    cv.width = W * scale;
    cv.height = H * scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sCanvas, 0, 0, cv.width, cv.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Pass 2: Depth-tested projected 3D latitude, longitude, and elevation contour hairlines.
    const segs = getWireframeSegments(st);
    const { fit: FIT, focal: FOCAL } = m;
    const [FS, FOX, FOY] = [FIT.s, FIT.ox, FIT.oy];
    const backInk = [];
    const backHot = [];
    const frontInk = [];
    const frontHot = [];

    for (let i = 0; i < segs.length; i += 6) {
      const ax = segs[i];
      const ay = segs[i + 1];
      const az = segs[i + 2];
      const bx = segs[i + 3];
      const by = segs[i + 4];
      const bz = segs[i + 5];

      const ax1 = ax * cy + az * sy;
      const az1 = -ax * sy + az * cy;
      const ay2 = ay * cp - az1 * sp;
      const z0 = ay * sp + az1 * cp;
      const x0 = ax1 * cl - ay2 * sl;
      const y0 = ax1 * sl + ay2 * cl;
      const k0 = (FOCAL / (FOCAL - z0)) * FS;
      const sx0 = FOX + x0 * k0;
      const sy0 = FOY + y0 * k0;

      const bx1 = bx * cy + bz * sy;
      const bz1 = -bx * sy + bz * cy;
      const by2 = by * cp - bz1 * sp;
      const z1 = by * sp + bz1 * cp;
      const x1 = bx1 * cl - by2 * sl;
      const y1 = bx1 * sl + by2 * cl;
      const k1 = (FOCAL / (FOCAL - z1)) * FS;
      const sx1 = FOX + x1 * k1;
      const sy1 = FOY + y1 * k1;

      const mx = Math.round((sx0 + sx1) * 0.5);
      const my = Math.round((sy0 + sy1) * 0.5);
      if (mx < 0 || mx >= rw || my < 0 || my >= rh) continue;
      const mi = my * rw + mx;
      if (whoBuf[mi] < 0) continue;
      const zMid = (z0 + z1) * 0.5;
      const front = zMid >= zbuf[mi] - 5.5;
      const isHot = partBuf[mi] === hot;
      if (front) {
        if (isHot) frontHot.push(sx0, sy0, sx1, sy1);
        else frontInk.push(sx0, sy0, sx1, sy1);
      } else {
        if (isHot) backHot.push(sx0, sy0, sx1, sy1);
        else backInk.push(sx0, sy0, sx1, sy1);
      }
    }

    const strokeSegs = (targetCtx, list, style, width) => {
      if (!list.length) return;
      targetCtx.strokeStyle = style;
      targetCtx.lineWidth = width;
      targetCtx.beginPath();
      for (let i = 0; i < list.length; i += 4) {
        targetCtx.moveTo(list[i], list[i + 1]);
        targetCtx.lineTo(list[i + 2], list[i + 3]);
      }
      targetCtx.stroke();
    };

    // Back-facing smoked-glass ghost lines.
    strokeSegs(ctx, backInk, rgba(m.colors.ink, dark ? 0.14 : 0.12), 0.65);
    strokeSegs(ctx, backHot, rgba(m.colors.accent, dark ? 0.2 : 0.16), 0.7);

    // Front-facing crisp mesh hairlines.
    strokeSegs(ctx, frontInk, rgba(m.colors.ink, dark ? 0.72 : 0.68), 0.9);

    // Accent strata seam pixels (luminous boundary between accent and body).
    const seamPts = [];
    if (hot >= 0) {
      for (let py = 2; py < rh - 2; py += 2) {
        const rowOff = py * rw;
        for (let px = 2; px < rw - 2; px += 2) {
          const idx = rowOff + px;
          if (partBuf[idx] !== hot) continue;
          const border =
            (partBuf[idx - 2] >= 0 && partBuf[idx - 2] !== hot) ||
            (partBuf[idx + 2] >= 0 && partBuf[idx + 2] !== hot) ||
            (partBuf[idx - rw * 2] >= 0 && partBuf[idx - rw * 2] !== hot) ||
            (partBuf[idx + rw * 2] >= 0 && partBuf[idx + rw * 2] !== hot);
          if (border) seamPts.push(px, py);
        }
      }
    }

    // Bloom pass for front-facing accent wireframe & seam on dark grounds.
    if (dark && (frontHot.length || seamPts.length) && m.colors.glow) {
      glow.width = cv.width;
      glow.height = cv.height;
      gctx.setTransform(scale, 0, 0, scale, 0, 0);
      gctx.clearRect(0, 0, W, H);
      strokeSegs(gctx, frontHot, m.colors.accent, 1.4);
      if (seamPts.length) {
        gctx.fillStyle = m.colors.accent;
        for (let i = 0; i < seamPts.length; i += 2) gctx.fillRect(seamPts[i] - 0.8, seamPts[i + 1] - 0.8, 1.8, 1.8);
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.55 * m.colors.glow;
      ctx.filter = `blur(${6 * scale}px)`;
      ctx.drawImage(glow, 0, 0);
      ctx.restore();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }

    strokeSegs(ctx, frontHot, rgba(m.colors.accent, dark ? 0.96 : 0.92), 1.05);
    if (seamPts.length) {
      ctx.fillStyle = rgba(m.colors.accent, dark ? 0.95 : 0.88);
      for (let i = 0; i < seamPts.length; i += 2) ctx.fillRect(seamPts[i] - 0.6, seamPts[i + 1] - 0.6, 1.4, 1.4);
    }
  }

  /** Crisp 2x canvas chrome overlay (e.g. blueprint drafting frame, coordinate ticks A-F / 1-8, registration crosshairs). */
  function drawCanvasChrome(scale) {
    const ch = F.canvasChrome;
    if (!ch) return;
    if (ch.kind === "blueprint") {
      const { frame, inner, headerY, titleBlock: tb, box, cols, rows } = ch;
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);

      // Outer perimeter border & inner drafting field border (stopping cleanly at the title block).
      ctx.strokeStyle = rgba(m.colors.ink, 0.34);
      ctx.lineWidth = 1;
      ctx.strokeRect(frame.x + 0.5, frame.y + 0.5, frame.w - 1, frame.h - 1);
      ctx.strokeStyle = rgba(m.colors.ink, 0.16);
      ctx.lineWidth = 0.75;
      const ix0 = inner.x - 4.5;
      const iy0 = inner.y - 4.5;
      const ix1 = inner.x + inner.w + 4.5;
      const iy1 = inner.y + inner.h + 4.5;
      ctx.beginPath();
      ctx.moveTo(tb.x, iy1);
      ctx.lineTo(ix0, iy1);
      ctx.lineTo(ix0, iy0);
      ctx.lineTo(ix1, iy0);
      ctx.lineTo(ix1, tb.y);
      ctx.stroke();

      // Coordinate band divisions & mono labels A..F (top/bottom) and 1..8 (left/right).
      ctx.font = `400 7.5px ${MONO}`;
      ctx.fillStyle = rgba(m.colors.ink, 0.48);
      ctx.strokeStyle = rgba(m.colors.ink, 0.24);
      ctx.lineWidth = 0.75;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const bandTopY = (frame.y + inner.y - 4) * 0.5;
      const bandBotY = (frame.y + frame.h + inner.y + inner.h + 4) * 0.5;
      const colStep = frame.w / cols;
      for (let i = 0; i < cols; i++) {
        const cx = frame.x + (i + 0.5) * colStep;
        const lbl = String.fromCharCode(65 + i);
        ctx.fillText(lbl, cx, bandTopY);
        if (cx < tb.x - 10) ctx.fillText(lbl, cx, bandBotY);
        if (i > 0) {
          const tx = frame.x + i * colStep;
          ctx.beginPath();
          ctx.moveTo(tx, frame.y);
          ctx.lineTo(tx, inner.y - 5);
          if (tx < tb.x) {
            ctx.moveTo(tx, inner.y + inner.h + 5);
            ctx.lineTo(tx, frame.y + frame.h);
          }
          ctx.stroke();
        }
      }
      const bandLeftX = (frame.x + inner.x - 4) * 0.5;
      const bandRightX = (frame.x + frame.w + inner.x + inner.w + 4) * 0.5;
      const rowStep = frame.h / rows;
      for (let i = 0; i < rows; i++) {
        const ry = frame.y + (i + 0.5) * rowStep;
        const lbl = String(i + 1);
        ctx.fillText(lbl, bandLeftX, ry);
        if (ry < tb.y - 10) ctx.fillText(lbl, bandRightX, ry);
        if (i > 0) {
          const ty = frame.y + i * rowStep;
          ctx.beginPath();
          ctx.moveTo(frame.x, ty);
          ctx.lineTo(inner.x - 5, ty);
          if (ty < tb.y) {
            ctx.moveTo(inner.x + inner.w + 5, ty);
            ctx.lineTo(frame.x + frame.w, ty);
          }
          ctx.stroke();
        }
      }

      // Fine millimeter scale ticks along left inner edge of the art stage.
      ctx.strokeStyle = rgba(m.colors.ink, 0.2);
      ctx.beginPath();
      for (let y = Math.ceil(headerY + 12); y < tb.y - 12; y += 8) {
        const major = ((y - Math.ceil(headerY + 12)) % 40) === 0;
        ctx.moveTo(inner.x - 4.5, y);
        ctx.lineTo(inner.x - 4.5 + (major ? 6 : 3), y);
      }
      ctx.stroke();

      // Subtle architectural crosshairs strictly inside the art box (zero overlap with DOM text blocks).
      if (box) {
        ctx.strokeStyle = rgba(m.colors.ink, 0.08);
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        for (let y = Math.ceil((box.top + 32) / 80) * 80; y < box.bottom - 20; y += 80) {
          for (let x = Math.ceil((box.left + 32) / 80) * 80; x < box.right - 20; x += 80) {
            ctx.moveTo(x - 3, y);
            ctx.lineTo(x + 3, y);
            ctx.moveTo(x, y - 3);
            ctx.lineTo(x, y + 3);
          }
        }
        ctx.stroke();
      }

      // Precision registration crosshairs `+` at outer frame corners.
      const cross = (x, y, arm, style) => {
        ctx.strokeStyle = style;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - arm, y);
        ctx.lineTo(x + arm, y);
        ctx.moveTo(x, y - arm);
        ctx.lineTo(x, y + arm);
        ctx.stroke();
      };
      const crColor = rgba(m.colors.ink, 0.56);
      cross(frame.x - 10, frame.y - 10, 5, crColor);
      cross(frame.x + frame.w + 10, frame.y - 10, 5, rgba(m.colors.accent, 0.75));
      cross(frame.x - 10, frame.y + frame.h + 10, 5, crColor);
      cross(frame.x + frame.w + 10, frame.y + frame.h + 10, 5, crColor);
      ctx.restore();
    }
  }

  /** Look: living — sculpted typographic relief on a faint dot sheet with cast shadow. */
  function drawLiving(f, scale) {
    const cells = coverCells(m, f);
    const FIT = m.fit;
    cv.width = W * scale;
    cv.height = H * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = m.colors.ground;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "alphabetic";
    const q = (a) => Math.round(20 * a) / 20;

    // The sheet: a dot on every other glyph cell off the form, the form's cast shadow taking dots away on dark and darkening on light.
    const occ = new Float32Array(COLS * ROWS);
    for (const c of cells) occ[c.i] = 1;
    const [dx, dy] = [Math.round((0.045 * FIT.short) / CW), Math.round((0.065 * FIT.short) / LH)];
    const shadow = new Float32Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const [sr, sc] = [r - dy, c - dx];
      if (sr >= 0 && sc >= 0 && sr < ROWS && sc < COLS) shadow[r * COLS + c] = occ[sr * COLS + sc];
    }
    coverBoxBlur(shadow, COLS, ROWS, Math.max(1, Math.round((0.07 * FIT.short) / CW)), Math.max(1, Math.round((0.07 * FIT.short) / LH)));
    ctx.font = `400 ${R.size}px ${MONO}`;
    const dots = new Map();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (occ[i]) continue;
      const s = shadow[i];
      if ((r + c) % 2 && s < 0.08) continue;
      const a = Math.round(100 * (TONES.dots.alpha + TONES.dots.shadow * s)) / 100;
      if (a < 0.015) continue;
      if (!dots.has(a)) dots.set(a, []);
      dots.get(a).push(i);
    }
    for (const [a, list] of dots) {
      ctx.fillStyle = rgba(m.colors.ink, a);
      for (const i of list) ctx.fillText("·", X0 + (i % COLS) * CW, Math.floor(i / COLS) * LH + LH * 0.8);
    }

    // The accent's glow: its cells, blurred under the letters on dark grounds.
    const hot = m.hot;
    glow.width = cv.width;
    glow.height = cv.height;
    gctx.setTransform(scale, 0, 0, scale, 0, 0);
    gctx.fillStyle = m.colors.accent;
    for (const c of cells) if (c.part === hot && c.letter) gctx.fillRect(X0 + (c.i % COLS) * CW, Math.floor(c.i / COLS) * LH, CW, LH);
    if (hot >= 0 && m.colors.glow) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = TONES.glow.alpha * COVER.glow * m.colors.glow * Math.min(1, Math.max(0.45, 0.15 / m.parts[hot].share));
      ctx.filter = `blur(${TONES.glow.blur * COVER.glow * scale}px)`;
      ctx.drawImage(glow, 0, 0);
      ctx.restore();
    }

    // On light/vivid grounds the accent is merged into clean rounded horizontal pill spans under crisp dark ink.
    const fill = m.colors.fill;
    if (fill && hot >= 0) {
      const byRow = new Map();
      for (const c of cells) {
        if (c.part !== hot) continue;
        const r = Math.floor(c.i / COLS);
        if (!byRow.has(r)) byRow.set(r, []);
        byRow.get(r).push(c);
      }
      for (const [r, list] of byRow) {
        list.sort((a, b) => (a.i % COLS) - (b.i % COLS));
        let k = 0;
        while (k < list.length) {
          let e = k + 1;
          while (e < list.length && (list[e].i % COLS) === (list[e - 1].i % COLS) + 1) e++;
          const run = list.slice(k, e);
          const meanV = run.reduce((s, c) => s + c.v, 0) / run.length;
          const meanFade = run.reduce((s, c) => s + Math.max(0.55, c.fade), 0) / run.length;
          const x = X0 + (run[0].i % COLS) * CW - 0.4;
          const y = r * LH - 0.3;
          const w = run.length * CW + 0.8;
          const h = LH + 0.6;
          const rad = Math.min(2.2, h * 0.35, w * 0.35);
          ctx.fillStyle = rgba(m.colors.accent, q(fill * (0.68 + 0.32 * meanV) * meanFade));
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, rad);
          ctx.fill();
          k = e;
        }
      }
    }
    const groups = new Map();
    for (const c of cells) {
      const isHot = c.part === hot && !fill;
      const isGlint = m.dark && c.kind === "mark" && !isHot;
      const alpha = isHot ? q((TONES.hot.from + (1 - TONES.hot.from) * (TONES.hot.by === "light" ? c.b : c.v)) * Math.max(0.5, c.fade)) : isGlint ? 1 : q(coverInkAlpha(m, c.kind, c.v) * c.fade);
      const weight = isHot || c.kind === "mark" || c.kind === "wall" || c.v > 0.42 ? 700 : 400;
      const g = `${isHot ? 1 : isGlint ? 2 : 0}|${weight}|${alpha}`;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(c);
    }
    for (const [g, list] of groups) {
      const [mode, weight, alpha] = g.split("|");
      ctx.font = `${weight} ${R.size}px ${MONO}`;
      ctx.fillStyle = rgba(mode === "1" ? m.colors.accent : m.colors.ink, +alpha);
      if (mode === "1" && TONES.glow.letters) [ctx.shadowColor, ctx.shadowBlur] = [rgba(m.colors.accent, 0.8), TONES.glow.letters * scale];
      else if (mode === "2") [ctx.shadowColor, ctx.shadowBlur] = [rgba(m.colors.ink, 0.55), 2 * scale];
      for (const c of list) ctx.fillText(c.ch, X0 + (c.i % COLS) * CW, Math.floor(c.i / COLS) * LH + LH * 0.8);
      ctx.shadowBlur = 0;
    }
  }

  /** Look: xerox — 2-plate riso/copier print (hard 3-color threshold, grain, misregistration, rubber stamp & markers). */
  function drawXerox(f, scale) {
    const cells = coverCells(m, f);
    const Wp = W * scale;
    const Hp = H * scale;
    cv.width = Wp;
    cv.height = Hp;
    const makePlate = () => {
      const c = document.createElement("canvas");
      c.width = Wp;
      c.height = Hp;
      const p = c.getContext("2d");
      p.scale(scale, scale);
      p.fillStyle = "#fff";
      p.strokeStyle = "#fff";
      return [c, p];
    };
    const [inkC, ictx] = makePlate();
    const [spotC, sctx] = makePlate();
    const hot = m.hot;
    const syms = [":", "-", "+", ":", "="];
    ictx.textBaseline = "alphabetic";
    // Paint form onto ink + spot alpha plates, quantized into crisp toner density classes.
    for (const c of cells) {
      const col = c.i % COLS;
      const row = Math.floor(c.i / COLS);
      const x = X0 + col * CW;
      const y = row * LH;
      const v = c.v;
      if (c.part === hot && v > 0.14) sctx.fillRect(x - 0.3, y - 0.2, CW + 0.6, LH + 0.4);
      if (v > 0.92 && c.kind !== "letter") {
        ictx.fillRect(x, y, CW, LH);
      } else if (v < 0.2 && !c.letter) {
        if (pxHash(col, row, seed) < 0.5) ictx.fillRect(x + CW / 2 - 0.6, y + LH * 0.6, 1.4, 1.4);
      } else if (v < 0.3 && c.kind !== "letter") {
        ictx.font = `400 ${R.size}px ${MONO}`;
        ictx.fillText(syms[Math.floor(pxHash(col, row, seed + 1) * syms.length)], x, y + LH * 0.8);
      } else {
        ictx.font = `${v > 0.62 || c.part === hot ? 700 : 400} ${R.size}px ${MONO}`;
        ictx.fillText(c.ch, x, y + LH * 0.8);
      }
    }
    // Rubber archive stamp on the spot plate (top right, slightly crooked).
    if (F.format !== "og") {
      const num = String((seed % 89) + 10).padStart(3, "0");
      sctx.save();
      sctx.translate(W - m.template.margin - 76, m.template.margin + 28);
      sctx.rotate((-3.8 * Math.PI) / 180);
      sctx.lineWidth = 2.6;
      sctx.strokeRect(-72, -26, 144, 54);
      sctx.font = `700 8.5px ${MONO}`;
      sctx.fillText("VYO ARCHIVE", -64, -13);
      if (F.series) {
        sctx.textAlign = "right";
        sctx.fillText(F.series, 64, -13);
        sctx.textAlign = "left";
      }
      sctx.font = `900 31px ${GROT}`;
      sctx.fillText(`N°${num}`, -65, 20);
      sctx.restore();
    }
    // Highlighter markers on spot plate behind commit hash and accent name in legend.
    if (F.markers) {
      for (let i = 0; i < F.markers.length; i++) {
        const mk = F.markers[i];
        paintMarker(sctx, mk.x, mk.y, mk.w, mk.h, seed + 11 + i);
      }
    }
    // Copier glass dust specks on ink plate.
    for (let i = 0; i < 65; i++) {
      const x = pxHash(seed, i, 21) * W;
      const y = pxHash(seed, i, 22) * H;
      const r = 0.4 + Math.pow(pxHash(seed, i, 23), 3) * 2.1;
      ictx.beginPath();
      ictx.ellipse(x, y, r, r * (0.5 + pxHash(seed, i, 24)), pxHash(seed, i, 25) * 3, 0, Math.PI * 2);
      ictx.fill();
    }

    // Generation curve over the 32-frame copier loop (0 on still frame, escalating 0 -> 3 -> 0 in motion).
    const isStill = f === F.still;
    const step = Math.floor(f / 2);
    const gen = isStill ? 0 : step < 4 ? 0 : step < 8 ? 1 : step < 12 ? 2 : step < 14 ? 3 : 0;
    const applyGen = (src) => {
      if (!gen) return src;
      const [dst, dctx] = makePlate();
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      const cx = (W / 2) * scale;
      const cy = (H / 2) * scale;
      dctx.translate(cx, cy);
      dctx.rotate((gen * 0.2 * Math.PI) / 180);
      dctx.scale(1 + gen * 0.005, 1 + gen * 0.005);
      dctx.translate(-cx, -cy);
      dctx.filter = `blur(${0.4 * gen * scale}px)`;
      dctx.drawImage(src, 0, 0);
      return dst;
    };
    const inkFin = applyGen(inkC);
    const spotFin = applyGen(spotC);
    const inkData = inkFin.getContext("2d").getImageData(0, 0, Wp, Hp).data;
    const spotData = spotFin.getContext("2d").getImageData(0, 0, Wp, Hp).data;
    const cg = hexRgb(m.colors.ground);
    const ci = hexRgb(m.colors.ink);
    const cs = hexRgb(m.colors.accent);
    const outImg = ctx.createImageData(Wp, Hp);
    const px = outImg.data;
    const amp = 44 + 26 * gen;
    const level = 126 - 5 * gen;
    const drop = 0.006 + 0.012 * gen;
    const fs = seed * 7919 + f;
    const ox = Math.round((2.0 + gen * 0.8) * scale);
    const oy = Math.round((1.4 + gen * 0.5) * scale);
    const streak = Math.floor(pxHash(seed, 5, 5) * (Wp - 40)) + 20;
    const metaCut = Math.round((m.template.box.top - 12) * scale);
    for (let y = 0; y < Hp; y++) {
      const fresh = y < metaCut;
      const a0 = fresh ? 32 : amp;
      const l0 = fresh ? 128 : level;
      const d0 = fresh ? 0.004 : drop;
      for (let x = 0; x < Wp; x++) {
        const i = (y * Wp + x) * 4;
        const clump = pxHash(x >> 1, y >> 1, fs);
        let on = inkData[i + 3] + (clump - 0.5) * a0 > l0;
        if (on && pxHash(x >> 2, y >> 2, fs + 1) < d0) on = false;
        if (!on && clump < 0.0012) on = true;
        if (!on && x >= streak && x < streak + Math.max(2, scale) && pxHash(x, y >> 3, fs + 2) < 0.18) on = true;
        const sx = x - ox;
        const sy = y - oy;
        let son = false;
        if (sx >= 0 && sx < Wp && sy >= 0 && sy < Hp) {
          const a = spotData[(sy * Wp + sx) * 4 + 3];
          son = a + (pxHash(sx >> 1, sy >> 1, fs + 3) - 0.5) * a0 > l0 && pxHash(sx >> 2, sy >> 2, fs + 4) > d0 * 0.6;
        }
        const c = on ? ci : son ? cs : cg;
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
        px[i + 3] = 255;
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(outImg, 0, 0);
  }

  /** Look: spin — crisp flat 3-color kinetic 3D solid with depth-scaled type, wall marks, and glitch beats. */
  function drawSpin(f, scale) {
    const cells = coverCells(m, f);
    cv.width = W * scale;
    cv.height = H * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = m.colors.ground;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "alphabetic";
    const hot = m.hot;
    const isStill = f === F.still;
    const beats = [18, 42, 66, 87];
    const beat = isStill ? undefined : beats.find((b) => f >= b && f < b + 3);
    const glitch = beat !== undefined;
    const phase = glitch ? f - beat : 0;

    // Optional inverted ink burn slice on glitch phase 0.
    const burnRows = new Set();
    if (glitch && phase === 0 && cells.length) {
      const rs = [...new Set(cells.map((c) => Math.floor(c.i / COLS)))].sort((a, b) => a - b);
      const r0 = rs[Math.floor(pxHash(seed, beat, 1) * rs.length * 0.75)];
      for (let r = r0; r < r0 + 5; r++) burnRows.add(r);
      const cols = cells.filter((c) => burnRows.has(Math.floor(c.i / COLS))).map((c) => c.i % COLS);
      if (cols.length) {
        ctx.fillStyle = m.colors.ink;
        ctx.fillRect(X0 + (Math.min(...cols) - 2) * CW, r0 * LH, (Math.max(...cols) - Math.min(...cols) + 5) * CW, 5 * LH);
      }
    }

    // Depth-scaled flat-color glyph pass: near cells bold & bigger, far cells compact; walls crisp marks.
    const groups = new Map();
    for (const c of cells) {
      const r = Math.floor(c.i / COLS);
      const col = c.i % COLS;
      let dx = 0;
      if (glitch) {
        if (phase === 0 && pxHash(r >> 2, beat, 2) < 0.25) dx = (pxHash(r >> 2, beat, 3) < 0.5 ? -1 : 1) * 5 * CW;
        else if (phase === 2 && r > ROWS * 0.48) dx = -4 * CW;
      }
      const near = (c.z + 1) / 2;
      const isHot = c.part === hot;
      const sz = c.kind === "wall" ? 1 : near > 0.6 ? 1.14 : near > 0.38 ? 1 : 0.84;
      const weight = isHot || near > 0.58 || (c.kind === "wall" && near > 0.52) ? 700 : 400;
      const color = isHot ? m.colors.accent : burnRows.has(r) ? m.colors.ground : m.colors.ink;
      const key = `${color}|${weight}|${sz}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ ch: c.ch, x: X0 + col * CW + dx + (CW - CW * sz) / 2, y: r * LH + LH * 0.82 });
    }
    for (const [key, list] of groups) {
      const [color, weight, sz] = key.split("|");
      ctx.fillStyle = color;
      ctx.font = `${weight} ${(R.size * +sz).toFixed(2)}px ${MONO}`;
      for (const item of list) ctx.fillText(item.ch, item.x, item.y);
    }
  }

  function draw(f, scale) {
    if (m.look === "xerox") drawXerox(f, scale);
    else if (m.look === "spin") drawSpin(f, scale);
    else if (m.finish === "studio") drawStudio(f, scale);
    else if (m.finish === "halftone") drawHalftone(f, scale);
    else if (m.finish === "wireframe") drawWireframe(f, scale);
    else drawLiving(f, scale);
    if (F.canvasChrome) drawCanvasChrome(scale);
    window.coverShown = f;
  }

  /** Draw loop frame f at `scale` and return its measurements, as the checks read them. */
  window.coverFrame = (f, scale = 2) => {
    draw(f, scale);
    return coverMeasure(m, f);
  };
  /** Glyph changes per step over the whole loop, once every frame has been drawn. */
  window.coverSteps = () => coverSteps(m);
  window.cover = { frames: m.frames, still: F.still, look: m.look, layout: m.layout, finish: m.finish, report: window.coverFrame(F.still, 2) };
  window.drawn = true;
})().catch((e) => {
  window.coverError = String(e && e.stack ? e.stack : e);
  throw e;
});

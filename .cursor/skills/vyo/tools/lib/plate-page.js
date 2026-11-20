// Runs in a plate's page after plates/seismic.mjs (render concatenates them): draws gallery-grade 2x vector
// plates for seismic (Unknown Pleasures ridgelines), topo (marching-squares elevation contours), and blueprint
// (architectural PCB / circuit schematic) with subtle film grain, studio glow, and seamless loop animation.
(async () => {
  const F = JSON.parse(document.getElementById("figure").textContent);
  await window.fontsReady;

  const cv = document.getElementById("plate");
  const ctx = cv.getContext("2d");
  const W = cv.width;
  const H = cv.height;
  const G = F.colors;
  const dark = G.theme === "dark";
  const MONO = '"Commit Mono", monospace';
  const seed = Number(F.seed) || 1;

  // What the canvas actually draws, tallied as it draws: the parts with geometry on the sheet and the accent strokes.
  // plate-parts judges these against the spec's parts, not the counts Node computed before drawing.
  let tally = { parts: new Set(), accent: 0 };
  const onSheet = (p) => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H;
  const rectOnSheet = (r) => r.x < W && r.x + r.w > 0 && r.y < H && r.y + r.h > 0;
  const drew = (partId, hot, visible) => {
    if (!visible) return;
    if (partId !== undefined) tally.parts.add(partId);
    if (hot) tally.accent++;
  };

  // Where labels may sit: the plate's box, pulled in to the sheet's safe margin on any edge where the box runs off
  // the sheet (a full-bleed layout such as macro), and 8px clear of the layout's chrome cards. Every label drawn is
  // recorded as the rect its ink covers, so blocks-inside and blocks-apart judge what the canvas shows.
  let labels = [];
  const plateBox = F.data.box || { left: 0, right: W, top: 0, bottom: H };
  const margin = Number(F.margin) || 0;
  const SAFE = {
    left: plateBox.left >= 0 ? plateBox.left : margin,
    right: plateBox.right <= W ? plateBox.right : W - margin,
    top: plateBox.top >= 0 ? plateBox.top : margin,
    bottom: plateBox.bottom <= H ? plateBox.bottom : H - margin,
  };
  const CARD_GAP = 8;
  const CARDS = (F.cards || []).map((c) => ({ left: c.x - CARD_GAP, right: c.x + c.w + CARD_GAP, top: c.y - CARD_GAP, bottom: c.y + c.h + CARD_GAP }));
  const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const shift = (r, dx, dy) => ({ left: r.left + dx, right: r.right + dx, top: r.top + dy, bottom: r.bottom + dy });
  const cut = (a, b) => ({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });
  /** The rect the ink of `text` covers when filled at (x, y) with the current font, align and baseline. */
  const inkRect = (text, x, y) => {
    const m = ctx.measureText(text);
    return { left: x - m.actualBoundingBoxLeft, right: x + m.actualBoundingBoxRight, top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent };
  };
  /**
   * The smallest move { dx, dy } that puts label rect `r` inside `within` (SAFE by default) and off every chrome card,
   * or null when no move does. `vertical: false` keeps a label on its row (a seismic band's label marks that band).
   */
  function placeLabel(r, { within = SAFE, vertical = true } = {}) {
    const fit = (lo, hi, min, max) => (hi - lo > max - min ? min - lo : lo < min ? min - lo : hi > max ? max - hi : 0);
    const inside = (q) => q.left >= within.left - 0.5 && q.right <= within.right + 0.5 && q.top >= within.top - 0.5 && q.bottom <= within.bottom + 0.5;
    if (!vertical && (r.top < within.top - 0.5 || r.bottom > within.bottom + 0.5)) return null;
    const dx0 = fit(r.left, r.right, within.left, within.right);
    const dy0 = vertical ? fit(r.top, r.bottom, within.top, within.bottom) : 0;
    const home = shift(r, dx0, dy0);
    const card = CARDS.find((c) => meets(home, c));
    if (!card) return { dx: dx0, dy: dy0 };
    const tries = [
      [dx0 + card.left - home.right, dy0],
      [dx0 + card.right - home.left, dy0],
      ...(vertical ? [[dx0, dy0 + card.top - home.bottom], [dx0, dy0 + card.bottom - home.top]] : []),
    ].sort((a, b) => Math.hypot(a[0] - dx0, a[1] - dy0) - Math.hypot(b[0] - dx0, b[1] - dy0));
    for (const [dx, dy] of tries) {
      const q = shift(r, dx, dy);
      if (inside(q) && !CARDS.some((c) => meets(q, c))) return { dx, dy };
    }
    return null;
  }
  /** A ground-coloured backing under a label moved off its home onto the plate's geometry, so it reads cleanly. */
  const backing = (r) => {
    ctx.fillStyle = G.ground;
    ctx.fillRect(r.left - 2, r.top - 2, r.right - r.left + 4, r.bottom - r.top + 4);
  };
  const record = (text, r) => {
    if (r.right - r.left > 0.5 && r.bottom - r.top > 0.5) labels.push({ text, rect: r });
  };

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

  // Cached archival film-grain substrate canvas (CSS-px resolution, blitted before crisp 2x vector strokes).
  let substrateCanvas = null;
  let substratePattern = null;
  function getSubstrate() {
    if (substrateCanvas) return { canvas: substrateCanvas, pattern: substratePattern };
    const sc = document.createElement("canvas");
    sc.width = W;
    sc.height = H;
    const sctx = sc.getContext("2d");
    const img = sctx.createImageData(W, H);
    const px = img.data;
    const gRgb = hexRgb(G.ground);
    const iRgb = hexRgb(G.ink);
    const box = F.data.box || { left: 0, right: W, top: 0, bottom: H };
    const cx = (box.left + box.right) * 0.5;
    const cy = (box.top + box.bottom) * 0.5;
    const invRx = 1 / Math.max(1, (box.right - box.left) * 0.68);
    const invRy = 1 / Math.max(1, (box.bottom - box.top) * 0.62);
    const plateKind = F.region.plate;
    // 1.8% monochrome grain on dark grounds (~±4.6 RGB), ultra-subtle 0.9% paper grain on light grounds (~±2.3 RGB).
    const grainAmp = dark ? 9.2 : 4.6;
    const hasVig = dark && (plateKind === "topo" || plateKind === "seismic");
    const vigStrength = plateKind === "topo" ? 0.024 : 0.014;
    const sInt = (seed * 31 + 17) | 0;

    for (let y = 0; y < H; y++) {
      const dy = (y - cy) * invRy;
      const dy2 = dy * dy;
      const rowOff = y * W;
      for (let x = 0; x < W; x++) {
        const p4 = (rowOff + x) * 4;
        const grain = (pxHash(x, y, sInt) - 0.5) * grainAmp;
        let r = gRgb[0];
        let g = gRgb[1];
        let b = gRgb[2];
        if (hasVig) {
          const dx = (x - cx) * invRx;
          const vig = Math.exp(-(dx * dx + dy2) * 1.15);
          const lift = vigStrength * vig;
          r += (iRgb[0] - r) * lift;
          g += (iRgb[1] - g) * lift;
          b += (iRgb[2] - b) * lift;
        }
        px[p4] = clamp255(r + grain);
        px[p4 + 1] = clamp255(g + grain);
        px[p4 + 2] = clamp255(b + grain);
        px[p4 + 3] = 255;
      }
    }
    sctx.putImageData(img, 0, 0);
    substrateCanvas = sc;
    substratePattern = ctx.createPattern(sc, "no-repeat");
    return { canvas: substrateCanvas, pattern: substratePattern };
  }

  /** Crisp 2x canvas chrome overlay for the blueprint layout (drafting border, A-F / 1-8 grid, mm ticks, crosshairs). */
  function drawCanvasChrome(scale) {
    const ch = F.canvasChrome;
    if (!ch || ch.kind !== "blueprint") return;
    const { frame, inner, headerY, titleBlock: tb, box, cols, rows } = ch;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Outer perimeter border & inner drafting field border (stopping cleanly at the title block).
    ctx.strokeStyle = rgba(G.ink, 0.34);
    ctx.lineWidth = 1;
    ctx.strokeRect(frame.x + 0.5, frame.y + 0.5, frame.w - 1, frame.h - 1);
    ctx.strokeStyle = rgba(G.ink, 0.16);
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
    ctx.fillStyle = rgba(G.ink, 0.48);
    ctx.strokeStyle = rgba(G.ink, 0.24);
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
    ctx.strokeStyle = rgba(G.ink, 0.2);
    ctx.beginPath();
    for (let y = Math.ceil(headerY + 12); y < tb.y - 12; y += 8) {
      const major = (y - Math.ceil(headerY + 12)) % 40 === 0;
      ctx.moveTo(inner.x - 4.5, y);
      ctx.lineTo(inner.x - 4.5 + (major ? 6 : 3), y);
    }
    ctx.stroke();

    // Subtle architectural crosshairs strictly inside the art box.
    if (box) {
      ctx.strokeStyle = rgba(G.ink, 0.07);
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
    const crColor = rgba(G.ink, 0.56);
    cross(frame.x - 10, frame.y - 10, 5, crColor);
    cross(frame.x + frame.w + 10, frame.y - 10, 5, rgba(G.accent, 0.75));
    cross(frame.x - 10, frame.y + frame.h + 10, 5, crColor);
    cross(frame.x + frame.w + 10, frame.y + frame.h + 10, 5, crColor);
    ctx.restore();
  }

  /** Renderer 1 — seismic: Unknown Pleasures stacked vector ridgelines with painter's horizon occlusion. */
  function drawSeismic(t, scale, subPattern) {
    const traces = F.data.traces || [];
    const bands = F.data.partBands || [];
    const n = traces.length;
    if (!n) return;

    const buildSmoothCurve = (pts) => {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length - 1; k++) {
        const mx = (pts[k].x + pts[k + 1].x) * 0.5;
        const my = (pts[k].y + pts[k + 1].y) * 0.5;
        ctx.quadraticCurveTo(pts[k].x, pts[k].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    };

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let idx = 0; idx < n; idx++) {
      const tr = traces[idx];
      const pts = seismicCurveAt(tr, t);
      if (pts.length < 2) continue;

      // Painter's horizon fill: foreground ridges crisply slice across background peaks.
      ctx.beginPath();
      ctx.moveTo(pts[0].x, tr.baseY + 32);
      ctx.lineTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length - 1; k++) {
        const mx = (pts[k].x + pts[k + 1].x) * 0.5;
        const my = (pts[k].y + pts[k + 1].y) * 0.5;
        ctx.quadraticCurveTo(pts[k].x, pts[k].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.lineTo(pts[pts.length - 1].x, tr.baseY + 32);
      ctx.closePath();
      ctx.fillStyle = subPattern || G.ground;
      ctx.fill();

      // Vector stroke path.
      ctx.beginPath();
      buildSmoothCurve(pts);
      const depthProgress = n > 1 ? idx / (n - 1) : 1;

      if (tr.hot) {
        if (dark) {
          ctx.save();
          ctx.strokeStyle = G.accent;
          ctx.lineWidth = 2.4;
          ctx.shadowColor = rgba(G.accent, 0.78);
          ctx.shadowBlur = 7 * scale;
          ctx.stroke();
          ctx.restore();
          ctx.strokeStyle = G.accent;
          ctx.lineWidth = 1.65;
          ctx.stroke();
        } else {
          ctx.strokeStyle = G.accent;
          ctx.lineWidth = 1.85;
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = rgba(G.ink, 0.72 + 0.24 * depthProgress);
        ctx.lineWidth = 1.35;
        ctx.stroke();
      }
      drew(tr.partId, tr.hot, pts.some(onSheet));
    }

    // Dedicated right-margin area index ticks & crisp mono labels, clear of the waveforms. When the box runs off the
    // sheet and leaves no room right of the ridges, the column moves in to the safe margin over the ridges' tails.
    if (bands.length) {
      const x1 = traces[0].x1;
      const labelX = x1 + 16;
      const room = SAFE.right - labelX - 2;
      const inset = room < 44;
      const maxLabelW = inset ? 140 : room;
      // Prioritize keeping hot band labels if two adjacent bands are closer than 12px.
      const drawnY = [];
      const ordered = [...bands].sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || a.midY - b.midY);
      const accepted = [];
      for (const b of ordered) {
        if (drawnY.some((y) => Math.abs(y - b.midY) < 12)) continue;
        drawnY.push(b.midY);
        accepted.push(b);
      }
      accepted.sort((a, b) => a.midY - b.midY);

      ctx.save();
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      for (const b of accepted) {
        const y = b.midY;
        const pctStr = b.share < 0.005 ? "<1%" : `${Math.round(b.share * 100)}%`;
        const font = `${b.hot ? 700 : 400} 7.5px ${MONO}`;
        ctx.font = font;
        let name = String(b.partName).toLowerCase();
        let label = `${name} ${pctStr}`;
        while (name.length > 3 && ctx.measureText(label).width > maxLabelW) {
          name = name.slice(0, -1).trimEnd();
          label = `${name}… ${pctStr}`;
        }

        // The label and its 6px tick, 4px to its left, as one rect: beside the ridges, or inset at the safe margin.
        const w = ctx.measureText(label).width;
        const x = inset ? SAFE.right - 2 - w : labelX;
        const ink = inkRect(label, x, y);
        const home = { ...ink, left: Math.min(ink.left, x - 10), top: Math.min(ink.top, y - 1), bottom: Math.max(ink.bottom, y + 1) };
        const move = placeLabel(home, { vertical: false });
        if (!move) continue;
        const at = shift(home, move.dx, 0);
        const tx = x + move.dx;
        if (inset || move.dx) backing(at);

        // Crisp 6px horizontal index tick (x1 + 6 to x1 + 12 beside the ridges), clear of the waveform tail.
        ctx.strokeStyle = b.hot ? G.accent : rgba(G.ink, 0.44);
        ctx.lineWidth = b.hot ? 1.15 : 0.8;
        ctx.beginPath();
        ctx.moveTo(tx - 10, y);
        ctx.lineTo(tx - 4, y);
        ctx.stroke();

        ctx.fillStyle = b.hot ? G.accent : rgba(G.ink, 0.54);
        ctx.fillText(label, tx, y);
        record(label, at);
      }
      ctx.restore();
    }
  }

  /** Renderer 2 — topo: Marching-squares topographic elevation contours with summit crosshairs and pulse wave. */
  function drawTopo(t, scale, isStill) {
    const box = F.data.box;
    const contours = F.data.contours || [];
    const summits = F.data.summits || [];

    // Subtle cartographic valley coordinate stipple dots at 24px pitch inside box.
    ctx.save();
    ctx.fillStyle = rgba(G.ink, 0.08);
    const sx0 = Math.ceil((box.left + 12) / 24) * 24;
    const sy0 = Math.ceil((box.top + 12) / 24) * 24;
    for (let y = sy0; y <= box.bottom - 12; y += 24) {
      for (let x = sx0; x <= box.right - 12; x += 24) {
        ctx.fillRect(x - 0.5, y - 0.5, 1.1, 1.1);
      }
    }
    ctx.restore();

    const sorted = [...contours].sort((a, b) => a.levelIndex - b.levelIndex);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      const pts = c.points;
      if (!pts || pts.length < 2) continue;

      const d = Math.min(Math.abs(c.levelNorm - t), 1 - Math.abs(c.levelNorm - t));
      const pulse = isStill ? 0 : Math.exp(-(d * d) / 0.008);

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
      if (c.closed) ctx.closePath();

      if (!c.major) {
        ctx.lineWidth = 0.58 + 0.35 * pulse;
        ctx.strokeStyle = c.hot ? rgba(G.accent, 0.56 + 0.32 * pulse) : rgba(G.ink, 0.32 + 0.28 * pulse);
        ctx.stroke();
      } else if (c.hot) {
        const lw = 1.65 + 0.45 * pulse;
        if (dark) {
          ctx.save();
          ctx.lineWidth = lw + 0.5;
          ctx.strokeStyle = G.accent;
          ctx.shadowColor = rgba(G.accent, 0.72);
          ctx.shadowBlur = (7 + 3 * pulse) * scale;
          ctx.stroke();
          ctx.restore();
        }
        ctx.lineWidth = lw;
        ctx.strokeStyle = G.accent;
        ctx.stroke();
      } else {
        ctx.lineWidth = 1.35 + 0.4 * pulse;
        ctx.strokeStyle = rgba(G.ink, 0.86 + 0.14 * pulse);
        ctx.stroke();
      }
      drew(c.partId, c.hot, pts.some(onSheet));
    }

    // Elevation summit crosshairs (+) and crisp haloed mono labels.
    ctx.save();
    const beat = isStill ? 0 : Math.sin(Math.PI * 2 * t);
    for (let i = 0; i < summits.length; i++) {
      const s = summits[i];
      const col = s.hot ? G.accent : rgba(G.ink, 0.84);
      const arm = 4.5;
      const gap = 2;

      ctx.strokeStyle = col;
      ctx.lineWidth = s.hot ? 1.15 : 0.95;
      ctx.beginPath();
      ctx.moveTo(s.x - arm, s.y);
      ctx.lineTo(s.x - gap, s.y);
      ctx.moveTo(s.x + gap, s.y);
      ctx.lineTo(s.x + arm, s.y);
      ctx.moveTo(s.x, s.y - arm);
      ctx.lineTo(s.x, s.y - gap);
      ctx.moveTo(s.x, s.y + gap);
      ctx.lineTo(s.x, s.y + arm);
      ctx.stroke();
      drew(s.partId, s.hot, onSheet(s));

      if (s.hot) {
        const r = 2.5 + 0.55 * beat;
        if (dark) {
          ctx.save();
          ctx.fillStyle = G.accent;
          ctx.shadowColor = rgba(G.accent, 0.82);
          ctx.shadowBlur = 7 * scale;
          ctx.beginPath();
          ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = G.accent;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (!isStill) {
          ctx.strokeStyle = rgba(G.accent, 0.35 * (0.5 + 0.5 * beat));
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 6 + 3 * (0.5 + 0.5 * beat), 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      const flipLeft = s.x > SAFE.right - 98;
      ctx.textAlign = flipLeft ? "right" : "left";
      ctx.textBaseline = "alphabetic";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeStyle = G.ground;

      // Both lines as one rect beside the summit, moved into the safe area and off the chrome cards when they must be.
      const line1 = String(s.partName).toLowerCase();
      const line2 = `${Number(s.loc).toLocaleString("en-US")} LOC`;
      const font1 = `${s.hot ? 700 : 400} 8px ${MONO}`;
      const font2 = `400 7.5px ${MONO}`;
      const lx0 = flipLeft ? s.x - 8 : s.x + 8;
      ctx.font = font1;
      const r1 = inkRect(line1, lx0, s.y - 3);
      ctx.font = font2;
      const r2 = inkRect(line2, lx0, s.y + 7);
      const home = { left: Math.min(r1.left, r2.left), right: Math.max(r1.right, r2.right), top: r1.top, bottom: r2.bottom };
      const move = placeLabel(home);
      if (!move) continue;
      const lx = lx0 + move.dx;

      ctx.font = font1;
      ctx.strokeText(line1, lx, s.y - 3 + move.dy);
      ctx.fillStyle = s.hot ? G.accent : rgba(G.ink, 0.88);
      ctx.fillText(line1, lx, s.y - 3 + move.dy);

      ctx.font = font2;
      ctx.strokeText(line2, lx, s.y + 7 + move.dy);
      ctx.fillStyle = s.hot ? rgba(G.accent, 0.76) : rgba(G.ink, 0.62);
      ctx.fillText(line2, lx, s.y + 7 + move.dy);
      record(`${line1} ${line2}`, shift(home, move.dx, move.dy));
    }
    ctx.restore();
  }

  /** Sample exact `(x, y)` at arc-length distance `dist` along a polyline. */
  function pointAtDistance(points, dist) {
    if (dist <= 0 || points.length === 1) return points[0];
    let acc = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (acc + seg >= dist) {
        const u = seg > 1e-6 ? (dist - acc) / seg : 0;
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      }
      acc += seg;
    }
    return points[points.length - 1];
  }

  /** Renderer 3 — blueprint: Proportional IC chambers, internal file cells, octilinear bus traces, vias & signals. */
  function drawBlueprint(t, scale) {
    const box = F.data.box;
    const chambers = F.data.chambers || [];
    const traces = F.data.traces || [];
    const vias = F.data.vias || [];

    // Subtle architectural 18px dot grid inside box.
    ctx.save();
    ctx.fillStyle = rgba(G.ink, 0.09);
    const gx0 = Math.ceil((box.left + 6) / 18) * 18;
    const gy0 = Math.ceil((box.top + 6) / 18) * 18;
    for (let y = gy0; y <= box.bottom - 6; y += 18) {
      for (let x = gx0; x <= box.right - 6; x += 18) {
        ctx.fillRect(x - 0.5, y - 0.5, 1.1, 1.1);
      }
    }
    ctx.restore();

    // 1. Proportional IC / Architectural Chambers with internal file sub-cells.
    for (let i = 0; i < chambers.length; i++) {
      const c = chambers[i];
      ctx.save();

      // Subtle chamber body fill.
      ctx.fillStyle = c.hot ? rgba(G.accent, dark ? 0.07 : 0.06) : rgba(G.ink, dark ? 0.025 : 0.02);
      ctx.fillRect(c.x, c.y, c.w, c.h);

      // Internal file sub-cells (density tint encodes locNorm + ultra-fine perimeter stroke).
      for (let k = 0; k < c.cells.length; k++) {
        const cell = c.cells[k];
        const cellCol = c.hot ? G.accent : G.ink;
        ctx.fillStyle = rgba(cellCol, 0.03 + 0.08 * cell.locNorm);
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
        ctx.strokeStyle = c.hot ? rgba(G.accent, 0.32) : rgba(G.ink, 0.18);
        ctx.lineWidth = 0.55;
        ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
      }

      // Outer chamber border (with studio glow on dark grounds for accent chamber).
      if (c.hot) {
        if (dark) {
          ctx.save();
          ctx.strokeStyle = G.accent;
          ctx.lineWidth = 2.0;
          ctx.shadowColor = rgba(G.accent, 0.65);
          ctx.shadowBlur = 6 * scale;
          ctx.strokeRect(c.x, c.y, c.w, c.h);
          ctx.restore();
        }
        ctx.strokeStyle = G.accent;
        ctx.lineWidth = 1.7;
        ctx.strokeRect(c.x, c.y, c.w, c.h);
      } else {
        ctx.strokeStyle = rgba(G.ink, 0.62);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(c.x, c.y, c.w, c.h);
      }
      drew(c.partId, c.hot, rectOnSheet(c));

      // Precision corner bracket accents.
      const br = Math.min(5.5, c.w * 0.2, c.h * 0.2);
      ctx.strokeStyle = c.hot ? G.accent : rgba(G.ink, 0.85);
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + br); ctx.lineTo(c.x, c.y); ctx.lineTo(c.x + br, c.y);
      ctx.moveTo(c.x + c.w - br, c.y); ctx.lineTo(c.x + c.w, c.y); ctx.lineTo(c.x + c.w, c.y + br);
      ctx.moveTo(c.x, c.y + c.h - br); ctx.lineTo(c.x, c.y + c.h); ctx.lineTo(c.x + br, c.y + c.h);
      ctx.moveTo(c.x + c.w - br, c.y + c.h); ctx.lineTo(c.x + c.w, c.y + c.h); ctx.lineTo(c.x + c.w, c.y + c.h - br);
      ctx.stroke();

      // Chamber header divider + clipped module label & share %.
      if (c.h >= c.headerH + 4 && c.w >= 26) {
        ctx.strokeStyle = c.hot ? rgba(G.accent, 0.42) : rgba(G.ink, 0.26);
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y + c.headerH);
        ctx.lineTo(c.x + c.w, c.y + c.headerH);
        ctx.stroke();

        // The name and share sit in the header, clipped to the chamber. Where the header is off the sheet's safe area
        // or under a chrome card, they move together, as one label, into the chamber's part of the safe area.
        ctx.textBaseline = "middle";
        const hy = c.y + c.headerH * 0.5 + 0.5;
        const header = { left: c.x + 4, right: c.x + c.w - 4, top: c.y + 1, bottom: c.y + c.headerH - 1 };
        const within = cut({ left: c.x + 4, right: c.x + c.w - 4, top: c.y + 1, bottom: c.y + c.h - 1 }, SAFE);
        const room = within.right > within.left && within.bottom > within.top;
        const name = String(c.partName).toLowerCase();
        const nameFont = `${c.hot ? 700 : 400} 8.5px ${MONO}`;
        const nameFill = c.hot ? G.accent : rgba(G.ink, 0.86);
        const pctStr = c.w >= 110 ? (c.share < 0.005 ? "<1%" : `${Math.round(c.share * 100)}%`) : null;
        const pctFont = `400 8px ${MONO}`;
        const pctFill = c.hot ? rgba(G.accent, 0.82) : rgba(G.ink, 0.54);
        const stays = (r) => {
          const m = room ? placeLabel(r, { within }) : null;
          return !!m && !m.dx && !m.dy;
        };
        ctx.font = nameFont;
        ctx.textAlign = "left";
        const nameInk = cut(inkRect(name, c.x + 6, hy), header);
        ctx.font = pctFont;
        ctx.textAlign = "right";
        const pctInk = pctStr ? cut(inkRect(pctStr, c.x + c.w - 6, hy), header) : null;

        ctx.save();
        if (stays(nameInk) && (!pctInk || stays(pctInk))) {
          ctx.beginPath();
          ctx.rect(header.left, header.top, Math.max(0, header.right - header.left), header.bottom - header.top);
          ctx.clip();
          ctx.font = nameFont;
          ctx.textAlign = "left";
          ctx.fillStyle = nameFill;
          ctx.fillText(name, c.x + 6, hy);
          record(name, nameInk);
          if (pctStr) {
            ctx.font = pctFont;
            ctx.textAlign = "right";
            ctx.fillStyle = pctFill;
            ctx.fillText(pctStr, c.x + c.w - 6, hy);
            record(pctStr, pctInk);
          }
        } else if (room) {
          ctx.textAlign = "left";
          ctx.font = nameFont;
          const nameW = ctx.measureText(name).width;
          let r = inkRect(name, c.x + 6, hy);
          if (pctStr) {
            ctx.font = pctFont;
            const p = inkRect(pctStr, c.x + 6 + nameW + 6, hy);
            r = { left: r.left, right: p.right, top: Math.min(r.top, p.top), bottom: Math.max(r.bottom, p.bottom) };
          }
          const move = placeLabel(r, { within });
          if (move) {
            const at = cut(shift(r, move.dx, move.dy), within);
            ctx.beginPath();
            ctx.rect(within.left, within.top, within.right - within.left, within.bottom - within.top);
            ctx.clip();
            backing(at);
            ctx.font = nameFont;
            ctx.fillStyle = nameFill;
            ctx.fillText(name, c.x + 6 + move.dx, hy + move.dy);
            if (pctStr) {
              ctx.font = pctFont;
              ctx.fillStyle = pctFill;
              ctx.fillText(pctStr, c.x + 6 + nameW + 6 + move.dx, hy + move.dy);
            }
            record(pctStr ? `${name} ${pctStr}` : name, at);
          }
        }
        ctx.restore();
      }
      ctx.restore();
    }

    // 2. Octilinear 45/90 deg chamfered bus traces (normal first, then hot on top).
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const drawTraceList = (hotFlag) => {
      for (let i = 0; i < traces.length; i++) {
        const tr = traces[i];
        if (!!tr.hot !== hotFlag || !tr.points || tr.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(tr.points[0].x, tr.points[0].y);
        for (let k = 1; k < tr.points.length; k++) ctx.lineTo(tr.points[k].x, tr.points[k].y);
        if (hotFlag) {
          if (dark) {
            ctx.save();
            ctx.lineWidth = 2.1;
            ctx.strokeStyle = G.accent;
            ctx.shadowColor = rgba(G.accent, 0.72);
            ctx.shadowBlur = 6 * scale;
            ctx.stroke();
            ctx.restore();
          }
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = G.accent;
          ctx.stroke();
        } else {
          ctx.lineWidth = 1.15;
          ctx.strokeStyle = rgba(G.ink, 0.56);
          ctx.stroke();
        }
        drew(undefined, tr.hot, tr.points.some(onSheet));
      }
    };
    drawTraceList(false);
    drawTraceList(true);

    // 3. Circular via pads (ground-filled annulus with center dot).
    for (let i = 0; i < vias.length; i++) {
      const v = vias[i];
      const r = v.r || 2.6;
      const col = v.hot ? G.accent : rgba(G.ink, 0.72);
      ctx.beginPath();
      ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
      ctx.fillStyle = G.ground;
      ctx.fill();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(v.x, v.y, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }

    // 4. Seamless traveling signal light packets along traces (consistent across t=0 and loop seam).
    for (let i = 0; i < traces.length; i++) {
      const tr = traces[i];
      if (!tr.points || tr.points.length < 2 || !(tr.length > 8)) continue;
      const phaseOffset = ((tr.index * 0.371 + (tr.fromPart + 1) * 0.193) % 1 + 1) % 1;
      const u = (t + phaseOffset) % 1;
      const edgeFade = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.35);
      if (edgeFade < 0.05) continue;

      const headDist = u * tr.length;
      const tailLen = Math.min(tr.length * 0.24, tr.hot ? 36 : 24);
      const segs = 6;
      const col = tr.hot ? G.accent : G.ink;

      // 6-segment tapered comet tail behind the luminous packet head.
      for (let s = 0; s < segs; s++) {
        const d0 = Math.max(0, headDist - (s / segs) * tailLen);
        const d1 = Math.max(0, headDist - ((s + 1) / segs) * tailLen);
        if (d0 - d1 < 0.25) continue;
        const p0 = pointAtDistance(tr.points, d0);
        const p1 = pointAtDistance(tr.points, d1);
        const fade = (1 - s / segs) * edgeFade;
        ctx.strokeStyle = rgba(col, (tr.hot ? 0.85 : 0.6) * fade);
        ctx.lineWidth = (tr.hot ? 2.1 : 1.45) * (1 - 0.65 * (s / segs));
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }

      // Luminous packet head.
      const head = pointAtDistance(tr.points, headDist);
      const r = tr.hot ? 2.4 : 1.7;
      ctx.save();
      if (dark) {
        ctx.shadowColor = rgba(col, 0.9 * edgeFade);
        ctx.shadowBlur = (tr.hot ? 7 : 4.5) * scale;
      }
      ctx.fillStyle = rgba(col, Math.min(1, 0.95 * edgeFade));
      ctx.beginPath();
      ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function draw(f, scale = 2, looping = false) {
    const N = Math.max(1, F.frames || 48);
    const frame = ((f % N) + N) % N;
    const t = frame / N;
    const isStill = !looping && frame === 0;

    cv.width = W * scale;
    cv.height = H * scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const { canvas: subCanvas, pattern: subPattern } = getSubstrate();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(subCanvas, 0, 0, cv.width, cv.height);

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    tally = { parts: new Set(), accent: 0 };
    labels = [];
    if (F.region.plate === "seismic") drawSeismic(t, scale, subPattern);
    else if (F.region.plate === "topo") drawTopo(t, scale, isStill);
    else if (F.region.plate === "blueprint") drawBlueprint(t, scale);

    if (F.canvasChrome) drawCanvasChrome(scale);
    window.plateShown = frame;

    return {
      frame,
      plate: F.region.plate,
      parts: [...tally.parts],
      labels,
      representedParts: tally.parts.size,
      accentCount: tally.accent,
      slices: F.data.traces?.length ?? F.parts.length,
      totalParts: F.parts.length,
    };
  }

  /** Draw plate loop frame `f` at `scale` and return its honest-encoding report. */
  window.plateFrame = (f, scale = 2, looping = false) => draw(f, scale, looping);
  window.plate = { frames: F.frames, still: 0, plate: F.region.plate, report: window.plateFrame(0, 2, false) };
  window.drawn = true;
})().catch((e) => {
  window.plateError = String(e && e.stack ? e.stack : e);
  throw e;
});

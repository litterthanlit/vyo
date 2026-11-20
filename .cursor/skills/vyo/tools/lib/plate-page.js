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
    }

    // Dedicated right-margin area index ticks & crisp mono labels, completely clear of all waveforms.
    if (bands.length) {
      const box = F.data.box || { right: W };
      const x1 = traces[0].x1;
      const tickStart = x1 + 6;
      const tickEnd = x1 + 12;
      const labelX = x1 + 16;
      const maxLabelW = Math.max(44, (box.right || W) - labelX - 2);
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

        // Crisp 6px horizontal index tick (x1 + 6 to x1 + 12), clear of the waveform tail.
        ctx.strokeStyle = b.hot ? G.accent : rgba(G.ink, 0.44);
        ctx.lineWidth = b.hot ? 1.15 : 0.8;
        ctx.beginPath();
        ctx.moveTo(tickStart, y);
        ctx.lineTo(tickEnd, y);
        ctx.stroke();

        ctx.fillStyle = b.hot ? G.accent : rgba(G.ink, 0.54);
        ctx.fillText(label, labelX, y);
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

      const flipLeft = s.x > box.right - 98;
      const lx = flipLeft ? s.x - 8 : s.x + 8;
      ctx.textAlign = flipLeft ? "right" : "left";
      ctx.textBaseline = "alphabetic";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeStyle = G.ground;

      const line1 = String(s.partName).toLowerCase();
      const line2 = `${Number(s.loc).toLocaleString("en-US")} LOC`;
      ctx.font = `${s.hot ? 700 : 400} 8px ${MONO}`;
      ctx.strokeText(line1, lx, s.y - 3);
      ctx.fillStyle = s.hot ? G.accent : rgba(G.ink, 0.88);
      ctx.fillText(line1, lx, s.y - 3);

      ctx.font = `400 7.5px ${MONO}`;
      ctx.strokeText(line2, lx, s.y + 7);
      ctx.fillStyle = s.hot ? rgba(G.accent, 0.76) : rgba(G.ink, 0.62);
      ctx.fillText(line2, lx, s.y + 7);
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

        ctx.save();
        ctx.beginPath();
        ctx.rect(c.x + 4, c.y + 1, Math.max(0, c.w - 8), c.headerH - 2);
        ctx.clip();
        ctx.font = `${c.hot ? 700 : 400} 8.5px ${MONO}`;
        ctx.textBaseline = "middle";
        const hy = c.y + c.headerH * 0.5 + 0.5;
        ctx.textAlign = "left";
        ctx.fillStyle = c.hot ? G.accent : rgba(G.ink, 0.86);
        ctx.fillText(String(c.partName).toLowerCase(), c.x + 6, hy);
        if (c.w >= 110) {
          const pctStr = c.share < 0.005 ? "<1%" : `${Math.round(c.share * 100)}%`;
          ctx.font = `400 8px ${MONO}`;
          ctx.textAlign = "right";
          ctx.fillStyle = c.hot ? rgba(G.accent, 0.82) : rgba(G.ink, 0.54);
          ctx.fillText(pctStr, c.x + c.w - 6, hy);
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
    if (F.region.plate === "seismic") drawSeismic(t, scale, subPattern);
    else if (F.region.plate === "topo") drawTopo(t, scale, isStill);
    else if (F.region.plate === "blueprint") drawBlueprint(t, scale);

    if (F.canvasChrome) drawCanvasChrome(scale);
    window.plateShown = frame;

    return {
      frame,
      plate: F.region.plate,
      representedParts: F.data.representedParts,
      accentCount: F.data.accentCount,
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

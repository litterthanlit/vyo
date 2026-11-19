// Runs in a cover's page after geometry.mjs, silhouettes.mjs, mask.mjs, shape-relief.mjs and cover.mjs (render
// concatenates them): builds the same model `vyo sketch` builds in Node, draws the still into the canvas in the
// chosen look (living, xerox or spin), and gives render one frame at a time for the loop.
(async () => {
  const F = JSON.parse(document.getElementById("figure").textContent);
  setMaskImages((name) => F.images[name]);
  await window.fontsReady;
  const m = coverModel(F.region, F.parts, { ground: F.ground, texts: F.texts, look: F.look, format: F.format, crop: F.crop });
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
    else drawLiving(f, scale);
    window.coverShown = f;
  }

  /** Draw loop frame f at `scale` and return its measurements, as the checks read them. */
  window.coverFrame = (f, scale = 2) => {
    draw(f, scale);
    return coverMeasure(m, f);
  };
  /** Glyph changes per step over the whole loop, once every frame has been drawn. */
  window.coverSteps = () => coverSteps(m);
  window.cover = { frames: m.frames, still: F.still, look: m.look, report: window.coverFrame(F.still, 2) };
  window.drawn = true;
})().catch((e) => {
  window.coverError = String(e && e.stack ? e.stack : e);
  throw e;
});

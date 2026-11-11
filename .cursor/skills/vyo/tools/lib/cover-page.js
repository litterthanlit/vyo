// Runs in a cover's page after geometry.mjs, silhouettes.mjs, mask.mjs, shape-relief.mjs and cover.mjs (render
// concatenates them): builds the same model `vyo sketch` builds in Node, draws the still into the canvas, and
// gives render one frame at a time for the loop. The template's words are the page's own text blocks.
(async () => {
  const F = JSON.parse(document.getElementById("figure").textContent);
  setMaskImages((name) => F.images[name]);
  await window.fontsReady;
  const m = coverModel(F.region, F.parts, { ground: F.ground, texts: F.texts });
  const { cols: COLS, rows: ROWS, cw: CW, lh: LH, x0: X0 } = COVER_GRID;
  const W = SHEET.width;
  const H = SHEET.height;
  const R = RELIEF;
  const TONES = m.tones;
  const cv = document.getElementById("cover");
  const ctx = cv.getContext("2d");
  const glow = document.createElement("canvas");
  const gctx = glow.getContext("2d");
  const MONO = '"Commit Mono", monospace';
  const rgba = (hex, a) => {
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
    return `rgba(${r},${g},${b},${a})`;
  };

  function draw(f, scale) {
    const cells = coverCells(m, f);
    const FIT = m.fit;
    cv.width = W * scale;
    cv.height = H * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = m.colors.ground;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "alphabetic";
    const q = (a) => Math.round(20 * a) / 20;

    // The sheet: a dot on every other glyph cell off the form, the form's cast shadow (down and right of the lamp)
    // taking dots away on a dark ground and darkening them on paper.
    const occ = new Float32Array(COLS * ROWS);
    for (const c of cells) occ[c.i] = 1;
    const [dx, dy] = [Math.round((0.045 * FIT.short) / CW), Math.round((0.065 * FIT.short) / LH)];
    const shadow = new Float32Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const [sr, sc] = [r - dy, c - dx];
      if (sr >= 0 && sc >= 0) shadow[r * COLS + c] = occ[sr * COLS + sc];
    }
    coverBoxBlur(shadow, COLS, ROWS, Math.round((0.07 * FIT.short) / CW), Math.round((0.07 * FIT.short) / LH));
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

    // The accent's glow: its cells, blurred under the letters.
    const hot = m.hot;
    glow.width = cv.width;
    glow.height = cv.height;
    gctx.setTransform(scale, 0, 0, scale, 0, 0);
    gctx.fillStyle = m.colors.accent;
    for (const c of cells) if (c.part === hot && c.letter) gctx.fillRect(X0 + (c.i % COLS) * CW, Math.floor(c.i / COLS) * LH, CW, LH);
    if (hot >= 0) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = TONES.glow.alpha * COVER.glow * Math.min(1, Math.max(0.45, 0.15 / m.parts[hot].share));
      ctx.filter = `blur(${TONES.glow.blur * COVER.glow * scale}px)`;
      ctx.drawImage(glow, 0, 0);
      ctx.restore();
    }

    const groups = new Map();
    for (const c of cells) {
      const isHot = c.part === hot;
      const alpha = isHot ? q((TONES.hot.from + (1 - TONES.hot.from) * (TONES.hot.by === "light" ? c.b : c.v)) * Math.max(0.5, c.fade)) : q(coverInkAlpha(m, c.kind, c.v) * c.fade);
      const weight = isHot || c.kind === "mark" || c.v > 0.42 ? 700 : 400;
      const g = `${isHot ? 1 : 0}|${weight}|${alpha}`;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(c);
    }
    for (const [g, list] of groups) {
      const [isHot, weight, alpha] = g.split("|");
      ctx.font = `${weight} ${R.size}px ${MONO}`;
      ctx.fillStyle = rgba(isHot === "1" ? m.colors.accent : m.colors.ink, +alpha);
      if (isHot === "1" && TONES.glow.letters) [ctx.shadowColor, ctx.shadowBlur] = [rgba(m.colors.accent, 0.8), TONES.glow.letters * scale];
      for (const c of list) ctx.fillText(c.ch, X0 + (c.i % COLS) * CW, Math.floor(c.i / COLS) * LH + LH * 0.8);
      ctx.shadowBlur = 0;
    }
    window.coverShown = f;
  }

  /** Draw loop frame f at `scale` and return its measurements, as the checks read them. */
  window.coverFrame = (f, scale = 2) => {
    draw(f, scale);
    return coverMeasure(m, f);
  };
  /** Glyph changes per step over the whole loop, once every frame has been drawn. */
  window.coverSteps = () => coverSteps(m);
  window.cover = { frames: m.frames, still: F.still, report: window.coverFrame(F.still, 2) };
  window.drawn = true;
})().catch((e) => {
  window.coverError = String(e && e.stack ? e.stack : e);
  throw e;
});

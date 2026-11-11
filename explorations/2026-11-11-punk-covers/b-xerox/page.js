// The copier. render.mjs hands it the model; it paints the master (form, template) as two plates, ink and spot, and
// for each frame photocopies them: generation loss, pasted strips, a spot plate out of register, toner grain.
// Every plate is an alpha mask until the last step, which thresholds it hard: three colours, no greys.
(() => {
  const S = 2;
  const MARGIN = 28;
  const NAME_TRACK = -0.058;
  const CLASSES = ["blank", "dot", "symbol", "letter", "bold", "solid"];
  const SYMBOLS = [":", "-", "+", ":", "="];
  let d;
  let layout;
  let tplInk;
  let tplSpot;
  let nameMaster;

  const hash = (x, y, s) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  const canvas = () => {
    const c = document.createElement("canvas");
    c.width = d.W * S;
    c.height = d.H * S;
    const ctx = c.getContext("2d");
    ctx.scale(S, S);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";
    return [c, ctx];
  };

  const nameFont = (px) => `900 ${px}px Grot`;

  /** The name's size and place: as wide as the sheet plus a bite off the right edge, its foot cut by the bottom. */
  function measureName(product, W, H) {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = nameFont(100);
    ctx.letterSpacing = `${NAME_TRACK * 100}px`;
    const m = ctx.measureText(product);
    const width = m.actualBoundingBoxRight + m.actualBoundingBoxLeft;
    const target = W - MARGIN + 14 - (MARGIN - 6);
    let size = (100 * target) / width;
    const cap = (px) => (m.actualBoundingBoxAscent * px) / 100;
    if (cap(size) > 270) size = (270 * 100) / m.actualBoundingBoxAscent;
    const baseline = H + cap(size) * 0.085;
    const top = baseline - cap(size);
    return { size, baseline, top, left: MARGIN - 6 + (m.actualBoundingBoxLeft * size) / 100, formBottom: top - 58, labelY: top - 22 };
  }

  function wrap(ctx, text, width) {
    const lines = [];
    let line = "";
    for (const word of text.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    return [...lines, line];
  }

  /** A highlighter block: hard-edged, a little crooked, its ends torn by the marker running dry. */
  function marker(ctx, x, y, w, h, seed) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(((hash(seed, 1, 3) - 0.5) * 2.2 * Math.PI) / 180);
    ctx.fillRect(-w / 2, -h / 2, w, h);
    for (let i = 0; i < 26; i++) {
      const yy = -h / 2 + hash(seed, i, 5) * h;
      ctx.fillRect(w / 2, yy, hash(seed, i, 6) * 7, 1 + hash(seed, i, 7) * 2);
      ctx.fillRect(-w / 2 - hash(seed, i, 8) * 5, yy, hash(seed, i, 8) * 5, 1 + hash(seed, i, 9) * 2);
    }
    ctx.restore();
  }

  function paintTemplate() {
    const t = d.text;
    let ctx;
    [tplInk, ctx] = canvas();
    const [, sctx] = ([tplSpot] = canvas());
    // Two columns of metadata at the top, as in the reference.
    ctx.font = "400 9.5px Commit";
    ctx.textBaseline = "alphabetic";
    const lead = 12;
    const top = MARGIN + 8;
    t.record.forEach((line, i) => ctx.fillText(line, MARGIN, top + i * lead));
    const commit = t.record[0].split(" at ")[1];
    const cx = MARGIN + ctx.measureText(t.record[0].split(" at ")[0] + " at ").width;
    marker(sctx, cx - 3, top - 9, ctx.measureText(commit).width + 6, 12, d.seed + 11);
    const legendX = 236;
    const legendW = 300;
    const lines = wrap(ctx, t.legend, legendW);
    lines.forEach((line, i) => ctx.fillText(line, legendX, top + i * lead));
    // The highlighter over the accent's name in the legend ties the words to the spot colour.
    // The name may wrap, so mark each line's share of it.
    const from = lines.join(" ").toLowerCase().indexOf(t.accentName.toLowerCase());
    const to = from + t.accentName.length;
    let start = 0;
    lines.forEach((line, i) => {
      const a = Math.max(from, start) - start;
      const b = Math.min(to, start + line.length) - start;
      start += line.length + 1;
      if (from < 0 || b <= a) return;
      const x = legendX + ctx.measureText(line.slice(0, a)).width;
      marker(sctx, x - 3, top + i * lead - 9, ctx.measureText(line.slice(a, b)).width + 6, 12, d.seed + 12 + i);
    });
    // The stamp: an archive number, in the spot plate, rubber-stamped and crooked.
    sctx.save();
    sctx.translate(d.W - MARGIN - 78, MARGIN + 26);
    sctx.rotate((-4 * Math.PI) / 180);
    sctx.lineWidth = 3;
    sctx.strokeRect(-76, -28, 152, 58);
    sctx.font = "700 8.5px Commit";
    sctx.fillText("VYO ARCHIVE", -68, -15);
    sctx.textAlign = "right";
    sctx.fillText(t.series, 68, -15);
    sctx.textAlign = "left";
    sctx.font = nameFont(33);
    sctx.letterSpacing = "-1.5px";
    sctx.fillText(`N°${t.archive}`, -69, 20);
    sctx.restore();
    // The label over the name.
    ctx.font = "400 11px Commit";
    ctx.fillText(t.headline, MARGIN, layout.labelY);
    // Dust on the copier glass: the same specks on every copy.
    for (let i = 0; i < 70; i++) {
      const x = hash(d.seed, i, 21) * d.W;
      const y = hash(d.seed, i, 22) * d.H;
      const r = 0.4 + hash(d.seed, i, 23) ** 3 * 2.2;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.5 + hash(d.seed, i, 24)), hash(d.seed, i, 25) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    let nctx;
    [nameMaster, nctx] = canvas();
    nctx.font = nameFont(layout.size);
    nctx.letterSpacing = `${NAME_TRACK * layout.size}px`;
    nctx.fillText(t.product, layout.left, layout.baseline);
  }

  /** The form's two plates under one key's light: type and symbols in ink, the accent's cells in the spot colour. */
  function paintForm(classes) {
    const [ink, ctx] = canvas();
    const [spot, sctx] = canvas();
    const { w, h } = d.cell;
    const regular = `400 ${w / 0.6}px Commit`;
    const bold = `700 ${w / 0.6}px Commit`;
    ctx.textBaseline = "alphabetic";
    d.cells.forEach(([c, r, part, ch], i) => {
      const cls = CLASSES[classes[i]];
      const x = d.x0 + c * w;
      const y = d.formTop + r * h;
      if (part === d.accent && cls !== "blank" && cls !== "dot") sctx.fillRect(x, y, w, h);
      if (cls === "blank") return;
      if (cls === "solid") return ctx.fillRect(x, y, w, h);
      if (cls === "dot") {
        if (hash(c, r, d.seed) < 0.5) ctx.fillRect(x + w / 2 - 0.6, y + h * 0.62, 1.4, 1.4);
        return;
      }
      if (cls === "symbol") {
        ctx.font = regular;
        return ctx.fillText(SYMBOLS[Math.floor(hash(c, r, d.seed + 1) * SYMBOLS.length)], x, y + h * 0.78);
      }
      ctx.font = cls === "bold" ? bold : regular;
      ctx.fillText(ch, x, y + h * 0.78);
    });
    return { ink, spot };
  }

  /** One copier generation: each copy a touch larger and more crooked, softer at the edge before the threshold. */
  function generation(src, gen) {
    if (!gen) return src;
    const [c] = canvas();
    const ctx = c.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const cx = ((d.maskBox.left + d.maskBox.right) / 2) * S;
    const cy = ((d.maskBox.top + d.maskBox.bottom) / 2) * S;
    ctx.translate(cx, cy);
    ctx.rotate((gen * 0.22 * Math.PI) / 180);
    ctx.scale(1 + gen * 0.006, 1 + gen * 0.006);
    ctx.translate(-cx, -cy);
    ctx.filter = `blur(${0.45 * gen}px)`;
    ctx.drawImage(src, 0, 0);
    return c;
  }

  /** The master cut into strips and pasted back, each slipped sideways by the key's amount. */
  function paste(dst, src, slips) {
    const ctx = dst.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    d.strips.forEach(([y0, y1], i) => ctx.drawImage(src, 0, y0 * S, src.width, (y1 - y0) * S, slips[i] * S, y0 * S, src.width, (y1 - y0) * S));
  }

  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

  function frame(f, hold) {
    const k = Math.floor(f / hold);
    const key = d.timeline[k];
    const form = paintForm(d.classes[k]);
    // Ink plate: the form and the name, copied and pasted in strips, over the metadata, which is pasted fresh.
    const [inkM, inkCtx] = canvas();
    const [both, bctx] = canvas();
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.drawImage(form.ink, 0, 0);
    bctx.drawImage(nameMaster, 0, 0);
    paste(inkM, generation(both, key.gen), key.slips);
    inkCtx.setTransform(1, 0, 0, 1, 0, 0);
    inkCtx.drawImage(tplInk, 0, 0);
    const [spotM, spotCtx] = canvas();
    paste(spotM, generation(form.spot, key.gen), key.slips);
    spotCtx.setTransform(1, 0, 0, 1, 0, 0);
    spotCtx.drawImage(tplSpot, 0, 0);

    const Wp = d.W * S;
    const Hp = d.H * S;
    const ink = inkM.getContext("2d").getImageData(0, 0, Wp, Hp).data;
    const spot = spotM.getContext("2d").getImageData(0, 0, Wp, Hp).data;
    const [cg, ci, cs] = [d.colors.ground, d.colors.ink, d.colors.spot].map(rgb);
    const [out, octx] = canvas();
    const img = octx.createImageData(Wp, Hp);
    const px = img.data;
    const g = key.gen;
    const amp = 46 + 30 * g;
    const level = 128 - 5 * g;
    const drop = 0.006 + 0.014 * g;
    const fs = d.seed * 7919 + f;
    const [ox, oy] = key.spotOffset.map((v) => v * S);
    const streak = Math.floor(hash(d.seed, 5, 5) * (Wp - 40)) + 20;
    const box = { l: (d.maskBox.left - 24) * S, r: (d.maskBox.right + 24) * S, t: (d.maskBox.top - 24) * S, b: Math.min(d.maskBox.bottom + 24, layout.formBottom) * S };
    let inkN = 0;
    let spotN = 0;
    for (let y = 0; y < Hp; y++) {
      const inBoxY = y >= box.t && y < box.b;
      // The metadata is pasted fresh on every copy; only the form and the name lose generations.
      const a0 = y < d.formTop * S ? 46 : amp;
      const l0 = y < d.formTop * S ? 128 : level;
      for (let x = 0; x < Wp; x++) {
        const i = (y * Wp + x) * 4;
        const clump = hash(x >> 1, y >> 1, fs);
        let on = ink[i + 3] + (clump - 0.5) * a0 > l0;
        if (on && hash(x >> 2, y >> 2, fs + 1) < (y < d.formTop * S ? 0.006 : drop)) on = false;
        if (!on && clump < 0.0016) on = true;
        if (!on && x >= streak && x < streak + 3 && hash(x, y >> 3, fs + 2) < 0.22) on = true;
        const sx = x - ox;
        const sy = y - oy;
        let son = false;
        if (sx >= 0 && sx < Wp && sy >= 0 && sy < Hp) {
          const a = spot[(sy * Wp + sx) * 4 + 3];
          son = a + (hash(sx >> 1, sy >> 1, fs + 3) - 0.5) * amp > level && hash(sx >> 2, sy >> 2, fs + 4) > drop * 0.6;
        }
        const c = on ? ci : son ? cs : cg;
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
        px[i + 3] = 255;
        if (inBoxY && x >= box.l && x < box.r) {
          if (on) inkN++;
          if (son) spotN++;
        }
      }
    }
    octx.putImageData(img, 0, 0);
    return { png: out.toDataURL("image/png").split(",")[1], stats: { ink: inkN, spot: spotN } };
  }

  window.xerox = {
    layout: ({ product }) => {
      layout = measureName(product, 840, 1190);
      return layout;
    },
    setup: (data) => {
      d = data;
      paintTemplate();
    },
    frame,
  };
})();

// Browser-side botanical rasterizer, crisp 7px pixel-mosaic quantizer, and sparse micro-type weaver.
// Renders onto an 840x1190 logical canvas (2x DPR = 1680x2380px).

window.renderMosaicPoster = function renderMosaicPoster(scene) {
  const W = scene.width;
  const H = scene.height;
  const PITCH = 7;
  const COLS = Math.floor(W / PITCH); // 120
  const ROWS = Math.floor(H / PITCH); // 170

  function cellHash(cx, cy, salt = 0) {
    let h =
      Math.imul(cx, 374761393) ^
      Math.imul(cy, 668265263) ^
      Math.imul(salt + scene.seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // Smooth 2D value noise for organic hand-printed botanical edge ripple
  function valueNoise(x, y, salt = 31) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = cellHash(ix, iy, salt);
    const b = cellHash(ix + 1, iy, salt);
    const c = cellHash(ix, iy + 1, salt);
    const d = cellHash(ix + 1, iy + 1, salt);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm(col, row, salt = 31) {
    return (
      valueNoise(col * 0.24, row * 0.24, salt) * 0.65 +
      valueNoise(col * 0.52, row * 0.52, salt + 19) * 0.35 -
      0.5
    );
  }

  const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  function makeLayer() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return { canvas: c, ctx: c.getContext("2d") };
  }

  const mistBuf = makeLayer();
  const slateBuf = makeLayer();
  const slateDeepBuf = makeLayer();
  const crimsonBuf = makeLayer();
  const crimsonDeepBuf = makeLayer();

  // ---- BOTANICAL DRAWING PRIMITIVES ----

  function evalCubic(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const x = mt2 * mt * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t2 * t * p3[0];
    const y = mt2 * mt * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t2 * t * p3[1];
    const dx =
      3 * mt2 * (p1[0] - p0[0]) +
      6 * mt * t * (p2[0] - p1[0]) +
      3 * t2 * (p3[0] - p2[0]);
    const dy =
      3 * mt2 * (p1[1] - p0[1]) +
      6 * mt * t * (p2[1] - p1[1]) +
      3 * t2 * (p3[1] - p2[1]);
    const len = Math.hypot(dx, dy) || 1;
    return { x, y, tx: dx / len, ty: dy / len };
  }

  function drawTaperedStem(ctx, pts, w0, w1, alpha = 1) {
    const steps = 42;
    const left = [];
    const right = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = evalCubic(pts[0], pts[1], pts[2], pts[3], t);
      const r = (w0 + (w1 - w0) * t) * 0.5;
      const nx = -p.ty;
      const ny = p.tx;
      left.push([p.x + nx * r, p.y + ny * r]);
      right.push([p.x - nx * r, p.y - ny * r]);
    }
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function traceSculptedPetal(ctx, p, scale = 1.0) {
    const L = p.len * scale;
    const Wp = p.wid * scale;
    const asym = p.asym || 0;
    const ruffle = p.ruffle || 0.09;
    const freq = p.ruffleFreq || 2;
    const phase = p.rufflePhase || 0;
    const notch = p.notch || 0.06;

    const steps = 38;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const side = u < 0.5 ? 1 : -1;
      const along = u < 0.5 ? u * 2 : (1 - u) * 2;

      const bell = Math.pow(Math.sin(along * Math.PI * 0.88), 0.72);
      const shoulder = 1 + 0.16 * Math.sin(along * Math.PI * 1.4);
      const sideBias = 1 + side * asym;

      const rimWeight = Math.max(0, (along - 0.42) / 0.58);
      const wave =
        Math.sin(u * Math.PI * 2 * freq + phase) * ruffle * rimWeight +
        Math.cos(u * Math.PI * 2 * (freq + 1) + phase * 1.3) * ruffle * 0.48 * rimWeight;

      const tipDip = Math.exp(-Math.pow((u - 0.5) / 0.09, 2)) * notch;

      const x = L * (0.04 + 0.96 * Math.pow(along, 0.78)) * (1 + wave - tipDip);
      const y = side * Wp * 0.52 * bell * shoulder * sideBias * (1 + wave * 0.8);
      pts.push([x, y]);
    }

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      ctx.quadraticCurveTo(prev[0], prev[1], (prev[0] + cur[0]) * 0.5, (prev[1] + cur[1]) * 0.5);
    }
    ctx.closePath();
  }

  function traceBotanicalLeaf(ctx, len, wid, curve, serration = 0.06, halfOnly = 0) {
    const steps = 26;
    const upper = [];
    const lower = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const sx = t * len;
      const sy = Math.sin(t * Math.PI) * len * curve * 0.28;
      const env = Math.pow(Math.sin(t * Math.PI), 0.75) * (1 - 0.20 * t);
      const tooth =
        t > 0.14 && t < 0.92
          ? 1 + Math.sin(t * Math.PI * 10) * serration * Math.sin(t * Math.PI)
          : 1;
      const hw = wid * 0.52 * env * tooth;
      upper.push([sx, sy - hw]);
      lower.push([sx, sy + hw]);
    }
    ctx.beginPath();
    if (halfOnly === 1) {
      ctx.moveTo(0, 0);
      for (let i = 1; i <= steps; i++) ctx.lineTo(upper[i][0], upper[i][1]);
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        ctx.lineTo(t * len, Math.sin(t * Math.PI) * len * curve * 0.28);
      }
    } else if (halfOnly === -1) {
      ctx.moveTo(0, 0);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        ctx.lineTo(t * len, Math.sin(t * Math.PI) * len * curve * 0.28);
      }
      for (let i = steps; i >= 0; i--) ctx.lineTo(lower[i][0], lower[i][1]);
    } else {
      ctx.moveTo(upper[0][0], upper[0][1]);
      for (let i = 1; i <= steps; i++) ctx.lineTo(upper[i][0], upper[i][1]);
      for (let i = steps; i >= 0; i--) ctx.lineTo(lower[i][0], lower[i][1]);
    }
    ctx.closePath();
  }

  // ---- LAYER 1: BACKGROUND MIST TENDRILS & STEMS ----
  for (const t of scene.bgTendrils) {
    drawTaperedStem(mistBuf.ctx, t.pts, t.w0, t.w1, 0.76);
  }

  for (const s of scene.stems) {
    if (s.tone === "mist") {
      drawTaperedStem(mistBuf.ctx, s.pts, s.w0, s.w1, 0.86);
    } else {
      drawTaperedStem(mistBuf.ctx, s.pts, s.w0 + 2.4, s.w1 + 1.4, 0.42);
      drawTaperedStem(slateBuf.ctx, s.pts, s.w0, s.w1, 0.92);
      drawTaperedStem(slateDeepBuf.ctx, s.pts, s.w0 * 0.5, s.w1 * 0.4, 0.62);
    }
  }

  // ---- LAYER 2: AIRY UPPER-RIGHT MISTY TWIGS & BERRY NODES ----
  for (const tw of scene.twigs) {
    drawTaperedStem(
      mistBuf.ctx,
      [tw.p0, tw.p1, tw.p2, tw.p3],
      tw.width,
      Math.max(2.3, tw.width * 0.72),
      0.86
    );
    for (const lf of tw.leaflets) {
      mistBuf.ctx.save();
      mistBuf.ctx.translate(lf.x, lf.y);
      mistBuf.ctx.rotate(lf.angle);
      traceBotanicalLeaf(mistBuf.ctx, lf.len, lf.wid, 0.14, 0.04, 0);
      mistBuf.ctx.fillStyle = "rgba(255,255,255,0.84)";
      mistBuf.ctx.fill();
      mistBuf.ctx.restore();
    }
    for (const b of tw.berries) {
      slateBuf.ctx.save();
      slateBuf.ctx.fillStyle = "rgba(255,255,255,0.95)";
      slateBuf.ctx.beginPath();
      slateBuf.ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      slateBuf.ctx.fill();
      slateBuf.ctx.restore();

      slateDeepBuf.ctx.save();
      slateDeepBuf.ctx.fillStyle = "rgba(255,255,255,0.85)";
      slateDeepBuf.ctx.beginPath();
      slateDeepBuf.ctx.arc(b.x, b.y, b.r * 0.76, 0, Math.PI * 2);
      slateDeepBuf.ctx.fill();
      slateDeepBuf.ctx.restore();
    }
  }

  // ---- LAYER 3: BOTANICAL LEAVES ----
  const sortedLeaves = [...scene.leaves].sort((a, b) => a.depth - b.depth);
  for (const lf of sortedLeaves) {
    if (lf.tone === "mist") {
      mistBuf.ctx.save();
      mistBuf.ctx.translate(lf.x, lf.y);
      mistBuf.ctx.rotate(lf.angle);
      traceBotanicalLeaf(mistBuf.ctx, lf.length, lf.width, lf.curve, lf.serration, 0);
      mistBuf.ctx.fillStyle = "rgba(255,255,255,0.84)";
      mistBuf.ctx.fill();
      mistBuf.ctx.restore();
    } else {
      mistBuf.ctx.save();
      mistBuf.ctx.translate(lf.x, lf.y);
      mistBuf.ctx.rotate(lf.angle);
      traceBotanicalLeaf(mistBuf.ctx, lf.length * 1.05, lf.width * 1.1, lf.curve, lf.serration, 0);
      mistBuf.ctx.fillStyle = "rgba(255,255,255,0.52)";
      mistBuf.ctx.fill();
      mistBuf.ctx.restore();

      slateBuf.ctx.save();
      slateBuf.ctx.translate(lf.x, lf.y);
      slateBuf.ctx.rotate(lf.angle);
      traceBotanicalLeaf(slateBuf.ctx, lf.length, lf.width, lf.curve, lf.serration, 0);
      slateBuf.ctx.fillStyle = "rgba(255,255,255,0.92)";
      slateBuf.ctx.fill();
      // Subtle sunlit midrib & vein lightening
      slateBuf.ctx.globalCompositeOperation = "destination-out";
      slateBuf.ctx.strokeStyle = "rgba(255,255,255,0.48)";
      slateBuf.ctx.lineWidth = 3.0;
      slateBuf.ctx.beginPath();
      slateBuf.ctx.moveTo(lf.length * 0.12, 0);
      slateBuf.ctx.quadraticCurveTo(lf.length * 0.5, lf.length * lf.curve * 0.25, lf.length * 0.84, 0);
      slateBuf.ctx.stroke();
      slateBuf.ctx.restore();

      slateDeepBuf.ctx.save();
      slateDeepBuf.ctx.translate(lf.x, lf.y);
      slateDeepBuf.ctx.rotate(lf.angle);
      traceBotanicalLeaf(slateDeepBuf.ctx, lf.length * 0.92, lf.width * 0.9, lf.curve, lf.serration, -1);
      slateDeepBuf.ctx.fillStyle = "rgba(255,255,255,0.74)";
      slateDeepBuf.ctx.fill();
      slateDeepBuf.ctx.restore();
    }
  }

  // ---- LAYER 4: CLOSED BOTANICAL BUDS ----
  for (const b of scene.buds) {
    if (b.stemFrom) {
      const mx = (b.stemFrom[0] + b.x) * 0.5 - 16;
      const my = (b.stemFrom[1] + b.y) * 0.5 + 12;
      drawTaperedStem(
        slateBuf.ctx,
        [b.stemFrom, [mx, my], [b.x, b.y + 22], [b.x, b.y]],
        5.2,
        3.4,
        0.85
      );
    }
    const sz = b.size;
    for (const ang of [-0.45, 0, 0.45]) {
      mistBuf.ctx.save();
      mistBuf.ctx.translate(b.x, b.y);
      mistBuf.ctx.rotate(b.angle + ang);
      traceBotanicalLeaf(mistBuf.ctx, sz * 1.18, sz * 0.72, ang * 0.4, 0.03, 0);
      mistBuf.ctx.fillStyle = "rgba(255,255,255,0.88)";
      mistBuf.ctx.fill();
      mistBuf.ctx.restore();
    }
    slateBuf.ctx.save();
    slateBuf.ctx.translate(b.x, b.y);
    slateBuf.ctx.rotate(b.angle);
    traceBotanicalLeaf(slateBuf.ctx, sz * 0.94, sz * 0.68, 0.05, 0.02, 0);
    slateBuf.ctx.fillStyle = "rgba(255,255,255,0.95)";
    slateBuf.ctx.fill();
    slateBuf.ctx.restore();

    slateDeepBuf.ctx.save();
    slateDeepBuf.ctx.translate(b.x, b.y);
    slateDeepBuf.ctx.rotate(b.angle);
    traceBotanicalLeaf(slateDeepBuf.ctx, sz * 0.72, sz * 0.54, 0.05, 0.02, 0);
    slateDeepBuf.ctx.fillStyle = "rgba(255,255,255,0.80)";
    slateDeepBuf.ctx.fill();
    slateDeepBuf.ctx.restore();

    if (b.hasCrimsonPeek) {
      crimsonBuf.ctx.save();
      crimsonBuf.ctx.translate(
        b.x + Math.cos(b.angle) * sz * 0.52,
        b.y + Math.sin(b.angle) * sz * 0.52
      );
      crimsonBuf.ctx.fillStyle = "rgba(255,255,255,0.95)";
      crimsonBuf.ctx.beginPath();
      crimsonBuf.ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
      crimsonBuf.ctx.fill();
      crimsonBuf.ctx.restore();
    }
  }

  // ---- LAYER 5: SCULPTED MULTI-LAYERED BOTANICAL BLOOMS ----
  for (const bloom of scene.blooms) {
    if (bloom.kind === "mist-blossom") {
      mistBuf.ctx.save();
      mistBuf.ctx.translate(bloom.x, bloom.y);
      mistBuf.ctx.rotate(bloom.tilt);
      mistBuf.ctx.scale(1, bloom.squashY);
      for (const p of bloom.outerPetals) {
        mistBuf.ctx.save();
        mistBuf.ctx.rotate(p.angle);
        traceSculptedPetal(mistBuf.ctx, p, 1.0);
        mistBuf.ctx.fillStyle = "rgba(255,255,255,0.88)";
        mistBuf.ctx.fill();
        mistBuf.ctx.restore();
      }
      for (const p of bloom.innerPetals) {
        mistBuf.ctx.save();
        mistBuf.ctx.rotate(p.angle);
        traceSculptedPetal(mistBuf.ctx, p, 1.0);
        mistBuf.ctx.fillStyle = "rgba(255,255,255,0.96)";
        mistBuf.ctx.fill();
        mistBuf.ctx.restore();
      }
      mistBuf.ctx.restore();

      const cx = bloom.x + Math.cos(bloom.calyxAngle) * bloom.radius * 0.42;
      const cy = bloom.y + Math.sin(bloom.calyxAngle) * bloom.radius * 0.42;
      for (const ang of [-0.55, 0, 0.55]) {
        slateBuf.ctx.save();
        slateBuf.ctx.translate(cx, cy);
        slateBuf.ctx.rotate(bloom.calyxAngle - Math.PI + ang);
        traceBotanicalLeaf(slateBuf.ctx, bloom.calyxSize * 1.14, bloom.calyxSize * 0.72, ang * 0.35, 0.04, 0);
        slateBuf.ctx.fillStyle = "rgba(255,255,255,0.94)";
        slateBuf.ctx.fill();
        slateBuf.ctx.restore();

        slateDeepBuf.ctx.save();
        slateDeepBuf.ctx.translate(cx, cy);
        slateDeepBuf.ctx.rotate(bloom.calyxAngle - Math.PI + ang);
        traceBotanicalLeaf(slateDeepBuf.ctx, bloom.calyxSize * 0.84, bloom.calyxSize * 0.54, ang * 0.35, 0.04, 0);
        slateDeepBuf.ctx.fillStyle = "rgba(255,255,255,0.78)";
        slateDeepBuf.ctx.fill();
        slateDeepBuf.ctx.restore();
      }
    } else if (bloom.kind === "crimson-hero") {
      // (1) Pale misty ruffled outer petals fanning asymmetrically
      mistBuf.ctx.save();
      mistBuf.ctx.translate(bloom.x, bloom.y);
      mistBuf.ctx.rotate(bloom.tilt);
      mistBuf.ctx.scale(1, bloom.squashY);
      for (const p of bloom.mistPetals) {
        mistBuf.ctx.save();
        mistBuf.ctx.rotate(p.angle);
        traceSculptedPetal(mistBuf.ctx, p, 1.0);
        mistBuf.ctx.fillStyle = "rgba(255,255,255,0.92)";
        mistBuf.ctx.fill();
        mistBuf.ctx.restore();
      }
      mistBuf.ctx.restore();

      // (2) Deep slate-blue cupping calyx/shadow folds
      for (const sc of bloom.slateCups) {
        slateBuf.ctx.save();
        slateBuf.ctx.translate(bloom.x, bloom.y);
        slateBuf.ctx.rotate(bloom.tilt);
        slateBuf.ctx.scale(1, bloom.squashY);
        slateBuf.ctx.rotate(sc.angle);
        traceSculptedPetal(slateBuf.ctx, sc, 1.0);
        slateBuf.ctx.fillStyle = "rgba(255,255,255,0.94)";
        slateBuf.ctx.fill();
        slateBuf.ctx.restore();

        slateDeepBuf.ctx.save();
        slateDeepBuf.ctx.translate(bloom.x, bloom.y);
        slateDeepBuf.ctx.rotate(bloom.tilt);
        slateDeepBuf.ctx.scale(1, bloom.squashY);
        slateDeepBuf.ctx.rotate(sc.angle);
        traceSculptedPetal(slateDeepBuf.ctx, sc, 0.82);
        slateDeepBuf.ctx.fillStyle = "rgba(255,255,255,0.76)";
        slateDeepBuf.ctx.fill();
        slateDeepBuf.ctx.restore();
      }

      // (3) Sculpted asymmetric crimson wing petals separated by crisp curved mist crevices!
      const hx = bloom.x + bloom.heartOffset[0];
      const hy = bloom.y + bloom.heartOffset[1];

      crimsonBuf.ctx.save();
      crimsonBuf.ctx.translate(hx, hy);
      crimsonBuf.ctx.rotate(bloom.tilt);
      crimsonBuf.ctx.scale(1, bloom.squashY);

      for (let i = 0; i < bloom.crimsonOuter.length; i++) {
        const p = bloom.crimsonOuter[i];
        crimsonBuf.ctx.save();
        crimsonBuf.ctx.rotate(p.angle);
        if (i > 0) {
          crimsonBuf.ctx.globalCompositeOperation = "destination-out";
          traceSculptedPetal(crimsonBuf.ctx, p, 1.03);
          crimsonBuf.ctx.lineWidth = p.gapWidth || 9.5;
          crimsonBuf.ctx.strokeStyle = "rgba(255,255,255,0.94)";
          crimsonBuf.ctx.stroke();
        }
        crimsonBuf.ctx.globalCompositeOperation = "source-over";
        traceSculptedPetal(crimsonBuf.ctx, p, 1.0);
        crimsonBuf.ctx.fillStyle = "rgba(255,255,255,0.96)";
        crimsonBuf.ctx.fill();
        crimsonBuf.ctx.restore();

        crimsonDeepBuf.ctx.save();
        crimsonDeepBuf.ctx.translate(hx, hy);
        crimsonDeepBuf.ctx.rotate(bloom.tilt);
        crimsonDeepBuf.ctx.scale(1, bloom.squashY);
        crimsonDeepBuf.ctx.rotate(p.angle);
        traceSculptedPetal(crimsonDeepBuf.ctx, p, 0.54);
        crimsonDeepBuf.ctx.fillStyle = "rgba(255,255,255,0.72)";
        crimsonDeepBuf.ctx.fill();
        crimsonDeepBuf.ctx.restore();
      }

      // Carve generous curved pale-mist petal crevices between outer crimson wings
      crimsonBuf.ctx.globalCompositeOperation = "destination-out";
      for (let i = 0; i < bloom.crimsonOuter.length; i++) {
        const pA = bloom.crimsonOuter[i];
        const pB = bloom.crimsonOuter[(i + 1) % bloom.crimsonOuter.length];
        const midA = pA.angle + 0.5 * (((pB.angle - pA.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const reach = Math.min(pA.len, pB.len) * 1.12;
        crimsonBuf.ctx.beginPath();
        crimsonBuf.ctx.moveTo(Math.cos(midA) * bloom.radius * 0.12, Math.sin(midA) * bloom.radius * 0.12);
        crimsonBuf.ctx.quadraticCurveTo(
          Math.cos(midA + 0.16) * reach * 0.55,
          Math.sin(midA + 0.16) * reach * 0.55,
          Math.cos(midA) * reach,
          Math.sin(midA) * reach
        );
        crimsonBuf.ctx.lineWidth = i % 2 === 0 ? 14.5 : 10.5;
        crimsonBuf.ctx.lineCap = "round";
        crimsonBuf.ctx.strokeStyle = "rgba(255,255,255,0.95)";
        crimsonBuf.ctx.stroke();
      }

      // (4) Inner cupped crimson petals framing the tilted heart
      for (const p of bloom.crimsonInner) {
        crimsonBuf.ctx.save();
        crimsonBuf.ctx.rotate(p.angle);
        crimsonBuf.ctx.globalCompositeOperation = "destination-out";
        traceSculptedPetal(crimsonBuf.ctx, p, 1.05);
        crimsonBuf.ctx.lineWidth = 6.5;
        crimsonBuf.ctx.strokeStyle = "rgba(255,255,255,0.85)";
        crimsonBuf.ctx.stroke();

        crimsonBuf.ctx.globalCompositeOperation = "source-over";
        traceSculptedPetal(crimsonBuf.ctx, p, 1.0);
        crimsonBuf.ctx.fillStyle = "rgba(255,255,255,0.98)";
        crimsonBuf.ctx.fill();
        crimsonBuf.ctx.restore();
      }

      // Open botanical stamen/heart crevice showing pale mist & slate inside center
      crimsonBuf.ctx.globalCompositeOperation = "destination-out";
      crimsonBuf.ctx.beginPath();
      crimsonBuf.ctx.ellipse(0, 0, bloom.radius * 0.10, bloom.radius * 0.065, 0.35, 0, Math.PI * 2);
      crimsonBuf.ctx.fillStyle = "rgba(255,255,255,0.92)";
      crimsonBuf.ctx.fill();
      crimsonBuf.ctx.restore();
    }
  }

  // ---- SAMPLE BUFFERS & QUANTIZE ONTO THE CRISP 7px MOSAIC GRID ----
  const mistImg = mistBuf.ctx.getImageData(0, 0, W, H).data;
  const slateImg = slateBuf.ctx.getImageData(0, 0, W, H).data;
  const slateDeepImg = slateDeepBuf.ctx.getImageData(0, 0, W, H).data;
  const crimsonImg = crimsonBuf.ctx.getImageData(0, 0, W, H).data;
  const crimsonDeepImg = crimsonDeepBuf.ctx.getImageData(0, 0, W, H).data;

  // tone: 0=empty, 1=mistLight, 2=mistMid, 3=slateLight, 4=slateMid, 5=slateDeep, 6=crimsonBright, 7=crimsonDeep
  const gridTone = new Uint8Array(COLS * ROWS);

  const canvas = document.getElementById("poster");
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const GROUND = "#F1F3F6";
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, W, H);

  const PALETTE = {
    1: "#D5DFE7", // mistLight
    2: "#C0CED9", // mistMid
    3: "#7DA0B7", // slateLight
    4: "#4B7996", // slateMid
    5: "#345E7A", // slateDeep
    6: "#CB222B", // crimsonBright
    7: "#B21B23", // crimsonDeep
  };

  function drawRoundedRect(x, y, w, h, rx) {
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

  for (let row = 0; row < ROWS; row++) {
    const y0 = row * PITCH;
    for (let col = 0; col < COLS; col++) {
      const x0 = col * PITCH;

      // Sacred serene top-left headline sanctuary
      if (y0 < 215 && x0 < 535) continue;
      if (y0 < 265 && x0 < 310) continue;

      let sMist = 0;
      let sSlate = 0;
      let sSlateD = 0;
      let sCrim = 0;
      let sCrimD = 0;
      const samples = PITCH * PITCH;

      for (let dy = 0; dy < PITCH; dy++) {
        const rowOff = (y0 + dy) * W;
        for (let dx = 0; dx < PITCH; dx++) {
          const idx = (rowOff + x0 + dx) * 4 + 3;
          sMist += mistImg[idx];
          sSlate += slateImg[idx];
          sSlateD += slateDeepImg[idx];
          sCrim += crimsonImg[idx];
          sCrimD += crimsonDeepImg[idx];
        }
      }

      const norm = 1 / (samples * 255);
      const vMist = sMist * norm;
      const vSlate = sSlate * norm;
      const vSlateD = sSlateD * norm;
      const vCrim = sCrim * norm;
      const vCrimD = sCrimD * norm;

      // Smooth organic botanical ripple + subtle Bayer screenprint halftone modulation
      const bayer = BAYER4[row & 3][col & 3] / 16 - 0.5;
      const organic = fbm(col, row, 47) * 0.24;
      const micro = (cellHash(col, row, 17) - 0.5) * 0.12 + bayer * 0.10;
      const mod = organic + micro;

      const hasSupportPetal = vMist > 0.24 || vSlate > 0.24;
      const crimsonHit =
        vCrim > 0.42 || (vCrim + mod > 0.36 && vCrim > 0.25 && hasSupportPetal);

      let tone = 0;
      let size = 5.4;
      let rx = 0.8;

      if (crimsonHit) {
        tone = vCrimD + micro * 0.5 > 0.45 ? 7 : 6;
        size = vCrim > 0.58 ? 5.65 : 4.85;
        rx = size * 0.41; // jewel-like crimson dot/bead
      } else if (vSlate + mod * 0.72 > 0.30) {
        if (vSlateD + micro * 0.5 > 0.43) tone = 5;
        else if (vSlate + micro * 0.5 > 0.48) tone = 4;
        else tone = 3;
        size = vSlate > 0.56 ? 5.55 : 4.75;
        rx = size * 0.25; // crisp softly-rounded slate square
      } else if (vMist + mod * 0.58 > 0.23) {
        tone = vMist + micro * 0.45 > 0.46 ? 2 : 1;
        size = vMist > 0.50 ? 5.45 : 4.50;
        rx = 0.65; // crisp delicate mist square
      }

      if (tone > 0) {
        gridTone[row * COLS + col] = tone;
        ctx.fillStyle = PALETTE[tone];
        const pad = (PITCH - size) * 0.5;
        drawRoundedRect(x0 + pad, y0 + pad, size, size, rx);
      }
    }
  }

  // ---- SPARSE, CRISP, DEDUPLICATED MICRO-TYPE WOVEN ONTO THE MOSAIC ----
  const textBlocked = new Uint8Array(COLS * ROWS);
  const phraseLastPos = new Map(); // enforce wide separation before any phrase could ever repeat

  function markBlocked(c0, r0, c1, r1) {
    const xA = Math.max(0, Math.floor(c0));
    const xB = Math.min(COLS - 1, Math.ceil(c1));
    const yA = Math.max(0, Math.floor(r0));
    const yB = Math.min(ROWS - 1, Math.ceil(r1));
    for (let r = yA; r <= yB; r++) {
      for (let c = xA; c <= xB; c++) {
        textBlocked[r * COLS + c] = 1;
      }
    }
  }

  function isAreaFree(c0, r0, c1, r1) {
    if (c0 < 2 || c1 >= COLS - 2 || r0 < 28 || r1 >= ROWS - 2) return false;
    for (let r = Math.floor(r0); r <= Math.ceil(r1); r++) {
      for (let c = Math.floor(c0); c <= Math.ceil(c1); c++) {
        if (textBlocked[r * COLS + c]) return false;
      }
    }
    return true;
  }

  function countLocalInk(c, r, rad) {
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

  ctx.save();
  ctx.textBaseline = "alphabetic";

  function colsForText(str, font) {
    ctx.font = font;
    return Math.ceil(ctx.measureText(str).width / PITCH);
  }

  let placedCount = 0;

  function tryPlaceText(str, col, row, padX, padY, font, fillColor, minRepeatDist = 52) {
    const prev = phraseLastPos.get(str);
    if (prev && Math.hypot(col - prev[0], row - prev[1]) < minRepeatDist) return false;

    const span = colsForText(str, font);
    if (!isAreaFree(col - padX, row - padY, col + span + padX, row + padY)) return false;

    const x = col * PITCH;
    const y = (row + 0.84) * PITCH;
    ctx.font = font;
    ctx.fillStyle = fillColor;
    ctx.fillText(str, x, y);
    markBlocked(col - padX, row - padY, col + span + padX, row + padY);
    phraseLastPos.set(str, [col, row]);
    placedCount++;
    return true;
  }

  const FONT_MIST = '400 9.1px "Commit Mono", monospace';
  const FONT_CORE = '700 8.8px "Commit Mono", monospace';

  // PASS 1: Single dew words perched delicately on wispy upper-right misty twigs!
  const dewCandidates = [];
  for (let r = 27; r < 112; r += 2) {
    for (let c = 56; c < COLS - 5; c += 2) {
      const t = gridTone[r * COLS + c];
      if (t === 1 || t === 2 || t === 4 || t === 5) {
        const local3 = countLocalInk(c, r, 3);
        const local6 = countLocalInk(c, r, 6);
        if (local3 >= 1 && local3 <= 24 && local6 <= 64) {
          dewCandidates.push({ c, r, score: cellHash(c, r, 91) + (r < 72 ? 0.35 : 0) });
        }
      }
    }
  }
  dewCandidates.sort((a, b) => b.score - a.score);

  let dewIdx = 0;
  const maxDew = 11;
  for (const cand of dewCandidates) {
    if (dewIdx >= maxDew) break;
    const word = scene.dewWords[dewIdx % scene.dewWords.length];
    const span = colsForText(word, FONT_MIST);
    const startC = Math.max(54, Math.min(COLS - span - 2, cand.c - Math.floor(span * 0.4)));
    if (tryPlaceText(word, startC, cand.r, 5, 4, FONT_MIST, "#171B22", 65)) {
      dewIdx++;
    }
  }

  // PASS 2: Crisp plain-language phrases nestled over pale misty blossoms & light outer petals!
  const mistCandidates = [];
  for (let r = 34; r < ROWS - 4; r += 2) {
    for (let c = 3; c < COLS - 12; c += 3) {
      const t = gridTone[r * COLS + c];
      if (t === 1 || t === 2 || t === 3) {
        const local = countLocalInk(c, r, 2);
        if (local >= 11) {
          mistCandidates.push({ c, r, score: cellHash(c, r, 131) + (t <= 2 ? 0.32 : 0) });
        }
      }
    }
  }
  mistCandidates.sort((a, b) => b.score - a.score);

  let phraseIdx = 0;
  const maxMistPhrases = 22;
  let placedMist = 0;
  for (const cand of mistCandidates) {
    if (placedMist >= maxMistPhrases) break;
    const phrase = scene.phrases[phraseIdx % scene.phrases.length];
    const span = colsForText(phrase, FONT_MIST);
    if (cand.c + span >= COLS - 3) continue;

    let inkCols = 0;
    let mistCols = 0;
    let darkCols = 0;
    for (let dc = 0; dc < span; dc++) {
      const gt = gridTone[cand.r * COLS + cand.c + dc];
      if (gt > 0) inkCols++;
      if (gt === 1 || gt === 2 || gt === 3) mistCols++;
      if (gt >= 4) darkCols++;
    }
    if (inkCols / Math.max(1, span) >= 0.62 && mistCols / Math.max(1, span) >= 0.6 && darkCols === 0) {
      if (tryPlaceText(phrase, cand.c, cand.r, 3, 2, FONT_MIST, "#151920", 999)) {
        placedMist++;
        phraseIdx++;
      }
    }
  }

  // PASS 3: Short crisp phrases woven sparingly over crimson blooms & slate foliage (preferring light/crevice transitions!)
  const coreCandidates = [];
  for (let r = 64; r < ROWS - 4; r += 2) {
    for (let c = 4; c < COLS - 10; c += 3) {
      const t = gridTone[r * COLS + c];
      if (t >= 4) {
        const local = countLocalInk(c, r, 2);
        if (local >= 15) {
          // Prefer rows touching a pale mist crevice or light slate edge for crisp legibility
          let lightCount = 0;
          for (let dc = -1; dc <= 7; dc++) {
            const cc = c + dc;
            if (cc >= 0 && cc < COLS) {
              const nt = gridTone[r * COLS + cc];
              if (nt === 1 || nt === 2 || nt === 3) lightCount++;
            }
          }
          coreCandidates.push({
            c,
            r,
            score: cellHash(c, r, 211) + Math.min(0.45, lightCount * 0.12),
          });
        }
      }
    }
  }
  coreCandidates.sort((a, b) => b.score - a.score);

  let coreIdx = 0;
  const maxCorePhrases = 12;
  let placedCore = 0;
  for (const cand of coreCandidates) {
    if (placedCore >= maxCorePhrases) break;
    const phrase = scene.shortCorePhrases[coreIdx % scene.shortCorePhrases.length];
    const span = colsForText(phrase, FONT_CORE);
    if (cand.c + span >= COLS - 3) continue;

    let inkCols = 0;
    for (let dc = 0; dc < span; dc++) {
      if (gridTone[cand.r * COLS + cand.c + dc] > 0) inkCols++;
    }
    if (inkCols / Math.max(1, span) >= 0.72) {
      if (tryPlaceText(phrase, cand.c, cand.r, 5, 3, FONT_CORE, "#0E1218", 999)) {
        placedCore++;
        coreIdx++;
      }
    }
  }
  ctx.restore();

  // ---- EDITORIAL FRAMING: TOP-LEFT HEADLINE, WHISPER COLOPHON, TOP-RIGHT BRAND PILL ----

  // 1. Clean Neo-Grotesque Headline
  ctx.save();
  ctx.fillStyle = "#111418";
  ctx.font = '500 47px "Inter", sans-serif';
  ctx.textBaseline = "top";
  function drawTrackedText(text, x, y, trackingPx) {
    let cx = x;
    for (const ch of text) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + trackingPx;
    }
  }
  const headX = 50;
  const headY = 66;
  const lineStep = 58;
  scene.headline.forEach((line, idx) => {
    drawTrackedText(line, headX, headY + idx * lineStep, -1.15);
  });
  ctx.restore();

  // 2. Ultra-restrained 1-line colophon whisper tucked calmly below the headline
  ctx.save();
  const coloY = headY + scene.headline.length * lineStep + 18;
  ctx.fillStyle = "#CB222B";
  drawRoundedRect(headX + 1, coloY + 2.5, 5.5, 5.5, 2.2);
  ctx.fillStyle = "#798998";
  ctx.font = '400 9.5px "Commit Mono", monospace';
  ctx.textBaseline = "top";
  ctx.fillText(scene.colophon, headX + 13, coloY);
  ctx.restore();

  // 3. Crisp Crimson Brand Pill (top-right, mirroring Ashmera tag)
  ctx.save();
  ctx.font = '600 17.5px "Inter Display", "Inter", sans-serif';
  const brandLabel = scene.brand;
  const labelW = ctx.measureText(brandLabel).width;
  const pillH = 33;
  const markW = 19;
  const pillW = Math.max(90, Math.ceil(13 + markW + 8 + labelW + 15));
  const pillX = W - 40 - pillW;
  const pillY = 26;

  ctx.fillStyle = "#BF1E26";
  drawRoundedRect(pillX, pillY, pillW, pillH, 1.5);

  ctx.fillStyle = "#FFFFFF";
  const mx = pillX + 13;
  const my = pillY + pillH * 0.5;
  ctx.beginPath();
  ctx.arc(mx + 4.5, my, 5.4, Math.PI * 0.5, Math.PI * 1.5);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(mx + 12.2, my, 5.4, Math.PI * 0.5, Math.PI * 1.5);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  ctx.fillText(brandLabel, pillX + 13 + markW + 7, pillY + pillH * 0.5 + 0.5);
  ctx.restore();

  return {
    placedCount,
    dewPlaced: dewIdx,
    mistPlaced: placedMist,
    corePlaced: placedCore,
  };
};

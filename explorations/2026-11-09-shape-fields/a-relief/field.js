// In-page: shape -> mask -> distance fields -> lit height -> glyphs, then the words placed where the shape leaves room.
(async () => {
  const D = window.DATA;
  const T = D.theme;
  const dark = D.themeName === "dark";
  const W = 840, H = 1190, G = 2, GW = W / G, GH = H / G;
  const MARGIN = 40, GAP = 26;
  const problems = [], notes = [];
  await Promise.all(['400 7px "Commit Mono"', '700 7px "Commit Mono"', '400 40px "Newsreader"'].map((f) => document.fonts.load(f)));
  await document.fonts.ready;

  // ---- shape primitives, in the author's own coordinates (y down)
  const KINDS = ["circle", "ellipse", "rect", "capsule", "line", "polygon", "arc", "path"];
  const kindOf = (p) => {
    const k = KINDS.filter((k) => k in p);
    if (k.length !== 1) throw new Error(`shape part needs exactly one of ${KINDS.join("/")}: ${JSON.stringify(p)}`);
    return k[0];
  };
  const svgBox = (d) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.setAttribute("d", d);
    svg.appendChild(el);
    document.body.appendChild(svg);
    const b = el.getBBox();
    svg.remove();
    return [b.x, b.y, b.x + b.width, b.y + b.height];
  };
  function ownBox(p) {
    const k = kindOf(p), v = p[k];
    if (k === "circle") return [v[0] - v[2], v[1] - v[2], v[0] + v[2], v[1] + v[2]];
    if (k === "ellipse") return [v[0] - v[2], v[1] - v[3], v[0] + v[2], v[1] + v[3]];
    if (k === "rect") return [v[0], v[1], v[0] + v[2], v[1] + v[3]];
    if (k === "capsule" || k === "line") {
      const r = k === "capsule" ? p.r : (p.width ?? 0) / 2;
      return [Math.min(v[0], v[2]) - r, Math.min(v[1], v[3]) - r, Math.max(v[0], v[2]) + r, Math.max(v[1], v[3]) + r];
    }
    if (k === "polygon") return [Math.min(...v.map((q) => q[0])), Math.min(...v.map((q) => q[1])), Math.max(...v.map((q) => q[0])), Math.max(...v.map((q) => q[1]))];
    if (k === "arc") {
      const r = v[2] + (p.width ?? 0) / 2;
      return [v[0] - r, v[1] - r, v[0] + r, v[1] + r];
    }
    return svgBox(v);
  }
  const rotBox = (b, deg, cx, cy) => {
    if (!deg) return b;
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const pts = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
    return [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))];
  };
  const boxOf = (p) => {
    const b = ownBox(p);
    return rotBox(b, p.rotate, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
  };

  // Paints one primitive: its area (fill) or, for a crease, its edge (a line or capsule: its centre line).
  function paint(ctx, p, edge, unit) {
    const k = kindOf(p), v = p[k];
    ctx.save();
    if (p.rotate) {
      const b = ownBox(p), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      ctx.translate(cx, cy);
      ctx.rotate((p.rotate * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    const path = new Path2D();
    let stroke = 0;
    if (k === "circle") path.arc(v[0], v[1], v[2], 0, Math.PI * 2);
    else if (k === "ellipse") path.ellipse(v[0], v[1], v[2], v[3], 0, 0, Math.PI * 2);
    else if (k === "rect") path.roundRect(v[0], v[1], v[2], v[3], Math.min(p.r ?? 0, v[2] / 2, v[3] / 2));
    else if (k === "capsule" || k === "line") {
      path.moveTo(v[0], v[1]);
      path.lineTo(v[2], v[3]);
      stroke = edge ? 0 : k === "capsule" ? 2 * p.r : p.width ?? 0;
    } else if (k === "polygon") {
      v.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
    } else if (k === "arc") {
      path.arc(v[0], v[1], v[2], ((p.from ?? 0) * Math.PI) / 180, ((p.to ?? 360) * Math.PI) / 180);
      stroke = edge ? 0 : p.width;
    } else path.addPath(new Path2D(v));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (edge) {
      ctx.lineWidth = 2.4 * unit;
      ctx.stroke(path);
    } else if (stroke) {
      ctx.lineWidth = stroke;
      ctx.stroke(path);
    } else ctx.fill(path);
    ctx.restore();
  }

  const shape = D.shape;
  const ops = shape.parts.map((p) => ({ ...p, op: p.op ?? "add" }));
  const bad = ops.find((p) => !["add", "cut", "crease"].includes(p.op));
  if (bad) throw new Error(`op must be add, cut or crease: ${JSON.stringify(bad)}`);
  const union = (bs) => [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))];

  // Fit: the shape's box, tilted, scaled uniformly into `fit.box` (sheet px) and aligned there.
  const fit = { box: [MARGIN, MARGIN, W - 2 * MARGIN, H - 2 * MARGIN], align: "center", ...shape.fit };
  function transformFor(b) {
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    const tb = rotBox(b, shape.tilt ?? 0, cx, cy);
    const [fx, fy, fw, fh] = fit.box;
    const s = Math.min(fw / (tb[2] - tb[0]), fh / (tb[3] - tb[1]));
    const w = (tb[2] - tb[0]) * s, h = (tb[3] - tb[1]) * s;
    const al = fit.align;
    const ox = al.includes("left") ? fx : al.includes("right") ? fx + fw - w : fx + (fw - w) / 2;
    const oy = al.includes("top") ? fy : al.includes("bottom") ? fy + fh - h : fy + (fh - h) / 2;
    const m = new DOMMatrix().translate(ox + w / 2, oy + h / 2).scale(s).rotate(shape.tilt ?? 0).translate(-cx, -cy);
    return { m, s };
  }
  function raster({ m, s }, crease) {
    const cv = new OffscreenCanvas(GW, GH);
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.setTransform(new DOMMatrix().scale(1 / G).multiply(m));
    ctx.fillStyle = ctx.strokeStyle = "#fff";
    for (const p of ops) {
      if ((p.op === "crease") !== crease) continue;
      ctx.globalCompositeOperation = p.op === "cut" ? "destination-out" : "source-over";
      paint(ctx, p, crease, G / s);
    }
    const a = ctx.getImageData(0, 0, GW, GH).data;
    const out = new Uint8Array(GW * GH);
    for (let i = 0; i < out.length; i++) out[i] = a[i * 4 + 3] > 127 ? 1 : 0;
    return out;
  }
  const maskBox = (mask) => {
    let x0 = GW, y0 = GH, x1 = -1, y1 = -1;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (mask[y * GW + x]) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
    return x1 < 0 ? null : [x0 * G, y0 * G, (x1 + 1) * G, (y1 + 1) * G];
  };
  // Two passes: fit the primitives' boxes, then refit to the pixels that survived the cuts.
  const roughBox = union(ops.filter((p) => p.op === "add").map(boxOf));
  let tf = transformFor(roughBox);
  let mask = raster(tf, false);
  const firstBox = maskBox(mask);
  if (!firstBox) throw new Error("the shape draws nothing: every add is cut away or off the sheet");
  {
    const inv = tf.m.inverse();
    const pts = [[firstBox[0], firstBox[1]], [firstBox[2], firstBox[1]], [firstBox[0], firstBox[3]], [firstBox[2], firstBox[3]]].map(([x, y]) => inv.transformPoint(new DOMPoint(x, y)));
    const tight = rotBox([Math.min(...pts.map((q) => q.x)), Math.min(...pts.map((q) => q.y)), Math.max(...pts.map((q) => q.x)), Math.max(...pts.map((q) => q.y))], -(shape.tilt ?? 0), (roughBox[0] + roughBox[2]) / 2, (roughBox[1] + roughBox[3]) / 2);
    tf = transformFor(shape.tilt ? roughBox : tight);
  }
  mask = raster(tf, false);
  const creases = raster(tf, true);
  // Faces: an add with `face` is a flat facet turned toward the light ("lit") or away from it ("dim"); later adds win.
  const face = new Int8Array(GW * GH);
  {
    const cv = new OffscreenCanvas(GW, GH);
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ops.forEach((p) => {
      if (p.op !== "add") return;
      if (p.face && !["lit", "dim", "round"].includes(p.face)) throw new Error(`face must be lit, dim or round: ${JSON.stringify(p)}`);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, GW, GH);
      ctx.setTransform(new DOMMatrix().scale(1 / G).multiply(tf.m));
      ctx.fillStyle = ctx.strokeStyle = "#fff";
      paint(ctx, p, false, G / tf.s);
      const a = ctx.getImageData(0, 0, GW, GH).data;
      const f = p.face === "lit" ? 1 : p.face === "dim" ? -1 : 0;
      for (let i = 0; i < face.length; i++) if (a[i * 4 + 3] > 127) face[i] = f;
    });
  }
  const box = maskBox(mask);
  const short = Math.min(box[2] - box[0], box[3] - box[1]);

  // ---- exact Euclidean distance transform (Felzenszwalb), in cells
  function edt(feature) {
    const INF = 1e12, n = Math.max(GW, GH);
    const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1), v = new Int32Array(n);
    const g = new Float64Array(GW * GH);
    for (let i = 0; i < g.length; i++) g[i] = feature[i] ? 0 : INF;
    const pass = (len, get, set) => {
      for (let q = 0; q < len; q++) f[q] = get(q);
      let k = 0;
      v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < len; q++) {
        let s;
        while ((s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])) <= z[k]) k--;
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < len; q++) {
        while (z[k + 1] < q) k++;
        d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
      }
      for (let q = 0; q < len; q++) set(q, d[q]);
    };
    for (let x = 0; x < GW; x++) pass(GH, (q) => g[q * GW + x], (q, val) => (g[q * GW + x] = val));
    for (let y = 0; y < GH; y++) pass(GW, (q) => g[y * GW + q], (q, val) => (g[y * GW + q] = val));
    const out = new Float32Array(g.length);
    for (let i = 0; i < g.length; i++) out[i] = Math.sqrt(g[i]) * G;
    return out;
  }
  const inv = mask.map((m) => 1 - m);
  const dIn = edt(inv); // px from an inside cell to the shape's edge
  const dOut = edt(mask); // px from an outside cell to the shape
  const at = (x, y) => Math.max(0, Math.min(GH - 1, Math.round(y / G - 0.5))) * GW + Math.max(0, Math.min(GW - 1, Math.round(x / G - 0.5)));

  // ---- strata: every inside cell to one part, by a projection, area by lines of code
  const st = { by: "angle", angle: 90, ...shape.strata };
  const label = new Int16Array(GW * GH).fill(-1);
  {
    const a = (st.angle * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const cells = [];
    for (let i = 0; i < mask.length; i++) if (mask[i]) cells.push(i);
    const key = new Float32Array(GW * GH);
    for (const i of cells) {
      const x = i % GW, y = (i - x) / GW;
      key[i] = st.by === "depth" ? dIn[i] + 0.001 * (x * ca + y * sa) : x * ca + y * sa + 0.0001 * (y * ca - x * sa);
    }
    cells.sort((i, j) => key[i] - key[j]);
    const total = D.parts.reduce((s, p) => s + p.loc, 0);
    let acc = 0, k = 0;
    for (let pi = 0; pi < D.parts.length; pi++) {
      acc += D.parts[pi].loc;
      const end = Math.round((acc / total) * cells.length);
      for (; k < end; k++) label[cells[k]] = pi;
    }
  }
  const seam = new Uint8Array(GW * GH);
  for (let y = 1; y < GH - 1; y++)
    for (let x = 1; x < GW - 1; x++) {
      const i = y * GW + x;
      if (label[i] < 0) continue;
      const l = label[i];
      if ((label[i + 1] >= 0 && label[i + 1] !== l) || (label[i + GW] >= 0 && label[i + GW] !== l)) seam[i] = 1;
    }
  const dSeam = edt(seam);
  const hasCrease = creases.some((c) => c);
  const dCrease = hasCrease ? edt(creases) : null;

  // ---- height: a rounded bevel off the outline, a smaller pillow per stratum, a valley along each crease
  // bevel: the fraction of the shape's half short side that is rounded; 1 is a full cylinder or dome
  const R = Math.max(14, (shape.bevel ?? 0.25) * short * 0.5);
  const RS = Math.min(12, Math.max(5, R * 0.22));
  const dome = (d, r) => {
    const t = Math.min(d / r, 1);
    return r * Math.sqrt(1 - (1 - t) * (1 - t));
  };
  const L = (() => {
    const v = [-0.62, -0.78, 0.75];
    const n = Math.hypot(...v);
    return v.map((c) => c / n);
  })();
  const away = [-L[0] / Math.hypot(L[0], L[1]), -L[1] / Math.hypot(L[0], L[1])];
  const height = new Float32Array(GW * GH);
  for (let i = 0; i < height.length; i++) {
    if (!mask[i]) continue;
    const x = (i % GW) * G, y = Math.floor(i / GW) * G;
    let h = dome(dIn[i], R) + 0.45 * dome(dSeam[i], RS);
    if (face[i]) h = 0.35 * dome(dIn[i], R) + 0.3 * dome(dSeam[i], RS) + face[i] * 0.55 * (x * away[0] + y * away[1]);
    if (dCrease) {
      const t = Math.max(0, 1 - dCrease[i] / (R * 0.3));
      h -= R * 0.6 * t * t;
    }
    height[i] = h;
  }
  const Hh = (() => {
    const v = [L[0], L[1], L[2] + 1];
    const n = Math.hypot(...v);
    return v.map((c) => c / n);
  })();
  const flat = L[2];
  // light in [0,1]: 0.5 on a flat top, toward 1 on faces turned to the light, toward 0 on faces turned away.
  const light = new Float32Array(GW * GH);
  for (let y = 1; y < GH - 1; y++)
    for (let x = 1; x < GW - 1; x++) {
      const i = y * GW + x;
      if (!mask[i]) continue;
      const hx = (height[i + 1] - height[i - 1]) / (2 * G), hy = (height[i + GW] - height[i - GW]) / (2 * G);
      const n = Math.hypot(hx, hy, 1);
      const nl = (-hx * L[0] - hy * L[1] + L[2]) / n;
      const spec = Math.pow(Math.max(0, (-hx * Hh[0] - hy * Hh[1] + Hh[2]) / n), 60);
      const lam = nl >= flat ? 0.5 + (0.5 * (nl - flat)) / (1 - flat) : (0.5 * Math.max(0, nl)) / flat;
      light[i] = Math.min(1, lam + 0.35 * spec);
    }

  // ---- cast shadow on the paper, down and right of the form
  const off = [0.045 * short, 0.065 * short], soft = 0.07 * short;
  const shadowAt = (x, y) => {
    const j = at(x - off[0], y - off[1]);
    const sd = mask[j] ? dIn[j] : -dOut[j];
    return Math.max(0, Math.min(1, 0.5 + sd / (2 * soft)));
  };

  // ---- words: label, headline and legend as one stack where the form leaves room, then the record line
  const BC = 4, BW = W / BC, BH = Math.ceil(H / BC);
  const blocked = new Uint8Array(BW * BH);
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const i = at(x * BC + BC / 2, y * BC + BC / 2);
      blocked[y * BW + x] = mask[i] || dOut[i] < GAP ? 1 : 0;
    }
  let sum;
  const integrate = () => {
    sum = new Int32Array((BW + 1) * (BH + 1));
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) sum[(y + 1) * (BW + 1) + x + 1] = blocked[y * BW + x] + sum[y * (BW + 1) + x + 1] + sum[(y + 1) * (BW + 1) + x] - sum[y * (BW + 1) + x];
  };
  integrate();
  const free = (x, y, w, h, m = MARGIN) => {
    if (x < m - 1 || y < m - 1 || x + w > W - m + 1 || y + h > H - m + 1) return false;
    const x0 = Math.floor(x / BC), y0 = Math.floor(y / BC), x1 = Math.ceil((x + w) / BC), y1 = Math.ceil((y + h) / BC);
    return sum[y1 * (BW + 1) + x1] - sum[y0 * (BW + 1) + x1] - sum[y1 * (BW + 1) + x0] + sum[y0 * (BW + 1) + x0] === 0;
  };
  const take = (r) => {
    for (let y = Math.floor((r.y - 10) / BC); y < Math.ceil((r.y + r.h + 10) / BC); y++)
      for (let x = Math.floor((r.x - 10) / BC); x < Math.ceil((r.x + r.w + 10) / BC); x++) if (x >= 0 && y >= 0 && x < BW && y < BH) blocked[y * BW + x] = 1;
    integrate();
  };
  const el = (id) => document.getElementById(id);
  el("label").textContent = D.name.toUpperCase();
  el("headline").textContent = D.headline;
  el("legend").textContent = D.legend;
  el("record").innerHTML = `${D.record}<span style="color:var(--hot)">.</span>`;
  const measure = (id, w, size) => {
    const e = el(id);
    e.style.width = `${w}px`;
    if (size) (e.style.fontSize = `${size}px`), (e.style.lineHeight = `${Math.round(size * 1.06)}px`);
    return e.getBoundingClientRect().height;
  };
  const corners = [[MARGIN, MARGIN], [W - MARGIN, MARGIN], [MARGIN, H - MARGIN], [W - MARGIN, H - MARGIN]];
  let best = null;
  for (const size of [60, 56, 52, 48, 44, 40, 36, 32]) {
    for (let w = 240; w <= 560; w += 20) {
      const hh = measure("headline", w, size);
      if (hh > size * 1.06 * 4 + 2) continue;
      const lw = Math.max(240, Math.min(w, 330));
      const lh = measure("legend", lw);
      const stack = { w: Math.max(w, lw), h: 16 + 18 + hh + 22 + lh };
      for (let y = MARGIN; y + stack.h <= H - MARGIN; y += 6)
        for (let x = MARGIN; x + stack.w <= W - MARGIN; x += 6) {
          if (!free(x, y, w, 16 + 18 + hh) || !free(x, y + 16 + 18 + hh + 22, lw, lh)) continue;
          const corner = Math.min(...corners.map(([cx, cy]) => Math.hypot(cx - (cx < W / 2 ? x : x + stack.w), cy - (cy < H / 2 ? y : y + stack.h))));
          const score = size * 40 - corner - 0.15 * w;
          if (!best || score > best.score) best = { score, size, w, hh, lw, lh, x, y };
        }
      if (best && best.size === size) break;
    }
    if (best) break;
  }
  const rects = {};
  if (!best) problems.push("no room for the label, headline and legend outside the shape: shrink the fit box or move it");
  else {
    const right = best.x + best.w / 2 > W / 2 && best.x + best.w > W - MARGIN - 40;
    const place = (id, x, y, w, h, align) => {
      const e = el(id);
      Object.assign(e.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, textAlign: align, visibility: "visible" });
      rects[id] = { x, y, w, h };
      take(rects[id]);
    };
    measure("headline", best.w, best.size);
    measure("legend", best.lw);
    const al = right ? "right" : "left";
    const lx = right ? best.x + best.w - best.lw : best.x;
    place("label", best.x, best.y, best.w, 16, al);
    place("headline", best.x, best.y + 34, best.w, best.hh, al);
    place("legend", lx, best.y + 34 + best.hh + 22, best.lw, best.lh, al);
    notes.push(`headline ${best.size}px in ${best.w}px at ${best.x},${best.y}`);
  }
  {
    const e = el("record");
    const rw = e.getBoundingClientRect().width;
    const y = H - 36 - 10;
    const spots = [[MARGIN, y], [W - MARGIN - rw, y]];
    const spot = spots.find(([x, yy]) => free(x, yy, rw, 10, 20));
    if (spot) {
      Object.assign(e.style, { left: `${spot[0]}px`, top: `${spot[1]}px`, visibility: "visible" });
      rects.record = { x: spot[0], y: spot[1], w: rw, h: 10 };
    } else {
      let yy = H - MARGIN;
      while (yy - rw > MARGIN && !free(26, yy - rw, 10, rw, 20)) yy -= 6;
      if (yy - rw <= MARGIN) problems.push("no clear edge for the record line");
      else {
        Object.assign(e.style, { left: "26px", top: `${yy}px`, transform: "rotate(-90deg)", transformOrigin: "left top", visibility: "visible" });
        rects.record = { x: 26, y: yy - rw, w: 10, h: rw };
      }
    }
  }
  const knocked = (x, y) => Object.values(rects).some((r) => x > r.x - 10 && x < r.x + r.w + 10 && y > r.y - 8 && y < r.y + r.h + 8);

  // ---- glyphs
  const cv = el("c");
  const ctx = cv.getContext("2d");
  ctx.scale(2, 2);
  ctx.fillStyle = T.paper;
  ctx.fillRect(0, 0, W, H);
  const fs = D.type.size, cw = fs * 0.6, lh = fs * (D.type.leading ?? 1.04);
  const cols = Math.floor(W / cw), rows = Math.ceil(H / lh);
  const xPad = (W - cols * cw) / 2;
  ctx.textBaseline = "middle";

  const ramp = (v) => (v < 0.3 ? "" : v < 0.7 ? "·" : ":");
  const wholeNames = new Array(D.parts.length).fill(0);
  const cellsOf = new Array(D.parts.length).fill(0);
  const glyphs = { 400: [], 700: [] };
  // A row is set word by word, and a word runs to its end even where a stratum boundary crosses it, so every name is
  // whole wherever the shape's edge does not cut it. Which part a word takes is error diffusion: of the parts under
  // the word, the one owed the most cells so far, so the glyph totals stay in proportion to the lines.
  const owed = new Float64Array(D.parts.length);
  const choose = (c, y) => {
    const cover = new Float64Array(D.parts.length);
    for (let j = c; j < Math.min(cols, c + 14); j++) {
      const i = at(xPad + j * cw + cw / 2, y);
      if (!mask[i]) break;
      cover[label[i]]++;
    }
    let best = -1;
    cover.forEach((n, p) => {
      if (n && (best < 0 || owed[p] + n > owed[best] + cover[best])) best = p;
    });
    return best;
  };
  for (let r = 0; r < rows; r++) {
    const y = r * lh + lh / 2;
    let pi = -1, k = 0, len = 0, whole = false;
    for (let c = 0; c < cols; c++) {
      const x = xPad + c * cw + cw / 2;
      const i = at(x, y);
      if (!mask[i]) {
        pi = -1;
        if (knocked(x, y)) continue;
        const s = shadowAt(x, y);
        if ((r + c) % 2 && s < 0.08) continue;
        // on paper the shadow darkens the dots; on a dark sheet it takes the faint light away
        const v = dark ? 0.12 * (1 - s) : 0.07 + 0.38 * s;
        if (v < 0.015) continue;
        glyphs[400].push({ x: x - cw / 2, y, ch: "·", color: T.ink, a: v });
        continue;
      }
      if (pi < 0 || k >= len) {
        const fresh = pi < 0;
        pi = choose(c, y);
        len = D.parts[pi].name.length + 2;
        k = fresh ? (r * 7) % len : 0;
        whole = k === 0;
      }
      owed[label[i]]++;
      owed[pi]--;
      const part = D.parts[pi];
      const gap = k >= part.name.length;
      const ch = part.name[k];
      k++;
      if (whole && k === part.name.length) wholeNames[pi]++;
      cellsOf[pi]++;
      const b = light[i];
      // ink density against the paper, contrast-stretched; a rim at the outline keeps the silhouette where the light washes it out
      const v = Math.max(dIn[i] < 5 ? 0.6 : 0, Math.min(1, Math.max(0, 0.5 + 1.5 * ((dark ? b : 1 - b) - 0.5))));
      const g = gap ? ramp(v) : ch === " " ? "" : ch;
      if (!g) continue;
      if (part.hot) {
        const hv = dark ? 0.55 + 0.45 * b : 0.88 + 0.12 * v;
        glyphs[700].push({ x: x - cw / 2, y, ch: g, color: T.hot, a: hv, hot: true });
      } else {
        const a = 0.3 + 0.7 * Math.pow(v, 1.1);
        glyphs[v > 0.42 ? 700 : 400].push({ x: x - cw / 2, y, ch: g, color: T.ink, a });
      }
    }
  }
  // the accent's halo, under its glyphs
  {
    const tint = new OffscreenCanvas(W, H);
    const tc = tint.getContext("2d");
    tc.fillStyle = T.hot;
    for (const q of glyphs[700]) if (q.hot) tc.fillRect(q.x, q.y - lh / 2, cw, lh);
    ctx.save();
    ctx.filter = `blur(${dark ? 14 : 10}px)`;
    ctx.globalAlpha = dark ? 0.55 : 0.4;
    ctx.drawImage(tint, 0, 0, W, H);
    ctx.restore();
    if (!D.parts.some((p) => p.hot)) problems.push("no accent part");
  }
  for (const wgt of [400, 700]) {
    ctx.font = `${wgt} ${fs}px "Commit Mono"`;
    for (const q of glyphs[wgt]) {
      ctx.globalAlpha = q.a;
      ctx.fillStyle = q.color;
      if (q.hot && dark) {
        ctx.shadowColor = T.hot;
        ctx.shadowBlur = 5;
      }
      ctx.fillText(q.ch, q.x, q.y);
      ctx.shadowBlur = 0;
    }
  }
  ctx.globalAlpha = 1;

  // ---- checks
  D.parts.forEach((p, i) => {
    if (!wholeNames[i]) problems.push(`"${p.name}" never shows its whole name in a row (${cellsOf[i]} glyph cells): widen its stratum or the shape`);
  });
  const edge = box[0] <= 0 || box[1] <= 0 || box[2] >= W || box[3] >= H;
  if (edge && !shape.bleed) problems.push(`the shape touches the sheet edge (${box.map(Math.round).join(",")}) without "bleed": true`);
  const total = D.parts.reduce((s, p) => s + p.loc, 0);
  const allCells = cellsOf.reduce((s, n) => s + n, 0);
  D.parts.forEach((p, i) => {
    const want = (100 * p.loc) / total, got = (100 * cellsOf[i]) / allCells;
    if (Math.abs(got - want) > Math.max(0.6, want * 0.2)) problems.push(`"${p.name}" has ${got.toFixed(1)}% of the glyphs for ${want.toFixed(1)}% of the lines: its strata are too thin across the rows`);
  });
  const hi = D.parts.findIndex((p) => p.hot);
  notes.push(`shape box ${box.map(Math.round).join(",")}, bevel ${Math.round(R)}px, ${allCells} glyph cells`);
  notes.push(`accent "${D.parts[hi]?.name}": ${((100 * D.parts[hi]?.loc) / total).toFixed(1)}% of lines, ${((100 * cellsOf[hi]) / allCells).toFixed(1)}% of cells, whole name ${wholeNames[hi]}x`);
  window.report = { problems, notes };
})().catch((e) => {
  window.report = { problems: [String(e.message || e)], notes: [] };
});

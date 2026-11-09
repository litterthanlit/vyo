// In-page engine: shape ops -> mask -> signed distance field -> iso-line rings -> text on each ring.
const W = 840, H = 1190, M = 40;

function shapePath(op, kind) {
  const p = new Path2D();
  if (kind === "circle") p.arc(op.at[0], op.at[1], op.r, 0, Math.PI * 2);
  else if (kind === "ellipse") p.ellipse(op.at[0], op.at[1], op.r[0], op.r[1], 0, 0, Math.PI * 2);
  else if (kind === "rect") p.roundRect(op.at[0], op.at[1], op.size[0], op.size[1], Math.min(op.round ?? 0, op.size[0] / 2, op.size[1] / 2));
  else if (kind === "capsule") (p.moveTo(...op.from), p.lineTo(...op.to));
  else if (kind === "arc") {
    // Degrees clockwise from twelve o'clock, like a clock face.
    const rad = (deg) => ((deg - 90) * Math.PI) / 180;
    p.arc(op.at[0], op.at[1], op.r, rad(op.from), rad(op.to), op.to < op.from);
  } else if (kind === "polygon") {
    const pts = op.points, n = pts.length, r = op.round ?? 0;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    p.moveTo(...mid(pts[n - 1], pts[0]));
    for (let i = 0; i < n; i++) p.arcTo(...pts[i], ...mid(pts[i], pts[(i + 1) % n]), r);
    p.closePath();
  } else if (kind === "path") return new Path2D(op.d);
  return p;
}

function paint(ctx, ops) {
  for (const op of ops) {
    const kind = op.add ?? op.cut;
    ctx.globalCompositeOperation = op.cut ? "destination-out" : "source-over";
    const p = shapePath(op, kind);
    if (kind === "capsule" || kind === "arc") {
      ctx.lineCap = kind === "capsule" || op.caps !== "flat" ? "round" : "butt";
      ctx.lineWidth = kind === "capsule" ? op.r * 2 : op.width;
      ctx.stroke(p);
    } else ctx.fill(p, op.rule ?? "nonzero");
  }
  ctx.globalCompositeOperation = "source-over";
}

function raster(w, h, transform, ops) {
  const c = new OffscreenCanvas(w, h), ctx = c.getContext("2d");
  ctx.setTransform(...transform);
  paint(ctx, ops);
  const a = ctx.getImageData(0, 0, w, h).data, inside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inside[i] = a[i * 4 + 3] > 127 ? 1 : 0;
  return inside;
}

// The shape's ink box in view units, measured from a raster, so cuts and strokes count.
function viewBox(shape) {
  const R = 1600, s = R / Math.max(...shape.view), pad = 0.25 * R;
  const w = Math.ceil(shape.view[0] * s + 2 * pad), h = Math.ceil(shape.view[1] * s + 2 * pad);
  const inside = raster(w, h, [s, 0, 0, s, pad, pad], shape.ops);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside[y * w + x]) (x0 = Math.min(x0, x), x1 = Math.max(x1, x), y0 = Math.min(y0, y), y1 = Math.max(y1, y));
  if (x1 < 0) throw new Error("shape paints nothing");
  return { x: (x0 - pad) / s, y: (y0 - pad) / s, w: (x1 - x0 + 1) / s, h: (y1 - y0 + 1) / s };
}

// Felzenszwalb's exact squared Euclidean distance transform, in place on a w*h grid.
function edt(f, w, h) {
  const n = Math.max(w, h), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), g = new Float64Array(n);
  const pass = (get, set, len) => {
    for (let q = 0; q < len; q++) g[q] = get(q);
    let k = 0;
    v[0] = 0, z[0] = -Infinity, z[1] = Infinity;
    for (let q = 1; q < len; q++) {
      let s;
      while ((s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])) <= z[k]) k--;
      k++, v[k] = q, z[k] = s, z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) ** 2 + g[v[k]];
    }
    for (let q = 0; q < len; q++) set(q, d[q]);
  };
  for (let x = 0; x < w; x++) pass((y) => f[y * w + x], (y, val) => (f[y * w + x] = val), h);
  for (let y = 0; y < h; y++) pass((x) => f[y * w + x], (x, val) => (f[y * w + x] = val), w);
}

function signedField(inside) {
  const BIG = 1e12, fin = new Float64Array(W * H), fout = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) (fin[i] = inside[i] ? BIG : 0), (fout[i] = inside[i] ? 0 : BIG);
  edt(fin, W, H), edt(fout, W, H);
  const sd = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) sd[i] = inside[i] ? Math.sqrt(fin[i]) - 0.5 : 0.5 - Math.sqrt(fout[i]);
  return sd;
}

// Marching squares at one level: closed loops of points in sheet px, joined through shared cell edges.
function isoLoops(sd, level) {
  const at = (x, y) => sd[y * W + x] - level;
  const pt = new Map(), link = new Map();
  const edgePoint = (id) => {
    if (pt.has(id)) return id;
    const cell = id >> 1, x = cell % W, y = (cell / W) | 0;
    const [x2, y2] = id & 1 ? [x, y + 1] : [x + 1, y];
    const a = at(x, y), b = at(x2, y2), t = a / (a - b);
    pt.set(id, [x + (x2 - x) * t, y + (y2 - y) * t]);
    return id;
  };
  const join = (a, b) => {
    edgePoint(a), edgePoint(b);
    (link.get(a) ?? link.set(a, []).get(a)).push(b);
    (link.get(b) ?? link.set(b, []).get(b)).push(a);
  };
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W - 1; x++) {
      const tl = at(x, y) > 0, tr = at(x + 1, y) > 0, br = at(x + 1, y + 1) > 0, bl = at(x, y + 1) > 0;
      const c = tl | (tr << 1) | (br << 2) | (bl << 3);
      if (c === 0 || c === 15) continue;
      const T = 2 * (y * W + x), B = 2 * ((y + 1) * W + x), L = 2 * (y * W + x) + 1, R = 2 * (y * W + x + 1) + 1;
      const centre = (at(x, y) + at(x + 1, y) + at(x + 1, y + 1) + at(x, y + 1)) / 4 > 0;
      const segs = {
        1: [[L, T]], 2: [[T, R]], 3: [[L, R]], 4: [[R, B]], 6: [[T, B]], 7: [[L, B]], 8: [[B, L]],
        9: [[B, T]], 11: [[B, R]], 12: [[R, L]], 13: [[R, T]], 14: [[T, L]],
        5: centre ? [[L, T], [R, B]] : [[L, B], [R, T]],
        10: centre ? [[T, R], [B, L]] : [[T, L], [B, R]],
      }[c];
      for (const [a, b] of segs) join(a, b);
    }
  const loops = [], seen = new Set();
  for (const start of link.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let prev = -1, cur = start;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur), loop.push(pt.get(cur));
      const next = link.get(cur).find((n) => n !== prev && !seen.has(n));
      (prev = cur), (cur = next);
    }
    if (loop.length > 8) loops.push(loop);
  }
  return loops;
}

function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b], len = Math.hypot(bx - ax, by - ay) || 1;
    let worst = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > worst) (worst = d), (at = i);
    }
    if (worst > eps) (keep[at] = 1), stack.push([a, at], [at, b]);
  }
  return pts.filter((_, i) => keep[i]);
}

// A closed loop's two ends coincide, which leaves RDP no baseline, so split it at the point farthest from the start.
function simplifyLoop(pts, eps) {
  const d = (p) => Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]);
  const far = pts.reduce((best, p, i) => (d(p) > d(pts[best]) ? i : best), 0);
  return [...simplify(pts.slice(0, far + 1), eps).slice(0, -1), ...simplify([...pts.slice(far), pts[0]], eps).slice(0, -1)];
}

const chaikin = (pts, rounds) => {
  for (let r = 0; r < rounds; r++)
    pts = pts.flatMap((p, i) => {
      const q = pts[(i + 1) % pts.length];
      return [[0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]];
    });
  return pts;
};
// The point at arc length s along a closed loop.
function along(pts) {
  const cum = [0];
  for (let i = 0; i < pts.length; i++) cum.push(cum[i] + Math.hypot(pts[(i + 1) % pts.length][0] - pts[i][0], pts[(i + 1) % pts.length][1] - pts[i][1]));
  return (s) => {
    let lo = 0, hi = pts.length;
    while (hi - lo > 1) (cum[(lo + hi) >> 1] <= s ? (lo = (lo + hi) >> 1) : (hi = (lo + hi) >> 1));
    const a = pts[lo], b = pts[(lo + 1) % pts.length], t = (s - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
}
const area = (pts) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const perimeter = (pts) => pts.reduce((s, p, i) => s + Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]), 0);

// Even spacing along a closed loop, so a moving average rounds corners by a fixed length.
function resample(pts, step) {
  const out = [], n = pts.length;
  let carry = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = carry; t < len; t += step) out.push([a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len]);
    carry = (((carry - len) % step) + step) % step;
  }
  return out;
}
const average = (pts, half) =>
  pts.map((_, i) => {
    let x = 0, y = 0;
    for (let j = -half; j <= half; j++) (x += pts[(i + j + pts.length) % pts.length][0]), (y += pts[(i + j + pts.length) % pts.length][1]);
    return [x / (2 * half + 1), y / (2 * half + 1)];
  });

// Clockwise on screen, starting at the leftmost point, so every ring's seam sits on the same side. Corners where
// the ring folds over the shape's medial axis are rounded over about `round` px, or glyphs pile up on them.
function ring(raw, round = 0) {
  let pts = simplifyLoop(raw, 0.35);
  pts = round >= 3 ? simplifyLoop(average(resample(pts, 1.5), Math.round(round / 3)), 0.15) : chaikin(pts, 2);
  if (area(pts) < 0) pts.reverse();
  const left = pts.reduce((best, p, i) => (p[0] < pts[best][0] ? i : best), 0);
  return [...pts.slice(left), ...pts.slice(0, left)];
}

// Ring counts per part, proportional to lines, at least one each, by largest remainder.
function allot(parts, total) {
  const loc = parts.reduce((s, p) => s + p.loc, 0);
  const raw = parts.map((p) => (p.loc / loc) * (total - parts.length));
  const n = raw.map((r) => 1 + Math.floor(r));
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; n.reduce((s, x) => s + x, 0) < total; k++) n[order[k % order.length][1]]++;
  return n;
}

function bandOrder(parts, order) {
  if (order === "tree") return parts;
  const hot = parts.filter((p) => p.hot), rest = parts.filter((p) => !p.hot);
  if (order === "accent-out") return [...hot, ...rest];
  if (order === "accent-in") return [...rest, ...hot];
  if (order === "size-out") return [...parts].sort((a, b) => b.loc - a.loc);
  if (typeof order === "number") return [...rest.slice(0, order), ...hot, ...rest.slice(order)];
  throw new Error(`rings.order "${order}" is not tree, accent-out, accent-in, size-out or a number`);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

window.draw = async (D) => {
  const sheet = document.querySelector(".sheet");
  await Promise.all([...document.fonts].map((f) => f.load()));
  await document.fonts.ready;
  const checks = [];
  const block = (style, html) => {
    const el = document.createElement("div");
    el.className = "t";
    Object.assign(el.style, style);
    el.innerHTML = html;
    sheet.append(el);
    return el;
  };
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };

  const label = block({ right: `${M}px`, top: "44px", fontSize: "13px", letterSpacing: ".17em", whiteSpace: "nowrap" }, esc(D.product.toUpperCase()));
  const head = block({ left: `${M}px`, top: "32px", width: "560px", fontFamily: "Newsreader", fontSize: "50px", lineHeight: "54px", letterSpacing: "-.01em" }, esc(D.headline));
  const texts = [box(label), box(head)];

  // Fit: the shape's ink box, scaled to the largest size that fits below the headline, centred.
  const top = texts[1].y + texts[1].h + 34, room = { x: M, y: top, w: W - 2 * M, h: H - 64 - top };
  const vb = viewBox(D.shape), s = Math.min(room.w / vb.w, room.h / vb.h);
  const place = D.shape.place ?? "center";
  const ox = place === "left" ? room.x : place === "right" ? room.x + room.w - vb.w * s : room.x + (room.w - vb.w * s) / 2;
  const oy = room.y + (room.h - vb.h * s) / 2;
  const inside = raster(W, H, [s, 0, 0, s, ox - vb.x * s, oy - vb.y * s], D.shape.ops);
  const sd = signedField(inside);

  // Rings: one iso-line every `gap` px inward from the outline, dealt to the parts in bands.
  const { gap, size, round } = D.rings;
  const ringAt = (raw, level) => ring(raw, Math.min(level, round));
  let deepest = 0;
  for (let i = 0; i < W * H; i++) deepest = Math.max(deepest, sd[i]);
  const levels = [];
  for (let d = gap * 0.5; d < deepest - 1.5; d += gap) levels.push(d);
  const parts = bandOrder(D.parts, D.rings.order);
  if (levels.length < parts.length) checks.push(`✗ only ${levels.length} rings for ${parts.length} parts: lower rings.gap or make the shape thicker`);
  const counts = allot(parts, Math.max(levels.length, parts.length));
  const owner = counts.flatMap((n, i) => Array(n).fill(i));

  const probe = document.createElement("canvas").getContext("2d");
  const advance = (weight) => ((probe.font = `${weight} ${size}px "Commit Mono"`), probe.measureText("MMMMMMMMMM").width / 10);
  const tone = (p) => (p.hot ? "var(--paper)" : "var(--ink)");
  const loopPath = (pts) => `M${pts.map((q) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join("L")}Z`;
  const loopsAt = (level) => isoLoops(sd, level).map((raw) => ringAt(raw, level)).filter((pts) => perimeter(pts) > 12).map(loopPath).join("");
  // Band edges sit halfway between the last ring of one part and the first of the next; the outline is edge 0.
  const edges = [0.5];
  for (let k = 1; k < levels.length; k++) if (owner[k] !== owner[k - 1]) edges.push((levels[k - 1] + levels[k]) / 2);
  const hotRings = levels.filter((_, k) => parts[owner[k]]?.hot);
  let under = "";
  if (hotRings.length) {
    const lo = Math.max(0.5, hotRings[0] - gap / 2), hi = hotRings[hotRings.length - 1] + gap / 2;
    under += `<path fill="var(--hot)" fill-rule="evenodd" d="${loopsAt(lo)}${loopsAt(hi)}"/>`;
  }
  under += `<path fill="none" stroke="var(--ink)" stroke-width="0.6" d="${edges.slice(1).map(loopsAt).join("")}"/>`;
  // A crease is the shape's medial axis, where a ring folds back on itself and the field's slope drops below 1.
  // Glyphs there would land on the ring's other side, so they become blank and the fold shows as a seam.
  const slope = (x, y) => {
    const v = (dx, dy) => sd[Math.min(H - 1, Math.max(0, Math.round(y + dy))) * W + Math.min(W - 1, Math.max(0, Math.round(x + dx)))];
    return Math.hypot(v(2, 0) - v(-2, 0), v(0, 2) - v(0, -2)) / 4;
  };
  const reach = size * 0.35;
  const onCrease = ([x, y]) => [[0, 0], [reach, 0], [-reach, 0], [0, reach], [0, -reach]].some(([dx, dy]) => slope(x + dx, y + dy) < 0.55);
  let defs = "", body = under, loopsDrawn = 0;
  const named = new Set();
  levels.forEach((level, k) => {
    const pi = owner[k], p = parts[pi];
    if (p === undefined) return;
    const weight = p.hot ? 700 : 400, adv = advance(weight), unit = `${p.name} · `;
    for (const raw of isoLoops(sd, level)) {
      const pts = ringAt(raw, level), len = perimeter(pts);
      if (len < adv * 4) continue;
      const reps = Math.floor(len / (unit.length * adv));
      const full = reps ? unit.repeat(reps) : "· ".repeat(Math.floor(len / (2 * adv)));
      const spacing = (len - full.length * adv) / full.length;
      const pos = along(pts);
      // A name touching a crease is blanked whole: a ring shows whole names or nothing, never fragments.
      const chars = [...full], creased = chars.map((_, i) => onCrease(pos((i + 0.5) * (adv + spacing))));
      for (let u = 0; u < chars.length; u += reps ? unit.length : 2) {
        // The name's glyphs decide; its separator goes with it, so a blanked ring leaves no orphan dots.
        const end = u + (reps ? unit.length : 2);
        if (creased.slice(u, u + (reps ? p.name.length : 1)).some(Boolean)) for (let i = u; i < end; i++) chars[i] = " ";
      }
      const text = chars.join("");
      if (reps && text.includes(p.name)) named.add(pi);
      const id = `r${k}_${loopsDrawn++}`;
      defs += `<path id="${id}" d="M${pts.map((q) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join("L")}Z"/>`;
      body += `<text font-size="${size}" font-weight="${weight}" letter-spacing="${spacing.toFixed(3)}" fill="${tone(p, pi)}" dy="${(size * 0.34).toFixed(2)}"><textPath href="#${id}">${esc(text)}</textPath></text>`;
    }
  });
  sheet.insertAdjacentHTML("beforeend", `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Commit Mono"><defs>${defs}</defs>${body}</svg>`);
  parts.forEach((p, i) => { if (!named.has(i)) checks.push(`✗ ${p.name}: no ring long enough to carry its name once`); });

  // Text in the room the shape leaves: a cell is taken within `clear` px of the outline.
  const clear = 22;
  const free = (r) => {
    if (r.x < M - 1 || r.y < 30 || r.x + r.w > W - M + 1 || r.y + r.h > H - 24) return false;
    if (texts.some((t) => overlaps(r, t))) return false;
    for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(H, r.y + r.h); y += 3)
      for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(W, r.x + r.w); x += 3) if (sd[y * W + x] > -clear) return false;
    return true;
  };
  // Prefer the spot nearest a sheet corner, bottom corners first.
  const spot = (w, h) => {
    let best = null;
    for (let y = 30; y + h <= H - 24; y += 6)
      for (let x = M; x + w <= W - M; x += 6) {
        const r = { x, y, w, h };
        if (!free(r)) continue;
        const score = Math.min(x - M, W - M - x - w) + Math.min(y, H - y - h) * 0.7 - (y > H / 2 ? 120 : 0);
        if (!best || score < best.score) best = { ...r, score };
      }
    return best;
  };
  const legendW = 260;
  const legend = block({ left: "0px", top: "0px", width: `${legendW}px`, fontFamily: "Newsreader", fontSize: "16px", lineHeight: "22px" }, esc(D.legend));
  const lg = spot(legendW, box(legend).h);
  if (lg) {
    // In a hole the shape closes on both sides (a jar's label), the legend centres in it like a printed label.
    const reach = (axis, dir) => {
      let r = { ...lg };
      while (free({ ...r, [axis]: r[axis] + dir * 2 })) r = { ...r, [axis]: r[axis] + dir * 2 };
      const edge = axis === "x" ? (dir < 0 ? r.x <= M + 1 : r.x + r.w >= W - M - 1) : dir < 0 ? r.y <= 32 : r.y + r.h >= H - 26;
      return { at: r[axis], edge };
    };
    const [l, r, t, b] = [reach("x", -1), reach("x", 1), reach("y", -1), reach("y", 1)];
    const enclosed = !l.edge && !r.edge && !t.edge && !b.edge;
    if (enclosed) Object.assign(lg, { x: (l.at + r.at) / 2, y: (t.at + b.at) / 2 });
    const right = lg.x + legendW / 2 > W / 2;
    Object.assign(legend.style, { left: `${lg.x}px`, top: `${lg.y}px`, textAlign: enclosed ? "center" : right ? "right" : "left" });
    texts.push(box(legend));
  } else (legend.style.display = "none"), checks.push(`✗ legend: no ${legendW}px-wide room clear of the shape`);

  const rec = block({ left: "0px", top: "0px", fontSize: "10px", letterSpacing: ".04em", whiteSpace: "nowrap", color: "var(--mid)" }, `${esc(D.record)}<span style="color:var(--hot)">.</span>`);
  const rw = box(rec).w;
  const bottom = [{ x: M, y: H - 36, w: rw, h: 12 }, { x: W - M - rw, y: H - 36, w: rw, h: 12 }].find(free);
  if (bottom) Object.assign(rec.style, { left: `${bottom.x}px`, top: `${bottom.y}px` }), texts.push(box(rec));
  else {
    const up = [...Array(Math.floor((H - rw - 60) / 10)).keys()].map((i) => ({ x: 18, y: H - 40 - rw - i * 10, w: 12, h: rw })).find(free);
    if (up) Object.assign(rec.style, { left: "18px", top: `${up.y + up.h}px`, transform: "rotate(-90deg)", transformOrigin: "left top" }), texts.push(up);
    else checks.push("✗ record: neither the bottom edge nor the left edge is clear");
  }
  // Echoes: hairline copies of the outline radiating outward, faded, and held back from every text block.
  const echo = D.shape.echo ?? 0;
  if (echo) {
    const pathOf = (pts) => `M${pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join("L")}${Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 3 ? "Z" : ""}`;
    const holes = texts.map((t) => `<rect x="${t.x - 16}" y="${t.y - 16}" width="${t.w + 32}" height="${t.h + 32}" fill="#000"/>`).join("");
    const rings = [...Array(echo).keys()].map((k) => {
      const d = isoLoops(sd, -gap * 1.4 * (k + 1)).map((raw) => pathOf(simplifyLoop(average(resample(raw, 1.5), 6), 0.2))).join("");
      return `<path d="${d}" fill="none" stroke="var(--soft)" stroke-width="0.7" opacity="${(D.echoInk * (1 - k / echo)).toFixed(2)}"/>`;
    });
    sheet.insertAdjacentHTML("afterbegin", `<svg width="${W}" height="${H}"><mask id="clear"><rect width="${W}" height="${H}" fill="#fff"/>${holes}</mask><g mask="url(#clear)">${rings.join("")}</g></svg>`);
  }
  if (texts[1].y + texts[1].h > room.y) checks.push("✗ headline runs into the shape's box");
  checks.push(`· shape fitted at ${Math.round(vb.w * s)}x${Math.round(vb.h * s)}px, deepest point ${deepest.toFixed(0)}px from the outline`);

  // ASCII sketch: 70 columns by 50 rows. # shape, * accent band, letters for text blocks.
  const hotLevels = levels.map((l, k) => [l, parts[owner[k]]?.hot]).filter(([, h]) => h).map(([l]) => l);
  const [hotLo, hotHi] = [Math.min(...hotLevels) - gap / 2, Math.max(...hotLevels) + gap / 2];
  const tags = [["N", texts[0]], ["H", texts[1]], ["L", texts[2]], ["R", texts[3]]];
  let ascii = "";
  for (let r = 0; r < 50; r++) {
    let line = "";
    for (let c = 0; c < 70; c++) {
      const x = Math.floor((c + 0.5) * (W / 70)), y = Math.floor((r + 0.5) * (H / 50)), v = sd[y * W + x];
      const tag = tags.find(([, t]) => t && x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h);
      line += tag ? tag[0] : v >= hotLo && v <= hotHi ? "*" : v > 0 ? "#" : ".";
    }
    ascii += line + "\n";
  }
  return {
    checks, ascii, gap, rings: levels.length, loops: loopsDrawn,
    bands: parts.map((p, i) => ({ name: p.name, loc: p.loc, hot: p.hot, rings: counts[i] })),
  };
};

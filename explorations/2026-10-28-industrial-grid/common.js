// Shared helpers for the industrial-grid mockups. Throwaway spike code.
const CELL = 70, W = 840, H = 1190;
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function noise2(seed) {
  const h = (x, y) => { let n = (x * 374761393 + y * 668265263 + seed * 982451653) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const s = t => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
}
function el(tag, css, text, parent) { const e = document.createElement(tag); Object.assign(e.style, css); if (text != null) e.textContent = text; (parent || document.querySelector(".sheet")).appendChild(e); return e; }
// Tonal mosaic: 70px cells, some split into 4x4 or 8x8 pixels. mask(x,y) in px decides where texture lives (0..1).
function mosaic({ seed, tones, mask = () => 1, density = 0.5, parent }) {
  const n = noise2(seed), n2 = noise2(seed + 7), r = rng(seed);
  const layer = el("div", { position: "absolute", inset: 0 }, null, parent);
  for (let cy = 0; cy < Math.ceil(H / CELL); cy++) for (let cx = 0; cx < W / CELL; cx++) {
    const m = mask(cx * CELL + 35, cy * CELL + 35); if (m <= 0) continue;
    const v = n(cx * 0.45, cy * 0.45) * m;
    if (v < 1 - density) continue;
    const split = r() < 0.55 ? (r() < 0.4 ? 8 : 4) : 1;
    const sz = CELL / split;
    for (let sy = 0; sy < split; sy++) for (let sx = 0; sx < split; sx++) {
      const px = cx * CELL + sx * sz, py = cy * CELL + sy * sz;
      const t = split === 1 ? v : n2(px / 22, py / 22) * 0.6 + v * 0.4 + (r() - 0.5) * 0.25;
      if (split > 1 && t < 0.45) continue;
      const tone = tones[Math.min(tones.length - 1, Math.floor(((t - 0.4) / 0.6) * tones.length))] || tones[0];
      el("div", { position: "absolute", left: px + "px", top: py + "px", width: sz + "px", height: sz + "px", background: tone }, null, layer);
    }
  }
  return layer;
}
function grid(color, parent) { return el("div", { position: "absolute", inset: 0, backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`, backgroundSize: `${CELL}px ${CELL}px`, backgroundPosition: "-0.5px -0.5px", pointerEvents: "none" }, null, parent); }
// Numbered list with the bracket rule: a hairline across the top, ticked down at the right end.
function bracketList(items, { x, y, w, gap = 22, color, num = 13, size = 13, lh = 18 }) {
  let top = y;
  items.forEach((t, i) => {
    el("div", { position: "absolute", left: x - 34 + "px", top: top + 6 + "px", fontSize: "11px", letterSpacing: ".04em", color }, String(i + 1).padStart(2, "0"));
    el("div", { position: "absolute", left: x + "px", top: top + "px", width: w + "px", height: "12px", borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}` });
    const d = el("div", { position: "absolute", left: x + "px", top: top + 10 + "px", width: w - 24 + "px", fontSize: size + "px", lineHeight: lh + "px", letterSpacing: ".02em", textTransform: "uppercase", whiteSpace: "pre-line", color }, t);
    top += 10 + d.offsetHeight + gap;
  });
  return top;
}

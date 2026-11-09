// The `shape` field, SCALE direction (throwaway). One silhouette, cut into one band per part; each band's type
// size grows with the part's lines, so the form is built from a few huge letterforms down to 5px texture.
//
//   node render.mjs <config.json> [--theme light|dark] [--out dir] [--html]
//
// Writes <config>-<theme>.png (2x), <config>-<theme>-thumb.png (280px wide), with --html the page too, and prints
// an ASCII preview of the fitted shape plus the checks (✗ fails, ! warns).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, "../../../.cursor/skills/vyo");
const { partsFromFacts, accentIds } = await import(path.join(SKILL, "tools/lib/parts.mjs"));
const { chromium } = createRequire(import.meta.url)("playwright");

const SHEET = { width: 840, height: 1190 };
const THEMES = {
  light: { paper: "#EAE8E2", ink: "#161616", soft: "#8E8C84", mid: "#55534D", hot: "#FF4F12", onHot: "#161616" },
  dark: { paper: "#0E1424", ink: "#ECEEF2", soft: "#4F5A74", mid: "#97A0B6", hot: "#FF5A1F", onHot: "#0E1424" },
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const configPath = path.resolve(args.find((a) => a.endsWith(".json")));
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const theme = flag("--theme") ?? config.theme ?? "light";
const outDir = path.resolve(flag("--out") ?? HERE);
const base = path.join(outDir, `${path.basename(configPath, ".json")}-${theme}`);

const facts = JSON.parse(fs.readFileSync(path.resolve(path.dirname(configPath), config.facts), "utf8"));
const parts = partsFromFacts(facts, { names: config.names });
const hot = accentIds(parts, config.accent);
if (!hot.size) throw new Error(`accent ${config.accent} names no part`);
const unnamed = parts.filter((p) => !config.names?.[p.id]).map((p) => p.id);
if (unnamed.length) console.log(`! parts keep their scanned name: ${unnamed.join(", ")}`);

const date = new Date().toISOString().slice(0, 10).split("-").map(Number);
const record = `${config.product}${config.commit ? ` at ${config.commit}` : ""}, ${date[2]} ${MONTHS[date[1] - 1]} ${date[0]}. Drawn by Vyo`;

const data = {
  sheet: SHEET,
  shape: config.shape,
  parts: parts.map((p) => ({ name: p.name.toLowerCase(), loc: p.loc, hot: hot.has(p.id) })),
  product: config.product,
  headline: config.headline,
  legend: config.legend,
  record,
  scale: { gamma: 2.4, min: 5, ...config.scale },
};

const font = (file, type) => `url(data:${type};base64,${fs.readFileSync(path.join(SKILL, "fonts", file)).toString("base64")})`;
const vars = Object.entries(THEMES[theme]).map(([k, v]) => `--${k}:${v}`).join(";");
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Commit Mono";font-weight:400;src:${font("commit-400.otf", "font/otf")}}
@font-face{font-family:"Commit Mono";font-weight:700;src:${font("commit-700.otf", "font/otf")}}
@font-face{font-family:"Newsreader";font-weight:400;src:${font("newsreader-400.ttf", "font/ttf")}}
*{margin:0;padding:0;box-sizing:border-box}
:root{${vars}}
html,body{background:var(--paper)}
.sheet{position:relative;width:${SHEET.width}px;height:${SHEET.height}px;overflow:hidden;background:var(--paper);color:var(--ink);font-family:"Commit Mono",monospace}
svg{position:absolute;inset:0}
.t{position:absolute;white-space:normal}
.label{font-size:13px;line-height:16px;letter-spacing:.17em;white-space:nowrap}
.headline{font-family:Newsreader,serif;letter-spacing:-.012em}
.legend{font-family:Newsreader,serif;font-size:15px;line-height:21px;color:var(--mid)}
.legend b{font-weight:400;color:var(--hot)}
.record{font-size:10px;line-height:10px;letter-spacing:.3px;color:var(--mid);white-space:nowrap}
</style></head><body><div class="sheet"></div>
<script>window.DATA=${JSON.stringify(data).replace(/</g, "\\u003c")};</script>
<script>(${page.toString()})().catch((e) => { window.report = { lines: ["✗ " + e.message], ascii: "" }; })</script></body></html>`;

fs.mkdirSync(outDir, { recursive: true });
if (args.includes("--html")) fs.writeFileSync(`${base}.html`, html);
const browser = await chromium.launch(process.env.VYO_CHROMIUM ? { executablePath: process.env.VYO_CHROMIUM } : {});
try {
  const tab = await browser.newPage({ viewport: SHEET, deviceScaleFactor: 2 });
  const errors = [];
  tab.on("pageerror", (e) => errors.push(e.message));
  await tab.setContent(html, { waitUntil: "load" });
  await tab.waitForFunction(() => window.report, null, { timeout: 15000 }).catch(() => {});
  const report = await tab.evaluate(() => window.report);
  if (errors.length || !report) throw new Error(`page failed: ${errors.join("; ") || "no report"}`);
  const shot = await tab.locator(".sheet").screenshot({ path: `${base}.png` });
  const thumb = { width: 280, height: Math.round((280 * SHEET.height) / SHEET.width) };
  const small = await browser.newPage({ viewport: thumb, deviceScaleFactor: 1 });
  await small.setContent(`<body style="margin:0"><img width="${thumb.width}" height="${thumb.height}" style="display:block" src="data:image/png;base64,${shot.toString("base64")}">`);
  await small.waitForFunction(() => document.images[0].complete);
  await small.screenshot({ path: `${base}-thumb.png` });
  console.log(report.ascii);
  for (const line of report.lines) console.log(line);
  console.log(`wrote ${base}.png and ${base}-thumb.png`);
  process.exitCode = report.lines.some((l) => l.startsWith("✗")) ? 1 : 0;
} finally {
  await browser.close();
}

// Everything below runs in the page.
async function page() {
  await Promise.all(['400 12px "Commit Mono"', '700 12px "Commit Mono"', '400 12px Newsreader'].map((f) => document.fonts.load(f)));
  const D = window.DATA;
  const { width: W, height: H } = D.sheet;
  const NS = "http://www.w3.org/2000/svg";
  const lines = [];
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };

  // --- shape format -> SVG path data, in viewBox units -------------------------------------------------------
  const KINDS = ["rect", "circle", "ellipse", "capsule", "polygon", "arc", "path"];
  const f = (n) => +n.toFixed(3);
  const clock = (cx, cy, r, deg) => [f(cx + r * Math.sin((deg * Math.PI) / 180)), f(cy - r * Math.cos((deg * Math.PI) / 180))];
  const PATHS = {
    rect: ([x, y, w, h], p) => {
      const r = Math.min(p.r ?? 0, w / 2, h / 2);
      if (!r) return `M${x} ${y}h${w}v${h}h${-w}Z`;
      return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
    },
    circle: ([cx, cy, r]) => PATHS.ellipse([cx, cy, r, r]),
    ellipse: ([cx, cy, rx, ry]) => `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`,
    capsule: ([x1, y1, x2, y2, r]) => {
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const [nx, ny] = [(-(y2 - y1) / len) * r, ((x2 - x1) / len) * r];
      return `M${f(x1 + nx)} ${f(y1 + ny)}L${f(x2 + nx)} ${f(y2 + ny)}A${r} ${r} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)}L${f(x1 - nx)} ${f(y1 - ny)}A${r} ${r} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)}Z`;
    },
    polygon: (pts) => `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}Z`,
    arc: ([cx, cy, r, from, to], p) => {
      const w = p.width ?? r / 3;
      const [R, q] = [r + w / 2, r - w / 2];
      const sweep = (((to - from) % 360) + 360) % 360 || 360;
      if (sweep >= 359.99) return `${PATHS.circle([cx, cy, R])}${PATHS.circle([cx, cy, q]).replace(/A(\S+) (\S+) 0 1 0/g, "A$1 $2 0 1 1")}`;
      const big = sweep > 180 ? 1 : 0;
      const [a, b, c, d] = [clock(cx, cy, R, from), clock(cx, cy, R, from + sweep), clock(cx, cy, q, from + sweep), clock(cx, cy, q, from)];
      return `M${a}A${R} ${R} 0 ${big} 1 ${b}L${c}A${q} ${q} 0 ${big} 0 ${d}Z`.replace(/,/g, " ");
    },
    path: (d) => d,
  };
  const centreOf = (kind, v) =>
    ({
      rect: () => [v[0] + v[2] / 2, v[1] + v[3] / 2],
      circle: () => [v[0], v[1]],
      ellipse: () => [v[0], v[1]],
      capsule: () => [(v[0] + v[2]) / 2, (v[1] + v[3]) / 2],
      polygon: () => [v.reduce((s, p) => s + p[0], 0) / v.length, v.reduce((s, p) => s + p[1], 0) / v.length],
      arc: () => [v[0], v[1]],
    })[kind]?.();

  const vb = D.shape.viewBox;
  const items = D.shape.parts.map((p, i) => {
    const kind = KINDS.find((k) => k in p);
    if (!kind) throw new Error(`shape part ${i} has none of ${KINDS.join(", ")}`);
    const d = PATHS[kind](p[kind], p);
    const c = p.origin ?? centreOf(kind, p[kind]) ?? [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2];
    const turns = [D.shape.rotate && [D.shape.rotate, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2], p.rotate && [p.rotate, ...c]].filter(Boolean);
    return { d, cut: !!p.cut, turns, rotate: turns.map(([a, x, y]) => `rotate(${a} ${x} ${y})`).join(" ") };
  });
  const paint = (ctx, m) => {
    for (const it of items) {
      ctx.save();
      ctx.setTransform(...m);
      for (const [a, cx, cy] of it.turns) {
        ctx.translate(cx, cy);
        ctx.rotate((a * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }
      ctx.globalCompositeOperation = it.cut ? "destination-out" : "source-over";
      ctx.fillStyle = "#000";
      ctx.fill(new Path2D(it.d));
      ctx.restore();
    }
  };
  const raster = (w, h, m) => {
    const c = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = c.getContext("2d", { willReadFrequently: true });
    paint(ctx, m);
    const a = ctx.getImageData(0, 0, w, h).data;
    const on = new Uint8Array(w * h);
    for (let i = 0; i < on.length; i++) on[i] = a[i * 4 + 3] > 127 ? 1 : 0;
    return on;
  };

  // --- fit: measure the shape's real extent in the viewBox, then scale its box to `fit` -------------------------
  const R = 1000 / Math.max(vb[2], vb[3]);
  const [pw, ph] = [Math.ceil(vb[2] * R * 2), Math.ceil(vb[3] * R * 2)];
  const probe = raster(pw, ph, [R, 0, 0, R, (-vb[0] + vb[2] / 2) * R, (-vb[1] + vb[3] / 2) * R]);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) if (probe[y * pw + x]) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x + 1), Math.max(y1, y + 1)];
  if (x0 === Infinity) throw new Error("the shape is empty");
  const box = { x: x0 / R + vb[0] - vb[2] / 2, y: y0 / R + vb[1] - vb[3] / 2, w: (x1 - x0) / R, h: (y1 - y0) / R };
  const fit = { cx: 0.5, cy: 0.5, ...D.shape.fit };
  const scales = [fit.w && (fit.w * W) / box.w, fit.h && (fit.h * H) / box.h].filter(Boolean);
  const s = scales.length ? Math.min(...scales) : Math.min((0.9 * W) / box.w, (0.9 * H) / box.h);
  const M = [s, 0, 0, s, fit.cx * W - (box.x + box.w / 2) * s, fit.cy * H - (box.y + box.h / 2) * s];
  const on = raster(W, H, M);
  const placed = { left: M[4] + box.x * s, top: M[5] + box.y * s, right: M[4] + (box.x + box.w) * s, bottom: M[5] + (box.y + box.h) * s };

  // --- bands: cumulative covered area down the sheet, cut where each part's share of the lines is reached ------
  const rowArea = new Float64Array(H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) rowArea[y] += on[y * W + x];
  const area = rowArea.reduce((a, b) => a + b, 0);
  const total = D.parts.reduce((a, p) => a + p.loc, 0);
  const top = rowArea.findIndex((a) => a > 0);
  const MIN_BAND = 8;
  const bottom = H - [...rowArea].reverse().findIndex((a) => a > 0);
  let y = top;
  let acc = 0;
  let want = 0;
  const bands = D.parts.map((p, i) => {
    want += (p.loc / total) * area;
    const start = y;
    if (i === D.parts.length - 1) y = bottom;
    else while (y < bottom && (acc + rowArea[y] / 2 < want || y < start + MIN_BAND)) acc += rowArea[y++];
    return { ...p, y0: start, y1: Math.max(y, start + 1) };
  });

  // Type size per band: the biggest part sets one line as tall as its band; the others shrink by (loc/max)^gamma,
  // never under `min` px, and the band takes as many lines as fit.
  const big = bands.reduce((a, b) => (b.loc > a.loc ? b : a));
  const LH = 0.86;
  const S = (big.y1 - big.y0) / LH;
  for (const b of bands) {
    const h = b.y1 - b.y0;
    const want = Math.max(D.scale.min, S * Math.pow(b.loc / big.loc, D.scale.gamma));
    b.lines = Math.max(1, Math.floor(h / (want * LH)));
    b.size = h / b.lines / LH;
    // A small part whose band was stretched to the minimum height keeps its small type: size encodes weight.
    if (b.lines === 1 && want < 12) b.size = Math.min(b.size, want);
    // A one-line band shrinks until one whole name fits across the shape, so the biggest word stays readable.
    if (b.lines === 1) {
      const r = Math.round((b.y0 + b.y1) / 2);
      let [l, rr] = [W, 0];
      for (let x = 0; x < W; x++) if (on[r * W + x]) [l, rr] = [Math.min(l, x), x];
      const fits = (rr - l) / (b.name.length * 0.6 * 0.94);
      if (fits < b.size) [b.fill, b.size] = [b.size, Math.max(fits, b.size * 0.6)];
    }
    if (b.size < D.scale.min) lines.push(`! band "${b.name}" is ${h}px tall: ${b.size.toFixed(1)}px type, under ${D.scale.min}px`);
  }

  // --- draw ------------------------------------------------------------------------------------------------------
  const sheet = document.querySelector(".sheet");
  const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, sheet);
  const defs = el("defs", {}, svg);
  const mask = el("mask", { id: "shape", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: W, height: H }, defs);
  const mg = el("g", { transform: `matrix(${M.join(" ")})` }, mask);
  for (const it of items) el("path", { d: it.d, fill: it.cut ? "#000" : "#fff", transform: it.rotate }, mg);
  const field = el("g", { mask: "url(#shape)" }, svg);
  const GAP = D.scale.gap ?? 3;
  const leftAt = (yy) => {
    const r = Math.min(H - 1, Math.max(0, Math.round(yy)));
    for (let x = 0; x < W; x++) if (on[r * W + x]) return x;
    return 0;
  };
  bands.forEach((b, i) => {
    const g0 = i ? GAP / 2 : 0;
    const g1 = i < bands.length - 1 ? GAP / 2 : 0;
    el("clipPath", { id: `b${i}` }, defs).appendChild(el("rect", { x: -10, y: b.y0 + g0, width: W + 20, height: b.y1 - b.y0 - g0 - g1 }));
    const g = el("g", { "clip-path": `url(#b${i})` }, field);
    el("rect", { x: 0, y: b.y0, width: W, height: b.y1 - b.y0, fill: b.hot ? "var(--hot)" : "var(--ink)" }, g);
    const step = (b.y1 - b.y0) / b.lines;
    const word = `${b.name} `;
    const adv = 0.6 * b.size;
    const track = b.size > 40 ? -0.06 : b.size > 14 ? -0.03 : 0.02;
    const reps = Math.ceil(W / (word.length * adv * (1 + track))) + 2;
    for (let j = 0; j < b.lines; j++) {
      const base = b.fill ? (b.y0 + b.y1) / 2 + 0.27 * b.size : b.y0 + step * (j + 0.84);
      const shift = (j % 2) * Math.round(word.length / 2) * adv;
      const t = el("text", {
        x: leftAt(b.y0 + step * (j + 0.5)) - shift,
        y: base,
        "font-family": "Commit Mono",
        "font-weight": b.size >= 12 ? 700 : 400,
        "font-size": b.size.toFixed(2),
        "letter-spacing": `${(track * b.size).toFixed(2)}`,
        fill: b.hot ? "var(--onHot)" : "var(--paper)",
      }, g);
      t.textContent = word.repeat(reps);
    }
  });

  // --- text: placed in the room the shape leaves ----------------------------------------------------------------
  const MARGIN = 44;
  const CLEAR = 26;
  const C = 4;
  const [gw, gh] = [Math.ceil(W / C), Math.ceil(H / C)];
  const busy = new Uint8Array(gw * gh);
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (on[yy * W + xx]) busy[Math.floor(yy / C) * gw + Math.floor(xx / C)] = 1;
  const dil = Math.ceil(CLEAR / C);
  const near = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++)
      if (busy[gy * gw + gx]) for (let dy = -dil; dy <= dil; dy++) for (let dx = -dil; dx <= dil; dx++) {
        const [a, c] = [gx + dx, gy + dy];
        if (a >= 0 && c >= 0 && a < gw && c < gh) near[c * gw + a] = 1;
      }
  const clear = (r) => {
    if (r.left < MARGIN - 1 || r.top < MARGIN - 1 || r.right > W - MARGIN + 1 || r.bottom > H - MARGIN + 1) return false;
    for (let gy = Math.floor(r.top / C); gy < Math.ceil(r.bottom / C); gy++)
      for (let gx = Math.floor(r.left / C); gx < Math.ceil(r.right / C); gx++) if (near[gy * gw + gx]) return false;
    return true;
  };
  const claim = (r) => {
    for (let gy = Math.max(0, Math.floor((r.top - 20) / C)); gy < Math.min(gh, Math.ceil((r.bottom + 20) / C)); gy++)
      for (let gx = Math.max(0, Math.floor((r.left - 20) / C)); gx < Math.min(gw, Math.ceil((r.right + 20) / C)); gx++) near[gy * gw + gx] = 1;
  };
  const block = (cls, htmlText, w, extra = "") => {
    const e = document.createElement("div");
    e.className = `t ${cls}`;
    e.style.cssText = `width:${w}px;${extra}`;
    e.innerHTML = htmlText;
    sheet.appendChild(e);
    return e;
  };
  // Try each spot top to bottom, left margin and right margin first, then the rest of the row.
  const findSpot = (w, h, prefer) => {
    const ys = [];
    for (let yy = MARGIN; yy + h <= H - MARGIN; yy += 4) ys.push(yy);
    if (prefer === "bottom") ys.reverse();
    for (const yy of ys) {
      const xs = [MARGIN, W - MARGIN - w];
      for (let xx = MARGIN + 8; xx < W - MARGIN - w; xx += 8) xs.push(xx);
      for (const xx of xs) {
        const r = { left: xx, top: yy, right: xx + w, bottom: yy + h };
        if (clear(r)) return r;
      }
    }
    return null;
  };
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const placeAt = (e, spot) => {
    Object.assign(e.style, { left: `${spot.left}px`, top: `${spot.top}px` });
    if (spot.left > W / 2) e.style.textAlign = "right";
    claim(spot);
  };
  const freeStrict = (r) => {
    for (let gy = Math.floor(r.top / C); gy < Math.ceil(r.bottom / C); gy++)
      for (let gx = Math.max(0, Math.floor(r.left / C)); gx < Math.min(gw, Math.ceil(r.right / C)); gx++) if (near[gy * gw + gx]) return false;
    return true;
  };
  // Record line: along the bottom edge where it is clear, else up the left or right edge.
  const placeRecord = (rec) => {
    const rw = rec.getBoundingClientRect().width;
    const EDGE = 28;
    const bottom = [MARGIN, W - MARGIN - rw].map((x) => ({ left: x, top: H - EDGE - 10, right: x + rw, bottom: H - EDGE })).find(freeStrict);
    if (bottom) {
      Object.assign(rec.style, { left: `${bottom.left}px`, top: `${bottom.top}px` });
      claim(bottom);
      return { ...bottom, side: "bottom" };
    }
    for (const side of ["left", "right"]) {
      const x = side === "left" ? EDGE : W - EDGE - 10;
      for (let yy = H - MARGIN; yy - rw > MARGIN; yy -= 8) {
        const r = { left: x, top: yy - rw, right: x + 10, bottom: yy };
        if (!freeStrict(r)) continue;
        Object.assign(rec.style, { left: `${r.left}px`, top: `${r.bottom}px`, transform: "rotate(-90deg)", transformOrigin: "left top" });
        claim(r);
        return { ...r, side };
      }
    }
    return null;
  };
  const headWords = `<div class="label" style="margin-bottom:18px">${esc(D.product.toUpperCase())}</div><div class="headline">${esc(D.headline)}</div>`;
  const legendHtml = esc(D.legend).replace(esc(D.parts.find((p) => p.hot).name), (m) => `<b>${m}</b>`);
  // The largest headline that still leaves room for the record line and the legend.
  let done = null;
  for (let size = 72; size >= 30 && !done; size -= 2)
    for (const w of [520, 440, 380, 320]) {
      const saved = near.slice();
      const made = [];
      const head = block("", headWords, w);
      made.push(head);
      head.querySelector(".headline").style.cssText = `font-size:${size}px;line-height:${Math.round(size * 1.04)}px`;
      const hs = findSpot(w, head.getBoundingClientRect().height, "top");
      if (hs) placeAt(head, hs);
      const rec = hs && block("record", `${esc(D.record)}<span style="color:var(--hot)">.</span>`, 0, "width:auto");
      if (rec) made.push(rec);
      const rs = rec && placeRecord(rec);
      let ls = null;
      if (rs)
        for (const lw of [300, 260, 220, 360]) {
          const leg = block("legend", legendHtml, lw);
          ls = findSpot(lw, leg.getBoundingClientRect().height, "bottom");
          if (ls) {
            placeAt(leg, ls);
            break;
          }
          leg.remove();
        }
      if (ls) {
        done = { size, hs, rs, ls };
        break;
      }
      made.forEach((m) => m.remove());
      near.set(saved);
    }
  if (done) lines.push(`headline ${done.size}px at ${done.hs.left},${done.hs.top}`, `record ${done.rs.side} at ${Math.round(done.rs.left)},${Math.round(done.rs.top)}`, `legend at ${done.ls.left},${done.ls.top}`);
  else lines.push("✗ no room for the headline, record line and legend together: shrink the shape or move it with fit.cx/cy");

  // --- report --------------------------------------------------------------------------------------------------
  const bleed = ["left", "top", "right", "bottom"].filter((k) => (k === "left" ? placed.left < 0 : k === "top" ? placed.top < 0 : k === "right" ? placed.right > W : placed.bottom > H));
  const visible = area / (W * H);
  lines.unshift(`shape covers ${(visible * 100).toFixed(0)}% of the sheet; bleeds ${bleed.join(", ") || "nowhere"}`);
  if (visible < 0.35) lines.push(`! the shape covers ${(visible * 100).toFixed(0)}% of the sheet: SCALE wants it huge (over 35%)`);
  for (const b of bands) lines.push(`  ${b.hot ? "*" : " "} ${b.name.padEnd(16)} ${String(b.loc).padStart(6)} lines  band ${String(b.y1 - b.y0).padStart(3)}px  ${b.lines} x ${b.size.toFixed(1)}px`);
  const accentBand = bands.find((b) => b.hot);
  if (accentBand.y1 - accentBand.y0 < 40) lines.push(`! the accent band is ${accentBand.y1 - accentBand.y0}px tall: it may vanish in the thumbnail`);
  const ascii = [];
  for (let gy = 0; gy < 60; gy++) {
    let row = "";
    for (let gx = 0; gx < 42; gx++) {
      const [px, py] = [Math.floor(((gx + 0.5) * W) / 42), Math.floor(((gy + 0.5) * H) / 60)];
      const b = bands.find((q) => py >= q.y0 && py < q.y1);
      row += on[py * W + px] ? (b?.hot ? "@" : "#") : ".";
    }
    ascii.push(row);
  }
  window.report = { lines, ascii: ascii.join("\n") };
}

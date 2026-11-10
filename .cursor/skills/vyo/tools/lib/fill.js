// Runs in the page after geometry.mjs and the field modules (render concatenates them): lays the figure's
// rows and dots out around the text blocks, then sets window.drawn.

// 5x7 letters, one string per row, "1" = a square.
const GLYPHS = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

const F = JSON.parse(document.getElementById("figure").textContent);
const isHot = (w) => !!F.hot && window.hasWord(w, F.hot);

function el(className, data, style, text) {
  const e = document.createElement("div");
  e.className = className;
  for (const [k, v] of Object.entries(data)) if (v !== false) e.dataset[k] = v === true ? "" : v;
  Object.assign(e.style, style);
  if (text !== undefined) e.textContent = text;
  return e;
}

const ctx = document.createElement("canvas").getContext("2d");
const measure = (text, size) => {
  ctx.font = `400 ${size}px "Commit Mono"`;
  return ctx.measureText(text).width;
};

/** One row of letters in the colour token `tone`: `r` from fillRows or a field layout. */
function drawRow(S, r, data, height, weight, tone) {
  const text = r.text.replace(/ /g, "\u00a0");
  const e = el(
    "row",
    data,
    {
      fontSize: r.size + "px", lineHeight: (r.lineHeight ?? height) + "px", height: height + "px",
      left: r.x + "px", top: r.y + "px", width: Math.ceil(r.width) + 1 + "px", letterSpacing: r.spacing + "px",
      color: `var(--${tone})`, fontWeight: weight, opacity: r.alpha ?? 1,
    },
    text.slice(0, -1),
  );
  // The last letter carries no tracking, so the letters span the run exactly.
  const last = document.createElement("span");
  last.style.letterSpacing = "0";
  last.textContent = text.slice(-1);
  e.appendChild(last);
  S.appendChild(e);
}

/** A row set letter by letter along a curve: each glyph at its own origin and angle, from a field layout. */
function drawGlyphs(svg, r, data) {
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("class", "row");
  for (const [k, v] of Object.entries(data)) if (v !== false && v !== undefined) t.dataset[k] = v === true ? "" : v;
  const f = (n) => Math.round(n * 100) / 100;
  t.setAttribute("x", r.glyphs.map((g) => f(g[0])).join(" "));
  t.setAttribute("y", r.glyphs.map((g) => f(g[1])).join(" "));
  t.setAttribute("rotate", r.glyphs.map((g) => f(g[2])).join(" "));
  Object.assign(t.style, { fontSize: r.size + "px", fontWeight: r.weight ?? 400, fill: `var(--${r.tone})`, color: `var(--${r.tone})`, whiteSpace: "pre" });
  t.textContent = r.text;
  svg.appendChild(t);
}

function drawFill(S, region, blocks) {
  const size = region.size || 12;
  const { pitch } = GRID[size];
  const rows = regionRows(region, blocks);
  for (const r of fillRows(region, rows, { measure: (t) => measure(t, size), isHot })) {
    drawRow(S, { ...r, size }, { word: r.word, region: region.id, hot: r.hot }, pitch, r.hot ? 700 : 400, r.hot ? "hot" : r.tone);
  }
  return { id: region.id, kind: "fill", bbox: bbox(shapeRings(region)), rows: rows.length };
}

function drawField(S, region, blocks) {
  const frame = { floor: F.floor, mirror: F.mirror, theme: F.theme, blocks, measure };
  for (const g of FIELDS[region.field].ground?.(region, region.parts, frame) ?? []) {
    // A ground with its own path (an outline traced from the field) fills it even-odd, so a ring band keeps its hole.
    const d = g.path ?? runsPath(g.rows);
    if (d) S.appendChild(el("ground", { region: region.id, part: g.part ?? false, hot: g.hot }, { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", background: `var(--${g.tone})`, clipPath: g.path ? `path(evenodd, "${d}")` : `path("${d}")`, opacity: g.alpha ?? 1 }));
  }
  const items = FIELDS[region.field].layout(region, region.parts, frame);
  const set = items.some((r) => r.glyphs) && S.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
  if (set) Object.assign(set.style, { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", fontFamily: '"Commit Mono", monospace' });
  for (const r of items) {
    if (r.glyphs) drawGlyphs(set, r, { word: r.word, region: region.id, part: r.part, hot: r.hot });
    else drawRow(S, r, { word: r.word, region: region.id, part: r.part, hot: r.hot }, r.height, r.weight ?? 400, r.tone);
  }
  const box = items.length ? bbox([items.flatMap((r) => [[r.x, r.y], [r.x + r.width, r.y + r.height]])]) : { left: 0, top: 0, right: 0, bottom: 0 };
  return { id: region.id, kind: "field", bbox: box, rows: items.length };
}

function drawDots(S, region) {
  const C = region.cell;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lines = dotsLines(region);
  lines.forEach((ln, li) => {
    const word = ln.word.toUpperCase();
    const tone = region.tones[li];
    const hot = tone === "hot" || isHot(ln.word);
    const line = el("dots", { word: ln.word, region: region.id, hot }, { left: ln.x + "px", top: ln.y + "px", width: ln.width + "px", height: ln.height + "px" });
    for (let ci = 0; ci < DOTS.cols; ci++) {
      for (let ri = 0; ri < DOTS.rows; ri++) {
        const letter = word[Math.floor(ci / 6)];
        const col = ci % 6;
        const on = letter && col < 5 && GLYPHS[letter][ri][col] === "1";
        const x = ci * C;
        const y = ri * C;
        const s = on ? Math.round((C * (14 + Math.round(rnd() * 8))) / 24) : 3;
        line.appendChild(
          el("", {}, {
            position: "absolute", left: x + (C - s) / 2 + "px", top: y + (C - s) / 2 + "px", width: s + "px", height: s + "px",
            background: on ? (hot ? "var(--hot)" : `var(--${tone})`) : "var(--ink)", opacity: on ? 1 : 0.16,
          }),
        );
      }
    }
    S.appendChild(line);
  });
  const last = lines[lines.length - 1];
  return { id: region.id, kind: "dots", bbox: { left: region.x, top: region.y, right: region.x + last.width, bottom: last.y + last.height }, rows: lines.length };
}

(async () => {
  await window.fontsReady;
  const S = document.querySelector(".sheet");
  for (const m of S.querySelectorAll("[data-role=masthead]")) window.fitWidth(m, parseFloat(m.style.width));
  const origin = S.getBoundingClientRect();
  const blocks = [...S.querySelectorAll("[data-role]")].map((b) => {
    const range = document.createRange();
    range.selectNodeContents(b);
    const r = range.getBoundingClientRect();
    return { left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top };
  });
  const draw = { fill: drawFill, dots: drawDots, field: drawField };
  window.figure = { regions: F.regions.map((r) => draw[r.kind](S, r, blocks)) };
  window.drawn = true;
})();

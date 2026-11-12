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
// A traced shape's image comes in the figure, read by render in Node.
setMaskImages((name) => F.images[name]);
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
    r.spans ? undefined : text.slice(0, -1),
  );
  // A row with spans shades its letters span by span; its width leaves room for the last letter's tracking.
  for (const s of r.spans ?? []) {
    const span = document.createElement("span");
    span.style.cssText = `opacity:${s.alpha};font-weight:${s.weight};color:var(--${s.tone})${s.glow ? `;text-shadow:0 0 ${s.glow}px var(--${s.tone})` : ""}`;
    span.textContent = s.text.replace(/ /g, " ");
    e.appendChild(span);
  }
  if (!r.spans) {
    // The last letter carries no tracking, so the letters span the run exactly.
    const last = document.createElement("span");
    last.style.letterSpacing = "0";
    last.textContent = text.slice(-1);
    e.appendChild(last);
  }
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

/** The sheet's own marks, each blanked within 10px across or 8px down of a block of words or the record line. */
function drawSheet(S, region, frame) {
  const origin = S.getBoundingClientRect();
  const record = S.querySelector("[data-block=record]")?.getBoundingClientRect();
  const clear = [...frame.blocks, ...(record ? [{ left: record.left - origin.left, top: record.top - origin.top, right: record.right - origin.left, bottom: record.bottom - origin.top }] : [])];
  const near = (x, y) => clear.some((b) => x > b.left - 10 && x < b.right + 10 && y > b.top - 8 && y < b.bottom + 8);
  for (const r of FIELDS[region.field].sheet?.(region, region.parts, frame) ?? []) {
    const cw = r.width / r.text.length;
    const e = el("sheet-marks", {}, { position: "absolute", fontSize: r.size + "px", lineHeight: r.lineHeight + "px", height: r.height + "px", left: r.x + "px", top: r.y + "px", letterSpacing: r.spacing + "px", whiteSpace: "pre" });
    e.setAttribute("aria-hidden", "true");
    let k = 0;
    for (const s of r.spans) {
      const span = document.createElement("span");
      span.style.cssText = `opacity:${s.alpha};font-weight:${s.weight};color:var(--${s.tone})`;
      span.textContent = [...s.text].map((ch) => (near(r.x + (k++ + 0.5) * cw, r.y + r.height / 2) ? " " : ch)).join("");
      e.appendChild(span);
    }
    S.appendChild(e);
  }
}

function drawField(S, region, blocks) {
  const frame = { floor: F.floor, mirror: F.mirror, theme: F.theme, frame: F.frame, blocks, measure };
  drawSheet(S, region, frame);
  for (const g of FIELDS[region.field].ground?.(region, region.parts, frame) ?? []) {
    // A ground may bring its own path, traced from the field, in place of its rows.
    const d = g.path ?? runsPath(g.rows);
    if (!d) continue;
    const fill = el("ground", { region: region.id, part: g.part ?? false, hot: g.hot }, { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", background: `var(--${g.tone})`, clipPath: `path("${d}")`, opacity: g.alpha ?? 1 });
    // A blur on the clipped fill itself would be clipped too, so a soft ground blurs a wrapper.
    const soft = g.blur && el("", {}, { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", filter: `blur(${g.blur}px)` });
    if (soft) soft.appendChild(fill);
    S.appendChild(soft || fill);
  }
  const items = FIELDS[region.field].layout(region, region.parts, frame);
  // On signal paper the accent part is ink on a highlighter block of the signal colour, as lime type would not read.
  const highlight = F.frame === "signal" && F.theme === "light";
  const set = items.some((r) => r.glyphs) && S.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
  if (set) Object.assign(set.style, { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", fontFamily: '"Commit Mono", monospace' });
  for (const r of items) {
    if (r.glyphs) drawGlyphs(set, r, { word: r.word, region: region.id, part: r.part, hot: r.hot });
    else {
      drawRow(S, r, { word: r.word, region: region.id, part: r.part, hot: r.hot }, r.height, r.weight ?? 400, r.tone);
      if (highlight && r.hot) S.lastChild.style.background = "var(--hot)";
    }
  }
  const box = items.length ? bbox([items.flatMap((r) => [[r.x, r.y], [r.x + r.width, r.y + r.height]])]) : { left: 0, top: 0, right: 0, bottom: 0 };
  return { id: region.id, kind: "field", bbox: box, rows: items.length };
}

function drawRoutes(S, region) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "routes");
  svg.setAttribute("viewBox", `0 0 ${SHEET.width} ${SHEET.height}`);
  svg.setAttribute("width", String(SHEET.width));
  svg.setAttribute("height", String(SHEET.height));
  svg.dataset.region = region.id;
  const pts = [];
  region.paths.forEach((p, i) => {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", p.d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", `var(--${p.tone})`);
    path.setAttribute("stroke-width", "1.15");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    if (p.tone === "hot") path.setAttribute("data-hot", "");
    svg.appendChild(path);
    pts[i] = p.points && p.points.length ? p.points : [[0, 0]];
  });
  S.appendChild(svg);
  for (const n of region.nodes || []) {
    const at = pointAlong(pts[n.path] || pts[0], n.t);
    const hot = n.tone === "hot";
    const node = el("node", { region: region.id, hot, tone: n.tone, path: String(n.path), t: String(n.t) }, {
      left: at.x - 4 + "px", top: at.y - 4 + "px", width: "8px", height: "8px",
      background: `var(--${n.tone})`,
    });
    S.appendChild(node);
  }
  const all = pts.flat();
  const box = all.length ? bbox([all]) : { left: 0, top: 0, right: 0, bottom: 0 };
  return { id: region.id, kind: "routes", bbox: box, rows: 0 };
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
  for (const h of S.querySelectorAll("[data-halo]")) {
    const b = S.querySelector(`[data-block="${h.dataset.halo}"]`);
    Object.assign(h.style, { fontSize: b.style.fontSize, lineHeight: b.style.lineHeight });
  }
  const origin = S.getBoundingClientRect();
  const blocks = [...S.querySelectorAll("[data-role]")].map((b) => {
    const range = document.createRange();
    range.selectNodeContents(b);
    const r = range.getBoundingClientRect();
    return { left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top };
  });
  const draw = { fill: drawFill, dots: drawDots, field: drawField, routes: drawRoutes };
  window.figure = { regions: F.regions.map((r) => draw[r.kind](S, r, blocks)) };
  window.applyMotion = (t) => {
    window.motionT = t;
    const kind = F.motion && F.motion.kind;
    if (kind === "nodes" || !kind) {
      for (const node of S.querySelectorAll(".node")) {
        const path = Number(node.dataset.path);
        const region = F.regions.find((r) => r.id === node.dataset.region);
        const pts = region && region.paths[path] && region.paths[path].points;
        if (!pts) continue;
        const base = Number(node.dataset.t) || 0;
        const at = pointAlong(pts, (base + t) % 1);
        node.style.left = at.x - 4 + "px";
        node.style.top = at.y - 4 + "px";
      }
    }
    if (kind === "resolve") {
      const rows = [...S.querySelectorAll(".row")];
      rows.forEach((row, i) => {
        const u = rows.length ? i / rows.length : 1;
        row.style.opacity = u <= t ? "1" : "0";
      });
    } else {
      for (const row of S.querySelectorAll(".row")) if (row.style.opacity === "0") row.style.opacity = "";
    }
    if (kind === "wipe") {
      for (const mark of S.querySelectorAll("[data-role=mark]")) {
        const w = Number(mark.dataset.markW) || parseFloat(mark.style.width);
        mark.style.width = w * t + "px";
      }
    }
  };
  window.drawn = true;
})();

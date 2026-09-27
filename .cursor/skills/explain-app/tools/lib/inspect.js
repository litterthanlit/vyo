// Runs inside the page (via page.evaluate). Must stay self-contained: no
// imports, no closures over module scope. Each rule maps to a line in
// swiss-design-principles.md's (or block-style.md's) pre-delivery checklist.
export function inspectPoster({ index, page, palette }) {
  const errors = [];
  const warnings = [];
  const root = document.getElementById(`poster-${index}`);
  const crashed = root.querySelector("[data-poster-error]");
  if (crashed) return { errors: [`Render error: ${crashed.textContent}`], warnings };
  if (!root.firstElementChild) return { errors: ["Poster rendered nothing"], warnings };

  const norm = (c) => {
    const d = document.createElement("div");
    d.style.color = c;
    document.body.appendChild(d);
    const v = getComputedStyle(d).color;
    d.remove();
    return v;
  };
  const C = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, norm(v)]));
  const TRANSPARENT = "rgba(0, 0, 0, 0)";
  const px = (v) => parseFloat(v) || 0;
  const near = (a, b, t = 1) => Math.abs(a - b) <= t;
  const onBaseline = (v) => {
    const m = ((v % 8) + 8) % 8;
    return m < 0.5 || m > 7.5;
  };
  const label = (el) => {
    const t = (el.textContent || "").trim().replace(/\s+/g, " ");
    return t ? `"${t.slice(0, 40)}${t.length > 40 ? "…" : ""}"` : `<${el.tagName.toLowerCase()}>`;
  };
  const inOverlay = (el) => !!el.closest("[data-grid-overlay]");
  const inFlow = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
  };

  const all = [...root.querySelectorAll("*")];
  // The Block style's colour field is checked on its own below.
  const content = all.filter((el) => !inOverlay(el) && !el.closest("[data-poster-field]"));
  const sheet = root.querySelector('[data-poster-style="block"]');
  const block = !!sheet;
  const rgba = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };

  // ── Grid ────────────────────────────────────────────────────────────────
  const tracksOf = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display !== "grid" && cs.display !== "inline-grid") return null;
    return cs.gridTemplateColumns.split(/\s+/).map(parseFloat);
  };
  const edgesOf = (g) => {
    const cs = getComputedStyle(g);
    const gap = px(cs.columnGap);
    let x = g.getBoundingClientRect().left + px(cs.borderLeftWidth) + px(cs.paddingLeft);
    return tracksOf(g).map((w) => {
      const e = [x, x + w];
      x += w + gap;
      return e;
    });
  };
  const grids = content.filter((el) => tracksOf(el));
  const outer = grids.find((g) => tracksOf(g).length === 12);
  if (!outer) return { errors: ["No 12-column grid found — posters are built on one outer 12-column grid"], warnings };
  const cols = edgesOf(outer);
  const starts = cols.map((c) => c[0]);
  const ends = cols.map((c) => c[1]);
  const top0 = outer.getBoundingClientRect().top;

  for (const g of grids) {
    const n = tracksOf(g).length;
    if (n !== 12) {
      errors.push(`Nested grid with ${n} columns at ${label(g)} — only 12-column subgrids that re-expose the same lines`);
      continue;
    }
    const drift = edgesOf(g).some(([s, e], i) => !near(s, starts[i]) || !near(e, ends[i]));
    if (drift) {
      errors.push(`12-column grid at ${label(g)} does not share the outer grid's column lines`);
      continue;
    }
    for (const child of g.children) {
      if (!inFlow(child)) continue;
      const r = child.getBoundingClientRect();
      if (!r.width) continue;
      if (!starts.some((s) => near(r.left, s)) || !ends.some((e) => near(r.right, e))) {
        errors.push(`Off the column lines: ${label(child)} (left ${r.left.toFixed(1)}, right ${r.right.toFixed(1)}) — no negative margins`);
      }
      const top = r.top - top0;
      if (!onBaseline(top) || !onBaseline(r.height)) {
        errors.push(`Off the 8px baseline: ${label(child)} (top ${top.toFixed(1)}, height ${r.height.toFixed(1)}) — take rule/border widths out of padding`);
      }
    }
  }

  // ── Type & colour ───────────────────────────────────────────────────────
  const textEls = content.filter(
    (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && getComputedStyle(el).display !== "none",
  );
  const sizes = new Map(); // size → characters set at that size
  let fullStops = 0;
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    const size = px(cs.fontSize);
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    sizes.set(size, (sizes.get(size) || 0) + own.length);

    if (cs.lineHeight === "normal" || !onBaseline(px(cs.lineHeight))) {
      errors.push(`Line height ${cs.lineHeight} on ${label(el)} — must be a multiple of 8, in px`);
    }
    if (!/helvetica|arial/i.test(cs.fontFamily)) errors.push(`Font "${cs.fontFamily}" on ${label(el)} — grotesque sans only`);
    if (cs.textAlign === "center" || cs.textAlign === "justify") {
      errors.push(`${cs.textAlign} text on ${label(el)} — flush-left only`);
    }
    if (cs.color === C.ACCENT) {
      if (own === ".") fullStops++;
      else if (el.tagName !== "BUTTON") errors.push(`Red text on ${label(el)} — the accent is reserved for the full stop and grid toggle`);
    } else if (block ? cs.color !== C.INK && cs.color !== C.PAPER : cs.color !== C.INK && cs.color !== C.INK_SOFT) {
      errors.push(`Text colour ${cs.color} on ${label(el)} — use ${block ? "INK or PAPER" : "INK or INK_SOFT"}`);
    }

    // WCAG contrast against the nearest opaque background.
    let bgEl = el;
    while (bgEl && bgEl !== root && !(rgba(getComputedStyle(bgEl).backgroundColor)?.a >= 1)) bgEl = bgEl.parentElement;
    if (block && (!bgEl || bgEl === root || bgEl === sheet)) {
      errors.push(`Text on the field: ${label(el)} — put it on a block, a tab or a paper strip`);
    } else if (bgEl && bgEl !== root) {
      const lum = ({ r, g, b }) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const [l1, l2] = [lum(rgba(cs.color)), lum(rgba(getComputedStyle(bgEl).backgroundColor))].sort((a, b) => b - a);
      const ratio = (l1 + 0.05) / (l2 + 0.05);
      const large = size >= 24 || (size >= 18.66 && px(cs.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) {
        errors.push(`Contrast ${ratio.toFixed(2)}:1 on ${label(el)} — needs ${large ? "3" : "4.5"}:1`);
      }
    }
  }
  if (fullStops === 0) errors.push("No red full stop after the masthead");
  if (fullStops > 1) errors.push(`${fullStops} red full stops — the accent appears once`);

  const sorted = [...sizes.keys()].sort((a, b) => b - a);
  if (sorted.length > 4) errors.push(`${sorted.length} font sizes (${sorted.join(", ")}px) — four maximum: display · numeral · body · folio`);
  const display = sorted[0];
  const body = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (block) {
    if (![64, 72, 80].includes(display)) errors.push(`Title is ${display}px — the Block style sets it at 64, 72, or 80px`);
  } else if (page === 1) {
    if (!(display >= 104 && display <= 128 && display % 8 === 0)) {
      errors.push(`Masthead is ${display}px — page 1 needs 104–128px in a multiple of 8`);
    }
    if (body && display / body < 7) errors.push(`Display : body is ${(display / body).toFixed(1)}:1 — needs at least 7:1`);
  } else if (![64, 72, 80].includes(display)) {
    errors.push(`Tagline is ${display}px — page 2 needs 64, 72, or 80px`);
  }
  if (sorted.at(-1) < 10) errors.push(`${sorted.at(-1)}px text — 10px is the floor`);

  for (const el of content) {
    const cs = getComputedStyle(el);
    const bgs = block ? [C.PAPER, C.INK, C.YELLOW, C.BLUE, C.SILVER] : [C.PAPER, C.INK];
    if (cs.backgroundColor !== TRANSPARENT && !bgs.includes(cs.backgroundColor)) {
      errors.push(`Background ${cs.backgroundColor} on ${label(el)} — ${block ? "paper, ink, or a status colour" : "paper and ink only"}`);
    }
    if (cs.backgroundImage !== "none") errors.push(`Background image/gradient on ${label(el)}`);
    if (cs.boxShadow !== "none") errors.push(`Box shadow on ${label(el)}`);
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      if (px(cs[`border${side}Width`]) && cs[`border${side}Style`] !== "none") {
        const c = cs[`border${side}Color`];
        if (c !== C.INK && c !== C.HAIRLINE) errors.push(`Border colour ${c} on ${label(el)} — rules are ink`);
      }
    }
  }

  // ── SVG artwork ─────────────────────────────────────────────────────────
  const SHAPES = "rect, circle, ellipse, line, path, polyline, polygon";
  const svgColours = new Set(["none", C.PAPER, C.INK, C.INK_SOFT, C.HAIRLINE, C.RED, C.BLUE, C.YELLOW]);
  const svgs = content.filter((el) => el.tagName.toLowerCase() === "svg" && !el.parentElement.closest("svg"));
  let redShapes = 0;
  for (const svg of svgs) {
    const name = svg.getAttribute("aria-label") || "an SVG";
    if (svg.getAttribute("aria-hidden") !== "true" && !(svg.getAttribute("role") === "img" && svg.getAttribute("aria-label"))) {
      errors.push(`${name}: give figures role="img" and an aria-label (or aria-hidden if purely decorative)`);
    }
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (vb && vb.width && (!near(r.width, vb.width) || !near(r.height, vb.height))) {
      errors.push(`${name}: drawn at ${r.width.toFixed(0)}×${r.height.toFixed(0)} but its viewBox is ${vb.width}×${vb.height} — draw SVG 1:1 with spanW()/snap8()`);
    }
    if (!starts.some((x) => near(r.left, x)) || !ends.some((x) => near(r.right, x))) {
      errors.push(`${name}: not on the column lines (left ${r.left.toFixed(1)}, right ${r.right.toFixed(1)})`);
    }
    if (!onBaseline(r.height)) errors.push(`${name}: height ${r.height.toFixed(1)} is not a multiple of 8`);
    const banned = [...svg.querySelectorAll("text, tspan, linearGradient, radialGradient, pattern, filter, image, foreignObject")];
    for (const tag of new Set(banned.map((b) => b.tagName))) {
      errors.push(`${name}: contains <${tag}> — ${/text|tspan/i.test(tag) ? "labels are HTML, never SVG text" : "flat colour only, no gradients, filters or images"}`);
    }
    for (const shape of svg.querySelectorAll(SHAPES)) {
      const cs = getComputedStyle(shape);
      // A line has no area, so its (default black) fill never paints.
      const fill = shape.tagName.toLowerCase() === "line" ? "none" : cs.fill.startsWith("url(") ? "url" : cs.fill;
      const strokeW = cs.stroke === "none" ? 0 : px(cs.strokeWidth);
      for (const [what, c] of [["fill", fill], ["stroke", strokeW ? cs.stroke : "none"]]) {
        if (!svgColours.has(c)) errors.push(`${name}: ${what} ${c} is outside the palette`);
      }
      if (fill === C.RED || (strokeW && cs.stroke === C.RED)) redShapes++;
      if (strokeW && strokeW < 8 && cs.stroke === C.YELLOW) {
        errors.push(`${name}: ${strokeW}px yellow stroke — yellow is a fill, or a stroke of at least 8px`);
      }
    }
  }
  if (redShapes > 1) errors.push(`${redShapes} red shapes — red means the product: the full stop plus one core element`);

  // Transit joins: every segment and branch end must sit inside a station or ring.
  const centreOf = (el) => {
    const svg = el.ownerSVGElement;
    const pt = svg.createSVGPoint();
    const m = el.getScreenCTM();
    pt.x = +el.getAttribute("cx");
    pt.y = +el.getAttribute("cy");
    const c = pt.matrixTransform(m);
    return { x: c.x, y: c.y, r: +el.getAttribute("r") * m.a };
  };
  const stops = content.filter((el) => /station|ring/.test(el.getAttribute("data-transit") || "")).map(centreOf);
  const inStop = (p) => stops.some((s) => Math.hypot(p.x - s.x, p.y - s.y) <= s.r + 1);
  let segment = 0;
  for (const el of content.filter((e) => /segment|branch/.test(e.getAttribute("data-transit") || ""))) {
    const kind = el.getAttribute("data-transit");
    if (kind === "segment") segment++;
    const svg = el.ownerSVGElement;
    const m = el.getScreenCTM();
    const end = (x, y) => {
      const pt = svg.createSVGPoint();
      pt.x = x;
      pt.y = y;
      return pt.matrixTransform(m);
    };
    const a = end(+el.getAttribute("x1"), +el.getAttribute("y1"));
    const b = end(+el.getAttribute("x2"), +el.getAttribute("y2"));
    if (!inStop(a) || !inStop(b)) {
      errors.push(kind === "segment"
        ? `Transit line segment ${segment} does not join two stations — run it from dot centre to dot centre`
        : "A branch stroke does not join its ring to the line");
    }
  }

  // ── Block style: sheet, connected figure, colour field ──────────────────
  if (block) {
    const S = sheet.getBoundingClientRect();
    if (!near(S.width, 1028) || !near(S.height, 1454)) {
      errors.push(`Block sheet is ${S.width.toFixed(0)}×${S.height.toFixed(0)} — it must be the 1028×1454 A-series sheet`);
    }
    const legend = sheet.querySelector("[data-legend]")?.getBoundingClientRect();
    const blocks = [...sheet.querySelectorAll("[data-block]")];
    const minOverlap = (ends[1] - starts[0]); // two columns and the gutter between them
    blocks.forEach((b, i) => {
      const r = b.getBoundingClientRect();
      if (r.bottom > S.bottom + 1 || r.right > S.right + 1 || r.left < S.left - 1) {
        errors.push(`Block ${label(b)} runs off the sheet — shorten its text or use fewer blocks`);
      }
      if (legend && r.bottom > legend.top - 1) errors.push(`Block ${label(b)} collides with the legend bar — shorten its text or use fewer blocks`);
      if (i === 0) return;
      const p = blocks[i - 1].getBoundingClientRect();
      const overlap = Math.min(p.right, r.right) - Math.max(p.left, r.left);
      if (!near(r.top, p.bottom) || overlap < minOverlap - 1) {
        errors.push(`Block ${label(b)} floats apart — each block must sit on the one above and overlap it by 2+ columns`);
      }
    });
    const field = sheet.querySelector("[data-poster-field]");
    if (!field) errors.push("Block sheet has no colour field");
    else {
      for (const f of field.querySelectorAll("filter *")) {
        if (f.tagName !== "feGaussianBlur") errors.push(`Colour field uses <${f.tagName}> — the field is one hue, softened by feGaussianBlur only`);
      }
      const hues = [];
      for (const shape of field.querySelectorAll(SHAPES)) {
        const c = rgba(getComputedStyle(shape).fill);
        if (!c) continue;
        const [r, g, b] = [c.r / 255, c.g / 255, c.b / 255];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        if (d < 0.1) continue; // near-grey: no meaningful hue
        const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        hues.push((h * 60 + 360) % 360);
      }
      const spread = Math.max(0, ...hues.map((a) => Math.max(...hues.map((b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))))));
      if (spread > 15) errors.push(`Colour field mixes hues (${spread.toFixed(0)}° apart) — one hue, lighter and darker`);
    }
  }

  // ── Copy: no file paths; flag jargon for a rewrite ──────────────────────
  const text = root.innerText;
  const paths = text.match(/(?:^|[\s(])(?:\.{0,2}\/)?(?:[\w.-]+\/)+[\w.-]+\.(?:tsx?|jsx?|mjs|py|go|rb|rs|json|md|ya?ml|css|html)\b|(?:^|\s)(?:src|app|lib|pages|components)\/[\w./-]+/gm);
  if (paths) errors.push(`File paths on the poster: ${[...new Set(paths.map((p) => p.trim()))].join(", ")}`);
  const jargon = [
    ...[/\bAPIs?\b/, /\bSDKs?\b/, /\bORM\b/, /\bREST\b/, /\bGraphQL\b/, /\bPRs?\b/, /\bCI\b/],
    ...["endpoint", "middleware", "webhook", "deploy", "deployment", "env var", "environment variable", "frontend", "front-end", "backend", "back-end", "monorepo", "repository", "repo", "component", "module", "commit", "pull request"].map((w) => new RegExp(`\\b${w}s?\\b`, "i")),
    ...(page === 2 ? ["MVP", "beta", "leverage", "utilize", "solution", "platform", "ecosystem", "disruptive", "revolutionary", "synergy", "holistic", "TAM", "moat", "ARR", "runway"].map((w) => new RegExp(`\\b${w}\\b`, /^[A-Z]+$/.test(w) ? "" : "i")) : []),
  ];
  const hits = jargon.map((re) => text.match(re)?.[0]).filter(Boolean);
  if (hits.length) warnings.push(`Jargon to rewrite (plain-language-rules.md): ${[...new Set(hits)].join(", ")}`);

  const box = root.getBoundingClientRect();
  return { errors: [...new Set(errors)], warnings, height: Math.ceil(box.height) };
}

// With the grid overlay switched on: the overlay must draw the same 12 columns.
export function inspectOverlay({ index }) {
  const root = document.getElementById(`poster-${index}`);
  const overlay = root.querySelector("[data-grid-overlay]");
  if (!overlay) return ["Grid toggle did not draw a [data-grid-overlay] layer"];
  const grids = [overlay, ...overlay.querySelectorAll("*")].filter((el) => getComputedStyle(el).display === "grid");
  const colsOf = (g) => {
    const cs = getComputedStyle(g);
    const gap = parseFloat(cs.columnGap) || 0;
    let x = g.getBoundingClientRect().left + (parseFloat(cs.paddingLeft) || 0);
    return cs.gridTemplateColumns.split(/\s+/).map((w) => {
      const s = x;
      x += parseFloat(w) + gap;
      return s;
    });
  };
  const content = [...root.querySelectorAll("*")].find(
    (el) => !el.closest("[data-grid-overlay]") && getComputedStyle(el).display === "grid",
  );
  const want = colsOf(content);
  const g = grids.find((el) => getComputedStyle(el).gridTemplateColumns.split(/\s+/).length === 12);
  if (!g) return ["Grid overlay has no 12-column field"];
  const got = colsOf(g);
  return got.every((x, i) => Math.abs(x - want[i]) <= 1) ? [] : ["Grid overlay columns do not match the content columns — overlay must share the content box"];
}

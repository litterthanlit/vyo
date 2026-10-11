// Runs inside the page (via page.evaluate). Must stay self-contained: no
// imports, no closures over module scope. Each rule maps to a line in
// swiss-design-principles.md's pre-delivery checklist.
// `caps` (page 3) is CAPS from lib/wire.mjs; `expect` (page 3) is what a fresh wire says the drawing must show,
// or null when the static checks could not produce one.
export function inspectPoster({ index, page, palette, caps, expect }) {
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
  const inOverlay = (el) => !!el.closest("[aria-hidden='true'], [aria-hidden='']");
  const inFlow = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
  };

  const all = [...root.querySelectorAll("*")];
  // SVG internals (page 3 drawing) follow their own rules below, not the HTML ones.
  const content = all.filter((el) => !inOverlay(el) && !el.closest("svg"));

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
      if (el.tagName === "BUTTON") continue;
      if (own === ".") fullStops++;
      else errors.push(`Red text on ${label(el)} — the accent is reserved for the full stop and grid toggle`);
    } else if (cs.color !== C.INK && cs.color !== C.INK_SOFT) {
      errors.push(`Text colour ${cs.color} on ${label(el)} — use INK or INK_SOFT`);
    }
  }
  if (fullStops === 0) errors.push("No red full stop after the masthead");
  if (fullStops > 1) errors.push(`${fullStops} red full stops — the accent appears once`);

  const sorted = [...sizes.keys()].sort((a, b) => b - a);
  if (sorted.length > 4) errors.push(`${sorted.length} font sizes (${sorted.join(", ")}px) — four maximum: display · numeral · body · folio`);
  const display = sorted[0];
  const body = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (page !== 2) {
    if (!(display >= 104 && display <= 128 && display % 8 === 0)) {
      errors.push(`Masthead is ${display}px — page ${page} needs 104–128px in a multiple of 8`);
    }
    if (body && display / body < 7) errors.push(`Display : body is ${(display / body).toFixed(1)}:1 — needs at least 7:1`);
  } else if (![64, 72, 80].includes(display)) {
    errors.push(`Tagline is ${display}px — page 2 needs 64, 72, or 80px`);
  }
  if (sorted.at(-1) < 10) errors.push(`${sorted.at(-1)}px text — 10px is the floor`);

  for (const el of content) {
    const cs = getComputedStyle(el);
    if (cs.backgroundColor !== TRANSPARENT && cs.backgroundColor !== C.PAPER && cs.backgroundColor !== C.INK) {
      errors.push(`Background ${cs.backgroundColor} on ${label(el)} — paper and ink only`);
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

  // ── Transit line: every segment must end inside a station dot ───────────
  const abs = content.filter((el) => getComputedStyle(el).position === "absolute");
  const rect = (el) => el.getBoundingClientRect();
  const dots = abs.filter((el) => {
    const r = rect(el);
    return near(r.width, r.height) && r.width >= 8 && r.width <= 16 && px(getComputedStyle(el).borderTopLeftRadius) >= r.width / 2 - 1;
  });
  const inDot = (x, y) => dots.some((d) => {
    const r = rect(d);
    return x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1;
  });
  let segment = 0;
  for (const el of abs) {
    if (getComputedStyle(el).backgroundColor !== C.INK || dots.includes(el)) continue;
    const r = rect(el);
    const cy = (r.top + r.bottom) / 2;
    const cx = (r.left + r.right) / 2;
    if (r.height <= 3 && r.width > 16) {
      segment++;
      if (!(inDot(r.left, cy) && inDot(r.right, cy))) {
        errors.push(`Transit line segment ${segment} does not join two stations — run it across the gutter to the next dot's centre`);
      }
    }
    if (r.width <= 3 && r.height > 16 && !(inDot(cx, r.top) && inDot(cx, r.bottom))) {
      errors.push(`A branch stroke does not join its ring to the line`);
    }
  }

  // ── Page 3 drawing: the DOM contract of tools/CONTRACTS.md §5 ────────────
  // Nested so page.evaluate(inspectPoster) carries it along.
  function inspectDrawing(root, C, { cols, caps, expect }) {
    const errors = [];
    const warnings = [];
    const done = () => ({ errors, warnings });
    const fig = root.querySelector("figure");
    const svg = fig?.querySelector("svg");
    if (!fig || !svg) {
      errors.push("No drawing — page 3 needs one <figure> holding the SVG");
      return done();
    }
    if (!fig.hasAttribute("data-facts-hash") || !fig.hasAttribute("data-parts-hash")) {
      errors.push("The <figure> has no data-facts-hash / data-parts-hash — the drawing must carry the hashes of the WIRING it was built from");
    }

    // ── Parts: 2 to 9, at most 4 to a tier, one top face each, one drawn unit per counted item ──
    const parts = [...svg.querySelectorAll("g[data-part]")].map((el) => ({
      el,
      i: Number(el.dataset.part),
      role: el.dataset.role,
      count: Number(el.dataset.count),
      drawn: Number(el.dataset.drawn),
    }));
    const n = parts.length;
    if (n < 2 || n > 9) errors.push(`${n} parts drawn — use 2 to 9`);
    const ids = parts.map((p) => p.i).sort((a, b) => a - b);
    if (ids.some((v, k) => v !== k)) errors.push("The parts are not numbered 0 to n−1 in data-part");

    const TIER = { screens: 0, api: 0, feature: 1, ai: 2, jobs: 2, data: 3, service: 3 };
    const tiers = [[], [], [], []];
    for (const p of parts) {
      if (!(p.role in TIER)) errors.push(`Part ${p.i + 1} has role "${p.role}" — screens, api, feature, ai, jobs, data or service`);
      else tiers[TIER[p.role]].push(p.i);
    }
    if (tiers[1].length + tiers[2].length <= 4) tiers.splice(1, 2, [...tiers[1], ...tiers[2]], []); // the T2 → T1 merge rule
    for (const t of tiers) if (t.length > 4) errors.push(`${t.length} parts in one tier — merge parts (4 per tier at most)`);

    for (const p of parts) {
      const k = p.i + 1;
      const faces = p.el.querySelectorAll('[data-face="top"]').length;
      if (faces !== 1) errors.push(`Part ${k} has ${faces} top faces — exactly one [data-face="top"] path`);
      const items = p.el.querySelectorAll("[data-item]").length;
      const cap = caps[p.role];
      const want = Math.min(p.count, cap);
      if (cap === undefined || !Number.isInteger(p.count) || !Number.isInteger(p.drawn)) {
        errors.push(`Part ${k} has no usable data-count / data-drawn`);
      } else if (items !== p.drawn || p.drawn !== want) {
        errors.push(`Part ${k} draws ${items} items but counts ${p.count} — one [data-item] per counted item, ${want} of them (the cap for ${p.role} is ${cap})`);
      }
    }

    // ── Every stroke and fill comes from the palette (light theme, the default and the export) ──
    const allowed = new Set([C.PAPER, C.INK, C.INK_SOFT, C.HAIRLINE, C.TINT, "none"]);
    const bad = new Set();
    for (const el of svg.querySelectorAll("path, line, polyline, polygon, circle, ellipse, rect")) {
      const cs = getComputedStyle(el);
      if (!allowed.has(cs.stroke)) bad.add(`Stroke colour ${cs.stroke}`);
      if (el.tagName !== "line" && !allowed.has(cs.fill)) bad.add(`Fill colour ${cs.fill}`); // a line paints no fill
    }
    for (const b of bad) errors.push(`${b} in the drawing — paper, ink, ink-soft, hairline, or the selected-part tint only`);

    // ── Figure height: fixed, and short enough that the whole poster stays on one screen ──
    const vbh = svg.viewBox.baseVal.height;
    const figH = fig.getBoundingClientRect().height;
    if (Math.max(vbh, figH) > 704.5) {
      errors.push(`Drawing is ${Math.ceil(Math.max(vbh, figH))}px tall — 704 at most; fit fewer or smaller parts`);
    }

    // ── Labels: one per part, two lines tall, never overlapping, inside their gutter ──
    const labels = [...root.querySelectorAll("[data-label]")].map((el) => ({ el, i: Number(el.dataset.label), r: el.getBoundingClientRect() }));
    if (labels.length !== n) errors.push(`${labels.length} labels for ${n} parts — every part has one [data-label]`);
    for (let a = 0; a < labels.length; a++) {
      for (let b = a + 1; b < labels.length; b++) {
        const [p, q] = [labels[a].r, labels[b].r];
        if (p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1) {
          errors.push(`Part labels overlap (${labels[a].i + 1} and ${labels[b].i + 1}) — keep them LABEL_STEP apart`);
        }
      }
    }
    // The extent of the text itself: a nowrap label can run past its own box.
    const textExtent = (el) => {
      let left = Infinity;
      let right = -Infinity;
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        if (!t.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(t);
        for (const r of range.getClientRects()) {
          left = Math.min(left, r.left);
          right = Math.max(right, r.right);
        }
      }
      return { left, right };
    };
    const gutter = { left: [cols[0][0], cols[1][1]], right: [cols[10][0], cols[11][1]] };
    for (const { el, i, r } of labels) {
      if (r.height > 40) errors.push(`Label ${i + 1} wraps (${Math.round(r.height)}px tall) — a label is exactly two lines, never wrapped; shorten the name`);
      const g = gutter[el.dataset.side];
      if (!g) {
        errors.push(`Label ${i + 1} has no data-side of "left" or "right"`);
        continue;
      }
      const t = textExtent(el);
      const over = Math.max(g[0] - Math.min(r.left, t.left), Math.max(r.right, t.right) - g[1]);
      // Up to 12px is tolerated. A name the contract allows (18 characters) can run 30–40px past the starter's
      // gutter, so a moderate overrun is a warning; past 48px the text reaches the drawing or the page edge.
      if (over > 48) errors.push(`Label ${i + 1} leaves its gutter by ${Math.round(over)}px — labels live in cols 1–2 or 11–12; shorten the name`);
      else if (over > 12) warnings.push(`Label ${i + 1} runs ${Math.round(over)}px past its gutter (cols 1–2 or 11–12 hold about 16 characters) — shorten the name`);
    }

    // ── Leaders: start on their part's top face, end at the near edge of their label ──
    const leaders = [...svg.querySelectorAll("polyline[data-leader]")];
    if (leaders.length !== n) errors.push(`${leaders.length} leader lines for ${n} parts — every part has one polyline[data-leader]`);
    const partBox = parts.map((p) => ({ i: p.i, r: p.el.getBoundingClientRect() }));
    const screenPoints = (poly) => {
      const m = poly.getScreenCTM();
      return [...poly.points].map((q) => new DOMPoint(q.x, q.y).matrixTransform(m));
    };
    const onFace = (face, pt) => {
      const inv = face.getScreenCTM().inverse();
      // The point itself, then 2px round it: an anchor on the outline still counts.
      return [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dy]) => {
        const local = new DOMPoint(pt.x + dx, pt.y + dy).matrixTransform(inv);
        return face.isPointInFill(local) || face.isPointInStroke(local);
      });
    };
    for (const el of leaders) {
      const i = Number(el.dataset.leader);
      const k = i + 1;
      const pts = screenPoints(el);
      const face = svg.querySelector(`g[data-part="${i}"] [data-face="top"]`);
      const lab = root.querySelector(`[data-label="${i}"]`);
      const lr = lab?.getBoundingClientRect();
      const [a, z] = [pts[0], pts.at(-1)];
      if (!face || !a || !onFace(face, a)) errors.push(`Leader line ${k} does not start on its part`);
      if (el.dataset.side !== lab?.dataset.side) errors.push(`Leader line ${k} and its label are on different sides`);
      const edge = el.dataset.side === "left" ? lr?.right : lr?.left;
      const reach = el.dataset.side === "left" ? z?.x - edge : edge - z?.x; // how far short of the label's near edge
      if (!lr || !z || !(reach >= -2 && reach <= 24 && z.y >= lr.top - 2 && z.y <= lr.bottom + 2)) {
        errors.push(`Leader line ${k} does not end at its label`);
      }
      // A leader may not run through another part (a warning: the starter routes round them when it can).
      const crossed = partBox.filter(({ i: j, r }) => j !== i && pts.slice(1).some((q, s) => {
        const [x1, y1, x2, y2] = [pts[s].x, pts[s].y, q.x, q.y];
        return Math.max(x1, x2) > r.left + 2 && Math.min(x1, x2) < r.right - 2 && Math.max(y1, y2) > r.top + 2 && Math.min(y1, y2) < r.bottom - 2;
      }));
      if (crossed.length) warnings.push(`Leader line ${k} runs across part ${crossed.map((c) => c.i + 1).join(", ")} — move its label or merge parts`);
    }

    // ── Cables: one path[data-link] per link, between two drawn parts ──
    const cables = [...svg.querySelectorAll("path[data-link]")].map((el) => ({
      k: Number(el.dataset.link),
      a: Number(el.dataset.fromPart),
      b: Number(el.dataset.toPart),
      w: Number(el.dataset.weight),
    }));
    const show = (v) => (Number.isNaN(v) ? "none" : v);
    for (const c of cables) {
      if (!(Number.isInteger(c.a) && Number.isInteger(c.b) && c.a !== c.b && c.a >= 0 && c.b >= 0 && c.a < n && c.b < n)) {
        errors.push(`Link ${c.k + 1} has bad ends (${show(c.a)} → ${show(c.b)}) — data-from-part and data-to-part must name two different drawn parts`);
      }
    }

    // ── The drawing shows what a fresh wire says, not something else ──
    if (expect) {
      if (fig.dataset.factsHash !== expect.facts || fig.dataset.partsHash !== expect.parts) {
        errors.push("The drawing's hashes differ from the facts and PARTS — it was not built from this WIRING");
      }
      for (const p of parts) {
        const want = expect.n[p.i];
        if (!want) continue;
        if (p.role !== expect.roles[p.i]) errors.push(`Part ${p.i + 1} is drawn as ${p.role} but PARTS says ${expect.roles[p.i]}`);
        if (p.count !== want.count) errors.push(`Part ${p.i + 1} shows a count of ${p.count} but the wiring counts ${want.count}`);
      }
      const key = (l) => l.join(",");
      const drawn = cables.map((c) => key([c.a, c.b, c.w])).sort();
      const wired = expect.links.map(key).sort();
      if (drawn.length !== wired.length || drawn.some((v, k) => v !== wired[k])) {
        errors.push(`The drawing has ${cables.length} cables but the wiring has ${expect.links.length} links — every link is one path[data-link], and nothing else is drawn`);
      }
    }
    return done();
  }
  if (page === 3) {
    const r = inspectDrawing(root, C, { cols, caps, expect });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }

  // ── Copy: no file paths; flag jargon for a rewrite ──────────────────────
  const svgText = [...root.querySelectorAll("svg title, svg desc, svg text")].map((t) => t.textContent).join("\n");
  const text = `${root.innerText}\n${svgText}`;
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
  const overlay = root.querySelector("[aria-hidden='true'], [aria-hidden='']");
  if (!overlay) return ["Grid toggle did not draw an aria-hidden overlay"];
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
    (el) => !el.closest("[aria-hidden]") && getComputedStyle(el).display === "grid",
  );
  const want = colsOf(content);
  const g = grids.find((el) => getComputedStyle(el).gridTemplateColumns.split(/\s+/).length === 12);
  if (!g) return ["Grid overlay has no 12-column field"];
  const got = colsOf(g);
  return got.every((x, i) => Math.abs(x - want[i]) <= 1) ? [] : ["Grid overlay columns do not match the content columns — overlay must share the content box"];
}

// Runs inside the page (via page.evaluate). Must stay self-contained: no
// imports, no closures over module scope. Each rule maps to a line in
// swiss-design-principles.md's pre-delivery checklist.
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
  const inOverlay = (el) => !!el.closest("[aria-hidden='true'], [aria-hidden='']");
  const inFlow = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
  };

  const all = [...root.querySelectorAll("*")];
  const content = all.filter((el) => !inOverlay(el));

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
  if (page === 1) {
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

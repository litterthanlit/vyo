# Exploded View Canvas Starter (Page 3)

Structural reference for `<repo>-exploded-view.canvas.tsx`. Read [exploded-view-layout.md](exploded-view-layout.md), the page 3 exception in [swiss-design-principles.md](swiss-design-principles.md#page-3-drawing-exception) and [tools/CONTRACTS.md](tools/CONTRACTS.md) (sections 3 to 6) first.

Copy grid helpers (`GridOverlay`, constants, `folio`/`meta`/`body`/`sectionLabel`/`subgrid` styles) from [poster-starter.md](poster-starter.md) — same visual system, do not invent a new one.

**The drawing shows this repo's real parts and real wiring.** The starter draws `PARTS` (what you write) and `WIRING` (what `node tools/scan.mjs wire <facts.json> --into <this file>` writes: counts, sizes and links computed from the code). You only edit `PARTS` and the `product` / `purpose` / `notBuilt` / `audience` copy. Every coordinate is derived. Do not hand-place anything in the SVG and do not edit the `WIRING` block.

Key craft moves this starter encodes — do not regress them:

- **Shape comes from the role.** Screens are portrait cards fanned in a tray; the API role is a patch panel with a socket per kind of request; a feature is a block (its footprint and height grow with its share of the code) with chips on top; AI is a hexagonal prism ringed by one satellite per tool; jobs are meshed gears; data is a stack of disks; outside services are a plug with prongs. One drawn unit per counted item, carrying `data-item`; when there are more items than the cap, the last unit is a **bundle** (a stack or a hatched unit) that reads as "more"
- **Cables are real paths.** Each link from `WIRING` is a screen-space curve from the lower part's top face into the upper part's underside, ports spread and ordered by the far end's x, one to three strands by weight. Same-tier links are arches behind the parts. The selected part's cables turn ink
- **2 to 9 parts in four tiers:** top = screens and API; features; AI and jobs; data and outside services. Empty tiers drop out, AI and jobs merge up into the feature tier when that tier stays at four or fewer, and a tier of more than four **throws**. Order inside a tier is four barycenter sweeps on the link weights, then a column assignment that keeps linked parts in line
- One 12-column `figure`; the SVG viewBox is **900 units wide = 1px per unit at full width**. The drawing lives in cols 3–10 (592 units), the labels in the two gutters (cols 1–2 and 11–12). Labels are HTML, **never wrap**, and are joined to their part by an elbow leader that starts on the part's top face
- The gap between tiers is driven by the slider (8 at 0, the part's own diagonal at 100). The drawing is fitted once at 100 so the figure never changes height; a fit below 0.6 **throws**
- Paint order, bottom tier first: arches, parts, the cables that leave this tier upward (skip-tier cables included, so they pass behind the middle parts), then every leader on top
- Selected part: opaque **accent tint** fill + ink outline at 1.25 + ink cables + ink label. Colour is never the only cue
- Interaction: slider opens the tiers; pointer or click selects a part; **↑/↓/Home/End** in the part list moves the selection; the caption under the drawing (`aria-live`) reads the selected part's line, what it is made of and what it is connected to
- A scoped `<style>` (`xv-` classes) draws the hairline slider, focus rings and the reduced-motion switch — the only CSS that isn't inline
- Light paper by default; the **theme** button flips to a dark blueprint (dot field, dot-screen side faces). Exports always use the light default
- `PARTS` must be valid JSON between its markers (the wire tool parses it). Changing a part's `role` or `from` changes its hash and the canvas **throws** until you re-run `wire`; names and lines can change freely

```tsx
import { useCanvasState } from "cursor/canvas";

// Same PAPER, INK, INK_SOFT, ACCENT, GRID_*, HAIRLINE, COLS, BL, LH, GUTTER,
// MARGIN, MAXW, FONT, folio, meta, body, sectionLabel, subgrid, GridOverlay
// as poster-starter.md.

// ACCENT at 12% on PAPER, pre-mixed so the selected part stays opaque.
const TINT = "#FCE1E6";

type Role = "screens" | "api" | "feature" | "ai" | "jobs" | "data" | "service";
type PartSpec = { name: string; role: Role; line: string; from: string[] };
type PartWiring = { count: number; drawn: number; items: number[]; size: number; loc: number; names: string[]; tools?: number };
type Wiring = { facts: string; parts: string; n: PartWiring[]; links: [number, number, number][] };
type Pt = [number, number];
type Pen = { line: string; detail: string; face: string; w: number; screen: boolean };
type Scene = { x0: number; y0: number; x1: number; y1: number };
type Built = { node: JSX.Element; hb: number; H: number; top: Pt[] };

// ── Copy ── the words around the drawing. Plain language, no file paths.
const product = "Pantry";
const purpose = "Pantry, taken apart: the parts that save your recipes, plan your week and suggest what to cook.";
const notBuilt = "Not built yet: shopping lists, sharing a plan";
const audience = "For a cook who wants to see how it fits together";

// PARTS:BEGIN — you write this (valid JSON). Then run: node tools/scan.mjs wire <facts.json> --into <this file>
const PARTS: PartSpec[] = [
  {"name": "What you see", "role": "screens", "line": "When you open Pantry, you move between six screens.", "from": ["screen:**"]},
  {"name": "Recipe box", "role": "feature", "line": "When you save a recipe, Pantry keeps it in your box and finds it again by name.", "from": ["area:lib/recipes", "area:components/recipes"]},
  {"name": "Meal planner", "role": "feature", "line": "When you plan your week, Pantry lays out each day's meals for you.", "from": ["area:lib/plan", "area:components/plan"]},
  {"name": "Recipe ideas", "role": "ai", "line": "When you ask for ideas, Pantry suggests dishes from what you already have.", "from": ["ai:*", "area:lib/ai"]},
  {"name": "Weekly email", "role": "jobs", "line": "Every week, Pantry sends your meal plan to your inbox without being asked.", "from": ["job:**"]},
  {"name": "Saved recipes", "role": "data", "line": "When you save, your recipes and plans are kept here and are waiting next time.", "from": ["table:*"]},
  {"name": "Outside services", "role": "service", "line": "When you pay, sign in or get an email, Pantry hands the job to a service it trusts.", "from": ["service:*"]}
];
// PARTS:END
// WIRING:BEGIN — generated by `node tools/scan.mjs wire`; do not edit
const WIRING: Wiring = {"facts":"000000000000","parts":"0650545e","n":[{"count":6,"drawn":6,"items":[1,1,1,1,1,1],"size":0.14,"loc":420,"names":["Home","Recipes","Recipe detail","New recipe","Plan","Settings"]},{"count":2,"drawn":2,"items":[0.62,0.38],"size":0.22,"loc":660,"names":["Recipes"]},{"count":2,"drawn":2,"items":[0.55,0.45],"size":0.12,"loc":360,"names":["Plan"]},{"count":1,"drawn":1,"items":[1],"size":0.08,"loc":240,"names":["OpenAI"],"tools":2},{"count":1,"drawn":1,"items":[1],"size":0.03,"loc":90,"names":["Weekly plan"]},{"count":4,"drawn":4,"items":[1,1,1,1],"size":0.06,"loc":180,"names":["User","Recipe","Ingredient","Meal plan"]},{"count":3,"drawn":3,"items":[1,1,1],"size":0.09,"loc":270,"names":["Payments","Email","Sign-in"]}],"links":[[0,1,5],[0,2,4],[0,3,2],[0,6,3],[1,5,6],[2,4,3],[2,5,4],[3,5,2],[4,5,3],[4,6,2]]};
// WIRING:END

// The canvas carries its own copy of the wire tool's hash (tools/lib/hash.mjs): keep the two identical.
const fnv1a = (str: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

// ── Isometric geometry ── 1 viewBox unit = 1px when the poster is full width.
const C30 = Math.cos(Math.PI / 6);
const iso = (x: number, y: number, z: number): Pt => [(x - y) * C30, (x + y) / 2 - z];
const path = (pts: Pt[], close = true) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") + (close ? "Z" : "");
// A circle lying flat at height z, as the ellipse it projects to.
const disc = (cx: number, cy: number, z: number, r: number) => {
  const [x, y] = iso(cx, cy, z);
  return { cx: x, cy: y, rx: Math.SQRT2 * C30 * r, ry: r / Math.SQRT2 };
};
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const flat = (poly: Pt[], z: number, close = true) => path(poly.map(([x, y]) => iso(x, y, z)), close);
const turn = (x: number, y: number, a: number): Pt => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const ring = (r: number, n: number, a0 = 0): Pt[] =>
  Array.from({ length: n }, (_, k): Pt => [r * Math.cos(a0 + (2 * Math.PI * k) / n), r * Math.sin(a0 + (2 * Math.PI * k) / n)]);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Page geometry: the drawing sits in cols 3–10, the labels in the gutters either side.
const COLW = (MAXW - (COLS - 1) * GUTTER) / COLS;
const DRAW_X = 2 * (COLW + GUTTER); // the col 3 line
const DRAW_W = 8 * COLW + 7 * GUTTER; // cols 3–10 = 592
const DRAW_C = DRAW_X + DRAW_W / 2;
const GUT_W = 2 * COLW + GUTTER; // a label gutter: cols 1–2, or 11–12
const GUT_R = MAXW - GUT_W; // the col 11 line
const FIT_H = 592; // tallest drawing at full open; with the chrome this keeps the poster under 1300px (VBH ≤ 656)
const LABEL_STEP = 40; // a label is 32px tall; keep 8 between them
const PAD = 32;
const TIER: Record<Role, number> = { screens: 0, api: 0, feature: 1, ai: 2, jobs: 2, data: 3, service: 3 };

// Rounded rectangle of half-sizes (sx, sy) in plan, 7 points per corner.
// Index 3 is the right corner on screen, 10 the front, 17 the left.
function loop(sx: number, r: number, sy = sx): Pt[] {
  const centres: Pt[] = [[sx - r, -(sy - r)], [sx - r, sy - r], [-(sx - r), sy - r], [-(sx - r), -(sy - r)]];
  return centres.flatMap(([cx, cy], k) =>
    Array.from({ length: 7 }, (_, j): Pt => {
      const a = (((k - 1) * 90 + j * 15) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }),
  );
}

const outline = (pen: Pen) => ({
  stroke: pen.line, strokeWidth: pen.w, strokeLinejoin: "round" as const, vectorEffect: "non-scaling-stroke" as const,
});
const fine = (pen: Pen) => ({
  fill: "none", stroke: pen.detail, strokeWidth: 0.75, strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const, vectorEffect: "non-scaling-stroke" as const,
});

const newScene = (): Scene => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
const grow = (sc: Scene, pts: Pt[]) => {
  for (const [x, y] of pts) {
    sc.x0 = Math.min(sc.x0, x);
    sc.x1 = Math.max(sc.x1, x);
    sc.y0 = Math.min(sc.y0, y);
    sc.y1 = Math.max(sc.y1, y);
  }
};

// Extrudes a plan outline (points in increasing angle) into a body: the side faces the viewer sees, then the top.
// `runs` names the faces by vertex range; `facets` makes one face per edge; otherwise the visible edges are one smooth face.
type Solid = { poly: Pt[]; z: number; h: number; runs?: [number, number][]; facets?: boolean; main?: boolean };
function solid(sc: Scene, s: Solid, pen: Pen): JSX.Element {
  const { poly, z, h } = s;
  const n = poly.length;
  const top = poly.map(([x, y]) => iso(x, y, z + h));
  const low = poly.map(([x, y]) => iso(x, y, z));
  const dir = (i: number): Pt => [poly[(i + 1) % n][0] - poly[i % n][0], poly[(i + 1) % n][1] - poly[i % n][1]];
  const seen = (i: number) => dir(i)[1] - dir(i)[0] > 1e-9;
  const depth = (i: number) => poly[i % n][0] + poly[i % n][1] + poly[(i + 1) % n][0] + poly[(i + 1) % n][1];
  let runs: [number, number][] = s.runs ?? [];
  if (!s.runs && s.facets) {
    runs = poly.flatMap((_, i) => (seen(i) ? [[i, i + 1] as [number, number]] : [])).sort((p, q) => depth(p[0]) - depth(q[0]));
  } else if (!s.runs) {
    const start = poly.findIndex((_, i) => seen(i) && !seen(i + n - 1));
    let len = 0;
    while (start >= 0 && seen(start + len)) len++;
    if (start >= 0) runs = [[start, start + len]];
  }
  const face = (a: number, b: number) => {
    const ii = Array.from({ length: b - a + 1 }, (_, k) => (a + k) % n);
    return path([...ii.map((i) => top[i]), ...ii.map((i) => low[i]).reverse()]);
  };
  // Dark theme: the faces turned away from the light (facing left on screen) get a dot screen.
  const shaded: [number, number][] = [];
  for (const [a, b] of runs) {
    let from = -1;
    for (let e = a; e <= b; e++) {
      const left = e < b && dir(e)[0] + dir(e)[1] < 0;
      if (left && from < 0) from = e;
      if (!left && from >= 0) {
        shaded.push([from, e]);
        from = -1;
      }
    }
  }
  grow(sc, top);
  for (const [a, b] of runs) for (let i = a; i <= b; i++) grow(sc, [low[i % n]]);
  return (
    <g>
      {runs.map(([a, b], k) => <path key={k} d={face(a, b)} fill={pen.face} {...outline(pen)} />)}
      {pen.screen ? shaded.map(([a, b], k) => <path key={`s${k}`} d={face(a, b)} fill="url(#xv-screen)" />) : null}
      <path data-face={s.main ? "top" : undefined} d={path(top)} fill={pen.face} {...outline(pen)} />
    </g>
  );
}

const slab = (sc: Scene, s: number, h: number, pen: Pen, o: { r?: number; at?: Pt; z?: number; main?: boolean; sy?: number } = {}) =>
  solid(sc, {
    poly: loop(s, o.r ?? 6, o.sy).map(([x, y]): Pt => [x + (o.at?.[0] ?? 0), y + (o.at?.[1] ?? 0)]),
    z: o.z ?? 0, h, runs: [[3, 10], [10, 17]], main: o.main,
  }, pen);
const topOf = (poly: Pt[], z: number) => poly.map(([x, y]) => iso(x, y, z));

// ── The seven shapes ── part-local coordinates: origin = footprint centre on the base plane, f = half-size in plan.
// Each returns the drawing, the height of its top face (hb), the height of everything (H) and the top face outline.

// Portrait cards fanned in a shallow tray. A bundle is a stack of cards.
function screens(sc: Scene, w: PartWiring, f: number, pen: Pen): Built {
  const hb = 7;
  const n = w.drawn;
  const ch = Math.min(1.25 * f, 56);
  const cw = ch / 1.5;
  const t = 3;
  const mid = (n - 1) / 2;
  const pitch = n > 1 ? Math.min(0.6 * cw, (1.3 * f) / (n - 1)) : 0;
  const turnBy = n > 1 ? Math.min(10, 44 / (n - 1)) : 0;
  const card = (cx: number, cy: number, psi: number, key: string, detail: boolean) => {
    const poly = rect(-t / 2, -cw / 2, t / 2, cw / 2).map(([x, y]): Pt => {
      const [rx, ry] = turn(x, y, psi);
      return [rx + cx, ry + cy];
    });
    const fp = (u: number, v: number): Pt => {
      const [rx, ry] = turn(t / 2, (u - 0.5) * cw, psi);
      return iso(rx + cx, ry + cy, hb + v * ch);
    };
    return (
      <g key={key}>
        {solid(sc, { poly, z: hb, h: ch, facets: true }, pen)}
        {detail ? (
          <>
            <path d={path([fp(0.14, 0.09), fp(0.86, 0.09), fp(0.86, 0.91), fp(0.14, 0.91)])} {...fine(pen)} />
            <path d={path([fp(0.34, 0.82), fp(0.66, 0.82)], false)} {...fine(pen)} />
          </>
        ) : null}
      </g>
    );
  };
  const node = (
    <g>
      {slab(sc, f, hb, pen, { r: 8, main: true })}
      {Array.from({ length: n }, (_, k) => {
        const u = (k - mid) * pitch;
        const psi = Math.PI / 4 - ((k - mid) * turnBy * Math.PI) / 180;
        const cx = u / Math.SQRT2;
        const cy = -u / Math.SQRT2;
        const bundle = w.count > w.drawn && k === n - 1;
        const [nx, ny] = [Math.cos(psi), Math.sin(psi)];
        return (
          <g key={k} data-item={k}>
            {bundle ? [2, 1].map((j) => card(cx - nx * 3.4 * j, cy - ny * 3.4 * j, psi, `b${j}`, false)) : null}
            {card(cx, cy, psi, "c", true)}
          </g>
        );
      })}
    </g>
  );
  return { node, hb, H: hb + ch, top: topOf(loop(f, 8), hb) };
}

// A low patch panel: sockets in rows of four, one per kind of request. A bundle socket is hatched.
function api(sc: Scene, w: PartWiring, f: number, pen: Pen): Built {
  const hb = 12;
  const n = w.drawn;
  const rows = Math.max(1, Math.ceil(n / 4));
  const cell = (1.56 * f) / 4;
  const rowPitch = Math.min(0.42 * f, (1.5 * f) / rows);
  const sw = 0.3 * cell + 0.1 * f;
  const sd = Math.min(0.16 * f, rowPitch * 0.36);
  const node = (
    <g>
      {slab(sc, f, hb, pen, { r: 6, main: true })}
      {Array.from({ length: n }, (_, k) => {
        const r = Math.floor(k / 4);
        const m = Math.min(4, n - r * 4);
        const x = (k - r * 4 - (m - 1) / 2) * cell;
        const y = (r - (rows - 1) / 2) * rowPitch;
        const bundle = w.count > w.drawn && k === n - 1;
        return (
          <g key={k} data-item={k}>
            <path d={flat(rect(x - sw, y - sd, x + sw, y + sd), hb)} {...fine(pen)} fill={pen.face} strokeWidth={1} />
            {bundle
              ? [-0.5, 0, 0.5].map((q) => <path key={q} d={flat([[x - sw * 0.8, y + q * sd], [x + sw * 0.8, y + q * sd]], hb, false)} {...fine(pen)} />)
              : <path d={flat(rect(x - sw * 0.5, y - sd * 0.38, x + sw * 0.5, y + sd * 0.38), hb)} {...fine(pen)} fill={pen.detail} />}
          </g>
        );
      })}
    </g>
  );
  return { node, hb, H: hb + 1, top: topOf(loop(f, 6), hb) };
}

// A block whose footprint and height grow with its share of the code, chips on top sized by theirs. A bundle chip is stacked.
function feature(sc: Scene, w: PartWiring, f: number, pen: Pen): Built {
  const size = clamp(w.size, 0, 1);
  const hb = 12 + 32 * Math.sqrt(size);
  const n = w.drawn;
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(n / Math.max(cols, 1)));
  const cs = (n <= 4 ? 0.54 : 0.5) * f;
  const back = (n <= 4 ? 0.14 : 0.06) * f; // chips sit toward the back, so the top face's centre line stays free for cables
  const top = Math.max(...w.items, 0.001);
  const chips = Array.from({ length: n }, (_, k) => {
    const r = Math.floor(k / cols);
    const m = Math.min(cols, n - r * cols);
    const wn = clamp((w.items[k] ?? 1) / top, 0.05, 1);
    return {
      k, x: (k - r * cols - (m - 1) / 2) * cs - back, y: (r - (rows - 1) / 2) * cs - back,
      half: cs * 0.46 * (0.55 + 0.45 * Math.sqrt(wn)), h: 3 + 5 * wn,
      bundle: w.count > w.drawn && k === n - 1,
    };
  }).sort((p, q) => p.x + p.y - (q.x + q.y));
  const H = Math.max(hb + 2, ...chips.map((c) => hb + c.h * (c.bundle ? 2 : 1)));
  const bands: number[] = [];
  for (let z = 10; z < hb - 5; z += 10) bands.push(z);
  const node = (
    <g>
      {slab(sc, f, hb, pen, { r: 6, main: true })}
      {bands.map((z) => <path key={z} d={path(loop(f, 6).slice(3, 18).map(([x, y]) => iso(x, y, z)), false)} {...fine(pen)} />)}
      {chips.map(({ k, x, y, half, h, bundle }) => (
        <g key={k} data-item={k}>
          {slab(sc, half, h, pen, { r: 2, at: [x, y], z: hb })}
          {bundle ? slab(sc, half * 0.62, h, pen, { r: 1.5, at: [x, y], z: hb + h }) : <ellipse {...disc(x - half * 0.45, y - half * 0.45, hb + h, 1.1)} fill={pen.detail} />}
        </g>
      ))}
    </g>
  );
  return { node, hb, H, top: topOf(loop(f, 6), hb) };
}

// A hexagonal prism ringed by one satellite per tool. One mark on a facet per provider; a bundle mark is three dots.
function ai(sc: Scene, w: PartWiring, f: number, pen: Pen): Built {
  const R = 0.62 * f;
  const hb = 30 + 0.14 * f;
  const poly = ring(R, 6, Math.PI / 12);
  const n = w.drawn;
  const tools = clamp(w.tools ?? 0, 0, 6);
  const orbit = 0.95 * f;
  const rs = Math.min(5, 0.13 * f);
  const sats = Array.from({ length: tools }, (_, j) => {
    const a = -Math.PI / 2 + (2 * Math.PI * (j + 0.5)) / tools + Math.PI / 6;
    return { j, x: orbit * Math.cos(a), y: orbit * Math.sin(a) };
  });
  const sphere = (x: number, y: number) => {
    const [cx, cy] = iso(x, y, rs);
    grow(sc, [[cx - rs, cy - rs], [cx + rs, cy + rs]]);
    return <circle key={`${x}${y}`} cx={cx} cy={cy} r={rs} fill={pen.face} {...outline(pen)} />;
  };
  // Facets the viewer sees, left to right, each with its centre and along-facet direction.
  const facets = poly
    .map(([x, y], i) => {
      const [x1, y1] = poly[(i + 1) % poly.length];
      return { x: (x + x1) / 2, y: (y + y1) / 2, ex: x1 - x, ey: y1 - y, len: Math.hypot(x1 - x, y1 - y), seen: y1 - y - (x1 - x) > 0 };
    })
    .filter((e) => e.seen)
    .sort((p, q) => iso(p.x, p.y, 0)[0] - iso(q.x, q.y, 0)[0]);
  const rm = Math.min(4.2, facets[0].len * 0.17);
  const mark = (k: number) => {
    const fc = facets[k % facets.length];
    const zc = hb * (k < facets.length ? 0.56 : 0.26);
    const at = (u: number, v: number): Pt => iso(fc.x + (fc.ex / fc.len) * u, fc.y + (fc.ey / fc.len) * u, zc + v);
    const bundle = w.count > w.drawn && k === n - 1;
    const [cx, cy] = at(0, 0);
    return (
      <g key={k} data-item={k}>
        {bundle ? (
          [-1, 0, 1].map((q) => {
            const [dx, dy] = at(q * rm * 0.95, 0);
            return <circle key={q} cx={dx} cy={dy} r={1.3} fill={pen.detail} />;
          })
        ) : (
          <>
            <path d={path(Array.from({ length: 20 }, (_, i) => at(rm * Math.cos((i * Math.PI) / 10), rm * Math.sin((i * Math.PI) / 10))))} {...fine(pen)} />
            <circle cx={cx} cy={cy} r={1.2} fill={pen.detail} />
          </>
        )}
      </g>
    );
  };
  const behind = sats.filter((s) => s.x + s.y < 0);
  const front = sats.filter((s) => s.x + s.y >= 0);
  const node = (
    <g>
      {tools ? <ellipse {...disc(0, 0, 0, orbit)} {...fine(pen)} strokeDasharray="1 4" /> : null}
      {behind.map((s) => sphere(s.x, s.y))}
      {solid(sc, { poly, z: 0, h: hb, facets: true, main: true }, pen)}
      {Array.from({ length: n }, (_, k) => mark(k))}
      {front.map((s) => sphere(s.x, s.y))}
    </g>
  );
  if (tools) grow(sc, [iso(-orbit, orbit, 0), iso(orbit, -orbit, 0), iso(-orbit, -orbit, 0), iso(orbit, orbit, 0)]);
  return { node, hb, H: hb, top: topOf(poly, hb) };
}

// Meshed flat gears on a plate, one per job; a bundle is a stacked pair. The chain runs along the screen's horizontal.
function gearPoly(cx: number, cy: number, r: number, teeth: number, th: number, phase: number): Pt[] {
  const p = (2 * Math.PI) / teeth;
  const cuts: [number, number][] = [[-0.27, -th / 2], [-0.15, th / 2], [0.15, th / 2], [0.27, -th / 2], [0.5, -th / 2]];
  return Array.from({ length: teeth }, (_, k) =>
    cuts.map(([d, o]): Pt => [cx + (r + o) * Math.cos(phase + (k + d) * p), cy + (r + o) * Math.sin(phase + (k + d) * p)]),
  ).flat();
}
function jobs(sc: Scene, w: PartWiring, f: number, pen: Pen): Built {
  const hb = 5;
  const gh = 6;
  const n = w.drawn;
  const mult = [1.12, 0.9, 1, 0.92];
  const bend = n > 2 ? 0.6 : 0;
  const unit: Pt[] = [[0, 0]];
  for (let k = 1; k < n; k++) {
    const d = mult[(k - 1) % 4] + mult[k % 4];
    const ang = (k % 2 ? 1 : -1) * bend;
    unit.push([unit[k - 1][0] + d * Math.cos(ang), unit[k - 1][1] + d * Math.sin(ang)]);
  }
  // (u, v) along and across the screen horizontal → plan; centre the chain, then size it to the plate.
  const plan: Pt[] = unit.map(([u, v]): Pt => [(u + v) / Math.SQRT2, (v - u) / Math.SQRT2]);
  const lo = [0, 1].map((i) => Math.min(...plan.map((p, k) => p[i] - 1.09 * mult[k % 4])));
  const hi = [0, 1].map((i) => Math.max(...plan.map((p, k) => p[i] + 1.09 * mult[k % 4])));
  const centred = plan.map(([x, y]): Pt => [x - (lo[0] + hi[0]) / 2, y - (lo[1] + hi[1]) / 2]);
  const rb = (0.9 * f) / Math.max(...centred.map(([x, y], k) => Math.max(Math.abs(x), Math.abs(y)) + 1.09 * mult[k % 4]));
  const gears = centred.map(([x, y], k) => {
    const r = rb * mult[k % 4];
    return { x: x * rb, y: y * rb, r, teeth: clamp(Math.round((2 * Math.PI * r) / 10), 8, 20), th: Math.min(4.2, 0.2 * r) };
  });
  // Phases: each gear's gap faces the tooth of the one before it.
  const phase: number[] = [];
  gears.forEach((g, k) => {
    if (k === 0) {
      phase[0] = gears.length > 1 ? Math.atan2(gears[1].y - g.y, gears[1].x - g.x) : 0;
      return;
    }
    const p = gears[k - 1];
    const al = Math.atan2(g.y - p.y, g.x - p.x);
    const pitch = (2 * Math.PI * p.r) / p.teeth;
    const sA = p.r * (al - phase[k - 1]);
    const want = (((pitch / 2 - sA) % pitch) + pitch) % pitch;
    phase[k] = al + Math.PI - want / g.r;
  });
  const bundle = w.count > w.drawn;
  const plate = loop(f, 8);
  const node = (
    <g>
      {slab(sc, f, hb, pen, { r: 8, main: true })}
      {gears.map((g, k) => {
        const stack = bundle && k === n - 1;
        const poly = (z: number, extra: number) => solid(sc, { poly: gearPoly(g.x, g.y, g.r, g.teeth, g.th, phase[k] + extra), z, h: gh, facets: true }, pen);
        const zt = hb + gh * (stack ? 2 : 1);
        return (
          <g key={k} data-item={k}>
            {poly(hb, 0)}
            {stack ? poly(hb + gh, Math.PI / g.teeth) : null}
            <ellipse {...disc(g.x, g.y, zt, g.r * 0.42)} {...fine(pen)} />
            <ellipse {...disc(g.x, g.y, zt, 1.8)} fill={pen.detail} />
          </g>
        );
      })}
    </g>
  );
  return { node, hb, H: hb + gh * (bundle ? 2 : 1), top: topOf(plate, hb) };
}

// A stack of disks, one per kind of record. A bundle disk is hatched on its side.
function data(sc: Scene, w: PartWiring, f: number, pen: Pen): Built {
  const n = Math.max(1, w.drawn);
  const R = 1.1 * f;
  const hd = clamp(Math.round(58 / n), 5, 12);
  const gap = n > 6 ? 2 : 3;
  const poly = ring(R, 48);
  const hb = n * (hd + gap) - gap;
  const node = (
    <g>
      {Array.from({ length: n }, (_, k) => {
        const z = k * (hd + gap);
        const bundle = w.count > w.drawn && k === n - 1;
        return (
          <g key={k} data-item={k}>
            {solid(sc, { poly, z, h: hd, main: k === n - 1 }, pen)}
            {bundle
              ? Array.from({ length: 19 }, (_, q) => {
                const a = ((-44 + q * 9) * Math.PI) / 180;
                return <path key={q} d={path([iso(R * Math.cos(a), R * Math.sin(a), z + 1), iso(R * Math.cos(a), R * Math.sin(a), z + hd - 1)], false)} {...fine(pen)} />;
              })
              : null}
          </g>
        );
      })}
    </g>
  );
  return { node, hb, H: hb, top: topOf(poly, hb) };
}

// A plug: a block with prongs standing out of its right face, one per outside service. A bundle prong is a comb.
function service(sc: Scene, w: PartWiring, f: number, pen: Pen): Built {
  const bx = 0.58 * f;
  const by = 0.78 * f;
  const hb = 0.5 * f + 8;
  const n = w.drawn;
  const perRow = n <= 3 ? n : 3;
  const rows = Math.max(1, Math.ceil(n / Math.max(perRow, 1)));
  const lp = 0.3 * f;
  const pw = Math.max(3.5, 0.1 * f);
  const ph = hb * 0.26;
  const prongs = Array.from({ length: n }, (_, k) => {
    const r = Math.floor(k / perRow);
    const m = Math.min(perRow, n - r * perRow);
    return { k, y: (k - r * perRow - (m - 1) / 2) * 0.46 * f, z: hb * (rows === 1 ? 0.5 : r ? 0.28 : 0.68) - ph / 2 };
  });
  const prong = (y: number, z: number, wd: number, key: string | number) =>
    <g key={key}>{solid(sc, { poly: rect(bx, y - wd / 2, bx + lp, y + wd / 2), z, h: ph, facets: true }, pen)}</g>;
  const node = (
    <g>
      {slab(sc, bx, hb, pen, { r: 5, main: true, sy: by })}
      {solid(sc, { poly: rect(bx, -by * 0.8, bx + 2, by * 0.8), z: hb * 0.1, h: hb * 0.8, facets: true }, pen)}
      {prongs.map(({ k, y, z }) => (
        <g key={k} data-item={k}>
          {w.count > w.drawn && k === n - 1
            ? [-1, 0, 1].map((q) => prong(y + q * pw * 1.5, z, pw * 0.7, q))
            : prong(y, z, pw, "p")}
        </g>
      ))}
    </g>
  );
  return { node, hb, H: hb, top: topOf(loop(bx, 5, by), hb) };
}

// How much of its slot a part fills: footprint = a × factor. Features grow with their share of the code.
const footprint = (r: Role, w: PartWiring, a: number) => (r === "feature" ? a * (0.6 + 0.4 * Math.sqrt(clamp(w.size, 0, 1))) : a);
const SHAPE: Record<Role, (sc: Scene, w: PartWiring, f: number, pen: Pen) => Built> = {
  screens, api, feature, ai, jobs, data, service,
};

// ── Order and place ── barycenter sweeps order each tier; columns keep linked parts in line.
function arrange(roles: Role[], links: [number, number, number][]) {
  const adj: [number, number][][] = roles.map(() => []);
  for (const [p, q, w] of links) {
    adj[p].push([q, w]);
    adj[q].push([p, w]);
  }
  const g: number[][] = [[], [], [], []];
  roles.forEach((r, i) => g[TIER[r]].push(i));
  if (g[1].length + g[2].length <= 4) {
    g[1] = [...g[1], ...g[2]].sort((x, y) => x - y);
    g[2] = [];
  }
  const tiers = g.filter((t) => t.length);
  for (const t of tiers) if (t.length > 4) throw new Error(`Tier with ${t.length} parts — merge parts (4 per tier at most)`);

  const pos: number[] = [];
  const rank = (t: number[]) => t.forEach((p, k) => (pos[p] = (k + 0.5) / t.length));
  tiers.forEach(rank);
  const idx = tiers.map((_, i) => i);
  for (let sweep = 0; sweep < 4; sweep++) {
    const down = sweep % 2 === 0;
    for (const ti of down ? idx.slice(1) : idx.slice(0, -1).reverse()) {
      const near = new Set(tiers[ti + (down ? -1 : 1)]);
      const bary = (p: number) => {
        let sum = 0;
        let wt = 0;
        for (const [q, w] of adj[p]) if (near.has(q)) { sum += w * pos[q]; wt += w; }
        return wt ? sum / wt : pos[p];
      };
      tiers[ti] = [...tiers[ti]].sort((p, q) => bary(p) - bary(q) || pos[p] - pos[q]);
      rank(tiers[ti]);
    }
  }

  // Columns: the widest tier first, then each other tier takes the spacing (half columns allowed) that
  // minimises Σ weight · |Δcolumn| to the parts already placed. Ties go to the centre.
  const K = Math.max(...tiers.map((t) => t.length));
  const col: number[] = [];
  const placed = new Set<number>();
  for (const ti of [...idx].sort((x, y) => tiers[y].length - tiers[x].length || x - y)) {
    const t = tiers[ti];
    let best: number[] = [];
    let low = Infinity;
    const walk = (k: number, from: number, got: number[]) => {
      if (k === t.length) {
        let cost = 0;
        t.forEach((p, j) => {
          for (const [q, w] of adj[p]) if (placed.has(q)) cost += w * Math.abs(got[j] - col[q]);
          cost += 1e-3 * Math.abs(got[j] - (K - 1) / 2);
        });
        if (cost < low - 1e-9) {
          low = cost;
          best = got;
        }
        return;
      }
      for (let c = from; c <= K - 1 - (t.length - 1 - k) + 1e-9; c += 0.5) walk(k + 1, c + 1, [...got, c]);
    };
    walk(0, 0, []);
    t.forEach((p, j) => {
      col[p] = best[j];
      placed.add(p);
    });
  }
  return { tiers, col, K };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
// Line 2 of a label: what the count means, in plain words.
function phrase(p: PartSpec, w: PartWiring) {
  switch (p.role) {
    case "screens": return plural(w.count, "screen", "screens");
    case "api": return `Answers ${plural(w.count, "kind", "kinds")} of request`;
    case "feature": {
      const pct = Math.round(w.size * 100);
      return `${pct < 1 ? "<1" : pct}% of the code`;
    }
    case "ai": return `${plural(w.count, "AI model", "AI models")}${w.tools ? ` · ${plural(w.tools, "tool", "tools")}` : ""}`;
    case "jobs": return `Runs ${plural(w.count, "job", "jobs")} on its own`;
    case "data": return `${plural(w.count, "kind", "kinds")} of saved record`;
    default: return plural(w.count, "outside service", "outside services");
  }
}
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

const pad2 = (n: number) => String(n).padStart(2, "0");

// Pseudo-elements, focus rings and reduced motion can't be inline styles. Scoped by the xv- prefix.
const css = (t: { paper: string; ink: string; tint: string }) => `
.xv-range{-webkit-appearance:none;appearance:none;width:100%;height:${LH}px;margin:0;background:transparent;cursor:pointer}
.xv-range::-webkit-slider-runnable-track{height:1px;background:${t.ink}}
.xv-range::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-7.5px;border-radius:50%;background:${t.paper};border:1px solid ${t.ink}}
.xv-range::-moz-range-track{height:1px;background:${t.ink}}
.xv-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:${t.paper};border:1px solid ${t.ink}}
.xv-range:focus-visible{outline:none}
.xv-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px ${t.tint}}
.xv-range:focus-visible::-moz-range-thumb{box-shadow:0 0 0 4px ${t.tint}}
.xv-list:focus{outline:none}
.xv-list:focus-visible [aria-selected="true"]{outline:1px solid ${t.ink};outline-offset:4px}
.xv-ease path,.xv-ease ellipse,.xv-ease circle{transition:fill 160ms ease,stroke 160ms ease}
@media (prefers-reduced-motion:reduce){.xv-ease path,.xv-ease ellipse,.xv-ease circle{transition:none}}
`;

export default function ExplodedView() {
  const [open, setOpen] = useCanvasState("openExploded", 80);
  const [picked, setPicked] = useCanvasState("partExploded", 0);
  const [theme, setTheme] = useCanvasState("themeExploded", "light");
  const [showGrid, setShowGrid] = useCanvasState("showGridExploded", false);

  // ── Checks ── a stale WIRING or an impossible drawing throws instead of drawing something wrong.
  const nP = PARTS.length;
  if (WIRING.parts !== fnv1a(JSON.stringify(PARTS.map((p) => [p.role, p.from]))) || WIRING.n.length !== nP) {
    throw new Error("PARTS changed — re-run wire: node tools/scan.mjs wire <facts.json> --into <this file>");
  }
  if (nP < 2 || nP > 9) throw new Error(`${nP} parts — use 2 to 9`);
  for (const p of PARTS) {
    if (p.name.length > 18) throw new Error(`Part name "${p.name}" is ${p.name.length} characters — 18 at most`);
  }

  // ── Order, place, size ──
  const { tiers, col, K } = arrange(PARTS.map((p) => p.role), WIRING.links);
  const tierOf: number[] = [];
  tiers.forEach((t, ti) => t.forEach((p) => (tierOf[p] = ti)));
  const P = DRAW_W / K; // slot pitch
  const a = Math.min(64, (P - 24) / 3.46); // half-size of a full slot
  const gOpen = 2 * a + 8;
  const cxOf = col.map((c) => DRAW_X + P * (c + 0.5));

  const dark = theme === "dark";
  const T = dark
    ? { paper: INK, ink: "#F2F2F2", soft: "rgba(242, 242, 242, 0.64)", face: "#161616", tint: "#3B0A15", field: "rgba(242, 242, 242, 0.16)" }
    : { paper: PAPER, ink: INK, soft: INK_SOFT, face: PAPER, tint: TINT, field: "none" };
  const sel = clamp(picked, 0, nP - 1);
  const penFor = (i: number): Pen => (i === sel
    ? { line: T.ink, detail: T.ink, face: T.tint, w: 1.25, screen: dark }
    : { line: T.soft, detail: T.soft, face: T.face, w: 1, screen: dark });

  const built = PARTS.map((p, i) => {
    const sc = newScene();
    const b = SHAPE[p.role](sc, WIRING.n[i], footprint(p.role, WIRING.n[i], a), penFor(i));
    return { ...b, box: sc };
  });
  // The top face as the cables and leaders see it: its left, right and back corners, centre line and half width.
  const face = built.map(({ top }) => {
    const by = (k: 0 | 1, sign: number) => top.reduce((m, q) => (sign * q[k] < sign * m[k] ? q : m), top[0]);
    const L = by(0, 1);
    const R = by(0, -1);
    return { L, R, B: by(1, 1), cy: (by(1, 1)[1] + by(1, -1)[1]) / 2, hw: (R[0] - L[0]) / 2 };
  });

  // Tiers stack bottom-up: each sits on the one below by the slider's gap (8 closed, one part's diagonal open).
  const tierH = tiers.map((t) => Math.max(...t.map((p) => built[p].H)));
  const stack = (o: number) => {
    const gap = 8 + ((gOpen - 8) * o) / 100;
    const z: number[] = [];
    let acc = 0;
    for (let ti = tiers.length - 1; ti >= 0; ti--) {
      z[ti] = acc;
      acc += tierH[ti] + gap;
    }
    return z;
  };
  const rise = a + 16; // same-tier arches climb this far above the back corners
  const extent = (o: number) => {
    const z = stack(o);
    const e = newScene();
    PARTS.forEach((_, p) => {
      const b = built[p].box;
      grow(e, [[cxOf[p] + b.x0, -z[tierOf[p]] + b.y0], [cxOf[p] + b.x1, -z[tierOf[p]] + b.y1]]);
    });
    for (const [p, q] of WIRING.links) {
      if (tierOf[p] === tierOf[q]) grow(e, [[cxOf[p], -z[tierOf[p]] + face[p].B[1] - rise], [cxOf[q], -z[tierOf[q]] + face[q].B[1] - rise]]);
    }
    return e;
  };
  const full = extent(100);
  const s = Math.min(1, DRAW_W / (full.x1 - full.x0), FIT_H / (full.y1 - full.y0));
  if (s < 0.6) throw new Error(`Drawing needs ${s.toFixed(2)}× scale — merge parts (fewer tiers or fewer parts per tier)`);
  const VBH = Math.ceil(((full.y1 - full.y0) * s + 2 * PAD) / BL) * BL; // fixed, so the page never jumps
  const z = stack(open);
  const now = extent(open);
  const X = (x: number) => DRAW_C + s * (x - DRAW_C);
  const Y = (y: number) => VBH / 2 + s * (y - (now.y0 + now.y1) / 2);
  const at = (p: number, lx: number, ly: number): Pt => [X(cxOf[p] + lx), Y(-z[tierOf[p]] + ly)];

  // ── Cables ── lower part's top face → upper part's underside; same-tier links arch over the back corners.
  const far = (k: number, p: number) => (WIRING.links[k][0] === p ? WIRING.links[k][1] : WIRING.links[k][0]);
  const lows: number[][] = PARTS.map(() => []);
  const ups: number[][] = PARTS.map(() => []);
  const arches: number[][] = PARTS.map(() => []);
  WIRING.links.forEach(([p, q], k) => {
    if (tierOf[p] === tierOf[q]) {
      arches[p].push(k);
      arches[q].push(k);
    } else {
      lows[tierOf[p] > tierOf[q] ? p : q].push(k);
      ups[tierOf[p] > tierOf[q] ? q : p].push(k);
    }
  });
  const port = (p: number, list: number[], k: number) => {
    list.sort((u, v) => cxOf[far(u, p)] - cxOf[far(v, p)]);
    const m = list.length;
    return m < 2 ? 0 : (list.indexOf(k) - (m - 1) / 2) * Math.min(12, (1.1 * face[p].hw) / (m - 1));
  };
  type Wire = { k: number; arch: boolean; tier: number; hot: boolean; strands: string[]; ends: Pt[] };
  const wires: Wire[] = WIRING.links.map(([p, q, wt], k): Wire => {
    const hot = p === sel || q === sel;
    const nStrand = wt >= 16 ? 3 : wt >= 4 ? 2 : 1;
    const shift = (m: number) => (m - (nStrand - 1) / 2) * 3;
    if (tierOf[p] === tierOf[q]) {
      const [x1, y1] = at(p, port(p, arches[p], k), face[p].B[1] + 3);
      const [x2, y2] = at(q, port(q, arches[q], k), face[q].B[1] + 3);
      const lift = (rise * s) / 0.75;
      return {
        k, arch: true, tier: tierOf[p], hot, ends: [[x1, y1], [x2, y2]],
        strands: Array.from({ length: nStrand }, (_, m) => `M${x1 + shift(m)} ${y1}C${x1 + shift(m)} ${y1 - lift} ${x2 + shift(m)} ${y2 - lift} ${x2 + shift(m)} ${y2}`),
      };
    }
    const lo = tierOf[p] > tierOf[q] ? p : q;
    const up = lo === p ? q : p;
    const [x1, y1] = at(lo, port(lo, lows[lo], k), face[lo].cy);
    const [x2, y2] = at(up, port(up, ups[up], k), 0);
    const bend = 0.45 * (y1 - y2);
    return {
      k, arch: false, tier: tierOf[lo], hot, ends: [[x1, y1]],
      strands: Array.from({ length: nStrand }, (_, m) => `M${x1 + shift(m)} ${y1}C${x1 + shift(m)} ${y1 - bend} ${x2 + shift(m)} ${y2 + bend} ${x2 + shift(m)} ${y2}`),
    };
  });
  const drawWire = (w: Wire) => {
    const [p, q, wt] = WIRING.links[w.k];
    const c = w.hot ? T.ink : T.soft;
    return (
      <g key={`w${w.k}`} pointerEvents="none">
        {w.strands.map((d, m) => (
          <path
            key={m}
            d={d}
            fill="none"
            stroke={c}
            strokeWidth={w.hot ? 1.25 : 0.75}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            {...(m === 0 ? { "data-link": w.k, "data-from-part": p, "data-to-part": q, "data-weight": wt } : { "data-strand": m })}
          />
        ))}
        {w.ends.map(([x, y], m) => (
          <circle key={m} cx={x} cy={y} r={2.5} fill={T.paper} stroke={c} strokeWidth={w.hot ? 1.25 : 0.75} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    );
  };
  const cablesOf = (ti: number, arch: boolean) =>
    wires.filter((w) => w.tier === ti && w.arch === arch).sort((u, v) => Number(u.hot) - Number(v.hot)).map(drawWire);

  // ── Labels ── a part goes to the side its slot is on; a centre slot goes to the emptier side (ties right).
  const side: ("left" | "right")[] = [];
  let nl = 0;
  let nr = 0;
  PARTS.forEach((_, i) => {
    if (cxOf[i] < DRAW_C - 1) { side[i] = "left"; nl++; }
    else if (cxOf[i] > DRAW_C + 1) { side[i] = "right"; nr++; }
  });
  PARTS.forEach((_, i) => {
    if (side[i]) return;
    side[i] = nl < nr ? "left" : "right";
    if (side[i] === "left") nl++;
    else nr++;
  });
  const anchor = (i: number): Pt => {
    const { L, R, hw } = face[i];
    const [x, y] = side[i] === "left" ? L : R;
    return at(i, x + (side[i] === "left" ? 0.1 : -0.1) * 2 * hw, y);
  };
  // A leader runs straight out from the outer corner of the top face. If another part is in the way it goes up from the
  // back corner instead, over the tier, and out from there.
  const box = built.map((b, i) => ({
    x0: X(cxOf[i] + b.box.x0), x1: X(cxOf[i] + b.box.x1), y0: Y(-z[tierOf[i]] + b.box.y0), y1: Y(-z[tierOf[i]] + b.box.y1),
  }));
  const blockers = (i: number, [x1, y1]: Pt, [x2, y2]: Pt) =>
    box.filter((r, j) => j !== i && Math.max(x1, x2) > r.x0 + 2 && Math.min(x1, x2) < r.x1 - 2 && Math.max(y1, y2) > r.y0 + 2 && Math.min(y1, y2) < r.y1 - 2);
  const route = (i: number): { pts: Pt[]; hint: number } => {
    const edge = side[i] === "left" ? DRAW_X - 4 : DRAW_X + DRAW_W + 4;
    const [ax, ay] = anchor(i);
    const direct = { pts: [[ax, ay], [edge, ay]] as Pt[], hint: ay };
    const hit = blockers(i, [ax, ay], [edge, ay]);
    if (!hit.length) return direct;
    const [bx, by] = at(i, face[i].B[0], face[i].B[1] + 3);
    const yh = Math.max(12, Math.min(...hit.map((r) => r.y0)) - 8);
    const cost = blockers(i, [bx, by], [bx, yh]).length + blockers(i, [bx, yh], [edge, yh]).length + (box[i].y0 < by - 8 ? 0.5 : 0);
    return cost < hit.length ? { pts: [[bx, by], [bx, yh], [edge, yh]], hint: yh } : direct;
  };
  const routes = PARTS.map((_, i) => route(i));
  const ly: number[] = [];
  for (const sd of ["left", "right"]) {
    const ids = PARTS.map((_, i) => i).filter((i) => side[i] === sd).sort((u, v) => routes[u].hint - routes[v].hint);
    const ys: number[] = [];
    ids.forEach((i, k) => (ys[k] = Math.max(routes[i].hint, k ? ys[k - 1] + LABEL_STEP : PAD)));
    if (ids.length && ys[ids.length - 1] > VBH - PAD) {
      ys[ids.length - 1] = VBH - PAD;
      for (let k = ids.length - 2; k >= 0; k--) ys[k] = Math.min(ys[k], ys[k + 1] - LABEL_STEP);
    }
    ids.forEach((i, k) => (ly[i] = ys[k]));
  }
  const leader = (i: number) => {
    const left = side[i] === "left";
    const pts: Pt[] = [...routes[i].pts, [left ? GUT_W + 8 : GUT_R - 8, ly[i]], [left ? GUT_W + 2 : GUT_R - 2, ly[i]]];
    const c = i === sel ? T.ink : T.soft;
    return (
      <g key={i}>
        <polyline data-leader={i} data-side={side[i]} points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} fill="none" stroke={c} strokeWidth={0.75} vectorEffect="non-scaling-stroke" />
        <circle cx={pts[0][0]} cy={pts[0][1]} r={2} fill={c} />
      </g>
    );
  };

  const links = PARTS.map((_, i) => WIRING.links.filter(([p, q]) => p === i || q === i).sort((u, v) => v[2] - u[2]).map(([p, q]) => PARTS[p === i ? q : p].name));
  const cur = WIRING.n[sel];
  const head = cur.names.slice(0, cur.count <= 3 ? 3 : 2);
  const madeOf = andList([...head, ...(cur.count > 3 ? [`${cur.count - head.length} more`] : [])]);
  const chrome = { fontFamily: FONT, background: "none", border: "none", padding: 0, cursor: "pointer" };

  return (
    <div style={{ background: T.paper, minHeight: "100%", fontFamily: FONT, color: T.ink }}>
      <style>{css(T)}</style>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: MARGIN, position: "relative" }}>
        {showGrid ? <GridOverlay /> : null}

        <div style={{ ...subgrid, rowGap: LH, position: "relative", zIndex: 1 }}>
          {/* Folio + 2px rule */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={subgrid}>
              <div style={{ gridColumn: "1 / 5", ...folio, color: T.ink }}>Exploded View — 03</div>
              <div style={{ gridColumn: "5 / 10", ...meta, color: T.soft }}>The app, taken apart</div>
              <div style={{ gridColumn: "10 / 13", ...meta, color: T.soft, textAlign: "right" }}>{product}</div>
            </div>
            <div style={{ height: 2, background: T.ink, marginTop: BL - 2 }} />
          </div>

          {/* Masthead — same as page 1 */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 112, lineHeight: "112px", fontWeight: 700, letterSpacing: "-0.03em", marginLeft: "-0.05em", color: T.ink }}>
              {product}<span style={{ color: ACCENT }}>.</span>
            </div>
          </div>

          <div style={{ gridColumn: "1 / 8" }}>
            <p style={{ ...body, color: T.ink, maxWidth: "28em" }}>{purpose}</p>
          </div>

          <div style={{ gridColumn: "1 / -1", ...sectionLabel, color: T.ink, borderTopColor: T.ink, marginBottom: 0 }}>
            Taken apart — drag to open, point at a part to read it
          </div>

          {/* The drawing — the one place SVG is allowed (swiss-design-principles.md, page 3 exception) */}
          <figure data-facts-hash={WIRING.facts} data-parts-hash={WIRING.parts} style={{ gridColumn: "1 / -1", margin: 0, position: "relative" }}>
            <svg viewBox={`0 0 ${MAXW} ${VBH}`} role="img" aria-labelledby="xv-title xv-desc" style={{ display: "block", width: "100%", height: "auto" }}>
              <title id="xv-title">{`${product}, drawn as ${nP} connected parts`}</title>
              <desc id="xv-desc">
                {PARTS.map((p, i) => `${i + 1}. ${p.name}: ${phrase(p, WIRING.n[i])}${links[i].length ? `, connected to ${andList(links[i])}` : ""}`).join(". ")}
              </desc>
              {dark ? (
                <>
                  <defs>
                    <pattern id="xv-field" width={24} height={24} patternUnits="userSpaceOnUse">
                      <circle cx={12} cy={12} r={0.9} fill={T.field} />
                    </pattern>
                    <pattern id="xv-screen" width={4} height={4} patternUnits="userSpaceOnUse">
                      <circle cx={2} cy={2} r={0.7} fill={T.soft} />
                    </pattern>
                  </defs>
                  <rect width={MAXW} height={VBH} fill="url(#xv-field)" />
                </>
              ) : null}

              {/* Bottom tier first, so upper tiers overlap it and cables climbing from it pass behind everything above */}
              {[...tiers.keys()].reverse().map((ti) => (
                <g key={ti}>
                  {cablesOf(ti, true)}
                  {tiers[ti].map((i) => (
                    <g
                      key={i}
                      data-part={i}
                      data-role={PARTS[i].role}
                      data-count={WIRING.n[i].count}
                      data-drawn={WIRING.n[i].drawn}
                      transform={`translate(${X(cxOf[i]).toFixed(1)} ${Y(-z[ti]).toFixed(1)}) scale(${s.toFixed(4)})`}
                      onPointerEnter={() => setPicked(i)}
                      onClick={() => setPicked(i)}
                      className="xv-ease"
                      style={{ cursor: "pointer" }}
                    >
                      {built[i].node}
                    </g>
                  ))}
                  {cablesOf(ti, false)}
                </g>
              ))}

              {/* Leader lines: anchor on the top face → elbow in the gutter → label */}
              <g pointerEvents="none">{PARTS.map((_, i) => leader(i))}</g>
            </svg>

            {/* Labels — HTML in the two gutters, positioned in viewBox units; they never wrap */}
            <div
              className="xv-list"
              role="listbox"
              aria-label="Parts, top to bottom"
              tabIndex={0}
              aria-activedescendant={`xv-part-${sel}`}
              onKeyDown={(e) => {
                const next = ({ ArrowDown: sel + 1, ArrowUp: sel - 1, Home: 0, End: nP - 1 } as Record<string, number>)[e.key];
                if (next === undefined) return;
                e.preventDefault();
                setPicked(clamp(next, 0, nP - 1));
              }}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            >
              {PARTS.map((p, i) => (
                <div
                  key={i}
                  id={`xv-part-${i}`}
                  role="option"
                  aria-selected={i === sel}
                  data-label={i}
                  data-side={side[i]}
                  onPointerEnter={() => setPicked(i)}
                  onClick={() => setPicked(i)}
                  style={{
                    position: "absolute",
                    left: `${((side[i] === "left" ? 0 : GUT_R) / MAXW) * 100}%`,
                    width: `${(GUT_W / MAXW) * 100}%`,
                    top: `${((ly[i] - 16) / VBH) * 100}%`,
                    whiteSpace: "nowrap",
                    pointerEvents: "auto",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ ...folio, color: i === sel ? T.ink : T.soft }}>{pad2(i + 1)} — {p.name}</div>
                  <div style={{ ...meta, color: T.soft }}>{phrase(p, WIRING.n[i])}</div>
                </div>
              ))}
            </div>
          </figure>

          {/* Caption — the selected part: its line, what it is made of, what it is connected to */}
          <div aria-live="polite" style={{ gridColumn: "1 / -1" }}>
            <div style={subgrid}>
              <div style={{ gridColumn: "1 / 7" }}>
                <div style={{ ...folio, color: T.ink }}>{pad2(sel + 1)} / {pad2(nP)} — {PARTS[sel].name}</div>
                <p style={{ ...body, color: T.ink, paddingRight: GUTTER }}>{PARTS[sel].line}</p>
              </div>
              <div style={{ gridColumn: "7 / 13", paddingTop: 16 }}>
                {madeOf ? <p style={{ ...body, color: T.ink }}>Made of: {madeOf}</p> : null}
                <p style={{ ...body, color: T.ink }}>{links[sel].length ? `Connected to: ${links[sel].join(", ")}` : "Not wired to the other parts"}</p>
              </div>
            </div>
          </div>

          {/* Controls — hidden in exports */}
          <div data-chrome style={{ gridColumn: "1 / -1" }}>
            <div style={subgrid}>
              <label htmlFor="xv-open" style={{ gridColumn: "1 / 3", ...meta, lineHeight: `${LH}px`, color: T.soft }}>Open layers</label>
              <input
                id="xv-open"
                type="range"
                min={0}
                max={100}
                value={open}
                aria-valuetext={`${open}% open`}
                onChange={(e) => setOpen(Number(e.target.value))}
                className="xv-range"
                style={{ gridColumn: "3 / 10" }}
              />
              <div style={{ gridColumn: "10 / 11", ...meta, lineHeight: `${LH}px`, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{open}%</div>
              <div style={{ gridColumn: "11 / 13" }}>
                <button
                  type="button"
                  aria-label={`Theme: switch to ${dark ? "light" : "dark"}`}
                  onClick={() => setTheme(dark ? "light" : "dark")}
                  style={{ ...chrome, display: "block", marginLeft: "auto", textAlign: "right", fontSize: 10, lineHeight: `${LH}px`, color: T.ink }}
                >
                  {dark ? "Theme — dark" : "Theme — light"}
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${dark ? T.soft : HAIRLINE}`, paddingTop: BL - 1 }}>
            <div style={subgrid}>
              <div style={{ gridColumn: "1 / 6", ...meta, color: T.soft }}>{notBuilt}</div>
              <div style={{ gridColumn: "6 / 10", ...meta, color: T.soft }}>{audience}</div>
              <div style={{ gridColumn: "10 / 13" }}>
                <button
                  type="button"
                  onClick={() => setShowGrid((v) => !v)}
                  style={{ ...chrome, display: "block", marginLeft: "auto", textAlign: "right", fontSize: 10, lineHeight: "16px", color: ACCENT }}
                >
                  {showGrid ? "Hide grid" : "Show grid"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

See [exploded-view-layout.md](exploded-view-layout.md) for how to choose and word the parts.

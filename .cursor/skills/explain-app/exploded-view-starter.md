# Exploded View Canvas Starter (Page 3)

Structural reference for `<repo>-exploded-view.canvas.tsx`. Read [exploded-view-layout.md](exploded-view-layout.md) and the page 3 exception in [swiss-design-principles.md](swiss-design-principles.md#page-3-drawing-exception) first.

Copy grid helpers (`GridOverlay`, constants, `folio`/`meta`/`body`/`sectionLabel`/`subgrid` styles) from [poster-starter.md](poster-starter.md) — same visual system, do not invent a new one.

**You only edit data.** Fill in `product`, `purpose`, `layers`, `notBuilt` and `audience`. Every coordinate is derived: the isometric slabs, chip packing, ports, the gap the slider opens, the label column on the col 9 line, and the leader lines. Do not hand-place anything in the SVG.

Key craft moves this starter encodes — do not regress them:

- **3–5 layers**, top (what you see) to bottom (where your data lives). Anything else **throws**, like `spanFor`
- One 12-column `figure`; the SVG viewBox is **900 units wide = 1px per unit at full width**, so the drawing, leader lines and HTML labels share one coordinate system
- Labels are **HTML** hung from the **col 9 line** — they stay inside the four-size type scale and the checker's colour rules
- Selected layer: opaque **accent tint** fill + ink outline + ink label. Colour is never the only cue (outline weight and label colour change too)
- Dotted **assembly axes** run behind the layers, so they only show in the gaps
- The open gap shrinks with the layer count so the drawing never passes `FIG_MAX` (704px) — 3 layers open widest, 5 the least
- Interaction: slider opens the layers; pointer or click selects one; **↑/↓** in the layer list moves the selection; the caption under the drawing reads the selected layer's "When you…" line (`aria-live`)
- A scoped `<style>` (`xv-` classes) draws the hairline slider, focus rings and the reduced-motion switch — the only CSS that isn't inline
- Light paper by default; the **theme** button flips to a dark blueprint (dot field, dot-screen side faces). Exports always use the light default

```tsx
import { useCanvasState } from "cursor/canvas";

// Same PAPER, INK, INK_SOFT, ACCENT, GRID_*, HAIRLINE, COLS, BL, LH, GUTTER,
// MARGIN, MAXW, FONT, folio, meta, body, sectionLabel, subgrid, GridOverlay
// as poster-starter.md.

// ACCENT at 12% on PAPER, pre-mixed so the selected layer stays opaque.
const TINT = "#FCE1E6";

type Kind = "screens" | "engine" | "brains" | "plate" | "data";
type Part = { label: string; size?: "s" | "m" | "l" };
type Layer = { kind: Kind; name: string; line: string; parts: Part[] };
type Pt = [number, number];
type Pen = { line: string; detail: string; face: string; w: number; screen: boolean };

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

const SPEC: Record<Kind, { size: number; h: number }> = {
  screens: { size: 236, h: 14 },
  engine: { size: 196, h: 10 },
  brains: { size: 216, h: 8 },
  plate: { size: 208, h: 8 },
  data: { size: 236, h: 28 },
};
const RADIUS = 14;
const COLW = (MAXW - (COLS - 1) * GUTTER) / COLS;
const LABEL_X = 8 * (COLW + GUTTER); // the col 9 line — labels hang from it
const X0 = (LABEL_X - GUTTER) / 2; // the drawing is centred in cols 1–8
const ELBOW = X0 + C30 * SPEC.data.size + 12; // leaders turn here, clear of the widest layer
const GAP_CLOSED = 8; // space between layers when the slider is at 0
const GAP_OPEN = 120; // …and at 100, unless the drawing would outgrow FIG_MAX
const FIG_MAX = 704; // tallest the drawing may get, so the page stays one screen
const LABEL_STEP = 40; // a label is 32px tall; keep 8 between them
const PAD = 32;

// Rounded square of half-size s in plan, sampled 7 points per corner.
// Index 3 is the right corner on screen, 10 the front, 17 the left.
function loop(s: number, r: number): Pt[] {
  const centres: Pt[] = [[s - r, -(s - r)], [s - r, s - r], [-(s - r), s - r], [-(s - r), -(s - r)]];
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

function Slab({ s, h, pen, r = RADIUS, at = [0, 0], z = 0, main = false }: {
  s: number; h: number; pen: Pen; r?: number; at?: Pt; z?: number; main?: boolean;
}) {
  const plan = loop(s, r).map(([x, y]): Pt => [x + at[0], y + at[1]]);
  const top = plan.map(([x, y]) => iso(x, y, z + h));
  const low = plan.map(([x, y]) => iso(x, y, z));
  const face = (a: number, b: number) => path([...top.slice(a, b + 1), ...low.slice(a, b + 1).reverse()]);
  return (
    <g>
      <path d={face(3, 10)} fill={pen.face} {...outline(pen)} />
      <path d={face(10, 17)} fill={pen.face} {...outline(pen)} />
      {pen.screen ? <path d={face(10, 17)} fill="url(#xv-screen)" /> : null}
      <path data-face={main ? "top" : undefined} d={path(top)} fill={pen.face} {...outline(pen)} />
    </g>
  );
}

const CHIP = { s: 0.2, m: 0.27, l: 0.36 };
// Chips fill the slots the layer above hides least: left, right, front, then back.
const SLOTS: Pt[] = [[-0.45, 0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, -0.45]];
const depth = ([x, y]: Pt) => x + y; // paint smaller first so nearer chips overlap farther ones

function Motif({ layer, pen }: { layer: Layer; pen: Pen }) {
  const { size, h } = SPEC[layer.kind];
  const s = size / 2;
  const n = layer.parts.length;
  const at = (dx: number, dy: number, pts: Pt[]) => pts.map(([x, y]): Pt => [x + dx, y + dy]);
  const flat = (pts: Pt[]) => path(pts.map(([x, y]) => iso(x, y, h)));

  if (layer.kind === "screens") {
    // A dot per screen, an inset panel, a home mark and a status light.
    return (
      <g>
        <path d={flat(loop(s * 0.84, 10))} {...fine(pen)} />
        {Array.from({ length: Math.min(Math.max(n, 1), 24) }, (_, k) => (
          <ellipse key={k} {...disc(s * (0.12 + 0.12 * (k % 6)), -s * (0.7 - 0.14 * Math.floor(k / 6)), h, 2)} fill={pen.detail} />
        ))}
        <path d={flat(at(-s * 0.3, s * 0.25, loop(s * 0.16, 3)))} {...fine(pen)} />
        <path d={flat(at(-s * 0.3, s * 0.25, loop(s * 0.08, 2)))} {...fine(pen)} />
        <ellipse {...disc(s * 0.5, s * 0.55, h, 2.5)} fill={pen.detail} />
      </g>
    );
  }
  if (layer.kind === "engine") {
    // A fan: ring, hub and swept blades.
    return (
      <g>
        <ellipse {...disc(0, 0, h, s * 0.78)} {...fine(pen)} />
        <ellipse {...disc(0, 0, h, s * 0.7)} {...fine(pen)} />
        <ellipse {...disc(0, 0, h, s * 0.14)} {...fine(pen)} />
        {Array.from({ length: 7 }, (_, k) => {
          const t0 = (k * 2 * Math.PI) / 7;
          const blade = Array.from({ length: 6 }, (_, j): Pt => {
            const r = s * (0.16 + (0.5 * j) / 5);
            const t = t0 + (0.7 * j) / 5;
            return iso(r * Math.cos(t), r * Math.sin(t), h);
          });
          return <path key={k} d={path(blade, false)} {...fine(pen)} />;
        })}
      </g>
    );
  }
  if (layer.kind === "brains") {
    // One chip per feature, packed back to front so nearer chips overlap farther ones.
    return (
      <g>
        {layer.parts
          .map((p, k) => ({ c: CHIP[p.size ?? "m"], at: SLOTS[k] }))
          .sort((a, b) => depth(a.at) - depth(b.at))
          .map(({ c, at: [dx, dy] }, k) => (
            <Slab key={k} s={s * c} h={4 + 8 * c} r={3} at={[dx * s, dy * s]} z={h} pen={pen} />
          ))}
      </g>
    );
  }
  if (layer.kind === "plate") {
    return (
      <g>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy], k) => (
          <ellipse key={k} {...disc(dx * s * 0.82, dy * s * 0.82, h, 3)} {...fine(pen)} />
        ))}
      </g>
    );
  }
  // data: vents on top, slits on the left face, one port per connected service on the right face.
  const port = (k: number) => {
    const y0 = -s * 0.7 + k * s * 0.3;
    const y1 = y0 + s * 0.18;
    return path([iso(s, y0, h * 0.3), iso(s, y1, h * 0.3), iso(s, y1, h * 0.7), iso(s, y0, h * 0.7)]);
  };
  return (
    <g>
      {Array.from({ length: 10 }, (_, k) => {
        const y = -s * 0.5 + k * s * 0.09;
        return <path key={k} d={path([iso(-s * 0.45, y, h), iso(s * 0.55, y, h)], false)} {...fine(pen)} />;
      })}
      {[-0.75, -0.35, 0.05].flatMap((x0, g) =>
        Array.from({ length: 7 }, (_, j) => {
          const x = s * (x0 + j * 0.035);
          return <path key={`${g}-${j}`} d={path([iso(x, s, h * 0.25), iso(x, s, h * 0.75)], false)} {...fine(pen)} />;
        }),
      )}
      {layer.parts.map((_, k) => <path key={k} d={port(k)} {...fine(pen)} />)}
    </g>
  );
}

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
.xv-ease path,.xv-ease ellipse{transition:fill 160ms ease,stroke 160ms ease}
@media (prefers-reduced-motion:reduce){.xv-ease path,.xv-ease ellipse{transition:none}}
`;

export default function ExplodedView() {
  const [open, setOpen] = useCanvasState("openExploded", 80);
  const [sel, setSel] = useCanvasState("layerExploded", 0);
  const [theme, setTheme] = useCanvasState("themeExploded", "light");
  const [showGrid, setShowGrid] = useCanvasState("showGridExploded", false);

  const product = "Product";
  const purpose = "One sentence: the app, taken apart into the parts that make it work.";
  // Top to bottom: what you see → where your data lives. 3 to 5 layers.
  // parts: screens = one per screen (≤ 24) · brains = one chip per feature (≤ 4) · data = one port per connected service (≤ 4)
  const layers: Layer[] = [
    { kind: "screens", name: "What you see", line: "When you open the app, these are the screens you move between.", parts: [{ label: "Home" }, { label: "Dashboard" }, { label: "Settings" }] },
    { kind: "engine", name: "What runs on its own", line: "When [trigger], the app [does this] without you asking.", parts: [{ label: "Daily email" }] },
    { kind: "brains", name: "The brains", line: "When you [act], this part decides what happens next.", parts: [{ label: "Feature one", size: "l" }, { label: "Feature two" }, { label: "Search", size: "s" }] },
    { kind: "data", name: "Where your data lives", line: "When you save, it is kept here and is waiting next time.", parts: [{ label: "Sign-in" }, { label: "Payments" }] },
  ];
  const notBuilt = "Not built yet: [items — same list as pages 1 and 2]";
  const audience = "For [who is reading]";

  if (layers.length < 3 || layers.length > 5) {
    throw new Error(`Exploded view: ${layers.length} layers — use 3 to 5, from what you see (top) to where your data lives (bottom)`);
  }
  for (const l of layers) {
    const max = l.kind === "screens" ? 24 : 4;
    if (l.parts.length > max) throw new Error(`Exploded view: "${l.name}" has ${l.parts.length} parts — ${max} at most`);
  }

  const n = layers.length;
  const last = n - 1;
  // Open far enough that every layer's top face shows, but never taller than FIG_MAX.
  const solid = layers.reduce((a, l) => a + SPEC[l.kind].h, 0) + (SPEC[layers[0].kind].size + SPEC[layers[last].kind].size) / 2;
  const gapOpen = Math.min(GAP_OPEN, (FIG_MAX - 2 * PAD - solid) / last);
  const stack = (o: number) => {
    const gap = GAP_CLOSED + ((gapOpen - GAP_CLOSED) * o) / 100;
    const z: number[] = [];
    let acc = 0;
    for (let i = last; i >= 0; i--) {
      z[i] = acc;
      acc += SPEC[layers[i].kind].h + gap;
    }
    const top = -SPEC[layers[0].kind].size / 2 - z[0] - SPEC[layers[0].kind].h;
    return { z, top, bottom: SPEC[layers[last].kind].size / 2 };
  };
  const full = stack(100);
  const VBH = Math.ceil((full.bottom - full.top + 2 * PAD) / BL) * BL; // fixed, so the page never jumps
  const { z, top, bottom } = stack(open);
  const oy = VBH / 2 - (top + bottom) / 2; // screen y of the base's bottom centre

  // Leaders start on each layer's top face near its right corner; labels keep LABEL_STEP apart.
  const anchors = layers.map((l, i): Pt => {
    const { size, h } = SPEC[l.kind];
    const a = size / 2 - RADIUS - 4;
    const [x, y] = iso(a, -a, h);
    return [X0 + x, oy - z[i] + y];
  });
  const ly: number[] = [];
  anchors.forEach(([, y], i) => {
    ly[i] = i ? Math.max(y, ly[i - 1] + LABEL_STEP) : Math.max(y, PAD);
  });
  const over = ly[last] - (VBH - PAD);
  if (over > 0) for (let i = 0; i < n; i++) ly[i] -= over;

  const dark = theme === "dark";
  const T = dark
    ? { paper: INK, ink: "#F2F2F2", soft: "rgba(242, 242, 242, 0.64)", face: "#161616", tint: "#3B0A15", field: "rgba(242, 242, 242, 0.16)" }
    : { paper: PAPER, ink: INK, soft: INK_SOFT, face: PAPER, tint: TINT, field: "none" };
  const penFor = (i: number): Pen => (i === sel
    ? { line: T.ink, detail: T.ink, face: T.tint, w: 1.25, screen: dark }
    : { line: T.soft, detail: T.soft, face: T.face, w: 1, screen: dark });

  const axisX = [-2 * 80 * C30, 0, 2 * 80 * C30];
  const yTop = oy - z[0] - SPEC[layers[0].kind].h;
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
            Taken apart — drag to open, point at a layer to read it
          </div>

          {/* The drawing — the one place SVG is allowed (swiss-design-principles.md, page 3 exception) */}
          <figure style={{ gridColumn: "1 / -1", margin: 0, position: "relative" }}>
            <svg viewBox={`0 0 ${MAXW} ${VBH}`} role="img" aria-labelledby="xv-title xv-desc" style={{ display: "block", width: "100%", height: "auto" }}>
              <title id="xv-title">{`${product}, drawn as ${n} stacked layers`}</title>
              <desc id="xv-desc">{layers.map((l, i) => `${i + 1}. ${l.name}: ${l.parts.map((p) => p.label).join(", ")}`).join(". ")}</desc>
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

              {/* Assembly axes — behind the layers, so they show only in the gaps */}
              <g pointerEvents="none">
                {axisX.map((x, k) => (
                  <line key={k} x1={X0 + x} y1={yTop} x2={X0 + x} y2={oy} stroke={T.soft} strokeWidth={1} strokeDasharray="1 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                ))}
              </g>

              {/* Paint bottom layer first so upper layers overlap it */}
              {layers.map((_, j) => {
                const i = last - j;
                const l = layers[i];
                const pen = penFor(i);
                return (
                  <g
                    key={i}
                    data-layer={i}
                    transform={`translate(${X0} ${(oy - z[i]).toFixed(1)})`}
                    onPointerEnter={() => setSel(i)}
                    onClick={() => setSel(i)}
                    className="xv-ease"
                    style={{ cursor: "pointer" }}
                  >
                    <Slab s={SPEC[l.kind].size / 2} h={SPEC[l.kind].h} pen={pen} main />
                    <Motif layer={l} pen={pen} />
                  </g>
                );
              })}

              {/* Leader lines: anchor dot → elbow → label */}
              <g pointerEvents="none">
                {anchors.map(([x, y], i) => {
                  const c = i === sel ? T.ink : T.soft;
                  const pts = [[x, y], [ELBOW, y], [LABEL_X - 8, ly[i]]].map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
                  return (
                    <g key={i}>
                      <polyline data-leader={i} points={pts} fill="none" stroke={c} strokeWidth={0.75} vectorEffect="non-scaling-stroke" />
                      <circle cx={x} cy={y} r={2} fill={c} />
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Labels — HTML on the col 9 line, positioned in viewBox units */}
            <div
              className="xv-list"
              role="listbox"
              aria-label="Layers, top to bottom"
              tabIndex={0}
              aria-activedescendant={`xv-layer-${sel}`}
              onKeyDown={(e) => {
                const next = ({ ArrowDown: sel + 1, ArrowUp: sel - 1, Home: 0, End: last } as Record<string, number>)[e.key];
                if (next === undefined) return;
                e.preventDefault();
                setSel(Math.max(0, Math.min(last, next)));
              }}
              style={{ position: "absolute", top: 0, bottom: 0, right: 0, left: `${(LABEL_X / MAXW) * 100}%`, pointerEvents: "none" }}
            >
              {layers.map((l, i) => (
                <div
                  key={i}
                  id={`xv-layer-${i}`}
                  role="option"
                  aria-selected={i === sel}
                  data-label={i}
                  onPointerEnter={() => setSel(i)}
                  onClick={() => setSel(i)}
                  style={{ position: "absolute", left: 0, right: 0, top: `${((ly[i] - 8) / VBH) * 100}%`, pointerEvents: "auto", cursor: "pointer" }}
                >
                  <div style={{ ...folio, color: i === sel ? T.ink : T.soft }}>{pad2(i + 1)} — {l.name}</div>
                  <div style={{ ...meta, color: T.soft }}>{l.parts.map((p) => p.label).join(" · ")}</div>
                </div>
              ))}
            </div>
          </figure>

          {/* Caption — the selected layer in one plain sentence */}
          <div style={{ gridColumn: "1 / 9" }}>
            <div style={{ ...folio, color: T.ink }}>{pad2(sel + 1)} / {pad2(n)} — {layers[sel].name}</div>
            <p aria-live="polite" style={{ ...body, color: T.ink }}>{layers[sel].line}</p>
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

See [exploded-view-layout.md](exploded-view-layout.md) for how to map a codebase onto layers.

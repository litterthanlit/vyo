# Poster Kit (shared by both pages)

Paste this block at the top of **both** canvas files, then the page component from [poster-starter.md](poster-starter.md) (page 1) or [sell-sheet-starter.md](sell-sheet-starter.md) (page 2). Canvases can't import helper files, so the kit travels inline. Read [swiss-design-principles.md](swiss-design-principles.md) first.

What the kit gives you:

| Piece | Job |
|-------|-----|
| Palette, grid constants, type styles | The only values a poster may use |
| `spanFor`, `cols` | Place N items on the 12 columns; throw on counts that can't land |
| `colX`, `spanW`, `snap8` | Exact pixel geometry for SVG — column 53px, gutter 24px at the 900px content box |
| `GridOverlay` | The "Show grid" layer, marked `data-grid-overlay` |
| `TransitLine` | "Under the hood" as an SVG transit line; stations can carry a colour role |
| `ScreenSchematic` | Line-drawn wireframe of one real screen, from a preset |
| `HeroFigure` | Müller-Brockmann concentric arcs generated from the product name and structure |

**SVG rules the kit already follows** (the checker enforces them): drawn 1:1 at poster size (viewBox = rendered size), outer box on column lines, heights in multiples of 8, no text inside SVG, no gradients/filters/images, colours only from the palette, `role="img"` + `aria-label` on every figure.

**Colour roles** — each primary means one thing across both pages, and appears only in graphics:

| Role | Colour | Used for |
|------|--------|----------|
| The product | `RED` | The red full stop, and the hero's core disc — nothing else |
| Data | `BLUE` | Where your data lives or gets processed — a transit station, a hero ring, a schematic block |
| Output | `YELLOW` | What comes back to you — same places. Fill only, never text or a thin line |

```tsx
import { useCanvasState } from "cursor/canvas";

// ── Palette ────────────────────────────────────────────────────────────────
const PAPER = "#FFFFFF";
const INK = "#0A0A0A";
const INK_SOFT = "#5B6066";
const RED = "#E4002B"; // the product: full stop + hero core only
const BLUE = "#0039A6"; // data: where it lives / gets processed
const YELLOW = "#FFCC00"; // output: what comes back — fills only
const ACCENT = RED;
const HAIRLINE = "rgba(10, 10, 10, 0.2)";
const GRID_FIELD = "rgba(228, 0, 43, 0.08)";
const GRID_BASELINE_MINOR = "rgba(228, 0, 43, 0.04)";
const GRID_BASELINE_MAJOR = "rgba(228, 0, 43, 0.12)";

type Role = "data" | "output";
const ROLE_FILL: Record<Role, string> = { data: BLUE, output: YELLOW };

// ── Grid ───────────────────────────────────────────────────────────────────
const COLS = 12;
const BL = 8;
const LH = 24;
const GUTTER = 24;
const MARGIN = 64;
const MAXW = 900;
const COLW = (MAXW - (COLS - 1) * GUTTER) / COLS; // 53px
const FONT = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';

const colX = (line: number) => (line - 1) * (COLW + GUTTER); // x of column line 1–12
const spanW = (n: number) => n * COLW + (n - 1) * GUTTER; // width of an n-column span
const snap8 = (v: number) => Math.round(v / BL) * BL;

// ── Type ───────────────────────────────────────────────────────────────────
const folio = {
  fontSize: 10, lineHeight: "16px", letterSpacing: "0.08em",
  textTransform: "uppercase" as const, fontWeight: 600, color: INK,
};
const meta = { fontSize: 10, lineHeight: "16px", letterSpacing: "0.02em", color: INK_SOFT };
const body = { fontSize: 14, lineHeight: `${LH}px`, margin: 0, color: INK };
// 1px rule + 7 + 16 line + 8 = 32px — stays on the baseline
const sectionLabel = { ...folio, borderTop: `1px solid ${INK}`, paddingTop: BL - 1, marginBottom: BL };
const numeral = {
  fontSize: 44, lineHeight: "48px", fontWeight: 700,
  letterSpacing: "-0.02em", marginLeft: "-0.03em", color: INK,
};
const subgrid = { display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, columnGap: GUTTER };
// Drawn 1:1 at the 900px content box; scales down smoothly in a narrower panel.
const svgBox = { display: "block", width: "100%", height: "auto", overflow: "hidden" } as const;

// Only counts that land on the 12-column grid are allowed. Anything else throws,
// so the mistake shows up in the canvas instead of cells silently mis-placing.
function spanFor(n: number, allowed: Record<number, number>, what: string) {
  const span = allowed[n];
  if (!span) throw new Error(`${what}: ${n} won't land on the 12-column grid — use ${Object.keys(allowed).join(", ")}`);
  return span;
}
const cols = (i: number, span: number) => `${i * span + 1} / ${i * span + span + 1}`;

function GridOverlay() {
  return (
    <div data-grid-overlay aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: MARGIN, ...subgrid }}>
        {Array.from({ length: COLS }).map((_, i) => (
          <div key={i} style={{ background: GRID_FIELD, height: "100%" }} />
        ))}
      </div>
      <div style={{ position: "absolute", inset: MARGIN, backgroundImage: `repeating-linear-gradient(to bottom, ${GRID_BASELINE_MINOR} 0, ${GRID_BASELINE_MINOR} 1px, transparent 1px, transparent ${BL}px), repeating-linear-gradient(to bottom, ${GRID_BASELINE_MAJOR} 0, ${GRID_BASELINE_MAJOR} 1px, transparent 1px, transparent ${LH}px)` }} />
      <div style={{ position: "absolute", top: MARGIN, bottom: MARGIN, left: MARGIN, width: 1, background: GRID_BASELINE_MAJOR }} />
      <div style={{ position: "absolute", top: MARGIN, bottom: MARGIN, right: MARGIN, width: 1, background: GRID_BASELINE_MAJOR }} />
    </div>
  );
}

function GridToggle({ on, set }: { on: boolean; set: (fn: (v: boolean) => boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => set((v) => !v)}
      // Block-level so the cell is exactly one 16px line — an inline button inherits the default line height
      style={{ display: "block", marginLeft: "auto", textAlign: "right", background: "none", border: "none", cursor: "pointer", fontSize: 10, lineHeight: "16px", color: ACCENT, padding: 0, fontFamily: FONT }}
    >
      {on ? "Hide grid" : "Show grid"}
    </button>
  );
}

// ── Transit line ───────────────────────────────────────────────────────────
// One 2px ink line, a station dot on each column line, an optional 90° branch
// ending in a hollow ring. Stations may carry a colour role (data / output).
type Station = { label: string; sub: string; role?: Role; branch?: { label: string; sub: string } };

function TransitLine({ stations }: { stations: Station[] }) {
  const span = spanFor(stations.length, { 3: 4, 4: 3, 6: 2 }, "Transit stations");
  const H = 72; // dot row; branches live in the space above the line
  const R = 6;
  const CY = H - 12;
  const RING_Y = 14;
  const cx = (i: number) => colX(i * span + 1) + R; // dot's left edge sits on the column line
  return (
    <div>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${MAXW} ${H}`} style={svgBox} role="img" aria-label={`Transit line: ${stations.map((s) => s.label).join(", then ")}`}>
          {stations.slice(1).map((_, i) => (
            <line key={i} data-transit="segment" x1={cx(i)} y1={CY} x2={cx(i + 1)} y2={CY} stroke={INK} strokeWidth={2} />
          ))}
          {stations.map((s, i) =>
            s.branch ? (
              <g key={`b${i}`}>
                <line data-transit="branch" x1={cx(i)} y1={RING_Y + R - 1} x2={cx(i)} y2={CY} stroke={INK} strokeWidth={2} />
                <circle data-transit="ring" cx={cx(i)} cy={RING_Y} r={R - 1} fill={PAPER} stroke={INK} strokeWidth={2} />
              </g>
            ) : null,
          )}
          {stations.map((s, i) => (
            <circle
              key={i}
              data-transit="station"
              cx={cx(i)}
              cy={CY}
              r={s.role ? R + 1 : R}
              fill={s.role ? ROLE_FILL[s.role] : INK}
              stroke={s.role ? INK : "none"}
              strokeWidth={s.role ? 2 : 0}
            />
          ))}
        </svg>
        {/* Branch labels: HTML on the same 12 columns, hanging beside the ring */}
        <div style={{ ...subgrid, position: "absolute", inset: 0 }}>
          {stations.map((s, i) =>
            s.branch ? (
              <div key={i} style={{ gridColumn: cols(i, span), paddingLeft: R * 2 + BL, paddingRight: GUTTER }}>
                <div style={folio}>{s.branch.label}</div>
                <div style={meta}>{s.branch.sub}</div>
              </div>
            ) : null,
          )}
        </div>
      </div>
      <div style={{ ...subgrid, marginTop: BL }}>
        {stations.map((s, i) => (
          <div key={i} style={{ gridColumn: cols(i, span), paddingRight: GUTTER }}>
            <div style={folio}>{s.label}</div>
            <div style={meta}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Screen schematics ──────────────────────────────────────────────────────
// A line-drawn wireframe of one real screen. Pick the preset closest to the
// screen's layout; optionally colour one block by the role it plays.
type BlockKind = "fill" | "box" | "text" | "media" | "node";
type Block = { k: BlockKind; x: number; y: number; w: number; h: number; id?: string };
type Preset = { blocks: Block[]; edges?: Array<[string, string]> };

// Blocks sit on a 12 × 9 module grid inside the screen frame.
const PRESETS: Record<string, Preset> = {
  landing: {
    blocks: [
      { k: "fill", x: 0, y: 0, w: 2, h: 0.8 },
      { k: "text", x: 8, y: 0, w: 4, h: 1 },
      { k: "fill", x: 0, y: 2, w: 6, h: 1.6, id: "headline" },
      { k: "text", x: 0, y: 4.2, w: 5, h: 2 },
      { k: "box", x: 0, y: 7, w: 3, h: 1.2, id: "cta" },
      { k: "media", x: 7, y: 2, w: 5, h: 6.2, id: "hero" },
    ],
  },
  dashboard: {
    blocks: [
      { k: "box", x: 0, y: 0, w: 2.2, h: 9, id: "nav" },
      { k: "text", x: 0.4, y: 1, w: 1.4, h: 4 },
      { k: "fill", x: 3, y: 0, w: 4, h: 0.8 },
      { k: "box", x: 3, y: 1.6, w: 2.8, h: 2.2, id: "stat1" },
      { k: "box", x: 6.1, y: 1.6, w: 2.8, h: 2.2, id: "stat2" },
      { k: "box", x: 9.2, y: 1.6, w: 2.8, h: 2.2, id: "stat3" },
      { k: "box", x: 3, y: 4.6, w: 5.6, h: 4.4, id: "panel" },
      { k: "text", x: 3.4, y: 5.2, w: 4.6, h: 3 },
      { k: "box", x: 9.2, y: 4.6, w: 2.8, h: 4.4, id: "feed" },
      { k: "text", x: 9.5, y: 5.2, w: 2.2, h: 3 },
    ],
  },
  list: {
    blocks: [
      { k: "fill", x: 0, y: 0, w: 4, h: 0.8 },
      { k: "box", x: 0, y: 1.6, w: 12, h: 1, id: "search" },
      { k: "box", x: 0, y: 3.2, w: 12, h: 1, id: "row1" },
      { k: "box", x: 0, y: 4.5, w: 12, h: 1, id: "row2" },
      { k: "box", x: 0, y: 5.8, w: 12, h: 1, id: "row3" },
      { k: "box", x: 0, y: 7.1, w: 12, h: 1, id: "row4" },
    ],
  },
  canvas: {
    blocks: [
      { k: "box", x: 0, y: 0, w: 12, h: 1, id: "toolbar" },
      { k: "node", x: 1, y: 2.4, w: 2, h: 2, id: "n1" },
      { k: "node", x: 5.5, y: 1.8, w: 2, h: 2, id: "n2" },
      { k: "node", x: 9, y: 4.6, w: 2, h: 2, id: "n3" },
      { k: "node", x: 3.5, y: 6.2, w: 2, h: 2, id: "n4" },
    ],
    edges: [["n1", "n2"], ["n2", "n3"], ["n1", "n4"], ["n4", "n3"]],
  },
  form: {
    blocks: [
      { k: "fill", x: 0, y: 0, w: 5, h: 0.8 },
      { k: "text", x: 0, y: 1.8, w: 3, h: 0.5 },
      { k: "box", x: 0, y: 2.4, w: 8, h: 1, id: "field1" },
      { k: "text", x: 0, y: 3.9, w: 3, h: 0.5 },
      { k: "box", x: 0, y: 4.5, w: 8, h: 1, id: "field2" },
      { k: "text", x: 0, y: 6, w: 3, h: 0.5 },
      { k: "box", x: 0, y: 6.6, w: 8, h: 1, id: "field3" },
      { k: "fill", x: 0, y: 8.2, w: 3, h: 0.8, id: "submit" },
    ],
  },
  detail: {
    blocks: [
      { k: "text", x: 0, y: 0, w: 2, h: 0.5 },
      { k: "media", x: 0, y: 1, w: 12, h: 4.2, id: "media" },
      { k: "fill", x: 0, y: 5.8, w: 6, h: 0.9, id: "title" },
      { k: "text", x: 0, y: 7.2, w: 10, h: 1.8 },
    ],
  },
  settings: {
    blocks: [
      { k: "box", x: 0, y: 0, w: 3, h: 9, id: "nav" },
      { k: "text", x: 0.4, y: 1, w: 2.2, h: 4 },
      { k: "fill", x: 4, y: 0, w: 4, h: 0.8 },
      { k: "text", x: 4, y: 2, w: 5, h: 0.5 },
      { k: "box", x: 10.4, y: 1.8, w: 1.6, h: 0.9, id: "toggle1" },
      { k: "text", x: 4, y: 3.8, w: 5, h: 0.5 },
      { k: "box", x: 10.4, y: 3.6, w: 1.6, h: 0.9, id: "toggle2" },
      { k: "text", x: 4, y: 5.6, w: 5, h: 0.5 },
      { k: "box", x: 10.4, y: 5.4, w: 1.6, h: 0.9, id: "toggle3" },
    ],
  },
  chat: {
    blocks: [
      { k: "box", x: 0, y: 0.4, w: 7, h: 1.4, id: "them1" },
      { k: "fill", x: 5, y: 2.4, w: 7, h: 1.4, id: "you1" },
      { k: "box", x: 0, y: 4.4, w: 8, h: 1.4, id: "them2" },
      { k: "box", x: 0, y: 7.8, w: 10.2, h: 1.2, id: "input" },
      { k: "fill", x: 10.6, y: 7.8, w: 1.4, h: 1.2, id: "send" },
    ],
  },
};
type PresetName = keyof typeof PRESETS;

function ScreenSchematic({ name, preset, span, highlight }: {
  name: string;
  preset: PresetName;
  span: number; // columns this schematic occupies
  highlight?: { block: string; role: Role };
}) {
  const p = PRESETS[preset];
  if (!p) throw new Error(`Unknown schematic preset "${String(preset)}" — use ${Object.keys(PRESETS).join(", ")}`);
  const W = spanW(span);
  const H = snap8(W * 0.75);
  const TOP = 16; // window bar
  const PAD = 10;
  const mx = (W - PAD * 2) / 12;
  const my = (H - TOP - PAD * 2) / 9;
  const box = (b: Block) => ({ x: PAD + b.x * mx, y: TOP + PAD + b.y * my, w: b.w * mx, h: b.h * my });
  const centre = (id: string) => {
    const b = p.blocks.find((x) => x.id === id)!;
    const r = box(b);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  };
  const fillFor = (b: Block, base: string) => (highlight && b.id === highlight.block ? ROLE_FILL[highlight.role] : base);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgBox} role="img" aria-label={`Wireframe of the ${name} screen`}>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <line x1={0.75} y1={TOP} x2={W - 0.75} y2={TOP} stroke={INK} strokeWidth={1} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={8 + i * 8} cy={TOP / 2} r={2} fill={HAIRLINE} />
      ))}
      {(p.edges || []).map(([a, b], i) => {
        const A = centre(a);
        const B = centre(b);
        return <line key={`e${i}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={INK} strokeWidth={1} />;
      })}
      {p.blocks.map((b, i) => {
        const r = box(b);
        if (b.k === "fill") return <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={fillFor(b, INK)} stroke={fillFor(b, INK) === INK ? "none" : INK} strokeWidth={1} />;
        if (b.k === "box") return <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={fillFor(b, PAPER)} stroke={INK} strokeWidth={1} />;
        if (b.k === "node") {
          const d = Math.min(r.w, r.h);
          return <circle key={i} cx={r.x + r.w / 2} cy={r.y + r.h / 2} r={d / 2} fill={fillFor(b, PAPER)} stroke={INK} strokeWidth={1.5} />;
        }
        if (b.k === "media") {
          return (
            <g key={i}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={fillFor(b, PAPER)} stroke={INK} strokeWidth={1} />
              <line x1={r.x} y1={r.y} x2={r.x + r.w} y2={r.y + r.h} stroke={HAIRLINE} strokeWidth={1} />
              <line x1={r.x + r.w} y1={r.y} x2={r.x} y2={r.y + r.h} stroke={HAIRLINE} strokeWidth={1} />
            </g>
          );
        }
        // text: hairline bars, one per module row, the last one shorter
        const rows = Math.max(1, Math.floor(r.h / my));
        return (
          <g key={i}>
            {Array.from({ length: rows }).map((_, j) => (
              <rect key={j} x={r.x} y={r.y + j * my + (my - 4) / 2} width={j === rows - 1 && rows > 1 ? r.w * 0.6 : r.w} height={4} fill={HAIRLINE} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ── Hero figure ────────────────────────────────────────────────────────────
// Müller-Brockmann concentric arcs rising from one edge of the box. Anchor
// position comes from a hash of the product name, so the same product always
// gets the same figure on both pages. Rings: one per journey/station (≤ 6).
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function HeroFigure({ seed, span, height, rings, dataRing, outputRing }: {
  seed: string;
  span: number; // columns the figure occupies
  height: number; // multiple of 8
  rings: number; // 3–6
  dataRing?: number; // 1-based ring coloured BLUE
  outputRing?: number; // 1-based ring coloured YELLOW
}) {
  const W = spanW(span);
  const H = snap8(height);
  const n = Math.max(3, Math.min(6, rings));
  const h = hash(seed);
  const lines = Array.from({ length: span - 1 }, (_, i) => colX(i + 2)); // interior column lines
  const ax = lines[h % lines.length];
  const ay = (h >> 8) % 2 ? H : 0; // rise from the bottom edge or hang from the top
  const STEP = 48;
  const STROKE = 24;
  const colour = (k: number) => (k === dataRing ? BLUE : k === outputRing ? YELLOW : INK);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgBox} role="img" aria-label={`${seed} emblem: ${n} rings around a red core`}>
      {Array.from({ length: n }).map((_, i) => (
        <circle key={i} cx={ax} cy={ay} r={STEP * (i + 1)} fill="none" stroke={colour(i + 1)} strokeWidth={STROKE} />
      ))}
      <circle cx={ax} cy={ay} r={STROKE} fill={RED} />
    </svg>
  );
}
```

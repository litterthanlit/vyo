# Block Kit (Block style only)

Paste this block **after** [poster-kit.md](poster-kit.md) in both Block-style canvases, then the page component from [block-starter.md](block-starter.md) (page 1) or [block-story-starter.md](block-story-starter.md) (page 2). Rules and rationale: [block-style.md](block-style.md).

| Piece | Job |
|-------|-----|
| `STATUS`, `SILVER`, `HUES` | Tab colours by status; the field's hue choices |
| `BlockSheet` | Fixed 1028 × 1454 A-series sheet: field behind, 12-column grid in front, legend bar and colophon |
| `BlockField` | Full-bleed soft colour field — blurred ellipses in one hue, placed by the product name |
| `BlockFigure` | The stack of black blocks — one per feature (page 1) or story section (page 2) — each with its tab |

```tsx
// ── Block palette ──────────────────────────────────────────────────────────
const SILVER = "#CFCFCF";
type Status = "live" | "behind" | "soon" | "label";
const STATUS: Record<Status, { fill: string; text: string; word: string }> = {
  live: { fill: YELLOW, text: INK, word: "Live" },
  behind: { fill: BLUE, text: PAPER, word: "Behind the scenes" },
  soon: { fill: SILVER, text: INK, word: "Coming soon" },
  label: { fill: PAPER, text: INK, word: "" },
};
// One saturated hue per poster. No blue/purple (house rule).
const HUES = ["#FF5A1F", "#FF3E7F", "#19B5E6", "#8FD400"];

const SHEET_W = MAXW + MARGIN * 2; // 1028
const SHEET_H = 1454; // A-series portrait at 1028 wide
const TAB_H = 40; // 4 + 16 + 16 + 4
const BODY_PAD = 16;

function toHsl(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(h * 60 + 360) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

// ── Field ──────────────────────────────────────────────────────────────────
// Out-of-focus colour, the way a photographed object reads behind the Farrow
// blocks: one hue, lighter and darker pools, heavily blurred. Pure vector.
function BlockField({ seed, hue }: { seed: string; hue?: string }) {
  const base = hue || HUES[hash(seed) % HUES.length];
  const { h, s, l } = toHsl(base);
  const shades = [26, -20, 12, -10, 34, -4];
  const pools = shades.map((dl, k) => {
    const v = hash(`${seed}:${k}`);
    return {
      cx: v % SHEET_W,
      cy: (v >>> 10) % SHEET_H,
      rx: 220 + ((v >>> 4) % 260),
      ry: 260 + ((v >>> 6) % 320),
      fill: `hsl(${h} ${s}% ${Math.max(12, Math.min(88, l + dl))}%)`,
    };
  });
  return (
    <svg data-poster-field aria-hidden="true" width={SHEET_W} height={SHEET_H} style={{ position: "absolute", inset: 0, display: "block" }}>
      <defs>
        <filter id="block-field-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={90} />
        </filter>
      </defs>
      <rect width={SHEET_W} height={SHEET_H} fill={base} />
      <g filter="url(#block-field-blur)">
        {pools.map((p, k) => (
          <ellipse key={k} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={p.fill} />
        ))}
      </g>
    </svg>
  );
}

// ── Sheet ──────────────────────────────────────────────────────────────────
function BlockSheet({ seed, hue, colophon, audience, showGrid, setShowGrid, children }: {
  seed: string;
  hue?: string;
  colophon: string; // "App Guide — 01 · Hypher" — set vertically in the left margin
  audience: string; // legend bar: who is reading
  showGrid: boolean;
  setShowGrid: (fn: (v: boolean) => boolean) => void;
  children: JSX.Element | JSX.Element[];
}) {
  return (
    <div
      data-poster-style="block"
      style={{ position: "relative", width: SHEET_W, height: SHEET_H, overflow: "hidden", padding: MARGIN, boxSizing: "border-box", fontFamily: FONT, color: INK }}
    >
      <BlockField seed={seed} hue={hue} />
      {showGrid ? <GridOverlay /> : null}
      <div style={{ ...subgrid, position: "relative", zIndex: 1, marginTop: TAB_H }}>{children}</div>

      {/* Legend bar — a white strip, like the paper bars in the reference */}
      <div data-legend style={{ position: "absolute", left: MARGIN, right: MARGIN, bottom: MARGIN, height: LEGEND_H, boxSizing: "border-box", zIndex: 1, background: PAPER, padding: `${BL}px ${BL * 2}px`, display: "flex", gap: GUTTER, alignItems: "center" }}>
        {(["live", "behind", "soon"] as const).map((k) => (
          <span key={k} style={{ display: "flex", gap: BL, alignItems: "center", ...meta, color: INK }}>
            <span aria-hidden="true" style={{ width: 16, height: 16, background: STATUS[k].fill }} />
            {STATUS[k].word}
          </span>
        ))}
        <span style={{ ...meta, color: INK, marginLeft: "auto" }}>{audience}</span>
        <GridToggle on={showGrid} set={setShowGrid} />
      </div>

      {/* Colophon — vertical, bottom of the left margin, on a paper chip */}
      <div style={{ position: "absolute", left: BL * 2, bottom: MARGIN, zIndex: 1, background: PAPER, padding: `${BL}px 4px`, writingMode: "vertical-rl", transform: "rotate(180deg)", ...folio }}>
        {colophon}
      </div>
    </div>
  );
}

// ── Figure ─────────────────────────────────────────────────────────────────
type BlockItem = {
  name: string; // tab label
  status: Status;
  weight: 1 | 2 | 3; // how central: 4 / 6 / 8 columns wide
  lines?: string[]; // white text in the block, one entry per paragraph
  numeral?: number; // page 2 talking points
};
type TitleItem = { tab: string; tabSub?: string; display: string[]; sub?: string };

const W_SPAN = { 1: 4, 2: 6, 3: 8 } as const;
const LEGEND_H = 32;
// Height the figure may use: the sheet minus margins, the first tab, the legend bar and a gap.
const FIGURE_H = SHEET_H - MARGIN * 2 - TAB_H - LEGEND_H - LH * 2;
// Conservative line estimate for 14px text (overestimates, so text never overflows its block).
const linesIn = (paras: string[], span: number) => {
  const perLine = Math.floor((spanW(span) - BODY_PAD * 2) / 7.6);
  return paras.reduce((n, t) => n + Math.max(1, Math.ceil(t.length / perLine)), 0);
};

function BlockFigure({ seed, title, blocks }: { seed: string; title: TitleItem; blocks: BlockItem[] }) {
  if (blocks.length < 3 || blocks.length > 8) {
    throw new Error(`Blocks: ${blocks.length} won't make a figure — use 3 to 8 blocks`);
  }
  // Place each block so it overlaps the one above by at least 2 columns: one connected body.
  const titleSpan = 8;
  const titleStart = 1 + (hash(seed) % 3);
  const placed: Array<{ start: number; span: number; tabRight: boolean }> = [];
  let prev = { start: titleStart, span: titleSpan };
  blocks.forEach((b, i) => {
    const span = W_SPAN[b.weight];
    const v = hash(`${seed}#${i}`);
    const drift = [-3, -2, -1, 1, 2, 3][v % 6];
    let start = Math.max(1, Math.min(13 - span, prev.start + drift));
    const overlap = (s: number) => Math.min(prev.start + prev.span, s + span) - Math.max(prev.start, s);
    while (overlap(start) < 2) start += start < prev.start ? 1 : -1;
    placed.push({ start, span, tabRight: ((v >>> 8) & 1) === 1 });
    prev = { start, span };
  });

  // Tabs: name + status word (40px), or a one-line 24px chip when there's no second line.
  const tab = (label: string, status: Status, span: number, right: boolean, sub?: string) => {
    const st = STATUS[status];
    const second = sub ?? st.word;
    const h = second ? TAB_H : LH;
    return (
      <div style={{ position: "absolute", top: -h, ...(right ? { right: 0 } : { left: 0 }), width: spanW(Math.min(3, span)), height: h, boxSizing: "border-box", padding: `4px ${BL}px`, background: st.fill }}>
        <div style={{ ...folio, color: st.text }}>{label}</div>
        {second ? <div style={{ ...meta, color: st.text }}>{second}</div> : null}
      </div>
    );
  };
  const white = { ...body, color: PAPER };

  // Every block gets the height its text needs (top padding + text + TAB_H kept
  // clear for the next block's tab); the rest of FIGURE_H is shared out by weight,
  // so the figure fills the sheet and central features stand taller. All multiples of 8.
  const titleNeed = BODY_PAD + 72 * title.display.length + (title.sub ? BL + LH * linesIn([title.sub], titleSpan) : 0) + TAB_H;
  const needs = blocks.map((b, i) => BODY_PAD + (b.numeral ? 48 + BL : 0) + LH * linesIn(b.lines || [""], placed[i].span) + TAB_H);
  const spare = Math.max(0, FIGURE_H - titleNeed - needs.reduce((a, b) => a + b, 0));
  const weightSum = blocks.reduce((a, b) => a + b.weight, 0);
  const minH = needs.map((n, i) => n + Math.floor((spare * blocks[i].weight) / weightSum / BL) * BL);
  return (
    <>
      <div data-block style={{ gridColumn: `${titleStart} / ${titleStart + titleSpan}`, position: "relative", background: INK, padding: `${BODY_PAD}px ${BODY_PAD}px ${TAB_H}px` }}>
        {tab(title.tab, "label", titleSpan, false, title.tabSub)}
        <h1 style={{ margin: 0, fontSize: 72, lineHeight: "72px", fontWeight: 700, letterSpacing: "-0.03em", color: PAPER }}>
          {title.display.map((line, i) => (
            <span key={i} style={{ display: "block" }}>
              {line}
              {i === title.display.length - 1 ? <span style={{ color: RED }}>.</span> : null}
            </span>
          ))}
        </h1>
        {title.sub ? <p style={{ ...white, marginTop: BL, maxWidth: "34em" }}>{title.sub}</p> : null}
      </div>
      {blocks.map((b, i) => {
        const p = placed[i];
        return (
          <div key={i} data-block style={{ gridColumn: `${p.start} / ${p.start + p.span}`, position: "relative", background: INK, minHeight: minH[i], padding: `${BODY_PAD}px ${BODY_PAD}px ${TAB_H}px`, boxSizing: "border-box" }}>
            {tab(b.name, b.status, p.span, p.tabRight)}
            {b.numeral ? <div style={{ ...numeral, color: PAPER, marginBottom: BL }}>{b.numeral}</div> : null}
            {(b.lines || []).map((line, j) => (
              <p key={j} style={white}>{line}</p>
            ))}
          </div>
        );
      })}
    </>
  );
}
```

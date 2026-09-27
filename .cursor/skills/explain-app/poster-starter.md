# Poster Canvas Starter (Page 1)

Structural reference for `<repo>-app-poster.canvas.tsx`. Read [swiss-design-principles.md](swiss-design-principles.md) first.

Key craft moves this starter encodes — do not regress them:

- Masthead at **104–128px on one line** (a multiple of 8 — 112 default) with a **red full stop** (the set's only accent mark)
- 2px **ink** rule under the folio; 1px ink hairlines above section labels (type hangs from rules)
- Journeys as **giant numerals** (44px), not body-size numbers
- "Under the hood" as a **transit line** — 2px ink line, solid dots on the **12-column grid**, **3 / 4 / 6 stations only** — never boxed flowcharts
- Primary copy in INK; INK_SOFT for folio/captions/status only
- Purpose sentence spans cols 1–7/8; the remaining columns stay **empty**
- Bands that pair a label with content wrap both in one grid cell — **no negative margins**
- **Four sizes only:** 112 display · 44 numerals · 14 body · 10 folio
- Rules and borders are **paid for out of padding** (`BL - 2`, `BL - 1`) so every block stays a multiple of 8px
- Counts that can't land on the 12-column grid (5 stations, 5 journeys…) **throw** via `spanFor` — never let them silently mis-place

```tsx
import { useCanvasState } from "cursor/canvas";

const PAPER = "#FFFFFF";
const INK = "#0A0A0A";
const INK_SOFT = "#5B6066";
const ACCENT = "#E4002B";
const GRID_FIELD = "rgba(228, 0, 43, 0.08)";
const GRID_BASELINE_MINOR = "rgba(228, 0, 43, 0.04)";
const GRID_BASELINE_MAJOR = "rgba(228, 0, 43, 0.12)";
const HAIRLINE = "rgba(10, 10, 10, 0.2)";

const COLS = 12;
const BL = 8;
const LH = 24;
const GUTTER = 24;
const MARGIN = 64;
const MAXW = 900;
const FONT = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';

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
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
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

type Station = { label: string; sub: string; branch?: { label: string; sub: string } };

function TransitLine({ stations }: { stations: Station[] }) {
  const span = spanFor(stations.length, { 3: 4, 4: 3, 6: 2 }, "Transit stations");
  const DOT = 12;
  const ROW = 72; // dot row height; branch lives in the space above the line
  return (
    <div style={subgrid}>
      {stations.map((s, i) => {
        const last = i === stations.length - 1;
        return (
          <div key={i} style={{ gridColumn: cols(i, span) }}>
            <div style={{ position: "relative", height: ROW }}>
              {!last ? (
                // Runs from this dot's centre across the gutter to the next dot's centre
                <div style={{ position: "absolute", left: DOT / 2, right: -(GUTTER + DOT / 2), top: ROW - DOT - 1, height: 2, background: INK }} />
              ) : null}
              {s.branch ? (
                <>
                  <div style={{ position: "absolute", left: DOT / 2 - 1, top: DOT + BL, height: ROW - DOT * 2 - BL - 4, width: 2, background: INK }} />
                  <div style={{ position: "absolute", left: 0, top: BL, width: DOT, height: DOT, borderRadius: DOT, border: `2px solid ${INK}`, background: PAPER, boxSizing: "border-box" }} />
                  <div style={{ position: "absolute", left: DOT + BL, top: 0, paddingRight: GUTTER }}>
                    <div style={folio}>{s.branch.label}</div>
                    <div style={meta}>{s.branch.sub}</div>
                  </div>
                </>
              ) : null}
              <div style={{ position: "absolute", left: 0, top: ROW - DOT - 6, width: DOT, height: DOT, borderRadius: DOT, background: INK }} />
            </div>
            <div style={{ ...folio, marginTop: BL }}>{s.label}</div>
            <div style={{ ...meta, paddingRight: GUTTER }}>{s.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AppPoster() {
  const [showGrid, setShowGrid] = useCanvasState("showGridApp", false);

  const journeys = ["Journey one", "Journey two", "Journey three", "Journey four"];
  const journeySpan = spanFor(journeys.length, { 2: 6, 3: 4, 4: 3 }, "Journeys");
  const stations: Station[] = [
    { label: "You act", sub: "plain verb" },
    { label: "Saved", sub: "where it goes" },
    { label: "Processed", sub: "what reads it", branch: { label: "Optional", sub: "branch step" } },
    { label: "Back out", sub: "what you receive" },
  ];
  const whenYou: Array<[string, string]> = [
    ["When you [act],", "plain consequence."],
    ["When [trigger],", "plain consequence."],
    ["When you [share],", "plain consequence."],
  ];
  const bodyColumns: Array<{ label: string; lines: string[] }> = [
    { label: "The problem", lines: ["Why this app exists."] },
    { label: "The screens", lines: ["Main screens, one line each."] },
    { label: "Connected", lines: ["Service — what it does for the user."] },
  ];
  const whenYouSpan = spanFor(whenYou.length, { 2: 6, 3: 4 }, "When-you lines");
  const bodySpan = spanFor(bodyColumns.length, { 3: 4 }, "Body columns");

  return (
    <div style={{ background: PAPER, minHeight: "100%", fontFamily: FONT, color: INK }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: MARGIN, position: "relative" }}>
        {showGrid ? <GridOverlay /> : null}

        <div style={{ ...subgrid, rowGap: LH, position: "relative", zIndex: 1 }}>
          {/* Folio + 2px ink rule — one cell so the rule hugs the type */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={subgrid}>
              <div style={{ gridColumn: "1 / 5", ...folio }}>App Guide — 01</div>
              <div style={{ gridColumn: "5 / 10", ...meta }}>{/* one-line promise */}</div>
              <div style={{ gridColumn: "10 / 13", ...meta, textAlign: "right" }}>{/* platform · audience */}</div>
            </div>
            {/* 16px folio + 6 + 2px rule = 24px, one leading unit */}
            <div style={{ height: 2, background: INK, marginTop: BL - 2 }} />
          </div>

          {/* Masthead — one line, 104–128px in multiples of 8, red full stop */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 112, lineHeight: "112px", fontWeight: 700, letterSpacing: "-0.03em", marginLeft: "-0.05em" }}>
              Product<span style={{ color: ACCENT }}>.</span>
            </div>
          </div>

          {/* Purpose — right columns stay empty */}
          <div style={{ gridColumn: "1 / 8" }}>
            <p style={{ ...body, maxWidth: "28em" }}>One-sentence purpose, set in ink.</p>
          </div>

          {/* Journeys — giant numerals */}
          <div style={{ gridColumn: "1 / -1", ...sectionLabel, marginBottom: 0 }}>What you do</div>
          {journeys.map((j, i) => (
            <div key={i} style={{ gridColumn: cols(i, journeySpan) }}>
              <div style={numeral}>{i + 1}</div>
              <p style={{ ...body, marginTop: BL, paddingRight: GUTTER }}>{j}</p>
            </div>
          ))}

          {/* Under the hood — transit line + when-you lines */}
          <div style={{ gridColumn: "1 / -1", ...sectionLabel, marginBottom: 0, marginTop: BL }}>
            Under the hood — what the code does
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <TransitLine stations={stations} />
          </div>
          {whenYou.map(([lead, rest], i) => (
            <div key={i} style={{ gridColumn: cols(i, whenYouSpan) }}>
              <p style={{ ...body, paddingRight: GUTTER }}>
                <span style={{ fontWeight: 600 }}>{lead}</span> {rest}
              </p>
            </div>
          ))}

          {/* Three-column body — label + copy share a cell */}
          {bodyColumns.map((col, i) => (
            <div key={i} style={{ gridColumn: cols(i, bodySpan), marginTop: BL }}>
              <div style={sectionLabel}>{col.label}</div>
              {col.lines.map((line, j) => (
                <p key={j} style={{ ...body, paddingRight: GUTTER }}>{line}</p>
              ))}
            </div>
          ))}

          {/* Footer */}
          <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${HAIRLINE}`, paddingTop: BL - 1 }}>
            <div style={subgrid}>
              <div style={{ gridColumn: "1 / 6", ...meta }}>{/* not-built items */}</div>
              <div style={{ gridColumn: "6 / 10", ...meta }}>{/* For [handoff audience — who is reading] */}</div>
              <div style={{ gridColumn: "10 / 13" }}>
                {/* Block-level so the cell is exactly one 16px line — an inline button inherits the default line height */}
                <button
                  type="button"
                  onClick={() => setShowGrid((v) => !v)}
                  style={{ display: "block", marginLeft: "auto", textAlign: "right", background: "none", border: "none", cursor: "pointer", fontSize: 10, lineHeight: "16px", color: ACCENT, padding: 0, fontFamily: FONT }}
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

See [poster-layout.md](poster-layout.md) for content mapping.

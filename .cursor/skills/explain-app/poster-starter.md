# Poster Canvas Starter

Structural reference for `<repo>-app-poster.canvas.tsx`. Read [swiss-design-principles.md](swiss-design-principles.md) first.

```tsx
import { useCanvasState } from "cursor/canvas";

const PAPER = "#FFFFFF";
const INK = "#0A0A0A";
const INK_SOFT = "#5B6066";
const ACCENT = "#E4002B";
const GRID_FIELD = "rgba(228, 0, 43, 0.08)";

const COLS = 12;
const BL = 8;
const LH = 24;
const GUTTER = 24;
const MARGIN = 48;
const MAXW = 900;

const FONT = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';

function GridOverlay() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        columnGap: GUTTER,
        padding: MARGIN,
      }}
    >
      {Array.from({ length: COLS }).map((_, i) => (
        <div key={i} style={{ background: GRID_FIELD, height: "100%" }} />
      ))}
    </div>
  );
}

function Band({ children, style }: { children: React.ReactNode; style?: Record<string, string | number> }) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        columnGap: GUTTER,
        alignItems: "start",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function AppPoster() {
  const [showGrid, setShowGrid] = useCanvasState("showGrid", false);

  const folio = {
    fontSize: 11,
    lineHeight: `${LH}px`,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    fontWeight: 500,
  };

  const body = {
    fontSize: 13,
    lineHeight: `${LH}px`,
    margin: 0,
  };

  const label = {
    ...folio,
    fontWeight: 600,
    marginBottom: BL,
    color: INK,
  };

  return (
    <div style={{ background: PAPER, minHeight: "100%", fontFamily: FONT, color: INK }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: MARGIN, position: "relative" }}>
        {showGrid ? <GridOverlay /> : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            columnGap: GUTTER,
            rowGap: BL * 3,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Folio */}
          <Band>
            <div style={{ gridColumn: "1 / 5", ...folio }}>App Guide</div>
            <div style={{ gridColumn: "5 / 9", ...folio, color: INK_SOFT, textTransform: "none" }}>
              {/* audience */}
            </div>
            <div
              style={{
                gridColumn: "9 / 13",
                ...folio,
                color: INK_SOFT,
                textTransform: "none",
                textAlign: "right",
              }}
            >
              {/* platform */}
            </div>
          </Band>

          {/* Masthead + journeys */}
          <Band>
            <div style={{ gridColumn: "1 / 8" }}>
              <div
                style={{
                  fontSize: 60,
                  lineHeight: "60px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  marginLeft: "-0.04em",
                }}
              >
                Product
                <br />
                Name
              </div>
              <p style={{ ...body, marginTop: BL * 3, maxWidth: 420, color: INK_SOFT }}>
                One-sentence purpose.
              </p>
            </div>
            <div style={{ gridColumn: "8 / 13", ...body, color: INK_SOFT }}>
              <div style={{ marginBottom: BL }}>1. Journey one</div>
              <div style={{ marginBottom: BL }}>2. Journey two</div>
              <div style={{ marginBottom: BL }}>3. Journey three</div>
            </div>
          </Band>

          {/* Accent rule */}
          <Band style={{ paddingTop: BL, paddingBottom: BL }}>
            <div style={{ gridColumn: "1 / -1", height: 2, background: ACCENT }} />
          </Band>

          {/* Body columns */}
          <Band>
            <div style={{ gridColumn: "1 / 5" }}>
              <div style={label}>The problem</div>
              <p style={body}>Why this app exists.</p>
            </div>
            <div style={{ gridColumn: "5 / 9" }}>
              <div style={label}>How it works</div>
              <p style={body}>Main areas and flows.</p>
            </div>
            <div style={{ gridColumn: "9 / 13" }}>
              <div style={label}>Connected</div>
              <p style={body}>Services and behind the scenes.</p>
            </div>
          </Band>

          {/* Footer */}
          <Band style={{ borderTop: `1px solid ${INK_SOFT}33`, paddingTop: BL * 2 }}>
            <div style={{ gridColumn: "1 / 5", fontSize: 10, lineHeight: "16px", color: INK_SOFT }}>
              {/* SERVER items */}
            </div>
            <div
              style={{
                gridColumn: "5 / 9",
                fontSize: 10,
                lineHeight: "16px",
                color: INK_SOFT,
                textAlign: "center",
              }}
            >
              For clients &amp; operators
            </div>
            <div style={{ gridColumn: "9 / 13", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setShowGrid((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 10,
                  color: ACCENT,
                  padding: 0,
                  fontFamily: FONT,
                }}
              >
                {showGrid ? "Hide grid" : "Show grid"}
              </button>
            </div>
          </Band>
        </div>
      </div>
    </div>
  );
}
```

See [poster-layout.md](poster-layout.md) for content mapping.

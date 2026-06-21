# Sell Sheet Canvas Starter

Structural reference for `<repo>-project-story.canvas.tsx`. Read [sell-sheet-layout.md](sell-sheet-layout.md) and [swiss-design-principles.md](swiss-design-principles.md) first.

Copy grid helpers (`GridOverlay`, `Band`, constants) from [poster-starter.md](poster-starter.md) — do not duplicate a different layout system.

```tsx
import { useCanvasState } from "cursor/canvas";

// Same PAPER, INK, INK_SOFT, ACCENT, GRID_FIELD, COLS, BL, LH, GUTTER, MARGIN, MAXW, FONT
// Same GridOverlay, Band helpers as poster-starter.md

export default function ProjectStory() {
  const [showGrid, setShowGrid] = useCanvasState("showGridStory", false);

  const folio = { /* same as poster */ };
  const body = { fontSize: 13, lineHeight: `${LH}px`, margin: 0 };
  const label = { /* uppercase section label */ };

  return (
    <div style={{ background: PAPER, minHeight: "100%", fontFamily: FONT, color: INK }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: MARGIN, position: "relative" }}>
        {showGrid ? <GridOverlay /> : null}

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, columnGap: GUTTER, rowGap: BL * 3, position: "relative", zIndex: 1 }}>
          {/* Folio */}
          <Band>
            <div style={{ gridColumn: "1 / 5", ...folio }}>Project Story</div>
            <div style={{ gridColumn: "5 / 9", ...folio, color: INK_SOFT, textTransform: "none" }}>
              {/* owner audience */}
            </div>
            <div style={{ gridColumn: "9 / 13", ...folio, color: INK_SOFT, textTransform: "none", textAlign: "right" }}>
              Page 2
            </div>
          </Band>

          {/* Masthead + in one breath */}
          <Band>
            <div style={{ gridColumn: "1 / 9" }}>
              <div style={{ fontSize: 60, lineHeight: "60px", fontWeight: 700, letterSpacing: "-0.02em", marginLeft: "-0.04em" }}>
                Product
                <br />
                Name
              </div>
              <p style={{ ...body, marginTop: BL * 2, color: INK_SOFT, maxWidth: 480 }}>
                Emotional tagline — outcome, not feature list.
              </p>
            </div>
            <div style={{ gridColumn: "9 / 13" }}>
              <div style={label}>In one breath</div>
              <p style={{ ...body, color: INK }}>
                Script they can say aloud in 20 seconds.
              </p>
            </div>
          </Band>

          {/* Accent rule */}
          <Band style={{ paddingTop: BL, paddingBottom: BL }}>
            <div style={{ gridColumn: "1 / -1", height: 2, background: ACCENT }} />
          </Band>

          {/* Three-column body */}
          <Band>
            <div style={{ gridColumn: "1 / 5" }}>
              <div style={label}>Who it&apos;s for</div>
              <p style={body}>Ideal person and moment.</p>
            </div>
            <div style={{ gridColumn: "5 / 9" }}>
              <div style={label}>Why they&apos;ll care</div>
              <p style={body}>Outcomes in their language.</p>
            </div>
            <div style={{ gridColumn: "9 / 13" }}>
              <div style={label}>What to say</div>
              <p style={body}>1. &quot;First talking point.&quot;</p>
              <p style={{ ...body, marginTop: BL }}>2. &quot;Second talking point.&quot;</p>
              <p style={{ ...body, marginTop: BL }}>3. &quot;Third talking point.&quot;</p>
            </div>
          </Band>

          {/* What's real today */}
          <Band>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={label}>What&apos;s real today</div>
              <p style={body}>Honest capability line one.</p>
              <p style={{ ...body, marginTop: BL }}>Honest capability line two.</p>
            </div>
          </Band>

          {/* Differentiation + vision */}
          <Band>
            <div style={{ gridColumn: "1 / 7" }}>
              <div style={label}>How you&apos;re different</div>
              <p style={body}>Contrast vs alternatives.</p>
            </div>
            <div style={{ gridColumn: "7 / 13" }}>
              <div style={label}>The vision</div>
              <p style={body}>Ownership language — why you built this.</p>
            </div>
          </Band>

          {/* Footer */}
          <Band style={{ borderTop: `1px solid ${INK_SOFT}33`, paddingTop: BL * 2 }}>
            <div style={{ gridColumn: "1 / 5", fontSize: 10, lineHeight: "16px", color: INK_SOFT }}>
              {/* coming soon items */}
            </div>
            <div style={{ gridColumn: "5 / 9", fontSize: 10, lineHeight: "16px", color: INK_SOFT, textAlign: "center" }}>
              Pair with the App Guide (page 1)
            </div>
            <div style={{ gridColumn: "9 / 13", textAlign: "right" }}>
              <button type="button" onClick={() => setShowGrid((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: ACCENT, padding: 0, fontFamily: FONT }}>
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

See [sell-sheet-layout.md](sell-sheet-layout.md) for content mapping.

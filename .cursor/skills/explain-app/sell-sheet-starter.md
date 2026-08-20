# Sell Sheet Canvas Starter (Page 2)

Structural reference for `<repo>-project-story.canvas.tsx`. Read [sell-sheet-layout.md](sell-sheet-layout.md) and [swiss-design-principles.md](swiss-design-principles.md) first.

Copy grid helpers (`GridOverlay`, constants, `folio`/`meta`/`body`/`sectionLabel`/`numeral`/`subgrid` styles) from [poster-starter.md](poster-starter.md) — same visual system, do not invent a new one.

Key craft moves specific to page 2:

- **The tagline is the hero** — 64–80px display over 2–3 lines, closed with the red full stop; the product name sits in the folio
- Talking points get **giant numerals**, mirroring page 1's journeys
- "What's real today" is set in **two columns of 6**, includes one honest limitation
- Everything else follows page 1: ink-first copy, ink rules, single accent, flush-left, no negative margins

```tsx
import { useCanvasState } from "cursor/canvas";

// Same PAPER, INK, INK_SOFT, ACCENT, GRID_*, HAIRLINE, COLS, BL, LH, GUTTER,
// MARGIN, MAXW, FONT, folio, meta, body, sectionLabel, numeral, subgrid,
// GridOverlay as poster-starter.md.

export default function ProjectStory() {
  const [showGrid, setShowGrid] = useCanvasState("showGridStory", false);

  const talkingPoints = [
    "\u201CFirst speakable talking point — not a restatement of the tagline.\u201D",
    "\u201CSecond speakable talking point.\u201D",
    "\u201CThird speakable talking point.\u201D",
  ];
  const realToday = [
    ["Capability line one", "Capability line two", "Capability line three"],
    ["Capability line four", "Capability line five", "One honest limitation \u2014 coming next"],
  ];

  return (
    <div style={{ background: PAPER, minHeight: "100%", fontFamily: FONT, color: INK }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: MARGIN, position: "relative" }}>
        {showGrid ? <GridOverlay /> : null}

        <div style={{ ...subgrid, rowGap: LH, position: "relative", zIndex: 1 }}>
          {/* Folio + 2px ink rule */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={subgrid}>
              <div style={{ gridColumn: "1 / 5", ...folio }}>Project Story — 02</div>
              <div style={{ gridColumn: "5 / 10", ...meta }}>For the owner — say it out loud</div>
              <div style={{ gridColumn: "10 / 13", ...meta, textAlign: "right" }}>{/* product name */}</div>
            </div>
            <div style={{ height: 2, background: INK, marginTop: BL }} />
          </div>

          {/* Masthead — tagline as hero, red full stop */}
          <div style={{ gridColumn: "1 / 12" }}>
            <div style={{ fontSize: 72, lineHeight: "76px", fontWeight: 700, letterSpacing: "-0.03em", marginLeft: "-0.05em" }}>
              Emotional
              <br />
              outcome, not
              <br />
              features<span style={{ color: ACCENT }}>.</span>
            </div>
          </div>

          {/* In one breath + who it's for */}
          <div style={{ gridColumn: "1 / 8" }}>
            <div style={sectionLabel}>In one breath</div>
            <p style={{ ...body, fontSize: 14, maxWidth: "30em" }}>
              &ldquo;20-second script the owner can read aloud.&rdquo;
            </p>
          </div>
          <div style={{ gridColumn: "8 / 13" }}>
            <div style={sectionLabel}>Who it&rsquo;s for</div>
            <p style={body}>Ideal person.</p>
            <p style={body}>Their situation.</p>
            <p style={body}>The moment they need this.</p>
          </div>

          {/* Talking points — giant numerals */}
          <div style={{ gridColumn: "1 / -1", ...sectionLabel, marginBottom: 0 }}>What to say</div>
          {talkingPoints.map((t, i) => (
            <div key={t} style={{ gridColumn: `${i * 4 + 1} / ${i * 4 + 5}` }}>
              <div style={numeral}>{i + 1}</div>
              <p style={{ ...body, marginTop: BL, paddingRight: GUTTER }}>{t}</p>
            </div>
          ))}

          {/* What's real today — two columns of six */}
          <div style={{ gridColumn: "1 / -1", marginTop: BL }}>
            <div style={{ ...sectionLabel, marginBottom: 0 }}>What&rsquo;s real today</div>
            <div style={{ ...subgrid, marginTop: BL }}>
              {realToday.map((col, i) => (
                <div key={i} style={{ gridColumn: i === 0 ? "1 / 7" : "7 / 13" }}>
                  {col.map((line) => (
                    <p key={line} style={body}>{line}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Differentiation + vision */}
          <div style={{ gridColumn: "1 / 7", marginTop: BL }}>
            <div style={sectionLabel}>How you&rsquo;re different</div>
            <p style={{ ...body, paddingRight: GUTTER }}>Contrast vs alternatives.</p>
          </div>
          <div style={{ gridColumn: "7 / 13", marginTop: BL }}>
            <div style={sectionLabel}>The vision</div>
            <p style={body}>Ownership language — why you built this.</p>
          </div>

          {/* Footer */}
          <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${HAIRLINE}`, paddingTop: BL }}>
            <div style={subgrid}>
              <div style={{ gridColumn: "1 / 6", ...meta }}>{/* coming soon items */}</div>
              <div style={{ gridColumn: "6 / 10", ...meta }}>Pair with the App Guide — page 01</div>
              <div style={{ gridColumn: "10 / 13", textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => setShowGrid((v) => !v)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, lineHeight: "16px", color: ACCENT, padding: 0, fontFamily: FONT }}
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

See [sell-sheet-layout.md](sell-sheet-layout.md) for content mapping.

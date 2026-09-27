// Showcase: page 2 filled with the Hypher sample copy from examples.md.
// The test prepends poster-kit.md.
export default function ProjectStory() {
  const [showGrid, setShowGrid] = useCanvasState("showGridStory", false);

  const product = "Hypher";
  const talkingPoints = [
    "“Most builders lose ideas across ten tabs — you get them back before they vanish.”",
    "“You capture a thought in seconds; the app lays it out on a canvas.”",
    "“Share a read-only link when you want feedback, not the keys to your code.”",
  ];
  const pointSpan = spanFor(talkingPoints.length, { 3: 4 }, "Talking points");
  const realToday = [
    ["Sign in and land on a personal dashboard", "Capture notes and files into projects", "Organise work on a spatial canvas"],
    ["A daily digest of recent activity", "Share a read-only canvas link", "Billing is not in the app yet — coming next"],
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
              <div style={{ gridColumn: "10 / 13", ...meta, textAlign: "right" }}>{product}</div>
            </div>
            <div style={{ height: 2, background: INK, marginTop: BL - 2 }} />
          </div>

          {/* Masthead — tagline as hero (cols 1–7) + the page-1 figure (cols 8–12) */}
          <div style={{ gridColumn: "1 / 8" }}>
            <h1 style={{ margin: 0, fontSize: 72, lineHeight: "72px", fontWeight: 700, letterSpacing: "-0.03em", marginLeft: "-0.05em" }}>
              Your ideas,
              <br />
              finally in
              <br />
              one place<span style={{ color: ACCENT }}>.</span>
            </h1>
          </div>
          <div style={{ gridColumn: "8 / 13" }}>
            <HeroFigure seed={product} span={5} height={216} rings={5} dataRing={2} outputRing={4} />
          </div>

          {/* In one breath + who it's for */}
          <div style={{ gridColumn: "1 / 8" }}>
            <h2 style={{ ...sectionLabel, marginTop: 0 }}>In one breath</h2>
            <p style={{ ...body, maxWidth: "30em" }}>
              &ldquo;Hypher is a workspace for solo builders who are tired of losing ideas across tabs. You capture a thought in seconds, see it laid out on a canvas, and get a daily digest that keeps you moving.&rdquo;
            </p>
          </div>
          <div style={{ gridColumn: "8 / 13" }}>
            <h2 style={{ ...sectionLabel, marginTop: 0 }}>Who it&rsquo;s for</h2>
            <p style={body}>Solo builders and consultants</p>
            <p style={body}>Juggling several projects at once</p>
            <p style={body}>A great idea in the shower, gone by lunch</p>
          </div>

          {/* Talking points — giant numerals */}
          <h2 style={{ gridColumn: "1 / -1", ...sectionLabel, margin: 0 }}>What to say</h2>
          <ol style={{ gridColumn: "1 / -1", ...subgrid, listStyle: "none", margin: 0, padding: 0 }}>
            {talkingPoints.map((t, i) => (
              <li key={i} style={{ gridColumn: cols(i, pointSpan) }}>
                <div style={numeral}>{i + 1}</div>
                <p style={{ ...body, marginTop: BL, paddingRight: GUTTER }}>{t}</p>
              </li>
            ))}
          </ol>

          {/* What's real today — two columns of six */}
          <div style={{ gridColumn: "1 / -1", marginTop: BL }}>
            <h2 style={{ ...sectionLabel, margin: 0 }}>What&rsquo;s real today</h2>
            <div style={{ ...subgrid, marginTop: BL }}>
              {realToday.map((col, i) => (
                <div key={i} style={{ gridColumn: i === 0 ? "1 / 7" : "7 / 13" }}>
                  {col.map((line, j) => (
                    <p key={j} style={body}>{line}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Differentiation + vision */}
          <div style={{ gridColumn: "1 / 7", marginTop: BL }}>
            <h2 style={{ ...sectionLabel, marginTop: 0 }}>How you&rsquo;re different</h2>
            <p style={{ ...body, paddingRight: GUTTER }}>Not another notes app with folders. Not a team project manager. A spatial brain for one person who ships alone.</p>
          </div>
          <div style={{ gridColumn: "7 / 13", marginTop: BL }}>
            <h2 style={{ ...sectionLabel, marginTop: 0 }}>The vision</h2>
            <p style={body}>You built this because scattered thinking was costing you momentum. Now you have one place to capture, see patterns, and share — on your terms.</p>
          </div>

          {/* Footer */}
          <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${HAIRLINE}`, paddingTop: BL - 1 }}>
            <div style={subgrid}>
              <div style={{ gridColumn: "1 / 6", ...meta }}>Not built yet: in-app billing, GitHub sign-in, voice capture</div>
              <div style={{ gridColumn: "6 / 10", ...meta }}>Pair with the App Guide — page 01</div>
              <div style={{ gridColumn: "10 / 13" }}>
                <GridToggle on={showGrid} set={setShowGrid} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

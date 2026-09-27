// Showcase: page 1 filled with the Hypher sample copy from examples.md.
// The test prepends poster-kit.md.
export default function AppPoster() {
  const [showGrid, setShowGrid] = useCanvasState("showGridApp", false);

  const product = "Hypher";
  const journeys = [
    "Capture a note or file and pick a project",
    "Arrange it on the spatial canvas",
    "Read the daily digest in your inbox",
    "Share a read-only link to your canvas",
  ];
  const journeySpan = spanFor(journeys.length, { 2: 6, 3: 4, 4: 3 }, "Journeys");
  const screens: Array<{ name: string; preset: PresetName; highlight?: { block: string; role: Role } }> = [
    { name: "Landing", preset: "landing" },
    { name: "Capture", preset: "form", highlight: { block: "submit", role: "data" } },
    { name: "Spatial canvas", preset: "canvas", highlight: { block: "n2", role: "data" } },
    { name: "Dashboard", preset: "dashboard", highlight: { block: "feed", role: "output" } },
  ];
  const screenSpan = spanFor(screens.length, { 3: 4, 4: 3 }, "Screens");
  const stations: Station[] = [
    { label: "You capture", sub: "a thought, a file" },
    { label: "Saved live", sub: "stored in your database", role: "data" },
    { label: "On the canvas", sub: "organise and connect", branch: { label: "Share", sub: "read-only link" } },
    { label: "Digest out", sub: "a daily email", role: "output" },
  ];
  const whenYou: Array<[string, string]> = [
    ["When you save a note,", "it is written to your database and appears in every open tab within a second."],
    ["When the day ends,", "a short digest of what changed is written and sent to your inbox."],
    ["When you share,", "the app publishes a read-only copy of your canvas at a link."],
  ];
  const whenYouSpan = spanFor(whenYou.length, { 2: 6, 3: 4 }, "When-you lines");
  const bodyColumns: Array<{ label: string; lines: string[] }> = [
    { label: "The problem", lines: ["Builders split ideas across notes, tabs, and chats. By the time they sit down to work, half of it is gone."] },
    { label: "Connected", lines: ["Sign-in — your own private account", "Live database — saves as you type", "Daily digest — one email each evening"] },
  ];
  const bodySpan = spanFor(bodyColumns.length, { 2: 6 }, "Body columns");

  return (
    <div style={{ background: PAPER, minHeight: "100%", fontFamily: FONT, color: INK }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: MARGIN, position: "relative" }}>
        {showGrid ? <GridOverlay /> : null}

        <div style={{ ...subgrid, rowGap: LH, position: "relative", zIndex: 1 }}>
          {/* Folio + 2px ink rule — one cell so the rule hugs the type */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={subgrid}>
              <div style={{ gridColumn: "1 / 5", ...folio }}>App Guide — 01</div>
              <div style={{ gridColumn: "5 / 10", ...meta }}>How Hypher works, in plain English</div>
              <div style={{ gridColumn: "10 / 13", ...meta, textAlign: "right" }}>Web app · Solo builders</div>
            </div>
            {/* 16px folio + 6 + 2px rule = 24px, one leading unit */}
            <div style={{ height: 2, background: INK, marginTop: BL - 2 }} />
          </div>

          {/* Masthead — one line, 104–128px in multiples of 8, red full stop */}
          <div style={{ gridColumn: "1 / -1" }}>
            <h1 style={{ margin: 0, fontSize: 112, lineHeight: "112px", fontWeight: 700, letterSpacing: "-0.03em", marginLeft: "-0.05em" }}>
              {product}<span style={{ color: ACCENT }}>.</span>
            </h1>
          </div>

          {/* Purpose (cols 1–5) + hero figure (cols 7–12); the white below the purpose is the empty zone */}
          <div style={{ gridColumn: "1 / 6" }}>
            <p style={body}>A spatial project brain for solo builders — capture thoughts anywhere, watch them cluster on a canvas, and get a daily digest.</p>
          </div>
          <div style={{ gridColumn: "7 / 13" }}>
            <HeroFigure seed={product} span={6} height={232} rings={5} dataRing={2} outputRing={4} />
          </div>

          {/* Journeys — giant numerals */}
          <h2 style={{ gridColumn: "1 / -1", ...sectionLabel, margin: 0 }}>What you do</h2>
          <ol style={{ gridColumn: "1 / -1", ...subgrid, listStyle: "none", margin: 0, padding: 0 }}>
            {journeys.map((j, i) => (
              <li key={i} style={{ gridColumn: cols(i, journeySpan) }}>
                <div style={numeral}>{i + 1}</div>
                <p style={{ ...body, marginTop: BL, paddingRight: GUTTER }}>{j}</p>
              </li>
            ))}
          </ol>

          {/* What it looks like — screen schematics */}
          <h2 style={{ gridColumn: "1 / -1", ...sectionLabel, margin: 0, marginTop: BL }}>What it looks like</h2>
          {screens.map((s, i) => (
            <div key={i} style={{ gridColumn: cols(i, screenSpan) }}>
              <ScreenSchematic name={s.name} preset={s.preset} span={screenSpan} highlight={s.highlight} />
              <div style={{ ...folio, marginTop: BL }}>{s.name}</div>
            </div>
          ))}

          {/* Under the hood — SVG transit line + when-you lines */}
          <h2 style={{ gridColumn: "1 / -1", ...sectionLabel, margin: 0, marginTop: BL }}>
            Under the hood — what the code does
          </h2>
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

          {/* Body — label + copy share a cell */}
          {bodyColumns.map((col, i) => (
            <div key={i} style={{ gridColumn: cols(i, bodySpan), marginTop: BL }}>
              <h2 style={{ ...sectionLabel, marginTop: 0 }}>{col.label}</h2>
              {col.lines.map((line, j) => (
                <p key={j} style={{ ...body, paddingRight: GUTTER }}>{line}</p>
              ))}
            </div>
          ))}

          {/* Footer */}
          <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${HAIRLINE}`, paddingTop: BL - 1 }}>
            <div style={subgrid}>
              <div style={{ gridColumn: "1 / 6", ...meta }}>Not built yet: in-app billing, GitHub sign-in, voice capture</div>
              <div style={{ gridColumn: "6 / 10", ...meta }}>For the client handoff</div>
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

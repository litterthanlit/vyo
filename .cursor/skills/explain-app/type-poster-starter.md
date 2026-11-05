# Type Poster Starter (optional page 4)

Structural reference for `<repo>-type-poster.canvas.tsx`, the **vortex**: a poster whose picture is made of the product's own words. Read [type-poster-layout.md](type-poster-layout.md) first for when to make one and how to choose the words.

Edit only the data block (`POSTER`) and `LIVE`. The component derives every ring, angle and colour from it.

- `outside`: what the product replaces, in the reader's words. These become the grey, broken, drifting outer rings.
- `inside`: the product's loop, in order. These become the closed inner rings, which line up into columns.
- `accent`: the one thing that matters. It becomes the innermost ring and is the only red on the page.
- `LIVE`: `true` makes the vortex move. Outer rings drift and wobble, the inner loop turns slowly, and wherever the reader points, the mess straightens out and darkens to ink. `false` draws the still poster. The reader can flip it with the button under the drawing (`useCanvasState("liveType")`).

Motion stops for readers who ask for reduced motion, and `poster.mjs export` always draws the still frame.

```tsx
import { useCanvasState } from "cursor/canvas";

const LIVE = true;

const POSTER = {
  product: "Studio OS",
  tagline: "The whole studio, run from one place.",
  outside: ["client emails", "slack threads", "figma links", "timesheets", "invoices", "moodboards", "contracts", "feedback round 4", "final_final_v3", "who has the brief"],
  inside: ["brief", "concept", "design", "review", "approve", "ship", "invoice"],
  accent: "the work",
  centre: ["ONE PLACE", "FOR THE WHOLE STUDIO"],
  notes: {
    outside: "Outside: every tab a studio keeps open, and the brief nobody can find.",
    order: "Each ring in is a little more in order.",
    inside: "Inside: brief, design, review, ship, invoice. One loop, in one window.",
  },
  columns: [
    ["What comes in", "Briefs, client notes, files and feedback land in the project they belong to, not in five inboxes."],
    ["What it keeps", "Every project's brief, decisions, versions and hours, side by side, so anyone can pick it up."],
    ["What goes out", "Approved work, sent with the hours behind it and the invoice that follows."],
  ],
  folio: "Studio OS, 5 November 2026",
};

const PAPER = "#EAE8E2";
const INK = "#161616";
const MID = "#55534D";
const SOFT = "#A3A099";
const ACCENT = "#FF4F12";
const MONO = 'ui-monospace, "SF Mono", "Commit Mono", Menlo, Consolas, monospace';
const SANS = '"Helvetica Neue", Helvetica, "Inter Display", Arial, sans-serif';
const SERIF = 'Newsreader, "Iowan Old Style", Georgia, serif';

// The vortex is laid out in a fixed 840 × 740 space and scaled to the panel.
const U = { w: 840, h: 740, cx: 420, cy: 370, r0: 96, r1: 352, step: 19, size: 11 };

type Glyph = {
  ch: string; r: number; a: number; spin: number; chaos: number; tier: 0 | 1 | 2;
  hot: boolean; phase: number; x?: number; y?: number; k: number;
};

function layout(measure: (s: string) => number): Glyph[] {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rings = Math.floor((U.r1 - U.r0) / U.step) + 1;
  const glyphs: Glyph[] = [];
  let wo = 0;
  for (let i = 0; i < rings; i++) {
    const r = U.r1 - i * U.step, t = i / (rings - 1);
    const calm = t > 0.5, last = i === rings - 1;
    const words = last ? [POSTER.accent] : calm ? POSTER.inside : POSTER.outside;
    const cover = calm ? 1 : 0.42 + 0.58 * (t / 0.5);
    const pieces = calm ? 1 : 2 + Math.floor(rnd() * 3);
    const rot = calm ? -Math.PI / 2 : rnd() * Math.PI * 2;
    // Outer rings drift both ways and fastest at the edge; the loop turns as one so its columns stay lined up.
    const spin = calm ? 0.02 : (i % 2 ? 1 : -1) * (0.03 + 0.09 * (1 - t / 0.5));
    const chaos = calm ? 0 : 1 - t / 0.5;
    const tier = last ? 2 : t < 0.25 ? 0 : t < 0.5 ? 1 : 2;
    let wi = 0;
    for (let p = 0; p < pieces; p++) {
      const span = ((Math.PI * 2) / pieces) * cover;
      const a0 = rot + (p * Math.PI * 2) / pieces + (calm ? 0 : rnd() * 0.3);
      let text = "";
      for (;;) {
        const w = (calm ? words[wi++ % words.length] : words[wo++ % words.length]).toUpperCase();
        const next = text + (text ? "   " : "") + w;
        if (measure(next) * 1.35 > span * r && text) break;
        text = next;
      }
      if (calm) text += "   ";
      const chars = [...text];
      chars.forEach((ch, c) => {
        if (ch !== " ") glyphs.push({ ch, r, a: a0 + (c + 0.5) * (span / chars.length), spin, chaos, tier, hot: last, phase: rnd() * Math.PI * 2, k: 0 });
      });
    }
  }
  return glyphs;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const TIERS = [rgb(SOFT), rgb(MID), rgb(INK)];
const INK_RGB = rgb(INK);
const mix = (a: number[], b: number[], k: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;

// Draws the vortex into a canvas and, when live, keeps it moving. Returns a function that stops it.
function run(cv: HTMLCanvasElement, live: boolean) {
  const g = cv.getContext("2d")!;
  const font = (bold: boolean) => `${bold ? 700 : 400} ${U.size}px ${MONO}`;
  g.font = font(false);
  const glyphs = layout((s) => g.measureText(s).width);
  const still = !live || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: 0, y: 0, on: false };
  let scale = 1, m = 1, frame = 0;
  const start = performance.now();

  const fit = () => {
    const w = cv.clientWidth;
    scale = w / U.w;
    m = (devicePixelRatio || 1) * scale;
    cv.width = Math.round(U.w * m);
    cv.height = Math.round(U.h * m);
  };

  const draw = (now: number) => {
    const t = still ? 0 : (now - start) / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const q of glyphs) {
      const a = q.a + q.spin * t;
      const x = U.cx + Math.cos(a) * q.r, y = U.cy + Math.sin(a) * q.r;
      // Order where the reader points: glyphs within reach ease out of their wobble and darken to ink.
      const near = pointer.on ? Math.max(0, 1 - Math.hypot(x - pointer.x, y - pointer.y) / 140) : 0;
      q.k += (near - q.k) * (still ? 1 : 0.12);
      const loose = q.chaos * (1 - q.k);
      const wob = Math.sin(t * 1.3 + q.phase);
      const rr = q.r + loose * 2.5 * wob, aa = a + loose * 0.012 * Math.cos(t * 0.9 + q.phase);
      const c = Math.cos(aa + Math.PI / 2 + loose * 0.18 * wob), s = Math.sin(aa + Math.PI / 2 + loose * 0.18 * wob);
      g.setTransform(c * m, s * m, -s * m, c * m, (U.cx + Math.cos(aa) * rr) * m, (U.cy + Math.sin(aa) * rr) * m);
      g.font = font(q.hot);
      g.fillStyle = q.hot ? ACCENT : mix(TIERS[q.tier], INK_RGB, q.k);
      g.fillText(q.ch, 0, 0);
    }
    g.setTransform(m, 0, 0, m, 0, 0);
    g.fillStyle = ACCENT;
    g.font = `700 20px ${MONO}`;
    g.fillText(POSTER.centre[0], U.cx, U.cy - 4);
    g.fillStyle = MID;
    g.font = `400 11px ${MONO}`;
    g.fillText(POSTER.centre[1], U.cx, U.cy + 20);
    if (!still) frame = requestAnimationFrame(draw);
  };

  const move = (e: PointerEvent) => {
    const b = cv.getBoundingClientRect();
    pointer.x = (e.clientX - b.left) / scale;
    pointer.y = (e.clientY - b.top) / scale;
    pointer.on = true;
    if (still && live) draw(0);
  };
  const leave = () => {
    pointer.on = false;
    if (still && live) draw(0);
  };
  const resize = () => {
    fit();
    if (still) draw(0);
  };

  fit();
  if (live) {
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerleave", leave);
  }
  addEventListener("resize", resize);
  draw(start);
  return () => {
    cancelAnimationFrame(frame);
    cv.removeEventListener("pointermove", move);
    cv.removeEventListener("pointerleave", leave);
    removeEventListener("resize", resize);
  };
}

// A ref callback starts the drawing when the canvas mounts and stops it when React swaps the callback or unmounts.
function vortex(live: boolean) {
  let stop: (() => void) | undefined;
  return (cv: HTMLCanvasElement | null) => {
    stop?.();
    stop = cv ? run(cv, live) : undefined;
  };
}

const note = { position: "absolute" as const, width: "21%", fontFamily: MONO, fontSize: 12, lineHeight: "18px", color: MID, margin: 0 };

export default function TypePoster() {
  const [live, setLive] = useCanvasState("liveType", LIVE);
  const summary = `${POSTER.product}: rings of words. Outside, ${POSTER.outside.slice(0, 4).join(", ")} and more, scattered. Inside, the loop in order: ${POSTER.inside.join(", ")}. At the centre, ${POSTER.accent}.`;
  return (
    <div style={{ background: PAPER, color: INK, maxWidth: 840, margin: "0 auto", padding: "36px 48px 28px", boxSizing: "border-box", fontFamily: MONO }}>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
        <h1 style={{ margin: 0, fontFamily: SANS, fontWeight: 700, fontSize: "clamp(48px, 10vw, 84px)", lineHeight: 1.05, letterSpacing: "-0.035em" }}>
          {POSTER.product}<span style={{ color: ACCENT }}>.</span>
        </h1>
        <p style={{ margin: "28px 0 0", width: 230, fontFamily: SERIF, fontSize: 22, lineHeight: "28px", color: MID }}>{POSTER.tagline}</p>
      </header>

      <figure style={{ position: "relative", margin: "24px 0 0" }}>
        <canvas
          key={String(live)}
          ref={vortex(live)}
          role="img"
          aria-label={summary}
          data-vortex={live ? "live" : "still"}
          style={{ display: "block", width: "100%", aspectRatio: `${U.w} / ${U.h}`, cursor: live ? "crosshair" : "default", touchAction: "pan-y" }}
        />
        <p style={{ ...note, left: 0, top: 0 }}>{POSTER.notes.outside}</p>
        <p style={{ ...note, right: 0, top: 0, textAlign: "right" }}>{POSTER.notes.order}</p>
        <p style={{ ...note, left: 0, bottom: 0, color: INK }}>{POSTER.notes.inside}</p>
        <button
          data-chrome
          onClick={() => setLive(!live)}
          aria-pressed={live}
          style={{ position: "absolute", right: 0, bottom: 0, font: `12px ${MONO}`, color: INK, background: "transparent", border: `1px solid ${INK}`, borderRadius: 999, padding: "6px 12px", cursor: "pointer" }}
        >
          {live ? "Hold still" : "Bring to life"}
        </button>
      </figure>

      <div style={{ borderTop: `1px solid ${INK}`, marginTop: 24, paddingTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
        {POSTER.columns.map(([title, text]) => (
          <p key={title} style={{ margin: 0, fontSize: 12, lineHeight: "18px" }}>
            <b>{title}</b>
            <br />
            {text}
          </p>
        ))}
      </div>
      <footer style={{ display: "flex", justifyContent: "space-between", marginTop: 48, fontSize: 11, color: MID }}>
        <span>{POSTER.folio}</span>
        <span>Drawn by Vyo<span style={{ color: ACCENT }}>.</span></span>
      </footer>
    </div>
  );
}
```

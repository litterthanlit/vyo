// Ported from explorations/2026-10-29-type-posters/warm-start.html. The mockup set four lines at
// a 24px cell; four lines here use a 20px cell so the headline band fits above the footer.

// 5x7 letters, one string per row, "1" = a square.
const GLYPHS = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};
const COLS = 29, Y0 = 56;

export default {
  id: "warm-start",
  fits: "A state that changes over a sequence: cold to warm, empty to full, unknown to known. Short words warm up line by line.",
  themes: {
    light: { paper: "#F2F1ED", ink: "#141414", soft: "#8A8880", cold: "#A9B8C8", cool: "#5F7389", hot: "#FF4F12" },
  },
  notes: 2,
  slots: {
    lines: { kind: "words", min: 2, max: 4, each: 5, letters: true, prompt: "2 to 4 words of at most 5 letters, read top to bottom; the last one is the warm one (YOUR NEXT AGENT KNOWS)" },
    aside: { kind: "line", max: 110, prompt: "What changes, one or two sentences next to the product name" },
  },
  hotWords: (s) => s.lines.slice(-1),
  hotRule: "the last word of slots.lines",

  draw(spec, ctx) {
    const s = spec.slots;
    const footerTop = 1190 - ctx.footerHeight - 36;
    const band = footerTop - 28 - 120;
    const units = (s.lines.length - 1) * 9 + 7;
    const C = Math.min(24, Math.floor((band - 32 - Y0) / units));
    const X0 = Math.round((840 - COLS * C) / 2);
    const tones = [...["var(--cold)", "var(--cool)", "var(--ink)"].slice(0, s.lines.length - 1), "var(--hot)"];
    const glyphs = Object.fromEntries([...new Set(s.lines.join("").toUpperCase())].map((ch) => [ch, GLYPHS[ch]]));
    return `
<div class="t serif" data-block="headline" style="left:56px;top:${band}px;width:400px;font-size:34px;line-height:40px">${ctx.headline}</div>
<div class="t" data-block="masthead" style="left:496px;top:${band - 6}px;font-size:48px;line-height:54px;font-weight:700;letter-spacing:-.035em;white-space:nowrap;font-family:${ctx.mastFont}">${ctx.masthead}</div>
<div class="t" data-block="aside" style="left:496px;top:${band + 58}px;width:288px">${ctx.line(s.aside)}</div>
<div style="position:absolute;left:56px;top:${footerTop}px;width:728px;height:${ctx.footerHeight}px">${ctx.footer}</div>
<script>
(async () => {
  const D = ${ctx.json({ lines: s.lines, glyphs, tones })};
  await window.fontsReady;
  const S = document.querySelector(".sheet");
  window.fitWidth(S.querySelector("[data-block=masthead]"), 288);
  // the words in a grid of squares; they warm up line by line, cold to warm
  const C = ${C};
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  D.lines.forEach((src, li) => {
    const word = src.toUpperCase(), last = li === D.lines.length - 1;
    const line = document.createElement("div");
    line.className = "row";
    line.dataset.word = src;
    if (last) line.dataset.hot = "";
    Object.assign(line.style, { left: "${X0}px", top: ${Y0} + li * 9 * C + "px", width: ${COLS} * C + "px", height: 7 * C + "px" });
    for (let ci = 0; ci < ${COLS}; ci++) for (let ri = 0; ri < 7; ri++) {
      const letter = word[Math.floor(ci / 6)], col = ci % 6, on = letter && col < 5 && D.glyphs[letter][ri][col] === "1";
      const x = ci * C, y = ri * C, sq = document.createElement("div");
      if (on) {
        const s = Math.round(C * (14 + Math.round(rnd() * 8)) / 24);
        Object.assign(sq.style, { position: "absolute", left: x + (C - s) / 2 + "px", top: y + (C - s) / 2 + "px", width: s + "px", height: s + "px", background: D.tones[li] });
      } else {
        Object.assign(sq.style, { position: "absolute", left: x + C / 2 - 1.5 + "px", top: y + C / 2 - 1.5 + "px", width: "3px", height: "3px", background: "var(--ink)", opacity: .16 });
      }
      line.appendChild(sq);
    }
    S.appendChild(line);
  });
  window.drawn = true;
})();
</script>`;
  },
};

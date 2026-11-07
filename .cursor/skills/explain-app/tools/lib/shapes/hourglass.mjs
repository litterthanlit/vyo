// Ported from explorations/2026-10-29-type-posters/hourglass.html and hourglass-dark.html.
const TOP = 176, ROWS = 44, LH = 16, WAIST = 22, CX = 420;

export default {
  id: "hourglass",
  fits: "Many messy inputs squeezed into one thing, then handed on. Funnels, condensers, hand-offs.",
  themes: {
    light: { paper: "#EAE8E2", ink: "#161616", soft: "#8E8C84", mid: "#55534D", hot: "#FF4F12" },
    dark: { paper: "#0E1424", ink: "#ECEEF2", soft: "#4F5A74", mid: "#97A0B6", hot: "#FF5A1F" },
  },
  notes: 3,
  slots: {
    top: { kind: "words", min: 6, max: 12, each: 16, prompt: "What goes in: 6 to 12 short nouns in the user's words (rants, screenshots, chat exports)" },
    waist: { kind: "phrase", max: 16, prompt: "What it all becomes, 1 or 2 words (ONE NOTE)" },
    bottom: { kind: "words", min: 3, max: 8, each: 16, prompt: "Where it goes next: 3 to 8 nouns" },
    asideLeft: { kind: "line", max: 90, prompt: "What the top half is, one sentence" },
    asideRight: { kind: "line", max: 110, prompt: "What the waist is, one sentence; may start with a **bold phrase**" },
    asideBottom: { kind: "line", max: 90, prompt: "What the bottom half is, one sentence" },
  },
  hotWords: (s) => [...s.top, s.waist],
  hotRule: "a word from slots.top or slots.waist",

  draw(spec, ctx) {
    const s = spec.slots;
    const footerTop = 1190 - ctx.footerHeight - 36;
    // A tall footer (a not-built list on two lines) lifts the whole figure so its last row clears the hairline by 4px.
    const top = TOP + Math.min(0, footerTop - 4 - (TOP + ROWS * LH));
    const waistTop = top + WAIST * LH - 8;
    return `
<div class="t" data-block="masthead" style="left:50px;top:36px;font-size:84px;line-height:88px;font-weight:700;letter-spacing:-.035em;white-space:nowrap;font-family:${ctx.mastFont}">${ctx.masthead}</div>
<div class="t serif" data-block="headline" style="left:560px;top:64px;width:224px;font-size:22px;line-height:28px;letter-spacing:-.005em;color:var(--mid)">${ctx.headline}</div>
<div class="t" data-block="waist" data-hot style="left:${CX - 200}px;top:${waistTop}px;width:400px;text-align:center;font-size:26px;line-height:32px;font-weight:700;color:var(--hot);letter-spacing:.18em">${ctx.esc(s.waist.toUpperCase())}</div>
<div class="t" data-block="asideLeft" style="left:56px;top:${waistTop}px;width:190px;color:var(--mid)">${ctx.line(s.asideLeft)}</div>
<div class="t" data-block="asideRight" style="left:594px;top:${waistTop + 6}px;width:190px">${ctx.line(s.asideRight)}</div>
<div class="t" data-block="asideBottom" style="left:56px;top:${waistTop + 120}px;width:190px;color:var(--mid)">${ctx.line(s.asideBottom)}</div>
<div style="position:absolute;left:56px;top:${footerTop}px;width:728px;height:${ctx.footerHeight}px">${ctx.footer}</div>
<script>
(async () => {
  const D = ${ctx.json({ top: s.top, bottom: s.bottom, hot: spec.hot })};
  await window.fontsReady;
  const S = document.querySelector(".sheet");
  window.fitWidth(S.querySelector("[data-block=masthead]"), 490);
  const meas = document.createElement("canvas").getContext("2d"); meas.font = '400 12px "Commit Mono"';
  const width = (w) => meas.measureText(w.toUpperCase()).width;
  const isHot = (w) => window.hasWord(w, D.hot);
  // the hourglass: rows of real words, wide mess on top, one note at the waist, where it goes below
  const cursor = { top: 0, bottom: 0 };
  const pick = (list, key, w) => {
    for (let i = 0; i < list.length; i++) {
      const word = list[(cursor[key] + i) % list.length];
      if (width(word) <= w) { cursor[key] += i + 1; return word; }
    }
    return list[cursor[key]++ % list.length];
  };
  for (let r = 0; r < ${ROWS}; r++) {
    const t = (r - ${WAIST}) / (r < ${WAIST} ? ${WAIST} : ${ROWS - 1 - WAIST});
    const w = 70 + 660 * Math.pow(Math.abs(t), 1.15);
    if (Math.abs(r - ${WAIST}) <= 1) continue;
    const src = r < ${WAIST} ? pick(D.top, "top", w) : pick(D.bottom, "bottom", w);
    const word = src.toUpperCase();
    let k = Math.max(1, Math.round(w / (meas.measureText(word).width * 1.9))), plain, natural;
    do { plain = Array(k).fill(word).join("   "); natural = meas.measureText(plain).width; } while (natural > w && --k > 1);
    if (natural > w) { plain = word; natural = meas.measureText(plain).width; }
    const ls = Math.max(0, (w - natural) / Math.max(1, plain.length - 1));
    const hot = isHot(src);
    const e = document.createElement("div");
    e.className = "row";
    e.dataset.word = src;
    if (hot) e.dataset.hot = "";
    Object.assign(e.style, {
      fontSize: "12px", lineHeight: "16px", height: "16px",
      left: ${CX} - w / 2 + "px", top: ${top} + r * ${LH} + "px", width: Math.ceil(w + ls) + 1 + "px", letterSpacing: ls + "px",
      color: hot ? "var(--hot)" : r < ${WAIST} ? (Math.abs(t) > .5 ? "var(--soft)" : "var(--mid)") : "var(--ink)", fontWeight: hot ? 700 : 400,
    });
    e.textContent = plain.replace(/ /g, "\\u00a0");
    S.appendChild(e);
  }
  window.drawn = true;
})();
</script>`;
  },
};

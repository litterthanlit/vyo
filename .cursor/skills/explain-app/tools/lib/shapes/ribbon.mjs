// Ported from explorations/2026-10-29-type-posters/ribbon-dark.html. The footer takes the
// mockup's bottom band, so the ribbon runs 200 to 720 and the endpoints sit above the footer.
const Y0 = 200, Y1 = 720, LH = 14;

export default {
  id: "ribbon",
  fits: "Something travels between two places or tools. The ribbon is made of what travels.",
  themes: {
    dark: { paper: "#100E22", ink: "#F1F0F7", soft: "#7D7A99", hot: "#9284FF" },
  },
  notes: 3,
  slots: {
    leftLine: { kind: "phrase", max: 24, prompt: "Where it starts, a short sentence (Save in Claude Code.)" },
    rightLine: { kind: "phrase", max: 24, prompt: "Where it arrives, a short sentence (Resume in Codex.)" },
    travels: { kind: "words", min: 4, max: 10, each: 22, prompt: "What travels between them: 4 to 10 short phrases (the goal, decisions and why)" },
    aside: { kind: "line", max: 110, prompt: "What travels, one or two sentences; may start with a **bold phrase**" },
  },
  hotWords: (s) => s.travels,
  hotRule: "a word from slots.travels; its rows are set bright, the rest soft",

  draw(spec, ctx) {
    const s = spec.slots;
    const footerTop = 1190 - ctx.footerHeight - 36;
    const big = `font-family:${ctx.mastFont};font-weight:700;letter-spacing:-.025em;font-size:56px;line-height:56px`;
    return `
<div class="t" data-block="leftLine" style="left:56px;top:56px;width:470px;${big}">${ctx.esc(s.leftLine)}</div>
<div class="t" data-block="aside" style="left:560px;top:64px;width:224px">${ctx.line(s.aside)}</div>
<div class="t" data-block="masthead" style="left:56px;top:740px;font-size:48px;line-height:54px;font-weight:700;letter-spacing:-.035em;white-space:nowrap;font-family:${ctx.mastFont}">${ctx.masthead}</div>
<div class="t serif" data-block="headline" style="left:56px;top:804px;width:330px;font-size:22px;line-height:28px">${ctx.headline}</div>
<div class="t" data-block="rightLine" style="right:56px;top:764px;width:400px;text-align:right;${big}">${ctx.esc(s.rightLine)}</div>
<div style="position:absolute;left:56px;top:${footerTop}px;width:728px;height:${ctx.footerHeight}px">${ctx.footer}</div>
<script>
(async () => {
  const D = ${ctx.json({ travels: s.travels, hot: spec.hot })};
  await window.fontsReady;
  const S = document.querySelector(".sheet");
  window.fitWidth(S.querySelector("[data-block=masthead]"), 330);
  const meas = document.createElement("canvas").getContext("2d"); meas.font = '400 11px "Commit Mono"';
  // the ribbon: what travels from one place to the next, twisting from top left to bottom right
  const rows = Math.floor((${Y1} - ${Y0}) / ${LH});
  for (let r = 0; r < rows; r++) {
    const u = r / (rows - 1), y = ${Y0} + r * ${LH};
    const cx = 430 + Math.sin((u - 0.5) * Math.PI) * 200 + Math.sin(u * Math.PI * 2) * 30;
    const twist = Math.cos(u * Math.PI * 2.5);
    const w = 70 + 300 * Math.abs(twist);
    const src = D.travels[Math.floor(r / 3) % D.travels.length];
    const word = src.toUpperCase();
    let k = Math.max(1, Math.round(w / (meas.measureText(word).width * 1.6))), plain, natural;
    do { plain = Array(k).fill(word).join("  "); natural = meas.measureText(plain).width; } while (natural > w && --k > 1);
    if (natural > w) { plain = word; natural = meas.measureText(word).width; }
    const ww = Math.max(w, natural), ls = (ww - natural) / Math.max(1, plain.length - 1);
    const hot = window.hasWord(src, D.hot);
    const e = document.createElement("div");
    e.className = "row";
    e.dataset.word = src;
    if (hot) e.dataset.hot = "";
    Object.assign(e.style, {
      fontSize: "11px", lineHeight: "14px", height: "14px",
      left: cx - ww / 2 + "px", top: y + "px", width: Math.ceil(ww + ls) + 1 + "px", letterSpacing: ls + "px",
      color: hot ? "var(--hot)" : "var(--soft)", opacity: twist < 0 ? .5 : 1, fontWeight: hot ? 700 : 400,
    });
    e.textContent = plain.replace(/ /g, "\\u00a0");
    S.appendChild(e);
  }
  window.drawn = true;
})();
</script>`;
  },
};

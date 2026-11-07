// Ported from explorations/2026-10-29-type-posters/vyo-eye.html. The pupil widens to clear the
// product name, which is usually longer than "Vyo", and the iris widens with it.
const CX = 420, CY = 600, HW = 372, HH = 280, LH = 14;

export default {
  id: "eye",
  fits: "Something that reads or watches everything and focuses on one thing: monitors, readers, finders, advisers.",
  themes: {
    light: { paper: "#EEEBE4", ink: "#151515", soft: "#9A968C", mid: "#5C5952", hot: "#FF5A1F" },
  },
  notes: 3,
  slots: {
    lids: { kind: "words", min: 6, max: 12, each: 18, prompt: "What it reads: 6 to 12 short nouns (files, screens, readme, background jobs)" },
    iris: { kind: "words", min: 3, max: 6, each: 18, prompt: "What it sees or decides: 3 to 6 short phrases (what it does, who it's for)" },
    blurb: { kind: "line", max: 140, prompt: "What you do with it, one or two sentences, top right" },
  },
  hotWords: (s) => s.iris,
  hotRule: "a word from slots.iris",

  draw(spec, ctx) {
    const s = spec.slots;
    const footerTop = 1190 - ctx.footerHeight - 36;
    return `
<div class="t serif" data-block="headline" style="left:56px;top:52px;width:520px;font-size:40px;line-height:46px;letter-spacing:-.01em">${ctx.headline}</div>
<div class="t" data-block="blurb" style="left:600px;top:60px;width:184px;color:var(--mid)">${ctx.line(s.blurb)}</div>
<div class="t" data-block="masthead" style="left:${CX}px;top:${CY - 38}px;transform:translateX(-50%);font-size:72px;line-height:76px;font-weight:700;letter-spacing:-.035em;white-space:nowrap;font-family:${ctx.mastFont}">${ctx.masthead}</div>
<div style="position:absolute;left:56px;top:${footerTop}px;width:728px;height:${ctx.footerHeight}px">${ctx.footer}</div>
<script>
(async () => {
  const D = ${ctx.json({ lids: s.lids, iris: s.iris })};
  await window.fontsReady;
  const S = document.querySelector(".sheet");
  const mast = S.querySelector("[data-block=masthead]");
  window.fitWidth(mast, 260);
  const r = document.createRange(); r.selectNodeContents(mast);
  const PR = Math.max(66, r.getBoundingClientRect().width / 2 + 12), IR = Math.max(168, PR + 90);
  const meas = document.createElement("canvas").getContext("2d"); meas.font = '400 11px "Commit Mono"';
  // fill a run of width w with a word repeated and letter-spaced to fit exactly
  const run = (x, y, w, src, css, hot) => { if (w < 24) return;
    const word = src.toUpperCase();
    let k = Math.max(1, Math.round(w / (meas.measureText(word).width * 1.7))), plain, nat;
    do { plain = Array(k).fill(word).join("  "); nat = meas.measureText(plain).width; } while (nat > w && --k > 1);
    if (nat > w) { if (meas.measureText(word).width > w) return; plain = word; nat = meas.measureText(word).width; }
    const ls = (w - nat) / Math.max(1, plain.length - 1);
    const e = document.createElement("div");
    e.className = "row";
    e.dataset.word = src;
    if (hot) e.dataset.hot = "";
    Object.assign(e.style, { fontSize: "11px", lineHeight: "14px", height: "14px", left: x + "px", top: y + "px", width: Math.ceil(w + ls) + 1 + "px", letterSpacing: ls + "px" }, css);
    e.textContent = plain.replace(/ /g, "\\u00a0");
    S.appendChild(e); };
  // the eye: it reads everything (the lids) and sees what matters (the iris)
  let a = 0, b = 0;
  for (let y = ${CY - HH}; y <= ${CY + HH}; y += ${LH}) {
    const t = (y + ${LH / 2} - ${CY}) / ${HH}, half = ${HW} * (1 - t * t);
    const dy = Math.abs(y + ${LH / 2} - ${CY}), ih = dy < IR ? Math.sqrt(IR * IR - dy * dy) : 0, ph = dy < PR ? Math.sqrt(PR * PR - dy * dy) : 0;
    const lid = D.lids[a++ % D.lids.length], lidCss = { color: Math.abs(t) > .55 ? "var(--soft)" : "var(--mid)" };
    if (!ih) { run(${CX} - half, y, 2 * half, lid, lidCss); continue; }
    const ir = Math.min(ih, half), word = D.iris[b++ % D.iris.length], irCss = { color: "var(--hot)", fontWeight: 700 };
    run(${CX} - half, y, half - ir - 18, lid, lidCss); run(${CX} + ir + 18, y, half - ir - 18, lid, lidCss);
    if (ph) { run(${CX} - ir, y, ir - ph - 6, word, irCss, true); run(${CX} + ph + 6, y, ir - ph - 6, word, irCss, true); }
    else run(${CX} - ir, y, 2 * ir, word, irCss, true);
  }
  window.drawn = true;
})();
</script>`;
  },
};

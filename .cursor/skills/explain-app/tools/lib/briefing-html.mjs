// The briefing as one self-contained web page (CONTRACTS.md §7). Renders the same doc as renderText, so the
// words cannot drift between the two:
//
//   const doc = buildBriefing(changes, { receipts });
//   fs.writeFileSync("briefing.html", renderHtml(doc, { receipts, app: "Pantry", hashes: { before, after } }));
//
// One file, no network: no <script>, no <link>, no url(), no @import. Every string that comes from the doc is
// escaped. The look is the posters' (Swiss editorial): white paper, near-black ink, one red accent that is used
// only for the full stop after the title and the flag on "Worth a look" lines. Dark mode follows the system.

const fmt = (n) => n.toLocaleString("en-US");
const signed = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : "0");

/** Text → safe for element content and quoted attribute values. */
export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
const esc = escapeHtml;
const idOf = (s) => `h-${String(s).replace(/[^a-zA-Z0-9_-]/g, "-")}`;

const CSS = `
:root{--paper:#FFFFFF;--ink:#0A0A0A;--ink-soft:#5B6066;--hairline:rgba(10,10,10,.12);--accent:#E4002B;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#0A0A0A;--ink:#F2F2F2;--ink-soft:#9AA0A6;--hairline:rgba(242,242,242,.14)}}
:root[data-theme="dark"]{--paper:#0A0A0A;--ink:#F2F2F2;--ink-soft:#9AA0A6;--hairline:rgba(242,242,242,.14);color-scheme:dark}
:root[data-theme="light"]{color-scheme:light}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:400 16px/24px "Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
code,.where{font-family:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}
:focus-visible{outline:2px solid var(--ink);outline-offset:4px}
.page{max-width:1120px;margin:0 auto;padding:0 16px 64px}

header{padding:32px 0 0}
.folio{margin:0;font-size:11px;line-height:16px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}
h1{margin:48px 0 0;font-size:clamp(48px,10vw,96px);line-height:1;font-weight:700;letter-spacing:-.03em;overflow-wrap:anywhere}
h1.long{font-size:clamp(36px,7vw,64px)}
.stop{color:var(--accent)}
.lede{margin:24px 0 0;max-width:40rem;color:var(--ink-soft)}

.row{margin-top:48px;padding-top:16px;border-top:1px solid var(--hairline)}
.row>h2{margin:0 0 24px;font-size:13px;line-height:16px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.body{min-width:0}
.lead{margin:0;font-size:20px;line-height:32px;letter-spacing:-.01em}

.numbers{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--hairline)}
.num{background:var(--paper);padding:16px 16px 24px}
.num:nth-child(2n+1){padding-left:0}
.num dt{font-size:13px;line-height:16px;color:var(--ink-soft)}
.num dd{margin:8px 0 0}
.big{display:block;font-size:40px;line-height:48px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.delta{display:block;margin-top:4px;font-size:13px;line-height:16px;color:var(--ink-soft);font-variant-numeric:tabular-nums}

.items{list-style:none;margin:0;padding:0}
.items>li{padding:16px 0;border-top:1px solid var(--hairline)}
.items>li:first-child{padding-top:0;border-top:0}
.items>li:last-child{padding-bottom:0}
.item{transition:transform .16s ease}
.items>li:hover>.item{transform:translateX(2px)}
.item p{margin:0;overflow-wrap:anywhere}
.item.flagged{display:grid;grid-template-columns:16px minmax(0,1fr);column-gap:12px}
.flag{width:16px;height:16px;margin-top:4px;color:var(--accent)}

details{margin-top:8px}
summary{display:inline-flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;line-height:16px;color:var(--ink-soft);cursor:pointer;list-style:none}
summary::-webkit-details-marker{display:none}
summary::before{content:"+";display:inline-block;width:12px;text-align:center;font-weight:700}
details[open]>summary::before{content:"\\2212"}
.where{margin:8px 0 0;font-size:12px;line-height:20px;color:var(--ink-soft);white-space:pre-wrap;overflow-wrap:anywhere}
details[open]>.where{animation:reveal .18s ease-out}
@keyframes reveal{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:none}}

.caption{margin:24px 0 0;font-size:13px;line-height:16px;color:var(--ink-soft)}
.bars{list-style:none;margin:16px 0 0;padding:0}
.bar{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:baseline;gap:8px 16px;padding:12px 0 16px;border-top:1px solid var(--hairline)}
.bar-label{overflow-wrap:anywhere}
.bar-val{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.bar-delta{display:inline-block;min-width:4.5em;color:var(--ink-soft)}
.track{grid-column:1/-1;display:flex;height:8px;background:var(--hairline)}
.track i{display:block;height:100%}
.kept{background:var(--ink-soft)}
.added{background:var(--ink)}
.lost{border:1px solid var(--ink-soft);border-left:0}

.note{margin:0;max-width:40rem;color:var(--ink-soft)}
.hashes{margin:16px 0 0;font-size:12px;line-height:16px;color:var(--ink-soft);overflow-wrap:anywhere}
.hashes code{font-size:inherit}

@media (min-width:900px){
  .page{padding:0 32px 96px}
  header{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:24px;padding-top:48px}
  header>*{grid-column:1/-1}
  h1{margin-top:64px}
  .lede{grid-column:4/span 7;margin-top:32px}
  .row{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:24px;margin-top:80px}
  .row>h2{grid-column:1/span 3;margin:0}
  .row>.body{grid-column:4/span 7}
  .lead{font-size:24px}
  .numbers{grid-template-columns:repeat(3,minmax(0,1fr))}
  .num:nth-child(2n+1){padding-left:16px}
  .num:nth-child(3n+1){padding-left:0}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{transition:none!important;animation:none!important}
  .items>li:hover>.item{transform:none}
}
@media print{
  :root,:root[data-theme]{--paper:#FFFFFF;--ink:#000000;--ink-soft:#444444;--hairline:rgba(0,0,0,.35)}
  body{background:none}
  .page{max-width:none;padding:0}
  .row,.items>li,.bar{break-inside:avoid}
  .numbers{background:none}
  .num{background:none;border-top:1px solid var(--hairline)}
  .track,.track i,.stop,.flag{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`.trim();

const FLAG = '<svg class="flag" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 1.5v13" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.75 2h9L10.25 5.5 12.75 9h-9z" fill="currentColor"/></svg>';

// The big figure and the small line under it: "7" and "6 → 7 (+1)" (or "no change", or nothing for a first look).
function numberTile(n) {
  const big = fmt(n.after);
  let small = String(n.value ?? "");
  if (small === big) small = "";
  else if (small.startsWith(`${big} (`) && small.endsWith(")")) small = small.slice(big.length + 2, -1);
  return `<div class="num"><dt>${esc(n.label)}</dt><dd><span class="big">${esc(big)}</span>${small ? `<span class="delta">${esc(small)}</span>` : ""}</dd></div>`;
}

function itemHtml(item, { flagged, receipts }) {
  const where =
    receipts && item.where ? `<details><summary>Show me where</summary><p class="where">${esc(item.where)}</p></details>` : "";
  const text = `<div><p>${esc(item.text)}</p>${where}</div>`;
  return flagged
    ? `<li><div class="item flagged">${FLAG}${text}</div></li>`
    : `<li><div class="item">${text}</div></li>`;
}

// Size bars: grey is what was there, solid is what was added, outlined is what went. Widths are shares of the biggest part.
// On a first look nothing was there before, so the legend and the "+N" column would only repeat the number.
function barsHtml(bars) {
  const top = Math.max(1, ...bars.map((b) => Math.max(b.before, b.after)));
  const pct = (n) => `${Math.round((n / top) * 10000) / 100}%`;
  const compared = bars.some((b) => b.before > 0);
  const rows = bars.map((b) => {
    const kept = Math.min(b.before, b.after);
    const grew = Math.max(0, b.after - b.before);
    const shrank = Math.max(0, b.before - b.after);
    const change = !compared ? "" : b.delta > 0 ? `, up ${fmt(b.delta)} from ${fmt(b.before)}` : b.delta < 0 ? `, down ${fmt(-b.delta)} from ${fmt(b.before)}` : ", no change";
    const label = `${b.label}: ${fmt(b.after)} lines${change}`;
    const seg = (cls, n) => (n > 0 ? `<i class="${cls}" style="width:${pct(n)}"></i>` : "");
    return (
      `<li class="bar"><span class="bar-label">${esc(b.label)}</span>` +
      `<span class="bar-val">${esc(fmt(b.after))}${compared ? ` <span class="bar-delta">${esc(signed(b.delta))}</span>` : ""}</span>` +
      `<span class="track" role="img" aria-label="${esc(label)}">${seg("kept", kept)}${seg("added", grew)}${seg("lost", shrank)}</span></li>`
    );
  });
  const legend = compared ? "Lines of code, by part. Grey was there before, solid is new, outlined is gone." : "Lines of code, by part.";
  return `<p class="caption">${legend}</p><ol class="bars">${rows.join("")}</ol>`;
}

/**
 * doc (from buildBriefing) → a complete HTML page, as a string.
 * @param opts.receipts  show each line's files and witness chains in a <details> (the doc carries `where` only if it was built with receipts)
 * @param opts.app       the app's name, for the page title and the folio ("What changed in Pantry")
 * @param opts.hashes    { before, after }: the facts hashes that were compared, shown small at the foot
 */
export function renderHtml(doc, { receipts = false, app, hashes } = {}) {
  const name = app ? String(app) : "";
  const changed = doc.title === "What changed";
  const pageTitle = name ? (changed ? `What changed in ${name}` : `Where ${name} stands`) : String(doc.title);
  const h = (id) => idOf(id);

  const section = (id, title, inner) =>
    `<section class="row" aria-labelledby="${esc(h(id))}"><h2 id="${esc(h(id))}">${esc(title)}</h2><div class="body">${inner}</div></section>`;

  const parts = [];
  if (doc.short) parts.push(section("short", "The short version", `<p class="lead">${esc(doc.short)}</p>`));
  if (doc.numbers?.length) parts.push(section("numbers", "In numbers", `<dl class="numbers">${doc.numbers.map(numberTile).join("")}</dl>`));
  for (const s of doc.sections ?? []) {
    const flagged = s.id === "look";
    const list = `<ul class="items">${s.items.map((i) => itemHtml(i, { flagged: flagged || Boolean(i.flag), receipts })).join("")}</ul>`;
    parts.push(section(s.id, s.title, list + (s.bars?.length ? barsHtml(s.bars) : "")));
  }

  const compared = hashes && (hashes.before || hashes.after)
    ? `<p class="hashes">Compared scans <code>${esc(hashes.before ?? "")}</code> → <code>${esc(hashes.after ?? "")}</code></p>`
    : "";
  let footer = "";
  if (doc.footer) {
    footer = `<footer class="row" aria-labelledby="${esc(h("limits"))}"><h2 id="${esc(h("limits"))}">What I can’t see</h2><div class="body"><p class="note">${esc(doc.footer)}</p>${compared}</div></footer>`;
  } else if (compared) {
    footer = `<footer class="row"><div class="body">${compared}</div></footer>`;
  }

  const folio = name ? `${esc(name)} · Briefing` : "Briefing";
  const titleHtml = `${esc(doc.title)}<span class="stop">.</span>`;
  return (
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<meta name="color-scheme" content="light dark">\n` +
    `<title>${esc(pageTitle)}</title>\n<style>\n${CSS}\n</style>\n</head>\n<body>\n<div class="page">\n` +
    `<header>\n<p class="folio">${folio}</p>\n<h1${String(doc.title).length > 16 ? ' class="long"' : ""}>${titleHtml}</h1>\n<p class="lede">${esc(doc.lede)}</p>\n</header>\n` +
    `<main>\n${parts.join("\n")}\n</main>\n${footer}\n</div>\n</body>\n</html>\n`
  );
}

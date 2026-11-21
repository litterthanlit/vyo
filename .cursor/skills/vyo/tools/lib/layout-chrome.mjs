// Shared multi-layout poster chrome builder (`classic`, `editorial`, `blueprint`, `macro`) used by both covers
// and gallery plates. Emits strictly palette-safe DOM (only var(--paper), var(--ink), var(--hot) with data-hot,
// never rgba()) and keeps every [data-role] block a direct child of .sheet for clean `text-clear` measurement.
import { COVER, coverTemplate, coverSmallWidth, coverBlackWidth } from "./cover.mjs";

// The faces chrome sets its small text in. Ascent and descent are in em, from each font's hhea table: a line box of
// height L at size s puts the baseline (L - (asc + desc) s) / 2 + asc s below its top. Commit Mono advances every
// glyph 0.6em, so its widths are exact; Inter Medium's come from the template's advance table, without kerning.
const FACES = {
  inter: { css: "'Inter',sans-serif", asc: 1984 / 2048, desc: 494 / 2048, width: (text, size) => (coverSmallWidth(text) * size) / COVER.small },
  mono: { css: "'Commit Mono',monospace", asc: 0.9, desc: 0.2, width: (text, size) => text.length * (0.6 * size) },
};
const baselineIn = (lineHeight, size, face = FACES.inter) => (lineHeight - (face.asc + face.desc) * size) / 2 + face.asc * size;

/** The type a `.t` block takes unless it sets its own: Commit Mono on xerox, Inter Medium otherwise. */
export const chromeSmallType = (look) =>
  look === "xerox" ? { face: "mono", weight: 400, size: 10, lineHeight: COVER.lead } : { face: "inter", weight: 500, size: COVER.small, lineHeight: COVER.lead };
/** A type as CSS declarations. */
export const typeCss = (t) => `font-family:${FACES[t.face].css};font-weight:${t.weight};font-size:${t.size}px;line-height:${t.lineHeight}px`;
// The record's own type in the editorial and macro layouts, and in blueprint's title block.
const RECORD_MONO = { face: "mono", weight: 400, size: 10, lineHeight: 14 };
const RECORD_TITLE = { face: "mono", weight: 400, size: 9.5, lineHeight: 14 };

/**
 * Where each line of a block lands on the sheet, as the page sets it: `x` the left of its first glyph, `y` its
 * baseline, `top` its line box's top, `width`, `align` and `lineHeight`. `x` given is the block's CSS `left`, or
 * for `align: "right"` its right edge: a `white-space: pre` block shrinks to its widest line, so each line ends there.
 */
function setLines(lines, type, { align = "left", x, top }) {
  const face = FACES[type.face];
  return lines.map((text, i) => {
    const width = face.width(text, type.size);
    const lineTop = top + i * type.lineHeight;
    return { text, x: align === "right" ? x - width : x, y: lineTop + baselineIn(type.lineHeight, type.size, face), top: lineTop, width, align, lineHeight: type.lineHeight, size: type.size, face: type.face };
  });
}

/** The x and width of characters `from` to `to` of a set line. */
export function spanOf(line, from, to) {
  const face = FACES[line.face];
  return { x: line.x + face.width(line.text.slice(0, from), line.size), w: face.width(line.text.slice(from, to), line.size) };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const joinLines = (list) => list.map(esc).join("\n");

/** Pick up to `limit` top parts by share, always keeping the accent part visible if present. */
function topParts(parts, limit = 5) {
  if (!parts?.length) return [];
  const total = parts.reduce((s, p) => s + (p.loc ?? p.share ?? 0), 0) || 1;
  const norm = parts.map((p) => ({
    id: p.id,
    name: String(p.name ?? "").toLowerCase(),
    share: p.share !== undefined ? p.share : (p.loc ?? 0) / total,
    hot: !!p.hot,
  }));
  const sorted = [...norm].sort((a, b) => b.share - a.share);
  const picked = sorted.slice(0, limit);
  const hot = norm.find((p) => p.hot);
  if (hot && !picked.some((p) => p.hot)) picked[picked.length - 1] = hot;
  return picked;
}

/**
 * Build layout chrome HTML, measured text block coordinates, and optional canvas drafting chrome for any cover
 * or plate in one of the four gallery layouts: `classic`, `editorial`, `blueprint`, or `macro`. The `record`,
 * `headline` and `legend` blocks carry `set`, each line where the page puts it (`setLines`): anything drawn over
 * their words reads its place from there.
 */
export function buildLayoutChrome({ spec, parts = [], record, template, ground, look = "living", layout = "classic", format = "poster", series = "", subtitle = "" }) {
  const legendText = spec.figure?.texts?.find((t) => t.role === "legend")?.text ?? "";
  const T = template ?? coverTemplate({ name: spec.product.name, headline: spec.headline, legend: legendText, format, look, layout });
  const W = T.width;
  const H = T.height;
  const M = T.margin;
  const { small, lead, headlineX } = COVER;
  const recordLines = Array.isArray(record) ? record : [String(record ?? "")];
  const seriesNum = series || spec.series || "";
  const top = (baseline) => baseline - baselineIn(lead, small);
  const smallType = chromeSmallType(look);
  const withSet = (block, type = smallType, align = "left") => ({ ...block, set: setLines(block.lines, type, { align, x: align === "right" ? block.right : block.left, top: block.top }) });

  // Layout 1: classic — exact v1 layout for living, xerox, spin, and classic plates.
  if (layout === "classic" || !layout) {
    const vyo = coverSmallWidth("Vyo");
    const name = T.nameSize;
    const isOg = T.format === "og";
    const punk = look === "xerox" || look === "spin";
    const nameWeight = punk ? 900 : 600;
    const blocks = {
      record: { left: M, top: top(M + 10), lines: recordLines },
      headline: isOg
        ? { left: M, top: top(M + 10 + (recordLines.length + 1) * lead), lines: T.headline }
        : { left: M + headlineX, top: top(M + 10), lines: T.headline },
      series: { right: W - M, top: top(M + 10), number: seriesNum, rule: W - M - vyo - 10 },
      legend: { left: M, top: top(T.legendY + 10), lines: T.legend },
      name: { left: M - name * 0.05, top: T.base - baselineIn(name, name), size: name, track: T.track },
    };
    for (const k of ["record", "headline", "legend"]) blocks[k] = withSet(blocks[k]);
    const seriesHtml =
      look === "xerox" && format !== "og"
        ? ""
        : look === "spin"
          ? `<div class="t" data-block="series" data-owner="render" style="right:${W - blocks.series.right}px;top:${blocks.series.top - 2}px;background:var(--ink);color:var(--paper);padding:2px 8px;font-family:'Inter Display',sans-serif;font-weight:900;font-size:12px;letter-spacing:.04em;transform:rotate(-2deg)">VYO${blocks.series.number ? ` ${esc(blocks.series.number)}` : ""}</div>`
          : `<div class="t" data-block="series" data-owner="render" style="right:${W - blocks.series.right}px;top:${blocks.series.top}px">Vyo</div>
${blocks.series.number ? `<div data-owner="render" style="position:absolute;left:${blocks.series.rule}px;top:${COVER.margin + 0.5}px;width:1px;height:12px;background:var(--ink);opacity:.5"></div>` : ""}
${blocks.series.number ? `<div class="t" data-block="number" data-owner="render" style="right:${W - blocks.series.rule + 10}px;top:${blocks.series.top}px">${esc(blocks.series.number)}</div>` : ""}`;
    const html = `<div class="t" data-block="record" data-owner="render" style="left:${blocks.record.left}px;top:${blocks.record.top}px${look === "spin" ? ";transform:rotate(-1deg)" : ""}">${joinLines(blocks.record.lines)}</div>
<div class="t" data-block="headline" data-role="headline" data-owner="figure" style="left:${blocks.headline.left}px;top:${blocks.headline.top}px${look === "spin" ? ";transform:rotate(0.8deg)" : ""}">${joinLines(blocks.headline.lines)}</div>
${seriesHtml}
<div class="t" data-block="legend" data-role="legend" data-owner="figure" style="left:${blocks.legend.left}px;top:${blocks.legend.top}px">${joinLines(blocks.legend.lines)}</div>
<div class="t" data-block="name" data-owner="render" style="left:${blocks.name.left}px;top:${blocks.name.top}px;font-family:'Inter Display',sans-serif;font-weight:${nameWeight};font-size:${blocks.name.size}px;line-height:${blocks.name.size}px;letter-spacing:${(blocks.name.track * blocks.name.size).toFixed(2)}px">${esc(spec.product.name)}</div>`;
    return { html, blocks, canvasChrome: null };
  }

  // Layout 2: editorial — asymmetric Swiss gallery grid with oversized top-left title, archival top-right record,
  // hairline dividers, and a tabular part breakdown.
  if (layout === "editorial") {
    const isOg = T.format === "og";
    const nameSize = T.nameSize;
    const ruleW = isOg ? T.tableW : W - 2 * M;
    const tableLeft = isOg ? M : W - M - T.tableW;
    const tableTop = isOg ? T.tableTop : T.subTop;
    const rec = withSet({ right: W - M, top: M + 18, lines: recordLines }, RECORD_MONO, "right");
    const blocks = {
      name: { left: M - nameSize * 0.04, top: M - Math.round(nameSize * 0.08), size: nameSize, track: T.track },
      series: { right: W - M, top: M + 2, number: seriesNum },
      record: { left: Math.min(...rec.set.map((l) => l.x)), ...rec },
      headline: withSet({ left: M, top: T.subTop, lines: T.headline }),
      legend: withSet({ left: M, top: T.legendY, lines: T.legend }),
    };
    const breakdown = topParts(parts, 5);
    blocks.table = { left: tableLeft, top: tableTop, right: tableLeft + T.tableW, bottom: tableTop + breakdown.length * 15 };
    const rowsHtml = breakdown
      .map((p, idx) => {
        const pct = p.share < 0.005 ? "<1%" : `${Math.round(p.share * 100)}%`;
        const rowTop = tableTop + idx * 15;
        const swatch = p.hot
          ? `<span data-hot style="display:inline-block;width:5px;height:5px;margin-right:8px;background:var(--hot)"></span>`
          : `<span style="display:inline-block;width:5px;height:5px;margin-right:8px;background:var(--ink);opacity:.35"></span>`;
        return `<div data-owner="render" style="position:absolute;left:${tableLeft}px;top:${rowTop}px;width:${T.tableW}px;height:15px;display:flex;align-items:center;justify-content:space-between;font-family:'Commit Mono',monospace;font-size:9.5px;line-height:15px${p.hot ? ";font-weight:700" : ""}"><span>${swatch}${esc(p.name)}</span><span>${pct}</span></div>`;
      })
      .join("\n");
    const tagText = `VYO${seriesNum ? ` ${seriesNum}` : ""}`;
    const subHtml = subtitle
      ? `<div data-owner="render" style="position:absolute;right:${M}px;top:${T.legendY}px;font-family:'Commit Mono',monospace;font-size:9.5px;line-height:${lead}px;text-align:right;opacity:.68">${esc(subtitle)}</div>`
      : "";
    const html = `<div class="t" data-block="name" data-owner="render" style="left:${blocks.name.left}px;top:${blocks.name.top}px;font-family:'Inter Display',sans-serif;font-weight:900;font-size:${nameSize}px;line-height:${nameSize}px;letter-spacing:${(T.track * nameSize).toFixed(2)}px">${esc(spec.product.name)}</div>
<div class="t" data-block="series" data-owner="render" style="right:${M}px;top:${blocks.series.top}px;font-family:'Commit Mono',monospace;font-weight:700;font-size:10px;line-height:14px;letter-spacing:.08em;text-align:right">${esc(tagText)}</div>
<div class="t" data-block="record" data-owner="render" style="right:${W - blocks.record.right}px;top:${blocks.record.top}px;${typeCss(RECORD_MONO)};text-align:right">${joinLines(recordLines)}</div>
<div data-owner="render" style="position:absolute;left:${M}px;top:${T.ruleY}px;width:${ruleW}px;height:1px;background:var(--ink);opacity:.22"></div>
<div class="t" data-block="headline" data-role="headline" data-owner="figure" style="left:${blocks.headline.left}px;top:${blocks.headline.top}px">${joinLines(T.headline)}</div>
${rowsHtml}
<div data-owner="render" style="position:absolute;left:${M}px;top:${T.bottomRuleY}px;width:${ruleW}px;height:1px;background:var(--ink);opacity:.22"></div>
<div class="t" data-block="legend" data-role="legend" data-owner="figure" style="left:${blocks.legend.left}px;top:${blocks.legend.top}px">${joinLines(T.legend)}</div>
${subHtml}`;
    return { html, blocks, canvasChrome: null };
  }

  // Layout 3: blueprint — technical architectural drafting plate with perimeter frame, coordinate ticks,
  // compact header strip, and bottom-right architectural title block.
  if (layout === "blueprint") {
    const { frame, inner, headerBottom, titleBlock: tb } = T;
    const linesCount = parts.reduce((s, p) => s + (p.loc ?? 0), 0);
    const filesCount = parts.reduce((s, p) => s + (p.files ?? 0), 0);
    const nameSize = T.nameSize;
    const blocks = {
      name: { left: inner.x, top: inner.y - 2, size: nameSize, track: T.track },
      headline: withSet({ left: T.headlineX, top: T.headlineTop, lines: T.headline }),
      series: { right: inner.x + inner.w, top: inner.y + 3, number: seriesNum },
      legend: withSet({ left: inner.x, top: T.legendY, lines: T.legend }),
      record: withSet({ left: tb.x + 10, top: tb.y + 37, lines: recordLines }, RECORD_TITLE),
      titleBlock: { left: tb.x, top: tb.y, right: tb.x + tb.w, bottom: tb.y + tb.h },
    };
    const tagText = `VYO${seriesNum ? ` ${seriesNum}` : ""}`;
    const c1 = 116;
    const c2 = 190;
    const c3 = 258;
    const cellStyle = "position:absolute;top:" + (tb.y + 4) + "px;height:24px;overflow:hidden;font-family:'Commit Mono',monospace";
    const lblStyle = "font-size:7px;line-height:9px;letter-spacing:.08em;opacity:.56";
    const valStyle = "font-size:9px;line-height:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
    const subHtml = subtitle
      ? `<div data-owner="render" style="position:absolute;right:${W - (inner.x + inner.w)}px;top:${inner.y + 18}px;font-family:'Commit Mono',monospace;font-size:8.5px;line-height:12px;text-align:right;opacity:.62">${esc(subtitle)}</div>`
      : "";
    const html = `<div class="t" data-block="name" data-owner="render" style="left:${blocks.name.left}px;top:${blocks.name.top}px;font-family:'Inter Display',sans-serif;font-weight:900;font-size:${nameSize}px;line-height:${nameSize}px;letter-spacing:${(T.track * nameSize).toFixed(2)}px">${esc(spec.product.name)}</div>
<div class="t" data-block="headline" data-role="headline" data-owner="figure" style="left:${blocks.headline.left}px;top:${blocks.headline.top}px">${joinLines(T.headline)}</div>
<div class="t" data-block="series" data-owner="render" style="right:${W - blocks.series.right}px;top:${blocks.series.top}px;font-family:'Commit Mono',monospace;font-weight:700;font-size:10px;line-height:14px;letter-spacing:.08em;text-align:right">${esc(tagText)}</div>
${subHtml}
<div data-owner="render" style="position:absolute;left:${frame.x}px;top:${headerBottom}px;width:${frame.w}px;height:1px;background:var(--ink);opacity:.24"></div>
<div class="t" data-block="legend" data-role="legend" data-owner="figure" style="left:${blocks.legend.left}px;top:${blocks.legend.top}px">${joinLines(T.legend)}</div>
<div data-owner="render" style="position:absolute;left:${tb.x}px;top:${tb.y}px;width:${tb.w}px;height:1px;background:var(--ink);opacity:.28"></div>
<div data-owner="render" style="position:absolute;left:${tb.x}px;top:${tb.y}px;width:1px;height:${tb.h}px;background:var(--ink);opacity:.28"></div>
<div data-owner="render" style="position:absolute;left:${tb.x}px;top:${tb.y + 30}px;width:${tb.w}px;height:1px;background:var(--ink);opacity:.28"></div>
<div data-owner="render" style="position:absolute;left:${tb.x + c1}px;top:${tb.y}px;width:1px;height:30px;background:var(--ink);opacity:.24"></div>
<div data-owner="render" style="position:absolute;left:${tb.x + c2}px;top:${tb.y}px;width:1px;height:30px;background:var(--ink);opacity:.24"></div>
<div data-owner="render" style="position:absolute;left:${tb.x + c3}px;top:${tb.y}px;width:1px;height:30px;background:var(--ink);opacity:.24"></div>
<div data-owner="render" style="${cellStyle};left:${tb.x + 8}px;width:${c1 - 14}px"><div style="${lblStyle}">PROJECT</div><div style="${valStyle}">${esc(spec.product.name)}</div></div>
<div data-owner="render" style="${cellStyle};left:${tb.x + c1 + 8}px;width:${c2 - c1 - 14}px"><div style="${lblStyle}">COMMIT</div><div style="${valStyle}">${esc(spec.product.commit ?? "none")}</div></div>
<div data-owner="render" style="${cellStyle};left:${tb.x + c2 + 8}px;width:${c3 - c2 - 14}px"><div style="${lblStyle}">LINES</div><div style="${valStyle}">${esc(linesCount.toLocaleString("en-US"))}</div></div>
<div data-owner="render" style="${cellStyle};left:${tb.x + c3 + 8}px;width:${tb.w - c3 - 14}px"><div style="${lblStyle}">FILES</div><div style="${valStyle}">${esc(String(filesCount))}</div></div>
<div class="t" data-block="record" data-owner="render" style="left:${blocks.record.left}px;top:${blocks.record.top}px;${typeCss(RECORD_TITLE)}">${joinLines(recordLines)}</div>`;
    const canvasChrome = {
      kind: "blueprint",
      frame,
      inner,
      headerY: headerBottom,
      titleBlock: tb,
      box: T.box,
      cols: format === "og" ? 8 : 6,
      rows: format === "og" ? 4 : format === "square" ? 6 : 8,
    };
    return { html, blocks, canvasChrome };
  }

  // Layout 4: macro — full-bleed monumental crop with translucent ground-tinted corner plaques.
  const padX = 16;
  const padY = 12;
  const nameSize = T.nameSize;
  const nameW = coverBlackWidth(spec.product.name, nameSize, T.track);
  // Each plaque is sized from the widths its words are set at, in the type this look sets them in (`setLines`):
  // xerox sets the headline and legend in Commit Mono, wider than the Inter the template wrapped them by.
  const setWidth = (lines, type = smallType) => Math.max(0, ...setLines(lines, type, { x: 0, top: 0 }).map((l) => l.width));
  const hlW = setWidth(T.headline);
  const tlW = Math.ceil(Math.max(nameW, hlW)) + padX * 2 + 8;
  const tlH = Math.ceil(nameSize * 1.02) + 8 + Math.ceil(T.headline.length * lead) + padY * 2;
  const tl = { x: M, y: M, w: tlW, h: tlH };

  const tagText = `VYO${seriesNum ? ` ${seriesNum}` : ""}`;
  // The tag: Commit Mono 700 at 10px, tracked .08em.
  const tagW = tagText.length * (0.6 + 0.08) * 10;
  const trW = Math.max(180, Math.ceil(Math.max(setWidth(recordLines, RECORD_MONO), tagW)) + padX * 2 + 8);
  const trH = 18 + recordLines.length * RECORD_MONO.lineHeight + padY * 2;
  const tr = { x: W - M - trW, y: M, w: trW, h: trH };

  const lgW = setWidth(T.legend);
  const blW = Math.ceil(lgW) + padX * 2 + 8;
  const blH = Math.ceil(T.legend.length * lead) + padY * 2;
  const bl = { x: M, y: H - M - blH, w: blW, h: blH };

  const rec = withSet({ right: tr.x + tr.w - padX, top: tr.y + padY + 18, lines: recordLines }, RECORD_MONO, "right");
  const blocks = {
    name: { left: tl.x + padX, top: tl.y + padY - 2, size: nameSize, track: T.track },
    headline: withSet({ left: tl.x + padX, top: tl.y + padY + Math.ceil(nameSize * 1.02) + 6, lines: T.headline }),
    series: { right: tr.x + tr.w - padX, top: tr.y + padY, number: seriesNum },
    record: { left: Math.min(...rec.set.map((l) => l.x)), ...rec },
    legend: withSet({ left: bl.x + padX, top: bl.y + padY, lines: T.legend }),
    cards: { tl, tr, bl },
    // The paper wash each plaque lays over the figure, at the opacity the DOM card would use.
    washes: [tl, tr, bl].map((c) => ({ ...c, opacity: 0.86 })),
  };
  // data-card names the plaque so the checks can keep a plate's canvas labels from sliding under it. The plaque's
  // paper wash sits above the figure and below the words. On xerox the spot plate's overprint (the highlighter
  // marks, the archive stamp) must sit above the wash too, and the canvas is one layer under all the chrome, so
  // there the canvas paints the wash itself, between the print and the overprint, and the card is only its box.
  const wash = look === "xerox" ? "" : ";background:var(--paper);opacity:.86";
  const plaque = (c, name) =>
    `<div data-owner="render" data-card="${name}" style="position:absolute;left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px${wash}"></div>
<div data-owner="render" style="position:absolute;left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;border:1px solid var(--ink);opacity:.18;pointer-events:none"></div>`;
  const html = `${plaque(tl, "title")}
${plaque(tr, "record")}
${plaque(bl, "legend")}
<div class="t" data-block="name" data-owner="render" style="left:${blocks.name.left}px;top:${blocks.name.top}px;font-family:'Inter Display',sans-serif;font-weight:900;font-size:${nameSize}px;line-height:${nameSize}px;letter-spacing:${(T.track * nameSize).toFixed(2)}px">${esc(spec.product.name)}</div>
<div class="t" data-block="headline" data-role="headline" data-owner="figure" style="left:${blocks.headline.left}px;top:${blocks.headline.top}px">${joinLines(T.headline)}</div>
<div class="t" data-block="series" data-owner="render" style="right:${W - blocks.series.right}px;top:${blocks.series.top}px;font-family:'Commit Mono',monospace;font-weight:700;font-size:10px;line-height:14px;letter-spacing:.08em;text-align:right">${esc(tagText)}</div>
<div class="t" data-block="record" data-owner="render" style="right:${W - blocks.record.right}px;top:${blocks.record.top}px;${typeCss(RECORD_MONO)};text-align:right">${joinLines(recordLines)}</div>
<div class="t" data-block="legend" data-role="legend" data-owner="figure" style="left:${blocks.legend.left}px;top:${blocks.legend.top}px">${joinLines(T.legend)}</div>`;
  return { html, blocks, canvasChrome: null };
}

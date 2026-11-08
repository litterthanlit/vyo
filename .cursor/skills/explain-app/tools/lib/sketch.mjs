// `vyo sketch`: the figure as ASCII at 20px cells, laid out in Node with the page's own geometry and
// Commit Mono's fixed advance, so the agent sees rows, coverage, each region's widths and the floor before rendering.
import { SHEET, GRID, regionRows, fillRows, dotsLines, fixedMeasure } from "./geometry.mjs";
import { hasWord, PLACEHOLDER } from "./spec.mjs";
import { floorOf, fieldItems as layoutField, listItems, recordOf } from "./render.mjs";
import { frameOf, roleOf, textSize, lineHeight, ruleText, recordRect } from "./frame.mjs";
import { FIELDS } from "./fields/index.mjs";
import { regionParts } from "./parts.mjs";
import { figureStats, regionStats, SILHOUETTE, REGION, boxMessage, thinMessage } from "./check.mjs";

const CELL = 20;
const COLS = SHEET.width / CELL;
const ROWS = Math.ceil(SHEET.height / CELL);
const LETTERS = "ABCDEF";
function wrap(text, perLine) {
  const lines = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + 1 + word.length <= perLine) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** Where a text block's letters land, estimated from its role's line height and average advance. */
export function estimateText(t, spec, facts) {
  const role = roleOf(spec, t);
  const size = textSize(spec, t);
  const per = (frameOf(spec) === "swiss" && t.role === "label" && t.hot ? role.em + 0.06 : role.em) * size;
  const one = (text) => [text];
  const lines = {
    name: () => one(frameOf(spec) === "swiss" ? `${spec.product.name}.` : spec.product.name.toUpperCase()),
    headline: () => wrap(spec.headline, Math.max(1, Math.floor(t.w / per))),
  }[role.prints]?.() ?? (t.role === "list" ? (facts || !t.parts ? listItems(spec, t, facts) : ["x".repeat(12)]) : t.role === "rule" ? [ruleText(t)] : t.role === "label" ? one(t.text) : wrap(t.text.replace(/\*\*/g, ""), Math.max(1, Math.floor(t.w / per))));
  const width = Math.min(t.w, Math.max(...lines.map((l) => l.length)) * per);
  const left = t.align === "right" ? t.x + t.w - width : t.align === "center" ? t.x + (t.w - width) / 2 : t.x;
  return { id: t.id, left, top: t.y, right: left + width, bottom: t.y + lines.length * lineHeight(spec, t), lines: lines.length };
}

const placeholder = (list) => !Array.isArray(list) || list.some((w) => typeof w === "string" && w.trim().startsWith(PLACEHOLDER));

/** A field region's rows as the page lays them out, around the estimated text blocks. */
export function fieldItems(spec, region, facts, texts = spec.figure.texts.map((t) => estimateText(t, spec, facts))) {
  return layoutField(spec, region, facts, texts);
}

/**
 * The sketch of a spec whose figure geometry is valid; placeholder words count as one 10-letter word.
 * A figure with a field needs the facts its parts come from.
 * @returns {string}
 */
export function sketch(spec, facts) {
  const floor = floorOf(spec);
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(" "));
  const put = (r, c, ch) => r >= 0 && r < ROWS && c >= 0 && c < COLS && (grid[r][c] = ch);
  const loose = frameOf(spec) === "loose";
  const texts = spec.figure.texts.map((t) => estimateText(t, spec, facts));
  if (loose) texts.push({ id: "record", ...recordRect(recordOf(spec, facts)) });
  const rowRects = [];
  const dotRects = [];
  const fieldRects = [];
  const legend = [];
  const notes = [];
  let letter = 0;

  for (const region of spec.figure.regions) {
    if (region.kind === "field") {
      const mark = LETTERS[letter++];
      const items = fieldItems(spec, region, facts, texts);
      for (const it of items) {
        fieldRects.push({ left: it.x, top: it.y, right: it.x + it.width, bottom: it.y + it.height });
        for (let c = 0; c < COLS; c++) {
          const cx = c * CELL + CELL / 2;
          if (cx >= it.x && cx < it.x + it.width) put(Math.floor((it.y + it.height / 2) / CELL), c, it.hot ? "·" : mark);
        }
      }
      const parts = regionParts(region, facts);
      const drawn = new Set(items.map((i) => i.part));
      legend.push(`${mark} ${region.id} (${region.field}, ${parts.length} parts, ${new Set(items.map((i) => i.y)).size} rows)`);
      for (const p of parts.filter((q) => !drawn.has(q.id))) notes.push(`region ${region.id}: part "${p.name}" (${p.id}) is never drawn`);
      if (region.accent !== undefined && !parts.some((p) => p.hot)) notes.push(`region ${region.id}: accent ${region.accent} names no part`);
      continue;
    }
    if (region.kind === "dots") {
      for (const ln of dotsLines(region)) {
        dotRects.push({ left: ln.x, top: ln.y, right: ln.x + ln.width, bottom: ln.y + ln.height });
        for (let r = Math.floor(ln.y / CELL); r * CELL < ln.y + ln.height; r++) for (let c = Math.floor(ln.x / CELL); c * CELL < ln.x + ln.width; c++) put(r, c, "#");
      }
      legend.push(`# ${region.id} (dots, ${region.lines.length} lines)`);
      continue;
    }
    const mark = LETTERS[letter++];
    const words = placeholder(region.words) ? ["xxxxxxxxxx"] : region.words;
    const size = region.size || 12;
    const rows = regionRows(region, texts);
    const items = fillRows({ ...region, words }, rows, { measure: (s) => fixedMeasure(s, size), isHot: (w) => !!spec.hot && hasWord(w, spec.hot) });
    const pitch = GRID[size].pitch;
    for (const it of items) {
      const rect = { left: it.x, top: it.y, right: it.x + it.width, bottom: it.y + pitch };
      rowRects.push({ ...rect, region: region.id });
      for (let c = 0; c < COLS; c++) {
        const cx = c * CELL + CELL / 2;
        if (cx >= rect.left && cx < rect.right) put(Math.floor((it.y + pitch / 2) / CELL), c, it.hot ? "·" : mark);
      }
    }
    legend.push(`${mark} ${region.id} (${rows.length} rows)`);
    if (rows.length < 4) notes.push(`region ${region.id} has ${rows.length} rows; it needs at least 4`);
    const drawn = new Set(items.map((i) => i.word));
    const missing = words.filter((w) => !drawn.has(w));
    if (missing.length) notes.push(`region ${region.id}: ${missing.map((w) => `"${w}"`).join(", ")} may never be drawn`);
    const bottom = Math.max(...rows.map((r) => r.y + pitch), 0);
    if (bottom > floor) notes.push(`region ${region.id} reaches ${bottom - floor}px below the floor`);
  }

  for (const b of texts) {
    const r0 = Math.floor(b.top / CELL);
    const r1 = Math.max(r0, Math.ceil(b.bottom / CELL) - 1);
    const c0 = Math.floor(b.left / CELL);
    const c1 = Math.max(c0, Math.ceil(b.right / CELL) - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const edgeRow = r === r0 || r === r1;
        const edgeCol = c === c0 || c === c1;
        put(r, c, edgeRow && edgeCol ? "+" : edgeRow ? "-" : edgeCol ? "|" : " ");
      }
    }
    const label = b.id.slice(0, Math.max(0, c1 - c0 - 1));
    const lr = r1 > r0 + 1 ? r0 + 1 : r0;
    [...label].forEach((ch, i) => put(lr, c0 + 1 + i, ch));
    if (!loose && b.bottom > floor) notes.push(`text ${b.id} reaches ${Math.ceil(b.bottom - floor)}px below the floor`);
  }

  const footRow = loose ? ROWS - 1 : Math.floor(floor / CELL);
  if (!loose) for (let c = 0; c < COLS; c++) put(footRow, c, "=");

  const s = figureStats([...rowRects, ...fieldRects], dotRects, floor);
  const perRegion = regionStats(rowRects);
  for (const r of perRegion) {
    if (r.variety < REGION.variety) notes.push(boxMessage(r));
    if (r.width < REGION.width) notes.push(thinMessage(r));
  }
  const ok = (v, need) => (v >= need ? "ok" : "too low");
  const out = [
    ...grid.slice(0, footRow + 1).map((r) => r.join("").trimEnd()),
    "",
    `regions: ${legend.join(", ")}; · marks hot rows`,
    `texts: ${texts.map((b) => `${b.id} ${Math.round(b.left)},${Math.round(b.top)} to ${Math.round(b.right)},${Math.round(b.bottom)}`).join("; ")}`,
    loose ? "floor: the sheet's bottom edge (loose frame)" : `floor: ${floor}`,
    `${[s.coverage >= SILHOUETTE.coverage, s.height >= SILHOUETTE.height, s.width >= SILHOUETTE.width].every(Boolean) ? "" : "! "}coverage ${Math.round(s.coverage * 100)}% (needs ${Math.round(SILHOUETTE.coverage * 100)}%, ${ok(s.coverage, SILHOUETTE.coverage)}), height ${Math.round(s.height * 100)}% (needs ${Math.round(SILHOUETTE.height * 100)}%, ${ok(s.height, SILHOUETTE.height)}), width ${Math.round(s.width * 100)}% (needs ${Math.round(SILHOUETTE.width * 100)}%, ${ok(s.width, SILHOUETTE.width)})`,
    ...(perRegion.length ? perRegion.map((r) => `region ${r.id}: spread/mean ${r.variety.toFixed(2)} (needs ${REGION.variety}), ${Math.round(r.width)}px across on average (needs ${REGION.width})`) : fieldRects.length ? [] : ["regions: no fill rows"]),
    ...notes.map((n) => `! ${n}`),
  ];
  return out.join("\n") + "\n";
}

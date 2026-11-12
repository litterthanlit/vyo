// `vyo sketch` for a cover: the still the render will draw, measured in Node with the page's own module, as lines
// of numbers and a 280px picture with the orange shell, so a cover is judged before any browser runs.
import { SHEET } from "./geometry.mjs";
import { encodePng } from "./png.mjs";
import { COVER, COVER_GRID, COVER_FRAMES, coverCells, coverInkAlpha } from "./cover.mjs";
import { coverOf, coverBlocks } from "./cover-render.mjs";
import { coverFindings, COVER_LIMITS } from "./cover-report.mjs";

const pct = (n) => `${(Math.round(n * 1000) / 10).toFixed(1)}%`;
// The share of a glyph cell its ink covers, for the picture: a letter, a mark, a gap's dot, and the accent with its glow.
const INK = { letter: 0.3, mark: 0.22, gap: 0.08, hot: 0.55 };

/** The sketch's lines for a cover: the still, the strata and the shell, and one line per part. */
export function coverSketchLines(spec, facts) {
  const c = coverOf(spec, facts);
  const { model, still, shell, region } = c;
  const look = region.shape.like ? `the ready ${region.shape.like}` : region.shape.mask !== undefined ? "a traced mask" : `${region.shape.ops.length} drawn ops`;
  const strata = typeof region.strata === "string" ? region.strata : region.strata ? JSON.stringify(region.strata) : "outline (the default)";
  const order = model.order.map((i) => ({ ...model.parts[i], i }));
  const lines = [
    `cover: ${spec.ground} ground, ${look}, ${model.parts.length} parts; the still is frame ${still.frame} of ${COVER_FRAMES} (${Math.round(still.turned * 100)}% into the turn)`,
    `strata: ${strata}${model.strata.outline ? ", the accent the outer shell and the others inside it" : ""}`,
    ...(shell ? [`shell: the orange shell is ${Math.round(shell.px)}px thick, ${pct(shell.share)} of the code (good: ${COVER_LIMITS.thin}px or more, at most ${Math.round(COVER_LIMITS.share * 100)}%)`] : []),
    `parts, ${model.strata.outline ? "from the outline in" : "in strata order"}: share of the lines, share of the glyphs in the still, whole names in the still`,
    ...order.map((p) => `  ${p.hot ? "*" : " "} ${p.id.padEnd(Math.max(28, ...order.map((q) => q.id.length)))} ${p.name.padEnd(24)} ${pct(p.share).padStart(6)} ${pct(still.shares[p.i]).padStart(6)} ${String(still.whole[p.i]).padStart(4)}${p.share >= COVER.big && !still.whole[p.i] ? "  ! never whole" : ""}`),
  ];
  return lines;
}

/** Every cover finding the sketch can measure, by check id: the still's, and the shell's. */
export const coverSketchFindings = (spec, facts) => {
  const c = coverOf(spec, facts);
  return coverFindings(c, { facts, cells: (f) => coverCells(c.model, f) });
};

/** The still at a third of its size, 280px wide, drawn from its cells: the form in its tones, the accent in orange, the words as bars. */
export function coverSketchImage(spec, facts) {
  const { model, still } = coverOf(spec, facts);
  const { width: W, height: H } = SHEET;
  const S = 3;
  const [w, h] = [Math.ceil(W / S), Math.ceil(H / S)];
  const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  const [ground, ink, accent] = [rgb(model.colors.ground), rgb(model.colors.ink), rgb(model.colors.accent)];
  const amount = new Float32Array(w * h * 3);
  const weight = new Float32Array(w * h);
  const lay = (x0, y0, x1, y1, color, a) => {
    for (let y = Math.max(0, Math.floor(y0 / S)); y < Math.min(h, Math.ceil(y1 / S)); y++) {
      for (let x = Math.max(0, Math.floor(x0 / S)); x < Math.min(w, Math.ceil(x1 / S)); x++) {
        const cover = (Math.min(x1, (x + 1) * S) - Math.max(x0, x * S)) * (Math.min(y1, (y + 1) * S) - Math.max(y0, y * S)) / (S * S);
        if (cover <= 0) continue;
        const k = y * w + x;
        for (let c = 0; c < 3; c++) amount[k * 3 + c] += color[c] * a * cover;
        weight[k] += a * cover;
      }
    }
  };
  const { cols, cw, lh, x0 } = COVER_GRID;
  for (const c of coverCells(model, still.frame)) {
    const [x, y] = [x0 + (c.i % cols) * cw, Math.floor(c.i / cols) * lh];
    const hot = c.part === model.hot;
    const fill = hot && model.colors.fill ? model.colors.fill * (0.6 + 0.4 * c.v) * Math.max(0.5, c.fade) : 0;
    const a = fill || (hot ? INK.hot : c.kind === "mark" ? INK.mark : c.letter ? INK.letter : INK.gap) * (hot ? Math.max(0.5, c.fade) : coverInkAlpha(model, c.kind, c.v) * c.fade);
    lay(x, y, x + cw, y + lh, hot ? accent : ink, a);
  }
  const B = coverBlocks(spec, facts);
  const bar = (left, top, lines, size) => lines.forEach((t, i) => lay(left, top + i * COVER.lead + 3, left + t.length * size * 0.52, top + i * COVER.lead + 11, ink, 0.35));
  bar(B.record.left, B.record.top, B.record.lines, COVER.small);
  bar(B.headline.left, B.headline.top, B.headline.lines, COVER.small);
  bar(B.legend.left, B.legend.top, B.legend.lines, COVER.small);
  const name = B.name.size;
  lay(B.name.left + name * 0.05, B.name.top + name * 0.14, B.name.left + spec.product.name.length * name * 0.55, B.name.top + name * 0.86, ink, 0.45);
  const out = new Uint8Array(w * h * 3);
  for (let k = 0; k < w * h; k++) {
    const a = Math.min(1, weight[k]);
    for (let c = 0; c < 3; c++) out[k * 3 + c] = Math.round(ground[c] * (1 - a) + (weight[k] ? (amount[k * 3 + c] / weight[k]) * a : 0));
  }
  return encodePng(w, h, out);
}

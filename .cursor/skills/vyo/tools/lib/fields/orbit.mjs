// The orbit field: an architectural dependency constellation. Parts orbit by real import centrality (most-imported
// core near the center, outer screens on the rim), each disc sized by its share of lines, with dotted chord links
// tracing real cross-area imports. Pure: render inlines it, sketch imports it.
import { SHEET, clearOf } from "../geometry.mjs";
import { repeatTo, toneSet, depthTone } from "./wave.mjs";
import { poseOf } from "./pose.mjs";

export const ORBIT = { size: 6.4, pitch: 7.8 };
const ORBIT_RAMP = "-:=+#";

function orbitHash(a, b) {
  let x = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) ^ 0x5bd1e995;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * Architectural orbit constellation: discs sized by LOC, rings ranked by import centrality, chords for top ties.
 * @param {{ ties?: [number, number, number][], seed?: number, symbols?: boolean }} region
 * @param {{ id: string, name: string, loc: number, files: number, hot: boolean }[]} parts
 * @param {{ floor: number, blocks?: { left: number, top: number, right: number, bottom: number }[], measure: (t: string, s: number) => number, theme?: "light" | "dark", frame?: string }} opts
 */
export function orbitRows(region, parts, opts) {
  if (!parts.length) return [];
  const { floor, blocks = [], measure, theme = "dark", frame } = opts;
  const { size, pitch } = ORBIT;
  const pose = poseOf(region.seed);
  const tones = toneSet(theme, frame);
  const cw = Math.round(measure("M", size) * 20) / 20;
  const spacing = region.symbols ? 1.8 : 0.3;
  const n = parts.length;
  const totalLoc = parts.reduce((s, p) => s + Math.max(1, p.loc), 0);

  // Import centrality per part from real cross-area ties.
  const degree = new Float64Array(n);
  const ties = region.ties ?? [];
  for (const [i, j, w] of ties) {
    if (i >= 0 && i < n) degree[i] += w;
    if (j >= 0 && j < n) degree[j] += w;
  }

  // Sort parts by centrality (most connected near center) with deterministic tie-break by LOC.
  const ranked = parts.map((p, i) => ({ i, p, deg: degree[i], share: p.loc / totalLoc })).sort((a, b) => b.deg - a.deg || b.p.loc - a.p.loc || a.i - b.i);

  const cx = SHEET.width * 0.5;
  const cy = Math.min(floor * 0.52, SHEET.height * 0.52);
  const maxR = Math.min(SHEET.width * 0.41, floor * 0.36);
  const baseAngle = pose.identity ? -Math.PI / 2 : pose.rnd() * Math.PI * 2;

  // Assign radii (proportional to sqrt(share)) and orbital positions (core, inner ring, outer ring).
  const nodes = new Array(n);
  const innerCount = n <= 4 ? Math.max(0, n - 1) : Math.min(5, Math.ceil((n - 1) * 0.42));
  const outerCount = Math.max(0, n - 1 - innerCount);

  ranked.forEach((item, rank) => {
    const r = Math.max(28, Math.min(112, Math.round(28 + Math.sqrt(item.share) * 155)));
    let x = cx;
    let y = cy;
    if (rank === 0) {
      x = cx;
      y = cy;
    } else if (rank <= innerCount) {
      const a = baseAngle + ((rank - 1) / Math.max(1, innerCount)) * Math.PI * 2;
      const dist = maxR * 0.52;
      x = cx + Math.cos(a) * dist;
      y = cy + Math.sin(a) * dist;
    } else {
      const k = rank - 1 - innerCount;
      const a = baseAngle + Math.PI / Math.max(2, outerCount) + (k / Math.max(1, outerCount)) * Math.PI * 2;
      const dist = maxR * 0.96;
      x = cx + Math.cos(a) * dist;
      y = cy + Math.sin(a) * dist;
    }
    // Keep every disc inside sheet margins and above floor.
    const pad = r + 14;
    x = Math.max(pad, Math.min(SHEET.width - pad, x));
    y = Math.max(pad + 40, Math.min(floor - pad - 18, y));
    nodes[item.i] = { ...item, x, y, r };
  });

  // Gentle relaxation so orbital discs never overlap awkwardly.
  for (let pass = 0; pass < 18; pass++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const want = a.r + b.r + 18;
        if (d < want) {
          const push = (want - d) * 0.45;
          const [ux, uy] = [dx / d, dy / d];
          a.x = Math.max(a.r + 14, Math.min(SHEET.width - a.r - 14, a.x - ux * push));
          a.y = Math.max(a.r + 54, Math.min(floor - a.r - 22, a.y - uy * push));
          b.x = Math.max(b.r + 14, Math.min(SHEET.width - b.r - 14, b.x + ux * push));
          b.y = Math.max(b.r + 54, Math.min(floor - b.r - 22, b.y + uy * push));
        }
      }
    }
  }

  const out = [];

  // 1. Subtle architectural import chords between top connected pairs (drawn as crisp dotted glyph hops).
  const topTies = [...ties].sort((a, b) => b[2] - a[2]).slice(0, 14);
  for (const [i, j] of topTies) {
    const a = nodes[i];
    const b = nodes[j];
    if (!a || !b) continue;
    const hotLink = !!(a.p.hot || b.p.hot);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(4, Math.floor(dist / 12));
    const linkPart = a.p.hot ? a.p : b.p.hot ? b.p : a.p;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      // Skip dots that fall inside either endpoint disc.
      if (Math.hypot(px - a.x, py - a.y) < a.r + 6 || Math.hypot(px - b.x, py - b.y) < b.r + 6) continue;
      if (py < 24 || py + pitch > floor) continue;
      if (blocks.some((bl) => px + cw > bl.left - 12 && px < bl.right + 12 && py + pitch > bl.top - 12 && py < bl.bottom + 12)) continue;
      out.push({
        x: Math.round(px * 10) / 10,
        y: Math.round((py - pitch * 0.5) * 10) / 10,
        width: cw + 2,
        height: pitch,
        size,
        text: hotLink ? "+" : "·",
        spacing: 0,
        part: linkPart.id,
        word: linkPart.name,
        hot: hotLink,
        tone: hotLink ? tones.hot : "mid",
        weight: hotLink ? 700 : 400,
        alpha: hotLink ? 0.95 : 0.72,
      });
    }
  }

  // 2. Typographic orbital discs for every part, sized by share of lines.
  for (const nd of nodes) {
    const p = nd.p;
    const isHot = !!p.hot;
    const baseTone = isHot ? tones.hot : depthTone(p.id, theme, frame);
    const topY = Math.max(24, Math.floor((nd.y - nd.r) / pitch) * pitch);
    const botY = Math.min(floor - pitch, nd.y + nd.r);
    for (let y = topY; y <= botY; y += pitch) {
      const dy = y + pitch * 0.5 - nd.y;
      if (Math.abs(dy) >= nd.r) continue;
      const hw = Math.sqrt(nd.r * nd.r - dy * dy);
      const l = Math.max(0, nd.x - hw);
      const r = Math.min(SHEET.width - 1, nd.x + hw);
      if (r - l < (region.symbols ? 8 : 20)) continue;
      const runs = clearOf([[l, r]], y, pitch, blocks);
      const ringDepth = 1 - Math.abs(dy) / nd.r;
      for (const [rl, rr] of runs) {
        const width = rr - rl;
        let text;
        if (region.symbols) {
          const cnt = Math.max(1, Math.floor((width + spacing) / (cw + spacing)));
          let s = "";
          for (let k = 0; k < cnt; k++) {
            const u = (rl + k * (cw + spacing) - nd.x) / nd.r;
            const d = Math.max(0, 1 - Math.hypot(u, dy / nd.r));
            const sym = ORBIT_RAMP[Math.min(ORBIT_RAMP.length - 1, Math.floor((0.3 + d * 0.7) * ORBIT_RAMP.length))];
            s += orbitHash(nd.i * 53 + Math.round(y), k) < 0.14 ? " " : sym;
          }
          text = s.trimEnd();
        } else {
          const placed = repeatTo(p.name.toLowerCase(), Math.max(0, width - 4), cw, spacing);
          text = placed.text;
        }
        if (!text) continue;
        out.push({
          x: Math.round(rl * 10) / 10,
          y: Math.round(y * 10) / 10,
          width,
          height: pitch,
          size,
          text,
          spacing,
          part: p.id,
          word: p.name,
          hot: isHot,
          tone: baseTone,
          weight: isHot || ringDepth > 0.72 ? 700 : 400,
          alpha: isHot ? 0.98 : Math.round((0.64 + 0.36 * ringDepth) * 10) / 10,
        });
      }
    }
  }
  return out;
}

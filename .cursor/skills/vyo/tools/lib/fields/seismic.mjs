// The seismic field: Joy Division-style stacked codebase ridgelines. Each part is one ridge down the sheet;
// peak height encodes its share of lines, peak count its files, and peak sharpness its cross-area imports.
// Foreground ridges cleanly occlude background ridges (painter's horizon). Pure: render inlines it, sketch imports it.
import { SHEET, clearOf } from "../geometry.mjs";
import { repeatTo, toneSet } from "./wave.mjs";
import { poseOf } from "./pose.mjs";

export const SEISMIC = { size: 6.6, pitch: 8.0, marginX: 54, top: 130, bottom: 72 };
const SEISMIC_RAMP = "-:=+#";

function seismicHash(a, b) {
  let x = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) ^ 0x5bd1e995;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * Stacked codebase ridgelines, bottom-to-top occlusion so foreground ridges cleanly mask background ones.
 * @param {{ ties?: [number, number, number][], seed?: number, symbols?: boolean }} region
 * @param {{ id: string, name: string, loc: number, files: number, hot: boolean }[]} parts
 * @param {{ floor: number, blocks?: { left: number, top: number, right: number, bottom: number }[], measure: (t: string, s: number) => number, theme?: "light" | "dark", frame?: string }} opts
 */
export function seismicRows(region, parts, opts) {
  if (!parts.length) return [];
  const { floor, blocks = [], measure, theme = "dark", frame } = opts;
  const { size, pitch, marginX, top, bottom } = SEISMIC;
  const pose = poseOf(region.seed);
  const tones = toneSet(theme, frame);
  const cw = Math.round(measure("M", size) * 20) / 20;
  const spacing = region.symbols ? 1.8 : 0.35;
  const x0 = marginX;
  const x1 = SHEET.width - marginX;
  const spanW = x1 - x0;
  const n = parts.length;
  const totalLoc = parts.reduce((s, p) => s + Math.max(1, p.loc), 0);
  const maxLoc = Math.max(1, ...parts.map((p) => p.loc));

  // Cross-area import coupling per part boosts peak sharpness and central energy.
  const coupling = new Float64Array(n);
  for (const [i, j, w] of region.ties ?? []) {
    if (i >= 0 && i < n) coupling[i] += w;
    if (j >= 0 && j < n) coupling[j] += w;
  }
  const maxCouple = Math.max(1, ...coupling);

  // Baseline y for each part from top to bottom, with room for tall peaks at the top.
  const usableTop = Math.min(floor * 0.24, top + 60);
  const usableBot = floor - bottom;
  const stepY = n > 1 ? (usableBot - usableTop) / (n - 1) : 0;
  const maxAmp = Math.min(148, Math.max(54, stepY * 2.2));

  // Precompute ridge crest elevation y(i, col) across columns.
  const cols = Math.floor(spanW / 4);
  const crests = parts.map((p, idx) => {
    const base = usableTop + idx * stepY;
    const share = p.loc / maxLoc;
    const couple = coupling[idx] / maxCouple;
    const amp = maxAmp * (0.28 + 0.56 * Math.sqrt(share) + 0.16 * couple);
    const peaks = Math.min(7, Math.max(2, Math.round(1.5 + Math.sqrt(Math.max(1, p.files)))));
    const seedOff = pose.identity ? idx * 17 + 3 : Math.floor(pose.rnd() * 997) + idx * 31;
    const locs = Array.from({ length: peaks }, (_, k) => ({
      u: 0.18 + ((k + 0.35 + 0.3 * seismicHash(seedOff, k)) / peaks) * 0.64,
      w: 0.035 + 0.055 * seismicHash(seedOff + 5, k),
      a: 0.45 + 0.55 * seismicHash(seedOff + 11, k),
    }));
    const arr = new Float32Array(cols);
    for (let c = 0; c < cols; c++) {
      const u = c / Math.max(1, cols - 1);
      // Taper cleanly to flat shoulders at the left and right edges (classic pulsar silhouette).
      const env = Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.06) / 0.88)));
      const shoulder = env > 0 ? Math.pow(env, 1.4) : 0;
      let h = 0;
      for (const pk of locs) {
        const d = (u - pk.u) / pk.w;
        h += pk.a * Math.exp(-0.5 * d * d);
      }
      const jitter = (seismicHash(idx * 131 + c, seedOff) - 0.5) * 0.09;
      arr[c] = base - amp * shoulder * Math.min(1.25, h * 0.72 + Math.max(0, jitter));
    }
    return { base, arr, amp };
  });

  // Painter's algorithm bottom to top: maintain minimum (highest on page) y drawn so far per column.
  const horizon = new Float32Array(cols).fill(floor);
  const out = [];
  const depthBands = Math.max(3, Math.min(6, Math.round(stepY / pitch) + 1));

  for (let idx = n - 1; idx >= 0; idx--) {
    const p = parts[idx];
    const { base, arr } = crests[idx];
    const isHot = !!p.hot;
    const partShare = p.loc / totalLoc;
    // Ensure every part's crest peeks above the horizon at least slightly so every part stays readable.
    const visibleCrest = new Float32Array(cols);
    for (let c = 0; c < cols; c++) visibleCrest[c] = Math.min(arr[c], horizon[c] - pitch * 0.9);

    // Emit horizontal bands from the ridge's peak down toward its baseline, clipped to [visibleCrest, horizon].
    const minY = Math.min(...visibleCrest);
    const maxY = Math.min(base + pitch * 0.5, floor - pitch);
    const startRow = Math.floor(minY / pitch);
    const endRow = Math.min(Math.floor(maxY / pitch), startRow + depthBands + Math.ceil((base - minY) / pitch));

    for (let r = startRow; r <= endRow; r++) {
      const y = Math.round(r * pitch * 10) / 10;
      if (y < 24 || y + pitch > floor) continue;
      // Find contiguous x runs where this row lies between visibleCrest[c] and horizon[c].
      const rawRuns = [];
      let runStart = -1;
      for (let c = 0; c <= cols; c++) {
        const inside = c < cols && y >= visibleCrest[c] - pitch * 0.25 && y < horizon[c] - pitch * 0.15 && y <= base + pitch * 0.2;
        if (inside && runStart < 0) runStart = c;
        else if (!inside && runStart >= 0) {
          const l = x0 + runStart * 4;
          const rr = x0 + c * 4;
          if (rr - l >= (region.symbols ? 10 : 24)) rawRuns.push([l, rr]);
          runStart = -1;
        }
      }
      if (!rawRuns.length) continue;
      const runs = clearOf(rawRuns, y, pitch, blocks);
      // Distance below the crest sets the shading: bright sharp crest, softer shadowed valley below.
      const depthNorm = Math.min(1, Math.max(0, (y - minY) / Math.max(pitch, base - minY)));
      const alpha = isHot ? Math.round((1 - depthNorm * 0.18) * 10) / 10 : Math.round((1 - depthNorm * 0.62) * 10) / 10;
      const weight = isHot || depthNorm < 0.28 ? 700 : 400;
      const rowTone = isHot ? tones.hot : depthNorm < 0.28 ? "ink" : depthNorm < 0.68 ? "mid" : "soft";
      for (const [l, rr] of runs) {
        const width = rr - l;
        let text;
        if (region.symbols) {
          const count = Math.max(1, Math.floor((width + spacing) / (cw + spacing)));
          let s = "";
          for (let k = 0; k < count; k++) {
            const symIdx = Math.min(SEISMIC_RAMP.length - 1, Math.max(0, Math.floor((1 - depthNorm * 0.85) * SEISMIC_RAMP.length)));
            s += seismicHash(idx * 37 + r, k) < 0.18 && depthNorm > 0.3 ? " " : SEISMIC_RAMP[symIdx];
          }
          text = s.trimEnd();
        } else {
          const placed = repeatTo(p.name.toLowerCase(), Math.max(0, width - 4), cw, spacing);
          text = placed.text;
        }
        if (!text) continue;
        out.push({
          x: Math.round(l * 10) / 10,
          y,
          width: Math.max(width, text.length * cw),
          height: pitch,
          size,
          text,
          spacing,
          part: p.id,
          word: p.name,
          hot: isHot,
          tone: rowTone,
          weight,
          alpha: Math.min(1, Math.max(0.36, alpha + (partShare > 0.15 ? 0.05 : 0))),
        });
      }
    }
    // Update painter's horizon with this ridge's crest so higher (earlier) ridges stay cleanly occluded behind it.
    for (let c = 0; c < cols; c++) horizon[c] = Math.min(horizon[c], visibleCrest[c]);
  }
  return out;
}

// Real codebase facts -> ordered horizontal strata model for the luminous frame.
// Pure ESM, zero I/O. Every file count, LOC total, slice height, shear displacement,
// chromatic dispersion, fault row, and focal accent weight comes directly from facts.json.
import { matchGlob } from "./scan/glob.mjs";

/** Deterministic 32-bit FNV-1a hash matching f-luminous's strata model. */
export function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Build a predicate matching a file `(fp, info)` against one or more accent area IDs / globs. */
function makeAccentMatcher(accentIds) {
  const list = (Array.isArray(accentIds) ? accentIds : accentIds ? [accentIds] : [])
    .filter((id) => typeof id === "string" && id.trim().length > 0);
  if (!list.length) return () => false;

  return (fp, info) => {
    const area = info?.area || "area:.";
    const fileId = `area:${fp}`;
    for (const raw of list) {
      const id = raw.trim();
      if (id === area || id === fileId) return true;
      if (id === "area:.") {
        if (area === "area:.") return true;
        continue;
      }
      if (id.includes("*")) {
        if (matchGlob(id, area) || matchGlob(id, fileId)) return true;
        continue;
      }
      if (area.startsWith(`${id}/`)) return true;
      const prefix = id.startsWith("area:") ? id.slice(5) : id;
      if (prefix && (fp === prefix || fp.startsWith(`${prefix}/`))) return true;
    }
    return false;
  };
}

const ENTRY_PATH = /(^|\/)(index|main|cli|app|server|entry|bin|__init__|__main__|vyo)\.[^./]+$/i;
const ENTRY_AREA = /^area:(cmd|bin|cli|apps\/|app\/|packages\/[^/]+\/src\/commands)/i;

/**
 * Convert scanned codebase `facts` into row-snapped horizontal strata for the luminous optical mosaic.
 * @param {object} facts  Scanned facts.json object
 * @param {string | string[] | undefined} accentIds  One or more accent area IDs / globs
 * @param {{ pitch?: number, width?: number, height?: number, yStart?: number, seed?: number }} [opts]
 */
export function buildLuminousStrata(facts, accentIds, opts = {}) {
  const pitch = opts.pitch ?? 7;
  const width = opts.width ?? 840;
  const height = opts.height ?? 1190;
  const cols = Math.floor(width / pitch);
  const rows = Math.floor(height / pitch);
  const yStart = opts.yStart ?? 0.06;

  const filesObj = facts?.files || {};
  const allEntries = Object.entries(filesObj).filter(([, info]) => info && !info.gen);
  const fileEntries = allEntries.length ? allEntries : Object.entries(filesObj).filter(([, info]) => !!info);
  const keptSet = new Set(fileEntries.map(([fp]) => fp));
  const imports = (facts?.imports || []).filter(([src, dst]) => keptSet.has(src) && keptSet.has(dst));

  const isAccent = makeAccentMatcher(accentIds);
  const inDeg = new Map();
  const outDeg = new Map();
  const crossDeg = new Map();
  const accentEdges = new Map();

  for (const [src, dst] of imports) {
    outDeg.set(src, (outDeg.get(src) || 0) + 1);
    inDeg.set(dst, (inDeg.get(dst) || 0) + 1);
    const sInfo = filesObj[src];
    const dInfo = filesObj[dst];
    if (sInfo && dInfo && sInfo.area !== dInfo.area) {
      crossDeg.set(src, (crossDeg.get(src) || 0) + 1);
      crossDeg.set(dst, (crossDeg.get(dst) || 0) + 1);
    }
    if (sInfo && dInfo && (isAccent(src, sInfo) || isAccent(dst, dInfo))) {
      accentEdges.set(src, (accentEdges.get(src) || 0) + 1);
      accentEdges.set(dst, (accentEdges.get(dst) || 0) + 1);
    }
  }

  let totalLoc = 0;
  let accentLoc = 0;
  let accentFiles = 0;

  const enriched = fileEntries.map(([fp, info]) => {
    const loc = Math.max(0, Number(info.loc) || 0);
    totalLoc += loc;
    const isAcc = isAccent(fp, info);
    if (isAcc) {
      accentLoc += loc;
      accentFiles++;
    }
    const ind = inDeg.get(fp) || 0;
    const outd = outDeg.get(fp) || 0;
    const xdeg = crossDeg.get(fp) || 0;
    const accTouch = accentEdges.get(fp) || 0;
    const area = info.area || "area:.";

    let layer = 3;
    if (isAcc) layer = 1;
    else if (ENTRY_AREA.test(area) || (area === "area:." && ENTRY_PATH.test(fp)) || (outd >= 2 && outd > ind * 1.5)) layer = 0;
    else if (accTouch > 0 || xdeg > 0) layer = 2;

    return {
      path: fp,
      area,
      loc,
      inDeg: ind,
      outDeg: outd,
      totalDeg: ind + outd,
      crossDeg: xdeg,
      accentTouch: accTouch,
      isAccent: isAcc,
      layer,
      hash: hashStr(fp),
    };
  });

  enriched.sort((a, b) => {
    if (a.layer !== b.layer) return a.layer - b.layer;
    if (a.layer === 0) return b.outDeg - a.outDeg || b.loc - a.loc || a.path.localeCompare(b.path);
    if (a.layer === 1) {
      const scoreA = a.loc * 0.55 + a.crossDeg * 85 + a.totalDeg * 25;
      const scoreB = b.loc * 0.55 + b.crossDeg * 85 + b.totalDeg * 25;
      return scoreB - scoreA || a.path.localeCompare(b.path);
    }
    if (a.area !== b.area) return a.area.localeCompare(b.area);
    return b.loc - a.loc || a.path.localeCompare(b.path);
  });

  const seed = opts.seed !== undefined
    ? (opts.seed >>> 0)
    : hashStr(`${facts?.hash || facts?.repo?.name || "luminous"}:${fileEntries.length}:${totalLoc}:${imports.length}`);

  if (!enriched.length) {
    return {
      totalFiles: 0,
      totalLoc: 0,
      totalImports: 0,
      accentFiles: 0,
      accentLoc: 0,
      slices: [],
      faultRows: [],
      topRows: [],
      accentSpan: { minY: 0.16, midY: 0.32, maxY: 0.48 },
      cols,
      rows,
      pitch,
      seed,
    };
  }

  const maxLoc = Math.max(1, ...enriched.map((f) => f.loc));
  const maxCross = Math.max(1, ...enriched.map((f) => f.crossDeg));
  const maxDeg = Math.max(1, ...enriched.map((f) => f.totalDeg));

  const Y_END = 1.0;
  const span = Y_END - yStart;

  // Group very small peripheral files in large repos so strata remain rhythmic & sculptural.
  const bands = [];
  const mergeLimit = enriched.length > 150 ? 480 : enriched.length > 45 ? 210 : 80;
  const smallThresh = enriched.length > 150 ? 160 : 75;
  for (const f of enriched) {
    const prev = bands[bands.length - 1];
    if (
      enriched.length > 45 &&
      f.layer >= 2 &&
      f.loc < smallThresh &&
      prev &&
      prev.layer === f.layer &&
      prev.area === f.area &&
      prev.loc < mergeLimit
    ) {
      prev.loc += f.loc;
      prev.inDeg += f.inDeg;
      prev.outDeg += f.outDeg;
      prev.totalDeg += f.totalDeg;
      prev.crossDeg += f.crossDeg;
      prev.accentTouch += f.accentTouch;
      prev.files.push(f.path);
    } else {
      bands.push({ ...f, files: [f.path] });
    }
  }

  const weights = bands.map((b) => {
    const locW = Math.pow(Math.max(b.loc, 12), 0.76);
    const layerBreath = b.layer === 0 ? 0.85 : b.layer === 1 ? 1.08 : b.layer === 2 ? 1.18 : 1.30;
    return locW * layerBreath;
  });
  const totalW = weights.reduce((s, w) => s + w, 0) || 1;

  let cursor = yStart;
  const slices = bands.map((b, idx) => {
    const hNorm = (weights[idx] / totalW) * span;
    const y0 = cursor;
    const y1 = idx === bands.length - 1 ? Y_END : cursor + hNorm;
    cursor = y1;

    const crossNorm = Math.min(1, b.crossDeg / Math.max(3, maxCross * 0.6));
    const degNorm = Math.min(1, b.totalDeg / Math.max(5, maxDeg * 0.65));
    const locNorm = Math.min(1, b.loc / maxLoc);

    const flow = b.outDeg - b.inDeg;
    const dir = flow !== 0 ? Math.sign(flow) : b.hash & 1 ? 1 : -1;
    const alt = idx % 2 === 0 ? 1 : -1;
    const signedDir = Math.abs(flow) >= 2 ? dir : alt * dir;

    const shearMag = 0.014 + crossNorm * 0.070 + degNorm * 0.026 + ((b.hash % 100) / 100) * 0.018;
    const shearX = signedDir * shearMag;

    // Chromatic dispersion in 1x pixels driven by real cross-area import coupling.
    const disp = 2.4 + crossNorm * 11.5 + degNorm * 4.8 + (b.isAccent ? 3.5 : 0);
    const energy = 0.48 + locNorm * 0.38 + crossNorm * 0.34 + (b.isAccent ? 0.52 : 0);

    const midV = 0.5 * (y0 + y1);
    const subSlices =
      midV < 0.55 && (b.isAccent || crossNorm > 0.30 || hNorm > 0.04)
        ? Math.min(4, Math.max(2, Math.round(1 + crossNorm * 2.4 + hNorm * 26)))
        : 1;

    return {
      index: idx,
      label: b.path,
      area: b.area,
      layer: b.layer,
      fileCount: b.files.length,
      loc: b.loc,
      inDeg: b.inDeg,
      outDeg: b.outDeg,
      crossDeg: b.crossDeg,
      isAccent: b.isAccent,
      y0,
      y1,
      midV,
      locNorm,
      crossNorm,
      degNorm,
      shearX,
      disp,
      energy,
      subSlices,
      seed: b.hash,
    };
  });

  // Architectural layer transition rows (used as 1-row fault cuts on alabaster).
  const faultSet = new Set();
  let prevLayer = slices[0]?.layer ?? 0;
  for (const s of slices) {
    if (s.layer !== prevLayer) {
      const fr = Math.round(s.y0 * rows);
      if (fr > 38 && fr < rows - 10) faultSet.add(fr);
      prevLayer = s.layer;
    }
  }
  const faultRows = [...faultSet].sort((a, b) => a - b);

  const accentBands = slices.filter((s) => s.isAccent);
  const accentMinY = accentBands.length ? accentBands[0].y0 : 0.16;
  const accentMaxY = accentBands.length ? accentBands[accentBands.length - 1].y1 : 0.48;
  const accentMidY = 0.5 * (accentMinY + accentMaxY);

  const topRows = [...slices]
    .sort((a, b) => b.crossNorm * 2 + b.degNorm + b.locNorm - (a.crossNorm * 2 + a.degNorm + a.locNorm))
    .slice(0, 6)
    .map((s) => ({
      label: s.label,
      area: s.area,
      midV: s.midV,
      row: Math.min(rows - 1, Math.max(0, Math.round(s.midV * rows))),
      loc: s.loc,
      crossDeg: s.crossDeg,
      isAccent: s.isAccent,
      energy: s.energy,
      seed: s.seed,
    }));

  return {
    totalFiles: fileEntries.length,
    totalLoc,
    totalImports: imports.length,
    accentFiles,
    accentLoc,
    slices,
    faultRows,
    topRows,
    accentSpan: { minY: accentMinY, midY: accentMidY, maxY: accentMaxY },
    cols,
    rows,
    pitch,
    seed,
  };
}

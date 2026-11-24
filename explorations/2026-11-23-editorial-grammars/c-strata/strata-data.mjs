// Real codebase facts -> ordered horizontal strata model for Exploration C (c-strata).
// No hardcoded fake stats: every count, band height, shear, and chromatic energy comes from the facts JSON.

import fs from "node:fs";

/** Deterministic FNV-1a 32-bit hash for reproducible organic seeding from real codebase facts. */
export function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Build an ordered strata model from a vyo-scanned facts JSON.
 *
 * @param {string} factsPath - Path to facts JSON ({ files, imports })
 * @param {object} spec - Target poster spec:
 *   - id: string
 *   - title: string[] (2 lines)
 *   - subtitle: string[] (3-4 lines)
 *   - accentCoreName: string (e.g. "THE DRAWING ENGINE")
 *   - colophonName: string (e.g. "VYO")
 *   - classifyLayer(filePath, fileInfo): number (0=entry, 1=accent core, 2=primary runtime, 3=secondary/utilities)
 *   - isAccent(filePath, fileInfo): boolean
 */
export function buildStrataModel(factsPath, spec) {
  const raw = JSON.parse(fs.readFileSync(factsPath, "utf8"));
  const fileEntries = Object.entries(raw.files || {});
  const imports = raw.imports || [];

  const inDeg = new Map();
  const outDeg = new Map();
  const crossDeg = new Map();
  const accentEdges = new Map();

  for (const [src, dst] of imports) {
    outDeg.set(src, (outDeg.get(src) || 0) + 1);
    inDeg.set(dst, (inDeg.get(dst) || 0) + 1);
    const sInfo = raw.files[src];
    const dInfo = raw.files[dst];
    if (sInfo && dInfo && sInfo.area !== dInfo.area) {
      crossDeg.set(src, (crossDeg.get(src) || 0) + 1);
      crossDeg.set(dst, (crossDeg.get(dst) || 0) + 1);
    }
    if (sInfo && dInfo) {
      const sAcc = spec.isAccent(src, sInfo);
      const dAcc = spec.isAccent(dst, dInfo);
      if (sAcc || dAcc) {
        accentEdges.set(src, (accentEdges.get(src) || 0) + 1);
        accentEdges.set(dst, (accentEdges.get(dst) || 0) + 1);
      }
    }
  }

  let totalLoc = 0;
  let accentLoc = 0;
  let accentFiles = 0;
  const enriched = fileEntries.map(([fp, info]) => {
    const loc = info.loc || 0;
    totalLoc += loc;
    const isAcc = spec.isAccent(fp, info);
    if (isAcc) {
      accentLoc += loc;
      accentFiles++;
    }
    const ind = inDeg.get(fp) || 0;
    const outd = outDeg.get(fp) || 0;
    const xdeg = crossDeg.get(fp) || 0;
    const layer = spec.classifyLayer(fp, info);
    return {
      path: fp,
      area: info.area || "unknown",
      loc,
      inDeg: ind,
      outDeg: outd,
      totalDeg: ind + outd,
      crossDeg: xdeg,
      accentTouch: accentEdges.get(fp) || 0,
      isAccent: isAcc,
      layer,
      hash: hashStr(fp),
    };
  });

  // Sort top-to-bottom: architectural layer first (0=entry -> 1=accent core -> 2=runtime -> 3=secondary/utils).
  // Inside layer 1 (accent core), arrange so the highest-LOC / highest-coupling files sit cleanly in the
  // dramatic upper-center to upper-right focal swell; inside lower layers, keep major files prominent.
  enriched.sort((a, b) => {
    if (a.layer !== b.layer) return a.layer - b.layer;
    // Within entry layer: highest out-degree first
    if (a.layer === 0) return b.outDeg - a.outDeg || b.loc - a.loc;
    // Within accent core: interleave high-LOC and high-cross files by descending coupling+size rhythm
    if (a.layer === 1) {
      const scoreA = a.loc * 0.55 + a.crossDeg * 85 + a.totalDeg * 25;
      const scoreB = b.loc * 0.55 + b.crossDeg * 85 + b.totalDeg * 25;
      return scoreB - scoreA || a.path.localeCompare(b.path);
    }
    // Within runtime & secondary layers: group gently by area, largest files first
    if (a.area !== b.area) return a.area.localeCompare(b.area);
    return b.loc - a.loc || a.path.localeCompare(b.path);
  });

  const maxLoc = Math.max(1, ...enriched.map((f) => f.loc));
  const maxCross = Math.max(1, ...enriched.map((f) => f.crossDeg));
  const maxDeg = Math.max(1, ...enriched.map((f) => f.totalDeg));

  // Map files to contiguous horizontal strata covering y in [Y_START, 1.0].
  // Upper zone (layers 0 & 1 + top of layer 2) gets finer fracture detail; lower layers create taller
  // sweeping atmospheric reflection panes. Band height is strictly driven by real file LOC (sublinear
  // power 0.76 so giant files command broad slabs while small files register as razor-crisp micro-cuts).
  const Y_START = 0.082;
  const Y_END = 1.0;
  const span = Y_END - Y_START;

  // Coalesce very tiny tail files (< 22 LOC) only if there are > 45 files so cuts stay readable at 1x/2x,
  // while preserving every significant file as its own crisp stratum.
  const bands = [];
  for (const f of enriched) {
    const prev = bands[bands.length - 1];
    if (
      enriched.length > 45 &&
      f.layer >= 3 &&
      f.loc < 75 &&
      prev &&
      prev.layer === f.layer &&
      prev.area === f.area &&
      prev.loc < 210
    ) {
      prev.loc += f.loc;
      prev.inDeg += f.inDeg;
      prev.outDeg += f.outDeg;
      prev.totalDeg += f.totalDeg;
      prev.crossDeg += f.crossDeg;
      prev.accentTouch += f.accentTouch;
      prev.files.push(f.path);
    } else {
      bands.push({
        ...f,
        files: [f.path],
      });
    }
  }

  // Compute raw vertical weights directly from real LOC (with gentle layer breathing in lower strata
  // so lower reflection bands stay tall and sculptural like the Bloomsbury cover).
  const weights = bands.map((b) => {
    const locW = Math.pow(Math.max(b.loc, 14), 0.78);
    // Lower reflection strata slightly taller per line so the bottom half has sweeping panoramic panes
    const layerBreath = b.layer === 0 ? 0.85 : b.layer === 1 ? 1.05 : b.layer === 2 ? 1.18 : 1.35;
    return locW * layerBreath;
  });
  const totalW = weights.reduce((s, w) => s + w, 0);

  let cursor = Y_START;
  const strata = bands.map((b, idx) => {
    const hNorm = (weights[idx] / totalW) * span;
    const y0 = cursor;
    const y1 = idx === bands.length - 1 ? Y_END : cursor + hNorm;
    cursor = y1;

    const crossNorm = Math.min(1, b.crossDeg / Math.max(4, maxCross * 0.65));
    const degNorm = Math.min(1, b.totalDeg / Math.max(6, maxDeg * 0.7));
    const locNorm = Math.min(1, b.loc / maxLoc);

    // Direction of shear driven by real import flow (outDeg - inDeg), breaking ties deterministically by hash
    const flow = b.outDeg - b.inDeg;
    const dir = flow !== 0 ? Math.sign(flow) : b.hash & 1 ? 1 : -1;
    // Alternating micro-contrast so neighboring strata have crisp stepped edges
    const alt = idx % 2 === 0 ? 1 : -1;
    const signedDir = Math.abs(flow) >= 2 ? dir : alt * dir;

    // Horizontal glitch shear in normalized sheet width units (stronger on high cross-area coupling!)
    const shearMag = 0.012 + crossNorm * 0.068 + degNorm * 0.026 + ((b.hash % 100) / 100) * 0.018;
    const shearX = signedDir * shearMag;

    // Optical RGB chromatic dispersion in pixels at 1x (840px width): driven by real cross-area imports
    const disp = 1.6 + crossNorm * 10.5 + degNorm * 4.5 + (b.isAccent ? 3.2 : 0);

    // Sculptural energy / heat: accent core ignites focal crimson + icy cyan flare
    const energy = 0.45 + locNorm * 0.4 + crossNorm * 0.35 + (b.isAccent ? 0.55 : 0);

    // Sub-slice count for upper focal strata with high coupling
    const midV = 0.5 * (y0 + y1);
    const subSlices =
      midV < 0.50 && (b.isAccent || crossNorm > 0.35 || hNorm > 0.042)
        ? Math.min(4, Math.max(2, Math.round(1 + crossNorm * 2.5 + hNorm * 28)))
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

  // Identify the focal accent band center (where the accent core peaks vertically)
  const accentBands = strata.filter((s) => s.isAccent);
  const accentMinY = accentBands.length ? accentBands[0].y0 : 0.14;
  const accentMaxY = accentBands.length ? accentBands[accentBands.length - 1].y1 : 0.46;
  const accentMidY = 0.5 * (accentMinY + accentMaxY);

  // Top 5 hub files by (crossDeg * 2 + totalDeg + loc/120) for real focal flare anchoring
  const hubs = [...strata]
    .sort((a, b) => b.crossNorm * 2 + b.degNorm + b.locNorm - (a.crossNorm * 2 + a.degNorm + a.locNorm))
    .slice(0, 6)
    .map((s) => ({
      label: s.label,
      midV: s.midV,
      loc: s.loc,
      crossDeg: s.crossDeg,
      isAccent: s.isAccent,
      energy: s.energy,
      seed: s.seed,
    }));

  const formatInt = (n) => n.toLocaleString("en-US");

  return {
    id: spec.id,
    seed: hashStr(`${spec.id}:${fileEntries.length}:${totalLoc}:${imports.length}`),
    stats: {
      files: fileEntries.length,
      totalLoc,
      imports: imports.length,
      accentFiles,
      accentLoc,
      strataCount: strata.length,
    },
    copy: {
      title: spec.title,
      subtitle: spec.subtitle,
      accentLine: `${spec.accentCoreName} · ${formatInt(totalLoc)} LINES`,
      colophon: `${spec.colophonName} · ${fileEntries.length} FILES`,
    },
    accentSpan: { minY: accentMinY, midY: accentMidY, maxY: accentMaxY },
    hubs,
    strata,
  };
}

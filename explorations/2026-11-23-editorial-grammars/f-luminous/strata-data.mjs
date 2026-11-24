// Real codebase facts -> ordered horizontal strata model for Exploration F (f-luminous).
// Every file count, LOC total, slice height, shear displacement, chromatic dispersion,
// and focal accent weight comes directly from the real scanned codebase facts JSON.

import fs from "node:fs";

export function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

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

  enriched.sort((a, b) => {
    if (a.layer !== b.layer) return a.layer - b.layer;
    if (a.layer === 0) return b.outDeg - a.outDeg || b.loc - a.loc;
    if (a.layer === 1) {
      const scoreA = a.loc * 0.55 + a.crossDeg * 85 + a.totalDeg * 25;
      const scoreB = b.loc * 0.55 + b.crossDeg * 85 + b.totalDeg * 25;
      return scoreB - scoreA || a.path.localeCompare(b.path);
    }
    if (a.area !== b.area) return a.area.localeCompare(b.area);
    return b.loc - a.loc || a.path.localeCompare(b.path);
  });

  const maxLoc = Math.max(1, ...enriched.map((f) => f.loc));
  const maxCross = Math.max(1, ...enriched.map((f) => f.crossDeg));
  const maxDeg = Math.max(1, ...enriched.map((f) => f.totalDeg));

  const Y_START = spec.yStart ?? 0.06;
  const Y_END = 1.0;
  const span = Y_END - Y_START;

  // Group very small peripheral files in large repos so strata remain rhythmic & sculptural
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
      bands.push({
        ...f,
        files: [f.path],
      });
    }
  }

  const weights = bands.map((b) => {
    const locW = Math.pow(Math.max(b.loc, 12), 0.76);
    const layerBreath = b.layer === 0 ? 0.85 : b.layer === 1 ? 1.08 : b.layer === 2 ? 1.18 : 1.30;
    return locW * layerBreath;
  });
  const totalW = weights.reduce((s, w) => s + w, 0);

  let cursor = Y_START;
  const strata = bands.map((b, idx) => {
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

    // Chromatic dispersion in 1x pixels driven by real cross-area import coupling
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

  const accentBands = strata.filter((s) => s.isAccent);
  const accentMinY = accentBands.length ? accentBands[0].y0 : 0.16;
  const accentMaxY = accentBands.length ? accentBands[accentBands.length - 1].y1 : 0.48;
  const accentMidY = 0.5 * (accentMinY + accentMaxY);

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
    subject: spec.subject,
    theme: spec.theme || "obsidian",
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
      repoName: spec.repoName,
      metaStats: `${formatInt(fileEntries.length)} files · ${formatInt(totalLoc)} lines`,
      headline: spec.headline,
      legend: spec.legend,
      typoPos: spec.typoPos,
    },
    microType: spec.microType || [],
    accentSpan: { minY: accentMinY, midY: accentMidY, maxY: accentMaxY },
    hubs,
    strata,
  };
}

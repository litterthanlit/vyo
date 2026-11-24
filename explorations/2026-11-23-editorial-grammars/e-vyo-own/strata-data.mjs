// Real codebase facts -> ordered horizontal strata model for Exploration E (e-vyo-own).
// Every file count, LOC total, import count, slice height, horizontal shear,
// dispersion weight, and architectural layer boundary comes directly from facts.json.

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

  // Print field spans cleanly between the top hairline (y=58 -> 0.055) and bottom hairline (y=1138 -> 0.955)
  const Y_START = spec.yStart ?? 0.058;
  const Y_END = spec.yEnd ?? 0.952;
  const span = Y_END - Y_START;

  // Group very small leaf files in large repos so strata bands remain crisp on the 170-row lattice
  const bands = [];
  for (const f of enriched) {
    const prev = bands[bands.length - 1];
    const shouldMerge =
      enriched.length > 60 &&
      f.layer >= 2 &&
      f.loc < (enriched.length > 150 ? 180 : 75) &&
      prev &&
      prev.layer === f.layer &&
      prev.area === f.area &&
      prev.loc < (enriched.length > 150 ? 680 : 210);
    if (shouldMerge) {
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
    const locW = Math.pow(Math.max(b.loc, 12), 0.74);
    const layerBreath = b.layer === 0 ? 0.9 : b.layer === 1 ? 1.08 : b.layer === 2 ? 1.12 : 1.24;
    return locW * layerBreath;
  });
  const totalW = weights.reduce((s, w) => s + w, 0);

  let cursor = Y_START;
  const strata = bands.map((b, idx) => {
    const hNorm = (weights[idx] / totalW) * span;
    const y0 = cursor;
    const y1 = idx === bands.length - 1 ? Y_END : cursor + hNorm;
    cursor = y1;

    const crossNorm = Math.min(1, b.crossDeg / Math.max(4, maxCross * 0.62));
    const degNorm = Math.min(1, b.totalDeg / Math.max(6, maxDeg * 0.68));
    const locNorm = Math.min(1, b.loc / maxLoc);

    const flow = b.outDeg - b.inDeg;
    const dir = flow !== 0 ? Math.sign(flow) : b.hash & 1 ? 1 : -1;
    const alt = idx % 2 === 0 ? 1 : -1;
    const signedDir = Math.abs(flow) >= 2 ? dir : alt * dir;

    const shearMag = 0.008 + crossNorm * 0.036 + degNorm * 0.014 + ((b.hash % 100) / 100) * 0.010;
    const shearX = signedDir * shearMag;

    // Dispersion amplitude in 1x pixels driven by real cross-area import coupling
    const disp = 1.6 + crossNorm * 7.5 + degNorm * 2.8 + (b.isAccent ? 2.4 : 0);
    const energy = 0.45 + locNorm * 0.35 + crossNorm * 0.35 + (b.isAccent ? 0.45 : 0);

    const subSlices =
      (b.isAccent || crossNorm > 0.34 || hNorm > 0.045)
        ? Math.min(3, Math.max(2, Math.round(1 + crossNorm * 1.8 + hNorm * 18)))
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
      midV: 0.5 * (y0 + y1),
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
    sheet: {
      index: spec.sheetIndex,
      productName: spec.productName,
      repoName: spec.repoName,
      headline: spec.headline,
      legendColorWord: spec.legendColorWord,
      legendSubject: spec.legendSubject,
      topLeft: `${spec.productName.toUpperCase()} / ${formatInt(fileEntries.length)} FILES · ${formatInt(totalLoc)} LINES`,
      topRight: `VYO SHEET · ${spec.sheetIndex}`,
      legendText: `${spec.legendColorWord} marks ${spec.legendSubject} · ${formatInt(fileEntries.length)} files, ${formatInt(totalLoc)} lines`,
      bottomLeft: `${spec.repoName} · ${formatInt(imports.length)} cross-file links`,
      bottomRight: `drawn from the codebase · no network`,
    },
    strata,
  };
}

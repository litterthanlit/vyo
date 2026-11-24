// layout.mjs — Deterministic codebase-to-cascade layout engine for Exploration B.
// Maps real scanned files, LOC, and import edges into translucent vertical shards.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Organic vertical curtain reach across normalized x in [0, 1].
// Deeper curtains on left (0..0.34) and right (0.72..1.00) flanks,
// dramatic top-heavy central spine trailing into delicate needles,
// and an airy bright-white arch clearing at center-right (0.48..0.68).
function curtainEnvelope(xNorm, isSpine) {
  const x = clamp(xNorm, 0, 1);
  const leftLobe = Math.exp(-Math.pow((x - 0.14) / 0.25, 2));
  const rightLobe = Math.exp(-Math.pow((x - 0.87) / 0.21, 2));
  const clearing = Math.exp(-Math.pow((x - 0.57) / 0.14, 2));
  const spineTail = Math.exp(-Math.pow((x - 0.40) / 0.10, 2));

  let base = 0.45 + 0.21 * leftLobe + 0.23 * rightLobe - 0.17 * clearing;
  if (isSpine) {
    // Spine concentrates mass high up, with only slender needles trailing down
    base = Math.max(base, 0.50 + 0.14 * spineTail);
  }
  return clamp(base, 0.34, 0.73);
}

/**
 * Build the complete cascade geometry from real codebase facts + theme config.
 */
export function buildCascade(facts, config) {
  const W = config.width || 840;
  const H = config.height || 1190;
  const filesObj = facts.files || {};
  const imports = facts.imports || [];

  const inDeg = new Map();
  const outDeg = new Map();
  const adjOut = new Map();
  const adjIn = new Map();

  for (const fp of Object.keys(filesObj)) {
    inDeg.set(fp, 0);
    outDeg.set(fp, 0);
    adjOut.set(fp, []);
    adjIn.set(fp, []);
  }

  for (const [from, to] of imports) {
    if (filesObj[from] && filesObj[to]) {
      outDeg.set(from, (outDeg.get(from) || 0) + 1);
      inDeg.set(to, (inDeg.get(to) || 0) + 1);
      adjOut.get(from).push(to);
      adjIn.get(to).push(from);
    }
  }

  const fileList = Object.entries(filesObj)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fp, info]) => {
      const loc = typeof info === 'number' ? info : (info.loc || 1);
      const area = info.area || '(root)';
      const degIn = inDeg.get(fp) || 0;
      const degOut = outDeg.get(fp) || 0;
      const zone = config.classifyFile(fp, info);
      return {
        path: fp,
        loc,
        area,
        inDeg: degIn,
        outDeg: degOut,
        centralityRaw: degIn * 1.45 + degOut * 0.75,
        zone,
      };
    });

  const maxLoc = Math.max(...fileList.map((f) => f.loc), 1);
  const maxCentrality = Math.max(...fileList.map((f) => f.centralityRaw), 1);
  const totalLoc = fileList.reduce((s, f) => s + f.loc, 0);

  for (const f of fileList) {
    f.locNorm = Math.log1p(f.loc) / Math.log1p(maxLoc);
    f.centralityNorm = Math.log1p(f.centralityRaw) / Math.log1p(maxCentrality);
  }

  // Group files by zone and assign stratified horizontal anchors within each zone
  const byZone = new Map();
  for (const f of fileList) {
    if (!byZone.has(f.zone)) byZone.set(f.zone, []);
    byZone.get(f.zone).push(f);
  }

  const fileByPath = new Map(fileList.map((f) => [f.path, f]));

  for (const [zoneId, list] of byZone.entries()) {
    const zSpec = config.zones[zoneId];
    list.sort((a, b) => hashString(a.path) - hashString(b.path));
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const f = list[i];
      const rng = mulberry32(hashString(f.path + ':anchor'));
      const t = n === 1 ? 0.5 : (i + 0.5) / n;
      let x = lerp(zSpec.xMin, zSpec.xMax, t);
      const hubPull = f.centralityNorm * (zSpec.hubPull ?? 0.25);
      x = lerp(x, zSpec.xCenter, hubPull);
      x += (rng() - 0.5) * (zSpec.xJitter ?? 0.032);
      f.baseX = clamp(x, -0.025, 1.025);
    }
  }

  // Compute cross-zone import targets for honest dependency-driven color weaving
  for (const f of fileList) {
    const neighbors = [...(adjOut.get(f.path) || []), ...(adjIn.get(f.path) || [])];
    const cross = [];
    for (const np of neighbors) {
      const nf = fileByPath.get(np);
      if (nf && nf.zone !== f.zone) cross.push(nf);
    }
    f.crossNeighbors = cross;
  }

  // Proportional shard counts per real file (total ~1,080 bars for rich mosaic tapestry)
  const targetBars = config.targetBars || 1080;
  const weights = fileList.map((f) => {
    const zSpec = config.zones[f.zone];
    const locWeight = Math.pow(Math.max(f.loc, 4), config.locExponent ?? 0.64);
    const centralityBoost = 1 + 0.20 * f.centralityNorm;
    return locWeight * centralityBoost * (zSpec.densityScale ?? 1.0);
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const bars = [];

  for (let fi = 0; fi < fileList.length; fi++) {
    const f = fileList[fi];
    const zSpec = config.zones[f.zone];
    const isSpine = f.zone === 'spine';
    const rng = mulberry32(hashString(f.path + ':' + (config.seed || 'cascade')));
    const count = Math.max(
      zSpec.minShards ?? 5,
      Math.round((weights[fi] / totalWeight) * targetBars)
    );

    // 1-4 vertical stream columns per file so large files weave gracefully across their zone
    const streamCount = count >= 26 ? 4 : count >= 15 ? 3 : count >= 8 ? 2 : 1;
    const streams = [f.baseX];
    for (let s = 1; s < streamCount; s++) {
      const dir = s % 2 === 1 ? 1 : -1;
      const step = Math.ceil(s / 2);
      const offset = dir * step * (0.022 + rng() * 0.036);
      streams.push(clamp(f.baseX + offset, zSpec.xMin - 0.015, zSpec.xMax + 0.015));
    }

    for (let i = 0; i < count; i++) {
      const u = (i + rng() * 0.85) / count;

      let xNorm = streams[i % streamCount];
      const isEcho = f.crossNeighbors.length > 0 && rng() < (zSpec.echoProb ?? 0.20);

      if (isEcho) {
        const target = f.crossNeighbors[Math.floor(rng() * f.crossNeighbors.length)];
        const pull = 0.50 + rng() * 0.48;
        xNorm = lerp(xNorm, target.baseX, pull) + (rng() - 0.5) * 0.045;
      } else {
        const spread = isSpine
          ? (u < 0.52 ? 0.042 : 0.052)
          : 0.044;
        xNorm += (rng() - 0.5) * 2 * spread;
      }

      // Subtle rose-into-left-flank weave for files that bridge core/scan/screens
      if (zSpec.mirrorFlankProb && rng() < zSpec.mirrorFlankProb) {
        xNorm = lerp(0.01, 0.19, rng());
      }

      xNorm = clamp(xNorm, -0.025, 1.022);

      // Vertical reach driven by curtain silhouette + real centrality + LOC
      const envReach = curtainEnvelope(xNorm, isSpine);
      const dataReach =
        envReach +
        0.09 * f.centralityNorm +
        0.045 * f.locNorm -
        0.035;
      const maxYNorm = clamp(dataReach, 0.30, 0.775);

      // Vertical placement: dense architectural tapestry at top bleeding off y=0,
      // lush vibrant mid-curtains down to ~0.55, tapering cleanly into droplets.
      let yNorm;
      if (i === 0 && rng() < 0.82) {
        // Crisp top-bleed pouring from above y=0
        yNorm = -0.038 + rng() * 0.055;
      } else if (u < 0.32) {
        // Upper tapestry
        const upperSpan = isSpine ? 0.21 : 0.26;
        yNorm = -0.028 + Math.pow(rng(), isSpine ? 1.25 : 1.05) * upperSpan;
      } else if (u < 0.76) {
        // Lush mid-curtain mosaic (keeps flanks & mid-zones vibrant through y = 0.20..0.58)
        const power = isSpine ? 1.65 : 1.06;
        const startY = isSpine ? 0.02 : 0.09;
        yNorm = startY + Math.pow(rng(), power) * (maxYNorm * 0.88 - startY);
      } else {
        // Trailing droplets & crisp needles dissolving into gallery whitespace
        const tail = 0.60 + Math.pow(rng(), 0.88) * 0.44;
        yNorm = clamp(tail * maxYNorm, 0.24, 0.795);
      }

      if (yNorm > 0.785) {
        yNorm = 0.71 + rng() * 0.07;
      }

      const yPos = yNorm * H;
      const depthRatio = clamp((yNorm + 0.035) / (maxYNorm + 0.035), 0, 1);

      // Architectural mosaic bar proportions — punchy vertical rectangles,
      // hairline needles, top-concentrated slabs, and crisp falling droplets!
      const rClass = rng();
      let w, h, kind;
      const spineOutsideCore = isSpine && (xNorm < 0.33 || xNorm > 0.57);

      if (depthRatio > 0.76) {
        // Trailing edge: scattered droplets, crisp tiny rects, and fine needles
        if (rClass < 0.68) {
          kind = 'droplet';
          w = 3.5 + rng() * 8.0;
          h = 5.0 + rng() * 17.5;
        } else {
          kind = 'needle';
          w = 1.8 + rng() * 2.8;
          h = 14 + rng() * 34;
        }
      } else if (spineOutsideCore || (isSpine && yNorm > 0.23)) {
        // Lower spine & outward spine echoes: slender needles, crisp small blocks (never heavy dark slabs)
        if (rClass < 0.46) {
          kind = 'needle';
          w = 1.8 + rng() * 3.0;
          h = 18 + rng() * 52;
        } else if (rClass < 0.80) {
          kind = 'droplet';
          w = 4.0 + rng() * 7.2;
          h = 6.5 + rng() * 19;
        } else {
          kind = 'ribbon';
          w = 6.0 + rng() * 6.0;
          h = 16 + rng() * 34;
        }
      } else if (depthRatio < 0.34) {
        // Upper tapestry: authoritative anchor slabs, punchy mosaic ribbons, sharp needles
        const slabThreshold = isSpine ? 0.22 : 0.13;
        if (rClass < slabThreshold) {
          kind = 'slab';
          w = (isSpine ? 14 : 14) + rng() * (isSpine ? 10 : 9);
          h = 32 + rng() * (isSpine ? 54 : 46);
        } else if (rClass < slabThreshold + 0.25) {
          kind = 'needle';
          w = 2.0 + rng() * 3.2;
          h = 24 + rng() * 62;
        } else if (rClass < 0.88) {
          kind = 'ribbon';
          w = 7.0 + rng() * 9.0;
          h = 22 + rng() * 52;
        } else {
          kind = 'droplet';
          w = 4.5 + rng() * 7.5;
          h = 8.0 + rng() * 18;
        }
      } else {
        // Mid cascade: rhythmic weave of compact ribbons, needles, occasional medium anchors, and droplets
        if (rClass < 0.09) {
          kind = 'slab';
          w = 13.5 + rng() * 7.5;
          h = 26 + rng() * 42;
        } else if (rClass < 0.35) {
          kind = 'needle';
          w = 1.8 + rng() * 3.0;
          h = 18 + rng() * 54;
        } else if (rClass < 0.78) {
          kind = 'ribbon';
          w = 6.5 + rng() * 8.5;
          h = 18 + rng() * 44;
        } else {
          kind = 'droplet';
          w = 4.0 + rng() * 7.5;
          h = 6.0 + rng() * 17;
        }
      }

      // Subtle LOC height modulation
      h *= 0.88 + 0.24 * f.locNorm;

      const maxBottom = H * 0.805;
      if (yPos + h > maxBottom) {
        h = Math.max(5, maxBottom - yPos);
      }

      // Pigment tone selection from zone palette (keep rich jewel tones through mid-cascade)
      const palette = zSpec.palette;
      let colorHex;
      if (isSpine && !spineOutsideCore && yNorm < 0.21 && rng() < 0.58) {
        colorHex = palette[0];
      } else {
        const idxBias = depthRatio * 0.30 + rng() * 0.80;
        const pIdx = Math.min(palette.length - 1, Math.floor(idxBias * palette.length));
        colorHex = palette[pIdx];
      }

      // Multiply translucency alpha
      let alpha;
      if (isSpine) {
        alpha = spineOutsideCore
          ? 0.26 + rng() * 0.24
          : yNorm < 0.21
            ? 0.42 + rng() * 0.30
            : 0.32 + rng() * 0.32;
      } else {
        alpha =
          depthRatio < 0.64
            ? 0.40 + rng() * 0.34
            : depthRatio < 0.82
              ? 0.30 + rng() * 0.30
              : 0.22 + rng() * 0.28;
      }

      if (kind === 'needle') {
        alpha = Math.min(0.84, alpha + 0.10);
      }

      bars.push({
        x: xNorm * W - w * 0.5,
        y: yPos,
        w,
        h,
        color: colorHex,
        alpha,
        kind,
        zone: f.zone,
        file: f.path,
        loc: f.loc,
        depthRatio,
        seed: rng(),
      });
    }
  }

  // 4 whisper-quiet stray droplets from top centrality hubs, strictly clear of
  // the bottom-left title, bottom-right mark, and bottom colophon line.
  const hubs = [...fileList]
    .sort((a, b) => b.centralityRaw - a.centralityRaw || b.loc - a.loc)
    .slice(0, 5);

  const straySlots = [
    { x: 0.515, y: 0.915, w: 10, h: 17 },
    { x: 0.578, y: 0.942, w: 7.5, h: 10 },
    { x: 0.725, y: 0.922, w: 9.0, h: 11 },
    { x: 0.958, y: 0.818, w: 3.0, h: 16 },
  ];

  for (let i = 0; i < straySlots.length && i < hubs.length; i++) {
    const f = hubs[i];
    const slot = straySlots[i];
    const zSpec = config.zones[f.zone];
    const rng = mulberry32(hashString(f.path + ':stray'));
    const color = zSpec.palette[Math.min(zSpec.palette.length - 1, 1 + (i % 2))];
    bars.push({
      x: (slot.x + (rng() - 0.5) * 0.016) * W,
      y: slot.y * H,
      w: slot.w,
      h: slot.h,
      color,
      alpha: 0.20 + rng() * 0.12,
      kind: 'stray',
      zone: f.zone,
      file: f.path,
      loc: f.loc,
      depthRatio: 1,
      seed: rng(),
    });
  }

  bars.sort((a, b) => a.seed - b.seed);

  return {
    width: W,
    height: H,
    bars,
    stats: {
      fileCount: fileList.length,
      totalLoc,
      importCount: imports.length,
      barCount: bars.length,
    },
  };
}

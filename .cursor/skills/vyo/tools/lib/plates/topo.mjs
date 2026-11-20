// Pure Marching-Squares Topographic Elevation Map geometry engine.
// Places codebase parts as geological massifs via Fibonacci initialization + spring/repulsion relaxation,
// orbits file slices as satellite sub-peaks, joins import-coupled parts with Gaussian saddle passes,
// extracts 22 iso-contour levels with all 16 marching-squares cases + saddle disambiguation,
// stitches continuous polylines, and applies 2 passes of Chaikin corner-cutting smoothing.

export const TOPO_DEFAULTS = {
  gw: 128,
  minGh: 96,
  maxGh: 180,
  levels: 22,
  minLevel: 0.07,
  maxLevel: 0.94,
  majorStep: 4,
  relaxIters: 40,
  chaikinPasses: 2,
};

function topoHashInt(a, b) {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) ^ 0x5bd1e995;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return x >>> 0;
}

function topoUnit(a, b) {
  return topoHashInt(a, b) / 4294967296;
}

function topoStrHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function topoRound2(v) {
  return Math.round(v * 100) / 100;
}

/** Deterministic smooth 2D value noise in [-1, 1] using cubic Hermite interpolation. */
function topoValueNoise2D(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const n00 = topoUnit(xi * 73856093 ^ seed, yi * 19349663) * 2 - 1;
  const n10 = topoUnit((xi + 1) * 73856093 ^ seed, yi * 19349663) * 2 - 1;
  const n01 = topoUnit(xi * 73856093 ^ seed, (yi + 1) * 19349663) * 2 - 1;
  const n11 = topoUnit((xi + 1) * 73856093 ^ seed, (yi + 1) * 19349663) * 2 - 1;
  const a = n00 + (n10 - n00) * u;
  const b = n01 + (n11 - n01) * u;
  return a + (b - a) * v;
}

/** 3-octave deterministic terrain FBM in [-1, 1] for authentic USGS cartographic undulation. */
function topoFbm(x, y, seed) {
  const o1 = topoValueNoise2D(x, y, seed);
  const o2 = topoValueNoise2D(x * 2.03 + 11.7, y * 2.03 - 7.3, seed ^ 0x9e3779b9);
  const o3 = topoValueNoise2D(x * 4.11 - 5.2, y * 4.11 + 19.4, seed ^ 0x85ebca6b);
  return (o1 * 0.58 + o2 * 0.29 + o3 * 0.13);
}

function topoEdgePoint(edge, gx, gy, v0, v1, v2, v3, iso) {
  const interp = (va, vb) => {
    const d = vb - va;
    if (Math.abs(d) < 1e-12) return 0.5;
    return Math.max(0, Math.min(1, (iso - va) / d));
  };
  if (edge === 0) return [gx + interp(v0, v1), gy];
  if (edge === 1) return [gx + 1, gy + interp(v1, v2)];
  if (edge === 2) return [gx + interp(v3, v2), gy + 1];
  return [gx, gy + interp(v0, v3)];
}

/**
 * Evaluate all 16 Marching-Squares cell cases with center-value saddle disambiguation for cases 5 and 10.
 * Corner bitmask: v0(TL)=8, v1(TR)=4, v2(BR)=2, v3(BL)=1.
 */
function topoCellPairs(code, v0, v1, v2, v3, iso) {
  switch (code) {
    case 0:
    case 15:
      return null;
    case 1:
    case 14:
      return [[3, 2]];
    case 2:
    case 13:
      return [[2, 1]];
    case 3:
    case 12:
      return [[3, 1]];
    case 4:
    case 11:
      return [[0, 1]];
    case 5: {
      const center = 0.25 * (v0 + v1 + v2 + v3);
      return center >= iso ? [[3, 0], [2, 1]] : [[3, 2], [0, 1]];
    }
    case 6:
    case 9:
      return [[0, 2]];
    case 7:
    case 8:
      return [[3, 0]];
    case 10: {
      const center = 0.25 * (v0 + v1 + v2 + v3);
      return center >= iso ? [[0, 1], [3, 2]] : [[3, 0], [2, 1]];
    }
    default:
      return null;
  }
}

function topoKey(x, y) {
  return `${Math.round(x * 10000)},${Math.round(y * 10000)}`;
}

/** Stitch unordered cell segments into continuous polylines (detecting closed loops within epsilon). */
function topoStitchSegments(segments) {
  const m = segments.length;
  if (!m) return [];
  const adj = new Map();
  const addAdj = (key, segIdx, endIdx) => {
    let list = adj.get(key);
    if (!list) {
      list = [];
      adj.set(key, list);
    }
    list.push([segIdx, endIdx]);
  };
  for (let i = 0; i < m; i++) {
    const [ax, ay, bx, by] = segments[i];
    addAdj(topoKey(ax, ay), i, 0);
    addAdj(topoKey(bx, by), i, 1);
  }

  const used = new Uint8Array(m);
  const chains = [];

  for (let i = 0; i < m; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const [ax, ay, bx, by] = segments[i];
    const pts = [[ax, ay], [bx, by]];

    // Extend tail forward.
    for (;;) {
      const tail = pts[pts.length - 1];
      const candidates = adj.get(topoKey(tail[0], tail[1]));
      if (!candidates) break;
      let next = null;
      for (let c = 0; c < candidates.length; c++) {
        const [sIdx, endIdx] = candidates[c];
        if (!used[sIdx]) {
          next = [sIdx, endIdx];
          break;
        }
      }
      if (!next) break;
      const [sIdx, endIdx] = next;
      used[sIdx] = 1;
      const seg = segments[sIdx];
      pts.push(endIdx === 0 ? [seg[2], seg[3]] : [seg[0], seg[1]]);
    }

    // Extend head backward if not already closed.
    const headInit = pts[0];
    const tailInit = pts[pts.length - 1];
    if (Math.hypot(headInit[0] - tailInit[0], headInit[1] - tailInit[1]) > 1e-3) {
      const prefix = [];
      let cur = headInit;
      for (;;) {
        const candidates = adj.get(topoKey(cur[0], cur[1]));
        if (!candidates) break;
        let next = null;
        for (let c = 0; c < candidates.length; c++) {
          const [sIdx, endIdx] = candidates[c];
          if (!used[sIdx]) {
            next = [sIdx, endIdx];
            break;
          }
        }
        if (!next) break;
        const [sIdx, endIdx] = next;
        used[sIdx] = 1;
        const seg = segments[sIdx];
        cur = endIdx === 0 ? [seg[2], seg[3]] : [seg[0], seg[1]];
        prefix.push(cur);
      }
      if (prefix.length) {
        prefix.reverse();
        pts.unshift(...prefix);
      }
    }

    const first = pts[0];
    const last = pts[pts.length - 1];
    const closed = pts.length >= 4 && Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1e-3;
    if (closed) pts.pop();
    if (pts.length >= 3) chains.push({ pts, closed });
  }
  return chains;
}

/** Apply `passes` of Chaikin corner-cutting smoothing, preserving closed loops and open endpoints. */
function topoChaikin(pts, closed, passes) {
  let cur = pts;
  for (let p = 0; p < passes; p++) {
    const n = cur.length;
    if (n < 3) break;
    const next = [];
    if (closed) {
      for (let i = 0; i < n; i++) {
        const a = cur[i];
        const b = cur[(i + 1) % n];
        next.push(
          [0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]],
          [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]],
        );
      }
    } else {
      next.push(cur[0]);
      for (let i = 0; i < n - 1; i++) {
        const a = cur[i];
        const b = cur[i + 1];
        next.push(
          [0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]],
          [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]],
        );
      }
      next.push(cur[n - 1]);
    }
    cur = next;
  }
  return cur;
}

function topoNiceElevation(val) {
  if (val <= 10) return Math.max(1, Math.round(val));
  if (val <= 100) return Math.round(val / 5) * 5;
  if (val <= 1000) return Math.round(val / 25) * 25;
  return Math.round(val / 100) * 100;
}

/**
 * Build the Marching-Squares Topographic Elevation Map plate geometry inside `box`.
 * @param {{ slices?: any[], parts?: any[], ties?: [number, number, number][], box: { left: number, right: number, top: number, bottom: number }, seed?: number }} opts
 */
export function buildTopoPlate({ slices = [], parts = [], ties = [], box, seed = 1 }) {
  const safeBox = {
    left: Number(box?.left) || 0,
    right: Number(box?.right) || 800,
    top: Number(box?.top) || 0,
    bottom: Number(box?.bottom) || 600,
  };

  // Derive parts from slices if caller omitted parts.
  let normParts = parts;
  if (!normParts.length && slices.length) {
    const byId = new Map();
    for (const sl of slices) {
      const prev = byId.get(sl.partId) ?? { id: sl.partId, name: sl.partName ?? sl.partId, loc: 0, files: 0, hot: !!sl.hot };
      prev.loc += Number(sl.loc) || 0;
      prev.files += (sl.files?.length || 1);
      if (sl.hot) prev.hot = true;
      byId.set(sl.partId, prev);
    }
    normParts = [...byId.values()];
  }

  const P = normParts.length;
  if (!P) {
    return {
      kind: "topo",
      box: safeBox,
      levels: TOPO_DEFAULTS.levels,
      contours: [],
      summits: [],
      representedParts: 0,
      accentCount: 0,
    };
  }

  const boxW = Math.max(1, safeBox.right - safeBox.left);
  const boxH = Math.max(1, safeBox.bottom - safeBox.top);
  const minDim = Math.min(boxW, boxH);
  const gw = TOPO_DEFAULTS.gw;
  const gh = Math.max(TOPO_DEFAULTS.minGh, Math.min(TOPO_DEFAULTS.maxGh, Math.round((gw * boxH) / boxW)));
  const seedInt = (Math.round(Number(seed) || 1) * 2654435761) >>> 0;

  const totalLoc = normParts.reduce((s, p) => s + Math.max(1, Number(p.loc) || 0), 0);
  const maxPartLoc = Math.max(1, ...normParts.map((p) => Number(p.loc) || 0));

  // Safe interior bounds for massif placement (generous full-sheet spread while keeping outer rings framed).
  const padX = boxW * 0.11;
  const padY = boxH * 0.11;
  const minX = safeBox.left + padX;
  const maxX = safeBox.right - padX;
  const minY = safeBox.top + padY;
  const maxY = safeBox.bottom - padY;
  const usableW = Math.max(1, maxX - minX);
  const usableH = Math.max(1, maxY - minY);
  const cx = (safeBox.left + safeBox.right) * 0.5;
  const cy = (safeBox.top + safeBox.bottom) * 0.5;
  const meanSpacing = Math.sqrt((usableW * usableH) / Math.max(1, P));

  // Deterministic Fibonacci / golden-angle initialization (largest parts anchored closer to center).
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const rankOrder = normParts.map((p, idx) => ({ idx, loc: Number(p.loc) || 0 })).sort((a, b) => b.loc - a.loc || a.idx - b.idx);
  const rankOf = new Array(P);
  rankOrder.forEach((r, rank) => { rankOf[r.idx] = rank; });

  const baseAngle = topoUnit(seedInt, 7) * Math.PI * 2;
  const nodes = normParts.map((p, idx) => {
    const share = Math.max(0.005, (Number(p.loc) || 0) / totalLoc);
    const rank = rankOf[idx];
    const pHash = topoStrHash(`${p.id}|${seedInt}`);
    const radFrac = P === 1 ? 0 : Math.sqrt((rank + 0.55) / (P + 0.15));
    const angle = baseAngle + rank * goldenAngle + (topoUnit(pHash, 1) - 0.5) * 0.25;
    const rx = usableW * 0.54 * radFrac;
    const ry = usableH * 0.54 * radFrac;
    const sigma = Math.min(minDim * 0.14, meanSpacing * (0.19 + 0.15 * Math.sqrt(share)));
    // Anisotropic elliptical ridge elongation (aspect ratio 1.35..1.85) so massifs read as geological ridges.
    const elongation = 1.35 + 0.50 * topoUnit(pHash, 3);
    const sigmaMajor = sigma * Math.sqrt(elongation);
    const sigmaMinor = sigma / Math.sqrt(elongation);
    return {
      idx,
      id: p.id,
      name: p.name ?? p.id,
      loc: Number(p.loc) || 0,
      files: Number(p.files) || 1,
      share,
      hot: !!p.hot,
      x: Math.max(minX, Math.min(maxX, cx + Math.cos(angle) * rx)),
      y: Math.max(minY, Math.min(maxY, cy + Math.sin(angle) * ry)),
      height: 0.52 + 0.68 * Math.sqrt(share),
      sigma,
      sigmaMajor,
      sigmaMinor,
      elongation,
      angle: topoUnit(pHash, 2) * Math.PI,
      pHash,
    };
  });

  // Valid ties between parts.
  const validTies = [];
  let maxTieWeight = 1;
  for (const tie of ties ?? []) {
    const [i, j, w] = tie;
    if (i >= 0 && i < P && j >= 0 && j < P && i !== j && w > 0) {
      validTies.push([i, j, w]);
      if (w > maxTieWeight) maxTieWeight = w;
    }
  }

  // 40 iterations of deterministic spring/repulsion relaxation (repulsion dominates so peaks never collapse).
  if (P > 1) {
    const baseRepelDist = meanSpacing * 0.94;
    for (let iter = 0; iter < TOPO_DEFAULTS.relaxIters; iter++) {
      const fx = new Float64Array(P);
      const fy = new Float64Array(P);
      const tx = new Float64Array(P);
      const ty = new Float64Array(P);
      const cooling = 1 - (iter / TOPO_DEFAULTS.relaxIters) * 0.55;

      // Strong pairwise repulsion keeps every massif cleanly separated across the full box.
      for (let i = 0; i < P; i++) {
        for (let j = i + 1; j < P; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          let d = Math.hypot(dx, dy);
          if (d < 1e-4) {
            const ang = i * 1.7 + j * 2.3;
            dx = Math.cos(ang);
            dy = Math.sin(ang);
            d = 1;
          }
          const minDist = baseRepelDist * (0.82 + 0.24 * (Math.sqrt(nodes[i].share) + Math.sqrt(nodes[j].share)));
          if (d < minDist) {
            const push = ((minDist - d) / minDist) * 34 * cooling;
            const ux = dx / d;
            const uy = dy / d;
            fx[i] -= ux * push;
            fy[i] -= uy * push;
            fx[j] += ux * push;
            fy[j] += uy * push;
          }
        }
      }

      // Gentle spring attraction along cross-part import ties (clamped per node so hubs never implode).
      for (let t = 0; t < validTies.length; t++) {
        const [i, j, w] = validTies[t];
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const d = Math.hypot(dx, dy) || 1;
        const ideal = baseRepelDist * 1.35;
        if (d > ideal) {
          const pull = ((d - ideal) / minDim) * 5.5 * Math.sqrt(w / maxTieWeight) * cooling;
          const ux = dx / d;
          const uy = dy / d;
          tx[i] += ux * pull;
          ty[i] += uy * pull;
          tx[j] -= ux * pull;
          ty[j] -= uy * pull;
        }
      }

      const maxTiePull = 4.5 * cooling;
      for (let i = 0; i < P; i++) {
        const tMag = Math.hypot(tx[i], ty[i]);
        if (tMag > maxTiePull) {
          tx[i] = (tx[i] / tMag) * maxTiePull;
          ty[i] = (ty[i] / tMag) * maxTiePull;
        }
        nodes[i].x = Math.max(minX, Math.min(maxX, nodes[i].x + fx[i] + tx[i]));
        nodes[i].y = Math.max(minY, Math.min(maxY, nodes[i].y + fy[i] + ty[i]));
      }
    }
  }

  // Group slices by partIndex so each slice becomes a satellite sub-peak spread along its massif's ridge spine.
  const partIdToIdx = new Map(normParts.map((p, i) => [p.id, i]));
  const partSlices = Array.from({ length: P }, () => []);
  for (let s = 0; s < slices.length; s++) {
    const sl = slices[s];
    const pIdx = partIdToIdx.has(sl.partId) ? partIdToIdx.get(sl.partId) : Math.min(P - 1, Math.max(0, sl.partIndex ?? 0));
    partSlices[pIdx].push(sl);
  }

  // Build elongated ridge-spine satellite sub-peaks & shoulder spurs for authentic mountain topography.
  const partSubPeaks = nodes.map((nd, pIdx) => {
    const sls = partSlices[pIdx];
    const count = sls.length;
    const cosA = Math.cos(nd.angle);
    const sinA = Math.sin(nd.angle);
    const normFactor = 1 / Math.max(1, count);
    const subs = [];

    for (let k = 0; k < count; k++) {
      const sl = sls[k];
      const sh = topoStrHash(`${sl.hash ?? sl.partId}|${k}|${seedInt}`);
      const locNorm = Math.max(0, Math.min(1, Number(sl.locNorm) || 0));
      const degreeNorm = Math.max(0, Math.min(1, Number(sl.degreeNorm) || 0));
      // Spread longitudinally along the massif's ridge spine with asymmetric lateral spurs.
      const spineU = count > 1 ? (k / (count - 1)) * 2 - 1 : (topoUnit(sh, 1) * 2 - 1) * 0.6;
      const along = (spineU * 1.15 + (topoUnit(sh, 2) - 0.5) * 0.45) * nd.sigmaMajor;
      const spurSign = (k % 2 === 0 ? 1 : -1) * (0.35 + 0.65 * topoUnit(sh, 3));
      const across = spurSign * 0.68 * nd.sigmaMinor;
      const sx = Math.max(safeBox.left + boxW * 0.08, Math.min(safeBox.right - boxW * 0.08, nd.x + cosA * along - sinA * across));
      const sy = Math.max(safeBox.top + boxH * 0.08, Math.min(safeBox.bottom - boxH * 0.08, nd.y + sinA * along + cosA * across));
      const subH = (0.38 + 0.66 * locNorm + 0.26 * degreeNorm) * normFactor * nd.height * 0.98;
      const subSig = nd.sigma * (0.38 + 0.24 * (1 - 0.4 * degreeNorm));
      const subElong = 1.25 + 0.45 * topoUnit(sh, 4);
      const subAng = nd.angle + (topoUnit(sh, 5) - 0.5) * 1.1;
      subs.push({
        x: sx,
        y: sy,
        h: subH,
        cosA: Math.cos(subAng),
        sinA: Math.sin(subAng),
        inv2sX: 1 / (2 * (subSig * Math.sqrt(subElong)) ** 2),
        inv2sY: 1 / (2 * (subSig / Math.sqrt(subElong)) ** 2),
      });
    }

    // Add 2 subtle geological shoulder spurs along the ridge spine for low-slice parts so they never look circular.
    if (count < 3) {
      for (let sp = 0; sp < 2; sp++) {
        const sign = sp === 0 ? -1 : 1;
        const along = sign * (0.72 + 0.35 * topoUnit(nd.pHash, 20 + sp)) * nd.sigmaMajor;
        const across = (topoUnit(nd.pHash, 30 + sp) - 0.5) * 0.55 * nd.sigmaMinor;
        const sx = Math.max(safeBox.left + boxW * 0.08, Math.min(safeBox.right - boxW * 0.08, nd.x + cosA * along - sinA * across));
        const sy = Math.max(safeBox.top + boxH * 0.08, Math.min(safeBox.bottom - boxH * 0.08, nd.y + sinA * along + cosA * across));
        const subSig = nd.sigma * 0.48;
        const spurAng = nd.angle + sign * 0.42;
        subs.push({
          x: sx,
          y: sy,
          h: nd.height * (0.24 + 0.08 * topoUnit(nd.pHash, 40 + sp)),
          cosA: Math.cos(spurAng),
          sinA: Math.sin(spurAng),
          inv2sX: 1 / (2 * (subSig * 1.25) ** 2),
          inv2sY: 1 / (2 * (subSig * 0.78) ** 2),
        });
      }
    }
    return subs;
  });

  // Precompute grid coordinates and gentle multi-octave terrain undulation + subtle domain warp.
  const xs = new Float64Array(gw);
  const ys = new Float64Array(gh);
  for (let gx = 0; gx < gw; gx++) xs[gx] = safeBox.left + (gx / (gw - 1)) * boxW;
  for (let gy = 0; gy < gh; gy++) ys[gy] = safeBox.top + (gy / (gh - 1)) * boxH;

  // Smooth border fade in the outer 6% margin so elevation islands frame crisply inside `box`.
  const edgeFadeX = new Float64Array(gw);
  const edgeFadeY = new Float64Array(gh);
  const smoothstep = (e0, e1, v) => {
    const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  for (let gx = 0; gx < gw; gx++) {
    const u = gx / (gw - 1);
    edgeFadeX[gx] = smoothstep(0, 0.06, u) * smoothstep(0, 0.06, 1 - u);
  }
  for (let gy = 0; gy < gh; gy++) {
    const v = gy / (gh - 1);
    edgeFadeY[gy] = smoothstep(0, 0.06, v) * smoothstep(0, 0.06, 1 - v);
  }

  // Precompute deterministic low-frequency USGS terrain warp & ~12% multi-octave undulation.
  const totalCells = gw * gh;
  const warpX = new Float32Array(totalCells);
  const warpY = new Float32Array(totalCells);
  const undul = new Float32Array(totalCells);
  const noiseFreq = 3.6 / Math.max(1, minDim);
  const warpAmp = Math.min(minDim * 0.036, meanSpacing * 0.14);
  for (let gy = 0; gy < gh; gy++) {
    const y = ys[gy];
    const rowOff = gy * gw;
    for (let gx = 0; gx < gw; gx++) {
      const x = xs[gx];
      const nx = (x - safeBox.left) * noiseFreq;
      const ny = (y - safeBox.top) * noiseFreq;
      const idx = rowOff + gx;
      warpX[idx] = topoFbm(nx + 3.1, ny + 1.7, seedInt ^ 0x1b873593) * warpAmp;
      warpY[idx] = topoFbm(nx - 4.3, ny + 6.9, seedInt ^ 0x5bd1e995) * warpAmp;
      undul[idx] = topoFbm(nx * 1.35 + 9.2, ny * 1.35 - 2.8, seedInt ^ 0x27d4eb2f);
    }
  }

  // Evaluate total scalar elevation field and track dominant ownerPart per grid cell.
  const field = new Float32Array(totalCells);
  const bestVal = new Float32Array(totalCells);
  const ownerPart = new Int16Array(totalCells).fill(-1);
  const partScratch = new Float32Array(totalCells);

  for (let pIdx = 0; pIdx < P; pIdx++) {
    partScratch.fill(0);
    const nd = nodes[pIdx];
    const cosA = Math.cos(nd.angle);
    const sinA = Math.sin(nd.angle);
    const inv2sX = 1 / (2 * nd.sigmaMajor * nd.sigmaMajor);
    const inv2sY = 1 / (2 * nd.sigmaMinor * nd.sigmaMinor);
    const subs = partSubPeaks[pIdx];

    for (let gy = 0; gy < gh; gy++) {
      const y = ys[gy];
      const rowOff = gy * gw;
      for (let gx = 0; gx < gw; gx++) {
        const idx = rowOff + gx;
        const wx = xs[gx] + warpX[idx];
        const wy = y + warpY[idx];
        const dx0 = wx - nd.x;
        const dy0 = wy - nd.y;
        const rx = dx0 * cosA + dy0 * sinA;
        const ry = -dx0 * sinA + dy0 * cosA;
        let val = nd.height * Math.exp(-(rx * rx * inv2sX + ry * ry * inv2sY));
        for (let k = 0; k < subs.length; k++) {
          const sb = subs[k];
          const sdx = wx - sb.x;
          const sdy = wy - sb.y;
          const srx = sdx * sb.cosA + sdy * sb.sinA;
          const sry = -sdx * sb.sinA + sdy * sb.cosA;
          val += sb.h * Math.exp(-(srx * srx * sb.inv2sX + sry * sry * sb.inv2sY));
        }
        // Blend ~12% smooth multi-octave geological terrain undulation into each massif.
        partScratch[idx] = Math.max(0, val * (1 + 0.125 * undul[idx]));
      }
    }

    for (let idx = 0; idx < totalCells; idx++) {
      const v = partScratch[idx];
      field[idx] += v;
      if (v > bestVal[idx]) {
        bestVal[idx] = v;
        ownerPart[idx] = pIdx;
      }
    }
  }

  // Add smooth Gaussian saddle ridges connecting import-coupled pairs of parts (subtle passes, never drowning peaks).
  const ridgeWidth = Math.min(minDim * 0.04, meanSpacing * 0.16);
  const inv2r2 = 1 / (2 * ridgeWidth * ridgeWidth);
  for (let t = 0; t < validTies.length; t++) {
    const [i, j, w] = validTies[t];
    const a = nodes[i];
    const b = nodes[j];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    if (len2 < 1) continue;
    const saddleAmp = 0.14 * Math.sqrt(w / maxTieWeight) * Math.min(a.height, b.height);
    const bbMinX = Math.min(a.x, b.x) - ridgeWidth * 3.2;
    const bbMaxX = Math.max(a.x, b.x) + ridgeWidth * 3.2;
    const bbMinY = Math.min(a.y, b.y) - ridgeWidth * 3.2;
    const bbMaxY = Math.max(a.y, b.y) + ridgeWidth * 3.2;

    for (let gy = 0; gy < gh; gy++) {
      const y = ys[gy];
      if (y < bbMinY || y > bbMaxY) continue;
      const rowOff = gy * gw;
      for (let gx = 0; gx < gw; gx++) {
        const x = xs[gx];
        if (x < bbMinX || x > bbMaxX) continue;
        const u = ((x - a.x) * vx + (y - a.y) * vy) / len2;
        if (u <= 0 || u >= 1) continue;
        const px = a.x + u * vx;
        const py = a.y + u * vy;
        const d2 = (x - px) * (x - px) + (y - py) * (y - py);
        const ridge = saddleAmp * Math.sin(Math.PI * u) * Math.exp(-d2 * inv2r2);
        const idx = rowOff + gx;
        field[idx] += ridge;
        if (ridge > bestVal[idx]) {
          bestVal[idx] = ridge;
          ownerPart[idx] = u < 0.5 ? i : j;
        }
      }
    }
  }

  // Apply border fade and find maxElevation + true local summit per part.
  let maxElevation = 0;
  const partPeakVal = new Float32Array(P).fill(-1);
  const partPeakX = new Float64Array(P);
  const partPeakY = new Float64Array(P);
  for (let i = 0; i < P; i++) {
    partPeakX[i] = nodes[i].x;
    partPeakY[i] = nodes[i].y;
  }

  for (let gy = 0; gy < gh; gy++) {
    const fy = edgeFadeY[gy];
    const rowOff = gy * gw;
    for (let gx = 0; gx < gw; gx++) {
      const idx = rowOff + gx;
      const v = field[idx] * edgeFadeX[gx] * fy;
      field[idx] = v;
      if (v > maxElevation) maxElevation = v;
      const own = ownerPart[idx];
      if (own >= 0 && v > partPeakVal[own]) {
        partPeakVal[own] = v;
        partPeakX[own] = xs[gx];
        partPeakY[own] = ys[gy];
      }
    }
  }

  // Extract 22 iso-contour levels via Marching Squares + stitching + 2-pass Chaikin smoothing.
  const levelCount = TOPO_DEFAULTS.levels;
  const contours = [];
  let accentCount = 0;

  if (maxElevation > 1e-6) {
    for (let lv = 0; lv < levelCount; lv++) {
      const levelNorm = TOPO_DEFAULTS.minLevel
        + (lv / Math.max(1, levelCount - 1)) * (TOPO_DEFAULTS.maxLevel - TOPO_DEFAULTS.minLevel);
      const iso = levelNorm * maxElevation;
      const segments = [];

      for (let gy = 0; gy < gh - 1; gy++) {
        const r0 = gy * gw;
        const r1 = (gy + 1) * gw;
        for (let gx = 0; gx < gw - 1; gx++) {
          const v0 = field[r0 + gx];
          const v1 = field[r0 + gx + 1];
          const v2 = field[r1 + gx + 1];
          const v3 = field[r1 + gx];
          const code = (v0 >= iso ? 8 : 0) | (v1 >= iso ? 4 : 0) | (v2 >= iso ? 2 : 0) | (v3 >= iso ? 1 : 0);
          if (code === 0 || code === 15) continue;
          const pairs = topoCellPairs(code, v0, v1, v2, v3, iso);
          if (!pairs) continue;
          for (let q = 0; q < pairs.length; q++) {
            const [eA, eB] = pairs[q];
            const pA = topoEdgePoint(eA, gx, gy, v0, v1, v2, v3, iso);
            const pB = topoEdgePoint(eB, gx, gy, v0, v1, v2, v3, iso);
            segments.push([pA[0], pA[1], pB[0], pB[1]]);
          }
        }
      }

      const chains = topoStitchSegments(segments);
      const major = lv % TOPO_DEFAULTS.majorStep === 0;
      const elevation = topoNiceElevation(levelNorm * maxPartLoc);

      for (let c = 0; c < chains.length; c++) {
        const chain = chains[c];
        const smoothed = topoChaikin(chain.pts, chain.closed, TOPO_DEFAULTS.chaikinPasses);
        const points = new Array(smoothed.length);
        let hotHits = 0;
        const partVotes = new Map();

        for (let k = 0; k < smoothed.length; k++) {
          const gxF = smoothed[k][0];
          const gyF = smoothed[k][1];
          const wx = safeBox.left + (gxF / (gw - 1)) * boxW;
          const wy = safeBox.top + (gyF / (gh - 1)) * boxH;
          points[k] = {
            x: topoRound2(Math.max(safeBox.left, Math.min(safeBox.right, wx))),
            y: topoRound2(Math.max(safeBox.top, Math.min(safeBox.bottom, wy))),
          };
          const cgx = Math.max(0, Math.min(gw - 1, Math.round(gxF)));
          const cgy = Math.max(0, Math.min(gh - 1, Math.round(gyF)));
          const own = ownerPart[cgy * gw + cgx];
          if (own >= 0) {
            if (nodes[own].hot) hotHits++;
            partVotes.set(own, (partVotes.get(own) ?? 0) + 1);
          }
        }

        let dominantPart = 0;
        let maxVotes = -1;
        for (const [pIdx, votes] of partVotes.entries()) {
          if (votes > maxVotes) {
            maxVotes = votes;
            dominantPart = pIdx;
          }
        }
        const hot = hotHits * 2 >= smoothed.length && hotHits > 0;
        if (hot) accentCount++;

        contours.push({
          levelIndex: lv,
          levelNorm: Math.round(levelNorm * 10000) / 10000,
          major,
          hot,
          closed: chain.closed,
          elevation,
          partIndex: dominantPart,
          partId: nodes[dominantPart]?.id ?? normParts[0].id,
          points,
        });
      }
    }
  }

  // Compute summit markers (one per part), nudging deterministically if two labels would collide.
  const summits = nodes.map((nd, i) => ({
    partId: nd.id,
    partName: nd.name,
    x: topoRound2(partPeakX[i]),
    y: topoRound2(partPeakY[i]),
    loc: Math.round(nd.loc),
    files: nd.files,
    share: Math.round(nd.share * 10000) / 10000,
    hot: nd.hot,
    peakVal: Math.round((partPeakVal[i] > 0 ? partPeakVal[i] / (maxElevation || 1) : nd.height) * 1000) / 1000,
  }));

  const minLabelW = Math.min(92, boxW * 0.16);
  const minLabelH = Math.min(30, boxH * 0.06);
  const summitPadX = Math.min(54, boxW * 0.09);
  const summitPadY = Math.min(26, boxH * 0.06);
  for (let pass = 0; pass < 16; pass++) {
    let moved = false;
    for (let i = 0; i < summits.length; i++) {
      for (let j = i + 1; j < summits.length; j++) {
        const a = summits[i];
        const b = summits[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < minLabelW && ady < minLabelH) {
          moved = true;
          const overlapY = (minLabelH - ady) * 0.52 + 1;
          const dirY = dy === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dy);
          const dirX = dx === 0 ? (j % 2 === 0 ? 1 : -1) : Math.sign(dx);
          a.y = topoRound2(Math.max(safeBox.top + summitPadY, Math.min(safeBox.bottom - summitPadY, a.y - dirY * overlapY)));
          b.y = topoRound2(Math.max(safeBox.top + summitPadY, Math.min(safeBox.bottom - summitPadY, b.y + dirY * overlapY)));
          if (adx < minLabelW * 0.5) {
            const nudgeX = (minLabelW * 0.5 - adx) * 0.25;
            a.x = topoRound2(Math.max(safeBox.left + summitPadX, Math.min(safeBox.right - summitPadX, a.x - dirX * nudgeX)));
            b.x = topoRound2(Math.max(safeBox.left + summitPadX, Math.min(safeBox.right - summitPadX, b.x + dirX * nudgeX)));
          }
        }
      }
    }
    if (!moved) break;
  }

  return {
    kind: "topo",
    box: safeBox,
    levels: levelCount,
    contours,
    summits,
    representedParts: summits.length,
    accentCount,
  };
}

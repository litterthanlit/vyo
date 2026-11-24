// Pure Architectural PCB / Circuit Schematic geometry engine.
// Partitions codebase parts into proportional IC chambers via a deterministic squarified treemap
// with non-overlapping routing gutters, subdivides each chamber into file-slice silicon die cells,
// and routes real import ties strictly through open gutter & perimeter corridors via a deterministic
// corridor-graph Dijkstra router with bend/congestion costs, safe parallel lane offsets, and 45-deg chamfers.

export const BLUEPRINT_DEFAULTS = {
  gutter: 28,
  headerH: 20,
  laneStep: 4.5,
  chamfer: 7,
  maxTraces: 44,
  pinRadius: 2.6,
  junctionRadius: 2.0,
};

function blueprintRound2(v) {
  return Math.round(v * 100) / 100;
}

/** Worst aspect ratio for placing a row of normalized areas `row` along a side of length `side`. */
function blueprintWorstAspect(row, side) {
  if (!row.length || side <= 0) return Infinity;
  let sum = 0;
  let minA = Infinity;
  let maxA = 0;
  for (let i = 0; i < row.length; i++) {
    const a = row[i].area;
    sum += a;
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
  }
  if (minA <= 0 || sum <= 0) return Infinity;
  const s2 = side * side;
  const sum2 = sum * sum;
  return Math.max((s2 * maxA) / sum2, sum2 / (s2 * minA));
}

/**
 * Deterministic Bruls-Huizing-van Wijk squarified treemap inside `rect = { x, y, w, h }`.
 */
function blueprintSquarify(items, rect) {
  if (!items.length || rect.w <= 0 || rect.h <= 0) return [];
  const totalW = items.reduce((s, it) => s + Math.max(1e-6, it.weight), 0);
  const totalArea = rect.w * rect.h;
  const sorted = items
    .map((it, order) => ({
      item: it,
      order,
      area: (Math.max(1e-6, it.weight) / totalW) * totalArea,
    }))
    .sort((a, b) => b.area - a.area || a.order - b.order);

  const out = [];
  let cur = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  let idx = 0;

  while (idx < sorted.length) {
    const horizStrip = cur.w <= cur.h;
    const side = Math.max(1e-6, horizStrip ? cur.w : cur.h);
    const row = [sorted[idx++]];
    let bestWorst = blueprintWorstAspect(row, side);

    while (idx < sorted.length) {
      const candidate = [...row, sorted[idx]];
      const candWorst = blueprintWorstAspect(candidate, side);
      if (candWorst <= bestWorst) {
        row.push(sorted[idx++]);
        bestWorst = candWorst;
      } else {
        break;
      }
    }

    const rowArea = row.reduce((s, r) => s + r.area, 0);
    if (horizStrip) {
      const stripH = cur.w > 0 ? Math.min(cur.h, rowArea / cur.w) : 0;
      let cx = cur.x;
      for (let i = 0; i < row.length; i++) {
        const w = i === row.length - 1 ? Math.max(0, cur.x + cur.w - cx) : (stripH > 0 ? row[i].area / stripH : 0);
        out.push({ item: row[i].item, x: cx, y: cur.y, w, h: stripH });
        cx += w;
      }
      cur = { x: cur.x, y: cur.y + stripH, w: cur.w, h: Math.max(0, cur.h - stripH) };
    } else {
      const stripW = cur.h > 0 ? Math.min(cur.w, rowArea / cur.h) : 0;
      let cy = cur.y;
      for (let i = 0; i < row.length; i++) {
        const h = i === row.length - 1 ? Math.max(0, cur.y + cur.h - cy) : (stripW > 0 ? row[i].area / stripW : 0);
        out.push({ item: row[i].item, x: cur.x, y: cy, w: stripW, h });
        cy += h;
      }
      cur = { x: cur.x + stripW, y: cur.y, w: Math.max(0, cur.w - stripW), h: cur.h };
    }
  }
  return out;
}

/** Liang-Barsky test: does segment a->b intersect the open interior of rect [x0, x1] x [y0, y1]? */
function blueprintSegIntersectsRect(a, b, x0, y0, x1, y1) {
  if (x1 <= x0 || y1 <= y0) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const checks = [
    [-dx, a.x - x0],
    [dx, x1 - a.x],
    [-dy, a.y - y0],
    [dy, y1 - a.y],
  ];
  for (let i = 0; i < 4; i++) {
    const p = checks[i][0];
    const q = checks[i][1];
    if (Math.abs(p) < 1e-9) {
      if (q <= 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t1 - t0 > 1e-5;
}

/** Check whether segment a->b intersects any chamber's rect (inset > 0 shrinks chamber; inset < 0 expands). */
function blueprintSegHitsAnyChamber(a, b, chambers, inset = 0.25) {
  for (let i = 0; i < chambers.length; i++) {
    const c = chambers[i];
    if (blueprintSegIntersectsRect(a, b, c.x + inset, c.y + inset, c.x + c.w - inset, c.y + c.h - inset)) {
      return true;
    }
  }
  return false;
}

function blueprintDedupSorted(values, eps = 0.8) {
  const sorted = [...values].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    const v = blueprintRound2(sorted[i]);
    if (!out.length || v - out[out.length - 1] > eps) out.push(v);
  }
  return out;
}

function blueprintDedupPoints(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = { x: blueprintRound2(pts[i].x), y: blueprintRound2(pts[i].y) };
    if (!out.length || Math.hypot(p.x - out[out.length - 1].x, p.y - out[out.length - 1].y) >= 0.05) {
      out.push(p);
    }
  }
  if (out.length <= 2) return out;
  const clean = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const a = clean[clean.length - 1];
    const b = out[i];
    const c = out[i + 1];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
    if (Math.abs(cross) < 1e-3 && dot > 0) continue;
    clean.push(b);
  }
  clean.push(out[out.length - 1]);
  return clean;
}

function blueprintPathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return blueprintRound2(len);
}

/**
 * Build the orthogonal corridor visibility graph from all gutter midlines + outer perimeter channels.
 * Every edge in this graph is guaranteed strictly clear of all chamber interiors (by >= 1px).
 */
function blueprintBuildCorridorGraph(chambers, safeBox, outerPad) {
  const rawXs = [
    safeBox.left + Math.max(5, outerPad * 0.45),
    safeBox.right - Math.max(5, outerPad * 0.45),
  ];
  const rawYs = [
    safeBox.top + Math.max(5, outerPad * 0.45),
    safeBox.bottom - Math.max(5, outerPad * 0.45),
  ];
  for (let i = 0; i < chambers.length; i++) {
    const r = chambers[i].rawRect;
    rawXs.push(r.x, r.x + r.w);
    rawYs.push(r.y, r.y + r.h);
  }
  const xs = blueprintDedupSorted(rawXs, 0.8);
  const ys = blueprintDedupSorted(rawYs, 0.8);
  const nx = xs.length;
  const ny = ys.length;
  const nodes = new Array(nx * ny);
  const adj = Array.from({ length: nx * ny }, () => []);

  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      nodes[iy * nx + ix] = { x: xs[ix], y: ys[iy], ix, iy };
    }
  }

  const addEdge = (u, v, dir) => {
    const a = nodes[u];
    const b = nodes[v];
    if (blueprintSegHitsAnyChamber(a, b, chambers, -0.75)) return;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const key = u < v ? `${u}:${v}` : `${v}:${u}`;
    adj[u].push({ to: v, dist, dir, key });
    adj[v].push({ to: u, dist, dir, key });
  };

  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const id = iy * nx + ix;
      if (ix + 1 < nx) addEdge(id, id + 1, 1);
      if (iy + 1 < ny) addEdge(id, id + nx, 2);
    }
  }

  return { xs, ys, nx, ny, nodes, adj };
}

function blueprintClosestIndex(arr, val) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(arr[i] - val);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Find bracketing grid indices [lo, hi] in sorted `arr` around `val`. */
function blueprintBracket(arr, val) {
  let lo = 0;
  let hi = arr.length - 1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] <= val + 0.05) lo = i;
    if (arr[i] >= val - 0.05) {
      hi = i;
      break;
    }
  }
  return [lo, hi];
}

/**
 * Route an orthogonal path between `cA` (on chamber A's corridor edge) and `cB` (on chamber B's corridor edge)
 * through the corridor graph using deterministic Dijkstra with bend penalties and congestion spreading.
 */
function blueprintDijkstraCorridor(graph, chambers, cA, sideA, cB, sideB, edgeUsage) {
  const { xs, ys, nx, ny, nodes, adj } = graph;
  const baseCount = nodes.length;
  const startId = baseCount;
  const endId = baseCount + 1;

  const snapCorr = (pt, side) => {
    if (side === "left" || side === "right") {
      return { x: xs[blueprintClosestIndex(xs, pt.x)], y: blueprintRound2(pt.y) };
    }
    return { x: blueprintRound2(pt.x), y: ys[blueprintClosestIndex(ys, pt.y)] };
  };
  const sA = snapCorr(cA, sideA);
  const sB = snapCorr(cB, sideB);

  const extraNodes = [sA, sB];
  const extraAdjStart = [];
  const extraAdjEnd = [];
  const extraBackToEnd = new Map();

  const attachPoint = (pt, side, isStart) => {
    const vertCorr = side === "left" || side === "right";
    const list = isStart ? extraAdjStart : extraAdjEnd;
    if (vertCorr) {
      const ix = blueprintClosestIndex(xs, pt.x);
      const [iyLo, iyHi] = blueprintBracket(ys, pt.y);
      const targets = iyLo === iyHi ? [iyLo] : [iyLo, iyHi];
      for (const iy of targets) {
        const nid = iy * nx + ix;
        const np = nodes[nid];
        if (!blueprintSegHitsAnyChamber(pt, np, chambers, -0.5)) {
          const dist = Math.hypot(np.x - pt.x, np.y - pt.y);
          const dir = Math.abs(np.x - pt.x) < 0.02 ? 2 : 1;
          const key = `tmp:${isStart ? "s" : "e"}:${nid}`;
          list.push({ to: nid, dist, dir, key });
          if (!isStart) extraBackToEnd.set(nid, { to: endId, dist, dir, key });
        }
      }
    } else {
      const iy = blueprintClosestIndex(ys, pt.y);
      const [ixLo, ixHi] = blueprintBracket(xs, pt.x);
      const targets = ixLo === ixHi ? [ixLo] : [ixLo, ixHi];
      for (const ix of targets) {
        const nid = iy * nx + ix;
        const np = nodes[nid];
        if (!blueprintSegHitsAnyChamber(pt, np, chambers, -0.5)) {
          const dist = Math.hypot(np.x - pt.x, np.y - pt.y);
          const dir = Math.abs(np.y - pt.y) < 0.02 ? 1 : 2;
          const key = `tmp:${isStart ? "s" : "e"}:${nid}`;
          list.push({ to: nid, dist, dir, key });
          if (!isStart) extraBackToEnd.set(nid, { to: endId, dist, dir, key });
        }
      }
    }
  };

  attachPoint(sA, sideA, true);
  attachPoint(sB, sideB, false);

  // Direct corridor connection only when both pins lie on the exact same unobstructed corridor line.
  const sameX = Math.abs(sA.x - sB.x) < 0.01;
  const sameY = Math.abs(sA.y - sB.y) < 0.01;
  if ((sameX || sameY) && !blueprintSegHitsAnyChamber(sA, sB, chambers, -0.5)) {
    const dist = Math.hypot(sB.x - sA.x, sB.y - sA.y);
    const dir = sameX ? 2 : 1;
    extraAdjStart.push({ to: endId, dist, dir, key: "tmp:direct" });
  }

  // Dijkstra over state = nodeId * 3 + dir (dir: 0=none, 1=H, 2=V).
  const totalNodes = baseCount + 2;
  const stateCount = totalNodes * 3;
  const bestCost = new Float64Array(stateCount).fill(Infinity);
  const prevState = new Int32Array(stateCount).fill(-1);
  const prevEdgeKey = new Array(stateCount).fill(null);
  const visited = new Uint8Array(stateCount);

  const startDir = (sideA === "left" || sideA === "right") ? 1 : 2;
  const startState = startId * 3 + startDir;
  bestCost[startState] = 0;

  const BEND_PENALTY = 24;
  const CONGESTION_COST = 18;

  for (;;) {
    let bestS = -1;
    let bestC = Infinity;
    for (let s = 0; s < stateCount; s++) {
      if (!visited[s] && bestCost[s] < bestC) {
        bestC = bestCost[s];
        bestS = s;
      }
    }
    if (bestS < 0) break;
    const curNode = Math.floor(bestS / 3);
    const curDir = bestS % 3;
    if (curNode === endId) {
      // Reconstruct node chain + record congestion on corridor edges.
      const chain = [];
      const usedKeys = [];
      let s = bestS;
      while (s >= 0) {
        const nid = Math.floor(s / 3);
        const pt = nid < baseCount ? { x: nodes[nid].x, y: nodes[nid].y } : extraNodes[nid - baseCount];
        chain.push(pt);
        if (prevEdgeKey[s] && !prevEdgeKey[s].startsWith("tmp:")) usedKeys.push(prevEdgeKey[s]);
        s = prevState[s];
      }
      chain.reverse();
      for (let i = 0; i < usedKeys.length; i++) {
        edgeUsage.set(usedKeys[i], (edgeUsage.get(usedKeys[i]) ?? 0) + 1);
      }
      return chain;
    }
    visited[bestS] = 1;

    const neighbors = curNode === startId ? extraAdjStart : (curNode < baseCount ? adj[curNode] : []);
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      const bend = (curDir !== 0 && curDir !== e.dir) ? BEND_PENALTY : 0;
      const cong = e.key.startsWith("tmp:") ? 0 : (edgeUsage.get(e.key) ?? 0) * CONGESTION_COST;
      const nextCost = bestC + e.dist + bend + cong;
      const ns = e.to * 3 + e.dir;
      if (!visited[ns] && nextCost < bestCost[ns]) {
        bestCost[ns] = nextCost;
        prevState[ns] = bestS;
        prevEdgeKey[ns] = e.key;
      }
    }
    if (curNode < baseCount && extraBackToEnd.has(curNode)) {
      const e = extraBackToEnd.get(curNode);
      const bend = (curDir !== 0 && curDir !== e.dir) ? BEND_PENALTY : 0;
      const nextCost = bestC + e.dist + bend;
      const ns = e.to * 3 + e.dir;
      if (!visited[ns] && nextCost < bestCost[ns]) {
        bestCost[ns] = nextCost;
        prevState[ns] = bestS;
        prevEdgeKey[ns] = e.key;
      }
    }
  }
  return null;
}

/**
 * Shift interior corridor segments by parallel lane offsets clamped strictly inside each corridor's open width
 * so parallel traces form crisp PCB bus bundles without ever clipping any chamber.
 */
function blueprintApplySafeLaneOffsets(orthoPts, chambers, safeBox, laneUsage) {
  const pts = orthoPts.map((p) => ({ x: blueprintRound2(p.x), y: blueprintRound2(p.y) }));
  if (pts.length < 4) return pts;

  for (let k = 1; k <= pts.length - 3; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const isVert = Math.abs(dx) < 0.08 && Math.abs(dy) >= 1;
    const isHoriz = Math.abs(dy) < 0.08 && Math.abs(dx) >= 1;
    if (!isVert && !isHoriz) continue;

    if (isVert) {
      const x = a.x;
      const yLo = Math.min(a.y, b.y);
      const yHi = Math.max(a.y, b.y);
      let leftWall = safeBox.left;
      let rightWall = safeBox.right;
      for (let i = 0; i < chambers.length; i++) {
        const c = chambers[i];
        if (c.y + c.h > yLo - 1.5 && c.y < yHi + 1.5) {
          if (c.x + c.w <= x + 0.5 && c.x + c.w > leftWall) leftWall = c.x + c.w;
          if (c.x >= x - 0.5 && c.x < rightWall) rightWall = c.x;
        }
      }
      const safeMin = blueprintRound2(Math.max(safeBox.left + 4, leftWall + 3.2));
      const safeMax = blueprintRound2(Math.min(safeBox.right - 4, rightWall - 3.2));
      const avail = safeMax - safeMin;
      if (avail < 2) continue;

      const cKey = `V:${Math.round(x / 2)}:${Math.round((yLo + yHi) / 60)}`;
      const slot = laneUsage.get(cKey) ?? 0;
      laneUsage.set(cKey, slot + 1);
      const signed = slot === 0 ? 0 : (slot % 2 === 1 ? Math.ceil(slot / 2) : -slot / 2);
      const step = avail < 14 ? Math.max(2.4, avail / 5) : BLUEPRINT_DEFAULTS.laneStep;
      const candX = blueprintRound2(Math.max(safeMin, Math.min(safeMax, x + signed * step)));
      if (Math.abs(candX - x) < 0.05) continue;

      const newA = { x: candX, y: a.y };
      const newB = { x: candX, y: b.y };
      // Verify the shifted segment and both adjacent perpendicular segments remain 100% clear of all chambers.
      if (
        !blueprintSegHitsAnyChamber(newA, newB, chambers, -0.5)
        && !blueprintSegHitsAnyChamber(pts[k - 1], newA, chambers, 0.2)
        && !blueprintSegHitsAnyChamber(newB, pts[k + 2], chambers, 0.2)
      ) {
        pts[k] = newA;
        pts[k + 1] = newB;
      }
    } else {
      const y = a.y;
      const xLo = Math.min(a.x, b.x);
      const xHi = Math.max(a.x, b.x);
      let topWall = safeBox.top;
      let botWall = safeBox.bottom;
      for (let i = 0; i < chambers.length; i++) {
        const c = chambers[i];
        if (c.x + c.w > xLo - 1.5 && c.x < xHi + 1.5) {
          if (c.y + c.h <= y + 0.5 && c.y + c.h > topWall) topWall = c.y + c.h;
          if (c.y >= y - 0.5 && c.y < botWall) botWall = c.y;
        }
      }
      const safeMin = blueprintRound2(Math.max(safeBox.top + 4, topWall + 3.2));
      const safeMax = blueprintRound2(Math.min(safeBox.bottom - 4, botWall - 3.2));
      const avail = safeMax - safeMin;
      if (avail < 2) continue;

      const cKey = `H:${Math.round(y / 2)}:${Math.round((xLo + xHi) / 60)}`;
      const slot = laneUsage.get(cKey) ?? 0;
      laneUsage.set(cKey, slot + 1);
      const signed = slot === 0 ? 0 : (slot % 2 === 1 ? Math.ceil(slot / 2) : -slot / 2);
      const step = avail < 14 ? Math.max(2.4, avail / 5) : BLUEPRINT_DEFAULTS.laneStep;
      const candY = blueprintRound2(Math.max(safeMin, Math.min(safeMax, y + signed * step)));
      if (Math.abs(candY - y) < 0.05) continue;

      const newA = { x: a.x, y: candY };
      const newB = { x: b.x, y: candY };
      if (
        !blueprintSegHitsAnyChamber(newA, newB, chambers, -0.5)
        && !blueprintSegHitsAnyChamber(pts[k - 1], newA, chambers, 0.2)
        && !blueprintSegHitsAnyChamber(newB, pts[k + 2], chambers, 0.2)
      ) {
        pts[k] = newA;
        pts[k + 1] = newB;
      }
    }
  }
  return blueprintDedupPoints(pts);
}

/**
 * Convert every 90-degree bend in an orthogonal polyline into a crisp exact-45-degree chamfer (6..8px),
 * verifying each diagonal stays strictly clear of all chamber interiors.
 */
function blueprintChamferOrthogonal(orthoPts, chambers, targetChamfer = BLUEPRINT_DEFAULTS.chamfer) {
  const pts = blueprintDedupPoints(orthoPts);
  if (pts.length <= 2) return pts;

  const out = [pts[0]];
  for (let k = 1; k < pts.length - 1; k++) {
    const prev = pts[k - 1];
    const cur = pts[k];
    const next = pts[k + 1];
    const dxIn = cur.x - prev.x;
    const dyIn = cur.y - prev.y;
    const dxOut = next.x - cur.x;
    const dyOut = next.y - cur.y;
    const lenIn = Math.hypot(dxIn, dyIn);
    const lenOut = Math.hypot(dxOut, dyOut);

    const inH = Math.abs(dyIn) < 0.05 && lenIn >= 0.5;
    const inV = Math.abs(dxIn) < 0.05 && lenIn >= 0.5;
    const outH = Math.abs(dyOut) < 0.05 && lenOut >= 0.5;
    const outV = Math.abs(dxOut) < 0.05 && lenOut >= 0.5;

    if (!((inH && outV) || (inV && outH))) {
      out.push(cur);
      continue;
    }

    const uxIn = inH ? Math.sign(dxIn) : 0;
    const uyIn = inV ? Math.sign(dyIn) : 0;
    const uxOut = outH ? Math.sign(dxOut) : 0;
    const uyOut = outV ? Math.sign(dyOut) : 0;

    let c = blueprintRound2(Math.min(targetChamfer, lenIn * 0.42, lenOut * 0.42));
    let placed = false;
    while (c >= 1.5) {
      const pBefore = {
        x: blueprintRound2(cur.x - uxIn * c),
        y: blueprintRound2(cur.y - uyIn * c),
      };
      const pAfter = {
        x: blueprintRound2(cur.x + uxOut * c),
        y: blueprintRound2(cur.y + uyOut * c),
      };
      if (!blueprintSegHitsAnyChamber(pBefore, pAfter, chambers, -0.25)) {
        out.push(pBefore, pAfter);
        placed = true;
        break;
      }
      c = blueprintRound2(c * 0.55);
    }
    if (!placed) out.push(cur);
  }
  out.push(pts[pts.length - 1]);
  return blueprintDedupPoints(out);
}

/**
 * Build the Architectural PCB / Circuit Schematic plate geometry inside `box`.
 * @param {{ slices?: any[], parts?: any[], ties?: [number, number, number][], box: { left: number, right: number, top: number, bottom: number }, seed?: number }} opts
 */
export function buildBlueprintPlate({ slices = [], parts = [], ties = [], box, seed = 1 }) {
  const safeBox = {
    left: Number(box?.left) || 0,
    right: Number(box?.right) || 800,
    top: Number(box?.top) || 0,
    bottom: Number(box?.bottom) || 600,
  };

  let normParts = parts;
  if (!normParts.length && slices.length) {
    const byId = new Map();
    for (const sl of slices) {
      const prev = byId.get(sl.partId) ?? { id: sl.partId, name: sl.partName ?? sl.partId, loc: 0, files: 0, hot: !!sl.hot };
      prev.loc += Number(sl.loc) || 0;
      prev.files += sl.files?.length || 1;
      if (sl.hot) prev.hot = true;
      byId.set(sl.partId, prev);
    }
    normParts = [...byId.values()];
  }

  const P = normParts.length;
  if (!P) {
    return {
      kind: "blueprint",
      box: safeBox,
      chambers: [],
      traces: [],
      vias: [],
      representedParts: 0,
      accentCount: 0,
    };
  }

  const boxW = Math.max(1, safeBox.right - safeBox.left);
  const boxH = Math.max(1, safeBox.bottom - safeBox.top);
  const minDim = Math.min(boxW, boxH);
  const totalLoc = normParts.reduce((s, p) => s + Math.max(1, Number(p.loc) || 0), 0);

  // Outer peripheral bus margin so perimeter tracks breathe around outer chambers cleanly.
  const outerPad = Math.max(16, Math.min(26, Math.round(minDim * 0.032)));
  const innerRect = {
    x: safeBox.left + outerPad,
    y: safeBox.top + outerPad,
    w: Math.max(20, boxW - 2 * outerPad),
    h: Math.max(20, boxH - 2 * outerPad),
  };

  // Floor tiny parts gently so every chamber keeps readable labels and internal sub-cells.
  const minShareFloor = Math.min(0.032, 0.32 / Math.max(1, P));
  const treemapItems = normParts.map((p, partIndex) => {
    const rawLoc = Math.max(1, Number(p.loc) || 0);
    return {
      partIndex,
      part: p,
      rawLoc,
      share: rawLoc / totalLoc,
      weight: Math.max(rawLoc, totalLoc * minShareFloor),
    };
  });

  const rawLayout = blueprintSquarify(treemapItems, innerRect);

  // Crisp routing gutter carved symmetrically from every treemap cell so chambers never overlap.
  const targetGutter = P <= 8 ? BLUEPRINT_DEFAULTS.gutter : P <= 12 ? 24 : 20;
  const minRawDim = Math.min(...rawLayout.map((r) => Math.min(r.w, r.h)));
  const gutter = Math.max(10, Math.min(targetGutter, Math.floor(minRawDim * 0.44)));
  const halfGutter = gutter * 0.5;

  // Group slices by partIndex.
  const partIdToIdx = new Map(normParts.map((p, i) => [p.id, i]));
  const slicesByPart = Array.from({ length: P }, () => []);
  for (let i = 0; i < slices.length; i++) {
    const sl = slices[i];
    const pIdx = partIdToIdx.has(sl.partId) ? partIdToIdx.get(sl.partId) : Math.min(P - 1, Math.max(0, sl.partIndex ?? 0));
    slicesByPart[pIdx].push(sl);
  }

  const chambersByIdx = new Array(P);
  for (let i = 0; i < rawLayout.length; i++) {
    const r = rawLayout[i];
    const { partIndex, part, rawLoc, share } = r.item;

    const cx0 = blueprintRound2(r.x + halfGutter);
    const cy0 = blueprintRound2(r.y + halfGutter);
    const cw = blueprintRound2(Math.max(8, r.w - gutter));
    const ch = blueprintRound2(Math.max(8, r.h - gutter));
    const headerH = Math.min(BLUEPRINT_DEFAULTS.headerH, Math.max(12, Math.floor(ch * 0.28)));

    // Recursively squarify this chamber's slices into internal silicon die sub-cells.
    const diePadX = Math.min(6, Math.max(2, Math.floor(cw * 0.05)));
    const diePadTop = headerH + 4;
    const diePadBot = Math.min(6, Math.max(2, Math.floor(ch * 0.05)));
    const dieRect = {
      x: cx0 + diePadX,
      y: cy0 + diePadTop,
      w: Math.max(0, cw - 2 * diePadX),
      h: Math.max(0, ch - diePadTop - diePadBot),
    };

    const pSlices = slicesByPart[partIndex];
    let cells = [];
    if (dieRect.w >= 6 && dieRect.h >= 6) {
      const cellItems = (pSlices.length
        ? pSlices
        : [{ index: partIndex, loc: rawLoc, locNorm: 0.5, degreeNorm: 0, coupling: 0, hot: !!part.hot }]
      ).map((sl, k) => ({
        slice: sl,
        k,
        weight: Math.max(1, Number(sl.loc) || 1),
      }));
      const subLayout = blueprintSquarify(cellItems, dieRect);
      cells = subLayout.map((sr) => {
        const inset = Math.min(1.5, sr.w * 0.14, sr.h * 0.14);
        const sl = sr.item.slice;
        return {
          x: blueprintRound2(sr.x + inset),
          y: blueprintRound2(sr.y + inset),
          w: blueprintRound2(Math.max(1.5, sr.w - 2 * inset)),
          h: blueprintRound2(Math.max(1.5, sr.h - 2 * inset)),
          sliceIndex: sl.index ?? sr.item.k,
          loc: Math.round(Number(sl.loc) || 0),
          locNorm: Math.round(Math.max(0, Math.min(1, Number(sl.locNorm) || 0)) * 1000) / 1000,
          degreeNorm: Math.round(Math.max(0, Math.min(1, Number(sl.degreeNorm) || 0)) * 1000) / 1000,
          coupling: Math.round((Number(sl.coupling) || 0) * 100) / 100,
          hot: !!part.hot,
        };
      });
    }

    chambersByIdx[partIndex] = {
      partIndex,
      partId: part.id,
      partName: part.name ?? part.id,
      loc: Math.round(rawLoc),
      files: Number(part.files) || pSlices.length || 1,
      share: Math.round(share * 10000) / 10000,
      hot: !!part.hot,
      x: cx0,
      y: cy0,
      w: cw,
      h: ch,
      cx: blueprintRound2(cx0 + cw * 0.5),
      cy: blueprintRound2(cy0 + ch * 0.5),
      headerH,
      rawRect: {
        x: blueprintRound2(r.x),
        y: blueprintRound2(r.y),
        w: blueprintRound2(r.w),
        h: blueprintRound2(r.h),
      },
      cells,
      pinCount: 0,
    };
  }

  const chambers = chambersByIdx;
  const graph = blueprintBuildCorridorGraph(chambers, safeBox, outerPad);

  // Select and expand real import ties into visual bus traces.
  const validTies = [];
  for (const tie of ties ?? []) {
    const [i, j, w] = tie;
    if (i >= 0 && i < P && j >= 0 && j < P && i !== j && w > 0) {
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      validTies.push([a, b, w]);
    }
  }
  validTies.sort((a, b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]);

  const traces = [];
  const vias = [];
  const viaSeen = new Set();
  const addVia = (x, y, r, hot, kind) => {
    const rx = blueprintRound2(x);
    const ry = blueprintRound2(y);
    const key = `${Math.round(rx / 2.5)},${Math.round(ry / 2.5)}`;
    if (viaSeen.has(key)) return;
    viaSeen.add(key);
    vias.push({ x: rx, y: ry, r, hot, kind });
  };

  const edgeUsage = new Map();
  const laneUsage = new Map();

  if (validTies.length > 0) {
    const maxTraces = BLUEPRINT_DEFAULTS.maxTraces;
    const maxWeight = validTies[0][2];
    const selected = [];
    const selectedKeys = new Set();
    const touchedParts = new Set();

    // Pass 1: strongest tie for each connected part.
    for (const tie of validTies) {
      const [i, j] = tie;
      if (!touchedParts.has(i) || !touchedParts.has(j)) {
        const key = `${i}:${j}`;
        if (!selectedKeys.has(key)) {
          selected.push(tie);
          selectedKeys.add(key);
        }
        touchedParts.add(i);
        touchedParts.add(j);
      }
    }
    // Pass 2: remaining ties in descending weight order up to cap.
    for (const tie of validTies) {
      if (selected.length >= maxTraces) break;
      const key = `${tie[0]}:${tie[1]}`;
      if (!selectedKeys.has(key)) {
        selected.push(tie);
        selectedKeys.add(key);
      }
    }

    // Expand heavy ties into 2-3 parallel bus lanes while staying within ~48 clean bus lines.
    const expanded = [];
    const laneCap = Math.min(48, Math.max(maxTraces, selected.length));
    let budget = Math.max(0, laneCap - selected.length);
    for (let t = 0; t < selected.length; t++) {
      const [i, j, w] = selected[t];
      const ratio = w / maxWeight;
      let lanes = 1;
      if (ratio >= 0.55 && budget >= 2) {
        lanes = 3;
        budget -= 2;
      } else if (ratio >= 0.24 && budget >= 1) {
        lanes = 2;
        budget -= 1;
      }
      for (let ln = 0; ln < lanes; ln++) {
        expanded.push({
          fromPart: i,
          toPart: j,
          weight: w,
          lane: ln,
          laneCount: lanes,
          hot: !!(chambers[i].hot || chambers[j].hot),
        });
      }
    }

    // Choose facing edges and allocate evenly-spaced distinct pin pads on each chamber edge.
    const edgeBins = new Map();
    const addPinReq = (chamberIdx, side, sortKey, req, endName) => {
      const key = `${chamberIdx}:${side}`;
      let list = edgeBins.get(key);
      if (!list) {
        list = [];
        edgeBins.set(key, list);
      }
      list.push({ sortKey, req, endName });
    };

    const reqs = expanded.map((item, idx) => {
      const A = chambers[item.fromPart];
      const B = chambers[item.toPart];
      const dx = B.cx - A.cx;
      const dy = B.cy - A.cy;
      const horiz = Math.abs(dx) >= Math.abs(dy);
      const sideA = horiz ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top");
      const sideB = horiz ? (dx >= 0 ? "left" : "right") : (dy >= 0 ? "top" : "bottom");
      const req = { ...item, idx, horiz, sideA, sideB, pA: null, cA: null, pB: null, cB: null };
      const sortA = horiz ? B.cy + item.lane * 0.01 : B.cx + item.lane * 0.01;
      const sortB = horiz ? A.cy + item.lane * 0.01 : A.cx + item.lane * 0.01;
      addPinReq(item.fromPart, sideA, sortA, req, "A");
      addPinReq(item.toPart, sideB, sortB, req, "B");
      return req;
    });

    for (const [key, list] of edgeBins.entries()) {
      const [cStr, side] = key.split(":");
      const ch = chambers[Number(cStr)];
      list.sort((a, b) => a.sortKey - b.sortKey || a.req.idx - b.req.idx);
      const count = list.length;
      ch.pinCount += count;

      const isVertEdge = side === "left" || side === "right";
      const start = isVertEdge ? ch.y + Math.min(ch.headerH + 4, ch.h * 0.25) : ch.x;
      const span = isVertEdge ? Math.max(4, ch.y + ch.h - start) : ch.w;
      const edgePad = Math.min(14, span * 0.14);
      const usable = Math.max(0, span - 2 * edgePad);

      for (let k = 0; k < count; k++) {
        const frac = count === 1 ? 0.5 : k / (count - 1);
        const pos = start + edgePad + frac * usable;
        let px;
        let py;
        let cx;
        let cy;
        if (side === "right") {
          px = ch.x + ch.w;
          py = pos;
          cx = ch.rawRect.x + ch.rawRect.w;
          cy = py;
        } else if (side === "left") {
          px = ch.x;
          py = pos;
          cx = ch.rawRect.x;
          cy = py;
        } else if (side === "bottom") {
          px = pos;
          py = ch.y + ch.h;
          cx = px;
          cy = ch.rawRect.y + ch.rawRect.h;
        } else {
          px = pos;
          py = ch.y;
          cx = px;
          cy = ch.rawRect.y;
        }
        const pinPt = { x: blueprintRound2(px), y: blueprintRound2(py) };
        const corrPt = { x: blueprintRound2(cx), y: blueprintRound2(cy) };
        const entry = list[k];
        if (entry.endName === "A") {
          entry.req.pA = pinPt;
          entry.req.cA = corrPt;
        } else {
          entry.req.pB = pinPt;
          entry.req.cB = corrPt;
        }
      }
    }

    // Route every trace through the open corridor graph with safe lane offsets & 45-degree chamfers.
    for (let r = 0; r < reqs.length; r++) {
      const req = reqs[r];
      const corrChain = blueprintDijkstraCorridor(graph, chambers, req.cA, req.sideA, req.cB, req.sideB, edgeUsage);
      if (!corrChain || corrChain.length < 2) continue;

      const fullOrtho = blueprintDedupPoints([req.pA, ...corrChain, req.pB]);
      const shiftedOrtho = blueprintApplySafeLaneOffsets(fullOrtho, chambers, safeBox, laneUsage);
      const points = blueprintChamferOrthogonal(shiftedOrtho, chambers, BLUEPRINT_DEFAULTS.chamfer);
      const length = blueprintPathLength(points);

      traces.push({
        index: traces.length,
        fromPart: req.fromPart,
        toPart: req.toPart,
        weight: req.weight,
        lane: req.lane,
        hot: req.hot,
        syntheticBus: false,
        points,
        length,
      });

      addVia(req.pA.x, req.pA.y, BLUEPRINT_DEFAULTS.pinRadius, req.hot, "pin");
      addVia(req.pB.x, req.pB.y, BLUEPRINT_DEFAULTS.pinRadius, req.hot, "pin");
      if (points.length >= 5) {
        const midIdx = Math.floor(points.length / 2);
        addVia(points[midIdx].x, points[midIdx].y, BLUEPRINT_DEFAULTS.junctionRadius, req.hot, "junction");
      }
    }
  } else {
    // Zero-ties fallback: find an unobstructed full-span spine corridor (or perimeter bus) and route cleanly to it.
    const spineHoriz = boxW >= boxH;
    const candidates = spineHoriz ? graph.ys : graph.xs;
    const midTarget = spineHoriz ? (safeBox.top + safeBox.bottom) * 0.5 : (safeBox.left + safeBox.right) * 0.5;
    const sMin = spineHoriz ? graph.xs[0] : graph.ys[0];
    const sMax = spineHoriz ? graph.xs[graph.xs.length - 1] : graph.ys[graph.ys.length - 1];

    let spineCoord = candidates[0];
    let bestScore = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const coord = candidates[i];
      const p0 = spineHoriz ? { x: sMin, y: coord } : { x: coord, y: sMin };
      const p1 = spineHoriz ? { x: sMax, y: coord } : { x: coord, y: sMax };
      if (!blueprintSegHitsAnyChamber(p0, p1, chambers, -0.5)) {
        const score = Math.abs(coord - midTarget);
        if (score < bestScore) {
          bestScore = score;
          spineCoord = coord;
        }
      }
    }

    const spineStart = spineHoriz ? { x: blueprintRound2(sMin), y: blueprintRound2(spineCoord) } : { x: blueprintRound2(spineCoord), y: blueprintRound2(sMin) };
    const spineEnd = spineHoriz ? { x: blueprintRound2(sMax), y: blueprintRound2(spineCoord) } : { x: blueprintRound2(spineCoord), y: blueprintRound2(sMax) };
    const anyHot = chambers.some((c) => c.hot);
    const trunkPts = [spineStart, spineEnd];
    traces.push({
      index: traces.length,
      fromPart: 0,
      toPart: Math.max(0, P - 1),
      weight: 1,
      lane: 0,
      hot: anyHot,
      syntheticBus: true,
      points: trunkPts,
      length: blueprintPathLength(trunkPts),
    });
    addVia(spineStart.x, spineStart.y, BLUEPRINT_DEFAULTS.junctionRadius, anyHot, "junction");
    addVia(spineEnd.x, spineEnd.y, BLUEPRINT_DEFAULTS.junctionRadius, anyHot, "junction");

    for (let i = 0; i < P; i++) {
      const ch = chambers[i];
      ch.pinCount += 1;
      let sideA;
      let pA;
      let cA;
      let tap;
      let tapSide;
      if (spineHoriz) {
        const above = ch.cy <= spineCoord;
        sideA = above ? "bottom" : "top";
        pA = { x: ch.cx, y: blueprintRound2(above ? ch.y + ch.h : ch.y) };
        cA = { x: ch.cx, y: blueprintRound2(above ? ch.rawRect.y + ch.rawRect.h : ch.rawRect.y) };
        tap = { x: blueprintRound2(Math.max(sMin + 2, Math.min(sMax - 2, ch.cx))), y: blueprintRound2(spineCoord) };
        tapSide = above ? "top" : "bottom";
      } else {
        const leftOf = ch.cx <= spineCoord;
        sideA = leftOf ? "right" : "left";
        pA = { x: blueprintRound2(leftOf ? ch.x + ch.w : ch.x), y: ch.cy };
        cA = { x: blueprintRound2(leftOf ? ch.rawRect.x + ch.rawRect.w : ch.rawRect.x), y: ch.cy };
        tap = { x: blueprintRound2(spineCoord), y: blueprintRound2(Math.max(sMin + 2, Math.min(sMax - 2, ch.cy))) };
        tapSide = leftOf ? "left" : "right";
      }
      const corrChain = blueprintDijkstraCorridor(graph, chambers, cA, sideA, tap, tapSide, edgeUsage);
      const rawPts = corrChain ? blueprintDedupPoints([pA, ...corrChain]) : blueprintDedupPoints([pA, cA, tap]);
      const points = blueprintChamferOrthogonal(rawPts, chambers, 6);
      traces.push({
        index: traces.length,
        fromPart: i,
        toPart: i,
        weight: 1,
        lane: 0,
        hot: ch.hot,
        syntheticBus: true,
        points,
        length: blueprintPathLength(points),
      });
      addVia(pA.x, pA.y, BLUEPRINT_DEFAULTS.pinRadius, ch.hot, "pin");
      addVia(tap.x, tap.y, BLUEPRINT_DEFAULTS.junctionRadius, ch.hot, "junction");
    }
  }

  const accentCount = chambers.filter((c) => c.hot).length + traces.filter((t) => t.hot).length;

  return {
    kind: "blueprint",
    box: safeBox,
    chambers,
    traces,
    vias,
    representedParts: chambers.length,
    accentCount,
  };
}

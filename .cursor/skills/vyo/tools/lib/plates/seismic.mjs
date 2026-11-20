// Pure vector *Unknown Pleasures* ridgeline geometry engine.
// Stacked file-level traces with crisp flat pulsar shoulders, dramatic multi-row overlapping peaks,
// coherent geological part signatures, amplitude driven by LOC, peak sharpness & harmonic impulses
// driven by import degree, dedicated right-margin index band, and seamless C-infinity periodic loop drift.

export const SEISMIC_DEFAULTS = {
  samples: 160,
  shoulder: 0.115,
  envelopePower: 1.75,
  topPad: 96,
  bottomPad: 12,
  rightPadWide: 118,
  rightPadCompact: 96,
  ampRatio: 5.8,
  maxAmpCap: 118,
  minAmpFloor: 46,
};

function seismicHashInt(a, b) {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) ^ 0x5bd1e995;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return x >>> 0;
}

function seismicUnit(a, b) {
  return seismicHashInt(a, b) / 4294967296;
}

function seismicStrHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function seismicEnvelope(u, shoulder, power) {
  if (u <= shoulder || u >= 1 - shoulder) return 0;
  const uInner = (u - shoulder) / (1 - 2 * shoulder);
  const s = Math.sin(Math.PI * uInner);
  return s > 0 ? Math.pow(s, power) : 0;
}

/**
 * Build the vector seismic plate geometry for `slices` inside `box`.
 * @param {{ slices: any[], parts?: any[], box: { left: number, right: number, top: number, bottom: number }, seed?: number }} opts
 */
export function buildSeismicPlate({ slices = [], parts = [], box, seed = 1 }) {
  const safeBox = {
    left: Number(box?.left) || 0,
    right: Number(box?.right) || 800,
    top: Number(box?.top) || 0,
    bottom: Number(box?.bottom) || 600,
  };
  const n = slices.length;
  if (!n) {
    return {
      kind: "seismic",
      box: safeBox,
      traces: [],
      partBands: [],
      representedParts: 0,
      accentCount: 0,
    };
  }

  const boxW = Math.max(1, safeBox.right - safeBox.left);
  const boxH = Math.max(1, safeBox.bottom - safeBox.top);
  const samples = SEISMIC_DEFAULTS.samples;
  const shoulder = SEISMIC_DEFAULTS.shoulder;
  const envPower = SEISMIC_DEFAULTS.envelopePower;
  const seedInt = (Math.round(Number(seed) || 1) * 2654435761) >>> 0;

  // Dedicated right-margin corridor for area index ticks & labels (completely clear of all waveforms).
  const leftPad = Math.max(8, Math.min(18, Math.round(boxW * 0.02)));
  const targetRightPad = boxW >= 700 ? SEISMIC_DEFAULTS.rightPadWide : SEISMIC_DEFAULTS.rightPadCompact;
  const rightPad = Math.min(targetRightPad, Math.round(boxW * 0.24));
  const x0 = Math.round((safeBox.left + leftPad) * 100) / 100;
  const x1 = Math.round((safeBox.right - rightPad) * 100) / 100;

  // Dramatic Unknown Pleasures amplitude (~5.8x row spacing) with matching top headroom so crests soar cleanly.
  const bottomPad = Math.min(SEISMIC_DEFAULTS.bottomPad, boxH * 0.03);
  const estRowStep = n > 1 ? Math.max(1, boxH - SEISMIC_DEFAULTS.topPad - bottomPad) / (n - 1) : 0;
  const estMaxAmp = Math.min(SEISMIC_DEFAULTS.maxAmpCap, Math.max(SEISMIC_DEFAULTS.minAmpFloor, estRowStep * SEISMIC_DEFAULTS.ampRatio));
  const topPad = Math.min(boxH * 0.28, Math.max(52, Math.round(estMaxAmp * 0.92)));
  const usableH = Math.max(1, boxH - topPad - bottomPad);
  const rowStep = n > 1 ? usableH / (n - 1) : 0;
  const maxAmp = Math.min(SEISMIC_DEFAULTS.maxAmpCap, Math.max(SEISMIC_DEFAULTS.minAmpFloor, rowStep * SEISMIC_DEFAULTS.ampRatio));

  // Precompute coherent part-level geological ridge spines so each codebase area has a distinct signature.
  const partMap = new Map();
  const totalLoc = slices.reduce((s, sl) => s + Math.max(0, Number(sl.loc) || 0), 0) || 1;
  const partCounts = new Map();
  for (const sl of slices) {
    partCounts.set(sl.partId, (partCounts.get(sl.partId) ?? 0) + 1);
  }
  const partSeen = new Map();

  for (let i = 0; i < n; i++) {
    const sl = slices[i];
    if (partMap.has(sl.partId)) continue;
    const pHash = seismicStrHash(`${sl.partId}|${seedInt}`);
    // Primary massif center drifts laterally per part across [0.30, 0.70] inside the active window.
    const primaryCenter = 0.30 + 0.40 * seismicUnit(pHash, 1);
    const driftRate = (seismicUnit(pHash, 2) - 0.5) * 0.14;
    const secondaryCenter = primaryCenter < 0.5
      ? Math.min(0.75, primaryCenter + 0.13 + 0.15 * seismicUnit(pHash, 3))
      : Math.max(0.25, primaryCenter - 0.13 - 0.15 * seismicUnit(pHash, 3));
    const tertiaryCenter = 0.24 + 0.52 * seismicUnit(pHash, 4);
    const spineSkew = (seismicUnit(pHash, 5) - 0.5) * 0.06;
    partMap.set(sl.partId, {
      pHash,
      primaryCenter,
      secondaryCenter,
      tertiaryCenter,
      driftRate,
      spineSkew,
      count: partCounts.get(sl.partId) ?? 1,
    });
  }

  // Precompute flat-shoulder smooth envelope across samples.
  const envArr = new Float64Array(samples);
  for (let k = 0; k < samples; k++) {
    const u = k / Math.max(1, samples - 1);
    envArr[k] = seismicEnvelope(u, shoulder, envPower);
  }

  const traces = [];
  const bandTracker = new Map();
  let accentCount = 0;

  for (let i = 0; i < n; i++) {
    const sl = slices[i];
    const baseY = Math.round((safeBox.top + topPad + i * rowStep) * 100) / 100;
    const localIdx = partSeen.get(sl.partId) ?? 0;
    partSeen.set(sl.partId, localIdx + 1);

    const geom = partMap.get(sl.partId);
    const localT = geom.count > 1 ? localIdx / (geom.count - 1) - 0.5 : 0;
    const sHash = seismicStrHash(`${sl.hash ?? sl.partId}|${i}|${seedInt}`);

    const locNorm = Math.max(0, Math.min(1, Number(sl.locNorm) || 0));
    const degreeNorm = Math.max(0, Math.min(1, Number(sl.degreeNorm) || 0));
    const sharpness = Math.max(0, Math.min(1, 0.22 + 0.78 * degreeNorm));

    // Strong contrast between quiet low-LOC ripples and soaring dramatic peaks that leap 4-6 rows.
    const rawAmp = maxAmp * (0.09 + 0.77 * Math.pow(locNorm, 0.78) + 0.14 * degreeNorm);
    const headroom = Math.max(14, baseY - safeBox.top - 3);
    const amp = Math.round(Math.min(rawAmp, headroom * 0.98) * 100) / 100;

    // Coherent ridge centers evolving smoothly across adjacent slices of the same part.
    const drift = geom.driftRate * localT;
    const c1 = Math.max(0.22, Math.min(0.78, geom.primaryCenter + drift + (seismicUnit(sHash, 11) - 0.5) * 0.05));
    const c2 = Math.max(0.20, Math.min(0.80, geom.secondaryCenter - drift * 0.6 + (seismicUnit(sHash, 12) - 0.5) * 0.075));
    const c3 = Math.max(0.20, Math.min(0.80, geom.tertiaryCenter + geom.spineSkew + (seismicUnit(sHash, 13) - 0.5) * 0.09));

    // Sharper, narrower iconic pulsar Gaussians (needle crags rather than soft hills).
    const w1 = (0.045 - 0.021 * sharpness) * (0.84 + 0.32 * seismicUnit(sHash, 21));
    const w2 = (0.033 - 0.015 * sharpness) * (0.80 + 0.36 * seismicUnit(sHash, 22));
    const w3 = (0.023 - 0.010 * sharpness) * (0.78 + 0.40 * seismicUnit(sHash, 23));

    const a1 = 0.74 + 0.36 * seismicUnit(sHash, 31);
    const a2 = (0.30 + 0.44 * seismicUnit(sHash, 32)) * (0.50 + 0.50 * Math.sqrt(locNorm));
    const a3 = (0.18 + 0.36 * seismicUnit(sHash, 33)) * (0.38 + 0.62 * degreeNorm);

    // Secondary high-frequency harmonic impulses driven by import coupling (degreeNorm).
    const impulseCount = 2 + Math.round(degreeNorm * 4);
    const impulses = [];
    for (let m = 0; m < impulseCount; m++) {
      const iu = 0.19 + 0.62 * seismicUnit(sHash, 40 + m * 3);
      const iw = (0.009 + 0.009 * (1 - sharpness)) * (0.75 + 0.5 * seismicUnit(sHash, 41 + m * 3));
      const ia = (0.12 + 0.40 * degreeNorm) * (0.55 + 0.45 * seismicUnit(sHash, 42 + m * 3));
      impulses.push({ u: iu, w: iw, a: ia });
    }

    // Fine coherent harmonic ripple parameters (deterministic per trace).
    const freqA = 11 + Math.round(degreeNorm * 14);
    const freqB = 23 + Math.round(degreeNorm * 20);
    const phaseA = seismicUnit(sHash, 71) * Math.PI * 2;
    const phaseB = seismicUnit(sHash, 72) * Math.PI * 2;

    const raw = new Float64Array(samples);
    let peakRaw = 0;
    for (let k = 0; k < samples; k++) {
      const env = envArr[k];
      if (env <= 0) {
        raw[k] = 0;
        continue;
      }
      const u = k / Math.max(1, samples - 1);
      const d1 = (u - c1) / w1;
      const d2 = (u - c2) / w2;
      const d3 = (u - c3) / w3;
      let h = a1 * Math.exp(-0.5 * d1 * d1)
        + a2 * Math.exp(-0.5 * d2 * d2)
        + a3 * Math.exp(-0.5 * d3 * d3);
      for (let m = 0; m < impulses.length; m++) {
        const imp = impulses[m];
        const di = (u - imp.u) / imp.w;
        h += imp.a * Math.exp(-0.5 * di * di);
      }
      const harmonic = (0.026 + 0.064 * degreeNorm) * (
        0.65 * Math.max(0, Math.sin(u * Math.PI * freqA + phaseA))
        + 0.35 * Math.max(0, Math.sin(u * Math.PI * freqB + phaseB))
      );
      const val = Math.max(0, env * (h + harmonic));
      raw[k] = val;
      if (val > peakRaw) peakRaw = val;
    }

    // Normalize relative to peakRaw gently so major crests hit full dramatic amplitude cleanly.
    const scale = peakRaw > 1.24 ? 1.24 / peakRaw : 1;
    const baseOffsets = new Array(samples);
    for (let k = 0; k < samples; k++) {
      const offset = Math.min(headroom, Math.max(0, raw[k] * scale * amp));
      baseOffsets[k] = Math.round(offset * 100) / 100;
    }

    const hot = !!sl.hot;
    if (hot) accentCount++;
    const phase = Math.round(((i / Math.max(1, n)) * Math.PI * 2 + seismicUnit(sHash, 91) * 0.6) * 1000) / 1000;

    traces.push({
      index: i,
      partId: sl.partId,
      partIndex: sl.partIndex ?? 0,
      partName: sl.partName ?? sl.partId,
      hot,
      baseY,
      x0,
      x1,
      amp,
      sharpness: Math.round(sharpness * 1000) / 1000,
      phase,
      baseOffsets,
    });

    const band = bandTracker.get(sl.partId);
    const sliceLoc = Math.max(0, Number(sl.loc) || 0);
    if (!band) {
      bandTracker.set(sl.partId, {
        partId: sl.partId,
        partIndex: sl.partIndex ?? 0,
        partName: sl.partName ?? sl.partId,
        hot,
        firstIndex: i,
        lastIndex: i,
        topY: baseY,
        bottomY: baseY,
        midY: baseY,
        loc: sliceLoc,
        share: 0,
        count: 1,
      });
    } else {
      band.lastIndex = i;
      band.bottomY = baseY;
      band.midY = Math.round(((band.topY + band.bottomY) * 0.5) * 100) / 100;
      band.loc += sliceLoc;
      band.count += 1;
      if (hot) band.hot = true;
    }
  }

  const partBands = [...bandTracker.values()].map((b) => ({
    ...b,
    loc: Math.round(b.loc),
    share: Math.round((b.loc / totalLoc) * 10000) / 10000,
  }));

  return {
    kind: "seismic",
    box: safeBox,
    traces,
    partBands,
    representedParts: partBands.length,
    accentCount,
  };
}

/**
 * Evaluate `(x, y)` curve points for a seismic trace at loop phase `t` in [0, 1).
 * At `t = 0` (the still frame), returns exact baseline heights (`baseY - baseOffsets[k]`).
 * For `t` in (0, 1), applies smooth C-infinity periodic traveling phase-drift and subtle breathing
 * that wraps seamlessly from `t -> 1` back to `t = 0`.
 * @param {{ x0: number, x1: number, baseY: number, phase: number, sharpness?: number, baseOffsets: number[] }} trace
 * @param {number} [t=0]
 * @returns {{ x: number, y: number }[]}
 */
export function seismicCurveAt(trace, t = 0) {
  const offsets = trace.baseOffsets;
  const n = offsets.length;
  if (!n) return [];
  const span = trace.x1 - trace.x0;
  const phase = Number(trace.phase) || 0;
  const wrappedT = ((Number(t) || 0) % 1 + 1) % 1;

  if (wrappedT === 0) {
    const out = new Array(n);
    for (let k = 0; k < n; k++) {
      const u = n > 1 ? k / (n - 1) : 0;
      out[k] = {
        x: Math.round((trace.x0 + u * span) * 100) / 100,
        y: Math.round((trace.baseY - offsets[k]) * 100) / 100,
      };
    }
    return out;
  }

  const twoPiT = Math.PI * 2 * wrappedT;
  const breath = 0.5 * (1 - Math.cos(twoPiT));
  // Subtle periodic lateral phase drift (0 at t=0 and t=1, C-infinity derivatives across seam).
  const lateralShift = 0.011 * (Math.cos(twoPiT - phase) - Math.cos(-phase));
  const out = new Array(n);

  for (let k = 0; k < n; k++) {
    const u = n > 1 ? k / (n - 1) : 0;
    const x = trace.x0 + u * span;
    const baseH = offsets[k];
    if (baseH <= 0) {
      out[k] = { x: Math.round(x * 100) / 100, y: trace.baseY };
      continue;
    }
    // Sample baseOffsets with linear interpolation at shifted index to create organic lateral drift.
    const fk = Math.max(0, Math.min(n - 1, k + lateralShift * (n - 1)));
    const k0 = Math.floor(fk);
    const k1 = Math.min(n - 1, k0 + 1);
    const frac = fk - k0;
    const driftedH = offsets[k0] * (1 - frac) + offsets[k1] * frac;

    // Periodic traveling wave modulation that equals 0 identically at t=0 and t=1.
    const phi = phase + u * Math.PI * 2;
    const travel = Math.sin(twoPiT - phi) - Math.sin(-phi);
    const mod = 1 + 0.075 * travel + 0.045 * breath * Math.sin(phase * 1.5 + u * Math.PI * 3);
    const h = Math.max(0, driftedH * mod);
    out[k] = {
      x: Math.round(x * 100) / 100,
      y: Math.round((trace.baseY - h) * 100) / 100,
    };
  }
  return out;
}

// Procedural botanical scene builder driven by real vyo codebase facts JSON.
// Maps real files, LOC, areas, endpoints, and internal import edges into
// layered stems, blooms, leaves, buds, wispy upper-right twigs, and micro-type pools.

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function createRng(seedStr) {
  let s = hashString(String(seedStr)) || 0x9e3779b9;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Extract real metrics, file centrality, and architectural clusters from a vyo facts JSON.
 */
export function analyzeCodebase(data, config) {
  const filesObj = data.files || {};
  const imports = Array.isArray(data.imports) ? data.imports : [];
  const facts = Array.isArray(data.facts) ? data.facts : [];

  const inDeg = new Map();
  const outDeg = new Map();
  for (const [from, to] of imports) {
    outDeg.set(from, (outDeg.get(from) || 0) + 1);
    inDeg.set(to, (inDeg.get(to) || 0) + 1);
  }

  const allFiles = Object.entries(filesObj).map(([fp, info]) => {
    const loc = info.loc || 0;
    const parts = fp.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    const name = parts[parts.length - 1];
    const stem = name.replace(/\.[^.]+$/, "");
    const ind = inDeg.get(fp) || 0;
    const outd = outDeg.get(fp) || 0;
    return {
      path: fp,
      dir,
      name,
      stem,
      loc,
      area: info.area || "area:.",
      inDeg: ind,
      outDeg: outd,
      degree: ind + outd,
    };
  });

  const totalLoc = allFiles.reduce((s, f) => s + f.loc, 0);
  const fileCount = allFiles.length;
  const importCount = imports.length;
  const endpoints = facts.filter((f) => f.kind === "endpoint");
  const areas = facts.filter((f) => f.kind === "area");

  const buckets = {
    accentPrimary: [],
    accentSecondary: [],
    canopy: [],
    foliage: [],
  };

  for (const f of allFiles) {
    const role = config.classify(f);
    if (buckets[role]) buckets[role].push(f);
    else buckets.foliage.push(f);
  }

  for (const key of Object.keys(buckets)) {
    buckets[key].sort((a, b) => b.loc - a.loc || b.degree - a.degree);
  }

  const locOf = (arr) => arr.reduce((s, f) => s + f.loc, 0);

  const stats = {
    repoName: data.repo?.name || config.id,
    hash: data.hash || config.id,
    fileCount,
    totalLoc,
    importCount,
    endpointCount: endpoints.length,
    areaCount: areas.length,
    accentPrimaryLoc: locOf(buckets.accentPrimary),
    accentSecondaryLoc: locOf(buckets.accentSecondary),
    accentTotalLoc: locOf(buckets.accentPrimary) + locOf(buckets.accentSecondary),
    accentFileCount: buckets.accentPrimary.length + buckets.accentSecondary.length,
    canopyLoc: locOf(buckets.canopy),
    canopyFileCount: buckets.canopy.length,
    foliageLoc: locOf(buckets.foliage),
    foliageFileCount: buckets.foliage.length,
  };

  const fileRole = new Map();
  for (const [role, arr] of Object.entries(buckets)) {
    for (const f of arr) fileRole.set(f.path, role);
  }
  let crossImports = 0;
  for (const [a, b] of imports) {
    if (fileRole.get(a) && fileRole.get(b) && fileRole.get(a) !== fileRole.get(b)) {
      crossImports++;
    }
  }
  stats.crossImports = crossImports;

  return { stats, buckets, allFiles, imports, endpoints, areas };
}

export function evalCubic(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const x = mt2 * mt * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t2 * t * p3[0];
  const y = mt2 * mt * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t2 * t * p3[1];
  const dx =
    3 * mt2 * (p1[0] - p0[0]) +
    6 * mt * t * (p2[0] - p1[0]) +
    3 * t2 * (p3[0] - p2[0]);
  const dy =
    3 * mt2 * (p1[1] - p0[1]) +
    6 * mt * t * (p2[1] - p1[1]) +
    3 * t2 * (p3[1] - p2[1]);
  const len = Math.hypot(dx, dy) || 1;
  return { x, y, tx: dx / len, ty: dy / len, angle: Math.atan2(dy, dx) };
}

/**
 * Build a procedural botanical scene from analyzed codebase facts.
 * Canvas logical coordinates: 840 x 1190.
 */
export function buildBotanicalScene(analysis, config) {
  const { stats, buckets } = analysis;
  const rng = createRng(`${stats.hash}:${config.id}:${stats.totalLoc}:${stats.importCount}`);
  const W = 840;
  const H = 1190;

  const accent1Share = stats.accentPrimaryLoc / Math.max(1, stats.totalLoc);
  const accent2Share = stats.accentSecondaryLoc / Math.max(1, stats.totalLoc);
  const canopyShare = stats.canopyLoc / Math.max(1, stats.totalLoc);
  const foliageShare = stats.foliageLoc / Math.max(1, stats.totalLoc);
  const densityRatio = clamp(stats.fileCount / 65, 0.55, 1.12);
  const importRatio = clamp(stats.importCount / 210, 0.42, 1.15);

  const layout = config.layout;

  // Sculpted bloom radii driven by real LOC proportions, kept within gallery balance
  const rHero1 = clamp(128 + Math.sqrt(accent1Share) * 68, 144, 174) * (layout.hero1Scale ?? 1);
  const rHero2 = clamp(96 + Math.sqrt(accent2Share) * 62, 110, 140) * (layout.hero2Scale ?? 1);
  const rCanopy = clamp(82 + Math.sqrt(canopyShare) * 76, 90, 128) * (layout.canopyScale ?? 1);
  const rMidRight = clamp(72 + Math.sqrt(foliageShare) * 48, 76, 108) * (layout.midRightScale ?? 1);

  const hero1Pos = layout.hero1;
  const hero2Pos = layout.hero2;
  const canopyPos = layout.canopy;
  const midRightPos = layout.midRight;

  const stems = [];
  const bgTendrils = [];
  const leaves = [];
  const buds = [];
  const twigs = [];
  const blooms = [];

  // 1. PRIMARY CURVED STEMS
  const mainLeftStem = { tone: "slate", w0: 9.0, w1: 4.8, pts: layout.mainLeftStem };
  const leftArchStem = { tone: "slate", w0: 7.4, w1: 3.6, pts: layout.leftArchStem };
  const centerLeafStem = { tone: "slate", w0: 9.8, w1: 4.4, pts: layout.centerLeafStem };
  const rightSweepStem = { tone: "slate", w0: 8.2, w1: 3.8, pts: layout.rightSweepStem };
  const hero2Stem = { tone: "slate", w0: 7.6, w1: 4.2, pts: layout.hero2Stem };
  const canopyStem = { tone: "mist", w0: 7.8, w1: 4.4, pts: layout.canopyStem };
  const panicleSpine = { tone: "mist", w0: 6.8, w1: 3.0, pts: layout.panicleSpine };
  const panicleSpine2 = { tone: "mist", w0: 6.0, w1: 2.8, pts: layout.panicleSpine2 };

  stems.push(
    mainLeftStem,
    leftArchStem,
    centerLeafStem,
    rightSweepStem,
    hero2Stem,
    canopyStem,
    panicleSpine,
    panicleSpine2
  );

  // 2. CROSS-IMPORT BACKGROUND MIST TENDRILS
  const tendrilCount = clamp(Math.round(3 + importRatio * 5), 4, 8);
  const tendrilRootMin = layout.tendrilRootRange?.[0] ?? 130;
  const tendrilRootMax = layout.tendrilRootRange?.[1] ?? 620;
  for (let i = 0; i < tendrilCount; i++) {
    const startX =
      tendrilRootMin +
      (i / Math.max(1, tendrilCount - 1)) * (tendrilRootMax - tendrilRootMin) +
      (rng() - 0.5) * 35;
    const endX = startX + (rng() - 0.35) * 210;
    const endY = 670 + rng() * 340;
    const cp1x = startX + (rng() - 0.4) * 95;
    const cp1y = H - 80 - rng() * 140;
    const cp2x = endX - (rng() - 0.4) * 85;
    const cp2y = endY + 70 + rng() * 110;
    bgTendrils.push({
      tone: "mist",
      w0: 4.8 + rng() * 2.2,
      w1: 2.5 + rng() * 1.2,
      pts: [
        [startX, H + 40],
        [cp1x, cp1y],
        [cp2x, cp2y],
        [endX, endY],
      ],
    });
  }

  // 3. ORGANIC FANNING BOTANICAL LEAVES (driven by real foliage files!)
  // Fewer, broader, more gracefully splayed rose/peony leaflets instead of upright plumes
  const maxFileLeaves = clamp(Math.round(7 + densityRatio * 7), 8, 15);
  const foliageFiles = buckets.foliage.slice(0, maxFileLeaves);
  const leafStems = [centerLeafStem, mainLeftStem, leftArchStem, rightSweepStem];

  for (let i = 0; i < foliageFiles.length; i++) {
    const file = foliageFiles[i];
    const stem = leafStems[i % leafStems.length];
    const t = clamp(0.16 + (i / foliageFiles.length) * 0.72 + (rng() - 0.5) * 0.08, 0.14, 0.88);
    const pt = evalCubic(...stem.pts, t);
    if (pt.y < 630 && pt.x < 350) continue;

    const side = i % 2 === 0 ? -1 : 1;
    const sizeScale = clamp(Math.sqrt(file.loc / 340), 0.65, 1.32);
    const length = (64 + rng() * 36) * sizeScale;
    const width = length * (0.40 + rng() * 0.14); // broader, lush rose-leaf proportions
    // Wider natural splay off the stem (0.55..1.18 rad) so foliage arches gracefully!
    const spread = (0.55 + rng() * 0.62) * side;
    const angle = pt.angle + spread;

    const isMistLeaf = i % 3 === 2;
    leaves.push({
      x: pt.x + (rng() - 0.5) * 12,
      y: pt.y + (rng() - 0.5) * 12,
      angle,
      length,
      width,
      curve: side * (0.22 + rng() * 0.25),
      serration: 0.055 + rng() * 0.05,
      tone: isMistLeaf ? "mist" : "slate",
      depth: isMistLeaf ? 0 : 1 + (i % 3) * 0.25,
      file: file.name,
      loc: file.loc,
    });
  }

  // Curated architectural leaf sprays anchoring the lower-left and mid-lower balance
  for (const anchor of layout.foliageClusters) {
    leaves.push({
      x: anchor.x + (rng() - 0.5) * 8,
      y: anchor.y + (rng() - 0.5) * 8,
      angle: anchor.angle + (rng() - 0.5) * 0.1,
      length: anchor.len * (0.92 + 0.14 * densityRatio),
      width: anchor.wid * (0.92 + 0.14 * densityRatio),
      curve: anchor.curve,
      serration: 0.06,
      tone: anchor.tone || "slate",
      depth: anchor.depth ?? 1.2,
    });
  }

  // 4. CLOSED BOTANICAL BUDS
  for (const b of layout.buds) {
    buds.push({
      x: b.x,
      y: b.y,
      angle: b.angle,
      size: b.size,
      hasCrimsonPeek: Boolean(b.hasCrimsonPeek),
      stemFrom: b.stemFrom,
    });
  }

  // 5. AIRY, DELICATE UPPER-RIGHT MISTY TWIGS & BERRY NODES
  // Finer, cleaner panicle sprigs so upper-right sky breathes and dew words perch effortlessly!
  const twigSources = buckets.canopy.length > 0 ? buckets.canopy : buckets.foliage;
  const twigCount = clamp(Math.round(6 + twigSources.length * 0.32 + stats.endpointCount * 0.14), 7, 13);

  function spawnTwigBranch(x, y, angle, len, depth, maxDepth, isMajor) {
    const bend = (rng() - 0.5) * 0.38;
    const midAngle = angle + bend * 0.55;
    const endAngle = angle + bend;
    const x1 = x + Math.cos(midAngle) * len * 0.52;
    const y1 = y + Math.sin(midAngle) * len * 0.52;
    const x2 = x + Math.cos(endAngle) * len;
    const y2 = y + Math.sin(endAngle) * len;

    // Keep upper-left headline zone completely sacred
    if (x2 < 460 && y2 < 260) return;
    if (y2 < 170) return;

    const twig = {
      p0: [x, y],
      p1: [x + Math.cos(angle) * len * 0.35, y + Math.sin(angle) * len * 0.35],
      p2: [x1, y1],
      p3: [x2, y2],
      width: Math.max(2.6, 4.4 - depth * 0.8),
      leaflets: [],
      berries: [],
    };

    // Delicate airy leaflet pairs at twig forks and tips
    const leafSpots = depth === maxDepth ? [0.68, 1.0] : [0.58];
    for (const lt of leafSpots) {
      if (rng() > 0.28) {
        const lp = evalCubic(twig.p0, twig.p1, twig.p2, twig.p3, lt);
        const side = rng() < 0.5 ? -1 : 1;
        twig.leaflets.push({
          x: lp.x,
          y: lp.y,
          angle: lp.angle + side * (0.48 + rng() * 0.5),
          len: 12 + rng() * 14,
          wid: 6.5 + rng() * 5.5,
        });
        if (lt > 0.8 && rng() < 0.55) {
          twig.leaflets.push({
            x: lp.x,
            y: lp.y,
            angle: lp.angle - side * (0.42 + rng() * 0.45),
            len: 11 + rng() * 12,
            wid: 5.5 + rng() * 5,
          });
        }
      }
    }

    // Crisp occasional deep-slate berry/node dot perched on the pale misty sprig
    if (rng() < (isMajor ? 0.52 : 0.38)) {
      const bt = 0.55 + rng() * 0.43;
      const bp = evalCubic(twig.p0, twig.p1, twig.p2, twig.p3, bt);
      twig.berries.push({
        x: bp.x + (rng() - 0.5) * 4,
        y: bp.y + (rng() - 0.5) * 4,
        r: 3.6 + rng() * 1.9,
      });
    }

    twigs.push(twig);

    if (depth < maxDepth) {
      const subCount = depth === 0 ? 2 : rng() < 0.48 ? 2 : 1;
      for (let k = 0; k < subCount; k++) {
        const branchT = 0.48 + k * 0.36 + rng() * 0.14;
        const bp = evalCubic(twig.p0, twig.p1, twig.p2, twig.p3, clamp(branchT, 0.42, 0.98));
        const forkSign = k % 2 === 0 ? -1 : 1;
        const forkAngle = bp.angle + forkSign * (0.42 + rng() * 0.42);
        spawnTwigBranch(
          bp.x,
          bp.y,
          forkAngle,
          len * (0.60 + rng() * 0.2),
          depth + 1,
          maxDepth,
          false
        );
      }
    }
  }

  for (let i = 0; i < twigCount; i++) {
    const useFirst = i % 3 !== 2;
    const spine = useFirst ? panicleSpine : panicleSpine2;
    const t = clamp(0.28 + (i / twigCount) * 0.70, 0.25, 0.98);
    const bp = evalCubic(...spine.pts, t);
    const side = i % 2 === 0 ? -1 : 1;
    const baseAngle = bp.angle + side * (0.45 + rng() * 0.46);
    const len = (66 + rng() * 64) * (useFirst ? 1.05 : 0.88);
    spawnTwigBranch(bp.x, bp.y, baseAngle, len, 0, rng() < 0.48 ? 2 : 1, true);
  }

  // Graceful wispy crown sprigs fanning into upper-right sky
  const tipPt = evalCubic(...panicleSpine.pts, 0.98);
  for (const ang of [-1.22, -0.72, -0.26, 0.22]) {
    spawnTwigBranch(tipPt.x, tipPt.y, ang + (rng() - 0.5) * 0.16, 78 + rng() * 44, 0, 2, true);
  }

  // 6. SCULPTED MULTI-LAYERED BOTANICAL BLOOMS
  function makePetals(count, rMin, rMax, wScale, angleOffset, gapBias = 0) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const baseAngle = angleOffset + (i / count) * Math.PI * 2;
      const jitter = (rng() - 0.5) * (Math.PI * 2 / count) * 0.26;
      const angle = baseAngle + jitter;
      const len = rMin + rng() * (rMax - rMin);
      const wid = len * wScale * (0.85 + rng() * 0.28);
      out.push({
        angle,
        len,
        wid,
        asym: (rng() - 0.5) * 0.24,
        ruffle: 0.09 + rng() * 0.09,
        ruffleFreq: 2 + Math.floor(rng() * 2),
        rufflePhase: rng() * Math.PI * 2,
        notch: 0.06 + rng() * 0.08,
        gapWidth: gapBias,
      });
    }
    return out;
  }

  // Build asymmetrical sculpted rose/peony crimson wing petals (like image_3's unmistakable flower!)
  function makeHeroCrimsonPetals(R, offsetAngle, wingConfigs) {
    return wingConfigs.map((wc) => ({
      angle: offsetAngle + wc.dAngle + (rng() - 0.5) * 0.1,
      len: R * wc.len * (0.94 + rng() * 0.12),
      wid: R * wc.wid * (0.94 + rng() * 0.12),
      asym: wc.asym + (rng() - 0.5) * 0.1,
      ruffle: 0.10 + rng() * 0.07,
      ruffleFreq: 2 + Math.floor(rng() * 2),
      rufflePhase: rng() * Math.PI * 2,
      notch: 0.06 + rng() * 0.07,
      gapWidth: wc.gap ?? 9.5,
    }));
  }

  // Bloom A: Upper-center pale misty blossom with cupped slate-blue heart
  blooms.push({
    id: "canopy",
    kind: "mist-blossom",
    x: canopyPos[0],
    y: canopyPos[1],
    radius: rCanopy,
    tilt: layout.canopyTilt ?? -0.20,
    squashY: 0.85,
    outerPetals: makePetals(5 + (buckets.canopy.length > 12 ? 1 : 0), rCanopy * 0.78, rCanopy * 1.14, 0.72, -Math.PI * 0.85),
    innerPetals: makePetals(4, rCanopy * 0.48, rCanopy * 0.72, 0.66, -Math.PI * 0.5),
    calyxAngle: Math.PI * 0.58,
    calyxSize: rCanopy * 0.43,
  });

  // Bloom B: Mid-right delicate misty blossom with slate cup
  blooms.push({
    id: "mid-right",
    kind: "mist-blossom",
    x: midRightPos[0],
    y: midRightPos[1],
    radius: rMidRight,
    tilt: 0.16,
    squashY: 0.87,
    outerPetals: makePetals(5, rMidRight * 0.76, rMidRight * 1.08, 0.66, -Math.PI * 0.65),
    innerPetals: makePetals(3, rMidRight * 0.44, rMidRight * 0.64, 0.60, -Math.PI * 0.3),
    calyxAngle: Math.PI * 0.62,
    calyxSize: rMidRight * 0.45,
  });

  // Bloom C: HERO CRIMSON BLOOM #1 (Primary Accent)
  // Asymmetric rose/peony wing structure: broad upper-left petal, sculpted upper-right petal,
  // bold sweeping lower-right wing, cupped lower-left wing — separated by crisp pale-mist crevices!
  const hero1Wings = [
    { dAngle: -2.15, len: 0.92, wid: 0.66, asym: -0.14, gap: 10.0 },
    { dAngle: -0.78, len: 0.88, wid: 0.62, asym: 0.12, gap: 10.5 },
    { dAngle: 0.32, len: 1.04, wid: 0.56, asym: 0.16, gap: 11.0 }, // sweeping right tongue!
    { dAngle: 1.38, len: 0.78, wid: 0.54, asym: -0.10, gap: 9.5 },
    { dAngle: 2.52, len: 0.82, wid: 0.52, asym: -0.12, gap: 9.5 },
  ];
  blooms.push({
    id: "hero-primary",
    kind: "crimson-hero",
    x: hero1Pos[0],
    y: hero1Pos[1],
    radius: rHero1,
    tilt: layout.hero1Tilt ?? -0.26,
    squashY: 0.88,
    mistPetals: makePetals(6, rHero1 * 0.98, rHero1 * 1.32, 0.64, -Math.PI * 0.92),
    slateCups: [
      { angle: -Math.PI * 0.62, len: rHero1 * 0.98, wid: rHero1 * 0.66, asym: -0.1, ruffle: 0.08, ruffleFreq: 2, rufflePhase: 0.5, notch: 0.05 },
      { angle: Math.PI * 0.66, len: rHero1 * 0.92, wid: rHero1 * 0.60, asym: 0.12, ruffle: 0.08, ruffleFreq: 2, rufflePhase: 1.8, notch: 0.06 },
      { angle: Math.PI * 0.94, len: rHero1 * 0.84, wid: rHero1 * 0.44, asym: -0.08, ruffle: 0.06, ruffleFreq: 2, rufflePhase: 2.3, notch: 0.04 },
    ],
    crimsonOuter: makeHeroCrimsonPetals(rHero1, layout.hero1PetalOffset ?? 0, hero1Wings),
    crimsonInner: makePetals(3, rHero1 * 0.36, rHero1 * 0.54, 0.56, (layout.hero1PetalOffset ?? 0) + 0.65, 6.5),
    heartOffset: [rHero1 * 0.04, -rHero1 * 0.03],
    seed: hashString(stats.hash + ":hero1"),
  });

  // Bloom D: HERO CRIMSON BLOOM #2 (Secondary Accent — sweeping off lower-right edge!)
  const hero2Wings = [
    { dAngle: -1.95, len: 0.88, wid: 0.56, asym: -0.12, gap: 9.5 },
    { dAngle: -0.58, len: 0.84, wid: 0.52, asym: 0.14, gap: 9.5 },
    { dAngle: 0.28, len: 1.08, wid: 0.54, asym: 0.15, gap: 10.5 }, // sweeping off right edge!
    { dAngle: 1.55, len: 0.74, wid: 0.52, asym: -0.08, gap: 9.0 },
  ];
  blooms.push({
    id: "hero-secondary",
    kind: "crimson-hero",
    x: hero2Pos[0],
    y: hero2Pos[1],
    radius: rHero2,
    tilt: layout.hero2Tilt ?? 0.24,
    squashY: 0.85,
    mistPetals: makePetals(5, rHero2 * 0.96, rHero2 * 1.28, 0.64, -Math.PI * 0.35),
    slateCups: [
      { angle: Math.PI * 0.64, len: rHero2 * 0.92, wid: rHero2 * 0.64, asym: 0.1, ruffle: 0.07, ruffleFreq: 2, rufflePhase: 1.1, notch: 0.05 },
      { angle: Math.PI * 0.90, len: rHero2 * 0.82, wid: rHero2 * 0.48, asym: -0.1, ruffle: 0.06, ruffleFreq: 2, rufflePhase: 2.2, notch: 0.04 },
    ],
    crimsonOuter: makeHeroCrimsonPetals(rHero2, layout.hero2PetalOffset ?? 0, hero2Wings),
    crimsonInner: makePetals(3, rHero2 * 0.34, rHero2 * 0.50, 0.52, (layout.hero2PetalOffset ?? 0) + 0.55, 5.5),
    heartOffset: [-rHero2 * 0.05, -rHero2 * 0.03],
    seed: hashString(stats.hash + ":hero2"),
  });

  return {
    width: W,
    height: H,
    seed: hashString(stats.hash + ":" + config.id),
    stats,
    headline: config.headline,
    brand: config.brand,
    colophon: config.colophon(stats),
    phrases: config.phrases,
    shortCorePhrases: config.shortCorePhrases || config.phrases,
    dewWords: config.dewWords,
    stems,
    bgTendrils,
    leaves,
    buds,
    twigs,
    blooms,
  };
}

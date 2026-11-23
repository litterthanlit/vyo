// Procedural luminous nocturnal botanical/branching scene builder for Poster 3 (vyo-bloom-strata).
// Driven by real vyo codebase facts (../facts/vyo-facts.json).
// Composed deliberately across the right two-thirds of the 840x1190 obsidian sheet,
// bleeding cleanly off the bottom and right edges while keeping the left column pitch-black
// for Bloomsbury editorial typography.

import fs from "node:fs";

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function createRng(seedStr) {
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

function evalCubic(p0, p1, p2, p3, t) {
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

export function buildObsidianBloomScene(factsPath) {
  const data = JSON.parse(fs.readFileSync(factsPath, "utf8"));
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
    const name = fp.split("/").pop();
    const ind = inDeg.get(fp) || 0;
    const outd = outDeg.get(fp) || 0;
    return { path: fp, name, loc, area: info.area || "area:.", degree: ind + outd };
  });

  const buckets = { accentPrimary: [], accentSecondary: [], canopy: [], foliage: [] };
  for (const f of allFiles) {
    if (f.path.startsWith("tools/lib/fields/")) {
      if (f.name.startsWith("shape")) buckets.accentPrimary.push(f);
      else buckets.accentSecondary.push(f);
    } else if (f.path.startsWith("tools/lib/scan/") || f.path.startsWith("examples/")) {
      buckets.canopy.push(f);
    } else {
      buckets.foliage.push(f);
    }
  }
  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => b.loc - a.loc || b.degree - a.degree);
  }

  const locOf = (arr) => arr.reduce((s, f) => s + f.loc, 0);
  const totalLoc = locOf(allFiles);
  const accent1Share = locOf(buckets.accentPrimary) / Math.max(1, totalLoc);
  const accent2Share = locOf(buckets.accentSecondary) / Math.max(1, totalLoc);
  const canopyShare = locOf(buckets.canopy) / Math.max(1, totalLoc);
  const foliageShare = locOf(buckets.foliage) / Math.max(1, totalLoc);
  const densityRatio = clamp(allFiles.length / 65, 0.65, 1.15);
  const importRatio = clamp(imports.length / 210, 0.5, 1.15);

  const rng = createRng(`vyo-bloom-strata:${data.hash || "vyo"}:${totalLoc}:${imports.length}`);
  const W = 840;
  const H = 1190;

  // Dramatic bloom radii driven by real LOC shares
  const rHero1 = clamp(142 + Math.sqrt(accent1Share) * 65, 152, 184);
  const rHero2 = clamp(114 + Math.sqrt(accent2Share) * 58, 122, 152);
  const rCanopy = clamp(96 + Math.sqrt(canopyShare) * 68, 102, 134);
  const rMidBloom = clamp(82 + Math.sqrt(foliageShare) * 50, 88, 114);

  // Sculpted stems sweeping up from lower-right / lower-center-right,
  // keeping x < 340 completely calm for the Bloomsbury editorial sanctuary!
  const stems = [
    // Primary trunk curving up to the upper-mid Hero Crimson Bloom #1
    {
      tone: "slate",
      w0: 12.5,
      w1: 5.5,
      pts: [
        [520, 1240],
        [492, 990],
        [498, 690],
        [538, 412],
      ],
    },
    // Sweeping outer-right trunk feeding Hero Crimson Bloom #2 (bleeds off right edge)
    {
      tone: "slate",
      w0: 10.5,
      w1: 5.0,
      pts: [
        [635, 1245],
        [668, 1110],
        [710, 995],
        [744, 902],
      ],
    },
    // Tall graceful luminous cyan canopy stem rising into upper-right crown
    {
      tone: "mist",
      w0: 9.5,
      w1: 4.4,
      pts: [
        [580, 1245],
        [612, 920],
        [648, 560],
        [682, 244],
      ],
    },
    // Mid-lower arching stem supporting the amethyst mid-bloom
    {
      tone: "slate",
      w0: 9.2,
      w1: 4.2,
      pts: [
        [458, 1242],
        [446, 1065],
        [448, 880],
        [484, 725],
      ],
    },
    // Airy branching panicle spine fanning into upper-right sky
    {
      tone: "mist",
      w0: 7.5,
      w1: 3.2,
      pts: [
        [548, 760],
        [642, 560],
        [726, 368],
        [798, 165],
      ],
    },
    // Secondary high panicle arching gracefully near top-right
    {
      tone: "mist",
      w0: 6.5,
      w1: 2.8,
      pts: [
        [605, 890],
        [715, 705],
        [790, 520],
        [865, 330],
      ],
    },
  ];

  // Background atmospheric tendrils rooted across bottom-right
  const bgTendrils = [];
  const tendrilCount = clamp(Math.round(4 + importRatio * 4), 5, 8);
  for (let i = 0; i < tendrilCount; i++) {
    const startX = 395 + (i / Math.max(1, tendrilCount - 1)) * 420 + (rng() - 0.5) * 30;
    const endX = clamp(startX + (rng() - 0.35) * 180, 380, 860);
    const endY = 580 + rng() * 380;
    bgTendrils.push({
      tone: "mist",
      w0: 5.5 + rng() * 2.5,
      w1: 2.6 + rng() * 1.4,
      pts: [
        [startX, H + 40],
        [startX + (rng() - 0.45) * 80, H - 120 - rng() * 150],
        [endX - (rng() - 0.45) * 75, endY + 90 + rng() * 120],
        [endX, endY],
      ],
    });
  }

  // Lush botanical leaves anchored along right-hand stems (zero invasion of x < 345)
  const leaves = [];
  const leafStems = [stems[0], stems[1], stems[3]];
  const maxFileLeaves = clamp(Math.round(8 + densityRatio * 6), 9, 14);
  for (let i = 0; i < Math.min(maxFileLeaves, buckets.foliage.length); i++) {
    const file = buckets.foliage[i];
    const stem = leafStems[i % leafStems.length];
    const t = clamp(0.16 + (i / maxFileLeaves) * 0.68 + (rng() - 0.5) * 0.08, 0.14, 0.84);
    const pt = evalCubic(...stem.pts, t);
    if (pt.x < 390 && pt.y < 690) continue;
    const side = pt.x < 470 ? 1 : i % 2 === 0 ? -1 : 1;
    const sizeScale = clamp(Math.sqrt(file.loc / 320), 0.72, 1.32);
    const length = (78 + rng() * 44) * sizeScale;
    const width = length * (0.42 + rng() * 0.14);
    leaves.push({
      x: pt.x + (rng() - 0.5) * 10,
      y: pt.y + (rng() - 0.5) * 10,
      angle: pt.angle + side * (0.52 + rng() * 0.55),
      length,
      width,
      curve: side * (0.20 + rng() * 0.24),
      serration: 0.06 + rng() * 0.04,
      tone: i % 3 === 2 ? "mist" : "slate",
      depth: i % 3 === 2 ? 0.3 : 1.1 + (i % 3) * 0.25,
    });
  }

  // Curated lush architectural leaves grounding the lower-right silhouette
  const anchorLeaves = [
    { x: 515, y: 845, angle: -2.18, length: 146, width: 64, curve: -0.24, tone: "slate", depth: 1.5 },
    { x: 545, y: 882, angle: -0.92, length: 158, width: 68, curve: 0.24, tone: "slate", depth: 1.6 },
    { x: 474, y: 965, angle: -2.28, length: 138, width: 60, curve: -0.28, tone: "slate", depth: 1.4 },
    { x: 562, y: 985, angle: -0.82, length: 152, width: 64, curve: 0.26, tone: "slate", depth: 1.5 },
    { x: 492, y: 1085, angle: -1.85, length: 156, width: 68, curve: -0.20, tone: "slate", depth: 1.5 },
    { x: 585, y: 1098, angle: -1.12, length: 148, width: 62, curve: 0.22, tone: "slate", depth: 1.4 },
    { x: 648, y: 785, angle: -0.58, length: 142, width: 58, curve: 0.26, tone: "mist", depth: 0.4 },
    { x: 618, y: 635, angle: -0.68, length: 128, width: 52, curve: 0.24, tone: "mist", depth: 0.3 },
    { x: 468, y: 1168, angle: -1.38, length: 132, width: 58, curve: -0.14, tone: "slate", depth: 1.5 },
    { x: 690, y: 1085, angle: -0.65, length: 148, width: 60, curve: 0.28, tone: "slate", depth: 1.3 },
  ];
  for (const a of anchorLeaves) {
    leaves.push({ ...a, serration: 0.06 });
  }

  // Closed botanical buds
  const buds = [
    { x: 405, y: 825, angle: -1.82, size: 50, hasCrimsonPeek: true, stemFrom: [458, 950] },
    { x: 662, y: 492, angle: -1.18, size: 54, hasCrimsonPeek: false, stemFrom: [615, 610] },
    { x: 615, y: 1025, angle: -1.35, size: 46, hasCrimsonPeek: true, stemFrom: [580, 1140] },
  ];

  // Delicate upper-right branching panicle twigs & berry nodes
  const twigs = [];
  function spawnTwig(x, y, angle, len, depth, maxDepth) {
    const bend = (rng() - 0.5) * 0.36;
    const x1 = x + Math.cos(angle + bend * 0.5) * len * 0.52;
    const y1 = y + Math.sin(angle + bend * 0.5) * len * 0.52;
    const x2 = x + Math.cos(angle + bend) * len;
    const y2 = y + Math.sin(angle + bend) * len;
    if (x2 < 420 || y2 < 95) return;

    const twig = {
      p0: [x, y],
      p1: [x + Math.cos(angle) * len * 0.35, y + Math.sin(angle) * len * 0.35],
      p2: [x1, y1],
      p3: [x2, y2],
      width: Math.max(2.8, 4.8 - depth * 0.8),
      leaflets: [],
      berries: [],
    };
    const lp = evalCubic(twig.p0, twig.p1, twig.p2, twig.p3, 0.72);
    twig.leaflets.push({
      x: lp.x,
      y: lp.y,
      angle: lp.angle + (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.4),
      len: 15 + rng() * 14,
      wid: 8 + rng() * 6,
    });
    if (rng() < 0.58) {
      const bp = evalCubic(twig.p0, twig.p1, twig.p2, twig.p3, 0.65 + rng() * 0.32);
      twig.berries.push({ x: bp.x, y: bp.y, r: 4.2 + rng() * 2.0 });
    }
    twigs.push(twig);

    if (depth < maxDepth) {
      const subCount = depth === 0 ? 2 : rng() < 0.5 ? 2 : 1;
      for (let k = 0; k < subCount; k++) {
        const bp = evalCubic(twig.p0, twig.p1, twig.p2, twig.p3, clamp(0.45 + k * 0.38, 0.4, 0.96));
        spawnTwig(
          bp.x,
          bp.y,
          bp.angle + (k % 2 === 0 ? -1 : 1) * (0.42 + rng() * 0.38),
          len * (0.62 + rng() * 0.18),
          depth + 1,
          maxDepth
        );
      }
    }
  }

  for (let i = 0; i < 10; i++) {
    const spine = i % 3 === 2 ? stems[5] : stems[4];
    const t = clamp(0.25 + (i / 10) * 0.72, 0.25, 0.98);
    const bp = evalCubic(...spine.pts, t);
    const side = i % 2 === 0 ? -1 : 1;
    spawnTwig(bp.x, bp.y, bp.angle + side * (0.45 + rng() * 0.4), 72 + rng() * 58, 0, 2);
  }
  const tipPt = evalCubic(...stems[4].pts, 0.98);
  for (const ang of [-1.25, -0.78, -0.25, 0.25]) {
    spawnTwig(tipPt.x, tipPt.y, ang, 78 + rng() * 40, 0, 2);
  }

  // Sculpted multi-layered botanical blooms
  function makePetals(count, rMin, rMax, wScale, angleOffset, gapBias = 0) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const angle =
        angleOffset +
        (i / count) * Math.PI * 2 +
        (rng() - 0.5) * ((Math.PI * 2) / count) * 0.24;
      const len = rMin + rng() * (rMax - rMin);
      const wid = len * wScale * (0.86 + rng() * 0.26);
      out.push({
        angle,
        len,
        wid,
        asym: (rng() - 0.5) * 0.22,
        ruffle: 0.09 + rng() * 0.08,
        ruffleFreq: 2 + Math.floor(rng() * 2),
        rufflePhase: rng() * Math.PI * 2,
        notch: 0.06 + rng() * 0.07,
        gapWidth: gapBias,
      });
    }
    return out;
  }

  function makeHeroWings(R, offsetAngle, wingConfigs) {
    return wingConfigs.map((wc) => ({
      angle: offsetAngle + wc.dAngle + (rng() - 0.5) * 0.08,
      len: R * wc.len * (0.95 + rng() * 0.1),
      wid: R * wc.wid * (0.95 + rng() * 0.1),
      asym: wc.asym,
      ruffle: 0.10 + rng() * 0.06,
      ruffleFreq: 2 + Math.floor(rng() * 2),
      rufflePhase: rng() * Math.PI * 2,
      notch: 0.06 + rng() * 0.06,
      gapWidth: wc.gap ?? 10.5,
    }));
  }

  const blooms = [
    // Upper-right luminous glacier-cyan & amethyst canopy bloom
    {
      id: "canopy",
      kind: "mist-blossom",
      x: 682,
      y: 205,
      radius: rCanopy,
      tilt: -0.18,
      squashY: 0.86,
      outerPetals: makePetals(6, rCanopy * 0.80, rCanopy * 1.16, 0.72, -Math.PI * 0.8),
      innerPetals: makePetals(4, rCanopy * 0.48, rCanopy * 0.74, 0.66, -Math.PI * 0.45),
      calyxAngle: Math.PI * 0.58,
      calyxSize: rCanopy * 0.44,
    },
    // Mid-center glowing twilight-amethyst / cyan bloom
    {
      id: "mid-amethyst",
      kind: "mist-blossom",
      x: 492,
      y: 686,
      radius: rMidBloom,
      tilt: 0.22,
      squashY: 0.88,
      outerPetals: makePetals(5, rMidBloom * 0.78, rMidBloom * 1.12, 0.68, -Math.PI * 0.62),
      innerPetals: makePetals(4, rMidBloom * 0.46, rMidBloom * 0.68, 0.62, -Math.PI * 0.25),
      calyxAngle: Math.PI * 0.64,
      calyxSize: rMidBloom * 0.46,
    },
    // HERO CRIMSON BLOOM #1 — Focal upper-mid-right radiant ember peony!
    {
      id: "hero-primary",
      kind: "crimson-hero",
      x: 548,
      y: 374,
      radius: rHero1,
      tilt: -0.28,
      squashY: 0.88,
      mistPetals: makePetals(6, rHero1 * 0.98, rHero1 * 1.32, 0.64, -Math.PI * 0.9),
      slateCups: [
        { angle: -Math.PI * 0.60, len: rHero1 * 0.98, wid: rHero1 * 0.66, asym: -0.1, ruffle: 0.08, ruffleFreq: 2, rufflePhase: 0.5, notch: 0.05 },
        { angle: Math.PI * 0.66, len: rHero1 * 0.92, wid: rHero1 * 0.60, asym: 0.12, ruffle: 0.08, ruffleFreq: 2, rufflePhase: 1.8, notch: 0.06 },
        { angle: Math.PI * 0.94, len: rHero1 * 0.84, wid: rHero1 * 0.44, asym: -0.08, ruffle: 0.06, ruffleFreq: 2, rufflePhase: 2.3, notch: 0.04 },
      ],
      crimsonOuter: makeHeroWings(rHero1, 0.08, [
        { dAngle: -2.12, len: 0.94, wid: 0.66, asym: -0.14, gap: 10.5 },
        { dAngle: -0.76, len: 0.90, wid: 0.62, asym: 0.12, gap: 10.5 },
        { dAngle: 0.30, len: 1.08, wid: 0.58, asym: 0.16, gap: 11.5 },
        { dAngle: 1.38, len: 0.80, wid: 0.54, asym: -0.10, gap: 10.0 },
        { dAngle: 2.50, len: 0.84, wid: 0.52, asym: -0.12, gap: 10.0 },
      ]),
      crimsonInner: makePetals(3, rHero1 * 0.38, rHero1 * 0.56, 0.56, 0.72, 6.5),
      heartOffset: [rHero1 * 0.04, -rHero1 * 0.03],
    },
    // HERO CRIMSON BLOOM #2 — Sweeping dramatically off the lower-right edge!
    {
      id: "hero-secondary",
      kind: "crimson-hero",
      x: 752,
      y: 884,
      radius: rHero2,
      tilt: 0.22,
      squashY: 0.86,
      mistPetals: makePetals(5, rHero2 * 0.96, rHero2 * 1.28, 0.64, -Math.PI * 0.35),
      slateCups: [
        { angle: Math.PI * 0.64, len: rHero2 * 0.92, wid: rHero2 * 0.64, asym: 0.1, ruffle: 0.07, ruffleFreq: 2, rufflePhase: 1.1, notch: 0.05 },
        { angle: Math.PI * 0.90, len: rHero2 * 0.82, wid: rHero2 * 0.48, asym: -0.1, ruffle: 0.06, ruffleFreq: 2, rufflePhase: 2.2, notch: 0.04 },
      ],
      crimsonOuter: makeHeroWings(rHero2, -0.14, [
        { dAngle: -1.95, len: 0.90, wid: 0.58, asym: -0.12, gap: 10.0 },
        { dAngle: -0.58, len: 0.86, wid: 0.54, asym: 0.14, gap: 10.0 },
        { dAngle: 0.28, len: 1.10, wid: 0.56, asym: 0.15, gap: 11.0 },
        { dAngle: 1.55, len: 0.76, wid: 0.52, asym: -0.08, gap: 9.5 },
      ]),
      crimsonInner: makePetals(3, rHero2 * 0.36, rHero2 * 0.52, 0.54, 0.45, 6.0),
      heartOffset: [-rHero2 * 0.04, -rHero2 * 0.02],
    },
  ];

  return {
    width: W,
    height: H,
    seed: hashString(`vyo-bloom:${totalLoc}:${imports.length}`),
    stems,
    bgTendrils,
    leaves,
    buds,
    twigs,
    blooms,
  };
}
